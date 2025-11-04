import express from "express";
import { deleteEmployee, getAllEmployees, loginEmployee, logoutEmployee, registerEmployee, resetEmployeePassword, updateEmployeeStatus } from "../../controllers/auth/employeeAuthController.js";
import isAdminAuthenticated from './../../middlewares/isAdminAuthenticated.js';
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

router.route("/register").post(loginLimiter, registerEmployee); // Rate limited registration
router.route("/login").post(loginLimiter, loginEmployee);
router.route("/logout").get(logoutEmployee);
router.route("/reset-password").patch(loginLimiter, isAuthenticated, resetEmployeePassword); // Rate limited password reset
router.route("/get-all-employees").get(isAdminAuthenticated,getAllEmployees);
router.route("/delete-employee/:employeeId").delete(isAdminAuthenticated,deleteEmployee)

export default router;