import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { OnboardingWorkflow, OnboardingTemplate } from '../models/onboarding.model.js';
import {
    DEFAULT_ONBOARDING_CHECKLIST,
    DEFAULT_ONBOARDING_TASKS,
    ONBOARDING_DOCUMENT_TYPES,
    DEFAULT_ASSET_TYPES,
    DEFAULT_TRAINING_MODULES,
    DEFAULT_POLICY_SIGNATURES,
} from '../constants/onboardingDefaults.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';
import { runInBackground } from '../helpers/backgroundTasks.js';

const TASK_WEIGHT = 0.35;
const DOCUMENT_WEIGHT = 0.30;
const CHECKLIST_WEIGHT = 0.20;
const TRAINING_WEIGHT = 0.15;

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function isSameOrBeforeToday(date) {
    if (!date) return false;
    return startOfDay(date) <= startOfDay(new Date());
}

export function resolveInitialWorkflowStatus({ joiningDate, scheduledStartDate, explicitStatus }) {
    if (explicitStatus && ['Draft', 'Scheduled', 'Not Started', 'In Progress'].includes(explicitStatus)) {
        return explicitStatus;
    }
    const effectiveStart = scheduledStartDate || joiningDate;
    if (!effectiveStart) return 'Draft';
    if (isSameOrBeforeToday(effectiveStart)) return 'In Progress';
    return 'Scheduled';
}

export async function getOrgOnboardingSettings(organizationId) {
    const org = await Organization.findById(organizationId).select('onboardingSettings').lean();
    return {
        autoCreateOnEmployeeRegister: org?.onboardingSettings?.autoCreateOnEmployeeRegister ?? false,
        startWorkflowOnJoiningDate: org?.onboardingSettings?.startWorkflowOnJoiningDate ?? true,
        defaultTemplateId: org?.onboardingSettings?.defaultTemplateId || null,
    };
}

function calcRoleTaskProgress(tasks, role) {
    const roleTasks = (tasks || []).filter((t) => (t.assigneeRole || 'employee') === role);
    if (!roleTasks.length) return 100;
    const done = roleTasks.filter((t) => t.status === 'Completed').length;
    return Math.round((done / roleTasks.length) * 100);
}

export function calculateProgressBreakdown(workflow) {
    const tasks = workflow.tasks || [];
    const documents = workflow.documents || [];
    const checklist = workflow.checklist || [];
    const training = workflow.trainingModules || [];

    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const tasksProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100;

    const mandatoryDocs = documents.filter((d) => d.mandatory !== false);
    const mandatoryUploaded = mandatoryDocs.filter((d) => ['Uploaded', 'Verified'].includes(d.status)).length;
    const docDenominator = mandatoryDocs.length > 0 ? mandatoryDocs.length : documents.length;
    const documentsProgress = docDenominator > 0
        ? Math.round((mandatoryUploaded / docDenominator) * 100)
        : 100;

    const mandatoryChecklist = checklist.filter((c) => c.mandatory !== false);
    const completedChecklist = mandatoryChecklist.filter((c) => c.completed).length;
    const checklistDenominator = mandatoryChecklist.length > 0 ? mandatoryChecklist.length : checklist.length;
    const checklistProgress = checklistDenominator > 0
        ? Math.round((completedChecklist / checklistDenominator) * 100)
        : 100;

    const mandatoryTraining = training.filter((t) => t.mandatory !== false);
    const trainingDenominator = mandatoryTraining.length > 0 ? mandatoryTraining.length : training.length;
    const completedTraining = (mandatoryTraining.length ? mandatoryTraining : training)
        .filter((t) => t.status === 'Completed').length;
    const trainingProgress = trainingDenominator > 0
        ? Math.round((completedTraining / trainingDenominator) * 100)
        : 100;

    const overall = Math.round(
        tasksProgress * TASK_WEIGHT +
        documentsProgress * DOCUMENT_WEIGHT +
        checklistProgress * CHECKLIST_WEIGHT +
        trainingProgress * TRAINING_WEIGHT
    );

    const byRole = {
        employee: calcRoleTaskProgress(tasks, 'employee'),
        hr: calcRoleTaskProgress(tasks, 'hr'),
        it: calcRoleTaskProgress(tasks, 'it'),
        manager: calcRoleTaskProgress(tasks, 'manager'),
        buddy: calcRoleTaskProgress(tasks, 'buddy'),
        payroll: calcRoleTaskProgress(tasks, 'payroll'),
    };

    return {
        tasks: tasksProgress,
        documents: documentsProgress,
        checklist: checklistProgress,
        training: trainingProgress,
        byRole,
        overall: Math.min(100, overall),
    };
}

