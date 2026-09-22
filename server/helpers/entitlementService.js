/**
 * Resolve effective SaaS entitlements for an organization.
 */

import {
  ALL_SAAS_FEATURES,
  SAAS_FEATURE_LABELS,
} from '../constants/saasFeatures.js';
import { getPlanDetails, getPlanModuleFeatures, getPlanMaxEmployees } from './subscriptionPlans.js';

const toFeatureObject = (features) => {
  if (!features) return {};
  if (features instanceof Map) return Object.fromEntries(features);
  if (typeof features === 'object') return { ...features };
  return {};
};

/**
 * @param {object} org - Organization lean/doc with subscriptionPlan, maxEmployees, settings.features
 */
export const resolveEffectiveEntitlement = (org) => {
  const planId = String(org?.subscriptionPlan || 'free').toLowerCase();
  const plan = getPlanDetails(planId) || getPlanDetails('free');
  const planFeatures = getPlanModuleFeatures(planId);
  const overrides = toFeatureObject(org?.settings?.features);

  const features = { ...planFeatures };
  Object.keys(overrides).forEach((key) => {
    if (typeof overrides[key] === 'boolean') {
      features[key] = overrides[key];
    }
  });

  // Employees module is always commercially available; seats are the limit.
  features.employees = true;

  const planMax = getPlanMaxEmployees(planId);
  const maxEmployees = org?.maxEmployees ?? planMax;

  const effectiveAccess = ALL_SAAS_FEATURES.map((key) => {
    const planEnabled = Boolean(planFeatures[key]) || key === 'employees';
    const hasOverride = typeof overrides[key] === 'boolean';
    const overrideEnabled = hasOverride ? overrides[key] : null;
    const effective = Boolean(features[key]);
    return {
      featureKey: key,
      label: SAAS_FEATURE_LABELS[key] || key,
      planEnabled,
      hasOverride,
      overrideEnabled,
      effective,
      reason: !effective
        ? hasOverride && overrideEnabled === false
          ? 'Disabled by organization override'
          : 'Not included in plan'
        : hasOverride
          ? 'Enabled via organization override'
          : 'Included in plan',
    };
  });

  return {
    planId,
    planName: plan?.name || planId,
    planFeatures,
    featureOverrides: overrides,
    features,
    limits: {
      maxEmployees,
      planMaxEmployees: planMax,
    },
    limitOverrides: {
      maxEmployees:
        org?.maxEmployees != null && org.maxEmployees !== planMax
          ? org.maxEmployees
          : null,
    },
    effectiveAccess,
    subscriptionStatus: org?.subscriptionStatus || 'trial',
    isActive: org?.isActive !== false,
  };
};

export default resolveEffectiveEntitlement;
