/**
 * Lifecycle configuration service — org settings, feature resolution, catalog.
 */

import Organization from '../models/organization.model.js';
import {
    LifecycleSettings,
    LifecycleFormDefinition,
    LifecycleDocumentCatalogEntry,
} from '../models/lifecycle.model.js';
import {
    LIFECYCLE_FEATURES,
    getDefaultEnabledFeatureKeys,
    resolveFeatureDependencies,
} from '../constants/lifecycleFeatureRegistry.js';
import { LIFECYCLE_INDUSTRY_FEATURES, LIFECYCLE_INDUSTRY_PACKS } from '../constants/lifecycleIndustryPacks.js';
import { LIFECYCLE_COMPLIANCE_FEATURES, LIFECYCLE_COMPLIANCE_PACKS } from '../constants/lifecycleCompliancePacks.js';
import { LIFECYCLE_DOCUMENT_CATALOG, LIFECYCLE_DOCUMENT_HUB_CATEGORIES, getCatalogByModule } from '../constants/lifecycleDocumentCatalog.js';
import { LIFECYCLE_FORM_FIELD_TYPES } from '../constants/lifecycleSharedSchemas.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import {
    listForms,
    createForm,
    updateForm,
} from './lifecycleFormService.js';

export function getFullFeatureRegistry() {
    return [...LIFECYCLE_FEATURES, ...LIFECYCLE_INDUSTRY_FEATURES, ...LIFECYCLE_COMPLIANCE_FEATURES];
}

/** MongoDB/Mongoose treat "." in object keys as nested paths — encode for Mixed storage. */
const FEATURE_KEY_DOT = '::';

export function encodeFeatureStorageKey(key) {
    return String(key || '').replace(/\./g, FEATURE_KEY_DOT);
}

export function decodeFeatureStorageKey(key) {
    return String(key || '').split(FEATURE_KEY_DOT).join('.');
}

function mapToObject(mapOrObj) {
    if (!mapOrObj) return {};
    if (mapOrObj instanceof Map) return Object.fromEntries(mapOrObj.entries());
    if (typeof mapOrObj === 'object' && !Array.isArray(mapOrObj)) {
        // Prefer toObject for mongoose subdocs / Mixed
        if (typeof mapOrObj.toObject === 'function') return mapOrObj.toObject();
        return { ...mapOrObj };
    }
    return {};
}

/**
 * Read enabledFeatures from DB into a flat featureKey → boolean map.
 * Supports: encoded keys (a::b), literal dotted keys, and legacy nested objects.
 */
export function featuresFromStorage(stored) {
    const raw = mapToObject(stored);
    const flat = {};

    const walk = (node, pathParts) => {
        if (node === null || node === undefined) return;
        if (typeof node !== 'object' || Array.isArray(node) || node instanceof Date) {
            if (pathParts.length) flat[pathParts.join('.')] = node === true;
            return;
        }
        for (const [k, v] of Object.entries(node)) {
            if (k.includes(FEATURE_KEY_DOT)) {
                flat[decodeFeatureStorageKey(k)] = v === true;
                continue;
            }
            // Literal dotted feature key stored as a single field name
            if (k.includes('.') && (typeof v === 'boolean' || v === true || v === false)) {
                flat[k] = v === true;
                continue;
            }
            walk(v, [...pathParts, k]);
        }
    };
    walk(raw, []);
    return flat;
}

function featuresToStorage(flatMap) {
    const out = {};
    for (const [key, enabled] of Object.entries(flatMap || {})) {
        out[encodeFeatureStorageKey(key)] = enabled === true;
    }
    return out;
}

function buildDefaultEnabledFeaturesMap() {
    const defaults = {};
    for (const feature of getFullFeatureRegistry()) {
        defaults[feature.key] = feature.defaultEnabled !== false;
    }
    return defaults;
}

/**
 * Persist a complete featureKey → boolean map for the org.
 * Partial UI updates are merged onto existing settings, then dependency-resolved.
 */
