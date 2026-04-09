import Project from "../../models/project.model.js";
import ProjectUpdate from "../../models/projectUpdate.model.js";
import Employee from "../../models/employee.model.js";
import logger from "../../helpers/logger.js";
import { getOrganizationId } from "../../helpers/organizationHelper.js";
import { getManagerEmployeeIds } from "../../helpers/managerHelper.js";

// Helper function to get employees with Manager role
const getManagersOnly = async () => {
    return await Employee.find({ 
        position: 'Manager',
        status: 'active'
    }).select('name email employeeId position department');
};

// Helper function to validate if employees are managers
const validateManagers = async (employeeIds) => {
    logger.debug('Validating managers', { employeeIds });
    
    const managers = await Employee.find({
        _id: { $in: employeeIds },
        position: 'Manager',
        status: 'active'
    }).select('_id name position status');
    
    logger.debug('Found managers', { count: managers.length, managerIds: managers.map(m => m._id.toString()) });
    
    const invalidIds = employeeIds.filter(id => 
        !managers.some(manager => manager._id.toString() === id.toString())
    );
    
    if (invalidIds.length > 0) {
        logger.warn('Invalid manager IDs found', { invalidIds });
    }
    
    return {
        validManagers: managers,
        invalidIds: invalidIds
    };
};

// Helper function to check if user is CEO
const isCEO = (req) => {
    if (req.user && req.user.role === 'admin') {
        // Admin can see cost data (for now, can be restricted if needed)
        return true;
    }
    if (req.employee) {
        const position = (req.employee.position || '').toLowerCase().trim();
        return position === 'ceo' || position.includes('chief executive');
    }
    return false;
};

// Get all projects with populated leader and members (Paginated & Optimized)
export const getAllProjects = async (req, res) => {
    try {
        const { parsePagination, parseSort, sendPaginatedResponse } = await import('../../helpers/paginationHelper.js');
        const { addOrganizationFilter } = await import('../../helpers/organizationHelper.js');
        
        // Parse pagination
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
        const sort = parseSort(req, '-createdAt');
        
        // Build query with organization filter
        const query = addOrganizationFilter(req, {});
        
        // Check if user is CEO (for cost data visibility)
        const userIsCEO = isCEO(req);
        
        // If user is a manager (not admin or HR), filter by manager field or projects they manage
        // Example: Manager "Arun Kumar" sees projects with employees linked to them (manager="Arun Kumar" or "Arun")
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerId = req.employee._id;
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            
            // Get all employees linked to this manager
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, req.organizationId, req.employee);
            
            // Filter projects where:
            // 1. Manager is the project leader, OR
            // 2. Manager is a project member, OR
            // 3. Project leader or members are linked to this manager
            query.$or = [
                { projectLeader: managerId },
                { projectMembers: managerId },
                { projectLeader: { $in: managerEmployeeIds } },
                { projectMembers: { $in: managerEmployeeIds } }
            ];
            
            logger.info('Manager filtering projects by manager field', {
                managerId: managerId,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        }
        
        // Execute optimized query with pagination
        const [projects, total] = await Promise.all([
            Project.find(query)
                .select('-__v')
                .populate('projectLeader', 'name email role')
                .populate('projectMembers', 'name email role')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Project.countDocuments(query)
        ]);
        
        // Remove cost data if user is not CEO
        const projectsWithCostControl = projects.map(project => {
            if (!userIsCEO) {
                // Remove cost fields for non-CEO users
                const { budget, actualCost, revenue, currency, ...projectWithoutCost } = project;
                return projectWithoutCost;
            }
            return project;
        });
        
        return sendPaginatedResponse(res, projectsWithCostControl, page, limit, total, 'Projects retrieved successfully');
    } catch (error) {
        logger.error('Get All Projects Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch projects', 
            details: error.message 
        });
    }
};

