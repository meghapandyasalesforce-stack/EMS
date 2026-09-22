/** Default employee onboarding template — used when auto-creating workflows */

export const ONBOARDING_DOCUMENT_TYPES = [
    { key: 'AADHAAR', label: 'Aadhaar Card', required: true, featureKey: 'compliance.india.aadhaar' },
    { key: 'PAN', label: 'PAN Card', required: true, featureKey: 'compliance.india.pan' },
    { key: 'PASSPORT', label: 'Passport', required: false, featureKey: 'documentCollection' },
    { key: 'DEGREE', label: 'Degree Certificate', required: true, featureKey: 'documentCollection' },
    { key: 'EXPERIENCE', label: 'Experience Certificate', required: false, featureKey: 'documentCollection' },
    { key: 'RESUME', label: 'Resume', required: false, featureKey: 'documentCollection' },
    { key: 'OFFER_ACK', label: 'Offer Letter Acknowledgement', required: true, featureKey: 'documentCollection' },
    { key: 'NDA', label: 'Non-Disclosure Agreement', required: true, featureKey: 'documentCollection' },
    { key: 'PHOTO', label: 'Photograph', required: true, featureKey: 'documentCollection' },
    { key: 'BANK_DETAILS', label: 'Bank Details', required: true, featureKey: 'bankDetails' },
    { key: 'OTHER', label: 'Other Document', required: false, featureKey: 'documentCollection' },
];

export const DEFAULT_ONBOARDING_STAGES = [
    { key: 'pre_boarding', name: 'Pre-Boarding', order: 0, mandatory: true, featureKey: 'preBoarding', dueDaysFromStart: 0 },
    { key: 'documentation', name: 'Documentation', order: 1, mandatory: true, featureKey: 'documentCollection', dueDaysFromStart: 7 },
    { key: 'it_setup', name: 'IT Setup', order: 2, mandatory: true, featureKey: 'itAssetProvisioning', dueDaysFromStart: 1 },
    { key: 'hr_setup', name: 'HR Setup', order: 3, mandatory: true, featureKey: 'payrollSetup', dueDaysFromStart: 7 },
    { key: 'induction', name: 'Induction', order: 4, mandatory: true, featureKey: 'induction', dueDaysFromStart: 7 },
];

export const DEFAULT_ONBOARDING_CHECKLIST = [
    { item: 'Accept Offer Letter', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'offerAcceptance', order: 1 },
    { item: 'Sign NDA', category: 'HR', mandatory: true, phase: 'Day 1', featureKey: 'eSignature', order: 2 },
    { item: 'Read Company Policies', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'induction', order: 3 },
    { item: 'Complete HR Forms', category: 'HR', mandatory: true, phase: 'Week 1', featureKey: 'digitalForms', order: 4 },
    { item: 'Laptop Received', category: 'IT', mandatory: true, phase: 'Day 1', featureKey: 'itAssetProvisioning', order: 5 },
    { item: 'Email Activated', category: 'IT', mandatory: true, phase: 'Day 1', featureKey: 'softwareAccessRequest', order: 6 },
    { item: 'Payroll Added', category: 'Payroll', mandatory: true, phase: 'Week 1', featureKey: 'payrollSetup', order: 7 },
    { item: 'ID Card Collected', category: 'HR', mandatory: false, phase: 'Week 2', featureKey: 'employeeIdGeneration', order: 8 },
    { item: 'Manager Induction Complete', category: 'Manager', mandatory: true, phase: 'Week 1', featureKey: 'induction', order: 9 },
    { item: 'Buddy Welcome Meeting', category: 'Buddy', mandatory: false, phase: 'Day 1', featureKey: 'buddyProgram', order: 10 },
];

