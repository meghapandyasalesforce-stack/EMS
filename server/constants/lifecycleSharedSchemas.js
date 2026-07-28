/**
 * Shared sub-schemas for lifecycle workflow builder foundation.
 */

import mongoose from 'mongoose';

export const lifecycleStageSchema = new mongoose.Schema({
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    order: { type: Number, default: 0 },
    mandatory: { type: Boolean, default: true },
    featureKey: String,
    visibility: {
        condition: {
            type: String,
            enum: ['always', 'feature_enabled', 'all_features_enabled'],
            default: 'feature_enabled',
        },
        requiredFeatures: [{ type: String }],
    },
    dueDaysFromStart: Number,
    dueDaysBeforeLastWorkingDate: Number,
    dueDaysAfterLastWorkingDate: Number,
    slaDays: Number,
    escalationRuleKey: String,
    groupKey: String,
    dependsOn: [{ type: String }],
    approvalRequired: { type: Boolean, default: false },
    reminderRuleKey: String,
}, { _id: true });

export const lifecycleReminderRuleSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: String,
    featureKey: String,
    enabled: { type: Boolean, default: true },
    daysBeforeDue: { type: Number, default: 1 },
    channels: {
        type: [{ type: String, enum: ['email', 'in_app', 'push'] }],
        default: ['email', 'in_app'],
    },
}, { _id: false });

export const lifecycleEscalationRuleSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: String,
    featureKey: String,
    enabled: { type: Boolean, default: true },
    daysAfterDue: { type: Number, default: 2 },
    escalateToRole: {
        type: String,
        enum: ['hr', 'manager', 'it', 'payroll', 'admin'],
        default: 'hr',
    },
    channels: {
        type: [{ type: String, enum: ['email', 'in_app', 'push'] }],
        default: ['email', 'in_app'],
    },
}, { _id: false });

export const lifecycleApprovalBindingSchema = new mongoose.Schema({
    entityType: {
        type: String,
        enum: ['Offer', 'Onboarding', 'Offboarding', 'Clearance', 'ExitInterview', 'FnF', 'AssetReturn', 'LifecycleForm'],
        required: true,
    },
    approvalWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflow' },
    enabled: { type: Boolean, default: false },
    featureKey: String,
}, { _id: false });

export const LIFECYCLE_FORM_FIELD_TYPES = Object.freeze([
    'text', 'textarea', 'number', 'email', 'phone', 'date', 'time', 'datetime',
    'dropdown', 'multiselect', 'checkbox', 'radio', 'toggle',
    'address', 'country', 'state', 'city', 'pincode',
    'employee_lookup', 'manager_lookup', 'department', 'designation',
    'file', 'image', 'signature', 'richtext',
    'heading', 'divider', 'paragraph', 'instructions',
]);

const conditionalConditionSchema = new mongoose.Schema({
    fieldKey: { type: String, required: true },
    operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'empty', 'not_empty'],
        default: 'equals',
    },
    value: mongoose.Schema.Types.Mixed,
}, { _id: false });

const conditionalRuleSchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ['show', 'hide', 'require', 'optional', 'enable', 'disable', 'set_default'],
        default: 'show',
    },
    combinator: { type: String, enum: ['and', 'or'], default: 'and' },
    conditions: [conditionalConditionSchema],
    targetValue: mongoose.Schema.Types.Mixed,
}, { _id: false });

export const lifecycleFormFieldSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
        type: String,
        enum: LIFECYCLE_FORM_FIELD_TYPES,
        required: true,
    },
    required: { type: Boolean, default: false },
    readOnly: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    placeholder: String,
    helpText: String,
    defaultValue: mongoose.Schema.Types.Mixed,
    options: [{ label: String, value: String, parentValue: String }],
    parentFieldKey: String,
    validation: {
        min: Number,
        max: Number,
        pattern: String,
        maxLength: Number,
        minLength: Number,
        allowedFileTypes: [String],
        maxFileSizeMb: Number,
    },
    conditionalRules: [conditionalRuleSchema],
    order: { type: Number, default: 0 },
    featureKey: String,
    sectionKey: String,
}, { _id: true });

export const templateItemVisibilitySchema = {
    featureKey: String,
    mandatory: { type: Boolean, default: true },
    stageKey: String,
    order: { type: Number, default: 0 },
    visibility: {
        condition: {
            type: String,
            enum: ['always', 'feature_enabled'],
            default: 'feature_enabled',
        },
        requiredFeatures: [{ type: String }],
    },
};

export function itemMatchesFeatures(item, enabledFeatures) {
    const key = item.featureKey || item.visibility?.requiredFeatures?.[0];
    if (!key) return true;
    if (item.visibility?.condition === 'always') return true;
    const required = item.visibility?.requiredFeatures?.length
        ? item.visibility.requiredFeatures
        : [key];
    return required.every((f) => enabledFeatures.has(f));
}

export function filterByEnabledFeatures(items, enabledFeatures) {
    return (items || []).filter((item) => itemMatchesFeatures(item, enabledFeatures));
}

export function sortByOrder(items) {
    return [...(items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function sortStages(stages) {
    return sortByOrder(stages);
}
