/**
 * Performance Tracking Controller
 * Provides performance metrics, tracking, and analytics
 */

import PerformanceReview from '../../models/performanceReview.model.js';
import Goal from '../../models/goal.model.js';
import Employee from '../../models/employee.model.js';
import Attendance from '../../models/attendance.model.js';
import Task from '../../models/task.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import mongoose from 'mongoose';

/**
 * Get employee performance metrics
 */
export const getEmployeePerformanceMetrics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, startDate, endDate } = req.query;
    const targetEmployeeId = employeeId || req.employee?._id;

    if (!targetEmployeeId) {
        return sendError(res, 'Employee ID is required', 400);
    }

    // Verify employee belongs to organization
    const employee = await Employee.findOne({
        _id: targetEmployeeId,
        organizationId
    });

    if (!employee) {
        return sendError(res, 'Employee not found', 404);
    }

    // Check access permissions
    if (req.employee?._id && targetEmployeeId.toString() !== req.employee._id.toString()) {
        return sendError(res, 'You can only view your own performance metrics', 403);
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Get performance reviews
    const reviews = await PerformanceReview.find({
        organizationId,
        employeeId: targetEmployeeId,
        'reviewPeriod.endDate': { $gte: start, $lte: end },
        status: 'Completed'
    }).sort({ 'reviewPeriod.endDate': -1 });

    // Get goals
    const goals = await Goal.find({
        organizationId,
        employeeId: targetEmployeeId,
        startDate: { $lte: end },
        endDate: { $gte: start }
    });

    // Get attendance data
    const attendanceRecords = await Attendance.find({
        organizationId,
        userId: targetEmployeeId,
        date: { $gte: start, $lte: end }
    });

    // Get task data
    const tasks = await Task.find({
        organizationId,
        assignedTo: targetEmployeeId,
        createdAt: { $gte: start, $lte: end }
    });

    // Calculate metrics
    const metrics = {
        employee: {
            id: employee._id,
            name: `${employee.name} ${employee.lastName || ''}`,
            email: employee.email,
            department: employee.department
        },
        period: {
            startDate: start,
            endDate: end
        },
        reviews: {
            total: reviews.length,
            averageRating: reviews.length > 0
                ? reviews.reduce((sum, r) => {
                    const managerRating = r.managerEvaluation?.overallRating || 0;
                    return sum + managerRating;
                }, 0) / reviews.length
                : 0,
            latestReview: reviews[0] || null,
            ratingTrend: reviews.map(r => ({
                date: r.reviewPeriod.endDate,
                rating: r.managerEvaluation?.overallRating || 0
            }))
        },
        goals: {
            total: goals.length,
            completed: goals.filter(g => g.status === 'Completed').length,
            inProgress: goals.filter(g => g.status === 'In Progress').length,
            averageProgress: goals.length > 0
                ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
                : 0,
            completionRate: goals.length > 0
                ? Math.round((goals.filter(g => g.status === 'Completed').length / goals.length) * 100)
                : 0
        },
        attendance: {
            totalDays: attendanceRecords.length,
            presentDays: attendanceRecords.filter(a => a.status === 'Present').length,
            absentDays: attendanceRecords.filter(a => a.status === 'Absent').length,
            attendanceRate: attendanceRecords.length > 0
                ? Math.round((attendanceRecords.filter(a => a.status === 'Present').length / attendanceRecords.length) * 100)
                : 0,
            averageHours: attendanceRecords.length > 0
                ? attendanceRecords.reduce((sum, a) => {
                    if (a.clockIn && a.clockOut) {
                        const hours = (new Date(a.clockOut) - new Date(a.clockIn)) / (1000 * 60 * 60);
                        return sum + hours;
                    }
                    return sum;
                }, 0) / attendanceRecords.filter(a => a.clockIn && a.clockOut).length
                : 0
        },
        tasks: {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'Completed').length,
            inProgress: tasks.filter(t => t.status === 'In Progress').length,
            pending: tasks.filter(t => t.status === 'Pending').length,
            completionRate: tasks.length > 0
                ? Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100)
                : 0
        },
        overallScore: 0 // Will be calculated
    };

    // Calculate overall performance score (weighted average)
    const reviewScore = metrics.reviews.averageRating * 20; // 0-100 scale
    const goalScore = metrics.goals.completionRate;
    const attendanceScore = metrics.attendance.attendanceRate;
    const taskScore = metrics.tasks.completionRate;

    metrics.overallScore = Math.round(
        (reviewScore * 0.3) +
        (goalScore * 0.3) +
        (attendanceScore * 0.2) +
        (taskScore * 0.2)
    );

    return sendSuccess(res, { metrics }, 'Performance metrics retrieved successfully');
});

/**
 * Get team performance metrics
 */