// Create a new project with validation
export const createProject = async (req, res) => {
    try {
        logger.info('Create project request', {
            projectName: req.body.name,
            projectLeader: req.body.projectLeader,
            memberCount: req.body.projectMembers?.length || 0
        });
        
        const { name, description, projectLeader, projectMembers, status, priority, startDate, endDate, budget, actualCost, revenue, currency, tags, category } = req.body;

        // Validate required fields
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        
        if (!projectLeader) {
            return res.status(400).json({ error: 'Project leader is required' });
        }
        
        if (!status) {
            return res.status(400).json({ error: 'Project status is required' });
        }

        // Validate dates
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }
        }

        // Validate project leader exists
        const leaderExists = await Employee.exists({ _id: projectLeader });
        if (!leaderExists) {
            return res.status(400).json({ error: 'Project leader not found' });
        }

        // Validate that project members exist (allow any active employee)
        if (projectMembers && projectMembers.length > 0) {
            logger.debug('Validating project members', { 
                memberCount: projectMembers.length,
                memberIds: projectMembers 
            });
            
            // Check if all project members exist and are active
            // Check both status field and active field for compatibility
            const existingMembers = await Employee.find({ 
                _id: { $in: projectMembers },
                $or: [
                    { status: 'active' },
                    { active: true }
                ]
            }).select('_id name email position status active');
            
            logger.debug('Existing active members found', { 
                count: existingMembers.length,
                memberIds: existingMembers.map(emp => emp._id.toString())
            });
            
            const existingIds = existingMembers.map(emp => emp._id.toString());
            const invalidIds = projectMembers.filter(id => !existingIds.includes(id.toString()));
            
            if (invalidIds.length > 0) {
                logger.warn('Invalid project member IDs', { invalidIds });
                // Get details of invalid employees for better error message
                const invalidEmployees = await Employee.find({ 
                    _id: { $in: invalidIds } 
                }).select('_id name email position status');
                
                logger.debug('Invalid employees details', { invalidEmployees });
                
                return res.status(400).json({ 
                    error: 'Some project members not found or inactive',
                    invalidIds: invalidIds,
                    invalidEmployees: invalidEmployees,
                    message: 'The following employee IDs are invalid or inactive:'
                });
            }
        }

        // Get organizationId from request (set by organizationHelper middleware)
        const organizationId = getOrganizationId(req);
        
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        const newProject = new Project({
            organizationId,
            name: name.trim(),
            description: description?.trim() || undefined,
            projectLeader,
            projectMembers: projectMembers || [],
            status,
            priority: priority || 'medium',
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            budget: budget || 0,
            actualCost: actualCost || 0,
            revenue: revenue || 0,
            currency: currency || 'USD',
            tags: tags || [],
            category: category || undefined
        });

        await newProject.save();
        
        // Return populated project data
        const populatedProject = await Project.findById(newProject._id)
            .populate('projectLeader', 'name email position department')
            .populate('projectMembers', 'name email position department');

        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            project: populatedProject
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to create project',
            details: error.message 
        });
    }
};