export function applyProgressToWorkflow(workflow) {
    const breakdown = calculateProgressBreakdown(workflow);
    workflow.progressBreakdown = {
        tasks: breakdown.tasks,
        documents: breakdown.documents,
        checklist: breakdown.checklist,
        training: breakdown.training,
        byRole: breakdown.byRole,
    };
    workflow.progress = breakdown.overall;

    const terminal = ['Completed', 'Cancelled', 'Draft', 'Scheduled', 'Paused'];
    if (terminal.includes(workflow.status)) {
        if (workflow.status === 'Completed' && workflow.progress < 100) {
            workflow.status = 'In Progress';
            workflow.actualCompletionDate = undefined;
        }
        return workflow;
    }

    if (workflow.expectedCompletionDate && new Date(workflow.expectedCompletionDate) < new Date()
        && !['Completed', 'Cancelled', 'Paused', 'Draft', 'Scheduled'].includes(workflow.status)) {
        workflow.status = 'Overdue';
    } else if (workflow.status === 'Overdue' && workflow.expectedCompletionDate
        && new Date(workflow.expectedCompletionDate) >= new Date()) {
        workflow.status = 'In Progress';
    }

    if (workflow.progress === 100 && workflow.status === 'In Progress') {
        workflow.status = 'Completed';
        workflow.actualCompletionDate = new Date();
    } else if (workflow.progress > 0 && workflow.progress < 100 && workflow.status === 'Not Started') {
        workflow.status = 'In Progress';
    }

    return workflow;
}

export function addActivity(workflow, { action, description, actor, actorName, metadata = {} }) {
    if (!workflow.activityFeed) workflow.activityFeed = [];
    workflow.activityFeed.unshift({
        action,
        description,
        actor: actor?._id || actor,
        actorName: actorName || actor?.name || 'System',
        metadata,
        createdAt: new Date(),
    });
    if (workflow.activityFeed.length > 100) {
        workflow.activityFeed = workflow.activityFeed.slice(0, 100);
    }
}

async function resolveAssigneeByRole({ assigneeRole, employee, organizationId }) {
    switch (assigneeRole) {
        case 'employee':
            return employee._id;
        case 'manager':
            return employee.managerId || null;
        case 'hr': {
            const hr = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [
                    { department: /human resource/i },
                    { jobTitle: /hr/i },
                    { functionalRoles: 'hr' },
                ],
            }).select('_id').lean();
            return hr?._id || null;
        }
        case 'it': {
            const it = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [{ department: /it/i }, { jobTitle: /it/i }],
            }).select('_id').lean();
            return it?._id || null;
        }
        case 'payroll': {
            const payroll = await Employee.findOne({
                organizationId,
                status: 'active',
                $or: [{ department: /finance/i }, { jobTitle: /payroll/i }],
            }).select('_id').lean();
            return payroll?._id || null;
        }
        default:
            return null;
    }
}

async function getDefaultTemplate(organizationId) {
    let template = await OnboardingTemplate.findOne({ organizationId, isDefault: true }).lean();
    if (!template) {
        template = {
            name: 'Default Onboarding',
            welcomeMessage: 'Welcome to the team! We are excited to have you join us. Please complete your onboarding tasks below.',
            expectedDays: 30,
            tasks: DEFAULT_ONBOARDING_TASKS,
            checklist: DEFAULT_ONBOARDING_CHECKLIST,
            documents: ONBOARDING_DOCUMENT_TYPES.map((d) => ({
                documentType: d.key,
                mandatory: d.required,
            })),
        };
    }
    return template;
}

