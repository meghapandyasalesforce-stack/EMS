import mongoose from 'mongoose';

const missedPunchReminderLogSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true,
    },
    /** yyyy-MM in the organization timezone. */
    monthKey: {
        type: String,
        required: true,
        trim: true,
    },
    stage: {
        type: String,
        enum: ['notice', 'lop'],
        required: true,
    },
    missedDateKeys: [{
        type: String,
        trim: true,
    }],
    sentAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

missedPunchReminderLogSchema.index(
    { organizationId: 1, employeeId: 1, monthKey: 1, stage: 1 },
    { unique: true }
);

const MissedPunchReminderLog = mongoose.model('MissedPunchReminderLog', missedPunchReminderLogSchema);
export default MissedPunchReminderLog;