// Update a project with validation
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, projectLeader, projectMembers, status, description, priority, startDate, endDate, budget, actualCost, revenue, currency, tags, category } = req.body;

        logger.info('Update project request', {
            projectId: id,
            projectName: name,
            projectLeader,
            memberCount: projectMembers?.length || 0
        });

        // Validate leader if being updated
        if (projectLeader) {
            const leaderExists = await Employee.exists({ _id: projectLeader });
            logger.debug('Leader exists check', { leaderExists, projectLeader });
            if (!leaderExists) {
                logger.warn('New project leader not found', { projectLeader });
                return res.status(400).json({ error: 'New project leader not found' });
            }
        }

        // Validate that project members exist and are active (allow any employee)
        if (projectMembers && projectMembers.length > 0) {
            logger.debug('Validating project members for update', { 
                memberCount: projectMembers.length,
                memberIds: projectMembers 
            });
            
            // Check if all project members exist and are active
            // Check both status field and active field for compatibility
            const existingMembers = await Employee.find({ 
                _id: { $in: projectMembers },
                $or: [
                    { status: 'active' },
                    { active: true }
                ]
            }).select('_id name email position status active');
            
            logger.debug('Existing active members found', { 
                count: existingMembers.length,
                memberIds: existingMembers.map(emp => emp._id.toString())
            });
            
            const existingIds = existingMembers.map(emp => emp._id.toString());
            const invalidIds = projectMembers.filter(id => !existingIds.includes(id.toString()));
            
            if (invalidIds.length > 0) {
                logger.warn('Invalid project member IDs', { invalidIds });
                // Get details of invalid employees for better error message
                const invalidEmployees = await Employee.find({ 
                    _id: { $in: invalidIds } 
                }).select('_id name email position status');
                
                logger.debug('Invalid employees details', { invalidEmployees });
                
                return res.status(400).json({ 
                    error: 'Some project members not found or inactive',
                    invalidIds: invalidIds,
                    invalidEmployees: invalidEmployees,
                    message: 'The following employee IDs are invalid or inactive:'
                });
            }
        }

        const updateData = {
            name,
            ...(projectLeader && { projectLeader }),
            ...(projectMembers && { projectMembers }),
            status,
            ...(description !== undefined && { description }),
            ...(priority && { priority }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            ...(budget !== undefined && { budget }),
            ...(actualCost !== undefined && { actualCost }),
            ...(revenue !== undefined && { revenue }),
            ...(currency && { currency }),
            ...(tags && { tags }),
            ...(category !== undefined && { category }),
            updatedAt: Date.now()
        };

        const updatedProject = await Project.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        ).populate('projectLeader', 'name email position department')
         .populate('projectMembers', 'name email position department');

        if (!updatedProject) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            project: updatedProject
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to update project',
            details: error.message 
        });
    }
};

// Delete a project
export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProject = await Project.findByIdAndDelete(id);
        
        if (!deletedProject) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json({ 
            success: true,
            message: 'Project deleted successfully',
            deletedProject 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to delete project',
            details: error.message 
        });
    }
};

// Get available managers for project assignment
export const getAvailableManagers = async (req, res) => {
    try {
        const managers = await getManagersOnly();
        
        res.status(200).json({
            success: true,
            message: 'Available managers retrieved successfully',
            managers: managers,
            count: managers.length
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch managers',
            details: error.message 
        });
    }
};

// Get project by ID with populated data
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const project = await Project.findById(id)
            .populate('projectLeader', 'name email position department employeeId')
            .populate('projectMembers', 'name email position department employeeId');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is CEO (for cost data visibility)
        const userIsCEO = isCEO(req);

        // If user is a manager (not admin or HR), verify access
        // Example: Manager "Arun Kumar" can only view projects with employees linked to them
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerId = req.employee._id;
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            
            // Get employees linked to this manager
            const organizationId = req.organizationId || req.employee.organizationId;
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
            const managerEmployeeIdStrings = managerEmployeeIds.map(id => id.toString());
            
            // Check if manager has access to this project
            const hasAccess = 
                project.projectLeader?._id?.toString() === managerId?.toString() ||
                project.projectMembers?.some(member => member._id?.toString() === managerId?.toString()) ||
                managerEmployeeIdStrings.includes(project.projectLeader?._id?.toString()) ||
                project.projectMembers?.some(member => managerEmployeeIdStrings.includes(member._id?.toString()));
            
            if (!hasAccess) {
                logger.warn('Manager trying to access project outside their scope', {
                    managerId: managerId,
                    managerName: managerName,
                    projectId: id
                });
                return res.status(403).json({ 
                    success: false,
                    error: 'You do not have access to this project. You can only view projects you manage or projects with employees linked to you.' 
                });
            }
        }

        // Remove cost data if user is not CEO
        let projectData = project.toObject ? project.toObject() : project;
        if (!userIsCEO) {
            const { budget, actualCost, revenue, currency, ...projectWithoutCost } = projectData;
            projectData = projectWithoutCost;
        }

        res.status(200).json({
            success: true,
            project: projectData
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch project',
            details: error.message 
        });
    }
};

