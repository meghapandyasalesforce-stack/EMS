import { OnboardingWorkflow, OnboardingTemplate, OffboardingWorkflow } from '../../models/onboarding.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import {
    createEmployeeOnboardingWorkflow,
    applyProgressToWorkflow,
    addActivity,
    calculateProgressBreakdown,
    filterTasksForUser,
    getOnboardingRoleContext,
    resolveEmployeeIdFromRequest,
    getTaskCompletionBlockers,
    canCompleteTask,
    synchronizeOnboardingWorkflows,
    buildEnhancedDashboardStats,
    buildRoleDashboardStats,
    synchronizeWorkflowDocuments,
} from '../../services/onboardingService.js';
import {
    addOffboardingActivity,
    buildOffboardingDashboardStats,
    createEmployeeOffboardingWorkflow,
    saveOffboardingWorkflow,
} from '../../services/offboardingService.js';
import {
    enrichOnboardingVisibility,
    enrichOffboardingVisibility,
    buildOnboardingViewQuery,
    buildOffboardingViewQuery,
    sanitizeTasksForLifecycleView,
    normalizeLifecycleView,
} from '../../services/lifecycleVisibilityService.js';
import { notify } from '../../helpers/notificationManager.js';
import { emitOffboardingChangedAsync, emitOnboardingChangedAsync } from '../../helpers/backgroundTasks.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    assertFeatureEnabled,
    assertAnyFeatureEnabled,
    LifecycleFeatureDisabledError,
} from '../../services/lifecycleConfigService.js';

const requireFeature = (req, key, label) => assertFeatureEnabled(getOrganizationId(req), key, label);
const requireAnyFeature = (req, keys, label) => assertAnyFeatureEnabled(getOrganizationId(req), keys, label);

const notifyOnboarding = (params) => {
    notify(params).catch((error) => {
        logger.error('Onboarding notification failed', {
            type: params?.type,
            organizationId: params?.organizationId,
            error: error?.message,
            stack: error?.stack,
        });
    });
};

const populateWorkflow = (query) => query
    .populate('employeeId', 'name lastName email employeeId department jobTitle dateOfJoining managerId')
    .populate('assignedHR', 'name email jobTitle')
    .populate('assignedBuddy', 'name email jobTitle')
    .populate('assignedManager', 'name email jobTitle')
    .populate('tasks.assignedTo', 'name email')
    .populate('tasks.comments.author', 'name')
    .populate('documents.uploadedBy', 'name')
    .populate('documents.verifiedBy', 'name')
    .populate('documents.versionHistory.uploadedBy', 'name')
    .populate('documents.versionHistory.verifiedBy', 'name')
    .populate('checklist.completedBy', 'name')
    .populate('activityFeed.actor', 'name')
    .populate('notes.addedBy', 'name');

const lightPopulate = (query) => query
    .populate('employeeId', 'name lastName email employeeId department jobTitle')
    .populate('assignedHR', 'name email jobTitle')
    .populate('assignedBuddy', 'name email jobTitle')
    .populate('assignedManager', 'name email jobTitle');

const getNotificationEmployee = (workflow) =>
    Employee.findById(workflow?.employeeId).select('_id name lastName').lean();

/** Strip internal notes (and optionally tasks) for non-HR viewers. */
const sanitizeWorkflowForViewer = (workflow, roleCtx, view = 'self') => {
    if (!workflow) return workflow;
    if (roleCtx?.isHR || roleCtx?.isAdmin) return workflow;

    const data = typeof workflow.toObject === 'function'
        ? workflow.toObject({ virtuals: true })
        : { ...workflow };

    data.notes = (data.notes || []).filter((note) => {
        if (!note.visibility || note.visibility === 'all' || note.visibility === 'employee') return true;
        if (note.visibility === 'manager' && roleCtx?.isManager) return true;
        return false;
    });

    const normalized = normalizeLifecycleView(view, roleCtx);
    if (normalized === 'buddy' || normalized === 'self' || (!roleCtx?.isManager && !roleCtx?.canViewTasks)) {
        data.tasks = sanitizeTasksForLifecycleView(data, roleCtx, normalized);
    } else if (!roleCtx?.isManager && !roleCtx?.isBuddy && roleCtx?.employeeId) {
        data.tasks = filterTasksForUser(data, roleCtx.userId || roleCtx.employeeId, roleCtx);
    }

    return data;
};

const saveWorkflowAndBroadcast = async (workflow, organizationId, { recalculate = true } = {}) => {
    const wasCompleted = workflow.status === 'Completed';
    if (recalculate) {
        await synchronizeWorkflowDocuments(workflow);
        applyProgressToWorkflow(workflow);
    }

    if (!wasCompleted && workflow.status === 'Completed') {
        workflow.completionNotifiedAt = new Date();
        addActivity(workflow, {
            action: 'workflow_completed',
            description: 'All mandatory onboarding requirements completed',
            actorName: 'System',
            metadata: { progress: workflow.progress },
        });
    }

    await workflow.save();
    emitOnboardingChangedAsync(organizationId, workflow._id);

    if (!wasCompleted && workflow.status === 'Completed') {
        notifyOnboarding({
            type: 'onboarding_workflow_completed',
            organizationId,
            data: { workflow },
        });
    }
};

// ─── Workflows ───────────────────────────────────────────────────────────────

export const createOnboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        employeeId,
        assignedHR,
        assignedBuddy,
        assignedManager,
        templateId,
        welcomeMessage,
        expectedCompletionDate,
        joiningDate,
        scheduledStartDate,
        saveAsDraft,
    } = req.body;

    if (!employeeId) {
        return res.status(400).json({ success: false, message: 'Employee is required' });
    }

    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const existing = await OnboardingWorkflow.findOne({
        organizationId,
        employeeId: employee._id,
        isTemplate: { $ne: true },
    });

    if (existing) {
        if (welcomeMessage) existing.welcomeMessage = welcomeMessage;
        if (assignedHR) existing.assignedHR = assignedHR;
        if (assignedBuddy) existing.assignedBuddy = assignedBuddy;
        if (assignedManager) existing.assignedManager = assignedManager;
        if (joiningDate) existing.joiningDate = new Date(joiningDate);
        if (scheduledStartDate) existing.scheduledStartDate = new Date(scheduledStartDate);
        if (expectedCompletionDate) existing.expectedCompletionDate = new Date(expectedCompletionDate);
        if (templateId) existing.templateId = templateId;

        // Re-creating without "save as draft" should publish a stuck Draft so the employee can see it.
        if (existing.status === 'Draft' && !saveAsDraft) {
            const effectiveStart = existing.scheduledStartDate || existing.joiningDate;
            const now = new Date();
            existing.status = effectiveStart && new Date(effectiveStart) > now ? 'Scheduled' : 'Not Started';
            if (existing.status === 'Not Started' && !existing.startDate) {
                existing.startDate = effectiveStart || now;
            }
        }

        addActivity(existing, {
            action: 'workflow_updated',
            description: 'Onboarding workflow settings updated by HR',
            actor: req.employee?._id || req.user?._id,
            actorName: req.employee?.name || req.user?.name || 'HR',
        });
        await saveWorkflowAndBroadcast(existing, organizationId);
        const populated = await lightPopulate(OnboardingWorkflow.findById(existing._id));
        return res.status(200).json({
            success: true,
            message: 'Onboarding workflow updated successfully',
            data: populated,
            updated: true,
        });
    }

    const workflow = await createEmployeeOnboardingWorkflow({
        employee,
        organizationId,
        assignedHR,
        assignedBuddy,
        assignedManager,
        templateId,
        initiatedBy: req.employee?._id || req.user?._id,
        joiningDate: joiningDate || employee.dateOfJoining,
        scheduledStartDate: scheduledStartDate || joiningDate || employee.dateOfJoining,
        welcomeMessage,
        asDraft: Boolean(saveAsDraft),
    });

    if (expectedCompletionDate) workflow.expectedCompletionDate = new Date(expectedCompletionDate);
    if (assignedManager) workflow.assignedManager = assignedManager;
    await saveWorkflowAndBroadcast(workflow, organizationId);

    const populated = await lightPopulate(OnboardingWorkflow.findById(workflow._id));
    res.status(201).json({
        success: true,
        message: saveAsDraft ? 'Onboarding draft saved' : workflow.status === 'Scheduled'
            ? 'Onboarding scheduled for joining date'
            : 'Onboarding workflow created successfully',
        data: populated,
    });
});

