import mongoose from "mongoose";

const MEETING_STATUSES = [
    'Pending',
    'Accepted',
    'Declined',
    'Reschedule Requested',
    'Rescheduled',
    'Scheduled', // legacy — treat as Accepted/Pending for filters
    'Completed',
    'Cancelled',
    'No Show'
];

const oneOnOneSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    /** Organizer (typically a manager). */
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    /** Invitee (employee or another manager). */
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    meetingKind: {
        type: String,
        enum: ['manager_employee', 'manager_manager'],
        default: 'manager_employee'
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
        enum: MEETING_STATUSES,
        default: 'Pending'
    },
    agenda: [{
        topic: String,
        notes: String,
        discussed: {
            type: Boolean,
            default: false
        }
    }],
    /** Legacy single-field notes (kept for backward compatibility). */
    managerNotes: String,
    employeeNotes: String,
    /** Shared notes visible to both participants. */
    meetingNotes: [{
        content: {
            type: String,
            required: true,
            trim: true
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        authorName: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: Date
    }],
    response: {
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        respondedAt: Date,
        note: String
    },
    rescheduleProposal: {
        proposedDate: Date,
        proposedTime: String,
        proposedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        proposedAt: Date,
        note: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: undefined
        }
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
    }],
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    cancelledAt: Date,
    cancelReason: String,
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    completedAt: Date,
    /** Stable key so calendar overlays stay de-duplicated across updates. */
    calendarEventKey: {
        type: String,
        index: true
    }
}, {
    timestamps: true
});

oneOnOneSchema.index({ organizationId: 1, managerId: 1, scheduledDate: 1 });
oneOnOneSchema.index({ organizationId: 1, employeeId: 1, scheduledDate: 1 });
oneOnOneSchema.index({ organizationId: 1, status: 1 });

oneOnOneSchema.pre('save', function (next) {
    if (!this.calendarEventKey) {
        this.calendarEventKey = `one-on-one-${this._id}`;
    }
    next();
});

export const ONE_ON_ONE_STATUSES = MEETING_STATUSES;
export const OneOnOne = mongoose.model('OneOnOne', oneOnOneSchema);
