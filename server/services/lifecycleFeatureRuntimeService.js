/**
 * Runtime feature gate — Configure (enabledFeatures + packs) is the single source of truth
 * for onboarding/offboarding UI, progress, validations, packs, and workflow sections.
 */

import {
    getOrCreateLifecycleSettings,
    isFeatureEnabled,
    resolveEnabledFeatureSet,
    isModuleEnabled,
} from './lifecycleConfigService.js';
import { LIFECYCLE_DOCUMENT_CATALOG } from '../constants/lifecycleDocumentCatalog.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import {
    applyPackArtifactsToOnboardingWorkflow,
    applyPackArtifactsToOffboardingWorkflow,
} from './lifecyclePackWorkflowService.js';
import logger from '../helpers/logger.js';

export const ONBOARDING_BASE_WEIGHTS = Object.freeze({
    tasks: 0.22,
    documents: 0.18,
    checklist: 0.12,
    training: 0.08,
    policies: 0.08,
    assets: 0.08,
    forms: 0.05,
    goals: 0.05,
    bgv: 0.08,
    software: 0.06,
});

export const OFFBOARDING_BASE_WEIGHTS = Object.freeze({
    tasks: 0.25,
    checklist: 0.20,
    assets: 0.15,
    knowledgeTransfer: 0.15,
    payrollClearance: 0.15,
    accessRevocation: 0.10,
});

/** Report category → feature key(s) that must be enabled (any). */
export const REPORT_CATEGORY_FEATURES = Object.freeze({
    offerAnalytics: ['offerLetter'],
    bgvAnalytics: ['backgroundVerification'],
    documentCompletion: ['documentCollection'],
    avgOnboardingTime: ['documentCollection', 'joiningChecklist'],
    joiningTrend: ['documentCollection'],
    pendingJoining: ['documentCollection'],
    fnf: ['fnfSettlement'],
    noticePeriod: ['noticePeriod'],
    assetReturn: ['assetReturn'],
    knowledgeTransfer: ['knowledgeTransfer', 'projectHandover'],
    clearance: ['clearance', 'hrClearance'],
    exitReasons: ['exitInterview'],
    attrition: ['exitInterview', 'fnfSettlement'],
    avgExitTime: ['fnfSettlement', 'clearance'],
});

function normalizeWeights(weights) {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total <= 0) return { ...weights };
    const out = {};
    for (const [key, value] of Object.entries(weights)) {
        out[key] = value / total;
    }
    return out;
}

export function resolveOnboardingProgressWeights(settings) {
    const w = { ...ONBOARDING_BASE_WEIGHTS };
    if (!settings) return normalizeWeights(w);
    if (!isFeatureEnabled(settings, 'documentCollection')) w.documents = 0;
    if (!isFeatureEnabled(settings, 'joiningChecklist') && !isFeatureEnabled(settings, 'induction')) w.checklist = 0;
    if (!isFeatureEnabled(settings, 'mandatoryTraining') && !isFeatureEnabled(settings, 'trainingLms')) w.training = 0;
    if (!isFeatureEnabled(settings, 'eSignature')) w.policies = 0;
    if (!isFeatureEnabled(settings, 'itAssetProvisioning')) w.assets = 0;
    if (!isFeatureEnabled(settings, 'digitalForms') && !isFeatureEnabled(settings, 'emergencyContact') && !isFeatureEnabled(settings, 'familyNominee') && !isFeatureEnabled(settings, 'bankDetails')) {
        w.forms = 0;
    }
    if (!isFeatureEnabled(settings, 'goalAssignment')) w.goals = 0;
    if (!isFeatureEnabled(settings, 'backgroundVerification')) w.bgv = 0;
    if (!isFeatureEnabled(settings, 'softwareAccessRequest')) w.software = 0;
    // If all section buckets off, keep a tiny tasks weight so progress stays defined
    if (Object.values(w).every((v) => v === 0)) w.tasks = 1;
    return normalizeWeights(w);
}

export function resolveOffboardingProgressWeights(settings) {
    const w = { ...OFFBOARDING_BASE_WEIGHTS };
    if (!settings) return normalizeWeights(w);
    if (!isFeatureEnabled(settings, 'clearance') && !isFeatureEnabled(settings, 'hrClearance')) w.checklist = 0;
    if (!isFeatureEnabled(settings, 'assetReturn')) w.assets = 0;
    if (!isFeatureEnabled(settings, 'knowledgeTransfer') && !isFeatureEnabled(settings, 'projectHandover')) w.knowledgeTransfer = 0;
    if (!isFeatureEnabled(settings, 'fnfSettlement')) w.payrollClearance = 0;
    if (!isFeatureEnabled(settings, 'accessRevocation') && !isFeatureEnabled(settings, 'emailAccessRemoval')) w.accessRevocation = 0;
    if (Object.values(w).every((v) => v === 0)) w.tasks = 1;
    return normalizeWeights(w);
}

