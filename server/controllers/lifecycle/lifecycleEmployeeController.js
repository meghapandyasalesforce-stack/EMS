/**
 * Employee Experience Controller - Self view, Buddy employees, tasks, forms
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getEmployeeOnboardingWorkflow,
    getEmployeeOffboardingWorkflow,
    getEmployeeDashboard,
    getEmployeePendingTasks,
    completeEmployeeTask,
    getEmployeeBuddyAssignments,
    getEmployeePendingForms,
    getEmployeeCompletedForms,
    getEmployeeLifecycleSummary,
    updateEmployeeOnboardingTask,
    updateEmployeeOnboardingChecklist,
    updateEmployeeOnboardingAsset,
    updateEmployeeOnboardingTraining,
    signEmployeePolicy,
    updateEmployeeBuddyCheckin,
    addEmployeeNote,
    updateEmployeeOffboardingTask,
    updateEmployeeOffboardingChecklist,
    updateEmployeeOffboardingAsset,
    updateEmployeeKnowledgeTransfer,
    updateEmployeeExitInterview,
    updateEmployeeAccessRevocation,
} from '../../services/lifecycleEmployeeService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

/**
 * GET /api/v1/both/lifecycle/employee/onboarding
 * Get employee's own onboarding workflow
 */
export const getEmployeeOnboardingHandler = async (req, res) => {
    try {
        const employeeId = actor(req)?._id;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Employee ID not found in request' });
        }
        const workflow = await getEmployeeOnboardingWorkflow(orgId(req), employeeId);
        return res.json({ success: true, data: workflow });
    } catch (error) {
        console.error('Error loading onboarding data:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/offboarding
 * Get employee's own offboarding workflow
 */
export const getEmployeeOffboardingHandler = async (req, res) => {
    try {
        const employeeId = actor(req)?._id;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Employee ID not found in request' });
        }
        const workflow = await getEmployeeOffboardingWorkflow(orgId(req), employeeId);
        return res.json({ success: true, data: workflow });
    } catch (error) {
        console.error('Error loading offboarding data:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/dashboard
 * Get employee's dashboard
 */
export const getEmployeeDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getEmployeeDashboard(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/tasks
 * Get employee's pending tasks
 */
export const getEmployeeTasksHandler = async (req, res) => {
    try {
        const tasks = await getEmployeePendingTasks(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/employee/workflows/:workflowId/tasks/:taskId/complete
 * Complete an employee task
 */
export const completeEmployeeTaskHandler = async (req, res) => {
    try {
        const workflow = await completeEmployeeTask(
            orgId(req),
            req.params.workflowId,
            req.params.taskId,
            { notes: req.body.notes, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Task completed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/buddy-assignments
 * Get employee's buddy assignments (if they are a buddy)
 */
export const getEmployeeBuddyAssignmentsHandler = async (req, res) => {
    try {
        const assignments = await getEmployeeBuddyAssignments(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: assignments });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/forms/pending
 * Get employee's pending forms
 */
export const getEmployeePendingFormsHandler = async (req, res) => {
    try {
        const forms = await getEmployeePendingForms(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: forms });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/forms/completed
 * Get employee's completed forms
 */
export const getEmployeeCompletedFormsHandler = async (req, res) => {
    try {
        const forms = await getEmployeeCompletedForms(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: forms });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/employee/summary
 * Get employee's lifecycle summary
 */
export const getEmployeeSummaryHandler = async (req, res) => {
    try {
        const summary = await getEmployeeLifecycleSummary(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: summary });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Enhanced Onboarding Endpoints
export const updateEmployeeOnboardingTaskHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOnboardingTask(
            orgId(req),
            req.params.workflowId,
            req.params.taskId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Task updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeOnboardingChecklistHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOnboardingChecklist(
            orgId(req),
            req.params.workflowId,
            req.params.itemId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Checklist updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeOnboardingAssetHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOnboardingAsset(
            orgId(req),
            req.params.workflowId,
            req.params.assetId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Asset updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeOnboardingTrainingHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOnboardingTraining(
            orgId(req),
            req.params.workflowId,
            req.params.trainingId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Training updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const signEmployeePolicyHandler = async (req, res) => {
    try {
        const workflow = await signEmployeePolicy(
            orgId(req),
            req.params.workflowId,
            req.params.signatureId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Policy signed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeBuddyCheckinHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeBuddyCheckin(
            orgId(req),
            req.params.workflowId,
            req.params.checkinId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Buddy checkin updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const addEmployeeNoteHandler = async (req, res) => {
    try {
        const workflow = await addEmployeeNote(
            orgId(req),
            req.params.workflowId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Note added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// Enhanced Offboarding Endpoints
export const updateEmployeeOffboardingTaskHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOffboardingTask(
            orgId(req),
            req.params.workflowId,
            req.params.taskId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Task updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeOffboardingChecklistHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOffboardingChecklist(
            orgId(req),
            req.params.workflowId,
            req.params.itemId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Checklist updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeOffboardingAssetHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeOffboardingAsset(
            orgId(req),
            req.params.workflowId,
            req.params.assetId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Asset updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeKnowledgeTransferHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeKnowledgeTransfer(
            orgId(req),
            req.params.workflowId,
            req.params.transferId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Knowledge transfer updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeExitInterviewHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeExitInterview(
            orgId(req),
            req.params.workflowId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Exit interview updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateEmployeeAccessRevocationHandler = async (req, res) => {
    try {
        const workflow = await updateEmployeeAccessRevocation(
            orgId(req),
            req.params.workflowId,
            req.params.accessId,
            { ...req.body, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Access revocation updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};
