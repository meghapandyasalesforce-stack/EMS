import Leave from "../../models/leave.model.js"
import Employee from "../../models/employee.model.js";
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import LeavePolicy from "../../models/leavePolicy.model.js";
import mongoose from "mongoose";
import logger from "../../helpers/logger.js";
import { parsePagination, parseSort, sendPaginatedResponse } from "../../helpers/paginationHelper.js";
import { addOrganizationFilter } from "../../helpers/organizationHelper.js";
import { getManagerEmployeeIds, isEmployeeLinkedToManager } from "../../helpers/managerHelper.js";
import { logApprove, logReject, logUpdate } from "../../helpers/auditLogger.js";
import { notify } from "../../helpers/notificationManager.js";
import "../../helpers/notificationEventRegistry.js";
import { shouldApplyDirectLeaveStatusUpdate } from "../../helpers/leaveStatusHelper.js";
import {
    attachWorkflowSummariesToLeaves,
    executeLeaveWorkflowAction,
    getCurrentPendingStep,
    getLeaveApprovalStageLabel,
    sendLeaveActionError,
} from "../../helpers/leaveWorkflowHelper.js";
import { sendLeaveApprovalNotification, sendLeaveRejectionNotification } from "../../helpers/leaveEmailHelper.js";
import { assertApplicantApprovalAccess, resolveHrApplicantIds } from "../../helpers/functionalRolesHelper.js";

