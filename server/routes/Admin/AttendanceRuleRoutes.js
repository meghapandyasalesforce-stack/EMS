import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createOrUpdateAttendanceRule,
    getAttendanceRule,
    getAllAttendanceRules,
    deactivateAttendanceRule,
    checkAttendanceRadius
} from '../../controllers/admin/attendanceRuleController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { attendanceRadiusCheckLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ATTENDANCE));

// Admin, HR, and Executive routes (create/update/deactivate - sensitive operations)
// Allow HR and Executives to manage attendance rules as they need to configure them
router.post('/create-or-update', isAdminOrHROrExecutiveAuthenticated, createOrUpdateAttendanceRule);
router.patch('/deactivate/:ruleId', isAdminOrHROrExecutiveAuthenticated, deactivateAttendanceRule);

// Read routes (allow HR and Executives to view attendance rules)
router.get('/current', isAdminOrHROrExecutiveAuthenticated, getAttendanceRule);
router.get('/all', isAdminOrHROrExecutiveAuthenticated, getAllAttendanceRules);

// Both admin and employee can check radius (for attendance marking)
router.post('/check-radius', isAuthenticated, attendanceRadiusCheckLimiter, checkAttendanceRadius);

export default router;

