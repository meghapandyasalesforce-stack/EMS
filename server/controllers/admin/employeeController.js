import Employee from '../../models/employee.model.js';
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import mongoose from 'mongoose';
import Attendance from '../../models/attendance.model.js';
import Project from '../../models/project.model.js';
import logger from '../../helpers/logger.js';
import { invalidateEmployeesCache } from '../../helpers/cacheHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { isEmployeeLinkedToManager } from '../../helpers/managerHelper.js';
import { assignSystemRoleToEmployee } from '../../helpers/systemRoleService.js';
import { SYSTEM_ROLE_IDS } from '../../config/systemRole.constants.js';
import { buildSalaryRevisionEntries } from '../../helpers/salaryRevisionHelper.js';
import { inferSystemRoleFromWorkInfo } from '../../helpers/inferSystemRoleFromWorkInfo.js';
import {
  evaluateProbationStartLock,
  isActiveProbationStatus,
  isExitedProbationStatus,
  resolveAllowProbationAfterJoining,
  syncWorkflowProbationFromEmployee,
} from '../../helpers/employeeProbationSyncHelper.js';
import AttendanceRule from '../../models/attendanceRule.model.js';
import { parseEmployeeShiftAssignment } from '../../helpers/shiftHelper.js';
import {
  isTopLevelManagerLabel,
  validateManagerAssignment,
} from '../../helpers/managerAssignmentHelper.js';

const JOB_CATEGORY_BY_DEPARTMENT = {
  engineering: 'Engineering',
  hr: 'Human Resources',
  'human resources': 'Human Resources',
  finance: 'Finance',
  marketing: 'Marketing',
  sales: 'Sales',
  'it support': 'Information Technology',
  operations: 'Operations',
  'customer support': 'Customer Service',
  'customer service': 'Customer Service',
  legal: 'Legal',
  product: 'Product Management',
  'research & development': 'Research and Development',
  design: 'Design',
  administration: 'Administration',
  management: 'Management',
};

function resolveJobCategoryFromDepartment(department) {
  const key = String(department || '').trim().toLowerCase();
  return JOB_CATEGORY_BY_DEPARTMENT[key] || 'Administration';
}

async function resolveManagerReference(organizationId, managerInput) {
  const raw = String(managerInput || '').trim();
  if (isTopLevelManagerLabel(raw)) {
    return { manager: 'Admin', managerId: null };
  }

  const baseQuery = { organizationId, status: 'active' };
  let managerEmployee = null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    managerEmployee = await Employee.findOne({ ...baseQuery, _id: raw })
      .select('_id name lastName employeeId')
      .lean();
  }
  if (!managerEmployee) {
    managerEmployee = await Employee.findOne({ ...baseQuery, employeeId: raw })
      .select('_id name lastName employeeId')
      .lean();
  }
  if (!managerEmployee) {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    managerEmployee = await Employee.findOne({
      ...baseQuery,
      $or: [
        { name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { $expr: { $regexMatch: { input: { $concat: ['$name', ' ', '$lastName'] }, regex: `^${escaped}$`, options: 'i' } } }
      ]
    }).select('_id name lastName employeeId').lean();
  }

  if (!managerEmployee) return null;
  return {
    manager: `${managerEmployee.name || ''} ${managerEmployee.lastName || ''}`.trim() || raw,
    managerId: managerEmployee._id
  };
}

