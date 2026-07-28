/**
 * Employee Experience Service - Self view, Buddy employees, tasks, forms
 * Provides employee-specific lifecycle workflows, actions, and dashboards
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import { LifecycleFormResponse } from '../models/lifecycle.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { getFormCompletionStatus } from './lifecycleFormGateService.js';

/**
 * Get employee's own onboarding workflow with full details
 */
export async function getEmployeeOnboardingWorkflow(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'onboarding')) {
        return null;
    }

    const workflow = await OnboardingWorkflow.findOne({
        organizationId,
        employeeId,
        isTemplate: { $ne: true },
    })
    .populate('assignedBuddy', 'firstName lastName email')
    .populate('assignedManager', 'firstName lastName email')
    .lean();

    if (!workflow) return null;

    // Enrich with additional employee-relevant data
    return {
        ...workflow,
        employeeTasks: (workflow.tasks || []).filter(t => t.assigneeRole === 'employee'),
        employeeChecklist: (workflow.checklist || []).filter(c => c.assigneeRole === 'employee'),
        assets: workflow.assets || [],
        training: workflow.training || [],
        signatures: workflow.signatures || [],
        buddyCheckins: workflow.buddyCheckins || [],
        notes: (workflow.notes || []).filter(n => !n.isPrivate || n.author?.toString() === employeeId.toString()),
    };
}

/**
 * Get employee's own offboarding workflow with full details
 */
export async function getEmployeeOffboardingWorkflow(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'offboarding')) {
        return null;
    }

    const workflow = await OffboardingWorkflow.findOne({
        organizationId,
        employeeId,
        isTemplate: { $ne: true },
    })
    .populate('assignedManager', 'firstName lastName email')
    .lean();

    if (!workflow) return null;

    // Enrich with additional employee-relevant data
    return {
        ...workflow,
        employeeTasks: (workflow.tasks || []).filter(t => t.assigneeRole === 'employee'),
        employeeChecklist: (workflow.checklist || []).filter(c => c.assigneeRole === 'employee'),
        assets: workflow.assets || [],
        knowledgeTransfer: workflow.knowledgeTransfer || [],
        exitInterview: workflow.exitInterview || null,
        payrollClearance: workflow.payrollClearance || null,
        accessRevocation: workflow.accessRevocation || [],
        notes: (workflow.notes || []).filter(n => !n.isPrivate || n.author?.toString() === employeeId.toString()),
    };
}

/**
 * Get employee's dashboard
 */
export async function getEmployeeDashboard(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const onboardingEnabled = isFeatureEnabled(settings, 'onboarding');
    const offboardingEnabled = isFeatureEnabled(settings, 'offboarding');
    const buddyEnabled = isFeatureEnabled(settings, 'buddyProgram');
    const formsEnabled = isFeatureEnabled(settings, 'digitalForms') || 
                         isFeatureEnabled(settings, 'emergencyContact') ||
                         isFeatureEnabled(settings, 'familyNominee') ||
                         isFeatureEnabled(settings, 'bankDetails');

    const onboardingWorkflow = onboardingEnabled ? await getEmployeeOnboardingWorkflow(organizationId, employeeId) : null;
    const offboardingWorkflow = offboardingEnabled ? await getEmployeeOffboardingWorkflow(organizationId, employeeId) : null;

    let buddyAssignments = 0;
    let pendingTasks = 0;
    let pendingForms = 0;
    let formsProgress = 0;

    if (buddyEnabled) {
        buddyAssignments = await OnboardingWorkflow.countDocuments({
            organizationId,
            assignedBuddy: employeeId,
            isTemplate: { $ne: true },
            status: { $nin: ['Cancelled', 'Completed'] },
        });
    }

    if (onboardingWorkflow) {
        pendingTasks = (onboardingWorkflow.tasks || []).filter(t => 
            t.assigneeRole === 'employee' && t.status === 'Pending'
        ).length;
    }

    if (formsEnabled && onboardingWorkflow) {
        const formStatus = await getFormCompletionStatus(organizationId, {
            employeeId,
            workflowId: onboardingWorkflow._id,
        });
        pendingForms = formStatus.total - formStatus.completed;
        formsProgress = formStatus.progress;
    }

    return {
        onboarding: onboardingEnabled ? {
            workflowId: onboardingWorkflow?._id,
            status: onboardingWorkflow?.status,
            progress: onboardingWorkflow?.progress || 0,
            joiningDate: onboardingWorkflow?.joiningDate,
            assignedBuddy: onboardingWorkflow?.assignedBuddy,
            assignedManager: onboardingWorkflow?.assignedManager,
        } : null,
        offboarding: offboardingEnabled ? {
            workflowId: offboardingWorkflow?._id,
            status: offboardingWorkflow?.status,
            lastWorkingDay: offboardingWorkflow?.lastWorkingDay,
        } : null,
        buddyAssignments: buddyEnabled ? buddyAssignments : null,
        pendingTasks,
        pendingForms: formsEnabled ? pendingForms : null,
        formsProgress: formsEnabled ? formsProgress : null,
        featuresEnabled: {
            onboarding: onboardingEnabled,
            offboarding: offboardingEnabled,
            buddy: buddyEnabled,
            forms: formsEnabled,
        },
    };
}

