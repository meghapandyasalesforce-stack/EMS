/**
 * Buddy Module Service - Dedicated buddy dashboard and task management
 * Buddies have separate visibility and can only see employees assigned to them
 */

import mongoose from 'mongoose';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { OnboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { notify } from '../helpers/notificationManager.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

const BUDDY_TASK_TYPES = Object.freeze([
    'welcome_meeting',
    'orientation_tour',
    'team_introduction',
    'tool_setup_help',
    'first_week_checkin',
    'first_month_checkin',
    'induction_completion',
    'feedback_submission',
]);

const BUDDY_TASK_STATUSES = Object.freeze([
    'Pending',
    'In Progress',
    'Completed',
    'Skipped',
    'Overdue',
]);

/**
 * Get all workflows where the given employee is assigned as buddy
 */
export async function getBuddyWorkflows(organizationId, buddyEmployeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled for this organization');
    }

    const workflows = await OnboardingWorkflow.find({
        organizationId,
        isTemplate: { $ne: true },
        status: { $nin: ['Completed', 'Cancelled'] },
        $or: [
            { assignedBuddy: buddyEmployeeId },
            {
                tasks: {
                    $elemMatch: {
                        assigneeRole: 'buddy',
                        assignedTo: buddyEmployeeId,
                    },
                },
            },
        ],
    })
        .populate('employeeId', 'name lastName email department jobTitle profilePicture')
        .populate('assignedManager', 'name lastName email')
        .populate('assignedHR', 'name lastName email')
        .sort({ startDate: -1 })
        .lean();

    return workflows;
}

/**
 * Get buddy-specific tasks for a workflow
 */
export function getBuddyTasksForWorkflow(workflow, buddyEmployeeId) {
    const buddyIdStr = String(buddyEmployeeId);
    const assignedBuddyStr = String(workflow.assignedBuddy || '');

    // Tasks explicitly assigned to this buddy
    const assignedTasks = (workflow.tasks || []).filter(
        (t) => t.assigneeRole === 'buddy' && 
        (String(t.assignedTo || '') === buddyIdStr || (!t.assignedTo && assignedBuddyStr === buddyIdStr))
    );

    // Buddy checkins from workflow
    const buddyCheckins = (workflow.buddyCheckins || []).map((bc) => ({
        ...bc,
        taskType: 'buddy_checkin',
        isCheckin: true,
    }));

    // Default buddy tasks if none exist
    if (assignedTasks.length === 0 && buddyCheckins.length === 0) {
        return generateDefaultBuddyTasks(workflow);
    }

    return [...assignedTasks, ...buddyCheckins];
}

/**
 * Generate default buddy tasks for a workflow
 */
function generateDefaultBuddyTasks(workflow) {
    const joiningDate = workflow.joiningDate || workflow.startDate;
    const tasks = [];

    // Welcome meeting (Day 1)
    tasks.push({
        _id: `buddy_welcome_${workflow._id}`,
        title: 'Welcome Meeting with New Hire',
        description: 'Schedule and conduct a welcome meeting to introduce the new hire to the team',
        taskType: 'welcome_meeting',
        assigneeRole: 'buddy',
        dueDate: joiningDate,
        status: 'Pending',
        priority: 'High',
        mandatory: true,
    });

    // Orientation tour (Week 1)
    if (joiningDate) {
        const tourDate = new Date(joiningDate);
        tourDate.setDate(tourDate.getDate() + 3);
        tasks.push({
            _id: `buddy_tour_${workflow._id}`,
            title: 'Office Orientation Tour',
            description: 'Show the new hire around the office, key facilities, and introduce to colleagues',
            taskType: 'orientation_tour',
            assigneeRole: 'buddy',
            dueDate: tourDate,
            status: 'Pending',
            priority: 'Medium',
            mandatory: true,
        });
    }

    // First week checkin
    if (joiningDate) {
        const checkinDate = new Date(joiningDate);
        checkinDate.setDate(checkinDate.getDate() + 5);
        tasks.push({
            _id: `buddy_week1_${workflow._id}`,
            title: 'First Week Check-in',
            description: 'Meet with the new hire to discuss their first week experience and address any concerns',
            taskType: 'first_week_checkin',
            assigneeRole: 'buddy',
            dueDate: checkinDate,
            status: 'Pending',
            priority: 'Medium',
            mandatory: true,
        });
    }

    // First month checkin
    if (joiningDate) {
        const monthCheckin = new Date(joiningDate);
        monthCheckin.setDate(monthCheckin.getDate() + 30);
        tasks.push({
            _id: `buddy_month1_${workflow._id}`,
            title: 'First Month Check-in',
            description: 'Monthly review to discuss progress, challenges, and goals',
            taskType: 'first_month_checkin',
            assigneeRole: 'buddy',
            dueDate: monthCheckin,
            status: 'Pending',
            priority: 'Medium',
            mandatory: true,
        });
    }

    return tasks;
}

