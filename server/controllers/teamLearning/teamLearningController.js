import { TeamLearning, LearningProgress } from '../../models/teamLearning.model.js';
import { shouldScopeDataToManagedTeam } from '../../helpers/permissionService.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { getManagerEmployeeIds } from '../../helpers/managerHelper.js';
import { sendNotificationToUsers } from '../../helpers/notificationService.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError } from '../../helpers/responseHelper.js';
import { parsePagination, sendPaginatedResponse } from '../../helpers/paginationHelper.js';

/**
 * Create team learning resource
 * POST /api/v1/both/team-learning
 */
export const createTeamLearning = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const managerId = req.employee?._id || req.user?._id;

    if (!managerId) {
        return sendError(res, 'Manager ID is required', 400, 'MISSING_MANAGER_ID');
    }

    const { title, description, category, resourceType, resources, assignedTo, tags, priority, dueDate } = req.body;

    if (!title || !description || !resourceType) {
        return sendValidationError(res, { message: 'Title, description, and resource type are required' });
    }

    // If assignedTo is empty, get all team members
    let assignedEmployees = assignedTo || [];
    if (assignedEmployees.length === 0 && req.employee?.isManager) {
        assignedEmployees = await getManagerEmployeeIds(Employee, organizationId, req.employee);
    }

    const teamLearning = new TeamLearning({
        organizationId,
        managerId,
        title,
        description,
        category: category || 'Other',
        resourceType,
        resources: resources || [],
        assignedTo: assignedEmployees,
        tags: tags || [],
        priority: priority || 'Medium',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: 'Published'
    });

    await teamLearning.save();

    // Send notifications to assigned employees
    if (assignedEmployees.length > 0) {
        try {
            const manager = await Employee.findById(managerId).select('name lastName').lean();
            const managerName = manager ? `${manager.name} ${manager.lastName || ''}`.trim() : 'Your Manager';
            
            const message = `${managerName} has shared a new learning resource: ${title}`;
            
            await sendNotificationToUsers(
                assignedEmployees,
                req.employee || req.user,
                message,
                'general',
                {
                    learningId: teamLearning._id,
                    type: 'team_learning',
                    title: title
                }
            );

            logger.info('Team learning notifications sent', {
                learningId: teamLearning._id,
                recipientCount: assignedEmployees.length
            });
        } catch (notificationError) {
            logger.error('Error sending team learning notifications', {
                error: notificationError.message,
                learningId: teamLearning._id
            });
            // Don't fail the request if notification fails
        }
    }

    return sendSuccess(res, { learning: teamLearning }, 'Team learning resource created successfully', 201);
});

/**
 * Get team learning resources
 * GET /api/v1/both/team-learning
 */
export const getTeamLearning = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.user?._id;
    const { status, category, managerId } = req.query;

    let query = addOrganizationFilter(req, {});

    // If user is a manager, show resources they created or assigned to their team
    if (shouldScopeDataToManagedTeam(req)) {
        const managerEmployeeIds = await getManagerEmployeeIds(Employee, organizationId, req.employee);
        
        query.$or = [
            { managerId: req.employee._id }, // Resources created by this manager
            { assignedTo: { $in: managerEmployeeIds } } // Resources assigned to their team
        ];
    } else if (employeeId) {
        // Regular employees see resources assigned to them
        query.assignedTo = { $in: [employeeId] };
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (managerId) query.managerId = managerId;

    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

    const [learnings, total] = await Promise.all([
        TeamLearning.find(query)
            .populate('managerId', 'name lastName email')
            .populate('assignedTo', 'name lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        TeamLearning.countDocuments(query)
    ]);

    // Get progress for each learning if employee is viewing
    if (employeeId) {
        const learningIds = learnings.map(l => l._id);
        const progressRecords = await LearningProgress.find({
            organizationId,
            employeeId,
            learningId: { $in: learningIds }
        }).lean();

        const progressMap = {};
        progressRecords.forEach(progress => {
            progressMap[progress.learningId.toString()] = progress;
        });

        learnings.forEach(learning => {
            const progressRecord = progressMap[learning._id.toString()] || null;
            learning.progressRecord = progressRecord;
            learning.progress = progressRecord?.progress ?? 0;
            learning.progressStatus = progressRecord?.status || 'Not Started';
        });
    }

    return sendPaginatedResponse(res, learnings, page, limit, total, 'Team learning resources retrieved successfully');
});

