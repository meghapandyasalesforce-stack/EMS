import mongoose from "mongoose";

const attendanceRuleSchema = new mongoose.Schema({
    location: {
        type: String,
        required: [true, 'Location is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    coordinates: {
        latitude: {
            type: Number,
            required: [true, 'Latitude is required']
        },
        longitude: {
            type: Number,
            required: [true, 'Longitude is required']
        }
    },
    maximumRadius: {
        type: Number,
        default: 500,
        min: [50, 'Minimum radius is 50 meters'],
        max: [1000, 'Maximum radius is 1000 meters']
    },
    enableCompOff: {
        type: Boolean,
        default: true
    },
    autoApprove: {
        type: Boolean,
        default: false
    },
    enableSimplePunches: {
        type: Boolean,
        default: false
    },
    enablePenaltyRules: {
        type: Boolean,
        default: true
    },
    // Additional penalty rules configuration
    penaltyRules: {
        lateArrival: {
            enabled: {
                type: Boolean,
                default: false
            },
            gracePeriod: {
                type: Number,
                default: 15 // minutes
            },
            action: {
                type: String,
                enum: ['warning', 'deduct', 'mark_absent'],
                default: 'warning'
            }
        },
        earlyDeparture: {
            enabled: {
                type: Boolean,
                default: false
            },
            gracePeriod: {
                type: Number,
                default: 30 // minutes
            },
            action: {
                type: String,
                enum: ['warning', 'deduct', 'mark_absent'],
                default: 'warning'
            }
        },
        absence: {
            enabled: {
                type: Boolean,
                default: true
            },
            action: {
                type: String,
                enum: ['mark_absent', 'deduct_salary', 'notification'],
                default: 'mark_absent'
            }
        }
    },
    // Comp Off settings
    compOffRules: {
        allowedPerMonth: {
            type: Number,
            default: 2
        },
        maxAccumulation: {
            type: Number,
            default: 5
        },
        validity: {
            type: Number,
            default: 90 // days
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    applicableDepartments: [{
        type: String
    }]
}, { timestamps: true });

// Add database indexes
attendanceRuleSchema.index({ location: 1 });
attendanceRuleSchema.index({ isActive: 1 });
attendanceRuleSchema.index({ coordinates: '2dsphere' }); // Geospatial index for location queries

const AttendanceRule = mongoose.model("AttendanceRule", attendanceRuleSchema, "attendanceRules");

export default AttendanceRule;

