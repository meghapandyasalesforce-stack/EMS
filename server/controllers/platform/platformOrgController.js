/**
 * Cross-tenant organization / subscription management for platform operators.
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import Organization from '../../models/organization.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import PlatformAuditLog from '../../models/platformAuditLog.model.js';
import { sendSuccess, sendNotFound, sendValidationError, sendError } from '../../helpers/responseHelper.js';
import {
    getPlanDetails,
    getPlanMaxEmployees,
    getPlanModuleFeatures,
    listKnownPlanIds,
    calculateTrialEndDate,
} from '../../helpers/subscriptionPlans.js';
import { ALL_SAAS_FEATURES, SAAS_FEATURE_LABELS, FEATURE_CATALOG } from '../../constants/saasFeatures.js';
import {
    attachTenantToRequest,
    getTenantUsageSnapshot,
} from '../../services/tenantService.js';
import { resolveEffectiveEntitlement } from '../../helpers/entitlementService.js';
import { listCachedPlans } from '../../helpers/planCatalog.js';
import { logPlatformAction } from '../../helpers/platformAudit.js';
import { PLATFORM_ROLES } from '../../config/identity.constants.js';
import logger from '../../helpers/logger.js';

const VALID_STATUSES = ['active', 'trial', 'expired', 'cancelled', 'past_due'];
const VALID_VERIFICATION = ['pending', 'verified', 'rejected'];

const toFeatureObject = (features) => {
    if (!features) return {};
    if (features instanceof Map) return Object.fromEntries(features);
    if (typeof features === 'object') return { ...features };
    return {};
};

const serializeOrgSummary = (org) => ({
    id: org._id,
    name: org.name,
    email: org.email,
    phone: org.phone || null,
    website: org.website || null,
    domain: org.domain || null,
    subscriptionPlan: org.subscriptionPlan || 'free',
    subscriptionStatus: org.subscriptionStatus || 'trial',
    maxEmployees: org.maxEmployees,
    isActive: org.isActive !== false,
    isTrialActive: !!org.isTrialActive,
    trialEndDate: org.trialEndDate || null,
    subscriptionStartDate: org.subscriptionStartDate || null,
    subscriptionEndDate: org.subscriptionEndDate || null,
    verificationStatus: org.verificationStatus || 'pending',
    platformTags: org.platformTags || [],
    paymentMethod: org.paymentMethod || 'none',
    razorpayCustomerId: org.razorpayCustomerId || null,
    razorpayOrderId: org.razorpayOrderId || null,
    stripeCustomerId: org.stripeCustomerId || null,
    deletedAt: org.deletedAt || null,
    createdAt: org.createdAt,
});

/**
 * GET /api/v1/platform/dashboard
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    const base = { deletedAt: null };
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
        totalOrgs,
        activeOrgs,
        suspendedOrgs,
        trialOrgs,
        trialsEndingSoon,
        pendingVerification,
        byPlan,
        recentOrgs,
    ] = await Promise.all([
        Organization.countDocuments(base),
        Organization.countDocuments({ ...base, isActive: true }),
        Organization.countDocuments({ ...base, isActive: false }),
        Organization.countDocuments({ ...base, subscriptionStatus: 'trial' }),
        Organization.countDocuments({
            ...base,
            subscriptionStatus: 'trial',
            trialEndDate: { $gte: now, $lte: inSevenDays },
        }),
        Organization.countDocuments({ ...base, verificationStatus: 'pending' }),
        Organization.aggregate([
            { $match: base },
            { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } },
        ]),
        Organization.find(base)
            .select('name email subscriptionPlan subscriptionStatus createdAt isActive')
            .sort({ createdAt: -1 })
            .limit(8)
            .lean(),
    ]);

    const planCounts = {};
    listKnownPlanIds().forEach((id) => {
        planCounts[id] = 0;
    });
    byPlan.forEach((row) => {
        planCounts[row._id || 'free'] = row.count;
    });

    // Rough MRR estimate from cached plan prices × active paid orgs
    let estimatedMrr = 0;
    const plans = listCachedPlans();
    for (const plan of plans) {
        if (!plan.price) continue;
        const count = await Organization.countDocuments({
            ...base,
            isActive: true,
            subscriptionPlan: plan.planId,
            subscriptionStatus: { $in: ['active', 'past_due'] },
        });
        estimatedMrr += count * (plan.price || 0);
    }

    return sendSuccess(res, {
        stats: {
            totalOrgs,
            activeOrgs,
            suspendedOrgs,
            trialOrgs,
            trialsEndingSoon,
            pendingVerification,
            estimatedMrr,
            planCounts,
        },
        recentOrganizations: recentOrgs.map(serializeOrgSummary),
    });
});

/**
 * GET /api/v1/platform/organizations
 */
