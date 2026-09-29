/**
 * Organization billing / Razorpay subscription endpoints.
 * Webhook is source of truth; verify-payment is optimistic UX confirmation.
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import Organization from '../../models/organization.model.js';
import Employee from '../../models/employee.model.js';
import BillingPayment from '../../models/billingPayment.model.js';
import { buildSubscriptionInvoicePdf } from '../../helpers/subscriptionInvoicePdf.js';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} from '../../helpers/responseHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { getPlanDetails, getPlanMaxEmployees, listKnownPlanIds } from '../../helpers/subscriptionPlans.js';
import {
  getBillingMode,
  isRazorpayConfigured,
  isPaidPlan,
  createCheckoutSession,
  createBillingPortalSession,
  applyPlanToOrganization,
  verifyMockCheckoutToken,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  verifyRazorpayWebhookSignature,
  getRazorpayCurrency,
  activatePaidSubscription,
  processRazorpayWebhookEvent,
  cancelRazorpaySubscription,
  planAmountMinorUnits,
  getRazorpay,
} from '../../services/razorpayBillingService.js';
import { getTenantUsageSnapshot, attachTenantToRequest } from '../../services/tenantService.js';
import logger from '../../helpers/logger.js';

const serializeBilling = (org, usage = null) => {
  const plan = getPlanDetails(org.subscriptionPlan);
  const currency = getRazorpayCurrency();
  return {
    organizationId: org._id,
    subscriptionPlan: org.subscriptionPlan || 'free',
    planName: plan?.name || org.subscriptionPlan,
    planPrice: plan?.price ?? 0,
    currency,
    maxEmployees: org.maxEmployees ?? getPlanMaxEmployees(org.subscriptionPlan),
    subscriptionStatus: org.subscriptionStatus || 'trial',
    isTrialActive: !!org.isTrialActive,
    trialEndDate: org.trialEndDate || null,
    subscriptionStartDate: org.subscriptionStartDate || null,
    subscriptionEndDate: org.subscriptionEndDate || null,
    paymentMethod: org.paymentMethod || 'none',
    razorpayCustomerId: org.razorpayCustomerId || null,
    razorpaySubscriptionId: org.razorpaySubscriptionId || null,
    razorpayOrderId: org.razorpayOrderId || null,
    razorpayPaymentId: org.razorpayPaymentId || null,
    billingMode: getBillingMode(),
    razorpayConfigured: isRazorpayConfigured(),
    recurring: Boolean(org.razorpaySubscriptionId),
    pendingPlan: org.pendingPlan || null,
    usage: usage || null,
  };
};

const serializePayment = (p) => ({
  id: p._id,
  invoiceNumber: p.invoiceNumber || null,
  planId: p.planId,
  status: p.status,
  source: p.source,
  amount: (p.amountMinor || 0) / 100,
  amountMinor: p.amountMinor,
  currency: p.currency,
  razorpayPaymentId: p.razorpayPaymentId || null,
  razorpaySubscriptionId: p.razorpaySubscriptionId || null,
  periodStart: p.periodStart || null,
  periodEnd: p.periodEnd || null,
  failureReason: p.failureReason || null,
  createdAt: p.createdAt,
});

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

  const recentPayments = await BillingPayment.find({ organizationId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const currency = getRazorpayCurrency();
  return sendSuccess(res, {
    subscription: serializeBilling(org, usage),
    recentPayments: recentPayments.map(serializePayment),
    availablePlans: listKnownPlanIds().map((id) => {
      const p = getPlanDetails(id);
      return {
        id,
        name: p.name,
        price: p.price,
        maxEmployees: p.maxEmployees,
        features: p.features,
        trialDays: p.trialDays,
        currency,
        requiresCheckout: isPaidPlan(id),
      };
    }),
  });
});

/**
 * GET /api/v1/organization/subscription/payments
 */
export const listBillingPayments = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const payments = await BillingPayment.find({ organizationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return sendSuccess(res, { payments: payments.map(serializePayment) });
});

