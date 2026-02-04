/**
 * Review Cycle Model
 * Manages performance review cycles (Quarterly, Semi-Annual, Annual)
 */

import mongoose from "mongoose";

const reviewCycleSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    cycleType: {
        type: String,
        enum: ['Quarterly', 'Semi-Annual', 'Annual', 'Custom'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reviewType: {
        type: String,
        enum: ['Self-Assessment', 'Manager Review', 'Peer Review', '360-Degree'],
        default: 'Manager Review'
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'In Progress', 'Completed', 'Archived'],
        default: 'Draft',
        index: true
    },
    // Auto-creation settings
    autoCreate: {
        enabled: {
            type: Boolean,
            default: false
        },
        employeeFilter: {
            departments: [String],
            roles: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Role'
            }],
            includeAll: {
                type: Boolean,
                default: true
            }
        }
    },
    // Reminder settings
    reminders: {
        enabled: {
            type: Boolean,
            default: true
        },
        daysBeforeStart: {
            type: Number,
            default: 7
        },
        daysBeforeEnd: {
            type: Number,
            default: 7
        },
        daysAfterEnd: {
            type: Number,
            default: 3
        }
    },
    // Review assignments
    assignedEmployees: [{
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        reviewId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PerformanceReview'
        },
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Overdue'],
            default: 'Pending'
        },
        assignedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: Date
    }],
    // Statistics
    statistics: {
        totalEmployees: {
            type: Number,
            default: 0
        },
        reviewsCreated: {
            type: Number,
            default: 0
        },
        reviewsCompleted: {
            type: Number,
            default: 0
        },
        completionRate: {
            type: Number,
            default: 0
        }
    },
    // Template settings (for recurring cycles)
    isTemplate: {
        type: Boolean,
        default: false
    },
    templateName: {
        type: String,
        trim: true
    },
    // Recurring cycle settings
    recurring: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['Quarterly', 'Semi-Annual', 'Annual']
        },
        nextCycleDate: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
reviewCycleSchema.index({ organizationId: 1, status: 1 });
reviewCycleSchema.index({ organizationId: 1, startDate: 1, endDate: 1 });
reviewCycleSchema.index({ 'assignedEmployees.employeeId': 1 });

// Virtual for calculating completion rate
reviewCycleSchema.virtual('completionRate').get(function() {
    if (this.statistics.totalEmployees === 0) return 0;
    return Math.round((this.statistics.reviewsCompleted / this.statistics.totalEmployees) * 100);
});

// Method to check if cycle is active
reviewCycleSchema.methods.isActive = function() {
    const now = new Date();
    return this.status === 'Active' && 
           this.startDate <= now && 
           this.endDate >= now;
};

// Method to check if cycle is overdue
reviewCycleSchema.methods.isOverdue = function() {
    const now = new Date();
    return this.status === 'In Progress' && this.endDate < now;
};

const ReviewCycle = mongoose.model("ReviewCycle", reviewCycleSchema, "reviewCycles");
export default ReviewCycle;

