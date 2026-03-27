import express from 'express';
import {
  forgotPassword,
  resetPassword
} from '../../controllers/forgetPassword/forgotPasswordController.js';
import { forgotPasswordLimiter, resetPasswordLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Apply rate limiting to prevent brute force attacks on password reset
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);

export default router;