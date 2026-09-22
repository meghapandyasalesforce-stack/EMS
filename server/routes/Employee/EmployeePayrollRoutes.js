import express from "express";
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import { 
    getEmployeePayrollHistory, 
    getPayrollDetails, 
    downloadPayslip, 
    getCurrentMonthPayroll,
    getPayrollByMonth
} from "../../controllers/employee/employeePayrollController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PAYROLL));

// Get employee's payroll history
router.route("/history").get(isAuthenticated, getEmployeePayrollHistory);

// Get current month payroll
router.route("/current").get(isAuthenticated, getCurrentMonthPayroll);

// Get payroll for a specific month/year (auto-creates if missing)
router.route("/by-month").get(isAuthenticated, getPayrollByMonth);

// Get specific payroll details
router.route("/details/:payrollId").get(isAuthenticated, getPayrollDetails);

// Download payslip
router.route("/download/:payrollId").get(isAuthenticated, downloadPayslip);

export default router;
