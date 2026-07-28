/**
 * Applies installed industry/compliance pack artifacts to onboarding/offboarding workflows.
 * Configure (enabled packs + feature flags) is the single source of truth.
 */

import { getArtifactsForInstalledPacks } from '../constants/lifecyclePackWorkflowDefinitions.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { LIFECYCLE_DOCUMENT_CATALOG } from '../constants/lifecycleDocumentCatalog.js';

export function enabledPackKeys(settings) {
    const industry = (settings.industryPacks || []).filter((p) => p.enabled).map((p) => p.packKey);
    const compliance = (settings.compliancePacks || []).filter((p) => p.enabled).map((p) => p.packKey);
    return [...industry, ...compliance];
}

function catalogFeatureKey(documentType) {
    return LIFECYCLE_DOCUMENT_CATALOG.find((d) => d.key === documentType)?.featureKey || null;
}

export function mergeTasks(existing, incoming, startDate) {
    const titles = new Set((existing || []).map((t) => t.title));
    const added = [];
    for (const t of incoming) {
        if (titles.has(t.title)) continue;
        const dueDate = startDate ? new Date(startDate.getTime() + (t.dueDaysFromStart || 7) * 86400000) : undefined;
        added.push({
            title: t.title,
            description: t.description || '',
            category: t.category || 'Other',
            assigneeRole: t.assigneeRole || 'employee',
            priority: t.mandatory === false ? 'Medium' : 'High',
            mandatory: t.mandatory !== false,
            phase: t.phase || 'Week 1',
            status: 'Pending',
            dueDate,
            requiredDocuments: t.requiredDocuments || [],
            featureKey: t.featureKey,
        });
        titles.add(t.title);
    }
    return [...(existing || []), ...added];
}

export function mergeChecklist(existing, incoming) {
    const items = new Set((existing || []).map((c) => c.item));
    const added = [];
    for (const c of incoming) {
        if (items.has(c.item)) continue;
        added.push({
            item: c.item,
            category: c.category || 'HR',
            phase: c.phase || 'Week 1',
            mandatory: c.mandatory !== false,
            assignedRole: (c.category || 'HR').toLowerCase() === 'it' ? 'it' : 'hr',
            completed: false,
            featureKey: c.featureKey,
        });
        items.add(c.item);
    }
    return [...(existing || []), ...added];
}

export function mergeDocuments(existing, documentKeys) {
    const types = new Set((existing || []).map((d) => d.documentType));
    const added = [];
    for (const key of documentKeys) {
        if (types.has(key)) {
            // Stamp catalog featureKey onto existing docs missing one
            const doc = (existing || []).find((d) => d.documentType === key);
            const fk = catalogFeatureKey(key);
            if (doc && fk && !doc.featureKey) doc.featureKey = fk;
            continue;
        }
        const catalog = LIFECYCLE_DOCUMENT_CATALOG.find((d) => d.key === key);
        if (!catalog) continue;
        added.push({
            documentType: key,
            name: catalog.label,
            status: 'Pending',
            mandatory: catalog.mandatory !== false,
            featureKey: catalog.featureKey || null,
        });
        types.add(key);
    }
    return [...(existing || []), ...added];
}

function mergeSoftwareRequests(existing, incoming) {
    const systems = new Set((existing || []).map((s) => s.system));
    const added = [];
    for (const s of incoming) {
        if (systems.has(s.system)) continue;
        added.push({
            system: s.system,
            category: s.category || 'application',
            status: 'Pending',
            mandatory: s.mandatory !== false,
            featureKey: s.featureKey,
            approvalStatus: 'Pending',
        });
        systems.add(s.system);
    }
    return [...(existing || []), ...added];
}

function mergeAssets(existing, incoming) {
    const names = new Set((existing || []).map((a) => a.name || a.assetType));
    const added = [];
    for (const a of incoming) {
        const id = a.name || a.assetType;
        if (names.has(id)) continue;
        added.push({
            assetType: a.assetType || 'Other',
            name: a.name || a.assetType,
            status: 'Pending',
            mandatory: a.mandatory !== false,
            featureKey: a.featureKey || 'itAssetProvisioning',
        });
        names.add(id);
    }
    return [...(existing || []), ...added];
}

function filterEnabled(items, settings) {
    return (items || []).filter((item) => !item.featureKey || isFeatureEnabled(settings, item.featureKey));
}

function filterDocumentKeys(documentKeys, settings) {
    return (documentKeys || []).filter((key) => {
        const fk = catalogFeatureKey(key);
        return !fk || isFeatureEnabled(settings, fk);
    });
}

/**
 * Merge currently-enabled pack artifacts into an onboarding workflow (create + re-enable sync).
 */
export async function applyPackArtifactsToOnboardingWorkflow(workflow, organizationId, settingsOverride = null) {
    const settings = settingsOverride || await getOrCreateLifecycleSettings(organizationId);
    const packKeys = enabledPackKeys(settings);
    if (!packKeys.length) return workflow;

    const artifacts = getArtifactsForInstalledPacks(packKeys);
    const startDate = workflow.joiningDate || workflow.startDate || new Date();

    workflow.tasks = mergeTasks(workflow.tasks, filterEnabled(artifacts.tasks, settings), startDate);
    workflow.checklist = mergeChecklist(workflow.checklist, filterEnabled(artifacts.checklist, settings));
    workflow.documents = mergeDocuments(
        workflow.documents,
        filterDocumentKeys(artifacts.documentKeys, settings),
    );
    workflow.softwareRequests = isFeatureEnabled(settings, 'softwareAccessRequest')
        ? mergeSoftwareRequests(workflow.softwareRequests, filterEnabled(artifacts.softwareRequests, settings))
        : (workflow.softwareRequests || []);
    workflow.assets = isFeatureEnabled(settings, 'itAssetProvisioning')
        ? mergeAssets(workflow.assets, filterEnabled(artifacts.assets, settings))
        : (workflow.assets || []);

    if (artifacts.fastTrack && isFeatureEnabled(settings, 'industry.retail.fastTrackOnboarding')) {
        workflow.fastTrack = true;
    }
    if (artifacts.bgvCheckTypes?.length && isFeatureEnabled(settings, 'backgroundVerification')) {
        workflow.packBgvCheckTypes = artifacts.bgvCheckTypes;
    }

    return workflow;
}

/**
 * Merge currently-enabled pack offboarding tasks into a workflow.
 */
export async function applyPackArtifactsToOffboardingWorkflow(workflow, organizationId, settingsOverride = null) {
    const settings = settingsOverride || await getOrCreateLifecycleSettings(organizationId);
    const packKeys = enabledPackKeys(settings);
    const artifacts = getArtifactsForInstalledPacks(packKeys);
    if (!artifacts.offboardingTasks?.length) return workflow;

    const lwd = workflow.lastWorkingDate || new Date();
    workflow.tasks = mergeTasks(
        workflow.tasks,
        filterEnabled(artifacts.offboardingTasks, settings).map((t) => ({
            ...t,
            dueDaysFromStart: 0,
        })),
        lwd,
    );
    return workflow;
}

export async function getInstalledPackArtifactsSummary(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    return getArtifactsForInstalledPacks(enabledPackKeys(settings));
}
