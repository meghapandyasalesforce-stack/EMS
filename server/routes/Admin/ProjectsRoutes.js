
import express from "express";
import { 
    createProject, 
    deleteProject, 
    getAllProjects, 
    updateProject, 
    getAvailableManagers, 
    getProjectById,
    updateProjectStatus,
    createProjectUpdate,
    getProjectUpdates
} from "../../controllers/admin/projectController.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";
import isAdminOrManagerOrHRAuthenticated from "../../middlewares/isAdminOrManagerOrHRAuthenticated.js";
import isAdminOrExecutiveAuthenticated from "../../middlewares/isAdminOrExecutiveAuthenticated.js";
import { projectLimiter } from "../../middlewares/endpointRateLimiters.js";
import { writeLimiter } from "../../middlewares/rateLimiter.js";
import { projectValidations } from "../../middlewares/inputValidation.js";

const router = express.Router();

// Get all projects (for dashboard - root endpoint) - with rate limiting
// Allow managers to view projects they manage or in their department
router.route("/")
    .get(isAdminOrManagerOrHRAuthenticated, projectLimiter, getAllProjects);

// Get all projects (alternative endpoint for backward compatibility)
// Allow Admin, Managers, HR, and Executives (CEO) to view projects
router.route("/get-all-project")
    .get(isAdminOrManagerOrHRAuthenticated, projectLimiter, getAllProjects);

// Create new project - write operations have stricter limits
// Allow Admin, Managers, and HR to create projects
router.route("/create-project")
    .post(isAdminOrManagerOrHRAuthenticated, writeLimiter, projectValidations.create, createProject);

// Update project - write operations have stricter limits
// Allow Admin, Managers, HR, and Executives (CEO) to update projects
router.route("/update-project/:id")
    .put(isAdminOrManagerOrHRAuthenticated, writeLimiter, projectValidations.update, updateProject);

// Delete project - write operations have stricter limits
router.route("/delete-project/:id")
    .delete(isAdminAuthenticated, writeLimiter, projectValidations.getById, deleteProject);

// Get project by ID
// Allow managers to view projects they manage or in their department
router.route("/get-project/:id")
    .get(isAdminOrManagerOrHRAuthenticated, projectValidations.getById, getProjectById);

// Get available managers for project assignment
router.route("/get-managers")
    .get(isAdminAuthenticated, getAvailableManagers);

// Project leader routes - status update and daily updates
// Update project status (only by project leader)
router.route("/:id/update-status")
    .put(isAdminOrManagerOrHRAuthenticated, writeLimiter, updateProjectStatus);

// Create daily project update (only by project leader)
router.route("/:id/updates")
    .post(isAdminOrManagerOrHRAuthenticated, writeLimiter, createProjectUpdate)
    .get(isAdminOrManagerOrHRAuthenticated, projectLimiter, getProjectUpdates);

export default router;