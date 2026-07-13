/**
 * Notification Event Registry
 * Registers all application events with the Notification Manager
 * This is where new events are added to the centralized notification system
 */

import { registerEvent } from './notificationManager.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import logger from './logger.js';

// Helper function to normalize role text
const normalizeRoleText = (value) => String(value || '').trim().toLowerCase();

// Helper function to check if employee is HR
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

// Helper function to resolve manager
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

// Helper to get leave stakeholders (Admins, HR, Manager)
const getLeaveStakeholderRecipients = async ({ employee, organizationId, includeAdmins = true, includeHr = true, includeManager = true, excludeIds = [] }) => {
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

// Helper to get HR/Admin/CEO recipients for break and attendance events
const getHrAdminCeoRecipients = async (organizationId) => {
  const recipientIds = new Set();

  // Get all admins
  const admins = await User.find({ role: 'admin', organizationId, isActive: true });
  admins.forEach(admin => recipientIds.add(admin._id.toString()));

  // Get HR employees
  const hrEmployees = await Employee.find({
    organizationId,
    status: 'active',
    $or: [
      { functionalRoles: { $in: ['hr', 'HR'] } },
      { department: { $regex: /hr/i } },
      { jobTitle: { $regex: /hr/i } },
      { position: { $regex: /hr/i } }
    ]
  }).select('_id').lean();
  hrEmployees.forEach(hr => recipientIds.add(hr._id.toString()));

  // Get CEO employees
  const ceoEmployees = await Employee.find({
    organizationId,
    status: 'active',
    $or: [
      { jobTitle: { $regex: /ceo/i } },
      { position: { $regex: /ceo/i } },
      { functionalRoles: { $in: ['ceo', 'CEO'] } }
    ]
  }).select('_id').lean();
  ceoEmployees.forEach(ceo => recipientIds.add(ceo._id.toString()));

  return [...recipientIds];
};

// Helper to format leave date
const formatLeaveDate = (value) => {
  const date = value ? new Date(value) : null;
  return Number.isNaN(date?.getTime?.()) ? value : date.toLocaleDateString('en-GB');
};

// ==================== LEAVE EVENTS ====================

// Leave Applied
registerEvent({
  type: 'leave_applied',
  defaultTitle: 'New Leave Request',
  defaultType: 'leave_request',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee, organizationId }) => {
    return await getLeaveStakeholderRecipients({
      employee,
      organizationId,
      includeAdmins: true,
      includeHr: true,
      includeManager: true
    });
  },
  messageBuilder: ({ leave, employee }) => {
    return `${leave.employeeName} has applied for ${leave.leaveType} leave from ${formatLeaveDate(leave.startDate)} to ${formatLeaveDate(leave.endDate)}.`;
  },
  metadataBuilder: ({ leave, employee }) => ({
    leaveId: leave._id,
    employeeId: employee._id,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    duration: leave.duration,
    status: leave.status
  })
});

// Leave Approved (Manager Stage)
registerEvent({
  type: 'leave_manager_approved',
  defaultTitle: 'Leave Approved by Manager',
  defaultType: 'leave_manager_approved',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee, organizationId }) => {
    const recipients = await getLeaveStakeholderRecipients({
      employee,
      organizationId,
      includeAdmins: true,
      includeHr: true,
      includeManager: false
    });
    return [employee._id, ...recipients];
  },
  messageBuilder: () => 'Your leave request has been approved by your manager and is awaiting final approval.',
  metadataBuilder: ({ leave, employee }) => ({
    leaveId: leave._id,
    employeeId: employee._id,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: 'approved'
  })
});

// Leave Approved (Final)
registerEvent({
  type: 'leave_approved',
  defaultTitle: 'Leave Approved',
  defaultType: 'leave_approved',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee, organizationId }) => {
    const recipients = await getLeaveStakeholderRecipients({
      employee,
      organizationId,
      includeAdmins: true,
      includeHr: true,
      includeManager: false,
      excludeIds: [employee._id]
    });
    return [employee._id, ...recipients];
  },
  messageBuilder: () => 'Your leave request has been fully approved.',
  metadataBuilder: ({ leave, employee }) => ({
    leaveId: leave._id,
    employeeId: employee._id,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: 'approved'
  })
});

