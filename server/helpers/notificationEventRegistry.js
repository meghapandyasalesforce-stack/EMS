/**
 * Notification Event Registry
 * Registers all application events with the Notification Manager
 * This is where new events are added to the centralized notification system
 */

import { registerEvent } from './notificationManager.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import logger from './logger.js';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';
import { formatDateInTimezone, formatTimeInTimezone } from './timezoneHelper.js';

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
  messageBuilder: ({ employee, timezone }) => {
    const time = formatTimeInTimezone(new Date(), timezone || DEFAULT_TIMEZONE);
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
  messageBuilder: ({ employee, timezone }) => {
    const time = formatTimeInTimezone(new Date(), timezone || DEFAULT_TIMEZONE);
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
  messageBuilder: ({ employee, timezone }) => {
    const time = formatTimeInTimezone(new Date(), timezone || DEFAULT_TIMEZONE);
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
  messageBuilder: ({ employee, timezone }) => {
    const time = formatTimeInTimezone(new Date(), timezone || DEFAULT_TIMEZONE);
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
  messageBuilder: ({ clockInTime, expectedTime, lateMinutes, timezone }) => {
    const tz = timezone || DEFAULT_TIMEZONE;
    return `You checked in ${lateMinutes} minutes late on ${formatDateInTimezone(clockInTime, tz)} at ${formatTimeInTimezone(clockInTime, tz)}. Expected time: ${formatTimeInTimezone(expectedTime, tz)}.`;
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
  messageBuilder: ({ clockOutTime, expectedTime, earlyMinutes, timezone }) => {
    const tz = timezone || DEFAULT_TIMEZONE;
    return `You checked out ${earlyMinutes} minutes early on ${formatDateInTimezone(clockOutTime, tz)} at ${formatTimeInTimezone(clockOutTime, tz)}. Expected time: ${formatTimeInTimezone(expectedTime, tz)}.`;
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

// Task Assigned (work-plan task / subtask)
registerEvent({
  type: 'work_item_assigned',
  defaultTitle: 'Task assigned',
  defaultType: 'task_assigned',
  defaultPriority: 'high',
  recipientResolver: async ({ assignee }) => (assignee?._id ? [assignee._id.toString()] : []),
  messageBuilder: ({ workItem, project }) => {
    const title = workItem?.title || 'a task';
    const projectName = project?.name || 'a project';
    return `You have been assigned to "${title}" on project "${projectName}".`;
  },
  metadataBuilder: ({ workItem, project }) => ({
    workItemId: workItem?._id,
    projectId: project?._id || workItem?.projectId,
    projectName: project?.name,
    taskTitle: workItem?.title,
    eventType: 'work_item_assigned',
  }),
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

// ==================== ONBOARDING EVENTS ====================

const onboardingId = (value) => value?._id?.toString?.() || value?.toString?.() || null;
const onboardingName = (employee) => {
  const name = `${employee?.name || ''} ${employee?.lastName || ''}`.trim();
  return name || 'The employee';
};
const uniqueOnboardingIds = (values) => [...new Set(values.map(onboardingId).filter(Boolean))];

/** HR often logs in as User while tasks store Employee IDs — notify both. */
const expandOnboardingRecipients = async (recipientIds, organizationId, { includeAdmins = false } = {}) => {
  const ids = new Set(uniqueOnboardingIds(recipientIds));
  if (!ids.size && !includeAdmins) return [];

  if (ids.size) {
    const employees = await Employee.find({ _id: { $in: [...ids] } })
      .select('_id userId')
      .lean();
    employees.forEach((employee) => {
      if (employee?.userId) ids.add(employee.userId.toString());
    });
  }

  if (includeAdmins && organizationId) {
    const admins = await User.find({
      organizationId,
      role: 'admin',
      isActive: true,
    }).select('_id').lean();
    admins.forEach((admin) => ids.add(admin._id.toString()));
  }

  return [...ids];
};

const getOnboardingRoleRecipients = async (organizationId, role) => {
  const roleQueries = {
    hr: [
      { functionalRoles: { $in: ['hr', 'HR'] } },
      { department: { $regex: /human resource|^hr$/i } },
      { jobTitle: { $regex: /\bhr\b|human resource/i } },
      { position: { $regex: /\bhr\b|human resource/i } },
    ],
    it: [
      { functionalRoles: { $in: ['it', 'IT'] } },
      { department: { $regex: /^it$|information technology/i } },
      { jobTitle: { $regex: /\bit\b|information technology|system admin/i } },
      { position: { $regex: /\bit\b|information technology|system admin/i } },
    ],
  };
  const conditions = roleQueries[role];
  if (!conditions) return [];
  const employees = await Employee.find({
    organizationId,
    status: 'active',
    $or: conditions,
  }).select('_id userId').lean();
  return employees.flatMap((employee) => [
    employee._id.toString(),
    ...(employee.userId ? [employee.userId.toString()] : []),
  ]);
};

const getOnboardingHrRecipients = async (workflow, organizationId) => expandOnboardingRecipients([
  workflow?.assignedHR,
  ...(await getOnboardingRoleRecipients(organizationId, 'hr')),
], organizationId, { includeAdmins: true });

const getOnboardingProgressRecipients = async (
  workflow,
  organizationId,
  { employee = false, hr = false, manager = false, buddy = false, it = false } = {},
) => {
  const ids = [];
  if (employee) ids.push(workflow?.employeeId);
  if (hr) ids.push(...await getOnboardingHrRecipients(workflow, organizationId));
  if (manager) ids.push(workflow?.assignedManager);
  if (buddy) ids.push(workflow?.assignedBuddy);
  if (it) {
    ids.push(
      ...(workflow?.tasks || [])
        .filter((task) => task.assigneeRole === 'it')
        .map((task) => task.assignedTo),
      ...await getOnboardingRoleRecipients(organizationId, 'it'),
    );
  }
  return expandOnboardingRecipients(ids, organizationId, { includeAdmins: hr });
};

registerEvent({
  type: 'onboarding_workflow_assigned',
  defaultTitle: 'New Onboarding Assigned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, employee, organizationId }) =>
    expandOnboardingRecipients([employee?._id, workflow?.employeeId], organizationId),
  messageBuilder: () =>
    'Welcome! Your onboarding process has been assigned. Please log in and start completing your onboarding tasks.',
  metadataBuilder: ({ employee, workflow }) => ({
    employeeId: employee?._id,
    workflowId: workflow?._id,
    eventType: 'onboarding_workflow_assigned',
  }),
});

registerEvent({
  type: 'onboarding_task_assigned',
  defaultTitle: 'New Onboarding Task',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ task, organizationId }) =>
    expandOnboardingRecipients([task?.assignedTo], organizationId),
  messageBuilder: () => 'A new onboarding task has been assigned to you.',
  metadataBuilder: ({ workflow, task }) => ({
    workflowId: workflow?._id,
    taskId: task?._id,
    eventType: 'onboarding_task_assigned',
  }),
});

registerEvent({
  type: 'onboarding_task_started',
  defaultTitle: 'Task Started',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true, manager: true }),
  messageBuilder: ({ employee, task }) =>
    `${onboardingName(employee)} has started the task "${task?.title}".`,
  metadataBuilder: ({ workflow, task, employee }) => ({
    workflowId: workflow?._id,
    taskId: task?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_task_started',
  }),
});

registerEvent({
  type: 'onboarding_task_completed',
  defaultTitle: 'Task Completed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true, manager: true, buddy: true }),
  messageBuilder: ({ employee, task }) =>
    `${onboardingName(employee)} has completed the task "${task?.title}".`,
  metadataBuilder: ({ workflow, task, employee }) => ({
    workflowId: workflow?._id,
    taskId: task?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_task_completed',
  }),
});

registerEvent({
  type: 'onboarding_document_uploaded',
  defaultTitle: 'Document Uploaded',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingHrRecipients(workflow, organizationId),
  messageBuilder: ({ employee, documentName, documentType }) =>
    `${onboardingName(employee)} uploaded ${documentName || documentType}. Please verify the document.`,
  metadataBuilder: ({ workflow, doc, documentType, employee }) => ({
    workflowId: workflow?._id,
    documentId: doc?._id,
    documentType: doc?.documentType || documentType,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_document_uploaded',
  }),
});

registerEvent({
  type: 'onboarding_document_approved',
  defaultTitle: 'Document Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    expandOnboardingRecipients([workflow?.employeeId], organizationId),
  messageBuilder: ({ documentName, doc }) =>
    `Your ${documentName || doc?.name || doc?.documentType} has been verified successfully.`,
  metadataBuilder: ({ workflow, doc }) => ({
    workflowId: workflow?._id,
    documentId: doc?._id,
    documentType: doc?.documentType,
    eventType: 'onboarding_document_approved',
  }),
});

registerEvent({
  type: 'onboarding_document_rejected',
  defaultTitle: 'Document Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ workflow, organizationId }) =>
    expandOnboardingRecipients([workflow?.employeeId], organizationId),
  messageBuilder: ({ documentName, doc }) =>
    `Your ${documentName || doc?.name || doc?.documentType} was rejected. Please upload the correct document after reviewing the comments.`,
  metadataBuilder: ({ workflow, doc }) => ({
    workflowId: workflow?._id,
    documentId: doc?._id,
    documentType: doc?.documentType,
    rejectionReason: doc?.rejectionReason,
    eventType: 'onboarding_document_rejected',
  }),
});

registerEvent({
  type: 'onboarding_checklist_completed',
  defaultTitle: 'Checklist Updated',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingHrRecipients(workflow, organizationId),
  messageBuilder: ({ employee, item }) =>
    `${onboardingName(employee)} completed the checklist item "${item?.item}".`,
  metadataBuilder: ({ workflow, item, employee }) => ({
    workflowId: workflow?._id,
    checklistItemId: item?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_checklist_completed',
  }),
});

registerEvent({
  type: 'onboarding_asset_assigned',
  defaultTitle: 'Asset Assigned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    expandOnboardingRecipients([workflow?.employeeId], organizationId),
  messageBuilder: ({ asset }) =>
    `A ${asset?.name || asset?.assetType || 'company asset'} has been assigned to you as part of your onboarding.`,
  metadataBuilder: ({ workflow, asset }) => ({
    workflowId: workflow?._id,
    assetId: asset?._id,
    eventType: 'onboarding_asset_assigned',
  }),
});

registerEvent({
  type: 'onboarding_asset_returned',
  defaultTitle: 'Asset Returned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true, it: true }),
  messageBuilder: ({ employee, asset }) =>
    `${onboardingName(employee)} has returned the assigned ${asset?.name || asset?.assetType || 'asset'}.`,
  metadataBuilder: ({ workflow, asset, employee }) => ({
    workflowId: workflow?._id,
    assetId: asset?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_asset_returned',
  }),
});

registerEvent({
  type: 'onboarding_training_completed',
  defaultTitle: 'Training Completed',
  defaultType: 'onboarding',
  defaultPriority: 'low',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true, manager: true }),
  messageBuilder: ({ employee, module }) =>
    `${onboardingName(employee)} has successfully completed the assigned training module${module?.title ? ` "${module.title}"` : ''}.`,
  metadataBuilder: ({ workflow, module, employee }) => ({
    workflowId: workflow?._id,
    trainingId: module?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_training_completed',
  }),
});

registerEvent({
  type: 'onboarding_policy_signed',
  defaultTitle: 'Policy Signed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingHrRecipients(workflow, organizationId),
  messageBuilder: ({ employee, signature }) =>
    `${onboardingName(employee)} has signed the ${signature?.title || 'required company policy'}.`,
  metadataBuilder: ({ workflow, signature, employee }) => ({
    workflowId: workflow?._id,
    signatureId: signature?._id,
    employeeId: employee?._id || workflow?.employeeId,
    eventType: 'onboarding_policy_signed',
  }),
});

registerEvent({
  type: 'onboarding_workflow_completed',
  defaultTitle: 'Onboarding Completed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true, buddy: true,
    }),
  messageBuilder: () => 'Congratulations! The onboarding process has been completed successfully.',
  metadataBuilder: ({ workflow }) => ({
    workflowId: workflow?._id,
    eventType: 'onboarding_workflow_completed',
  }),
});

