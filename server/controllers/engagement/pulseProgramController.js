import { Survey, SurveyResponse, PulseProgram } from '../../models/engagement.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import {
    validateSurveyTargeting,
    resolveSurveyEligibleEmployeeIds,
    resolveAnalyticsMinResponses,
    applyThreshold
} from '../../helpers/engagementHelper.js';
import {
    buildOccurrenceKey,
    buildOccurrenceTitle,
    buildPeriodLabel,
    buildOccurrenceEndDate,
    programHasCapacity,
    calculateFirstRunDate,
    calculateNextRunDate,
    openDurationDaysFromFrequency,
    advanceByFrequency
} from '../../helpers/pulseScheduleHelper.js';
import { loadEngagementSettings, isEngagementFeatureEnabled, featureDisabledResponse } from '../../helpers/engagementSettingsHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { notify } from '../../helpers/notificationManager.js';
import logger from '../../helpers/logger.js';

const safeNotify = async (payload) => {
    try { await notify(payload); } catch (err) {
        logger.warn('Pulse notification failed', { type: payload?.type, error: err.message });
    }
};

/* ──── CRUD ──── */

export const createPulseProgram = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const settings = await loadEngagementSettings(organizationId);
    if (!isEngagementFeatureEnabled(settings, 'pulse')) {
        return res.status(403).json(featureDisabledResponse('pulse'));
    }

    const targeting = await validateSurveyTargeting(req.body, organizationId);
    if (!targeting.valid) {
        return res.status(400).json({ success: false, message: targeting.message });
    }

    if (!req.body.questions?.length) {
        return res.status(400).json({ success: false, message: 'At least one question is required.' });
    }

    const program = new PulseProgram({
        organizationId,
        name: req.body.name,
        description: req.body.description,
        frequency: req.body.frequency,
        startDate: req.body.startDate,
        endDate: req.body.endDate || undefined,
        maxOccurrences: req.body.maxOccurrences || undefined,
        ...targeting.normalized,
        anonymous: Boolean(req.body.anonymous),
        questions: req.body.questions,
        reminderEnabled: req.body.reminderEnabled !== false,
        reminderDaysBefore: req.body.reminderDaysBefore ?? 2,
        openDurationDays: req.body.openDurationDays ?? openDurationDaysFromFrequency(req.body.frequency),
        createdBy,
        status: 'Draft'
    });

    await program.save();
    res.status(201).json({ success: true, message: 'Pulse program created', data: program });
});

export const getPulsePrograms = asyncHandler(async (req, res) => {
    const programs = await PulseProgram.find(addOrganizationFilter(req, {}))
        .sort({ updatedAt: -1 })
        .lean();
    res.json({ success: true, data: programs });
});

export const getPulseProgramById = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(
        addOrganizationFilter(req, { _id: req.params.id })
    ).lean();
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });
    res.json({ success: true, data: program });
});

export const updatePulseProgram = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    if (program.status === 'Completed' || program.status === 'Archived') {
        return res.status(400).json({
            success: false,
            message: `Cannot edit a ${program.status} program.`
        });
    }

    const isDraft = program.status === 'Draft';

    if (req.body.questions !== undefined && !isDraft && program.occurrenceCount > 0) {
        // For active programs with generated surveys, updating template is allowed but won't change past surveys
    }

    const targetingFields = ['targetAudience', 'targetDepartments', 'targetRoles', 'targetEmployees'];
    const hasTargetingChange = targetingFields.some((k) => req.body[k] !== undefined);

    if (hasTargetingChange) {
        const merged = {
            targetAudience: req.body.targetAudience ?? program.targetAudience,
            targetDepartments: req.body.targetDepartments ?? program.targetDepartments,
            targetRoles: req.body.targetRoles ?? program.targetRoles,
            targetEmployees: req.body.targetEmployees ?? program.targetEmployees
        };
        const targeting = await validateSurveyTargeting(merged, getOrganizationId(req));
        if (!targeting.valid) {
            return res.status(400).json({ success: false, message: targeting.message });
        }
        Object.assign(program, targeting.normalized);
    }

    const safeFields = isDraft
        ? ['name', 'description', 'frequency', 'startDate', 'endDate', 'maxOccurrences',
           'anonymous', 'questions', 'reminderEnabled', 'reminderDaysBefore', 'openDurationDays']
        : ['name', 'description', 'endDate', 'maxOccurrences',
           'questions', 'reminderEnabled', 'reminderDaysBefore', 'openDurationDays'];

    safeFields.forEach((key) => {
        if (req.body[key] !== undefined) {
            program[key] = req.body[key];
        }
    });

    await program.save();
    res.json({ success: true, message: 'Pulse program updated', data: program });
});

/* ──── LIFECYCLE ──── */