/**
 * Get single team learning resource
 * GET /api/v1/both/team-learning/:id
 */
export const getTeamLearningById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const employeeId = req.employee?._id || req.user?._id;

    const learning = await TeamLearning.findOne({
        _id: id,
        organizationId
    })
        .populate('managerId', 'name lastName email')
        .populate('assignedTo', 'name lastName email')
        .lean();

    if (!learning) {
        return sendNotFound(res, 'Team learning resource');
    }

    // Check access - employee must be assigned or manager must be creator
    if (employeeId) {
        const isAssigned = learning.assignedTo.some(emp => 
            (emp._id || emp).toString() === employeeId.toString()
        );
        const isManager = learning.managerId._id.toString() === employeeId.toString();

        if (!isAssigned && !isManager && !req.user) {
            return sendError(res, 'You do not have access to this learning resource', 403, 'ACCESS_DENIED');
        }
    }

    // Get progress if employee is viewing
    if (employeeId) {
        const progress = await LearningProgress.findOne({
            organizationId,
            employeeId,
            learningId: id
        }).lean();

        learning.progressRecord = progress || null;
        learning.progress = progress?.progress ?? 0;
        learning.progressStatus = progress?.status || 'Not Started';
    }

    return sendSuccess(res, { learning }, 'Team learning resource retrieved successfully');
});

/**
 * Update team learning resource
 * PUT /api/v1/both/team-learning/:id
 */
export const updateTeamLearning = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const managerId = req.employee?._id || req.user?._id;

    const learning = await TeamLearning.findOne({
        _id: id,
        organizationId,
        managerId // Only creator can update
    });

    if (!learning) {
        return sendNotFound(res, 'Team learning resource');
    }

    Object.assign(learning, req.body);
    learning.updatedAt = new Date();
    await learning.save();

    return sendSuccess(res, { learning }, 'Team learning resource updated successfully');
});

/**
 * Delete team learning resource
 * DELETE /api/v1/both/team-learning/:id
 */
export const deleteTeamLearning = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const managerId = req.employee?._id || req.user?._id;

    const learning = await TeamLearning.findOneAndDelete({
        _id: id,
        organizationId,
        managerId // Only creator can delete
    });

    if (!learning) {
        return sendNotFound(res, 'Team learning resource');
    }

    // Delete associated progress records
    await LearningProgress.deleteMany({ learningId: id, organizationId });

    return sendSuccess(res, null, 'Team learning resource deleted successfully');
});

/**
 * Update learning progress
 * POST /api/v1/both/team-learning/:id/progress
 */
export const updateLearningProgress = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const employeeId = req.employee?._id || req.user?._id;
    const { status, progress, completedResources, notes } = req.body;

    if (!employeeId) {
        return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
    }

    // Check if learning exists and employee has access
    const learning = await TeamLearning.findOne({
        _id: id,
        organizationId
    }).lean();

    if (!learning) {
        return sendNotFound(res, 'Team learning resource');
    }

    const isAssigned = learning.assignedTo.some(emp => 
        (emp._id || emp).toString() === employeeId.toString()
    );

    if (!isAssigned && !req.user) {
        return sendError(res, 'You do not have access to this learning resource', 403, 'ACCESS_DENIED');
    }

    // Update or create progress
    const progressData = {
        organizationId,
        learningId: id,
        employeeId,
        status: status || 'In Progress',
        progress: progress || 0,
        completedResources: completedResources || [],
        notes: notes || undefined
    };

    if (status === 'Not Started' && !progressData.startedAt) {
        progressData.startedAt = new Date();
    }

    if (status === 'Completed') {
        progressData.completedAt = new Date();
        progressData.progress = 100;
    }

    const learningProgress = await LearningProgress.findOneAndUpdate(
        { organizationId, learningId: id, employeeId },
        progressData,
        { upsert: true, new: true, runValidators: true }
    );

    return sendSuccess(res, { progress: learningProgress }, 'Learning progress updated successfully');
});