export const getAllLeaves = async (req, res) => {
    try {
        // Access is controlled by middleware (isAdminOrManagerOrHRAuthenticated)
        // No need to check role here as middleware handles it
        if (!req.user && !req.employee) {
            return res.status(403).json({ message: 'Access denied. Authentication required.' });
        }

        // Get organizationId - required for multi-tenancy
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            logger.error('Get All Leaves Error: Missing organizationId', {
                hasUser: !!req.user,
                hasEmployee: !!req.employee,
                userId: req.user?._id || req.employee?._id
            });
            return res.status(400).json({ 
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.' 
            });
        }

        // Parse pagination
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
        const sort = parseSort(req, '-createdAt');

        const { status, year } = req.query;
        let query = addOrganizationFilter(req, {});

        if (status) query.status = status;
        if (year) query.year = parseInt(year);

        // If user is a manager (not admin or HR), filter by manager field
        // Example: Manager "Arun Kumar" sees leaves for employees with manager="Arun Kumar" or "Arun"
        const isManager = shouldScopeDataToManagedTeam(req);
        if (isManager && req.employee) {
            const managerEmployeeIds = await getManagerEmployeeIds(Employee, req.organizationId, req.employee);
            query.employee = { $in: managerEmployeeIds };
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering leaves by manager field', {
                managerId: req.employee._id,
                managerName: managerName,
                employeeCount: managerEmployeeIds.length
            });
        }

        // Execute optimized query with pagination
        const [leavesRaw, total] = await Promise.all([
            Leave.find(query)
                .select('-__v')
                .populate('employee', 'name lastName email department jobTitle designation position profilePhoto manager managerId functionalRoles userId')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Leave.countDocuments(query)
        ]);

        const leavesWithWorkflow = await attachWorkflowSummariesToLeaves(leavesRaw);
        const hrApplicantIds = await resolveHrApplicantIds(
            leavesWithWorkflow.map((leave) => leave.employee).filter(Boolean)
        );
        const leaves = leavesWithWorkflow.map((leave) => ({
            ...leave,
            approvalStage: getLeaveApprovalStageLabel(leave),
            requiresAdminApproval: hrApplicantIds.has(String(leave.employee?._id || '')),
        }));

        // Calculate statistics efficiently using aggregation (only for approved leaves)
        const statsQuery = { ...query, status: 'approved' };
        const statisticsData = await Leave.aggregate([
            { $match: statsQuery },
            {
                $group: {
                    _id: '$leaveType',
                    totalDuration: { $sum: '$duration' }
                }
            }
        ]);

        const leavesByType = {
            sick: 0,
            annual: 0,
            paid: 0,
            casual: 0
        };

        if (statisticsData && Array.isArray(statisticsData)) {
            statisticsData.forEach(stat => {
                leavesByType[stat._id] = stat.totalDuration;
            });
        }

        const leavesTaken = (statisticsData && Array.isArray(statisticsData))
            ? statisticsData.reduce((acc, stat) => acc + stat.totalDuration, 0)
            : 0;

        let totalLeaves = 0;
        try {
            const policy = await LeavePolicy.findOne({
                organizationId,
                isActive: true
            }).sort({ effectiveDate: -1 });
            if (policy && policy.leaveTypes && policy.leaveTypes.length) {
                totalLeaves = policy.leaveTypes.reduce((sum, lt) => sum + (lt.accrual?.amount ?? 0), 0);
            }
        } catch (e) {
            logger.warn('Get All Leaves: policy fetch for stats failed', { organizationId, error: e.message });
        }

        const statistics = {
            totalLeaves,
            leavesTaken,
            remainingLeaves: Math.max(0, totalLeaves - leavesTaken),
            leavesByType
        };

        res.json({ 
            success: true,
            leaves,
            statistics,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Get All Leaves Error', { 
            error: error.message, 
            stack: error.stack,
            organizationId: req.organizationId || req.user?.organizationId || req.employee?.organizationId,
            hasUser: !!req.user,
            hasEmployee: !!req.employee,
            userId: req.user?._id || req.employee?._id
        });
        res.status(500).json({ 
            success: false,
            message: 'Error fetching leaves', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};



export const updateLeaveStatus = async (req, res) => {
    try {
        // Access is controlled by middleware (isAdminOrManagerOrHRAuthenticated)
        // No need to check role here as middleware handles it
        if (!req.user && !req.employee) {
            return res.status(403).json({ message: 'Access denied. Authentication required.' });
        }

        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required. Please ensure you are authenticated.'
            });
        }

        const leave = await Leave.findOne({ _id: id, organizationId }).populate('employee', 'department');
        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        // Leave raised by HR staff bypasses the manager → HR chain: org admin decides.
        try {
            await assertApplicantApprovalAccess(
                req,
                leave.employee?._id || leave.employee,
                'This leave request'
            );
        } catch (accessError) {
            return res.status(accessError.statusCode || 403).json({
                success: false,
                message: accessError.message,
            });
        }

        // Get leave before update for audit log
        const leaveBefore = leave.toObject();

        // If user is a manager (not admin or HR), verify the leave belongs to an employee linked to them
        // Example: Manager "Arun Kumar" can only approve/reject leaves for employees with manager="Arun Kumar" or "Arun"
        const isManager = shouldScopeDataToManagedTeam(req);
        let employeeLinkedForWorkflow = true;
        if (isManager && req.employee) {
            const leaveEmployee = await Employee.findById(leave.employee?._id || leave.employee).select('manager managerId').lean();
            if (!leaveEmployee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            employeeLinkedForWorkflow = isEmployeeLinkedToManager(leaveEmployee, req.employee);
            
            if (!employeeLinkedForWorkflow) {
                const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
                logger.warn('Manager trying to update leave for unlinked employee', {
                    managerId: req.employee._id,
                    managerName: managerName,
                    leaveEmployeeManager: leaveEmployee.manager,
                    leaveId: id
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'You can only approve/reject leaves for employees linked to you.' 
                });
            }
        }

        // ✅ SYNC WITH APPROVAL WORKFLOW (Manager → HR)
        const approverId = req.user?._id || req.employee?._id;
        let workflowProcessed = false;
        let workflowStillInProgress = false;
        let workflowError = false;

        // If leave has an approval instance, process through workflow
        if (leave.approvalInstanceId) {
            try {
                const { ApprovalInstance } = await import('../../models/approvalWorkflow.model.js');
                
                const approvalInstance = await ApprovalInstance.findById(leave.approvalInstanceId);
                if (approvalInstance && approvalInstance.status === 'In Progress') {
                    const currentStep = getCurrentPendingStep(approvalInstance);
                    if (currentStep) {
                        await executeLeaveWorkflowAction({
                            req,
                            approvalInstance,
                            currentStep,
                            action: status === 'approved' ? 'Approve' : 'Reject',
                            comments: rejectionReason || '',
                            leave,
                            employeeLinked: employeeLinkedForWorkflow,
                        });
                        
                        workflowProcessed = true;

                        const updatedInstance = await ApprovalInstance.findById(leave.approvalInstanceId);
                        
                        if (updatedInstance && updatedInstance.status === 'Approved') {
                            leave.status = 'approved';
                            leave.approvedBy = approverId;
                            leave.approvedAt = new Date();
                        } else if (updatedInstance && updatedInstance.status === 'Rejected') {
                            leave.status = 'rejected';
                            leave.rejectedBy = approverId;
                            leave.rejectedAt = new Date();
                            leave.rejectionReason = rejectionReason || updatedInstance.rejectionReason;
                        } else if (updatedInstance && updatedInstance.status === 'In Progress') {
                            workflowStillInProgress = true;
                        }
                    }
                }
            } catch (workflowErr) {
                workflowError = true;
                logger.error('Error processing approval workflow', {
                    error: workflowErr.message,
                    leaveId: leave._id,
                    stack: workflowErr.stack
                });
                return sendLeaveActionError(
                    res,
                    workflowErr,
                    'Error processing leave approval workflow'
                );
            }
        }
        
        // Direct status update only when no workflow, or workflow already finished
        if (shouldApplyDirectLeaveStatusUpdate({
            hasApprovalInstance: Boolean(leave.approvalInstanceId),
            workflowProcessed,
            workflowStillInProgress,
            workflowError,
        })) {
            leave.status = status;
            
            if (status === 'approved') {
                leave.approvedBy = approverId;
                leave.approvedAt = new Date();
                leave.rejectionReason = undefined;
                leave.rejectedBy = undefined;
                leave.rejectedAt = undefined;
            } else if (status === 'rejected') {
                leave.rejectedBy = approverId;
                leave.rejectedAt = new Date();
                if (rejectionReason) {
                    leave.rejectionReason = rejectionReason;
                }
                leave.approvedBy = undefined;
                leave.approvedAt = undefined;
            } else if (status === 'cancelled') {
                leave.status = 'cancelled';
            }
        }

        await leave.save();
        
        // Send email notification to employee (non-blocking)
        const employeeId = leave.employee?._id || leave.employee;
        if (employeeId) {
            setImmediate(async () => {
                try {
                    if (leave.status === 'approved') {
                        await sendLeaveApprovalNotification(
                            {
                                _id: leave._id,
                                employeeName: leave.employeeName,
                                leaveType: leave.leaveType,
                                startDate: leave.startDate,
                                endDate: leave.endDate,
                                duration: leave.duration,
                                reason: leave.reason,
                                status: leave.status,
                                approvedAt: leave.approvedAt,
                                approvedBy: approverId
                            },
                            employeeId
                        );
                    } else if (leave.status === 'rejected') {
                        await sendLeaveRejectionNotification(
                            {
                                _id: leave._id,
                                employeeName: leave.employeeName,
                                leaveType: leave.leaveType,
                                startDate: leave.startDate,
                                endDate: leave.endDate,
                                duration: leave.duration,
                                reason: leave.reason,
                                status: leave.status,
                                rejectionReason: leave.rejectionReason,
                                rejectedAt: leave.rejectedAt,
                                rejectedBy: approverId
                            },
                            employeeId
                        );
                    }
                } catch (emailError) {
                    logger.error('Failed to send leave status email notification', {
                        leaveId: leave._id,
                        employeeId,
                        status: leave.status,
                        error: emailError.message
                    });
                    // Email failure should not block the leave status update
                }
            });
        }
        
        // Log audit trail based on resolved leave status (not requested status)
        const resolvedStatus = leave.status;
        if (resolvedStatus === 'approved') {
            await logApprove({
                entityType: 'Leave',
                entityId: leave._id,
                entityName: `${leave.leaveType} leave for ${leave.employeeName || 'Employee'}`,
                req,
                before: leaveBefore,
                after: leave.toObject(),
                metadata: {
                    leaveType: leave.leaveType,
                    duration: leave.duration,
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    approverId: approverId.toString()
                }
            });
        } else if (resolvedStatus === 'rejected') {
            await logReject({
                entityType: 'Leave',
                entityId: leave._id,
                entityName: `${leave.leaveType} leave for ${leave.employeeName || 'Employee'}`,
                req,
                before: leaveBefore,
                after: leave.toObject(),
                metadata: {
                    leaveType: leave.leaveType,
                    duration: leave.duration,
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    rejectionReason,
                    rejectedBy: approverId.toString()
                }
            });
        } else {
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
                    requestedStatus: status,
                    workflowStillInProgress,
                    ...(workflowStillInProgress && status === 'approved'
                        ? { workflowStepApproved: true }
                        : {})
                }
            });
        }
        
        // Recalculate leave balance when status changes (approved: deduct used; rejected/cancelled: release pending)
        if (employeeId && (leave.status === 'approved' || leave.status === 'rejected' || leave.status === 'cancelled')) {
            try {
                const leaveBalanceEngine = (await import('../../services/leaveBalanceEngine.js')).default;
                const year = new Date(leave.startDate).getFullYear();
                const organizationId = leave.organizationId || req.organizationId || req.user?.organizationId || req.employee?.organizationId;
                if (organizationId) {
                    await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
                }
            } catch (balanceError) {
                logger.warn('Error updating leave balance after status update', {
                    error: balanceError.message,
                    leaveId: leave._id,
                    status: leave.status
                });
            }
        }

        // Only send a direct requester notification when this update bypassed the workflow
        // notification pipeline. Workflow-driven final approvals/rejections already notify
        // the employee from `approvalWorkflowService`.
        if (leave.employee && !workflowProcessed) {
            try {
                const employeeRecord = await Employee.findById(employeeId)
                    .select('_id name lastName managerId manager functionalRoles department position jobTitle')
                    .lean();

                // Determine approval stage based on workflow state
                let approvalStage = null;
                if (resolvedStatus === 'approved') {
                    // If workflow was processed, check if it was final approval
                    approvalStage = workflowStillInProgress ? 'manager' : 'final';
                }

                // Send notification using centralized manager
                let eventType;
                if (resolvedStatus === 'rejected') {
                    eventType = 'leave_rejected';
                } else if (approvalStage === 'manager') {
                    eventType = 'leave_manager_approved';
                } else {
                    eventType = 'leave_approved';
                }

                await notify({
                    type: eventType,
                    organizationId,
                    data: {
                        leave,
                        employee: employeeRecord
                    }
                });
            } catch (notifError) {
                logger.warn('Failed to send leave status notification', {
                    error: notifError.message,
                    leaveId: leave._id,
                    status
                });
                // Don't fail the request if notification fails
            }
        }

        const responseMessage = workflowStillInProgress && status === 'approved'
            ? 'Leave approved at current step. Pending HR verification.'
            : 'Leave status updated successfully';

        res.json({ success: true, message: responseMessage, leave, workflowStillInProgress });
    } catch (error) {
        logger.error('Update Leave Status Error', { error: error.message, stack: error.stack, leaveId: req.params.id });
        res.status(500).json({ message: 'Error updating leave status', error: error.message });
    }
};

 
export const getLeaveStatistics = async (req, res) => {

    try {
        // Step 1: Determine employee ID
        const rawId = req.params.employeeId || req.user?._id || req.employee?._id;

        if (!rawId) {
            return res.status(400).json({ message: 'Employee ID missing' });
        }

        // Step 2: Convert to ObjectId
        let employeeObjectId;
        try {
            employeeObjectId = new mongoose.Types.ObjectId(rawId);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid employee ID format' });
        }

        // Step 3: Admin/HR access control (only needed when accessing someone else's data)
        // Check if user is admin or HR (HR can access employee data)
        const isAdmin = req.user?.role === 'admin';
        const isHR = req.employee && (
            (req.employee.department || '').toLowerCase().includes('hr') ||
            (req.employee.jobTitle || '').toLowerCase().includes('hr') ||
            (req.employee.position || '').toLowerCase().includes('hr')
        );
        
        if (req.params.employeeId && !isAdmin && !isHR) {
            return res.status(403).json({ message: 'Access denied. Admin or HR privileges required.' });
        }

        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const employee = await Employee.findById(employeeObjectId).select('organizationId').lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (organizationId && employee.organizationId?.toString() !== organizationId.toString()) {
            return res.status(403).json({ message: 'Access denied. Employee is not in your organization.' });
        }

        const leaveQuery = { employee: employeeObjectId };
        if (organizationId) {
            leaveQuery.organizationId = organizationId;
        }
        const leaves = await Leave.find(leaveQuery);

        // Step 5: Compute statistics
        const statistics = {
            totalLeaves: leaves.length,
            approvedLeaves: leaves.filter(l => l.status === 'approved').length,
            pendingLeaves: leaves.filter(l => l.status === 'pending').length,
            rejectedLeaves: leaves.filter(l => l.status === 'rejected').length,
            leavesByType: leaves.reduce((acc, leave) => {
                acc[leave.leaveType] = (acc[leave.leaveType] || 0) + 1;
                return acc;
            }, {})
        };

        return res.json(statistics);
    } catch (error) {
        logger.error('Leave Statistics Error', { error: error.message, stack: error.stack });
        return res.status(500).json({ message: 'Error fetching leave statistics', error: error.message });
    }
};