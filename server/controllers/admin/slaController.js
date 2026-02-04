import { SLA, SLAViolation } from '../../models/sla.model.js';
import { trackEntity, markResponded, markResolved, getViolations } from '../../services/slaService.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Create SLA
 */
export const createSLA = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { name, description, entityType, priority, responseTime, resolutionTime, escalationLevels, conditions } = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const sla = await SLA.create({
        organizationId,
        name,
        description,
        entityType,
        priority,
        responseTime,
        resolutionTime,
        escalationLevels,
        conditions,
        createdBy: req.user?._id || req.employee?._id
    });

    return sendSuccess(res, sla, 'SLA created successfully', 201);
});

/**
 * Get all SLAs
 */
export const getAllSLAs = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { entityType, isActive } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const query = { organizationId };
    if (entityType) query.entityType = entityType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const slas = await SLA.find(query)
        .populate('escalationLevels.notifyToRole', 'name')
        .populate('escalationLevels.notifyToEmployee', 'name email')
        .sort({ createdAt: -1 });

    return sendSuccess(res, slas, 'SLAs retrieved successfully');
});

/**
 * Get SLA by ID
 */
export const getSLAById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const sla = await SLA.findOne({
        _id: id,
        organizationId
    })
        .populate('escalationLevels.notifyToRole', 'name')
        .populate('escalationLevels.notifyToEmployee', 'name email');

    if (!sla) {
        return sendError(res, 'SLA not found', 404);
    }

    return sendSuccess(res, sla, 'SLA retrieved successfully');
});

/**
 * Update SLA
 */
export const updateSLA = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const updateData = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const sla = await SLA.findOneAndUpdate(
        { _id: id, organizationId },
        { ...updateData, updatedBy: req.user?._id || req.employee?._id },
        { new: true, runValidators: true }
    );

    if (!sla) {
        return sendError(res, 'SLA not found', 404);
    }

    return sendSuccess(res, sla, 'SLA updated successfully');
});

/**
 * Delete SLA
 */
export const deleteSLA = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const sla = await SLA.findOneAndDelete({
        _id: id,
        organizationId
    });

    if (!sla) {
        return sendError(res, 'SLA not found', 404);
    }

    return sendSuccess(res, null, 'SLA deleted successfully');
});

/**
 * Get SLA violations
 */
export const getSLAViolations = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, entityType, priority, page = 1, limit = 20 } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const filters = { status, entityType, priority };
    const violations = await getViolations(organizationId, filters);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = violations.slice(skip, skip + parseInt(limit));

    return sendSuccess(res, {
        violations: paginated,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: violations.length,
            pages: Math.ceil(violations.length / parseInt(limit))
        }
    }, 'Violations retrieved successfully');
});

/**
 * Track entity for SLA
 */
export const trackEntityForSLA = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { entityType, entityId, priority, metadata } = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const violation = await trackEntity({
        organizationId,
        entityType,
        entityId,
        priority,
        metadata
    });

    if (!violation) {
        return sendSuccess(res, null, 'No SLA applicable or entity tracked');
    }

    return sendSuccess(res, violation, 'Entity tracked for SLA');
});

/**
 * Mark entity as responded
 */
export const markEntityResponded = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await markResponded(id);

    return sendSuccess(res, null, 'Entity marked as responded');
});

/**
 * Mark entity as resolved
 */
export const markEntityResolved = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await markResolved(id);

    return sendSuccess(res, null, 'Entity marked as resolved');
});