/**
 * Get employee's pending tasks
 */
export async function getEmployeePendingTasks(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const tasks = [];

    const onboardingEnabled = isFeatureEnabled(settings, 'onboarding');
    const offboardingEnabled = isFeatureEnabled(settings, 'offboarding');

    if (onboardingEnabled) {
        const onboardingWorkflow = await OnboardingWorkflow.findOne({
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
        }).lean();

        if (onboardingWorkflow) {
            const employeeTasks = (onboardingWorkflow.tasks || []).filter(t => 
                t.assigneeRole === 'employee' && t.status === 'Pending'
            );

            for (const task of employeeTasks) {
                tasks.push({
                    taskId: task._id,
                    title: task.title,
                    description: task.description,
                    dueDate: task.dueDate,
                    workflowId: onboardingWorkflow._id,
                    workflowType: 'onboarding',
                    priority: task.priority || 'medium',
                    createdAt: task.createdAt,
                });
            }
        }
    }

    if (offboardingEnabled) {
        const offboardingWorkflow = await OffboardingWorkflow.findOne({
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
        }).lean();

        if (offboardingWorkflow) {
            const employeeTasks = (offboardingWorkflow.tasks || []).filter(t => 
                t.assigneeRole === 'employee' && t.status === 'Pending'
            );

            for (const task of employeeTasks) {
                tasks.push({
                    taskId: task._id,
                    title: task.title,
                    description: task.description,
                    dueDate: task.dueDate,
                    workflowId: offboardingWorkflow._id,
                    workflowType: 'offboarding',
                    priority: task.priority || 'medium',
                    createdAt: task.createdAt,
                });
            }
        }
    }

    // Sort by due date
    const now = new Date();
    tasks.sort((a, b) => {
        const aOverdue = a.dueDate && new Date(a.dueDate) < now;
        const bOverdue = b.dueDate && new Date(b.dueDate) < now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return new Date(a.dueDate || a.createdAt) - new Date(b.dueDate || b.createdAt);
    });

    return tasks;
}

/**
 * Complete an employee task
 */
