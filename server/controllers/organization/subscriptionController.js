import { sendSuccess, sendError } from "../../helpers/responseHelper.js";
import { SUBSCRIPTION_PLANS, getPlanDetails } from "../../helpers/subscriptionPlans.js";
import logger from "../../helpers/logger.js";

/**
 * Get all available subscription plans
 * @route GET /api/v1/organization/subscription/plans
 * @access Public
 */
export const getSubscriptionPlans = async (req, res) => {
    try {
        // Return plans with formatted data
        const plans = Object.keys(SUBSCRIPTION_PLANS).map(planId => {
            const plan = SUBSCRIPTION_PLANS[planId];
            return {
                id: planId,
                name: plan.name,
                price: plan.price,
                maxEmployees: plan.maxEmployees,
                features: plan.features,
                trialDays: plan.trialDays,
                currency: 'USD' // Can be made dynamic based on organization
            };
        });

        return sendSuccess(res, {
            plans
        });

    } catch (error) {
        logger.error('Error fetching subscription plans', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch subscription plans', 500);
    }
};

/**
 * Get subscription plan details
 * @route GET /api/v1/organization/subscription/plans/:planId
 * @access Public
 */
export const getSubscriptionPlanDetails = async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = getPlanDetails(planId);

        if (!plan) {
            return sendError(res, 'Subscription plan not found', 404, 'PLAN_NOT_FOUND');
        }

        return sendSuccess(res, {
            plan: {
                id: planId,
                name: plan.name,
                price: plan.price,
                maxEmployees: plan.maxEmployees,
                features: plan.features,
                trialDays: plan.trialDays,
                currency: 'USD'
            }
        });

    } catch (error) {
        logger.error('Error fetching subscription plan details', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch plan details', 500);
    }
};

