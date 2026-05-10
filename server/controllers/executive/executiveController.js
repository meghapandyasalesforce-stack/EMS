import { getOrganizationId } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import Employee from '../../models/employee.model.js';
import Payroll from '../../models/payroll.model.js';
import Project from '../../models/project.model.js';
import Attendance from '../../models/attendance.model.js';
import Leave from '../../models/leave.model.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import logger from '../../helpers/logger.js';
import mongoose from 'mongoose';

/**
 * Date window for payroll / leave KPIs — matches {@link getFinancialSummary} semantics.
 */
const resolveExecutivePeriodRange = (query = {}) => {
    const { startDate, endDate, period = 'month' } = query;
    let start;
    let end;

    if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
    } else {
        const currentDate = new Date();
        switch (period) {
            case 'week': {
                start = new Date(currentDate.getTime());
                start.setDate(start.getDate() - 7);
                end = new Date();
                break;
            }
            case 'month':
                start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                end = new Date();
                break;
            case 'quarter': {
                const quarter = Math.floor(currentDate.getMonth() / 3);
                start = new Date(currentDate.getFullYear(), quarter * 3, 1);
                end = new Date();
                break;
            }
            case 'year':
                start = new Date(currentDate.getFullYear(), 0, 1);
                end = new Date();
                break;
            default:
                start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                end = new Date();
        }
    }

    return {
        start,
        end,
        dateFilter: { createdAt: { $gte: start, $lte: end } }
    };
};

/**
 * Get Executive Financial Summary
 * @route GET /api/v1/admin/executive/financial-summary
 * @access Private (Admin/Executive only)
 */
export const getFinancialSummary = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const { start, end, dateFilter } = resolveExecutivePeriodRange(req.query);

    try {
        // Total Payroll Costs
        const payrollStats = await Payroll.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), ...dateFilter } },
            {
                $group: {
                    _id: null,
                    totalPayroll: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    avgPayroll: { $avg: '$inHandSalary' },
                    employeeCount: { $sum: 1 },
                    minPayroll: { $min: '$inHandSalary' },
                    maxPayroll: { $max: '$inHandSalary' }
                }
            }
        ]);

        // Monthly Payroll Trend
        const monthlyPayroll = await Payroll.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), ...dateFilter } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Department-wise Payroll
        const departmentPayroll = await Payroll.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), ...dateFilter } },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$employee.department' || 'Unknown',
                    total: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    avg: { $avg: '$inHandSalary' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        // Previous period comparison
        const periodDiff = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - periodDiff);
        const prevEnd = start;

        const previousPayroll = await Payroll.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: prevStart, $lte: prevEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPayroll: { $sum: { $ifNull: ['$inHandSalary', 0] } }
                }
            }
        ]);

        const currentTotal = payrollStats[0]?.totalPayroll || 0;
        const previousTotal = previousPayroll[0]?.totalPayroll || 0;
        const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(2) : 0;

        return sendSuccess(res, {
            summary: {
                totalPayroll: currentTotal,
                averagePayroll: payrollStats[0]?.avgPayroll || 0,
                employeeCount: payrollStats[0]?.employeeCount || 0,
                growth: parseFloat(growth),
                period: { start, end }
            },
            trends: monthlyPayroll.map(item => ({
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                total: item.total,
                count: item.count
            })),
            byDepartment: departmentPayroll,
            comparison: {
                current: currentTotal,
                previous: previousTotal,
                growth: parseFloat(growth)
            }
        }, 'Financial summary retrieved successfully');
    } catch (error) {
        logger.error('Error fetching financial summary', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch financial summary', 500);
    }
});

/**
 * Get Executive KPIs
 * @route GET /api/v1/admin/executive/kpis
 * @access Private (Admin/Executive only)
 */
