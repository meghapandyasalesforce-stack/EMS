import mongoose from "mongoose";

const helpdeskTicketSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    ticketNumber: {
        type: String,
        required: true
        // Note: unique index is created explicitly below to avoid duplicate index warning
    },
    category: {
        type: String,
        enum: ['HR', 'IT', 'Payroll', 'Benefits', 'Leave', 'Attendance', 
               'Training', 'Document', 'General', 'Other'],
        required: true
    },
    subCategory: String,
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
        default: 'Open'
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        index: true
    },
    department: String,
    attachments: [{
        name: String,
        url: String,
        uploadedAt: Date
    }],
    comments: [{
        comment: String,
        commentedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        commentedAt: {
            type: Date,
            default: Date.now
        },
        isInternal: {
            type: Boolean,
            default: false
        }
    }],
    resolution: {
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        resolvedAt: Date,
        resolutionNotes: String
    },
    sla: {
        targetResolutionTime: Date,
        actualResolutionTime: Date,
        status: {
            type: String,
            enum: ['On Time', 'At Risk', 'Breached']
        }
    },
    tags: [String],
    relatedTickets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HelpdeskTicket'
    }],
    satisfactionRating: {
        rating: Number,
        feedback: String,
        ratedAt: Date
    }
}, {
    timestamps: true
});

// Generate ticket number before save
helpdeskTicketSchema.pre('save', async function(next) {
    if (!this.ticketNumber) {
        const count = await mongoose.model('HelpdeskTicket').countDocuments();
        this.ticketNumber = `TKT-${Date.now()}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Indexes
helpdeskTicketSchema.index({ organizationId: 1, status: 1 });
helpdeskTicketSchema.index({ organizationId: 1, requestedBy: 1 });
helpdeskTicketSchema.index({ organizationId: 1, assignedTo: 1 });
helpdeskTicketSchema.index({ organizationId: 1, category: 1 });
// Unique index on ticketNumber (explicit to avoid duplicate with unique: true)
helpdeskTicketSchema.index({ ticketNumber: 1 }, { unique: true });

export const HelpdeskTicket = mongoose.model('HelpdeskTicket', helpdeskTicketSchema);

