import AttendanceRule from '../../models/attendanceRule.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError } from '../../helpers/responseHelper.js';

// Create or update attendance rule
export const createOrUpdateAttendanceRule = async (req, res) => {
    try {
        logger.info('Attendance rule request', {
            location: req.body.location,
            adminId: req.user._id
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

        // Validate coordinates - allow default (0,0) for initial setup
        if (!coordinates || coordinates.latitude === undefined || coordinates.longitude === undefined) {
            return sendValidationError(res, { coordinates: 'Coordinates are required' });
        }

        // Validate maximum radius
        if (maximumRadius < 50 || maximumRadius > 1000) {
            return sendValidationError(res, { maximumRadius: 'Maximum radius must be between 50 and 1000 meters' });
        }

        // Check if a rule already exists
        let attendanceRule = await AttendanceRule.findOne({ isActive: true });

        if (attendanceRule) {
            // Update existing rule
            attendanceRule.location = location;
            attendanceRule.address = address;
            attendanceRule.coordinates = coordinates;
            attendanceRule.maximumRadius = maximumRadius || 500;
            attendanceRule.enableCompOff = enableCompOff !== undefined ? enableCompOff : true;
            attendanceRule.autoApprove = autoApprove !== undefined ? autoApprove : false;
            attendanceRule.enableSimplePunches = enableSimplePunches !== undefined ? enableSimplePunches : false;
            attendanceRule.enablePenaltyRules = enablePenaltyRules !== undefined ? enablePenaltyRules : true;

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

            await attendanceRule.save();

            return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule updated successfully');
        } else {
            // Create new rule
            attendanceRule = await AttendanceRule.create({
                location,
                address,
                coordinates,
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
                createdBy: req.user?._id || null
            });

            return sendSuccess(res, { rule: attendanceRule }, 'Attendance rule created successfully', 201);
        }
    } catch (error) {
        logger.error('Error creating/updating attendance rule', {
            error: error.message,
            stack: error.stack,
            adminId: req.user._id
        });
        return sendInternalError(res, 'Failed to save attendance rule', error);
    }
};

// Get current attendance rule
export const getAttendanceRule = async (req, res) => {
    try {
        const attendanceRule = await AttendanceRule.findOne({ isActive: true });

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
                    applicableDepartments: []
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
        const rules = await AttendanceRule.find().sort({ createdAt: -1 });

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

        const attendanceRule = await AttendanceRule.findByIdAndUpdate(
            ruleId,
            { isActive: false },
            { new: true }
        );

        if (!attendanceRule) {
            return sendNotFound(res, 'Attendance rule');
        }

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

        const attendanceRule = await AttendanceRule.findOne({ isActive: true });

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

