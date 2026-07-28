/**
 * Manager Experience Controller - My Onboarding, My Team, Buddy views
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getManagerOnboardingWorkflows,
    getManagerOffboardingWorkflows,
    getManagerDashboard,
    getManagerPendingTasks,
    completeManagerTask,
    getManagerBuddyAssignments,
    addManagerNote,
    getTeamLifecycleStatus,
} from '../../services/lifecycleManagerService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;

/**
 * GET /api/v1/both/lifecycle/manager/onboarding
 * Get manager's onboarding workflows (team members)
 */
export const getManagerOnboarding = async (req, res) => {
    try {
        const workflows = await getManagerOnboardingWorkflows(orgId(req), actor(req)?._id, req.query);
        return res.json({ success: true, data: workflows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/manager/offboarding
 * Get manager's offboarding workflows (team members leaving)
 */
export const getManagerOffboarding = async (req, res) => {
    try {
        const workflows = await getManagerOffboardingWorkflows(orgId(req), actor(req)?._id, req.query);
        return res.json({ success: true, data: workflows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/manager/dashboard
 * Get manager's dashboard statistics
 */
export const getManagerDashboardHandler = async (req, res) => {
    try {
        const dashboard = await getManagerDashboard(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: dashboard });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/manager/tasks
 * Get manager's pending tasks across all workflows
 */
export const getManagerTasks = async (req, res) => {
    try {
        const tasks = await getManagerPendingTasks(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: tasks });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/manager/workflows/:workflowId/tasks/:taskId/complete
 * Complete a manager task
 */
export const completeManagerTaskHandler = async (req, res) => {
    try {
        const workflow = await completeManagerTask(
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
 * GET /api/v1/both/lifecycle/manager/buddy-assignments
 * Get manager's buddy assignments
 */
export const getManagerBuddyAssignmentsHandler = async (req, res) => {
    try {
        const assignments = await getManagerBuddyAssignments(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: assignments });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/v1/both/lifecycle/manager/workflows/:workflowId/notes
 * Add manager note to workflow
 */
export const addManagerNoteHandler = async (req, res) => {
    try {
        const workflow = await addManagerNote(
            orgId(req),
            req.params.workflowId,
            { note: req.body.note, isPrivate: req.body.isPrivate, actor: actor(req), req }
        );
        return res.json({ success: true, data: workflow, message: 'Note added' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/both/lifecycle/manager/team-status
 * Get team members with their lifecycle status
 */
export const getTeamStatusHandler = async (req, res) => {
    try {
        const teamStatus = await getTeamLifecycleStatus(orgId(req), actor(req)?._id);
        return res.json({ success: true, data: teamStatus });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
