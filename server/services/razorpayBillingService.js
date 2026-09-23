/**
 * Razorpay SaaS billing — recurring Subscriptions + payment ledger.
 *
 * Mode:
 * - RAZORPAY_BILLING_MODE=mock|razorpay
 * - Default: razorpay when KEY_ID + KEY_SECRET set, else mock
 *
 * Checkout:
 * - Default: Razorpay Subscriptions (plan → subscription → Checkout.js)
 * - RAZORPAY_CHECKOUT_MODE=order forces one-time orders (legacy)
 */

import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getPlanDetails, getPlanMaxEmployees } from '../helpers/subscriptionPlans.js';
import SubscriptionPlan from '../models/subscriptionPlan.model.js';
import BillingPayment from '../models/billingPayment.model.js';
import BillingWebhookEvent from '../models/billingWebhookEvent.model.js';
import Organization from '../models/organization.model.js';
import logger from '../helpers/logger.js';

const PAID_PLANS = new Set(['basic', 'premium', 'enterprise']);

export const isPaidPlan = (planId) => PAID_PLANS.has(String(planId || '').toLowerCase());

export const getBillingMode = () => {
  const forced = String(process.env.RAZORPAY_BILLING_MODE || '').toLowerCase();
  if (forced === 'mock') return 'mock';
  if (forced === 'razorpay') return 'razorpay';
  return hasRazorpayKeys() ? 'razorpay' : 'mock';
};

export const hasRazorpayKeys = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const isRazorpayConfigured = () => getBillingMode() === 'razorpay' && hasRazorpayKeys();

export const getRazorpayCurrency = () =>
  String(process.env.RAZORPAY_CURRENCY || 'INR').toUpperCase();

/** subscription (default) | order */
export const getCheckoutMode = () => {
  const mode = String(process.env.RAZORPAY_CHECKOUT_MODE || 'subscription').toLowerCase();
  return mode === 'order' ? 'order' : 'subscription';
};

