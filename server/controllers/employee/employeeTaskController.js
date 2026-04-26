import Task from "../../models/task.model.js";
import Project from "../../models/project.model.js";
import ProjectUpdate from "../../models/projectUpdate.model.js";
import Employee from "../../models/employee.model.js";
import { sendTaskUpdateNotification } from "../../helpers/notificationService.js";
import { sendSuccess, sendError, sendForbidden, sendInternalError } from "../../helpers/responseHelper.js";
import { addOrganizationFilter, getOrganizationId } from "../../helpers/organizationHelper.js";
import { getManagerEmployeeIds } from "../../helpers/managerHelper.js";
import logger from "../../helpers/logger.js";

// Get all projects for the logged-in employee
export const getMyProjects = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);

        // Keep this endpoint organization-scoped for reliable progress calculations.
        const projectQuery = addOrganizationFilter(req, {
            $or: [
                { projectLeader: employeeId },
                { projectMembers: employeeId }
            ]
        });

        const projects = await Project.find(projectQuery)
        .populate('projectLeader', 'name email')
        .populate('projectMembers', 'name email');

        if (!projects.length) {
            return sendSuccess(res, { projects: [] }, 'Projects retrieved successfully');
        }

        const projectIds = projects.map((p) => p._id);

        // Task progress fallback: completed tasks / total tasks.
        const taskQuery = addOrganizationFilter(req, {
            project: { $in: projectIds }
        });
        const tasks = await Task.find(taskQuery).select('project status').lean();

        // Update-based progress: latest update wins when available.
        const updatesQuery = addOrganizationFilter(req, {
            projectId: { $in: projectIds }
        });
        const updates = await ProjectUpdate.find(updatesQuery)
            .select('projectId progress updateDate')
            .sort({ updateDate: -1 })
            .lean();

        const taskStatsByProject = new Map();
        tasks.forEach((task) => {
            const projectId = task.project?.toString();
            if (!projectId) return;
            const current = taskStatsByProject.get(projectId) || { total: 0, completed: 0 };
            current.total += 1;
            if (String(task.status || '').toLowerCase() === 'completed') {
                current.completed += 1;
            }
            taskStatsByProject.set(projectId, current);
        });

        const latestUpdateProgressByProject = new Map();
        updates.forEach((update) => {
            const projectId = update.projectId?.toString();
            if (!projectId || latestUpdateProgressByProject.has(projectId)) return;
            if (typeof update.progress === 'number' && Number.isFinite(update.progress)) {
                latestUpdateProgressByProject.set(projectId, Math.max(0, Math.min(100, update.progress)));
            }
        });

        const projectsWithProgress = projects.map((projectDoc) => {
            const project = projectDoc.toObject();
            const pid = projectDoc._id.toString();
            const stats = taskStatsByProject.get(pid) || { total: 0, completed: 0 };
            const taskProgress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            const updateProgress = latestUpdateProgressByProject.get(pid);

            let overallProgress = typeof updateProgress === 'number' ? updateProgress : taskProgress;
            if (String(project.status || '').toLowerCase() === 'completed') {
                overallProgress = 100;
            }

            project.progress = Math.round(overallProgress);
            project.taskProgress = Math.round(taskProgress);
            project.updateProgress = typeof updateProgress === 'number' ? Math.round(updateProgress) : null;
            project.totalTasks = stats.total;
            project.completedTasks = stats.completed;
            project.organizationId = organizationId || project.organizationId;
            return project;
        });

        return sendSuccess(res, { projects: projectsWithProgress }, 'Projects retrieved successfully');
    } catch (error) {
        logger.error('Error fetching projects', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to fetch projects', error);
    }
};