// Leave Rejected
registerEvent({
  type: 'leave_rejected',
  defaultTitle: 'Leave Request Rejected',
  defaultType: 'leave_rejected',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: () => 'Your leave request has been rejected.',
  metadataBuilder: ({ leave, employee }) => ({
    leaveId: leave._id,
    employeeId: employee._id,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: 'rejected',
    rejectionReason: leave.rejectionReason || ''
  })
});

// ==================== BREAK EVENTS ====================

// Break Started
registerEvent({
  type: 'break_started',
  defaultTitle: 'Employee Started Break',
  defaultType: 'break',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => {
    return await getHrAdminCeoRecipients(organizationId);
  },
  messageBuilder: ({ employee }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${employee.name} ${employee.lastName || ''} has started a break at ${time}.`;
  },
  metadataBuilder: ({ employee }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    breakTime: new Date()
  })
});

// Break Ended
registerEvent({
  type: 'break_ended',
  defaultTitle: 'Employee Returned from Break',
  defaultType: 'break',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => {
    return await getHrAdminCeoRecipients(organizationId);
  },
  messageBuilder: ({ employee }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${employee.name} ${employee.lastName || ''} has returned from break at ${time}.`;
  },
  metadataBuilder: ({ employee }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    breakEndTime: new Date()
  })
});

// ==================== ATTENDANCE EVENTS ====================

// Punch In
registerEvent({
  type: 'punch_in',
  defaultTitle: 'Employee Clocked In',
  defaultType: 'attendance',
  defaultPriority: 'low',
  recipientResolver: async ({ organizationId }) => {
    return await getHrAdminCeoRecipients(organizationId);
  },
  messageBuilder: ({ employee }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${employee.name} ${employee.lastName || ''} clocked in at ${time}.`;
  },
  metadataBuilder: ({ employee, attendanceData }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    punchInTime: new Date(),
    ...attendanceData
  })
});

// Punch Out
registerEvent({
  type: 'punch_out',
  defaultTitle: 'Employee Clocked Out',
  defaultType: 'attendance',
  defaultPriority: 'low',
  recipientResolver: async ({ organizationId }) => {
    return await getHrAdminCeoRecipients(organizationId);
  },
  messageBuilder: ({ employee }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${employee.name} ${employee.lastName || ''} clocked out at ${time}.`;
  },
  metadataBuilder: ({ employee, attendanceData }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    punchOutTime: new Date(),
    ...attendanceData
  })
});

// Late Arrival
registerEvent({
  type: 'late_arrival',
  defaultTitle: 'Late Arrival',
  defaultType: 'attendance_penalty',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: ({ clockInTime, expectedTime, lateMinutes }) => {
    return `You checked in ${lateMinutes} minutes late on ${clockInTime.toLocaleDateString()} at ${clockInTime.toLocaleTimeString()}. Expected time: ${expectedTime.toLocaleTimeString()}.`;
  },
  metadataBuilder: ({ lateMinutes, clockInTime, expectedTime, rule }) => ({
    penaltyType: 'late_arrival',
    lateMinutes,
    clockInTime,
    expectedTime,
    action: rule?.penaltyRules?.lateArrival?.action || 'warning'
  })
});

// Early Departure
registerEvent({
  type: 'early_departure',
  defaultTitle: 'Early Departure',
  defaultType: 'attendance_penalty',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: ({ clockOutTime, expectedTime, earlyMinutes }) => {
    return `You checked out ${earlyMinutes} minutes early on ${clockOutTime.toLocaleDateString()} at ${clockOutTime.toLocaleTimeString()}. Expected time: ${expectedTime.toLocaleTimeString()}.`;
  },
  metadataBuilder: ({ earlyMinutes, clockOutTime, expectedTime, rule }) => ({
    penaltyType: 'early_departure',
    earlyMinutes,
    clockOutTime,
    expectedTime,
    action: rule?.penaltyRules?.earlyDeparture?.action || 'warning'
  })
});

// Location Validation Failed
registerEvent({
  type: 'location_validation_failed',
  defaultTitle: 'Location Validation Failed',
  defaultType: 'attendance_error',
  defaultPriority: 'high',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: ({ message }) => message,
  metadataBuilder: ({ reason, timestamp }) => ({
    reason,
    timestamp
  })
});