let razorpayClient = null;
export const getRazorpay = () => {
  if (!isRazorpayConfigured()) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

const frontendBase = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const mockSecret = () =>
  process.env.RAZORPAY_MOCK_SECRET || process.env.JWT_SECRET || 'ems-razorpay-mock-dev';

export const signMockCheckoutToken = (payload, ttlSeconds = 60 * 30) => {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
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

export const planAmountMinorUnits = (planId) => {
  const plan = getPlanDetails(planId);
  const major = Number(plan?.price || 0);
  return Math.round(major * 100);
};

export const nextPeriodEnd = (from = new Date()) => {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
};

export const applyPlanToOrganization = (org, planId, extras = {}) => {
  const id = String(planId || 'free').toLowerCase();
  org.subscriptionPlan = id;
  org.maxEmployees = extras.maxEmployees ?? getPlanMaxEmployees(id) ?? org.maxEmployees;
  if (extras.subscriptionStatus) org.subscriptionStatus = extras.subscriptionStatus;
  if (extras.isTrialActive !== undefined) org.isTrialActive = extras.isTrialActive;
  if (extras.subscriptionStartDate) org.subscriptionStartDate = extras.subscriptionStartDate;
  if (extras.subscriptionEndDate !== undefined) org.subscriptionEndDate = extras.subscriptionEndDate;
  if (extras.paymentMethod) org.paymentMethod = extras.paymentMethod;
  if (extras.razorpayCustomerId !== undefined) org.razorpayCustomerId = extras.razorpayCustomerId;
  if (extras.razorpaySubscriptionId !== undefined) {
    org.razorpaySubscriptionId = extras.razorpaySubscriptionId;
  }
  if (extras.razorpayPaymentId !== undefined) org.razorpayPaymentId = extras.razorpayPaymentId;
  if (extras.razorpayOrderId !== undefined) org.razorpayOrderId = extras.razorpayOrderId;
  if (extras.clearStripeIds) {
    org.stripeCustomerId = undefined;
    org.stripeSubscriptionId = undefined;
  }
  if (extras.clearTrial) {
    org.isTrialActive = false;
    if (!extras.subscriptionStatus) org.subscriptionStatus = 'active';
  }
  return { org, plan: getPlanDetails(id) };
};

export const verifyRazorpayPaymentSignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

/** Subscription auth: payment_id|subscription_id */
export const verifyRazorpaySubscriptionSignature = ({ paymentId, subscriptionId, signature }) => {
  if (!paymentId || !subscriptionId || !signature) return false;
  const body = `${paymentId}|${subscriptionId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

export const verifyRazorpayWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
};

async function nextInvoiceNumber(organizationId) {
  const year = new Date().getFullYear();
  const count = await BillingPayment.countDocuments({
    organizationId,
    status: 'succeeded',
  });
  const suffix = crypto.randomBytes(2).toString('hex');
  return `INV-${year}-${String(count + 1).padStart(5, '0')}-${suffix}`;
}

/**
 * Idempotent ledger write. Same razorpayPaymentId never creates two rows.
 * Duplicate-key races return the existing document as success.
 */
export const recordBillingPayment = async ({
  organizationId,
  planId,
  status,
  source,
  amountMinor,
  currency,
  razorpayPaymentId,
  razorpayOrderId,
  razorpaySubscriptionId,
  razorpayInvoiceId,
  periodStart,
  periodEnd,
  failureReason,
  metadata,
}) => {
  const amount = amountMinor ?? planAmountMinorUnits(planId);
  const curr = currency || getRazorpayCurrency();

  if (razorpayPaymentId) {
    const existing = await BillingPayment.findOne({ razorpayPaymentId });
    if (existing) {
      let dirty = false;
      if (status && existing.status !== status) {
        existing.status = status;
        dirty = true;
      }
      if (failureReason && existing.failureReason !== failureReason) {
        existing.failureReason = failureReason;
        dirty = true;
      }
      if (periodEnd) {
        existing.periodEnd = periodEnd;
        dirty = true;
      }
      if (periodStart && !existing.periodStart) {
        existing.periodStart = periodStart;
        dirty = true;
      }
      if (dirty) await existing.save();
      return { payment: existing, created: false };
    }

    try {
      const invoiceNumber =
        status === 'succeeded' ? await nextInvoiceNumber(organizationId) : undefined;

      const payment = await BillingPayment.create({
        organizationId,
        planId,
        status,
        source,
        amountMinor: amount,
        currency: curr,
        invoiceNumber,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySubscriptionId,
        razorpayInvoiceId,
        periodStart,
        periodEnd,
        failureReason,
        metadata,
      });
      return { payment, created: true };
    } catch (error) {
      // Concurrent verify + webhook: unique razorpayPaymentId (or invoice) conflict
      if (error?.code === 11000) {
        const raced = await BillingPayment.findOne({ razorpayPaymentId });
        if (raced) {
          return { payment: raced, created: false };
        }
        // Invoice-number collision without payment match — retry once with new invoice
        if (error?.keyPattern?.invoiceNumber) {
          const payment = await BillingPayment.create({
            organizationId,
            planId,
            status,
            source,
            amountMinor: amount,
            currency: curr,
            invoiceNumber: await nextInvoiceNumber(organizationId),
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySubscriptionId,
            razorpayInvoiceId,
            periodStart,
            periodEnd,
            failureReason,
            metadata,
          });
          return { payment, created: true };
        }
      }
      throw error;
    }
  }

  const payment = await BillingPayment.create({
    organizationId,
    planId,
    status,
    source,
    amountMinor: amount,
    currency: curr,
    invoiceNumber: status === 'succeeded' ? await nextInvoiceNumber(organizationId) : undefined,
    razorpayOrderId,
    razorpaySubscriptionId,
    razorpayInvoiceId,
    periodStart,
    periodEnd,
    failureReason,
    metadata,
  });
  return { payment, created: true };
};

/**
 * Activate / renew org entitlement. Safe to call from checkout verify AND webhook.
 * Ledger is claimed first; org update is best-effort after.
 */
export const activatePaidSubscription = async ({
  organization,
  planId,
  paymentId,
  orderId,
  subscriptionId,
  source = 'webhook',
  amountMinor,
  currency,
  customerId,
}) => {
  const org = organization;
  const id = String(planId || '').toLowerCase();
  if (!isPaidPlan(id)) {
    const err = new Error('Invalid paid plan');
    err.statusCode = 400;
    err.code = 'INVALID_PLAN';
    throw err;
  }

  const now = new Date();
  const periodEnd = nextPeriodEnd(now);

  // 1) Idempotent ledger claim (source of bookkeeping truth)
  const { payment, created } = await recordBillingPayment({
    organizationId: org._id,
    planId: id,
    status: 'succeeded',
    source,
    amountMinor: amountMinor ?? planAmountMinorUnits(id),
    currency: currency || getRazorpayCurrency(),
    razorpayPaymentId: paymentId,
    razorpayOrderId: orderId,
    razorpaySubscriptionId: subscriptionId || org.razorpaySubscriptionId,
    periodStart: now,
    periodEnd,
  });

  const alreadyOnPlan =
    paymentId &&
    org.razorpayPaymentId === paymentId &&
    org.subscriptionStatus === 'active' &&
    String(org.subscriptionPlan).toLowerCase() === id;

  if (alreadyOnPlan && !created) {
    return { org, payment, alreadyApplied: true };
  }

  // 2) Entitlement update (may already be applied by the other path)
  applyPlanToOrganization(org, id, {
    subscriptionStatus: 'active',
    clearTrial: true,
    subscriptionStartDate: org.subscriptionStartDate || now,
    subscriptionEndDate: periodEnd,
    paymentMethod: 'razorpay',
    razorpayOrderId: orderId || org.razorpayOrderId,
    razorpayPaymentId: paymentId || org.razorpayPaymentId,
    razorpaySubscriptionId: subscriptionId || org.razorpaySubscriptionId,
    razorpayCustomerId: customerId || org.razorpayCustomerId,
  });
  await org.save();

  logger.info('Paid subscription activated/renewed', {
    organizationId: org._id,
    planId: id,
    paymentId,
    subscriptionId,
    source,
    alreadyApplied: !created,
  });

  return { org, payment, alreadyApplied: !created };
};

export const ensureRazorpayPlan = async (planId) => {
  const id = String(planId).toLowerCase();
  const plan = getPlanDetails(id);
  const amount = planAmountMinorUnits(id);
  const currency = getRazorpayCurrency();

  let catalog = await SubscriptionPlan.findOne({ planId: id });
  if (catalog?.razorpayPlanId) {
    return catalog.razorpayPlanId;
  }

  const envKey = `RAZORPAY_PLAN_ID_${id.toUpperCase()}`;
  if (process.env[envKey]) {
    if (catalog) {
      catalog.razorpayPlanId = process.env[envKey];
      await catalog.save();
    }
    return process.env[envKey];
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    const err = new Error('Razorpay is not configured');
    err.statusCode = 503;
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }

  const created = await razorpay.plans.create({
    period: 'monthly',
    interval: 1,
    item: {
      name: `Paarsiv EMS — ${plan.name}`,
      amount,
      currency,
      description: `${plan.name} plan (monthly)`,
    },
    notes: {
      emsPlanId: id,
    },
  });

  if (catalog) {
    catalog.razorpayPlanId = created.id;
    await catalog.save();
  } else {
    try {
      await SubscriptionPlan.create({
        planId: id,
        name: plan.name,
        price: plan.price,
        maxEmployees: plan.maxEmployees,
        trialDays: plan.trialDays,
        features: plan.features || [],
        razorpayPlanId: created.id,
      });
    } catch {
      await SubscriptionPlan.updateOne(
        { planId: id },
        { $set: { razorpayPlanId: created.id } }
      );
    }
  }

  logger.info('Created Razorpay plan', { planId: id, razorpayPlanId: created.id });
  return created.id;
};

export const cancelRazorpaySubscription = async (subscriptionId, { cancelAtCycleEnd = false } = {}) => {
  if (!subscriptionId || String(subscriptionId).startsWith('sub_mock_')) return null;
  const razorpay = getRazorpay();
  if (!razorpay) return null;
  try {
    return await razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
  } catch (error) {
    logger.warn('Failed to cancel Razorpay subscription', {
      subscriptionId,
      error: error.message,
    });
    return null;
  }
};

export const createCheckoutSession = async ({
  organization,
  planId,
  customerEmail,
  customerName,
}) => {
  const id = String(planId).toLowerCase();
  if (!isPaidPlan(id)) {
    const err = new Error('Checkout is only required for paid plans');
    err.statusCode = 400;
    err.code = 'CHECKOUT_NOT_REQUIRED';
    throw err;
  }

  const plan = getPlanDetails(id);
  const mode = getBillingMode();
  const currency = getRazorpayCurrency();
  const amount = planAmountMinorUnits(id);

  if (mode === 'mock') {
    const token = signMockCheckoutToken({
      organizationId: String(organization._id),
      planId: id,
      mode: 'mock',
      amount: plan.price,
      planName: plan.name,
      currency,
    });
    const url = `${frontendBase()}/organization/checkout?token=${encodeURIComponent(token)}`;
    logger.info('Created mock checkout', { organizationId: organization._id, planId: id });
    return {
      mode: 'mock',
      checkoutType: 'mock',
      url,
      planId: id,
      planName: plan.name,
      amount: plan.price,
      currency,
    };
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    const err = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    err.statusCode = 503;
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }

  if (
    organization.razorpaySubscriptionId &&
    String(organization.subscriptionPlan).toLowerCase() !== id
  ) {
    await cancelRazorpaySubscription(organization.razorpaySubscriptionId, {
      cancelAtCycleEnd: false,
    });
  }

  if (getCheckoutMode() === 'order') {
    const receipt = `ems_${String(organization._id).slice(-8)}_${id}_${Date.now()}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        organizationId: String(organization._id),
        planId: id,
        organizationName: organization.name || '',
      },
    });
    return {
      mode: 'razorpay',
      checkoutType: 'order',
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planId: id,
      planName: plan.name,
      displayAmount: plan.price,
      name: 'Paarsiv EMS',
      description: `${plan.name} plan — monthly`,
      prefill: {
        name: customerName || organization.name || '',
        email: customerEmail || organization.email || '',
      },
      theme: { color: '#4F46E5' },
    };
  }

  const razorpayPlanId = await ensureRazorpayPlan(id);
  const totalCount = Number(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT || 120);

  const subscription = await razorpay.subscriptions.create({
    plan_id: razorpayPlanId,
    total_count: totalCount,
    quantity: 1,
    customer_notify: 1,
    notes: {
      organizationId: String(organization._id),
      planId: id,
      organizationName: organization.name || '',
    },
  });

  logger.info('Created Razorpay subscription', {
    organizationId: organization._id,
    planId: id,
    subscriptionId: subscription.id,
  });

  return {
    mode: 'razorpay',
    checkoutType: 'subscription',
    keyId: process.env.RAZORPAY_KEY_ID,
    subscriptionId: subscription.id,
    razorpayPlanId,
    amount,
    currency,
    planId: id,
    planName: plan.name,
    displayAmount: plan.price,
    name: 'Paarsiv EMS',
    description: `${plan.name} plan — recurring monthly`,
    prefill: {
      name: customerName || organization.name || '',
      email: customerEmail || organization.email || '',
    },
    theme: { color: '#4F46E5' },
  };
};