export const getExecutiveKPIs = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const { start, end, dateFilter } = resolveExecutivePeriodRange(req.query);

    try {
        // Employee Metrics
        const [totalEmployees, activeEmployees] = await Promise.all([
            Employee.countDocuments({ organizationId }),
            Employee.countDocuments({ organizationId, status: 'active' })
        ]);

        // Project Metrics
        const projectStats = await Project.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const activeProjects = projectStats
            .filter(p => p._id === 'pending' || p._id === 'in-progress')
            .reduce((sum, p) => sum + p.count, 0);
        const totalProjects = projectStats.reduce((sum, p) => sum + p.count, 0);
        const completedProjects = projectStats.find(p => p._id === 'completed')?.count || 0;

        // Attendance Metrics (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const attendanceStats = await Attendance.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    totalHours: { $sum: '$effectiveHours' },
                    avgHours: { $avg: '$effectiveHours' },
                    presentDays: { $sum: 1 },
                    uniqueEmployees: { $addToSet: '$userId' }
                }
            }
        ]);

        const expectedWorkingDays = 22; // Approximate working days per month
        const attendanceRate = activeEmployees > 0 && attendanceStats[0] ? 
            ((attendanceStats[0].presentDays / (activeEmployees * expectedWorkingDays)) * 100).toFixed(2) : 0;

        // Payroll: same window as financial summary; avg = total ÷ distinct employees paid (HRMS-standard)
        const payrollRollup = await Payroll.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    employeeIds: { $addToSet: '$employeeId' }
                }
            }
        ]);
        const payrollTotalAmount = payrollRollup[0]?.total || 0;
        const employeesPaidCount = payrollRollup[0]?.employeeIds?.length || 0;
        const avgPerPaidEmployee =
            employeesPaidCount > 0 ? payrollTotalAmount / employeesPaidCount : 0;

        // Leave Metrics
        const leaveStats = await Leave.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalDays: { $sum: { $ifNull: ['$duration', 0] } }
                }
            }
        ]);

        const approvalStats = {};
        const slaStats = {};

        return sendSuccess(res, {
            employees: {
                total: totalEmployees,
                active: activeEmployees,
                inactive: totalEmployees - activeEmployees,
                utilizationRate: totalEmployees > 0 ? parseFloat(((activeEmployees / totalEmployees) * 100).toFixed(2)) : 0
            },
            projects: {
                total: totalProjects,
                active: activeProjects,
                completionRate:
                    totalProjects > 0
                        ? parseFloat(((completedProjects / totalProjects) * 100).toFixed(2))
                        : 0
            },
            attendance: {
                rate: parseFloat(attendanceRate),
                totalHours: attendanceStats[0]?.totalHours || 0,
                avgHoursPerDay: attendanceStats[0]?.avgHours || 0,
                uniqueEmployees: attendanceStats[0]?.uniqueEmployees?.length || 0
            },
            payroll: {
                total: payrollTotalAmount,
                avgPerEmployee: avgPerPaidEmployee,
                employeesPaid: employeesPaidCount,
                activeEmployeesSnapshot: activeEmployees,
                window: { start, end }
            },
            leaves: {
                pending: leaveStats.find(l => l._id === 'pending')?.count || 0,
                approved: leaveStats.find(l => l._id === 'approved')?.count || 0,
                totalDays: leaveStats.reduce((sum, l) => sum + (l.totalDays || 0), 0)
            },
            approvals: approvalStats,
            sla: slaStats,
            productivity: {
                avgHoursPerEmployee: attendanceStats[0]?.avgHours || 0,
                employeeEngagement: 0 // Placeholder for future implementation
            }
        }, 'KPIs retrieved successfully');
    } catch (error) {
        logger.error('Error fetching executive KPIs', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch KPIs', 500);
    }
});

/**
 * Get Critical Alerts
 * @route GET /api/v1/admin/executive/alerts
 * @access Private (Admin/Executive only)
 */
