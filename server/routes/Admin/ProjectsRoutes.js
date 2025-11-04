
import express from "express";
import { 
    createProject, 
    deleteProject, 
    getAllProjects, 
    updateProject, 
    getAvailableManagers, 
    getProjectById 
} from "../../controllers/admin/projectController.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";

const router = express.Router();

// Get all projects
router.route("/get-all-project")
    .get(isAdminAuthenticated, getAllProjects);

// Create new project
router.route("/create-project")
    .post(isAdminAuthenticated, createProject);

// Update project
router.route("/update-project/:id")
    .put(isAdminAuthenticated, updateProject);

// Delete project
router.route("/delete-project/:id")
    .delete(isAdminAuthenticated, deleteProject);

// Get project by ID
router.route("/get-project/:id")
    .get(isAdminAuthenticated, getProjectById);

// Get available managers for project assignment
router.route("/get-managers")
    .get(isAdminAuthenticated, getAvailableManagers);

export default router;