export const getTeamPerformanceMetrics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { department, startDate, endDate } = req.query;

    if (!req.user?._id) {
        return sendError(res, 'Admin access required', 403);
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const employeeQuery = addOrganizationFilter(req, {});
    if (department) {
        employeeQuery.department = department;
    }

    const employees = await Employee.find(employeeQuery).select('_id name lastName email department');

    const teamMetrics = await Promise.all(employees.map(async (employee) => {
        // Get reviews
        const reviews = await PerformanceReview.find({
            organizationId,
            employeeId: employee._id,
            'reviewPeriod.endDate': { $gte: start, $lte: end },
            status: 'Completed'
        });

        // Get goals
        const goals = await Goal.find({
            organizationId,
            employeeId: employee._id,
            startDate: { $lte: end },
            endDate: { $gte: start }
        });

        // Get tasks
        const tasks = await Task.find({
            organizationId,
            assignedTo: employee._id,
            createdAt: { $gte: start, $lte: end }
        });

        const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + (r.managerEvaluation?.overallRating || 0), 0) / reviews.length
            : 0;

        const goalCompletion = goals.length > 0
            ? Math.round((goals.filter(g => g.status === 'Completed').length / goals.length) * 100)
            : 0;

        const taskCompletion = tasks.length > 0
            ? Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100)
            : 0;

        const overallScore = Math.round(
            (avgRating * 20 * 0.3) +
            (goalCompletion * 0.3) +
            (taskCompletion * 0.4)
        );

        return {
            employee: {
                id: employee._id,
                name: `${employee.name} ${employee.lastName || ''}`,
                email: employee.email,
                department: employee.department
            },
            metrics: {
                averageRating: avgRating,
                goalCompletionRate: goalCompletion,
                taskCompletionRate: taskCompletion,
                overallScore
            }
        };
    }));

    // Calculate team averages
    const teamAverage = {
        averageRating: teamMetrics.length > 0
            ? teamMetrics.reduce((sum, m) => sum + m.metrics.averageRating, 0) / teamMetrics.length
            : 0,
        averageGoalCompletion: teamMetrics.length > 0
            ? Math.round(teamMetrics.reduce((sum, m) => sum + m.metrics.goalCompletionRate, 0) / teamMetrics.length)
            : 0,
        averageTaskCompletion: teamMetrics.length > 0
            ? Math.round(teamMetrics.reduce((sum, m) => sum + m.metrics.taskCompletionRate, 0) / teamMetrics.length)
            : 0,
        averageOverallScore: teamMetrics.length > 0
            ? Math.round(teamMetrics.reduce((sum, m) => sum + m.metrics.overallScore, 0) / teamMetrics.length)
            : 0
    };

    return sendSuccess(res, {
        teamMetrics,
        teamAverage,
        period: { startDate: start, endDate: end },
        department: department || 'All'
    }, 'Team performance metrics retrieved successfully');
});

/**
 * Get performance trends
 */
export const getPerformanceTrends = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, period = 'year' } = req.query;
    const targetEmployeeId = employeeId || req.employee?._id;

    if (!targetEmployeeId) {
        return sendError(res, 'Employee ID is required', 400);
    }

    // Check access permissions
    if (req.employee?._id && targetEmployeeId.toString() !== req.employee._id.toString()) {
        return sendError(res, 'You can only view your own performance trends', 403);
    }

    let startDate, endDate;
    const now = new Date();

    switch (period) {
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
            break;
        case 'year':
        default:
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
    }

    // Get reviews over time
    const reviews = await PerformanceReview.find({
        organizationId,
        employeeId: targetEmployeeId,
        'reviewPeriod.endDate': { $gte: startDate, $lte: endDate }
    }).sort({ 'reviewPeriod.endDate': 1 });

    // Get goals over time
    const goals = await Goal.find({
        organizationId,
        employeeId: targetEmployeeId,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
    }).sort({ startDate: 1 });

    const trends = {
        reviews: reviews.map(r => ({
            date: r.reviewPeriod.endDate,
            rating: r.managerEvaluation?.overallRating || 0,
            type: r.reviewType
        })),
        goals: goals.map(g => ({
            date: g.startDate,
            progress: g.progress,
            status: g.status,
            title: g.title
        })),
        period: {
            startDate,
            endDate,
            type: period
        }
    };

    return sendSuccess(res, { trends }, 'Performance trends retrieved successfully');
});

/**
 * Get performance dashboard data
 */
export const getPerformanceDashboard = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId } = req.query;
    const targetEmployeeId = employeeId || req.employee?._id;

    if (!targetEmployeeId) {
        return sendError(res, 'Employee ID is required', 400);
    }

    // Check access permissions
    if (req.employee?._id && targetEmployeeId.toString() !== req.employee._id.toString()) {
        return sendError(res, 'You can only view your own performance dashboard', 403);
    }

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Get current year metrics
    const metrics = await getEmployeePerformanceMetrics({
        query: {
            employeeId: targetEmployeeId,
            startDate: yearStart.toISOString(),
            endDate: now.toISOString()
        },
        employee: req.employee,
        user: req.user
    }, {
        json: (data) => data
    });

    // Get recent reviews
    const recentReviews = await PerformanceReview.find({
        organizationId,
        employeeId: targetEmployeeId
    })
        .sort({ 'reviewPeriod.endDate': -1 })
        .limit(5)
        .populate('managerEvaluation.managerId', 'name email');

    // Get active goals
    const activeGoals = await Goal.find({
        organizationId,
        employeeId: targetEmployeeId,
        status: { $in: ['Not Started', 'In Progress'] }
    })
        .sort({ endDate: 1 })
        .limit(5);

    // Get upcoming milestones
    const upcomingMilestones = [];
    activeGoals.forEach(goal => {
        goal.milestones.forEach(milestone => {
            if (milestone.status === 'Pending' && milestone.targetDate) {
                upcomingMilestones.push({
                    goalId: goal._id,
                    goalTitle: goal.title,
                    milestone: milestone
                });
            }
        });
    });

    upcomingMilestones.sort((a, b) => new Date(a.milestone.targetDate) - new Date(b.milestone.targetDate));

    const dashboard = {
        metrics: metrics.body?.data?.metrics || {},
        recentReviews: recentReviews,
        activeGoals: activeGoals,
        upcomingMilestones: upcomingMilestones.slice(0, 5),
        lastUpdated: new Date()
    };

    return sendSuccess(res, { dashboard }, 'Performance dashboard retrieved successfully');
});

