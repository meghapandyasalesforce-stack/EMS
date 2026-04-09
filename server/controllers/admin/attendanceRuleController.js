import AttendanceRule from '../../models/attendanceRule.model.js';
import AttendanceRuleAudit from '../../models/attendanceRuleAudit.model.js';
import Calendar from '../../models/calendar.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError } from '../../helpers/responseHelper.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { geocodeAddress, isGeocodingAvailable } from '../../helpers/geocodingService.js';

// Helper to get client IP
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip ||
           req.connection?.remoteAddress ||
           'unknown';
};

// Helper to create audit log
const createAuditLog = async (ruleId, organizationId, action, changedBy, changedByRole, previousState, newState, fieldChanges, changeReason, req) => {
    try {
        await AttendanceRuleAudit.create({
            ruleId,
            organizationId,
            action,
            changedBy,
            changedByRole,
            previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
            newState: newState ? JSON.parse(JSON.stringify(newState)) : null,
            fieldChanges,
            changeReason,
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });
    } catch (error) {
        logger.error('Failed to create audit log', {
            error: error.message,
            ruleId,
            action
        });
        // Don't throw - audit logging failure shouldn't break the main operation
    }
};

// Helper to detect field changes
const detectFieldChanges = (oldRule, newRule) => {
    const changes = [];
    const fieldsToCheck = [
        'location', 'address', 'coordinates', 'maximumRadius',
        'enableCompOff', 'autoApprove', 'enableSimplePunches', 'enablePenaltyRules',
        'penaltyRules', 'compOffRules', 'applicableDepartments',
        'timezone', 'officeHours', 'shifts', 'exceptions', 'security'
    ];

    fieldsToCheck.forEach(field => {
        const oldValue = oldRule?.[field];
        const newValue = newRule?.[field];
        
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
                field,
                oldValue,
                newValue
            });
        }
    });

    return changes;
};

// Sync attendance office hours to current-year calendar working hours.
const syncCalendarWorkingHoursFromRule = async (req, organizationId, officeHours) => {
    if (!officeHours?.startTime || !officeHours?.endTime) return;

    const currentYear = new Date().getFullYear();
    const query = addOrganizationFilter(req, { year: currentYear });
    let calendar = await Calendar.findOne(query);

    if (!calendar) {
        calendar = new Calendar({
            organizationId,
            year: currentYear,
            holidays: [],
            workingDays: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false
            },
            workingHours: {
                startTime: officeHours.startTime,
                endTime: officeHours.endTime,
                breakDuration: 60
            },
            companySettings: {
                timezone: "UTC",
                dateFormat: "DD/MM/YYYY",
                weekStartsOn: "monday"
            }
        });
    } else {
        calendar.workingHours = {
            ...calendar.workingHours,
            startTime: officeHours.startTime,
            endTime: officeHours.endTime
        };
    }

    await calendar.save();
};

