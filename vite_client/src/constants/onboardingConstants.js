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

export const ORG_ONBOARDING_STEPS = [
    { id: 'welcome', title: 'Welcome', description: 'Get started with your HRMS setup' },
    { id: 'email', title: 'Email Verification', description: 'Verify your organization email' },
    { id: 'company-info', title: 'Company Information', description: 'Legal and business details' },
    { id: 'logo', title: 'Company Logo', description: 'Upload your organization logo' },
    { id: 'branding', title: 'Branding', description: 'Theme colors and email branding' },
    { id: 'office-locations', title: 'Office Locations', description: 'Head office and branch offices' },
    { id: 'working-hours', title: 'Working Hours', description: 'Working days, hours and breaks' },
    { id: 'timezone-currency', title: 'Timezone & Currency', description: 'Regional and financial settings' },
    { id: 'departments', title: 'Departments & Roles', description: 'Organizational structure' },
    { id: 'holidays', title: 'Holiday Calendar', description: 'Configure holidays and weekly offs' },
    { id: 'leave-policy', title: 'Leave Policies', description: 'Set up leave entitlements' },
    { id: 'attendance-policy', title: 'Attendance Rules', description: 'Configure attendance policies' },
    { id: 'subscription-plan', title: 'Subscription Plan', description: 'Choose your SaaS plan' },
    { id: 'company-policies', title: 'Company Policies', description: 'Upload policy documents' },
    { id: 'smtp-email', title: 'Email / SMTP', description: 'Configure outbound email' },
    { id: 'notification-preferences', title: 'Notifications', description: 'Email and alert preferences' },
    { id: 'integrations', title: 'Integrations', description: 'Google, Microsoft, Slack' },
    { id: 'invite-users', title: 'Invite Users', description: 'Invite HR, managers and admins' },
    { id: 'import-employees', title: 'Import Employees', description: 'Bulk import or skip for later' },
    { id: 'review', title: 'Review', description: 'Review your configuration' },
    { id: 'complete', title: 'Complete', description: 'Organization is ready!' },
];

export const INDUSTRIES = ['IT', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Real Estate', 'Hospitality', 'Construction', 'Transportation', 'Other'];
export const COMPANY_SIZES = [
    { value: 'startup', label: 'Startup (1-10)' },
    { value: 'small', label: 'Small (11-50)' },
    { value: 'medium', label: 'Medium (51-200)' },
    { value: 'large', label: 'Large (201-1000)' },
    { value: 'enterprise', label: 'Enterprise (1000+)' },
];

export const TIMELINE_PHASES = ['Day 0', 'Day 1', 'Week 1', 'Week 2', 'Week 3', 'Month 1'];

export const ONBOARDING_TIMELINE_ROADMAP = [
    { phase: 'Day 0', title: 'Offer Accepted', description: 'Offer letter signed and joining confirmed' },
    { phase: 'Day 1', title: 'Joining Day', description: 'Welcome, ID setup, laptop, email access' },
    { phase: 'Week 1', title: 'Documentation', description: 'Identity docs, bank details, HR forms' },
    { phase: 'Week 2', title: 'Training', description: 'Compliance, policies, role training' },
    { phase: 'Week 3', title: 'Evaluation', description: 'Manager check-in, buddy feedback' },
    // { phase: 'Month 1', title: 'Review', description: '30-day onboarding review meeting' },
];

export const WORKFLOW_STATUSES = [
    'Draft', 'Scheduled', 'Not Started', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue',
];

export const TASK_GROUPS_BY_ROLE = [
    { key: 'employee', label: 'Employee Tasks' },
    { key: 'hr', label: 'HR Tasks' },
    { key: 'it', label: 'IT Tasks' },
    { key: 'manager', label: 'Manager Tasks' },
    { key: 'buddy', label: 'Buddy Tasks' },
    { key: 'payroll', label: 'Payroll Tasks' },
];

export const ASSET_STATUSES = ['Pending', 'Assigned', 'Returned', 'Lost', 'Damaged'];

export const TASK_STATUS_COLORS = {
    Completed: 'bg-emerald-100 text-emerald-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Pending: 'bg-gray-100 text-gray-700',
    Waiting: 'bg-yellow-100 text-yellow-800',
    Blocked: 'bg-red-100 text-red-800',
    Cancelled: 'bg-gray-100 text-gray-500',
    Overdue: 'bg-red-100 text-red-800',
    Draft: 'bg-slate-100 text-slate-700',
    Scheduled: 'bg-indigo-100 text-indigo-800',
    Paused: 'bg-amber-100 text-amber-800',
};

export const DOC_STATUS_COLORS = {
    Verified: 'bg-emerald-100 text-emerald-800',
    Uploaded: 'bg-blue-100 text-blue-800',
    Pending: 'bg-gray-100 text-gray-700',
    Rejected: 'bg-red-100 text-red-800',
};

const DOC_LABELS = Object.fromEntries(ONBOARDING_DOCUMENT_TYPES.map((d) => [d.key, d.label]));

const TASK_TITLE_COMPLETION_FALLBACK = {
    'Upload identity documents': { requiredDocuments: ['AADHAAR', 'PAN', 'PHOTO'] },
    'Upload bank details': { requiredDocuments: ['BANK_DETAILS'] },
    'Verify employee documents': { requiresAllMandatoryDocsVerified: true },
};

function resolveTaskCompletionRules(task) {
    const fallback = TASK_TITLE_COMPLETION_FALLBACK[task.title] || {};
    return {
        requiredDocuments: task.requiredDocuments?.length
            ? task.requiredDocuments
            : (fallback.requiredDocuments || []),
        requiresAllMandatoryDocsVerified: task.requiresAllMandatoryDocsVerified
            || fallback.requiresAllMandatoryDocsVerified
            || false,
    };
}

function getWorkflowDocument(workflow, documentType) {
    return (workflow.documents || []).find((d) => d.documentType === documentType);
}

function isDocUploaded(doc) {
    return Boolean(doc?.url) && ['Uploaded', 'Verified'].includes(doc?.status);
}

/** Returns blockers that must be cleared before a task can be marked complete */
export function getTaskCompletionBlockers(workflow, task) {
    const blockers = [];
    if (!workflow || !task || task.status === 'Completed') return blockers;

    if (task.status === 'Pending') {
        blockers.push('Start the task before marking it complete');
        return blockers;
    }

    const rules = resolveTaskCompletionRules(task);

    for (const docType of rules.requiredDocuments) {
        const doc = getWorkflowDocument(workflow, docType);
        if (!isDocUploaded(doc)) {
            blockers.push(`Upload ${DOC_LABELS[docType] || docType}`);
        }
    }

    if (rules.requiresAllMandatoryDocsVerified) {
        const mandatoryDocs = (workflow.documents || []).filter((d) => d.mandatory !== false);
        for (const doc of mandatoryDocs) {
            if (doc.status === 'Verified') continue;
            const label = DOC_LABELS[doc.documentType] || doc.name || doc.documentType;
            if (!doc.url || doc.status === 'Pending') {
                blockers.push(`Waiting for employee to upload ${label}`);
            } else if (doc.status === 'Uploaded') {
                blockers.push(`Verify ${label}`);
            } else if (doc.status === 'Rejected') {
                blockers.push(`${label} was rejected — ask employee to re-upload`);
            } else {
                blockers.push(`Verify ${label}`);
            }
        }
    }

    return blockers;
}

export function canCompleteTask(workflow, task) {
    return getTaskCompletionBlockers(workflow, task).length === 0;
}
