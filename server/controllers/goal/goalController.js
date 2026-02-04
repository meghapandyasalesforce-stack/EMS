/**
 * Goal Management Controller
 * Handles CRUD operations for employee goals
 */

import Goal from '../../models/goal.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError } from '../../helpers/responseHelper.js';

/**
 * Create a new goal
 */
export const createGoal = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.body.employeeId;

    if (!employeeId) {
        return sendError(res, 'Employee ID is required', 400);
    }

    // Verify employee belongs to organization
    const employee = await Employee.findOne({
        _id: employeeId,
        organizationId
    });

    if (!employee) {
        return sendError(res, 'Employee not found or does not belong to organization', 404);
    }

    const {
        title,
        description,
        goalType,
        objective,
        keyResults,
        startDate,
        endDate,
        priority,
        parentGoalId,
        alignedWith,
        milestones,
        tags,
        category,
        isPrivate,
        sharedWith
    } = req.body;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
        return sendValidationError(res, { endDate: 'End date must be after start date' });
    }

    const goal = new Goal({
        organizationId,
        employeeId,
        title,
        description,
        goalType: goalType || 'KPI',
        objective,
        keyResults: keyResults || [],
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        priority: priority || 'Medium',
        parentGoalId: parentGoalId || null,
        alignedWith: alignedWith || [],
        milestones: milestones || [],
        tags: tags || [],
        category,
        isPrivate: isPrivate || false,
        sharedWith: sharedWith || [],
        status: 'Not Started',
        progress: 0
    });

    await goal.save();

    return sendSuccess(res, { goal }, 'Goal created successfully', 201);
});

/**
 * Get all goals
 */
export const getGoals = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        employeeId,
        status,
        goalType,
        priority,
        startDate,
        endDate,
        page = 1,
        limit = 20
    } = req.query;

    const query = addOrganizationFilter(req, {});

    // Employee can only see their own goals (unless shared)
    if (req.employee?._id) {
        query.$or = [
            { employeeId: req.employee._id },
            { isPrivate: false },
            { sharedWith: req.employee._id }
        ];
    } else if (employeeId) {
        query.employeeId = employeeId;
    }

    if (status) {
        query.status = status;
    }

    if (goalType) {
        query.goalType = goalType;
    }

    if (priority) {
        query.priority = priority;
    }

    if (startDate || endDate) {
        query.$or = [
            {
                startDate: {
                    $gte: startDate ? new Date(startDate) : new Date(0),
                    $lte: endDate ? new Date(endDate) : new Date()
                }
            },
            {
                endDate: {
                    $gte: startDate ? new Date(startDate) : new Date(0),
                    $lte: endDate ? new Date(endDate) : new Date()
                }
            }
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const goals = await Goal.find(query)
        .populate('employeeId', 'name lastName email employeeId department')
        .populate('parentGoalId', 'title')
        .populate('alignedWith.goalId', 'title')
        .populate('sharedWith', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Goal.countDocuments(query);

    return sendSuccess(res, {
        goals,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    }, 'Goals retrieved successfully');
});

/**
 * Get goal by ID
 */
export const getGoalById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const query = addOrganizationFilter(req, { _id: id });

    // Check access permissions
    if (req.employee?._id) {
        query.$or = [
            { employeeId: req.employee._id },
            { isPrivate: false },
            { sharedWith: req.employee._id }
        ];
    }

    const goal = await Goal.findOne(query)
        .populate('employeeId', 'name lastName email employeeId department')
        .populate('parentGoalId', 'title description')
        .populate('alignedWith.goalId', 'title description')
        .populate('sharedWith', 'name email')
        .populate('reviews.reviewedBy', 'name email');

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    return sendSuccess(res, { goal }, 'Goal retrieved successfully');
});

/**
 * Update goal
 */
export const updateGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    // Employee can only update their own goals
    if (employeeId && goal.employeeId.toString() !== employeeId.toString()) {
        return sendError(res, 'You can only update your own goals', 403);
    }

    const allowedFields = [
        'title', 'description', 'goalType', 'objective', 'keyResults',
        'startDate', 'endDate', 'priority', 'status', 'progress',
        'parentGoalId', 'alignedWith', 'milestones', 'tags', 'category',
        'isPrivate', 'sharedWith'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            if (field === 'startDate' || field === 'endDate') {
                goal[field] = new Date(req.body[field]);
            } else {
                goal[field] = req.body[field];
            }
        }
    });

    // Validate dates
    if (goal.startDate >= goal.endDate) {
        return sendValidationError(res, { endDate: 'End date must be after start date' });
    }

    // Auto-calculate progress from key results if not provided
    if (req.body.keyResults && !req.body.progress) {
        const totalKeyResults = goal.keyResults.length;
        if (totalKeyResults > 0) {
            const completedKeyResults = goal.keyResults.filter(kr => kr.status === 'Completed').length;
            goal.progress = Math.round((completedKeyResults / totalKeyResults) * 100);
        }
    }

    await goal.save();

    return sendSuccess(res, { goal }, 'Goal updated successfully');
});

/**
 * Delete goal
 */
export const deleteGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    // Employee can only delete their own goals
    if (employeeId && goal.employeeId.toString() !== employeeId.toString()) {
        return sendError(res, 'You can only delete your own goals', 403);
    }

    await Goal.findByIdAndDelete(id);

    return sendSuccess(res, null, 'Goal deleted successfully');
});