export async function completeEmployeeTask(organizationId, workflowId, taskId, { notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) {
        const offboardingWf = await OffboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
            employeeId: actor?._id,
        });
        if (!offboardingWf) throw new Error('Workflow not found');
        
        const task = offboardingWf.tasks.id(taskId);
        if (!task) throw new Error('Task not found');
        if (task.assigneeRole !== 'employee') throw new Error('Not an employee task');

        task.status = 'Completed';
        task.completedDate = new Date();
        task.completedBy = actor?._id;
        if (notes) task.notes = notes;

        offboardingWf.activityFeed = offboardingWf.activityFeed || [];
        offboardingWf.activityFeed.unshift({
            action: 'task_completed',
            description: `Employee completed task: ${task.title}`,
            actor: actor?._id,
            actorName: actor?.name,
            metadata: { taskId, notes },
        });

        await offboardingWf.save();

        await logLifecycleAudit({
            action: 'Update',
            entityType: 'OffboardingWorkflow',
            entityId: offboardingWf._id,
            entityName: 'Employee Task Completed',
            req,
            actor,
            metadata: { taskId, taskTitle: task.title },
        });

        return offboardingWf;
    }

    const task = workflow.tasks.id(taskId);
    if (!task) throw new Error('Task not found');
    if (task.assigneeRole !== 'employee') throw new Error('Not an employee task');

    task.status = 'Completed';
    task.completedDate = new Date();
    task.completedBy = actor?._id;
    if (notes) task.notes = notes;

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'task_completed',
        description: `Employee completed task: ${task.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { taskId, notes },
    });

    await workflow.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OnboardingWorkflow',
        entityId: workflow._id,
        entityName: 'Employee Task Completed',
        req,
        actor,
        metadata: { taskId, taskTitle: task.title },
    });

    return workflow;
}

/**
 * Get employee's buddy assignments (if they are a buddy)
 */
export async function getEmployeeBuddyAssignments(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        return [];
    }

    const assignments = await OnboardingWorkflow.find({
        organizationId,
        assignedBuddy: employeeId,
        isTemplate: { $ne: true },
        status: { $nin: ['Cancelled', 'Completed'] },
    })
    .populate('employeeId', 'firstName lastName email department jobTitle')
    .sort({ createdAt: -1 })
    .lean();

    return assignments.map(wf => ({
        workflowId: wf._id,
        employee: wf.employeeId,
        status: wf.status,
        progress: wf.progress || 0,
        joiningDate: wf.joiningDate,
        buddyCheckins: wf.buddyCheckins?.length || 0,
        lastCheckin: wf.buddyCheckins?.[wf.buddyCheckins.length - 1],
    }));
}

/**
 * Get employee's pending forms
 */
export async function getEmployeePendingForms(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const formsEnabled = isFeatureEnabled(settings, 'digitalForms') || 
                       isFeatureEnabled(settings, 'emergencyContact') ||
                       isFeatureEnabled(settings, 'familyNominee') ||
                       isFeatureEnabled(settings, 'bankDetails');

    if (!formsEnabled) {
        return [];
    }

    // Get employee's onboarding workflow
    const onboardingWorkflow = await OnboardingWorkflow.findOne({
        organizationId,
        employeeId,
        isTemplate: { $ne: true },
    }).lean();

    if (!onboardingWorkflow) {
        return [];
    }

    const formStatus = await getFormCompletionStatus(organizationId, {
        employeeId,
        workflowId: onboardingWorkflow._id,
    });

    return formStatus.items.filter(item => !item.completed).map(item => ({
        formId: item.formId,
        name: item.name,
        featureKey: item.featureKey,
        status: item.status,
        responseId: item.responseId,
    }));
}

/**
 * Get employee's completed forms
 */
export async function getEmployeeCompletedForms(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const formsEnabled = isFeatureEnabled(settings, 'digitalForms') || 
                       isFeatureEnabled(settings, 'emergencyContact') ||
                       isFeatureEnabled(settings, 'familyNominee') ||
                       isFeatureEnabled(settings, 'bankDetails');

    if (!formsEnabled) {
        return [];
    }

    const responses = await LifecycleFormResponse.find({
        organizationId,
        employeeId,
        status: { $in: ['Submitted', 'Approved'] },
    })
    .populate('formDefinitionId', 'name description')
    .sort({ submittedAt: -1 })
    .lean();

    return responses.map(response => ({
        responseId: response._id,
        form: response.formDefinitionId,
        status: response.status,
        submittedAt: response.submittedAt,
        approvalStatus: response.approvalStatus,
    }));
}

/**
 * Get employee's lifecycle summary
 */
export async function getEmployeeLifecycleSummary(organizationId, employeeId) {
    const onboardingWorkflow = await getEmployeeOnboardingWorkflow(organizationId, employeeId);
    const offboardingWorkflow = await getEmployeeOffboardingWorkflow(organizationId, employeeId);

    let lifecyclePhase = 'active';
    if (offboardingWorkflow) {
        lifecyclePhase = 'offboarding';
    } else if (onboardingWorkflow && onboardingWorkflow.status !== 'Completed') {
        lifecyclePhase = 'onboarding';
    }

    return {
        lifecyclePhase,
        onboarding: onboardingWorkflow ? {
            workflowId: onboardingWorkflow._id,
            status: onboardingWorkflow.status,
            progress: onboardingWorkflow.progress || 0,
            joiningDate: onboardingWorkflow.joiningDate,
        } : null,
        offboarding: offboardingWorkflow ? {
            workflowId: offboardingWorkflow._id,
            status: offboardingWorkflow.status,
            lastWorkingDay: offboardingWorkflow.lastWorkingDay,
        } : null,
    };
}

/**
 * Update employee onboarding task
 */
export async function updateEmployeeOnboardingTask(organizationId, workflowId, taskId, { status, notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const task = workflow.tasks.id(taskId);
    if (!task) throw new Error('Task not found');
    if (task.assigneeRole !== 'employee') throw new Error('Not an employee task');

    task.status = status || task.status;
    if (notes) task.notes = notes;
    if (status === 'Completed') {
        task.completedDate = new Date();
        task.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'task_updated',
        description: `Employee updated task: ${task.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { taskId, status },
    });

    await workflow.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OnboardingWorkflow',
        entityId: workflow._id,
        entityName: 'Employee Task Updated',
        req,
        actor,
        metadata: { taskId, taskTitle: task.title },
    });

    return workflow;
}

