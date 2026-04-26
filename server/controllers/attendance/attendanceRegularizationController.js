import AttendanceRegularization from '../../models/attendanceRegularization.model.js';
import Attendance from '../../models/attendance.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { getManagerEmployeeIds, isEmployeeLinkedToManager } from '../../helpers/managerHelper.js';

/**
 * Create a new attendance regularization request
 * POST /api/v1/attendance-regularization/request
 */
export const createRegularizationRequest = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);
        
        const {
            attendanceDate,
            regularizationType,
            requestedClockIn,
            requestedClockOut,
            reason,
            supportingDocuments
        } = req.body;

        // Validation
        if (!attendanceDate || !regularizationType || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Attendance date, regularization type, and reason are required'
            });
        }

        // Validate regularization type
        const validTypes = ['missing_clock_in', 'missing_clock_out', 'both', 'incorrect_time', 'full_day'];
        if (!validTypes.includes(regularizationType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid regularization type'
            });
        }

        // Enforce current-month-only regularization
        const requestedDate = new Date(attendanceDate);
        if (Number.isNaN(requestedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid attendance date'
            });
        }
        const now = new Date();
        const isCurrentMonth =
            requestedDate.getFullYear() === now.getFullYear() &&
            requestedDate.getMonth() === now.getMonth();
        if (!isCurrentMonth) {
            return res.status(400).json({
                success: false,
                message: 'Regularization is allowed only for the current month.'
            });
        }

        // Enforce monthly request cap (count only pending + approved)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const monthlyRequestCount = await AttendanceRegularization.countDocuments({
            organizationId,
            employeeId,
            attendanceDate: { $gte: monthStart, $lt: nextMonthStart },
            status: { $in: ['pending', 'approved'] }
        });
        if (monthlyRequestCount >= 5) {
            return res.status(400).json({
                success: false,
                message: 'Monthly regularization limit reached (max 5 requests for pending/approved).'
            });
        }

        // Validate dates based on type
        if (regularizationType === 'missing_clock_in' || regularizationType === 'both' || regularizationType === 'incorrect_time') {
            if (!requestedClockIn) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested clock-in time is required for this regularization type'
                });
            }
        }

        if (regularizationType === 'missing_clock_out' || regularizationType === 'both' || regularizationType === 'incorrect_time') {
            if (!requestedClockOut) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested clock-out time is required for this regularization type'
                });
            }
        }

        // Check if a request already exists for this date
        const existingRequest = await AttendanceRegularization.findOne({
            employeeId,
            attendanceDate: requestedDate,
            status: { $in: ['pending', 'approved'] },
            organizationId
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'A regularization request already exists for this date'
            });
        }

        // Find the employee's manager
        // First, try to find manager by department (manager with same department)
        const employee = await Employee.findById(employeeId).select('department position').lean();
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Find manager in the same department
        let manager = await Employee.findOne({
            organizationId,
            department: employee.department,
            position: { $in: ['Manager', 'Director'] },
            status: 'active'
        }).select('_id').lean();

        // If no manager found in department, find any manager in the organization
        if (!manager) {
            manager = await Employee.findOne({
                organizationId,
                $or: [
                    { position: 'Manager' },
                    { position: 'Director' },
                    { jobTitle: { $regex: /manager|director/i } }
                ],
                status: 'active'
            }).select('_id').lean();
        }

        if (!manager) {
            return res.status(404).json({
                success: false,
                message: 'No manager found to assign this request. Please contact HR.'
            });
        }

        // Create the regularization request
        const regularizationRequest = new AttendanceRegularization({
            organizationId,
            employeeId,
            managerId: manager._id,
            attendanceDate: requestedDate,
            regularizationType,
            requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : undefined,
            requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : undefined,
            reason,
            supportingDocuments: supportingDocuments || [],
            status: 'pending'
        });

        await regularizationRequest.save();

        // Populate employee and manager details for response
        await regularizationRequest.populate('employeeId', 'name lastName email employeeId department');
        await regularizationRequest.populate('managerId', 'name lastName email employeeId');

        logger.info('Attendance regularization request created', {
            requestId: regularizationRequest._id,
            employeeId,
            managerId: manager._id,
            attendanceDate
        });

        res.status(201).json({
            success: true,
            message: 'Regularization request submitted successfully',
            data: regularizationRequest
        });
    } catch (error) {
        logger.error('Create Regularization Request Error', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee._id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to create regularization request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get employee's own regularization requests
 * GET /api/v1/attendance-regularization/request
 */
export const getMyRegularizationRequests = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);
        const { status, page = 1, limit = 20 } = req.query;

        const query = {
            employeeId,
            organizationId
        };

        if (status) {
            query.status = status;
        }

        const { page: parsedPage, limit: parsedLimit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

        const [requests, total] = await Promise.all([
            AttendanceRegularization.find(query)
                .populate('managerId', 'name lastName email employeeId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            AttendanceRegularization.countDocuments(query)
        ]);

        return sendPaginatedResponse(
            res,
            requests,
            parsedPage,
            parsedLimit,
            total,
            'Regularization requests retrieved successfully'
        );
    } catch (error) {
        logger.error('Get My Regularization Requests Error', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee._id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch regularization requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get regularization requests for manager (team requests)
 * GET /api/v1/attendance-regularization/manager/requests
 */
export const getRegularizationRequestsForManager = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { status, page = 1, limit = 20 } = req.query;

        // If user is a manager (not admin or HR), filter by their department
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let query = addOrganizationFilter(req, {});

        if (isManager && req.employee) {
            const managerId = req.employee._id;
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();

            // Get all employees linked to this manager
            // Example: Manager "Arun Kumar" sees requests for employees with manager="Arun Kumar" or "Arun"
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);

            // Filter requests for employees linked to this manager
            query.employeeId = { $in: managerEmployeeIds };
            query.managerId = managerId; // Also ensure manager is assigned

            logger.info('Manager filtering regularization requests by manager field', {
                managerId: managerId,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        } else if (req.user) {
            // Admin can see all requests
            // No additional filtering needed
        } else if (req.employee?.isHR) {
            // HR can see all requests in their organization
            // No additional filtering needed
        }

        if (status) {
            query.status = status;
        }

        const { page: parsedPage, limit: parsedLimit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

        const [requests, total] = await Promise.all([
            AttendanceRegularization.find(query)
                .populate('employeeId', 'name lastName email employeeId department')
                .populate('managerId', 'name lastName email employeeId')
                .populate('reviewedBy', 'name lastName email employeeId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            AttendanceRegularization.countDocuments(query)
        ]);

        return sendPaginatedResponse(
            res,
            requests,
            parsedPage,
            parsedLimit,
            total,
            'Regularization requests retrieved successfully'
        );
    } catch (error) {
        logger.error('Get Regularization Requests For Manager Error', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch regularization requests',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Approve a regularization request
 * PATCH /api/v1/attendance-regularization/manager/approve/:id
 */
export const approveRegularization = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const reviewerId = req.user?._id || req.employee?._id;

        const regularizationRequest = await AttendanceRegularization.findById(id)
            .populate('employeeId', 'department');

        if (!regularizationRequest) {
            return res.status(404).json({
                success: false,
                message: 'Regularization request not found'
            });
        }

        // Check organization match
        if (regularizationRequest.organizationId.toString() !== organizationId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // If user is a manager, verify they can approve this request
        // Example: Manager "Arun Kumar" can only approve requests for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = await Employee.findById(regularizationRequest.employeeId?._id || regularizationRequest.employeeId)
                .select('manager').lean();
            
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found.'
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(employee, req.employee);
            
            if (!isLinked) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to approve regularization for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    requestId: id
                });
                return res.status(403).json({
                    success: false,
                    message: 'You can only approve regularization requests for employees linked to you.'
                });
            }
        }

        if (regularizationRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request is already ${regularizationRequest.status}`
            });
        }

        // Update request status
        regularizationRequest.status = 'approved';
        regularizationRequest.reviewedBy = reviewerId;
        regularizationRequest.reviewedAt = new Date();
        regularizationRequest.managerResponse = req.body.managerResponse || 'Approved';

        await regularizationRequest.save();

        // Create or update attendance record
        const attendanceDate = new Date(regularizationRequest.attendanceDate);
        const startOfDay = new Date(attendanceDate);
        startOfDay.setHours(0, 0, 0, 0);

        let attendanceRecord = await Attendance.findOne({
            userId: regularizationRequest.employeeId._id || regularizationRequest.employeeId,
            date: startOfDay,
            organizationId
        });

        // Prepare clock in/out times
        let clockInTime = regularizationRequest.requestedClockIn;
        let clockOutTime = regularizationRequest.requestedClockOut;

        // If times not provided, use default office hours
        if (!clockInTime) {
            clockInTime = new Date(startOfDay);
            clockInTime.setHours(9, 0, 0, 0);
        }
        if (!clockOutTime) {
            clockOutTime = new Date(startOfDay);
            clockOutTime.setHours(17, 0, 0, 0);
        }

        if (!attendanceRecord) {
            // Create new attendance record
            attendanceRecord = new Attendance({
                organizationId,
                userId: regularizationRequest.employeeId._id || regularizationRequest.employeeId,
                date: startOfDay,
                clockIn: clockInTime,
                clockOut: clockOutTime,
                status: 'present',
                workLocation: 'office'
            });
        } else {
            // Update existing attendance record
            if (regularizationRequest.requestedClockIn) {
                attendanceRecord.clockIn = clockInTime;
            }
            if (regularizationRequest.requestedClockOut) {
                attendanceRecord.clockOut = clockOutTime;
            }
            attendanceRecord.status = 'present';
        }

        try {
            await attendanceRecord.save();
        } catch (saveError) {
            // If another request inserted the same (org,user,date) row in parallel,
            // reuse that row and apply the requested update.
            if (saveError?.code === 11000) {
                attendanceRecord = await Attendance.findOne({
                    userId: regularizationRequest.employeeId._id || regularizationRequest.employeeId,
                    date: startOfDay,
                    organizationId
                });

                if (!attendanceRecord) {
                    throw saveError;
                }

                if (regularizationRequest.requestedClockIn) {
                    attendanceRecord.clockIn = clockInTime;
                }
                if (regularizationRequest.requestedClockOut) {
                    attendanceRecord.clockOut = clockOutTime;
                }
                attendanceRecord.status = 'present';
                await attendanceRecord.save();
            } else {
                throw saveError;
            }
        }

        // Link attendance record to regularization request
        regularizationRequest.attendanceRecordId = attendanceRecord._id;
        await regularizationRequest.save();

        // Populate for response
        await regularizationRequest.populate('employeeId', 'name lastName email employeeId department');
        await regularizationRequest.populate('managerId', 'name lastName email employeeId');
        await regularizationRequest.populate('reviewedBy', 'name lastName email employeeId');

        logger.info('Attendance regularization approved', {
            requestId: id,
            reviewerId,
            employeeId: regularizationRequest.employeeId._id,
            attendanceRecordId: attendanceRecord._id
        });

        res.json({
            success: true,
            message: 'Regularization request approved and attendance record updated',
            data: regularizationRequest
        });
    } catch (error) {
        logger.error('Approve Regularization Error', {
            error: error.message,
            stack: error.stack,
            requestId: req.params.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to approve regularization request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Reject a regularization request
 * PATCH /api/v1/attendance-regularization/manager/reject/:id
 */
export const rejectRegularization = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const organizationId = getOrganizationId(req);
        const reviewerId = req.user?._id || req.employee?._id;

        const regularizationRequest = await AttendanceRegularization.findById(id)
            .populate('employeeId', 'department');

        if (!regularizationRequest) {
            return res.status(404).json({
                success: false,
                message: 'Regularization request not found'
            });
        }

        // Check organization match
        if (regularizationRequest.organizationId.toString() !== organizationId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // If user is a manager, verify they can reject this request
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const employee = regularizationRequest.employeeId;
            if (employee.department !== req.employee.department) {
                logger.warn('Manager trying to reject regularization outside their department', {
                    managerId: req.employee._id,
                    managerDepartment: req.employee.department,
                    employeeDepartment: employee.department,
                    requestId: id
                });
                return res.status(403).json({
                    success: false,
                    message: 'You can only reject regularization requests for employees in your department.'
                });
            }
        }

        if (regularizationRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request is already ${regularizationRequest.status}`
            });
        }

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        // Update request status
        regularizationRequest.status = 'rejected';
        regularizationRequest.reviewedBy = reviewerId;
        regularizationRequest.reviewedAt = new Date();
        regularizationRequest.managerResponse = rejectionReason;

        await regularizationRequest.save();

        // Populate for response
        await regularizationRequest.populate('employeeId', 'name lastName email employeeId department');
        await regularizationRequest.populate('managerId', 'name lastName email employeeId');
        await regularizationRequest.populate('reviewedBy', 'name lastName email employeeId');

        logger.info('Attendance regularization rejected', {
            requestId: id,
            reviewerId,
            employeeId: regularizationRequest.employeeId._id
        });

        res.json({
            success: true,
            message: 'Regularization request rejected',
            data: regularizationRequest
        });
    } catch (error) {
        logger.error('Reject Regularization Error', {
            error: error.message,
            stack: error.stack,
            requestId: req.params.id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to reject regularization request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Cancel own regularization request (employee only, if pending)
 * PATCH /api/v1/attendance-regularization/request/:id/cancel
 */
export const cancelRegularizationRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);

        const regularizationRequest = await AttendanceRegularization.findOne({
            _id: id,
            employeeId,
            organizationId
        });

        if (!regularizationRequest) {
            return res.status(404).json({
                success: false,
                message: 'Regularization request not found'
            });
        }

        if (regularizationRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel request that is already ${regularizationRequest.status}`
            });
        }

        regularizationRequest.status = 'cancelled';
        await regularizationRequest.save();

        logger.info('Attendance regularization request cancelled', {
            requestId: id,
            employeeId
        });

        res.json({
            success: true,
            message: 'Regularization request cancelled successfully',
            data: regularizationRequest
        });
    } catch (error) {
        logger.error('Cancel Regularization Request Error', {
            error: error.message,
            stack: error.stack,
            requestId: req.params.id,
            employeeId: req.employee._id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to cancel regularization request',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