registerEvent({
  type: 'onboarding_workflow_overdue',
  defaultTitle: 'Onboarding Overdue',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true,
    }),
  messageBuilder: () =>
    'The onboarding process is overdue. Please complete the remaining activities.',
  metadataBuilder: ({ workflow }) => ({
    workflowId: workflow?._id,
    employeeId: onboardingId(workflow?.employeeId),
    eventType: 'onboarding_workflow_overdue',
  }),
});

registerEvent({
  type: 'onboarding_reminder',
  defaultTitle: 'Onboarding Reminder',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ recipient, organizationId }) =>
    expandOnboardingRecipients([recipient], organizationId),
  messageBuilder: ({ message }) => message || 'An onboarding activity requires your attention.',
  metadataBuilder: ({ workflow, item, reminderType, dueDate }) => ({
    workflowId: workflow?._id,
    itemId: item?._id,
    reminderType,
    dueDate,
    eventType: 'onboarding_reminder',
  }),
});

// ==================== BGV EVENTS ====================

// BGV Verification Assigned to Employee
registerEvent({
  type: 'bgv_verification_assigned',
  defaultTitle: 'Background Verification Assigned',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Background verification for ${checkLabel || 'your profile'} has been assigned. Please complete the required document uploads.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_verification_assigned',
  }),
});