// ==================== EMPLOYEE EVENTS ====================

// New Employee Joined
registerEvent({
  type: 'new_employee_joined',
  defaultTitle: 'New Employee Joined 🎉',
  defaultType: 'new_employee',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => {
    return await getHrAdminCeoRecipients(organizationId);
  },
  messageBuilder: ({ employee }) => {
    return `Welcome ${employee.name} ${employee.lastName || ''} to Paarsiv Technologies Private Limited. We wish you a successful and rewarding journey with us!`;
  },
  metadataBuilder: ({ employee }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    jobTitle: employee.jobTitle,
    department: employee.department
  })
});

// ==================== ANNOUNCEMENT EVENTS ====================

// Announcement Created
registerEvent({
  type: 'announcement_created',
  defaultTitle: 'New Announcement',
  defaultType: 'announcement',
  defaultPriority: 'high',
  isBroadcast: true,
  recipientResolver: async () => [],
  messageBuilder: ({ announcement }) => {
    return announcement.title || announcement.message || 'A new announcement has been posted.';
  },
  metadataBuilder: ({ announcement }) => ({
    announcementId: announcement._id,
    title: announcement.title,
    category: announcement.category
  })
});

// ==================== SPECIAL EVENTS ====================

// Birthday
registerEvent({
  type: 'birthday',
  defaultTitle: 'Birthday Celebration 🎂',
  defaultType: 'birthday',
  defaultPriority: 'low',
  isBroadcast: true,
  recipientResolver: async () => [],
  messageBuilder: ({ employee }) => {
    return `Today is ${employee.name} ${employee.lastName || ''}'s birthday! 🎂`;
  },
  metadataBuilder: ({ employee }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    eventType: 'birthday'
  })
});

// Work Anniversary
registerEvent({
  type: 'work_anniversary',
  defaultTitle: 'Work Anniversary 🎉',
  defaultType: 'anniversary',
  defaultPriority: 'low',
  isBroadcast: true,
  recipientResolver: async () => [],
  messageBuilder: ({ employee, years }) => {
    return `${employee.name} ${employee.lastName || ''} is celebrating ${years} year(s) with us! 🎉`;
  },
  metadataBuilder: ({ employee, years }) => ({
    employeeId: employee._id,
    employeeName: `${employee.name} ${employee.lastName || ''}`,
    eventType: 'work_anniversary',
    years
  })
});

// Holiday
registerEvent({
  type: 'holiday',
  defaultTitle: 'Holiday Notice',
  defaultType: 'holiday',
  defaultPriority: 'medium',
  isBroadcast: true,
  recipientResolver: async () => [],
  messageBuilder: ({ holiday }) => {
    const holidayDate = holiday?.date ? new Date(holiday.date).toLocaleDateString('en-GB') : '';
    return `${holiday.name}${holidayDate ? ` on ${holidayDate}` : ''} is a holiday.`;
  },
  metadataBuilder: ({ holiday }) => ({
    holidayId: holiday._id,
    name: holiday.name,
    date: holiday.date,
    eventType: 'holiday'
  })
});

// ==================== PAYROLL EVENTS ====================

// Payroll Released
registerEvent({
  type: 'payroll_released',
  defaultTitle: 'Payroll Released',
  defaultType: 'payroll',
  defaultPriority: 'high',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: ({ payrollData }) => {
    return `Your payroll for ${payrollData.month} ${payrollData.year} has been released. Net Salary: $${(payrollData.inHandSalary || 0).toFixed(2)}`;
  },
  metadataBuilder: ({ payrollData }) => ({
    payrollId: payrollData._id,
    month: payrollData.month,
    year: payrollData.year,
    amount: payrollData.inHandSalary
  })
});

// ==================== ATTENDANCE REGULARIZATION EVENTS ====================

