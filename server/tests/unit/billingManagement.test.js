import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import Organization from '../../models/organization.model.js';
import { cancelRecurringSubscription } from '../../controllers/organization/billingController.js';
import { applyPlanToOrganization, createBillingPortalSession } from '../../services/razorpayBillingService.js';
import logger from '../../helpers/logger.js';

const previousMode = process.env.RAZORPAY_BILLING_MODE;
const previousFrontend = process.env.FRONTEND_URL;
beforeEach(() => {
  process.env.RAZORPAY_BILLING_MODE = 'mock';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousMode === undefined) delete process.env.RAZORPAY_BILLING_MODE;
  else process.env.RAZORPAY_BILLING_MODE = previousMode;
  if (previousFrontend === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = previousFrontend;
});
const organization = (extras = {}) => ({
  _id: 'trusted-org', subscriptionPlan: 'enterprise', subscriptionStatus: 'active',
  razorpaySubscriptionId: 'sub_mock_test', subscriptionEndDate: new Date('2026-11-23'),
  save: jest.fn(async () => {}), ...extras,
});
const invokeCancel = (body = { atCycleEnd: true }) => new Promise((resolve, reject) => {
  const res = { status: jest.fn(function (status) { this.statusCode = status; return this; }),
    json: jest.fn(function (data) { resolve({ status: this.statusCode, data }); }) };
  cancelRecurringSubscription({ user: { organizationId: 'trusted-org' }, body }, res, reject);
});

describe('billing management API', () => {
  it.each(['mock', 'razorpay'])('opens the dedicated management page in %s mode', async mode => {
    process.env.RAZORPAY_BILLING_MODE = mode;
    expect((await createBillingPortalSession({})).url).toBe('http://localhost:5173/organization/billing');
  });

  it('persists cycle-end cancellation while preserving paid access and tenant isolation', async () => {
    const org = organization(); const find = jest.spyOn(Organization, 'findById').mockResolvedValue(org);
    const response = await invokeCancel({ atCycleEnd: true, organizationId: 'untrusted-org' });
    expect(find).toHaveBeenCalledWith('trusted-org');
    expect(org.save).toHaveBeenCalledTimes(1);
    expect(org.cancelAtPeriodEnd).toBe(true);
    expect(response.data.subscription).toMatchObject({ cancelAtPeriodEnd: true, subscriptionStatus: 'active' });
    expect(org.subscriptionEndDate.toISOString()).toBe('2026-11-23T00:00:00.000Z');
  });

  it('handles repeated cancellation without cancelling again', async () => {
    const org = organization({ cancelAtPeriodEnd: true });
    jest.spyOn(Organization, 'findById').mockResolvedValue(org);
    expect((await invokeCancel()).status).toBe(200);
    expect(org.save).not.toHaveBeenCalled();
  });

  it('does not cancel a one-time subscription', async () => {
    const org = organization({ razorpaySubscriptionId: null });
    jest.spyOn(Organization, 'findById').mockResolvedValue(org);
    expect((await invokeCancel()).data.code).toBe('NO_RECURRING_SUBSCRIPTION');
    expect(org.save).not.toHaveBeenCalled();
  });

  it('does not claim cancellation when the payment provider is unavailable', async () => {
    const org = organization({ razorpaySubscriptionId: 'sub_real_fixture' });
    jest.spyOn(Organization, 'findById').mockResolvedValue(org);
    await expect(invokeCancel()).rejects.toMatchObject({ statusCode: 503 });
    expect(org.save).not.toHaveBeenCalled();
    expect(org.cancelAtPeriodEnd).toBeUndefined();
  });

  it('clears scheduled cancellation when switching plans but preserves it for the existing subscription', () => {
    const org = organization({ cancelAtPeriodEnd: true });
    applyPlanToOrganization(org, 'enterprise', { razorpaySubscriptionId: org.razorpaySubscriptionId });
    expect(org.cancelAtPeriodEnd).toBe(true);
    applyPlanToOrganization(org, 'free');
    expect(org.cancelAtPeriodEnd).toBe(false);
    expect(new Organization().cancelAtPeriodEnd).toBe(false);
  });
});
