import Employee from '../../models/employee.model.js';
import Organization from '../../models/organization.model.js';
import {
    Survey,
    SurveyResponse,
    Feedback,
    Recognition,
    SUGGESTION_STATUSES,
    RECOGNITION_TYPES,
    EngagementActionPlan,
    WELLBEING_TEMPLATE_QUESTIONS
} from '../../models/engagement.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import {
    loadRequestEmployee,
    isEngagementManager,
    surveyMatchesEmployee,
    isSurveyActiveForResponse,
    filterSurveysForEmployee,
    getRequestActorId,
    buildAnonymousHash,
    sanitizeFeedbackDocument,
    sanitizeFeedbackList,
    defaultStatusForFeedbackType,
    canManageEngagementFeedback,
    validateSuggestionStatusTransition,
    employeeOwnsFeedback,
    sanitizeSurveyResponses,
    resolveAnalyticsMinResponses,
    applyThreshold,
    resolveEngagementAnalyticsScope,
    getManagedTeamEmployeeIds,
    resolveSurveyEligibleEmployeeIds,
    resolveAnalyticsDateRange,
    buildSurveyQuestionAnalytics,
    buildSurveyResponseTrends,
    buildTrendGroupId,
    formatTrendPeriod,
    validateSurveyTargeting,
    validateSurveyStructuralUpdate,
    buildRichDepartmentBreakdown,
    canManageRecognition,
    isRecognitionHrCreator,
    loadRecognitionApprovalRequired,
    canEmployeeViewRecognition,
    buildRecognitionDateFilter,
    resolveRecognitionListScope,
    validateRecognitionPayload,
    getRecognitionRecipientEmployeeIds,
    formatRecognitionRecipientLabel
} from '../../helpers/engagementHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { notify } from '../../helpers/notificationManager.js';
import logger from '../../helpers/logger.js';
import { hasPermission } from '../../helpers/permissionService.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import { csvRow, feedbackDisplayName, recognitionDisplayName, writeCsvBom, writeReportMetadata, writeMetricsTable, formatExportDateTime, formatDateRangeLabel, formatScopeLabel, formatAnswerValue, formatHrReply, getLastUpdated, exportFilename, surveyEmployeeFields, buildSummaryMetricsFromAnalytics } from '../../helpers/engagementExportHelper.js';
import {
    loadEngagementSettings,
    isEngagementFeatureEnabled,
    featureDisabledResponse,
    resolveOrgAnalyticsMinResponses,
    buildEngagementPrivacySummary,
    ENGAGEMENT_NOTIFICATION_KEYS,
    LIFECYCLE_TRIGGER_KEYS
} from '../../helpers/engagementSettingsHelper.js';

const safeNotify = async (payload) => {
    try {
        const settings = await loadEngagementSettings(payload.organizationId);
        const type = payload?.type;
        if (type === 'engagement.survey.assigned' && !settings.notifications.surveyAssigned) return;
        if (
            (type === 'engagement.survey.reminder' || type === 'engagement.survey.closing') &&
            !settings.notifications.surveyReminder
        ) {
            return;
        }
        if (type === 'engagement.recognition.received' && !settings.notifications.recognitionReceived) return;
        if (type === 'engagement.lifecycle.survey_assigned' && !settings.notifications.lifecycleSurveyAssigned) {
            return;
        }
        if (type === 'engagement.suggestion.implemented' && !settings.notifications.suggestionImplemented) {
            return;
        }
        await notify(payload);
    } catch (err) {
        logger.warn('Engagement notification failed', { type: payload?.type, error: err.message });
    }
};

/**
 * Create survey
 */
export const createSurvey = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const settings = await loadEngagementSettings(organizationId);
    if (req.body.type === 'Pulse' && !isEngagementFeatureEnabled(settings, 'pulse')) {
        return res.status(403).json(featureDisabledResponse('pulse'));
    }
    if (req.body.type !== 'Pulse' && !isEngagementFeatureEnabled(settings, 'surveys')) {
        return res.status(403).json(featureDisabledResponse('surveys'));
    }

    const targeting = await validateSurveyTargeting(req.body, organizationId);
    if (!targeting.valid) {
        return res.status(400).json({
            success: false,
            message: targeting.message
        });
    }

    const survey = new Survey({
        ...req.body,
        ...targeting.normalized,
        organizationId,
        createdBy,
        reminderEnabled: req.body.reminderEnabled !== false,
        reminderDaysBefore: req.body.reminderDaysBefore ?? 2
    });

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(survey, organizationId);
    survey.totalInvites = eligibleIds.length;

    await survey.save();

    if (survey.status === 'Active') {
        await safeNotify({
            type: 'engagement.survey.assigned',
            organizationId,
            data: { survey }
        });
    }

    res.status(201).json({
        success: true,
        message: 'Survey created successfully',
        data: survey
    });
});

/**
 * Get surveys
 */
export const getSurveys = asyncHandler(async (req, res) => {
    const { status, type, page = 1, limit = 20, lifecycleOnly, lifecycleTrigger } = req.query;
    const employee = await loadRequestEmployee(req);
    const manager = isEngagementManager(req, employee);

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    else if (!manager) query.status = 'Active';

    if (type) query.type = type;

    if (lifecycleOnly === 'true' || lifecycleOnly === '1') {
        query.lifecycleTrigger = { $exists: true, $ne: null };
    }
    if (lifecycleTrigger) {
        query.lifecycleTrigger = lifecycleTrigger;
    }

    const parsedLimit = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    if (!manager && employee) {
        const allActive = await Survey.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .lean();
        const filtered = filterSurveysForEmployee(allActive, employee);
        const paged = filtered.slice(skip, skip + parsedLimit);
        return res.json({
            success: true,
            data: paged,
            pagination: {
                page: parseInt(page, 10),
                limit: parsedLimit,
                total: filtered.length,
                pages: Math.ceil(filtered.length / parsedLimit) || 1
            }
        });
    }

    const [surveys, total] = await Promise.all([
        Survey.find(query)
            .populate('createdBy', 'name email')
            .populate('lifecycleEmployeeId', 'name lastName department status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit),
        Survey.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: surveys,
        pagination: {
            page: parseInt(page, 10),
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit) || 1
        }
    });
});

/**
 * Employee survey inbox with completion state
 */
export const getMySurveys = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);

    if (!employee?._id) {
        return res.status(403).json({
            success: false,
            message: 'Only employees can view survey inbox'
        });
    }

    const surveys = await Survey.find({
        organizationId,
        status: { $in: ['Active', 'Closed'] }
    })
        .sort({ endDate: 1 })
        .lean();

    const eligible = surveys.filter((s) => surveyMatchesEmployee(s, employee));
    const surveyIds = eligible.map((s) => s._id);
    const respondentHash = buildAnonymousHash(organizationId, employee._id, 'survey');

    const myResponses = await SurveyResponse.find({
        organizationId,
        surveyId: { $in: surveyIds },
        $or: [
            { employeeId: employee._id },
            { respondentHash }
        ]
    })
        .select('surveyId submittedAt isAnonymous')
        .lean();

    const respondedMap = new Map(myResponses.map((r) => [String(r.surveyId), r]));
    const now = Date.now();

    const data = eligible.map((s) => {
        const resp = respondedMap.get(String(s._id));
        const startOk = !s.startDate || new Date(s.startDate).getTime() <= now;
        const endOk = !s.endDate || new Date(s.endDate).getTime() >= now;
        const canRespond = s.status === 'Active' && startOk && endOk && !resp;
        let completionState = 'pending';
        if (resp) completionState = 'completed';
        else if (s.status === 'Closed' || (s.endDate && new Date(s.endDate).getTime() < now)) {
            completionState = 'expired';
        } else if (!startOk) {
            completionState = 'upcoming';
        }

        return {
            _id: s._id,
            title: s.title,
            description: s.description,
            type: s.type,
            status: s.status,
            anonymous: Boolean(s.anonymous),
            startDate: s.startDate,
            endDate: s.endDate,
            completionState,
            completedAt: resp?.submittedAt || null,
            canRespond
        };
    });

    res.json({ success: true, data });
});

/**
 * Get single survey by id
 */
export const getSurveyById = asyncHandler(async (req, res) => {
    const { surveyId } = req.params;
    const employee = await loadRequestEmployee(req);
    const manager = isEngagementManager(req, employee);

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId }))
        .populate('createdBy', 'name lastName email');

    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    if (!manager) {
        if (!employee) {
            return res.status(403).json({
                success: false,
                message: 'Employee access required'
            });
        }
        if (!surveyMatchesEmployee(survey, employee)) {
            return res.status(403).json({
                success: false,
                message: 'This survey is not available for you'
            });
        }
        if (!['Active', 'Closed'].includes(survey.status)) {
            return res.status(403).json({
                success: false,
                message: 'This survey is not available yet'
            });
        }
    }

    res.json({
        success: true,
        data: survey
    });
});

/**
 * Admin/HR: Update survey
 */
export const updateSurvey = asyncHandler(async (req, res) => {
    const { surveyId } = req.params;
    const organizationId = getOrganizationId(req);

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId }));
    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    const responseCount = survey.responseCount || 0;
    const structuralCheck = validateSurveyStructuralUpdate(survey, req.body, responseCount);
    if (!structuralCheck.valid) {
        return res.status(400).json({
            success: false,
            message: structuralCheck.message
        });
    }

    const targetingFields = [
        'targetAudience',
        'targetDepartments',
        'targetRoles',
        'targetEmployees'
    ];
    const hasTargetingChange = targetingFields.some((key) => req.body[key] !== undefined);
    let normalizedTargeting = null;

    if (hasTargetingChange || req.body.targetAudience !== undefined) {
        const merged = {
            targetAudience: req.body.targetAudience ?? survey.targetAudience,
            targetDepartments: req.body.targetDepartments ?? survey.targetDepartments,
            targetRoles: req.body.targetRoles ?? survey.targetRoles,
            targetEmployees: req.body.targetEmployees ?? survey.targetEmployees
        };
        const targeting = await validateSurveyTargeting(merged, organizationId);
        if (!targeting.valid) {
            return res.status(400).json({
                success: false,
                message: targeting.message
            });
        }
        normalizedTargeting = targeting.normalized;
    }

    const previousStatus = survey.status;

    const allowed = [
        'title',
        'description',
        'type',
        'questions',
        'targetAudience',
        'targetDepartments',
        'targetRoles',
        'targetEmployees',
        'startDate',
        'endDate',
        'anonymous',
        'status',
        'reminderEnabled',
        'reminderDaysBefore'
    ];

    allowed.forEach((key) => {
        if (req.body[key] !== undefined) {
            survey[key] = req.body[key];
        }
    });

    if (normalizedTargeting) {
        survey.targetAudience = normalizedTargeting.targetAudience;
        survey.targetDepartments = normalizedTargeting.targetDepartments;
        survey.targetRoles = normalizedTargeting.targetRoles;
        survey.targetEmployees = normalizedTargeting.targetEmployees;
    }

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(survey, organizationId);
    survey.totalInvites = eligibleIds.length;

    await survey.save();

    if (previousStatus !== 'Active' && survey.status === 'Active') {
        await safeNotify({
            type: 'engagement.survey.assigned',
            organizationId: survey.organizationId,
            data: { survey }
        });
    }

    res.json({
        success: true,
        message: 'Survey updated successfully',
        data: survey
    });
});

/**
 * Admin/HR: Delete survey and its responses
 */
export const deleteSurvey = asyncHandler(async (req, res) => {
    const { surveyId } = req.params;
    const organizationId = getOrganizationId(req);

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId }));
    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    await SurveyResponse.deleteMany({
        organizationId,
        surveyId: survey._id
    });
    await survey.deleteOne();

    res.json({
        success: true,
        message: 'Survey deleted successfully'
    });
});

