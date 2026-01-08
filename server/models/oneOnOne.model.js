import mongoose from "mongoose";

const oneOnOneSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
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
        enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'],
        default: 'Scheduled'
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

