import express from 'express';
import {
  platformLogin,
  platformMe,
  platformLogout,
  platformForgotPassword,
  platformResetPassword,
} from '../../controllers/platform/platformAuthController.js';
import { requirePlatformOperator } from '../../middlewares/requirePlatformOperator.js';
import { refreshToken } from '../../controllers/auth/refreshTokenController.js';
import { forgotPasswordLimiter, resetPasswordLimiter } from '../../middlewares/rateLimiter.js';
import { authValidations } from '../../middlewares/inputValidation.js';

const router = express.Router();

router.post('/login', platformLogin);
router.post('/refresh-token', refreshToken);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  authValidations.forgotPassword,
  platformForgotPassword
);
router.post('/reset-password/:token', resetPasswordLimiter, platformResetPassword);
router.post('/logout', requirePlatformOperator, platformLogout);
router.get('/me', requirePlatformOperator, platformMe);

export default router;
