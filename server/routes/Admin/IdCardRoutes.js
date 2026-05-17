import express from 'express';
import {
    generateIdCard,
    getAllIdCards,
    getIdCardByEmployeeId,
    updateIdCard,
    revokeIdCard,
    getEmployeeIdCard,
    downloadIdCard,
    testDatabaseConnection
} from '../../controllers/admin/idCardController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

/**
 * @swagger
 * /admin/id-card/employee/my-card:
 *   get:
 *     summary: Get employee's own ID card
 *     tags: [ID Card Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: ID card details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.route('/employee/my-card').get(isAuthenticated, getEmployeeIdCard);

/**
 * @swagger
 * /admin/id-card/card/{id}/download:
 *   get:
 *     summary: Download ID card as PDF
 *     tags: [ID Card Management]
 *     produces:
 *       - application/pdf
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.route('/card/:id/download').get(isAuthenticated, downloadIdCard);

/**
 * @swagger
 * /admin/id-card/generate:
 *   post:
 *     summary: Generate ID card for employee
 *     tags: [ID Card Management]
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
 *             properties:
 *               employeeId:
 *                 type: string
 *               cardType:
 *                 type: string
 *                 enum: [employee, visitor, contractor, temporary]
 *                 default: employee
 *               cardDesign:
 *                 type: object
 *                 properties:
 *                   template:
 *                     type: string
 *                     enum: [standard, premium, executive, custom, mint, corporate, modern, professional]
 *                   backgroundColor:
 *                     type: string
 *                   textColor:
 *                     type: string
 *                   companyName:
 *                     type: string
 *                   companyAddress:
 *                     type: string
 *               accessLevel:
 *                 type: string
 *                 enum: [basic, standard, premium, admin]
 *     responses:
 *       201:
 *         description: ID card generated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.route('/generate').post(isAdminOrHROrExecutiveAuthenticated, generateIdCard);

/**
 * @swagger
 * /admin/id-card:
 *   get:
 *     summary: Get all ID cards
 *     tags: [ID Card Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of ID cards
 */
router.route('/').get(isAdminOrHROrExecutiveAuthenticated, getAllIdCards);

router.route('/test-db').get(testDatabaseConnection);

/**
 * @swagger
 * /admin/id-card/{employeeId}:
 *   get:
 *     summary: Get ID card by employee ID
 *     tags: [ID Card Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ID card details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.route('/:employeeId').get(isAdminOrHROrExecutiveAuthenticated, getIdCardByEmployeeId);

/**
 * @swagger
 * /admin/id-card/card/{id}:
 *   put:
 *     summary: Update ID card
 *     tags: [ID Card Management]
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
 *         description: ID card updated successfully
 *   delete:
 *     summary: Revoke ID card
 *     tags: [ID Card Management]
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
 *         description: ID card revoked successfully
 */
router.route('/card/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, updateIdCard)
    .delete(isAdminOrHROrExecutiveAuthenticated, revokeIdCard);

export default router;
