
import express from "express";
import { getAllEmployeesPayroll, getAllPayrolls, getEmployeePayroll, createPayroll, updatePayroll, getEmployeePayrollForAdmin, getCurrentMonthPayrollForAdmin, getPayrollByEmployeeMonthYear, getPayrollById, togglePayrollVisibility, generatePayrollsForMonthYear, disbursePayrolls } from "../../controllers/admin/payrollController.js";
import { exportPayrollPDF } from "../../controllers/admin/pdfExportController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";
import isAdminOrManagerOrHRAuthenticated from "../../middlewares/isAdminOrManagerOrHRAuthenticated.js";
import isCEOAuthenticated from "../../middlewares/isCEOAuthenticated.js";
import { payrollLimiter, exportLimiter } from "../../middlewares/endpointRateLimiters.js";
import { writeLimiter } from "../../middlewares/rateLimiter.js";
import { payrollValidations, payrollValidationsExtended } from "../../middlewares/inputValidation.js";
import { cacheMiddleware } from "../../helpers/cache.js";

const router = express.Router();

// Get all payrolls (for dashboard - root endpoint) - strict rate limiting for sensitive data
// Allow managers to view payrolls for their department (read-only)
// Cache for 2 minutes (sensitive data, shorter cache)
router.route("/")
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:all', 120), getAllPayrolls);

router.route("/create-payroll")
    .post(isAdminOrManagerOrHRAuthenticated, writeLimiter, payrollValidations.create, createPayroll);
router.route("/update-payroll/:id")
    .put(isAdminAuthenticated, writeLimiter, payrollValidationsExtended.update, updatePayroll);
router.route("/toggle-visibility/:id")
    .patch(isAdminAuthenticated, writeLimiter, payrollValidationsExtended.toggleVisibility, togglePayrollVisibility);
router.route("/generate-bulk")
    .post(isAdminOrManagerOrHRAuthenticated, exportLimiter, payrollValidationsExtended.generateBulk, generatePayrollsForMonthYear);

// Disburse salaries to employees' bank accounts (mock provider) - CEO only
router.route("/disburse")
    .post(isCEOAuthenticated, exportLimiter, payrollValidationsExtended.disburse, disbursePayrolls);

// Admin employee payroll management
// Allow managers to view payrolls for employees in their department (read-only)
// Cache for 2 minutes
router.route("/admin-employee-payroll/:employeeId")
    .get(isAdminOrManagerOrHRAuthenticated, payrollValidationsExtended.getByEmployee, cacheMiddleware('payroll:employee', 120), getEmployeePayrollForAdmin);
router.route("/admin-current-payroll/:employeeId")
    .get(isAdminOrManagerOrHRAuthenticated, payrollValidationsExtended.getByEmployee, cacheMiddleware('payroll:current', 120), getCurrentMonthPayrollForAdmin);
router.route("/admin-payroll/:employeeId/:month/:year")
    .get(isAdminOrManagerOrHRAuthenticated, payrollValidationsExtended.getByMonthYear, cacheMiddleware('payroll:monthyear', 120), getPayrollByEmployeeMonthYear);

router.route("/details/:id")
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, getPayrollById);
 
router.route("/get-employee-payroll").get(isAuthenticated, cacheMiddleware('payroll:my', 120), getEmployeePayroll)
router.route("/get-all-payroll").get(isAuthenticated, cacheMiddleware('payroll:all', 120), getAllPayrolls)
// Allow managers to view all employee payrolls in their department
router.route("/get-all-employee-payroll").get(isAdminOrManagerOrHRAuthenticated, cacheMiddleware('payroll:all-employees', 120), getAllEmployeesPayroll)

// PDF Export routes
router.route("/:id/export-pdf")
    .get(isAdminOrManagerOrHRAuthenticated, exportLimiter, exportPayrollPDF);

export default router;