export const getCriticalAlerts = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        const alerts = [];

        // High-priority leave requests
        const pendingLeaves = await Leave.countDocuments({
            organizationId,
            status: 'pending',
            priority: 'high'
        });
        if (pendingLeaves > 0) {
            alerts.push({
                type: 'leave',
                severity: 'high',
                title: 'High-Priority Leave Requests',
                message: `${pendingLeaves} high-priority leave requests pending approval`,
                count: pendingLeaves,
                action: '/leave-management',
                icon: 'calendar'
            });
        }

        // Overdue projects
        const overdueProjects = await Project.countDocuments({
            organizationId,
            status: { $in: ['pending', 'in-progress'] },
            endDate: { $lt: new Date() }
        });
        if (overdueProjects > 0) {
            alerts.push({
                type: 'project',
                severity: 'high',
                title: 'Overdue Projects',
                message: `${overdueProjects} projects are past their deadline`,
                count: overdueProjects,
                action: '/projects',
                icon: 'project'
            });
        }

        // Low attendance rate
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const attendanceCount = await Attendance.countDocuments({
            organizationId,
            date: { $gte: thirtyDaysAgo }
        });
        const activeEmployees = await Employee.countDocuments({
            organizationId,
            status: 'active'
        });
        const expectedAttendance = activeEmployees * 22; // 22 working days
        const attendanceRate = expectedAttendance > 0 ? (attendanceCount / expectedAttendance) * 100 : 0;

        if (attendanceRate < 70) {
            alerts.push({
                type: 'attendance',
                severity: 'medium',
                title: 'Low Attendance Rate',
                message: `Attendance rate is ${attendanceRate.toFixed(1)}%, below 70% threshold`,
                count: parseFloat(attendanceRate.toFixed(1)),
                action: '/today-attendance',
                icon: 'attendance'
            });
        }

        // Unpaid payrolls (overdue by more than 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const unpaidPayrolls = await Payroll.countDocuments({
            organizationId,
            status: { $ne: 'paid' },
            createdAt: { $lt: sevenDaysAgo }
        });
        if (unpaidPayrolls > 0) {
            alerts.push({
                type: 'payroll',
                severity: 'high',
                title: 'Unpaid Payrolls',
                message: `${unpaidPayrolls} payrolls are overdue for payment`,
                count: unpaidPayrolls,
                action: '/admin-payroll',
                icon: 'payroll'
            });
        }

        // Pending approvals (general)
        const pendingApprovals = await Leave.countDocuments({
            organizationId,
            status: 'pending'
        });
        if (pendingApprovals > 5) {
            alerts.push({
                type: 'approval',
                severity: 'medium',
                title: 'Pending Approvals',
                message: `${pendingApprovals} leave requests awaiting approval`,
                count: pendingApprovals,
                action: '/leave-management',
                icon: 'approval'
            });
        }

        return sendSuccess(res, {
            alerts,
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'high').length
        }, 'Alerts retrieved successfully');
    } catch (error) {
        logger.error('Error fetching critical alerts', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch alerts', 500);
    }
});

/**
 * Get Project Portfolio Overview
 * @route GET /api/v1/admin/executive/project-portfolio
 * @access Private (Admin/Executive only)
 */
export const getProjectPortfolio = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        // Project Status Distribution
        const statusDistribution = await Project.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Projects by Priority
        const priorityDistribution = await Project.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Recent Projects
        const recentProjects = await Project.find({ organizationId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name status priority startDate endDate description')
            .lean();

        // Projects at Risk (overdue or near deadline)
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const atRiskProjects = await Project.find({
            organizationId,
            status: { $in: ['pending', 'in-progress'] },
            $or: [
                { endDate: { $lt: now } }, // Overdue
                { endDate: { $gte: now, $lte: sevenDaysFromNow } } // Due within 7 days
            ]
        })
            .select('name status priority endDate')
            .sort({ endDate: 1 })
            .limit(10)
            .lean();

        // Project Health Score
        const totalProjects = statusDistribution.reduce((sum, s) => sum + s.count, 0);
        const completedProjects = statusDistribution.find(s => s._id === 'completed')?.count || 0;
        const healthScore = totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(2) : 0;

        return sendSuccess(res, {
            overview: {
                total: totalProjects,
                active: statusDistribution
                    .filter(s => s._id === 'pending' || s._id === 'in-progress')
                    .reduce((sum, s) => sum + s.count, 0),
                completed: completedProjects,
                healthScore: parseFloat(healthScore)
            },
            statusDistribution,
            priorityDistribution,
            recentProjects: recentProjects.map(p => ({
                ...p,
                endDate: p.endDate ? new Date(p.endDate).toISOString() : null,
                startDate: p.startDate ? new Date(p.startDate).toISOString() : null
            })),
            atRisk: atRiskProjects.map(p => ({
                ...p,
                endDate: p.endDate ? new Date(p.endDate).toISOString() : null
            })),
            atRiskCount: atRiskProjects.length
        }, 'Project portfolio retrieved successfully');
    } catch (error) {
        logger.error('Error fetching project portfolio', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch project portfolio', 500);
    }
});

/**
 * Phase 2: Get Department Performance Metrics
 * @route GET /api/v1/admin/executive/department-performance
 * @access Private (Admin/Executive only)
 */
