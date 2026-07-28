/**
 * Feature-gated lifecycle template engine.
 * All feature filtering for templates happens here — nowhere else.
 */

import {
    OnboardingTemplate,
    OffboardingTemplate,
} from '../models/onboarding.model.js';
import {
    DEFAULT_ONBOARDING_CHECKLIST,
    DEFAULT_ONBOARDING_TASKS,
    DEFAULT_ONBOARDING_STAGES,
    ONBOARDING_DOCUMENT_TYPES,
    DEFAULT_ASSET_TYPES,
    DEFAULT_TRAINING_MODULES,
    DEFAULT_POLICY_SIGNATURES,
} from '../constants/onboardingDefaults.js';
import {
    DEFAULT_OFFBOARDING_STAGES,
    DEFAULT_OFFBOARDING_TASKS,
    DEFAULT_OFFBOARDING_CHECKLIST,
    DEFAULT_ACCESS_REVOCATIONS,
    DEFAULT_OFFBOARDING_KNOWLEDGE_TRANSFER,
    DEFAULT_OFFBOARDING_CLEARANCE_RULES,
    DEFAULT_OFFBOARDING_EXIT_TYPES,
} from '../constants/offboardingDefaults.js';
import {
    filterByEnabledFeatures,
    sortByOrder,
    sortStages,
    itemMatchesFeatures,
} from '../constants/lifecycleSharedSchemas.js';
import {
    getOrCreateLifecycleSettings,
    resolveEnabledFeatureSet,
    isModuleEnabled,
} from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

const TEMPLATE_MODELS = {
    onboarding: OnboardingTemplate,
    offboarding: OffboardingTemplate,
};

function normalizeStageKeys(stages = []) {
    const sorted = sortStages(stages.map((stage, index) => ({
        ...stage,
        order: stage.order ?? index,
    })));
    const keys = new Set(sorted.map((s) => s.key).filter(Boolean));
    const seen = new Set();
    for (const stage of sorted) {
        if (!stage.key) throw new Error('Each stage requires a unique key');
        if (seen.has(stage.key)) throw new Error(`Duplicate stage key: ${stage.key}`);
        seen.add(stage.key);
        for (const dep of stage.dependsOn || []) {
            if (!keys.has(dep)) {
                throw new Error(`Stage "${stage.key}" depends on unknown stage "${dep}"`);
            }
        }
    }
    return sorted;
}

function snapshotTemplate(template) {
    const obj = template.toObject ? template.toObject() : { ...template };
    delete obj.versionHistory;
    return obj;
}

function pushTemplateVersion(template, actor, changeNotes = 'Workflow updated') {
    template.versionHistory = template.versionHistory || [];
    template.versionHistory.push({
        version: template.version || 1,
        snapshot: snapshotTemplate(template),
        changedBy: actor?._id,
        changedAt: new Date(),
        changeNotes,
    });
    template.version = (template.version || 1) + 1;
}

async function getTemplateModel(module, organizationId, templateId) {
    const Model = TEMPLATE_MODELS[module];
    if (!Model) throw new Error(`Unknown module: ${module}`);
    const template = await Model.findOne({ _id: templateId, organizationId });
    if (!template) throw new Error('Template not found');
    return template;
}

export async function listRawTemplates(organizationId, module) {
    const Model = TEMPLATE_MODELS[module];
    if (!Model) throw new Error(`Unknown module: ${module}`);
    return Model.find({ organizationId }).sort({ isDefault: -1, name: 1 }).lean();
}

export async function getRawTemplate(organizationId, module, templateId) {
    const Model = TEMPLATE_MODELS[module];
    const template = await Model.findOne({ _id: templateId, organizationId }).lean();
    if (!template) throw new Error('Template not found');
    return template;
}

export async function createLifecycleTemplate(organizationId, module, payload, { actor, req } = {}) {
    const Model = TEMPLATE_MODELS[module];
    const data = {
        organizationId,
        name: payload.name,
        description: payload.description,
        expectedDays: payload.expectedDays,
        welcomeMessage: payload.welcomeMessage,
        stages: normalizeStageKeys(payload.stages || []),
        stageGroups: payload.stageGroups || [],
        status: 'Draft',
        version: 1,
        isDefault: false,
    };
    if (module === 'offboarding') {
        data.exitTypes = payload.exitTypes;
    }
    const template = await Model.create(data);
    await logLifecycleAudit({
        action: 'Create',
        entityType: 'LifecycleTemplate',
        entityId: template._id,
        entityName: template.name,
        req,
        actor,
        after: template.toObject(),
        metadata: { module },
    });
    return template;
}

