/**
 * Runtime plan catalog cache — DB-backed with code defaults as seed/fallback.
 */

import SubscriptionPlan from '../models/subscriptionPlan.model.js';
import {
  SUBSCRIPTION_PLANS as DEFAULT_PLANS,
  PLAN_MODULE_FEATURES as DEFAULT_MODULE_FEATURES,
} from './subscriptionPlans.defaults.js';
import { ALL_SAAS_FEATURES } from '../constants/saasFeatures.js';
import logger from './logger.js';

/** @type {Record<string, object>} */
let planCache = {};

const buildCacheEntry = (doc) => {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const moduleFeatures = {};
  ALL_SAAS_FEATURES.forEach((key) => {
    moduleFeatures[key] = Boolean(plain.moduleFeatures?.[key]);
  });
  return {
    planId: plain.planId,
    name: plain.name,
    price: plain.price ?? 0,
    maxEmployees: plain.maxEmployees ?? 10,
    trialDays: plain.trialDays ?? 14,
    features: Array.isArray(plain.features) ? plain.features : [],
    moduleFeatures,
    isActive: plain.isActive !== false,
    sortOrder: plain.sortOrder ?? 0,
  };
};

export const getPlanCache = () => planCache;

export const reloadPlanCache = async () => {
  const docs = await SubscriptionPlan.find({}).sort({ sortOrder: 1, planId: 1 }).lean();
  const next = {};
  docs.forEach((doc) => {
    next[doc.planId] = buildCacheEntry(doc);
  });
  // Fallback defaults if DB empty / missing keys
  Object.keys(DEFAULT_PLANS).forEach((planId) => {
    if (!next[planId]) {
      next[planId] = {
        planId,
        ...DEFAULT_PLANS[planId],
        moduleFeatures: { ...(DEFAULT_MODULE_FEATURES[planId] || DEFAULT_MODULE_FEATURES.free) },
        isActive: true,
        sortOrder: Object.keys(DEFAULT_PLANS).indexOf(planId),
      };
    }
  });
  planCache = next;
  return planCache;
};

export const ensurePlansSeeded = async () => {
  const count = await SubscriptionPlan.countDocuments();
  if (count > 0) {
    await reloadPlanCache();
    return { seeded: false, count };
  }

  const docs = Object.entries(DEFAULT_PLANS).map(([planId, plan], index) => ({
    planId,
    name: plan.name,
    price: plan.price,
    maxEmployees: plan.maxEmployees,
    trialDays: plan.trialDays,
    features: plan.features,
    moduleFeatures: { ...(DEFAULT_MODULE_FEATURES[planId] || {}) },
    isActive: true,
    sortOrder: index,
  }));

  await SubscriptionPlan.insertMany(docs);
  await reloadPlanCache();
  logger.info('Seeded subscription plans into database', { count: docs.length });
  return { seeded: true, count: docs.length };
};

export const listCachedPlans = () =>
  Object.values(planCache).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

export const getCachedPlan = (planId) => {
  const key = String(planId || 'free').toLowerCase();
  return planCache[key] || planCache.free || null;
};