function assignEnabledFeatures(settings, updates) {
    const complete = {
        ...buildDefaultEnabledFeaturesMap(),
        ...featuresFromStorage(settings.enabledFeatures),
        ...Object.fromEntries(
            Object.entries(updates || {}).map(([k, v]) => [decodeFeatureStorageKey(k), v === true]),
        ),
    };

    const enabledList = Object.entries(complete)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key);
    const resolved = new Set(resolveFeatureDependencies(enabledList));

    const finalMap = {};
    for (const feature of getFullFeatureRegistry()) {
        finalMap[feature.key] = resolved.has(feature.key);
    }

    settings.enabledFeatures = featuresToStorage(finalMap);
    settings.markModified('enabledFeatures');
}

export function resolveEnabledFeatureSet(settings) {
    const raw = featuresFromStorage(settings?.enabledFeatures);
    const keys = Object.keys(raw);

    // Never configured → registry defaults
    if (!keys.length) {
        return new Set(getDefaultEnabledFeatureKeys());
    }

    // Configured (including all-disabled) → honor stored booleans; never reset to defaults
    const enabledKeys = Object.entries(raw)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => key);
    return new Set(resolveFeatureDependencies(enabledKeys));
}

export function isFeatureEnabled(settings, featureKey) {
    if (!featureKey) return true;
    if (!settings?.modules) return true;
    const feature = getFullFeatureRegistry().find((f) => f.key === featureKey);
    if (feature?.module === 'onboarding' && settings.modules.onboarding?.enabled === false) return false;
    if (feature?.module === 'offboarding' && settings.modules.offboarding?.enabled === false) return false;
    return resolveEnabledFeatureSet(settings).has(featureKey);
}

export function isModuleEnabled(settings, module) {
    if (!settings?.modules) return true;
    return settings.modules[module]?.enabled !== false;
}

/** Thrown when Configure has disabled a feature — map to HTTP 403. */
export class LifecycleFeatureDisabledError extends Error {
    constructor(featureKey, label = null) {
        super(`${label || featureKey} is disabled in Employee Lifecycle → Configure`);
        this.name = 'LifecycleFeatureDisabledError';
        this.status = 403;
        this.statusCode = 403;
        this.code = 'FEATURE_DISABLED';
        this.featureKey = featureKey;
        this.isCustom = true;
    }
}

/**
 * Hard runtime gate — throws LifecycleFeatureDisabledError (403) if feature is off.
 * Use at service entry points and controllers so Configure is SSOT for APIs/jobs/integrations.
 */
export async function assertFeatureEnabled(organizationId, featureKey, label = null) {
    if (!featureKey) return getOrCreateLifecycleSettings(organizationId);
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, featureKey)) {
        throw new LifecycleFeatureDisabledError(featureKey, label);
    }
    return settings;
}

/** Pass if ANY of the keys is enabled. */
export async function assertAnyFeatureEnabled(organizationId, featureKeys = [], label = null) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const keys = Array.isArray(featureKeys) ? featureKeys.filter(Boolean) : [];
    if (!keys.length) return settings;
    if (!keys.some((k) => isFeatureEnabled(settings, k))) {
        throw new LifecycleFeatureDisabledError(keys[0], label || keys.join(' / '));
    }
    return settings;
}

export async function assertModuleEnabled(organizationId, moduleName, label = null) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isModuleEnabled(settings, moduleName)) {
        throw new LifecycleFeatureDisabledError(moduleName, label || `${moduleName} module`);
    }
    return settings;
}

/**
 * Soft check for jobs/notifications — returns false instead of throwing.
 */
export async function isOrgFeatureEnabled(organizationId, featureKey) {
    if (!featureKey) return true;
    const settings = await getOrCreateLifecycleSettings(organizationId);
    return isFeatureEnabled(settings, featureKey);
}