// Create or update attendance rule
export const createOrUpdateAttendanceRule = async (req, res) => {
    try {
        logger.info('Attendance rule request', {
            location: req.body.location,
            adminId: req.user?._id || req.employee?._id
        });
        
        const {
            location,
            address,
            coordinates,
            maximumRadius,
            enableCompOff,
            autoApprove,
            enableSimplePunches,
            enablePenaltyRules,
            penaltyRules,
            compOffRules,
            applicableDepartments
        } = req.body;

        let finalCoordinates = coordinates;
        let finalAddress = address;

        // Auto-geocode address if coordinates are missing or default (0,0) and address is provided
        if (address && (!coordinates || 
            coordinates.latitude === 0 || 
            coordinates.longitude === 0 || 
            coordinates.latitude === undefined || 
            coordinates.longitude === undefined)) {
            
            if (isGeocodingAvailable()) {
                try {
                    logger.info('Auto-geocoding address for attendance rule', { address });
                    const geocodeResult = await geocodeAddress(address);
                    
                    finalCoordinates = {
                        latitude: geocodeResult.latitude,
                        longitude: geocodeResult.longitude
                    };
                    
                    // Use formatted address from Google if available
                    if (geocodeResult.formattedAddress) {
                        finalAddress = geocodeResult.formattedAddress;
                    }
                    
                    logger.info('Address geocoded successfully', {
                        address,
                        coordinates: finalCoordinates,
                        formattedAddress: finalAddress
                    });
                } catch (geocodeError) {
                    logger.warn('Geocoding failed, using provided coordinates', {
                        error: geocodeError.message,
                        address
                    });
                    // If geocoding fails, validate that coordinates are provided
                    if (!coordinates || coordinates.latitude === undefined || coordinates.longitude === undefined) {
                        return sendValidationError(res, { 
                            address: `Could not geocode address. Please provide valid coordinates manually. Error: ${geocodeError.message}` 
                        });
                    }
                }
            } else {
                // Geocoding not available, require coordinates
                if (!coordinates || coordinates.latitude === undefined || coordinates.longitude === undefined) {
                    return sendValidationError(res, { 
                        coordinates: 'Coordinates are required when geocoding is not available' 
                    });
                }
            }
        }

        // Validate coordinates
        if (!finalCoordinates || finalCoordinates.latitude === undefined || finalCoordinates.longitude === undefined) {
            return sendValidationError(res, { coordinates: 'Coordinates are required' });
        }

        // Validate coordinate values
        if (finalCoordinates.latitude === 0 && finalCoordinates.longitude === 0) {
            return sendValidationError(res, { 
                coordinates: 'Invalid coordinates (0,0). Please provide a valid address or coordinates.' 
            });
        }

        // Validate maximum radius
        if (maximumRadius < 50 || maximumRadius > 1000) {
            return sendValidationError(res, { maximumRadius: 'Maximum radius must be between 50 and 1000 meters' });
        }

        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Create/update attendance rule error: Missing organizationId', {
                hasUser: !!req.user,
                hasEmployee: !!req.employee
            });
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Check if a rule already exists
        const query = addOrganizationFilter(req, { isActive: true });
        let attendanceRule = await AttendanceRule.findOne(query);

        if (attendanceRule) {
            // Store previous state for audit
            const previousState = attendanceRule.toObject();
            
            // Increment version for rule versioning
            const newVersion = (attendanceRule.version || 1) + 1;
            const parentRuleId = attendanceRule._id;

            // Update existing rule
            attendanceRule.location = location;
            attendanceRule.address = finalAddress || address;
            attendanceRule.coordinates = finalCoordinates;
            attendanceRule.maximumRadius = maximumRadius || 500;
            attendanceRule.enableCompOff = enableCompOff !== undefined ? enableCompOff : true;
            attendanceRule.autoApprove = autoApprove !== undefined ? autoApprove : false;
            attendanceRule.enableSimplePunches = enableSimplePunches !== undefined ? enableSimplePunches : false;
            attendanceRule.enablePenaltyRules = enablePenaltyRules !== undefined ? enablePenaltyRules : true;

            // Update new fields if provided
            if (req.body.timezone) attendanceRule.timezone = req.body.timezone;
            if (req.body.officeHours) attendanceRule.officeHours = req.body.officeHours;
            if (req.body.checkInOutTimes) attendanceRule.checkInOutTimes = req.body.checkInOutTimes;
            if (req.body.autoCheckOut) attendanceRule.autoCheckOut = req.body.autoCheckOut;
            if (req.body.timeStop) attendanceRule.timeStop = req.body.timeStop;
            if (req.body.shifts) attendanceRule.shifts = req.body.shifts;
            if (req.body.exceptions) attendanceRule.exceptions = req.body.exceptions;
            if (req.body.security) attendanceRule.security = req.body.security;
            if (req.body.priority) attendanceRule.priority = req.body.priority;
            if (req.body.effectiveDate) attendanceRule.effectiveDate = new Date(req.body.effectiveDate);
            if (req.body.expiryDate) attendanceRule.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;

            if (penaltyRules) {
                attendanceRule.penaltyRules = penaltyRules;
            }

            if (compOffRules) {
                attendanceRule.compOffRules = compOffRules;
            }

            if (applicableDepartments) {
                attendanceRule.applicableDepartments = applicableDepartments;
            }

            attendanceRule.createdBy = req.user?._id || attendanceRule.createdBy;
            attendanceRule.version = newVersion;

            await attendanceRule.save();

            // Create audit log
            const newState = attendanceRule.toObject();
            const fieldChanges = detectFieldChanges(previousState, newState);
            const changedBy = req.user?._id || req.employee?._id;
            const changedByRole = req.user?.role || (req.employee ? 'hr' : 'admin');

            await createAuditLog(
                attendanceRule._id,
                organizationId,
                'updated',
                changedBy,
                changedByRole,
                previousState,
                newState,
                fieldChanges,
                req.body.changeReason || null,
                req
            );

            // Keep calendar working hours in sync with attendance office hours.
            try {
                await syncCalendarWorkingHoursFromRule(req, organizationId, attendanceRule.officeHours);
            } catch (syncError) {
                logger.error('Sync attendance->calendar working hours failed', {
                    error: syncError.message,
                    stack: syncError.stack,
                    organizationId
                });
            }

            return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule updated successfully');
        } else {
            // Create new rule
            attendanceRule = await AttendanceRule.create({
                organizationId, // Add organizationId for multi-tenancy
                location,
                address: finalAddress || address,
                coordinates: finalCoordinates,
                maximumRadius: maximumRadius || 500,
                enableCompOff: enableCompOff !== undefined ? enableCompOff : true,
                autoApprove: autoApprove !== undefined ? autoApprove : false,
                enableSimplePunches: enableSimplePunches !== undefined ? enableSimplePunches : false,
                enablePenaltyRules: enablePenaltyRules !== undefined ? enablePenaltyRules : true,
                penaltyRules: penaltyRules || {},
                compOffRules: compOffRules || {
                    allowedPerMonth: 2,
                    maxAccumulation: 5,
                    validity: 90
                },
                applicableDepartments: applicableDepartments || [],
                createdBy: req.user?._id || req.employee?._id || null,
                version: 1,
                effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : new Date(),
                expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
                timezone: req.body.timezone || 'UTC',
                officeHours: req.body.officeHours || { startTime: '09:00', endTime: '17:00' },
                checkInOutTimes: req.body.checkInOutTimes || {
                    checkInStartTime: '09:00',
                    checkInEndTime: '10:00',
                    checkOutStartTime: '17:00',
                    checkOutEndTime: '18:00',
                    checkInGracePeriod: 15,
                    checkOutGracePeriod: 30
                },
                autoCheckOut: req.body.autoCheckOut || {
                    enabled: false,
                    time: '18:00',
                    notifyBeforeMinutes: 15
                },
                timeStop: req.body.timeStop || {
                    enabled: false,
                    time: '20:00',
                    action: 'auto_checkout'
                },
                shifts: req.body.shifts || [],
                exceptions: req.body.exceptions || {},
                security: req.body.security || {
                    enableGPSValidation: true,
                    enableDeviceFingerprinting: false,
                    enableImageCapture: false,
                    enableOTP: false,
                    minGPSAccuracy: 100,
                    allowIPFallback: true,
                    maxIPDistanceKm: 50
                },
                priority: req.body.priority || 1
            });

            // Create audit log for creation
            const changedBy = req.user?._id || req.employee?._id;
            const changedByRole = req.user?.role || (req.employee ? 'hr' : 'admin');

            await createAuditLog(
                attendanceRule._id,
                organizationId,
                'created',
                changedBy,
                changedByRole,
                null,
                attendanceRule.toObject(),
                [],
                req.body.changeReason || null,
                req
            );

            // Keep calendar working hours in sync with attendance office hours.
            try {
                await syncCalendarWorkingHoursFromRule(req, organizationId, attendanceRule.officeHours);
            } catch (syncError) {
                logger.error('Sync attendance->calendar working hours failed', {
                    error: syncError.message,
                    stack: syncError.stack,
                    organizationId
                });
            }

            return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule created successfully', 201);
        }
    } catch (error) {
        logger.error('Error creating/updating attendance rule', {
            error: error.message,
            stack: error.stack,
            adminId: req.user?._id || req.employee?._id
        });
        return sendInternalError(res, 'Failed to save attendance rule', error);
    }
};

