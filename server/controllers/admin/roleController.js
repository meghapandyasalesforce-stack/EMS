import Role from '../../models/role.model.js';
import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import logger from '../../helpers/logger.js';

// Create a new role
export const createRole = async (req, res) => {
    try {
        const {
            name,
            description,
            level,
            permissions,
            canManageRoles,
            canAccessReports,
            canManageSystem,
            parentRole,
            dashboardRoute,
        } = req.body;
        
        // SECURITY: Get organizationId from authenticated user (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId;
        if (!organizationId) {
            logger.error('Create role error: Missing organizationId', { userId: req.user?._id });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Check if role with same name exists within the same organization
        const existingRole = await Role.findOne({ name, organizationId });
        if (existingRole) {
            return res.status(400).json({ 
                success: false,
                message: 'Role with this name already exists' 
            });
        }

        // SECURITY: Check if level is already taken within the same organization
        const existingLevel = await Role.findOne({ level, organizationId });
        if (existingLevel) {
            return res.status(400).json({ 
                success: false,
                message: 'Role level already exists' 
            });
        }

        // SECURITY: Validate parentRole belongs to the same organization
        if (parentRole) {
            const parent = await Role.findOne({ _id: parentRole, organizationId });
            if (!parent) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Parent role not found or does not belong to your organization' 
                });
            }
        }

        const role = new Role({
            name,
            description,
            level,
            permissions: permissions || [],
            canManageRoles: canManageRoles || false,
            canAccessReports: canAccessReports || false,
            canManageSystem: canManageSystem || false,
            parentRole: parentRole || null,
            dashboardRoute: dashboardRoute || '/dashboard-employee',
            organizationId // SECURITY: Set organizationId for multi-tenancy
        });

        await role.save();

        // Update parent role's child roles (scoped to organization)
        if (parentRole) {
            await Role.findOneAndUpdate(
                { _id: parentRole, organizationId },
                { $push: { childRoles: role._id } }
            );
        }

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            role
        });
    } catch (error) {
        logger.error('Create role error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to create role', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Get all roles
export const getAllRoles = async (req, res) => {
    try {
        // SECURITY: Get organizationId from authenticated user or employee (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Get roles error: Missing organizationId', { 
                userId: req.user?._id || req.employee?._id 
            });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get roles for the authenticated user's organization
        const roles = await Role.find({ isActive: true, organizationId })
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level')
            .sort({ level: 1 });

        res.json(roles);
    } catch (error) {
        logger.error('Get roles error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to get roles', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Get role by ID
export const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // SECURITY: Get organizationId from authenticated user (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId;
        if (!organizationId) {
            logger.error('Get role error: Missing organizationId', { userId: req.user?._id });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get role if it belongs to the authenticated user's organization
        const role = await Role.findOne({ _id: id, organizationId })
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level');

        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        res.json(role);
    } catch (error) {
        logger.error('Get role error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to get role', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Update role
export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // SECURITY: Get organizationId from authenticated user (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId;
        if (!organizationId) {
            logger.error('Update role error: Missing organizationId', { userId: req.user?._id });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get role if it belongs to the authenticated user's organization
        const role = await Role.findOne({ _id: id, organizationId });
        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // SECURITY: Check if new name conflicts with existing role within the same organization
        if (updates.name && updates.name !== role.name) {
            const existingRole = await Role.findOne({ 
                name: updates.name, 
                organizationId,
                _id: { $ne: id } 
            });
            if (existingRole) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Role with this name already exists' 
                });
            }
        }

        // SECURITY: Check if new level conflicts with existing role within the same organization
        if (updates.level && updates.level !== role.level) {
            const existingLevel = await Role.findOne({ 
                level: updates.level, 
                organizationId,
                _id: { $ne: id } 
            });
            if (existingLevel) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Role level already exists' 
                });
            }
        }

        // SECURITY: Validate parentRole belongs to the same organization
        if (updates.parentRole && updates.parentRole !== role.parentRole?.toString()) {
            const parent = await Role.findOne({ _id: updates.parentRole, organizationId });
            if (!parent) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Parent role not found or does not belong to your organization' 
                });
            }
        }

        // SECURITY: Prevent changing organizationId
        delete updates.organizationId;

        const updatedRole = await Role.findOneAndUpdate(
            { _id: id, organizationId },
            updates,
            { new: true }
        )
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level');

        res.json({
            success: true,
            message: 'Role updated successfully',
            role: updatedRole
        });
    } catch (error) {
        logger.error('Update role error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to update role', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Delete role
export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // SECURITY: Get organizationId from authenticated user (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId;
        if (!organizationId) {
            logger.error('Delete role error: Missing organizationId', { userId: req.user?._id });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get role if it belongs to the authenticated user's organization
        const role = await Role.findOne({ _id: id, organizationId });
        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // SECURITY: Check if role is being used by any employees in the same organization
        const usersWithRole = await Employee.countDocuments({ 
            roleLevel: role.level,
            organizationId 
        });
        if (usersWithRole > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Cannot delete role. It is being used by employees.',
                usersCount: usersWithRole
            });
        }

        // SECURITY: Remove from parent role's child roles (scoped to organization)
        if (role.parentRole) {
            await Role.findOneAndUpdate(
                { _id: role.parentRole, organizationId },
                { $pull: { childRoles: role._id } }
            );
        }

        // SECURITY: Remove child roles' parent reference (scoped to organization)
        if (role.childRoles.length > 0) {
            await Role.updateMany(
                { _id: { $in: role.childRoles }, organizationId },
                { $unset: { parentRole: 1 } }
            );
        }

        await Role.findOneAndDelete({ _id: id, organizationId });

        res.json({ 
            success: true,
            message: 'Role deleted successfully' 
        });
    } catch (error) {
        logger.error('Delete role error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to delete role', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Assign role to employee
export const assignRoleToEmployee = async (req, res) => {
    try {
        const { employeeId, roleId } = req.body;

        // SECURITY: Get organizationId from authenticated user (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId;
        if (!organizationId) {
            logger.error('Assign role error: Missing organizationId', { userId: req.user?._id });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get employee if they belong to the authenticated user's organization
        const employee = await Employee.findOne({ _id: employeeId, organizationId });
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found' 
            });
        }

        // SECURITY: Only get role if it belongs to the authenticated user's organization
        const role = await Role.findOne({ _id: roleId, organizationId });
        if (!role) {
            return res.status(404).json({ 
                success: false,
                message: 'Role not found' 
            });
        }

        // Assign role to employee - set all role-related fields
        employee.roleLevel = role.level;
        employee.permissions = role.permissions;
        employee.assignedRole = roleId; // Set assignedRole for dashboard routing

        await employee.save();

        logger.info('Role assigned to employee', {
            employeeId: employee._id,
            employeeName: employee.name,
            roleId: role._id,
            roleName: role.name,
            dashboardRoute: role.dashboardRoute,
            organizationId
        });

        res.json({
            success: true,
            message: 'Role assigned successfully',
            employee: {
                id: employee._id,
                name: employee.name,
                roleLevel: employee.roleLevel,
                permissions: employee.permissions,
                assignedRole: employee.assignedRole
            },
            role: {
                id: role._id,
                name: role.name,
                dashboardRoute: role.dashboardRoute
            }
        });
    } catch (error) {
        logger.error('Assign role error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to assign role', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Get role hierarchy
export const getRoleHierarchy = async (req, res) => {
    try {
        // SECURITY: Get organizationId from authenticated user or employee (multi-tenancy)
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Get hierarchy error: Missing organizationId', { 
                userId: req.user?._id || req.employee?._id 
            });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // SECURITY: Only get hierarchy for the authenticated user's organization
        const hierarchy = await Role.find({ isActive: true, organizationId })
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level')
            .sort({ level: 1 });
        
        res.json(hierarchy);
    } catch (error) {
        logger.error('Get hierarchy error', { error: error.message, stack: error.stack, organizationId: req.organizationId });
        res.status(500).json({ 
            success: false,
            message: 'Failed to get role hierarchy', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Check user permissions
export const checkPermissions = async (req, res) => {
    try {
        const { userId, userType } = req.params;
        const { module, action } = req.query;

        let user;
        if (userType === 'employee') {
            user = await Employee.findById(userId);
        } else if (userType === 'admin') {
            user = await User.findById(userId);
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let hasPermission = false;
        if (userType === 'employee' && user.permissions) {
            const permission = user.permissions.find(p => p.module === module);
            hasPermission = permission && permission.actions.includes(action);
        } else if (userType === 'admin') {
            // Admins have all permissions by default
            hasPermission = true;
        }

        res.json({
            hasPermission,
            user: {
                id: user._id,
                name: user.name,
                role: user.role || 'admin',
                roleLevel: user.roleLevel || 1
            }
        });
    } catch (error) {
        logger.error('Check permissions error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: 'Failed to check permissions', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};