// BGV Documents Required
registerEvent({
  type: 'bgv_documents_required',
  defaultTitle: 'Documents Required for BGV',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Please upload the required documents for ${checkLabel || 'background verification'}.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_documents_required',
  }),
});

// BGV Submission Successful
registerEvent({
  type: 'bgv_submission_successful',
  defaultTitle: 'BGV Documents Submitted',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Your documents for ${checkLabel || 'background verification'} have been submitted successfully. Waiting for HR review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_submission_successful',
  }),
});

// BGV Additional Information Requested
registerEvent({
  type: 'bgv_additional_info_requested',
  defaultTitle: 'Additional Information Required',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel, request }) =>
    `HR has requested additional information for ${checkLabel || 'background verification'}. ${request || 'Please provide the requested details.'}`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId, request }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    request,
    eventType: 'bgv_additional_info_requested',
  }),
});

// BGV Verification Approved
registerEvent({
  type: 'bgv_verification_approved',
  defaultTitle: 'BGV Verification Approved',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Your ${checkLabel || 'background verification'} has been approved successfully.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_verification_approved',
  }),
});

// BGV Verification Rejected
registerEvent({
  type: 'bgv_verification_rejected',
  defaultTitle: 'BGV Verification Rejected',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Your ${checkLabel || 'background verification'} has been rejected. Please review the feedback and resubmit.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_verification_rejected',
  }),
});

