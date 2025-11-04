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
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Employee route - MUST come before /:employeeId to avoid route conflicts
router.route('/employee/my-card').get(isAuthenticated, getEmployeeIdCard);

// Download ID card - MUST come before /:employeeId to avoid route conflicts
router.route('/card/:id/download').get(downloadIdCard);

// Admin routes - require admin authentication
router.route('/generate').post(isAdminAuthenticated, generateIdCard);
router.route('/').get(isAdminAuthenticated, getAllIdCards);
router.route('/test-db').get(testDatabaseConnection);
router.route('/:employeeId').get(isAdminAuthenticated, getIdCardByEmployeeId); // Get by employeeId (from Employee model)
router.route('/card/:id') // Use /card/:id for IdCard document ID
    .put(isAdminAuthenticated, updateIdCard)
    .delete(isAdminAuthenticated, revokeIdCard); // Using delete for revoke for simplicity, can be a PUT with status change

export default router;
