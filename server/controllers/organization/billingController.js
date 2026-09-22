/**
 * Organization billing / Stripe subscription endpoints.
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import Organization from '../../models/organization.model.js';
import Employee from '../../models/employee.model.js';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from '../../helpers/responseHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { getPlanDetails, getPlanMaxEmployees, listKnownPlanIds } from '../../helpers/subscriptionPlans.js';
import {
  getStripeBillingMode,
  isStripeLiveConfigured,
  isPaidPlan,
  createCheckoutSession,
  createBillingPortalSession,
  applyPlanToOrganization,
  mapStripeSubscriptionStatus,
  verifyMockCheckoutToken,
  getStripe,
} from '../../services/stripeBillingService.js';
import { getTenantUsageSnapshot, attachTenantToRequest } from '../../services/tenantService.js';
import logger from '../../helpers/logger.js';

const serializeBilling = (org, usage = null) => {
  const plan = getPlanDetails(org.subscriptionPlan);
  return {
    organizationId: org._id,
    subscriptionPlan: org.subscriptionPlan || 'free',
    planName: plan?.name || org.subscriptionPlan,
    planPrice: plan?.price ?? 0,
    maxEmployees: org.maxEmployees ?? getPlanMaxEmployees(org.subscriptionPlan),
    subscriptionStatus: org.subscriptionStatus || 'trial',
    isTrialActive: !!org.isTrialActive,
    trialEndDate: org.trialEndDate || null,
    subscriptionStartDate: org.subscriptionStartDate || null,
    subscriptionEndDate: org.subscriptionEndDate || null,
    paymentMethod: org.paymentMethod || 'none',
    stripeCustomerId: org.stripeCustomerId || null,
    stripeSubscriptionId: org.stripeSubscriptionId || null,
    billingMode: getStripeBillingMode(),
    stripeConfigured: isStripeLiveConfigured(),
    usage: usage || null,
  };
};

/**
 * GET /api/v1/organization/subscription/current
 */
export const getCurrentSubscription = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  let usage = null;
  try {
    req.organizationId = organizationId;
    const tenant = await attachTenantToRequest(req);
    usage = await getTenantUsageSnapshot(organizationId, tenant);
  } catch {
    const count = await Employee.countDocuments({
      organizationId,
      status: { $in: ['active', 'inactive', 'suspended'] },
    });
    usage = {
      employees: {
        current: count,
        max: org.maxEmployees,
        percent: org.maxEmployees ? Math.round((count / org.maxEmployees) * 100) : 0,
      },
    };
  }

  return sendSuccess(res, {
    subscription: serializeBilling(org, usage),
    availablePlans: listKnownPlanIds().map((id) => {
      const p = getPlanDetails(id);
      return {
        id,
        name: p.name,
        price: p.price,
        maxEmployees: p.maxEmployees,
        features: p.features,
        trialDays: p.trialDays,
        currency: 'USD',
        requiresCheckout: isPaidPlan(id),
      };
    }),
  });
});

/**
 * POST /api/v1/organization/subscription/checkout
 * Body: { planId }
 */
export const createSubscriptionCheckout = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const planId = String(req.body?.planId || '').toLowerCase();

  if (!planId || !listKnownPlanIds().includes(planId)) {
    return sendValidationError(res, { planId: 'Invalid plan' });
  }
  if (!isPaidPlan(planId)) {
    return sendError(
      res,
      'Use the free plan switch endpoint for the Free plan',
      400,
      'CHECKOUT_NOT_REQUIRED'
    );
  }

  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  if (String(org.subscriptionPlan).toLowerCase() === planId && org.subscriptionStatus === 'active') {
    return sendError(res, 'Organization is already on this plan', 400, 'ALREADY_ON_PLAN');
  }

  try {
    const session = await createCheckoutSession({
      organization: org,
      planId,
      customerEmail: req.user?.email || org.email,
    });

    // Persist customer id early when Stripe created one
    if (session.customerId && !org.stripeCustomerId) {
      org.stripeCustomerId = session.customerId;
      org.paymentMethod = 'stripe';
      await org.save();
    }

    return sendSuccess(res, { checkout: session }, 'Checkout session created');
  } catch (error) {
    logger.error('Checkout create failed', { error: error.message, organizationId, planId });
    return sendError(
      res,
      error.message || 'Failed to create checkout',
      error.statusCode || 500,
      error.code || 'CHECKOUT_ERROR'
    );
  }
});

/**
 * GET /api/v1/organization/subscription/checkout/preview?token=
 * Load plan summary for the hosted payment page (does not activate).
 */
