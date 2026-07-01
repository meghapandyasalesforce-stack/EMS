import AttendanceRegularization from '../../models/attendanceRegularization.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, sendPaginatedResponse, createPaginationMeta } from '../../helpers/paginationHelper.js';
import { getManagerEmployeeIds, isEmployeeLinkedToManager, buildManagerRegularizationScopeFilter, canLineManagerAccessRegularization, isAssignedRegularizationApprover } from '../../helpers/managerHelper.js';
import { harmonizeRegularizationRequestedTimes } from '../../helpers/attendanceRegularizationTimeHelper.js';
import { ApprovalInstance } from '../../models/approvalWorkflow.model.js';
import { initiateApproval } from '../../services/approvalWorkflowService.js';
import {
    applyRegularizationApproval,
    applyRegularizationRejection,
    cancelRegularizationApprovalWorkflow
} from '../../services/attendanceRegularizationWorkflowService.js';
import {
    getReviewerEmployeeId,
    getCurrentPendingStep,
    executeRegularizationWorkflowAction,
    executeAdminBypassRegularization,
    attachWorkflowSummariesToRequests,
    sendRegularizationActionError,
    isAdminUser,
} from '../../helpers/regularizationWorkflowActionHelper.js';
import { getRegularizationLimitSummary, isRegularizationInCurrentMonth } from '../../helpers/regularizationLimitHelper.js';

/** Parse calendar `YYYY-MM-DD` from query; local start/end-of-day boundary, or null if invalid */
function parseCalendarDayQuery(raw, boundary) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const y = Number(s.slice(0, 4));
    const mo = Number(s.slice(5, 7));
    const d = Number(s.slice(8, 10));
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    if (boundary === 'start') {
        dt.setHours(0, 0, 0, 0);
    } else {
        dt.setHours(23, 59, 59, 999);
    }
    return dt;
}

/**
 * Create a new attendance regularization request
 * POST /api/v1/attendance-regularization/request
 */
