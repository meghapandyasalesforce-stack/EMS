/**
 * Manager Experience Service - My Onboarding, My Team, Buddy views
 * Provides manager-specific lifecycle workflows, actions, and dashboards
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import {
    enrichOnboardingVisibility,
    buildOnboardingViewQuery,
    sanitizeTasksForLifecycleView,
} from './lifecycleVisibilityService.js';

/**
 * Get manager's onboarding workflows (team members they manage)
 */
export async function getManagerOnboardingWorkflows(organizationId, managerId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'onboarding')) {
        return [];
    }

    // Get all direct reports
    const directReports = await Employee.find({
        organizationId,
        assignedManager: managerId,
        isActive: true,
    }).select('_id').lean();

    const employeeIds = directReports.map(e => e._id);

    const query = {
        organizationId,
        isTemplate: { $ne: true },
        employeeId: { $in: employeeIds },
    };

    if (filters.status) query.status = filters.status;
    if (filters.search) {
        query.$or = [
            { 'employee.firstName': new RegExp(filters.search, 'i') },
            { 'employee.lastName': new RegExp(filters.search, 'i') },
            { 'employee.email': new RegExp(filters.search, 'i') },
        ];
    }

    const workflows = await OnboardingWorkflow.find(query)
        .populate('employeeId', 'firstName lastName email department jobTitle')
        .populate('assignedBuddy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

    return workflows;
}

/**
 * Get manager's offboarding workflows (team members leaving)
 */
export async function getManagerOffboardingWorkflows(organizationId, managerId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'offboarding')) {
        return [];
    }

    const directReports = await Employee.find({
        organizationId,
        assignedManager: managerId,
        isActive: true,
    }).select('_id').lean();

    const employeeIds = directReports.map(e => e._id);

    const query = {
        organizationId,
        isTemplate: { $ne: true },
        employeeId: { $in: employeeIds },
    };

    if (filters.status) query.status = filters.status;

    const workflows = await OffboardingWorkflow.find(query)
        .populate('employeeId', 'firstName lastName email department jobTitle')
        .sort({ createdAt: -1 })
        .lean();

    return workflows;
}

/**
 * Get manager's dashboard statistics
 */
export async function getManagerDashboard(organizationId, managerId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const onboardingEnabled = isFeatureEnabled(settings, 'onboarding');
    const offboardingEnabled = isFeatureEnabled(settings, 'offboarding');
    const buddyEnabled = isFeatureEnabled(settings, 'buddyProgram');

    const directReports = await Employee.find({
        organizationId,
        assignedManager: managerId,
        isActive: true,
    }).select('_id').lean();

    const employeeIds = directReports.map(e => e._id);

    let onboardingStats = { total: 0, inProgress: 0, completed: 0, overdue: 0 };
    let offboardingStats = { total: 0, inProgress: 0, completed: 0 };
    let buddyAssignments = 0;
    let pendingManagerTasks = 0;

    if (onboardingEnabled) {
        const onboardingWorkflows = await OnboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            employeeId: { $in: employeeIds },
        }).lean();

        onboardingStats.total = onboardingWorkflows.length;
        onboardingStats.inProgress = onboardingWorkflows.filter(w => ['In Progress', 'Not Started'].includes(w.status)).length;
        onboardingStats.completed = onboardingWorkflows.filter(w => w.status === 'Completed').length;
        onboardingStats.overdue = onboardingWorkflows.filter(w => w.status === 'Overdue').length;

        // Count pending manager tasks
        for (const wf of onboardingWorkflows) {
            const managerTasks = (wf.tasks || []).filter(t => 
                t.assigneeRole === 'manager' && t.status === 'Pending'
            );
            pendingManagerTasks += managerTasks.length;
        }

        // Count buddy assignments
        if (buddyEnabled) {
            buddyAssignments = await OnboardingWorkflow.countDocuments({
                organizationId,
                assignedBuddy: managerId,
                isTemplate: { $ne: true },
                status: { $nin: ['Cancelled', 'Completed'] },
            });
        }
    }

    if (offboardingEnabled) {
        const offboardingWorkflows = await OffboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            employeeId: { $in: employeeIds },
        }).lean();

        offboardingStats.total = offboardingWorkflows.length;
        offboardingStats.inProgress = offboardingWorkflows.filter(w => ['Initiated', 'In Progress'].includes(w.status)).length;
        offboardingStats.completed = offboardingWorkflows.filter(w => w.status === 'Completed').length;
    }

    return {
        teamSize: directReports.length,
        onboarding: onboardingEnabled ? onboardingStats : null,
        offboarding: offboardingEnabled ? offboardingStats : null,
        buddyAssignments: buddyEnabled ? buddyAssignments : null,
        pendingManagerTasks,
        featuresEnabled: {
            onboarding: onboardingEnabled,
            offboarding: offboardingEnabled,
            buddy: buddyEnabled,
        },
    };
}

