/**
 * Seeds default India lifecycle forms (emergency contact, nominee, tax, bank, UAN).
 */

import { LifecycleFormDefinition } from '../models/lifecycle.model.js';
import { publishForm } from './lifecycleFormService.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, updateLifecycleSettings } from './lifecycleConfigService.js';

const MANDATORY_FORM_FEATURE_KEYS = ['digitalForms', 'emergencyContact', 'familyNominee', 'bankDetails'];

export const DEFAULT_FORMS = [
    {
        name: 'Emergency Contact Details',
        category: 'onboarding',
        featureKey: 'emergencyContact',
        stageKey: 'documentation',
        mandatory: true,
        fields: [
            { key: 'primaryName', label: 'Primary Contact Name', type: 'text', required: true, order: 0 },
            { key: 'primaryRelationship', label: 'Relationship', type: 'dropdown', required: true, options: ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'], order: 1 },
            { key: 'primaryPhone', label: 'Primary Phone', type: 'phone', required: true, order: 2 },
            { key: 'primaryEmail', label: 'Primary Email', type: 'email', required: false, order: 3 },
            { key: 'secondaryName', label: 'Secondary Contact Name', type: 'text', required: false, order: 4 },
            { key: 'secondaryPhone', label: 'Secondary Phone', type: 'phone', required: false, order: 5 },
        ],
    },
    {
        name: 'Family & Nominee Details',
        category: 'onboarding',
        featureKey: 'familyNominee',
        stageKey: 'documentation',
        mandatory: true,
        fields: [
            { key: 'fatherName', label: "Father's Name", type: 'text', required: true, order: 0 },
            { key: 'motherName', label: "Mother's Name", type: 'text', required: false, order: 1 },
            { key: 'maritalStatus', label: 'Marital Status', type: 'dropdown', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'], order: 2 },
            { key: 'nomineeName', label: 'Nominee Name', type: 'text', required: true, order: 3 },
            { key: 'nomineeRelationship', label: 'Nominee Relationship', type: 'text', required: true, order: 4 },
            { key: 'nomineeShare', label: 'Nominee Share %', type: 'number', required: true, order: 5 },
        ],
    },
    {
        name: 'Bank Account Details',
        category: 'onboarding',
        featureKey: 'bankDetails',
        stageKey: 'documentation',
        mandatory: true,
        fields: [
            { key: 'accountName', label: 'Account Holder Name', type: 'text', required: true, order: 0 },
            { key: 'bankName', label: 'Bank Name', type: 'text', required: true, order: 1 },
            { key: 'accountNumber', label: 'Account Number', type: 'text', required: true, order: 2 },
            { key: 'ifsc', label: 'IFSC Code', type: 'text', required: true, order: 3 },
            { key: 'branch', label: 'Branch', type: 'text', required: false, order: 4 },
        ],
    },
    {
        name: 'Tax Declaration (India)',
        category: 'onboarding',
        featureKey: 'digitalForms',
        stageKey: 'documentation',
        mandatory: true,
        fields: [
            { key: 'panNumber', label: 'PAN Number', type: 'text', required: true, order: 0 },
            { key: 'taxRegime', label: 'Tax Regime', type: 'radio', required: true, options: ['Old', 'New'], order: 1 },
            { key: 'epfUan', label: 'EPF UAN', type: 'text', required: false, order: 2 },
            { key: 'previousEmployerTds', label: 'Previous Employer TDS', type: 'number', required: false, order: 3 },
        ],
    },
    {
        name: 'Investment Declaration (80C/80D)',
        category: 'compliance',
        featureKey: 'compliance.india.investmentDeclaration',
        stageKey: 'documentation',
        mandatory: false,
        fields: [
            { key: 'section80C', label: '80C Investments', type: 'number', required: false, order: 0 },
            { key: 'section80D', label: '80D Medical Insurance', type: 'number', required: false, order: 1 },
            { key: 'hraClaim', label: 'HRA Claim', type: 'checkbox', required: false, order: 2 },
            { key: 'landlordPan', label: 'Landlord PAN', type: 'text', required: false, order: 3 },
        ],
    },
];

export async function seedDefaultLifecycleForms(organizationId, { actor, req } = {}) {
    const created = [];
    for (const template of DEFAULT_FORMS) {
        const exists = await LifecycleFormDefinition.findOne({ organizationId, name: template.name }).lean();
        if (exists) {
            created.push(exists);
            continue;
        }
        const form = await LifecycleFormDefinition.create({
            organizationId,
            name: template.name,
            category: template.category,
            module: 'onboarding',
            featureKey: template.featureKey,
            stageKey: template.stageKey,
            fields: template.fields,
            status: 'Draft',
            isActive: true,
            tags: ['default', 'india', ...(template.mandatory ? ['mandatory'] : [])],
        });
        try {
            await publishForm(organizationId, form._id, { actor, req });
        } catch {
            form.status = 'Published';
            form.publishedAt = new Date();
            await form.save();
        }
        created.push(form);
    }
    return created;
}

/**
 * Ensures default mandatory onboarding forms exist, are published, and related features are on.
 * Safe to call repeatedly (idempotent).
 */
export async function ensureMandatoryOnboardingForms(organizationId, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const featureUpdates = {};
    for (const key of MANDATORY_FORM_FEATURE_KEYS) {
        if (!isFeatureEnabled(settings, key)) featureUpdates[key] = true;
    }
    if (Object.keys(featureUpdates).length) {
        await updateLifecycleSettings(organizationId, { enabledFeatures: featureUpdates }, { actor, req });
    }

    await seedDefaultLifecycleForms(organizationId, { actor, req });

    const mandatoryTemplates = DEFAULT_FORMS.filter((f) => f.mandatory);
    for (const template of mandatoryTemplates) {
        const form = await LifecycleFormDefinition.findOne({ organizationId, name: template.name });
        if (!form) continue;
        if (form.status !== 'Published' || !form.isActive) {
            try {
                await publishForm(organizationId, form._id, { actor, req });
            } catch {
                form.status = 'Published';
                form.publishedAt = form.publishedAt || new Date();
                form.isActive = true;
                await form.save();
            }
        }
        const nextTags = [...new Set([...(form.tags || []), 'default', 'mandatory'])];
        const prevTags = form.tags || [];
        if (nextTags.length !== prevTags.length || !prevTags.includes('mandatory')) {
            form.tags = nextTags;
            await form.save();
        }
    }

    return mandatoryTemplates.length;
}

export async function getMandatoryFormsForWorkflow(organizationId, settings) {
    const forms = await LifecycleFormDefinition.find({
        organizationId,
        status: 'Published',
        isActive: true,
        category: { $in: ['onboarding', 'compliance'] },
    }).lean();
    return forms.filter((f) => DEFAULT_FORMS.some((d) => d.name === f.name && d.mandatory));
}
