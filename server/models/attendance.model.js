import mongoose from "mongoose";
import AttendanceRule from "./attendanceRule.model.js";
import {
    getExpectedWorkingHoursFromRule,
    getEffectiveOfficeStartForLate,
    getEffectiveOfficeEndForEarlyDeparture,
} from "../helpers/attendanceSecurityHelper.js";
import { getEffectiveTimezone } from "../helpers/organizationTimezoneService.js";
import {
    getDateKeyInTimezone,
    getStartOfDayInTimezone,
} from "../helpers/timezoneHelper.js";

const attendanceSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
    },
    /** Start-of-day UTC instant in effective org timezone (legacy compatibility). */
    date: {
        type: Date,
        required: true,
    },
    /** Calendar day yyyy-MM-dd in effective timezone at punch-in (canonical day key). */
    attendanceDateKey: {
        type: String,
        trim: true,
        index: true,
    },
    /** IANA timezone used when this row's attendance day was opened. */
    timezoneUsed: {
        type: String,
        trim: true,
    },
    clockIn: {
        type: Date,
        required: true,
    },
    clockOut: {
        type: Date,
    },
    breaks: [{
        breakIn: Date,
        breakOut: Date
    }],
    effectiveHours: {
        type: Number,
        default: 0,
    },
    grossHours: {
        type: Number,
        default: 0,
    },
    overtimeHours: {
        type: Number,
        default: 0,
    },
    isOnTime: {
        type: Boolean,
        default: true,
    },
    isLateArrival: {
        type: Boolean,
        default: false,
    },
    isEarlyDeparture: {
        type: Boolean,
        default: false,
    },
    averageWorkHours: {
        type: Number,
        default: 0,
    },
    workLocation: {
        type: String,
        enum: ["office", "work_from_home"],
        default: "office",
    },
    
    // Image capture for clock in/out
    clockInImage: {
        url: { type: String },
        filename: { type: String }
    },
    clockOutImage: {
        url: { type: String },
        filename: { type: String }
    },
    
    // Geolocation tracking
    clockInLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String },
        accuracy: { type: Number },
        locationMatch: { type: Boolean, default: false },
        locationDistance: { type: Number }
    },
    clockOutLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String },
        accuracy: { type: Number }
    },
    
    // Network tracking
    clockInNetwork: {
        ipAddress: { type: String },
        userAgent: { type: String },
        networkType: { type: String },
        connectionSpeed: { type: String },
        deviceType: { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'] }
    },
    clockOutNetwork: {
        ipAddress: { type: String },
        userAgent: { type: String },
        networkType: { type: String },
        connectionSpeed: { type: String }
    },
    
    status: {
        type: String,
        enum: ["present", "absent", "half-day", "onBreak", "loggedOut"],
        default: "present",
    },
    // Auto check-out flag
    autoCheckedOut: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true,
});

attendanceSchema.pre("save", async function (next) {
    try {
        // Set canonical day fields only when creating a row (never overwrite on clock-out).
        if (this.isNew && this.clockIn && this.organizationId) {
            const tz = await getEffectiveTimezone(this.organizationId);
            const ref = this.clockIn;
            if (!this.attendanceDateKey) {
                this.attendanceDateKey = getDateKeyInTimezone(ref, tz);
            }
            if (!this.date) {
                this.date = getStartOfDayInTimezone(ref, tz);
            }
            if (!this.timezoneUsed) {
                this.timezoneUsed = tz;
            }
        }

        if (this.clockIn && this.clockOut) {
            const durationMs = this.clockOut - this.clockIn;
            const grossHours = durationMs / (1000 * 60 * 60);
            this.grossHours = Math.round(grossHours * 100) / 100;

            let totalBreakMs = 0;
            if (this.breaks && this.breaks.length > 0) {
                this.breaks.forEach(b => {
                    if (b.breakIn && b.breakOut) {
                        totalBreakMs += new Date(b.breakOut) - new Date(b.breakIn);
                    }
                });
            }

            const effectiveHours = (durationMs - totalBreakMs) / (1000 * 60 * 60);
            this.effectiveHours = Math.round(effectiveHours * 100) / 100;

            let rule = null;
            if (this.organizationId) {
                rule = await AttendanceRule.findOne({
                    isActive: true,
                    organizationId: this.organizationId,
                })
                    .sort({ priority: -1, updatedAt: -1 })
                    .lean();
            }

            const referenceDate = this.date || this.clockIn;

            const effectiveStart = getEffectiveOfficeStartForLate(rule, referenceDate);
            this.isLateArrival = new Date(this.clockIn) > effectiveStart;
            this.isOnTime = !this.isLateArrival;

            const effectiveEnd = getEffectiveOfficeEndForEarlyDeparture(rule, referenceDate);
            this.isEarlyDeparture = new Date(this.clockOut) < effectiveEnd;

            const expectedHours = getExpectedWorkingHoursFromRule(rule, referenceDate);
            this.overtimeHours = this.effectiveHours > expectedHours
                ? Math.round((this.effectiveHours - expectedHours) * 100) / 100
                : 0;
        }

        next();
    } catch (err) {
        next(err);
    }
});

// One attendance row per user per calendar day per organization
attendanceSchema.index(
    { organizationId: 1, userId: 1, attendanceDateKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            attendanceDateKey: { $exists: true, $gt: '' },
        },
    }
);
attendanceSchema.index({ organizationId: 1, attendanceDateKey: 1 });
attendanceSchema.index({ userId: 1, attendanceDateKey: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ userId: 1, status: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
