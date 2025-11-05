import express from 'express';
import {
  forgotPassword,
  resetPassword
} from '../../controllers/forgetPassword/forgotPasswordController.js';
import { passwordResetLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Apply rate limiting to prevent brute force attacks on password reset
router.post('/forgot-password', passwordResetLimiter, forgotPassword);

router.post('/reset-password/:token', passwordResetLimiter, resetPassword);

export default router;