export const previewMockCheckout = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const token = req.query.token;
  let payload;
  try {
    payload = verifyMockCheckoutToken(token);
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 400, error.code || 'INVALID_MOCK_TOKEN');
  }
  if (String(payload.organizationId) !== String(organizationId)) {
    return sendError(res, 'Token does not match this organization', 403, 'MOCK_ORG_MISMATCH');
  }

  const org = await Organization.findById(organizationId).select('name email');
  if (!org) return sendNotFound(res, 'Organization not found');

  const plan = getPlanDetails(payload.planId);
  return sendSuccess(res, {
    preview: {
      organizationName: org.name,
      organizationEmail: org.email,
      planId: payload.planId,
      planName: payload.planName || plan.name,
      amount: payload.amount ?? plan.price,
      currency: payload.currency || 'USD',
      billingMode: getStripeBillingMode(),
      testCardHint: '4242 4242 4242 4242',
    },
  });
});

/**
 * POST /api/v1/organization/subscription/confirm-mock
 * Completes mock checkout after dummy card payment (dev without Stripe keys).
 * Requires Stripe test card 4242 4242 4242 4242 (any future expiry, any CVC).
 */
export const confirmMockCheckout = asyncHandler(async (req, res) => {
  if (getStripeBillingMode() !== 'mock') {
    return sendError(res, 'Mock checkout is disabled when Stripe is configured', 400, 'MOCK_DISABLED');
  }

  const organizationId = getOrganizationId(req);
  const { token, cardNumber, expMonth, expYear, cvc, cardholderName } = req.body || {};
  let payload;
  try {
    payload = verifyMockCheckoutToken(token);
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 400, error.code || 'INVALID_MOCK_TOKEN');
  }

  if (String(payload.organizationId) !== String(organizationId)) {
    return sendError(res, 'Token does not match this organization', 403, 'MOCK_ORG_MISMATCH');
  }

  const digits = String(cardNumber || '').replace(/\D/g, '');
  if (digits !== '4242424242424242') {
    return sendError(
      res,
      'Payment declined. Use the test card 4242 4242 4242 4242.',
      402,
      'CARD_DECLINED'
    );
  }

  const month = Number(expMonth);
  const yearRaw = Number(expYear);
  const fullYear = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const now = new Date();
  if (
    !month ||
    month < 1 ||
    month > 12 ||
    !yearRaw ||
    fullYear < now.getFullYear() ||
    (fullYear === now.getFullYear() && month < now.getMonth() + 1)
  ) {
    return sendError(res, 'Card expired or invalid expiry', 402, 'CARD_EXPIRED');
  }
  if (!cvc || String(cvc).replace(/\D/g, '').length < 3) {
    return sendError(res, 'Invalid CVC', 400, 'INVALID_CVC');
  }
  if (!cardholderName || String(cardholderName).trim().length < 2) {
    return sendError(res, 'Cardholder name is required', 400, 'INVALID_NAME');
  }

  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  applyPlanToOrganization(org, payload.planId, {
    subscriptionStatus: 'active',
    isTrialActive: false,
    clearTrial: true,
    subscriptionStartDate: org.subscriptionStartDate || now,
    subscriptionEndDate: periodEnd,
    paymentMethod: 'stripe',
    stripeCustomerId: org.stripeCustomerId || `cus_mock_${organizationId}`,
    stripeSubscriptionId: `sub_mock_${Date.now()}`,
  });
  await org.save();

  logger.info('Mock checkout confirmed after dummy card payment', {
    organizationId,
    planId: payload.planId,
    cardLast4: '4242',
  });

  return sendSuccess(
    res,
    {
      subscription: serializeBilling(org),
      payment: {
        status: 'succeeded',
        amount: payload.amount ?? getPlanDetails(payload.planId).price,
        currency: 'USD',
        last4: '4242',
        brand: 'visa',
      },
    },
    'Payment successful'
  );
});

/**
 * POST /api/v1/organization/subscription/portal
 */
export const createPortalSession = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  try {
    const portal = await createBillingPortalSession(org);
    return sendSuccess(res, { portal }, 'Billing portal session created');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to open billing portal',
      error.statusCode || 500,
      error.code || 'PORTAL_ERROR'
    );
  }
});

/**
 * POST /api/v1/organization/subscription/switch-free
 * Downgrade / switch to free without Stripe.
 */
export const switchToFreePlan = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  // If live Stripe subscription exists, cancel at period end via Stripe when possible
  if (isStripeLiveConfigured() && org.stripeSubscriptionId && !String(org.stripeSubscriptionId).startsWith('sub_mock_')) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
        metadata: { ...(org.metadata || {}), requestedPlan: 'free' },
      });
    } catch (error) {
      logger.warn('Failed to schedule Stripe cancel on free switch', {
        error: error.message,
        organizationId,
      });
    }
  }

  applyPlanToOrganization(org, 'free', {
    subscriptionStatus: 'active',
    isTrialActive: false,
    paymentMethod: org.paymentMethod === 'stripe' ? 'stripe' : 'none',
  });
  await org.save();

  return sendSuccess(res, { subscription: serializeBilling(org) }, 'Switched to Free plan');
});

/**
 * GET /api/v1/organization/subscription/checkout/session/:sessionId
 * After Stripe redirect — sync org from session (backup if webhook delayed).
 */