/**
 * Update goal progress
 */
export const updateGoalProgress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { progress, keyResultIndex, keyResultProgress } = req.body;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    // Employee can only update their own goals
    if (employeeId && goal.employeeId.toString() !== employeeId.toString()) {
        return sendError(res, 'You can only update your own goals', 403);
    }

    // Update specific key result progress
    if (keyResultIndex !== undefined && keyResultProgress !== undefined) {
        if (goal.keyResults[keyResultIndex]) {
            goal.keyResults[keyResultIndex].current = keyResultProgress;
            
            // Auto-update key result status
            const keyResult = goal.keyResults[keyResultIndex];
            if (keyResultProgress >= keyResult.target) {
                keyResult.status = 'Completed';
            } else if (keyResultProgress > 0) {
                keyResult.status = 'In Progress';
            } else {
                keyResult.status = 'Not Started';
            }

            // Recalculate overall progress
            const totalKeyResults = goal.keyResults.length;
            if (totalKeyResults > 0) {
                const completedKeyResults = goal.keyResults.filter(kr => kr.status === 'Completed').length;
                goal.progress = Math.round((completedKeyResults / totalKeyResults) * 100);
            }
        }
    } else if (progress !== undefined) {
        // Update overall progress
        goal.progress = Math.max(0, Math.min(100, parseInt(progress)));
    }

    // Update goal status based on progress
    if (goal.progress === 100) {
        goal.status = 'Completed';
    } else if (goal.progress > 0) {
        goal.status = 'In Progress';
    }

    await goal.save();

    return sendSuccess(res, { goal }, 'Goal progress updated successfully');
});

/**
 * Add milestone to goal
 */
export const addMilestone = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, targetDate } = req.body;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    if (employeeId && goal.employeeId.toString() !== employeeId.toString()) {
        return sendError(res, 'You can only update your own goals', 403);
    }

    goal.milestones.push({
        title,
        targetDate: targetDate ? new Date(targetDate) : null,
        status: 'Pending'
    });

    await goal.save();

    return sendSuccess(res, { goal }, 'Milestone added successfully');
});

/**
 * Update milestone
 */
export const updateMilestone = asyncHandler(async (req, res) => {
    const { id, milestoneIndex } = req.params;
    const { title, targetDate, status, completedDate } = req.body;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    if (employeeId && goal.employeeId.toString() !== employeeId.toString()) {
        return sendError(res, 'You can only update your own goals', 403);
    }

    const milestone = goal.milestones[milestoneIndex];
    if (!milestone) {
        return sendError(res, 'Milestone not found', 404);
    }

    if (title !== undefined) milestone.title = title;
    if (targetDate !== undefined) milestone.targetDate = new Date(targetDate);
    if (status !== undefined) milestone.status = status;
    if (completedDate !== undefined) milestone.completedDate = new Date(completedDate);

    await goal.save();

    return sendSuccess(res, { goal }, 'Milestone updated successfully');
});

/**
 * Add review to goal
 */
export const addGoalReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments, progress } = req.body;
    const organizationId = getOrganizationId(req);
    const reviewerId = req.employee?._id || req.user?._id;

    if (!reviewerId) {
        return sendError(res, 'Reviewer authentication required', 401);
    }

    const query = addOrganizationFilter(req, { _id: id });
    const goal = await Goal.findOne(query);

    if (!goal) {
        return sendNotFound(res, 'Goal');
    }

    goal.reviews.push({
        reviewDate: new Date(),
        reviewedBy: reviewerId,
        comments: comments || '',
        progress: progress !== undefined ? progress : goal.progress
    });

    await goal.save();

    return sendSuccess(res, { goal }, 'Goal review added successfully');
});

/**
 * Get goal statistics
 */
export const getGoalStatistics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, startDate, endDate } = req.query;

    const query = addOrganizationFilter(req, {});

    if (employeeId) {
        query.employeeId = employeeId;
    } else if (req.employee?._id) {
        query.employeeId = req.employee._id;
    }

    if (startDate || endDate) {
        query.startDate = {
            $gte: startDate ? new Date(startDate) : new Date(0),
            $lte: endDate ? new Date(endDate) : new Date()
        };
    }

    const goals = await Goal.find(query);

    const statistics = {
        total: goals.length,
        byStatus: {
            'Not Started': goals.filter(g => g.status === 'Not Started').length,
            'In Progress': goals.filter(g => g.status === 'In Progress').length,
            'Completed': goals.filter(g => g.status === 'Completed').length,
            'Cancelled': goals.filter(g => g.status === 'Cancelled').length,
            'On Hold': goals.filter(g => g.status === 'On Hold').length
        },
        byType: {},
        byPriority: {},
        averageProgress: goals.length > 0
            ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
            : 0,
        completionRate: goals.length > 0
            ? Math.round((goals.filter(g => g.status === 'Completed').length / goals.length) * 100)
            : 0
    };

    goals.forEach(goal => {
        statistics.byType[goal.goalType] = (statistics.byType[goal.goalType] || 0) + 1;
        statistics.byPriority[goal.priority] = (statistics.byPriority[goal.priority] || 0) + 1;
    });

    return sendSuccess(res, { statistics }, 'Goal statistics retrieved successfully');
});