// Update employee work information (Admin only)
export const updateEmployeeWorkInfo = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { jobTitle, department, position, manager, salary, joiningDate, performanceScore, salaryEffectiveFrom, salaryRevisionNote, probation, shiftId, shiftName } = req.body;

    // Validate employee ID
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid employee ID' 
      });
    }

    // Check if employee exists within requester's organization
    const organizationId = getOrganizationId(req);
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        message: 'Employee not found' 
      });
    }

    // Manager can update only employees linked to them.
    const isManagerScope = shouldScopeDataToManagedTeam(req);
    if (isManagerScope) {
      const linked = isEmployeeLinkedToManager(employee, req.employee);
      if (!linked) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update employees linked to you.'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (jobTitle !== undefined) {
      const nextTitle = String(jobTitle || '').trim();
      updateData.jobTitle = nextTitle || employee.jobTitle || 'CEO';
    }
    if (department !== undefined) {
      const nextDept = String(department || '').trim();
      updateData.department = nextDept || employee.department || 'Administration';
    }
    if (position !== undefined) {
      const nextPos = String(position || '').trim();
      updateData.position = nextPos || employee.position || 'CEO';
    }
    // runValidators re-checks required fields on the whole doc — always keep jobCategory valid
    const nextDepartment = updateData.department || employee.department;
    updateData.jobCategory = resolveJobCategoryFromDepartment(nextDepartment);
    if (manager !== undefined) {
      // Admin Me / org-owner root must stay top-level — never nest under another employee
      if (employee.isOrgOwnerRoot === true) {
        const assignmentCheck = await validateManagerAssignment({
          organizationId,
          employeeId,
          managerId: null,
        });
        if (!assignmentCheck.valid) {
          return res.status(400).json({
            success: false,
            message: assignmentCheck.message,
          });
        }
        updateData.manager = assignmentCheck.manager;
        updateData.managerId = assignmentCheck.managerId;
        updateData.isOrgOwnerRoot = true;
      } else {
        const resolvedManager = await resolveManagerReference(organizationId, manager);
        if (!resolvedManager) {
          return res.status(400).json({
            success: false,
            message: 'Selected manager not found in this organization'
          });
        }
        const assignmentCheck = await validateManagerAssignment({
          organizationId,
          employeeId,
          managerId: resolvedManager.managerId,
        });
        if (!assignmentCheck.valid) {
          return res.status(400).json({
            success: false,
            message: assignmentCheck.message,
          });
        }
        updateData.manager = assignmentCheck.manager;
        updateData.managerId = assignmentCheck.managerId;
      }
    }
    if (salary !== undefined) {
      const nextSalary = Math.max(0, Number(salary) || 0);
      const previousSalary = Math.max(0, Number(employee.salary) || 0);

      if (nextSalary !== previousSalary) {
        updateData.salary = nextSalary;

        const effectiveFrom = salaryEffectiveFrom
          ? new Date(salaryEffectiveFrom)
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        if (Number.isNaN(effectiveFrom.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid salaryEffectiveFrom date'
          });
        }

        const existingRevisions = Array.isArray(employee.salaryRevisions) ? employee.salaryRevisions : [];
        const revisionEntries = existingRevisions.length > 0
          ? [{
              salary: nextSalary,
              effectiveFrom,
              note: salaryRevisionNote ? String(salaryRevisionNote).trim() : 'Salary revision'
            }]
          : buildSalaryRevisionEntries({
              previousSalary,
              newSalary: nextSalary,
              joiningDate: employee.joiningDate,
              effectiveFrom,
              note: salaryRevisionNote
            });

        updateData.$push = {
          salaryRevisions: { $each: revisionEntries }
        };
      }
    }
    if (joiningDate !== undefined && joiningDate !== null && joiningDate !== '') {
      const parsedJoining = new Date(joiningDate);
      if (Number.isNaN(parsedJoining.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid joining date'
        });
      }
      updateData.joiningDate = parsedJoining;
    }
    if (performanceScore !== undefined) updateData.performanceScore = performanceScore;
    if (shiftId !== undefined || shiftName !== undefined) {
      const rawId = shiftId != null ? String(shiftId).trim() : '';
      const rawName = shiftName != null ? String(shiftName).trim() : '';
      if (!rawId && !rawName) {
        updateData.$unset = { ...(updateData.$unset || {}), shiftId: '', shiftName: '' };
      } else {
        try {
          const activeRuleForShift = await AttendanceRule.findOne({
            organizationId,
            isActive: true,
          })
            .sort({ priority: -1, updatedAt: -1 })
            .select('shifts')
            .lean();
          const assigned = parseEmployeeShiftAssignment(
            { shiftId: rawId, shiftName: rawName },
            activeRuleForShift?.shifts
          );
          updateData.shiftId = assigned.shiftId;
          updateData.shiftName = assigned.shiftName;
        } catch (shiftErr) {
          return res.status(400).json({
            success: false,
            message: shiftErr.message,
          });
        }
      }
    }
    if (probation !== undefined && probation !== null && typeof probation === 'object') {
      const nextProbation = {
        ...(employee.probation?.toObject?.() || employee.probation || {}),
      };
      const currentStatus = employee.probation?.status || 'None';
      const nextStatus = probation.status !== undefined ? probation.status : currentStatus;
      const allowProbationAfterJoining = await resolveAllowProbationAfterJoining(organizationId);
      const startLock = evaluateProbationStartLock({
        currentStatus,
        nextStatus,
        allowProbationAfterJoining,
      });
      if (!startLock.allowed) {
        return res.status(400).json({
          success: false,
          message: startLock.reason,
        });
      }

      if (probation.status !== undefined) nextProbation.status = probation.status;
      if (probation.startDate !== undefined) {
        nextProbation.startDate = probation.startDate ? new Date(probation.startDate) : null;
      }
      if (probation.endDate !== undefined) {
        nextProbation.endDate = probation.endDate ? new Date(probation.endDate) : null;
      }
      if (probation.confirmedAt !== undefined) {
        nextProbation.confirmedAt = probation.confirmedAt
          ? new Date(probation.confirmedAt)
          : null;
      }
      if (probation.rejectedAt !== undefined) {
        nextProbation.rejectedAt = probation.rejectedAt
          ? new Date(probation.rejectedAt)
          : null;
      }
      if (
        isExitedProbationStatus(currentStatus) &&
        isActiveProbationStatus(nextStatus)
      ) {
        if (probation.confirmedAt === undefined) nextProbation.confirmedAt = null;
        if (probation.rejectedAt === undefined) nextProbation.rejectedAt = null;
      }
      updateData.probation = nextProbation;
    }

    const workProfileChanged =
      jobTitle !== undefined || department !== undefined || position !== undefined;
    const probationChanged = updateData.probation !== undefined;

  let updatedEmployee = await Employee.findOneAndUpdate(
    { _id: employeeId, organizationId },
    updateData,
    { new: true, runValidators: true }
  ).select('-password -role').lean();

  // Keep Lifecycle onboarding probation in sync with Job Details
  if (probationChanged && updatedEmployee?.probation) {
    try {
      await syncWorkflowProbationFromEmployee({
        organizationId,
        employeeId,
        probation: updatedEmployee.probation,
      });
    } catch (e) {
      logger.warn('Failed to sync Lifecycle probation after work-info update', {
        error: e.message,
        employeeId,
      });
    }
  }

  // Job Details → sync system role from job fields; keep the title/position the user saved
  if (workProfileChanged && updatedEmployee) {
    const { systemRoleId } = inferSystemRoleFromWorkInfo({
      department: updatedEmployee.department,
      jobTitle: updatedEmployee.jobTitle,
      position: updatedEmployee.position,
    });
    await assignSystemRoleToEmployee({
      employeeId,
      systemRoleId,
      organizationId,
      syncJobProfile: false,
    });
    updatedEmployee = await Employee.findOne({ _id: employeeId, organizationId })
      .select('-password -role')
      .lean();
  }

  if (updatedEmployee?.organizationId) {
    try {
      await invalidateEmployeesCache(updatedEmployee.organizationId);
    } catch (e) {
      logger.warn('Failed to invalidate employees cache after work-info update', { error: e.message });
    }
  }

  if (updatedEmployee && updatedEmployee.salary === undefined) {
    const employeeWithSalary = await Employee.findById(employeeId).select('salary').lean();
    updatedEmployee.salary = employeeWithSalary?.salary ?? 0;
  }

  res.status(200).json({
    success: true,
    message: 'Employee work information updated successfully',
    employee: updatedEmployee,
  });

  } catch (error) {
    logger.error('Error updating employee work information', { error: error.message, stack: error.stack });
    const isValidation = error?.name === 'ValidationError';
    res.status(isValidation ? 400 : 500).json({
      success: false,
      message: isValidation
        ? (error.message || 'Validation failed while updating work information')
        : 'Failed to update employee work information',
      error: error.message
    });
  }
};

