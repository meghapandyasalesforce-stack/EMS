import mongoose from "mongoose";

const attendanceRuleSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
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
    }],
    // Rule Versioning
    version: {
        type: Number,
        default: 1
    },
    parentRuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceRule',
        default: null
    },
    // Rule Lifecycle
    effectiveDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        default: null
    },
    // Priority for multiple rules (higher = more priority)
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 100
    },
    // Timezone support
    timezone: {
        type: String,
        default: null,
        trim: true
    },
    // Office hours (timezone-aware)
    officeHours: {
        startTime: {
            type: String, // Format: "HH:mm" (e.g., "09:00")
            default: "09:00"
        },
        endTime: {
            type: String, // Format: "HH:mm" (e.g., "17:00")
            default: "17:00"
        }
    },
    // Check-in and Check-out Time Configuration
    checkInOutTimes: {
        checkInStartTime: {
            type: String, // Format: "HH:mm" (e.g., "08:00")
            default: "09:00"
        },
        checkInEndTime: {
            type: String, // Format: "HH:mm" (e.g., "10:00")
            default: "10:00"
        },
        checkOutStartTime: {
            type: String, // Format: "HH:mm" (e.g., "17:00")
            default: "17:00"
        },
        checkOutEndTime: {
            type: String, // Format: "HH:mm" (e.g., "18:00")
            default: "18:00"
        },
        // Grace periods
        checkInGracePeriod: {
            type: Number, // minutes
            default: 15,
            min: 0,
            max: 120
        },
        checkOutGracePeriod: {
            type: Number, // minutes
            default: 30,
            min: 0,
            max: 120
        }
    },
    // Auto Check-out Configuration
    autoCheckOut: {
        enabled: {
            type: Boolean,
            default: false
        },
        time: {
            type: String, // Format: "HH:mm" (e.g., "18:00")
            default: "18:00"
        },
        notifyBeforeMinutes: {
            type: Number, // Notify X minutes before auto check-out
            default: 15,
            min: 5,
            max: 60
        }
    },
    // Time Stop Configuration (stop tracking after this time)
    timeStop: {
        enabled: {
            type: Boolean,
            default: false
        },
        time: {
            type: String, // Format: "HH:mm" (e.g., "20:00")
            default: "20:00"
        },
        action: {
            type: String,
            enum: ['stop_tracking', 'auto_checkout', 'warning'],
            default: 'auto_checkout'
        }
    },
    // Shift support (for multi-shift operations)
    shifts: [{
        name: {
            type: String,
            required: true
        },
        startTime: {
            type: String, // Format: "HH:mm"
            required: true
        },
        endTime: {
            type: String, // Format: "HH:mm"
            required: true
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    }],
    // Employee/Role Exceptions
    exceptions: {
        exemptEmployees: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }],
        exemptRoles: [{
            type: String
        }],
        exemptDepartments: [{
            type: String
        }],
        customRadiusEmployees: [{
            employeeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Employee'
            },
            customRadius: {
                type: Number,
                min: 50,
                max: 1000
            }
        }]
    },
    // Security Settings
    security: {
        enableGPSValidation: {
            type: Boolean,
            default: true
        },
        enableDeviceFingerprinting: {
            type: Boolean,
            default: false
        },
        enableImageCapture: {
            type: Boolean,
            default: false
        },
        enableOTP: {
            type: Boolean,
            default: false
        },
        minGPSAccuracy: {
            type: Number,
            default: 100, // meters
            min: 10,
            max: 500
        },
        allowIPFallback: {
            type: Boolean,
            default: true
        },
        maxIPDistanceKm: {
            type: Number,
            default: 50, // km
            min: 1,
            max: 1000
        }
    },
    // Geocoding cache settings
    geocodingCache: {
        enabled: {
            type: Boolean,
            default: true
        },
        ttl: {
            type: Number,
            default: 86400 // 24 hours in seconds
        }
    }
}, { timestamps: true });

// Add database indexes
attendanceRuleSchema.index({ location: 1 });
attendanceRuleSchema.index({ isActive: 1 });
attendanceRuleSchema.index({ coordinates: '2dsphere' }); // Geospatial index for location queries
attendanceRuleSchema.index({ organizationId: 1, isActive: 1, priority: -1 }); // Compound index for rule queries
attendanceRuleSchema.index({ effectiveDate: 1, expiryDate: 1 }); // Lifecycle index
attendanceRuleSchema.index({ version: 1, parentRuleId: 1 }); // Versioning index

const AttendanceRule = mongoose.model("AttendanceRule", attendanceRuleSchema, "attendanceRules");

export default AttendanceRule;

