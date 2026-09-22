import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT } from '../../utils/constant';
import {
  FiCheck,
  FiArrowUp,
  FiArrowDown,
  FiCreditCard,
  FiCalendar,
  FiUsers,
  FiExternalLink,
} from 'react-icons/fi';
import logger from '../../utils/logger';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const statusTone = (status) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'trial':
      return 'bg-sky-100 text-sky-800';
    case 'past_due':
      return 'bg-amber-100 text-amber-800';
    case 'expired':
    case 'cancelled':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const SubscriptionManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/current`, {
        withCredentials: true,
      });
      setSubscription(res.data.subscription || null);
      setPlans(res.data.availablePlans || []);
    } catch (error) {
      logger.error('Failed to load subscription', { error: error.message });
      toast.error(error.response?.data?.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle return from Stripe checkout / cancel (mock uses /organization/checkout page)
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');

    const finishParams = () => {
      const next = new URLSearchParams(searchParams);
      ['checkout', 'token', 'session_id', 'portal'].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    };

    const run = async () => {
      if (checkout === 'paid') {
        toast.success('Subscription updated after payment');
        await load();
        finishParams();
        return;
      }

      if (checkout === 'success' && sessionId) {
        try {
          setBusyPlan('sync');
          await axios.get(
            `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/checkout/session/${sessionId}`,
            { withCredentials: true }
          );
          toast.success('Payment successful — subscription updated');
          await load();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Could not sync payment');
        } finally {
          setBusyPlan(null);
          finishParams();
        }
        return;
      }

      if (checkout === 'cancelled') {
        toast.info('Checkout cancelled');
        finishParams();
      }

      if (searchParams.get('portal') === 'mock') {
        toast.info('Mock billing portal — manage your plan on this page');
        finishParams();
      }
    };

    if (checkout || searchParams.get('portal')) {
      run();
    }
  }, [searchParams, setSearchParams, load]);

  const handleSelectPlan = async (planId) => {
    if (busyPlan) return;
    const id = String(planId).toLowerCase();

    if (id === 'free') {
      if (!window.confirm('Switch to the Free plan? Paid features will be limited.')) return;
      try {
        setBusyPlan(id);
        await axios.post(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/switch-free`, {}, { withCredentials: true });
        toast.success('Switched to Free plan');
        await load();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to switch plan');
      } finally {
        setBusyPlan(null);
      }
      return;
    }

    try {
      setBusyPlan(id);
      const res = await axios.post(
        `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/checkout`,
        { planId: id },
        { withCredentials: true }
      );
      const checkout = res.data.checkout;
      if (checkout?.url) {
        if (checkout.mode === 'mock') {
          toast.info('Opening development checkout…');
        }
        window.location.href = checkout.url;
        return;
      }
      toast.error('No checkout URL returned');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start checkout');
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    try {
      setBusyPlan('portal');
      const res = await axios.post(
        `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/portal`,
        {},
        { withCredentials: true }
      );
      const url = res.data.portal?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      toast.info(res.data.portal?.message || 'Portal unavailable');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to open billing portal');
    } finally {
      setBusyPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-theme-secondary" />
      </div>
    );
  }

  const currentPlan = subscription?.subscriptionPlan;
  const planOrder = ['free', 'basic', 'premium', 'enterprise'];
  const sortedPlans = planOrder
    .map((id) => plans.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="page-shell min-h-screen bg-gray-50">
      <div className="page-shell-inner hrms-stack space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription & billing</h1>
            <p className="mt-2 text-gray-600">
              View your plan, seats, renewal dates, and upgrade with checkout
              {subscription?.billingMode === 'mock' ? ' (development / mock mode)' : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={openPortal}
            disabled={!!busyPlan}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <FiExternalLink /> Manage billing
          </button>
        </div>

        {subscription && (
          <div className="rounded-xl border border-theme-secondary/30 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Current subscription</h2>
                <p className="mt-1 text-2xl font-bold text-theme-secondary">
                  {subscription.planName || currentPlan}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  ${subscription.planPrice ?? 0}/month
                  {subscription.billingMode === 'mock' && ' · Mock billing'}
                  {subscription.stripeConfigured && ' · Stripe connected'}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(
                  subscription.subscriptionStatus
                )}`}
              >
                {subscription.subscriptionStatus}
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <FiUsers /> Seats
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900">
                  {subscription.usage?.employees?.current ?? 0} /{' '}
                  {subscription.maxEmployees || '∞'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <FiCalendar /> Trial ends
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900">
                  {formatDate(subscription.trialEndDate)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <FiCalendar /> Period ends
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900">
                  {formatDate(subscription.subscriptionEndDate)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <FiCreditCard /> Payment
                </div>
                <div className="mt-2 text-lg font-semibold capitalize text-gray-900">
                  {subscription.paymentMethod || 'none'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const currentIdx = planOrder.indexOf(currentPlan);
            const targetIdx = planOrder.indexOf(plan.id);
            const isUpgrade = targetIdx > currentIdx;
            const isDowngrade = targetIdx < currentIdx;

            return (
              <div
                key={plan.id}
                className={`relative overflow-hidden rounded-lg border-2 bg-white shadow-lg ${
                  isCurrent ? 'border-theme-secondary ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                {isCurrent && (
                  <div className="absolute left-0 right-0 top-0 bg-theme-primary py-1 text-center text-sm font-semibold text-white">
                    Current plan
                  </div>
                )}
                <div className={`p-6 ${isCurrent ? 'pt-10' : ''}`}>
                  <div className="mb-6 text-center">
                    <h3 className="mb-2 text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-600">/month</span>
                    </div>
                    <div className="flex items-center justify-center text-sm text-gray-600">
                      <FiUsers className="mr-1 h-4 w-4" />
                      <span>Up to {plan.maxEmployees} employees</span>
                    </div>
                  </div>

                  <ul className="mb-6 space-y-3">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-start">
                        <FiCheck className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-md bg-gray-200 px-4 py-2 text-gray-600"
                      >
                        Current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={!!busyPlan}
                        className={`flex w-full items-center justify-center rounded-md px-4 py-2 text-white disabled:opacity-50 ${
                          isUpgrade
                            ? 'bg-theme-primary hover:opacity-90'
                            : isDowngrade
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        {busyPlan === plan.id ? (
                          'Please wait…'
                        ) : plan.id === 'free' ? (
                          <>
                            <FiArrowDown className="mr-2" /> Switch to Free
                          </>
                        ) : isUpgrade ? (
                          <>
                            <FiArrowUp className="mr-2" />{' '}
                            {plan.requiresCheckout ? 'Upgrade & checkout' : 'Upgrade'}
                          </>
                        ) : (
                          <>
                            <FiArrowDown className="mr-2" /> Change plan
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">How billing works</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>
              Paid plans open a <strong>checkout payment page</strong> (like Razorpay/Stripe). Enter test card{' '}
              <code className="text-xs">4242 4242 4242 4242</code> — no real money is charged in test/mock mode.
            </li>
            <li>Free plan never requires payment.</li>
            <li>
              For live Stripe Checkout, set <code className="text-xs">STRIPE_SECRET_KEY=sk_test_…</code> and{' '}
              <code className="text-xs">STRIPE_BILLING_MODE=stripe</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