export async function updateLifecycleTemplateWorkflow(organizationId, module, templateId, payload, { actor, req } = {}) {
    const template = await getTemplateModel(module, organizationId, templateId);
    const before = snapshotTemplate(template);

    if (payload.name != null) template.name = payload.name;
    if (payload.description != null) template.description = payload.description;
    if (payload.expectedDays != null) template.expectedDays = payload.expectedDays;
    if (payload.welcomeMessage != null) template.welcomeMessage = payload.welcomeMessage;
    if (payload.stageGroups != null) template.stageGroups = payload.stageGroups;
    if (payload.stages != null) template.stages = normalizeStageKeys(payload.stages);

    if (template.isModified()) {
        pushTemplateVersion(template, actor, payload.changeNotes || 'Workflow builder save');
        if (template.status === 'Published') template.status = 'Draft';
    }

    await template.save();
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleTemplate',
        entityId: template._id,
        entityName: template.name,
        req,
        actor,
        before,
        after: template.toObject(),
        metadata: { module, source: 'workflow_builder' },
    });
    return template.toObject();
}

export async function cloneLifecycleTemplate(organizationId, module, templateId, { name, actor, req } = {}) {
    const source = await getTemplateModel(module, organizationId, templateId);
    const Model = TEMPLATE_MODELS[module];
    const cloneName = name || `${source.name} (Copy)`;
    const cloneData = {
        ...snapshotTemplate(source),
        _id: undefined,
        name: cloneName,
        isDefault: false,
        status: 'Draft',
        version: 1,
        versionHistory: [],
        publishedAt: null,
        clonedFrom: source._id,
        createdAt: undefined,
        updatedAt: undefined,
    };
    const template = await Model.create(cloneData);
    await logLifecycleAudit({
        action: 'Create',
        entityType: 'LifecycleTemplate',
        entityId: template._id,
        entityName: template.name,
        req,
        actor,
        after: template.toObject(),
        metadata: { module, clonedFrom: source._id },
    });
    return template;
}

export async function publishLifecycleTemplate(organizationId, module, templateId, { actor, req } = {}) {
    const template = await getTemplateModel(module, organizationId, templateId);
    normalizeStageKeys(template.stages || []);
    if (!template.stages?.length) throw new Error('At least one stage is required to publish');

    template.status = 'Published';
    template.publishedAt = new Date();
    pushTemplateVersion(template, actor, 'Published workflow');
    await template.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleTemplate',
        entityId: template._id,
        entityName: template.name,
        req,
        actor,
        metadata: { module, action: 'publish', version: template.version },
    });
    return template.toObject();
}

export function buildTemplatePreview(template, module) {
    const stages = sortStages(template.stages || []);
    const groups = sortByOrder(template.stageGroups || []);
    const stageMap = Object.fromEntries(stages.map((s) => [s.key, s]));

    const timeline = stages.map((stage) => {
        const dueLabel = module === 'offboarding'
            ? (stage.dueDaysBeforeLastWorkingDate != null
                ? `${stage.dueDaysBeforeLastWorkingDate}d before LWD`
                : stage.dueDaysAfterLastWorkingDate != null
                    ? `${stage.dueDaysAfterLastWorkingDate}d after LWD`
                    : null)
            : (stage.dueDaysFromStart != null ? `Day ${stage.dueDaysFromStart}` : null);

        return {
            key: stage.key,
            name: stage.name,
            order: stage.order,
            mandatory: stage.mandatory !== false,
            groupKey: stage.groupKey,
            groupName: groups.find((g) => g.key === stage.groupKey)?.name,
            dependsOn: stage.dependsOn || [],
            blockedBy: (stage.dependsOn || []).filter((k) => stageMap[k]),
            dueLabel,
            slaDays: stage.slaDays,
            escalationRuleKey: stage.escalationRuleKey,
            reminderRuleKey: stage.reminderRuleKey,
            approvalRequired: stage.approvalRequired,
            featureKey: stage.featureKey,
            visibility: stage.visibility,
        };
    });

    return {
        templateId: template._id,
        name: template.name,
        module,
        status: template.status,
        version: template.version,
        expectedDays: template.expectedDays,
        stageCount: stages.length,
        mandatoryStageCount: stages.filter((s) => s.mandatory !== false).length,
        optionalStageCount: stages.filter((s) => s.mandatory === false).length,
        groups,
        timeline,
        warnings: stages
            .filter((s) => (s.dependsOn || []).length && s.order === 0)
            .map((s) => `Stage "${s.name}" has dependencies but is first in order`),
    };
}

export async function previewLifecycleTemplate(organizationId, module, templateId) {
    const template = await getRawTemplate(organizationId, module, templateId);
    return buildTemplatePreview(template, module);
}

