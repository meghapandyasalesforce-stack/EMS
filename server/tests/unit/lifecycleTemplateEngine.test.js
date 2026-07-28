import { describe, expect, it } from '@jest/globals';
import {
    filterByEnabledFeatures,
    itemMatchesFeatures,
} from '../../constants/lifecycleSharedSchemas.js';
import { applyFeatureGateToTemplate } from '../../services/lifecycleTemplateEngine.js';
import { resolveFeatureDependencies } from '../../constants/lifecycleFeatureRegistry.js';

describe('lifecycle template engine', () => {
    const allFeatures = new Set([
        'documentCollection', 'bankDetails', 'buddyProgram', 'itAssetProvisioning',
        'payrollSetup', 'induction', 'assetReturn', 'clearance',
    ]);

    const template = {
        stages: [
            { key: 'docs', name: 'Docs', featureKey: 'documentCollection', order: 0 },
            { key: 'buddy', name: 'Buddy', featureKey: 'buddyProgram', order: 1 },
        ],
        tasks: [
            { title: 'Upload docs', featureKey: 'documentCollection', order: 0 },
            { title: 'Buddy meet', featureKey: 'buddyProgram', order: 1 },
        ],
        checklist: [{ item: 'Laptop', featureKey: 'itAssetProvisioning' }],
    };

    it('filters items when feature is disabled', () => {
        const enabled = new Set([...allFeatures].filter((f) => f !== 'buddyProgram'));
        const gated = applyFeatureGateToTemplate(template, enabled);
        expect(gated.tasks.map((t) => t.title)).toEqual(['Upload docs']);
        expect(gated.stages.map((s) => s.key)).toEqual(['docs']);
    });

    it('includes all items when features are enabled', () => {
        const gated = applyFeatureGateToTemplate(template, allFeatures);
        expect(gated.tasks).toHaveLength(2);
        expect(gated.stages).toHaveLength(2);
    });

    it('itemMatchesFeatures respects always visibility', () => {
        expect(itemMatchesFeatures({ visibility: { condition: 'always' } }, new Set())).toBe(true);
    });

    it('resolveFeatureDependencies removes dependents when parent disabled', () => {
        const resolved = resolveFeatureDependencies(['offerApproval']);
        expect(resolved).not.toContain('offerApproval');
        const withParent = resolveFeatureDependencies(['offerApproval', 'offerLetter']);
        expect(withParent).toContain('offerLetter');
        expect(withParent).toContain('offerApproval');
    });

    it('filterByEnabledFeatures returns empty for disabled module items', () => {
        const items = [{ featureKey: 'buddyProgram' }, { featureKey: 'induction' }];
        expect(filterByEnabledFeatures(items, new Set(['induction']))).toHaveLength(1);
    });
});