export async function createEmployeeOnboardingWorkflow({
    employee,
    organizationId,
    assignedHR = null,
    assignedBuddy = null,
    assignedManager = null,
    templateId = null,
    initiatedBy = null,
    joiningDate = null,
    scheduledStartDate = null,
    status = null,
    welcomeMessage = null,
    asDraft = false,
}) {
    const existing = await OnboardingWorkflow.findOne({
        organizationId,
        employeeId: employee._id,
        isTemplate: { $ne: true },
    });
    if (existing && !asDraft) return existing;

    let template;
    if (templateId) {
        template = await OnboardingTemplate.findOne({ _id: templateId, organizationId }).lean();
    }
    if (!template) {
        template = await getDefaultTemplate(organizationId);
    }

    const effectiveJoining = joiningDate
        ? new Date(joiningDate)
        : (employee.dateOfJoining ? new Date(employee.dateOfJoining) : null);
    const effectiveScheduled = scheduledStartDate
        ? new Date(scheduledStartDate)
        : effectiveJoining;

    const orgSettings = await getOrgOnboardingSettings(organizationId);
    let workflowStatus = asDraft
        ? 'Draft'
        : resolveInitialWorkflowStatus({
            joiningDate: effectiveJoining,
            scheduledStartDate: orgSettings.startWorkflowOnJoiningDate ? effectiveScheduled : null,
            explicitStatus: status,
        });

    const now = new Date();
    const startDate = (workflowStatus === 'In Progress') ? (effectiveScheduled && isSameOrBeforeToday(effectiveScheduled) ? effectiveScheduled : now) : null;

    const expectedDays = template.expectedDays || 30;
    const expectedCompletionDate = new Date(effectiveScheduled || effectiveJoining || now);
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + expectedDays);

    const hrAssignee = assignedHR || await resolveAssigneeByRole({
        assigneeRole: 'hr',
        employee,
        organizationId,
    });

    const managerAssignee = assignedManager || employee.managerId || null;

    const roleCache = { hr: hrAssignee, employee: employee._id, manager: managerAssignee, buddy: assignedBuddy };
    const resolveCached = async (role) => {
        if (roleCache[role] !== undefined) return roleCache[role];
        roleCache[role] = await resolveAssigneeByRole({ assigneeRole: role, employee, organizationId });
        return roleCache[role];
    };

    const tasks = [];
    for (const taskDef of template.tasks || DEFAULT_ONBOARDING_TASKS) {
        const taskStart = startDate || effectiveScheduled || now;
        const dueDate = new Date(taskStart);
        dueDate.setDate(dueDate.getDate() + (taskDef.dueDaysFromStart || 7));

        let assignedTo = null;
        const role = taskDef.assigneeRole || 'employee';
        if (role === 'employee') assignedTo = employee._id;
        else if (role === 'manager') assignedTo = managerAssignee;
        else if (role === 'buddy') assignedTo = assignedBuddy;
        else if (role === 'hr') assignedTo = hrAssignee;
        else assignedTo = await resolveCached(role);

        if (assignedTo) {
            tasks.push({
                title: taskDef.title,
                description: taskDef.description,
                category: taskDef.category || 'Other',
                assigneeRole: taskDef.assigneeRole || 'employee',
                assignedTo,
                dueDate,
                priority: taskDef.priority || 'Medium',
                phase: taskDef.phase || 'Day 1',
                status: 'Pending',
                requiredDocuments: taskDef.requiredDocuments || [],
                requiresAllMandatoryDocsVerified: Boolean(taskDef.requiresAllMandatoryDocsVerified),
            });
        }
    }

    const documents = (template.documents || ONBOARDING_DOCUMENT_TYPES.map((d) => ({
        documentType: d.key,
        mandatory: d.required,
    }))).map((doc) => ({
        documentType: doc.documentType,
        name: doc.name || doc.documentType,
        mandatory: doc.mandatory !== false,
        status: 'Pending',
    }));

    const checklist = (template.checklist || DEFAULT_ONBOARDING_CHECKLIST).map((item) => ({
        item: item.item,
        category: item.category,
        phase: item.phase || 'Day 1',
        mandatory: item.mandatory !== false,
        completed: false,
    }));

    const assets = DEFAULT_ASSET_TYPES.map((a) => ({
        assetType: a.assetType,
        name: a.name,
        mandatory: a.mandatory !== false,
        status: 'Pending',
    }));

    const trainingModules = DEFAULT_TRAINING_MODULES.map((t) => ({
        title: t.title,
        description: t.description,
        type: t.type,
        mandatory: t.mandatory !== false,
        passingScore: t.passingScore || 70,
        phase: t.phase || 'Week 1',
        status: 'Not Started',
    }));

    const policySignatures = DEFAULT_POLICY_SIGNATURES.map((p) => ({
        documentType: p.documentType,
        title: p.title,
        mandatory: p.mandatory !== false,
        status: 'Pending',
    }));

    const buddyCheckins = [
        { type: 'welcome_meeting', title: 'Buddy Welcome Meeting', status: 'Pending' },
        { type: 'first_week', title: 'First Week Check-in', status: 'Pending' },
        { type: 'day_30', title: '30-Day Check-in', status: 'Pending' },
    ];

    const managerActions = [
        { actionType: 'probation_goals', title: 'Approve Probation Goals', status: 'Pending' },
        { actionType: 'first_project', title: 'Assign First Project', status: 'Pending' },
        { actionType: 'one_on_one', title: 'Schedule 1:1 Meeting', status: 'Pending' },
        { actionType: 'review', title: 'Review Employee Progress', status: 'Pending' },
    ];

    const workflow = new OnboardingWorkflow({
        organizationId,
        employeeId: employee._id,
        templateId: template._id || templateId,
        startDate,
        joiningDate: effectiveJoining,
        scheduledStartDate: orgSettings.startWorkflowOnJoiningDate ? effectiveScheduled : null,
        expectedCompletionDate,
        status: workflowStatus,
        welcomeMessage: welcomeMessage || template.welcomeMessage ||
            `Welcome ${employee.name}! We're thrilled to have you on the team.`,
        assignedHR: hrAssignee,
        assignedBuddy: assignedBuddy || null,
        assignedManager: managerAssignee,
        tasks,
        documents,
        checklist,
        assets,
        trainingModules,
        policySignatures,
        buddyCheckins,
        managerActions,
        activityFeed: [{
            action: workflowStatus === 'Draft' ? 'workflow_drafted' : workflowStatus === 'Scheduled' ? 'workflow_scheduled' : 'workflow_created',
            description: workflowStatus === 'Scheduled'
                ? `Onboarding scheduled for ${employee.name} on ${effectiveScheduled ? effectiveScheduled.toDateString() : 'joining date'}`
                : `Onboarding workflow created for ${employee.name} ${employee.lastName || ''}`,
            actor: initiatedBy,
            actorName: initiatedBy ? 'HR' : 'System',
            createdAt: new Date(),
        }],
    });

    applyProgressToWorkflow(workflow);
    await workflow.save();

    if (workflowStatus !== 'Draft') {
        runInBackground('onboarding-workflow-notify', async () => {
            await notify({
                type: 'onboarding_workflow_created',
                organizationId,
                data: { employee, workflow, hrAssignee },
            });
        });
    }

    return workflow;
}