export const syncCheckoutSession = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const { sessionId } = req.params;

  if (!sessionId || sessionId.startsWith('mock_')) {
    return sendSuccess(res, { synced: false, reason: 'mock_or_missing' });
  }

  if (!isStripeLiveConfigured()) {
    return sendError(res, 'Stripe is not configured', 503, 'STRIPE_NOT_CONFIGURED');
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  if (String(session.client_reference_id || session.metadata?.organizationId) !== String(organizationId)) {
    return sendError(res, 'Session does not belong to this organization', 403, 'SESSION_ORG_MISMATCH');
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return sendSuccess(res, { synced: false, status: session.status, payment_status: session.payment_status });
  }

  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  const planId = session.metadata?.planId || org.subscriptionPlan;
  const subscription = session.subscription;
  const subObj = typeof subscription === 'object' ? subscription : null;

  applyPlanToOrganization(org, planId, {
    subscriptionStatus: subObj
      ? mapStripeSubscriptionStatus(subObj.status)
      : 'active',
    isTrialActive: false,
    clearTrial: true,
    subscriptionStartDate: org.subscriptionStartDate || new Date(),
    subscriptionEndDate: subObj?.current_period_end
      ? new Date(subObj.current_period_end * 1000)
      : org.subscriptionEndDate,
    paymentMethod: 'stripe',
    stripeCustomerId: session.customer || org.stripeCustomerId,
    stripeSubscriptionId: subObj?.id || session.subscription || org.stripeSubscriptionId,
  });
  await org.save();

  return sendSuccess(res, { synced: true, subscription: serializeBilling(org) }, 'Subscription synced');
});

/**
 * Stripe webhook handler (raw body required).
 * POST /api/v1/webhooks/stripe
 */
export const handleStripeWebhook = async (req, res) => {
  if (!isStripeLiveConfigured()) {
    return res.status(503).json({ success: false, message: 'Stripe not configured' });
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && req.rawBody) {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } else {
      // Dev fallback without signature verification (not for production)
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      logger.warn('Stripe webhook accepted without signature verification');
    }
  } catch (error) {
    logger.error('Stripe webhook signature failed', { error: error.message });
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    await processStripeEvent(event);
    return res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook processing failed', {
      type: event?.type,
      error: error.message,
    });
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function processStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const organizationId = session.metadata?.organizationId || session.client_reference_id;
      const planId = session.metadata?.planId;
      if (!organizationId || !planId) return;

      const org = await Organization.findById(organizationId);
      if (!org) return;

      let periodEnd = null;
      if (session.subscription) {
        try {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
          applyPlanToOrganization(org, planId, {
            subscriptionStatus: mapStripeSubscriptionStatus(sub.status),
            isTrialActive: false,
            clearTrial: true,
            subscriptionStartDate: org.subscriptionStartDate || new Date(),
            subscriptionEndDate: periodEnd,
            paymentMethod: 'stripe',
            stripeCustomerId: session.customer || org.stripeCustomerId,
            stripeSubscriptionId: sub.id,
          });
        } catch {
          applyPlanToOrganization(org, planId, {
            subscriptionStatus: 'active',
            clearTrial: true,
            paymentMethod: 'stripe',
            stripeCustomerId: session.customer || org.stripeCustomerId,
            stripeSubscriptionId: session.subscription,
          });
        }
      } else {
        applyPlanToOrganization(org, planId, {
          subscriptionStatus: 'active',
          clearTrial: true,
          paymentMethod: 'stripe',
          stripeCustomerId: session.customer || org.stripeCustomerId,
        });
      }
      await org.save();
      logger.info('Webhook checkout.session.completed applied', { organizationId, planId });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const organizationId = sub.metadata?.organizationId;
      const org = organizationId
        ? await Organization.findById(organizationId)
        : await Organization.findOne({ stripeSubscriptionId: sub.id });
      if (!org) return;

      const planId = sub.metadata?.planId || org.subscriptionPlan;
      if (event.type === 'customer.subscription.deleted') {
        applyPlanToOrganization(org, 'free', {
          subscriptionStatus: 'cancelled',
          isTrialActive: false,
          stripeSubscriptionId: null,
        });
      } else {
        applyPlanToOrganization(org, planId, {
          subscriptionStatus: mapStripeSubscriptionStatus(sub.status),
          subscriptionEndDate: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : org.subscriptionEndDate,
          stripeCustomerId: sub.customer || org.stripeCustomerId,
          stripeSubscriptionId: sub.id,
          paymentMethod: 'stripe',
          isTrialActive: sub.status === 'trialing',
        });
      }
      await org.save();
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const org = await Organization.findOne({
        stripeCustomerId: invoice.customer,
      });
      if (!org) return;
      org.subscriptionStatus = 'past_due';
      await org.save();
      break;
    }
    default:
      break;
  }
}