export const listOrganizations = asyncHandler(async (req, res) => {
    const {
        search = '',
        plan,
        status,
        isActive,
        verificationStatus,
        tag,
        includeDeleted = 'false',
        onlyDeleted = 'false',
        page = 1,
        limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (onlyDeleted === 'true') {
        filter.deletedAt = { $ne: null };
    } else if (includeDeleted !== 'true') {
        filter.deletedAt = null;
    }
    if (search && String(search).trim()) {
        const q = String(search).trim();
        filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { domain: { $regex: q, $options: 'i' } },
        ];
    }
    const knownPlans = listKnownPlanIds();
    if (plan && knownPlans.includes(String(plan).toLowerCase())) {
        filter.subscriptionPlan = String(plan).toLowerCase();
    }
    if (status && VALID_STATUSES.includes(String(status).toLowerCase())) {
        filter.subscriptionStatus = String(status).toLowerCase();
    }
    if (isActive === 'true' || isActive === 'false') {
        filter.isActive = isActive === 'true';
    }
    if (verificationStatus && VALID_VERIFICATION.includes(String(verificationStatus))) {
        filter.verificationStatus = verificationStatus;
    }
    if (tag && String(tag).trim()) {
        filter.platformTags = String(tag).trim().toLowerCase();
    }

    const [organizations, total] = await Promise.all([
        Organization.find(filter)
            .select(
                'name email phone website domain subscriptionPlan subscriptionStatus maxEmployees isActive isTrialActive trialEndDate subscriptionStartDate subscriptionEndDate verificationStatus platformTags paymentMethod razorpayCustomerId stripeCustomerId deletedAt createdAt'
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Organization.countDocuments(filter),
    ]);

    return sendSuccess(res, {
        organizations: organizations.map(serializeOrgSummary),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
        },
    });
});

/**
 * GET /api/v1/platform/organizations/export
 */
