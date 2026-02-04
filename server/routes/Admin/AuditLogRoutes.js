/**
 * Audit Log Routes
 * Admin-only routes for viewing audit logs
 */

import express from 'express';
import {
    getAuditLogs,
    getAuditLogById,
    getEntityAuditLogs,
    getAuditLogStatistics
} from '../../controllers/admin/auditLogController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [Create, Update, Delete, Login, Logout, Export, Import, Approve, Reject, Download, Upload]
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Success, Failed, Error]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.route('/')
    .get(isAdminOrHRAuthenticated, readLimiter, getAuditLogs);

/**
 * @swagger
 * /admin/audit-logs/statistics:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.route('/statistics')
    .get(isAdminOrHRAuthenticated, readLimiter, getAuditLogStatistics);

/**
 * @swagger
 * /admin/audit-logs/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get audit logs for a specific entity
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entity audit logs retrieved successfully
 */
router.route('/entity/:entityType/:entityId')
    .get(isAdminOrHRAuthenticated, readLimiter, getEntityAuditLogs);

/**
 * @swagger
 * /admin/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.route('/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getAuditLogById);

export default router;