export const getDepartmentPerformance = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { period = 'month' } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        // Calculate date range
        const now = new Date();
        let start;
        switch (period) {
            case 'week':
                start = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                start = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        // Department-wise Employee Metrics
        const departmentEmployees = await Employee.aggregate([
            { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
            {
                $group: {
                    _id: '$department',
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0]
                        }
                    },
                    avgTenure: { $avg: { $ifNull: [{ $divide: [{ $subtract: [new Date(), '$joiningDate'] }, 86400000] }, 0] } }
                }
            }
        ]);

        // Department-wise Attendance
        const departmentAttendance = await Attendance.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    date: { $gte: start }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$employee.department' || 'Unknown',
                    totalHours: { $sum: '$effectiveHours' },
                    avgHours: { $avg: '$effectiveHours' },
                    presentDays: { $sum: 1 },
                    uniqueEmployees: { $addToSet: '$userId' }
                }
            }
        ]);

        // Department-wise Payroll
        const departmentPayroll = await Payroll.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: start }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$employee.department' || 'Unknown',
                    totalPayroll: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    avgPayroll: { $avg: '$inHandSalary' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Department-wise Projects
        const departmentProjects = await Project.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId)
                }
            },
            {
                $group: {
                    _id: '$department',
                    total: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0]
                        }
                    },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                }
            }
        ]);

        // Combine all metrics by department
        const departments = {};
        
        [...departmentEmployees, ...departmentAttendance, ...departmentPayroll, ...departmentProjects].forEach(item => {
            const dept = item._id || 'Unknown';
            if (!departments[dept]) {
                departments[dept] = {
                    name: dept,
                    employees: { total: 0, active: 0, avgTenure: 0 },
                    attendance: { totalHours: 0, avgHours: 0, presentDays: 0, uniqueEmployees: 0 },
                    payroll: { total: 0, avg: 0, count: 0 },
                    projects: { total: 0, active: 0, completed: 0 }
                };
            }
            
            if (item.total !== undefined) {
                departments[dept].employees = {
                    total: item.total || 0,
                    active: item.active || 0,
                    avgTenure: Math.round(item.avgTenure || 0)
                };
            }
            if (item.totalHours !== undefined) {
                departments[dept].attendance = {
                    totalHours: item.totalHours || 0,
                    avgHours: parseFloat((item.avgHours || 0).toFixed(2)),
                    presentDays: item.presentDays || 0,
                    uniqueEmployees: item.uniqueEmployees?.length || 0
                };
            }
            if (item.totalPayroll !== undefined) {
                departments[dept].payroll = {
                    total: item.totalPayroll || 0,
                    avg: parseFloat((item.avgPayroll || 0).toFixed(2)),
                    count: item.count || 0
                };
            }
            if (item.total !== undefined && item.active !== undefined && item.completed !== undefined) {
                departments[dept].projects = {
                    total: item.total || 0,
                    active: item.active || 0,
                    completed: item.completed || 0
                };
            }
        });

        // Calculate performance scores
        const performanceData = Object.values(departments).map(dept => {
            const attendanceRate = dept.employees.total > 0 && dept.attendance.uniqueEmployees > 0
                ? ((dept.attendance.uniqueEmployees / dept.employees.total) * 100).toFixed(1)
                : 0;
            
            const projectCompletionRate = dept.projects.total > 0
                ? ((dept.projects.completed / dept.projects.total) * 100).toFixed(1)
                : 0;

            const performanceScore = (
                (parseFloat(attendanceRate) * 0.3) +
                (parseFloat(projectCompletionRate) * 0.4) +
                ((dept.employees.active / Math.max(dept.employees.total, 1)) * 100 * 0.3)
            ).toFixed(1);

            return {
                ...dept,
                metrics: {
                    attendanceRate: parseFloat(attendanceRate),
                    projectCompletionRate: parseFloat(projectCompletionRate),
                    performanceScore: parseFloat(performanceScore)
                }
            };
        });

        return sendSuccess(res, {
            departments: performanceData,
            period,
            summary: {
                totalDepartments: performanceData.length,
                avgPerformanceScore: performanceData.length > 0
                    ? (performanceData.reduce((sum, d) => sum + d.metrics.performanceScore, 0) / performanceData.length).toFixed(1)
                    : 0
            }
        }, 'Department performance retrieved successfully');
    } catch (error) {
        logger.error('Error fetching department performance', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch department performance', 500);
    }
});

/**
 * Phase 2: Get Employee Trends
 * @route GET /api/v1/admin/executive/employee-trends
 * @access Private (Admin/Executive only)
 */