export const exportOrganizationsCsv = asyncHandler(async (req, res) => {
    const orgs = await Organization.find({ deletedAt: null })
        .select(
            'name email domain subscriptionPlan subscriptionStatus maxEmployees isActive verificationStatus trialEndDate createdAt platformTags'
        )
        .sort({ createdAt: -1 })
        .lean();

    const header = [
        'id',
        'name',
        'email',
        'domain',
        'plan',
        'status',
        'maxEmployees',
        'isActive',
        'verification',
        'trialEnd',
        'tags',
        'createdAt',
    ];
    const rows = orgs.map((o) =>
        [
            o._id,
            JSON.stringify(o.name || ''),
            o.email || '',
            o.domain || '',
            o.subscriptionPlan || '',
            o.subscriptionStatus || '',
            o.maxEmployees ?? '',
            o.isActive !== false,
            o.verificationStatus || '',
            o.trialEndDate ? new Date(o.trialEndDate).toISOString().slice(0, 10) : '',
            (o.platformTags || []).join('|'),
            o.createdAt ? new Date(o.createdAt).toISOString() : '',
        ].join(',')
    );

    const csv = [header.join(','), ...rows].join('\n');
    await logPlatformAction({
        req,
        action: 'export_organizations',
        entityType: 'Organization',
        summary: `Exported ${orgs.length} organizations`,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="organizations.csv"');
    return res.status(200).send(csv);
});

/**
 * POST /api/v1/platform/organizations
 */
export const createOrganization = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        phone,
        website,
        domain,
        subscriptionPlan = 'free',
        ownerName,
        ownerEmail,
        ownerPassword,
    } = req.body;

    if (!name || !email || !ownerName || !ownerEmail || !ownerPassword) {
        return sendValidationError(res, {
            name: !name ? 'Required' : undefined,
            email: !email ? 'Required' : undefined,
            ownerName: !ownerName ? 'Required' : undefined,
            ownerEmail: !ownerEmail ? 'Required' : undefined,
            ownerPassword: !ownerPassword ? 'Required' : undefined,
        });
    }
    if (String(ownerPassword).length < 8) {
        return sendValidationError(res, { ownerPassword: 'Must be at least 8 characters' });
    }

    const planId = String(subscriptionPlan || 'free').toLowerCase();
    if (!listKnownPlanIds().includes(planId)) {
        return sendValidationError(res, { subscriptionPlan: 'Invalid plan' });
    }

    const existingOrg = await Organization.findOne({ email: String(email).toLowerCase().trim() });
    if (existingOrg) {
        return sendError(res, 'Organization email already exists', 409, 'ORG_EMAIL_EXISTS');
    }

    const trialStart = new Date();
    const org = await Organization.create({
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        phone: phone || undefined,
        website: website || undefined,
        domain: domain ? String(domain).toLowerCase().trim() : undefined,
        subscriptionPlan: planId,
        maxEmployees: getPlanMaxEmployees(planId),
        subscriptionStatus: 'trial',
        isTrialActive: true,
        trialStartDate: trialStart,
        trialEndDate: calculateTrialEndDate(trialStart, planId),
        trialDays: getPlanDetails(planId)?.trialDays || 14,
        subscriptionStartDate: trialStart,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        isActive: true,
    });

    const owner = new User({
        name: String(ownerName).trim(),
        email: String(ownerEmail).toLowerCase().trim(),
        password: ownerPassword,
        role: 'admin',
        roles: [PLATFORM_ROLES.ORG_OWNER, PLATFORM_ROLES.HR_ADMIN],
        organizationId: org._id,
        isActive: true,
        emailVerified: true,
    });
    await owner.save();

    await logPlatformAction({
        req,
        action: 'create_organization',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Created organization ${org.name}`,
        after: serializeOrgSummary(org.toObject()),
    });

    return sendSuccess(
        res,
        {
            organization: serializeOrgSummary(org.toObject()),
            owner: { id: owner._id, name: owner.name, email: owner.email },
        },
        'Organization created',
        201
    );
});

/**
 * GET /api/v1/platform/organizations/:orgId
 */
export const getOrganization = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId)
        .select(
            'name email phone website domain subscriptionPlan subscriptionStatus maxEmployees isActive isTrialActive trialStartDate trialEndDate trialDays subscriptionStartDate subscriptionEndDate verificationStatus verifiedAt settings.features platformNotes platformTags paymentMethod razorpayCustomerId razorpaySubscriptionId razorpayOrderId razorpayPaymentId stripeCustomerId stripeSubscriptionId deletedAt createdAt updatedAt'
        )
        .lean();

    if (!org) {
        return sendNotFound(res, 'Organization not found');
    }

    const entitlement = resolveEffectiveEntitlement(org);
    const planFeatures = entitlement.planFeatures;
    const overrides = entitlement.featureOverrides;
    const effectiveFeatures = entitlement.features;

    req.organizationId = orgId;
    let usage = null;
    try {
        const tenant = await attachTenantToRequest(req);
        usage = await getTenantUsageSnapshot(orgId, tenant);
    } catch (error) {
        logger.warn('Platform getOrganization usage snapshot failed', {
            orgId,
            error: error.message,
        });
    }

    const [admins, auditLogs, employeeCount] = await Promise.all([
        User.find({
            organizationId: orgId,
            role: { $ne: 'platform' },
        })
            .select('name email roles role isActive createdAt')
            .sort({ createdAt: 1 })
            .limit(50)
            .lean(),
        PlatformAuditLog.find({ organizationId: orgId })
            .sort({ createdAt: -1 })
            .limit(30)
            .lean(),
        Employee.countDocuments({
            organizationId: orgId,
            status: { $in: ['active', 'inactive', 'suspended'] },
        }),
    ]);

    return sendSuccess(res, {
        organization: {
            ...serializeOrgSummary(org),
            trialStartDate: org.trialStartDate || null,
            trialDays: org.trialDays,
            platformNotes: org.platformNotes || '',
            featureOverrides: overrides,
            planFeatures,
            effectiveFeatures,
            entitlement,
            verifiedAt: org.verifiedAt || null,
            razorpayCustomerId: org.razorpayCustomerId || null,
            razorpaySubscriptionId: org.razorpaySubscriptionId || null,
            razorpayOrderId: org.razorpayOrderId || null,
            razorpayPaymentId: org.razorpayPaymentId || null,
            stripeSubscriptionId: org.stripeSubscriptionId || null,
            updatedAt: org.updatedAt,
        },
        usage: usage || {
            employees: { current: employeeCount, max: org.maxEmployees, percent: 0 },
        },
        admins: admins.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            roles: u.roles || [],
            role: u.role,
            isActive: u.isActive !== false,
            createdAt: u.createdAt,
        })),
        auditLogs: auditLogs.map((a) => ({
            id: a._id,
            action: a.action,
            summary: a.summary,
            operatorEmail: a.operatorEmail,
            createdAt: a.createdAt,
            before: a.before,
            after: a.after,
        })),
        featureLabels: SAAS_FEATURE_LABELS,
        availableFeatures: ALL_SAAS_FEATURES,
    });
});

/**
 * PATCH /api/v1/platform/organizations/:orgId
 */
export const updateOrganization = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const {
        isActive,
        verificationStatus,
        name,
        email,
        phone,
        website,
        domain,
        platformNotes,
        platformTags,
        paymentMethod,
        razorpayCustomerId,
        razorpaySubscriptionId,
        stripeCustomerId,
        stripeSubscriptionId,
    } = req.body;

    const org = await Organization.findById(orgId);
    if (!org) {
        return sendNotFound(res, 'Organization not found');
    }

    const before = serializeOrgSummary(org.toObject());

    if (typeof isActive === 'boolean') {
        org.isActive = isActive;
    }
    if (verificationStatus !== undefined) {
        if (!VALID_VERIFICATION.includes(verificationStatus)) {
            return sendValidationError(res, { verificationStatus: 'Invalid verification status' });
        }
        org.verificationStatus = verificationStatus;
        if (verificationStatus === 'verified') {
            org.verifiedAt = new Date();
        }
    }
    if (name !== undefined) org.name = String(name).trim();
    if (email !== undefined) org.email = String(email).toLowerCase().trim();
    if (phone !== undefined) org.phone = phone;
    if (website !== undefined) org.website = website;
    if (domain !== undefined) org.domain = domain ? String(domain).toLowerCase().trim() : undefined;
    if (platformNotes !== undefined) org.platformNotes = String(platformNotes);
    if (platformTags !== undefined) {
        if (!Array.isArray(platformTags)) {
            return sendValidationError(res, { platformTags: 'Must be an array of strings' });
        }
        org.platformTags = platformTags
            .map((t) => String(t).trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 20);
    }
    if (paymentMethod !== undefined) {
        if (!['none', 'razorpay', 'stripe', 'paypal', 'bank_transfer'].includes(paymentMethod)) {
            return sendValidationError(res, { paymentMethod: 'Invalid payment method' });
        }
        org.paymentMethod = paymentMethod;
    }
    if (razorpayCustomerId !== undefined) org.razorpayCustomerId = razorpayCustomerId || undefined;
    if (razorpaySubscriptionId !== undefined) {
        org.razorpaySubscriptionId = razorpaySubscriptionId || undefined;
    }
    if (stripeCustomerId !== undefined) org.stripeCustomerId = stripeCustomerId || undefined;
    if (stripeSubscriptionId !== undefined) {
        org.stripeSubscriptionId = stripeSubscriptionId || undefined;
    }

    await org.save();
    const after = serializeOrgSummary(org.toObject());

    await logPlatformAction({
        req,
        action: 'update_organization',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Updated organization ${org.name}`,
        before,
        after,
    });

    return sendSuccess(res, { organization: after }, 'Organization updated');
});