export const getOnboardingWorkflows = asyncHandler(async (req, res) => {
    await synchronizeOnboardingWorkflows(getOrganizationId(req));
    const { employeeId, status, page = 1, limit = 20, view = 'all' } = req.query;
    const query = addOrganizationFilter(req, { isTemplate: { $ne: true } });
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const roleCtx = await getOnboardingRoleContext(req);
    if (view === 'team' && roleCtx.hasTeamOnboarding && !roleCtx.isHR && !roleCtx.isAdmin) {
        query.assignedManager = roleCtx.employeeId || roleCtx.userId;
    } else if (view === 'buddy' && roleCtx.hasBuddyAssignments && !roleCtx.isHR && !roleCtx.isAdmin) {
        query.assignedBuddy = roleCtx.employeeId || roleCtx.userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [workflows, total] = await Promise.all([
        populateWorkflow(OnboardingWorkflow.find(query))
            .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        OnboardingWorkflow.countDocuments(query),
    ]);

    res.json({
        success: true,
        data: workflows,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
});

export const getOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    await synchronizeOnboardingWorkflows(organizationId);
    const workflow = await populateWorkflow(OnboardingWorkflow.findOne({ _id: id, organizationId }));
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    res.json({ success: true, data: workflow });
});

export const deleteOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOneAndDelete({
        _id: id,
        organizationId,
        isTemplate: { $ne: true },
    });

    if (!workflow) {
        return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    emitOnboardingChangedAsync(organizationId, workflow._id);
    res.json({ success: true, message: 'Onboarding workflow deleted successfully' });
});

export const getMyOnboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    await synchronizeOnboardingWorkflows(organizationId);

    const employeeId = await resolveEmployeeIdFromRequest(req);

    if (!employeeId) {
        return res.status(401).json({
            success: false,
            message: 'Employee profile not found. Please contact HR.',
        });
    }

    const roleCtx = await getOnboardingRoleContext(req);
    const workflow = await populateWorkflow(OnboardingWorkflow.findOne({
        employeeId, organizationId, isTemplate: { $ne: true },
    }).sort({ createdAt: -1 }));

    if (!workflow) return res.status(404).json({ success: false, message: 'No onboarding workflow found' });
    res.json({ success: true, data: sanitizeWorkflowForViewer(workflow, roleCtx) });
});

export const getOnboardingDashboard = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    await synchronizeOnboardingWorkflows(organizationId);

    const baseRole = await getOnboardingRoleContext(req);
    const roleCtx = await enrichOnboardingVisibility(baseRole);
    const { view: rawView } = req.query;
    const { query: workflowQuery, view, postFilter } = await buildOnboardingViewQuery(
        organizationId,
        roleCtx,
        rawView,
    );

    const [rawWorkflows, templates, organizationStats] = await Promise.all([
        populateWorkflow(OnboardingWorkflow.find(workflowQuery).sort({ updatedAt: -1 }).limit(80)),
        OnboardingTemplate.find({ organizationId }).lean(),
        roleCtx.isHR || roleCtx.isAdmin
            ? buildEnhancedDashboardStats(organizationId)
            : Promise.resolve(null),
    ]);

    let workflows = rawWorkflows || [];
    if (typeof postFilter === 'function') {
        workflows = postFilter(workflows);
    }

    const stats = organizationStats || buildRoleDashboardStats(workflows, roleCtx, view);
    const sanitized = workflows.map((w) => sanitizeWorkflowForViewer(w, roleCtx, view));

    res.json({
        success: true,
        data: {
            workflows: sanitized,
            templates,
            stats,
            view,
            role: {
                employeeId: roleCtx.employeeId,
                isAdmin: roleCtx.isAdmin,
                isHR: roleCtx.isHR,
                isManager: roleCtx.isManager,
                isBuddy: roleCtx.isBuddy,
                isLineManager: roleCtx.isLineManager,
                hasTeamOnboarding: roleCtx.hasTeamOnboarding,
                hasBuddyAssignments: roleCtx.hasBuddyAssignments,
                hasDirectReports: roleCtx.hasDirectReports,
                hasPendingManagerTasks: roleCtx.hasPendingManagerTasks,
                hasSelfWorkflow: roleCtx.hasSelfWorkflow,
                canViewSelf: roleCtx.canViewSelf,
                canViewTasks: roleCtx.canViewTasks,
                canViewTeam: roleCtx.canViewTeam,
                canViewBuddy: roleCtx.canViewBuddy,
            },
        },
    });
});

export const updateOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const existingTaskAssignments = new Set((workflow.tasks || []).map((task) =>
        `${task._id}:${task.assignedTo?.toString() || ''}`));
    if (req.body.status !== undefined) {
        return res.status(400).json({
            success: false,
            message: 'Workflow status is system-managed. Use Publish, Pause, Resume, or Cancel.',
        });
    }

    const allowed = [
        'welcomeMessage', 'expectedCompletionDate', 'joiningDate', 'scheduledStartDate',
        'assignedHR', 'assignedBuddy', 'assignedManager', 'tasks', 'checklist', 'notes',
    ];
    const dateFields = new Set(['expectedCompletionDate', 'joiningDate', 'scheduledStartDate']);
    for (const key of allowed) {
        if (req.body[key] === undefined) continue;
        workflow[key] = dateFields.has(key)
            ? (req.body[key] ? new Date(req.body[key]) : null)
            : req.body[key];
    }

    if (req.body.expectedCompletionDate !== undefined
        || req.body.joiningDate !== undefined
        || req.body.scheduledStartDate !== undefined) {
        addActivity(workflow, {
            action: 'schedule_updated',
            description: 'Onboarding schedule dates updated',
            actor: req.employee?._id || req.user?._id,
            actorName: req.employee?.name || req.user?.name || 'HR',
        });
    }

    if (req.body.tasks) {
        addActivity(workflow, {
            action: 'tasks_updated',
            description: 'Onboarding tasks were updated',
            actor: req.employee?._id || req.user?._id,
            actorName: req.employee?.name || req.user?.name || 'HR',
        });
    }

    await saveWorkflowAndBroadcast(workflow, organizationId);

    if (req.body.tasks) {
        const newlyAssignedTasks = (workflow.tasks || []).filter((task) =>
            task.assignedTo && !existingTaskAssignments.has(`${task._id}:${task.assignedTo.toString()}`));
        void Promise.all(newlyAssignedTasks.map((task) => notifyOnboarding({
            type: 'onboarding_task_assigned',
            organizationId,
            data: { workflow, task },
        })));
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Workflow updated', data: populated });
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const updateOnboardingTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.params;
    const organizationId = getOrganizationId(req);
    const actorEmployeeId = await resolveEmployeeIdFromRequest(req);

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const task = workflow.tasks.id(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const roleCtx = await getOnboardingRoleContext(req);
    const assigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const isAssignee = assigneeId && actorEmployeeId && assigneeId === actorEmployeeId.toString();
    const isWorkflowEmployee = workflow.employeeId?.toString() === actorEmployeeId?.toString()
        && task.assigneeRole === 'employee';

    if (!roleCtx.isHR && !roleCtx.isAdmin && !isAssignee && !isWorkflowEmployee) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    const previousStatus = task.status;
    const newStatus = req.body.status;
    if (newStatus && !['Pending', 'In Progress', 'Completed'].includes(newStatus)) {
        return res.status(400).json({
            success: false,
            message: 'Task status must be Pending, In Progress, or Completed; overdue status is automatic',
        });
    }

    if (newStatus === 'Completed') {
        // Pull the latest canonical Employee Documents before enforcing
        // document blockers, avoiding a race with background upload sync.
        await synchronizeWorkflowDocuments(workflow);
        const blockers = getTaskCompletionBlockers(workflow, task);
        if (blockers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Complete the required steps before marking this task done',
                blockers,
            });
        }
    }

    if (newStatus) task.status = newStatus;

    if (newStatus === 'In Progress') {
        if (!task.startedDate) task.startedDate = new Date();
        task.completedDate = undefined;
    } else if (newStatus === 'Completed') {
        if (!task.startedDate) task.startedDate = new Date();
        if (!task.completedDate) task.completedDate = new Date();
    } else if (newStatus === 'Pending') {
        task.startedDate = undefined;
        task.completedDate = undefined;
    }

    if (req.body.comment) {
        task.comments.push({ text: req.body.comment, author: actorEmployeeId || req.user?._id });
    }
    if (req.body.attachment?.url) {
        task.attachments.push({
            name: req.body.attachment.name || 'Attachment',
            url: req.body.attachment.url,
            uploadedAt: new Date(),
        });
    }

    const activityDesc = newStatus === 'In Progress'
        ? `Task "${task.title}" started`
        : newStatus === 'Completed'
            ? `Task "${task.title}" completed`
            : `Task "${task.title}" updated to ${task.status}`;

    addActivity(workflow, {
        action: newStatus === 'In Progress' ? 'task_started' : 'task_updated',
        description: activityDesc,
        actor: actorEmployeeId || req.user?._id,
        metadata: { taskId: task._id, status: task.status },
    });

    await saveWorkflowAndBroadcast(workflow, organizationId);

    const taskStarted = previousStatus === 'Pending' && task.status === 'In Progress';
    const taskCompleted = previousStatus !== 'Completed' && task.status === 'Completed';
    if (taskStarted || taskCompleted) {
        const employee = await getNotificationEmployee(workflow);
        notifyOnboarding({
            type: taskStarted
                ? 'onboarding_task_started'
                : 'onboarding_task_completed',
            organizationId,
            data: { workflow, task, employee },
        });
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: activityDesc, data: populated });
});

