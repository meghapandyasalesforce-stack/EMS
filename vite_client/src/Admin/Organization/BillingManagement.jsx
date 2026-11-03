import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCreditCard, FiDownload } from 'react-icons/fi';
import axios from '../../utils/axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT as ENDPOINT } from '../../utils/constant';
import { formatBillingDate as date, formatBillingMoney as money, downloadBillingInvoice } from '../../utils/billingDisplay';
import { checkAuthSession } from '../../context/Auth/authSlice';
import '../../styles/billingPages.css';

export default function BillingManagement() {
  const dispatch = useDispatch();
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [current, history] = await Promise.all([
        axios.get(`${ENDPOINT}/current`, { withCredentials: true }),
        axios.get(`${ENDPOINT}/payments?limit=100`, { withCredentials: true }),
      ]);
      if (!current.data.subscription) throw new Error('No subscription details were returned.');
      setSubscription(current.data.subscription);
      setPayments(history.data.payments || []);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Could not load billing details. Please try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancelRenewal = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const response = await axios.post(`${ENDPOINT}/cancel`, { atCycleEnd: true }, { withCredentials: true });
      setSubscription(current => ({
        ...current, ...response.data.subscription,
        usage: response.data.subscription?.usage || current?.usage,
      }));
      setCancelOpen(false);
      toast.success('Auto-renewal stopped. Your current plan remains available until the period ends.');
      dispatch(checkAuthSession());
    } catch (failure) {
      toast.error(failure.response?.data?.message || 'Could not stop auto-renewal. Please try again.');
    } finally { setCancelling(false); }
  };
  const download = async payment => {
    setDownloading(payment.id);
    try { await downloadBillingInvoice(payment); }
    catch { toast.error('Could not download invoice. Please try again.'); }
    finally { setDownloading(null); }
  };

  const button = 'billing-button';
  return (
    <div className="page-shell billing-page">
      <div className="page-shell-inner billing-page__content">
        <header className="billing-page__header">
          <div><h1 className="text-3xl font-bold text-slate-900">Billing management</h1><p className="mt-2 text-slate-600">Manage renewals, review payments, and download your invoices.</p></div>
          <Link className={button} to="/organization/subscription"><FiArrowLeft /> Back to subscription</Link>
        </header>
        {loading ? <p role="status" className="rounded-xl bg-white p-6">Loading billing details…</p> : error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-white p-6"><p>{error}</p><button type="button" className={`${button} mt-4`} onClick={load}>Try again</button></div>
        ) : subscription && <>
          <section aria-labelledby="billing-plan" className="billing-panel billing-account">
            <div className="billing-summary__heading">
              <div><h2 id="billing-plan" className="text-lg font-semibold">Current plan</h2><p className="billing-summary__plan">{subscription.planName || subscription.subscriptionPlan}</p><p className="mt-1 text-slate-600">{money(subscription.planPrice, subscription.currency)}/month</p></div>
              <span className={`billing-badge billing-badge--${subscription.subscriptionStatus}`}>{subscription.subscriptionStatus}</span>
            </div>
            <dl className="billing-metrics">
              {[
                ['Employee seats', `${subscription.usage?.employees?.current ?? 0} / ${subscription.maxEmployees || 'Unlimited'}`],
                ['Period ends', date(subscription.subscriptionEndDate)],
                ...(subscription.trialEndDate ? [['Trial ends', date(subscription.trialEndDate)]] : []),
                ['Payment method', subscription.paymentMethod === 'razorpay' ? 'Razorpay' : subscription.paymentMethod === 'none' ? 'No payment required' : subscription.paymentMethod || '—'],
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}
            </dl>
            {subscription.billingMode === 'mock' && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Development billing: payments here are simulated. No real money is charged.</p>}
            <div className="billing-summary__actions">
              <Link className={`${button} billing-button--primary`} to="/organization/subscription"><FiCreditCard /> Change plan</Link>
              {subscription.subscriptionPlan !== 'free' && ['expired', 'cancelled', 'past_due'].includes(subscription.subscriptionStatus) && (
                <Link className={button} to={`/organization/subscription?startCheckout=${encodeURIComponent(subscription.subscriptionPlan)}`}>Renew plan</Link>
              )}
            </div>
          <div aria-labelledby="billing-renewal" className="billing-renewal">
            <h2 id="billing-renewal" className="text-lg font-semibold">Renewal settings</h2>
            <p className="mt-2 text-sm text-slate-600">{subscription.cancelAtPeriodEnd
              ? `Auto-renewal is stopped. Your plan remains available until ${date(subscription.subscriptionEndDate)}.`
              : subscription.recurring && subscription.subscriptionStatus === 'active'
                ? `Your subscription renews automatically${subscription.subscriptionEndDate ? ` after ${date(subscription.subscriptionEndDate)}` : ''}.`
                : subscription.subscriptionPlan === 'free' ? 'Your Free plan has no recurring charges.' : 'Auto-renewal is not active. You can renew your plan when the current period ends.'}</p>
            {subscription.recurring && !subscription.cancelAtPeriodEnd && subscription.subscriptionStatus === 'active' && (
              !cancelOpen ? <button type="button" className={`${button} mt-4`} onClick={() => setCancelOpen(true)}>Stop auto-renewal</button> : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4" role="region" aria-label="Confirm stop auto-renewal">
                  <p className="text-sm">Stop future renewals? This keeps your current paid access until the period ends.</p>
                  <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={button} disabled={cancelling} onClick={() => setCancelOpen(false)}>Keep auto-renewal</button><button type="button" className={button} disabled={cancelling} onClick={cancelRenewal}>{cancelling ? 'Stopping…' : 'Confirm stop auto-renewal'}</button></div>
                </div>
              )
            )}
          </div>
          </section>
          <section aria-labelledby="billing-payments" className="billing-panel">
            <h2 id="billing-payments" className="text-lg font-semibold">Payment history &amp; invoices</h2>
            {payments.length === 0 ? <p className="mt-4 text-sm text-slate-500">No payments yet. Your invoices will appear here after a successful payment.</p> : <>
              <p className="mt-2 text-sm text-slate-500">Your latest {payments.length} {payments.length === 1 ? 'payment' : 'payments'}.</p>
              <p className="billing-scroll-hint">Scroll to view all payment details.</p><div className="billing-table-wrap" tabIndex={0} role="region" aria-label="Payment history table"><table className="billing-table"><thead><tr className="border-b text-xs uppercase text-slate-500">{['Invoice', 'Plan', 'Amount', 'Status', 'Date', 'Receipt'].map(label => <th scope="col" key={label} className="whitespace-nowrap py-3 pr-5">{label}</th>)}</tr></thead><tbody>
                {payments.map(payment => <tr key={payment.id} className="border-b border-slate-100"><td data-label="Invoice" className="whitespace-nowrap py-3 pr-5">{payment.invoiceNumber || '—'}</td><td data-label="Plan" className="pr-5 capitalize">{payment.planId}</td><td data-label="Amount" className="whitespace-nowrap pr-5">{money(payment.amount, payment.currency || subscription.currency)}</td><td data-label="Status"><span className={`billing-badge billing-badge--${payment.status}`}>{payment.status}</span>{payment.failureReason && <p className="text-xs text-red-700">{payment.failureReason}</p>}</td><td data-label="Date" className="whitespace-nowrap pr-5">{date(payment.createdAt)}</td><td data-label="Receipt">{payment.status === 'succeeded' ? <button type="button" className="billing-download" disabled={downloading !== null} onClick={() => download(payment)} aria-label={`Download invoice ${payment.invoiceNumber || payment.id}`}><FiDownload />{downloading === payment.id ? 'Downloading…' : 'Download PDF'}</button> : '—'}</td></tr>)}
              </tbody></table></div>
            </>}
          </section>
        </>}
      </div>
    </div>
  );
}
