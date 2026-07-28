/**
 * Express middleware — require org Configure feature(s) before route handlers run.
 * Permission alone is not enough; feature must be enabled for the organization.
 */

import { getOrganizationId } from '../helpers/organizationHelper.js';
import {
    assertFeatureEnabled,
    assertAnyFeatureEnabled,
    assertModuleEnabled,
    LifecycleFeatureDisabledError,
    isFeatureEnabled,
} from '../services/lifecycleConfigService.js';

function sendFeatureDisabled(res, error) {
    const status = error?.status || 403;
    return res.status(status).json({
        success: false,
        code: error?.code || 'FEATURE_DISABLED',
        featureKey: error?.featureKey,
        message: error?.message || 'Feature is disabled for this organization',
    });
}

/**
 * @param {string|string[]} featureKey - one key or list (ANY must be enabled)
 * @param {string} [label]
 * @param {boolean} [allowEmpty] - If true, proceed with empty data when disabled instead of blocking
 */
export function requireLifecycleFeature(featureKey, label = null, allowEmpty = false) {
    return async (req, res, next) => {
        try {
            const organizationId = getOrganizationId(req);
            if (Array.isArray(featureKey)) {
                await assertAnyFeatureEnabled(organizationId, featureKey, label);
            } else {
                await assertFeatureEnabled(organizationId, featureKey, label);
            }
            return next();
        } catch (error) {
            if (error instanceof LifecycleFeatureDisabledError || error?.code === 'FEATURE_DISABLED') {
                if (allowEmpty) {
                    // Allow request to proceed but mark feature as disabled
                    req.featureDisabled = true;
                    req.disabledFeatureKey = error?.featureKey || featureKey;
                    return next();
                }
                return sendFeatureDisabled(res, error);
            }
            return res.status(500).json({ success: false, message: error.message });
        }
    };
}

export function requireLifecycleModule(moduleName, label = null, allowEmpty = false) {
    return async (req, res, next) => {
        try {
            await assertModuleEnabled(getOrganizationId(req), moduleName, label);
            return next();
        } catch (error) {
            if (error instanceof LifecycleFeatureDisabledError || error?.code === 'FEATURE_DISABLED') {
                if (allowEmpty) {
                    req.featureDisabled = true;
                    req.disabledModule = moduleName;
                    return next();
                }
                return sendFeatureDisabled(res, error);
            }
            return res.status(500).json({ success: false, message: error.message });
        }
    };
}

export { sendFeatureDisabled, LifecycleFeatureDisabledError };