// Update project status (only by project leader)
export const updateProjectStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user?._id || req.employee?._id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate status
        const validStatuses = ['pending', 'in-progress', 'completed', 'on-hold'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be one of: pending, in-progress, completed, on-hold' });
        }

        // Get project
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is the project leader
        const isProjectLeader = project.projectLeader?.toString() === userId.toString();
        if (!isProjectLeader) {
            return res.status(403).json({ 
                error: 'Only the project leader can update the project status' 
            });
        }

        // Update project status
        project.status = status;
        project.updatedAt = Date.now();
        await project.save();

        // Return populated project
        const updatedProject = await Project.findById(id)
            .populate('projectLeader', 'name email position department employeeId')
            .populate('projectMembers', 'name email position department employeeId');

        logger.info('Project status updated by leader', {
            projectId: id,
            newStatus: status,
            leaderId: userId
        });

        res.status(200).json({
            success: true,
            message: 'Project status updated successfully',
            project: updatedProject
        });
    } catch (error) {
        logger.error('Update Project Status Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            error: 'Failed to update project status',
            details: error.message 
        });
    }
};

// Create a daily project update (only by project leader)
export const createProjectUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { update, updateDate, status, progress, blockers, nextSteps } = req.body;
        const userId = req.user?._id || req.employee?._id;
        const organizationId = getOrganizationId(req);
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!update || !update.trim()) {
            return res.status(400).json({ error: 'Update content is required' });
        }

        // Get project
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is the project leader
        const isProjectLeader = project.projectLeader?.toString() === userId.toString();
        if (!isProjectLeader) {
            return res.status(403).json({ 
                error: 'Only the project leader can post daily updates' 
            });
        }

        // Validate progress if provided
        if (progress !== undefined && (progress < 0 || progress > 100)) {
            return res.status(400).json({ error: 'Progress must be between 0 and 100' });
        }

        // Validate status if provided
        if (status) {
            const validStatuses = ['pending', 'in-progress', 'completed', 'on-hold'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
        }

        // Create project update
        const projectUpdate = new ProjectUpdate({
            organizationId,
            projectId: id,
            postedBy: userId,
            update: update.trim(),
            updateDate: updateDate ? new Date(updateDate) : new Date(),
            status: status || project.status,
            progress: progress !== undefined ? progress : undefined,
            blockers: blockers?.trim() || undefined,
            nextSteps: nextSteps?.trim() || undefined
        });

        await projectUpdate.save();

        // Populate the update
        const populatedUpdate = await ProjectUpdate.findById(projectUpdate._id)
            .populate('postedBy', 'name email position department employeeId')
            .populate('projectId', 'name status');

        logger.info('Project daily update created', {
            projectId: id,
            updateId: projectUpdate._id,
            leaderId: userId
        });

        res.status(201).json({
            success: true,
            message: 'Daily update posted successfully',
            update: populatedUpdate
        });
    } catch (error) {
        logger.error('Create Project Update Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            error: 'Failed to create project update',
            details: error.message 
        });
    }
};

// Get all daily updates for a project
export const getProjectUpdates = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        // Verify project exists
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Parse pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Get updates with pagination
        const [updates, total] = await Promise.all([
            ProjectUpdate.find({ projectId: id })
                .populate('postedBy', 'name email position department employeeId')
                .sort({ updateDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            ProjectUpdate.countDocuments({ projectId: id })
        ]);

        res.status(200).json({
            success: true,
            updates,
            pagination: {
                page: parseInt(page),
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        logger.error('Get Project Updates Error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            error: 'Failed to fetch project updates',
            details: error.message 
        });
    }
};