/**
 * Get manager's pending tasks across all workflows
 */
export async function getManagerPendingTasks(organizationId, managerId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    
    const onboardingEnabled = isFeatureEnabled(settings, 'onboarding');
    const offboardingEnabled = isFeatureEnabled(settings, 'offboarding');

    const tasks = [];

    if (onboardingEnabled) {
        const onboardingWorkflows = await OnboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            'tasks.assigneeRole': 'manager',
            'tasks.assignedTo': managerId,
            'tasks.status': 'Pending',
        })
        .populate('employeeId', 'firstName lastName email')
        .lean();

        for (const wf of onboardingWorkflows) {
            const managerTasks = (wf.tasks || []).filter(t => 
                t.assigneeRole === 'manager' && 
                (t.assignedTo?.toString() === managerId.toString() || !t.assignedTo) &&
                t.status === 'Pending'
            );

            for (const task of managerTasks) {
                tasks.push({
                    taskId: task._id,
                    title: task.title,
                    description: task.description,
                    dueDate: task.dueDate,
                    workflowId: wf._id,
                    workflowType: 'onboarding',
                    employee: wf.employeeId,
                    priority: task.priority || 'medium',
                    createdAt: task.createdAt,
                });
            }
        }
    }

    if (offboardingEnabled) {
        const offboardingWorkflows = await OffboardingWorkflow.find({
            organizationId,
            isTemplate: { $ne: true },
            'tasks.assigneeRole': 'manager',
            'tasks.assignedTo': managerId,
            'tasks.status': 'Pending',
        })
        .populate('employeeId', 'firstName lastName email')
        .lean();

        for (const wf of offboardingWorkflows) {
            const managerTasks = (wf.tasks || []).filter(t => 
                t.assigneeRole === 'manager' && 
                (t.assignedTo?.toString() === managerId.toString() || !t.assignedTo) &&
                t.status === 'Pending'
            );

            for (const task of managerTasks) {
                tasks.push({
                    taskId: task._id,
                    title: task.title,
                    description: task.description,
                    dueDate: task.dueDate,
                    workflowId: wf._id,
                    workflowType: 'offboarding',
                    employee: wf.employeeId,
                    priority: task.priority || 'medium',
                    createdAt: task.createdAt,
                });
            }
        }
    }

    // Sort by due date (overdue first)
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
 * Complete a manager task
 */