/**
 * Admin/HR: Get responses for a survey
 */
export const getSurveyResponses = asyncHandler(async (req, res) => {
    const { surveyId } = req.params;
    const { page = 1, limit = 25 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (parsedPage - 1) * parsedLimit;

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId }));
    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    const baseQuery = {
        organizationId: getOrganizationId(req),
        surveyId: survey._id
    };

    const [total, responses] = await Promise.all([
        SurveyResponse.countDocuments(baseQuery),
        SurveyResponse.find(baseQuery)
            .populate('employeeId', 'name lastName email employeeId')
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 1;

    res.json({
        success: true,
        data: sanitizeSurveyResponses(responses, survey.anonymous),
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages,
            hasNext: parsedPage < totalPages,
            hasPrev: parsedPage > 1
        }
    });
});

/**
 * Survey-level analytics (eligible audience, question aggregates, trends).
 * Org vs team scope enforced server-side; privacy floor via resolveAnalyticsMinResponses.
 */
export const getSurveyAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { surveyId } = req.params;
    const minResponses = resolveAnalyticsMinResponses(req);
    const dateWindow = resolveAnalyticsDateRange(req);

    const scope = resolveEngagementAnalyticsScope(req.authContext);
    let effectiveScope = scope;
    if (
        !effectiveScope &&
        req.authContext &&
        (hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE) ||
            hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_MANAGE))
    ) {
        effectiveScope = 'org';
    }

    if (!effectiveScope) {
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions for survey analytics',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId })).lean();
    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    let teamIds = null;
    if (effectiveScope === 'team') {
        const employee = await loadRequestEmployee(req);
        const managerId = employee?._id || req.employee?._id;
        if (!managerId) {
            return res.status(403).json({
                success: false,
                message: 'Employee profile required for team analytics',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        teamIds = await getManagedTeamEmployeeIds(organizationId, managerId);

        // Anonymous responses cannot be attributed to a team
        if (survey.anonymous) {
            return res.json({
                success: true,
                data: {
                    scope: 'team',
                    surveyId: survey._id,
                    title: survey.title,
                    type: survey.type,
                    status: survey.status,
                    anonymous: true,
                    startDate: survey.startDate,
                    endDate: survey.endDate,
                    minResponses,
                    overview: {
                        available: false,
                        message:
                            'Team analytics are not available for anonymous surveys because responses cannot be attributed to your team.'
                    },
                    questions: [],
                    eNPS: null,
                    trends: { available: false, range: dateWindow.range, points: [] },
                    privacyNote:
                        'Anonymous survey responses are organization-scoped only. Team-level analytics require identified responses.'
                }
            });
        }
    }

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(survey, organizationId, {
        restrictToIds: effectiveScope === 'team' ? teamIds : null
    });
    const eligibleCount = eligibleIds.length;

    const responseMatch = {
        organizationId,
        surveyId: survey._id
    };
    if (effectiveScope === 'team') {
        responseMatch.employeeId = { $in: teamIds || [] };
        responseMatch.isAnonymous = { $ne: true };
    }

    const allResponses = await SurveyResponse.find(responseMatch)
        .select('responses submittedAt createdAt employeeId isAnonymous')
        .lean();

    const totalResponses = allResponses.length;
    const overviewAvailable = totalResponses >= minResponses;

    let pending = null;
    let participationRate = null;
    let completionRate = null;

    if (overviewAvailable) {
        // Identified surveys: pending = eligible − unique respondents among eligible
        // Anonymous: aggregate only (no identity); pending still as eligible − responses
        if (survey.anonymous || effectiveScope === 'team') {
            pending = Math.max(0, eligibleCount - totalResponses);
        } else {
            const respondentSet = new Set(
                allResponses
                    .map((r) => (r.employeeId ? String(r.employeeId) : null))
                    .filter(Boolean)
            );
            pending = Math.max(0, eligibleCount - respondentSet.size);
        }
        participationRate =
            eligibleCount > 0
                ? Number(((totalResponses / eligibleCount) * 100).toFixed(2))
                : totalResponses > 0
                  ? 100
                  : 0;
        // Single-submit surveys: completion ≈ participation (full form submit)
        completionRate = participationRate;
    }

    const questionAnalytics = overviewAvailable
        ? buildSurveyQuestionAnalytics(survey, allResponses, minResponses)
        : [];

    const enpsQuestions = (questionAnalytics || []).filter(
        (q) => q.questionType === 'eNPS' && q.available
    );
    const suppressedEnps = (questionAnalytics || []).find(
        (q) => q.questionType === 'eNPS' && !q.available && q.message
    );
    const eNPSSummary = !overviewAvailable
        ? {
              available: false,
              minResponses,
              message: 'Not enough responses to display analytics.'
          }
        : enpsQuestions.length > 0
          ? {
                available: true,
                promoters: enpsQuestions[0].promoters,
                passives: enpsQuestions[0].passives,
                detractors: enpsQuestions[0].detractors,
                promoterPct: enpsQuestions[0].promoterPct,
                passivePct: enpsQuestions[0].passivePct,
                detractorPct: enpsQuestions[0].detractorPct,
                eNPS: enpsQuestions[0].eNPS ?? enpsQuestions[0].score,
                responseCount: enpsQuestions[0].responseCount,
                minResponses,
                legacy: Boolean(enpsQuestions[0].legacy)
            }
          : {
                available: false,
                minResponses,
                message:
                    suppressedEnps?.message ||
                    'No eNPS question in this survey (or below privacy threshold).'
            };

    const trendResponses = allResponses.filter((doc) => {
        const submitted = doc.submittedAt || doc.createdAt;
        if (!submitted) return false;
        const t = new Date(submitted).getTime();
        return t >= dateWindow.start.getTime() && t <= dateWindow.end.getTime();
    });

    const trendPoints = overviewAvailable
        ? buildSurveyResponseTrends(trendResponses, survey, dateWindow)
        : [];

    // Sync totalInvites for org scope so list views stay reasonable (best-effort)
    if (effectiveScope === 'org' && survey.totalInvites !== eligibleCount) {
        Survey.updateOne({ _id: survey._id }, { $set: { totalInvites: eligibleCount } }).catch(
            () => {}
        );
    }

    res.json({
        success: true,
        data: {
            scope: effectiveScope,
            surveyId: survey._id,
            title: survey.title,
            type: survey.type,
            status: survey.status,
            anonymous: Boolean(survey.anonymous),
            targetAudience: survey.targetAudience,
            startDate: survey.startDate,
            endDate: survey.endDate,
            minResponses,
            overview: overviewAvailable
                ? {
                      available: true,
                      eligible: eligibleCount,
                      responses: totalResponses,
                      pending,
                      participationRate,
                      completionRate,
                      minResponses
                  }
                : {
                      available: false,
                      minResponses,
                      message: 'Not enough responses to display analytics.'
                  },
            questions: questionAnalytics,
            eNPS: eNPSSummary,
            trends: {
                available: overviewAvailable && trendPoints.length > 0,
                range: dateWindow.range,
                startDate: dateWindow.start,
                endDate: dateWindow.end,
                points: overviewAvailable ? trendPoints : [],
                message:
                    overviewAvailable && trendPoints.length === 0
                        ? 'No response trend data in the selected date range.'
                        : overviewAvailable
                          ? undefined
                          : 'Not enough responses to display analytics.'
            },
            privacyNote: survey.anonymous
                ? 'Anonymous survey analytics are aggregate-only. Free-text answers are excluded. Groups below the minimum response threshold are suppressed.'
                : 'Groups below the minimum response threshold are suppressed. Free-text answers are excluded from aggregate analytics.'
        }
    });
});

/**
 * Submit survey response
 */
export const submitSurveyResponse = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { surveyId } = req.params;
    const employeeId = req.employee?._id;

    if (!employeeId) {
        return res.status(403).json({
            success: false,
            message: 'Only employees can submit survey responses'
        });
    }

    const employee = await loadRequestEmployee(req);

    const survey = await Survey.findOne({
        _id: surveyId,
        organizationId
    });

    if (!survey) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    if (!surveyMatchesEmployee(survey, employee)) {
        return res.status(403).json({
            success: false,
            message: 'This survey is not assigned to you'
        });
    }

    if (!isSurveyActiveForResponse(survey)) {
        return res.status(400).json({
            success: false,
            message: 'Survey is not open for responses'
        });
    }

    const respondentHash = buildAnonymousHash(organizationId, employeeId, 'survey');

    if (survey.anonymous) {
        const existingAnon = await SurveyResponse.findOne({
            organizationId,
            surveyId,
            respondentHash
        });
        if (existingAnon) {
            return res.status(400).json({
                success: false,
                message: 'Already responded to this survey'
            });
        }
    } else {
        const existingResponse = await SurveyResponse.findOne({
            organizationId,
            surveyId,
            employeeId
        });
        if (existingResponse) {
            return res.status(400).json({
                success: false,
                message: 'Already responded to this survey'
            });
        }
    }

    const questionTypeMap = new Map(
        (survey.questions || []).map((q) => [String(q._id), q.type])
    );

    const normalizedResponses = (req.body.responses || []).map((r) => ({
        ...r,
        questionType: r.questionType || questionTypeMap.get(String(r.questionId)) || undefined
    }));

    const response = new SurveyResponse({
        organizationId,
        surveyId,
        employeeId: survey.anonymous ? null : employeeId,
        respondentHash: survey.anonymous ? respondentHash : undefined,
        responses: normalizedResponses,
        isAnonymous: survey.anonymous,
        timeSpent: req.body.timeSpent
    });

    await response.save();

    survey.responseCount += 1;
    await survey.save();

    const safeData = response.toObject();
    delete safeData.respondentHash;
    if (survey.anonymous) safeData.employeeId = null;

    res.status(201).json({
        success: true,
        message: 'Survey response submitted successfully',
        data: safeData
    });
});

/**
 * Create feedback (privacy-safe anonymous)
 */
export const createFeedback = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;
    const settings = await loadEngagementSettings(organizationId);
    const feedbackType = req.body.type || 'Other';
    const feature = feedbackType === 'Suggestion' ? 'suggestions' : 'feedback';
    if (!isEngagementFeatureEnabled(settings, feature)) {
        return res.status(403).json(featureDisabledResponse(feature));
    }

    if (!employeeId) {
        return res.status(403).json({
            success: false,
            message: 'Only employees can submit feedback'
        });
    }

    const { subject, message, type, category, priority, anonymous } = req.body;
    const isAnonymous = Boolean(anonymous);

    if (isAnonymous) {
        const canAnonymous =
            hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_FEEDBACK_ANONYMOUS) ||
            req.authContext?.isOrgOwner;
        if (!canAnonymous) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to submit anonymous feedback',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
    }

    const status = defaultStatusForFeedbackType(feedbackType);

    const feedbackPayload = {
        organizationId,
        subject,
        message,
        type: feedbackType,
        category,
        priority,
        anonymous: isAnonymous,
        status,
        employeeId: isAnonymous ? null : employeeId,
        submitterHash: isAnonymous
            ? buildAnonymousHash(organizationId, employeeId, 'feedback')
            : undefined
    };

    const feedback = new Feedback(feedbackPayload);
    await feedback.save();

    await safeNotify({
        type: 'engagement.feedback.received',
        organizationId,
        data: {
            feedback: {
                _id: feedback._id,
                subject: feedback.subject,
                type: feedback.type,
                anonymous: feedback.anonymous
            }
        }
    });

    // Return sanitized — never expose identity for anonymous
    const populated = isAnonymous
        ? null
        : await Feedback.findById(feedback._id).populate('employeeId', 'name lastName email');

    const data = sanitizeFeedbackDocument(populated || feedback);

    res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data
    });
});