export const DEFAULT_ONBOARDING_TASKS = [
    {
        title: 'Upload identity documents',
        description: 'Upload Aadhaar, PAN, and photograph for HR verification.',
        category: 'Documentation',
        assigneeRole: 'employee',
        priority: 'High',
        dueDaysFromStart: 3,
        phase: 'Week 1',
        stageKey: 'documentation',
        featureKey: 'documentCollection',
        order: 1,
        requiredDocuments: ['AADHAAR', 'PAN', 'PHOTO'],
    },
    {
        title: 'Upload bank details',
        description: 'Submit bank account details for payroll setup.',
        category: 'Documentation',
        assigneeRole: 'employee',
        priority: 'High',
        dueDaysFromStart: 5,
        phase: 'Week 1',
        stageKey: 'documentation',
        featureKey: 'bankDetails',
        order: 2,
        requiredDocuments: ['BANK_DETAILS'],
    },
    {
        title: 'Verify employee documents',
        description: 'Review and verify all uploaded onboarding documents.',
        category: 'HR Paperwork',
        assigneeRole: 'hr',
        priority: 'High',
        dueDaysFromStart: 7,
        phase: 'Week 1',
        stageKey: 'documentation',
        featureKey: 'documentApproval',
        order: 3,
        requiresAllMandatoryDocsVerified: true,
    },
    {
        title: 'Assign laptop and equipment',
        description: 'Provide laptop and required equipment to the new joiner.',
        category: 'Equipment',
        assigneeRole: 'it',
        priority: 'Medium',
        dueDaysFromStart: 1,
        phase: 'Day 1',
        stageKey: 'it_setup',
        featureKey: 'itAssetProvisioning',
        order: 4,
    },
    {
        title: 'Add employee to payroll',
        description: 'Configure salary structure and payroll records.',
        category: 'HR Paperwork',
        assigneeRole: 'payroll',
        priority: 'High',
        dueDaysFromStart: 7,
        phase: 'Week 1',
        stageKey: 'hr_setup',
        featureKey: 'payrollSetup',
        order: 5,
    },
    {
        title: 'Manager induction session',
        description: 'Conduct team introduction and role briefing.',
        category: 'Orientation',
        assigneeRole: 'manager',
        priority: 'Medium',
        dueDaysFromStart: 5,
        phase: 'Week 1',
        stageKey: 'induction',
        featureKey: 'induction',
        order: 6,
    },
    {
        title: 'Buddy welcome meeting',
        description: 'Schedule and conduct welcome meeting with assigned buddy.',
        category: 'Orientation',
        assigneeRole: 'buddy',
        priority: 'Medium',
        dueDaysFromStart: 3,
        phase: 'Day 1',
        stageKey: 'induction',
        featureKey: 'buddyProgram',
        order: 7,
    },
];

export const ONBOARDING_TIMELINE_PHASES = ['Day 0', 'Day 1', 'Week 1', 'Week 2', 'Week 3', 'Month 1'];

/** Jira-style roadmap milestones */
export const ONBOARDING_TIMELINE_ROADMAP = [
    { phase: 'Day 0', title: 'Offer Accepted', description: 'Offer letter signed and joining confirmed' },
    { phase: 'Day 1', title: 'Joining Day', description: 'Welcome, ID setup, laptop, email access' },
    { phase: 'Week 1', title: 'Documentation', description: 'Identity docs, bank details, HR forms' },
    // { phase: 'Week 2', title: 'Training', description: 'Compliance, policies, role training' },
    { phase: 'Week 3', title: 'Evaluation', description: 'Manager check-in, buddy feedback' },
    { phase: 'Month 1', title: 'Review', description: '30-day onboarding review meeting' },
];

export const WORKFLOW_STATUSES = [
    'Draft', 'Scheduled', 'Not Started', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue',
];

export const DEFAULT_ASSET_TYPES = [
    { assetType: 'Laptop', name: 'Laptop', mandatory: true, featureKey: 'itAssetProvisioning', order: 1 },
    { assetType: 'Mouse', name: 'Mouse', mandatory: false, featureKey: 'itAssetProvisioning', order: 2 },
    { assetType: 'Keyboard', name: 'Keyboard', mandatory: false, featureKey: 'itAssetProvisioning', order: 3 },
    { assetType: 'Monitor', name: 'Monitor', mandatory: false, featureKey: 'itAssetProvisioning', order: 4 },
    { assetType: 'ID Card', name: 'ID Card', mandatory: true, featureKey: 'employeeIdGeneration', order: 5 },
    { assetType: 'Access Card', name: 'Access Card', mandatory: true, featureKey: 'softwareAccessRequest', order: 6 },
    { assetType: 'SIM', name: 'SIM Card', mandatory: false, featureKey: 'itAssetProvisioning', order: 7 },
    { assetType: 'Locker', name: 'Locker', mandatory: false, featureKey: 'itAssetProvisioning', order: 8 },
    { assetType: 'Headphones', name: 'Headphones', mandatory: false, featureKey: 'itAssetProvisioning', order: 9 },
];

export const ASSET_STATUSES = ['Pending', 'Assigned', 'Returned', 'Lost', 'Damaged'];

