/**
 * Tenant / SaaS context — subscription, features, usage limits.
 */

import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import {
    getPlanDetails,
    getPlanMaxEmployees,
    getPlanModuleFeatures,
    isTrialActive,
} from '../helpers/subscriptionPlans.js';
import { SAAS_FEATURES } from '../constants/saasFeatures.js';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trial']);

export class TenantError extends Error {
    constructor(message, statusCode = 403, code = 'TENANT_ERROR', details = null) {
        super(message);
        this.name = 'TenantError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

/**
 * Load organization tenant record (cached per request via req.tenant).
 * @param {string} organizationId
 * @param {Object} [projection]
 */
export const loadTenantOrganization = async (organizationId, projection = null) => {
    const select = projection || [
        'name',
        'subscriptionPlan',
        'subscriptionStatus',
        'maxEmployees',
        'trialEndDate',
        'trialStartDate',
        'isActive',
        'settings.features',
    ].join(' ');

    return Organization.findById(organizationId).select(select).lean();
};

/**
 * Attach tenant snapshot to request (call after auth + organizationId known).
 */
export const attachTenantToRequest = async (req) => {
    const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
    if (!organizationId) return null;

    if (req.tenant?.organizationId?.toString() === organizationId.toString()) {
        return req.tenant;
    }

    const org = await loadTenantOrganization(organizationId);
    if (!org) {
        throw new TenantError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }

    const planId = (org.subscriptionPlan || 'free').toLowerCase();
    const plan = getPlanDetails(planId) || getPlanDetails('free');
    const maxEmployees = org.maxEmployees ?? plan.maxEmployees ?? getPlanMaxEmployees(planId);
    const planFeatures = getPlanModuleFeatures(planId);
    const rawOverrides = org.settings?.features;
    const orgFeatureOverrides =
        rawOverrides instanceof Map
            ? Object.fromEntries(rawOverrides)
            : rawOverrides && typeof rawOverrides === 'object'
                ? rawOverrides
                : {};

    const features = { ...planFeatures };
    Object.keys(orgFeatureOverrides).forEach((key) => {
        if (typeof orgFeatureOverrides[key] === 'boolean') {
            features[key] = orgFeatureOverrides[key];
        }
    });

    const subscriptionStatus = org.subscriptionStatus || 'trial';
    const trialActive = subscriptionStatus === 'trial' && isTrialActive(org.trialEndDate);
    const subscriptionActive =
        org.isActive !== false &&
        (ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus) || trialActive);

    req.tenant = {
        organizationId,
        organization: org,
        planId,
        planName: plan.name,
        maxEmployees,
        features,
        subscriptionStatus,
        subscriptionActive,
        trialActive,
    };

    return req.tenant;
};

export const assertSubscriptionActive = (tenant) => {
    if (!tenant?.subscriptionActive) {
        throw new TenantError(
            'Your organization subscription is inactive or expired. Please renew to continue.',
            403,
            'SUBSCRIPTION_INACTIVE'
        );
    }
};

export const isFeatureEnabledForTenant = (tenant, featureKey) => {
    if (!tenant) return false;
    if (featureKey === SAAS_FEATURES.EMPLOYEES) return true;
    return Boolean(tenant.features?.[featureKey]);
};

export const assertFeatureEnabled = (tenant, featureKey) => {
    assertSubscriptionActive(tenant);
    if (!isFeatureEnabledForTenant(tenant, featureKey)) {
        throw new TenantError(
            `This feature is not included in your current plan (${tenant.planName || tenant.planId}). Please upgrade to access it.`,
            403,
            'FEATURE_NOT_AVAILABLE',
            { feature: featureKey, planId: tenant.planId }
        );
    }
};

/**
 * Count active employees and enforce plan limit before create/import.
 * @param {string} organizationId
 * @param {Object} tenant - from attachTenantToRequest
 * @param {{ additional?: number }} options
 */
export const assertEmployeeCapacity = async (organizationId, tenant, { additional = 1 } = {}) => {
    assertSubscriptionActive(tenant);
    assertFeatureEnabled(tenant, SAAS_FEATURES.EMPLOYEES);

    const max = tenant.maxEmployees ?? 0;
    if (max <= 0) return { current: 0, max: 0, remaining: Infinity };

    const current = await Employee.countDocuments({
        organizationId,
        status: { $in: ['active', 'inactive', 'suspended'] },
    });

    if (current + additional > max) {
        throw new TenantError(
            `Employee limit reached (${current}/${max}). Please upgrade your plan to add more employees.`,
            403,
            'EMPLOYEE_LIMIT_REACHED',
            { current, max, planId: tenant.planId }
        );
    }

    return { current, max, remaining: max - current };
};

export const getTenantUsageSnapshot = async (organizationId, tenant) => {
    const employeeCount = await Employee.countDocuments({
        organizationId,
        status: { $in: ['active', 'inactive', 'suspended'] },
    });
    const maxEmployees = tenant?.maxEmployees ?? 0;
    return {
        employees: {
            current: employeeCount,
            max: maxEmployees,
            percent: maxEmployees > 0 ? Number(((employeeCount / maxEmployees) * 100).toFixed(1)) : 0,
        },
        planId: tenant?.planId,
        planName: tenant?.planName,
        features: tenant?.features || {},
        subscriptionStatus: tenant?.subscriptionStatus,
        subscriptionActive: tenant?.subscriptionActive,
    };
};

export default {
    TenantError,
    loadTenantOrganization,
    attachTenantToRequest,
    assertSubscriptionActive,
    isFeatureEnabledForTenant,
    assertFeatureEnabled,
    assertEmployeeCapacity,
    getTenantUsageSnapshot,
};
