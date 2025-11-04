
import express from "express";
import { getAllEmployeesPayroll, getAllPayrolls, getEmployeePayroll, updatePayroll, createPayroll, getEmployeePayrollForAdmin, getCurrentMonthPayrollForAdmin, getPayrollByEmployeeMonthYear, togglePayrollVisibility, generatePayrollsForMonthYear, disbursePayrolls } from "../../controllers/admin/payrollController.js";
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";




const router = express.Router();


router.route("/create-payroll").post(isAdminAuthenticated, createPayroll)
router.route("/update-payroll/:id").put(isAdminAuthenticated,updatePayroll)
router.route("/toggle-visibility/:id").patch(isAdminAuthenticated, togglePayrollVisibility)
router.route("/generate-bulk").post(isAdminAuthenticated, generatePayrollsForMonthYear)

// Disburse salaries to employees' bank accounts (mock provider)
router.route("/disburse").post(isAdminAuthenticated, disbursePayrolls)

// Admin employee payroll management
router.route("/admin-employee-payroll/:employeeId").get(isAdminAuthenticated, getEmployeePayrollForAdmin)
router.route("/admin-current-payroll/:employeeId").get(isAdminAuthenticated, getCurrentMonthPayrollForAdmin)
router.route("/admin-payroll/:employeeId/:month/:year").get(isAdminAuthenticated, getPayrollByEmployeeMonthYear)
 
router.route("/get-employee-payroll").get(isAuthenticated,getEmployeePayroll)
router.route("/get-all-payroll").get(isAuthenticated,getAllPayrolls)
router.route("/get-all-employee-payroll").get(isAdminAuthenticated,getAllEmployeesPayroll)

export default router;