export const createBillingPortalSession = async (organization) => {
  if (getBillingMode() === 'mock') {
    return {
      mode: 'mock',
      url: `${frontendBase()}/organization/subscription?portal=mock`,
      message: 'Mock mode — manage your plan on this page.',
    };
  }
  return {
    mode: 'razorpay',
    url: `${frontendBase()}/organization/subscription`,
    message: organization?.razorpaySubscriptionId
      ? 'Manage upgrades or cancel from this page. Recurring charges are handled by Razorpay.'
      : 'Manage your plan on this page.',
    subscriptionId: organization?.razorpaySubscriptionId || null,
  };
};

export const claimWebhookEvent = async (event) => {
  const entity =
    event?.payload?.payment?.entity ||
    event?.payload?.subscription?.entity ||
    event?.payload?.order?.entity ||
    {};
  const eventId =
    event?.event_id ||
    `${event?.event || 'unknown'}:${entity.id || ''}:${entity.created_at || Date.now()}`;

  try {
    await BillingWebhookEvent.create({
      eventId,
      eventType: event?.event || 'unknown',
      payloadSummary: {
        entityId: entity.id,
        status: entity.status,
      },
    });
    return { claimed: true, eventId };
  } catch (error) {
    if (error?.code === 11000) {
      return { claimed: false, eventId };
    }
    throw error;
  }
};