// ─── Checklist ───────────────────────────────────────────────────────────────

export const updateOnboardingChecklistItem = asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;
    const { completed } = req.body;
    const organizationId = getOrganizationId(req);
    const actorId = await resolveEmployeeIdFromRequest(req);

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const item = workflow.checklist.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Checklist item not found' });

    const roleCtx = await getOnboardingRoleContext(req);
    const assignedRole = item.assignedRole || 'employee';
    const roleTaskAssigned = (workflow.tasks || []).some((task) => {
        const assignedId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        return task.assigneeRole === assignedRole && assignedId === actorId?.toString();
    });
    const canUpdate = roleCtx.isHR || roleCtx.isAdmin
        || (assignedRole === 'employee' && workflow.employeeId?.toString() === actorId?.toString())
        || (assignedRole === 'manager' && workflow.assignedManager?.toString() === actorId?.toString())
        || (assignedRole === 'buddy' && workflow.assignedBuddy?.toString() === actorId?.toString())
        || roleTaskAssigned;
    if (!canUpdate) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this checklist item' });
    }

    const wasCompleted = item.completed;
    item.completed = completed !== false;
    item.completedBy = completed !== false ? actorId : undefined;
    item.completedAt = completed !== false ? new Date() : undefined;

    addActivity(workflow, {
        action: 'checklist_updated',
        description: `"${item.item}" marked as ${item.completed ? 'complete' : 'incomplete'}`,
        actor: actorId,
    });

    await saveWorkflowAndBroadcast(workflow, organizationId);

    if (!wasCompleted && item.completed) {
        const employee = await getNotificationEmployee(workflow);
        notifyOnboarding({
            type: 'onboarding_checklist_completed',
            organizationId,
            data: { workflow, item, employee },
        });
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Checklist updated', data: populated });
});

// ─── Workflow status, assets, training, signatures ───────────────────────────

export const updateWorkflowStatus = asyncHandler(async (req, res) => {
    res.status(400).json({
        success: false,
        message: 'Workflow status is system-managed. Use Publish, Pause, Resume, or Cancel.',
    });
});

export const performWorkflowAction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const action = String(req.params.action || '').toLowerCase();
    const organizationId = getOrganizationId(req);
    if (!['publish', 'pause', 'resume', 'cancel'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid workflow action' });
    }

    const roleCtx = await getOnboardingRoleContext(req);
    if (!roleCtx.isHR && !roleCtx.isAdmin) {
        return res.status(403).json({ success: false, message: 'Only HR or Admin can manage workflow lifecycle actions' });
    }

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    await synchronizeWorkflowDocuments(workflow);
    const previousStatus = workflow.status;
    const now = new Date();

    if (action === 'publish') {
        if (workflow.status !== 'Draft') {
            return res.status(409).json({ success: false, message: 'Only draft workflows can be published' });
        }
        const effectiveStart = workflow.scheduledStartDate || workflow.joiningDate;
        workflow.status = effectiveStart && new Date(effectiveStart) > now ? 'Scheduled' : 'Not Started';
        if (workflow.status === 'Not Started' && !workflow.startDate) {
            workflow.startDate = effectiveStart || now;
        }
    } else if (action === 'pause') {
        if (!['Scheduled', 'Not Started', 'In Progress', 'Overdue'].includes(workflow.status)) {
            return res.status(409).json({ success: false, message: `A ${workflow.status} workflow cannot be paused` });
        }
        workflow.pausedFromStatus = workflow.status;
        workflow.status = 'Paused';
    } else if (action === 'resume') {
        if (workflow.status !== 'Paused') {
            return res.status(409).json({ success: false, message: 'Only paused workflows can be resumed' });
        }
        const effectiveStart = workflow.scheduledStartDate || workflow.joiningDate;
        workflow.status = effectiveStart && new Date(effectiveStart) > now ? 'Scheduled' : 'Not Started';
        workflow.pausedFromStatus = undefined;
    } else if (action === 'cancel') {
        if (['Completed', 'Cancelled'].includes(workflow.status)) {
            return res.status(409).json({ success: false, message: `A ${workflow.status} workflow cannot be cancelled` });
        }
        workflow.pausedFromStatus = undefined;
        workflow.status = 'Cancelled';
    }

    const actionPastTense = {
        publish: 'published',
        pause: 'paused',
        resume: 'resumed',
        cancel: 'cancelled',
    }[action];
    addActivity(workflow, {
        action: `workflow_${actionPastTense}`,
        description: `Workflow ${actionPastTense} by HR`,
        actor: req.employee?._id || req.user?._id,
        actorName: req.employee?.name || req.user?.name || 'HR',
        metadata: { previousStatus },
    });
    await saveWorkflowAndBroadcast(workflow, organizationId);

    if (action === 'publish') {
        const employee = await getNotificationEmployee(workflow);
        void Promise.all([
            notifyOnboarding({
                type: 'onboarding_workflow_assigned',
                organizationId,
                data: { employee, workflow },
            }),
            ...(workflow.tasks || []).filter((task) => task.assignedTo).map((task) => notifyOnboarding({
                type: 'onboarding_task_assigned',
                organizationId,
                data: { employee, workflow, task },
            })),
        ]);
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: `Workflow ${actionPastTense}`, data: populated });
});

