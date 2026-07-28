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
import { addWorkItemComment } from "../../controllers/both/workItemCommentController.js";
import isAuthenticated from './../../middlewares/isAuthenticated.js';
import isProjectWorkspaceAuthenticated from './../../middlewares/isProjectWorkspaceAuthenticated.js';

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
router.post("/work-items/:workItemId/comments", isAuthenticated, addWorkItemComment);

// Admin routes — project managers, managers, HR, admins
router.get("/admin/projects/:projectId/tasks", isProjectWorkspaceAuthenticated, getProjectTasks);

export default router;