// Create a new task for today
export const createTodayTask = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);
        const { projectId, taskDescription } = req.body;

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'ORG_ID_MISSING');
        }

        // Validate the employee is part of the project
        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { projectLeader: employeeId },
                { projectMembers: employeeId }
            ]
        });

        if (!project) {
            return sendForbidden(res, 'You are not part of this project or project does not exist');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if task already exists for today
        const existingTask = await Task.findOne({
            employee: employeeId,
            project: projectId,
            date: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        if (existingTask) {
            return sendError(res, 'You already have a task for today in this project. Please update it instead.', 400, 'TASK_EXISTS');
        }

        const newTask = new Task({
            organizationId,
            employee: employeeId,
            project: projectId,
            taskDescription,
            status: 'Not Started'
        });

        await newTask.save();

        const populatedTask = await Task.findById(newTask._id)
            .populate('project', 'name')
            .populate('employee', 'name email');

        // Send notification for task creation
        const employee = await Employee.findById(employeeId);
        if (employee) {
            await sendTaskUpdateNotification(populatedTask, employee, 'created');
        }

        return sendSuccess(res, { task: populatedTask }, 'Task created successfully', 201);
    } catch (error) {
        logger.error('Error creating task', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to create task', error);
    }
};

// Update task status or description
export const updateTask = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { taskId } = req.params;
        const { taskDescription, status, comments } = req.body;

        const task = await Task.findOne({
            _id: taskId,
            employee: employeeId
        });

        if (!task) {
            return res.status(404).json({ 
                error: 'Task not found or you are not authorized to update it' 
            });
        }

        // Only allow updates to today's task
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        if (task.date < today || task.date >= tomorrow) {
            return res.status(400).json({ 
                error: 'You can only update tasks for today' 
            });
        }

        // Store old task state for notification
        const oldTask = {
            taskDescription: task.taskDescription,
            status: task.status,
            comments: task.comments
        };

        if (taskDescription) task.taskDescription = taskDescription;
        if (status) task.status = status;
        if (comments) task.comments = comments;

        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('project', 'name')
            .populate('employee', 'name email');

        // Send notification for task update
        const employee = await Employee.findById(employeeId);
        if (employee) {
            const updateType = status === 'Completed' ? 'completed' : 'updated';
            await sendTaskUpdateNotification(populatedTask, employee, updateType, oldTask);
        }

        return sendSuccess(res, { task: populatedTask }, 'Task updated successfully');
    } catch (error) {
        logger.error('Error updating task', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to update task', error);
    }
};

// Get all tasks for the logged-in employee
// For managers, returns tasks from their department team members
export const getMyTasks = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { date, projectId, status } = req.query;

        // Get organizationId for multi-tenancy
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Organization ID is required'
            });
        }

        // Add organization filter
        let filter = addOrganizationFilter(req, {});
        
        // Check if user is a manager (not admin or HR)
        // Example: Manager "Arun Kumar" sees tasks for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        
        if (isManager && req.employee) {
            // Manager: Get tasks from all employees linked to them
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            filter.employee = { $in: managerEmployeeIds };
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering tasks by manager field', {
                managerId: employeeId,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        } else {
            // Regular employee: Only their own tasks
            filter.employee = employeeId;
        }

        if (date) {
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);
            
            filter.date = {
                $gte: selectedDate,
                $lt: nextDay
            };
        }

        if (projectId) filter.project = projectId;
        if (status) filter.status = status;

        const tasks = await Task.find(filter)
            .populate('project', 'name')
            .populate('employee', 'name email department')
            .sort({ date: -1 });

        res.json({
            success: true,
            tasks
        });
    } catch (error) {
        logger.error('Get My Tasks Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch tasks', 
            details: error.message 
        });
    }
};

// Admin: Get all tasks for a specific project
export const getProjectTasks = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { date, employeeId, status } = req.query;

        const filter = { project: projectId };

        if (date) {
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);
            
            filter.date = {
                $gte: selectedDate,
                $lt: nextDay
            };
        }

        if (employeeId) filter.employee = employeeId;
        if (status) filter.status = status;

        const tasks = await Task.find(filter)
            .populate('project', 'name')
            .populate('employee', 'name email')
            .sort({ date: -1 });

        res.json({
            success: true,
            tasks
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch project tasks', 
            details: error.message 
        });
    }
};