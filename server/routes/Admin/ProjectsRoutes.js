
import express from "express";
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import { 
    createProject, 
    deleteProject, 
    getAllProjects, 
    updateProject, 
    getAvailableManagers, 
    getProjectById,
    getProjectTemplates,
    updateProjectStatus,
    createProjectUpdate,
    getProjectUpdates
} from "../../controllers/admin/projectController.js";
import {
    getProjectDashboard,
    getProjectStatistics,
    getProjectProgress,
    getTeamPerformance,
    getBudgetAnalysis
} from "../../controllers/admin/projectDashboardController.js";
import {
    getProjectWorkItems,
    postProjectWorkItems,
    updateProjectWorkItem,
    deleteProjectWorkItem
} from "../../controllers/admin/projectWorkItemController.js";
import { addWorkItemComment } from "../../controllers/both/workItemCommentController.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";
import isProjectWorkspaceAuthenticated from "../../middlewares/isProjectWorkspaceAuthenticated.js";
import { projectLimiter } from "../../middlewares/endpointRateLimiters.js";
import { writeLimiter } from "../../middlewares/rateLimiter.js";
import { projectValidations } from "../../middlewares/inputValidation.js";

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PROJECTS));

// Get all projects (for dashboard - root endpoint) - with rate limiting
// Allow managers to view projects they manage or in their department
router.route("/")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getAllProjects);

// Get all projects (alternative endpoint for backward compatibility)
// Allow Admin, Managers, HR, and Executives (CEO) to view projects
router.route("/get-all-project")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getAllProjects);

// Built-in project templates (tasks / subtasks presets)
router.route("/templates")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectTemplates);

// Create new project - write operations have stricter limits
// Allow Admin, Managers, and HR to create projects
router.route("/create-project")
    .post(isProjectWorkspaceAuthenticated, writeLimiter, projectValidations.create, createProject);

// Update project - write operations have stricter limits
// Allow Admin, Managers, HR, and Executives (CEO) to update projects
router.route("/update-project/:id")
    .put(isProjectWorkspaceAuthenticated, writeLimiter, projectValidations.update, updateProject);

// Delete project - write operations have stricter limits
router.route("/delete-project/:id")
    .delete(isAdminAuthenticated, writeLimiter, projectValidations.getById, deleteProject);

// Get project by ID
// Allow managers to view projects they manage or in their department
router.route("/get-project/:id")
    .get(isProjectWorkspaceAuthenticated, projectValidations.getById, getProjectById);

// Project work breakdown (tasks / subtasks) — register before generic :id sub-routes if any conflict
router.route("/work-items/:workItemId/comments")
    .post(isProjectWorkspaceAuthenticated, writeLimiter, addWorkItemComment);

router.route("/work-items/:workItemId")
    .put(isProjectWorkspaceAuthenticated, writeLimiter, updateProjectWorkItem)
    .delete(isProjectWorkspaceAuthenticated, writeLimiter, deleteProjectWorkItem);

router.route("/:id/work-items")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectWorkItems)
    .post(isProjectWorkspaceAuthenticated, writeLimiter, postProjectWorkItems);

// Get available managers for project assignment
router.route("/get-managers")
    .get(isAdminAuthenticated, getAvailableManagers);

// Project leader routes - status update and daily updates
// Update project status (only by project leader)
router.route("/:id/update-status")
    .put(isProjectWorkspaceAuthenticated, writeLimiter, updateProjectStatus);

// Create daily project update (only by project leader)
router.route("/:id/updates")
    .post(isProjectWorkspaceAuthenticated, writeLimiter, createProjectUpdate)
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectUpdates);

// Project Dashboard routes
router.route("/dashboard")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectDashboard);

router.route("/dashboard/statistics")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectStatistics);

router.route("/dashboard/progress")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getProjectProgress);

router.route("/dashboard/team-performance")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getTeamPerformance);

router.route("/dashboard/budget-analysis")
    .get(isProjectWorkspaceAuthenticated, projectLimiter, getBudgetAnalysis);

export default router;