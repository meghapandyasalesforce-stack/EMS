import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
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
        maxlength: 200
    },
    description: {
        type: String,
        maxlength: 1000
    },
    reportType: {
        type: String,
        required: true,
        enum: [
            'Payroll', 'Attendance', 'Leave', 'Employee', 
            'Performance', 'Expense', 'Project', 'Custom'
        ]
    },
    // Report configuration
    config: {
        dateRange: {
            startDate: Date,
            endDate: Date,
            preset: {
                type: String,
                enum: ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'Custom']
            }
        },
        filters: {
            departments: [String],
            employees: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Employee'
            }],
            status: [String],
            customFilters: mongoose.Schema.Types.Mixed
        },
        columns: [{
            field: String,
            label: String,
            visible: {
                type: Boolean,
                default: true
            }
        }],
        grouping: {
            enabled: Boolean,
            groupBy: String
        },
        sorting: {
            field: String,
            order: {
                type: String,
                enum: ['asc', 'desc']
            }
        }
    },
    // Report data (cached)
    data: {
        type: mongoose.Schema.Types.Mixed
    },
    // Export settings
    exportSettings: {
        format: {
            type: String,
            enum: ['PDF', 'Excel', 'CSV', 'JSON'],
            default: 'PDF'
        },
        includeCharts: {
            type: Boolean,
            default: true
        },
        template: String
    },
    // Schedule settings
    schedule: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']
        },
        dayOfWeek: Number, // 0-6 for weekly
        dayOfMonth: Number, // 1-31 for monthly
        time: String, // HH:MM format
        recipients: [{
            type: String // Email addresses
        }],
        lastRun: Date,
        nextRun: Date
    },
    // Access control
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedWith: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        permission: {
            type: String,
            enum: ['View', 'Edit', 'Delete'],
            default: 'View'
        }
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    // Status
    status: {
        type: String,
        enum: ['Active', 'Archived', 'Deleted'],
        default: 'Active'
    }
}, {
    timestamps: true
});

// Indexes
reportSchema.index({ organizationId: 1, reportType: 1 });
reportSchema.index({ createdBy: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ isTemplate: 1 });

const Report = mongoose.model("Report", reportSchema, "reports");
export default Report;

