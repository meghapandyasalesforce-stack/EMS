import { WorkforcePlan, HeadcountForecast } from '../../models/workforce.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create workforce plan
 */
export const createWorkforcePlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const workforcePlan = new WorkforcePlan({
        ...req.body,
        organizationId,
        createdBy
    });

    await workforcePlan.save();

    res.status(201).json({
        success: true,
        message: 'Workforce plan created successfully',
        data: workforcePlan
    });
});

/**
 * Get workforce plans
 */
export const getWorkforcePlans = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { planYear, department, status } = req.query;

    const query = addOrganizationFilter(req, {});

    if (planYear) query.planYear = planYear;
    if (department) query.department = department;
    if (status) query.status = status;

    const plans = await WorkforcePlan.find(query)
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ planYear: -1, createdAt: -1 });

    res.json({
        success: true,
        data: plans
    });
});

/**
 * Create headcount forecast
 */
export const createHeadcountForecast = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const forecast = new HeadcountForecast({
        ...req.body,
        organizationId,
        createdBy
    });

    await forecast.save();

    res.status(201).json({
        success: true,
        message: 'Headcount forecast created successfully',
        data: forecast
    });
});

/**
 * Get headcount forecasts
 */
export const getHeadcountForecasts = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { department, startDate, endDate } = req.query;

    const query = addOrganizationFilter(req, {});

    if (department) query.department = department;
    if (startDate || endDate) {
        query.forecastDate = {};
        if (startDate) query.forecastDate.$gte = new Date(startDate);
        if (endDate) query.forecastDate.$lte = new Date(endDate);
    }

    const forecasts = await HeadcountForecast.find(query)
        .populate('createdBy', 'name email')
        .sort({ forecastDate: -1 });

    res.json({
        success: true,
        data: forecasts
    });
});

/**
 * Get single workforce plan
 */
export const getWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await WorkforcePlan.findOne({
        _id: id,
        organizationId
    })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    res.json({
        success: true,
        data: plan
    });
});

/**
 * Update workforce plan
 */
export const updateWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await WorkforcePlan.findOne({
        _id: id,
        organizationId
    });

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    Object.assign(plan, req.body);
    
    // Recalculate budget remaining if budget fields changed
    if (req.body.budget) {
        plan.budget.remaining = (plan.budget.allocated || 0) - (plan.budget.spent || 0);
    }

    await plan.save();

    const populatedPlan = await WorkforcePlan.findById(plan._id)
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');

    res.json({
        success: true,
        message: 'Workforce plan updated successfully',
        data: populatedPlan
    });
});

/**
 * Delete workforce plan
 */
export const deleteWorkforcePlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await WorkforcePlan.findOne({
        _id: id,
        organizationId
    });

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Workforce plan not found'
        });
    }

    await WorkforcePlan.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Workforce plan deleted successfully'
    });
});

/**
 * Get single headcount forecast
 */
export const getHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    })
        .populate('createdBy', 'name email');

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    res.json({
        success: true,
        data: forecast
    });
});

/**
 * Update headcount forecast
 */
export const updateHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    });

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    Object.assign(forecast, req.body);
    await forecast.save();

    const populatedForecast = await HeadcountForecast.findById(forecast._id)
        .populate('createdBy', 'name email');

    res.json({
        success: true,
        message: 'Headcount forecast updated successfully',
        data: populatedForecast
    });
});

/**
 * Delete headcount forecast
 */
export const deleteHeadcountForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const forecast = await HeadcountForecast.findOne({
        _id: id,
        organizationId
    });

    if (!forecast) {
        return res.status(404).json({
            success: false,
            message: 'Headcount forecast not found'
        });
    }

    await HeadcountForecast.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Headcount forecast deleted successfully'
    });
});

/**
 * Get workforce analytics
 */
