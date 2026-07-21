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
    activateScheduledWorkflows,
    buildEnhancedDashboardStats,
    resolveInitialWorkflowStatus,
} from '../../services/onboardingService.js';
import { notify } from '../../helpers/notificationManager.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

const populateWorkflow = (query) => query
    .populate('employeeId', 'name lastName email employeeId department jobTitle dateOfJoining managerId')
    .populate('assignedHR', 'name email jobTitle')
    .populate('assignedBuddy', 'name email jobTitle')
    .populate('assignedManager', 'name email jobTitle')
    .populate('tasks.assignedTo', 'name email')
    .populate('tasks.comments.author', 'name')
    .populate('documents.uploadedBy', 'name')
    .populate('documents.verifiedBy', 'name')
    .populate('checklist.completedBy', 'name')
    .populate('activityFeed.actor', 'name')
    .populate('notes.addedBy', 'name');

const lightPopulate = (query) => query
    .populate('employeeId', 'name lastName email employeeId department jobTitle')
    .populate('assignedHR', 'name email jobTitle')
    .populate('assignedBuddy', 'name email jobTitle')
    .populate('assignedManager', 'name email jobTitle');

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
        status,
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

    if (existing && !saveAsDraft) {
        if (welcomeMessage) existing.welcomeMessage = welcomeMessage;
        if (assignedHR) existing.assignedHR = assignedHR;
        if (assignedBuddy) existing.assignedBuddy = assignedBuddy;
        if (assignedManager) existing.assignedManager = assignedManager;
        if (joiningDate) existing.joiningDate = new Date(joiningDate);
        if (scheduledStartDate) existing.scheduledStartDate = new Date(scheduledStartDate);
        if (expectedCompletionDate) existing.expectedCompletionDate = new Date(expectedCompletionDate);
        if (templateId) existing.templateId = templateId;
        if (status) existing.status = status;
        addActivity(existing, {
            action: 'workflow_updated',
            description: 'Onboarding workflow settings updated by HR',
            actor: req.employee?._id || req.user?._id,
            actorName: req.employee?.name || req.user?.name || 'HR',
        });
        applyProgressToWorkflow(existing);
        await existing.save();
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
        status,
        welcomeMessage,
        asDraft: Boolean(saveAsDraft),
    });

    if (expectedCompletionDate) workflow.expectedCompletionDate = new Date(expectedCompletionDate);
    if (assignedManager) workflow.assignedManager = assignedManager;
    await workflow.save();

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
    const { employeeId, status, page = 1, limit = 20, view = 'all' } = req.query;
    const query = addOrganizationFilter(req, { isTemplate: { $ne: true } });
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const roleCtx = await getOnboardingRoleContext(req);
    if (view === 'team' && roleCtx.isManager && !roleCtx.isHR && !roleCtx.isAdmin) {
        query.assignedManager = roleCtx.userId;
    } else if (view === 'buddy' && roleCtx.isBuddy && !roleCtx.isHR && !roleCtx.isAdmin) {
        query.assignedBuddy = roleCtx.userId;
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
    const workflow = await populateWorkflow(OnboardingWorkflow.findOne({ _id: id, organizationId }));
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    res.json({ success: true, data: workflow });
});

export const getMyOnboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    await activateScheduledWorkflows(organizationId);

    const employeeId = await resolveEmployeeIdFromRequest(req);

    if (!employeeId) {
        return res.status(401).json({
            success: false,
            message: 'Employee profile not found. Please contact HR.',
        });
    }

    const workflow = await populateWorkflow(OnboardingWorkflow.findOne({
        employeeId, organizationId, isTemplate: { $ne: true },
    }).sort({ createdAt: -1 }));

    if (!workflow) return res.status(404).json({ success: false, message: 'No onboarding workflow found' });
    res.json({ success: true, data: workflow });
});

export const getOnboardingDashboard = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    await activateScheduledWorkflows(organizationId);

    const roleCtx = await getOnboardingRoleContext(req);
    const baseQuery = { organizationId, isTemplate: { $ne: true } };

    let workflowQuery = { ...baseQuery };
    if (!roleCtx.isHR && !roleCtx.isAdmin) {
        if (roleCtx.isManager) workflowQuery.assignedManager = roleCtx.userId;
        else if (roleCtx.isBuddy) workflowQuery.assignedBuddy = roleCtx.userId;
        else if (roleCtx.employeeId) workflowQuery.employeeId = roleCtx.employeeId;
        else {
            return res.json({
                success: true,
                data: { workflows: [], templates: [], stats: {}, role: roleCtx },
            });
        }
    }

    const [workflows, templates, stats] = await Promise.all([
        populateWorkflow(OnboardingWorkflow.find(workflowQuery).sort({ updatedAt: -1 }).limit(50)),
        OnboardingTemplate.find({ organizationId }).lean(),
        roleCtx.isHR || roleCtx.isAdmin
            ? buildEnhancedDashboardStats(organizationId)
            : Promise.resolve({}),
    ]);

    res.json({
        success: true,
        data: { workflows, templates, stats, role: roleCtx },
    });
});