export const getEmployeeTrends = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { months = 12 } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - parseInt(months), 1);

        // Monthly employee growth
        const monthlyGrowth = await Employee.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Monthly attendance trends
        const monthlyAttendance = await Attendance.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    totalHours: { $sum: '$effectiveHours' },
                    avgHours: { $avg: '$effectiveHours' },
                    presentDays: { $sum: 1 },
                    uniqueEmployees: { $addToSet: '$userId' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Monthly payroll trends
        const monthlyPayroll = await Payroll.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    avg: { $avg: '$inHandSalary' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Format data for charts
        const trends = {
            employeeGrowth: monthlyGrowth.map(item => ({
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                count: item.count
            })),
            attendance: monthlyAttendance.map(item => ({
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                totalHours: item.totalHours,
                avgHours: parseFloat((item.avgHours || 0).toFixed(2)),
                presentDays: item.presentDays,
                uniqueEmployees: item.uniqueEmployees?.length || 0
            })),
            payroll: monthlyPayroll.map(item => ({
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                total: item.total,
                avg: parseFloat((item.avg || 0).toFixed(2)),
                count: item.count
            }))
        };

        // Calculate growth rates
        const employeeGrowthRate = monthlyGrowth.length >= 2
            ? (((monthlyGrowth[monthlyGrowth.length - 1].count - monthlyGrowth[0].count) / monthlyGrowth[0].count) * 100).toFixed(2)
            : 0;

        const payrollGrowthRate = monthlyPayroll.length >= 2
            ? (((monthlyPayroll[monthlyPayroll.length - 1].total - monthlyPayroll[0].total) / monthlyPayroll[0].total) * 100).toFixed(2)
            : 0;

        return sendSuccess(res, {
            trends,
            growthRates: {
                employees: parseFloat(employeeGrowthRate),
                payroll: parseFloat(payrollGrowthRate)
            },
            period: { months: parseInt(months), startDate, endDate: now }
        }, 'Employee trends retrieved successfully');
    } catch (error) {
        logger.error('Error fetching employee trends', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch employee trends', 500);
    }
});

/**
 * Phase 3: Get Strategic Insights
 * @route GET /api/v1/admin/executive/strategic-insights
 * @access Private (Admin/Executive only)
 */
