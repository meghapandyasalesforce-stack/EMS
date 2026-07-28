import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getLifecycleConfigurationSnapshot,
    getFullFeatureRegistry,
    updateLifecycleSettings,
    installIndustryPack,
    installCompliancePack,
    uninstallIndustryPack,
    uninstallCompliancePack,
    getResolvedDocumentCatalog,
    listFormDefinitions,
    upsertFormDefinition,
    getOrCreateLifecycleSettings,
} from '../../services/lifecycleConfigService.js';
import {
    listGatedOnboardingTemplates,
    listGatedOffboardingTemplates,
    updateOnboardingTemplateStages,
    updateOffboardingTemplateStages,
    ensureDefaultOnboardingTemplate,
    ensureDefaultOffboardingTemplate,
    listRawTemplates,
    getRawTemplate,
    createLifecycleTemplate,
    updateLifecycleTemplateWorkflow,
    cloneLifecycleTemplate,
    publishLifecycleTemplate,
    previewLifecycleTemplate,
    buildTemplatePreview,
} from '../../services/lifecycleTemplateEngine.js';
import { OnboardingTemplate, OffboardingTemplate } from '../../models/onboarding.model.js';
import { LifecycleFormDefinition } from '../../models/lifecycle.model.js';
import { logLifecycleAudit } from '../../services/lifecycleAuditService.js';

const orgId = (req) => getOrganizationId(req);

