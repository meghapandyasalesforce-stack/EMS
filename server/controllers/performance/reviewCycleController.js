/**
 * Review Cycle Management Controller
 * Handles review cycle creation, management, and automation
 */

import ReviewCycle from '../../models/reviewCycle.model.js';
import PerformanceReview from '../../models/performanceReview.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError } from '../../helpers/responseHelper.js';
import { sendNotification } from '../../helpers/notificationService.js';

/**
 * Create a new review cycle
 */
export const createReviewCycle = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const userId = req.user?._id;

    if (!userId) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const {
        name,
        description,
        cycleType,
        startDate,
        endDate,
        reviewType,
        autoCreate,
        reminders,
        assignedEmployees,
        isTemplate,
        templateName,
        recurring
    } = req.body;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
        return sendValidationError(res, { endDate: 'End date must be after start date' });
    }

    const cycle = new ReviewCycle({
        organizationId,
        name,
        description,
        cycleType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reviewType: reviewType || 'Manager Review',
        status: 'Draft',
        autoCreate: autoCreate || { enabled: false },
        reminders: reminders || {
            enabled: true,
            daysBeforeStart: 7,
            daysBeforeEnd: 7,
            daysAfterEnd: 3
        },
        assignedEmployees: assignedEmployees || [],
        isTemplate: isTemplate || false,
        templateName: templateName || null,
        recurring: recurring || { enabled: false },
        createdBy: userId,
        statistics: {
            totalEmployees: 0,
            reviewsCreated: 0,
            reviewsCompleted: 0,
            completionRate: 0
        }
    });

    await cycle.save();

    return sendSuccess(res, { cycle }, 'Review cycle created successfully', 201);
});

/**
 * Get all review cycles
 */
export const getReviewCycles = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, cycleType, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (status) {
        query.status = status;
    }

    if (cycleType) {
        query.cycleType = cycleType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const cycles = await ReviewCycle.find(query)
        .populate('createdBy', 'name email')
        .populate('assignedEmployees.employeeId', 'name lastName email')
        .populate('assignedEmployees.reviewId')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await ReviewCycle.countDocuments(query);

    return sendSuccess(res, {
        cycles,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    }, 'Review cycles retrieved successfully');
});

/**
 * Get review cycle by ID
 */
export const getReviewCycleById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const query = addOrganizationFilter(req, { _id: id });

    const cycle = await ReviewCycle.findOne(query)
        .populate('createdBy', 'name email')
        .populate('assignedEmployees.employeeId', 'name lastName email employeeId department')
        .populate('assignedEmployees.reviewId')
        .populate('autoCreate.employeeFilter.roles', 'name');

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    return sendSuccess(res, { cycle }, 'Review cycle retrieved successfully');
});

/**
 * Update review cycle
 */
export const updateReviewCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    if (!req.user?._id) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query);

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    // Can't update completed or archived cycles
    if (cycle.status === 'Completed' || cycle.status === 'Archived') {
        return sendError(res, 'Cannot update completed or archived cycles', 400);
    }

    const allowedFields = [
        'name', 'description', 'cycleType', 'startDate', 'endDate',
        'reviewType', 'autoCreate', 'reminders', 'recurring', 'isTemplate', 'templateName'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            if (field === 'startDate' || field === 'endDate') {
                cycle[field] = new Date(req.body[field]);
            } else {
                cycle[field] = req.body[field];
            }
        }
    });

    // Validate dates
    if (cycle.startDate >= cycle.endDate) {
        return sendValidationError(res, { endDate: 'End date must be after start date' });
    }

    await cycle.save();

    return sendSuccess(res, { cycle }, 'Review cycle updated successfully');
});

/**
 * Activate review cycle
 */
export const activateReviewCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    if (!req.user?._id) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query);

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    if (cycle.status !== 'Draft') {
        return sendError(res, 'Only draft cycles can be activated', 400);
    }

    cycle.status = 'Active';

    // Auto-create reviews if enabled
    if (cycle.autoCreate.enabled) {
        await autoCreateReviews(cycle);
    }

    await cycle.save();

    return sendSuccess(res, { cycle }, 'Review cycle activated successfully');
});

/**
 * Auto-create reviews for cycle
 */
