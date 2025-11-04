import express from "express";
import { 
    getEmployeePayrollHistory, 
    getPayrollDetails, 
    downloadPayslip, 
    getCurrentMonthPayroll 
} from "../../controllers/employee/employeePayrollController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";

const router = express.Router();

// Get employee's payroll history
router.route("/history").get(isAuthenticated, getEmployeePayrollHistory);

// Get current month payroll
router.route("/current").get(isAuthenticated, getCurrentMonthPayroll);

// Get specific payroll details
router.route("/details/:payrollId").get(isAuthenticated, getPayrollDetails);

// Download payslip
router.route("/download/:payrollId").get(isAuthenticated, downloadPayslip);

export default router;
