import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT } from '../../utils/constant';
import { checkAuthSession } from '../../context/Auth/authSlice';
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

const formatMoney = (amount, currency = 'INR') => {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
};

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

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
  const dispatch = useDispatch();
  const checkoutStarted = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/current`, {
        withCredentials: true,
      });
      setSubscription(res.data.subscription || null);
      setPlans(res.data.availablePlans || []);
      setPayments(res.data.recentPayments || []);
    } catch (error) {
      logger.error('Failed to load subscription', { error: error.message });
      toast.error(error.response?.data?.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPlanAccess = useCallback(async () => {
    await load();
    try {
      await dispatch(checkAuthSession()).unwrap();
    } catch {
      // Session refresh is best-effort; subscription page still updated.
    }
  }, [dispatch, load]);

  const downloadInvoice = async (payment) => {
    try {
      const res = await axios.get(
        `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/payments/${payment.id}/invoice`,
        { withCredentials: true, responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${payment.invoiceNumber || 'invoice'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Could not download invoice');
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');

    const finishParams = () => {
      const next = new URLSearchParams(searchParams);
      ['checkout', 'token', 'session_id', 'portal'].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    };

    const run = async () => {
      if (checkout === 'paid') {
        toast.success('Subscription updated after payment');
        await refreshPlanAccess();
        finishParams();
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
  }, [searchParams, setSearchParams, refreshPlanAccess]);

  const openRazorpayCheckout = async (checkout) => {
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      toast.error('Could not load Razorpay Checkout. Check your network.');
      return;
    }

    const planId = checkout.planId;
    const options = {
      key: checkout.keyId,
      name: checkout.name || 'Paarsiv EMS',
      description: checkout.description || `${checkout.planName} plan`,
      prefill: checkout.prefill || {},
      theme: checkout.theme || { color: '#4F46E5' },
      handler: async (response) => {
        try {
          setBusyPlan(planId);
          const res = await axios.post(
            `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/verify-payment`,
            {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              planId,
            },
            { withCredentials: true }
          );
          toast.success(
            res.data?.message || 'Payment successful — subscription updated'
          );
          await refreshPlanAccess();
        } catch (error) {
          const code = error.response?.data?.code;
          if (code === 'DUPLICATE_VALUE' || code === 'ALREADY_APPLIED') {
            toast.success('Payment successful — subscription updated');
            await refreshPlanAccess();
          } else {
            await refreshPlanAccess();
            toast.error(
              error.response?.data?.message || 'Payment verification failed'
            );
          }
        } finally {
          setBusyPlan(null);
        }
      },
      modal: {
        ondismiss: () => {
          toast.info('Checkout cancelled');
          setBusyPlan(null);
        },
      },
    };

    if (checkout.subscriptionId) {
      options.subscription_id = checkout.subscriptionId;
    } else {
      options.order_id = checkout.orderId;
      options.amount = checkout.amount;
      options.currency = checkout.currency || 'INR';
    }

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      toast.error(resp?.error?.description || 'Payment failed');
      setBusyPlan(null);
    });
    rzp.open();
  };

  const handleSelectPlan = async (planId) => {
    if (busyPlan) return;
    const id = String(planId).toLowerCase();

    if (id === 'free') {
      if (!window.confirm('Switch to the Free plan? Paid features will be limited.')) return;
      try {
        setBusyPlan(id);
        await axios.post(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/switch-free`, {}, { withCredentials: true });
        toast.success('Switched to Free plan');
        await refreshPlanAccess();
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

      if (checkout?.mode === 'razorpay' && (checkout.subscriptionId || checkout.orderId)) {
        toast.info(
          checkout.subscriptionId
            ? 'Opening Razorpay subscription checkout…'
            : 'Opening Razorpay Checkout…'
        );
        await openRazorpayCheckout(checkout);
        return;
      }

      if (checkout?.url) {
        if (checkout.mode === 'mock') {
          toast.info('Opening development checkout…');
        }
        window.location.href = checkout.url;
        return;
      }

      toast.error('No checkout session returned');
      setBusyPlan(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start checkout');
      setBusyPlan(null);
    }
  };

  useEffect(() => {
    const plan = searchParams.get('startCheckout');
    if (!plan || loading || checkoutStarted.current) return;
    checkoutStarted.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('startCheckout');
    setSearchParams(next, { replace: true });
    handleSelectPlan(plan);
  }, [loading, searchParams, setSearchParams]);

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
  const currency = subscription?.currency || plans[0]?.currency || 'INR';
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
              View your plan, seats, renewal dates, and upgrade with Razorpay checkout
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

        {subscription?.pendingPlan && subscription.subscriptionPlan === 'free' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            You selected the <strong className="capitalize">{subscription.pendingPlan}</strong> plan at signup.
            It stays inactive until payment succeeds. Use Upgrade &amp; checkout below if the payment window was closed.
          </div>
        )}

        {subscription?.subscriptionStatus === 'expired' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            This plan ended on {formatDate(subscription.subscriptionEndDate)}. Paid features are locked until you renew. Employee records are still saved.
          </div>
        )}

        {subscription && (
          <div className="rounded-xl border border-theme-secondary/30 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Current subscription</h2>
                <p className="mt-1 text-2xl font-bold text-theme-secondary">
                  {subscription.planName || currentPlan}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {formatMoney(subscription.planPrice ?? 0, currency)}/month
                  {subscription.billingMode === 'mock' && ' · Mock billing'}
                  {subscription.razorpayConfigured && ' · Razorpay connected'}
                  {subscription.recurring && ' · Recurring'}
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
            const planCurrency = plan.currency || currency;

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
                      <span className="text-4xl font-bold text-gray-900">
                        {formatMoney(plan.price, planCurrency)}
                      </span>
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
              Paid access lasts until the period end date. A daily job emails you about 3 days before it ends, then locks paid features if you do not renew. A receipt is emailed after each successful payment.
            </li>
            <li>
              Webhooks (<code className="text-xs">subscription.charged</code>, etc.) are the source of
              truth for renewals and failures. Client verify unlocks access immediately after checkout.
            </li>
            <li>
              Without API keys, local <strong>mock</strong> checkout uses card{' '}
              <code className="text-xs">4242 4242 4242 4242</code>.
            </li>
            <li>
              Free plan cancels any active Razorpay subscription. Configure webhook:{' '}
              <code className="text-xs">POST /api/v1/webhooks/razorpay</code>.
            </li>
          </ul>
        </div>

        {payments.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Invoice</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-700">
                        {p.invoiceNumber || '—'}
                      </td>
                      <td className="py-2.5 pr-4 capitalize">{p.planId}</td>
                      <td className="py-2.5 pr-4">
                        {formatMoney(p.amount, p.currency || currency)}
                      </td>
                      <td className="py-2.5 pr-4 capitalize">{p.status}</td>
                      <td className="py-2.5">{formatDate(p.createdAt)}</td>
                      <td className="py-2.5">
                        {p.status === 'succeeded' ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-700 underline"
                            onClick={() => downloadInvoice(p)}
                          >
                            Download
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;
