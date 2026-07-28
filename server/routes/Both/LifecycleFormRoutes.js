import express from 'express';
import {
    getLifecycleForm,
    submitLifecycleFormResponse,
    saveLifecycleFormDraft,
    listLifecycleForms,
} from '../../controllers/lifecycle/lifecycleFormController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { getOrgFeatureFlags } from '../../services/lifecycleFeatureRuntimeService.js';

const router = express.Router();

/** Read-only org feature flags — Configure is SSOT for HR and employees */
router.route('/features')
    .get(isAuthenticated, readLimiter, async (req, res) => {
        try {
            const flags = await getOrgFeatureFlags(getOrganizationId(req));
            return res.json({
                success: true,
                data: {
                    modules: flags.modules,
                    enabledFeatures: flags.enabledFeatures,
                },
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    });

router.route('/forms')
    .get(isAuthenticated, readLimiter, (req, res) => {
        req.query.status = 'Published';
        req.query.activeOnly = '1';
        return listLifecycleForms(req, res);
    });

router.route('/forms/:id')
    .get(isAuthenticated, readLimiter, getLifecycleForm);

router.route('/forms/:id/submit')
    .post(isAuthenticated, writeLimiter, submitLifecycleFormResponse);

router.route('/forms/:id/draft')
    .post(isAuthenticated, writeLimiter, saveLifecycleFormDraft);

export default router;
