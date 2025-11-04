import Employee from '../../models/employee.model.js';
import mongoose from 'mongoose';
import Attendance from '../../models/attendance.model.js';
import Project from '../../models/project.model.js';

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

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
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
    if (manager !== undefined) updateData.manager = manager;
    if (salary !== undefined) updateData.salary = salary;
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate;
    if (performanceScore !== undefined) updateData.performanceScore = performanceScore;

    // Update employee work information
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employeeId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Employee work information updated successfully',
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('Error updating employee work information:', error);
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
      .select('jobTitle department position manager salary joiningDate employeeId name lastName email')
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
    console.error('Error fetching employee work information:', error);
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
    console.error('Error calculating employee statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate employee statistics',
      error: error.message
    });
  }
};
