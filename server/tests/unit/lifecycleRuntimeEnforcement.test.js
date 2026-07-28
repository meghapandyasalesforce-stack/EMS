import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    LifecycleFeatureDisabledError,
    isFeatureEnabled,
    featuresFromStorage,
} from '../../services/lifecycleConfigService.js';
import { resolveNotificationFeatureKey } from '../../constants/lifecycleNotificationFeatureMap.js';
import { applyOnboardingFeatureGates, applyOffboardingFeatureGates } from '../../services/lifecycleFeatureRuntimeService.js';

function settingsWith(enabledKeys = []) {
    const stored = {};
    const allKeys = [
        'documentCollection', 'buddyProgram', 'exitInterview', 'fnfSettlement',
        'compliance.india.aadhaar', 'reminders', 'backgroundVerification',
        'clearance', 'assetReturn', 'accessRevocation', 'eSignature',
    ];
    for (const key of allKeys) {
        stored[key.replace(/\./g, '::')] = enabledKeys.includes(key);
    }
    for (const key of enabledKeys) {
        stored[key.replace(/\./g, '::')] = true;
    }
    return {
        modules: { onboarding: { enabled: true }, offboarding: { enabled: true } },
        enabledFeatures: stored,
    };
}

describe('runtime enforcement helpers', () => {
    it('LifecycleFeatureDisabledError is a 403 custom error', () => {
        const err = new LifecycleFeatureDisabledError('fnfSettlement', 'F&F');
        assert.equal(err.status, 403);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FEATURE_DISABLED');
        assert.equal(err.isCustom, true);
        assert.match(err.message, /Configure/);
    });

    it('maps lifecycle notification events to feature keys', () => {
        assert.equal(resolveNotificationFeatureKey('onboarding_reminder'), 'reminders');
        assert.equal(resolveNotificationFeatureKey('lifecycle_bgv_initiated'), 'backgroundVerification');
        assert.equal(resolveNotificationFeatureKey('lifecycle_fnf_approved'), 'fnfSettlement');
        assert.equal(resolveNotificationFeatureKey('unrelated_event'), null);
        assert.equal(
            resolveNotificationFeatureKey('custom', { featureKey: 'buddyProgram' }),
            'buddyProgram',
        );
    });

    it('decodes storage and honors disabled features', () => {
        const settings = settingsWith(['documentCollection']);
        assert.equal(isFeatureEnabled(settings, 'documentCollection'), true);
        assert.equal(isFeatureEnabled(settings, 'buddyProgram'), false);
        assert.equal(isFeatureEnabled(settings, 'compliance.india.aadhaar'), false);
        assert.deepEqual(
            featuresFromStorage(settings.enabledFeatures)['documentCollection'],
            true,
        );
    });

    it('does not delete historical completed workflow identity when gating', () => {
        const settings = settingsWith([]);
        const workflow = {
            _id: 'wf1',
            tasks: [{ title: 'Aadhaar', featureKey: 'compliance.india.aadhaar', status: 'Completed' }],
            documents: [{ documentType: 'AADHAAR', featureKey: 'compliance.india.aadhaar' }],
            exitInterview: { status: 'Completed', mandatory: true },
            finalSettlement: { status: 'Paid', mandatory: true },
        };
        applyOnboardingFeatureGates(workflow, settings);
        applyOffboardingFeatureGates(workflow, {
            ...settings,
            modules: { onboarding: { enabled: true }, offboarding: { enabled: true } },
        });
        // Historical workflow document remains; gated items removed from active arrays
        assert.ok(workflow._id);
        assert.equal(workflow.tasks.length, 0);
        assert.equal(workflow.exitInterview.status, 'Waived');
        assert.equal(workflow.finalSettlement.status, 'Waived');
    });
});