/**
 * Manually promote an employee to HR Manager: updates job profile + HR system access.
 * Email and password are never changed.
 */
export const promoteEmployeeToHrManager = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID',
      });
    }

    const organizationId = getOrganizationId(req);
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    const preservedEmail = employee.email;

    employee.jobTitle = 'HR Manager';
    employee.department = 'HR';
    if (!employee.position || String(employee.position).trim() === '') {
      employee.position = 'Manager';
    }
    employee._skipFunctionalRoleInference = true;
    await employee.save();

    const result = await assignSystemRoleToEmployee({
      employeeId,
      systemRoleId: SYSTEM_ROLE_IDS.HR_MANAGER,
      organizationId,
    });

    if (result.employee.email !== preservedEmail) {
      result.employee.email = preservedEmail;
      await result.employee.save();
    }

    if (result.employee?.organizationId) {
      try {
        await invalidateEmployeesCache(result.employee.organizationId);
      } catch (e) {
        logger.warn('Failed to invalidate employees cache after HR promotion', { error: e.message });
      }
    }

    const updated = await Employee.findById(employeeId)
      .select('-password')
      .lean();

    return res.status(200).json({
      success: true,
      message:
        'Employee promoted to HR Manager. Job title and department updated. Email and password unchanged — ask them to log out and back in.',
      employee: updated,
      systemRoleId: result.systemRoleId,
      functionalRoles: result.functionalRoles,
    });
  } catch (error) {
    logger.error('Error promoting employee to HR Manager', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to promote employee to HR Manager',
    });
  }
};

