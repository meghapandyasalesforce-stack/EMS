/**
 * Lifecycle-based engagement surveys.
 * Reuses Survey model + notify() — does not create a separate survey system.
 * One shared Survey per org + trigger; eligible employees are added to targetEmployees.
 */
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { Survey, LIFECYCLE_SURVEY_TEMPLATES } from '../models/engagement.model.js';
import { loadEngagementSettings, isEngagementFeatureEnabled } from './engagementSettingsHelper.js';
import { notify } from './notificationManager.js';
import logger from './logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Assign when tenure days fall within [target, target + window) */
const JOINER_WINDOW_DAYS = 3;
/** Exit survey: look back this many days from last working / termination date */
const EXIT_LOOKBACK_DAYS = 14;

const TRIGGER_META = {
    day7: { days: 7, label: 'Day 7' },
    day30: { days: 30, label: 'Day 30' },
    day90: { days: 90, label: 'Day 90' },
    exit: { days: null, label: 'Exit' }
};

/**
 * Collapse legacy per-employee lifecycle surveys into one shared survey per trigger.
 * Merges assignees into the oldest survey; removes empty duplicates (0 responses).
 */
const consolidateLifecycleSurveysForTrigger = async (organizationId, trigger) => {
    const surveys = await Survey.find({ organizationId, lifecycleTrigger: trigger }).sort({
        createdAt: 1
    });
    if (surveys.length <= 1) return;

    const primary = surveys[0];
    const idSet = new Set(
        (primary.targetEmployees || []).map((id) => String(id)).filter(Boolean)
    );
    if (primary.lifecycleEmployeeId) {
        idSet.add(String(primary.lifecycleEmployeeId));
    }

    const toRemove = [];
    for (let i = 1; i < surveys.length; i += 1) {
        const s = surveys[i];
        (s.targetEmployees || []).forEach((id) => {
            if (id) idSet.add(String(id));
        });
        if (s.lifecycleEmployeeId) {
            idSet.add(String(s.lifecycleEmployeeId));
        }
        if ((Number(s.responseCount) || 0) === 0) {
            toRemove.push(s._id);
        } else {
            // Keep surveys that already collected responses; stop listing as Active lifecycle dupes
            if (s.status === 'Active') {
                s.status = 'Archived';
                s.lifecycleEmployeeId = null;
                await s.save();
            }
        }
    }

    primary.targetAudience = 'Specific Employees';
    primary.targetEmployees = [...idSet];
    primary.totalInvites = idSet.size;
    primary.lifecycleEmployeeId = null;
    if (primary.status === 'Closed' || primary.status === 'Archived') {
        primary.status = 'Active';
    }
    await primary.save();

    if (toRemove.length) {
        await Survey.deleteMany({ _id: { $in: toRemove }, organizationId });
        logger.info('Consolidated lifecycle survey duplicates', {
            organizationId: String(organizationId),
            trigger,
            kept: String(primary._id),
            removed: toRemove.length
        });
    }
};

const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const daysBetween = (from, to) => {
    const a = startOfDay(from).getTime();
    const b = startOfDay(to).getTime();
    return Math.floor((b - a) / MS_PER_DAY);
};

const safeLifecycleNotify = async (settings, payload) => {
    try {
        if (settings?.notifications?.lifecycleSurveyAssigned === false) return;
        if (settings?.notifications?.surveyAssigned === false) return;
        await notify(payload);
    } catch (err) {
        logger.warn('Lifecycle survey notification failed', {
            type: payload?.type,
            error: err.message
        });
    }
};

/**
 * Assign an employee to the single shared lifecycle Survey for this trigger.
 * One survey per org + trigger (Day 7 / 30 / 90 / Exit); employees are added to its audience.
 * Returns { created: boolean, assigned?: boolean, survey? }
 */