/**
 * Get feedbacks — anonymous identity never exposed
 */
export const getFeedbacks = asyncHandler(async (req, res) => {
    const { status, type, category, page = 1, limit = 20 } = req.query;
    const employee = await loadRequestEmployee(req);
    const manager =
        isEngagementManager(req, employee) || canManageEngagementFeedback(req.authContext);
    const organizationId = getOrganizationId(req);

    const query = addOrganizationFilter(req, {});

    if (!manager) {
        if (!employee?._id) {
            return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
        }
        const submitterHash = buildAnonymousHash(organizationId, employee._id, 'feedback');
        query.$or = [
            { employeeId: employee._id },
            { submitterHash, anonymous: true }
        ];
    } else if (req.query.employeeId) {
        query.employeeId = req.query.employeeId;
        query.anonymous = { $ne: true };
    }

    if (status) query.status = status;
    if (type) query.type = type;
    if (category) query.category = category;

    const parsedLimit = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    const [feedbacks, total] = await Promise.all([
        Feedback.find(query)
            .select('+submitterHash')
            .populate('employeeId', 'name lastName email department')
            .populate('assignedTo', 'name lastName email')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parsedLimit),
        Feedback.countDocuments(query)
    ]);

    const stripInternal = !manager;
    const data = sanitizeFeedbackList(feedbacks, { stripInternal });

    res.json({
        success: true,
        data,
        pagination: {
            page: parseInt(page, 10),
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit) || 1
        }
    });
});

/**
 * Get single feedback/suggestion — scoped to owner or HR/Admin manage permission
 */
export const getFeedbackById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const employee = await loadRequestEmployee(req);
    const organizationId = getOrganizationId(req);
    const manager =
        isEngagementManager(req, employee) || canManageEngagementFeedback(req.authContext);

    const feedback = await Feedback.findOne(addOrganizationFilter(req, { _id: id }))
        .select('+submitterHash')
        .populate('employeeId', 'name lastName email department')
        .populate('assignedTo', 'name lastName email')
        .populate('responses.respondedBy', 'name lastName email')
        .populate('internalRemarks.addedBy', 'name lastName email');

    if (!feedback) {
        return res.status(404).json({
            success: false,
            message: 'Feedback not found'
        });
    }

    if (!manager && !employeeOwnsFeedback(feedback, employee, organizationId)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    res.json({
        success: true,
        data: sanitizeFeedbackDocument(feedback, { stripInternal: !manager })
    });
});

/**
 * Admin/HR: Update feedback status or add HR reply
 */
export const updateFeedback = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, priority, hrResponse, internalRemark, resolutionNote, implementationDate } =
        req.body;

    const feedback = await Feedback.findOne(addOrganizationFilter(req, { _id: id })).select('+submitterHash');
    if (!feedback) {
        return res.status(404).json({
            success: false,
            message: 'Feedback not found'
        });
    }

    const previousStatus = feedback.status;

    if (status && status !== feedback.status) {
        if (feedback.type === 'Suggestion') {
            const transition = validateSuggestionStatusTransition(feedback.status, status);
            if (!transition.valid) {
                return res.status(400).json({
                    success: false,
                    message: transition.message
                });
            }
            if (status === 'Implemented') {
                const note = resolutionNote !== undefined
                    ? String(resolutionNote).trim()
                    : String(feedback.resolutionNote || '').trim();
                if (!note) {
                    return res.status(400).json({
                        success: false,
                        message: 'A short resolution / outcome note is required when marking a suggestion as Implemented'
                    });
                }
            }
        }
        feedback.status = status;
        if (['Resolved', 'Closed', 'Implemented', 'Rejected'].includes(status)) {
            feedback.resolvedAt = new Date();
            feedback.resolvedBy = getRequestActorId(req);
        }
        if (status === 'Implemented' && !feedback.implementationDate && !implementationDate) {
            feedback.implementationDate = new Date();
        }
    }
    if (priority) feedback.priority = priority;

    if (hrResponse && String(hrResponse).trim()) {
        const responderId = getRequestActorId(req);
        feedback.responses = feedback.responses || [];
        feedback.responses.push({
            respondedBy: responderId,
            response: String(hrResponse).trim(),
            respondedAt: new Date()
        });
        if (feedback.type === 'Suggestion' && feedback.status === 'Submitted') {
            const transition = validateSuggestionStatusTransition(feedback.status, 'Under Review');
            if (transition.valid) {
                feedback.status = 'Under Review';
            }
        } else if (feedback.status === 'Open') {
            feedback.status = 'In Review';
        }
    }

    if (internalRemark && String(internalRemark).trim()) {
        feedback.internalRemarks = feedback.internalRemarks || [];
        feedback.internalRemarks.push({
            remark: String(internalRemark).trim(),
            addedBy: getRequestActorId(req),
            addedAt: new Date()
        });
    }

    if (resolutionNote !== undefined) {
        feedback.resolutionNote = String(resolutionNote).trim() || undefined;
    }
    if (implementationDate !== undefined) {
        feedback.implementationDate = implementationDate ? new Date(implementationDate) : undefined;
    }

    await feedback.save();

    const statusChanged = previousStatus !== feedback.status;
    const isSuggestion = feedback.type === 'Suggestion';
    const becameImplemented = isSuggestion && statusChanged && feedback.status === 'Implemented';

    if (statusChanged && feedback.employeeId && !feedback.anonymous) {
        if (becameImplemented) {
            await safeNotify({
                type: 'engagement.suggestion.implemented',
                organizationId: feedback.organizationId,
                data: {
                    feedback: {
                        _id: feedback._id,
                        subject: feedback.subject,
                        status: feedback.status,
                        type: feedback.type,
                        resolutionNote: feedback.resolutionNote
                    },
                    employeeId: feedback.employeeId
                }
            });
        } else {
            const eventType = isSuggestion
                ? 'engagement.suggestion.status_updated'
                : 'engagement.feedback.status_updated';

            await safeNotify({
                type: eventType,
                organizationId: feedback.organizationId,
                data: {
                    feedback: {
                        _id: feedback._id,
                        subject: feedback.subject,
                        status: feedback.status,
                        type: feedback.type
                    },
                    employeeId: feedback.employeeId
                }
            });
        }
    }

    const populated = await Feedback.findById(feedback._id)
        .populate('employeeId', 'name lastName email department')
        .populate('assignedTo', 'name lastName email')
        .populate('responses.respondedBy', 'name lastName email')
        .populate('internalRemarks.addedBy', 'name lastName email');

    res.json({
        success: true,
        message: 'Feedback updated successfully',
        data: sanitizeFeedbackDocument(populated)
    });
});

/**
 * Get engagement module settings (HR)
 */
export const getEngagementSettings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await loadEngagementSettings(organizationId);
    res.json({ success: true, data });
});

/**
 * Public read-only settings for employee/manager UI (feature flags + defaults + privacy summary).
 */
export const getPublicEngagementSettings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await loadEngagementSettings(organizationId);
    res.json({
        success: true,
        data: {
            ...data,
            privacy: buildEngagementPrivacySummary(data)
        }
    });
});

export const getWellbeingTemplate = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            type: 'Wellbeing',
            anonymous: true,
            questions: WELLBEING_TEMPLATE_QUESTIONS
        }
    });
});

/**
 * Update engagement module settings (HR)
 */
export const updateEngagementSettings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const org = await Organization.findById(organizationId);
    if (!org) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    if (!org.settings) org.settings = {};
    if (!org.settings.engagement) org.settings.engagement = {};
    const current = org.settings.engagement;

    if (req.body.recognitionRequireApproval !== undefined) {
        current.recognitionRequireApproval = Boolean(req.body.recognitionRequireApproval);
    }
    if (req.body.anonymousFeedbackDefault !== undefined) {
        current.anonymousFeedbackDefault = Boolean(req.body.anonymousFeedbackDefault);
    }
    if (req.body.analyticsMinResponses !== undefined) {
        const n = parseInt(req.body.analyticsMinResponses, 10);
        current.analyticsMinResponses = Number.isNaN(n)
            ? 5
            : Math.min(50, Math.max(5, n));
    }
    if (req.body.features && typeof req.body.features === 'object') {
        if (!current.features) current.features = {};
        ['surveys', 'feedback', 'suggestions', 'recognition', 'pulse'].forEach((key) => {
            if (req.body.features[key] !== undefined) {
                current.features[key] = Boolean(req.body.features[key]);
            }
        });
    }
    if (req.body.notifications && typeof req.body.notifications === 'object') {
        if (!current.notifications) current.notifications = {};
        ENGAGEMENT_NOTIFICATION_KEYS.forEach((key) => {
            if (req.body.notifications[key] !== undefined) {
                current.notifications[key] = Boolean(req.body.notifications[key]);
            }
        });
    }
    if (req.body.lifecycle && typeof req.body.lifecycle === 'object') {
        if (!current.lifecycle) current.lifecycle = {};
        if (req.body.lifecycle.enabled !== undefined) {
            current.lifecycle.enabled = Boolean(req.body.lifecycle.enabled);
        }
        LIFECYCLE_TRIGGER_KEYS.forEach((key) => {
            if (req.body.lifecycle[key] !== undefined) {
                current.lifecycle[key] = Boolean(req.body.lifecycle[key]);
            }
        });
        if (req.body.lifecycle.openDurationDays !== undefined) {
            const n = parseInt(req.body.lifecycle.openDurationDays, 10);
            current.lifecycle.openDurationDays = Number.isNaN(n)
                ? 7
                : Math.min(30, Math.max(3, n));
        }
        if (req.body.lifecycle.anonymous !== undefined) {
            current.lifecycle.anonymous = Boolean(req.body.lifecycle.anonymous);
        }
    }

    org.markModified('settings');
    await org.save();

    res.json({
        success: true,
        message: 'Engagement settings updated',
        data: await loadEngagementSettings(organizationId)
    });
});

/**
 * Create recognition (peer or HR)
 */
