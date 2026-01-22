import Leave from '../../models/leave.model.js';
import LeaveBalance from '../../models/leaveBalance.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';
import mongoose from 'mongoose';

/**
 * Get leave usage trends
 */
export const getLeaveUsageTrends = async (req, res) => {
    try {
        const { startDate, endDate, department, leaveType } = req.query;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const query = addOrganizationFilter(req, {
            status: 'approved'
        });

        if (startDate && endDate) {
            query.startDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        if (leaveType) {
            query.leaveType = leaveType;
        }

        // Get leaves with employee population
        let leaves = await Leave.find(query)
            .populate('employee', 'name lastName department')
            .lean();

        // Filter by department if specified
        if (department) {
            leaves = leaves.filter(leave => 
                leave.employee?.department?.toLowerCase() === department.toLowerCase()
            );
        }

        // Group by month
        const monthlyTrends = {};
        leaves.forEach(leave => {
            const month = new Date(leave.startDate).toLocaleString('default', { month: 'long', year: 'numeric' });
            if (!monthlyTrends[month]) {
                monthlyTrends[month] = { total: 0, byType: {} };
            }
            monthlyTrends[month].total += leave.duration || 0;
            monthlyTrends[month].byType[leave.leaveType] = 
                (monthlyTrends[month].byType[leave.leaveType] || 0) + (leave.duration || 0);
        });

        // Group by leave type
        const byType = {};
        leaves.forEach(leave => {
            byType[leave.leaveType] = (byType[leave.leaveType] || 0) + (leave.duration || 0);
        });

        // Group by department
        const byDepartment = {};
        leaves.forEach(leave => {
            const dept = leave.employee?.department || 'Unknown';
            if (!byDepartment[dept]) {
                byDepartment[dept] = { total: 0, byType: {} };
            }
            byDepartment[dept].total += leave.duration || 0;
            byDepartment[dept].byType[leave.leaveType] = 
                (byDepartment[dept].byType[leave.leaveType] || 0) + (leave.duration || 0);
        });

        return sendSuccess(res, {
            monthlyTrends,
            byType,
            byDepartment,
            totalLeaves: leaves.length,
            totalDays: leaves.reduce((sum, l) => sum + (l.duration || 0), 0)
        }, 'Leave usage trends retrieved successfully');
    } catch (error) {
        logger.error('Get Leave Usage Trends Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error fetching leave usage trends', 500, 'FETCH_ERROR');
    }
};

/**
 * Get leave balance report
 */
export const getLeaveBalanceReport = async (req, res) => {
    try {
        const { year, department } = req.query;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const employeeQuery = addOrganizationFilter(req, { status: 'active' });
        if (department) {
            employeeQuery.department = department;
        }

        const employees = await Employee.find(employeeQuery).lean();
        const balances = [];

        for (const employee of employees) {
            const balance = await LeaveBalance.findOne({
                organizationId,
                employee: employee._id,
                year: targetYear
            }).populate('policy', 'policyName').lean();

            if (balance) {
                balances.push({
                    employee: {
                        _id: employee._id,
                        name: employee.name,
                        lastName: employee.lastName,
                        employeeId: employee.employeeId,
                        department: employee.department
                    },
                    balance
                });
            }
        }

        // Calculate summary statistics
        const summary = {
            totalEmployees: balances.length,
            totalAccrued: 0,
            totalUsed: 0,
            totalAvailable: 0,
            totalPending: 0,
            byLeaveType: {}
        };

        balances.forEach(({ balance }) => {
            balance.balances?.forEach(typeBalance => {
                summary.totalAccrued += typeBalance.accrued || 0;
                summary.totalUsed += typeBalance.used || 0;
                summary.totalAvailable += typeBalance.available || 0;
                summary.totalPending += typeBalance.pending || 0;

                if (!summary.byLeaveType[typeBalance.leaveType]) {
                    summary.byLeaveType[typeBalance.leaveType] = {
                        accrued: 0,
                        used: 0,
                        available: 0
                    };
                }
                summary.byLeaveType[typeBalance.leaveType].accrued += typeBalance.accrued || 0;
                summary.byLeaveType[typeBalance.leaveType].used += typeBalance.used || 0;
                summary.byLeaveType[typeBalance.leaveType].available += typeBalance.available || 0;
            });
        });

        return sendSuccess(res, {
            balances,
            summary,
            year: targetYear
        }, 'Leave balance report retrieved successfully');
    } catch (error) {
        logger.error('Get Leave Balance Report Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error fetching leave balance report', 500, 'FETCH_ERROR');
    }
};

/**
 * Get leave approval analytics
 */
export const getLeaveApprovalAnalytics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const query = addOrganizationFilter(req, {});

        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const leaves = await Leave.find(query).lean();

        const analytics = {
            total: leaves.length,
            approved: leaves.filter(l => l.status === 'approved').length,
            rejected: leaves.filter(l => l.status === 'rejected').length,
            pending: leaves.filter(l => l.status === 'pending').length,
            cancelled: leaves.filter(l => l.status === 'cancelled').length,
            byType: {},
            byStatus: {
                approved: 0,
                rejected: 0,
                pending: 0,
                cancelled: 0
            },
            averageProcessingTime: 0
        };

        leaves.forEach(leave => {
            // Count by type
            if (!analytics.byType[leave.leaveType]) {
                analytics.byType[leave.leaveType] = {
                    total: 0,
                    approved: 0,
                    rejected: 0,
                    pending: 0
                };
            }
            analytics.byType[leave.leaveType].total++;
            analytics.byType[leave.leaveType][leave.status]++;

            // Calculate processing time for approved/rejected
            if (leave.status === 'approved' && leave.approvedAt) {
                const processingTime = new Date(leave.approvedAt) - new Date(leave.createdAt);
                analytics.averageProcessingTime += processingTime;
            } else if (leave.status === 'rejected' && leave.rejectedAt) {
                const processingTime = new Date(leave.rejectedAt) - new Date(leave.createdAt);
                analytics.averageProcessingTime += processingTime;
            }
        });

        const processedLeaves = analytics.approved + analytics.rejected;
        if (processedLeaves > 0) {
            analytics.averageProcessingTime = Math.round(analytics.averageProcessingTime / processedLeaves / (1000 * 60 * 60)); // Convert to hours
        }

        return sendSuccess(res, analytics, 'Leave approval analytics retrieved successfully');
    } catch (error) {
        logger.error('Get Leave Approval Analytics Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error fetching leave approval analytics', 500, 'FETCH_ERROR');
    }
};