/**
 * POST /api/v1/platform/organizations/:orgId/extend-trial
 */
export const extendTrial = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const days = Math.max(1, parseInt(req.body?.days, 10) || 14);

    const org = await Organization.findById(orgId);
    if (!org) return sendNotFound(res, 'Organization not found');

    const before = {
        trialEndDate: org.trialEndDate,
        subscriptionStatus: org.subscriptionStatus,
        isTrialActive: org.isTrialActive,
    };

    const base = org.trialEndDate && new Date(org.trialEndDate) > new Date()
        ? new Date(org.trialEndDate)
        : new Date();
    base.setDate(base.getDate() + days);
    org.trialEndDate = base;
    org.isTrialActive = true;
    org.subscriptionStatus = 'trial';
    if (!org.trialStartDate) org.trialStartDate = new Date();
    await org.save();

    await logPlatformAction({
        req,
        action: 'extend_trial',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Extended trial by ${days} days`,
        before,
        after: {
            trialEndDate: org.trialEndDate,
            subscriptionStatus: org.subscriptionStatus,
            isTrialActive: org.isTrialActive,
        },
    });

    return sendSuccess(res, { organization: serializeOrgSummary(org.toObject()) }, 'Trial extended');
});

/**
 * POST /api/v1/platform/organizations/:orgId/soft-delete
 */
export const softDeleteOrganization = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return sendNotFound(res, 'Organization not found');

    org.deletedAt = new Date();
    org.isActive = false;
    await org.save();

    await logPlatformAction({
        req,
        action: 'soft_delete_organization',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Soft-deleted organization ${org.name}`,
    });

    return sendSuccess(res, { organization: serializeOrgSummary(org.toObject()) }, 'Organization soft-deleted');
});