export const createLifecycleSurveyForEmployee = async ({
    organizationId,
    employee,
    trigger,
    settings,
    now = new Date()
}) => {
    if (!organizationId || !employee?._id || !trigger) {
        return { created: false };
    }
    if (!isEngagementFeatureEnabled(settings, 'surveys')) {
        return { created: false };
    }

    const template = LIFECYCLE_SURVEY_TEMPLATES[trigger];
    if (!template) return { created: false };

    const empId = employee._id;
    const empIdStr = String(empId);

    // Already on any survey for this trigger (shared or legacy per-employee)
    const alreadyAssigned = await Survey.findOne({
        organizationId,
        lifecycleTrigger: trigger,
        $or: [{ lifecycleEmployeeId: empId }, { targetEmployees: empId }]
    })
        .select('_id')
        .lean();
    if (alreadyAssigned) {
        return { created: false, surveyId: alreadyAssigned._id };
    }

    const lifecycle = settings.lifecycle || {};
    const openDays = Number(lifecycle.openDurationDays) || 7;
    const endDate = new Date(now.getTime() + openDays * MS_PER_DAY);
    const anonymous = lifecycle.anonymous !== false;
    const empName = `${employee.name || ''} ${employee.lastName || ''}`.trim() || 'Employee';

    // Reuse the oldest survey for this org + trigger (one shared survey)
    let survey = await Survey.findOne({
        organizationId,
        lifecycleTrigger: trigger
    }).sort({ createdAt: 1 });

    let created = false;

    if (survey) {
        const targets = Array.isArray(survey.targetEmployees) ? survey.targetEmployees : [];
        const alreadyOnShared = targets.some((id) => String(id) === empIdStr);
        if (alreadyOnShared) {
            return { created: false, surveyId: survey._id };
        }

        survey.targetAudience = 'Specific Employees';
        survey.targetEmployees = [...targets, empId];
        survey.totalInvites = (Number(survey.totalInvites) || targets.length) + 1;
        // Prefer shared model going forward (legacy field unused)
        survey.lifecycleEmployeeId = null;
        if (survey.status === 'Closed' || survey.status === 'Archived') {
            survey.status = 'Active';
        }
        // Keep survey open long enough for the newly assigned employee
        if (!survey.endDate || new Date(survey.endDate) < endDate) {
            survey.endDate = endDate;
        }
        await survey.save();
    } else {
        survey = new Survey({
            organizationId,
            title: template.title,
            description: template.description,
            type: template.type,
            questions: template.questions,
            targetAudience: 'Specific Employees',
            targetEmployees: [empId],
            startDate: new Date(now),
            endDate,
            anonymous,
            status: 'Active',
            reminderEnabled: true,
            reminderDaysBefore: Math.min(2, Math.max(0, openDays - 1)),
            totalInvites: 1,
            lifecycleTrigger: trigger
            // no lifecycleEmployeeId — shared across all employees for this trigger
        });

        try {
            await survey.save();
            created = true;
        } catch (err) {
            // Race: another worker created the shared survey — attach to it
            if (err?.code === 11000) {
                survey = await Survey.findOne({
                    organizationId,
                    lifecycleTrigger: trigger
                }).sort({ createdAt: 1 });
                if (!survey) throw err;
                const targets = Array.isArray(survey.targetEmployees) ? survey.targetEmployees : [];
                if (!targets.some((id) => String(id) === empIdStr)) {
                    survey.targetEmployees = [...targets, empId];
                    survey.totalInvites = (Number(survey.totalInvites) || targets.length) + 1;
                    survey.lifecycleEmployeeId = null;
                    await survey.save();
                }
                created = false;
            } else {
                throw err;
            }
        }
    }

    await safeLifecycleNotify(settings, {
        type: 'engagement.lifecycle.survey_assigned',
        organizationId,
        data: {
            survey,
            recipients: [empIdStr],
            trigger,
            triggerLabel: TRIGGER_META[trigger]?.label || trigger,
            employeeName: empName
        }
    });

    logger.info(created ? 'Lifecycle engagement survey created' : 'Lifecycle engagement survey assignee added', {
        organizationId: String(organizationId),
        employeeId: empIdStr,
        trigger,
        surveyId: String(survey._id)
    });

    return { created, assigned: true, survey };
};