// BGV Employee Submitted (HR notification)
registerEvent({
  type: 'bgv_employee_submitted',
  defaultTitle: 'Employee Submitted BGV Documents',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${employeeName || 'An employee'} has submitted documents for ${checkLabel || 'background verification'}. Please review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_employee_submitted',
  }),
});

// BGV Employee Resubmitted (HR notification)
registerEvent({
  type: 'bgv_employee_resubmitted',
  defaultTitle: 'Employee Resubmitted BGV Documents',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${employeeName || 'An employee'} has resubmitted documents for ${checkLabel || 'background verification'}. Please review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_employee_resubmitted',
  }),
});

// BGV Verification Pending (HR notification)
registerEvent({
  type: 'bgv_verification_pending',
  defaultTitle: 'BGV Verification Pending',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${checkLabel || 'Background verification'} for ${employeeName || 'an employee'} is pending HR review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_verification_pending',
  }),
});

// BGV Verification Overdue (HR notification)
registerEvent({
  type: 'bgv_verification_overdue',
  defaultTitle: 'BGV Verification Overdue',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${checkLabel || 'Background verification'} for ${employeeName || 'an employee'} is overdue.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_verification_overdue',
  }),
});

// BGV Check Submitted
registerEvent({
  type: 'bgv_check_submitted',
  defaultTitle: 'BGV Check Submitted',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId, employeeId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${employeeName || 'An employee'} has submitted ${checkLabel || 'background verification check'} for review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_check_submitted',
  }),
});

// BGV Check Verified
registerEvent({
  type: 'bgv_check_verified',
  defaultTitle: 'BGV Check Verified',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Your ${checkLabel || 'background verification check'} has been verified successfully.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_check_verified',
  }),
});

// BGV Check Rejected
registerEvent({
  type: 'bgv_check_rejected',
  defaultTitle: 'BGV Check Rejected',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `Your ${checkLabel || 'background verification check'} has been rejected. Please review and resubmit.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_check_rejected',
  }),
});

// BGV Info Requested
registerEvent({
  type: 'bgv_info_requested',
  defaultTitle: 'Additional Information Requested',
  defaultType: 'bgv',
  defaultPriority: 'high',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel, request }) =>
    `HR has requested additional information for ${checkLabel || 'background verification'}. ${request || ''}`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId, request }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    request,
    eventType: 'bgv_info_requested',
  }),
});

// BGV Info Response
registerEvent({
  type: 'bgv_info_response',
  defaultTitle: 'Information Response Submitted',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) =>
    getHrAdminCeoRecipients(organizationId),
  messageBuilder: ({ employeeName, checkLabel }) =>
    `${employeeName || 'An employee'} has provided additional information for ${checkLabel || 'background verification'}.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_info_response',
  }),
});

// BGV HR Remarks
registerEvent({
  type: 'bgv_hr_remarks',
  defaultTitle: 'HR Remarks Added',
  defaultType: 'bgv',
  defaultPriority: 'medium',
  recipientResolver: async ({ employeeId, organizationId }) =>
    expandOnboardingRecipients([employeeId], organizationId),
  messageBuilder: ({ checkLabel }) =>
    `HR has added remarks for your ${checkLabel || 'background verification'}. Please review.`,
  metadataBuilder: ({ bgvCaseId, checkId, checkLabel, employeeId }) => ({
    bgvCaseId,
    checkId,
    checkLabel,
    employeeId,
    eventType: 'bgv_hr_remarks',
  }),
});

const offboardingUrl = (workflow) =>
  `/onboarding?lifecycle=offboarding${workflow?._id ? `&id=${workflow._id}` : ''}`;

