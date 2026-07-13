import Employee from "../../models/employee.model.js"
import Leave from "../../models/leave.model.js"
import logger from "../../helpers/logger.js";
import { sendSuccess, sendError, sendNotFound, sendUnauthorized, sendInternalError } from "../../helpers/responseHelper.js";
import leaveBalanceEngine from "../../services/leaveBalanceEngine.js";
import leaveValidationService from "../../services/leaveValidationService.js";
import Calendar from "../../models/calendar.model.js";
import { logCreate, logUpdate } from "../../helpers/auditLogger.js";
import { normalizeLeaveTypeForPolicy } from "../../helpers/leaveTypeHelper.js";
import { buildEmployeeLeaveBalanceResponse } from "../../helpers/leaveBalanceResponseHelper.js";
import { notify } from "../../helpers/notificationManager.js";
import "../../helpers/notificationEventRegistry.js";
import {
    ensureDefaultLeaveWorkflow,
    attachWorkflowSummariesToLeaves,
    getLeaveApprovalStageLabel,
} from "../../helpers/leaveWorkflowHelper.js";
import path from "path";
import { upload as leaveDocumentUpload } from "../fileUpload/uploadConfigController.js";
import { sendLeaveRequestNotification } from "../../helpers/leaveEmailHelper.js";