export const activatePulseProgram = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });
    const settings = await loadEngagementSettings(getOrganizationId(req));
    if (!isEngagementFeatureEnabled(settings, 'pulse')) {
        return res.status(403).json(featureDisabledResponse('pulse'));
    }

    if (!['Draft', 'Paused'].includes(program.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot activate a ${program.status} program.`
        });
    }

    if (!program.questions?.length) {
        return res.status(400).json({ success: false, message: 'Program must have at least one question.' });
    }

    if (!programHasCapacity(program)) {
        return res.status(400).json({ success: false, message: 'Program has no remaining capacity.' });
    }

    if (!program.scheduleAnchorDate) {
        program.scheduleAnchorDate = program.startDate;
    }

    program.status = 'Active';
    program.nextRunAt = calculateFirstRunDate(program);
    program.lastGenerationError = undefined;
    await program.save();

    res.json({ success: true, message: 'Pulse program activated', data: program });
});

export const pausePulseProgram = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    if (program.status !== 'Active') {
        return res.status(400).json({ success: false, message: 'Only active programs can be paused.' });
    }

    program.status = 'Paused';
    await program.save();
    res.json({ success: true, message: 'Pulse program paused', data: program });
});

export const resumePulseProgram = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    if (program.status !== 'Paused') {
        return res.status(400).json({ success: false, message: 'Only paused programs can be resumed.' });
    }

    if (!programHasCapacity(program)) {
        program.status = 'Completed';
        await program.save();
        return res.json({ success: true, message: 'Program has no remaining capacity — marked Completed.', data: program });
    }

    program.status = 'Active';
    program.nextRunAt = calculateFirstRunDate(program);
    program.lastGenerationError = undefined;
    await program.save();
    res.json({ success: true, message: 'Pulse program resumed', data: program });
});

export const archivePulseProgram = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(addOrganizationFilter(req, { _id: req.params.id }));
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    if (program.status === 'Active') {
        return res.status(400).json({ success: false, message: 'Pause or complete the program before archiving.' });
    }

    program.status = 'Archived';
    await program.save();
    res.json({ success: true, message: 'Pulse program archived', data: program });
});

/* ──── HISTORY / ANALYTICS ──── */

export const getPulseProgramHistory = asyncHandler(async (req, res) => {
    const program = await PulseProgram.findOne(
        addOrganizationFilter(req, { _id: req.params.id })
    ).lean();
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    const surveys = await Survey.find({
        organizationId: program.organizationId,
        pulseProgramId: program._id
    })
        .select('title status startDate endDate responseCount totalInvites pulsePeriodLabel pulseOccurrenceKey anonymous')
        .sort({ startDate: -1 })
        .lean();

    res.json({
        success: true,
        data: {
            program: {
                _id: program._id,
                name: program.name,
                frequency: program.frequency,
                occurrenceCount: program.occurrenceCount,
                status: program.status
            },
            occurrences: surveys.map((s) => ({
                surveyId: s._id,
                title: s.title,
                period: s.pulsePeriodLabel || s.pulseOccurrenceKey,
                status: s.status,
                startDate: s.startDate,
                endDate: s.endDate,
                responseCount: s.responseCount,
                totalInvites: s.totalInvites,
                participationRate: s.totalInvites > 0
                    ? Number(((s.responseCount / s.totalInvites) * 100).toFixed(1))
                    : 0
            }))
        }
    });
});

export const getPulseProgramAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const minResponses = resolveAnalyticsMinResponses(req);

    const program = await PulseProgram.findOne(
        addOrganizationFilter(req, { _id: req.params.id })
    ).lean();
    if (!program) return res.status(404).json({ success: false, message: 'Pulse program not found' });

    const surveys = await Survey.find({
        organizationId,
        pulseProgramId: program._id
    })
        .select('_id title status startDate endDate responseCount totalInvites pulsePeriodLabel pulseOccurrenceKey anonymous')
        .sort({ startDate: 1 })
        .lean();

    const surveyIds = surveys.map((s) => s._id);

    const eNPSBySurvey = await SurveyResponse.aggregate([
        { $match: { organizationId, surveyId: { $in: surveyIds } } },
        { $unwind: '$responses' },
        { $match: { 'responses.questionType': 'eNPS' } },
        {
            $group: {
                _id: '$surveyId',
                promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                detractors: { $sum: { $cond: [{ $lte: ['$responses.answer', 6] }, 1, 0] } },
                total: { $sum: 1 }
            }
        }
    ]);
    const eNPSMap = new Map(eNPSBySurvey.map((r) => [String(r._id), r]));

    const ratingBySurvey = await SurveyResponse.aggregate([
        { $match: { organizationId, surveyId: { $in: surveyIds } } },
        { $unwind: '$responses' },
        { $match: { 'responses.questionType': { $in: ['Rating', 'Scale'] } } },
        {
            $group: {
                _id: '$surveyId',
                avgRating: { $avg: '$responses.answer' },
                count: { $sum: 1 }
            }
        }
    ]);
    const ratingMap = new Map(ratingBySurvey.map((r) => [String(r._id), r]));

    const occurrences = surveys.map((s) => {
        const period = s.pulsePeriodLabel || s.pulseOccurrenceKey || '';
        const participation = s.totalInvites > 0
            ? Number(((s.responseCount / s.totalInvites) * 100).toFixed(1))
            : 0;

        const eNPSRow = eNPSMap.get(String(s._id));
        let eNPS = null;
        if (eNPSRow && eNPSRow.total >= minResponses) {
            eNPS = Number(
                (((eNPSRow.promoters / eNPSRow.total) * 100) -
                    ((eNPSRow.detractors / eNPSRow.total) * 100)).toFixed(2)
            );
        }

        const ratingRow = ratingMap.get(String(s._id));
        let avgRating = null;
        if (ratingRow && ratingRow.count >= minResponses) {
            avgRating = Number(ratingRow.avgRating.toFixed(2));
        }

        const thresholdResult = applyThreshold(s.responseCount || 0, minResponses);

        return {
            surveyId: s._id,
            title: s.title,
            period,
            status: s.status,
            startDate: s.startDate,
            endDate: s.endDate,
            ...thresholdResult,
            participation: thresholdResult.available ? participation : undefined,
            eNPS: thresholdResult.available ? eNPS : undefined,
            avgRating: thresholdResult.available ? avgRating : undefined
        };
    });

    res.json({
        success: true,
        data: {
            program: {
                _id: program._id,
                name: program.name,
                frequency: program.frequency,
                status: program.status,
                occurrenceCount: program.occurrenceCount
            },
            occurrences,
            minResponses
        }
    });
});

/* ──── SURVEY GENERATION (called by job) ──── */

export const generatePulseOccurrence = async (program) => {
    const now = new Date();
    const occurrenceDate = program.nextRunAt || now;
    const occurrenceKey = buildOccurrenceKey(occurrenceDate);
    const organizationId = program.organizationId;

    // Idempotent — check if already generated
    const existing = await Survey.findOne({
        organizationId,
        pulseProgramId: program._id,
        pulseOccurrenceKey: occurrenceKey
    }).select('_id');

    if (existing) {
        logger.info('Pulse occurrence already exists, skipping', {
            programId: program._id,
            occurrenceKey
        });
        const next = advanceByFrequency(occurrenceDate, program.frequency);
        if (
            (program.endDate && next > new Date(program.endDate)) ||
            (program.maxOccurrences && program.occurrenceCount >= program.maxOccurrences)
        ) {
            program.status = 'Completed';
            program.nextRunAt = undefined;
        } else {
            program.nextRunAt = next;
        }
        await program.save();
        return { skipped: true, surveyId: existing._id };
    }

    const startDate = occurrenceDate;
    const endDate = buildOccurrenceEndDate(startDate, program.openDurationDays);
    const title = buildOccurrenceTitle(program.name, startDate, program.frequency);

    const survey = new Survey({
        organizationId,
        title,
        description: program.description || '',
        type: 'Pulse',
        questions: program.questions.map((q, i) => ({
            question: q.question,
            type: q.type,
            options: q.options || [],
            required: q.required || false,
            order: q.order ?? i
        })),
        targetAudience: program.targetAudience,
        targetDepartments: program.targetDepartments,
        targetRoles: program.targetRoles,
        targetEmployees: program.targetEmployees,
        startDate,
        endDate,
        anonymous: program.anonymous,
        status: 'Active',
        reminderEnabled: program.reminderEnabled,
        reminderDaysBefore: program.reminderDaysBefore,
        createdBy: program.createdBy,
        pulseProgramId: program._id,
        pulseOccurrenceKey: occurrenceKey,
        pulsePeriodLabel: buildPeriodLabel(startDate, program.frequency)
    });

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(survey, organizationId);
    survey.totalInvites = eligibleIds.length;

    try {
        await survey.save();
    } catch (error) {
        if (error?.code === 11000) {
            logger.info('Pulse occurrence duplicate key, treating as skip', {
                programId: program._id,
                occurrenceKey
            });
            const next = advanceByFrequency(occurrenceDate, program.frequency);
            if (
                (program.endDate && next > new Date(program.endDate)) ||
                (program.maxOccurrences && program.occurrenceCount >= program.maxOccurrences)
            ) {
                program.status = 'Completed';
                program.nextRunAt = undefined;
            } else {
                program.nextRunAt = next;
            }
            await program.save();
            return { skipped: true };
        }
        throw error;
    }

    // Trigger normal survey assignment notification
    await safeNotify({
        type: 'engagement.survey.assigned',
        organizationId,
        data: { survey }
    });

    // Advance program
    program.occurrenceCount = (program.occurrenceCount || 0) + 1;
    program.lastRunAt = now;
    program.lastGenerationError = undefined;

    const nextRun = calculateNextRunDate(program, startDate);
    if (nextRun) {
        program.nextRunAt = nextRun;
    } else {
        program.status = 'Completed';
        program.nextRunAt = undefined;
    }

    await program.save();

    logger.info('Pulse survey generated', {
        programId: program._id,
        surveyId: survey._id,
        occurrenceKey,
        nextRunAt: program.nextRunAt || 'none (completed)'
    });

    return { skipped: false, surveyId: survey._id };
};