export const createRecognition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const settings = await loadEngagementSettings(organizationId);
    if (!isEngagementFeatureEnabled(settings, 'recognition')) {
        return res.status(403).json(featureDisabledResponse('recognition'));
    }
    const employee = await loadRequestEmployee(req);
    const givenBy = employee?._id || getRequestActorId(req);
    const isHr = isRecognitionHrCreator(req, employee);

    if (!givenBy) {
        return res.status(403).json({
            success: false,
            message: 'Authentication required'
        });
    }

    const validation = await validateRecognitionPayload(req.body, organizationId, givenBy);
    if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.message });
    }

    const { recipientType, recipientId, recipientIds, targetDepartment, teamLabel } = validation.normalized;
    const { type, title, description, badge, isPublic = true } = req.body;
    let points = Number(req.body.points) || 0;

    if (!isHr) {
        points = Math.min(Math.max(0, points), 10);
    } else {
        points = Math.min(Math.max(0, points), 100);
    }

    const requireApproval = isHr ? false : await loadRecognitionApprovalRequired(organizationId);
    const initialStatus = requireApproval ? 'Pending' : 'Approved';

    const recognition = new Recognition({
        organizationId,
        recipientId,
        recipientType,
        recipientIds,
        targetDepartment,
        teamLabel,
        givenBy,
        type,
        title: String(title).slice(0, 200),
        description: description ? String(description).slice(0, 2000) : undefined,
        points,
        badge: badge ? String(badge).slice(0, 80) : undefined,
        isPublic: Boolean(isPublic),
        status: initialStatus,
        approvedBy: initialStatus === 'Approved' ? givenBy : undefined,
        approvedAt: initialStatus === 'Approved' ? new Date() : undefined
    });

    await recognition.save();

    if (initialStatus === 'Approved') {
        await safeNotify({
            type: 'engagement.recognition.received',
            organizationId,
            data: {
                recognition: {
                    _id: recognition._id,
                    title: recognition.title,
                    type: recognition.type,
                    recipientType: recognition.recipientType,
                    teamLabel: recognition.teamLabel,
                    targetDepartment: recognition.targetDepartment
                },
                recipientId,
                recipientIds,
                givenBy
            }
        });
    } else {
        await safeNotify({
            type: 'engagement.recognition.pending_approval',
            organizationId,
            data: {
                recognition: {
                    _id: recognition._id,
                    title: recognition.title,
                    type: recognition.type,
                    recipientType: recognition.recipientType,
                    teamLabel: recognition.teamLabel,
                    targetDepartment: recognition.targetDepartment
                },
                givenBy
            }
        });
    }

    const populated = await Recognition.findById(recognition._id)
        .populate('recipientId', 'name lastName email department')
        .populate('recipientIds', 'name lastName email department')
        .populate('givenBy', 'name lastName email department');

    const data = populated.toObject();
    data.recipientLabel = formatRecognitionRecipientLabel(data);

    res.status(201).json({
        success: true,
        message:
            initialStatus === 'Pending'
                ? 'Recognition submitted for approval'
                : 'Recognition published successfully',
        data
    });
});

/**
 * Get recognitions (wall / mine / HR manage)
 */
export const getRecognitions = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    const scope = await resolveRecognitionListScope(req, employee, organizationId);
    const {
        recipientId,
        givenBy,
        mine,
        status,
        type,
        category,
        startDate,
        endDate,
        view,
        page = 1,
        limit = 20
    } = req.query;

    const query = addOrganizationFilter(req, {});
    const categoryFilter = category || type;
    const isManageView = view === 'manage' && scope.manager;

    if (isManageView) {
        if (scope.teamOnly && scope.employeeIds?.length) {
            query.$or = [
                { recipientId: { $in: scope.employeeIds } },
                { givenBy: { $in: scope.employeeIds } },
                { recipientIds: { $in: scope.employeeIds } }
            ];
        }
        if (status) query.status = status;
        else query.status = { $in: ['Pending', 'Approved', 'Rejected'] };
    } else if (mine === 'received' && employee?._id) {
        query.$or = [
            { recipientId: employee._id },
            { recipientIds: employee._id }
        ];
        if (status && scope.manager) query.status = status;
        else if (!status) query.status = { $in: ['Approved', 'Pending', 'Rejected'] };
    } else if (mine === 'given' && employee?._id) {
        query.givenBy = employee._id;
        if (status && scope.manager) query.status = status;
        else if (!status) query.status = { $in: ['Approved', 'Pending', 'Rejected'] };
    } else if (recipientId) {
        if (!scope.manager && String(recipientId) !== String(employee?._id)) {
            query.status = 'Approved';
            query.isPublic = true;
        }
        query.recipientId = recipientId;
        if (status && scope.manager) query.status = status;
        else if (!scope.manager) {
            query.status = 'Approved';
            query.isPublic = true;
        }
    } else if (givenBy) {
        if (!scope.manager && String(givenBy) !== String(employee?._id)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        query.givenBy = givenBy;
        if (status && scope.manager) query.status = status;
    } else {
        query.status = 'Approved';
        query.isPublic = true;
    }

    if (categoryFilter) query.type = categoryFilter;
    Object.assign(query, buildRecognitionDateFilter(startDate, endDate));

    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 500);
    const skip = (parseInt(page, 10) - 1) * parsedLimit;

    const [recognitions, total] = await Promise.all([
        Recognition.find(query)
            .populate('recipientId', 'name lastName email department')
            .populate('recipientIds', 'name lastName email department')
            .populate('givenBy', 'name lastName email department')
            .populate('approvedBy', 'name lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit),
        Recognition.countDocuments(query)
    ]);

    const data = recognitions.map((doc) => {
        const row = doc.toObject();
        row.recipientLabel = formatRecognitionRecipientLabel(row);
        return row;
    });

    res.json({
        success: true,
        data,
        pagination: {
            page: parseInt(page, 10),
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit) || 1
        }
    });
});

/**
 * Get single recognition — scoped to participants, public wall, or HR manage
 */
export const getRecognitionById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const employee = await loadRequestEmployee(req);
    const scope = await resolveRecognitionListScope(
        req,
        employee,
        getOrganizationId(req)
    );

    const recognition = await Recognition.findOne(addOrganizationFilter(req, { _id: id }))
        .populate('recipientId', 'name lastName email department')
        .populate('recipientIds', 'name lastName email department')
        .populate('givenBy', 'name lastName email department')
        .populate('approvedBy', 'name lastName email');

    if (!recognition) {
        return res.status(404).json({
            success: false,
            message: 'Recognition not found'
        });
    }

    const employeeId = employee?._id;

    if (scope.manager) {
        if (scope.teamOnly && scope.employeeIds?.length) {
            const rid = String(recognition.recipientId?._id || recognition.recipientId);
            const gid = String(recognition.givenBy?._id || recognition.givenBy);
            const inRecipients = (recognition.recipientIds || []).some((r) =>
                scope.employeeIds.includes(String(r?._id || r))
            );
            if (!scope.employeeIds.includes(rid) && !scope.employeeIds.includes(gid) && !inRecipients) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }
        }
    } else if (!canEmployeeViewRecognition(recognition, employeeId)) {
        return res.status(403).json({
            success: false,
            message: 'Access denied',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const data = recognition.toObject();
    data.recipientLabel = formatRecognitionRecipientLabel(data);

    res.json({
        success: true,
        data
    });
});

/**
 * Update recognition status (HR moderate)
 */
export const updateRecognition = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, isPublic } = req.body;

    const recognition = await Recognition.findOne(addOrganizationFilter(req, { _id: id }));
    if (!recognition) {
        return res.status(404).json({
            success: false,
            message: 'Recognition not found'
        });
    }

    const prevStatus = recognition.status;

    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
        recognition.status = status;
        if (status === 'Approved') {
            recognition.approvedBy = getRequestActorId(req);
            recognition.approvedAt = new Date();
        }
    }
    if (isPublic !== undefined) recognition.isPublic = Boolean(isPublic);

    await recognition.save();

    if (prevStatus !== 'Approved' && recognition.status === 'Approved') {
        await safeNotify({
            type: 'engagement.recognition.received',
            organizationId: recognition.organizationId,
            data: {
                recognition: {
                    _id: recognition._id,
                    title: recognition.title,
                    type: recognition.type,
                    recipientType: recognition.recipientType,
                    teamLabel: recognition.teamLabel,
                    targetDepartment: recognition.targetDepartment
                },
                recipientId: recognition.recipientId,
                recipientIds: recognition.recipientIds,
                givenBy: recognition.givenBy
            }
        });
    }

    if (prevStatus === 'Pending' && recognition.status === 'Rejected') {
        await safeNotify({
            type: 'engagement.recognition.rejected',
            organizationId: recognition.organizationId,
            data: {
                recognition: {
                    _id: recognition._id,
                    title: recognition.title,
                    type: recognition.type
                },
                employeeId: recognition.givenBy
            }
        });
    }

    const populated = await Recognition.findById(recognition._id)
        .populate('recipientId', 'name lastName email department')
        .populate('recipientIds', 'name lastName email department')
        .populate('givenBy', 'name lastName email department')
        .populate('approvedBy', 'name lastName email');

    const data = populated.toObject();
    data.recipientLabel = formatRecognitionRecipientLabel(data);

    res.json({
        success: true,
        message: 'Recognition updated',
        data
    });
});

/**
 * Recognition analytics (HR / scoped managers)
 */
export const getRecognitionAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    const scope = await resolveRecognitionListScope(req, employee, organizationId);

    if (!scope.manager) {
        return res.status(403).json({
            success: false,
            message: 'Access denied',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = buildRecognitionDateFilter(startDate, endDate);
    const match = { organizationId, ...dateFilter };

    if (scope.teamOnly && scope.employeeIds?.length) {
        match.$or = [
            { recipientId: { $in: scope.employeeIds } },
            { givenBy: { $in: scope.employeeIds } }
        ];
    }

    const [totals, byCategory, trend, receivedCount, givenCount, approvedDocs] = await Promise.all([
        Recognition.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]),
        Recognition.aggregate([
            { $match: { ...match, status: 'Approved' } },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        Recognition.aggregate([
            { $match: { ...match, status: 'Approved' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]),
        Recognition.countDocuments({ ...match, status: 'Approved' }),
        Recognition.aggregate([
            { $match: { ...match, status: 'Approved' } },
            { $group: { _id: '$givenBy', count: { $sum: 1 } } },
            { $count: 'distinctGivers' }
        ]),
        Recognition.find({ ...match, status: 'Approved' })
            .populate('recipientId', 'department')
            .select('recipientType targetDepartment recipientId')
            .lean()
    ]);

    const deptMap = {};
    for (const doc of approvedDocs) {
        let dept = null;
        if (doc.recipientType === 'Department' && doc.targetDepartment) {
            dept = doc.targetDepartment;
        } else if (doc.recipientId?.department) {
            dept = doc.recipientId.department;
        }
        if (dept) {
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        }
    }
    const byDepartment = Object.entries(deptMap)
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);

    const statusMap = totals.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
    }, {});

    res.json({
        success: true,
        data: {
            scope: scope.teamOnly ? 'team' : 'organization',
            total: Object.values(statusMap).reduce((s, n) => s + n, 0),
            approved: statusMap.Approved || 0,
            pending: statusMap.Pending || 0,
            rejected: statusMap.Rejected || 0,
            approvedCount: receivedCount,
            distinctGivers: givenCount[0]?.distinctGivers || 0,
            byCategory: byCategory.map((r) => ({ category: r._id, count: r.count })),
            byDepartment,
            trend: trend.map((r) => ({
                period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
                count: r.count
            }))
        }
    });
});

/**
 * React to recognition on the wall
 */
export const reactToRecognition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;
    const { id } = req.params;
    const emoji = String(req.body.emoji || '❤️').slice(0, 16);

    if (!employeeId) {
        return res.status(403).json({
            success: false,
            message: 'Only employees can react'
        });
    }

    const recognition = await Recognition.findOne({
        _id: id,
        organizationId,
        status: 'Approved',
        isPublic: true
    });

    if (!recognition) {
        return res.status(404).json({
            success: false,
            message: 'Recognition not found'
        });
    }

    recognition.reactions = recognition.reactions || [];
    const existingIdx = recognition.reactions.findIndex(
        (r) => String(r.employeeId) === String(employeeId) && r.emoji === emoji
    );

    if (existingIdx >= 0) {
        recognition.reactions.splice(existingIdx, 1);
    } else {
        // One reaction per emoji per user; replace other emoji from same user optional — keep multi
        recognition.reactions.push({ emoji, employeeId, reactedAt: new Date() });
    }

    await recognition.save();

    res.json({
        success: true,
        data: {
            _id: recognition._id,
            reactions: recognition.reactions,
            reactionCounts: recognition.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
            }, {})
        }
    });
});

/**
 * Get engagement analytics including eNPS (privacy-thresholded; org vs team scoped)
 */
