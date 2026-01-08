import { OnboardingWorkflow, OffboardingWorkflow } from '../../models/onboarding.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create onboarding workflow
 */
export const createOnboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);

    const workflow = new OnboardingWorkflow({
        ...req.body,
        organizationId
    });

    await workflow.save();

    res.status(201).json({
        success: true,
        message: 'Onboarding workflow created successfully',
        data: workflow
    });
});

/**
 * Get onboarding workflows
 */
export const getOnboardingWorkflows = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, status, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const workflows = await OnboardingWorkflow.find(query)
        .populate('employeeId', 'name email employeeId department')
        .populate('assignedHR', 'name email')
        .populate('assignedBuddy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await OnboardingWorkflow.countDocuments(query);

    res.json({
        success: true,
        data: workflows,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Get single onboarding workflow
 */
export const getOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const workflow = await OnboardingWorkflow.findOne({
        _id: id,
        organizationId
    })
        .populate('employeeId', 'name email employeeId department')
        .populate('assignedHR', 'name email')
        .populate('assignedBuddy', 'name email');

    if (!workflow) {
        return res.status(404).json({
            success: false,
            message: 'Onboarding workflow not found'
        });
    }

    res.json({
        success: true,
        data: workflow
    });
});

/**
 * Get employee's own onboarding workflow
 */
export const getMyOnboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.user?._id;

    if (!employeeId) {
        return res.status(401).json({
            success: false,
            message: 'Employee ID not found'
        });
    }

    const workflow = await OnboardingWorkflow.findOne({
        employeeId,
        organizationId
    })
        .populate('employeeId', 'name email employeeId department')
        .populate('assignedHR', 'name email')
        .populate('assignedBuddy', 'name email')
        .sort({ createdAt: -1 });

    if (!workflow) {
        return res.status(404).json({
            success: false,
            message: 'No onboarding workflow found for this employee'
        });
    }

    res.json({
        success: true,
        data: workflow
    });
});

/**
 * Update onboarding workflow
 */
export const updateOnboardingWorkflow = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const workflow = await OnboardingWorkflow.findOne({
        _id: id,
        organizationId
    });

    if (!workflow) {
        return res.status(404).json({
            success: false,
            message: 'Onboarding workflow not found'
        });
    }

    // Update workflow fields
    Object.assign(workflow, req.body);

    // Recalculate progress if tasks were updated
    if (req.body.tasks) {
        const completedTasks = workflow.tasks.filter(t => t.status === 'Completed').length;
        workflow.progress = workflow.tasks.length > 0 
            ? Math.round((completedTasks / workflow.tasks.length) * 100) 
            : 0;

        if (workflow.progress === 100 && workflow.status !== 'Completed') {
            workflow.status = 'Completed';
            workflow.actualCompletionDate = new Date();
        } else if (workflow.progress < 100 && workflow.status === 'Completed') {
            workflow.status = 'In Progress';
        }
    }

    await workflow.save();

    const populatedWorkflow = await OnboardingWorkflow.findById(workflow._id)
        .populate('employeeId', 'name email employeeId department')
        .populate('assignedHR', 'name email')
        .populate('assignedBuddy', 'name email');

    res.json({
        success: true,
        message: 'Workflow updated successfully',
        data: populatedWorkflow
    });
});

/**
 * Update onboarding task
 */
export const updateOnboardingTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.params;
    const organizationId = getOrganizationId(req);

    const workflow = await OnboardingWorkflow.findOne({
        _id: id,
        organizationId
    });

    if (!workflow) {
        return res.status(404).json({
            success: false,
            message: 'Onboarding workflow not found'
        });
    }

    const task = workflow.tasks.id(taskId);
    if (!task) {
        return res.status(404).json({
            success: false,
            message: 'Task not found'
        });
    }

    Object.assign(task, req.body);
    if (req.body.status === 'Completed' && !task.completedDate) {
        task.completedDate = new Date();
    }

    // Calculate progress
    const completedTasks = workflow.tasks.filter(t => t.status === 'Completed').length;
    workflow.progress = workflow.tasks.length > 0 
        ? Math.round((completedTasks / workflow.tasks.length) * 100) 
        : 0;

    if (workflow.progress === 100 && workflow.status !== 'Completed') {
        workflow.status = 'Completed';
        workflow.actualCompletionDate = new Date();
    } else if (workflow.progress < 100 && workflow.status === 'Completed') {
        workflow.status = 'In Progress';
    }

    await workflow.save();

    const populatedWorkflow = await OnboardingWorkflow.findById(workflow._id)
        .populate('employeeId', 'name email employeeId department')
        .populate('assignedHR', 'name email')
        .populate('assignedBuddy', 'name email');

    res.json({
        success: true,
        message: 'Task updated successfully',
        data: populatedWorkflow
    });
});