export const updateOnboardingAsset = asyncHandler(async (req, res) => {
    await requireFeature(req, 'itAssetProvisioning', 'IT asset provisioning');
    const { id, assetId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const asset = workflow.assets.id(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const previousStatus = asset.status;
    const { status, serialNumber, notes } = req.body;
    if (status) asset.status = status;
    if (serialNumber !== undefined) asset.serialNumber = serialNumber;
    if (notes !== undefined) asset.notes = notes;
    if (status === 'Assigned') {
        asset.assignedAt = new Date();
        asset.assignedBy = req.employee?._id || req.user?._id;
    }
    if (status === 'Returned') asset.returnedAt = new Date();

    addActivity(workflow, {
        action: 'asset_updated',
        description: `${asset.name} marked as ${asset.status}`,
        actor: req.employee?._id || req.user?._id,
    });
    await saveWorkflowAndBroadcast(workflow, organizationId);

    if (status === 'Assigned' && previousStatus !== 'Assigned') {
        notifyOnboarding({
            type: 'onboarding_asset_assigned',
            organizationId,
            data: { workflow, asset },
        });
    } else if (status === 'Returned' && previousStatus !== 'Returned') {
        const employee = await getNotificationEmployee(workflow);
        notifyOnboarding({
            type: 'onboarding_asset_returned',
            organizationId,
            data: { workflow, asset, employee },
        });
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Asset updated', data: populated });
});

export const updateOnboardingTraining = asyncHandler(async (req, res) => {
    await requireAnyFeature(req, ['mandatoryTraining', 'trainingLms'], 'Training');
    const { id, trainingId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const module = workflow.trainingModules.id(trainingId);
    if (!module) return res.status(404).json({ success: false, message: 'Training module not found' });
    const previousStatus = module.status;

    const roleCtx = await getOnboardingRoleContext(req);
    const actorEmployeeId = await resolveEmployeeIdFromRequest(req);
    const isWorkflowEmployee = workflow.employeeId?.toString() === actorEmployeeId?.toString();
    if (!roleCtx.isHR && !roleCtx.isAdmin && !isWorkflowEmployee) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this training' });
    }

    const { status, score, answers } = req.body;
    if (['video', 'document'].includes(module.type)
        && status === 'Completed' && !(module.videoUrl || module.documentUrl)) {
        return res.status(400).json({
            success: false,
            message: 'Training content must be configured before completion',
        });
    }
    if (module.type === 'quiz' && status === 'Completed' && answers === undefined && score === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Quiz completion requires submitted answers or a verified score',
        });
    }
    if (status) module.status = status;

    if (answers && module.quizQuestions?.length) {
        let correct = 0;
        module.quizQuestions.forEach((q, i) => {
            if (answers[i] === q.correctIndex) correct += 1;
        });
        module.score = Math.round((correct / module.quizQuestions.length) * 100);
        module.status = module.score >= (module.passingScore || 70) ? 'Completed' : 'Failed';
    } else if (score !== undefined) {
        module.score = score;
        module.status = score >= (module.passingScore || 70) ? 'Completed' : 'Failed';
    }

    if (module.status === 'Completed') {
        module.completedAt = new Date();
    }

    addActivity(workflow, {
        action: module.status === 'Completed' ? 'training_completed' : 'training_updated',
        description: `Training "${module.title}" updated to ${module.status}`,
        actor: req.employee?._id || req.user?._id,
        metadata: { trainingId: module._id, status: module.status, score: module.score },
    });

    await saveWorkflowAndBroadcast(workflow, organizationId);

    if (module.status === 'Completed' && previousStatus !== 'Completed') {
        const employee = await getNotificationEmployee(workflow);
        notifyOnboarding({
            type: 'onboarding_training_completed',
            organizationId,
            data: { workflow, module, employee },
        });
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Training updated', data: populated });
});

export const signOnboardingPolicy = asyncHandler(async (req, res) => {
    await requireFeature(req, 'eSignature', 'E-signature');
    const { id, signatureId } = req.params;
    const organizationId = getOrganizationId(req);
    const signerId = await resolveEmployeeIdFromRequest(req);

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const isWorkflowEmployee = workflow.employeeId?.toString() === signerId?.toString();
    if (!isWorkflowEmployee) {
        return res.status(403).json({ success: false, message: 'Only the onboarding employee can sign policies' });
    }

    const sig = workflow.policySignatures.id(signatureId);
    if (!sig) return res.status(404).json({ success: false, message: 'Policy not found' });
    const wasSigned = sig.status === 'Signed';
    if (!sig.documentUrl) {
        return res.status(400).json({
            success: false,
            message: 'Policy document must be configured before it can be signed',
        });
    }

    sig.status = 'Signed';
    sig.signedAt = new Date();
    sig.signedBy = signerId;
    sig.signatureData = req.body.signatureData || req.body.acknowledgment || 'Digitally acknowledged';
    sig.ipAddress = req.ip;

    addActivity(workflow, {
        action: 'policy_signed',
        description: `${sig.title} signed digitally`,
        actor: signerId,
    });

    await saveWorkflowAndBroadcast(workflow, organizationId);
    if (!wasSigned) {
        const employee = await getNotificationEmployee(workflow);
        notifyOnboarding({
            type: 'onboarding_policy_signed',
            organizationId,
            data: { workflow, signature: sig, employee },
        });
    }
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Policy signed', data: populated });
});

export const updateBuddyCheckin = asyncHandler(async (req, res) => {
    await requireFeature(req, 'buddyProgram', 'Buddy program');
    const { id, checkinId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const checkin = workflow.buddyCheckins.id(checkinId);
    if (!checkin) return res.status(404).json({ success: false, message: 'Check-in not found' });

    const roleCtx = await getOnboardingRoleContext(req);
    const actorEmployeeId = await resolveEmployeeIdFromRequest(req);
    const isAssignedBuddy = workflow.assignedBuddy?.toString() === actorEmployeeId?.toString();
    if (!roleCtx.isHR && !roleCtx.isAdmin && !isAssignedBuddy) {
        return res.status(403).json({ success: false, message: 'Only the assigned buddy or HR can update this check-in' });
    }

    const { status, scheduledDate, feedback, rating } = req.body;
    if (status) checkin.status = status;
    if (scheduledDate) checkin.scheduledDate = new Date(scheduledDate);
    if (feedback !== undefined) checkin.feedback = feedback;
    if (rating !== undefined) checkin.rating = rating;
    if (status === 'Completed') checkin.completedDate = new Date();

    addActivity(workflow, {
        action: status === 'Completed' ? 'buddy_checkin_completed' : 'buddy_checkin_updated',
        description: `Buddy check-in "${checkin.title}" updated to ${checkin.status}`,
        actor: req.employee?._id || req.user?._id,
        metadata: { checkinId: checkin._id, status: checkin.status },
    });
    await saveWorkflowAndBroadcast(workflow, organizationId);
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Buddy check-in updated', data: populated });
});

export const updateManagerAction = asyncHandler(async (req, res) => {
    await requireAnyFeature(req, ['managerFeedback', 'probation'], 'Manager feedback / probation');
    const { id, actionId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const action = workflow.managerActions.id(actionId);
    if (!action) return res.status(404).json({ success: false, message: 'Manager action not found' });

    const roleCtx = await getOnboardingRoleContext(req);
    const actorEmployeeId = await resolveEmployeeIdFromRequest(req);
    const isAssignedManager = workflow.assignedManager?.toString() === actorEmployeeId?.toString();
    if (!roleCtx.isHR && !roleCtx.isAdmin && !isAssignedManager) {
        return res.status(403).json({ success: false, message: 'Only the assigned manager or HR can update this action' });
    }

    const { status, notes, dueDate } = req.body;
    if (status) action.status = status;
    if (notes !== undefined) action.notes = notes;
    if (dueDate) action.dueDate = new Date(dueDate);
    if (status === 'Completed') action.completedAt = new Date();

    addActivity(workflow, {
        action: status === 'Completed' ? 'manager_action_completed' : 'manager_action_updated',
        description: `Manager action "${action.title}" updated to ${action.status}`,
        actor: req.employee?._id || req.user?._id,
        metadata: { actionId: action._id, status: action.status },
    });
    await saveWorkflowAndBroadcast(workflow, organizationId);
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Manager action updated', data: populated });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

export const addOnboardingNote = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note, visibility = 'internal' } = req.body;
    const organizationId = getOrganizationId(req);

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    workflow.notes.push({
        note,
        visibility,
        addedBy: req.employee?._id || req.user?._id,
        addedAt: new Date(),
    });

    addActivity(workflow, {
        action: 'note_added',
        description: 'A note was added to the onboarding workflow',
        actor: req.employee?._id || req.user?._id,
    });

    await saveWorkflowAndBroadcast(workflow, organizationId, { recalculate: false });
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Note added', data: populated });
});

// ─── Templates ───────────────────────────────────────────────────────────────

export const getOnboardingTemplates = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const templates = await OnboardingTemplate.find({ organizationId }).sort({ isDefault: -1, name: 1 });
    res.json({ success: true, data: templates });
});

export const createOnboardingTemplate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const template = new OnboardingTemplate({ ...req.body, organizationId });
    if (template.isDefault) {
        await OnboardingTemplate.updateMany({ organizationId }, { isDefault: false });
    }
    await template.save();
    res.status(201).json({ success: true, data: template });
});

