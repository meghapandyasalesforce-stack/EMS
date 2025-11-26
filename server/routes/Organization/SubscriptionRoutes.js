import express from "express";
import { getSubscriptionPlans, getSubscriptionPlanDetails } from "../../controllers/organization/subscriptionController.js";

const router = express.Router();

// Get all subscription plans (public)
router.route("/plans").get(getSubscriptionPlans);

// Get specific plan details (public)
router.route("/plans/:planId").get(getSubscriptionPlanDetails);

export default router;