export async function getOrCreateLifecycleSettings(organizationId) {
    let settings = await LifecycleSettings.findOne({ organizationId });
    if (settings) return settings;

    const org = await Organization.findById(organizationId)
        .select('onboardingSettings')
        .lean();

    const defaultFeatures = featuresToStorage(buildDefaultEnabledFeaturesMap());
    settings = await LifecycleSettings.create({
        organizationId,
        modules: { onboarding: { enabled: true }, offboarding: { enabled: true } },
        enabledFeatures: defaultFeatures,
        onboarding: {
            autoCreateOnEmployeeRegister: org?.onboardingSettings?.autoCreateOnEmployeeRegister ?? false,
            startWorkflowOnJoiningDate: org?.onboardingSettings?.startWorkflowOnJoiningDate ?? true,
        },
        defaults: {
            onboardingTemplateId: org?.onboardingSettings?.defaultTemplateId || undefined,
        },
        reminders: [
            { key: 'task_due_reminder', label: 'Task Due Reminder', featureKey: 'reminders', daysBeforeDue: 1, channels: ['email', 'in_app'] },
            { key: 'document_due_reminder', label: 'Document Due Reminder', featureKey: 'documentCollection', daysBeforeDue: 2, channels: ['email', 'in_app'] },
        ],
        escalations: [
            { key: 'task_overdue_escalation', label: 'Overdue Task Escalation', featureKey: 'escalations', daysAfterDue: 2, escalateToRole: 'hr', channels: ['email', 'in_app'] },
        ],
        approvals: [
            { entityType: 'Offer', enabled: false, featureKey: 'offerApproval' },
            { entityType: 'Onboarding', enabled: false, featureKey: 'documentApproval' },
            { entityType: 'Offboarding', enabled: false, featureKey: 'clearance' },
            { entityType: 'Clearance', enabled: false, featureKey: 'clearance' },
            { entityType: 'ExitInterview', enabled: false, featureKey: 'exitInterview' },
            { entityType: 'FnF', enabled: false, featureKey: 'fnfSettlement' },
            { entityType: 'AssetReturn', enabled: false, featureKey: 'assetReturn' },
        ],
    });

    return settings;
}

export async function getLifecycleSettingsForOrg(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const plain = settings.toObject ? settings.toObject({ flattenMaps: true }) : settings;
    return {
        ...plain,
        // Always return flat decoded keys for API / UI consumers
        enabledFeatures: featuresFromStorage(settings.enabledFeatures),
    };
}

/** Backward-compatible bridge for existing onboardingSettings consumers */
export async function getOrgLifecycleOnboardingBridge(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    return {
        autoCreateOnEmployeeRegister: settings.onboarding?.autoCreateOnEmployeeRegister ?? false,
        startWorkflowOnJoiningDate: settings.onboarding?.startWorkflowOnJoiningDate ?? true,
        defaultTemplateId: settings.defaults?.onboardingTemplateId || null,
        defaultOffboardingTemplateId: settings.defaults?.offboardingTemplateId || null,
        modules: settings.modules,
        enabledFeatures: featuresFromStorage(settings.enabledFeatures),
    };
}

export async function updateLifecycleSettings(organizationId, updates, { req = null, actor = null } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const before = settings.toObject();

    if (updates.modules) {
        settings.modules = { ...settings.modules?.toObject?.() || settings.modules, ...updates.modules };
    }
    if (updates.onboarding) {
        settings.onboarding = { ...settings.onboarding?.toObject?.() || settings.onboarding, ...updates.onboarding };
    }
    if (updates.notifications) {
        settings.notifications = { ...settings.notifications?.toObject?.() || settings.notifications, ...updates.notifications };
    }
    if (updates.defaults) {
        settings.defaults = { ...settings.defaults?.toObject?.() || settings.defaults, ...updates.defaults };
    }
    if (updates.enabledFeatures) {
        assignEnabledFeatures(settings, updates.enabledFeatures);
    }
    if (updates.reminders) settings.reminders = updates.reminders;
    if (updates.escalations) settings.escalations = updates.escalations;
    if (updates.approvals) settings.approvals = updates.approvals;
    if (updates.documentOverrides) settings.documentOverrides = updates.documentOverrides;
    if (updates.noticePeriodPolicy) {
        settings.noticePeriodPolicy = {
            ...settings.noticePeriodPolicy?.toObject?.() || settings.noticePeriodPolicy || {},
            ...updates.noticePeriodPolicy,
        };
    }
    if (updates.fnfPolicy) {
        settings.fnfPolicy = {
            ...settings.fnfPolicy?.toObject?.() || settings.fnfPolicy || {},
            ...updates.fnfPolicy,
        };
    }
    if (updates.bgvPolicy) {
        settings.bgvPolicy = {
            ...settings.bgvPolicy?.toObject?.() || settings.bgvPolicy || {},
            ...updates.bgvPolicy,
        };
    }
    if (updates.esignProvider) settings.esignProvider = updates.esignProvider;
    if (updates.offerPolicy) {
        settings.offerPolicy = {
            ...settings.offerPolicy?.toObject?.() || settings.offerPolicy || {},
            ...updates.offerPolicy,
        };
    }
    if (updates.exitInterviewPolicy) {
        settings.exitInterviewPolicy = {
            ...settings.exitInterviewPolicy?.toObject?.() || settings.exitInterviewPolicy || {},
            ...updates.exitInterviewPolicy,
        };
    }

    await settings.save();

    // Sync legacy org.onboardingSettings for backward compatibility
    await Organization.findByIdAndUpdate(organizationId, {
        $set: {
            'onboardingSettings.autoCreateOnEmployeeRegister': settings.onboarding?.autoCreateOnEmployeeRegister ?? false,
            'onboardingSettings.startWorkflowOnJoiningDate': settings.onboarding?.startWorkflowOnJoiningDate ?? true,
            'onboardingSettings.defaultTemplateId': settings.defaults?.onboardingTemplateId || null,
        },
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: 'Lifecycle Settings',
        req,
        actor,
        before,
        after: settings.toObject(),
    });

    return getLifecycleSettingsForOrg(organizationId);
}