export const updateOnboardingTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const template = await OnboardingTemplate.findOne({ _id: id, organizationId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    Object.assign(template, req.body);
    if (template.isDefault) {
        await OnboardingTemplate.updateMany({ organizationId, _id: { $ne: id } }, { isDefault: false });
    }
    await template.save();
    res.json({ success: true, data: template });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getOnboardingAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.startDate = {};
        if (startDate) dateFilter.startDate.$gte = new Date(startDate);
        if (endDate) dateFilter.startDate.$lte = new Date(endDate);
    }

    const baseMatch = { organizationId, isTemplate: { $ne: true }, ...dateFilter };

    const [totalWorkflows, completedWorkflows, inProgressWorkflows, delayedWorkflows, avgCompletionTime,
        workflowsByStatus, tasksByCategory, pendingDocuments, tasksByRole, rejectedDocs, deptStats,
        delayedTasks, workloadByAssignee, monthlyTrend] = await Promise.all([
        OnboardingWorkflow.countDocuments(baseMatch),
        OnboardingWorkflow.countDocuments({ ...baseMatch, status: 'Completed' }),
        OnboardingWorkflow.countDocuments({ ...baseMatch, status: 'In Progress' }),
        OnboardingWorkflow.countDocuments({
            ...baseMatch,
            status: { $in: ['In Progress', 'Not Started', 'Overdue'] },
            expectedCompletionDate: { $lt: new Date() },
        }),
        OnboardingWorkflow.aggregate([
            { $match: { ...baseMatch, status: 'Completed', actualCompletionDate: { $exists: true } } },
            { $project: { daysToComplete: { $divide: [{ $subtract: ['$actualCompletionDate', '$startDate'] }, 86400000] } } },
            { $group: { _id: null, avgDays: { $avg: '$daysToComplete' } } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$tasks' },
            { $group: { _id: '$tasks.category', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$tasks.status', 'Completed'] }, 1, 0] } } } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$documents' },
            { $match: { 'documents.status': { $in: ['Pending', 'Uploaded'] } } },
            { $count: 'total' },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$tasks' },
            { $match: { 'tasks.status': { $ne: 'Completed' } } },
            { $group: { _id: '$tasks.assigneeRole', count: { $sum: 1 } } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$documents' },
            { $match: { 'documents.status': 'Rejected' } },
            { $group: { _id: '$documents.documentType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
            { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: '$emp.department',
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
                avgDays: { $avg: {
                    $cond: [
                        { $and: [{ $eq: ['$status', 'Completed'] }, '$actualCompletionDate', '$startDate'] },
                        { $divide: [{ $subtract: ['$actualCompletionDate', '$startDate'] }, 86400000] },
                        null,
                    ],
                } },
            } },
            { $addFields: {
                completionRate: {
                    $cond: [{ $gt: ['$count', 0] }, { $multiply: [{ $divide: ['$completed', '$count'] }, 100] }, 0],
                },
            } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$tasks' },
            { $match: {
                'tasks.status': { $nin: ['Completed', 'Cancelled'] },
                'tasks.dueDate': { $lt: new Date() },
            } },
            { $project: {
                workflowId: '$_id',
                employeeId: 1,
                title: '$tasks.title',
                assigneeRole: '$tasks.assigneeRole',
                dueDate: '$tasks.dueDate',
                daysDelayed: { $divide: [{ $subtract: [new Date(), '$tasks.dueDate'] }, 86400000] },
            } },
            { $sort: { daysDelayed: -1 } },
            { $limit: 10 },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: baseMatch },
            { $unwind: '$tasks' },
            { $match: { 'tasks.status': { $nin: ['Completed', 'Cancelled'] } } },
            { $group: {
                _id: { assignedTo: '$tasks.assignedTo', role: '$tasks.assigneeRole' },
                pendingTasks: { $sum: 1 },
                overdueTasks: { $sum: { $cond: [{ $eq: ['$tasks.status', 'Overdue'] }, 1, 0] } },
            } },
            { $lookup: { from: 'employees', localField: '_id.assignedTo', foreignField: '_id', as: 'assignee' } },
            { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
            { $project: {
                assignedTo: '$_id.assignedTo',
                role: '$_id.role',
                name: '$assignee.name',
                pendingTasks: 1,
                overdueTasks: 1,
            } },
            { $sort: { pendingTasks: -1 } },
        ]),
        OnboardingWorkflow.aggregate([
            { $match: { ...baseMatch, startDate: { $exists: true } } },
            { $group: {
                _id: { year: { $year: '$startDate' }, month: { $month: '$startDate' } },
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
            } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
    ]);

    const completionRate = totalWorkflows > 0 ? parseFloat(((completedWorkflows / totalWorkflows) * 100).toFixed(2)) : 0;

    res.json({
        success: true,
        data: {
            totalWorkflows,
            completedWorkflows,
            inProgressWorkflows,
            delayedWorkflows,
            completionRate,
            avgCompletionTime: avgCompletionTime[0] || { avgDays: 0 },
            workflowsByStatus,
            tasksByCategory,
            pendingDocuments: pendingDocuments[0]?.total || 0,
            pendingTasksByRole: tasksByRole,
            mostRejectedDocuments: rejectedDocs,
            departmentWiseCompletion: deptStats,
            mostDelayedTasks: delayedTasks,
            workloadByAssignee,
            monthlyTrend,
            scheduledWorkflows: workflowsByStatus.find((s) => s._id === 'Scheduled')?.count || 0,
        },
    });
});

// ─── Offboarding ─────────────────────────────────────────────────────────────

const populateOffboardingWorkflow = (query) => query
    .populate('employeeId', 'name lastName email employeeId department jobTitle dateOfJoining managerId')
    .populate('assignedHR', 'name email jobTitle')
    .populate('assignedManager', 'name email jobTitle')
    .populate('tasks.assignedTo', 'name email jobTitle')
    .populate('clearanceChecklist.completedBy', 'name email')
    .populate('assets.clearedBy', 'name email')
    .populate('knowledgeTransfer.transferredBy', 'name email')
    .populate('knowledgeTransfer.transferredTo', 'name email')
    .populate('exitInterview.conductedBy', 'name email')
    .populate('experienceLetter.uploadedBy', 'name email')
    .populate('finalSettlement.clearedBy', 'name email')
    .populate('accessRevocation.revokedBy', 'name email')
    .populate('activityFeed.actor', 'name')
    .populate('notes.addedBy', 'name');

const getOffboardingRoleContext = async (req) => {
    const base = await getOnboardingRoleContext(req);
    if (!base.employeeId || base.isAdmin || base.isHR) return base;
    const employeeProfile = await Employee.findById(base.employeeId)
        .select('functionalRoles department jobTitle position')
        .lean();
    const roleText = [
        ...(employeeProfile?.functionalRoles || []),
        employeeProfile?.department,
        employeeProfile?.jobTitle,
        employeeProfile?.position,
    ].filter(Boolean).join(' ').toLowerCase();
    const isManager = base.isManager || Boolean(await OffboardingWorkflow.exists({
        organizationId: base.organizationId,
        assignedManager: base.employeeId,
    }));
    const isAssignee = Boolean(await OffboardingWorkflow.exists({
        organizationId: base.organizationId,
        'tasks.assignedTo': base.employeeId,
        status: { $nin: ['Completed', 'Cancelled'] },
    }));
    return {
        ...base,
        isManager,
        isAssignee,
        isIT: /\bit\b|information technology|system admin/.test(roleText),
        isPayroll: /payroll|finance|accounts/.test(roleText),
    };
};

const sanitizeOffboardingWorkflow = (workflow, roleCtx) => {
    if (!workflow || roleCtx.isAdmin || roleCtx.isHR) return workflow;
    const data = typeof workflow.toObject === 'function' ? workflow.toObject() : { ...workflow };
    data.notes = (data.notes || []).filter((note) =>
        ['all', 'employee'].includes(note.visibility)
        || (note.visibility === 'manager' && roleCtx.isManager));
    return data;
};

const offboardingActorId = (req, roleCtx) =>
    req.employee?._id || roleCtx?.employeeId || req.user?._id;

const canAccessOffboardingWorkflow = (workflow, roleCtx) => {
    if (roleCtx.isAdmin || roleCtx.isHR) return true;
    const employeeId = workflow.employeeId?._id || workflow.employeeId;
    const managerId = workflow.assignedManager?._id || workflow.assignedManager;
    const hasAssignedTask = (workflow.tasks || []).some((task) =>
        (task.assignedTo?._id || task.assignedTo)?.toString() === roleCtx.employeeId?.toString());
    const isDirectReport = (roleCtx.directReportIds || []).some(
        (id) => String(id) === String(employeeId),
    );
    return employeeId?.toString() === roleCtx.employeeId?.toString()
        || (roleCtx.isManager && managerId?.toString() === roleCtx.employeeId?.toString())
        || isDirectReport
        || hasAssignedTask;
};

const canUpdateOffboardingRoleItem = (workflow, item, roleCtx) => {
    if (roleCtx.isAdmin || roleCtx.isHR) return true;
    const actorId = roleCtx.employeeId?.toString();
    const assignedTo = item.assignedTo?._id || item.assignedTo;
    if (assignedTo?.toString() === actorId) return true;
    if (item.assigneeRole === 'employee') {
        return (workflow.employeeId?._id || workflow.employeeId)?.toString() === actorId;
    }
    if (item.assigneeRole === 'manager' || item.assignedRole === 'manager') {
        return (workflow.assignedManager?._id || workflow.assignedManager)?.toString() === actorId;
    }
    if ((item.assigneeRole === 'it' || item.assignedRole === 'it') && roleCtx.isIT) return true;
    if ((item.assigneeRole === 'payroll' || item.assignedRole === 'payroll') && roleCtx.isPayroll) return true;
    return false;
};

const getOffboardingWorkflowOr404 = async (id, organizationId) =>
    OffboardingWorkflow.findOne({ _id: id, organizationId });

const sendOffboardingNotification = (type, organizationId, data) => {
    notify({ type, organizationId, data }).catch((error) => {
        logger.error('Offboarding notification failed', { type, organizationId, error: error.message });
    });
};

const offboardingAssigneesBelongToOrganization = async (organizationId, ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
    if (!uniqueIds.length) return true;
    const count = await Employee.countDocuments({ organizationId, _id: { $in: uniqueIds } });
    return count === uniqueIds.length;
};

export const createOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        employeeId, lastWorkingDate, resignationDate, reason, reasonDetails,
        assignedHR, assignedManager, saveAsDraft,
    } = req.body;
    if (!employeeId || !lastWorkingDate) {
        return res.status(400).json({ success: false, message: 'Employee and last working date are required' });
    }
    const lastDay = new Date(lastWorkingDate);
    if (Number.isNaN(lastDay.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid last working date' });
    }
    if (reason && !['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other'].includes(reason)) {
        return res.status(400).json({ success: false, message: 'Invalid offboarding reason' });
    }
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (!await offboardingAssigneesBelongToOrganization(organizationId, [assignedHR, assignedManager])) {
        return res.status(400).json({ success: false, message: 'Assigned HR and manager must belong to this organization' });
    }

    const existing = await OffboardingWorkflow.findOne({
        organizationId,
        employeeId,
        status: { $nin: ['Completed', 'Cancelled'] },
    });
    if (existing) {
        return res.status(409).json({
            success: false,
            message: 'An active offboarding workflow already exists for this employee',
            data: existing,
        });
    }

    const workflow = await createEmployeeOffboardingWorkflow({
        employee,
        organizationId,
        lastWorkingDate,
        resignationDate,
        reason,
        reasonDetails,
        assignedHR,
        assignedManager,
        initiatedBy: req.employee?._id || req.user?._id,
        saveAsDraft: Boolean(saveAsDraft),
    });
    emitOffboardingChangedAsync(organizationId, workflow._id);
    sendOffboardingNotification('offboarding_workflow_initiated', organizationId, { workflow, employee });
    for (const task of workflow.tasks || []) {
        if (task.assignedTo) {
            sendOffboardingNotification('offboarding_task_assigned', organizationId, { workflow, task, employee });
        }
    }
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.status(201).json({
        success: true,
        message: saveAsDraft ? 'Offboarding draft saved' : 'Offboarding workflow initiated',
        data: populated,
    });
});

export const getOffboardingWorkflows = asyncHandler(async (req, res) => {
    const { employeeId, status, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const query = addOrganizationFilter(req, {});
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    const skip = (parsedPage - 1) * parsedLimit;
    const [workflows, total] = await Promise.all([
        populateOffboardingWorkflow(OffboardingWorkflow.find(query))
            .sort({ createdAt: -1 }).skip(skip).limit(parsedLimit),
        OffboardingWorkflow.countDocuments(query),
    ]);
    res.json({
        success: true,
        data: workflows,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit),
        },
    });
});

export const getOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await populateOffboardingWorkflow(getOffboardingWorkflowOr404(req.params.id, organizationId));
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!canAccessOffboardingWorkflow(workflow, roleCtx)) {
        return res.status(403).json({ success: false, message: 'You cannot access this offboarding workflow' });
    }
    res.json({ success: true, data: sanitizeOffboardingWorkflow(workflow, roleCtx) });
});

export const updateOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!await offboardingAssigneesBelongToOrganization(
        organizationId,
        [req.body.assignedHR, req.body.assignedManager],
    )) {
        return res.status(400).json({ success: false, message: 'Assigned HR and manager must belong to this organization' });
    }
    const allowed = [
        'lastWorkingDate', 'resignationDate', 'reason', 'reasonDetails',
        'assignedHR', 'assignedManager', 'expectedCompletionDate',
    ];
    for (const field of allowed) {
        if (req.body[field] !== undefined) workflow[field] = req.body[field];
    }
    addOffboardingActivity(workflow, {
        action: 'workflow_updated',
        description: 'Offboarding workflow settings updated',
        actor: req.employee?._id || req.user?._id,
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: req.employee?._id || req.user?._id });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Offboarding workflow updated', data: populated });
});

