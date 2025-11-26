import express from "express";
import { loginUser,logoutUser,registerUser } from "../../controllers/auth/adminAuthController.js";
import { refreshToken } from "../../controllers/auth/refreshTokenController.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";
import isAdminAuthenticated from "../../middlewares/isAdminAuthenticated.js";
import { authValidations } from "../../middlewares/inputValidation.js";
import logger from "../../helpers/logger.js";

const router = express.Router();

// Registration endpoint - secure in production
// In production, require admin authentication to prevent unauthorized admin creation
// In development, allow open registration for testing
const registerMiddleware = process.env.NODE_ENV === 'production' 
  ? [isAdminAuthenticated, loginLimiter] 
  : [loginLimiter];

router.route("/register").post(...registerMiddleware, authValidations.register, registerUser);
router.route("/login").post(
    loginLimiter,
    authValidations.login,
    loginUser
);
router.route("/logout").post(logoutUser); // Changed to POST for state-changing operation
router.route("/refresh-token").post(refreshToken); // Refresh access token

export default router;