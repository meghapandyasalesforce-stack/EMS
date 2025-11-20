import Project from "../../models/project.model.js";
import Employee from "../../models/employee.model.js";
import logger from "../../helpers/logger.js";

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

// Get all projects with populated leader and members
export const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('projectLeader', 'name email role')
            .populate('projectMembers', 'name email role');
       res.json({
  success: true,
  projects: [projects]
});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
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
        
        const { name, projectLeader, projectMembers, status } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        
        if (!projectLeader) {
            return res.status(400).json({ error: 'Project leader is required' });
        }
        
        if (!status) {
            return res.status(400).json({ error: 'Project status is required' });
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

        const newProject = new Project({
            name,
            projectLeader,
            projectMembers: projectMembers || [],
            status
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
        const { name, projectLeader, projectMembers, status } = req.body;

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

        const updatedProject = await Project.findByIdAndUpdate(
            id,
            { 
                name, 
                ...(projectLeader && { projectLeader }),
                ...(projectMembers && { projectMembers }),
                status,
                updatedAt: Date.now() 
            },
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

        res.status(200).json({
            success: true,
            project: project
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch project',
            details: error.message 
        });
    }
};