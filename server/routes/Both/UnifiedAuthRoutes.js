import express from 'express';
import { unifiedLogin } from '../../controllers/auth/unifiedAuthController.js';
import { getMyPermissions } from '../../controllers/auth/permissionsController.js';
import { changePassword } from '../../controllers/auth/changePasswordController.js';
import { loginLimiter } from '../../middlewares/rateLimiter.js';
import { authValidations } from '../../middlewares/inputValidation.js';
import { attachAuthContext } from '../../middlewares/requirePermission.js';
import isAuthenticatedBoth from '../../middlewares/isAuthenticatedBoth.js';

const router = express.Router();

router.post('/login', loginLimiter, authValidations.login, unifiedLogin);
router.get('/permissions', attachAuthContext, getMyPermissions);
router.post('/change-password', isAuthenticatedBoth, changePassword);

export default router;