registerEvent({
  type: 'offboarding_workflow_initiated',
  defaultTitle: 'Offboarding Workflow Initiated',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true,
    }),
  messageBuilder: ({ employee }) =>
    `${onboardingName(employee)}'s offboarding workflow has been initiated.`,
  metadataBuilder: ({ workflow, employee }) => ({
    workflowId: workflow?._id,
    employeeId: employee?._id || workflow?.employeeId,
    lifecycle: 'offboarding',
    eventType: 'offboarding_workflow_initiated',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_task_assigned',
  defaultTitle: 'New Offboarding Task',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ task, organizationId }) =>
    expandOnboardingRecipients([task?.assignedTo], organizationId),
  messageBuilder: ({ task }) =>
    `The offboarding task "${task?.title || 'Task'}" has been assigned to you.`,
  metadataBuilder: ({ workflow, task }) => ({
    workflowId: workflow?._id,
    taskId: task?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_task_assigned',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_task_completed',
  defaultTitle: 'Offboarding Task Completed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true, manager: true }),
  messageBuilder: ({ task }) =>
    `The offboarding task "${task?.title || 'Task'}" has been completed.`,
  metadataBuilder: ({ workflow, task }) => ({
    workflowId: workflow?._id,
    taskId: task?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_task_completed',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_asset_returned',
  defaultTitle: 'Company Asset Returned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { employee: true, hr: true, it: true }),
  messageBuilder: ({ asset }) =>
    `${asset?.assetName || asset?.assetType || 'A company asset'} has been marked as returned.`,
  metadataBuilder: ({ workflow, asset }) => ({
    workflowId: workflow?._id,
    assetId: asset?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_asset_returned',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_experience_letter_issued',
  defaultTitle: 'Experience Letter Issued',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ workflow, organizationId }) =>
    expandOnboardingRecipients([workflow?.employeeId], organizationId),
  messageBuilder: () =>
    'HR has issued your experience letter. You can view it in your offboarding workflow.',
  metadataBuilder: ({ workflow, document }) => ({
    workflowId: workflow?._id,
    documentId: document?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_experience_letter_issued',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_workflow_completed',
  defaultTitle: 'Offboarding Completed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true, it: true,
    }),
  messageBuilder: () => 'All mandatory offboarding clearances have been completed.',
  metadataBuilder: ({ workflow }) => ({
    workflowId: workflow?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_workflow_completed',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_workflow_overdue',
  defaultTitle: 'Offboarding Overdue',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true, it: true,
    }),
  messageBuilder: () => 'The offboarding workflow is overdue and has pending mandatory clearances.',
  metadataBuilder: ({ workflow }) => ({
    workflowId: workflow?._id,
    lifecycle: 'offboarding',
    eventType: 'offboarding_workflow_overdue',
    url: offboardingUrl(workflow),
  }),
});

registerEvent({
  type: 'offboarding_reminder',
  defaultTitle: 'Offboarding Reminder',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, {
      employee: true, hr: true, manager: true,
    }),
  messageBuilder: ({ remainingDays }) => remainingDays === 0
    ? 'The employee’s final working day is today. Please complete all remaining clearances.'
    : `The employee’s final working day is in ${remainingDays} day${remainingDays === 1 ? '' : 's'}.`,
  metadataBuilder: ({ workflow, remainingDays }) => ({
    workflowId: workflow?._id,
    remainingDays,
    lifecycle: 'offboarding',
    eventType: 'offboarding_reminder',
    url: offboardingUrl(workflow),
  }),
});

const getHrRecipients = async (organizationId) => {
  const employees = await Employee.find({ organizationId, status: 'active' }).select('_id department jobTitle position functionalRoles').lean();
  return employees.filter(isHrEmployee).map((e) => e._id.toString());
};

registerEvent({
  type: 'lifecycle_offer_sent',
  defaultTitle: 'Offer Letter Sent',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ offer, candidate }) => {
    const name = candidate ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') : 'Candidate';
    return `Offer letter sent to ${name} for ${offer?.position || 'position'}.`;
  },
  metadataBuilder: ({ offer }) => ({ offerId: offer?._id, lifecycle: 'offer' }),
});

registerEvent({
  type: 'lifecycle_offer_accepted',
  defaultTitle: 'Offer Accepted',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ offer }) => `Candidate accepted the offer for ${offer?.position || 'position'}.`,
  metadataBuilder: ({ offer }) => ({ offerId: offer?._id, lifecycle: 'offer' }),
});

registerEvent({
  type: 'lifecycle_offer_declined',
  defaultTitle: 'Offer Declined',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ offer }) => `Candidate declined the offer for ${offer?.position || 'position'}.`,
  metadataBuilder: ({ offer }) => ({ offerId: offer?._id, lifecycle: 'offer' }),
});

registerEvent({
  type: 'lifecycle_offer_approved',
  defaultTitle: 'Offer Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ offer }) => `Offer letter approved for ${offer?.position || 'position'}.`,
  metadataBuilder: ({ offer }) => ({ offerId: offer?._id, lifecycle: 'offer' }),
});

registerEvent({
  type: 'lifecycle_offer_rejected',
  defaultTitle: 'Offer Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'An offer letter was rejected during approval.',
  metadataBuilder: ({ offer }) => ({ offerId: offer?._id, lifecycle: 'offer' }),
});