function catalogFeatureKeyForDoc(documentType) {
    return LIFECYCLE_DOCUMENT_CATALOG.find((d) => d.key === documentType)?.featureKey || null;
}

/**
 * Resolve featureKey for a workflow sub-item (task, doc, checklist, etc.).
 */
export function resolveItemFeatureKey(item, field = null) {
    if (!item) return null;
    if (item.featureKey) return item.featureKey;
    if (field === 'documents' || item.documentType) {
        return catalogFeatureKeyForDoc(item.documentType);
    }
    return null;
}

/**
 * Keep items whose feature is enabled (or that have no featureKey).
 */
export function filterByFeatureKey(items, settings, field = null) {
    return (items || []).filter((item) => {
        const key = resolveItemFeatureKey(item, field);
        if (!key) return true;
        return isFeatureEnabled(settings, key);
    });
}

/**
 * Stamp catalog featureKey onto documents missing one (enables gating of legacy rows).
 */
function stampDocumentFeatureKeys(workflow) {
    let changed = false;
    for (const doc of workflow.documents || []) {
        if (doc.featureKey) continue;
        const fk = catalogFeatureKeyForDoc(doc.documentType);
        if (fk) {
            doc.featureKey = fk;
            changed = true;
        }
    }
    return changed;
}

/**
 * Mutates onboarding workflow so disabled Configure features are waived/cleared.
 * Returns true if any field changed.
 */
export function applyOnboardingFeatureGates(workflow, settings) {
    if (!workflow || !settings) return false;
    let changed = stampDocumentFeatureKeys(workflow);

    const gateArray = (field, enabled) => {
        if (enabled) return;
        if (Array.isArray(workflow[field]) && workflow[field].length) {
            workflow[field] = [];
            changed = true;
        }
    };

    if (!isModuleEnabled(settings, 'onboarding')) {
        for (const field of ['tasks', 'documents', 'checklist', 'assets', 'trainingModules', 'policySignatures', 'softwareRequests', 'buddyCheckins', 'milestones', 'managerActions', 'assignedGoalIds', 'onboardingGoals']) {
            gateArray(field, false);
        }
        return true;
    }

    if (!isFeatureEnabled(settings, 'buddyProgram')) {
        gateArray('buddyCheckins', false);
        const before = (workflow.tasks || []).length;
        workflow.tasks = (workflow.tasks || []).filter((t) => t.assigneeRole !== 'buddy' && t.featureKey !== 'buddyProgram');
        if (workflow.tasks.length !== before) changed = true;
    }

    if (!isFeatureEnabled(settings, 'milestone30_60_90')) {
        gateArray('milestones', false);
    }

    if (!isFeatureEnabled(settings, 'probation')) {
        if (workflow.probation && workflow.probation.status !== 'Waived') {
            workflow.probation = { ...(workflow.probation.toObject?.() || workflow.probation), status: 'Waived' };
            changed = true;
        }
    }

    if (!isFeatureEnabled(settings, 'managerFeedback')) {
        gateArray('managerActions', false);
    }

    if (!isFeatureEnabled(settings, 'goalAssignment')) {
        if (workflow.goalsProgress !== 100) { workflow.goalsProgress = 100; changed = true; }
        gateArray('assignedGoalIds', false);
        gateArray('onboardingGoals', false);
    }

    if (!isFeatureEnabled(settings, 'digitalForms')
        && !isFeatureEnabled(settings, 'emergencyContact')
        && !isFeatureEnabled(settings, 'familyNominee')
        && !isFeatureEnabled(settings, 'bankDetails')) {
        if (workflow.formsProgress !== 100) { workflow.formsProgress = 100; changed = true; }
        if (workflow.mandatoryFormsCompleted !== true) { workflow.mandatoryFormsCompleted = true; changed = true; }
    }

    if (!isFeatureEnabled(settings, 'mandatoryTraining') && !isFeatureEnabled(settings, 'trainingLms')) {
        gateArray('trainingModules', false);
    }

    if (!isFeatureEnabled(settings, 'eSignature')) {
        gateArray('policySignatures', false);
    }

    if (!isFeatureEnabled(settings, 'itAssetProvisioning')) {
        gateArray('assets', false);
    }

    if (!isFeatureEnabled(settings, 'softwareAccessRequest')) {
        gateArray('softwareRequests', false);
    }

    if (!isFeatureEnabled(settings, 'documentCollection')) {
        // Keep pack/compliance docs that have their own featureKey; drop generic collection docs
        const before = (workflow.documents || []).length;
        workflow.documents = (workflow.documents || []).filter((d) => {
            const key = resolveItemFeatureKey(d, 'documents');
            return key && key !== 'documentCollection' && isFeatureEnabled(settings, key);
        });
        if ((workflow.documents || []).length !== before) changed = true;
    }

    if (!isFeatureEnabled(settings, 'joiningChecklist') && !isFeatureEnabled(settings, 'induction')) {
        const before = (workflow.checklist || []).length;
        workflow.checklist = filterByFeatureKey(workflow.checklist, settings);
        // Also drop checklist items without featureKey when both induction features off
        workflow.checklist = (workflow.checklist || []).filter((c) => c.featureKey && isFeatureEnabled(settings, c.featureKey));
        if ((workflow.checklist || []).length !== before) changed = true;
    }

    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        if (workflow.bgvStatus !== 'Waived') {
            workflow.bgvStatus = 'Waived';
            workflow.bgvProgress = 100;
            changed = true;
        }
        // Keep historical case id; mark mirrored status waived so progress/joining ignore it
        if (workflow.backgroundVerification && workflow.backgroundVerification.status !== 'Waived') {
            workflow.backgroundVerification = {
                ...(workflow.backgroundVerification.toObject?.() || workflow.backgroundVerification || {}),
                status: 'Waived',
            };
            changed = true;
        }
    }

    if (!isFeatureEnabled(settings, 'softwareAccessRequest')) {
        const before = (workflow.softwareRequests || []).length;
        workflow.softwareRequests = [];
        if (before) changed = true;
    }

    // Drop template/pack items whose featureKey is disabled
    for (const field of ['tasks', 'documents', 'checklist', 'assets', 'trainingModules', 'policySignatures', 'softwareRequests']) {
        const before = (workflow[field] || []).length;
        workflow[field] = filterByFeatureKey(workflow[field], settings, field);
        if ((workflow[field] || []).length !== before) changed = true;
    }

    return changed;
}

