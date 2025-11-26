import express from "express";
import { registerOrganization, loginOrganization, checkOrganizationByEmail } from "../../controllers/auth/organizationAuthController.js";
import { verifyOrganizationEmail, resendVerificationEmail } from "../../controllers/auth/emailVerificationController.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";
import { authValidations } from "../../middlewares/inputValidation.js";

const router = express.Router();

// Organization registration (public endpoint)
router.route("/register").post(
    loginLimiter, 
    authValidations.register,
    registerOrganization
);

// Organization admin login
router.route("/login").post(
    loginLimiter, 
    authValidations.login,
    loginOrganization
);

// Check organization by email (public endpoint)
router.route("/check-email").get(checkOrganizationByEmail);

// Email verification
router.route("/verify-email").get(verifyOrganizationEmail);
router.route("/resend-verification").post(loginLimiter, resendVerificationEmail);

export default router;

