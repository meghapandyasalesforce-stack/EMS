import express from "express";
import { loginUser,logoutUser,registerUser } from "../../controllers/auth/adminAuthController.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

// Apply rate limiting to prevent abuse
router.route("/register").post(loginLimiter, registerUser); // Rate limited registration
router.route("/login").post(loginLimiter, loginUser);
router.route("/logout").get(logoutUser);

export default router;