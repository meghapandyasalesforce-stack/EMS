/**
 * DB-backed subscription plan CRUD for platform operators.
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import SubscriptionPlan from '../../models/subscriptionPlan.model.js';
import { sendSuccess, sendNotFound, sendValidationError } from '../../helpers/responseHelper.js';
import { ALL_SAAS_FEATURES, SAAS_FEATURE_LABELS } from '../../constants/saasFeatures.js';
import { reloadPlanCache, listCachedPlans } from '../../helpers/planCatalog.js';
import { logPlatformAction } from '../../helpers/platformAudit.js';
import Organization from '../../models/organization.model.js';

/**
 * PATCH /api/v1/platform/plans/:planId
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const planId = String(req.params.planId || '').toLowerCase();
  const plan = await SubscriptionPlan.findOne({ planId });
  if (!plan) {
    return sendNotFound(res, 'Plan not found');
  }

  const before = plan.toObject();
  const {
    name,
    price,
    maxEmployees,
    trialDays,
    features,
    moduleFeatures,
    isActive,
    sortOrder,
  } = req.body;

  if (name !== undefined) plan.name = String(name).trim();
  if (price !== undefined) {
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) {
      return sendValidationError(res, { price: 'Invalid price' });
    }
    plan.price = p;
  }
  if (maxEmployees !== undefined) {
    const m = Number(maxEmployees);
    if (!Number.isFinite(m) || m < 1) {
      return sendValidationError(res, { maxEmployees: 'Must be >= 1' });
    }
    plan.maxEmployees = Math.floor(m);
  }
  if (trialDays !== undefined) {
    const t = Number(trialDays);
    if (!Number.isFinite(t) || t < 0) {
      return sendValidationError(res, { trialDays: 'Invalid trial days' });
    }
    plan.trialDays = Math.floor(t);
  }
  if (features !== undefined) {
    if (!Array.isArray(features)) {
      return sendValidationError(res, { features: 'Must be an array of strings' });
    }
    plan.features = features.map((f) => String(f).trim()).filter(Boolean);
  }
  if (moduleFeatures !== undefined) {
    if (typeof moduleFeatures !== 'object' || Array.isArray(moduleFeatures)) {
      return sendValidationError(res, { moduleFeatures: 'Must be an object' });
    }
    ALL_SAAS_FEATURES.forEach((key) => {
      if (typeof moduleFeatures[key] === 'boolean') {
        plan.moduleFeatures[key] = moduleFeatures[key];
      }
    });
    plan.markModified('moduleFeatures');
  }
  if (typeof isActive === 'boolean') plan.isActive = isActive;
  if (sortOrder !== undefined) plan.sortOrder = Number(sortOrder) || 0;

  await plan.save();
  await reloadPlanCache();

  const orgCount = await Organization.countDocuments({
    deletedAt: null,
    subscriptionPlan: planId,
  });

  await logPlatformAction({
    req,
    action: 'update_plan',
    entityType: 'SubscriptionPlan',
    entityId: plan._id,
    summary: `Updated plan ${planId}`,
    before: {
      name: before.name,
      price: before.price,
      maxEmployees: before.maxEmployees,
      moduleFeatures: before.moduleFeatures,
    },
    after: {
      name: plan.name,
      price: plan.price,
      maxEmployees: plan.maxEmployees,
      moduleFeatures: plan.moduleFeatures,
    },
  });

  return sendSuccess(
    res,
    {
      plan: {
        id: plan.planId,
        name: plan.name,
        price: plan.price,
        maxEmployees: plan.maxEmployees,
        trialDays: plan.trialDays,
        features: plan.features,
        moduleFeatures: plan.moduleFeatures,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        orgCount,
      },
      plans: listCachedPlans().map((p) => ({
        id: p.planId,
        name: p.name,
        price: p.price,
        maxEmployees: p.maxEmployees,
        trialDays: p.trialDays,
        features: p.features,
        moduleFeatures: p.moduleFeatures,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
      })),
      featureLabels: SAAS_FEATURE_LABELS,
    },
    'Plan updated'
  );
});