const autoCreateReviews = async (cycle) => {
    try {
        let employees = [];

        if (cycle.autoCreate.employeeFilter.includeAll) {
            // Get all active employees
            employees = await Employee.find({
                organizationId: cycle.organizationId,
                status: 'active'
            });
        } else {
            // Filter by department and role
            const filter = {
                organizationId: cycle.organizationId,
                status: 'active'
            };

            if (cycle.autoCreate.employeeFilter.departments?.length > 0) {
                filter.department = { $in: cycle.autoCreate.employeeFilter.departments };
            }

            if (cycle.autoCreate.employeeFilter.roles?.length > 0) {
                filter.assignedRole = { $in: cycle.autoCreate.employeeFilter.roles };
            }

            employees = await Employee.find(filter);
        }

        const assignedEmployees = [];

        for (const employee of employees) {
            // Create performance review
            const review = new PerformanceReview({
                organizationId: cycle.organizationId,
                employeeId: employee._id,
                reviewPeriod: {
                    startDate: cycle.startDate,
                    endDate: cycle.endDate,
                    type: cycle.cycleType
                },
                reviewType: cycle.reviewType,
                status: 'Draft'
            });

            await review.save();

            assignedEmployees.push({
                employeeId: employee._id,
                reviewId: review._id,
                status: 'Pending',
                assignedAt: new Date()
            });

            // Send notification
            try {
                await sendNotification({
                    userId: employee._id,
                    title: 'Performance Review Assigned',
                    message: `A new ${cycle.cycleType} performance review has been assigned to you. Review period: ${cycle.startDate.toLocaleDateString()} - ${cycle.endDate.toLocaleDateString()}`,
                    type: 'performance_review',
                    priority: 'medium',
                    metadata: {
                        cycleId: cycle._id,
                        reviewId: review._id,
                        cycleName: cycle.name
                    },
                    organizationId: cycle.organizationId
                });
            } catch (notifError) {
                logger.warn('Error sending review notification', {
                    error: notifError.message,
                    employeeId: employee._id
                });
            }
        }

        cycle.assignedEmployees = assignedEmployees;
        cycle.statistics.totalEmployees = employees.length;
        cycle.statistics.reviewsCreated = employees.length;

        logger.info('Auto-created reviews for cycle', {
            cycleId: cycle._id,
            reviewsCreated: employees.length
        });
    } catch (error) {
        logger.error('Error auto-creating reviews', {
            error: error.message,
            cycleId: cycle._id
        });
        throw error;
    }
};

/**
 * Assign employee to cycle
 */
export const assignEmployeeToCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { employeeId } = req.body;
    const organizationId = getOrganizationId(req);

    if (!req.user?._id) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query);

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    // Verify employee exists
    const employee = await Employee.findOne({
        _id: employeeId,
        organizationId
    });

    if (!employee) {
        return sendError(res, 'Employee not found', 404);
    }

    // Check if already assigned
    const existing = cycle.assignedEmployees.find(
        a => a.employeeId.toString() === employeeId.toString()
    );

    if (existing) {
        return sendError(res, 'Employee already assigned to this cycle', 400);
    }

    // Create performance review
    const review = new PerformanceReview({
        organizationId: cycle.organizationId,
        employeeId: employee._id,
        reviewPeriod: {
            startDate: cycle.startDate,
            endDate: cycle.endDate,
            type: cycle.cycleType
        },
        reviewType: cycle.reviewType,
        status: 'Draft'
    });

    await review.save();

    // Add to assigned employees
    cycle.assignedEmployees.push({
        employeeId: employee._id,
        reviewId: review._id,
        status: 'Pending',
        assignedAt: new Date()
    });

    cycle.statistics.totalEmployees = cycle.assignedEmployees.length;
    cycle.statistics.reviewsCreated = cycle.assignedEmployees.length;

    await cycle.save();

    return sendSuccess(res, { cycle }, 'Employee assigned to cycle successfully');
});

/**
 * Complete review cycle
 */
export const completeReviewCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    if (!req.user?._id) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query);

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    if (cycle.status === 'Completed' || cycle.status === 'Archived') {
        return sendError(res, 'Cycle is already completed or archived', 400);
    }

    // Count completed reviews
    const completedReviews = await PerformanceReview.countDocuments({
        organizationId: cycle.organizationId,
        _id: { $in: cycle.assignedEmployees.map(a => a.reviewId).filter(Boolean) },
        status: 'Completed'
    });

    cycle.status = 'Completed';
    cycle.statistics.reviewsCompleted = completedReviews;
    cycle.statistics.completionRate = cycle.statistics.totalEmployees > 0
        ? Math.round((completedReviews / cycle.statistics.totalEmployees) * 100)
        : 0;

    await cycle.save();

    // Create next cycle if recurring is enabled
    if (cycle.recurring.enabled && cycle.recurring.nextCycleDate) {
        await createNextCycle(cycle);
    }

    return sendSuccess(res, { cycle }, 'Review cycle completed successfully');
});

