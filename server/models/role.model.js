import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
        unique: true
    },
    permissions: [{
        module: {
            type: String,
            required: true,
            enum: [
                'dashboard', 'employees', 'attendance', 'payroll', 'leave', 
                'projects', 'notifications', 'reports', 'settings', 'calendar'
            ]
        },
        actions: [{
            type: String,
            enum: ['read', 'write', 'delete', 'approve', 'export', 'import']
        }]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    canManageRoles: {
        type: Boolean,
        default: false
    },
    canAccessReports: {
        type: Boolean,
        default: false
    },
    canManageSystem: {
        type: Boolean,
        default: false
    },
    parentRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        default: null
    },
    childRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }]
}, {
    timestamps: true
});

// Index for efficient queries
roleSchema.index({ isActive: 1 });

// Virtual for getting all permissions as a flat array
roleSchema.virtual('allPermissions').get(function() {
    const permissions = {};
    this.permissions.forEach(perm => {
        if (!permissions[perm.module]) {
            permissions[perm.module] = [];
        }
        permissions[perm.module] = [...permissions[perm.module], ...perm.actions];
    });
    return permissions;
});

// Method to check if role has specific permission
roleSchema.methods.hasPermission = function(module, action) {
    const permission = this.permissions.find(p => p.module === module);
    return permission && permission.actions.includes(action);
};

// Method to check if role can manage another role
roleSchema.methods.canManageRole = function(targetRoleLevel) {
    return this.level < targetRoleLevel;
};

// Static method to get role hierarchy
roleSchema.statics.getHierarchy = async function() {
    return await this.find({ isActive: true })
        .populate('parentRole', 'name level')
        .populate('childRoles', 'name level')
        .sort({ level: 1 });
};

const Role = mongoose.model("Role", roleSchema, "roles");
export default Role;