export const createRegularizationRequest = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }
        
        const {
            attendanceDate,
            regularizationType,
            requestedClockIn,
            requestedClockOut,
            reason,
            supportingDocuments,
            clockOutNextDay
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
        const isCurrentMonth = await isRegularizationInCurrentMonth(organizationId, requestedDate);
        if (!isCurrentMonth) {
            return res.status(400).json({
                success: false,
                message: 'Regularization is allowed only for the current month.'
            });
        }

        // Enforce monthly request cap from attendance rules (count only pending + approved)
        const limitSummary = await getRegularizationLimitSummary(organizationId, employeeId);

        if (!limitSummary.enabled) {
            return res.status(400).json({
                success: false,
                message: 'Attendance regularization is disabled for your organization.'
            });
        }

        if (!limitSummary.unlimited && limitSummary.usedThisMonth >= limitSummary.allowedPerMonth) {
            return res.status(400).json({
                success: false,
                message: `Monthly regularization limit reached (max ${limitSummary.allowedPerMonth} requests for pending/approved).`
            });
        }

        // Validate dates based on type (full_day uses defaults at approval — no punches required here)
        if (regularizationType !== 'full_day') {
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
        }

        let finalRequestedClockIn;
        let finalRequestedClockOut;
        if (regularizationType === 'full_day') {
            finalRequestedClockIn = undefined;
            finalRequestedClockOut = undefined;
        } else {
            try {
                const ci = requestedClockIn ? new Date(requestedClockIn) : null;
                const co = requestedClockOut ? new Date(requestedClockOut) : null;
                const h = harmonizeRegularizationRequestedTimes({
                    attendanceDate: requestedDate,
                    clockIn: ci,
                    clockOut: co,
                    clockOutNextDay
                });
                finalRequestedClockIn = h.clockIn || undefined;
                finalRequestedClockOut = h.clockOut || undefined;
            } catch (timeErr) {
                return res.status(400).json({
                    success: false,
                    message: timeErr.message || 'Invalid requested clock times'
                });
            }

            const needsStart =
                regularizationType === 'missing_clock_in' ||
                regularizationType === 'both' ||
                regularizationType === 'incorrect_time';
            const needsEnd =
                regularizationType === 'missing_clock_out' ||
                regularizationType === 'both' ||
                regularizationType === 'incorrect_time';
            if (needsStart && !finalRequestedClockIn) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested clock-in time is required for this regularization type'
                });
            }
            if (needsEnd && !finalRequestedClockOut) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested clock-out time is required for this regularization type'
                });
            }
            if (finalRequestedClockIn && finalRequestedClockOut) {
                if (finalRequestedClockOut.getTime() <= finalRequestedClockIn.getTime()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Requested clock-out must be after requested clock-in (use “next-day clock-out” if you left after midnight).'
                    });
                }
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
        const employee = await Employee.findById(employeeId).select('department position managerId manager').lean();
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Prefer explicit reporting line (managerId), then department/org heuristics
        let manager = null;
        if (employee.managerId) {
            manager = await Employee.findOne({
                _id: employee.managerId,
                organizationId,
                status: 'active'
            }).select('_id').lean();
        }

        if (!manager) {
            manager = await Employee.findOne({
                organizationId,
                department: employee.department,
                position: { $in: ['Manager', 'Director'] },
                status: 'active'
            }).select('_id').lean();
        }

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
            requestedClockIn: finalRequestedClockIn,
            requestedClockOut: finalRequestedClockOut,
            reason,
            supportingDocuments: supportingDocuments || [],
            status: 'pending'
        });

        await regularizationRequest.save();

        // Populate employee and manager details for response
        await regularizationRequest.populate('employeeId', 'name lastName email employeeId department');
        await regularizationRequest.populate('managerId', 'name lastName email employeeId');

        // Route through approval workflow when configured.
        try {
            const approvalResult = await initiateApproval({
                organizationId,
                entityType: 'AttendanceRegularization',
                entityId: regularizationRequest._id,
                requestedBy: employeeId,
                metadata: {
                    attendanceDate,
                    regularizationType,
                    managerId: manager._id,
                    requestedClockIn: finalRequestedClockIn,
                    requestedClockOut: finalRequestedClockOut
                },
                priority: regularizationType === 'full_day' ? 'High' : 'Medium'
            });

            if (approvalResult.approvalInstanceId) {
                regularizationRequest.approvalInstanceId = approvalResult.approvalInstanceId;
                const approvalInstance = await ApprovalInstance.findById(
                    approvalResult.approvalInstanceId
                ).select('steps');
                const firstPending = approvalInstance?.steps?.find(
                    (s) => s.status === 'Pending'
                );
                if (firstPending?.approverId) {
                    regularizationRequest.managerId = firstPending.approverId;
                }
                await regularizationRequest.save();
            }

            if (approvalResult.autoApproved && approvalResult.status === 'Approved') {
                await applyRegularizationApproval({
                    regularizationRequest,
                    organizationId,
                    reviewerId: manager._id,
                    managerResponse: 'Auto-approved through workflow'
                });
            }
        } catch (approvalError) {
            logger.error('Error initiating approval workflow for regularization', {
                error: approvalError.message,
                requestId: regularizationRequest._id,
                stack: approvalError.stack
            });
        }

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
 * Get employee's regularization limit summary for the current month
 * GET /api/v1/attendance-regularization/limits
 */
