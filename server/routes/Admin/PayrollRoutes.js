
import express from "express";
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getAllEmployeesPayroll,
    getAllPayrolls,
    getEmployeePayroll,
    createPayroll,
    updatePayroll,
    getEmployeePayrollForAdmin,
    getCurrentMonthPayrollForAdmin,
    getPayrollByEmployeeMonthYear,
    getPayrollById,
    togglePayrollVisibility,
    generatePayrollsForMonthYear,
    disbursePayrolls,
    previewDisbursement,
    processPayrollEntry,
    voidPayrollEntry,
    supersedeMonthlyBase
} from "../../controllers/admin/payrollController.js";
import { exportPayrollPDF } from "../../controllers/admin/pdfExportController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isCEOAuthenticated from "../../middlewares/isCEOAuthenticated.js";
import {
  attachAuthContext,
  composeMiddleware,
  requireAnyPermission,
  requirePayrollPublish,
} from "../../middlewares/requirePermission.js";
import { PERMISSIONS } from "../../config/permissions.constants.js";
import { payrollLimiter, exportLimiter } from "../../middlewares/endpointRateLimiters.js";
import { writeLimiter } from "../../middlewares/rateLimiter.js";
import { payrollValidations, payrollValidationsExtended } from "../../middlewares/inputValidation.js";
import { cacheMiddleware } from "../../helpers/cache.js";

const router = express.Router();

router.use(attachAuthContext);
router.use(requireFeature(SAAS_FEATURES.PAYROLL));

const viewPayrollAll = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_VIEW_ALL])
);
const createPayrollMw = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_CREATE])
);
const editPayrollMw = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_EDIT])
);
const processPayrollMw = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_PROCESS])
);

// Get all payrolls (for dashboard - root endpoint) - strict rate limiting for sensitive data
// Allow managers to view payrolls for their department (read-only)
// Cache for 2 minutes (sensitive data, shorter cache)
router.route("/")
    .get(viewPayrollAll, payrollLimiter, cacheMiddleware('payroll:all', 120), getAllPayrolls);

router.route("/create-payroll")
    .post(createPayrollMw, writeLimiter, payrollValidations.create, createPayroll);
router.route("/update-payroll/:id")
    .put(editPayrollMw, writeLimiter, payrollValidationsExtended.update, updatePayroll);
router.route("/toggle-visibility/:id")
    .patch(requirePayrollPublish, writeLimiter, payrollValidationsExtended.toggleVisibility, togglePayrollVisibility);
router.route("/generate-bulk")
    .post(createPayrollMw, exportLimiter, payrollValidationsExtended.generateBulk, generatePayrollsForMonthYear);
router.route("/process/:id")
    .post(processPayrollMw, writeLimiter, payrollValidationsExtended.processById, processPayrollEntry);
router.route("/void/:id")
    .post(processPayrollMw, writeLimiter, payrollValidationsExtended.voidById, voidPayrollEntry);
router.route("/supersede-base")
    .post(processPayrollMw, writeLimiter, payrollValidationsExtended.supersedeBase, supersedeMonthlyBase);

// Disburse salaries to employees' bank accounts (mock provider) - CEO only
router.route("/disburse-preview")
    .get(isCEOAuthenticated, exportLimiter, payrollValidationsExtended.disbursePreview, previewDisbursement);
router.route("/disburse")
    .post(isCEOAuthenticated, exportLimiter, payrollValidationsExtended.disburse, disbursePayrolls);

// Admin employee payroll management
// Allow managers to view payrolls for employees in their department (read-only)
// Cache for 2 minutes
router.route("/admin-employee-payroll/:employeeId")
    .get(viewPayrollAll, payrollValidationsExtended.getByEmployee, cacheMiddleware('payroll:employee', 120), getEmployeePayrollForAdmin);
router.route("/admin-current-payroll/:employeeId")
    .get(viewPayrollAll, payrollValidationsExtended.getByEmployee, cacheMiddleware('payroll:current', 120), getCurrentMonthPayrollForAdmin);
router.route("/admin-payroll/:employeeId/:month/:year")
    .get(viewPayrollAll, payrollValidationsExtended.getByMonthYear, cacheMiddleware('payroll:monthyear', 120), getPayrollByEmployeeMonthYear);

router.route("/details/:id")
    .get(viewPayrollAll, payrollLimiter, getPayrollById);
 
router.route("/get-employee-payroll").get(isAuthenticated, cacheMiddleware('payroll:my', 120), getEmployeePayroll)
router.route("/get-all-payroll").get(isAuthenticated, cacheMiddleware('payroll:all', 120), getAllPayrolls)
// Allow managers to view all employee payrolls in their department
router.route("/get-all-employee-payroll").get(viewPayrollAll, cacheMiddleware('payroll:all-employees', 120), getAllEmployeesPayroll)

// PDF Export routes
router.route("/:id/export-pdf")
    .get(viewPayrollAll, exportLimiter, exportPayrollPDF);

export default router;