/**
 * Create next cycle from recurring cycle
 */
const createNextCycle = async (previousCycle) => {
    try {
        const nextStartDate = new Date(previousCycle.recurring.nextCycleDate);
        let nextEndDate;

        switch (previousCycle.recurring.frequency) {
            case 'Quarterly':
                nextEndDate = new Date(nextStartDate);
                nextEndDate.setMonth(nextEndDate.getMonth() + 3);
                break;
            case 'Semi-Annual':
                nextEndDate = new Date(nextStartDate);
                nextEndDate.setMonth(nextEndDate.getMonth() + 6);
                break;
            case 'Annual':
                nextEndDate = new Date(nextStartDate);
                nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
                break;
            default:
                return;
        }

        const nextCycle = new ReviewCycle({
            organizationId: previousCycle.organizationId,
            name: `${previousCycle.name} - ${nextStartDate.getFullYear()}`,
            description: previousCycle.description,
            cycleType: previousCycle.cycleType,
            startDate: nextStartDate,
            endDate: nextEndDate,
            reviewType: previousCycle.reviewType,
            status: 'Draft',
            autoCreate: previousCycle.autoCreate,
            reminders: previousCycle.reminders,
            isTemplate: false,
            recurring: previousCycle.recurring,
            createdBy: previousCycle.createdBy,
            statistics: {
                totalEmployees: 0,
                reviewsCreated: 0,
                reviewsCompleted: 0,
                completionRate: 0
            }
        });

        await nextCycle.save();

        logger.info('Created next recurring cycle', {
            previousCycleId: previousCycle._id,
            nextCycleId: nextCycle._id
        });
    } catch (error) {
        logger.error('Error creating next cycle', {
            error: error.message,
            cycleId: previousCycle._id
        });
    }
};

/**
 * Get cycle statistics
 */
export const getCycleStatistics = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query)
        .populate('assignedEmployees.employeeId', 'name email department')
        .populate('assignedEmployees.reviewId');

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    // Get detailed review statistics
    const reviews = await PerformanceReview.find({
        _id: { $in: cycle.assignedEmployees.map(a => a.reviewId).filter(Boolean) }
    });

    const statistics = {
        cycle: {
            id: cycle._id,
            name: cycle.name,
            status: cycle.status,
            startDate: cycle.startDate,
            endDate: cycle.endDate
        },
        overview: cycle.statistics,
        byStatus: {
            pending: cycle.assignedEmployees.filter(a => a.status === 'Pending').length,
            inProgress: cycle.assignedEmployees.filter(a => a.status === 'In Progress').length,
            completed: cycle.assignedEmployees.filter(a => a.status === 'Completed').length,
            overdue: cycle.assignedEmployees.filter(a => a.status === 'Overdue').length
        },
        byDepartment: {},
        averageRating: reviews.length > 0
            ? reviews.reduce((sum, r) => sum + (r.managerEvaluation?.overallRating || 0), 0) / reviews.length
            : 0
    };

    // Calculate by department
    cycle.assignedEmployees.forEach(assignment => {
        const employee = assignment.employeeId;
        if (employee && employee.department) {
            if (!statistics.byDepartment[employee.department]) {
                statistics.byDepartment[employee.department] = {
                    total: 0,
                    completed: 0
                };
            }
            statistics.byDepartment[employee.department].total++;
            if (assignment.status === 'Completed') {
                statistics.byDepartment[employee.department].completed++;
            }
        }
    });

    return sendSuccess(res, { statistics }, 'Cycle statistics retrieved successfully');
});

/**
 * Delete review cycle
 */
export const deleteReviewCycle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    if (!req.user?._id) {
        return sendError(res, 'Admin authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const cycle = await ReviewCycle.findOne(query);

    if (!cycle) {
        return sendNotFound(res, 'Review cycle');
    }

    // Can't delete active or completed cycles
    if (cycle.status === 'Active' || cycle.status === 'In Progress') {
        return sendError(res, 'Cannot delete active or in-progress cycles', 400);
    }

    await ReviewCycle.findByIdAndDelete(id);

    return sendSuccess(res, null, 'Review cycle deleted successfully');
});

