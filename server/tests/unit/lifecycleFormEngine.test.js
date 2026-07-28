import { describe, expect, it } from '@jest/globals';
import {
    isFieldVisible,
    isFieldRequired,
    validateFormResponses,
    buildFormPreview,
    getVisibleFields,
} from '../../services/lifecycleFormEngine.js';

const baseFields = [
    { key: 'employee_type', label: 'Employee Type', type: 'dropdown', required: false, order: 0 },
    {
        key: 'pan',
        label: 'PAN',
        type: 'text',
        required: false,
        order: 1,
        conditionalRules: [{
            action: 'show',
            combinator: 'and',
            conditions: [{ fieldKey: 'employee_type', operator: 'equals', value: 'full_time' }],
        }, {
            action: 'require',
            combinator: 'and',
            conditions: [{ fieldKey: 'employee_type', operator: 'equals', value: 'full_time' }],
        }],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', required: false, order: 2 },
];

describe('lifecycleFormEngine', () => {
    it('shows PAN only when employee type is full time', () => {
        expect(isFieldVisible(baseFields[1], { employee_type: 'full_time' })).toBe(true);
        expect(isFieldVisible(baseFields[1], { employee_type: 'contract' })).toBe(false);
    });

    it('conditionally requires PAN for full time employees', () => {
        expect(isFieldRequired(baseFields[1], { employee_type: 'full_time' })).toBe(true);
        expect(isFieldRequired(baseFields[1], { employee_type: 'contract' })).toBe(false);
    });

    it('validates required visible fields', () => {
        const errors = validateFormResponses(baseFields, { employee_type: 'full_time' });
        expect(errors.some((e) => e.fieldKey === 'pan')).toBe(true);
        const ok = validateFormResponses(baseFields, { employee_type: 'full_time', pan: 'ABCDE1234F' });
        expect(ok).toHaveLength(0);
    });

    it('excludes hidden fields from visible set', () => {
        const visible = getVisibleFields(baseFields, { employee_type: 'contract' });
        expect(visible.map((f) => f.key)).not.toContain('pan');
    });

    it('builds form preview metadata', () => {
        const preview = buildFormPreview({
            _id: 'f1',
            name: 'KYC Form',
            version: 2,
            status: 'Published',
            category: 'compliance',
            fields: baseFields,
        });
        expect(preview.fieldCount).toBe(3);
        expect(preview.requiredFieldCount).toBe(0);
        expect(preview.fields[1].hasConditionalRules).toBe(true);
    });
});