export const getEngagementAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const settings = await loadEngagementSettings(organizationId);
    const minResponses = resolveOrgAnalyticsMinResponses(settings, req);
    const trendDateRange = resolveAnalyticsDateRange(req);

    let scope = resolveEngagementAnalyticsScope(req.authContext);
    if (
        req.query.scope === 'team' &&
        hasPermission(req.authContext, PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM)
    ) {
        scope = 'team';
    }
    if (!scope) {
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions for engagement analytics',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }

    const orgObjectId = organizationId;
    let teamIds = null;

    if (scope === 'team') {
        const employee = await loadRequestEmployee(req);
        const managerId = employee?._id || req.employee?._id;
        if (!managerId) {
            return res.status(403).json({
                success: false,
                message: 'Employee profile required for team analytics',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        teamIds = await getManagedTeamEmployeeIds(organizationId, managerId);
    }

    const responseMatch = {
        organizationId: orgObjectId
    };
    const feedbackMatch = {
        organizationId: orgObjectId
    };
    const generalFeedbackMatch = {
        organizationId: orgObjectId,
        type: { $ne: 'Suggestion' }
    };
    const suggestionMatch = {
        organizationId: orgObjectId,
        type: 'Suggestion'
    };
    const recognitionMatch = {
        organizationId: orgObjectId,
        status: 'Approved'
    };

    const trendResponseMatch = {
        organizationId: orgObjectId,
        submittedAt: { $gte: trendDateRange.start, $lte: trendDateRange.end }
    };
    const trendFeedbackMatch = {
        organizationId: orgObjectId,
        type: { $ne: 'Suggestion' },
        createdAt: { $gte: trendDateRange.start, $lte: trendDateRange.end }
    };
    const trendSuggestionMatch = {
        organizationId: orgObjectId,
        type: 'Suggestion',
        createdAt: { $gte: trendDateRange.start, $lte: trendDateRange.end }
    };
    const trendRecognitionMatch = {
        organizationId: orgObjectId,
        status: 'Approved',
        createdAt: { $gte: trendDateRange.start, $lte: trendDateRange.end }
    };

    if (scope === 'team') {
        // Anonymous rows cannot be attributed to a team — use identified team members only
        responseMatch.employeeId = { $in: teamIds };
        responseMatch.isAnonymous = { $ne: true };
        feedbackMatch.employeeId = { $in: teamIds };
        feedbackMatch.anonymous = { $ne: true };
        generalFeedbackMatch.employeeId = { $in: teamIds };
        generalFeedbackMatch.anonymous = { $ne: true };
        suggestionMatch.employeeId = { $in: teamIds };
        suggestionMatch.anonymous = { $ne: true };
        recognitionMatch.$or = [
            { recipientId: { $in: teamIds } },
            { givenBy: { $in: teamIds } }
        ];
        trendResponseMatch.employeeId = { $in: teamIds };
        trendResponseMatch.isAnonymous = { $ne: true };
        trendFeedbackMatch.employeeId = { $in: teamIds };
        trendFeedbackMatch.anonymous = { $ne: true };
        trendSuggestionMatch.employeeId = { $in: teamIds };
        trendSuggestionMatch.anonymous = { $ne: true };
        trendRecognitionMatch.$or = [
            { recipientId: { $in: teamIds } },
            { givenBy: { $in: teamIds } }
        ];
    }

    const departmentFilter = String(req.query.department || '').trim();
    const surveyTypeFilter = String(req.query.surveyType || '').trim();

    if (departmentFilter && scope === 'org') {
        const deptEmployees = await Employee.find({
            organizationId: orgObjectId,
            status: 'active',
            department: departmentFilter
        })
            .select('_id')
            .lean();
        const deptIds = deptEmployees.map((e) => e._id);
        responseMatch.employeeId = { $in: deptIds };
        responseMatch.isAnonymous = { $ne: true };
        generalFeedbackMatch.employeeId = { $in: deptIds };
        generalFeedbackMatch.anonymous = { $ne: true };
        suggestionMatch.employeeId = { $in: deptIds };
        suggestionMatch.anonymous = { $ne: true };
        recognitionMatch.$or = [
            { recipientId: { $in: deptIds } },
            { givenBy: { $in: deptIds } },
            { targetDepartment: departmentFilter }
        ];
        trendResponseMatch.employeeId = { $in: deptIds };
        trendResponseMatch.isAnonymous = { $ne: true };
        trendFeedbackMatch.employeeId = { $in: deptIds };
        trendFeedbackMatch.anonymous = { $ne: true };
        trendSuggestionMatch.employeeId = { $in: deptIds };
        trendSuggestionMatch.anonymous = { $ne: true };
        trendRecognitionMatch.$or = [
            { recipientId: { $in: deptIds } },
            { givenBy: { $in: deptIds } },
            { targetDepartment: departmentFilter }
        ];
    }

    if (surveyTypeFilter) {
        const typeSurveys = await Survey.find({
            organizationId: orgObjectId,
            type: surveyTypeFilter
        })
            .select('_id')
            .lean();
        const typeIds = typeSurveys.map((s) => s._id);
        responseMatch.surveyId = { $in: typeIds };
        trendResponseMatch.surveyId = { $in: typeIds };
    }

    const emptyTeam = scope === 'team' && (!teamIds || teamIds.length === 0);

    if (emptyTeam) {
        return res.json({
            success: true,
            data: {
                scope: 'team',
                dateRange: {
                    start: trendDateRange.start,
                    end: trendDateRange.end,
                    range: trendDateRange.range
                },
                surveys: {
                    teamSize: 0
                },
                surveysByType: [],
                feedback: [],
                suggestions: { total: 0, byStatus: [], openCount: 0 },
                recognition: [],
                eNPS: null,
                eNPSDetail: {
                    available: false,
                    minResponses,
                    message: 'Not enough responses to display analytics.'
                },
                departmentBreakdown: [],
                trends: {
                    responses: [],
                    enps: [],
                    feedback: [],
                    suggestions: [],
                    recognition: []
                },
                minResponses,
                privacyNote:
                    'Team analytics include only your direct reports. Anonymous responses are excluded. Groups below the minimum response threshold are suppressed.'
            }
        });
    }

    const trendGroupSubmitted = buildTrendGroupId(trendDateRange.range, '$submittedAt');
    const trendGroupCreated = buildTrendGroupId(trendDateRange.range, '$createdAt');
    const enpsMatchOr = [
        { 'responses.questionType': 'eNPS' },
        { 'responses.questionText': { $regex: /recommend|nps|net promoter|enps/i } }
    ];

    const [
        totalSurveys,
        activeSurveys,
        closedSurveys,
        draftSurveys,
        totalResponses,
        surveysByType,
        avgResponseRate,
        feedbackStats,
        openFeedback,
        suggestionStats,
        suggestionTotal,
        openSuggestions,
        recognitionStats,
        recognitionCount,
        eNPSByType,
        eNPSByText,
        deptBreakdownRaw,
        feedbackByDept,
        suggestionByDept,
        recognitionByDept,
        enpsByDept,
        eligibleByDept,
        respondentsByDept,
        uniqueRespondents,
        responseTrendRaw,
        enpsTrendRaw,
        feedbackTrendRaw,
        suggestionTrendRaw,
        recognitionTrendRaw
    ] = await Promise.all([
        scope === 'org'
            ? Survey.countDocuments({ organizationId: orgObjectId })
            : Promise.resolve(null),
        scope === 'org'
            ? Survey.countDocuments({ organizationId: orgObjectId, status: 'Active' })
            : Promise.resolve(null),
        scope === 'org'
            ? Survey.countDocuments({
                organizationId: orgObjectId,
                status: { $in: ['Closed', 'Archived'] }
            })
            : Promise.resolve(null),
        scope === 'org'
            ? Survey.countDocuments({ organizationId: orgObjectId, status: 'Draft' })
            : Promise.resolve(null),
        SurveyResponse.countDocuments(responseMatch),
        scope === 'org'
            ? Survey.aggregate([
                { $match: { organizationId: orgObjectId } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? Survey.aggregate([
                { $match: { organizationId: orgObjectId } },
                {
                    $project: {
                        responseRate: {
                            $cond: [
                                { $gt: ['$totalInvites', 0] },
                                { $multiply: [{ $divide: ['$responseCount', '$totalInvites'] }, 100] },
                                {
                                    $cond: [{ $gt: ['$responseCount', 0] }, 100, 0]
                                }
                            ]
                        }
                    }
                },
                { $group: { _id: null, avgRate: { $avg: '$responseRate' } } }
            ])
            : Promise.resolve([]),
        Feedback.aggregate([
            { $match: generalFeedbackMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Feedback.countDocuments({
            ...generalFeedbackMatch,
            status: { $in: ['Open', 'In Review'] }
        }),
        Feedback.aggregate([
            { $match: suggestionMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Feedback.countDocuments(suggestionMatch),
        Feedback.countDocuments({
            ...suggestionMatch,
            status: { $in: ['Submitted', 'Under Review', 'In Progress'] }
        }),
        Recognition.aggregate([
            { $match: recognitionMatch },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]),
        Recognition.countDocuments(recognitionMatch),
        SurveyResponse.aggregate([
            { $match: responseMatch },
            { $unwind: '$responses' },
            { $match: { 'responses.questionType': 'eNPS' } },
            {
                $group: {
                    _id: null,
                    promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                    passives: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$responses.answer', 7] },
                                        { $lte: ['$responses.answer', 8] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    detractors: { $sum: { $cond: [{ $lte: ['$responses.answer', 6] }, 1, 0] } },
                    total: { $sum: 1 }
                }
            }
        ]),
        SurveyResponse.aggregate([
            { $match: responseMatch },
            { $unwind: '$responses' },
            {
                $match: {
                    'responses.questionText': { $regex: /recommend|nps|net promoter|enps/i }
                }
            },
            {
                $group: {
                    _id: null,
                    promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                    passives: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$responses.answer', 7] },
                                        { $lte: ['$responses.answer', 8] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    detractors: { $sum: { $cond: [{ $lte: ['$responses.answer', 6] }, 1, 0] } },
                    total: { $sum: 1 }
                }
            }
        ]),
        scope === 'org'
            ? SurveyResponse.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        isAnonymous: { $ne: true },
                        employeeId: { $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'employeeId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                {
                    $group: {
                        _id: '$emp.department',
                        count: { $sum: 1 }
                    }
                }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? Feedback.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        anonymous: { $ne: true },
                        type: { $ne: 'Suggestion' },
                        employeeId: { $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'employeeId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                { $group: { _id: '$emp.department', count: { $sum: 1 } } }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? Feedback.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        anonymous: { $ne: true },
                        type: 'Suggestion',
                        employeeId: { $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'employeeId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                { $group: { _id: '$emp.department', count: { $sum: 1 } } }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? Recognition.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        status: 'Approved'
                    }
                },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'recipientId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                { $group: { _id: '$emp.department', count: { $sum: 1 } } }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? SurveyResponse.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        isAnonymous: { $ne: true },
                        employeeId: { $ne: null }
                    }
                },
                { $unwind: '$responses' },
                { $match: { $or: enpsMatchOr } },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'employeeId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                {
                    $group: {
                        _id: '$emp.department',
                        promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                        detractors: { $sum: { $cond: [{ $lte: ['$responses.answer', 6] }, 1, 0] } },
                        total: { $sum: 1 }
                    }
                }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? Employee.aggregate([
                { $match: { organizationId: orgObjectId, status: 'active' } },
                { $group: { _id: '$department', eligible: { $sum: 1 } } }
            ])
            : Promise.resolve([]),
        scope === 'org'
            ? SurveyResponse.aggregate([
                {
                    $match: {
                        organizationId: orgObjectId,
                        isAnonymous: { $ne: true },
                        employeeId: { $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'employees',
                        localField: 'employeeId',
                        foreignField: '_id',
                        as: 'emp'
                    }
                },
                { $unwind: '$emp' },
                {
                    $group: {
                        _id: '$emp.department',
                        respondents: { $addToSet: '$employeeId' }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        respondents: { $size: '$respondents' }
                    }
                }
            ])
            : Promise.resolve([]),
        scope === 'team'
            ? SurveyResponse.distinct('employeeId', responseMatch)
            : Promise.resolve([]),
        SurveyResponse.aggregate([
            { $match: trendResponseMatch },
            { $group: { _id: trendGroupSubmitted, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),
        SurveyResponse.aggregate([
            { $match: trendResponseMatch },
            { $unwind: '$responses' },
            { $match: { $or: enpsMatchOr } },
            {
                $group: {
                    _id: trendGroupSubmitted,
                    promoters: { $sum: { $cond: [{ $gte: ['$responses.answer', 9] }, 1, 0] } },
                    passives: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$responses.answer', 7] },
                                        { $lte: ['$responses.answer', 8] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    detractors: { $sum: { $cond: [{ $lte: ['$responses.answer', 6] }, 1, 0] } },
                    total: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),
        Feedback.aggregate([
            { $match: trendFeedbackMatch },
            { $group: { _id: trendGroupCreated, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),
        Feedback.aggregate([
            { $match: trendSuggestionMatch },
            { $group: { _id: trendGroupCreated, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),
        Recognition.aggregate([
            { $match: trendRecognitionMatch },
            { $group: { _id: trendGroupCreated, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ])
    ]);

    const eNPSSource = eNPSByType[0]?.total > 0 ? eNPSByType[0] : eNPSByText[0];
    let eNPSValue = null;
    let eNPSMeta = {
        available: false,
        minResponses,
        message: 'Not enough responses to display analytics.'
    };
    if (eNPSSource && eNPSSource.total > 0) {
        eNPSMeta = applyThreshold(eNPSSource.total, minResponses, {
            promoters: eNPSSource.promoters,
            passives: eNPSSource.passives,
            detractors: eNPSSource.detractors
        });
        if (eNPSMeta.available) {
            const { promoters, detractors, total } = eNPSSource;
            eNPSValue = Number(
                (((promoters / total) * 100) - ((detractors / total) * 100)).toFixed(2)
            );
            eNPSMeta.score = eNPSValue;
        }
    }

    const participationByDept = (eligibleByDept || []).map((row) => {
        const respondentRow = (respondentsByDept || []).find((r) => r._id === row._id);
        return {
            _id: row._id,
            eligible: row.eligible || 0,
            respondents: respondentRow?.respondents || 0
        };
    });

    const departmentBreakdown =
        scope === 'org'
            ? buildRichDepartmentBreakdown({
                surveyResponseByDept: deptBreakdownRaw,
                feedbackByDept,
                suggestionByDept,
                recognitionByDept,
                enpsByDept,
                participationByDept,
                minResponses
            })
            : [];

    let participationRate = avgResponseRate[0]?.avgRate || 0;
    if (scope === 'team') {
        const teamSize = teamIds.length;
        const respondentCount = Array.isArray(uniqueRespondents) ? uniqueRespondents.filter(Boolean).length : 0;
        participationRate = teamSize > 0 ? Number(((respondentCount / teamSize) * 100).toFixed(2)) : 0;
    }

    // Suppress detailed team metrics when overall response volume is below threshold
    const teamDetailAvailable = scope !== 'team' || totalResponses >= minResponses;

    const mapTrendRows = (rows) =>
        (rows || []).map((row) => ({
            period: formatTrendPeriod(row._id, trendDateRange.range),
            count: row.count || 0
        }));

    const enpsTrend = (enpsTrendRaw || []).map((row) => {
        const total = row.total || 0;
        const meta = applyThreshold(total, minResponses, {
            promoters: row.promoters,
            passives: row.passives,
            detractors: row.detractors
        });
        if (!meta.available) {
            return {
                period: formatTrendPeriod(row._id, trendDateRange.range),
                available: false,
                message: 'Not enough responses to display analytics.'
            };
        }
        const score = Number(
            (((row.promoters / total) * 100) - ((row.detractors / total) * 100)).toFixed(2)
        );
        return {
            period: formatTrendPeriod(row._id, trendDateRange.range),
            available: true,
            score,
            responseCount: total
        };
    });

    const payload = {
        scope,
        dateRange: {
            start: trendDateRange.start,
            end: trendDateRange.end,
            range: trendDateRange.range
        },
        surveys: {
            total: scope === 'org' ? totalSurveys : undefined,
            active: scope === 'org' ? activeSurveys : undefined,
            closed: scope === 'org' ? closedSurveys : undefined,
            draft: scope === 'org' ? draftSurveys : undefined,
            pending: scope === 'org' ? draftSurveys : undefined,
            totalResponses: teamDetailAvailable ? totalResponses : undefined,
            participationRate: teamDetailAvailable ? participationRate : undefined,
            teamSize: scope === 'team' ? teamIds.length : undefined
        },
        surveysByType: scope === 'org' ? surveysByType : [],
        avgResponseRate: teamDetailAvailable ? participationRate : undefined,
        feedback: teamDetailAvailable ? feedbackStats : [],
        openFeedback: teamDetailAvailable ? openFeedback : undefined,
        suggestions: teamDetailAvailable
            ? {
                total: suggestionTotal,
                byStatus: suggestionStats,
                openCount: openSuggestions
            }
            : { total: undefined, byStatus: [], openCount: undefined },
        recognition: teamDetailAvailable ? recognitionStats : [],
        recognitionCount: teamDetailAvailable ? recognitionCount : undefined,
        eNPS: teamDetailAvailable ? eNPSValue : null,
        eNPSDetail: teamDetailAvailable
            ? eNPSMeta
            : {
                available: false,
                minResponses,
                message: 'Not enough responses to display analytics.'
            },
        departmentBreakdown,
        trends: teamDetailAvailable
            ? {
                responses: mapTrendRows(responseTrendRaw),
                enps: enpsTrend,
                feedback: mapTrendRows(feedbackTrendRaw),
                suggestions: mapTrendRows(suggestionTrendRaw),
                recognition: mapTrendRows(recognitionTrendRaw)
            }
            : {
                responses: [],
                enps: [],
                feedback: [],
                suggestions: [],
                recognition: []
            },
        minResponses,
        filters: {
            department: departmentFilter || null,
            surveyType: surveyTypeFilter || null
        },
        privacyNote:
            scope === 'team'
                ? 'Team analytics include only your direct reports. Anonymous responses are excluded. Groups below the minimum response threshold are suppressed.'
                : 'Anonymous responses are excluded from department breakdowns. Groups below the minimum response threshold are suppressed.'
    };

    const windowMs = trendDateRange.end.getTime() - trendDateRange.start.getTime();
    const prevEnd = new Date(trendDateRange.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - windowMs);
    const prevResponseMatch = {
        ...trendResponseMatch,
        submittedAt: { $gte: prevStart, $lte: prevEnd }
    };
    const prevFeedbackMatch = {
        ...trendFeedbackMatch,
        createdAt: { $gte: prevStart, $lte: prevEnd }
    };
    const prevSuggestionMatch = {
        ...trendSuggestionMatch,
        createdAt: { $gte: prevStart, $lte: prevEnd }
    };
    const prevRecognitionMatch = {
        ...trendRecognitionMatch,
        createdAt: { $gte: prevStart, $lte: prevEnd }
    };

    const [prevResponses, prevFeedback, prevSuggestions, prevRecognition, tenureRows] = await Promise.all([
        SurveyResponse.countDocuments(prevResponseMatch),
        Feedback.countDocuments(prevFeedbackMatch),
        Feedback.countDocuments(prevSuggestionMatch),
        Recognition.countDocuments(prevRecognitionMatch),
        SurveyResponse.aggregate([
            {
                $match: {
                    ...trendResponseMatch,
                    isAnonymous: { $ne: true },
                    employeeId: { $ne: null }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'emp'
                }
            },
            { $unwind: '$emp' },
            {
                $project: {
                    joiningDate: '$emp.joiningDate',
                    submittedAt: 1
                }
            }
        ])
    ]);

    const currentResponses = (payload.trends?.responses || []).reduce((s, r) => s + (r.count || 0), 0);
    const currentFeedback = (payload.trends?.feedback || []).reduce((s, r) => s + (r.count || 0), 0);
    const currentSuggestions = (payload.trends?.suggestions || []).reduce((s, r) => s + (r.count || 0), 0);
    const currentRecognition = (payload.trends?.recognition || []).reduce((s, r) => s + (r.count || 0), 0);

    const pctChange = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    payload.comparison = {
        previousRange: { start: prevStart, end: prevEnd },
        responses: {
            current: currentResponses,
            previous: prevResponses,
            delta: currentResponses - prevResponses,
            deltaPct: pctChange(currentResponses, prevResponses)
        },
        feedback: {
            current: currentFeedback,
            previous: prevFeedback,
            delta: currentFeedback - prevFeedback,
            deltaPct: pctChange(currentFeedback, prevFeedback)
        },
        suggestions: {
            current: currentSuggestions,
            previous: prevSuggestions,
            delta: currentSuggestions - prevSuggestions,
            deltaPct: pctChange(currentSuggestions, prevSuggestions)
        },
        recognition: {
            current: currentRecognition,
            previous: prevRecognition,
            delta: currentRecognition - prevRecognition,
            deltaPct: pctChange(currentRecognition, prevRecognition)
        }
    };

    const tenureBuckets = {
        newJoiner: { label: 'New joiners (<90 days)', count: 0 },
        '0-1': { label: '0–1 year', count: 0 },
        '1-3': { label: '1–3 years', count: 0 },
        '3+': { label: '3+ years', count: 0 }
    };
    const nowRef = trendDateRange.end;
    for (const row of tenureRows) {
        if (!row.joiningDate) continue;
        const days = (nowRef.getTime() - new Date(row.joiningDate).getTime()) / (24 * 60 * 60 * 1000);
        if (days < 90) tenureBuckets.newJoiner.count += 1;
        else if (days < 365) tenureBuckets['0-1'].count += 1;
        else if (days < 365 * 3) tenureBuckets['1-3'].count += 1;
        else tenureBuckets['3+'].count += 1;
    }
    payload.tenureInsights = Object.entries(tenureBuckets).map(([key, val]) => {
        const thresholded = applyThreshold(val.count, minResponses);
        return {
            cohort: key,
            label: val.label,
            ...thresholded,
            responseCount: thresholded.available ? val.count : undefined
        };
    });

    // Closed-loop action plans + lifecycle participation (aggregate, privacy-safe)
    const actionPlanMatch = { organizationId: orgObjectId };
    if (scope === 'team') {
        actionPlanMatch.owner = { $in: teamIds };
    }
    if (departmentFilter && scope === 'org') {
        actionPlanMatch.department = departmentFilter;
    }

    const nowForPlans = new Date();
    const [
        actionPlansByStatus,
        actionPlansBySource,
        overdueActionPlans,
        followUpCompleted,
        insightLinkedTotal,
        implementedSuggestions,
        lifecycleSurveys,
        lifecycleResponses
    ] = await Promise.all([
        EngagementActionPlan.aggregate([
            { $match: actionPlanMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        EngagementActionPlan.aggregate([
            { $match: actionPlanMatch },
            { $group: { _id: '$sourceType', count: { $sum: 1 } } }
        ]),
        EngagementActionPlan.countDocuments({
            ...actionPlanMatch,
            status: { $in: ['Open', 'In Progress'] },
            dueDate: { $lt: nowForPlans }
        }),
        EngagementActionPlan.countDocuments({
            ...actionPlanMatch,
            status: 'Completed',
            sourceType: { $in: ['Survey', 'Pulse', 'Feedback', 'Suggestion'] }
        }),
        EngagementActionPlan.countDocuments({
            ...actionPlanMatch,
            sourceType: { $in: ['Survey', 'Pulse', 'Feedback', 'Suggestion'] }
        }),
        Feedback.countDocuments({
            ...suggestionMatch,
            status: 'Implemented'
        }),
        Survey.aggregate([
            {
                $match: {
                    organizationId: orgObjectId,
                    lifecycleTrigger: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$lifecycleTrigger',
                    surveys: { $sum: 1 },
                    invites: { $sum: { $ifNull: ['$totalInvites', 1] } },
                    responses: { $sum: { $ifNull: ['$responseCount', 0] } },
                    active: {
                        $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
                    },
                    closed: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['Closed', 'Archived']] }, 1, 0]
                        }
                    }
                }
            }
        ]),
        // Lifecycle response volume for participation (no identity leakage)
        SurveyResponse.aggregate([
            {
                $match: {
                    organizationId: orgObjectId
                }
            },
            {
                $lookup: {
                    from: 'surveys',
                    localField: 'surveyId',
                    foreignField: '_id',
                    as: 'survey'
                }
            },
            { $unwind: '$survey' },
            {
                $match: {
                    'survey.lifecycleTrigger': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$survey.lifecycleTrigger',
                    responseCount: { $sum: 1 }
                }
            }
        ])
    ]);

    const statusMap = Object.fromEntries((actionPlansByStatus || []).map((r) => [r._id, r.count]));
    const openCount = (statusMap.Open || 0) + (statusMap['In Progress'] || 0);
    const completedCount = statusMap.Completed || 0;
    const cancelledCount = statusMap.Cancelled || 0;
    const totalPlans = openCount + completedCount + cancelledCount;
    const closureDenom = Math.max(totalPlans - cancelledCount, 0);
    const closureRate =
        closureDenom > 0 ? Number(((completedCount / closureDenom) * 100).toFixed(1)) : null;

    const lifecycleResponseMap = Object.fromEntries(
        (lifecycleResponses || []).map((r) => [r._id, r.responseCount])
    );
    const lifecycleByTrigger = (lifecycleSurveys || []).map((row) => {
        const invites = row.invites || row.surveys || 0;
        const responses = lifecycleResponseMap[row._id] ?? row.responses ?? 0;
        const participationRate =
            invites > 0 ? Number(((responses / invites) * 100).toFixed(1)) : 0;
        return {
            trigger: row._id,
            surveys: row.surveys,
            active: row.active,
            closed: row.closed,
            invites,
            responses,
            // Only expose participation when enough responses (privacy floor)
            participationRate:
                responses >= minResponses || invites < minResponses ? participationRate : null,
            participationAvailable: responses >= minResponses || invites < minResponses
        };
    });

    const lifecycleTotals = lifecycleByTrigger.reduce(
        (acc, row) => {
            acc.surveys += row.surveys || 0;
            acc.invites += row.invites || 0;
            acc.responses += row.responses || 0;
            acc.active += row.active || 0;
            return acc;
        },
        { surveys: 0, invites: 0, responses: 0, active: 0 }
    );
    lifecycleTotals.participationRate =
        lifecycleTotals.invites > 0
            ? Number(((lifecycleTotals.responses / lifecycleTotals.invites) * 100).toFixed(1))
            : 0;

    payload.closedLoop = {
        actionPlans: {
            total: totalPlans,
            open: statusMap.Open || 0,
            inProgress: statusMap['In Progress'] || 0,
            completed: completedCount,
            cancelled: cancelledCount,
            overdue: overdueActionPlans,
            openOrInProgress: openCount,
            closureRate,
            insightLinked: insightLinkedTotal,
            followUpCompleted,
            followUpCompletionRate:
                insightLinkedTotal > 0
                    ? Number(((followUpCompleted / insightLinkedTotal) * 100).toFixed(1))
                    : null,
            bySourceType: (actionPlansBySource || []).map((r) => ({
                sourceType: r._id || 'Manual',
                count: r.count
            })),
            byStatus: (actionPlansByStatus || []).map((r) => ({
                status: r._id,
                count: r.count
            }))
        },
        suggestionsImplemented: implementedSuggestions,
        improvementIndicator: {
            followUpCompletionRate:
                insightLinkedTotal > 0
                    ? Number(((followUpCompleted / insightLinkedTotal) * 100).toFixed(1))
                    : null,
            actionClosureRate: closureRate,
            suggestionsImplemented: implementedSuggestions
        }
    };

    payload.lifecycle = {
        enabled: Boolean(settings.lifecycle?.enabled),
        totals: lifecycleTotals,
        byTrigger: lifecycleByTrigger
    };

    // Suggestion implemented count already in suggestions; expose explicit KPI
    if (payload.suggestions && typeof payload.suggestions === 'object') {
        payload.suggestions.implementedCount = teamDetailAvailable
            ? implementedSuggestions
            : undefined;
    }

    res.json({
        success: true,
        data: payload
    });
});

/**
 * Create pulse survey (quick, frequent survey)
 */
export const createPulseSurvey = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const settings = await loadEngagementSettings(organizationId);
    if (!isEngagementFeatureEnabled(settings, 'pulse')) {
        return res.status(403).json(featureDisabledResponse('pulse'));
    }

    const targeting = await validateSurveyTargeting(req.body, organizationId);
    if (!targeting.valid) {
        return res.status(400).json({
            success: false,
            message: targeting.message
        });
    }

    const pulseSurvey = new Survey({
        ...req.body,
        ...targeting.normalized,
        organizationId,
        createdBy,
        type: 'Pulse',
        questions: req.body.questions || [],
        reminderEnabled: req.body.reminderEnabled !== false,
        reminderDaysBefore: req.body.reminderDaysBefore ?? 1
    });

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(pulseSurvey, organizationId);
    pulseSurvey.totalInvites = eligibleIds.length;

    await pulseSurvey.save();

    if (pulseSurvey.status === 'Active') {
        await safeNotify({
            type: 'engagement.survey.assigned',
            organizationId,
            data: { survey: pulseSurvey }
        });
    }

    res.status(201).json({
        success: true,
        message: 'Pulse survey created successfully',
        data: pulseSurvey
    });
});

/**
 * Clone survey for structural changes when responses exist
 */
export const cloneSurvey = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { surveyId } = req.params;
    const createdBy = req.user?._id || req.employee?._id;

    const source = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId })).lean();
    if (!source) {
        return res.status(404).json({
            success: false,
            message: 'Survey not found'
        });
    }

    const payload = {
        title: req.body.title || `${source.title} (Copy)`,
        description: source.description,
        type: source.type,
        questions: source.questions,
        targetAudience: req.body.targetAudience || source.targetAudience,
        targetDepartments: req.body.targetDepartments || source.targetDepartments,
        targetRoles: req.body.targetRoles || source.targetRoles,
        targetEmployees: req.body.targetEmployees || source.targetEmployees,
        startDate: req.body.startDate || source.startDate,
        endDate: req.body.endDate || source.endDate,
        anonymous: req.body.anonymous ?? source.anonymous,
        status: 'Draft',
        reminderEnabled: source.reminderEnabled,
        reminderDaysBefore: source.reminderDaysBefore
    };

    const targeting = await validateSurveyTargeting(payload, organizationId);
    if (!targeting.valid) {
        return res.status(400).json({
            success: false,
            message: targeting.message
        });
    }

    const survey = new Survey({
        ...payload,
        ...targeting.normalized,
        organizationId,
        createdBy,
        responseCount: 0,
        totalInvites: 0
    });

    const eligibleIds = await resolveSurveyEligibleEmployeeIds(survey, organizationId);
    survey.totalInvites = eligibleIds.length;
    await survey.save();

    res.status(201).json({
        success: true,
        message: 'Survey cloned successfully',
        data: survey
    });
});

const setCsvDownloadHeaders = (res, filename) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};

/**
 * Export survey responses as CSV (privacy-safe)
 */
export const exportSurveyResponses = asyncHandler(async (req, res) => {
    const { surveyId } = req.params;
    const organizationId = getOrganizationId(req);

    const survey = await Survey.findOne(addOrganizationFilter(req, { _id: surveyId }));
    if (!survey) {
        return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    setCsvDownloadHeaders(res, exportFilename('survey-responses', { part: survey.title }));
    writeCsvBom(res);
    res.write(
        `${csvRow([
            'Survey Title',
            'Response Date',
            'Employee',
            'Department',
            'Role',
            'Anonymous',
            'Question',
            'Answer'
        ])}\n`
    );

    const batchSize = 200;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await SurveyResponse.find({
            organizationId,
            surveyId: survey._id
        })
            .populate({
                path: 'employeeId',
                select: 'name lastName department',
                populate: { path: 'assignedRole', select: 'name' }
            })
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(batchSize)
            .lean();

        if (!batch.length) {
            hasMore = false;
            break;
        }

        for (const row of batch) {
            const sanitized = sanitizeSurveyResponses([row], survey.anonymous)[0];
            const fields = surveyEmployeeFields(sanitized, survey.anonymous);
            const date = formatExportDateTime(sanitized.submittedAt);
            const answers = Array.isArray(sanitized.responses) ? sanitized.responses : [];

            if (!answers.length) {
                res.write(
                    `${csvRow([
                        survey.title,
                        date,
                        fields.employee,
                        fields.department,
                        fields.role,
                        fields.anonymous,
                        '',
                        ''
                    ])}\n`
                );
            } else {
                for (const ans of answers) {
                    res.write(
                        `${csvRow([
                            survey.title,
                            date,
                            fields.employee,
                            fields.department,
                            fields.role,
                            fields.anonymous,
                            ans.questionText || '',
                            formatAnswerValue(ans.answer)
                        ])}\n`
                    );
                }
            }
        }

        skip += batch.length;
        hasMore = batch.length === batchSize;
    }

    res.end();
});

/**
 * Export feedback CSV
 */
export const exportFeedback = asyncHandler(async (req, res) => {
    const query = addOrganizationFilter(req, { type: { $ne: 'Suggestion' } });

    setCsvDownloadHeaders(res, exportFilename('employee-feedback'));
    writeCsvBom(res);
    res.write(
        `${csvRow([
            'Subject',
            'Type',
            'Category',
            'Status',
            'Submitted By',
            'Submitted Date',
            'Last Updated',
            'HR Reply'
        ])}\n`
    );

    const batchSize = 200;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await Feedback.find(query)
            .populate('employeeId', 'name lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(batchSize)
            .lean();

        if (!batch.length) {
            hasMore = false;
            break;
        }

        for (const doc of batch) {
            const safe = sanitizeFeedbackDocument(doc);
            res.write(
                `${csvRow([
                    safe.subject,
                    safe.type,
                    safe.category || '',
                    safe.status,
                    feedbackDisplayName(safe),
                    formatExportDateTime(safe.createdAt),
                    formatExportDateTime(getLastUpdated(safe)),
                    formatHrReply(safe.responses)
                ])}\n`
            );
        }

        skip += batch.length;
        hasMore = batch.length === batchSize;
    }

    res.end();
});

/**
 * Export suggestions CSV
 */
export const exportSuggestions = asyncHandler(async (req, res) => {
    const query = addOrganizationFilter(req, { type: 'Suggestion' });

    setCsvDownloadHeaders(res, exportFilename('employee-suggestions'));
    writeCsvBom(res);
    res.write(
        `${csvRow([
            'Subject',
            'Category',
            'Status',
            'Submitted By',
            'Submitted Date',
            'Last Updated',
            'HR Reply',
            'Resolution Note',
            'Implementation Date'
        ])}\n`
    );

    const batchSize = 200;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await Feedback.find(query)
            .populate('employeeId', 'name lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(batchSize)
            .lean();

        if (!batch.length) {
            hasMore = false;
            break;
        }

        for (const doc of batch) {
            const safe = sanitizeFeedbackDocument(doc);
            res.write(
                `${csvRow([
                    safe.subject,
                    safe.category || '',
                    safe.status,
                    feedbackDisplayName(safe),
                    formatExportDateTime(safe.createdAt),
                    formatExportDateTime(getLastUpdated(safe)),
                    formatHrReply(safe.responses),
                    safe.resolutionNote || '',
                    safe.implementationDate
                        ? formatExportDateTime(safe.implementationDate).split(' ')[0]
                        : ''
                ])}\n`
            );
        }

        skip += batch.length;
        hasMore = batch.length === batchSize;
    }

    res.end();
});

/**
 * Export recognition CSV
 */
export const exportRecognition = asyncHandler(async (req, res) => {
    const query = addOrganizationFilter(req, {});

    setCsvDownloadHeaders(res, exportFilename('employee-recognition'));
    writeCsvBom(res);
    res.write(
        `${csvRow([
            'Recognition Date',
            'Given By',
            'Recognized Employee',
            'Category',
            'Title',
            'Message',
            'Status',
            'Points'
        ])}\n`
    );

    const batchSize = 200;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const batch = await Recognition.find(query)
            .populate('recipientId', 'name lastName')
            .populate('givenBy', 'name lastName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(batchSize)
            .lean();

        if (!batch.length) {
            hasMore = false;
            break;
        }

        for (const doc of batch) {
            res.write(
                `${csvRow([
                    formatExportDateTime(doc.createdAt),
                    recognitionDisplayName(doc.givenBy),
                    recognitionDisplayName(doc.recipientId),
                    doc.type || '',
                    doc.title,
                    doc.description || '',
                    doc.status,
                    doc.points ?? ''
                ])}\n`
            );
        }

        skip += batch.length;
        hasMore = batch.length === batchSize;
    }

    res.end();
});

/**
 * Export engagement analytics summary CSV
 */
export const exportEngagementSummary = asyncHandler(async (req, res) => {
    let analyticsData = null;
    let blocked = false;

    const captureRes = {
        status(code) {
            if (code === 403) blocked = true;
            return captureRes;
        },
        json(payload) {
            analyticsData = payload?.data ?? null;
        }
    };

    await getEngagementAnalytics(req, captureRes, () => {});

    if (blocked || !analyticsData) {
        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions for analytics export'
        });
    }

    const orgName =
        req.user?.organization?.name ||
        req.user?.organizationName ||
        req.employee?.organization?.name ||
        '';

    setCsvDownloadHeaders(res, exportFilename('employee-engagement-summary'));
    writeCsvBom(res);

    const metadataRows = [
        ['Report', 'Employee Engagement Summary'],
        ['Scope', formatScopeLabel(analyticsData.scope)],
        ['Generated At', formatExportDateTime(new Date())],
        ['Date Range', formatDateRangeLabel(analyticsData.dateRange)]
    ];
    if (orgName) {
        metadataRows.splice(1, 0, ['Organization', orgName]);
    }
    writeReportMetadata(res, metadataRows);
    writeMetricsTable(res, buildSummaryMetricsFromAnalytics(analyticsData));
    res.end();
});

/**
 * Get 360-degree feedback placeholder (unchanged — not expanded in Phase 1)
 */
export const get360Feedback = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId } = req.params;

    const feedbacks = await Feedback.find({
        organizationId,
        employeeId,
        anonymous: { $ne: true },
        type: { $in: ['Suggestion', 'Appreciation'] }
    })
        .populate('employeeId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        message: '360 feedback retrieved (simplified - needs dedicated model)',
        data: sanitizeFeedbackList(feedbacks)
    });
});

/**
 * Employee-only engagement activity (recent window, no private/anonymous leakage).
 */
export const getEngagementActivity = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employee = await loadRequestEmployee(req);
    if (!employee?._id) {
        return res.status(403).json({ success: false, message: 'Only employees can view activity' });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const empId = employee._id;
    const hash = buildAnonymousHash(organizationId, empId, 'survey');

    const [surveys, responses, received, given, ownFeedback, ownPlans, implementedSuggestions] = await Promise.all([
        Survey.find({
            organizationId,
            status: { $in: ['Active', 'Closed'] },
            startDate: { $gte: since }
        })
            .select('title type status startDate endDate anonymous targetAudience targetDepartments targetRoles targetEmployees lifecycleTrigger')
            .lean(),
        SurveyResponse.find({
            organizationId,
            submittedAt: { $gte: since },
            $or: [{ employeeId: empId }, { respondentHash: hash }]
        })
            .select('surveyId submittedAt isAnonymous')
            .lean(),
        Recognition.find({
            organizationId,
            status: 'Approved',
            createdAt: { $gte: since },
            $or: [{ recipientId: empId }, { recipientIds: empId }]
        })
            .populate('givenBy', 'name lastName')
            .select('title type givenBy createdAt recipientType teamLabel targetDepartment')
            .lean(),
        Recognition.find({
            organizationId,
            givenBy: empId,
            createdAt: { $gte: since }
        })
            .select('title type status createdAt recipientType teamLabel targetDepartment recipientId')
            .populate('recipientId', 'name lastName')
            .lean(),
        Feedback.find({
            organizationId,
            employeeId: empId,
            anonymous: { $ne: true },
            updatedAt: { $gte: since }
        })
            .select('subject type status updatedAt createdAt resolutionNote')
            .lean(),
        EngagementActionPlan.find({
            organizationId,
            owner: empId,
            createdAt: { $gte: since }
        })
            .select('title status priority dueDate createdAt')
            .lean(),
        Feedback.find({
            organizationId,
            type: 'Suggestion',
            status: 'Implemented',
            employeeId: empId,
            anonymous: { $ne: true },
            updatedAt: { $gte: since }
        })
            .select('subject resolutionNote updatedAt implementationDate')
            .lean()
    ]);

    const eligibleSurveys = surveys.filter((s) => surveyMatchesEmployee(s, employee));
    const respondedIds = new Set(responses.map((r) => String(r.surveyId)));
    const items = [];

    for (const s of eligibleSurveys) {
        items.push({
            kind: s.lifecycleTrigger
                ? 'lifecycle_survey_assigned'
                : s.type === 'Pulse'
                  ? 'pulse_assigned'
                  : 'survey_assigned',
            at: s.startDate,
            title: s.title,
            meta: {
                surveyId: s._id,
                type: s.type,
                status: s.status,
                lifecycleTrigger: s.lifecycleTrigger || null
            }
        });
    }
    for (const r of responses) {
        items.push({
            kind: 'survey_completed',
            at: r.submittedAt,
            title: 'You completed a survey',
            meta: { surveyId: r.surveyId, anonymous: Boolean(r.isAnonymous) }
        });
    }
    for (const rec of received) {
        items.push({
            kind: 'recognition_received',
            at: rec.createdAt,
            title: rec.title,
            meta: { type: rec.type, from: rec.givenBy ? `${rec.givenBy.name || ''} ${rec.givenBy.lastName || ''}`.trim() : 'A colleague' }
        });
    }
    for (const rec of given) {
        items.push({
            kind: 'recognition_given',
            at: rec.createdAt,
            title: rec.title,
            meta: { type: rec.type, status: rec.status }
        });
    }
    for (const f of ownFeedback) {
        if (String(f.status) === 'Submitted' || String(f.status) === 'Open') continue;
        items.push({
            kind:
                f.type === 'Suggestion' && f.status === 'Implemented'
                    ? 'suggestion_implemented'
                    : f.type === 'Suggestion'
                      ? 'suggestion_status'
                      : 'feedback_status',
            at: f.updatedAt || f.createdAt,
            title: f.subject,
            meta: {
                status: f.status,
                type: f.type,
                resolutionNote: f.resolutionNote || null
            }
        });
    }
    for (const s of implementedSuggestions) {
        // Avoid duplicate if already added from ownFeedback loop
        if (items.some((i) => i.kind === 'suggestion_implemented' && i.title === s.subject)) continue;
        items.push({
            kind: 'suggestion_implemented',
            at: s.implementationDate || s.updatedAt,
            title: s.subject,
            meta: {
                status: 'Implemented',
                resolutionNote: s.resolutionNote || null
            }
        });
    }
    for (const p of ownPlans) {
        items.push({
            kind: 'action_plan',
            at: p.createdAt,
            title: p.title,
            meta: { status: p.status, priority: p.priority, dueDate: p.dueDate, planId: p._id }
        });
    }

    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ success: true, data: items.slice(0, 50) });
});

/**
 * Lightweight celebrations from existing joiningDate. Does not send notifications.
 */
export const getEngagementCelebrations = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [employees, implemented] = await Promise.all([
        Employee.find({
            organizationId,
            status: 'active',
            joiningDate: { $exists: true, $ne: null }
        })
            .select('name lastName department joiningDate')
            .lean(),
        Feedback.find({
            organizationId,
            type: 'Suggestion',
            status: 'Implemented',
            $or: [
                { implementationDate: { $gte: since } },
                { updatedAt: { $gte: since }, implementationDate: { $exists: false } }
            ]
        })
            .select('subject resolutionNote implementationDate updatedAt anonymous')
            .sort({ implementationDate: -1, updatedAt: -1 })
            .limit(15)
            .lean()
    ]);

    const celebrations = [];
    for (const emp of employees) {
        const join = new Date(emp.joiningDate);
        if (Number.isNaN(join.getTime())) continue;
        const years = now.getFullYear() - join.getFullYear();
        if (years < 1) continue;
        const anniversaryThisYear = new Date(now.getFullYear(), join.getMonth(), join.getDate());
        const diffDays = Math.round((anniversaryThisYear.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const isToday = join.getMonth() === month && join.getDate() === day;
        const upcoming = diffDays >= 0 && diffDays <= 14;
        const recent = diffDays < 0 && diffDays >= -7;
        if (!isToday && !upcoming && !recent) continue;
        celebrations.push({
            kind: 'work_anniversary',
            employeeName: `${emp.name || ''} ${emp.lastName || ''}`.trim(),
            department: emp.department || '',
            years,
            joiningDate: emp.joiningDate,
            message: `Congratulations to ${`${emp.name || ''} ${emp.lastName || ''}`.trim()} on completing ${years} year${years === 1 ? '' : 's'} with the company.`
        });
    }

    for (const s of implemented) {
        const outcome = s.resolutionNote
            ? ` Outcome: ${String(s.resolutionNote).slice(0, 160)}`
            : '';
        celebrations.push({
            kind: 'suggestion_implemented',
            subject: s.subject,
            resolutionNote: s.resolutionNote || null,
            at: s.implementationDate || s.updatedAt,
            // Never expose anonymous submitter identity
            message: `An employee suggestion was implemented: "${s.subject}".${outcome}`
        });
    }

    celebrations.sort((a, b) => {
        if (a.kind === 'suggestion_implemented' && b.kind !== 'suggestion_implemented') return -1;
        if (b.kind === 'suggestion_implemented' && a.kind !== 'suggestion_implemented') return 1;
        return (b.years || 0) - (a.years || 0);
    });
    res.json({ success: true, data: celebrations.slice(0, 25) });
});