export const updateOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const allowed = ['welcomeMessage', 'expectedCompletionDate', 'assignedHR', 'assignedBuddy', 'assignedManager', 'status', 'tasks', 'checklist', 'notes'];
    for (const key of allowed) {
        if (req.body[key] !== undefined) workflow[key] = req.body[key];
    }

    if (req.body.tasks) {
        addActivity(workflow, {
            action: 'tasks_updated',
            description: 'Onboarding tasks were updated',
            actor: req.employee?._id || req.user?._id,
            actorName: req.employee?.name || req.user?.name || 'HR',
        });
    }

    applyProgressToWorkflow(workflow);
    await workflow.save();

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

    const newStatus = req.body.status;

    if (newStatus === 'Completed') {
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

    applyProgressToWorkflow(workflow);
    await workflow.save();

    if (task.status === 'Completed') {
        notify({ type: 'onboarding_task_completed', organizationId, data: { workflow, task } }).catch(() => {});
    }

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: activityDesc, data: populated });
});

// ─── Documents ───────────────────────────────────────────────────────────────

export const uploadOnboardingDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { documentType, name, url } = req.body;
    const organizationId = getOrganizationId(req);
    const uploaderId = await resolveEmployeeIdFromRequest(req);
    const roleCtx = await getOnboardingRoleContext(req);

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const isWorkflowEmployee = workflow.employeeId?.toString() === uploaderId?.toString();
    if (!roleCtx.isHR && !roleCtx.isAdmin && !isWorkflowEmployee) {
        return res.status(403).json({
            success: false,
            message: 'Only the onboarding employee or HR can upload documents',
        });
    }

    if (!url) {
        return res.status(400).json({ success: false, message: 'Document URL is required' });
    }

    let doc = workflow.documents.find((d) => d.documentType === documentType);
    if (doc) {
        doc.name = name || doc.name;
        doc.url = url;
        doc.uploadedAt = new Date();
        doc.uploadedBy = uploaderId;
        doc.status = 'Uploaded';
        doc.rejectionReason = undefined;
    } else {
        workflow.documents.push({
            documentType, name, url, uploadedAt: new Date(),
            uploadedBy: uploaderId, status: 'Uploaded',
        });
        doc = workflow.documents[workflow.documents.length - 1];
    }

    addActivity(workflow, {
        action: 'document_uploaded',
        description: `Document "${documentType}" uploaded`,
        actor: uploaderId,
        metadata: { documentType },
    });

    applyProgressToWorkflow(workflow);
    await workflow.save();

    notify({ type: 'onboarding_document_uploaded', organizationId, data: { workflow, documentType } }).catch(() => {});

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Document uploaded', data: populated });
});

export const verifyOnboardingDocument = asyncHandler(async (req, res) => {
    const { id, docId } = req.params;
    const { status, rejectionReason, remarks } = req.body;
    const organizationId = getOrganizationId(req);
    const verifierId = req.employee?._id || req.user?._id;

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const doc = workflow.documents.id(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    doc.status = status || 'Verified';
    doc.verifiedBy = verifierId;
    doc.verifiedAt = new Date();
    if (rejectionReason) doc.rejectionReason = rejectionReason;
    if (remarks) doc.remarks = remarks;

    addActivity(workflow, {
        action: status === 'Rejected' ? 'document_rejected' : 'document_verified',
        description: `Document "${doc.documentType}" ${status === 'Rejected' ? 'rejected' : 'verified'}`,
        actor: verifierId,
        metadata: { documentType: doc.documentType, status: doc.status },
    });

    applyProgressToWorkflow(workflow);
    await workflow.save();

    notify({
        type: status === 'Rejected' ? 'onboarding_document_rejected' : 'onboarding_document_verified',
        organizationId,
        data: { workflow, doc },
    }).catch(() => {});

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Document updated', data: populated });
});

// ─── Checklist ───────────────────────────────────────────────────────────────

export const updateOnboardingChecklistItem = asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;
    const { completed } = req.body;
    const organizationId = getOrganizationId(req);
    const actorId = req.employee?._id || req.user?._id;

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const item = workflow.checklist.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Checklist item not found' });

    item.completed = completed !== false;
    item.completedBy = completed !== false ? actorId : undefined;
    item.completedAt = completed !== false ? new Date() : undefined;

    addActivity(workflow, {
        action: 'checklist_updated',
        description: `"${item.item}" marked as ${item.completed ? 'complete' : 'incomplete'}`,
        actor: actorId,
    });

    applyProgressToWorkflow(workflow);
    await workflow.save();

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Checklist updated', data: populated });
});

// ─── Workflow status, assets, training, signatures ───────────────────────────

