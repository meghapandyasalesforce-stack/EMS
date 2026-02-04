import express from 'express';
import {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    addComment,
    resolveTicket,
    getHelpdeskAnalytics
} from '../../controllers/helpdesk/helpdeskController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

/**
 * @swagger
 * /both/helpdesk/tickets:
 *   post:
 *     summary: Create a new helpdesk ticket
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - subject
 *               - description
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [HR, IT, Payroll, Benefits, Leave, Attendance, Training, Document, General, Other]
 *               subCategory:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *                 default: Medium
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *               department:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     url:
 *                       type: string
 *     responses:
 *       201:
 *         description: Ticket created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   get:
 *     summary: Get all helpdesk tickets
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Open, Assigned, In Progress, Resolved, Closed, Cancelled]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Urgent]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of tickets
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.route('/tickets')
    .post(isAuthenticatedBoth, writeLimiter, createTicket)
    .get(isAuthenticatedBoth, readLimiter, getTickets);

/**
 * @swagger
 * /both/helpdesk/tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Helpdesk]
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
 *         description: Ticket details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Update ticket
 *     tags: [Helpdesk]
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
 *         description: Ticket updated successfully
 */
router.route('/tickets/:id')
    .get(isAuthenticatedBoth, readLimiter, getTicketById)
    .put(isAuthenticatedBoth, writeLimiter, updateTicket);

/**
 * @swagger
 * /both/helpdesk/tickets/{id}/comment:
 *   post:
 *     summary: Add comment to ticket
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Comment added successfully
 */
router.route('/tickets/:id/comment')
    .post(isAuthenticatedBoth, writeLimiter, addComment);

/**
 * @swagger
 * /both/helpdesk/tickets/{id}/resolve:
 *   post:
 *     summary: Resolve ticket
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolutionNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket resolved successfully
 */
router.route('/tickets/:id/resolve')
    .post(isAuthenticatedBoth, writeLimiter, resolveTicket);

/**
 * @swagger
 * /both/helpdesk/analytics:
 *   get:
 *     summary: Get helpdesk analytics
 *     tags: [Helpdesk]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
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
 *     responses:
 *       200:
 *         description: Analytics data
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.route('/analytics')
    .get(isAdminOrHRAuthenticated, readLimiter, getHelpdeskAnalytics);

export default router;

