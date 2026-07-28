export const DEFAULT_OFFBOARDING_STAGES = Object.freeze([
    { key: 'initiation', name: 'Exit Initiation', order: 0, mandatory: true, featureKey: 'resignation', dueDaysBeforeLastWorkingDate: 10 },
    { key: 'handover', name: 'Knowledge Transfer', order: 1, mandatory: true, featureKey: 'knowledgeTransfer', dueDaysBeforeLastWorkingDate: 3 },
    { key: 'clearance', name: 'Department Clearance', order: 2, mandatory: true, featureKey: 'clearance', dueDaysBeforeLastWorkingDate: 0 },
    { key: 'settlement', name: 'Final Settlement', order: 3, mandatory: true, featureKey: 'fnfSettlement', dueDaysAfterLastWorkingDate: 7 },
    { key: 'letters', name: 'Exit Letters', order: 4, mandatory: true, featureKey: 'experienceLetter', dueDaysBeforeLastWorkingDate: 0 },
]);

export const DEFAULT_OFFBOARDING_TASKS = Object.freeze([
    {
        title: 'Submit resignation and handover information',
        description: 'Confirm the final working date, current responsibilities and handover contacts.',
        category: 'HR',
        assigneeRole: 'employee',
        priority: 'High',
        mandatory: true,
        stageKey: 'initiation',
        featureKey: 'resignation',
        order: 1,
        dueDaysBeforeLastWorkingDate: 10,
    },
    {
        title: 'Complete knowledge transfer',
        description: 'Transfer active work, credentials owned by the employee and operational knowledge.',
        category: 'Knowledge Transfer',
        assigneeRole: 'employee',
        priority: 'High',
        mandatory: true,
        stageKey: 'handover',
        featureKey: 'knowledgeTransfer',
        order: 2,
        dueDaysBeforeLastWorkingDate: 3,
    },
    {
        title: 'Approve role and project handover',
        description: 'Review the employee handover and confirm ownership of active responsibilities.',
        category: 'Knowledge Transfer',
        assigneeRole: 'manager',
        priority: 'High',
        mandatory: true,
        stageKey: 'handover',
        featureKey: 'projectHandover',
        order: 3,
        dueDaysBeforeLastWorkingDate: 2,
    },
    {
        title: 'Collect company assets',
        description: 'Record the return condition of all assets assigned during onboarding.',
        category: 'Equipment',
        assigneeRole: 'it',
        priority: 'Critical',
        mandatory: true,
        stageKey: 'clearance',
        featureKey: 'assetReturn',
        order: 4,
        dueDaysBeforeLastWorkingDate: 0,
    },
    {
        title: 'Revoke system and physical access',
        description: 'Revoke application, email, VPN, ID card and building access.',
        category: 'Access',
        assigneeRole: 'it',
        priority: 'Critical',
        mandatory: true,
        stageKey: 'clearance',
        featureKey: 'accessRevocation',
        order: 5,
        dueDaysBeforeLastWorkingDate: 0,
    },
    {
        title: 'Issue experience letter',
        description: 'Upload the employee experience letter to the existing document library.',
        category: 'Documentation',
        assigneeRole: 'hr',
        priority: 'High',
        mandatory: true,
        stageKey: 'letters',
        featureKey: 'experienceLetter',
        order: 6,
        dueDaysBeforeLastWorkingDate: 0,
    },
    {
        title: 'Complete final settlement clearance',
        description: 'Record final settlement clearance without changing payroll calculations.',
        category: 'Finance',
        assigneeRole: 'payroll',
        priority: 'High',
        mandatory: true,
        stageKey: 'settlement',
        featureKey: 'fnfSettlement',
        order: 7,
        dueDaysAfterLastWorkingDate: 7,
    },
]);

export const DEFAULT_OFFBOARDING_CHECKLIST = Object.freeze([
    { item: 'Resignation or separation approval recorded', category: 'HR', assignedRole: 'hr', mandatory: true, featureKey: 'hrClearance', stageKey: 'clearance', order: 1 },
    { item: 'Employee contact and forwarding details confirmed', category: 'Employee', assignedRole: 'employee', mandatory: true, featureKey: 'resignation', stageKey: 'initiation', order: 2 },
    { item: 'Project and responsibility handover approved', category: 'Manager', assignedRole: 'manager', mandatory: true, featureKey: 'managerApproval', stageKey: 'handover', order: 3 },
    { item: 'Company documents and records reviewed', category: 'Documentation', assignedRole: 'hr', mandatory: true, featureKey: 'hrClearance', stageKey: 'clearance', order: 4 },
    { item: 'Asset return clearance completed', category: 'IT', assignedRole: 'it', mandatory: true, featureKey: 'itClearance', stageKey: 'clearance', order: 5 },
    { item: 'Access revocation clearance completed', category: 'IT', assignedRole: 'it', mandatory: true, featureKey: 'itClearance', stageKey: 'clearance', order: 6 },
    { item: 'Final settlement clearance recorded', category: 'Finance', assignedRole: 'payroll', mandatory: true, featureKey: 'financeClearance', stageKey: 'settlement', order: 7 },
]);

export const DEFAULT_ACCESS_REVOCATIONS = Object.freeze([
    { system: 'Company email', accessType: 'Digital account', mandatory: true, featureKey: 'emailAccessRemoval', order: 1 },
    { system: 'HRMS and internal applications', accessType: 'Application access', mandatory: true, featureKey: 'accessRevocation', order: 2 },
    { system: 'VPN and network', accessType: 'Network access', mandatory: true, featureKey: 'accessRevocation', order: 3 },
    { system: 'Building and ID card access', accessType: 'Physical access', mandatory: true, featureKey: 'accessRevocation', order: 4 },
]);

export const DEFAULT_OFFBOARDING_KNOWLEDGE_TRANSFER = Object.freeze([
    {
        topic: 'Role, project and operational handover',
        description: 'Transfer active responsibilities and supporting knowledge before the final working date.',
        mandatory: true,
        featureKey: 'knowledgeTransfer',
        dueDaysBeforeLastWorkingDate: 3,
        order: 1,
    },
]);

export const DEFAULT_OFFBOARDING_CLEARANCE_RULES = Object.freeze([
    { department: 'HR', assignedRole: 'hr', mandatory: true, featureKey: 'hrClearance', slaDays: 2, order: 1 },
    { department: 'IT', assignedRole: 'it', mandatory: true, featureKey: 'itClearance', slaDays: 1, order: 2 },
    { department: 'Finance', assignedRole: 'payroll', mandatory: true, featureKey: 'financeClearance', slaDays: 7, order: 3 },
    { department: 'Admin', assignedRole: 'admin', mandatory: true, featureKey: 'adminClearance', slaDays: 2, order: 4 },
]);

export const DEFAULT_OFFBOARDING_EXIT_TYPES = Object.freeze([
    'Resignation', 'Termination', 'Retirement', 'Contract End', 'Other',
]);
