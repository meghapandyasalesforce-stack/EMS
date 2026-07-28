/**
 * Central Lifecycle Feature Registry
 * Every lifecycle capability MUST be registered here before use.
 * Organizations enable/disable features via LifecycleSettings — never hardcode in workflows.
 */

export const LIFECYCLE_MODULES = Object.freeze({
    ONBOARDING: 'onboarding',
    OFFBOARDING: 'offboarding',
    SHARED: 'shared',
});

export const LIFECYCLE_FEATURE_CATEGORIES = Object.freeze({
    OFFER: 'offer',
    PREBOARDING: 'preboarding',
    DOCUMENTS: 'documents',
    VERIFICATION: 'verification',
    ASSIGNMENT: 'assignment',
    IT: 'it',
    TRAINING: 'training',
    INDUCTION: 'induction',
    PROBATION: 'probation',
    FEEDBACK: 'feedback',
    AUTOMATION: 'automation',
    EXIT: 'exit',
    CLEARANCE: 'clearance',
    SETTLEMENT: 'settlement',
    LETTERS: 'letters',
    ALUMNI: 'alumni',
    INDUSTRY: 'industry',
    COMPLIANCE: 'compliance',
});

/** @type {ReadonlyArray<{ key: string, label: string, module: string, category: string, description?: string, defaultEnabled?: boolean, dependsOn?: string[] }>} */
export const LIFECYCLE_FEATURES = Object.freeze([
    // ── Onboarding: Offer ──
    { key: 'offerLetter', label: 'Offer Letter Generation', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.OFFER, defaultEnabled: true },
    { key: 'offerApproval', label: 'Offer Approval Workflow', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.OFFER, defaultEnabled: true, dependsOn: ['offerLetter'] },
    { key: 'offerAcceptance', label: 'Offer Acceptance / Rejection', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.OFFER, defaultEnabled: true, dependsOn: ['offerLetter'] },
    { key: 'eSignature', label: 'Digital / E-Signature', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.OFFER, defaultEnabled: true },
    { key: 'candidatePortal', label: 'Candidate Portal', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.PREBOARDING, defaultEnabled: false },
    { key: 'preBoarding', label: 'Pre-Boarding Workflow', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.PREBOARDING, defaultEnabled: true },

    // ── Onboarding: Documents & Forms ──
    { key: 'documentCollection', label: 'Document Collection', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true },
    { key: 'documentApproval', label: 'Document Approval Workflow', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true, dependsOn: ['documentCollection'] },
    { key: 'bankDetails', label: 'Bank Details Collection', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true },
    { key: 'emergencyContact', label: 'Emergency Contact Details', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true },
    { key: 'familyNominee', label: 'Family & Nominee Details', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true },
    { key: 'digitalForms', label: 'Digital Employee Forms', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.DOCUMENTS, defaultEnabled: true },

    // ── Onboarding: Verification ──
    { key: 'backgroundVerification', label: 'Background Verification', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.VERIFICATION, defaultEnabled: true },
    { key: 'employmentVerification', label: 'Employment Verification', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.VERIFICATION, defaultEnabled: false, dependsOn: ['backgroundVerification'] },
    { key: 'educationVerification', label: 'Education Verification', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.VERIFICATION, defaultEnabled: false, dependsOn: ['backgroundVerification'] },
    { key: 'referenceVerification', label: 'Reference Verification', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.VERIFICATION, defaultEnabled: false, dependsOn: ['backgroundVerification'] },

    // ── Onboarding: Assignments ──
    { key: 'employeeIdGeneration', label: 'Employee ID Generation', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },
    { key: 'departmentAssignment', label: 'Department Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },
    { key: 'designationAssignment', label: 'Designation Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },
    { key: 'reportingManagerAssignment', label: 'Reporting Manager Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },
    { key: 'shiftAssignment', label: 'Shift Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: false },
    { key: 'workLocationAssignment', label: 'Work Location Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },
    { key: 'attendancePolicyAssignment', label: 'Attendance Policy Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: false },
    { key: 'leavePolicyAssignment', label: 'Leave Policy Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: false },
    { key: 'payrollSetup', label: 'Payroll Setup', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ASSIGNMENT, defaultEnabled: true },

    // ── Onboarding: IT & Assets ──
    { key: 'itAssetProvisioning', label: 'IT Asset Request & Provisioning', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.IT, defaultEnabled: true },
    { key: 'softwareAccessRequest', label: 'Software & Email Access Requests', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.IT, defaultEnabled: true },

    // ── Onboarding: Induction & Training ──
    { key: 'joiningChecklist', label: 'Joining Checklist', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.INDUCTION, defaultEnabled: true },
    { key: 'induction', label: 'Induction / Orientation Checklist', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.INDUCTION, defaultEnabled: true },
    { key: 'buddyProgram', label: 'Buddy / Mentor Assignment', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.INDUCTION, defaultEnabled: true },
    { key: 'trainingLms', label: 'Training / LMS Integration', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.TRAINING, defaultEnabled: false },
    { key: 'mandatoryTraining', label: 'Mandatory Training Tracking', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.TRAINING, defaultEnabled: true },
    { key: 'milestone30_60_90', label: '30-60-90 Day Milestone Tracking', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.PROBATION, defaultEnabled: true },
    { key: 'probation', label: 'Probation Period Tracking', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.PROBATION, defaultEnabled: true },
    { key: 'managerFeedback', label: 'Manager Feedback Forms', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.FEEDBACK, defaultEnabled: true },
    { key: 'employeeFeedback', label: 'Employee Feedback Forms', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.FEEDBACK, defaultEnabled: true },
    { key: 'goalAssignment', label: 'Goal Setting (KRA / KPI)', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.FEEDBACK, defaultEnabled: false },
    { key: 'welcomeEmail', label: 'Welcome Email Automation', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'reminders', label: 'Reminder Engine', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'escalations', label: 'Escalation Rules', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },

    // ── Offboarding: Exit Types ──
    { key: 'resignation', label: 'Employee Resignation Workflow', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'hrInitiatedExit', label: 'HR Initiated Exit', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'termination', label: 'Termination Workflow', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'retirement', label: 'Retirement Workflow', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'contractCompletion', label: 'Contract Completion Workflow', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'noticePeriod', label: 'Notice Period Tracking', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'noticeAlerts', label: 'Notice Alerts & Reminders', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true, dependsOn: ['noticePeriod'] },
    { key: 'lastWorkingDay', label: 'Last Working Day Management', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'leaveAdjustmentNotice', label: 'Leave Adjustment During Notice', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: false, dependsOn: ['noticePeriod'] },

    // ── Offboarding: Exit Process ──
    { key: 'exitInterview', label: 'Exit Interview', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.EXIT, defaultEnabled: true },
    { key: 'knowledgeTransfer', label: 'Knowledge Transfer Checklist', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'projectHandover', label: 'Project & Client Handover', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'clearance', label: 'Multi-Department Clearance', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'hrClearance', label: 'HR Clearance', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['clearance'] },
    { key: 'itClearance', label: 'IT Clearance', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['clearance'] },
    { key: 'financeClearance', label: 'Finance Clearance', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['clearance'] },
    { key: 'adminClearance', label: 'Admin Clearance', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['clearance'] },
    { key: 'managerApproval', label: 'Manager Approval', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'assetReturn', label: 'Asset Return Tracking', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'assetDamageReporting', label: 'Asset Damage Reporting', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['assetReturn'] },
    { key: 'accessRevocation', label: 'System & Access Revocation', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true },
    { key: 'emailAccessRemoval', label: 'Email & Software Access Removal', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.CLEARANCE, defaultEnabled: true, dependsOn: ['accessRevocation'] },

    // ── Offboarding: Settlement & Letters ──
    { key: 'fnfSettlement', label: 'Full & Final Settlement', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.SETTLEMENT, defaultEnabled: true },
    { key: 'leaveEncashment', label: 'Leave Encashment', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.SETTLEMENT, defaultEnabled: false, dependsOn: ['fnfSettlement'] },
    { key: 'bonusRecovery', label: 'Bonus & Recovery Calculation', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.SETTLEMENT, defaultEnabled: false, dependsOn: ['fnfSettlement'] },
    { key: 'experienceLetter', label: 'Experience Letter Generation', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.LETTERS, defaultEnabled: true },
    { key: 'relievingLetter', label: 'Relieving Letter Generation', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.LETTERS, defaultEnabled: true },
    { key: 'serviceCertificate', label: 'Service Certificate Generation', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.LETTERS, defaultEnabled: false },
    { key: 'alumniManagement', label: 'Alumni Management', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ALUMNI, defaultEnabled: true },
    { key: 'rehireEligibility', label: 'Rehire Eligibility', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ALUMNI, defaultEnabled: true },
    { key: 'blacklisting', label: 'Blacklisting (Optional)', module: LIFECYCLE_MODULES.OFFBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.ALUMNI, defaultEnabled: false },

    // ── Phase F: Enterprise completion ──
    { key: 'indiaStatutoryCompliance', label: 'India Statutory Compliance (Form 16, TDS, EPF)', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.COMPLIANCE, defaultEnabled: true },
    { key: 'itTicketingIntegration', label: 'IT Ticketing (ServiceNow/Jira/Freshservice/Zendesk)', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.IT, defaultEnabled: false, dependsOn: ['softwareAccessRequest'] },
    { key: 'lmsDashboard', label: 'LMS Training Dashboard', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.TRAINING, defaultEnabled: true, dependsOn: ['trainingLms'] },
    { key: 'probationCenter', label: 'Probation Center', module: LIFECYCLE_MODULES.ONBOARDING, category: LIFECYCLE_FEATURE_CATEGORIES.PROBATION, defaultEnabled: true, dependsOn: ['probation'] },
    { key: 'enterpriseDashboards', label: 'Enterprise Dashboards', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'globalLifecycleSearch', label: 'Global Lifecycle Search', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'notificationCenter', label: 'Enterprise Notification Center', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'bulkOperations', label: 'Bulk Lifecycle Operations', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
    { key: 'whiteLabelBranding', label: 'White-Label Branding', module: LIFECYCLE_MODULES.SHARED, category: LIFECYCLE_FEATURE_CATEGORIES.AUTOMATION, defaultEnabled: true },
]);

const featureMap = new Map(LIFECYCLE_FEATURES.map((f) => [f.key, f]));

export function getFeatureDefinition(key) {
    return featureMap.get(key) || null;
}

export function getFeaturesByModule(module) {
    return LIFECYCLE_FEATURES.filter((f) => f.module === module || f.module === LIFECYCLE_MODULES.SHARED);
}

export function getDefaultEnabledFeatureKeys() {
    return LIFECYCLE_FEATURES.filter((f) => f.defaultEnabled !== false).map((f) => f.key);
}

export function validateFeatureKey(key) {
    return featureMap.has(key);
}

export function resolveFeatureDependencies(enabledKeys) {
    const enabled = new Set(enabledKeys);
    let changed = true;
    while (changed) {
        changed = false;
        for (const feature of LIFECYCLE_FEATURES) {
            if (!enabled.has(feature.key)) continue;
            for (const dep of feature.dependsOn || []) {
                if (!enabled.has(dep)) {
                    enabled.delete(feature.key);
                    changed = true;
                }
            }
        }
    }
    return [...enabled];
}

export const LIFECYCLE_APPROVAL_ENTITY_TYPES = Object.freeze([
    'Offer',
    'Onboarding',
    'Offboarding',
    'Clearance',
    'ExitInterview',
    'FnF',
    'AssetReturn',
]);