export const deleteOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    await workflow.deleteOne();
    emitOffboardingChangedAsync(organizationId, workflow._id);
    res.json({ success: true, message: 'Offboarding workflow deleted' });
});

export const performOffboardingAction = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { action } = req.params;
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });

    const transitions = {
        publish: ['Draft'],
        pause: ['Initiated', 'In Progress', 'Overdue', 'Scheduled'],
        resume: ['Paused', 'On Hold'],
        cancel: ['Draft', 'Scheduled', 'Initiated', 'In Progress', 'Paused', 'On Hold', 'Overdue'],
    };
    if (!transitions[action]?.includes(workflow.status)) {
        return res.status(400).json({ success: false, message: `Cannot ${action} a ${workflow.status} workflow` });
    }
    const previousStatus = workflow.status;
    if (action === 'publish') workflow.status = 'Initiated';
    if (action === 'pause') {
        workflow.pausedFromStatus = previousStatus;
        workflow.status = 'Paused';
    }
    if (action === 'resume') {
        workflow.status = ['Initiated', 'In Progress', 'Overdue', 'Scheduled'].includes(workflow.pausedFromStatus)
            ? workflow.pausedFromStatus : 'In Progress';
        workflow.pausedFromStatus = undefined;
    }
    if (action === 'cancel') workflow.status = 'Cancelled';
    addOffboardingActivity(workflow, {
        action: `workflow_${action}`,
        description: `Offboarding workflow ${({
            publish: 'published',
            pause: 'paused',
            resume: 'resumed',
            cancel: 'cancelled',
        })[action]}`,
        actor: req.employee?._id || req.user?._id,
        metadata: { previousStatus },
    });
    await saveOffboardingWorkflow(workflow, organizationId, {
        recalculate: action !== 'cancel',
        actor: req.employee?._id || req.user?._id,
    });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: `Workflow ${action} successful`, data: populated });
});

