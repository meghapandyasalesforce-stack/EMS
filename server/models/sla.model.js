import mongoose from "mongoose";

/**
 * SLA (Service Level Agreement) Model
 * Defines SLAs for different entity types and tracks violations
 */
const slaSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['Leave', 'Expense', 'Document', 'Helpdesk', 'Attendance', 'Project', 'Other'],
        index: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    // SLA thresholds
    responseTime: {
        hours: {
            type: Number,
            required: true
        },
        businessHoursOnly: {
            type: Boolean,
            default: false
        }
    },
    resolutionTime: {
        hours: {
            type: Number,
            required: true
        },
        businessHoursOnly: {
            type: Boolean,
            default: false
        }
    },
    // Escalation levels
    escalationLevels: [{
        level: {
            type: Number,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        triggerAfterHours: {
            type: Number,
            required: true
        },
        notifyTo: {
            type: String,
            enum: ['Manager', 'HR', 'Executive', 'Role', 'Department', 'Employee'],
            required: true
        },
        notifyToRole: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role'
        },
        notifyToDepartment: String,
        notifyToEmployee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        actions: [{
            type: String,
            enum: ['Notify', 'AutoAssign', 'ChangePriority', 'EscalateToNextLevel']
        }]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    conditions: {
        minAmount: Number, // For expenses
        maxAmount: Number,
        departments: [String],
        leaveTypes: [String]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

/**
 * SLA Violation Tracking Model
 */
const slaViolationSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    slaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SLA',
        required: true,
        index: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['Leave', 'Expense', 'Document', 'Helpdesk', 'Attendance', 'Project', 'Other']
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    violationType: {
        type: String,
        enum: ['ResponseTime', 'ResolutionTime', 'Both'],
        required: true
    },
    currentLevel: {
        type: Number,
        default: 0
    },
    escalatedTo: [{
        level: Number,
        escalatedAt: Date,
        escalatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        notified: {
            type: Boolean,
            default: false
        }
    }],
    responseTime: {
        target: Date,
        actual: Date,
        violated: {
            type: Boolean,
            default: false
        },
        violatedAt: Date
    },
    resolutionTime: {
        target: Date,
        actual: Date,
        violated: {
            type: Boolean,
            default: false
        },
        violatedAt: Date
    },
    status: {
        type: String,
        enum: ['Active', 'Resolved', 'Cancelled'],
        default: 'Active'
    },
    resolvedAt: Date,
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes
slaSchema.index({ organizationId: 1, entityType: 1, isActive: 1 });
slaViolationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
slaViolationSchema.index({ entityId: 1, entityType: 1 });
slaViolationSchema.index({ slaId: 1, status: 1 });

export const SLA = mongoose.model('SLA', slaSchema);
export const SLAViolation = mongoose.model('SLAViolation', slaViolationSchema);