export async function installIndustryPack(organizationId, packKey, { req = null, actor = null } = {}) {
    const pack = LIFECYCLE_INDUSTRY_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new Error(`Unknown industry pack: ${packKey}`);

    const settings = await getOrCreateLifecycleSettings(organizationId);
    const existing = settings.industryPacks.find((p) => p.packKey === packKey);
    if (existing) {
        existing.enabled = true;
        existing.installedAt = new Date();
    } else {
        settings.industryPacks.push({ packKey, enabled: true, installedAt: new Date() });
    }

    const featureUpdates = {};
    for (const key of pack.features) featureUpdates[key] = true;
    assignEnabledFeatures(settings, featureUpdates);

    await settings.save();
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: `Industry Pack: ${pack.label}`,
        req,
        actor,
        metadata: { packKey, action: 'install' },
    });
    return getLifecycleSettingsForOrg(organizationId);
}

export async function uninstallIndustryPack(organizationId, packKey, { req = null, actor = null } = {}) {
    const pack = LIFECYCLE_INDUSTRY_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new Error(`Unknown industry pack: ${packKey}`);

    const settings = await getOrCreateLifecycleSettings(organizationId);
    const existing = settings.industryPacks.find((p) => p.packKey === packKey);
    if (existing) {
        existing.enabled = false;
    }

    const featureUpdates = {};
    for (const key of pack.features) featureUpdates[key] = false;
    assignEnabledFeatures(settings, featureUpdates);

    await settings.save();
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: `Industry Pack: ${pack.label}`,
        req,
        actor,
        metadata: { packKey, action: 'uninstall' },
    });
    return getLifecycleSettingsForOrg(organizationId);
}

export async function installCompliancePack(organizationId, packKey, { req = null, actor = null } = {}) {
    const pack = LIFECYCLE_COMPLIANCE_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new Error(`Unknown compliance pack: ${packKey}`);

    const settings = await getOrCreateLifecycleSettings(organizationId);
    const existing = settings.compliancePacks.find((p) => p.packKey === packKey);
    if (existing) {
        existing.enabled = true;
        existing.installedAt = new Date();
    } else {
        settings.compliancePacks.push({ packKey, enabled: true, installedAt: new Date() });
    }

    const featureUpdates = {};
    for (const key of pack.features) featureUpdates[key] = true;
    assignEnabledFeatures(settings, featureUpdates);

    await settings.save();

    for (const catalogKey of pack.documentKeys || []) {
        const systemDoc = LIFECYCLE_DOCUMENT_CATALOG.find((d) => d.key === catalogKey);
        if (!systemDoc) continue;
        await LifecycleDocumentCatalogEntry.findOneAndUpdate(
            { organizationId, catalogKey },
            {
                $setOnInsert: {
                    organizationId,
                    catalogKey,
                    label: systemDoc.label,
                    module: systemDoc.module,
                    featureKey: systemDoc.featureKey,
                    mandatory: systemDoc.mandatory,
                    approvalRequired: systemDoc.approvalRequired,
                    expiryDays: systemDoc.expiryDays,
                    renewalReminderDays: systemDoc.renewalReminderDays,
                    versioningEnabled: systemDoc.versioningEnabled,
                    enabled: true,
                },
            },
            { upsert: true, new: true },
        );
    }

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: `Compliance Pack: ${pack.label}`,
        req,
        actor,
        metadata: { packKey, action: 'install' },
    });
    return getLifecycleSettingsForOrg(organizationId);
}

