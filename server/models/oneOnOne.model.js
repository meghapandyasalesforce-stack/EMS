import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema({
    status: String,
    action: String,
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    note: String,
    at: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const meetingNoteSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const rescheduleProposalSchema = new mongoose.Schema({
    proposedDate: Date,
    proposedTime: String,
    reason: String,
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    requestedByRole: {
        type: String,
        enum: ['Organizer', 'Invitee']
    },
    status: {
        type: String,
        enum: ['none', 'pending', 'accepted', 'rejected'],
        default: 'none'
    },
    respondedAt: Date,
    responseNote: String
}, { _id: false });

const oneOnOneSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    // Organizer (manager / HR / admin who scheduled)
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    // Invitee
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    scheduledTime: String,
    duration: {
        type: Number, // in minutes
        default: 30
    },
    location: String,
    meetingLink: String,
    status: {
        type: String,
        enum: [
            'Pending Response',
            'Scheduled',
            'Completed',
            'Cancelled',
            'Declined',
            'Rescheduled',
            'No Show'
        ],
        default: 'Pending Response'
    },
    inviteeResponse: {
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending'
        },
        respondedAt: Date,
        reason: String
    },
    rescheduleProposal: {
        type: rescheduleProposalSchema,
        default: () => ({ status: 'none' })
    },
    statusHistory: {
        type: [statusHistorySchema],
        default: []
    },
    agenda: [{
        topic: String,
        notes: String,
        discussed: {
            type: Boolean,
            default: false
        }
    }],
    managerNotes: String,
    employeeNotes: String,
    meetingNotes: {
        type: [meetingNoteSchema],
        default: []
    },
    actionItems: [{
        item: String,
        assignedTo: {
            type: String,
            enum: ['Manager', 'Employee', 'Both']
        },
        dueDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'Pending'
        },
        completedAt: Date
    }],
    goals: [{
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Goal'
        },
        progress: Number,
        notes: String
    }],
    feedback: {
        managerFeedback: String,
        employeeFeedback: String,
        overallRating: Number
    },
    nextMeetingDate: Date,
    recurring: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly']
        },
        dayOfWeek: Number,
        dayOfMonth: Number
    },
    reminders: [{
        sentAt: Date,
        type: {
            type: String,
            enum: ['Email', 'Notification', 'SMS']
        }
    }]
}, {
    timestamps: true
});

// Indexes
oneOnOneSchema.index({ organizationId: 1, managerId: 1, scheduledDate: 1 });
oneOnOneSchema.index({ organizationId: 1, employeeId: 1, scheduledDate: 1 });
oneOnOneSchema.index({ organizationId: 1, status: 1 });

export const OneOnOne = mongoose.model('OneOnOne', oneOnOneSchema);