/**
 * Create offboarding workflow
 */
export const createOffboardingWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const initiatedBy = req.user?._id || req.employee?._id;

    const workflow = new OffboardingWorkflow({
        ...req.body,
        organizationId,
        initiatedBy
    });

    await workflow.save();

    res.status(201).json({
        success: true,
        message: 'Offboarding workflow created successfully',
        data: workflow
    });
});

/**
 * Get offboarding workflows
 */
export const getOffboardingWorkflows = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { employeeId, status, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const workflows = await OffboardingWorkflow.find(query)
        .populate('employeeId', 'name email employeeId department')
        .populate('initiatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await OffboardingWorkflow.countDocuments(query);

    res.json({
        success: true,
        data: workflows,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Update offboarding task
 */
export const updateOffboardingTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.params;
    const organizationId = getOrganizationId(req);

    const workflow = await OffboardingWorkflow.findOne({
        _id: id,
        organizationId
    });

    if (!workflow) {
        return res.status(404).json({
            success: false,
            message: 'Offboarding workflow not found'
        });
    }

    const task = workflow.tasks.id(taskId);
    if (!task) {
        return res.status(404).json({
            success: false,
            message: 'Task not found'
        });
    }

    Object.assign(task, req.body);
    if (req.body.status === 'Completed' && !task.completedDate) {
        task.completedDate = new Date();
    }

    // Calculate progress
    const completedTasks = workflow.tasks.filter(t => t.status === 'Completed').length;
    workflow.progress = Math.round((completedTasks / workflow.tasks.length) * 100);

    if (workflow.progress === 100 && workflow.status !== 'Completed') {
        workflow.status = 'Completed';
    }

    await workflow.save();

    res.json({
        success: true,
        message: 'Task updated successfully',
        data: workflow
    });
});

/**
 * Get onboarding analytics
 */
export const getOnboardingAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.startDate = {};
        if (startDate) dateFilter.startDate.$gte = new Date(startDate);
        if (endDate) dateFilter.startDate.$lte = new Date(endDate);
    }

    const [totalWorkflows, completedWorkflows, inProgressWorkflows, avgCompletionTime, 
           workflowsByStatus, tasksByCategory] = await Promise.all([
        OnboardingWorkflow.countDocuments({ organizationId, isTemplate: { $ne: true }, ...dateFilter }),
        OnboardingWorkflow.countDocuments({ organizationId, status: 'Completed', isTemplate: { $ne: true }, ...dateFilter }),
        OnboardingWorkflow.countDocuments({ organizationId, status: 'In Progress', isTemplate: { $ne: true }, ...dateFilter }),
        OnboardingWorkflow.aggregate([
            { $match: { organizationId, status: 'Completed', actualCompletionDate: { $exists: true }, isTemplate: { $ne: true }, ...dateFilter } },
            {
                $project: {
                    daysToComplete: {
                        $divide: [
                            { $subtract: ['$actualCompletionDate', '$startDate'] },
                            86400000
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgDays: { $avg: '$daysToComplete' }
                }
            }
        ]),
        OnboardingWorkflow.aggregate([
            { $match: { organizationId, isTemplate: { $ne: true }, ...dateFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        OnboardingWorkflow.aggregate([
            { $match: { organizationId, isTemplate: { $ne: true }, ...dateFilter } },
            { $unwind: '$tasks' },
            { $group: { _id: '$tasks.category', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$tasks.status', 'Completed'] }, 1, 0] } } } }
        ])
    ]);

    const completionRate = totalWorkflows > 0 
        ? ((completedWorkflows / totalWorkflows) * 100).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            totalWorkflows,
            completedWorkflows,
            inProgressWorkflows,
            completionRate: parseFloat(completionRate),
            avgCompletionTime: avgCompletionTime[0] || {},
            workflowsByStatus,
            tasksByCategory
        }
    });
});

