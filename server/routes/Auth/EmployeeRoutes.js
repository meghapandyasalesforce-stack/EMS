import express from "express";
import { loginEmployee, logoutEmployee, registerEmployee, resetEmployeePassword } from "../../controllers/auth/employeeAuthController.js";
import { deleteEmployee, getAllEmployees } from "../../controllers/admin/employeeManagementController.js";
import { refreshToken } from "../../controllers/auth/refreshTokenController.js";
import isAdminAuthenticated from './../../middlewares/isAdminAuthenticated.js';
import isAuthenticated from "../../middlewares/isAuthenticated.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";
import { authValidations, employeeValidations } from "../../middlewares/inputValidation.js";
import logger from "../../helpers/logger.js";

const router = express.Router();

// Employee registration requires admin authentication
// Employee registration uses employeeValidations.create which validates all required employee fields
// Password is optional (will be auto-generated if not provided)
router.route("/register").post(
    isAdminAuthenticated, // Require admin authentication to get organizationId
    loginLimiter, 
    employeeValidations.create, 
    registerEmployee
); // Rate limited registration
router.route("/login").post(
    loginLimiter,
    authValidations.login,
    loginEmployee
);
router.route("/logout").post(logoutEmployee); // Changed to POST for state-changing operation
router.route("/refresh-token").post(refreshToken); // Refresh access token
router.route("/reset-password").patch(loginLimiter, isAuthenticated, resetEmployeePassword); // Rate limited password reset
router.route("/get-all-employees").get(isAdminAuthenticated, getAllEmployees);
router.route("/delete-employee/:employeeId").delete(isAdminAuthenticated, deleteEmployee);

export default router;