export const getRegularizationLimits = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = getOrganizationId(req);

        const summary = await getRegularizationLimitSummary(organizationId, employeeId, req.employee);

        res.status(200).json({
            success: true,
            message: 'Regularization limits retrieved successfully',
            data: summary
        });
    } catch (error) {
        logger.error('Get Regularization Limits Error', {
            error: error.message,
            stack: error.stack,
            employeeId: req.employee?._id
        });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch regularization limits',
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
        const { status: statusFilter, startDate, endDate } = req.query;

        // If user is a manager (not admin or HR), filter by their department
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let query = addOrganizationFilter(req, {});

        if (isManager && req.employee) {
            const managerId = req.employee._id;
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();

            // Get all employees linked to this manager
            // Example: Manager "Arun Kumar" sees requests for employees with manager="Arun Kumar" or "Arun"
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);

            Object.assign(query, buildManagerRegularizationScopeFilter(req.employee, managerEmployeeIds));

            logger.info('Manager filtering regularization requests by team', {
                managerId: managerId,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length,
                includesAssignedToManager: true
            });
        } else if (req.user) {
            // Admin can see all requests
            // No additional filtering needed
        } else if (req.employee?.isHR) {
            // HR can see all requests in their organization
            // No additional filtering needed
        }

        const startBound = parseCalendarDayQuery(startDate, 'start');
        const endBound = parseCalendarDayQuery(endDate, 'end');
        if (startDate && !startBound) {
            logger.warn('Invalid startDate for manager regularization list', { startDate });
        }
        if (endDate && !endBound) {
            logger.warn('Invalid endDate for manager regularization list', { endDate });
        }
        if (startBound || endBound) {
            query.attendanceDate = {};
            if (startBound) query.attendanceDate.$gte = startBound;
            if (endBound) query.attendanceDate.$lte = endBound;
        }

        if (statusFilter) {
            query.status = statusFilter;
        }

        const { page: parsedPage, limit: parsedLimit, skip } = parsePagination(req, {
            defaultLimit: 100,
            maxLimit: 500
        });

        const countBase = { ...query };
        delete countBase.status;

        const [pending, approved, rejected, cancelled] = await Promise.all([
            AttendanceRegularization.countDocuments({ ...countBase, status: 'pending' }),
            AttendanceRegularization.countDocuments({ ...countBase, status: 'approved' }),
            AttendanceRegularization.countDocuments({ ...countBase, status: 'rejected' }),
            AttendanceRegularization.countDocuments({ ...countBase, status: 'cancelled' })
        ]);

        const total = await AttendanceRegularization.countDocuments(query);

        const requestsRaw = await AttendanceRegularization.find(query)
            .populate('employeeId', 'name lastName email employeeId department profilePhoto position')
            .populate('managerId', 'name lastName email employeeId')
            .populate('reviewedBy', 'name lastName email employeeId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean();

        const requests = await attachWorkflowSummariesToRequests(requestsRaw);

        return res.status(200).json({
            success: true,
            message: 'Regularization requests retrieved successfully',
            data: requests,
            pagination: createPaginationMeta(parsedPage, parsedLimit, total),
            statusCounts: { pending, approved, rejected, cancelled }
        });
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
        const reviewerEmployeeId = getReviewerEmployeeId(req);

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

        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let employeeLinked = true;
        if (isManager && req.employee) {
            const employee = await Employee.findById(regularizationRequest.employeeId?._id || regularizationRequest.employeeId)
                .select('manager managerId').lean();
            
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found.'
                });
            }
            
            employeeLinked = isEmployeeLinkedToManager(employee, req.employee)
                || isAssignedRegularizationApprover(regularizationRequest, req.employee);

            if (!canLineManagerAccessRegularization(req, regularizationRequest, employee)) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to approve regularization for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    requestId: id
                });
                return res.status(403).json({
                    success: false,
                    message: 'You can only approve regularization requests for employees linked to you or assigned to you.'
                });
            }
        }

        if (regularizationRequest.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Request is already ${regularizationRequest.status}`
            });
        }

        if (regularizationRequest.approvalInstanceId) {
            const approvalInstance = await ApprovalInstance.findById(regularizationRequest.approvalInstanceId);

            if (approvalInstance && approvalInstance.status === 'In Progress') {
                const currentStep = getCurrentPendingStep(approvalInstance);

                if (!currentStep) {
                    return res.status(400).json({
                        success: false,
                        message: 'No pending workflow step found for this regularization request'
                    });
                }

                const managerResponse = req.body.managerResponse || 'Approved';
                const confirmEarlyApproval = Boolean(req.body.confirmEarlyApproval);
                const adminBypass =
                    isAdminUser(req) && req.body.adminBypass !== false;

                if (adminBypass) {
                    await executeAdminBypassRegularization({
                        approvalInstance,
                        comments: managerResponse,
                        regularizationRequest,
                    });
                } else {
                    await executeRegularizationWorkflowAction({
                        req,
                        approvalInstance,
                        currentStep,
                        action: 'Approve',
                        comments: managerResponse,
                        regularizationRequest,
                        employeeLinked,
                        confirmEarlyApproval,
                    });
                }

                const updatedRequest = await AttendanceRegularization.findById(id)
                    .populate('employeeId', 'name lastName email employeeId department')
                    .populate('managerId', 'name lastName email employeeId')
                    .populate('reviewedBy', 'name lastName email employeeId');

                return res.json({
                    success: true,
                    message: updatedRequest?.status === 'approved'
                        ? adminBypass
                            ? 'Regularization approved by admin (all workflow steps completed)'
                            : 'Regularization request approved and attendance record updated'
                        : 'Approval processed, moving to next workflow step',
                    data: updatedRequest
                });
            }
        }

        const updatedRequest = await applyRegularizationApproval({
            regularizationRequest,
            organizationId,
            reviewerId: reviewerEmployeeId,
            managerResponse: req.body.managerResponse || 'Approved'
        });

        res.json({
            success: true,
            message: 'Regularization request approved and attendance record updated',
            data: updatedRequest
        });
    } catch (error) {
        logger.error('Approve Regularization Error', {
            error: error.message,
            stack: error.stack,
            requestId: req.params.id
        });
        return sendRegularizationActionError(
            res,
            error,
            'Failed to approve regularization request'
        );
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
        const reviewerEmployeeId = getReviewerEmployeeId(req);

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

        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        let employeeLinked = true;
        if (isManager && req.employee) {
            const employee = await Employee.findById(regularizationRequest.employeeId?._id || regularizationRequest.employeeId)
                .select('manager managerId').lean();

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found.'
                });
            }

            employeeLinked = isEmployeeLinkedToManager(employee, req.employee)
                || isAssignedRegularizationApprover(regularizationRequest, req.employee);

            if (!canLineManagerAccessRegularization(req, regularizationRequest, employee)) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to reject regularization for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    employeeManager: employee.manager,
                    requestId: id
                });
                return res.status(403).json({
                    success: false,
                    message: 'You can only reject regularization requests for employees linked to you or assigned to you.'
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

        if (regularizationRequest.approvalInstanceId) {
            const approvalInstance = await ApprovalInstance.findById(regularizationRequest.approvalInstanceId);

            if (approvalInstance && approvalInstance.status === 'In Progress') {
                const currentStep = getCurrentPendingStep(approvalInstance);

                if (!currentStep) {
                    return res.status(400).json({
                        success: false,
                        message: 'No pending workflow step found for this regularization request'
                    });
                }

                await executeRegularizationWorkflowAction({
                    req,
                    approvalInstance,
                    currentStep,
                    action: 'Reject',
                    comments: rejectionReason,
                    regularizationRequest,
                    employeeLinked,
                    confirmEarlyApproval: Boolean(req.body.confirmEarlyApproval),
                });

                const updatedRequest = await AttendanceRegularization.findById(id)
                    .populate('employeeId', 'name lastName email employeeId department')
                    .populate('managerId', 'name lastName email employeeId')
                    .populate('reviewedBy', 'name lastName email employeeId');

                return res.json({
                    success: true,
                    message: 'Regularization request rejected',
                    data: updatedRequest
                });
            }
        }

        const updatedRequest = await applyRegularizationRejection({
            regularizationRequest,
            reviewerId: reviewerEmployeeId,
            rejectionReason
        });

        res.json({
            success: true,
            message: 'Regularization request rejected',
            data: updatedRequest
        });
    } catch (error) {
        logger.error('Reject Regularization Error', {
            error: error.message,
            stack: error.stack,
            requestId: req.params.id
        });
        return sendRegularizationActionError(
            res,
            error,
            'Failed to reject regularization request'
        );
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
        await cancelRegularizationApprovalWorkflow({
            approvalInstanceId: regularizationRequest.approvalInstanceId,
            actorId: employeeId
        });

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

