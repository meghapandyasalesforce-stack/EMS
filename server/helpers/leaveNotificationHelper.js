import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { sendNotification } from './notificationService.js';
import { sendPushNotification, createPushPayload } from './pushNotificationService.js';
import logger from './logger.js';

const normalizeRoleText = (value) => String(value || '').trim().toLowerCase();

const formatLeaveDate = (value) => {
    const date = value ? new Date(value) : null;
    return Number.isNaN(date?.getTime?.()) ? value : date.toLocaleDateString('en-GB');
};

const isHrEmployee = (employee) => {
    const roles = Array.isArray(employee?.functionalRoles)
        ? employee.functionalRoles.map(normalizeRoleText)
        : [];
    const department = normalizeRoleText(employee?.department);
    const position = normalizeRoleText(employee?.position);
    const jobTitle = normalizeRoleText(employee?.jobTitle);

    return (
        roles.includes('hr') ||
        department === 'hr' ||
        department.includes('human resource') ||
        jobTitle.includes('hr') ||
        position.includes('hr')
    );
};

const resolveManagerRecipient = async (employee, organizationId) => {
    if (!employee) return null;

    if (employee.managerId) {
        const manager = await Employee.findOne({
            _id: employee.managerId,
            organizationId,
            status: 'active'
        })
            .select('_id')
            .lean();
        if (manager?._id) return manager._id.toString();
    }

    const managerReference = normalizeRoleText(employee.manager);
    if (!managerReference || managerReference === 'ceo') {
        return null;
    }

    const activeEmployees = await Employee.find({
        organizationId,
        status: 'active'
    })
        .select('_id name lastName')
        .lean();

    const match = activeEmployees.find((candidate) => {
        const fullName = normalizeRoleText(`${candidate?.name || ''} ${candidate?.lastName || ''}`);
        const firstName = normalizeRoleText(candidate?.name);
        return (
            managerReference === fullName ||
            managerReference === firstName ||
            fullName.startsWith(`${managerReference} `)
        );
    });

    return match?._id?.toString() || null;
};

const getLeaveStakeholderRecipientIds = async ({ employee, organizationId, includeAdmins = true, includeHr = true, includeManager = true, excludeIds = [] }) => {
    const excluded = new Set(excludeIds.filter(Boolean).map((id) => id.toString()));
    const recipientIds = new Set();

    const queries = [];
    if (includeHr || includeManager) {
        queries.push(
            Employee.find({ organizationId, status: 'active' })
                .select('_id name lastName functionalRoles department position jobTitle managerId manager')
                .lean()
        );
    } else {
        queries.push(Promise.resolve([]));
    }

    if (includeAdmins) {
        queries.push(
            User.find({ organizationId, role: 'admin', isActive: true })
                .select('_id')
                .lean()
        );
    } else {
        queries.push(Promise.resolve([]));
    }

    const [employeeDirectory, adminUsers] = await Promise.all(queries);

    if (includeHr) {
        employeeDirectory
            .filter(isHrEmployee)
            .forEach((hrEmployee) => recipientIds.add(hrEmployee._id.toString()));
    }

    if (includeManager) {
        const managerId = await resolveManagerRecipient(employee, organizationId);
        if (managerId) recipientIds.add(managerId);
    }

    if (includeAdmins) {
        adminUsers.forEach((admin) => recipientIds.add(admin._id.toString()));
    }

    excluded.forEach((id) => recipientIds.delete(id));
    return [...recipientIds];
};

const sendLeaveNotifications = async ({ recipientIds, title, message, type, priority, metadata, organizationId, logContext }) => {
    if (!recipientIds.length) return;

    const results = await Promise.allSettled(
        recipientIds.map((recipientId) =>
            sendNotification({
                userId: recipientId,
                title,
                message,
                type,
                priority,
                metadata,
                organizationId
            })
        )
    );

    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
        logger.warn('Some leave notifications failed', {
            failedCount,
            totalCount: results.length,
            ...logContext
        });
    }
};

const sendLeavePushNotifications = async ({ recipientIds, title, message, type, metadata, organizationId, logContext }) => {
    if (!recipientIds.length) return;

    const results = await Promise.allSettled(
        recipientIds.map(async (recipientId) => {
            try {
                const employee = await Employee.findById(recipientId).select('_id').lean();
                const user = await User.findById(recipientId).select('_id').lean();
                
                const recipientType = employee ? 'Employee' : (user ? 'User' : 'Employee');
                const pushPayload = createPushPayload(message, type, metadata);
                
                return await sendPushNotification(recipientId, recipientType, pushPayload, organizationId);
            } catch (error) {
                logger.error('Error sending push notification to recipient', {
                    recipientId,
                    error: error.message
                });
                throw error;
            }
        })
    );

    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
        logger.warn('Some leave push notifications failed', {
            failedCount,
            totalCount: results.length,
            ...logContext
        });
    }
};

