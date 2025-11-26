import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema({
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
    subject: {
        type: String,
        required: true,
        maxlength: 500
    },
    body: {
        type: String,
        required: true
    },
    templateType: {
        type: String,
        required: true,
        enum: [
            'Welcome', 'Birthday', 'Anniversary', 'Payroll', 
            'Leave Approval', 'Leave Rejection', 'Performance Review',
            'Document Expiration', 'Password Reset', 'Notification',
            'Custom'
        ]
    },
    // Template variables (e.g., {{employeeName}}, {{date}})
    variables: [{
        name: String,
        description: String,
        example: String
    }],
    // Email settings
    fromEmail: {
        type: String
    },
    fromName: {
        type: String
    },
    replyTo: {
        type: String
    },
    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String
    }],
    // Automation settings
    automation: {
        enabled: {
            type: Boolean,
            default: false
        },
        trigger: {
            type: String,
            enum: [
                'Employee Created', 'Payroll Generated', 'Leave Applied',
                'Leave Approved', 'Leave Rejected', 'Performance Review Due',
                'Document Expiring', 'Birthday', 'Anniversary', 'Custom'
            ]
        },
        conditions: mongoose.Schema.Types.Mixed,
        delay: {
            type: Number, // Delay in hours
            default: 0
        }
    },
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    // Usage tracking
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
emailTemplateSchema.index({ organizationId: 1, templateType: 1 });
emailTemplateSchema.index({ isActive: 1 });
emailTemplateSchema.index({ isDefault: 1 });

const EmailTemplate = mongoose.model("EmailTemplate", emailTemplateSchema, "emailtemplates");
export default EmailTemplate;