registerEvent({
  type: 'lifecycle_bgv_initiated',
  defaultTitle: 'Background Verification Started',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'A background verification case has been initiated.',
  metadataBuilder: ({ bgvCase }) => ({ bgvCaseId: bgvCase?._id, lifecycle: 'bgv' }),
});

registerEvent({
  type: 'lifecycle_bgv_cleared',
  defaultTitle: 'Background Verification Cleared',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'Background verification has been cleared.',
  metadataBuilder: ({ bgvCase }) => ({ bgvCaseId: bgvCase?._id, lifecycle: 'bgv' }),
});

registerEvent({
  type: 'lifecycle_bgv_failed',
  defaultTitle: 'Background Verification Failed',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'Background verification reported a failure or discrepancy requiring review.',
  metadataBuilder: ({ bgvCase }) => ({ bgvCaseId: bgvCase?._id, lifecycle: 'bgv' }),
});

registerEvent({
  type: 'lifecycle_fnf_approved',
  defaultTitle: 'F&F Settlement Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true }),
  messageBuilder: ({ workflow }) => 'Full & Final settlement has been approved.',
  metadataBuilder: ({ workflow }) => ({ workflowId: workflow?._id, lifecycle: 'fnf', url: offboardingUrl(workflow) }),
});

registerEvent({
  type: 'lifecycle_fnf_rejected',
  defaultTitle: 'F&F Settlement Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ workflow, organizationId }) =>
    getOnboardingProgressRecipients(workflow, organizationId, { hr: true }),
  messageBuilder: () => 'Full & Final settlement was rejected and needs revision.',
  metadataBuilder: ({ workflow }) => ({ workflowId: workflow?._id, lifecycle: 'fnf', url: offboardingUrl(workflow) }),
});

registerEvent({
  type: 'lifecycle_onboarding_escalation',
  defaultTitle: 'Onboarding Escalation',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ recipient, organizationId }) => {
    if (recipient) return [recipient.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ message }) => message || 'An onboarding item is overdue and has been escalated.',
  metadataBuilder: ({ workflow, item }) => ({ workflowId: workflow?._id, itemKind: item?.kind, lifecycle: 'escalation' }),
});

registerEvent({
  type: 'lifecycle_offboarding_escalation',
  defaultTitle: 'Offboarding Escalation',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ recipient, organizationId }) => {
    if (recipient) return [recipient.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ message }) => message || 'An offboarding item is overdue and has been escalated.',
  metadataBuilder: ({ workflow, item }) => ({ workflowId: workflow?._id, itemKind: item?.kind, lifecycle: 'escalation', url: offboardingUrl(workflow) }),
});

