import mongoose from "mongoose";

/**
 * Approval Workflow Model
 * Defines configurable multi-step approval workflows
 */
const approvalWorkflowSchema = new mongoose.Schema({
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
        enum: ['Leave', 'Expense', 'Document', 'WorkforcePlan', 'Project', 'Other'],
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    steps: [{
        stepNumber: {
            type: Number,
            required: true
        },
        stepName: {
            type: String,
            required: true
        },
        approverType: {
            type: String,
            enum: ['Role', 'Department', 'Employee', 'Manager', 'HR', 'Finance', 'Executive'],
            required: true
        },
        approverRole: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role'
        },
        approverDepartment: String,
        approverEmployee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        isRequired: {
            type: Boolean,
            default: true
        },
        canDelegate: {
            type: Boolean,
            default: false
        },
        timeoutHours: {
            type: Number,
            default: 48 // Auto-approve after timeout
        },
        conditions: {
            minAmount: Number, // For expenses
            maxAmount: Number,
            leaveDuration: Number, // Days
            department: [String]
        }
    }],
    autoApprove: {
        enabled: {
            type: Boolean,
            default: false
        },
        conditions: {
            maxAmount: Number,
            leaveDays: Number
        }
    },
    escalation: {
        enabled: {
            type: Boolean,
            default: true
        },
        escalateAfterHours: {
            type: Number,
            default: 24
        },
        escalateTo: {
            type: String,
            enum: ['NextLevel', 'HR', 'Executive', 'Role', 'Employee']
        },
        escalateToRole: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role'
        },
        escalateToEmployee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }
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
 * Approval Instance Model
 * Tracks individual approval requests through workflows
 */
const approvalInstanceSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    workflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApprovalWorkflow',
        required: true,
        index: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['Leave', 'Expense', 'Document', 'WorkforcePlan', 'Project', 'Other']
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Approved', 'Rejected', 'Cancelled', 'Expired'],
        default: 'Pending',
        index: true
    },
    currentStep: {
        type: Number,
        default: 0
    },
    steps: [{
        stepNumber: {
            type: Number,
            required: true
        },
        stepName: String,
        approverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        approverName: String,
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Skipped', 'Delegated', 'Expired'],
            default: 'Pending'
        },
        action: {
            type: String,
            enum: ['Approve', 'Reject', 'Request Changes', 'Delegate']
        },
        comments: String,
        actionDate: Date,
        dueDate: Date,
        escalated: {
            type: Boolean,
            default: false
        },
        escalatedAt: Date,
        delegatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }
    }],
    approvedAt: Date,
    rejectedAt: Date,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    rejectionReason: String,
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    }
}, {
    timestamps: true
});

// Indexes
approvalWorkflowSchema.index({ organizationId: 1, entityType: 1, isActive: 1 });
approvalInstanceSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
approvalInstanceSchema.index({ requestedBy: 1, status: 1 });
approvalInstanceSchema.index({ 'steps.approverId': 1, 'steps.status': 1 });

export const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
export const ApprovalInstance = mongoose.model('ApprovalInstance', approvalInstanceSchema);