// Attendance Regularization Request Submitted
registerEvent({
  type: 'attendance_regularization_request',
  defaultTitle: 'Attendance Regularization Request',
  defaultType: 'attendance_regularization',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee, organizationId }) => {
    const recipients = await getLeaveStakeholderRecipients({
      employee,
      organizationId,
      includeAdmins: true,
      includeHr: true,
      includeManager: true
    });
    logger.info('Attendance regularization request recipient resolver', {
      employeeId: employee?._id,
      organizationId,
      recipientCount: recipients.length,
      recipients: recipients
    });
    return recipients;
  },
  messageBuilder: ({ regularization, employee }) => {
    const attendanceDate = regularization?.attendanceDate 
      ? new Date(regularization.attendanceDate).toLocaleDateString('en-GB') 
      : 'N/A';
    const employeeName = employee?.name ? `${employee.name} ${employee.lastName || ''}` : 'An employee';
    return `${employeeName} has submitted an attendance regularization request for ${attendanceDate}.`;
  },
  metadataBuilder: ({ regularization, employee }) => ({
    regularizationId: regularization._id,
    employeeId: employee._id,
    attendanceDate: regularization.attendanceDate,
    regularizationType: regularization.regularizationType,
    status: regularization.status
  })
});

// Attendance Regularization Approved
registerEvent({
  type: 'attendance_regularization_approved',
  defaultTitle: 'Attendance Regularization Approved',
  defaultType: 'attendance_regularization',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: () => 'Your attendance regularization request has been approved.',
  metadataBuilder: ({ regularization, employee }) => ({
    regularizationId: regularization._id,
    employeeId: employee._id,
    attendanceDate: regularization.attendanceDate,
    regularizationType: regularization.regularizationType,
    status: 'approved'
  })
});

// Attendance Regularization Rejected
registerEvent({
  type: 'attendance_regularization_rejected',
  defaultTitle: 'Attendance Regularization Rejected',
  defaultType: 'attendance_regularization',
  defaultPriority: 'medium',
  recipientResolver: async ({ employee }) => [employee._id],
  messageBuilder: () => 'Your attendance regularization request has been rejected.',
  metadataBuilder: ({ regularization, employee }) => ({
    regularizationId: regularization._id,
    employeeId: employee._id,
    attendanceDate: regularization.attendanceDate,
    regularizationType: regularization.regularizationType,
    status: 'rejected',
    rejectionReason: regularization.rejectionReason
  })
});

// ==================== TASK EVENTS ====================

// Task Created
registerEvent({
  type: 'task_created',
  defaultTitle: 'New Task',
  defaultType: 'task_created',
  defaultPriority: 'low',
  recipientResolver: async ({ recipients }) => recipients || [],
  messageBuilder: ({ task, employee, project }) => {
    return `${employee.name} created a new task "${task.taskDescription}" in project "${project.name}"`;
  },
  metadataBuilder: ({ task, employee, project }) => ({
    taskId: task._id,
    taskDescription: task.taskDescription,
    projectId: project._id,
    projectName: project.name,
    employeeId: employee._id,
    employeeName: employee.name
  })
});

// Task Updated
registerEvent({
  type: 'task_updated',
  defaultTitle: 'Task Updated',
  defaultType: 'task_update',
  defaultPriority: 'medium',
  recipientResolver: async ({ recipients }) => recipients || [],
  messageBuilder: ({ task, employee, project }) => {
    return `${employee.name} updated task "${task.taskDescription}" in project "${project.name}"`;
  },
  metadataBuilder: ({ task, employee, project }) => ({
    taskId: task._id,
    taskDescription: task.taskDescription,
    projectId: project._id,
    projectName: project.name,
    employeeId: employee._id,
    employeeName: employee.name
  })
});

// Task Completed
registerEvent({
  type: 'task_completed',
  defaultTitle: 'Task Completed',
  defaultType: 'task_completed',
  defaultPriority: 'high',
  recipientResolver: async ({ recipients }) => recipients || [],
  messageBuilder: ({ task, employee, project }) => {
    return `🎉 ${employee.name} completed task "${task.taskDescription}" in project "${project.name}"`;
  },
  metadataBuilder: ({ task, employee, project }) => ({
    taskId: task._id,
    taskDescription: task.taskDescription,
    projectId: project._id,
    projectName: project.name,
    employeeId: employee._id,
    employeeName: employee.name
  })
});

export default {
  // This file auto-registers events on import
};
