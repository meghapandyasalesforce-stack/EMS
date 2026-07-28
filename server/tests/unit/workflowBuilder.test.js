import { describe, expect, it } from '@jest/globals';
import { buildTemplatePreview } from '../../services/lifecycleTemplateEngine.js';

describe('workflow builder template preview', () => {
    it('builds timeline with groups and dependencies', () => {
        const preview = buildTemplatePreview({
            _id: 'tpl1',
            name: 'Test Onboarding',
            status: 'Draft',
            version: 2,
            expectedDays: 30,
            stageGroups: [{ key: 'grp1', name: 'Setup', order: 0 }],
            stages: [
                { key: 'docs', name: 'Documentation', order: 0, mandatory: true, dueDaysFromStart: 3, groupKey: 'grp1' },
                { key: 'it', name: 'IT Setup', order: 1, mandatory: true, dependsOn: ['docs'], slaDays: 2 },
            ],
        }, 'onboarding');

        expect(preview.stageCount).toBe(2);
        expect(preview.mandatoryStageCount).toBe(2);
        expect(preview.timeline[1].dependsOn).toEqual(['docs']);
        expect(preview.timeline[0].groupName).toBe('Setup');
        expect(preview.timeline[0].dueLabel).toBe('Day 3');
    });
});