const processJoinerTrigger = async (organizationId, settings, trigger, now) => {
    const meta = TRIGGER_META[trigger];
    if (!meta?.days) return 0;
    if (settings.lifecycle?.[trigger] === false) return 0;

    const minJoin = startOfDay(new Date(now.getTime() - (meta.days + JOINER_WINDOW_DAYS - 1) * MS_PER_DAY));
    const maxJoin = startOfDay(new Date(now.getTime() - meta.days * MS_PER_DAY));

    const employees = await Employee.find({
        organizationId,
        status: 'active',
        joiningDate: { $gte: minJoin, $lte: new Date(maxJoin.getTime() + MS_PER_DAY - 1) }
    })
        .select('_id name lastName joiningDate organizationId')
        .lean();

    let created = 0;
    for (const emp of employees) {
        const tenureDays = daysBetween(emp.joiningDate, now);
        if (tenureDays < meta.days || tenureDays >= meta.days + JOINER_WINDOW_DAYS) continue;
        const result = await createLifecycleSurveyForEmployee({
            organizationId,
            employee: emp,
            trigger,
            settings,
            now
        });
        if (result.created) created += 1;
    }
    return created;
};

const processExitTrigger = async (organizationId, settings, now) => {
    if (settings.lifecycle?.exit === false) return 0;

    const since = new Date(now.getTime() - EXIT_LOOKBACK_DAYS * MS_PER_DAY);

    const employees = await Employee.find({
        organizationId,
        $or: [
            { status: { $in: ['inactive', 'terminated'] }, updatedAt: { $gte: since } },
            { lastWorkingDate: { $gte: since, $lte: now } },
            { terminationDate: { $gte: since, $lte: now } }
        ]
    })
        .select('_id name lastName status lastWorkingDate terminationDate organizationId')
        .lean();

    let created = 0;
    for (const emp of employees) {
        const result = await createLifecycleSurveyForEmployee({
            organizationId,
            employee: emp,
            trigger: 'exit',
            settings,
            now
        });
        if (result.created) created += 1;
    }
    return created;
};

/**
 * Process lifecycle surveys for all orgs (or one org). Idempotent.
 */
export const processLifecycleEngagementSurveys = async (options = {}) => {
    const now = options.now || new Date();
    const orgFilter = options.organizationId ? { _id: options.organizationId } : {};

    const orgs = await Organization.find(orgFilter).select('_id settings.engagement').lean();
    let totalCreated = 0;

    for (const org of orgs) {
        try {
            const settings = await loadEngagementSettings(org._id);
            if (!settings.lifecycle?.enabled) continue;
            if (!isEngagementFeatureEnabled(settings, 'surveys')) continue;

            // One shared survey per trigger — merge any legacy per-employee copies
            await consolidateLifecycleSurveysForTrigger(org._id, 'day7');
            await consolidateLifecycleSurveysForTrigger(org._id, 'day30');
            await consolidateLifecycleSurveysForTrigger(org._id, 'day90');
            await consolidateLifecycleSurveysForTrigger(org._id, 'exit');

            totalCreated += await processJoinerTrigger(org._id, settings, 'day7', now);
            totalCreated += await processJoinerTrigger(org._id, settings, 'day30', now);
            totalCreated += await processJoinerTrigger(org._id, settings, 'day90', now);
            totalCreated += await processExitTrigger(org._id, settings, now);
        } catch (err) {
            logger.error('Lifecycle engagement processing failed for org', {
                organizationId: org._id,
                error: err.message
            });
        }
    }

    return { created: totalCreated };
};