/**
 * GET /api/v1/organization/subscription/payments/:paymentId/invoice
 */
export const downloadBillingInvoice = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const payment = await BillingPayment.findOne({
    _id: req.params.paymentId,
    organizationId,
    status: 'succeeded',
  });
  if (!payment) return sendNotFound(res, 'Invoice not found');

  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  const pdf = await buildSubscriptionInvoicePdf({ org, payment });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
  return res.send(pdf.buffer);
});

/**
 * POST /api/v1/organization/subscription/checkout
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
      customerName: req.user?.name || org.name,
    });

    if (session.orderId) {
      org.razorpayOrderId = session.orderId;
      org.paymentMethod = 'razorpay';
      await org.save();
    }
    if (session.subscriptionId) {
      org.razorpaySubscriptionId = session.subscriptionId;
      org.paymentMethod = 'razorpay';
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
      currency: payload.currency || getRazorpayCurrency(),
      billingMode: getBillingMode(),
      testCardHint: '4242 4242 4242 4242',
    },
  });
});

/**
 * POST /api/v1/organization/subscription/confirm-mock
 */
export const confirmMockCheckout = asyncHandler(async (req, res) => {
  if (getBillingMode() !== 'mock') {
    return sendError(res, 'Mock checkout is disabled when Razorpay is configured', 400, 'MOCK_DISABLED');
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

  const paymentId = `pay_mock_${Date.now()}`;
  const subscriptionId = `sub_mock_${organizationId}`;

  const { payment } = await activatePaidSubscription({
    organization: org,
    planId: payload.planId,
    paymentId,
    orderId: `order_mock_${Date.now()}`,
    subscriptionId,
    source: 'mock',
    amountMinor: planAmountMinorUnits(payload.planId),
    currency: payload.currency || getRazorpayCurrency(),
    customerId: org.razorpayCustomerId || `cust_mock_${organizationId}`,
  });

  return sendSuccess(
    res,
    {
      subscription: serializeBilling(org),
      payment: {
        status: 'succeeded',
        amount: payload.amount ?? getPlanDetails(payload.planId).price,
        currency: payload.currency || getRazorpayCurrency(),
        last4: '4242',
        brand: 'visa',
        invoiceNumber: payment?.invoiceNumber,
      },
    },
    'Payment successful'
  );
});

/**
 * POST /api/v1/organization/subscription/verify-payment
 * Optimistic confirm after Checkout.js (webhook remains source of truth for renewals).
 */
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  if (!isRazorpayConfigured()) {
    return sendError(res, 'Razorpay is not configured', 503, 'RAZORPAY_NOT_CONFIGURED');
  }

  const organizationId = getOrganizationId(req);
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: subscriptionId,
    razorpay_signature: signature,
    planId: bodyPlanId,
  } = req.body || {};

  if (!paymentId || !signature) {
    return sendValidationError(res, {
      razorpay_payment_id: !paymentId ? 'Required' : undefined,
      razorpay_signature: !signature ? 'Required' : undefined,
    });
  }

  const isSubscription = Boolean(subscriptionId);
  const valid = isSubscription
    ? verifyRazorpaySubscriptionSignature({ paymentId, subscriptionId, signature })
    : verifyRazorpayPaymentSignature({ orderId, paymentId, signature });

  if (!valid) {
    return sendError(res, 'Invalid payment signature', 400, 'INVALID_SIGNATURE');
  }

  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  let planId = bodyPlanId || org.subscriptionPlan;

  try {
    const rzp = getRazorpay();
    if (isSubscription && rzp) {
      const sub = await rzp.subscriptions.fetch(subscriptionId);
      if (sub?.notes?.planId) planId = sub.notes.planId;
      if (sub?.notes?.organizationId && String(sub.notes.organizationId) !== String(organizationId)) {
        return sendError(res, 'Subscription does not belong to this organization', 403, 'SUB_ORG_MISMATCH');
      }
    } else if (orderId && rzp) {
      const order = await rzp.orders.fetch(orderId);
      if (order?.notes?.planId) planId = order.notes.planId;
      if (order?.notes?.organizationId && String(order.notes.organizationId) !== String(organizationId)) {
        return sendError(res, 'Order does not belong to this organization', 403, 'ORDER_ORG_MISMATCH');
      }
    }
  } catch (error) {
    logger.warn('Could not fetch Razorpay entity during verify', { error: error.message });
  }

  if (!isPaidPlan(planId)) {
    return sendError(res, 'Invalid plan on payment', 400, 'INVALID_PLAN');
  }

  const { payment, alreadyApplied } = await activatePaidSubscription({
    organization: org,
    planId,
    paymentId,
    orderId,
    subscriptionId: subscriptionId || org.razorpaySubscriptionId,
    source: 'checkout',
  });

  // Reload org in case another path updated it
  const fresh = await Organization.findById(organizationId);
  const subscriptionOrg = fresh || org;

  return sendSuccess(
    res,
    {
      subscription: serializeBilling(subscriptionOrg),
      payment: {
        orderId,
        paymentId,
        subscriptionId: subscriptionId || subscriptionOrg.razorpaySubscriptionId,
        status: 'captured',
        invoiceNumber: payment?.invoiceNumber,
        alreadyApplied: !!alreadyApplied,
      },
    },
    alreadyApplied
      ? 'Payment already processed — subscription is active'
      : 'Payment verified — subscription updated'
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
 * POST /api/v1/organization/subscription/cancel
 * Cancel recurring Razorpay subscription (keeps access until period end).
 */
export const cancelRecurringSubscription = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  const atCycleEnd = req.body?.atCycleEnd !== false;

  if (org.razorpaySubscriptionId) {
    await cancelRazorpaySubscription(org.razorpaySubscriptionId, {
      cancelAtCycleEnd: atCycleEnd,
    });
  }

  org.subscriptionStatus = atCycleEnd ? org.subscriptionStatus : 'cancelled';
  if (!atCycleEnd) {
    // Immediate cancel → free at end of grace; mark cancelled now
    org.subscriptionStatus = 'cancelled';
  }
  await org.save();

  return sendSuccess(
    res,
    { subscription: serializeBilling(org) },
    atCycleEnd
      ? 'Subscription will cancel at the end of the billing period'
      : 'Subscription cancelled'
  );
});