// Get employee work information (Admin only)
export const getEmployeeWorkInfo = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate employee ID
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid employee ID' 
      });
    }

    // Get employee work information
    const employee = await Employee.findById(employeeId)
      .select('jobTitle department position manager managerId salary joiningDate employeeId name lastName email')
      .lean();

    if (!employee) {
      return res.status(404).json({ 
        success: false,
        message: 'Employee not found' 
      });
    }

    res.status(200).json({
      success: true,
      employee
    });

  } catch (error) {
    logger.error('Error fetching employee work information', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee work information',
      error: error.message
    });
  }
};

// Calculate employee statistics (Admin only)
export const calculateEmployeeStats = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate employee ID
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid employee ID' 
      });
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        message: 'Employee not found' 
      });
    }

    // Calculate years of experience
    const joiningDate = new Date(employee.joiningDate);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - joiningDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const yearsOfExperience = Math.floor(diffDays / 365);

    // Calculate attendance rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRecords = await Attendance.find({
      employeeId: employeeId,
      clockIn: { $gte: thirtyDaysAgo }
    });

    const totalWorkingDays = 22; // Approximate working days in 30 days
    const presentDays = attendanceRecords.length;
    const attendanceRate = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    // Count completed projects
    const completedProjects = await Project.countDocuments({
      projectMembers: employeeId,
      status: 'Completed'
    });

    // Update employee with calculated stats
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employeeId,
      {
        attendanceRate: Math.min(attendanceRate, 100),
        projectsCompleted: completedProjects
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Employee statistics calculated successfully',
      stats: {
        yearsOfExperience,
        attendanceRate: Math.min(attendanceRate, 100),
        projectsCompleted: completedProjects,
        performanceScore: employee.performanceScore
      },
      employee: updatedEmployee
    });

  } catch (error) {
    logger.error('Error calculating employee statistics', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate employee statistics',
      error: error.message
    });
  }
};