export const getWorkforceAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate, department } = req.query;

    const query = addOrganizationFilter(req, {});
    if (department) query.department = department;

    // Get workforce plans statistics
    const [totalPlans, activePlans, plansByStatus, plansByDepartment] = await Promise.all([
        WorkforcePlan.countDocuments(query),
        WorkforcePlan.countDocuments({ ...query, status: { $in: ['Approved', 'In Progress'] } }),
        WorkforcePlan.aggregate([
            { $match: query },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        WorkforcePlan.aggregate([
            { $match: query },
            { $group: { _id: '$department', count: { $sum: 1 } } }
        ])
    ]);

    // Get headcount forecast statistics
    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.forecastDate = {};
        if (startDate) dateFilter.forecastDate.$gte = new Date(startDate);
        if (endDate) dateFilter.forecastDate.$lte = new Date(endDate);
    }

    const forecastQuery = { ...query, ...dateFilter };
    const [totalForecasts, forecastsByDepartment, avgProjectedHeadcount] = await Promise.all([
        HeadcountForecast.countDocuments(forecastQuery),
        HeadcountForecast.aggregate([
            { $match: forecastQuery },
            { $group: { _id: '$department', count: { $sum: 1 } } }
        ]),
        HeadcountForecast.aggregate([
            { $match: forecastQuery },
            {
                $group: {
                    _id: null,
                    avgProjected: { $avg: '$projectedHeadcount' },
                    avgCurrent: { $avg: '$currentHeadcount' },
                    totalNewHires: { $sum: '$newHires' },
                    totalTerminations: { $sum: '$terminations' }
                }
            }
        ])
    ]);

    // Get budget statistics
    const budgetStats = await WorkforcePlan.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalAllocated: { $sum: '$budget.allocated' },
                totalSpent: { $sum: '$budget.spent' },
                totalRemaining: { $sum: '$budget.remaining' },
                avgAllocated: { $avg: '$budget.allocated' }
            }
        }
    ]);

    // Get hiring plan statistics
    const hiringPlanStats = await WorkforcePlan.aggregate([
        { $match: query },
        { $unwind: '$hiringPlan' },
        {
            $group: {
                _id: '$hiringPlan.status',
                count: { $sum: 1 },
                totalPositions: { $sum: '$hiringPlan.numberOfPositions' },
                totalBudget: { $sum: '$hiringPlan.budget' }
            }
        }
    ]);

    // Get skills gap analysis
    const skillsGapStats = await WorkforcePlan.aggregate([
        { $match: query },
        { $unwind: '$skillsRequired' },
        {
            $group: {
                _id: '$skillsRequired.skill',
                totalRequired: { $sum: '$skillsRequired.requiredCount' },
                totalCurrent: { $sum: '$skillsRequired.currentCount' },
                totalGap: { $sum: '$skillsRequired.gap' }
            }
        },
        { $sort: { totalGap: -1 } },
        { $limit: 10 }
    ]);

    const analytics = {
        workforcePlans: {
            total: totalPlans,
            active: activePlans,
            byStatus: plansByStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            byDepartment: plansByDepartment.reduce((acc, item) => {
                acc[item._id || 'Unassigned'] = item.count;
                return acc;
            }, {})
        },
        headcountForecasts: {
            total: totalForecasts,
            byDepartment: forecastsByDepartment.reduce((acc, item) => {
                acc[item._id || 'Unassigned'] = item.count;
                return acc;
            }, {}),
            averages: avgProjectedHeadcount.length > 0 ? {
                avgProjectedHeadcount: Math.round(avgProjectedHeadcount[0].avgProjected || 0),
                avgCurrentHeadcount: Math.round(avgProjectedHeadcount[0].avgCurrent || 0),
                totalNewHires: avgProjectedHeadcount[0].totalNewHires || 0,
                totalTerminations: avgProjectedHeadcount[0].totalTerminations || 0
            } : {
                avgProjectedHeadcount: 0,
                avgCurrentHeadcount: 0,
                totalNewHires: 0,
                totalTerminations: 0
            }
        },
        budget: budgetStats.length > 0 ? {
            totalAllocated: budgetStats[0].totalAllocated || 0,
            totalSpent: budgetStats[0].totalSpent || 0,
            totalRemaining: budgetStats[0].totalRemaining || 0,
            avgAllocated: Math.round(budgetStats[0].avgAllocated || 0),
            utilizationRate: budgetStats[0].totalAllocated > 0
                ? Math.round((budgetStats[0].totalSpent / budgetStats[0].totalAllocated) * 100)
                : 0
        } : {
            totalAllocated: 0,
            totalSpent: 0,
            totalRemaining: 0,
            avgAllocated: 0,
            utilizationRate: 0
        },
        hiringPlans: hiringPlanStats.reduce((acc, item) => {
            acc[item._id] = {
                count: item.count,
                totalPositions: item.totalPositions,
                totalBudget: item.totalBudget
            };
            return acc;
        }, {}),
        skillsGap: skillsGapStats.map(item => ({
            skill: item._id,
            required: item.totalRequired,
            current: item.totalCurrent,
            gap: item.totalGap
        })),
        period: {
            startDate: startDate || null,
            endDate: endDate || null
        }
    };

    res.json({
        success: true,
        data: analytics
    });
});

