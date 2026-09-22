import { SAAS_FEATURES } from '../constants/saasFeatures.js';

/**
 * Module feature flags per plan (SaaS gating — backend + frontend).
 * Org-level overrides may be added later on Organization.settings.features.
 */
export const PLAN_MODULE_FEATURES = {
    free: {
        [SAAS_FEATURES.EMPLOYEES]: true,
        [SAAS_FEATURES.LEAVE]: true,
        [SAAS_FEATURES.ATTENDANCE]: true,
        [SAAS_FEATURES.RECRUITMENT]: false,
        [SAAS_FEATURES.PAYROLL]: false,
        [SAAS_FEATURES.PERFORMANCE]: false,
        [SAAS_FEATURES.WORKFORCE_PLANNING]: false,
        [SAAS_FEATURES.LIFECYCLE]: true,
        [SAAS_FEATURES.ENGAGEMENT]: false,
        [SAAS_FEATURES.DOCUMENTS]: true,
        [SAAS_FEATURES.ANALYTICS]: false,
        [SAAS_FEATURES.PROJECTS]: false,
    },
    basic: {
        [SAAS_FEATURES.EMPLOYEES]: true,
        [SAAS_FEATURES.LEAVE]: true,
        [SAAS_FEATURES.ATTENDANCE]: true,
        [SAAS_FEATURES.RECRUITMENT]: true,
        [SAAS_FEATURES.PAYROLL]: true,
        [SAAS_FEATURES.PERFORMANCE]: true,
        [SAAS_FEATURES.WORKFORCE_PLANNING]: true,
        [SAAS_FEATURES.LIFECYCLE]: true,
        [SAAS_FEATURES.ENGAGEMENT]: true,
        [SAAS_FEATURES.DOCUMENTS]: true,
        [SAAS_FEATURES.ANALYTICS]: true,
        [SAAS_FEATURES.PROJECTS]: true,
    },
    premium: {
        [SAAS_FEATURES.EMPLOYEES]: true,
        [SAAS_FEATURES.LEAVE]: true,
        [SAAS_FEATURES.ATTENDANCE]: true,
        [SAAS_FEATURES.RECRUITMENT]: true,
        [SAAS_FEATURES.PAYROLL]: true,
        [SAAS_FEATURES.PERFORMANCE]: true,
        [SAAS_FEATURES.WORKFORCE_PLANNING]: true,
        [SAAS_FEATURES.LIFECYCLE]: true,
        [SAAS_FEATURES.ENGAGEMENT]: true,
        [SAAS_FEATURES.DOCUMENTS]: true,
        [SAAS_FEATURES.ANALYTICS]: true,
        [SAAS_FEATURES.PROJECTS]: true,
    },
    enterprise: {
        [SAAS_FEATURES.EMPLOYEES]: true,
        [SAAS_FEATURES.LEAVE]: true,
        [SAAS_FEATURES.ATTENDANCE]: true,
        [SAAS_FEATURES.RECRUITMENT]: true,
        [SAAS_FEATURES.PAYROLL]: true,
        [SAAS_FEATURES.PERFORMANCE]: true,
        [SAAS_FEATURES.WORKFORCE_PLANNING]: true,
        [SAAS_FEATURES.LIFECYCLE]: true,
        [SAAS_FEATURES.ENGAGEMENT]: true,
        [SAAS_FEATURES.DOCUMENTS]: true,
        [SAAS_FEATURES.ANALYTICS]: true,
        [SAAS_FEATURES.PROJECTS]: true,
    },
};

/**
 * Subscription plan configurations
 */
export const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        maxEmployees: 10,
        features: [
            'Up to 10 employees',
            'Basic employee management',
            'Attendance tracking',
            'Leave management',
            'Basic reports',
            'Email support'
        ],
        trialDays: 14
    },
    basic: {
        name: 'Basic',
        price: 29, // Monthly price in USD
        maxEmployees: 50,
        features: [
            'Up to 50 employees',
            'All Free features',
            'Advanced reporting',
            'Payroll management',
            'Performance reviews',
            'Priority email support',
            'Custom branding'
        ],
        trialDays: 14
    },
    premium: {
        name: 'Premium',
        price: 79,
        maxEmployees: 200,
        features: [
            'Up to 200 employees',
            'All Basic features',
            'Advanced analytics',
            'API access',
            'SSO integration',
            '24/7 phone support',
            'Dedicated account manager'
        ],
        trialDays: 30
    },
    enterprise: {
        name: 'Enterprise',
        price: 199,
        maxEmployees: 1000,
        features: [
            'Unlimited employees',
            'All Premium features',
            'Custom integrations',
            'White-label option',
            'On-premise deployment',
            'Dedicated support team',
            'Custom SLA'
        ],
        trialDays: 30
    }
};

/**
 * Get subscription plan details
 * @param {string} planId - Plan ID (free, basic, premium, enterprise)
 * @returns {Object|null} Plan details or null if not found
 */
export const getPlanDetails = (planId) => {
    return SUBSCRIPTION_PLANS[planId] || null;
};

/**
 * Get employee limit for a plan
 * @param {string} planId - Plan ID
 * @returns {number} Max employees
 */
export const getPlanMaxEmployees = (planId) => {
    const plan = getPlanDetails(planId);
    return plan ? plan.maxEmployees : 10;
};

/**
 * Resolved module features for a plan id.
 * @param {string} planId
 * @returns {Record<string, boolean>}
 */
export const getPlanModuleFeatures = (planId) => {
    const key = String(planId || 'free').toLowerCase();
    return { ...(PLAN_MODULE_FEATURES[key] || PLAN_MODULE_FEATURES.free) };
};

/**
 * Whether a module feature is enabled for a plan.
 */
export const isPlanFeatureEnabled = (planId, featureKey) => {
    const features = getPlanModuleFeatures(planId);
    return Boolean(features[featureKey]);
};

/**
 * Get trial days for a plan
 * @param {string} planId - Plan ID
 * @returns {number} Trial days
 */
export const getPlanTrialDays = (planId) => {
    const plan = getPlanDetails(planId);
    return plan ? plan.trialDays : 14;
};

/**
 * Calculate trial end date
 * @param {Date} startDate - Trial start date
 * @param {string} planId - Plan ID
 * @returns {Date} Trial end date
 */
export const calculateTrialEndDate = (startDate, planId) => {
    const trialDays = getPlanTrialDays(planId);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + trialDays);
    return endDate;
};

/**
 * Check if trial is active
 * @param {Date} trialEndDate - Trial end date
 * @returns {boolean} True if trial is still active
 */
export const isTrialActive = (trialEndDate) => {
    if (!trialEndDate) return false;
    return new Date() < new Date(trialEndDate);
};

/**
 * Get days remaining in trial
 * @param {Date} trialEndDate - Trial end date
 * @returns {number} Days remaining (0 if expired)
 */
export const getTrialDaysRemaining = (trialEndDate) => {
    if (!trialEndDate) return 0;
    const now = new Date();
    const end = new Date(trialEndDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
};

