import mongoose from "mongoose";

const attendanceRegularizationSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    // Employee who requested regularization
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    // Manager who will approve/reject (can be auto-assigned based on employee's manager)
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    // Date for which attendance needs to be regularized
    attendanceDate: {
        type: Date,
        required: true,
        index: true
    },
    // Type of regularization: missing_clock_in, missing_clock_out, both, incorrect_time
    regularizationType: {
        type: String,
        enum: ['missing_clock_in', 'missing_clock_out', 'both', 'incorrect_time', 'full_day'],
        required: true
    },
    // Requested clock in time (if applicable)
    requestedClockIn: {
        type: Date
    },
    // Requested clock out time (if applicable)
    requestedClockOut: {
        type: Date
    },
    // Reason for regularization
    reason: {
        type: String,
        required: true,
        maxlength: 500
    },
    // Supporting documents/evidence (optional)
    supportingDocuments: [{
        url: String,
        filename: String,
        uploadedAt: { type: Date, default: Date.now }
    }],
    // Status of the request
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending',
        index: true
    },
    // Manager's response
    managerResponse: {
        type: String,
        maxlength: 500
    },
    // Who approved/rejected
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    // When reviewed
    reviewedAt: {
        type: Date
    },
    // If approved, link to the created/updated attendance record
    attendanceRecordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance'
    }
}, {
    timestamps: true
});

// Indexes for better query performance
attendanceRegularizationSchema.index({ employeeId: 1, status: 1 });
attendanceRegularizationSchema.index({ managerId: 1, status: 1 });
attendanceRegularizationSchema.index({ attendanceDate: 1, status: 1 });
attendanceRegularizationSchema.index({ organizationId: 1, status: 1 });

// Compound index for manager dashboard queries
attendanceRegularizationSchema.index({ managerId: 1, status: 1, createdAt: -1 });

const AttendanceRegularization = mongoose.model("AttendanceRegularization", attendanceRegularizationSchema);
export default AttendanceRegularization;