export const updateOffboardingTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.params;
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    const task = workflow.tasks.id(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!canUpdateOffboardingRoleItem(workflow, task, roleCtx)) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
    }
    const allowedStatuses = ['Pending', 'In Progress', 'Waiting', 'Blocked', 'Completed'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid task status' });
    }
    const previousStatus = task.status;
    if (req.body.status) task.status = req.body.status;
    if (req.body.completionNotes !== undefined) task.completionNotes = req.body.completionNotes;
    if (roleCtx.isAdmin || roleCtx.isHR) {
        if (req.body.assignedTo !== undefined) {
            if (!await offboardingAssigneesBelongToOrganization(organizationId, [req.body.assignedTo])) {
                return res.status(400).json({ success: false, message: 'Task assignee must belong to this organization' });
            }
            task.assignedTo = req.body.assignedTo || undefined;
        }
        if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
        if (req.body.priority !== undefined) task.priority = req.body.priority;
    }
    if (task.status === 'In Progress' && !task.startedDate) task.startedDate = new Date();
    if (task.status === 'Completed') task.completedDate = task.completedDate || new Date();
    if (task.status !== 'Completed') task.completedDate = undefined;
    addOffboardingActivity(workflow, {
        action: task.status === 'Completed' ? 'task_completed' : 'task_updated',
        description: `${task.title} changed from ${previousStatus} to ${task.status}`,
        actor: offboardingActorId(req, roleCtx),
        metadata: { taskId: task._id, previousStatus, status: task.status },
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: offboardingActorId(req, roleCtx) });
    if (previousStatus !== 'Completed' && task.status === 'Completed') {
        sendOffboardingNotification('offboarding_task_completed', organizationId, { workflow, task });
    }
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Task updated', data: sanitizeOffboardingWorkflow(populated, roleCtx) });
});

export const updateOffboardingChecklistItem = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    const item = workflow.clearanceChecklist.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Checklist item not found' });
    const roleItem = { ...item.toObject(), assigneeRole: item.assignedRole };
    if (!canUpdateOffboardingRoleItem(workflow, roleItem, roleCtx)) {
        return res.status(403).json({ success: false, message: 'You cannot update this clearance item' });
    }
    item.completed = Boolean(req.body.completed);
    item.notes = req.body.notes ?? item.notes;
    item.completedAt = item.completed ? new Date() : undefined;
    item.completedBy = item.completed ? offboardingActorId(req, roleCtx) : undefined;
    addOffboardingActivity(workflow, {
        action: 'clearance_updated',
        description: `${item.item} marked ${item.completed ? 'complete' : 'incomplete'}`,
        actor: offboardingActorId(req, roleCtx),
        metadata: { itemId: item._id, completed: item.completed },
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: offboardingActorId(req, roleCtx) });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Clearance checklist updated', data: sanitizeOffboardingWorkflow(populated, roleCtx) });
});

export const updateOffboardingAsset = asyncHandler(async (req, res) => {
    await requireFeature(req, 'assetReturn', 'Asset return');
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!roleCtx.isAdmin && !roleCtx.isHR && !roleCtx.isIT) {
        return res.status(403).json({ success: false, message: 'Only HR or IT can update asset returns' });
    }
    const asset = workflow.assets.id(req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const allowedStatuses = ['Pending', 'Returned', 'Damaged', 'Lost', 'Waived'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid asset return status' });
    }
    if (req.body.status) asset.status = req.body.status;
    if (req.body.condition !== undefined) asset.condition = req.body.condition;
    if (req.body.notes !== undefined) asset.notes = req.body.notes;
    asset.returned = asset.status === 'Returned';
    asset.returnDate = asset.status !== 'Pending' ? new Date() : undefined;
    asset.clearedBy = asset.status !== 'Pending' ? (req.employee?._id || req.user?._id) : undefined;
    addOffboardingActivity(workflow, {
        action: 'asset_return_updated',
        description: `${asset.assetName || asset.assetType || 'Asset'} marked ${asset.status}`,
        actor: req.employee?._id || req.user?._id,
        metadata: { assetId: asset._id, status: asset.status },
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: req.employee?._id || req.user?._id });
    if (asset.status === 'Returned') {
        sendOffboardingNotification('offboarding_asset_returned', organizationId, { workflow, asset });
    }
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Asset return updated', data: populated });
});

export const updateOffboardingKnowledgeTransfer = asyncHandler(async (req, res) => {
    await requireAnyFeature(req, ['knowledgeTransfer', 'projectHandover'], 'Knowledge transfer');
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    const item = workflow.knowledgeTransfer.id(req.params.transferId);
    if (!item) return res.status(404).json({ success: false, message: 'Knowledge-transfer item not found' });
    const actorId = roleCtx.employeeId?.toString();
    const ownerId = (item.transferredBy?._id || item.transferredBy)?.toString();
    const recipientId = (item.transferredTo?._id || item.transferredTo)?.toString();
    if (!roleCtx.isAdmin && !roleCtx.isHR && actorId !== ownerId && actorId !== recipientId) {
        return res.status(403).json({ success: false, message: 'You cannot update this knowledge transfer' });
    }
    const allowedStatuses = ['Pending', 'In Progress', 'Completed', 'Waived'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid knowledge-transfer status' });
    }
    if (req.body.status) item.status = req.body.status;
    if (req.body.notes !== undefined) item.notes = req.body.notes;
    if ((roleCtx.isAdmin || roleCtx.isHR) && req.body.transferredTo !== undefined) item.transferredTo = req.body.transferredTo;
    item.transferDate = item.status === 'Completed' ? new Date() : undefined;
    addOffboardingActivity(workflow, {
        action: 'knowledge_transfer_updated',
        description: `${item.topic} marked ${item.status}`,
        actor: offboardingActorId(req, roleCtx),
        metadata: { transferId: item._id, status: item.status },
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: offboardingActorId(req, roleCtx) });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Knowledge transfer updated', data: sanitizeOffboardingWorkflow(populated, roleCtx) });
});

export const updateOffboardingExitInterview = asyncHandler(async (req, res) => {
    await requireFeature(req, 'exitInterview', 'Exit interview');
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!canAccessOffboardingWorkflow(workflow, roleCtx)) {
        return res.status(403).json({ success: false, message: 'You cannot update this exit interview' });
    }
    const interview = workflow.exitInterview;
    const isEmployee = (workflow.employeeId?._id || workflow.employeeId)?.toString() === roleCtx.employeeId?.toString();
    if (Array.isArray(req.body.questions) && (isEmployee || roleCtx.isAdmin || roleCtx.isHR)) {
        for (const answer of req.body.questions) {
            const question = interview.questions.id?.(answer._id)
                || interview.questions.find((entry) => entry.question === answer.question);
            if (question) question.answer = String(answer.answer || '').slice(0, 4000);
        }
    }
    if (req.body.feedback !== undefined) interview.feedback = String(req.body.feedback).slice(0, 4000);
    if (req.body.rating !== undefined) interview.rating = req.body.rating;
    if (roleCtx.isAdmin || roleCtx.isHR) {
        if (req.body.status !== undefined
            && !['Not Scheduled', 'Scheduled', 'In Progress', 'Completed', 'Waived', 'Overdue'].includes(req.body.status)) {
            return res.status(400).json({ success: false, message: 'Invalid exit-interview status' });
        }
        if (req.body.scheduledDate !== undefined) interview.scheduledDate = req.body.scheduledDate;
        if (req.body.conductedBy !== undefined) interview.conductedBy = req.body.conductedBy;
        if (req.body.status !== undefined) interview.status = req.body.status;
        if (['Completed', 'Waived'].includes(interview.status)) interview.conductedDate = new Date();
    } else if (req.body.submit === true && interview.status === 'Scheduled') {
        interview.status = 'Completed';
        interview.conductedDate = new Date();
    }
    addOffboardingActivity(workflow, {
        action: 'exit_interview_updated',
        description: `Exit interview updated (${interview.status})`,
        actor: offboardingActorId(req, roleCtx),
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: offboardingActorId(req, roleCtx) });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Exit interview updated', data: sanitizeOffboardingWorkflow(populated, roleCtx) });
});