/**
 * @swagger
 * /api/v1/employee/leave/create:
 *   post:
 *     summary: Create a leave request
 *     description: Creates a new leave request for the authenticated employee. Validates leave balance and policies.
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *               - leaveType
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-02-01
 *                 description: Leave start date
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-02-05
 *                 description: Leave end date
 *               leaveType:
 *                 type: string
 *                 enum: [Sick, Casual, Annual, Maternity, Paternity, Compensatory, Unpaid, Other]
 *                 example: Annual
 *                 description: Type of leave
 *               reason:
 *                 type: string
 *                 example: Family vacation
 *                 description: Reason for leave
 *               isHalfDay:
 *                 type: boolean
 *                 example: false
 *                 description: Whether this is a half-day leave
 *               halfDayType:
 *                 type: string
 *                 enum: [First Half, Second Half]
 *                 description: Half-day type (if isHalfDay is true)
 *     responses:
 *       201:
 *         description: Leave request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Leave request created successfully
 *                 leave:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: pending
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Create a leave request
export const createLeave = async (req, res) => {
    logger.debug("Creating leave request", { employeeId: req.employee?._id });

    try {
        const { startDate, endDate, leaveType, reason, isHalfDay, halfDayType, document } = req.body;
        const employeeId = req.employee?._id;

        // ✅ Ensure authentication was successful
        if (!employeeId) {
            return sendUnauthorized(res, "Unauthorized: Employee data missing");
        }

        // ✅ Validate required fields
        if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
            return sendError(res, "Invalid start or end date format", 400, 'INVALID_DATE_FORMAT');
        }

        if (new Date(endDate) < new Date(startDate)) {
            return sendError(res, "End date cannot be before start date", 400, 'INVALID_DATE_RANGE');
        }

        const employee = await Employee.findById(employeeId);
        logger.debug("Employee found", { employeeId, hasEmployee: !!employee });

        if (!employee) {
            return sendNotFound(res, "Employee");
        }

        // Get organizationId - required for multi-tenancy
        const organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId || employee.organizationId;
        
        if (!organizationId) {
            logger.error('Create Leave Error: Missing organizationId', {
                employeeId,
                hasEmployee: !!employee,
                hasReqEmployee: !!req.employee,
                hasReqUser: !!req.user
            });
            return sendError(res, 'Organization ID is required. Please ensure you are authenticated.', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Validate leave request using comprehensive validation service
        const validation = await leaveValidationService.validateLeaveRequest(
            employeeId,
            { startDate, endDate, leaveType, isHalfDay, document },
            organizationId
        );

        if (!validation.valid) {
            // Return human-readable validation errors directly in message
            // and put the code into details to avoid i18n key strings like "errors.LEAVE_VALIDATION_FAILED"
            return sendError(
                res,
                validation.errors.join('; '),
                400,
                null,
                { code: 'LEAVE_VALIDATION_FAILED', warnings: validation.warnings }
            );
        }

        // Get calendar for working days calculation
        const calendar = await Calendar.findOne({ 
            organizationId, 
            year: new Date(startDate).getFullYear() 
        });

        // Calculate duration and working days
        const duration = validation.duration || Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
        const workingDays = validation.workingDays || duration;

        // Check leave balance before creating request (skip for loss_of_pay; use normalized type for policy alignment)
        const balanceLeaveType = normalizeLeaveTypeForPolicy(leaveType);
        if (leaveType !== 'loss_of_pay') {
            const year = new Date(startDate).getFullYear();
            try {
                const balance = await leaveBalanceEngine.calculateBalance(
                    employeeId,
                    year,
                    organizationId
                );

                if (balance) {
                    const typeBalance = balance.balances.find(b => b.leaveType === balanceLeaveType);
                    const requestedDays = isHalfDay ? 0.5 : duration;
                    if (typeBalance && typeBalance.available < requestedDays) {
                        return sendError(
                            res,
                            `Insufficient leave balance. Available: ${typeBalance.available} days, Requested: ${requestedDays} days`,
                            400,
                            'INSUFFICIENT_LEAVE_BALANCE'
                        );
                    }
                }
            } catch (balanceError) {
                // Log error but don't block leave creation if balance calculation fails
                logger.warn('Error checking leave balance', {
                    error: balanceError.message,
                    employeeId,
                    year
                });
            }
        }

        const leave = new Leave({
            organizationId, // Required for multi-tenancy
            employee: employeeId,
            employeeName: `${employee.name} ${employee.lastName}`,
            startDate,
            endDate,
            leaveType,
            reason,
            duration: isHalfDay ? 0.5 : duration,
            workingDays,
            isHalfDay: isHalfDay || false,
            halfDayType: isHalfDay ? halfDayType : null,
            document: document || null,
            resumptionDate: new Date(endDate),
            year: new Date(startDate).getFullYear(),
            status: "pending"
        });

        await leave.save();
        
        // Log audit trail for leave creation
        await logCreate({
            entityType: 'Leave',
            entityId: leave._id,
            entityName: `${leave.leaveType} leave for ${employee.name}`,
            req,
            before: null,
            after: leave.toObject(),
            metadata: {
                leaveType,
                duration: leave.duration,
                startDate,
                endDate,
                isHalfDay: leave.isHalfDay
            }
        });

        // Send email notification to approver (non-blocking)
        setImmediate(async () => {
            try {
                await sendLeaveRequestNotification(
                    {
                        _id: leave._id,
                        employeeName: leave.employeeName,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        duration: leave.duration,
                        reason: leave.reason,
                        status: leave.status,
                        department: employee.department,
                        designation: employee.jobTitle
                    },
                    employeeId,
                    organizationId
                );
            } catch (emailError) {
                logger.error('Failed to send leave request email notification', {
                    leaveId: leave._id,
                    employeeId,
                    error: emailError.message
                });
                // Email failure should not block the leave creation
            }
        });

        setImmediate(async () => {
            await notify({
                type: 'leave_applied',
                organizationId,
                data: {
                    leave,
                    employee
                }
            });
        });
        
        // ✅ INTEGRATE APPROVAL WORKFLOW (Manager → HR)
        try {
            await ensureDefaultLeaveWorkflow(organizationId);

            const { initiateApproval } = await import('../../services/approvalWorkflowService.js');
            const approvalResult = await initiateApproval({
                organizationId,
                entityType: 'Leave',
                entityId: leave._id,
                requestedBy: employeeId,
                metadata: {
                    leaveType,
                    duration,
                    startDate,
                    endDate,
                    employeeName: `${employee.name} ${employee.lastName}`
                },
                priority: duration > 5 ? 'High' : 'Medium'
            });

            // Update leave with approval instance ID if workflow was initiated
            if (approvalResult.approvalInstanceId) {
                leave.approvalInstanceId = approvalResult.approvalInstanceId;
                await leave.save();
            }

            // If auto-approved (should not happen with default workflow), update leave status
            if (approvalResult.autoApproved && approvalResult.status === 'Approved') {
                leave.status = 'approved';
                leave.approvedBy = employeeId; // Auto-approved
                leave.approvedAt = new Date();
                await leave.save();

                // Update leave balance
                try {
                    const year = new Date(startDate).getFullYear();
                    await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
                } catch (balanceError) {
                    logger.warn('Error updating leave balance after auto-approval', {
                        error: balanceError.message,
                        employeeId,
                        leaveId: leave._id
                    });
                }
            }

            logger.info('Leave approval workflow initiated', {
                leaveId: leave._id,
                approvalInstanceId: approvalResult.approvalInstanceId,
                autoApproved: approvalResult.autoApproved
            });
        } catch (approvalError) {
            // Log error but don't fail leave creation
            logger.error('Error initiating approval workflow for leave', {
                error: approvalError.message,
                leaveId: leave._id,
                stack: approvalError.stack
            });
            // Leave is still created, just without workflow integration
        }
        
        // Return success with warnings if any
        return sendSuccess(
            res, 
            { leave, warnings: validation.warnings }, 
            validation.warnings && validation.warnings.length > 0 
                ? `Leave application submitted successfully. Note: ${validation.warnings.join('; ')}`
                : "Leave application submitted successfully. It will be sent to your manager first, then HR for final approval.",
            201
        );

    } catch (error) {
        logger.error("Create Leave Error", { error: error.message, stack: error.stack });
        return sendInternalError(res, "Error submitting leave application", error);
    }
};
// Get current user's leaves (statistics from actual policy/balance)
export const getMyLeaves = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = req.organizationId || req.employee?.organizationId;
        const year = new Date().getFullYear();

        const leaveQuery = { employee: employeeId };
        if (organizationId) {
            leaveQuery.organizationId = organizationId;
        }
        const leavesRaw = await Leave.find(leaveQuery).sort({ createdAt: -1 }).lean();
        const leavesWithWorkflow = await attachWorkflowSummariesToLeaves(leavesRaw);
        const leaves = leavesWithWorkflow.map((leave) => ({
            ...leave,
            approvalStage: getLeaveApprovalStageLabel(leave),
        }));

        const currentYearLeaves = leaves.filter(leave =>
            new Date(leave.startDate).getFullYear() === year &&
            leave.status === 'approved'
        );

        const leavesTaken = currentYearLeaves.reduce((acc, leave) => acc + (leave.duration || 0), 0);
        const leavesByType = {
            sick: currentYearLeaves.filter(l => l.leaveType === 'sick').reduce((acc, l) => acc + (l.duration || 0), 0),
            annual: currentYearLeaves.filter(l => l.leaveType === 'annual' || l.leaveType === 'paid').reduce((acc, l) => acc + (l.duration || 0), 0),
            casual: currentYearLeaves.filter(l => l.leaveType === 'casual').reduce((acc, l) => acc + (l.duration || 0), 0),
            paid: currentYearLeaves.filter(l => l.leaveType === 'paid').reduce((acc, l) => acc + (l.duration || 0), 0)
        };

        let totalLeaves = 0;
        let remainingLeaves = 0;
        let balanceByType = null;
        if (organizationId) {
            try {
                const balanceResponse = await buildEmployeeLeaveBalanceResponse(
                    employeeId,
                    year,
                    organizationId
                );
                if (balanceResponse?.leaveSummary) {
                    const summary = balanceResponse.leaveSummary;
                    totalLeaves = (summary.totalAccrued || 0) + (summary.totalCarriedForward || 0);
                    remainingLeaves = summary.totalAvailableLeave || 0;
                    balanceByType = {
                        sick: { accrued: summary.totalAccrued, available: summary.totalAvailableLeave, used: summary.totalUsed, pending: summary.totalPending },
                        annual: { accrued: summary.totalAccrued, available: summary.totalAvailableLeave, used: summary.totalUsed, pending: summary.totalPending },
                        casual: { accrued: summary.totalAccrued, available: summary.totalAvailableLeave, used: summary.totalUsed, pending: summary.totalPending },
                    };
                } else if (balanceResponse?.balances?.length) {
                    totalLeaves = balanceResponse.balances.reduce(
                        (sum, b) => sum + (b.accrued || 0) + (b.carriedForward || 0),
                        0
                    );
                    remainingLeaves = Number(balanceResponse.totalAvailableLeave) ||
                        balanceResponse.balances.reduce((sum, b) => sum + (b.available || 0), 0);
                    balanceByType = {
                        sick: { accrued: 0, available: 0, used: 0, pending: 0 },
                        annual: { accrued: 0, available: 0, used: 0, pending: 0 },
                        casual: { accrued: 0, available: 0, used: 0, pending: 0 },
                    };
                    for (const b of balanceResponse.balances) {
                        const typeKey = b.leaveType === 'paid' ? 'annual' : b.leaveType;
                        if (!balanceByType[typeKey]) continue;
                        balanceByType[typeKey] = {
                            accrued: (b.accrued || 0) + (b.carriedForward || 0),
                            available: b.available || 0,
                            used: b.used || 0,
                            pending: b.pending || 0,
                        };
                    }
                }
            } catch (e) {
                logger.warn('Get My Leaves: balance fetch failed', { employeeId, error: e.message });
            }
        }

        let monthlyLeaveCaps = { year: new Date().getFullYear(), month: new Date().getMonth() + 1, monthLabel: '', types: [] };
        if (organizationId) {
            try {
                const now = new Date();
                monthlyLeaveCaps = await leaveValidationService.getMonthlyLeaveCapSummary(
                    employeeId,
                    organizationId,
                    now.getFullYear(),
                    now.getMonth() + 1
                );
            } catch (e) {
                logger.warn('Get My Leaves: monthly cap summary failed', { employeeId, error: e.message });
            }
        }

        const statistics = {
            totalLeaves,
            leavesTaken,
            remainingLeaves: totalLeaves > 0 ? remainingLeaves : Math.max(0, totalLeaves - leavesTaken),
            leavesByType,
            balanceByType,
            hasBalanceData: Boolean(balanceByType),
            monthlyLeaveCaps
        };

        res.json({ leaves, statistics });
    } catch (error) {
        logger.error('Get My Leaves Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Error fetching your leaves', error: error.message });
    }
};

export const getMyLeaveBalance = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        if (!employeeId) {
            return sendUnauthorized(res, "Unauthorized: Employee data missing");
        }

        const organizationId = req.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return sendError(res, 'Organization ID is required. Please ensure you are authenticated.', 400, 'MISSING_ORGANIZATION_ID');
        }

        const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
        const balance = await buildEmployeeLeaveBalanceResponse(employeeId, year, organizationId);

        if (!balance) {
            return sendNotFound(res, 'Leave balance. No applicable policy for this employee.');
        }

        return sendSuccess(res, { balance }, 'Leave balance fetched successfully');
    } catch (error) {
        logger.error('Get My Leave Balance Error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Error fetching leave balance', error);
    }
};

export const uploadLeaveDocument = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        if (!employeeId) {
            return sendUnauthorized(res, "Unauthorized: Employee data missing");
        }

        if (!req.file) {
            return sendError(res, 'Document file is required', 400, 'MISSING_DOCUMENT');
        }

        const documentPath = `/uploads/documents/${path.basename(req.file.path)}`;
        return sendSuccess(
            res,
            {
                document: documentPath,
                fileName: req.file.originalname,
                mimeType: req.file.mimetype
            },
            'Leave document uploaded successfully',
            201
        );
    } catch (error) {
        logger.error('Upload Leave Document Error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Error uploading leave document', error);
    }
};

export const cancelLeave = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        if (!employeeId) {
            return sendUnauthorized(res, "Unauthorized: Employee data missing");
        }

        const { id } = req.params;
        const organizationId = req.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return sendError(res, 'Organization ID is required. Please ensure you are authenticated.', 400, 'MISSING_ORGANIZATION_ID');
        }

        const leave = await Leave.findOne({ _id: id, employee: employeeId, organizationId });
        if (!leave) {
            return sendNotFound(res, 'Leave application');
        }

        if (leave.status !== 'pending') {
            return sendError(res, 'Only pending leave requests can be cancelled', 400, 'LEAVE_NOT_CANCELLABLE');
        }

        const leaveBefore = leave.toObject();

        if (leave.approvalInstanceId) {
            try {
                const { cancelApprovalInstance } = await import('../../services/approvalWorkflowService.js');
                await cancelApprovalInstance({
                    approvalInstanceId: leave.approvalInstanceId,
                    cancelledBy: employeeId,
                    reason: 'Cancelled by employee'
                });
            } catch (workflowError) {
                logger.warn('Error cancelling approval workflow for leave', {
                    error: workflowError.message,
                    leaveId: leave._id,
                    approvalInstanceId: leave.approvalInstanceId
                });
            }
        }

        leave.status = 'cancelled';
        await leave.save();

        await logUpdate({
            entityType: 'Leave',
            entityId: leave._id,
            entityName: `${leave.leaveType} leave for ${leave.employeeName || 'Employee'}`,
            req,
            before: leaveBefore,
            after: leave.toObject(),
            metadata: {
                statusChange: true,
                previousStatus: leaveBefore.status,
                newStatus: leave.status,
                cancelledByEmployee: true
            }
        });

        try {
            const year = new Date(leave.startDate).getFullYear();
            await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
        } catch (balanceError) {
            logger.warn('Error updating leave balance after cancellation', {
                error: balanceError.message,
                leaveId: leave._id
            });
        }

        return sendSuccess(res, { leave }, 'Leave request cancelled successfully');
    } catch (error) {
        logger.error('Cancel Leave Error', { error: error.message, stack: error.stack, leaveId: req.params.id });
        return sendInternalError(res, 'Error cancelling leave request', error);
    }
};

export { leaveDocumentUpload };

