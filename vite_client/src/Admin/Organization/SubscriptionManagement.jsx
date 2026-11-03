import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FiSettings,
} from 'react-icons/fi';
import logger from '../../utils/logger';
import '../../styles/billingPages.css';
import { formatBillingDate as formatDate, formatBillingMoney as formatMoney, downloadBillingInvoice } from '../../utils/billingDisplay';

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
    script.onerror = () => { script.remove(); resolve(false); };
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
  const navigate = useNavigate();
  const checkoutStarted = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyPlan, setBusyPlan] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/current`, {
        withCredentials: true,
      });
      setSubscription(res.data.subscription || null);
      setPlans(res.data.availablePlans || []);
      setPayments(res.data.recentPayments || []);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load subscription details.');
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
      await downloadBillingInvoice(payment);
    } catch {
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
      return false;
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
    return true;
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
        const opened = await openRazorpayCheckout(checkout);
        if (!opened) setBusyPlan(null);
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


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-theme-secondary" />
      </div>
    );
  }

  if (loadError) {
    return <div className="page-shell"><div role="alert" className="page-shell-inner rounded-xl border border-red-200 bg-white p-6"><h1 className="text-xl font-bold">Subscription &amp; billing</h1><p className="mt-3">{loadError}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={() => { setLoading(true); load(); }}>Try again</button></div></div>;
  }

  const currentPlan = subscription?.subscriptionPlan;
  const currency = subscription?.currency || plans[0]?.currency || 'INR';
  const planOrder = ['free', 'basic', 'premium', 'enterprise'];
  const sortedPlans = planOrder
    .map((id) => plans.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="page-shell billing-page">
      <div className="page-shell-inner billing-page__content">
        <div className="billing-page__header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription & billing</h1>
            <p className="mt-2 text-gray-600">
              Choose the right plan for your team and keep track of your subscription.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/organization/billing')}
            disabled={!!busyPlan}
            className="billing-button billing-button--primary"
          >
            <FiSettings /> Manage billing
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
          <div className="billing-panel billing-summary">
            <div className="billing-summary__heading">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Current subscription</h2>
                <p className="billing-summary__plan">
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
                className={`billing-badge ${statusTone(
                  subscription.subscriptionStatus
                )}`}
              >
                {subscription.subscriptionStatus}
              </span>
            </div>

            <div className="billing-metrics">
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

        <section aria-labelledby="subscription-plans" className="billing-plan-section">
          <div className="billing-section-heading"><h2 id="subscription-plans">Choose your plan</h2><p>Find the features and capacity your team needs.</p></div>
        <div className="billing-plans">
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
                className={`billing-plan ${isCurrent ? 'is-current' : ''}`}
              >
                {isCurrent && (
                  <div className="billing-plan__ribbon">
                    Current plan
                  </div>
                )}
                <div className="billing-plan__body">
                  <div className="billing-plan__heading">
                    <h3 className="mb-2 text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="billing-plan__price">
                        {formatMoney(plan.price, planCurrency)}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>
                    <div className="flex items-center justify-center text-sm text-gray-600">
                      <FiUsers className="mr-1 h-4 w-4" />
                      <span>Up to {plan.maxEmployees} employees</span>
                    </div>
                  </div>

                  <ul className="billing-plan__features">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-start">
                        <FiCheck className="mr-2 mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="billing-plan__action">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="billing-button billing-button--current"
                      >
                        Current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={!!busyPlan}
                        className={`billing-button ${isUpgrade ? 'billing-button--primary' : isDowngrade ? 'billing-button--secondary' : ''}`}
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
        </section>

        <div className="billing-panel billing-help">
          <h2 className="text-lg font-semibold text-gray-900">How billing works</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-600">
            <li>
              Your plan remains active until the period end date. We’ll email a reminder before renewal and a receipt after successful payment.
            </li>
            <li>Open Manage billing to review payment history, download invoices, and manage auto-renewal.</li>
            <li>Plan changes are applied after successful payment through secure checkout.</li>
          </ul>
        </div>

        {payments.length > 0 && (
          <div className="billing-panel">
            <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="py-2 pr-4">Invoice</th>
                    <th scope="col" className="py-2 pr-4">Plan</th>
                    <th scope="col" className="py-2 pr-4">Amount</th>
                    <th scope="col" className="py-2 pr-4">Status</th>
                    <th scope="col" className="py-2 pr-4">Date</th>
                    <th scope="col" className="py-2">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td data-label="Invoice" className="py-2.5 pr-4 font-mono text-xs text-gray-700">
                        {p.invoiceNumber || '—'}
                      </td>
                      <td data-label="Plan" className="py-2.5 pr-4 capitalize">{p.planId}</td>
                      <td data-label="Amount" className="py-2.5 pr-4">
                        {formatMoney(p.amount, p.currency || currency)}
                      </td>
                      <td data-label="Status"><span className={`billing-badge billing-badge--${p.status}`}>{p.status}</span></td>
                      <td data-label="Date" className="py-2.5">{formatDate(p.createdAt)}</td>
                      <td data-label="Receipt" className="py-2.5">
                        {p.status === 'succeeded' ? (
                          <button
                            type="button"
                            className="billing-download"
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
