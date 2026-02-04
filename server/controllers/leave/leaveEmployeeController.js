import Employee from "../../models/employee.model.js"
import Leave from "../../models/leave.model.js"
import logger from "../../helpers/logger.js";
import { sendSuccess, sendError, sendNotFound, sendUnauthorized, sendInternalError } from "../../helpers/responseHelper.js";
import leaveBalanceEngine from "../../services/leaveBalanceEngine.js";
import leaveValidationService from "../../services/leaveValidationService.js";
import Calendar from "../../models/calendar.model.js";
import { logCreate } from "../../helpers/auditLogger.js";


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
            { startDate, endDate, leaveType },
            organizationId
        );

        if (!validation.valid) {
            return sendError(
                res,
                validation.errors.join('; '),
                400,
                'LEAVE_VALIDATION_FAILED',
                { warnings: validation.warnings }
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

        // Check leave balance before creating request (skip for loss_of_pay)
        if (leaveType !== 'loss_of_pay') {
            const year = new Date(startDate).getFullYear();
            try {
                const balance = await leaveBalanceEngine.calculateBalance(
                    employeeId,
                    year,
                    organizationId
                );

                if (balance) {
                    const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
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
        
        // ✅ INTEGRATE APPROVAL WORKFLOW
        try {
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

            // If auto-approved, update leave status
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
                : "Leave application submitted successfully", 
            201
        );

    } catch (error) {
        logger.error("Create Leave Error", { error: error.message, stack: error.stack });
        return sendInternalError(res, "Error submitting leave application", error);
    }
};
// Get current user's leaves
export const getMyLeaves = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const year = new Date().getFullYear();

        const leaves = await Leave.find({ employee: employeeId }).sort({ createdAt: -1 });

        const currentYearLeaves = leaves.filter(leave =>
            new Date(leave.startDate).getFullYear() === year &&
            leave.status === 'approved'
        );

        const statistics = {
            totalLeaves: 36,
            leavesTaken: currentYearLeaves.reduce((acc, leave) => acc + leave.duration, 0),
            leavesByType: {
                sick: currentYearLeaves.filter(l => l.leaveType === 'sick').reduce((acc, l) => acc + l.duration, 0),
                annual: currentYearLeaves.filter(l => l.leaveType === 'annual').reduce((acc, l) => acc + l.duration, 0),
                casual: currentYearLeaves.filter(l => l.leaveType === 'casual').reduce((acc, l) => acc + l.duration, 0)
            }
        };

        statistics.remainingLeaves = statistics.totalLeaves - statistics.leavesTaken;

        res.json({ leaves, statistics });
    } catch (error) {
        logger.error('Get My Leaves Error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Error fetching your leaves', error: error.message });
    }
};

