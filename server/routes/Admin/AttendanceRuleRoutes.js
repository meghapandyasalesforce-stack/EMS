import express from 'express';
import {
    createOrUpdateAttendanceRule,
    getAttendanceRule,
    getAllAttendanceRules,
    deactivateAttendanceRule,
    checkAttendanceRadius
} from '../../controllers/admin/attendanceRuleController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Admin routes (require admin authentication)
router.post('/create-or-update', isAdminAuthenticated, createOrUpdateAttendanceRule);
router.get('/current', isAdminAuthenticated, getAttendanceRule);
router.get('/all', isAdminAuthenticated, getAllAttendanceRules);
router.patch('/deactivate/:ruleId', isAdminAuthenticated, deactivateAttendanceRule);

// Both admin and employee can check radius (for attendance marking)
router.post('/check-radius', isAuthenticated, checkAttendanceRadius);

export default router;

