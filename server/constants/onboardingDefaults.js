/** Default employee onboarding template — used when auto-creating workflows */

export const ONBOARDING_DOCUMENT_TYPES = [
    { key: 'AADHAAR', label: 'Aadhaar Card', required: true },
    { key: 'PAN', label: 'PAN Card', required: true },
    { key: 'PASSPORT', label: 'Passport', required: false },
    { key: 'DEGREE', label: 'Degree Certificate', required: true },
    { key: 'EXPERIENCE', label: 'Experience Certificate', required: false },
    { key: 'RESUME', label: 'Resume', required: true },
    { key: 'OFFER_ACK', label: 'Offer Letter Acknowledgement', required: true },
    { key: 'PHOTO', label: 'Photograph', required: true },
    { key: 'BANK_DETAILS', label: 'Bank Details', required: true },
    { key: 'OTHER', label: 'Other Document', required: false },
];

export const DEFAULT_ONBOARDING_CHECKLIST = [
    { item: 'Accept Offer Letter', category: 'HR', mandatory: true, phase: 'Day 1' },
    { item: 'Sign NDA', category: 'HR', mandatory: true, phase: 'Day 1' },
    { item: 'Read Company Policies', category: 'HR', mandatory: true, phase: 'Week 1' },
    { item: 'Complete HR Forms', category: 'HR', mandatory: true, phase: 'Week 1' },
    { item: 'Laptop Received', category: 'IT', mandatory: true, phase: 'Day 1' },
    { item: 'Email Activated', category: 'IT', mandatory: true, phase: 'Day 1' },
    { item: 'Payroll Added', category: 'Payroll', mandatory: true, phase: 'Week 1' },
    { item: 'ID Card Collected', category: 'HR', mandatory: false, phase: 'Week 2' },
    { item: 'Manager Induction Complete', category: 'Manager', mandatory: true, phase: 'Week 1' },
    { item: 'Buddy Welcome Meeting', category: 'Buddy', mandatory: false, phase: 'Day 1' },
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
        requiresAllMandatoryDocsVerified: true,
    },
    {
        title: 'Setup email and system access',
        description: 'Create email account and grant required system access.',
        category: 'IT Setup',
        assigneeRole: 'it',
        priority: 'High',
        dueDaysFromStart: 2,
        phase: 'Day 1',
    },
    {
        title: 'Assign laptop and equipment',
        description: 'Provide laptop and required equipment to the new joiner.',
        category: 'Equipment',
        assigneeRole: 'it',
        priority: 'Medium',
        dueDaysFromStart: 1,
        phase: 'Day 1',
    },
    {
        title: 'Add employee to payroll',
        description: 'Configure salary structure and payroll records.',
        category: 'HR Paperwork',
        assigneeRole: 'payroll',
        priority: 'High',
        dueDaysFromStart: 7,
        phase: 'Week 1',
    },
    {
        title: 'Manager induction session',
        description: 'Conduct team introduction and role briefing.',
        category: 'Orientation',
        assigneeRole: 'manager',
        priority: 'Medium',
        dueDaysFromStart: 5,
        phase: 'Week 1',
    },
    {
        title: 'Buddy welcome meeting',
        description: 'Schedule and conduct welcome meeting with assigned buddy.',
        category: 'Orientation',
        assigneeRole: 'buddy',
        priority: 'Medium',
        dueDaysFromStart: 3,
        phase: 'Day 1',
    },
    {
        title: 'Complete compliance training',
        description: 'Finish mandatory company policy and compliance modules.',
        category: 'Training',
        assigneeRole: 'employee',
        priority: 'Medium',
        dueDaysFromStart: 14,
        phase: 'Week 2',
    },
    // {
    //     title: '30-day review meeting',
    //     description: 'Schedule onboarding review with HR and manager.',
    //     category: 'Orientation',
    //     assigneeRole: 'hr',
    //     priority: 'Low',
    //     dueDaysFromStart: 30,
    //     phase: 'Month 1',
    // },
];

export const ONBOARDING_TIMELINE_PHASES = ['Day 0', 'Day 1', 'Week 1', 'Week 2', 'Week 3', 'Month 1'];

/** Jira-style roadmap milestones */
export const ONBOARDING_TIMELINE_ROADMAP = [
    { phase: 'Day 0', title: 'Offer Accepted', description: 'Offer letter signed and joining confirmed' },
    { phase: 'Day 1', title: 'Joining Day', description: 'Welcome, ID setup, laptop, email access' },
    { phase: 'Week 1', title: 'Documentation', description: 'Identity docs, bank details, HR forms' },
    { phase: 'Week 2', title: 'Training', description: 'Compliance, policies, role training' },
    { phase: 'Week 3', title: 'Evaluation', description: 'Manager check-in, buddy feedback' },
    { phase: 'Month 1', title: 'Review', description: '30-day onboarding review meeting' },
];

export const WORKFLOW_STATUSES = [
    'Draft', 'Scheduled', 'Not Started', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue',
];

export const DEFAULT_ASSET_TYPES = [
    { assetType: 'Laptop', name: 'Laptop', mandatory: true },
    { assetType: 'Mouse', name: 'Mouse', mandatory: false },
    { assetType: 'Keyboard', name: 'Keyboard', mandatory: false },
    { assetType: 'Monitor', name: 'Monitor', mandatory: false },
    { assetType: 'ID Card', name: 'ID Card', mandatory: true },
    { assetType: 'Access Card', name: 'Access Card', mandatory: true },
    { assetType: 'SIM', name: 'SIM Card', mandatory: false },
    { assetType: 'Locker', name: 'Locker', mandatory: false },
    { assetType: 'Headphones', name: 'Headphones', mandatory: false },
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
    { documentType: 'OFFER_LETTER', title: 'Offer Letter', mandatory: true },
    { documentType: 'NDA', title: 'Non-Disclosure Agreement', mandatory: true },
    { documentType: 'COMPANY_POLICIES', title: 'Company Policies', mandatory: true },
    { documentType: 'CODE_OF_CONDUCT', title: 'Code of Conduct', mandatory: true },
    { documentType: 'SECURITY_POLICY', title: 'Security Policy', mandatory: true },
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
    'Engineering', 'Human Resources', 'Finance', 'Sales', 'Marketing', 'Operations', 'IT Support',
];

export const DEFAULT_ORG_DESIGNATIONS = [
    'Software Engineer', 'HR Manager', 'Finance Manager', 'Sales Executive',
    'Marketing Manager', 'Operations Manager', 'Project Manager',
];

export const DEFAULT_EMPLOYMENT_TYPES = [
    { name: 'Full Time', code: 'FT' },
    { name: 'Part Time', code: 'PT' },
    { name: 'Contract', code: 'CT' },
    { name: 'Intern', code: 'IN' },
];

export const ASSIGNEE_ROLES = ['employee', 'hr', 'manager', 'buddy', 'it', 'payroll', 'admin'];