export function applyFeatureGateToTemplate(template, enabledFeatures) {
    if (!template) return null;
    const features = enabledFeatures instanceof Set ? enabledFeatures : new Set(enabledFeatures);
    const result = { ...template };

    result.stages = sortStages(filterByEnabledFeatures(template.stages, features));
    result.tasks = sortByOrder(filterByEnabledFeatures(template.tasks, features));
    result.checklist = sortByOrder(filterByEnabledFeatures(template.checklist, features));
    result.documents = sortByOrder(filterByEnabledFeatures(template.documents, features));
    result.assets = sortByOrder(filterByEnabledFeatures(template.assets, features));
    result.trainingModules = sortByOrder(filterByEnabledFeatures(template.trainingModules, features));
    result.policySignatures = sortByOrder(filterByEnabledFeatures(template.policySignatures, features));

    if (template.clearanceChecklist) {
        result.clearanceChecklist = sortByOrder(filterByEnabledFeatures(template.clearanceChecklist, features));
    }
    if (template.accessRevocation) {
        result.accessRevocation = sortByOrder(filterByEnabledFeatures(template.accessRevocation, features));
    }
    if (template.knowledgeTransfer) {
        result.knowledgeTransfer = sortByOrder(filterByEnabledFeatures(template.knowledgeTransfer, features));
    }
    if (template.assetRules) {
        result.assetRules = sortByOrder(filterByEnabledFeatures(template.assetRules, features));
    }
    if (template.clearanceRules) {
        result.clearanceRules = sortByOrder(filterByEnabledFeatures(template.clearanceRules, features));
    }
    if (template.exitInterview && !itemMatchesFeatures({ featureKey: template.exitInterview.featureKey || 'exitInterview' }, features)) {
        result.exitInterview = { ...template.exitInterview, enabled: false, mandatory: false };
    }
    if (template.finalSettlement && !itemMatchesFeatures({ featureKey: template.finalSettlement.featureKey || 'fnfSettlement' }, features)) {
        result.finalSettlement = { ...template.finalSettlement, enabled: false, mandatory: false };
    }

    return result;
}

function buildDefaultOnboardingTemplatePayload() {
    return {
        name: 'Default Onboarding',
        description: 'System-created baseline. HR can customize every requirement.',
        isDefault: true,
        welcomeMessage: 'Welcome to the team! Please complete the onboarding requirements assigned to you.',
        expectedDays: 30,
        stages: DEFAULT_ONBOARDING_STAGES,
        tasks: DEFAULT_ONBOARDING_TASKS,
        checklist: DEFAULT_ONBOARDING_CHECKLIST,
        documents: ONBOARDING_DOCUMENT_TYPES.map((d, index) => ({
            documentType: d.key,
            catalogKey: d.key,
            mandatory: d.required,
            featureKey: d.featureKey,
            order: index,
        })),
        assets: DEFAULT_ASSET_TYPES,
        trainingModules: DEFAULT_TRAINING_MODULES.filter((m) =>
            m.videoUrl || m.documentUrl || m.quizQuestions?.length).map((m, index) => ({
            ...m,
            featureKey: m.featureKey || 'mandatoryTraining',
            order: index,
        })),
        policySignatures: DEFAULT_POLICY_SIGNATURES.filter((p) => p.documentUrl).map((p, index) => ({
            ...p,
            order: index,
        })),
    };
}

function buildDefaultOffboardingTemplatePayload() {
    return {
        name: 'Default Offboarding',
        description: 'System-created baseline exit workflow. HR can customize every requirement.',
        isDefault: true,
        expectedDays: 14,
        exitTypes: [...DEFAULT_OFFBOARDING_EXIT_TYPES],
        stages: DEFAULT_OFFBOARDING_STAGES,
        tasks: DEFAULT_OFFBOARDING_TASKS,
        clearanceChecklist: DEFAULT_OFFBOARDING_CHECKLIST,
        accessRevocation: DEFAULT_ACCESS_REVOCATIONS,
        knowledgeTransfer: DEFAULT_OFFBOARDING_KNOWLEDGE_TRANSFER,
        assetRules: DEFAULT_ASSET_TYPES.map((a, index) => ({
            assetType: a.assetType,
            mandatory: a.mandatory,
            featureKey: 'assetReturn',
            order: index,
        })),
        clearanceRules: DEFAULT_OFFBOARDING_CLEARANCE_RULES,
        exitInterview: { enabled: false, mandatory: false, featureKey: 'exitInterview' },
        finalSettlement: { enabled: true, mandatory: true, featureKey: 'fnfSettlement' },
    };
}