export const getStrategicInsights = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        const insights = [];

        // Employee Insights
        const totalEmployees = await Employee.countDocuments({ organizationId });
        const activeEmployees = await Employee.countDocuments({ organizationId, status: 'active' });
        const utilizationRate = totalEmployees > 0 ? ((activeEmployees / totalEmployees) * 100).toFixed(1) : 0;

        if (parseFloat(utilizationRate) < 80) {
            insights.push({
                category: 'employees',
                type: 'warning',
                title: 'Low Employee Utilization',
                message: `Only ${utilizationRate}% of employees are active. Consider reviewing inactive employees.`,
                recommendation: 'Review employee status and consider re-engagement strategies or termination processes.',
                priority: 'medium'
            });
        }

        // Financial Insights
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const lastMonth = new Date(currentMonth);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const [currentPayroll, previousPayroll] = await Promise.all([
            Payroll.aggregate([
                {
                    $match: {
                        organizationId: new mongoose.Types.ObjectId(organizationId),
                        createdAt: { $gte: currentMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$inHandSalary', 0] } } } }
            ]),
            Payroll.aggregate([
                {
                    $match: {
                        organizationId: new mongoose.Types.ObjectId(organizationId),
                        createdAt: { $gte: lastMonth, $lt: currentMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$inHandSalary', 0] } } } }
            ])
        ]);

        const currentTotal = currentPayroll[0]?.total || 0;
        const previousTotal = previousPayroll[0]?.total || 0;
        const payrollGrowth = previousTotal > 0 ? (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(2) : 0;

        if (parseFloat(payrollGrowth) > 20) {
            insights.push({
                category: 'financial',
                type: 'warning',
                title: 'Significant Payroll Increase',
                message: `Payroll has increased by ${payrollGrowth}% compared to last month.`,
                recommendation: 'Review payroll trends and ensure budget alignment.',
                priority: 'high'
            });
        }

        // Project Insights
        const overdueProjects = await Project.countDocuments({
            organizationId,
            status: { $in: ['pending', 'in-progress'] },
            endDate: { $lt: new Date() }
        });

        if (overdueProjects > 0) {
            insights.push({
                category: 'projects',
                type: 'critical',
                title: 'Project Delays',
                message: `${overdueProjects} project(s) are overdue.`,
                recommendation: 'Review project timelines and resource allocation. Consider re-prioritizing or extending deadlines.',
                priority: 'high'
            });
        }

        // Attendance Insights
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const attendanceCount = await Attendance.countDocuments({
            organizationId,
            date: { $gte: thirtyDaysAgo }
        });
        const expectedAttendance = activeEmployees * 22;
        const attendanceRate = expectedAttendance > 0 ? ((attendanceCount / expectedAttendance) * 100).toFixed(1) : 0;

        if (parseFloat(attendanceRate) < 75) {
            insights.push({
                category: 'attendance',
                type: 'warning',
                title: 'Low Attendance Rate',
                message: `Attendance rate is ${attendanceRate}%, below optimal threshold.`,
                recommendation: 'Investigate attendance patterns and consider engagement initiatives.',
                priority: 'medium'
            });
        }

        // Positive Insights
        if (parseFloat(utilizationRate) >= 90) {
            insights.push({
                category: 'employees',
                type: 'success',
                title: 'Excellent Employee Utilization',
                message: `${utilizationRate}% employee utilization rate indicates strong workforce engagement.`,
                recommendation: 'Maintain current engagement strategies.',
                priority: 'low'
            });
        }

        return sendSuccess(res, {
            insights,
            summary: {
                total: insights.length,
                critical: insights.filter(i => i.priority === 'high').length,
                warnings: insights.filter(i => i.type === 'warning').length,
                successes: insights.filter(i => i.type === 'success').length
            }
        }, 'Strategic insights retrieved successfully');
    } catch (error) {
        logger.error('Error fetching strategic insights', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch strategic insights', 500);
    }
});

/**
 * Phase 3: Get Predictive Analytics
 * @route GET /api/v1/admin/executive/predictive-analytics
 * @access Private (Admin/Executive only)
 */
export const getPredictiveAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { forecastMonths = 6 } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

        // Historical payroll data for trend analysis
        const historicalPayroll = await Payroll.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: { $ifNull: ['$inHandSalary', 0] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Historical employee growth
        const historicalEmployees = await Employee.aggregate([
            {
                $match: {
                    organizationId: new mongoose.Types.ObjectId(organizationId),
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Simple linear regression for forecasting
        const calculateTrend = (data) => {
            if (data.length < 2) return { slope: 0, intercept: 0 };
            
            const n = data.length;
            const sumX = data.reduce((sum, _, i) => sum + i, 0);
            const sumY = data.reduce((sum, item) => sum + (item.total || item.count || 0), 0);
            const sumXY = data.reduce((sum, item, i) => sum + (i * (item.total || item.count || 0)), 0);
            const sumX2 = data.reduce((sum, _, i) => sum + (i * i), 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            return { slope, intercept };
        };

        const payrollTrend = calculateTrend(historicalPayroll);
        const employeeTrend = calculateTrend(historicalEmployees);

        // Generate forecasts
        const forecasts = {
            payroll: [],
            employees: []
        };

        for (let i = 1; i <= parseInt(forecastMonths); i++) {
            const monthIndex = historicalPayroll.length + i - 1;
            const forecastedPayroll = Math.max(0, payrollTrend.slope * monthIndex + payrollTrend.intercept);
            const forecastedEmployees = Math.max(0, employeeTrend.slope * monthIndex + employeeTrend.intercept);

            const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
            forecasts.payroll.push({
                month: `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`,
                predicted: Math.round(forecastedPayroll),
                confidence: 'medium'
            });

            forecasts.employees.push({
                month: `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`,
                predicted: Math.round(forecastedEmployees),
                confidence: 'medium'
            });
        }

        // Risk indicators
        const currentPayroll = historicalPayroll[historicalPayroll.length - 1]?.total || 0;
        const projectedPayroll = forecasts.payroll[0]?.predicted || 0;
        const payrollIncrease = currentPayroll > 0 ? (((projectedPayroll - currentPayroll) / currentPayroll) * 100).toFixed(2) : 0;

        return sendSuccess(res, {
            forecasts,
            trends: {
                payroll: {
                    slope: payrollTrend.slope,
                    direction: payrollTrend.slope > 0 ? 'increasing' : payrollTrend.slope < 0 ? 'decreasing' : 'stable'
                },
                employees: {
                    slope: employeeTrend.slope,
                    direction: employeeTrend.slope > 0 ? 'increasing' : employeeTrend.slope < 0 ? 'decreasing' : 'stable'
                }
            },
            riskIndicators: {
                payrollGrowth: parseFloat(payrollIncrease),
                riskLevel: parseFloat(payrollIncrease) > 20 ? 'high' : parseFloat(payrollIncrease) > 10 ? 'medium' : 'low'
            },
            period: { forecastMonths: parseInt(forecastMonths) }
        }, 'Predictive analytics retrieved successfully');
    } catch (error) {
        logger.error('Error fetching predictive analytics', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to fetch predictive analytics', 500);
    }
});

