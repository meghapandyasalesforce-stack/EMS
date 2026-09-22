import { SAAS_FEATURES } from '../constants/saasFeatures.js';

/**
 * Default module feature flags per plan (seed + fallback).
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
        [SAAS_FEATURES.WORKFORCE_PLANNING]: false,
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
 * Default subscription plan configurations (seed + fallback).
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
            'Email support',
        ],
        trialDays: 14,
    },
    basic: {
        name: 'Basic',
        price: 29,
        maxEmployees: 50,
        features: [
            'Up to 50 employees',
            'All Free features',
            'Advanced reporting',
            'Payroll management',
            'Performance reviews',
            'Priority email support',
            'Custom branding',
        ],
        trialDays: 14,
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
            'Dedicated account manager',
        ],
        trialDays: 30,
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
            'Custom SLA',
        ],
        trialDays: 30,
    },
};