export const updateOffboardingPayrollClearance = asyncHandler(async (req, res) => {
    await requireFeature(req, 'fnfSettlement', 'F&F settlement');
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!roleCtx.isAdmin && !roleCtx.isHR && !roleCtx.isPayroll) {
        return res.status(403).json({ success: false, message: 'Only HR or payroll can update payroll clearance' });
    }
    const allowedStatuses = ['Pending', 'In Review', 'Cleared', 'Waived'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid payroll-clearance status' });
    }
    if (req.body.status) workflow.finalSettlement.status = req.body.status;
    if (req.body.notes !== undefined) workflow.finalSettlement.notes = req.body.notes;
    if (['Cleared', 'Waived'].includes(workflow.finalSettlement.status)) {
        workflow.finalSettlement.clearedAt = new Date();
        workflow.finalSettlement.clearedBy = req.employee?._id || req.user?._id;
    }
    addOffboardingActivity(workflow, {
        action: 'payroll_clearance_updated',
        description: `Payroll clearance marked ${workflow.finalSettlement.status}`,
        actor: req.employee?._id || req.user?._id,
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: req.employee?._id || req.user?._id });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Payroll clearance updated', data: populated });
});

export const updateOffboardingAccessRevocation = asyncHandler(async (req, res) => {
    await requireAnyFeature(req, ['accessRevocation', 'emailAccessRemoval'], 'Access revocation');
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    if (!roleCtx.isAdmin && !roleCtx.isHR && !roleCtx.isIT) {
        return res.status(403).json({ success: false, message: 'Only HR or IT can update access revocation' });
    }
    const item = workflow.accessRevocation.id(req.params.accessId);
    if (!item) return res.status(404).json({ success: false, message: 'Access item not found' });
    if (!['Pending', 'Completed', 'Waived'].includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid access-revocation status' });
    }
    item.status = req.body.status;
    item.notes = req.body.notes ?? item.notes;
    item.revokedDate = item.status === 'Completed' ? new Date() : undefined;
    item.revokedBy = item.status === 'Completed' ? (req.employee?._id || req.user?._id) : undefined;
    addOffboardingActivity(workflow, {
        action: 'access_revocation_updated',
        description: `${item.system} marked ${item.status}`,
        actor: req.employee?._id || req.user?._id,
    });
    await saveOffboardingWorkflow(workflow, organizationId, { actor: req.employee?._id || req.user?._id });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Access revocation updated', data: populated });
});

export const addOffboardingNote = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const workflow = await getOffboardingWorkflowOr404(req.params.id, organizationId);
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    const note = String(req.body.note || '').trim();
    if (!note) return res.status(400).json({ success: false, message: 'Note is required' });
    workflow.notes.push({
        note: note.slice(0, 4000),
        visibility: req.body.visibility || 'internal',
        addedBy: req.employee?._id || req.user?._id,
        addedAt: new Date(),
    });
    addOffboardingActivity(workflow, {
        action: 'note_added',
        description: 'A note was added to the offboarding workflow',
        actor: req.employee?._id || req.user?._id,
    });
    await saveOffboardingWorkflow(workflow, organizationId, { recalculate: false });
    const populated = await populateOffboardingWorkflow(OffboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Note added', data: populated });
});

export const getOffboardingDashboard = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const baseRole = await getOffboardingRoleContext(req);
    const roleCtx = await enrichOffboardingVisibility(baseRole);
    const { view: rawView } = req.query;
    const { query, view, postFilter } = await buildOffboardingViewQuery(organizationId, roleCtx, rawView);

    let workflows = await populateOffboardingWorkflow(
        OffboardingWorkflow.find(query).sort({ updatedAt: -1 }).limit(100),
    );
    if (typeof postFilter === 'function') {
        workflows = postFilter(workflows);
    }

    res.json({
        success: true,
        data: {
            workflows: workflows.map((workflow) => sanitizeOffboardingWorkflow(workflow, roleCtx)),
            stats: buildOffboardingDashboardStats(workflows),
            view,
            role: {
                employeeId: roleCtx.employeeId,
                isAdmin: roleCtx.isAdmin,
                isHR: roleCtx.isHR,
                isManager: roleCtx.isManager,
                isAssignee: roleCtx.isAssignee,
                isIT: roleCtx.isIT,
                isPayroll: roleCtx.isPayroll,
                isEmployee: !roleCtx.isAdmin && !roleCtx.isHR,
                isLineManager: roleCtx.isLineManager,
                hasDirectReports: roleCtx.hasDirectReports,
                hasPendingManagerTasks: roleCtx.hasPendingManagerTasks,
                hasSelfWorkflow: roleCtx.hasSelfWorkflow,
                canViewSelf: roleCtx.canViewSelf,
                canViewTasks: roleCtx.canViewTasks,
                canViewTeam: roleCtx.canViewTeam,
                canViewBuddy: false,
            },
        },
    });
});

export const getMyOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOffboardingRoleContext(req);
    if (!roleCtx.employeeId) return res.status(404).json({ success: false, message: 'Employee profile not found' });
    const workflow = await populateOffboardingWorkflow(OffboardingWorkflow.findOne({
        organizationId,
        employeeId: roleCtx.employeeId,
        status: { $ne: 'Cancelled' },
    }).sort({ createdAt: -1 }));
    if (!workflow) return res.status(404).json({ success: false, message: 'No offboarding workflow found' });
    res.json({ success: true, data: sanitizeOffboardingWorkflow(workflow, roleCtx) });
});

export const getOffboardingAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const match = { organizationId };
    const [total, completed, active, overdue, byReason, byStatus, averageProgress] = await Promise.all([
        OffboardingWorkflow.countDocuments(match),
        OffboardingWorkflow.countDocuments({ ...match, status: 'Completed' }),
        OffboardingWorkflow.countDocuments({ ...match, status: { $in: ['Initiated', 'In Progress'] } }),
        OffboardingWorkflow.countDocuments({ ...match, status: 'Overdue' }),
        OffboardingWorkflow.aggregate([
            { $match: match },
            { $group: { _id: '$reason', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        OffboardingWorkflow.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        OffboardingWorkflow.aggregate([
            { $match: match },
            { $group: { _id: null, value: { $avg: '$progress' } } },
        ]),
    ]);
    res.json({
        success: true,
        data: {
            total,
            completed,
            active,
            overdue,
            completionRate: total ? Math.round((completed / total) * 100) : 0,
            averageProgress: Math.round(averageProgress[0]?.value || 0),
            byReason,
            byStatus,
        },
    });
});

export const acceptOnboardingPolicy = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    workflow.policyAccepted = true;
    workflow.policyAcceptedAt = new Date();
    addActivity(workflow, { action: 'policy_accepted', description: 'Company policies accepted', actor: req.employee?._id });
    await saveWorkflowAndBroadcast(workflow, organizationId);
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, data: populated });
});

export const getMyOnboardingTasks = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const roleCtx = await getOnboardingRoleContext(req);
    const actorId = roleCtx.userId;

    let query = { organizationId, isTemplate: { $ne: true }, status: { $ne: 'Completed' } };
    if (!roleCtx.isHR && !roleCtx.isAdmin) {
        if (roleCtx.isManager) query.assignedManager = actorId;
        else if (roleCtx.isBuddy) query.assignedBuddy = actorId;
        else query.employeeId = roleCtx.employeeId;
    }

    const workflows = await populateWorkflow(OnboardingWorkflow.find(query).sort({ updatedAt: -1 }).limit(20));
    const myTasks = [];
    for (const wf of workflows) {
        const tasks = filterTasksForUser(wf, actorId, roleCtx);
        for (const task of tasks) {
            if (task.status !== 'Completed') {
                myTasks.push({ workflow: { _id: wf._id, employee: wf.employeeId }, task });
            }
        }
    }

    res.json({ success: true, data: myTasks });
});