/**
 * Update employee onboarding checklist item
 */
export async function updateEmployeeOnboardingChecklist(organizationId, workflowId, itemId, { completed, notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const item = workflow.checklist.id(itemId);
    if (!item) throw new Error('Checklist item not found');
    if (item.assigneeRole !== 'employee') throw new Error('Not an employee checklist item');

    item.completed = completed !== undefined ? completed : item.completed;
    if (notes) item.notes = notes;
    if (item.completed) {
        item.completedAt = new Date();
        item.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'checklist_updated',
        description: `Employee updated checklist item: ${item.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { itemId, completed },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee onboarding asset
 */
export async function updateEmployeeOnboardingAsset(organizationId, workflowId, assetId, { status, notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const asset = workflow.assets.id(assetId);
    if (!asset) throw new Error('Asset not found');

    asset.status = status || asset.status;
    if (notes) asset.notes = notes;

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'asset_updated',
        description: `Employee updated asset: ${asset.name}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { assetId, status },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee onboarding training
 */
export async function updateEmployeeOnboardingTraining(organizationId, workflowId, trainingId, { status, progress, notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const training = workflow.training.id(trainingId);
    if (!training) throw new Error('Training not found');

    training.status = status || training.status;
    training.progress = progress !== undefined ? progress : training.progress;
    if (notes) training.notes = notes;
    if (status === 'Completed') {
        training.completedAt = new Date();
        training.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'training_updated',
        description: `Employee updated training: ${training.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { trainingId, status, progress },
    });

    await workflow.save();

    return workflow;
}

/**
 * Sign employee policy
 */
export async function signEmployeePolicy(organizationId, workflowId, signatureId, { signed, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const signature = workflow.signatures.id(signatureId);
    if (!signature) throw new Error('Signature not found');

    signature.signed = signed !== undefined ? signed : signature.signed;
    if (signature.signed) {
        signature.signedAt = new Date();
        signature.signedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'policy_signed',
        description: `Employee signed policy: ${signature.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { signatureId, signed },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee buddy checkin
 */
export async function updateEmployeeBuddyCheckin(organizationId, workflowId, checkinId, { status, notes, topicsDiscussed, concerns, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const checkin = workflow.buddyCheckins.id(checkinId);
    if (!checkin) throw new Error('Checkin not found');

    checkin.status = status || checkin.status;
    if (notes) checkin.notes = notes;
    if (topicsDiscussed) checkin.topicsDiscussed = topicsDiscussed;
    if (concerns) checkin.concerns = concerns;
    if (status === 'Completed') {
        checkin.completedAt = new Date();
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'buddy_checkin_updated',
        description: `Employee updated buddy checkin`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkinId, status },
    });

    await workflow.save();

    return workflow;
}

/**
 * Add employee note
 */
export async function addEmployeeNote(organizationId, workflowId, { note, isPrivate, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) {
        const offboardingWf = await OffboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
            employeeId: actor?._id,
        });
        if (!offboardingWf) throw new Error('Workflow not found');

        offboardingWf.notes = offboardingWf.notes || [];
        offboardingWf.notes.push({
            content: note,
            isPrivate: isPrivate || false,
            author: actor?._id,
            authorName: actor?.name,
            createdAt: new Date(),
            role: 'employee',
        });

        await offboardingWf.save();

        await logLifecycleAudit({
            action: 'Update',
            entityType: 'OffboardingWorkflow',
            entityId: offboardingWf._id,
            entityName: 'Employee Note Added',
            req,
            actor,
            metadata: { isPrivate },
        });

        return offboardingWf;
    }

    workflow.notes = workflow.notes || [];
    workflow.notes.push({
        content: note,
        isPrivate: isPrivate || false,
        author: actor?._id,
        authorName: actor?.name,
        createdAt: new Date(),
        role: 'employee',
    });

    await workflow.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OnboardingWorkflow',
        entityId: workflow._id,
        entityName: 'Employee Note Added',
        req,
        actor,
        metadata: { isPrivate },
    });

    return workflow;
}

/**
 * Update employee offboarding task
 */
export async function updateEmployeeOffboardingTask(organizationId, workflowId, taskId, { status, notes, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const task = workflow.tasks.id(taskId);
    if (!task) throw new Error('Task not found');
    if (task.assigneeRole !== 'employee') throw new Error('Not an employee task');

    task.status = status || task.status;
    if (notes) task.notes = notes;
    if (status === 'Completed') {
        task.completedDate = new Date();
        task.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'task_updated',
        description: `Employee updated task: ${task.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { taskId, status },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee offboarding checklist item
 */
export async function updateEmployeeOffboardingChecklist(organizationId, workflowId, itemId, { completed, notes, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const item = workflow.checklist.id(itemId);
    if (!item) throw new Error('Checklist item not found');
    if (item.assigneeRole !== 'employee') throw new Error('Not an employee checklist item');

    item.completed = completed !== undefined ? completed : item.completed;
    if (notes) item.notes = notes;
    if (item.completed) {
        item.completedAt = new Date();
        item.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'checklist_updated',
        description: `Employee updated checklist item: ${item.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { itemId, completed },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee offboarding asset
 */
export async function updateEmployeeOffboardingAsset(organizationId, workflowId, assetId, { status, notes, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const asset = workflow.assets.id(assetId);
    if (!asset) throw new Error('Asset not found');

    asset.status = status || asset.status;
    if (notes) asset.notes = notes;

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'asset_updated',
        description: `Employee updated asset: ${asset.name}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { assetId, status },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee knowledge transfer
 */
export async function updateEmployeeKnowledgeTransfer(organizationId, workflowId, transferId, { status, notes, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const transfer = workflow.knowledgeTransfer.id(transferId);
    if (!transfer) throw new Error('Knowledge transfer not found');

    transfer.status = status || transfer.status;
    if (notes) transfer.notes = notes;
    if (status === 'Completed') {
        transfer.completedAt = new Date();
        transfer.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'knowledge_transfer_updated',
        description: `Employee updated knowledge transfer: ${transfer.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { transferId, status },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee exit interview
 */
export async function updateEmployeeExitInterview(organizationId, workflowId, { responses, feedback, rating, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    if (!workflow.exitInterview) {
        workflow.exitInterview = {};
    }

    if (responses) workflow.exitInterview.responses = responses;
    if (feedback) workflow.exitInterview.feedback = feedback;
    if (rating) workflow.exitInterview.rating = rating;
    workflow.exitInterview.completedAt = new Date();
    workflow.exitInterview.completedBy = actor?._id;

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'exit_interview_completed',
        description: 'Employee completed exit interview',
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { rating },
    });

    await workflow.save();

    return workflow;
}

/**
 * Update employee access revocation
 */
export async function updateEmployeeAccessRevocation(organizationId, workflowId, accessId, { status, notes, actor, req } = {}) {
    const workflow = await OffboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        employeeId: actor?._id,
    });

    if (!workflow) throw new Error('Workflow not found');

    const access = workflow.accessRevocation.id(accessId);
    if (!access) throw new Error('Access revocation not found');

    access.status = status || access.status;
    if (notes) access.notes = notes;
    if (status === 'Completed') {
        access.completedAt = new Date();
        access.completedBy = actor?._id;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'access_revocation_updated',
        description: `Employee updated access revocation: ${access.system}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { accessId, status },
    });

    await workflow.save();

    return workflow;
}
