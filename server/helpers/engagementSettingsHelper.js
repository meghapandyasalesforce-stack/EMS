import Organization from '../models/organization.model.js';

const DEFAULT_ANALYTICS_MIN_RESPONSES = 5;

const FEATURE_DEFAULTS = {
    surveys: true,
    feedback: true,
    suggestions: true,
    recognition: true,
    pulse: true
};

const NOTIFICATION_DEFAULTS = {
    surveyAssigned: true,
    surveyReminder: true,
    recognitionReceived: true,
    actionPlanAssigned: true,
    actionPlanDue: true,
    suggestionImplemented: true,
    lifecycleSurveyAssigned: true
};

const LIFECYCLE_DEFAULTS = {
    enabled: false,
    day7: true,
    day30: true,
    day90: true,
    exit: true,
    openDurationDays: 7,
    anonymous: true
};

export const ENGAGEMENT_FEATURES = Object.keys(FEATURE_DEFAULTS);
export const ENGAGEMENT_NOTIFICATION_KEYS = Object.keys(NOTIFICATION_DEFAULTS);
export const LIFECYCLE_TRIGGER_KEYS = ['day7', 'day30', 'day90', 'exit'];

const clampMinResponses = (value) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return DEFAULT_ANALYTICS_MIN_RESPONSES;
    return Math.min(50, Math.max(DEFAULT_ANALYTICS_MIN_RESPONSES, n));
};

const clampOpenDuration = (value) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return LIFECYCLE_DEFAULTS.openDurationDays;
    return Math.min(30, Math.max(3, n));
};

export const normalizeLifecycleSettings = (raw = {}) => {
    const lifecycle = { ...LIFECYCLE_DEFAULTS, ...(raw || {}) };
    return {
        enabled: Boolean(lifecycle.enabled),
        day7: lifecycle.day7 !== false,
        day30: lifecycle.day30 !== false,
        day90: lifecycle.day90 !== false,
        exit: lifecycle.exit !== false,
        openDurationDays: clampOpenDuration(lifecycle.openDurationDays),
        anonymous: lifecycle.anonymous !== false
    };
};

export const normalizeEngagementSettings = (raw = {}) => {
    const features = { ...FEATURE_DEFAULTS, ...(raw.features || {}) };
    Object.keys(FEATURE_DEFAULTS).forEach((key) => {
        features[key] = features[key] !== false;
    });
    const notifications = { ...NOTIFICATION_DEFAULTS, ...(raw.notifications || {}) };
    Object.keys(NOTIFICATION_DEFAULTS).forEach((key) => {
        notifications[key] = notifications[key] !== false;
    });
    return {
        recognitionRequireApproval: Boolean(raw.recognitionRequireApproval),
        features,
        anonymousFeedbackDefault: Boolean(raw.anonymousFeedbackDefault),
        analyticsMinResponses: clampMinResponses(raw.analyticsMinResponses),
        notifications,
        lifecycle: normalizeLifecycleSettings(raw.lifecycle)
    };
};

export const loadEngagementSettings = async (organizationId) => {
    if (!organizationId) return normalizeEngagementSettings();
    const org = await Organization.findById(organizationId)
        .select('settings.engagement')
        .lean();
    return normalizeEngagementSettings(org?.settings?.engagement);
};

export const isEngagementFeatureEnabled = (settings, feature) => {
    if (!feature) return true;
    if (!settings?.features) return true;
    return settings.features[feature] !== false;
};

export const featureDisabledResponse = (feature) => ({
    success: false,
    message: `Engagement ${feature} is currently disabled for this organization.`,
    code: 'FEATURE_DISABLED'
});

export const resolveOrgAnalyticsMinResponses = (settings, req) => {
    const orgFloor = clampMinResponses(settings?.analyticsMinResponses);
    const raw = req?.query?.minResponses ?? req?.body?.minResponses;
    if (raw === undefined || raw === null || raw === '') return orgFloor;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return orgFloor;
    return Math.min(50, Math.max(orgFloor, n));
};

/** Employee-facing privacy copy (no technical internals). */
export const buildEngagementPrivacySummary = (settings) => {
    const min = clampMinResponses(settings?.analyticsMinResponses);
    return {
        analyticsMinResponses: min,
        anonymousFeedbackDefault: Boolean(settings?.anonymousFeedbackDefault),
        points: [
            'Anonymous feedback and anonymous surveys do not expose your identity to managers or colleagues.',
            `Engagement analytics are only shown when there are at least ${min} responses in a group, so individuals cannot be singled out.`,
            'Managers only see authorized team-level engagement information for their direct reports.',
            'HR and Admin manage Engagement according to their assigned permissions.',
            'You can always see your own identified submissions and any outcomes shared with you (such as implemented suggestions).'
        ]
    };
};