// Update employee payroll statutory settings (PF/ESI deduction flags) — payroll admins only
export const updateEmployeePayrollSettings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { deductPf, deductEsi } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID'
      });
    }

    const organizationId = getOrganizationId(req);
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const isManagerScope = shouldScopeDataToManagedTeam(req);
    if (isManagerScope) {
      const linked = isEmployeeLinkedToManager(employee, req.employee);
      if (!linked) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update employees linked to you.'
        });
      }
    }

    if (deductPf === undefined && deductEsi === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one of deductPf or deductEsi is required.'
      });
    }

    const prev = employee.financialDetails?.toObject?.() || employee.financialDetails || {};
    const financialDetails = {
      ...prev,
      ...(deductPf !== undefined && { deductPf: Boolean(deductPf) }),
      ...(deductEsi !== undefined && { deductEsi: Boolean(deductEsi) }),
    };

    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: employeeId, organizationId },
      { financialDetails },
      { new: true, runValidators: true }
    ).select('-password -role').lean();

    invalidateEmployeesCache(organizationId);

    res.status(200).json({
      success: true,
      message: 'Payroll settings updated successfully',
      employee: updatedEmployee,
    });
  } catch (error) {
    logger.error('Error updating employee payroll settings', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to update payroll settings',
      error: error.message
    });
  }
};

/**
 * Assign Shift 1 / Shift 2 to selected employees, or clear shift (no shift).
 * Body: { shiftId: 'shift1'|'shift2'|''|'none', employeeIds: string[] } — employeeIds required.
 */
export const bulkAssignEmployeeShift = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    const { shiftId, shiftName, employeeIds } = req.body || {};

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select one or more employees to assign a shift.',
      });
    }

    const rawId = shiftId != null ? String(shiftId).trim() : '';
    const rawName = shiftName != null ? String(shiftName).trim() : '';
    const clearShift =
      !rawId ||
      rawId.toLowerCase() === 'none' ||
      rawId.toLowerCase() === 'unassigned';

    const validIds = employeeIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!validIds.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid employee IDs provided',
      });
    }

    const filter = {
      organizationId,
      _id: { $in: validIds },
      status: { $ne: 'terminated' },
      active: { $ne: false },
    };

    if (clearShift) {
      const result = await Employee.updateMany(filter, {
        $unset: { shiftId: '', shiftName: '' },
      });

      try {
        await invalidateEmployeesCache(organizationId);
      } catch (e) {
        logger.warn('Failed to invalidate employees cache after bulk shift clear', {
          error: e.message,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Cleared shift for ${result.modifiedCount} selected employee(s).`,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        shiftId: null,
        shiftName: null,
      });
    }

    const activeRuleForShift = await AttendanceRule.findOne({
      organizationId,
      isActive: true,
    })
      .sort({ priority: -1, updatedAt: -1 })
      .select('shifts')
      .lean();

    let assigned;
    try {
      assigned = parseEmployeeShiftAssignment(
        { shiftId: rawId, shiftName: rawName },
        activeRuleForShift?.shifts
      );
    } catch (shiftErr) {
      return res.status(400).json({
        success: false,
        message: shiftErr.message,
      });
    }

    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: 'Select Shift 1, Shift 2, or No shift.',
      });
    }

    const result = await Employee.updateMany(filter, {
      $set: {
        shiftId: assigned.shiftId,
        shiftName: assigned.shiftName,
      },
    });

    try {
      await invalidateEmployeesCache(organizationId);
    } catch (e) {
      logger.warn('Failed to invalidate employees cache after bulk shift assign', {
        error: e.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Assigned ${assigned.shiftName} to ${result.modifiedCount} selected employee(s).`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      shiftId: assigned.shiftId,
      shiftName: assigned.shiftName,
    });
  } catch (error) {
    logger.error('Error bulk-assigning employee shift', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to assign shift to employees',
      error: error.message,
    });
  }
};
