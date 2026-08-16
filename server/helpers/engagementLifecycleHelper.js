/**
 * Lifecycle-based engagement surveys.
 * Reuses Survey model + notify() — does not create a separate survey system.
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
 * Create (or skip if exists) a lifecycle Survey for one employee.
 * Returns { created: boolean, survey? }
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

    const existing = await Survey.findOne({
        organizationId,
        lifecycleTrigger: trigger,
        lifecycleEmployeeId: employee._id
    })
        .select('_id')
        .lean();
    if (existing) return { created: false, surveyId: existing._id };

    const lifecycle = settings.lifecycle || {};
    const openDays = Number(lifecycle.openDurationDays) || 7;
    const startDate = new Date(now);
    const endDate = new Date(now.getTime() + openDays * MS_PER_DAY);
    const anonymous = lifecycle.anonymous !== false;
    const empName = `${employee.name || ''} ${employee.lastName || ''}`.trim() || 'Employee';

    const survey = new Survey({
        organizationId,
        title: template.title,
        description: template.description,
        type: template.type,
        questions: template.questions,
        targetAudience: 'Specific Employees',
        targetEmployees: [employee._id],
        startDate,
        endDate,
        anonymous,
        status: 'Active',
        reminderEnabled: true,
        reminderDaysBefore: Math.min(2, Math.max(0, openDays - 1)),
        totalInvites: 1,
        lifecycleTrigger: trigger,
        lifecycleEmployeeId: employee._id
    });

    try {
        await survey.save();
    } catch (err) {
        // Race on unique index — treat as already created
        if (err?.code === 11000) {
            return { created: false };
        }
        throw err;
    }

    await safeLifecycleNotify(settings, {
        type: 'engagement.lifecycle.survey_assigned',
        organizationId,
        data: {
            survey,
            recipients: [employee._id.toString()],
            trigger,
            triggerLabel: TRIGGER_META[trigger]?.label || trigger,
            employeeName: empName
        }
    });

    logger.info('Lifecycle engagement survey created', {
        organizationId: String(organizationId),
        employeeId: String(employee._id),
        trigger,
        surveyId: String(survey._id)
    });

    return { created: true, survey };
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