export async function uninstallCompliancePack(organizationId, packKey, { req = null, actor = null } = {}) {
    const pack = LIFECYCLE_COMPLIANCE_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new Error(`Unknown compliance pack: ${packKey}`);

    const settings = await getOrCreateLifecycleSettings(organizationId);
    const existing = settings.compliancePacks.find((p) => p.packKey === packKey);
    if (existing) {
        existing.enabled = false;
    } else {
        settings.compliancePacks.push({ packKey, enabled: false, installedAt: new Date() });
    }

    const featureUpdates = {};
    for (const key of pack.features) featureUpdates[key] = false;
    assignEnabledFeatures(settings, featureUpdates);

    await settings.save();
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleSettings',
        entityId: settings._id,
        entityName: `Compliance Pack: ${pack.label}`,
        req,
        actor,
        metadata: { packKey, action: 'uninstall' },
    });
    return getLifecycleSettingsForOrg(organizationId);
}

export async function getResolvedDocumentCatalog(organizationId, module = 'onboarding') {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const enabledFeatures = resolveEnabledFeatureSet(settings);
    const orgEntries = await LifecycleDocumentCatalogEntry.find({ organizationId }).lean();
    const orgMap = new Map(orgEntries.map((e) => [e.catalogKey, e]));

    return getCatalogByModule(module)
        .map((systemDoc) => {
            const override = orgMap.get(systemDoc.key);
            const docOverride = (settings.documentOverrides || []).find((d) => d.catalogKey === systemDoc.key);
            const enabled = override?.enabled ?? docOverride?.enabled ?? true;
            if (!enabled) return null;
            if (systemDoc.featureKey && !enabledFeatures.has(systemDoc.featureKey)) return null;
            return {
                ...systemDoc,
                ...override,
                hubCategory: override?.hubCategory || systemDoc.hubCategory,
                mandatory: docOverride?.mandatory ?? override?.mandatory ?? systemDoc.mandatory,
                approvalRequired: docOverride?.approvalRequired ?? override?.approvalRequired ?? systemDoc.approvalRequired,
            };
        })
        .filter(Boolean);
}

export async function listFormDefinitions(organizationId, { module = null, activeOnly = true } = {}) {
    return listForms(organizationId, {
        category: module && module !== 'both' ? module : undefined,
        activeOnly,
    });
}

export async function upsertFormDefinition(organizationId, payload, { req = null, actor = null } = {}) {
    const { id, ...data } = payload;
    if (id) {
        return updateForm(organizationId, id, data, { actor, req });
    }
    return createForm(organizationId, data, { actor, req });
}

export function getLifecycleConfigurationSnapshot(organizationId) {
    return Promise.all([
        getLifecycleSettingsForOrg(organizationId),
        listFormDefinitions(organizationId),
        getResolvedDocumentCatalog(organizationId, 'onboarding'),
        getResolvedDocumentCatalog(organizationId, 'offboarding'),
    ]).then(([settings, forms, onboardingDocs, offboardingDocs]) => ({
        registry: {
            features: getFullFeatureRegistry(),
            industryPacks: LIFECYCLE_INDUSTRY_PACKS,
            compliancePacks: LIFECYCLE_COMPLIANCE_PACKS,
            documentCatalog: LIFECYCLE_DOCUMENT_CATALOG,
            documentHubCategories: LIFECYCLE_DOCUMENT_HUB_CATEGORIES,
            formFieldTypes: [...LIFECYCLE_FORM_FIELD_TYPES],
        },
        settings,
        forms,
        documentCatalog: { onboarding: onboardingDocs, offboarding: offboardingDocs },
    }));
}
