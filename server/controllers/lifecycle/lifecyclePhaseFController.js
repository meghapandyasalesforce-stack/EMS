/**
 * Phase F — Enterprise completion controller (statutory, IT, LMS, dashboards, search, bulk, notifications, branding).
 */

import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { OnboardingWorkflow } from '../../models/onboarding.model.js';
import Employee from '../../models/employee.model.js';
import {
    STATUTORY_DOC_TYPES,
    STATUTORY_MODULES,
    generateStatutoryDocument,
    listEmployeeStatutoryDocuments,
    previewStatutoryDocument,
    bulkGenerateStatutoryDocuments,
    listStatutoryHistory,
    getStatutoryOrgDashboard,
} from '../../services/indiaStatutoryComplianceService.js';
import {
    getSoftwareInventoryDashboard,
    addSoftwareRequest,
    approveSoftwareRequest,
    markSoftwareProvisioned,
    getAccessProvisioningCatalog,
    requestDeviceReplacement,
    loadOnboarding,
    listItTicketingProviders,
} from '../../services/itProvisioningService.js';
import {
    buildLmsDashboard,
    buildManagerTrainingDashboard,
    assignCourseToWorkflow,
    syncAndCertifyWorkflow,
    getTrainingHistory,
    listLmsProviders,
} from '../../services/lifecycleLmsService.js';
import { buildDashboard, listDashboardTypes } from '../../services/lifecycleDashboardService.js';
import {
    globalLifecycleSearch,
    listSearchCategories,
    saveSearch,
    listSavedSearches,
} from '../../services/lifecycleSearchService.js';
import {
    executeBulkOperation,
    BULK_OPERATIONS,
} from '../../services/lifecycleBulkOperationsService.js';
import {
    getNotificationCenterConfig,
    updateNotificationCenterConfig,
    listLifecycleEventTypes,
    listNotificationChannels,
} from '../../services/lifecycleNotificationCenterService.js';
import {
    getOrganizationBranding,
    updateLifecycleBranding,
} from '../../services/lifecycleBrandingService.js';
import {
    extendProbation,
    submitProbationReview,
    buildProbationDashboard,
} from '../../services/lifecycleProbationService.js';
import { applyProgressToWorkflow } from '../../services/onboardingService.js';
import {
    assertFeatureEnabled,
    assertAnyFeatureEnabled,
} from '../../services/lifecycleConfigService.js';

const orgId = (req) => getOrganizationId(req);
const actor = (req) => req.employee || req.user;
const assertOrgFeature = assertFeatureEnabled;

// ── Part 1: Statutory ──
export const getStatutoryDocTypes = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        return res.json({ success: true, data: STATUTORY_DOC_TYPES });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getStatutoryModules = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        return res.json({ success: true, data: STATUTORY_MODULES });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getStatutoryPreview = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const { docType, employeeId } = req.query;
        if (!docType) {
            return res.status(400).json({ success: false, message: 'Document type is required' });
        }
        const data = await previewStatutoryDocument(orgId(req), {
            docType,
            employeeId,
            fyStartMonth: req.query.fyStartMonth ? Number(req.query.fyStartMonth) : undefined,
        });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getStatutoryDashboard = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const data = await getStatutoryOrgDashboard(orgId(req));
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getStatutoryHistory = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const data = await listStatutoryHistory(orgId(req), {
            docType: req.query.docType,
            employeeId: req.query.employeeId,
            limit: req.query.limit,
        });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const postBulkGenerateStatutory = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const { docType, employeeIds, requireApproval, fyStartMonth } = req.body || {};
        if (!docType) {
            return res.status(400).json({ success: false, message: 'Document type is required' });
        }
        const data = await bulkGenerateStatutoryDocuments(
            orgId(req),
            { docType, employeeIds, requireApproval: Boolean(requireApproval), fyStartMonth },
            { actor: actor(req), req }
        );
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message || 'Bulk generation failed',
        });
    }
};

export const postGenerateStatutoryDoc = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const { docType, employeeId, requireApproval, fyStartMonth } = req.body || {};
        if (!docType) {
            return res.status(400).json({ success: false, message: 'Document type is required' });
        }
        const result = await generateStatutoryDocument(
            orgId(req),
            { docType, employeeId, requireApproval: Boolean(requireApproval), fyStartMonth },
            { actor: actor(req), req }
        );
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false,
            code: error.code,
            featureKey: error.featureKey,
            message: error.message || 'Generation failed',
        });
    }
};

export const getEmployeeStatutoryDocs = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'indiaStatutoryCompliance', 'India statutory compliance');
        const docs = await listEmployeeStatutoryDocuments(orgId(req), req.params.employeeId);
        return res.json({ success: true, data: docs });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

