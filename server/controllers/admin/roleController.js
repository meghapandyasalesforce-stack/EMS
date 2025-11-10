import Role from '../../models/role.model.js';
import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import logger from '../../helpers/logger.js';

// Create a new role
export const createRole = async (req, res) => {
    try {
        const { name, description, level, permissions, canManageRoles, canAccessReports, canManageSystem, parentRole } = req.body;

        // Check if role with same name exists
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({ message: 'Role with this name already exists' });
        }

        // Check if level is already taken
        const existingLevel = await Role.findOne({ level });
        if (existingLevel) {
            return res.status(400).json({ message: 'Role level already exists' });
        }

        const role = new Role({
            name,
            description,
            level,
            permissions,
            canManageRoles,
            canAccessReports,
            canManageSystem,
            parentRole
        });

        await role.save();

        // Update parent role's child roles
        if (parentRole) {
            await Role.findByIdAndUpdate(parentRole, {
                $push: { childRoles: role._id }
            });
        }

        res.status(201).json({
            message: 'Role created successfully',
            role
        });
    } catch (error) {
        logger.error('Create role error', { error: error.message, stack: error.stack });
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
        const roles = await Role.find({ isActive: true })
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level')
            .sort({ level: 1 });

        res.json(roles);
    } catch (error) {
        logger.error('Get roles error', { error: error.message, stack: error.stack });
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
        const role = await Role.findById(id)
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level');

        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        res.json(role);
    } catch (error) {
        logger.error('Get role error', { error: error.message, stack: error.stack });
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

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        // Check if new name conflicts with existing role
        if (updates.name && updates.name !== role.name) {
            const existingRole = await Role.findOne({ name: updates.name, _id: { $ne: id } });
            if (existingRole) {
                return res.status(400).json({ message: 'Role with this name already exists' });
            }
        }

        // Check if new level conflicts with existing role
        if (updates.level && updates.level !== role.level) {
            const existingLevel = await Role.findOne({ level: updates.level, _id: { $ne: id } });
            if (existingLevel) {
                return res.status(400).json({ message: 'Role level already exists' });
            }
        }

        const updatedRole = await Role.findByIdAndUpdate(id, updates, { new: true })
            .populate('parentRole', 'name level')
            .populate('childRoles', 'name level');

        res.json({
            message: 'Role updated successfully',
            role: updatedRole
        });
    } catch (error) {
        logger.error('Update role error', { error: error.message, stack: error.stack });
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

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        // Check if role is being used by any users
        const usersWithRole = await Employee.countDocuments({ roleLevel: role.level });
        if (usersWithRole > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete role. It is being used by employees.',
                usersCount: usersWithRole
            });
        }

        // Remove from parent role's child roles
        if (role.parentRole) {
            await Role.findByIdAndUpdate(role.parentRole, {
                $pull: { childRoles: role._id }
            });
        }

        // Remove child roles' parent reference
        if (role.childRoles.length > 0) {
            await Role.updateMany(
                { _id: { $in: role.childRoles } },
                { $unset: { parentRole: 1 } }
            );
        }

        await Role.findByIdAndDelete(id);

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.error('Delete role error', { error: error.message, stack: error.stack });
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

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        employee.roleLevel = role.level;
        employee.permissions = role.permissions;

        await employee.save();

        res.json({
            message: 'Role assigned successfully',
            employee: {
                id: employee._id,
                name: employee.name,
                roleLevel: employee.roleLevel,
                permissions: employee.permissions
            }
        });
    } catch (error) {
        logger.error('Assign role error', { error: error.message, stack: error.stack });
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
        const hierarchy = await Role.getHierarchy();
        res.json(hierarchy);
    } catch (error) {
        logger.error('Get hierarchy error', { error: error.message, stack: error.stack });
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
