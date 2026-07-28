/**
 * Phase 2.6 — Enterprise Lifecycle Reports & Analytics
 * Configuration-driven report catalog (no hardcoded business logic in UI).
 */

export const LIFECYCLE_REPORT_SECTIONS = Object.freeze([
    {
        key: 'onboarding',
        label: 'Onboarding',
        children: ['joiningTrend', 'pendingJoining', 'documentCompletion', 'offerAnalytics', 'bgvAnalytics', 'avgOnboardingTime'],
    },
    {
        key: 'offboarding',
        label: 'Offboarding',
        children: ['attrition', 'exitReasons', 'clearance', 'noticePeriod', 'fnf', 'assetReturn', 'knowledgeTransfer', 'avgExitTime'],
    },
    {
        key: 'hrAnalytics',
        label: 'HR Analytics',
        children: ['department', 'location', 'designation', 'manager', 'hiring', 'turnover'],
    },
]);

export const LIFECYCLE_REPORT_CATEGORIES = Object.freeze(
    LIFECYCLE_REPORT_SECTIONS.flatMap((s) => [s.key, ...s.children]),
);

export const LIFECYCLE_REPORT_EXPORT_FORMATS = Object.freeze(['csv', 'excel', 'pdf']);

export const LIFECYCLE_SCHEDULE_FREQUENCIES = Object.freeze([
    { key: 'daily', label: 'Daily', cron: '0 6 * * *' },
    { key: 'weekly', label: 'Weekly (Monday)', cron: '0 6 * * 1' },
    { key: 'monthly', label: 'Monthly (1st)', cron: '0 6 1 * *' },
]);

export const DEFAULT_REPORTING_POLICY = Object.freeze({
    enabled: true,
    defaultDateRangeDays: 90,
    enabledCategories: [...LIFECYCLE_REPORT_CATEGORIES],
    allowScheduledReports: true,
    allowExport: true,
    retentionDays: 365,
});