/** Activate workflows whose scheduled start date has arrived */
export async function activateScheduledWorkflows(organizationId = null) {
    const now = new Date();
    const query = {
        status: 'Scheduled',
        isTemplate: { $ne: true },
        scheduledStartDate: { $lte: now },
    };
    if (organizationId) query.organizationId = organizationId;

    const workflows = await OnboardingWorkflow.find(query);
    let activated = 0;

    for (const workflow of workflows) {
        workflow.status = 'In Progress';
        workflow.startDate = workflow.scheduledStartDate || workflow.joiningDate || now;
        addActivity(workflow, {
            action: 'workflow_started',
            description: `Onboarding started automatically on joining date`,
            actorName: 'System',
        });
        applyProgressToWorkflow(workflow);
        await workflow.save();
        activated += 1;

        runInBackground('onboarding-workflow-started', async () => {
            const employee = await Employee.findById(workflow.employeeId).lean();
            await notify({
                type: 'onboarding_workflow_created',
                organizationId: workflow.organizationId,
                data: { employee, workflow, autoStarted: true },
            });
        });
    }

    return activated;
}

export async function buildEnhancedDashboardStats(organizationId) {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const base = { organizationId, isTemplate: { $ne: true } };
    const workflows = await OnboardingWorkflow.find(base).lean();

    const countPendingDocs = (w) => (w.documents || []).filter((d) =>
        d.mandatory !== false && !['Verified'].includes(d.status)).length;

    const pendingHrTasks = (w) => (w.tasks || []).filter((t) =>
        t.assigneeRole === 'hr' && t.status !== 'Completed').length;

    const pendingItTasks = (w) => (w.tasks || []).filter((t) =>
        (t.assigneeRole === 'it' || t.category === 'IT Setup' || t.category === 'Equipment') && t.status !== 'Completed').length;

    const pendingManagerTasks = (w) => (w.tasks || []).filter((t) =>
        t.assigneeRole === 'manager' && t.status !== 'Completed').length;

    const isDelayed = (w) => w.status === 'Overdue'
        || (w.expectedCompletionDate && new Date(w.expectedCompletionDate) < new Date()
            && !['Completed', 'Cancelled', 'Draft', 'Scheduled', 'Paused'].includes(w.status));

    return {
        active: workflows.filter((w) => w.status === 'In Progress').length,
        completed: workflows.filter((w) => w.status === 'Completed').length,
        delayed: workflows.filter(isDelayed).length,
        notStarted: workflows.filter((w) => ['Not Started', 'Draft'].includes(w.status)).length,
        scheduled: workflows.filter((w) => w.status === 'Scheduled').length,
        paused: workflows.filter((w) => ['Paused', 'On Hold'].includes(w.status)).length,
        todaysJoinings: workflows.filter((w) => {
            if (!w.joiningDate) return false;
            const jd = startOfDay(new Date(w.joiningDate));
            return jd.getTime() === today.getTime();
        }).length,
        upcomingJoinings: workflows.filter((w) => {
            if (!w.joiningDate) return false;
            const jd = startOfDay(new Date(w.joiningDate));
            return jd > today && jd <= new Date(today.getTime() + 30 * 86400000);
        }).length,
        pendingDocuments: workflows.reduce((sum, w) => sum + countPendingDocs(w), 0),
        pendingHrTasks: workflows.reduce((sum, w) => sum + pendingHrTasks(w), 0),
        pendingItSetup: workflows.reduce((sum, w) => sum + pendingItTasks(w), 0),
        pendingManagerReviews: workflows.reduce((sum, w) => sum + pendingManagerTasks(w), 0),
        delayedEmployees: workflows.filter(isDelayed).length,
        completedThisMonth: workflows.filter((w) =>
            w.status === 'Completed' && w.actualCompletionDate
            && new Date(w.actualCompletionDate) >= monthStart
            && new Date(w.actualCompletionDate) <= monthEnd).length,
    };
}

