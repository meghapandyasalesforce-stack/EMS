/**
 * Buddy Module Controller - Dedicated buddy dashboard and task management
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { OnboardingWorkflow } from '../../models/onboarding.model.js';
import {
    getBuddyWorkflows,
    getBuddyTasksForWorkflow,
    completeBuddyTask,
    addBuddyCheckin,
    markInductionComplete,
    submitBuddyFeedback,
    buildBuddyDashboard,
    uploadBuddyDocument,
} from '../../services/lifecycleBuddyService.js';
import { resolveEmployeeIdFromRequest } from '../../services/onboardingService.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

async function loadWorkflow(organizationId, workflowId) {
    const workflow = await OnboardingWorkflow.findOne({
        _id: workflowId,
        organizationId,
        isTemplate: { $ne: true },
    })
        .populate('employeeId', 'name lastName email department jobTitle profilePicture')
        .populate('assignedManager', 'name lastName email')
        .populate('assignedHR', 'name lastName email');
    
    if (!workflow) {
        const error = new Error('Onboarding workflow not found');
        error.statusCode = 404;
        throw error;
    }
    return workflow;
}

/**
 * GET /api/v1/both/lifecycle/buddy/dashboard
 * Get buddy dashboard with assigned workflows and statistics
 */
export const getBuddyDashboard = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const dashboard = await buildBuddyDashboard(organizationId, employeeId);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/buddy/workflows
 * Get all workflows where the current user is assigned as buddy
 */
export const getBuddyWorkflowsHandler = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflows = await getBuddyWorkflows(organizationId, employeeId);
        return res.json({ success: true, data: workflows });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/buddy/workflows/:workflowId
 * Get a specific workflow with buddy-specific tasks
 */
export const getBuddyWorkflowDetail = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        // Verify buddy assignment
        const buddyIdStr = String(employeeId);
        const assignedBuddyStr = String(workflow.assignedBuddy || '');
        const hasBuddyTask = (workflow.tasks || []).some(
            (t) => t.assigneeRole === 'buddy' && String(t.assignedTo || '') === buddyIdStr
        );

        if (assignedBuddyStr !== buddyIdStr && !hasBuddyTask) {
            return res.status(403).json({ success: false, message: 'You are not assigned as buddy for this workflow' });
        }

        const buddyTasks = getBuddyTasksForWorkflow(workflow, employeeId);
        
        return res.json({
            success: true,
            data: {
                workflow,
                buddyTasks,
                isAssignedBuddy: assignedBuddyStr === buddyIdStr,
            },
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/buddy/workflows/:workflowId/tasks/:taskId/complete
 * Complete a buddy task
 */
export const postCompleteBuddyTask = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        const updatedWorkflow = await completeBuddyTask(
            workflow,
            req.params.taskId,
            {
                ...req.body,
            },
            { actor: actor(req), req }
        );

        await workflow.save();
        
        return res.json({
            success: true,
            data: updatedWorkflow,
            message: 'Buddy task completed',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/buddy/workflows/:workflowId/checkin
 * Add a buddy check-in note
 */
export const postBuddyCheckin = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        const updatedWorkflow = await addBuddyCheckin(
            workflow,
            req.body,
            { actor: actor(req), req }
        );

        await workflow.save();
        
        return res.json({
            success: true,
            data: updatedWorkflow,
            message: 'Buddy check-in added',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/buddy/workflows/:workflowId/induction/complete
 * Mark induction as complete by buddy
 */
export const postMarkInductionComplete = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        const updatedWorkflow = await markInductionComplete(
            workflow,
            req.body,
            { actor: actor(req), req }
        );

        await workflow.save();
        
        return res.json({
            success: true,
            data: updatedWorkflow,
            message: 'Induction marked as complete',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/buddy/workflows/:workflowId/feedback
 * Submit onboarding feedback as buddy
 */
export const postBuddyFeedback = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        const updatedWorkflow = await submitBuddyFeedback(
            workflow,
            req.body,
            { actor: actor(req), req }
        );

        await workflow.save();
        
        return res.json({
            success: true,
            data: updatedWorkflow,
            message: 'Buddy feedback submitted',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/buddy/workflows/:workflowId/documents
 * Upload document as buddy
 */
export const postBuddyDocumentUpload = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        const updatedWorkflow = await uploadBuddyDocument(
            workflow,
            req.body,
            { actor: actor(req), req }
        );

        await workflow.save();
        
        return res.json({
            success: true,
            data: updatedWorkflow,
            message: 'Buddy document uploaded',
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/buddy/workflows/:workflowId/tasks
 * Get buddy-specific tasks for a workflow
 */
export const getBuddyTasks = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const employeeId = await resolveEmployeeIdFromRequest(req);
        
        if (!employeeId) {
            return res.status(401).json({ success: false, message: 'Employee profile not found' });
        }

        const workflow = await loadWorkflow(organizationId, req.params.workflowId);
        
        // Verify buddy assignment
        const buddyIdStr = String(employeeId);
        const assignedBuddyStr = String(workflow.assignedBuddy || '');
        const hasBuddyTask = (workflow.tasks || []).some(
            (t) => t.assigneeRole === 'buddy' && String(t.assignedTo || '') === buddyIdStr
        );

        if (assignedBuddyStr !== buddyIdStr && !hasBuddyTask) {
            return res.status(403).json({ success: false, message: 'You are not assigned as buddy for this workflow' });
        }

        const buddyTasks = getBuddyTasksForWorkflow(workflow, employeeId);
        
        return res.json({ success: true, data: buddyTasks });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};