registerEvent({
  type: 'lifecycle_form_assigned',
  defaultTitle: 'Form Assigned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data, organizationId }) => {
    const employeeId = data?.employeeId || data?.response?.employeeId;
    if (employeeId) return [employeeId.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ data }) => `Please complete the form: ${data?.form?.name || 'HR Form'}.`,
  metadataBuilder: ({ data }) => ({ formId: data?.form?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_form_submitted',
  defaultTitle: 'Form Submitted',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `${data?.form?.name || 'A form'} was submitted.`,
  metadataBuilder: ({ data }) => ({ formId: data?.form?._id, responseId: data?.response?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_form_pending_approval',
  defaultTitle: 'Form Pending Approval',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `${data?.form?.name || 'A form'} is pending your approval.`,
  metadataBuilder: ({ data }) => ({ formId: data?.form?._id, responseId: data?.response?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_form_approved',
  defaultTitle: 'Form Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.response?.submittedBy || data?.response?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Your form submission was approved.`,
  metadataBuilder: ({ data }) => ({ responseId: data?.response?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_form_rejected',
  defaultTitle: 'Form Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data }) => {
    const id = data?.response?.submittedBy || data?.response?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => data?.response?.rejectionReason || 'Your form submission was rejected. Please revise and resubmit.',
  metadataBuilder: ({ data }) => ({ responseId: data?.response?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_form_reminder',
  defaultTitle: 'Form Reminder',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data, organizationId }) => {
    const employeeId = data?.employeeId;
    if (employeeId) return [employeeId.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ data }) => `Reminder: please complete ${data?.form?.name || 'your assigned form'}.`,
  metadataBuilder: ({ data }) => ({ formId: data?.form?._id, lifecycle: 'form' }),
});

registerEvent({
  type: 'lifecycle_document_uploaded',
  defaultTitle: 'Document Uploaded',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `${data?.document?.name || 'A document'} was uploaded and needs verification.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, catalogKey: data?.document?.catalogKey, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_approved',
  defaultTitle: 'Document Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.document?.uploadedBy;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Your document "${data?.document?.name || 'upload'}" was approved.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_rejected',
  defaultTitle: 'Document Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.document?.uploadedBy;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => data?.rejectionReason || `Your document "${data?.document?.name || 'upload'}" was rejected. Please re-upload.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_expiring',
  defaultTitle: 'Document Expiring Soon',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.document?.uploadedBy;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Your ${data?.document?.name || 'document'} expires in ${data?.daysUntil ?? 'soon'} days. Please renew.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_expired',
  defaultTitle: 'Document Expired',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data, organizationId }) => {
    const id = data?.employeeId || data?.document?.uploadedBy;
    if (id) return [id.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ data }) => `${data?.document?.name || 'A document'} has expired and requires renewal.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_reminder',
  defaultTitle: 'Document Reminder',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.document?.uploadedBy;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Reminder: please upload or renew ${data?.document?.name || 'your required document'}.`,
  metadataBuilder: ({ data }) => ({ documentId: data?.document?._id, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_document_requested',
  defaultTitle: 'Document Requested',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Please upload: ${data?.catalogLabel || data?.catalogKey || 'required document'}.`,
  metadataBuilder: ({ data }) => ({ catalogKey: data?.catalogKey, lifecycle: 'document' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_assigned',
  defaultTitle: 'Exit Interview Assigned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const ids = [data?.employeeId, data?.conductorId].filter(Boolean).map(String);
    return ids;
  },
  messageBuilder: ({ data }) => `An exit interview (${data?.session?.interviewType || 'interview'}) has been assigned.`,
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_scheduled',
  defaultTitle: 'Exit Interview Scheduled',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.session?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => 'Your exit interview has been scheduled.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_reminder',
  defaultTitle: 'Exit Interview Reminder',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.session?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Reminder: exit interview in ${data?.daysUntil ?? 'soon'} days.`,
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_completed',
  defaultTitle: 'Exit Interview Completed',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'An exit interview was submitted.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_pending_approval',
  defaultTitle: 'Exit Interview Pending Approval',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'An exit interview is pending approval.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_approved',
  defaultTitle: 'Exit Interview Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.session?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: () => 'Your exit interview was approved.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_rejected',
  defaultTitle: 'Exit Interview Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.session?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: () => 'Your exit interview needs revision. Please resubmit.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_exit_interview_overdue',
  defaultTitle: 'Exit Interview Overdue',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ data, organizationId }) => {
    const ids = [data?.employeeId, data?.session?.conductorId].filter(Boolean).map(String);
    if (ids.length) return ids;
    return getHrRecipients(organizationId);
  },
  messageBuilder: () => 'An exit interview is overdue.',
  metadataBuilder: ({ data }) => ({ sessionId: data?.session?._id, lifecycle: 'exit_interview' }),
});

registerEvent({
  type: 'lifecycle_letter_generated',
  defaultTitle: 'Letter Generated',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `${data?.letter?.title || 'A letter'} was generated.`,
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_letter_pending_approval',
  defaultTitle: 'Letter Pending Approval',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `${data?.letter?.title || 'A letter'} requires approval.`,
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_letter_approved',
  defaultTitle: 'Letter Approved',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data, organizationId }) => {
    const id = data?.employeeId || data?.letter?.employeeId;
    if (id) return [id.toString()];
    return getHrRecipients(organizationId);
  },
  messageBuilder: () => 'Your letter was approved.',
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_letter_rejected',
  defaultTitle: 'Letter Rejected',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'A letter was rejected and needs revision.',
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_letter_sent',
  defaultTitle: 'Letter Sent',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId || data?.letter?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `You have a new letter: ${data?.letter?.title || 'HR Document'}.`,
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_letter_viewed',
  defaultTitle: 'Letter Viewed',
  defaultType: 'onboarding',
  defaultPriority: 'low',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'An employee viewed their letter.',
  metadataBuilder: ({ data }) => ({ letterId: data?.letter?._id, lifecycle: 'letter' }),
});

registerEvent({
  type: 'lifecycle_report_ready',
  defaultTitle: 'Scheduled Report Ready',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `Scheduled lifecycle report "${data?.report?.name || 'Report'}" is ready (${data?.format || 'csv'}).`,
  metadataBuilder: ({ data }) => ({
    reportId: data?.report?._id,
    category: data?.category,
    fileName: data?.fileName,
    lifecycle: 'reports',
  }),
});

registerEvent({
  type: 'lifecycle_probation_review',
  defaultTitle: 'Probation Review',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `Probation ${data?.reviewType || ''} review submitted${data?.decision ? ` — ${data.decision}` : ''}.`,
  metadataBuilder: ({ data }) => ({ workflowId: data?.workflowId, lifecycle: 'probation' }),
});

registerEvent({
  type: 'lifecycle_probation_ending',
  defaultTitle: 'Probation Ending Soon',
  defaultType: 'onboarding',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: () => 'An employee probation period is ending within 30 days.',
  metadataBuilder: ({ data }) => ({ workflowId: data?.workflowId, lifecycle: 'probation' }),
});

registerEvent({
  type: 'lifecycle_software_request',
  defaultTitle: 'Software Access Request',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ organizationId }) => getHrRecipients(organizationId),
  messageBuilder: ({ data }) => `New software access request: ${data?.system || 'application'}.`,
  metadataBuilder: ({ data }) => ({ workflowId: data?.workflowId, system: data?.system, lifecycle: 'it' }),
});

registerEvent({
  type: 'lifecycle_lms_enrolled',
  defaultTitle: 'Training Assigned',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => `You have been enrolled in training: ${data?.course || 'course'}.`,
  metadataBuilder: ({ data }) => ({ workflowId: data?.workflowId, lifecycle: 'lms' }),
});

registerEvent({
  type: 'lifecycle_bulk_notification',
  defaultTitle: 'HR Notice',
  defaultType: 'onboarding',
  defaultPriority: 'medium',
  recipientResolver: async ({ data }) => {
    const id = data?.employeeId;
    return id ? [id.toString()] : [];
  },
  messageBuilder: ({ data }) => data?.message || data?.title || 'You have a new HR notification.',
  metadataBuilder: ({ data }) => ({ lifecycle: 'bulk', channels: data?.channels }),
});

registerEvent({
  type: 'internal_job_posted',
  defaultTitle: 'New Internal Job Opening',
  defaultType: 'announcement',
  defaultPriority: 'high',
  isBroadcast: true,
  recipientResolver: async () => [],
  messageBuilder: ({ job, internalUrl }) => {
    const title = job?.jobTitle || 'a role';
    const dept = job?.department ? ` (${job.department})` : '';
    return `New internal opening: ${title}${dept}. View & apply${internalUrl ? `: ${internalUrl}` : ''}`;
  },
  metadataBuilder: ({ job, internalUrl }) => ({
    jobId: job?._id,
    jobTitle: job?.jobTitle,
    department: job?.department,
    location: job?.location,
    link: internalUrl || `/employee/internal-jobs/${job?._id}`,
  }),
});

registerEvent({
  type: 'recruitment_interview_assigned',
  defaultTitle: 'Interview assigned to you',
  defaultType: 'announcement',
  defaultPriority: 'high',
  recipientResolver: async ({ interviewerId, recipients }) => {
    if (Array.isArray(recipients) && recipients.length) {
      return recipients.map((id) => id.toString());
    }
    return interviewerId ? [interviewerId.toString()] : [];
  },
  messageBuilder: ({ candidate, interview, jobTitle }) => {
    const name = candidate
      ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
      : 'a candidate';
    const role = jobTitle || 'open role';
    const type = interview?.interviewType || 'Interview';
    const when = [
      interview?.scheduledDate
        ? new Date(interview.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : null,
      interview?.scheduledTime || null,
    ].filter(Boolean).join(' ');
    const place = interview?.location ? ` · ${interview.location}` : '';
    const link = interview?.meetingLink ? ` · Join: ${interview.meetingLink}` : '';
    return `You need to take the ${type} interview for ${name} (${role})${when ? ` on ${when}` : ''}${place}${link}.`;
  },
  metadataBuilder: ({ candidate, interview, jobTitle }) => ({
    candidateId: candidate?._id,
    interviewId: interview?._id,
    interviewType: interview?.interviewType,
    scheduledDate: interview?.scheduledDate,
    scheduledTime: interview?.scheduledTime,
    location: interview?.location,
    meetingLink: interview?.meetingLink,
    jobTitle,
    link: candidate?._id ? `/employee/internal-jobs?tab=interviews` : '/employee/internal-jobs?tab=interviews',
  }),
});

registerEvent({
  type: 'resume_inbox_imported',
  defaultTitle: 'New Resume Imported',
  defaultType: 'announcement',
  defaultPriority: 'high',
  recipientResolver: async ({ organizationId, recipients }) => {
    // Prefer explicit recipients (e.g. assigned recruiter); otherwise notify HR.
    if (Array.isArray(recipients) && recipients.length > 0) {
      const hr = await getHrRecipients(organizationId);
      return [...new Set([...recipients.map((id) => id.toString()), ...hr])];
    }
    return getHrRecipients(organizationId);
  },
  messageBuilder: ({ candidate, job, wasDuplicate, message }) => {
    if (message) return message;
    const name = candidate
      ? [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
      : 'Candidate';
    const position = job?.jobTitle || 'Unassigned';
    return wasDuplicate
      ? `Duplicate resume via Email for ${name} (${position}).`
      : `New resume imported via Email: ${name} — Source: Email — ${position}.`;
  },
  metadataBuilder: ({ candidate, job, candidateId }) => ({
    candidateId: candidateId || candidate?._id,
    jobId: job?._id,
    source: 'Email',
    link: candidateId || candidate?._id
      ? `/recruitment/candidates/${candidateId || candidate._id}`
      : '/recruitment/inbox',
  }),
});

export default {
  // This file auto-registers events on import
};