/** Fallback rules for workflows created before requiredDocuments was stored on tasks */
const TASK_TITLE_COMPLETION_FALLBACK = {
    'Upload identity documents': { requiredDocuments: ['AADHAAR', 'PAN', 'PHOTO'] },
    'Upload bank details': { requiredDocuments: ['BANK_DETAILS'] },
    'Verify employee documents': { requiresAllMandatoryDocsVerified: true },
};

const DOC_LABELS = Object.fromEntries(
    ONBOARDING_DOCUMENT_TYPES.map((d) => [d.key, d.label])
);

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

function isDocVerified(doc) {
    return doc?.status === 'Verified';
}

/**
 * Returns human-readable blockers preventing task completion.
 * Empty array means the task can be marked complete.
 */
export function getTaskCompletionBlockers(workflow, task) {
    const blockers = [];

    if (task.status === 'Completed') return blockers;

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
        const unverified = mandatoryDocs.filter((d) => !isDocVerified(d));
        for (const doc of unverified) {
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

export function filterTasksForUser(workflow, userId, { isHR, isAdmin, isManager, isBuddy, employeeId }) {
    if (isHR || isAdmin) return workflow.tasks || [];

    return (workflow.tasks || []).filter((task) => {
        const assignedId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        if (assignedId === userId?.toString()) return true;
        if (isManager && task.assigneeRole === 'manager' && workflow.assignedManager?.toString() === userId?.toString()) return true;
        if (isBuddy && task.assigneeRole === 'buddy' && workflow.assignedBuddy?.toString() === userId?.toString()) return true;
        if (employeeId && task.assigneeRole === 'employee' && workflow.employeeId?.toString() === employeeId?.toString()) return true;
        return false;
    });
}

export async function resolveEmployeeIdFromRequest(req) {
    const organizationId = req.user?.organizationId || req.employee?.organizationId;
    if (req.employee?._id) return req.employee._id;
    if (req.user?.employeeId) return req.user.employeeId;
    if (req.user?._id && organizationId) {
        const emp = await Employee.findOne({
            userId: req.user._id,
            organizationId,
            status: 'active',
        }).select('_id').lean();
        if (emp?._id) return emp._id;
    }
    return null;
}

export async function getOnboardingRoleContext(req) {
    const employeeId = await resolveEmployeeIdFromRequest(req);
    const userId = req.employee?._id || employeeId || req.user?._id;
    const organizationId = req.user?.organizationId || req.employee?.organizationId;

    const isAdmin = req.user?.role === 'admin' || req.authContext?.isOrgOwner;
    const isHR = req.authContext?.isHrManager || req.authContext?.isHrExecutive ||
        (req.employee?.department || '').toLowerCase().includes('human resource');

    let isManager = false;
    let isBuddy = false;

    if (employeeId) {
        const buddyWorkflows = await OnboardingWorkflow.countDocuments({
            organizationId,
            assignedBuddy: employeeId,
            isTemplate: { $ne: true },
        });
        isBuddy = buddyWorkflows > 0;

        const managerWorkflows = await OnboardingWorkflow.countDocuments({
            organizationId,
            assignedManager: employeeId,
            isTemplate: { $ne: true },
        });
        isManager = managerWorkflows > 0 || req.authContext?.isLineManager;
    }

    return { employeeId, userId, organizationId, isAdmin, isHR, isManager, isBuddy };
}
