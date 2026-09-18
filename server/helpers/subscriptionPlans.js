/**
 * Subscription plan helpers — reads DB-backed cache when available, else code defaults.
 */

import {
    SUBSCRIPTION_PLANS as DEFAULT_PLANS,
    PLAN_MODULE_FEATURES as DEFAULT_MODULE_FEATURES,
} from './subscriptionPlans.defaults.js';
import { getCachedPlan, getPlanCache } from './planCatalog.js';

/** @deprecated Prefer cached plans; kept for callers that import the constant map */
export const PLAN_MODULE_FEATURES = DEFAULT_MODULE_FEATURES;
/** @deprecated Prefer cached plans; kept for callers that import the constant map */
export const SUBSCRIPTION_PLANS = DEFAULT_PLANS;

const resolvePlan = (planId) => {
    const key = String(planId || 'free').toLowerCase();
    const cached = getCachedPlan(key);
    if (cached) return cached;
    const fallback = DEFAULT_PLANS[key] || DEFAULT_PLANS.free;
    return {
        planId: key,
        ...fallback,
        moduleFeatures: {
            ...(DEFAULT_MODULE_FEATURES[key] || DEFAULT_MODULE_FEATURES.free),
        },
    };
};

export const getPlanDetails = (planId) => {
    const plan = resolvePlan(planId);
    if (!plan) return null;
    return {
        name: plan.name,
        price: plan.price,
        maxEmployees: plan.maxEmployees,
        features: plan.features,
        trialDays: plan.trialDays,
    };
};

export const getPlanMaxEmployees = (planId) => {
    const plan = resolvePlan(planId);
    return plan?.maxEmployees ?? 10;
};

export const getPlanModuleFeatures = (planId) => {
    const plan = resolvePlan(planId);
    return { ...(plan?.moduleFeatures || DEFAULT_MODULE_FEATURES.free) };
};

export const isPlanFeatureEnabled = (planId, featureKey) => {
    const features = getPlanModuleFeatures(planId);
    return Boolean(features[featureKey]);
};

export const getPlanTrialDays = (planId) => {
    const plan = resolvePlan(planId);
    return plan?.trialDays ?? 14;
};

export const calculateTrialEndDate = (startDate, planId) => {
    const trialDays = getPlanTrialDays(planId);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + trialDays);
    return endDate;
};

export const isTrialActive = (trialEndDate) => {
    if (!trialEndDate) return false;
    return new Date() < new Date(trialEndDate);
};

export const getTrialDaysRemaining = (trialEndDate) => {
    if (!trialEndDate) return 0;
    const now = new Date();
    const end = new Date(trialEndDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
};

export const listKnownPlanIds = () => {
    const cache = getPlanCache();
    const ids = Object.keys(cache || {});
    return ids.length ? ids : Object.keys(DEFAULT_PLANS);
};
