/**
 * Audit Log Controller
 * Provides endpoints to view and filter audit logs
 */

import AuditLog from '../../models/auditLog.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { sendSuccess, sendError, sendNotFound, sendForbidden } from '../../helpers/responseHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Get audit logs with filtering
 * GET /api/v1/admin/audit-logs
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    
    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    // Parse pagination
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const sort = parseSort(req, '-createdAt');

    // Build query with organization filter
    const query = addOrganizationFilter(req, {});

    // Filter by action
    if (req.query.action) {
        query.action = req.query.action;
    }

    // Filter by entity type
    if (req.query.entityType) {
        query.entityType = req.query.entityType;
    }

    // Filter by entity ID
    if (req.query.entityId) {
        query.entityId = req.query.entityId;
    }

    // Filter by user/employee
    if (req.query.userId) {
        query.userId = req.query.userId;
    }
    if (req.query.employeeId) {
        query.employeeId = req.query.employeeId;
    }

    // Filter by status
    if (req.query.status) {
        query.status = req.query.status;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
        query.createdAt = {};
        if (req.query.startDate) {
            query.createdAt.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
            query.createdAt.$lte = new Date(req.query.endDate);
        }
    }

    // Execute query
    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .populate('userId', 'name email role')
            .populate('employeeId', 'name lastName email employeeId')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        AuditLog.countDocuments(query)
    ]);

    return sendPaginatedResponse(res, logs, page, limit, total, 'Audit logs retrieved successfully');
});

/**
 * Get audit log by ID
 * GET /api/v1/admin/audit-logs/:id
 */
export const getAuditLogById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const log = await AuditLog.findOne({
        _id: id,
        organizationId
    })
        .populate('userId', 'name email role')
        .populate('employeeId', 'name lastName email employeeId')
        .lean();

    if (!log) {
        return sendNotFound(res, 'Audit log');
    }

    return sendSuccess(res, log, 'Audit log retrieved successfully');
});

/**
 * Get audit logs for a specific entity
 * GET /api/v1/admin/audit-logs/entity/:entityType/:entityId
 */
export const getEntityAuditLogs = asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const organizationId = getOrganizationId(req);

    const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
    const sort = parseSort(req, '-createdAt');

    const query = addOrganizationFilter(req, {
        entityType,
        entityId
    });

    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .populate('userId', 'name email role')
            .populate('employeeId', 'name lastName email employeeId')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        AuditLog.countDocuments(query)
    ]);

    return sendPaginatedResponse(res, logs, page, limit, total, 'Entity audit logs retrieved successfully');
});

/**
 * Get audit log statistics
 * GET /api/v1/admin/audit-logs/statistics
 */
export const getAuditLogStatistics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;

    const matchFilter = { organizationId };
    if (startDate || endDate) {
        matchFilter.createdAt = {};
        if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
        if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }

    const [
        totalLogs,
        logsByAction,
        logsByEntityType,
        logsByStatus,
        recentLogs
    ] = await Promise.all([
        AuditLog.countDocuments(matchFilter),
        AuditLog.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        AuditLog.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$entityType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        AuditLog.aggregate([
            { $match: matchFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        AuditLog.find(matchFilter)
            .sort('-createdAt')
            .limit(10)
            .select('action entityType entityName createdAt status')
            .lean()
    ]);

    return sendSuccess(res, {
        total: totalLogs,
        byAction: logsByAction,
        byEntityType: logsByEntityType,
        byStatus: logsByStatus,
        recent: recentLogs
    }, 'Audit log statistics retrieved successfully');
});

export default {
    getAuditLogs,
    getAuditLogById,
    getEntityAuditLogs,
    getAuditLogStatistics
};

