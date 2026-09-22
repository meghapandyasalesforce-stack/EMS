/**
 * Stripe billing helpers — real Stripe test/live mode OR local mock checkout.
 *
 * Mode selection:
 * - STRIPE_BILLING_MODE=mock|stripe (optional override)
 * - Default: "stripe" when STRIPE_SECRET_KEY is set, otherwise "mock"
 *
 * Paid Checkout sessions use inline price_data so you don't need Dashboard price IDs.
 * Optional: STRIPE_PRICE_BASIC / STRIPE_PRICE_PREMIUM / STRIPE_PRICE_ENTERPRISE
 */

import crypto from 'crypto';
import Stripe from 'stripe';
import { getPlanDetails, getPlanMaxEmployees } from '../helpers/subscriptionPlans.js';
import logger from '../helpers/logger.js';

const PAID_PLANS = new Set(['basic', 'premium', 'enterprise']);

export const isPaidPlan = (planId) => PAID_PLANS.has(String(planId || '').toLowerCase());

export const getStripeBillingMode = () => {
  const forced = String(process.env.STRIPE_BILLING_MODE || '').toLowerCase();
  if (forced === 'mock' || forced === 'stripe') return forced;
  return process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock';
};

export const isStripeLiveConfigured = () =>
  getStripeBillingMode() === 'stripe' && Boolean(process.env.STRIPE_SECRET_KEY);

let stripeClient = null;
export const getStripe = () => {
  if (!isStripeLiveConfigured()) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

const frontendBase = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const mockSecret = () =>
  process.env.STRIPE_MOCK_SECRET || process.env.JWT_SECRET || 'ems-stripe-mock-dev';

export const signMockCheckoutToken = (payload, ttlSeconds = 60 * 30) => {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', mockSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
};

export const verifyMockCheckoutToken = (token) => {
  if (!token || !String(token).includes('.')) {
    const err = new Error('Invalid mock checkout token');
    err.statusCode = 400;
    err.code = 'INVALID_MOCK_TOKEN';
    throw err;
  }
  const [data, sig] = String(token).split('.');
  const expected = crypto.createHmac('sha256', mockSecret()).update(data).digest('base64url');
  if (sig !== expected) {
    const err = new Error('Invalid mock checkout signature');
    err.statusCode = 400;
    err.code = 'INVALID_MOCK_TOKEN';
    throw err;
  }
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    const err = new Error('Mock checkout token expired');
    err.statusCode = 400;
    err.code = 'MOCK_TOKEN_EXPIRED';
    throw err;
  }
  return payload;
};

const priceEnvKey = (planId) => {
  const map = {
    basic: 'STRIPE_PRICE_BASIC',
    premium: 'STRIPE_PRICE_PREMIUM',
    enterprise: 'STRIPE_PRICE_ENTERPRISE',
  };
  return map[planId];
};

/**
 * Apply a plan change onto an org document (caller saves).
 */
export const applyPlanToOrganization = (org, planId, extras = {}) => {
  const id = String(planId || 'free').toLowerCase();
  const plan = getPlanDetails(id);
  org.subscriptionPlan = id;
  org.maxEmployees = extras.maxEmployees ?? getPlanMaxEmployees(id) ?? org.maxEmployees;
  if (extras.subscriptionStatus) org.subscriptionStatus = extras.subscriptionStatus;
  if (extras.isTrialActive !== undefined) org.isTrialActive = extras.isTrialActive;
  if (extras.subscriptionStartDate) org.subscriptionStartDate = extras.subscriptionStartDate;
  if (extras.subscriptionEndDate !== undefined) org.subscriptionEndDate = extras.subscriptionEndDate;
  if (extras.paymentMethod) org.paymentMethod = extras.paymentMethod;
  if (extras.stripeCustomerId !== undefined) org.stripeCustomerId = extras.stripeCustomerId;
  if (extras.stripeSubscriptionId !== undefined) {
    org.stripeSubscriptionId = extras.stripeSubscriptionId;
  }
  if (extras.clearTrial) {
    org.isTrialActive = false;
    if (!extras.subscriptionStatus) org.subscriptionStatus = 'active';
  }
  return { org, plan };
};