export const notifyLeaveSubmissionStakeholders = async ({ leave, employee, organizationId }) => {
    try {
        const recipientIds = await getLeaveStakeholderRecipientIds({
            employee,
            organizationId,
            includeAdmins: true,
            includeHr: true,
            includeManager: true
        });

        const title = 'New Leave Request';
        const message = `${leave.employeeName} has applied for ${leave.leaveType} leave from ${formatLeaveDate(leave.startDate)} to ${formatLeaveDate(leave.endDate)}.`;

        await sendLeaveNotifications({
            recipientIds,
            title,
            message,
            type: 'leave_request',
            priority: leave.duration > 5 ? 'high' : 'medium',
            metadata: {
                leaveId: leave._id,
                employeeId: employee._id,
                leaveType: leave.leaveType,
                startDate: leave.startDate,
                endDate: leave.endDate,
                duration: leave.duration,
                status: leave.status
            },
            organizationId,
            logContext: {
                leaveId: leave._id,
                employeeId: employee._id,
                phase: 'submission'
            }
        });

        await sendLeavePushNotifications({
            recipientIds,
            title,
            message,
            type: 'leave',
            metadata: {
                leaveId: leave._id,
                employeeId: employee._id,
                leaveType: leave.leaveType,
                startDate: leave.startDate,
                endDate: leave.endDate,
                status: leave.status
            },
            organizationId,
            logContext: {
                leaveId: leave._id,
                employeeId: employee._id,
                phase: 'submission_push'
            }
        });
    } catch (error) {
        logger.error('Failed to notify leave submission stakeholders', {
            leaveId: leave?._id,
            employeeId: employee?._id,
            error: error.message
        });
    }
};

export const notifyLeaveStatusStakeholders = async ({ leave, employee, organizationId, status, approvalStage = null }) => {
    try {
        const normalizedStatus = normalizeRoleText(status || leave?.status);
        if (!['approved', 'rejected'].includes(normalizedStatus)) {
            return;
        }

        if (normalizedStatus === 'rejected') {
            const title = 'Leave Request Rejected';
            const message = 'Your leave request has been rejected.';
            
            await sendLeaveNotifications({
                recipientIds: [employee?._id || leave.employee],
                title,
                message,
                type: 'leave_rejected',
                priority: 'medium',
                metadata: {
                    leaveId: leave._id,
                    employeeId: employee?._id || leave.employee,
                    leaveType: leave.leaveType,
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    status: normalizedStatus,
                    rejectionReason: leave.rejectionReason || ''
                },
                organizationId,
                logContext: {
                    leaveId: leave._id,
                    employeeId: employee?._id || leave.employee,
                    phase: 'status_update',
                    status: normalizedStatus
                }
            });

            await sendLeavePushNotifications({
                recipientIds: [employee?._id || leave.employee],
                title,
                message,
                type: 'leave',
                metadata: {
                    leaveId: leave._id,
                    employeeId: employee?._id || leave.employee,
                    leaveType: leave.leaveType,
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    status: normalizedStatus
                },
                organizationId,
                logContext: {
                    leaveId: leave._id,
                    employeeId: employee?._id || leave.employee,
                    phase: 'rejection_push'
                }
            });
            return;
        }

        if (normalizedStatus === 'approved') {
            if (approvalStage === 'manager') {
                const recipientIds = await getLeaveStakeholderRecipientIds({
                    employee,
                    organizationId,
                    includeAdmins: true,
                    includeHr: true,
                    includeManager: false,
                    excludeIds: []
                });

                const title = 'Leave Approved by Manager';
                const message = 'Your leave request has been approved by your manager and is awaiting final approval.';

                await sendLeaveNotifications({
                    recipientIds: [employee?._id || leave.employee, ...recipientIds],
                    title,
                    message,
                    type: 'leave_manager_approved',
                    priority: 'medium',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'manager_approval',
                        status: normalizedStatus
                    }
                });

                await sendLeavePushNotifications({
                    recipientIds: [employee?._id || leave.employee, ...recipientIds],
                    title,
                    message,
                    type: 'leave',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'manager_approval_push'
                    }
                });
            } else if (approvalStage === 'admin' || approvalStage === 'final') {
                const recipientIds = await getLeaveStakeholderRecipientIds({
                    employee,
                    organizationId,
                    includeAdmins: false,
                    includeHr: true,
                    includeManager: true,
                    excludeIds: []
                });

                const title = 'Leave Approved';
                const message = 'Your leave request has been fully approved.';

                await sendLeaveNotifications({
                    recipientIds: [employee?._id || leave.employee, ...recipientIds],
                    title,
                    message,
                    type: 'leave_approved',
                    priority: 'medium',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'final_approval',
                        status: normalizedStatus
                    }
                });

                await sendLeavePushNotifications({
                    recipientIds: [employee?._id || leave.employee, ...recipientIds],
                    title,
                    message,
                    type: 'leave',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'final_approval_push'
                    }
                });
            } else {
                const recipientIds = await getLeaveStakeholderRecipientIds({
                    employee,
                    organizationId,
                    includeAdmins: true,
                    includeHr: true,
                    includeManager: true,
                    excludeIds: [employee?._id]
                });

                const title = 'Leave Approved';
                const message = `${leave.employeeName} had ${leave.leaveType} leave ${normalizedStatus} for ${formatLeaveDate(leave.startDate)} to ${formatLeaveDate(leave.endDate)}.`;

                await sendLeaveNotifications({
                    recipientIds,
                    title,
                    message,
                    type: `leave_${normalizedStatus}`,
                    priority: 'medium',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus,
                        rejectionReason: leave.rejectionReason || ''
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'status_update',
                        status: normalizedStatus
                    }
                });

                await sendLeavePushNotifications({
                    recipientIds,
                    title,
                    message,
                    type: 'leave',
                    metadata: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        leaveType: leave.leaveType,
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        status: normalizedStatus
                    },
                    organizationId,
                    logContext: {
                        leaveId: leave._id,
                        employeeId: employee?._id || leave.employee,
                        phase: 'approval_push'
                    }
                });
            }
        }
    } catch (error) {
        logger.error('Failed to notify leave status stakeholders', {
            leaveId: leave?._id,
            employeeId: employee?._id || leave?.employee,
            status,
            approvalStage,
            error: error.message
        });
    }
};