export const getLifecycleRegistry = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const snapshot = await getLifecycleConfigurationSnapshot(organizationId);
        return res.json({ success: true, data: snapshot });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLifecycleSettings = async (req, res) => {
    try {
        const settings = await getOrCreateLifecycleSettings(orgId(req));
        return res.json({ success: true, data: settings });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const patchLifecycleSettings = async (req, res) => {
    try {
        const settings = await updateLifecycleSettings(orgId(req), req.body, {
            req,
            actor: req.employee,
        });

        // Immediately propagate Configure toggles to active workflows
        if (req.body.enabledFeatures || req.body.modules) {
            const { queueFeatureGateSync } = await import('../../services/lifecycleFeatureRuntimeService.js');
            await queueFeatureGateSync(orgId(req));
        }

        return res.json({ success: true, data: settings, message: 'Lifecycle settings updated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postInstallIndustryPack = async (req, res) => {
    try {
        const { packKey } = req.body;
        const settings = await installIndustryPack(orgId(req), packKey, { req, actor: req.employee });
        const { queueFeatureGateSync } = await import('../../services/lifecycleFeatureRuntimeService.js');
        await queueFeatureGateSync(orgId(req));
        return res.json({ success: true, data: settings, message: 'Industry pack installed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postInstallCompliancePack = async (req, res) => {
    try {
        const { packKey } = req.body;
        const settings = await installCompliancePack(orgId(req), packKey, { req, actor: req.employee });
        const { queueFeatureGateSync } = await import('../../services/lifecycleFeatureRuntimeService.js');
        await queueFeatureGateSync(orgId(req));
        return res.json({ success: true, data: settings, message: 'Compliance pack installed' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postUninstallIndustryPack = async (req, res) => {
    try {
        const { packKey } = req.body;
        const settings = await uninstallIndustryPack(orgId(req), packKey, { req, actor: req.employee });
        const { queueFeatureGateSync } = await import('../../services/lifecycleFeatureRuntimeService.js');
        await queueFeatureGateSync(orgId(req));
        return res.json({ success: true, data: settings, message: 'Industry pack disabled' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postUninstallCompliancePack = async (req, res) => {
    try {
        const { packKey } = req.body;
        const settings = await uninstallCompliancePack(orgId(req), packKey, { req, actor: req.employee });
        const { queueFeatureGateSync } = await import('../../services/lifecycleFeatureRuntimeService.js');
        await queueFeatureGateSync(orgId(req));
        return res.json({ success: true, data: settings, message: 'Compliance pack disabled' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getOnboardingTemplatesGated = async (req, res) => {
    try {
        const templates = req.query.builder === '1'
            ? await listRawTemplates(orgId(req), 'onboarding')
            : await listGatedOnboardingTemplates(orgId(req));
        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getOffboardingTemplatesGated = async (req, res) => {
    try {
        const templates = req.query.builder === '1'
            ? await listRawTemplates(orgId(req), 'offboarding')
            : await listGatedOffboardingTemplates(orgId(req));
        return res.json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getLifecycleTemplateById = async (req, res) => {
    try {
        const module = req.params.module;
        const template = await getRawTemplate(orgId(req), module, req.params.id);
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(404).json({ success: false, message: error.message });
    }
};

export const createLifecycleTemplateHandler = async (req, res) => {
    try {
        const module = req.params.module;
        const template = await createLifecycleTemplate(orgId(req), module, req.body, {
            actor: req.employee,
            req,
        });
        return res.status(201).json({ success: true, data: template, message: 'Workflow template created' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateLifecycleTemplateWorkflowHandler = async (req, res) => {
    try {
        const template = await updateLifecycleTemplateWorkflow(
            orgId(req),
            req.params.module,
            req.params.id,
            req.body,
            { actor: req.employee, req },
        );
        return res.json({ success: true, data: template, message: 'Workflow saved' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const cloneLifecycleTemplateHandler = async (req, res) => {
    try {
        const template = await cloneLifecycleTemplate(
            orgId(req),
            req.params.module,
            req.params.id,
            { name: req.body.name, actor: req.employee, req },
        );
        return res.status(201).json({ success: true, data: template, message: 'Workflow cloned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const publishLifecycleTemplateHandler = async (req, res) => {
    try {
        const template = await publishLifecycleTemplate(
            orgId(req),
            req.params.module,
            req.params.id,
            { actor: req.employee, req },
        );
        return res.json({ success: true, data: template, message: 'Workflow published' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const previewLifecycleTemplateHandler = async (req, res) => {
    try {
        const preview = await previewLifecycleTemplate(orgId(req), req.params.module, req.params.id);
        return res.json({ success: true, data: preview });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const createOffboardingTemplate = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const template = await OffboardingTemplate.create({ ...req.body, organizationId });
        await logLifecycleAudit({
            action: 'Create',
            entityType: 'LifecycleTemplate',
            entityId: template._id,
            entityName: template.name,
            req,
            actor: req.employee,
            after: template.toObject(),
        });
        return res.status(201).json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateOffboardingTemplate = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const before = await OffboardingTemplate.findOne({ _id: req.params.id, organizationId }).lean();
        const template = await OffboardingTemplate.findOneAndUpdate(
            { _id: req.params.id, organizationId },
            { $set: req.body },
            { new: true },
        );
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
        await logLifecycleAudit({
            action: 'Update',
            entityType: 'LifecycleTemplate',
            entityId: template._id,
            entityName: template.name,
            req,
            actor: req.employee,
            before,
            after: template.toObject(),
        });
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateOnboardingTemplateStagesHandler = async (req, res) => {
    try {
        const template = await updateOnboardingTemplateStages(
            orgId(req),
            req.params.id,
            req.body.stages || [],
            { req, actor: req.employee, stageGroups: req.body.stageGroups },
        );
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const updateOffboardingTemplateStagesHandler = async (req, res) => {
    try {
        const template = await updateOffboardingTemplateStages(
            orgId(req),
            req.params.id,
            req.body.stages || [],
            { req, actor: req.employee, stageGroups: req.body.stageGroups },
        );
        return res.json({ success: true, data: template });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getDocumentCatalog = async (req, res) => {
    try {
        const module = req.query.module || 'onboarding';
        const docs = await getResolvedDocumentCatalog(orgId(req), module);
        return res.json({ success: true, data: docs });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getFormDefinitions = async (req, res) => {
    try {
        const forms = await listFormDefinitions(orgId(req), { module: req.query.module });
        return res.json({ success: true, data: forms });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const saveFormDefinition = async (req, res) => {
    try {
        const form = await upsertFormDefinition(orgId(req), req.body, { req, actor: req.employee });
        return res.json({ success: true, data: form });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteFormDefinition = async (req, res) => {
    try {
        const organizationId = orgId(req);
        const form = await LifecycleFormDefinition.findOneAndUpdate(
            { _id: req.params.id, organizationId },
            { $set: { isActive: false } },
            { new: true },
        );
        if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
        await logLifecycleAudit({
            action: 'Delete',
            entityType: 'LifecycleForm',
            entityId: form._id,
            entityName: form.name,
            req,
            actor: req.employee,
        });
        return res.json({ success: true, message: 'Form deactivated' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const seedLifecycleDefaults = async (req, res) => {
    try {
        const organizationId = orgId(req);
        await ensureDefaultOnboardingTemplate(organizationId);
        await ensureDefaultOffboardingTemplate(organizationId);
        await getOrCreateLifecycleSettings(organizationId);
        const { bootstrapEnterpriseLifecycle } = await import('../../services/lifecycleEnterpriseBootstrap.js');
        const { autoConfigureLifecyclePacks } = await import('../../services/lifecycleCountryAutoConfigService.js');
        await autoConfigureLifecyclePacks(organizationId, { actor: req.employee, req });
        const bootstrap = await bootstrapEnterpriseLifecycle(organizationId, { actor: req.employee, req });
        return res.json({
            success: true,
            message: 'Lifecycle defaults seeded with enterprise bootstrap',
            data: bootstrap,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getFeatureRegistryOnly = async (_req, res) => {
    return res.json({ success: true, data: getFullFeatureRegistry() });
};
