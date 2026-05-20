import express from "express";
import {
    getMyProjects,
    createTodayTask,
    updateTask,
    getMyTasks,
    getProjectTasks
} from "../../controllers/employee/employeeTaskController.js";
import {
    getEmployeeProjectWorkItems,
    updateEmployeeProjectWorkItem
} from "../../controllers/employee/employeeProjectWorkItemController.js";
import isAuthenticated from './../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from './../../middlewares/isAdminAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from './../../middlewares/isAdminOrManagerOrHRAuthenticated.js';

const router = express.Router();

// Root route - Get tasks (for dashboard)
// This endpoint is used by the frontend dashboard
router.get("/", isAuthenticated, getMyTasks);

// Employee routes
router.get("/get-my-projects", isAuthenticated, getMyProjects);
router.post("/create-task", isAuthenticated, createTodayTask);
router.put("/task-status/:taskId", isAuthenticated, updateTask);
router.get("/all-tasks", isAuthenticated, getMyTasks);

// Employee work plan (project_work_items) — read + limited update
router.get("/projects/:projectId/work-items", isAuthenticated, getEmployeeProjectWorkItems);
router.put("/work-items/:workItemId", isAuthenticated, updateEmployeeProjectWorkItem);

// Admin routes - Allow Admin, Managers, HR, and Executives (CEO) to view project tasks
router.get("/admin/projects/:projectId/tasks", isAdminOrManagerOrHRAuthenticated, getProjectTasks);

export default router;