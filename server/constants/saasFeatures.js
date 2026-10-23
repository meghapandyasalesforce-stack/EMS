/**
 * SaaS module feature keys — used by tenantService and requireFeature middleware.
 * Plan matrices live in subscriptionPlans / planCatalog.
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

/**
 * Commercial product catalog for the control-panel Feature Catalog page.
 * Submodules are documentation-level; SaaS gating uses the parent featureKey.
 */
export const FEATURE_CATALOG = [
    {
        category: 'Core HR',
        items: [
            {
                featureKey: SAAS_FEATURES.EMPLOYEES,
                label: 'Employees',
                description: 'Employee directory, org structure, roles',
                submodules: ['Directory', 'Departments', 'Job roles', 'Org chart'],
            },
            {
                featureKey: SAAS_FEATURES.LEAVE,
                label: 'Leave Management',
                description: 'Leave policies, requests, balances',
                submodules: ['Leave types', 'Approvals', 'Balances', 'Encashment'],
            },
            {
                featureKey: SAAS_FEATURES.ATTENDANCE,
                label: 'Attendance',
                description: 'Punch, history, regularization, WFH',
                submodules: ['Daily attendance', 'Regularization', 'WFH', 'Comp-off'],
            },
        ],
    },
    {
        category: 'Talent',
        items: [
            {
                featureKey: SAAS_FEATURES.RECRUITMENT,
                label: 'Recruitment / ATS',
                description: 'Jobs, pipeline, careers portal',
                submodules: ['Jobs', 'Candidates', 'Careers page', 'Resume inbox'],
            },
            {
                featureKey: SAAS_FEATURES.PERFORMANCE,
                label: 'Performance',
                description: 'Reviews, goals, cycles',
                submodules: ['Review cycles', 'Goals', 'Feedback'],
            },
            {
                featureKey: SAAS_FEATURES.WORKFORCE_PLANNING,
                label: 'Workforce Planning',
                description: 'Headcount plans and forecasts',
                submodules: ['Workforce plans', 'Forecasts'],
            },
            {
                featureKey: SAAS_FEATURES.LIFECYCLE,
                label: 'Employee Lifecycle',
                description: 'Onboarding / offboarding (deep toggles stay in-tenant)',
                submodules: ['Onboarding', 'Offboarding', 'Offer letter', 'E-sign', 'Exit interview'],
            },
        ],
    },
    {
        category: 'Finance',
        items: [
            {
                featureKey: SAAS_FEATURES.PAYROLL,
                label: 'Payroll',
                description: 'Payroll runs, salary structure, payslips',
                submodules: ['Payroll runs', 'Salary structure', 'Payslips'],
            },
        ],
    },
    {
        category: 'Collaboration & insight',
        items: [
            {
                featureKey: SAAS_FEATURES.ENGAGEMENT,
                label: 'Engagement',
                description: 'Surveys, recognition, pulse',
                submodules: ['Surveys', 'Recognition', 'Pulse'],
            },
            {
                featureKey: SAAS_FEATURES.DOCUMENTS,
                label: 'Documents',
                description: 'Company docs, employee docs, templates',
                submodules: ['Document library', 'Templates', 'Requests'],
            },
            {
                featureKey: SAAS_FEATURES.ANALYTICS,
                label: 'Analytics & Reports',
                description: 'HR reports and analytics dashboards',
                submodules: ['HR reports', 'Analytics'],
            },
            {
                featureKey: SAAS_FEATURES.PROJECTS,
                label: 'Projects',
                description: 'Projects and work items',
                submodules: ['Projects', 'Tasks'],
            },
        ],
    },
];

/** Map frontend nav paths → SaaS feature key (for nav gating) */
export const NAV_PATH_FEATURE_MAP = {
    '/employees': SAAS_FEATURES.EMPLOYEES,
    '/organization/chart': SAAS_FEATURES.EMPLOYEES,
    '/leave-management': SAAS_FEATURES.LEAVE,
    '/my-leave': SAAS_FEATURES.LEAVE,
    '/employee/leave-attendance': SAAS_FEATURES.LEAVE,
    '/calendar-management': SAAS_FEATURES.LEAVE,
    '/employee/calendar': SAAS_FEATURES.LEAVE,
    '/all-attendance-history': SAAS_FEATURES.ATTENDANCE,
    '/my-attendance-regularization': SAAS_FEATURES.ATTENDANCE,
    '/manager/attendance-regularization': SAAS_FEATURES.ATTENDANCE,
    '/attendance-regularization': SAAS_FEATURES.ATTENDANCE,
    '/recruitment': SAAS_FEATURES.RECRUITMENT,
    '/employee/internal-jobs': SAAS_FEATURES.RECRUITMENT,
    '/admin-payroll': SAAS_FEATURES.PAYROLL,
    '/employee-payroll': SAAS_FEATURES.PAYROLL,
    '/salary-structure': SAAS_FEATURES.PAYROLL,
    '/onboarding': SAAS_FEATURES.LIFECYCLE,
    '/one-on-one': SAAS_FEATURES.PERFORMANCE,
    '/benefits': SAAS_FEATURES.PERFORMANCE,
    '/learning': SAAS_FEATURES.PERFORMANCE,
    '/team-learning': SAAS_FEATURES.PERFORMANCE,
    '/employee/benefits-learning': SAAS_FEATURES.PERFORMANCE,
    '/engagement': SAAS_FEATURES.ENGAGEMENT,
    '/employee/engagement': SAAS_FEATURES.ENGAGEMENT,
    '/documents': SAAS_FEATURES.DOCUMENTS,
    '/admin/document-management': SAAS_FEATURES.DOCUMENTS,
    '/employee/documents-id': SAAS_FEATURES.DOCUMENTS,
    '/employee/my-documents': SAAS_FEATURES.DOCUMENTS,
    '/employee/document-requests': SAAS_FEATURES.DOCUMENTS,
    '/id-card-generator': SAAS_FEATURES.DOCUMENTS,
    '/workforce': SAAS_FEATURES.WORKFORCE_PLANNING,
    '/projects': SAAS_FEATURES.PROJECTS,
    '/employee/projects': SAAS_FEATURES.PROJECTS,
    '/admin/reports': SAAS_FEATURES.ANALYTICS,
    '/hr/analytics': SAAS_FEATURES.ANALYTICS,
};
