import express from 'express';
import {
    createOneOnOne,
    getOneOnOnes,
    updateOneOnOne,
    completeOneOnOne
} from '../../controllers/oneOnOne/oneOnOneController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

/**
 * @swagger
 * /both/one-on-one/one-on-ones:
 *   post:
 *     summary: Schedule a one-on-one meeting
 *     tags: [One-on-One Meetings]
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
 *               - employeeId
 *               - scheduledDate
 *             properties:
 *               employeeId:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               scheduledTime:
 *                 type: string
 *               duration:
 *                 type: integer
 *                 default: 30
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *               agenda:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     topic:
 *                       type: string
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Meeting scheduled successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *   get:
 *     summary: Get one-on-one meetings
 *     tags: [One-on-One Meetings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: managerId
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
 *           enum: [Scheduled, Completed, Cancelled, Rescheduled, No Show]
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
 *         description: List of meetings
 */
router.route('/one-on-ones')
    .post(isAuthenticatedBoth, writeLimiter, createOneOnOne)
    .get(isAuthenticatedBoth, readLimiter, getOneOnOnes);

/**
 * @swagger
 * /both/one-on-one/one-on-ones/{id}:
 *   put:
 *     summary: Update one-on-one meeting
 *     tags: [One-on-One Meetings]
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
 *         description: Meeting updated successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.route('/one-on-ones/:id')
    .put(isAuthenticatedBoth, writeLimiter, updateOneOnOne);

/**
 * @swagger
 * /both/one-on-one/one-on-ones/{id}/complete:
 *   post:
 *     summary: Complete one-on-one meeting
 *     tags: [One-on-One Meetings]
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
 *               managerNotes:
 *                 type: string
 *               employeeNotes:
 *                 type: string
 *               actionItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     item:
 *                       type: string
 *                     assignedTo:
 *                       type: string
 *                       enum: [Manager, Employee, Both]
 *                     dueDate:
 *                       type: string
 *                       format: date
 *               feedback:
 *                 type: object
 *                 properties:
 *                   managerFeedback:
 *                     type: string
 *                   employeeFeedback:
 *                     type: string
 *                   overallRating:
 *                     type: number
 *               nextMeetingDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Meeting completed successfully
 */
router.route('/one-on-ones/:id/complete')
    .post(isAuthenticatedBoth, writeLimiter, completeOneOnOne);

export default router;

