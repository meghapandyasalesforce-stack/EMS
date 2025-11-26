import mongoose from "mongoose";

const performanceReviewSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    reviewPeriod: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        type: {
            type: String,
            enum: ['Quarterly', 'Semi-Annual', 'Annual', 'Custom'],
            required: true
        }
    },
    reviewType: {
        type: String,
        enum: ['Self-Assessment', 'Manager Review', 'Peer Review', '360-Degree'],
        default: 'Manager Review'
    },
    status: {
        type: String,
        enum: ['Draft', 'In Progress', 'Completed', 'Archived'],
        default: 'Draft'
    },
    // Self-Assessment
    selfAssessment: {
        strengths: [{
            type: String,
            maxlength: 500
        }],
        areasForImprovement: [{
            type: String,
            maxlength: 500
        }],
        achievements: [{
            type: String,
            maxlength: 500
        }],
        goals: [{
            type: String,
            maxlength: 500
        }],
        submittedAt: Date
    },
    // Manager Evaluation
    managerEvaluation: {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        overallRating: {
            type: Number,
            min: 1,
            max: 5
        },
        ratings: [{
            category: {
                type: String,
                required: true
            },
            rating: {
                type: Number,
                min: 1,
                max: 5,
                required: true
            },
            comments: {
                type: String,
                maxlength: 500
            }
        }],
        strengths: [{
            type: String,
            maxlength: 500
        }],
        areasForImprovement: [{
            type: String,
            maxlength: 500
        }],
        goals: [{
            goal: {
                type: String,
                required: true,
                maxlength: 500
            },
            targetDate: Date,
            status: {
                type: String,
                enum: ['Not Started', 'In Progress', 'Completed', 'On Hold']
            }
        }],
        comments: {
            type: String,
            maxlength: 2000
        },
        submittedAt: Date
    },
    // Peer Reviews
    peerReviews: [{
        reviewerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        reviewerName: {
            type: String,
            required: true
        },
        relationship: {
            type: String,
            enum: ['Peer', 'Subordinate', 'Supervisor', 'Client', 'Other']
        },
        ratings: [{
            category: String,
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comments: String
        }],
        overallComments: {
            type: String,
            maxlength: 1000
        },
        submittedAt: Date
    }],
    // Final Review
    finalReview: {
        overallRating: {
            type: Number,
            min: 1,
            max: 5
        },
        summary: {
            type: String,
            maxlength: 2000
        },
        recommendations: [{
            type: String,
            maxlength: 500
        }],
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date
    },
    // Performance Improvement Plan
    improvementPlan: {
        hasPlan: {
            type: Boolean,
            default: false
        },
        objectives: [{
            objective: {
                type: String,
                required: true,
                maxlength: 500
            },
            actionItems: [{
                type: String,
                maxlength: 500
            }],
            targetDate: Date,
            status: {
                type: String,
                enum: ['Not Started', 'In Progress', 'Completed', 'On Hold']
            }
        }],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: Date
    }
}, {
    timestamps: true
});

// Indexes
performanceReviewSchema.index({ employeeId: 1, 'reviewPeriod.endDate': -1 });
performanceReviewSchema.index({ status: 1 });
performanceReviewSchema.index({ organizationId: 1, status: 1 });

const PerformanceReview = mongoose.model("PerformanceReview", performanceReviewSchema, "performancereviews");
export default PerformanceReview;