/**
 * Complete a buddy task
 */
export async function completeBuddyTask(workflow, taskId, { completionNotes, rating, meetingScheduledDate }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled');
    }

    const buddyIdStr = String(actor._id);
    const assignedBuddyStr = String(workflow.assignedBuddy || '');

    // Find the task in workflow.tasks
    const taskIndex = (workflow.tasks || []).findIndex(
        (t) => String(t._id) === taskId && t.assigneeRole === 'buddy'
    );

    if (taskIndex === -1) {
        throw new Error('Buddy task not found or not assigned to you');
    }

    const task = workflow.tasks[taskIndex];
    
    // Verify assignment
    if (String(task.assignedTo || '') !== buddyIdStr && assignedBuddyStr !== buddyIdStr) {
        throw new Error('This task is not assigned to you');
    }

    // Update task
    workflow.tasks[taskIndex].status = 'Completed';
    workflow.tasks[taskIndex].completedDate = new Date();
    workflow.tasks[taskIndex].completionNotes = completionNotes || task.completionNotes;
    if (rating) workflow.tasks[taskIndex].rating = rating;
    if (meetingScheduledDate) workflow.tasks[taskIndex].meetingScheduledDate = meetingScheduledDate;

    // Add to activity feed
    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'buddy_task_completed',
        description: `Buddy completed task: ${task.title}`,
        actor: actor._id,
        actorName: actor.name,
        metadata: { taskId, taskTitle: task.title },
        createdAt: new Date(),
    });

    // Update buddy checkins if this is a checkin task
    if (workflow.buddyCheckins) {
        const checkinIndex = workflow.buddyCheckins.findIndex(
            (bc) => String(bc.taskId) === taskId
        );
        if (checkinIndex !== -1) {
            workflow.buddyCheckins[checkinIndex].status = 'Completed';
            workflow.buddyCheckins[checkinIndex].completedAt = new Date();
            workflow.buddyCheckins[checkinIndex].notes = completionNotes;
            if (rating) workflow.buddyCheckins[checkinIndex].rating = rating;
        }
    }

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Buddy Task Completion',
        actor,
        req,
        metadata: { taskId, taskTitle: task.title },
    });

    // Notify HR and manager
    await notify({
        type: 'lifecycle_buddy_task_completed',
        organizationId: workflow.organizationId,
        data: {
            workflowId: workflow._id,
            buddyId: actor._id,
            taskId,
            taskTitle: task.title,
        },
    }).catch(() => {});

    return workflow;
}

/**
 * Add a buddy checkin note
 */
export async function addBuddyCheckin(workflow, { notes, meetingDate, topicsDiscussed, concerns }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled');
    }

    workflow.buddyCheckins = workflow.buddyCheckins || [];
    
    const checkin = {
        _id: new mongoose.Types.ObjectId(),
        date: meetingDate || new Date(),
        buddyId: actor._id,
        buddyName: actor.name,
        notes,
        topicsDiscussed: topicsDiscussed || [],
        concerns: concerns || '',
        status: 'Completed',
        createdAt: new Date(),
    };

    workflow.buddyCheckins.push(checkin);

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'buddy_checkin_added',
        description: `Buddy added check-in notes`,
        actor: actor._id,
        actorName: actor.name,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Buddy Check-in',
        actor,
        req,
    });

    await notify({
        type: 'lifecycle_buddy_checkin_added',
        organizationId: workflow.organizationId,
        data: {
            workflowId: workflow._id,
            buddyId: actor._id,
        },
    }).catch(() => {});

    return workflow;
}

