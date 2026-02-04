import CompOff from '../../models/compOff.model.js';
import Employee from '../../models/employee.model.js';
import AttendanceRule from '../../models/attendanceRule.model.js';
import Leave from '../../models/leave.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound } from '../../helpers/responseHelper.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, sendPaginatedResponse } from '../../helpers/paginationHelper.js';

/**
 * Create comp-off request
 * POST /api/v1/both/comp-off/request
 */
export const createCompOffRequest = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const organizationId = getOrganizationId(req);
        
        if (!employeeId) {
            return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
        }

        const { date, reason, earnedDate } = req.body;

        if (!date || !reason) {
            return sendError(res, 'Date and reason are required', 400, 'VALIDATION_ERROR');
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Get attendance rule to check comp-off settings
        const rule = await AttendanceRule.findOne({
            organizationId,
            isActive: true
        });

        if (!rule || !rule.enableCompOff) {
            return sendError(res, 'Comp-off is not enabled for this organization', 400, 'COMP_OFF_DISABLED');
        }

        const validityDays = rule?.compOffRules?.validity || 90;
        const maxAccumulation = rule?.compOffRules?.maxAccumulation || 5;
        const allowedPerMonth = rule?.compOffRules?.allowedPerMonth || 2;

        // Check monthly limit
        const requestDate = new Date(date);
        const monthStart = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
        const monthEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0);

        const monthlyCompOffs = await CompOff.countDocuments({
            organizationId,
            employeeId,
            date: { $gte: monthStart, $lte: monthEnd },
            status: { $in: ['pending', 'approved'] }
        });

        if (monthlyCompOffs >= allowedPerMonth) {
            return sendError(
                res,
                `Maximum ${allowedPerMonth} comp-off requests allowed per month. You have already requested ${monthlyCompOffs} this month.`,
                400,
                'MONTHLY_LIMIT_EXCEEDED'
            );
        }

        // Check total accumulation
        const totalCompOffs = await CompOff.countDocuments({
            organizationId,
            employeeId,
            status: { $in: ['pending', 'approved'] },
            isExpired: false,
            isUsed: false
        });

        if (totalCompOffs >= maxAccumulation) {
            return sendError(
                res,
                `Maximum ${maxAccumulation} comp-offs can be accumulated. You currently have ${totalCompOffs} active comp-offs.`,
                400,
                'MAX_ACCUMULATION_EXCEEDED'
            );
        }

        // Check if comp-off already exists for this date
        const existingCompOff = await CompOff.findOne({
            organizationId,
            employeeId,
            date: new Date(date),
            status: { $in: ['pending', 'approved'] }
        });

        if (existingCompOff) {
            return sendError(res, 'Comp-off request already exists for this date', 400, 'DUPLICATE_REQUEST');
        }

        // Create comp-off request
        const compOff = new CompOff({
            organizationId,
            employeeId,
            employeeName: `${employee.name} ${employee.lastName}`,
            date: new Date(date),
            earnedDate: earnedDate ? new Date(earnedDate) : new Date(date),
            reason,
            validityDays,
            status: 'pending'
        });

        await compOff.save();

        return sendSuccess(
            res,
            { compOff },
            'Comp-off request created successfully',
            201
        );
    } catch (error) {
        logger.error('Create Comp-Off Request Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error creating comp-off request', 500, 'CREATE_ERROR');
    }
};

/**
 * Get my comp-off requests
 * GET /api/v1/both/comp-off/my-requests
 */
export const getMyCompOffRequests = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const organizationId = getOrganizationId(req);
        const { status, year } = req.query;

        if (!employeeId) {
            return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
        }

        const query = addOrganizationFilter(req, { employeeId });

        if (status) {
            query.status = status;
        }

        if (year) {
            const yearStart = new Date(parseInt(year), 0, 1);
            const yearEnd = new Date(parseInt(year), 11, 31);
            query.date = { $gte: yearStart, $lte: yearEnd };
        }

        const compOffs = await CompOff.find(query)
            .sort({ createdAt: -1 })
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email');

        // Calculate statistics
        const stats = {
            total: compOffs.length,
            pending: compOffs.filter(c => c.status === 'pending').length,
            approved: compOffs.filter(c => c.status === 'approved').length,
            rejected: compOffs.filter(c => c.status === 'rejected').length,
            expired: compOffs.filter(c => c.isExpired).length,
            used: compOffs.filter(c => c.isUsed).length,
            available: compOffs.filter(c => c.status === 'approved' && !c.isExpired && !c.isUsed).length
        };

        return sendSuccess(
            res,
            { compOffs, statistics: stats },
            'Comp-off requests retrieved successfully'
        );
    } catch (error) {
        logger.error('Get My Comp-Off Requests Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching comp-off requests', 500, 'FETCH_ERROR');
    }
};

/**
 * Get all comp-off requests (Admin/HR/Manager)
 * GET /api/v1/admin/comp-off/requests
 */
export const getAllCompOffRequests = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { status, employeeId, department, year } = req.query;
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

        const query = addOrganizationFilter(req, {});

        if (status) {
            query.status = status;
        }

        if (employeeId) {
            query.employeeId = employeeId;
        }

        if (department) {
            const employees = await Employee.find({
                organizationId,
                department
            }).select('_id');
            query.employeeId = { $in: employees.map(e => e._id) };
        }

        if (year) {
            const yearStart = new Date(parseInt(year), 0, 1);
            const yearEnd = new Date(parseInt(year), 11, 31);
            query.date = { $gte: yearStart, $lte: yearEnd };
        }

        const total = await CompOff.countDocuments(query);
        const compOffs = await CompOff.find(query)
            .populate('employeeId', 'name lastName email department')
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return sendPaginatedResponse(
            res,
            compOffs,
            total,
            page,
            limit,
            'Comp-off requests retrieved successfully'
        );
    } catch (error) {
        logger.error('Get All Comp-Off Requests Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error fetching comp-off requests', 500, 'FETCH_ERROR');
    }
};