export const updateWorkflowStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = getOrganizationId(req);
    const allowed = ['Draft', 'Scheduled', 'Not Started', 'In Progress', 'Paused', 'Cancelled'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status transition' });
    }

    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    workflow.status = status;
    if (status === 'In Progress' && !workflow.startDate) {
        workflow.startDate = workflow.scheduledStartDate || workflow.joiningDate || new Date();
    }
    addActivity(workflow, {
        action: 'workflow_status_changed',
        description: `Workflow status changed to ${status}`,
        actor: req.employee?._id || req.user?._id,
        actorName: req.employee?.name || req.user?.name || 'HR',
    });
    applyProgressToWorkflow(workflow);
    await workflow.save();

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: `Workflow ${status}`, data: populated });
});

export const updateOnboardingAsset = asyncHandler(async (req, res) => {
    const { id, assetId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const asset = workflow.assets.id(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

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
    await workflow.save();

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Asset updated', data: populated });
});

export const updateOnboardingTraining = asyncHandler(async (req, res) => {
    const { id, trainingId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const module = workflow.trainingModules.id(trainingId);
    if (!module) return res.status(404).json({ success: false, message: 'Training module not found' });

    const { status, score, answers } = req.body;
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
        if (!module.certificateUrl) {
            module.certificateUrl = `/certificates/onboarding/${workflow._id}/${trainingId}`;
        }
    }

    applyProgressToWorkflow(workflow);
    await workflow.save();

    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Training updated', data: populated });
});

export const signOnboardingPolicy = asyncHandler(async (req, res) => {
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

    await workflow.save();
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Policy signed', data: populated });
});

export const updateBuddyCheckin = asyncHandler(async (req, res) => {
    const { id, checkinId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const checkin = workflow.buddyCheckins.id(checkinId);
    if (!checkin) return res.status(404).json({ success: false, message: 'Check-in not found' });

    const { status, scheduledDate, feedback, rating } = req.body;
    if (status) checkin.status = status;
    if (scheduledDate) checkin.scheduledDate = new Date(scheduledDate);
    if (feedback !== undefined) checkin.feedback = feedback;
    if (rating !== undefined) checkin.rating = rating;
    if (status === 'Completed') checkin.completedDate = new Date();

    await workflow.save();
    const populated = await populateWorkflow(OnboardingWorkflow.findById(workflow._id));
    res.json({ success: true, message: 'Buddy check-in updated', data: populated });
});

export const updateManagerAction = asyncHandler(async (req, res) => {
    const { id, actionId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const action = workflow.managerActions.id(actionId);
    if (!action) return res.status(404).json({ success: false, message: 'Manager action not found' });

    const { status, notes, dueDate } = req.body;
    if (status) action.status = status;
    if (notes !== undefined) action.notes = notes;
    if (dueDate) action.dueDate = new Date(dueDate);
    if (status === 'Completed') action.completedAt = new Date();

    await workflow.save();
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

    await workflow.save();
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
        workflowsByStatus, tasksByCategory, pendingDocuments, tasksByRole, rejectedDocs, deptStats] = await Promise.all([
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
            { $match: { ...baseMatch, status: 'Completed', actualCompletionDate: { $exists: true } } },
            { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
            { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: '$emp.department',
                count: { $sum: 1 },
                avgDays: { $avg: { $divide: [{ $subtract: ['$actualCompletionDate', '$startDate'] }, 86400000] } },
            } },
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
            scheduledWorkflows: workflowsByStatus.find((s) => s._id === 'Scheduled')?.count || 0,
        },
    });
});

// ─── Offboarding (preserved) ─────────────────────────────────────────────────

export const createOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const workflow = new OffboardingWorkflow({
        ...req.body,
        organizationId,
        initiatedBy: req.user?._id || req.employee?._id,
    });
    await workflow.save();
    res.status(201).json({ success: true, message: 'Offboarding workflow created', data: workflow });
});

export const getOffboardingWorkflows = asyncHandler(async (req, res) => {
    const { employeeId, status, page = 1, limit = 20 } = req.query;
    const query = addOrganizationFilter(req, {});
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [workflows, total] = await Promise.all([
        OffboardingWorkflow.find(query).populate('employeeId', 'name email employeeId department')
            .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        OffboardingWorkflow.countDocuments(query),
    ]);
    res.json({ success: true, data: workflows, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
});

export const updateOffboardingTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OffboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Offboarding workflow not found' });
    const task = workflow.tasks.id(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    Object.assign(task, req.body);
    if (req.body.status === 'Completed' && !task.completedDate) task.completedDate = new Date();
    const completedTasks = workflow.tasks.filter((t) => t.status === 'Completed').length;
    workflow.progress = workflow.tasks.length > 0 ? Math.round((completedTasks / workflow.tasks.length) * 100) : 0;
    if (workflow.progress === 100) workflow.status = 'Completed';
    await workflow.save();
    res.json({ success: true, message: 'Task updated', data: workflow });
});

export const acceptOnboardingPolicy = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const workflow = await OnboardingWorkflow.findOne({ _id: id, organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    workflow.policyAccepted = true;
    workflow.policyAcceptedAt = new Date();
    addActivity(workflow, { action: 'policy_accepted', description: 'Company policies accepted', actor: req.employee?._id });
    applyProgressToWorkflow(workflow);
    await workflow.save();
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