// ── Part 2: IT Provisioning ──
export const getItInventoryDashboard = async (req, res) => {
    try {
        const data = await getSoftwareInventoryDashboard(orgId(req));
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getItTicketingProviders = (_req, res) =>
    res.json({ success: true, data: listItTicketingProviders() });

export const getAccessProvisioningCatalogHandler = (_req, res) =>
    res.json({ success: true, data: getAccessProvisioningCatalog() });

export const postSoftwareRequest = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await addSoftwareRequest(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: workflow.softwareRequests });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postApproveSoftwareRequest = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const { request } = await approveSoftwareRequest(workflow, req.params.requestId, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: request });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postMarkSoftwareProvisioned = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const request = await markSoftwareProvisioned(workflow, req.params.requestId, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: request, message: 'Marked as Provisioned' });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postDeviceReplacement = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const result = await requestDeviceReplacement(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// ── Part 3: LMS ──
export const getLmsDashboard = async (req, res) => {
    try {
        const data = await buildLmsDashboard(orgId(req), req.query);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getManagerTrainingDashboard = async (req, res) => {
    try {
        const managerId = req.query.managerId || actor(req)?._id;
        const data = await buildManagerTrainingDashboard(orgId(req), managerId);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postAssignCourse = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const result = await assignCourseToWorkflow(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postLmsSyncCertify = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        const result = await syncAndCertifyWorkflow(workflow, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getTrainingHistoryHandler = async (req, res) => {
    try {
        const data = await getTrainingHistory(orgId(req), req.params.employeeId);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const getLmsProviders = (_req, res) =>
    res.json({ success: true, data: listLmsProviders() });

// ── Part 4: Probation Center ──
export const getProbationCenter = async (req, res) => {
    try {
        const workflows = await OnboardingWorkflow.find({
            organizationId: orgId(req),
            isTemplate: { $ne: true },
            'probation.status': { $exists: true },
        }).populate('employeeId', 'name lastName email department managerId').lean();

        const dashboard = buildProbationDashboard(workflows);
        const active = workflows.filter((w) => ['Active', 'Extended'].includes(w.probation?.status));
        const upcoming = workflows.filter((w) => {
            const days = w.probation?.endDate ? Math.ceil((new Date(w.probation.endDate) - new Date()) / 86400000) : 999;
            return days >= 0 && days <= 30 && ['Active', 'Extended'].includes(w.probation?.status);
        });

        return res.json({
            success: true,
            data: { dashboard, active, upcoming, all: workflows },
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postProbationCenterExtend = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await extendProbation(workflow, req.body, { actor: actor(req), req });
        await workflow.save();
        return res.json({ success: true, data: workflow.probation });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const postProbationCenterReview = async (req, res) => {
    try {
        const workflow = await loadOnboarding(orgId(req), req.params.workflowId);
        await submitProbationReview(workflow, req.body, { actor: actor(req), req });
        applyProgressToWorkflow(workflow);
        await workflow.save();
        return res.json({ success: true, data: workflow.probation });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// ── Part 5: Dashboards ──
export const getDashboardTypes = (_req, res) =>
    res.json({ success: true, data: listDashboardTypes() });

export const getEnterpriseDashboard = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'enterpriseDashboards', 'Enterprise dashboards');
        const data = await buildDashboard(orgId(req), req.params.type, req.query);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

// ── Part 6: Search ──
export const getSearchCategories = (_req, res) =>
    res.json({ success: true, data: listSearchCategories() });

export const getGlobalSearch = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'globalLifecycleSearch', 'Global lifecycle search');
        const data = await globalLifecycleSearch(orgId(req), {
            q: req.query.q,
            categories: req.query.categories ? req.query.categories.split(',') : [],
            limit: Number(req.query.limit) || 20,
            department: req.query.department,
            status: req.query.status,
        });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const postSavedSearch = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'globalLifecycleSearch', 'Global lifecycle search');
        const saved = await saveSearch(orgId(req), actor(req)?._id, req.body);
        return res.json({ success: true, data: saved });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getSavedSearches = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'globalLifecycleSearch', 'Global lifecycle search');
        const data = await listSavedSearches(orgId(req), actor(req)?._id);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

// ── Part 7: Notification Center ──
export const getNotificationCenter = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'notificationCenter', 'Notification center');
        const data = await getNotificationCenterConfig(orgId(req));
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const patchNotificationCenter = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'notificationCenter', 'Notification center');
        const data = await updateNotificationCenterConfig(orgId(req), req.body, { actor: actor(req), req });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const getNotificationMeta = (_req, res) =>
    res.json({
        success: true,
        data: { channels: listNotificationChannels(), events: listLifecycleEventTypes() },
    });

// ── Part 8: Bulk ──
export const getBulkOperations = (_req, res) =>
    res.json({ success: true, data: BULK_OPERATIONS });

export const postBulkOperation = async (req, res) => {
    try {
        const result = await executeBulkOperation(orgId(req), req.body, { actor: actor(req), req });
        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

// ── Part 9: Branding ──
export const getLifecycleBranding = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'whiteLabelBranding', 'White-label branding');
        const data = await getOrganizationBranding(orgId(req));
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};

export const patchLifecycleBranding = async (req, res) => {
    try {
        await assertOrgFeature(orgId(req), 'whiteLabelBranding', 'White-label branding');
        const data = await updateLifecycleBranding(orgId(req), req.body);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(error.status || error.statusCode || 400).json({
            success: false, code: error.code, featureKey: error.featureKey, message: error.message,
        });
    }
};