// Get current attendance rule
export const getAttendanceRule = async (req, res) => {
    try {
        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Get attendance rule error: Missing organizationId', {
                hasUser: !!req.user,
                hasEmployee: !!req.employee
            });
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Get active rule with priority and lifecycle check
        const now = new Date();
        const query = addOrganizationFilter(req, { 
            isActive: true,
            effectiveDate: { $lte: now },
            $or: [
                { expiryDate: null },
                { expiryDate: { $gte: now } }
            ]
        });
        
        // Get rule with highest priority
        const attendanceRule = await AttendanceRule.findOne(query)
            .sort({ priority: -1, createdAt: -1 })
            .lean();

        if (!attendanceRule) {
            // Return a sane default instead of 404 to simplify client UX
            return sendSuccess(res, {
                rule: {
                    location: '',
                    address: '',
                    coordinates: { latitude: 0, longitude: 0 },
                    maximumRadius: 500,
                    enableCompOff: true,
                    autoApprove: false,
                    enableSimplePunches: false,
                    enablePenaltyRules: true,
                    penaltyRules: {},
                    compOffRules: { allowedPerMonth: 2, maxAccumulation: 5, validity: 90 },
                    applicableDepartments: [],
                    officeHours: { startTime: '09:00', endTime: '17:00' },
                    checkInOutTimes: {
                        checkInStartTime: '09:00',
                        checkInEndTime: '10:00',
                        checkOutStartTime: '17:00',
                        checkOutEndTime: '18:00',
                        checkInGracePeriod: 15,
                        checkOutGracePeriod: 30
                    },
                    autoCheckOut: {
                        enabled: false,
                        time: '18:00',
                        notifyBeforeMinutes: 15
                    },
                    timeStop: {
                        enabled: false,
                        time: '20:00',
                        action: 'auto_checkout'
                    }
                }
            }, 'Default attendance rule retrieved');
        }

        return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule retrieved successfully');
    } catch (error) {
        logger.error('Error fetching attendance rule', {
            error: error.message,
            stack: error.stack
        });
        return sendInternalError(res, 'Failed to fetch attendance rule', error);
    }
};