/**
 * Mutates offboarding workflow for disabled Configure features.
 */
export function applyOffboardingFeatureGates(workflow, settings) {
    if (!workflow || !settings) return false;
    let changed = false;

    const clear = (field) => {
        if (Array.isArray(workflow[field]) && workflow[field].length) {
            workflow[field] = [];
            changed = true;
        }
    };

    if (!isModuleEnabled(settings, 'offboarding')) {
        for (const field of ['tasks', 'clearanceChecklist', 'assets', 'knowledgeTransfer', 'accessRevocation']) {
            clear(field);
        }
        return true;
    }

    if (!isFeatureEnabled(settings, 'exitInterview')) {
        if (workflow.exitInterview && workflow.exitInterview.status !== 'Waived') {
            workflow.exitInterview = {
                ...(workflow.exitInterview.toObject?.() || workflow.exitInterview),
                mandatory: false,
                status: 'Waived',
            };
            changed = true;
        }
        const before = (workflow.tasks || []).length;
        workflow.tasks = (workflow.tasks || []).filter((t) => {
            if (t.featureKey === 'exitInterview') return false;
            return !/exit interview/i.test(t.title || '');
        });
        if (workflow.tasks.length !== before) changed = true;
    }

    if (!isFeatureEnabled(settings, 'fnfSettlement')) {
        if (workflow.finalSettlement && workflow.finalSettlement.status !== 'Waived') {
            workflow.finalSettlement = {
                ...(workflow.finalSettlement.toObject?.() || workflow.finalSettlement),
                mandatory: false,
                status: 'Waived',
            };
            changed = true;
        }
        const before = (workflow.tasks || []).length;
        workflow.tasks = (workflow.tasks || []).filter((t) => t.featureKey !== 'fnfSettlement' && !/\bf.?&?.?f\b|full\s*&?\s*final|settlement/i.test(t.title || ''));
        if (workflow.tasks.length !== before) changed = true;
    }

    if (!isFeatureEnabled(settings, 'knowledgeTransfer') && !isFeatureEnabled(settings, 'projectHandover')) {
        clear('knowledgeTransfer');
    }

    if (!isFeatureEnabled(settings, 'accessRevocation') && !isFeatureEnabled(settings, 'emailAccessRemoval')) {
        clear('accessRevocation');
    }

    if (!isFeatureEnabled(settings, 'assetReturn')) {
        clear('assets');
    }

    if (!isFeatureEnabled(settings, 'clearance') && !isFeatureEnabled(settings, 'hrClearance')) {
        clear('clearanceChecklist');
    }

    if (!isFeatureEnabled(settings, 'experienceLetter')
        && !isFeatureEnabled(settings, 'relievingLetter')
        && !isFeatureEnabled(settings, 'serviceCertificate')) {
        if (workflow.experienceLetter && workflow.experienceLetter.status !== 'Waived') {
            workflow.experienceLetter = {
                ...(workflow.experienceLetter.toObject?.() || workflow.experienceLetter),
                status: 'Waived',
            };
            changed = true;
        }
    }

    if (!isFeatureEnabled(settings, 'noticePeriod')) {
        if (workflow.noticePeriod && workflow.noticePeriod.status !== 'Not Applicable') {
            workflow.noticePeriod = {
                ...(workflow.noticePeriod.toObject?.() || workflow.noticePeriod),
                status: 'Not Applicable',
            };
            changed = true;
        }
    }

    for (const field of ['tasks', 'clearanceChecklist', 'assets', 'knowledgeTransfer', 'accessRevocation']) {
        const before = (workflow[field] || []).length;
        workflow[field] = filterByFeatureKey(workflow[field], settings, field);
        if ((workflow[field] || []).length !== before) changed = true;
    }

    return changed;
}

