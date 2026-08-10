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
import { syncWorkflowProbationFromEmployee } from '../../helpers/employeeProbationSyncHelper.js';

async function resolveManagerReference(organizationId, managerInput) {
  const raw = String(managerInput || '').trim();
  if (!raw || raw === 'CEO') {
    return { manager: 'CEO', managerId: null };
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
    const { jobTitle, department, position, manager, salary, joiningDate, performanceScore, salaryEffectiveFrom, salaryRevisionNote, probation } = req.body;

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
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (department !== undefined) updateData.department = department;
    if (position !== undefined) updateData.position = position;
    if (manager !== undefined) {
      const resolvedManager = await resolveManagerReference(organizationId, manager);
      if (!resolvedManager) {
        return res.status(400).json({
          success: false,
          message: 'Selected manager not found in this organization'
        });
      }
      updateData.manager = resolvedManager.manager;
      updateData.managerId = resolvedManager.managerId;
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
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate;
    if (performanceScore !== undefined) updateData.performanceScore = performanceScore;
    if (probation !== undefined && probation !== null && typeof probation === 'object') {
      const nextProbation = {
        ...(employee.probation?.toObject?.() || employee.probation || {}),
      };
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
    res.status(500).json({
      success: false,
      message: 'Failed to update employee work information',
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
