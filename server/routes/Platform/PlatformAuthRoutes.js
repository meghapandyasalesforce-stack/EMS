import express from 'express';
import { platformLogin, platformMe, platformLogout } from '../../controllers/platform/platformAuthController.js';
import { requirePlatformOperator } from '../../middlewares/requirePlatformOperator.js';
import { refreshToken } from '../../controllers/auth/refreshTokenController.js';

const router = express.Router();

router.post('/login', platformLogin);
router.post('/refresh-token', refreshToken);
router.post('/logout', requirePlatformOperator, platformLogout);
router.get('/me', requirePlatformOperator, platformMe);

export default router;