/**
 * POST /api/v1/organization/subscription/switch-free
 */
export const switchToFreePlan = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);
  const org = await Organization.findById(organizationId);
  if (!org) return sendNotFound(res, 'Organization not found');

  if (org.razorpaySubscriptionId) {
    await cancelRazorpaySubscription(org.razorpaySubscriptionId, { cancelAtCycleEnd: false });
  }

  applyPlanToOrganization(org, 'free', {
    subscriptionStatus: 'active',
    isTrialActive: false,
    paymentMethod: 'none',
    razorpaySubscriptionId: undefined,
    subscriptionEndDate: null,
  });
  org.razorpaySubscriptionId = undefined;
  await org.save();

  return sendSuccess(res, { subscription: serializeBilling(org) }, 'Switched to Free plan');
});

export const syncCheckoutSession = asyncHandler(async (req, res) => {
  return sendSuccess(res, { synced: false, reason: 'use_razorpay_verify' });
});

/**
 * POST /api/v1/webhooks/razorpay
 */
export const handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody
    ? req.rawBody.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});

  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const ok = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!ok) {
      logger.error('Razorpay webhook signature failed');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ success: false, message: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON' });
  }

  try {
    const result = await processRazorpayWebhookEvent(event);
    return res.json({ received: true, ...result });
  } catch (error) {
    logger.error('Razorpay webhook processing failed', {
      event: event?.event,
      error: error.message,
    });
    return res.status(500).json({ success: false, message: error.message });
  }
};
