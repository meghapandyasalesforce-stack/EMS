import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyOnboardingFeatureGates,
    applyOffboardingFeatureGates,
    filterByFeatureKey,
    resolveItemFeatureKey,
} from '../../services/lifecycleFeatureRuntimeService.js';

function settingsWith(enabledKeys = []) {
    const enabledFeatures = {};
    for (const key of enabledKeys) enabledFeatures[key] = true;
    // Encode-style storage is decoded by featuresFromStorage — tests pass a settings-like object
    // that resolveEnabledFeatureSet reads via featuresFromStorage. Use encoded flat map.
    const stored = {};
    for (const [k, v] of Object.entries(enabledFeatures)) {
        stored[k.replace(/\./g, '::')] = v;
    }
    // Also include explicit false for common keys so "configured" path is used
    const allKeys = [
        'documentCollection', 'buddyProgram', 'exitInterview', 'fnfSettlement',
        'compliance.india.aadhaar', 'compliance.india.pan', 'industry.it.nda',
        'clearance', 'assetReturn', 'noticePeriod', 'knowledgeTransfer', 'accessRevocation',
        'experienceLetter', 'joiningChecklist', 'induction', 'eSignature', 'itAssetProvisioning',
        'softwareAccessRequest', 'mandatoryTraining', 'goalAssignment', 'backgroundVerification',
        'milestone30_60_90', 'probation', 'managerFeedback', 'digitalForms',
    ];
    for (const key of allKeys) {
        const enc = key.replace(/\./g, '::');
        if (stored[enc] === undefined) stored[enc] = enabledKeys.includes(key);
    }
    return {
        modules: { onboarding: { enabled: true }, offboarding: { enabled: true } },
        enabledFeatures: stored,
    };
}

describe('lifecycle runtime feature gates', () => {
    it('resolves document featureKey from catalog when missing on item', () => {
        assert.equal(resolveItemFeatureKey({ documentType: 'AADHAAR' }, 'documents'), 'compliance.india.aadhaar');
        assert.equal(resolveItemFeatureKey({ featureKey: 'buddyProgram' }), 'buddyProgram');
    });

    it('filters tasks by featureKey', () => {
        const settings = settingsWith(['industry.it.nda']);
        const tasks = [
            { title: 'NDA', featureKey: 'industry.it.nda' },
            { title: 'Aadhaar', featureKey: 'compliance.india.aadhaar' },
            { title: 'Generic', featureKey: null },
        ];
        const filtered = filterByFeatureKey(tasks, settings);
        assert.equal(filtered.length, 2);
        assert.ok(filtered.some((t) => t.title === 'NDA'));
        assert.ok(filtered.some((t) => t.title === 'Generic'));
        assert.ok(!filtered.some((t) => t.title === 'Aadhaar'));
    });

    it('removes India compliance tasks when pack features are off', () => {
        const settings = settingsWith(['documentCollection', 'joiningChecklist']);
        const workflow = {
            tasks: [
                { title: 'Collect and verify Aadhaar', featureKey: 'compliance.india.aadhaar' },
                { title: 'Day 1 welcome', featureKey: null },
            ],
            documents: [
                { documentType: 'AADHAAR', name: 'Aadhaar', featureKey: 'compliance.india.aadhaar' },
                { documentType: 'DEGREE', name: 'Degree', featureKey: 'documentCollection' },
            ],
            checklist: [
                { item: 'Aadhaar verified', featureKey: 'compliance.india.aadhaar' },
                { item: 'Welcome done', featureKey: 'induction' },
            ],
        };
        applyOnboardingFeatureGates(workflow, settings);
        assert.ok(!workflow.tasks.some((t) => t.featureKey === 'compliance.india.aadhaar'));
        assert.ok(workflow.tasks.some((t) => t.title === 'Day 1 welcome'));
        assert.ok(!workflow.documents.some((d) => d.documentType === 'AADHAAR'));
        assert.ok(workflow.documents.some((d) => d.documentType === 'DEGREE'));
    });

    it('waives exit interview and F&F when disabled', () => {
        const settings = settingsWith(['clearance', 'assetReturn']);
        const workflow = {
            tasks: [
                { title: 'Complete exit interview', featureKey: 'exitInterview' },
                { title: 'Calculate F&F', featureKey: 'fnfSettlement' },
                { title: 'Return badge', featureKey: 'assetReturn' },
            ],
            exitInterview: { status: 'Pending', mandatory: true },
            finalSettlement: { status: 'Pending', mandatory: true },
            clearanceChecklist: [{ item: 'HR clearance', featureKey: 'clearance' }],
            assets: [{ name: 'Laptop', featureKey: 'assetReturn' }],
        };
        applyOffboardingFeatureGates(workflow, settings);
        assert.equal(workflow.exitInterview.status, 'Waived');
        assert.equal(workflow.finalSettlement.status, 'Waived');
        assert.ok(!workflow.tasks.some((t) => t.featureKey === 'exitInterview'));
        assert.ok(!workflow.tasks.some((t) => t.featureKey === 'fnfSettlement'));
        assert.ok(workflow.tasks.some((t) => t.featureKey === 'assetReturn'));
    });
});