export const resolveOrgFromNotesOrIds = async ({
  notes = {},
  orderId,
  subscriptionId,
}) => {
  if (notes.organizationId) {
    const org = await Organization.findById(notes.organizationId);
    if (org) return { org, planId: notes.planId };
  }
  if (subscriptionId) {
    const org = await Organization.findOne({ razorpaySubscriptionId: subscriptionId });
    if (org) return { org, planId: notes.planId || org.subscriptionPlan };
  }
  if (orderId) {
    const org = await Organization.findOne({ razorpayOrderId: orderId });
    if (org) return { org, planId: notes.planId || org.subscriptionPlan };
  }
  return { org: null, planId: notes.planId };
};

export const processRazorpayWebhookEvent = async (event) => {
  const { claimed, eventId } = await claimWebhookEvent(event);
  if (!claimed) {
    logger.info('Skipping duplicate Razorpay webhook', { eventId, type: event?.event });
    return { duplicate: true };
  }

  const type = event?.event;
  const payload = event?.payload || {};

  if (
    type === 'subscription.charged' ||
    type === 'subscription.activated' ||
    type === 'payment.captured' ||
    type === 'order.paid'
  ) {
    const paymentEntity = payload.payment?.entity;
    const subscriptionEntity = payload.subscription?.entity;
    const orderEntity = payload.order?.entity;

    const paymentId = paymentEntity?.id;
    const subscriptionId =
      subscriptionEntity?.id || paymentEntity?.subscription_id || undefined;
    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const notes =
      paymentEntity?.notes ||
      subscriptionEntity?.notes ||
      orderEntity?.notes ||
      {};

    const { org, planId } = await resolveOrgFromNotesOrIds({
      notes,
      orderId,
      subscriptionId,
    });

    if (!org) {
      logger.warn('Webhook org not found', { type, paymentId, subscriptionId, eventId });
      return { handled: false, reason: 'org_not_found' };
    }

    if (subscriptionId && org.razorpaySubscriptionId !== subscriptionId) {
      org.razorpaySubscriptionId = subscriptionId;
    }

    const effectivePlan = planId || notes.planId || org.subscriptionPlan;

    if (type === 'subscription.activated' && !paymentId) {
      if (isPaidPlan(effectivePlan)) {
        const now = new Date();
        applyPlanToOrganization(org, effectivePlan, {
          subscriptionStatus: 'active',
          clearTrial: true,
          subscriptionStartDate: org.subscriptionStartDate || now,
          subscriptionEndDate: nextPeriodEnd(now),
          paymentMethod: 'razorpay',
          razorpaySubscriptionId: subscriptionId,
        });
        await org.save();
      }
      await BillingWebhookEvent.updateOne(
        { eventId },
        { $set: { organizationId: org._id } }
      );
      return { handled: true, type };
    }

    if (paymentId || isPaidPlan(effectivePlan)) {
      await activatePaidSubscription({
        organization: org,
        planId: effectivePlan,
        paymentId,
        orderId,
        subscriptionId,
        source: 'webhook',
        amountMinor: paymentEntity?.amount,
        currency: paymentEntity?.currency,
        customerId: paymentEntity?.customer_id || subscriptionEntity?.customer_id,
      });
      await BillingWebhookEvent.updateOne(
        { eventId },
        { $set: { organizationId: org._id } }
      );
    }
    return { handled: true, type };
  }

  if (type === 'subscription.pending' || type === 'subscription.halted') {
    const sub = payload.subscription?.entity;
    const { org } = await resolveOrgFromNotesOrIds({
      notes: sub?.notes || {},
      subscriptionId: sub?.id,
    });
    if (org && org.paymentMethod === 'razorpay') {
      org.subscriptionStatus = 'past_due';
      await org.save();
      await recordBillingPayment({
        organizationId: org._id,
        planId: org.subscriptionPlan,
        status: 'failed',
        source: 'webhook',
        amountMinor: planAmountMinorUnits(org.subscriptionPlan),
        razorpaySubscriptionId: sub?.id,
        failureReason: type,
      });
      await BillingWebhookEvent.updateOne(
        { eventId },
        { $set: { organizationId: org._id } }
      );
    }
    return { handled: true, type };
  }

  if (type === 'subscription.cancelled' || type === 'subscription.completed') {
    const sub = payload.subscription?.entity;
    const { org } = await resolveOrgFromNotesOrIds({
      notes: sub?.notes || {},
      subscriptionId: sub?.id,
    });
    if (org) {
      org.subscriptionStatus = 'cancelled';
      await org.save();
      await BillingWebhookEvent.updateOne(
        { eventId },
        { $set: { organizationId: org._id } }
      );
    }
    return { handled: true, type };
  }

  if (type === 'payment.failed') {
    const paymentEntity = payload.payment?.entity || {};
    const notes = paymentEntity.notes || {};
    const { org, planId } = await resolveOrgFromNotesOrIds({
      notes,
      orderId: paymentEntity.order_id,
      subscriptionId: paymentEntity.subscription_id,
    });
    if (org) {
      if (org.paymentMethod === 'razorpay' && org.razorpayPaymentId) {
        org.subscriptionStatus = 'past_due';
        await org.save();
      }
      await recordBillingPayment({
        organizationId: org._id,
        planId: planId || org.subscriptionPlan,
        status: 'failed',
        source: 'webhook',
        amountMinor: paymentEntity.amount || planAmountMinorUnits(planId || org.subscriptionPlan),
        currency: paymentEntity.currency,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
        razorpaySubscriptionId: paymentEntity.subscription_id,
        failureReason: paymentEntity.error_description || 'payment.failed',
      });
      await BillingWebhookEvent.updateOne(
        { eventId },
        { $set: { organizationId: org._id } }
      );
    }
    return { handled: true, type };
  }

  logger.info('Unhandled Razorpay webhook type', { type, eventId });
  return { handled: false, type };
};

export default {
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
  activatePaidSubscription,
  processRazorpayWebhookEvent,
  cancelRazorpaySubscription,
  ensureRazorpayPlan,
  getRazorpay,
  getCheckoutMode,
};