/**
 * Approve comp-off request
 * PUT /api/v1/admin/comp-off/approve/:id
 */
export const approveCompOff = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id || req.employee?._id;

        const compOff = await CompOff.findById(id);
        if (!compOff) {
            return sendNotFound(res, 'Comp-off request');
        }

        if (compOff.organizationId.toString() !== organizationId.toString()) {
            return sendError(res, 'Unauthorized access', 403, 'UNAUTHORIZED');
        }

        if (compOff.status !== 'pending') {
            return sendError(res, `Comp-off request is already ${compOff.status}`, 400, 'INVALID_STATUS');
        }

        compOff.status = 'approved';
        compOff.approvedBy = approverId;
        compOff.approvedAt = new Date();

        await compOff.save();

        return sendSuccess(
            res,
            { compOff },
            'Comp-off request approved successfully'
        );
    } catch (error) {
        logger.error('Approve Comp-Off Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error approving comp-off request', 500, 'APPROVAL_ERROR');
    }
};

/**
 * Reject comp-off request
 * PUT /api/v1/admin/comp-off/reject/:id
 */
export const rejectCompOff = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;
        const organizationId = getOrganizationId(req);
        const approverId = req.user?._id || req.employee?._id;

        const compOff = await CompOff.findById(id);
        if (!compOff) {
            return sendNotFound(res, 'Comp-off request');
        }

        if (compOff.organizationId.toString() !== organizationId.toString()) {
            return sendError(res, 'Unauthorized access', 403, 'UNAUTHORIZED');
        }

        if (compOff.status !== 'pending') {
            return sendError(res, `Comp-off request is already ${compOff.status}`, 400, 'INVALID_STATUS');
        }

        compOff.status = 'rejected';
        compOff.rejectedBy = approverId;
        compOff.rejectedAt = new Date();
        compOff.rejectionReason = rejectionReason || '';

        await compOff.save();

        return sendSuccess(
            res,
            { compOff },
            'Comp-off request rejected successfully'
        );
    } catch (error) {
        logger.error('Reject Comp-Off Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error rejecting comp-off request', 500, 'REJECTION_ERROR');
    }
};

/**
 * Use comp-off in leave application
 * POST /api/v1/both/comp-off/use/:id
 */
export const useCompOff = async (req, res) => {
    try {
        const { id } = req.params;
        const { leaveId } = req.body;
        const employeeId = req.employee?._id;
        const organizationId = getOrganizationId(req);

        if (!employeeId) {
            return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
        }

        const compOff = await CompOff.findById(id);
        if (!compOff) {
            return sendNotFound(res, 'Comp-off');
        }

        if (compOff.employeeId.toString() !== employeeId.toString()) {
            return sendError(res, 'You can only use your own comp-offs', 403, 'UNAUTHORIZED');
        }

        if (compOff.status !== 'approved') {
            return sendError(res, 'Only approved comp-offs can be used', 400, 'INVALID_STATUS');
        }

        if (compOff.isUsed) {
            return sendError(res, 'This comp-off has already been used', 400, 'ALREADY_USED');
        }

        if (compOff.isExpired) {
            return sendError(res, 'This comp-off has expired', 400, 'EXPIRED');
        }

        // Verify leave exists and belongs to employee
        if (leaveId) {
            const leave = await Leave.findById(leaveId);
            if (!leave) {
                return sendNotFound(res, 'Leave');
            }

            if (leave.employee.toString() !== employeeId.toString()) {
                return sendError(res, 'Leave does not belong to you', 403, 'UNAUTHORIZED');
            }

            if (leave.leaveType !== 'compensatory') {
                return sendError(res, 'Comp-off can only be used with compensatory leave', 400, 'INVALID_LEAVE_TYPE');
            }
        }

        compOff.isUsed = true;
        compOff.usedAt = new Date();
        compOff.usedInLeave = leaveId || null;

        await compOff.save();

        return sendSuccess(
            res,
            { compOff },
            'Comp-off marked as used successfully'
        );
    } catch (error) {
        logger.error('Use Comp-Off Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error using comp-off', 500, 'USE_ERROR');
    }
};

/**
 * Cancel comp-off request
 * DELETE /api/v1/both/comp-off/cancel/:id
 */
export const cancelCompOffRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const employeeId = req.employee?._id;
        const organizationId = getOrganizationId(req);

        if (!employeeId) {
            return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
        }

        const compOff = await CompOff.findById(id);
        if (!compOff) {
            return sendNotFound(res, 'Comp-off request');
        }

        if (compOff.employeeId.toString() !== employeeId.toString()) {
            return sendError(res, 'You can only cancel your own comp-off requests', 403, 'UNAUTHORIZED');
        }

        if (compOff.status !== 'pending') {
            return sendError(res, `Cannot cancel comp-off request with status: ${compOff.status}`, 400, 'INVALID_STATUS');
        }

        await CompOff.deleteOne({ _id: id });

        return sendSuccess(
            res,
            {},
            'Comp-off request cancelled successfully'
        );
    } catch (error) {
        logger.error('Cancel Comp-Off Request Error', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Error cancelling comp-off request', 500, 'CANCEL_ERROR');
    }
};