export async function ensureDefaultOnboardingTemplate(organizationId) {
    let template = await OnboardingTemplate.findOne({ organizationId, isDefault: true }).lean();
    if (!template) {
        template = await OnboardingTemplate.findOneAndUpdate(
            { organizationId, isDefault: true },
            { $setOnInsert: { organizationId, ...buildDefaultOnboardingTemplatePayload() } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
    }
    return template;
}

export async function ensureDefaultOffboardingTemplate(organizationId) {
    let template = await OffboardingTemplate.findOne({ organizationId, isDefault: true }).lean();
    if (!template) {
        template = await OffboardingTemplate.findOneAndUpdate(
            { organizationId, isDefault: true },
            { $setOnInsert: { organizationId, ...buildDefaultOffboardingTemplatePayload() } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
    }
    return template;
}

export async function resolveGatedOnboardingTemplate(organizationId, templateId = null) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isModuleEnabled(settings, 'onboarding')) return null;

    const enabledFeatures = resolveEnabledFeatureSet(settings);
    let template;
    const resolvedId = templateId || settings.defaults?.onboardingTemplateId;
    if (resolvedId) {
        template = await OnboardingTemplate.findOne({ _id: resolvedId, organizationId }).lean();
    }
    if (!template) {
        template = await ensureDefaultOnboardingTemplate(organizationId);
    }
    return applyFeatureGateToTemplate(template, enabledFeatures);
}

export async function resolveGatedOffboardingTemplate(organizationId, templateId = null) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isModuleEnabled(settings, 'offboarding')) return null;

    const enabledFeatures = resolveEnabledFeatureSet(settings);
    let template;
    const resolvedId = templateId || settings.defaults?.offboardingTemplateId;
    if (resolvedId) {
        template = await OffboardingTemplate.findOne({ _id: resolvedId, organizationId }).lean();
    }
    if (!template) {
        template = await ensureDefaultOffboardingTemplate(organizationId);
    }
    return applyFeatureGateToTemplate(template, enabledFeatures);
}

export async function listGatedOnboardingTemplates(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const enabledFeatures = resolveEnabledFeatureSet(settings);
    const templates = await OnboardingTemplate.find({ organizationId }).lean();
    return templates.map((t) => applyFeatureGateToTemplate(t, enabledFeatures));
}

export async function listGatedOffboardingTemplates(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const enabledFeatures = resolveEnabledFeatureSet(settings);
    const templates = await OffboardingTemplate.find({ organizationId }).lean();
    return templates.map((t) => applyFeatureGateToTemplate(t, enabledFeatures));
}

export async function updateOnboardingTemplateStages(organizationId, templateId, stages, { req = null, actor = null, stageGroups = null } = {}) {
    const template = await OnboardingTemplate.findOne({ _id: templateId, organizationId });
    if (!template) throw new Error('Template not found');
    template.stages = normalizeStageKeys(stages);
    if (stageGroups != null) template.stageGroups = stageGroups;
    if (template.isModified()) {
        pushTemplateVersion(template, actor, 'Stages updated');
        if (template.status === 'Published') template.status = 'Draft';
    }
    await template.save();
    if (req || actor) {
        await logLifecycleAudit({
            action: 'Update',
            entityType: 'LifecycleTemplate',
            entityId: template._id,
            entityName: template.name,
            req,
            actor,
            metadata: { module: 'onboarding', source: 'stages_api' },
        });
    }
    return applyFeatureGateToTemplate(template.toObject(), resolveEnabledFeatureSet(await getOrCreateLifecycleSettings(organizationId)));
}

export async function updateOffboardingTemplateStages(organizationId, templateId, stages, { req = null, actor = null, stageGroups = null } = {}) {
    const template = await OffboardingTemplate.findOne({ _id: templateId, organizationId });
    if (!template) throw new Error('Template not found');
    template.stages = normalizeStageKeys(stages);
    if (stageGroups != null) template.stageGroups = stageGroups;
    if (template.isModified()) {
        pushTemplateVersion(template, actor, 'Stages updated');
        if (template.status === 'Published') template.status = 'Draft';
    }
    await template.save();
    if (req || actor) {
        await logLifecycleAudit({
            action: 'Update',
            entityType: 'LifecycleTemplate',
            entityId: template._id,
            entityName: template.name,
            req,
            actor,
            metadata: { module: 'offboarding', source: 'stages_api' },
        });
    }
    return applyFeatureGateToTemplate(template.toObject(), resolveEnabledFeatureSet(await getOrCreateLifecycleSettings(organizationId)));
}

export {
    buildDefaultOnboardingTemplatePayload,
    buildDefaultOffboardingTemplatePayload,
};