export async function completeManagerTask(organizationId, workflowId, taskId, { notes, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
    });

    if (!workflow) {
        // Try offboarding
        const offboardingWf = await OffboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
        });
        if (!offboardingWf) throw new Error('Workflow not found');
        
        const task = offboardingWf.tasks.id(taskId);
        if (!task) throw new Error('Task not found');
        if (task.assigneeRole !== 'manager') throw new Error('Not a manager task');

        task.status = 'Completed';
        task.completedDate = new Date();
        task.completedBy = actor?._id;
        if (notes) task.notes = notes;

        offboardingWf.activityFeed = offboardingWf.activityFeed || [];
        offboardingWf.activityFeed.unshift({
            action: 'task_completed',
            description: `Manager completed task: ${task.title}`,
            actor: actor?._id,
            actorName: actor?.name,
            metadata: { taskId, notes },
        });

        await offboardingWf.save();

        await logLifecycleAudit({
            action: 'Update',
            entityType: 'OffboardingWorkflow',
            entityId: offboardingWf._id,
            entityName: 'Manager Task Completed',
            req,
            actor,
            metadata: { taskId, taskTitle: task.title },
        });

        return offboardingWf;
    }

    const task = workflow.tasks.id(taskId);
    if (!task) throw new Error('Task not found');
    if (task.assigneeRole !== 'manager') throw new Error('Not a manager task');

    task.status = 'Completed';
    task.completedDate = new Date();
    task.completedBy = actor?._id;
    if (notes) task.notes = notes;

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'task_completed',
        description: `Manager completed task: ${task.title}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { taskId, notes },
    });

    await workflow.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OnboardingWorkflow',
        entityId: workflow._id,
        entityName: 'Manager Task Completed',
        req,
        actor,
        metadata: { taskId, taskTitle: task.title },
    });

    return workflow;
}

/**
 * Get manager's buddy assignments
 */
export async function getManagerBuddyAssignments(organizationId, managerId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        return [];
    }

    const assignments = await OnboardingWorkflow.find({
        organizationId,
        assignedBuddy: managerId,
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
 * Add manager note to workflow
 */
export async function addManagerNote(organizationId, workflowId, { note, isPrivate, actor, req } = {}) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
    });

    if (!workflow) {
        const offboardingWf = await OffboardingWorkflow.findOne({
            _id: workflowId,
            organizationId,
        });
        if (!offboardingWf) throw new Error('Workflow not found');

        offboardingWf.notes = offboardingWf.notes || [];
        offboardingWf.notes.push({
            content: note,
            isPrivate: isPrivate || false,
            author: actor?._id,
            authorName: actor?.name,
            createdAt: new Date(),
            role: 'manager',
        });

        await offboardingWf.save();

        await logLifecycleAudit({
            action: 'Update',
            entityType: 'OffboardingWorkflow',
            entityId: offboardingWf._id,
            entityName: 'Manager Note Added',
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
        role: 'manager',
    });

    await workflow.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'OnboardingWorkflow',
        entityId: workflow._id,
        entityName: 'Manager Note Added',
        req,
        actor,
        metadata: { isPrivate },
    });

    return workflow;
}

/**
 * Get team members with their lifecycle status
 */
export async function getTeamLifecycleStatus(organizationId, managerId) {
    const directReports = await Employee.find({
        organizationId,
        assignedManager: managerId,
        isActive: true,
    })
    .select('_id firstName lastName email department jobTitle joiningDate')
    .lean();

    const employeeIds = directReports.map(e => e._id);

    const onboardingWorkflows = await OnboardingWorkflow.find({
        organizationId,
        isTemplate: { $ne: true },
        employeeId: { $in: employeeIds },
    })
    .populate('employeeId')
    .lean();

    const offboardingWorkflows = await OffboardingWorkflow.find({
        organizationId,
        isTemplate: { $ne: true },
        employeeId: { $in: employeeIds },
    })
    .populate('employeeId')
    .lean();

    const teamStatus = directReports.map(employee => {
        const onboarding = onboardingWorkflows.find(w => 
            w.employeeId?._id.toString() === employee._id.toString()
        );
        const offboarding = offboardingWorkflows.find(w => 
            w.employeeId?._id.toString() === employee._id.toString()
        );

        return {
            employee,
            onboarding: onboarding ? {
                workflowId: onboarding._id,
                status: onboarding.status,
                progress: onboarding.progress || 0,
                joiningDate: onboarding.joiningDate,
            } : null,
            offboarding: offboarding ? {
                workflowId: offboarding._id,
                status: offboarding.status,
                lastWorkingDay: offboarding.lastWorkingDay,
            } : null,
            lifecyclePhase: offboarding ? 'offboarding' : onboarding ? 'onboarding' : 'active',
        };
    });

    return teamStatus;
}
