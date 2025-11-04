import AttendanceRule from '../../models/attendanceRule.model.js';

// Create or update attendance rule
export const createOrUpdateAttendanceRule = async (req, res) => {
    try {
        console.log('=== Attendance Rule Request ===');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('User:', req.user);
        
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
            return res.status(400).json({
                success: false,
                message: 'Coordinates are required'
            });
        }

        // Validate maximum radius
        if (maximumRadius < 50 || maximumRadius > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum radius must be between 50 and 1000 meters'
            });
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

            return res.status(200).json({
                success: true,
                message: 'Attendance rule updated successfully',
                rule: attendanceRule
            });
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

            return res.status(201).json({
                success: true,
                message: 'Attendance rule created successfully',
                rule: attendanceRule
            });
        }
    } catch (error) {
        console.error('Error creating/updating attendance rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save attendance rule',
            error: error.message
        });
    }
};

// Get current attendance rule
export const getAttendanceRule = async (req, res) => {
    try {
        const attendanceRule = await AttendanceRule.findOne({ isActive: true });

        if (!attendanceRule) {
            // Return a sane default instead of 404 to simplify client UX
            return res.status(200).json({
                success: true,
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
            });
        }

        return res.status(200).json({
            success: true,
            rule: attendanceRule
        });
    } catch (error) {
        console.error('Error fetching attendance rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance rule',
            error: error.message
        });
    }
};

// Get all attendance rules (including inactive)
export const getAllAttendanceRules = async (req, res) => {
    try {
        const rules = await AttendanceRule.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: rules.length,
            rules
        });
    } catch (error) {
        console.error('Error fetching attendance rules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance rules',
            error: error.message
        });
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
            return res.status(404).json({
                success: false,
                message: 'Attendance rule not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Attendance rule deactivated successfully',
            rule: attendanceRule
        });
    } catch (error) {
        console.error('Error deactivating attendance rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to deactivate attendance rule',
            error: error.message
        });
    }
};

// Check if user is within attendance radius
export const checkAttendanceRadius = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const attendanceRule = await AttendanceRule.findOne({ isActive: true });

        if (!attendanceRule) {
            return res.status(404).json({
                success: false,
                message: 'No attendance rule found'
            });
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

        return res.status(200).json({
            success: true,
            isWithinRadius,
            distance: Math.round(distance),
            maximumRadius: attendanceRule.maximumRadius,
            location: attendanceRule.location
        });
    } catch (error) {
        console.error('Error checking attendance radius:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check attendance radius',
            error: error.message
        });
    }
};