/**
 * Mark induction as complete by buddy
 */
export async function markInductionComplete(workflow, { feedback, rating, suggestions }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled');
    }

    const buddyIdStr = String(actor._id);
    if (String(workflow.assignedBuddy || '') !== buddyIdStr) {
        throw new Error('Only the assigned buddy can mark induction complete');
    }

    workflow.induction = workflow.induction || {};
    workflow.induction.buddyCompletion = {
        completedAt: new Date(),
        completedBy: actor._id,
        feedback,
        rating: rating || null,
        suggestions,
    };

    // Check if induction is now complete (HR + Buddy)
    const hrComplete = workflow.induction.hrCompletion?.completedAt;
    if (hrComplete) {
        workflow.induction.status = 'Completed';
        workflow.induction.completedAt = new Date();
    } else {
        workflow.induction.status = 'In Progress';
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'induction_buddy_complete',
        description: 'Buddy marked induction phase as complete',
        actor: actor._id,
        actorName: actor.name,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Induction Completion',
        actor,
        req,
    });

    await notify({
        type: 'lifecycle_induction_buddy_complete',
        organizationId: workflow.organizationId,
        data: {
            workflowId: workflow._id,
            buddyId: actor._id,
        },
    }).catch(() => {});

    return workflow;
}

/**
 * Provide onboarding feedback as buddy
 */
export async function submitBuddyFeedback(workflow, { overallRating, strengths, improvements, additionalComments }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled');
    }

    const buddyIdStr = String(actor._id);
    if (String(workflow.assignedBuddy || '') !== buddyIdStr) {
        throw new Error('Only the assigned buddy can submit feedback');
    }

    workflow.buddyFeedback = {
        submittedAt: new Date(),
        submittedBy: actor._id,
        overallRating,
        strengths,
        improvements,
        additionalComments,
    };

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'buddy_feedback_submitted',
        description: 'Buddy submitted onboarding feedback',
        actor: actor._id,
        actorName: actor.name,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Buddy Feedback',
        actor,
        req,
    });

    await notify({
        type: 'lifecycle_buddy_feedback_submitted',
        organizationId: workflow.organizationId,
        data: {
            workflowId: workflow._id,
            buddyId: actor._id,
        },
    }).catch(() => {});

    return workflow;
}

/**
 * Builduddy dashboard statistics
 */
export async function buildBuddyDashboard(organizationId, buddyEmployeeId) {
    const workflows = await getBuddyWorkflows(organizationId, buddyEmployeeId);
    
    const total = workflows.length;
    const active = workflows.filter((w) => w.status === 'In Progress').length;
    const completed = workflows.filter((w) => w.status === 'Completed').length;
    
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    
    const now = new Date();
    
    for (const wf of workflows) {
        const buddyTasks = getBuddyTasksForWorkflow(wf, buddyEmployeeId);
        totalTasks += buddyTasks.length;
        completedTasks += buddyTasks.filter((t) => t.status === 'Completed').length;
        overdueTasks += buddyTasks.filter((t) => 
            t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < now
        ).length;
    }

    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
        total,
        active,
        completed,
        totalTasks,
        completedTasks,
        overdueTasks,
        taskCompletionRate,
        recentWorkflows: workflows.slice(0, 5),
    };
}

/**
 * Upload document as buddy (e.g., induction checklist, meeting notes)
 */
export async function uploadBuddyDocument(workflow, { documentType, fileName, fileUrl, notes }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        throw new Error('Buddy program is disabled');
    }

    const buddyIdStr = String(actor._id);
    if (String(workflow.assignedBuddy || '') !== buddyIdStr) {
        throw new Error('Only the assigned buddy can upload documents');
    }

    workflow.buddyDocuments = workflow.buddyDocuments || [];
    workflow.buddyDocuments.push({
        documentType,
        fileName,
        fileUrl,
        uploadedBy: actor._id,
        uploadedAt: new Date(),
        notes,
    });

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'buddy_document_uploaded',
        description: `Buddy uploaded document: ${fileName}`,
        actor: actor._id,
        actorName: actor.name,
        metadata: { fileName, documentType },
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Buddy Document Upload',
        actor,
        req,
        metadata: { fileName, documentType },
    });

    return workflow;
}
