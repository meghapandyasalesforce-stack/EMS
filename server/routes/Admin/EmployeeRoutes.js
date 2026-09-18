import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
  updateEmployeeWorkInfo,
  getEmployeeWorkInfo,
  calculateEmployeeStats,
  promoteEmployeeToHrManager,
  updateEmployeePayrollSettings,
} from '../../controllers/admin/employeeController.js';
import {
  getManagers,
  getAllEmployees,
  getOrganizationJobTitles,
  linkEmployeeAsOrgOwnerMeProfile,
} from '../../controllers/admin/employeeManagementController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import { requireOrgOwnerOnly, composeMiddleware, requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isProjectWorkspaceAuthenticated from '../../middlewares/isProjectWorkspaceAuthenticated.js';
import { employeeListLimiter } from '../../middlewares/endpointRateLimiters.js';
import { writeLimiter as generalWriteLimiter } from '../../middlewares/rateLimiter.js';
import { cacheMiddleware } from '../../helpers/cache.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.EMPLOYEES));

const editPayrollSettingsMw = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_EDIT])
);

// Get all employees (for dashboard) - with rate limiting and caching
// Allow HR, managers, and project managers (org roster for project assignment)
// Managers will see team-scoped lists; pure PMs see org-wide
router.route('/')
  .get(isProjectWorkspaceAuthenticated, employeeListLimiter, getAllEmployees);

// Get managers (employees with management positions) - no cache so dropdown always shows current list
router.route('/managers')
  .get(isAdminOrHROrExecutiveAuthenticated, employeeListLimiter, getManagers);

// Get organization-specific job titles for dropdowns
router.route('/job-titles')
  .get(isAdminOrHROrExecutiveAuthenticated, employeeListLimiter, getOrganizationJobTitles);

// Manually promote employee to HR Manager (job profile + access; login unchanged)
router.route('/:employeeId/promote-hr-manager')
  .post(isAdminAuthenticated, generalWriteLimiter, promoteEmployeeToHrManager);

// Org owner: link an existing employee as their Me-tab profile
router.route('/:employeeId/link-as-me-profile')
  .post(requireOrgOwnerOnly, generalWriteLimiter, linkEmployeeAsOrgOwnerMeProfile);

// Update employee work information - write operations have stricter limits
router.route('/:employeeId/work-info')
  .put(isAdminOrHROrExecutiveAuthenticated, generalWriteLimiter, updateEmployeeWorkInfo)
  .get(isAdminAuthenticated, employeeListLimiter, getEmployeeWorkInfo);

// PF/ESI statutory deduction flags — same access as payroll edit
router.route('/:employeeId/payroll-settings')
  .put(editPayrollSettingsMw, generalWriteLimiter, updateEmployeePayrollSettings);

// Calculate employee statistics - resource intensive
router.route('/:employeeId/stats')
  .get(isAdminAuthenticated, employeeListLimiter, calculateEmployeeStats);

export default router;
