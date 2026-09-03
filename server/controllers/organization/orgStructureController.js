import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { requireOrganizationId } from '../../helpers/organizationHelper.js';
import {
    getStructureCatalog,
    seedOrgStructureFromOrganization,
    createMasterRecord,
    updateMasterRecord,
    deleteMasterRecord,
    listMasterRecords,
    MASTER_MODELS,
} from '../../services/orgStructureService.js';
import { getTenantUsageSnapshot } from '../../services/tenantService.js';
import { SAAS_FEATURE_LABELS } from '../../constants/saasFeatures.js';
import asyncHandler from '../../helpers/asyncHandler.js';

const RESOURCES = Object.keys(MASTER_MODELS);

export const getOrgStructureCatalog = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const { departmentId } = req.query;
    const catalog = await getStructureCatalog(organizationId, { departmentId });
    return sendSuccess(res, catalog, 'Organization structure catalog');
});

export const seedOrgStructure = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const result = await seedOrgStructureFromOrganization(organizationId);
    const catalog = await getStructureCatalog(organizationId);
    return sendSuccess(res, { ...result, catalog }, 'Organization structure initialized');
});

export const listOrgMaster = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const { resource } = req.params;
    if (!RESOURCES.includes(resource)) {
        return sendError(res, 'Invalid resource', 400, 'INVALID_RESOURCE');
    }
    const items = await listMasterRecords(organizationId, resource, {
        departmentId: req.query.departmentId,
    });
    return sendSuccess(res, { items }, `${resource} list`);
});

export const createOrgMaster = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const { resource } = req.params;
    if (!RESOURCES.includes(resource)) {
        return sendError(res, 'Invalid resource', 400, 'INVALID_RESOURCE');
    }
    const item = await createMasterRecord(organizationId, resource, req.body);
    return sendSuccess(res, { item }, 'Created', 201);
});

export const updateOrgMaster = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const { resource, id } = req.params;
    if (!RESOURCES.includes(resource)) {
        return sendError(res, 'Invalid resource', 400, 'INVALID_RESOURCE');
    }
    try {
        const item = await updateMasterRecord(organizationId, resource, id, req.body);
        return sendSuccess(res, { item }, 'Updated');
    } catch (error) {
        return sendError(res, error.message, 404, 'NOT_FOUND');
    }
});

export const deleteOrgMaster = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const { resource, id } = req.params;
    if (!RESOURCES.includes(resource)) {
        return sendError(res, 'Invalid resource', 400, 'INVALID_RESOURCE');
    }
    try {
        const item = await deleteMasterRecord(organizationId, resource, id);
        return sendSuccess(res, { item }, 'Deactivated');
    } catch (error) {
        return sendError(res, error.message, 404, 'NOT_FOUND');
    }
});

export const getTenantFeaturesAndUsage = asyncHandler(async (req, res) => {
    const organizationId = requireOrganizationId(req);
    const usage = await getTenantUsageSnapshot(organizationId, req.tenant);
    return sendSuccess(res, {
        usage,
        featureLabels: SAAS_FEATURE_LABELS,
        features: req.tenant?.features || {},
        planId: req.tenant?.planId,
        planName: req.tenant?.planName,
        subscriptionStatus: req.tenant?.subscriptionStatus,
    }, 'Tenant features and usage');
});
