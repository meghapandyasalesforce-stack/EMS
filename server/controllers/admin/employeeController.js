import Employee from '../../models/employee.model.js';
import mongoose from 'mongoose';
import Attendance from '../../models/attendance.model.js';
import Project from '../../models/project.model.js';
import logger from '../../helpers/logger.js';
import { invalidateEmployeesCache } from '../../helpers/cacheHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';

function deriveRoleFlagsFromWorkInfo({ department, position, jobTitle }) {
  const dept = (department || '').toLowerCase().trim();
  const pos = (position || '').toLowerCase().trim();
  const title = (jobTitle || '').toLowerCase().trim();

  const isHR =
    dept === 'hr' ||
    dept.includes('hr') ||
    dept.includes('human resource') ||
    title.includes('hr manager') ||
    title.includes('human resource') ||
    title.includes('hr') ||
    (pos.includes('hr') && pos.includes('manager'));

  const isManager =
    pos === 'manager' ||
    pos === 'director' ||
    pos.includes('manager') ||
    pos.includes('director') ||
    title.includes('manager') ||
    title.includes('director');

  return { isHR, isManager };
}

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
    const { jobTitle, department, position, manager, salary, joiningDate, performanceScore } = req.body;

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
    if (salary !== undefined) updateData.salary = salary;
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate;
    if (performanceScore !== undefined) updateData.performanceScore = performanceScore;

    // Keep functionalRoles in sync with work info edits:
    // - HR can see all employees.
    // - Manager (without HR) sees only their team.
    const effectiveDepartment = updateData.department ?? employee.department;
    const effectivePosition = updateData.position ?? employee.position;
    const effectiveJobTitle = updateData.jobTitle ?? employee.jobTitle;
    const { isHR, isManager } = deriveRoleFlagsFromWorkInfo({
      department: effectiveDepartment,
      position: effectivePosition,
      jobTitle: effectiveJobTitle
    });

    const nextRoles = new Set(Array.isArray(employee.functionalRoles) ? employee.functionalRoles : []);
    if (isHR) nextRoles.add('hr');
    else nextRoles.delete('hr');
    if (isManager) nextRoles.add('manager');
    else nextRoles.delete('manager');
    updateData.functionalRoles = Array.from(nextRoles);

    // Update employee work information
    // Explicitly include salary field in the response
    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: employeeId, organizationId },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -role').lean();

    // Ensure employee list caches reflect work-info changes immediately.
    if (updatedEmployee?.organizationId) {
      try {
        await invalidateEmployeesCache(updatedEmployee.organizationId);
      } catch (e) {
        logger.warn('Failed to invalidate employees cache after work-info update', { error: e.message });
      }
    }

    // Ensure salary is explicitly included in the response
    if (updatedEmployee && updatedEmployee.salary === undefined) {
      const employeeWithSalary = await Employee.findById(employeeId).select('salary').lean();
      updatedEmployee.salary = employeeWithSalary?.salary ?? 0;
    }

    res.status(200).json({
      success: true,
      message: 'Employee work information updated successfully',
      employee: updatedEmployee
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
