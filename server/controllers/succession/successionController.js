import { SuccessionPlan, TalentPool } from '../../models/succession.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create succession plan
 */
export const createSuccessionPlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const successionPlan = new SuccessionPlan({
        ...req.body,
        organizationId,
        createdBy
    });

    await successionPlan.save();

    res.status(201).json({
        success: true,
        message: 'Succession plan created successfully',
        data: successionPlan
    });
});

/**
 * Get succession plans
 */
export const getSuccessionPlans = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { positionId, riskLevel, status } = req.query;

    const query = addOrganizationFilter(req, {});

    if (positionId) query.positionId = positionId;
    if (riskLevel) query.riskLevel = riskLevel;
    if (status) query.status = status;

    const plans = await SuccessionPlan.find(query)
        .populate('positionId', 'name level')
        .populate('currentIncumbent', 'name email department')
        .populate('successors.employeeId', 'name email department position')
        .populate('successors.developmentPlan')
        .sort({ riskLevel: 1, criticality: 1 });

    res.json({
        success: true,
        data: plans
    });
});

/**
 * Add to talent pool
 */
export const addToTalentPool = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const addedBy = req.user?._id || req.employee?._id;

    const talentPool = new TalentPool({
        ...req.body,
        organizationId,
        addedBy
    });

    await talentPool.save();

    res.status(201).json({
        success: true,
        message: 'Added to talent pool successfully',
        data: talentPool
    });
});

/**
 * Get talent pool
 */
export const getTalentPool = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { potentialLevel, currentRole } = req.query;

    const query = addOrganizationFilter(req, {});

    if (potentialLevel) query.potentialLevel = potentialLevel;
    if (currentRole) query.currentRole = currentRole;

    const talentPool = await TalentPool.find(query)
        .populate('employeeId', 'name email department position')
        .populate('currentRole', 'name level')
        .populate('targetRoles.roleId', 'name level')
        .populate('developmentPlan')
        .sort({ potentialLevel: 1, lastReviewDate: -1 });

    res.json({
        success: true,
        data: talentPool
    });
});

/**
 * Get single succession plan
 */
export const getSuccessionPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await SuccessionPlan.findOne({
        _id: id,
        organizationId
    })
        .populate('positionId', 'name level')
        .populate('currentIncumbent', 'name email department position')
        .populate('successors.employeeId', 'name email department position')
        .populate('successors.developmentPlan')
        .populate('developmentActivities.assignedTo', 'name email')
        .populate('createdBy', 'name email');

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Succession plan not found'
        });
    }

    res.json({
        success: true,
        data: plan
    });
});

/**
 * Update succession plan
 */
export const updateSuccessionPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await SuccessionPlan.findOne({
        _id: id,
        organizationId
    });

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Succession plan not found'
        });
    }

    Object.assign(plan, req.body);
    await plan.save();

    const populatedPlan = await SuccessionPlan.findById(plan._id)
        .populate('positionId', 'name level')
        .populate('currentIncumbent', 'name email department position')
        .populate('successors.employeeId', 'name email department position')
        .populate('successors.developmentPlan')
        .populate('developmentActivities.assignedTo', 'name email')
        .populate('createdBy', 'name email');

    res.json({
        success: true,
        message: 'Succession plan updated successfully',
        data: populatedPlan
    });
});

/**
 * Delete succession plan
 */
export const deleteSuccessionPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const plan = await SuccessionPlan.findOne({
        _id: id,
        organizationId
    });

    if (!plan) {
        return res.status(404).json({
            success: false,
            message: 'Succession plan not found'
        });
    }

    await SuccessionPlan.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Succession plan deleted successfully'
    });
});

/**
 * Update talent pool entry
 */
export const updateTalentPool = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const talent = await TalentPool.findOne({
        _id: id,
        organizationId
    });

    if (!talent) {
        return res.status(404).json({
            success: false,
            message: 'Talent pool entry not found'
        });
    }

    Object.assign(talent, req.body);
    await talent.save();

    const populatedTalent = await TalentPool.findById(talent._id)
        .populate('employeeId', 'name email department position')
        .populate('currentRole', 'name level')
        .populate('targetRoles.roleId', 'name level')
        .populate('developmentPlan');

    res.json({
        success: true,
        message: 'Talent pool entry updated successfully',
        data: populatedTalent
    });
});

/**
 * Delete talent pool entry
 */
export const deleteTalentPool = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const talent = await TalentPool.findOne({
        _id: id,
        organizationId
    });

    if (!talent) {
        return res.status(404).json({
            success: false,
            message: 'Talent pool entry not found'
        });
    }

    await TalentPool.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Talent pool entry deleted successfully'
    });
});