/**
 * Create Checkout Session (Stripe) or mock checkout URL.
 */
export const createCheckoutSession = async ({
  organization,
  planId,
  customerEmail,
  successPath = '/organization/subscription?checkout=success',
  cancelPath = '/organization/subscription?checkout=cancelled',
}) => {
  const id = String(planId).toLowerCase();
  if (!isPaidPlan(id)) {
    const err = new Error('Checkout is only required for paid plans');
    err.statusCode = 400;
    err.code = 'CHECKOUT_NOT_REQUIRED';
    throw err;
  }

  const plan = getPlanDetails(id);
  const mode = getStripeBillingMode();
  const successUrl = `${frontendBase()}${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${frontendBase()}${cancelPath}`;

  if (mode === 'mock') {
    const token = signMockCheckoutToken({
      organizationId: String(organization._id),
      planId: id,
      mode: 'mock',
      amount: plan.price,
      planName: plan.name,
      currency: 'USD',
    });
    // Hosted-style payment page (Razorpay/Stripe-like), not instant activate
    const url = `${frontendBase()}/organization/checkout?token=${encodeURIComponent(token)}`;
    logger.info('Created mock Stripe checkout', { organizationId: organization._id, planId: id });
    return {
      mode: 'mock',
      url,
      sessionId: `mock_${token.slice(0, 24)}`,
      planId: id,
      planName: plan.name,
      amount: plan.price,
      currency: 'USD',
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    const err = new Error('Stripe is not configured');
    err.statusCode = 503;
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }

  let customerId = organization.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: customerEmail || organization.email,
      name: organization.name,
      metadata: { organizationId: String(organization._id) },
    });
    customerId = customer.id;
  }

  const envPrice = process.env[priceEnvKey(id)];
  const lineItems = envPrice
    ? [{ price: envPrice, quantity: 1 }]
    : [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(plan.price || 0) * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: `EMS ${plan.name}`,
              description: `Up to ${plan.maxEmployees} employees`,
              metadata: { planId: id },
            },
          },
          quantity: 1,
        },
      ];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: String(organization._id),
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: lineItems,
    allow_promotion_codes: true,
    metadata: {
      organizationId: String(organization._id),
      planId: id,
    },
    subscription_data: {
      metadata: {
        organizationId: String(organization._id),
        planId: id,
      },
    },
  });

  logger.info('Created Stripe checkout session', {
    organizationId: organization._id,
    planId: id,
    sessionId: session.id,
  });

  return {
    mode: 'stripe',
    url: session.url,
    sessionId: session.id,
    customerId,
    planId: id,
    planName: plan.name,
    amount: plan.price,
    currency: 'USD',
  };
};

export const createBillingPortalSession = async (organization) => {
  if (getStripeBillingMode() === 'mock') {
    return {
      mode: 'mock',
      url: `${frontendBase()}/organization/subscription?portal=mock`,
      message: 'Mock mode — no Stripe customer portal. Manage plan on this page.',
    };
  }

  const stripe = getStripe();
  if (!stripe || !organization.stripeCustomerId) {
    const err = new Error('No Stripe customer on file for this organization');
    err.statusCode = 400;
    err.code = 'NO_STRIPE_CUSTOMER';
    throw err;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: `${frontendBase()}/organization/subscription`,
  });

  return { mode: 'stripe', url: session.url };
};

/**
 * Map Stripe subscription status → our subscriptionStatus enum.
 */
export const mapStripeSubscriptionStatus = (stripeStatus) => {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return stripeStatus === 'trialing' ? 'trial' : 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'incomplete':
      return 'past_due';
    default:
      return 'active';
  }
};

export default {
  getStripeBillingMode,
  isStripeLiveConfigured,
  isPaidPlan,
  createCheckoutSession,
  createBillingPortalSession,
  applyPlanToOrganization,
  mapStripeSubscriptionStatus,
  verifyMockCheckoutToken,
  getStripe,
};