/**
 * After removing disabled items, restore pack artifacts for currently enabled features.
 */
export async function restoreEnabledPackArtifacts(workflow, organizationId, settings, module = 'onboarding') {
    if (module === 'offboarding') {
        await applyPackArtifactsToOffboardingWorkflow(workflow, organizationId, settings);
    } else {
        await applyPackArtifactsToOnboardingWorkflow(workflow, organizationId, settings);
    }
}

export async function getOrgFeatureFlags(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const enabledSet = resolveEnabledFeatureSet(settings);
    const enabledFeatures = {};
    for (const key of enabledSet) enabledFeatures[key] = true;

    const { getFullFeatureRegistry } = await import('./lifecycleConfigService.js');
    for (const feature of getFullFeatureRegistry()) {
        if (enabledFeatures[feature.key] === undefined) {
            enabledFeatures[feature.key] = false;
        }
    }

    return {
        modules: {
            onboarding: isModuleEnabled(settings, 'onboarding'),
            offboarding: isModuleEnabled(settings, 'offboarding'),
        },
        enabledFeatures,
        isEnabled: (key) => isFeatureEnabled(settings, key),
        settings,
    };
}

/**
 * Whether a report category should be visible for this org Configure state.
 */
export function isReportCategoryEnabled(settings, category) {
    if (!category) return true;
    const keys = REPORT_CATEGORY_FEATURES[category];
    if (!keys?.length) return true;
    return keys.some((k) => isFeatureEnabled(settings, k));
}

/**
 * After Configure save or pack install/uninstall — re-apply gates and restore enabled pack items
 * on all active workflows so changes take effect immediately.
 */
export async function syncActiveWorkflowsWithFeatureGates(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const onboarding = await OnboardingWorkflow.find({
        organizationId,
        isTemplate: { $ne: true },
        status: { $nin: ['Completed', 'Cancelled'] },
    });
    const offboarding = await OffboardingWorkflow.find({
        organizationId,
        status: { $nin: ['Completed', 'Cancelled', 'Draft'] },
    });

    let updated = 0;
    const { applyProgressToWorkflow } = await import('./onboardingService.js');
    const { applyOffboardingProgress } = await import('./offboardingService.js');

    for (const wf of onboarding) {
        try {
            applyOnboardingFeatureGates(wf, settings);
            await restoreEnabledPackArtifacts(wf, organizationId, settings, 'onboarding');
            // Re-gate after restore so only enabled pack items remain
            applyOnboardingFeatureGates(wf, settings);
            applyProgressToWorkflow(wf, settings);
            await wf.save();
            updated += 1;
        } catch (err) {
            logger.error('Failed to sync onboarding workflow feature gates', {
                organizationId: String(organizationId),
                workflowId: String(wf._id),
                message: err.message,
            });
        }
    }

    for (const wf of offboarding) {
        try {
            applyOffboardingFeatureGates(wf, settings);
            await restoreEnabledPackArtifacts(wf, organizationId, settings, 'offboarding');
            applyOffboardingFeatureGates(wf, settings);
            applyOffboardingProgress(wf, new Date(), settings);
            await wf.save();
            updated += 1;
        } catch (err) {
            logger.error('Failed to sync offboarding workflow feature gates', {
                organizationId: String(organizationId),
                workflowId: String(wf._id),
                message: err.message,
            });
        }
    }

    logger.info('Synced workflows with Configure feature gates', {
        organizationId: String(organizationId),
        updated,
        onboarding: onboarding.length,
        offboarding: offboarding.length,
    });
    return { updated, onboarding: onboarding.length, offboarding: offboarding.length };
}

/**
 * Fire-and-forget sync used by Configure save and pack install/uninstall.
 */
export async function queueFeatureGateSync(organizationId) {
    const { runInBackground } = await import('../helpers/backgroundTasks.js');
    runInBackground('lifecycle-feature-sync', () => syncActiveWorkflowsWithFeatureGates(organizationId));
}
