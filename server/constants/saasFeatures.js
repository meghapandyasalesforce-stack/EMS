/**
 * SaaS module feature keys — used by tenantService and requireFeature middleware.
 * Plan matrices live in subscriptionPlans.js (PLAN_MODULE_FEATURES).
 */

export const SAAS_FEATURES = {
    EMPLOYEES: 'employees',
    LEAVE: 'leave',
    ATTENDANCE: 'attendance',
    RECRUITMENT: 'recruitment',
    PAYROLL: 'payroll',
    PERFORMANCE: 'performance',
    WORKFORCE_PLANNING: 'workforcePlanning',
    LIFECYCLE: 'lifecycle',
    ENGAGEMENT: 'engagement',
    DOCUMENTS: 'documents',
    ANALYTICS: 'analytics',
    PROJECTS: 'projects',
};

export const ALL_SAAS_FEATURES = Object.values(SAAS_FEATURES);

/** Human-readable labels for admin UI */
export const SAAS_FEATURE_LABELS = {
    [SAAS_FEATURES.EMPLOYEES]: 'Employees',
    [SAAS_FEATURES.LEAVE]: 'Leave Management',
    [SAAS_FEATURES.ATTENDANCE]: 'Attendance',
    [SAAS_FEATURES.RECRUITMENT]: 'Recruitment / ATS',
    [SAAS_FEATURES.PAYROLL]: 'Payroll',
    [SAAS_FEATURES.PERFORMANCE]: 'Performance',
    [SAAS_FEATURES.WORKFORCE_PLANNING]: 'Workforce Planning',
    [SAAS_FEATURES.LIFECYCLE]: 'Employee Lifecycle',
    [SAAS_FEATURES.ENGAGEMENT]: 'Engagement',
    [SAAS_FEATURES.DOCUMENTS]: 'Documents',
    [SAAS_FEATURES.ANALYTICS]: 'Analytics & Reports',
    [SAAS_FEATURES.PROJECTS]: 'Projects',
};