// Get all attendance rules (including inactive)
export const getAllAttendanceRules = async (req, res) => {
    try {
        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Get all attendance rules error: Missing organizationId', {
                hasUser: !!req.user,
                hasEmployee: !!req.employee
            });
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, {});
        const rules = await AttendanceRule.find(query).sort({ createdAt: -1 });

        return sendSuccess(res, { count: rules.length, rules }, 'Attendance rules retrieved successfully');
    } catch (error) {
        logger.error('Error fetching attendance rules', {
            error: error.message,
            stack: error.stack
        });
        return sendInternalError(res, 'Failed to fetch attendance rules', error);
    }
};

// Deactivate attendance rule
export const deactivateAttendanceRule = async (req, res) => {
    try {
        const { ruleId } = req.params;
        
        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const attendanceRule = await AttendanceRule.findOne({ _id: ruleId, organizationId });
        
        if (!attendanceRule) {
            return sendNotFound(res, 'Attendance rule');
        }

        // Store previous state for audit
        const previousState = attendanceRule.toObject();

        // Deactivate
        attendanceRule.isActive = false;
        await attendanceRule.save();

        // Create audit log
        const changedBy = req.user?._id || req.employee?._id;
        const changedByRole = req.user?.role || (req.employee ? 'hr' : 'admin');

        await createAuditLog(
            attendanceRule._id,
            organizationId,
            'deactivated',
            changedBy,
            changedByRole,
            previousState,
            attendanceRule.toObject(),
            [{ field: 'isActive', oldValue: true, newValue: false }],
            req.body.reason || null,
            req
        );

        return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule deactivated successfully');
    } catch (error) {
        logger.error('Error deactivating attendance rule', {
            error: error.message,
            stack: error.stack,
            ruleId: req.params.ruleId
        });
        return sendInternalError(res, 'Failed to deactivate attendance rule', error);
    }
};

// Check if user is within attendance radius
export const checkAttendanceRadius = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return sendValidationError(res, { coordinates: 'Latitude and longitude are required' });
        }

        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const query = organizationId 
            ? { isActive: true, organizationId }
            : { isActive: true };
        
        const attendanceRule = await AttendanceRule.findOne(query);

        if (!attendanceRule) {
            return sendNotFound(res, 'Attendance rule');
        }

        // Calculate distance using Haversine formula
        const R = 6371000; // Earth's radius in meters
        const dLat = (latitude - attendanceRule.coordinates.latitude) * Math.PI / 180;
        const dLon = (longitude - attendanceRule.coordinates.longitude) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(attendanceRule.coordinates.latitude * Math.PI / 180) *
            Math.cos(latitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        const isWithinRadius = distance <= attendanceRule.maximumRadius;

        return sendSuccess(res, {
            isWithinRadius,
            distance: Math.round(distance),
            maximumRadius: attendanceRule.maximumRadius,
            location: attendanceRule.location
        }, 'Radius check completed successfully');
    } catch (error) {
        logger.error('Error checking attendance radius', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee?._id || req.user?._id
        });
        return sendInternalError(res, 'Failed to check attendance radius', error);
    }
};