export const DEFAULT_TRAINING_MODULES = [
    {
        title: 'Company Orientation',
        description: 'Welcome video and company overview',
        type: 'video',
        mandatory: true,
        passingScore: 70,
        phase: 'Week 1',
    },
    {
        title: 'Compliance & Code of Conduct',
        description: 'Mandatory compliance training with quiz',
        type: 'quiz',
        mandatory: true,
        passingScore: 80,
        phase: 'Week 2',
    },
    {
        title: 'Information Security',
        description: 'Security policies and best practices',
        type: 'quiz',
        mandatory: true,
        passingScore: 75,
        phase: 'Week 2',
    },
];

export const DEFAULT_POLICY_SIGNATURES = [
    { documentType: 'OFFER_LETTER', title: 'Offer Letter', mandatory: true, featureKey: 'offerLetter' },
    { documentType: 'NDA', title: 'Non-Disclosure Agreement', mandatory: true, featureKey: 'eSignature' },
    { documentType: 'COMPANY_POLICIES', title: 'Company Policies', mandatory: true, featureKey: 'induction' },
    { documentType: 'CODE_OF_CONDUCT', title: 'Code of Conduct', mandatory: true, featureKey: 'induction' },
    { documentType: 'SECURITY_POLICY', title: 'Security Policy', mandatory: true, featureKey: 'mandatoryTraining' },
];

export const TASK_GROUPS_BY_ROLE = [
    { key: 'employee', label: 'Employee Tasks' },
    { key: 'hr', label: 'HR Tasks' },
    { key: 'it', label: 'IT Tasks' },
    { key: 'manager', label: 'Manager Tasks' },
    { key: 'buddy', label: 'Buddy Tasks' },
    { key: 'payroll', label: 'Payroll Tasks' },
];

export const ORG_ONBOARDING_STEPS = [
    'welcome',
    'email',
    'company-info',
    'logo',
    'branding',
    'office-locations',
    'working-hours',
    'timezone-currency',
    'departments',
    'holidays',
    'leave-policy',
    'attendance-policy',
    'subscription-plan',
    'company-policies',
    'smtp-email',
    'notification-preferences',
    'integrations',
    'invite-users',
    'import-employees',
    'review',
    'complete',
];

export const DEFAULT_ORG_DEPARTMENTS = [
    'Administration',
    'Engineering',
    'Human Resources',
    'Finance',
    'Sales',
    'Marketing',
    'Operations',
    'IT Support',
];

/**
 * Designations = seniority / rank only (not job function).
 * Job function belongs in DEFAULT_ORG_JOB_ROLES / Org Job Roles.
 */
export const DEFAULT_ORG_DESIGNATIONS = [
    'Intern',
    'Trainee',
    'Junior',
    'Mid-Level',
    'Senior',
    'Lead',
    'Supervisor',
    'Manager',
    'Senior Manager',
    'Director',
    'Executive',
    'VP',
    'CTO',
    'CFO',
    'CEO',
];

/**
 * Job roles = what work the person does (function), optionally linked to a department.
 * Includes titles previously mis-seeded as designations.
 */
export const DEFAULT_ORG_JOB_ROLES = [
    'Chief Executive Officer',
    'Chief Technology Officer',
    'Chief Financial Officer',
    'VP Engineering',
    'VP Finance',
    'VP Human Resources',
    'VP Sales',
    'VP Operations',
    'VP Marketing',
    'Software Engineer',
    'Senior Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'DevOps Engineer',
    'QA Tester',
    'UX/UI Designer',
    'Product Manager',
    'Project Manager',
    'IT Support Engineer',
    'HR Director',
    'HR Manager',
    'HR Executive',
    'Recruiter',
    'Finance Manager',
    'Financial Analyst',
    'Accountant',
    'Marketing Manager',
    'Marketing Executive',
    'Sales Executive',
    'Sales Representative',
    'Operations Manager',
    'Operations Coordinator',
    'Customer Support Specialist',
    'Legal Advisor',
];

export const DEFAULT_EMPLOYMENT_TYPES = [
    { name: 'Full Time', code: 'FT' },
    { name: 'Part Time', code: 'PT' },
    { name: 'Contract', code: 'CT' },
    { name: 'Intern', code: 'IN' },
];

export const ASSIGNEE_ROLES = ['employee', 'hr', 'manager', 'buddy', 'it', 'payroll', 'admin'];
