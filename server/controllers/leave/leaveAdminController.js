import Leave from "../../models/leave.model.js"
import Employee from "../../models/employee.model.js";
import mongoose from "mongoose";
import logger from "../../helpers/logger.js";
import { parsePagination, parseSort, sendPaginatedResponse } from "../../helpers/paginationHelper.js";
import { addOrganizationFilter } from "../../helpers/organizationHelper.js";
import { getManagerEmployeeIds, isEmployeeLinkedToManager } from "../../helpers/managerHelper.js";

export const getAllLeaves = async (req, res) => {
    try {
        // Access is controlled by middleware (isAdminOrHRAuthenticated)
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
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
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
        const [leaves, total] = await Promise.all([
            Leave.find(query)
                .select('-__v')
                .populate('employee', 'name email department')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Leave.countDocuments(query)
        ]);

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
            casual: 0
        };
        
        // Handle case where aggregation returns empty array
        if (statisticsData && Array.isArray(statisticsData)) {
            statisticsData.forEach(stat => {
                if (leavesByType.hasOwnProperty(stat._id)) {
                    leavesByType[stat._id] = stat.totalDuration;
                }
            });
        }

        const leavesTaken = (statisticsData && Array.isArray(statisticsData))
            ? statisticsData.reduce((acc, stat) => acc + stat.totalDuration, 0)
            : 0;
        const totalLeaves = 36; // This should come from employee/leave policy configuration
        const statistics = {
            totalLeaves,
            leavesTaken,
            remainingLeaves: totalLeaves - leavesTaken,
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

        const leave = await Leave.findById(id).populate('employee', 'department');
        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        // If user is a manager (not admin or HR), verify the leave belongs to an employee linked to them
        // Example: Manager "Arun Kumar" can only approve/reject leaves for employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const leaveEmployee = await Employee.findById(leave.employee?._id || leave.employee).select('manager').lean();
            if (!leaveEmployee) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found.' 
                });
            }
            
            // Check if employee's manager field matches this manager
            const isLinked = isEmployeeLinkedToManager(leaveEmployee, req.employee);
            
            if (!isLinked) {
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

        leave.status = status;
        
        if (status === 'approved') {
            leave.approvedBy = req.user?._id || req.employee?._id;
            leave.approvedAt = new Date();
            leave.rejectionReason = undefined;
            leave.rejectedBy = undefined;
            leave.rejectedAt = undefined;
        } else if (status === 'rejected') {
            leave.rejectedBy = req.user?._id || req.employee?._id;
            leave.rejectedAt = new Date();
            if (rejectionReason) {
                leave.rejectionReason = rejectionReason;
            }
            leave.approvedBy = undefined;
            leave.approvedAt = undefined;
        } else if (status === 'cancelled') {
            // Employee can cancel their own leave
            leave.status = 'cancelled';
        }

        await leave.save();

        // Send push notification based on status
        if (leave.employee) {
            try {
                const { notifyLeaveApproved, notifyLeaveRejected } = await import('../../helpers/pushNotificationTriggers.js');
                const employeeId = leave.employee._id || leave.employee;
                
                if (status === 'approved') {
                    await notifyLeaveApproved(employeeId, leave);
                } else if (status === 'rejected') {
                    await notifyLeaveRejected(employeeId, leave);
                }
            } catch (notifError) {
                logger.warn('Failed to send leave status notification', {
                    error: notifError.message,
                    leaveId: leave._id,
                    status
                });
                // Don't fail the request if notification fails
            }
        }

        res.json({ message: 'Leave status updated successfully', leave });
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

        // Step 4: Find all leave records for this employee
        const leaves = await Leave.find({ employee: employeeObjectId });

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