/**
 * POST /api/v1/platform/organizations/:orgId/restore
 */
export const restoreOrganization = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) return sendNotFound(res, 'Organization not found');

    org.deletedAt = null;
    org.isActive = true;
    await org.save();

    await logPlatformAction({
        req,
        action: 'restore_organization',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Restored organization ${org.name}`,
    });

    return sendSuccess(res, { organization: serializeOrgSummary(org.toObject()) }, 'Organization restored');
});

/**
 * PATCH /api/v1/platform/organizations/:orgId/subscription
 */
export const updateOrganizationSubscription = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const {
        subscriptionPlan,
        subscriptionStatus,
        maxEmployees,
        subscriptionEndDate,
        trialEndDate,
        isTrialActive,
    } = req.body;

    const org = await Organization.findById(orgId);
    if (!org) {
        return sendNotFound(res, 'Organization not found');
    }

    const before = serializeOrgSummary(org.toObject());

    if (subscriptionPlan !== undefined) {
        const planId = String(subscriptionPlan).toLowerCase();
        if (!listKnownPlanIds().includes(planId)) {
            return sendValidationError(res, {
                subscriptionPlan: `Invalid plan. Allowed: ${listKnownPlanIds().join(', ')}`,
            });
        }
        org.subscriptionPlan = planId;
        if (maxEmployees === undefined) {
            org.maxEmployees = getPlanMaxEmployees(planId);
        }
        if (!org.subscriptionStartDate) {
            org.subscriptionStartDate = new Date();
        }
    }

    if (subscriptionStatus !== undefined) {
        const status = String(subscriptionStatus).toLowerCase();
        if (!VALID_STATUSES.includes(status)) {
            return sendValidationError(res, {
                subscriptionStatus: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
            });
        }
        org.subscriptionStatus = status;
    }

    if (maxEmployees !== undefined) {
        const parsed = Number(maxEmployees);
        if (!Number.isFinite(parsed) || parsed < 1) {
            return sendValidationError(res, { maxEmployees: 'maxEmployees must be a positive number' });
        }
        org.maxEmployees = Math.floor(parsed);
    }

    if (subscriptionEndDate !== undefined) {
        org.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
    }
    if (trialEndDate !== undefined) {
        org.trialEndDate = trialEndDate ? new Date(trialEndDate) : null;
    }
    if (typeof isTrialActive === 'boolean') {
        org.isTrialActive = isTrialActive;
    }

    await org.save();

    await logPlatformAction({
        req,
        action: 'update_subscription',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: `Updated subscription to ${org.subscriptionPlan}/${org.subscriptionStatus}`,
        before,
        after: serializeOrgSummary(org.toObject()),
    });

    return sendSuccess(
        res,
        {
            organization: serializeOrgSummary(org.toObject()),
            plan: getPlanDetails(org.subscriptionPlan),
        },
        'Subscription updated'
    );
});

/**
 * PATCH /api/v1/platform/organizations/:orgId/features
 */
export const updateOrganizationFeatures = asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const { features, replace = false } = req.body;

    if (!features || typeof features !== 'object' || Array.isArray(features)) {
        return sendValidationError(res, { features: 'features must be an object of boolean flags' });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
        return sendNotFound(res, 'Organization not found');
    }

    if (!org.settings) {
        org.settings = {};
    }

    const before = toFeatureObject(org.settings.features);
    const next = replace ? {} : { ...before };

    Object.entries(features).forEach(([key, value]) => {
        if (!ALL_SAAS_FEATURES.includes(key)) {
            return;
        }
        if (value === null) {
            delete next[key];
            return;
        }
        if (typeof value === 'boolean') {
            next[key] = value;
        }
    });

    const invalidKeys = Object.keys(features).filter(
        (k) => !ALL_SAAS_FEATURES.includes(k) && features[k] !== null
    );
    if (invalidKeys.length) {
        return sendValidationError(res, {
            features: `Unknown feature keys: ${invalidKeys.join(', ')}`,
        });
    }

    org.settings.features = next;
    org.markModified('settings.features');
    await org.save();

    const entitlement = resolveEffectiveEntitlement(org.toObject());
    const overrides = entitlement.featureOverrides;

    await logPlatformAction({
        req,
        action: 'update_features',
        entityType: 'Organization',
        entityId: org._id,
        organizationId: org._id,
        summary: 'Updated feature overrides',
        before,
        after: overrides,
    });

    return sendSuccess(
        res,
        {
            organization: {
                id: org._id,
                featureOverrides: overrides,
                planFeatures: entitlement.planFeatures,
                effectiveFeatures: entitlement.features,
                entitlement,
            },
        },
        'Feature overrides updated'
    );
});

/**
 * PATCH /api/v1/platform/organizations/:orgId/admins/:userId
 */
export const updateOrganizationAdmin = asyncHandler(async (req, res) => {
    const { orgId, userId } = req.params;
    const { isActive, password } = req.body;

    const user = await User.findOne({
        _id: userId,
        organizationId: orgId,
        role: { $ne: 'platform' },
    }).select('+password');

    if (!user) {
        return sendNotFound(res, 'Admin user not found');
    }

    const before = { isActive: user.isActive };
    if (typeof isActive === 'boolean') {
        user.isActive = isActive;
    }
    if (password) {
        if (String(password).length < 8) {
            return sendValidationError(res, { password: 'Must be at least 8 characters' });
        }
        user.password = password;
    }
    await user.save();

    await logPlatformAction({
        req,
        action: password ? 'reset_admin_password' : 'update_admin',
        entityType: 'User',
        entityId: user._id,
        organizationId: orgId,
        summary: password
            ? `Reset password for ${user.email}`
            : `Updated admin ${user.email} active=${user.isActive}`,
        before,
        after: { isActive: user.isActive, passwordReset: Boolean(password) },
    });

    return sendSuccess(
        res,
        {
            admin: {
                id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                isActive: user.isActive,
            },
        },
        'Admin updated'
    );
});

/**
 * GET /api/v1/platform/plans
 */
export const listPlans = asyncHandler(async (req, res) => {
    const plans = listCachedPlans().map((plan) => ({
        id: plan.planId,
        name: plan.name,
        price: plan.price,
        maxEmployees: plan.maxEmployees,
        trialDays: plan.trialDays,
        features: plan.features,
        moduleFeatures: plan.moduleFeatures,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
    }));

    const counts = {};
    for (const plan of plans) {
        counts[plan.id] = await Organization.countDocuments({
            deletedAt: null,
            subscriptionPlan: plan.id,
        });
    }

    return sendSuccess(res, {
        plans: plans.map((p) => ({ ...p, orgCount: counts[p.id] || 0 })),
        featureLabels: SAAS_FEATURE_LABELS,
        availableFeatures: ALL_SAAS_FEATURES,
    });
});

/**
 * GET /api/v1/platform/feature-catalog
 */
export const getFeatureCatalog = asyncHandler(async (req, res) => {
    return sendSuccess(res, {
        catalog: FEATURE_CATALOG,
        featureLabels: SAAS_FEATURE_LABELS,
        availableFeatures: ALL_SAAS_FEATURES,
    });
});

/**
 * GET /api/v1/platform/audit-logs
 */
export const listPlatformAuditLogs = asyncHandler(async (req, res) => {
    const { organizationId, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const filter = {};
    if (organizationId) filter.organizationId = organizationId;

    const [logs, total] = await Promise.all([
        PlatformAuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        PlatformAuditLog.countDocuments(filter),
    ]);

    return sendSuccess(res, {
        auditLogs: logs.map((a) => ({
            id: a._id,
            organizationId: a.organizationId,
            action: a.action,
            entityType: a.entityType,
            summary: a.summary,
            operatorEmail: a.operatorEmail,
            createdAt: a.createdAt,
            before: a.before,
            after: a.after,
        })),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
        },
    });
});
