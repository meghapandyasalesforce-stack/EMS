import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_SUBSCRIPTION_ENDPOINT } from '../../utils/constant';
import { FiArrowLeft, FiCreditCard, FiLock, FiShield } from 'react-icons/fi';

const formatCardInput = (value) => {
  const digits = String(value).replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const CheckoutPaymentPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState('form'); // form | processing | success
  const [form, setForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: '',
  });

  useEffect(() => {
    if (!token) {
      toast.error('Missing checkout session');
      navigate('/organization/subscription', { replace: true });
      return;
    }

    const load = async () => {
      try {
        const res = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/checkout/preview`, {
          params: { token },
          withCredentials: true,
        });
        setPreview(res.data.preview);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Checkout session expired');
        navigate('/organization/subscription', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, navigate]);

  const amountLabel = useMemo(() => {
    if (!preview) return '';
    const currency = preview.currency || 'INR';
    const amount = Number(preview.amount || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [preview]);

  const fillTestCard = () => {
    const now = new Date();
    setForm({
      cardholderName: 'Test User',
      cardNumber: '4242 4242 4242 4242',
      expMonth: String(now.getMonth() + 1).padStart(2, '0'),
      expYear: String((now.getFullYear() + 2) % 100).padStart(2, '0'),
      cvc: '123',
    });
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (paying) return;

    setPaying(true);
    setStep('processing');
    // Simulate gateway processing spinner
    await new Promise((r) => setTimeout(r, 1400));

    try {
      const res = await axios.post(
        `${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/confirm-mock`,
        {
          token,
          cardholderName: form.cardholderName,
          cardNumber: form.cardNumber,
          expMonth: form.expMonth,
          expYear: form.expYear,
          cvc: form.cvc,
        },
        { withCredentials: true }
      );

      setStep('success');
      toast.success(res.data.message || 'Payment successful');
      setTimeout(() => {
        navigate('/organization/subscription?checkout=paid', { replace: true });
      }, 1600);
    } catch (error) {
      setStep('form');
      toast.error(error.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <p className="text-lg font-medium">Processing payment…</p>
        <p className="mt-1 text-sm text-slate-400">Secure connection · Do not refresh</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-50">
        <div className="rounded-2xl border border-emerald-200 bg-white px-10 py-8 text-center shadow-lg">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Payment successful</h1>
          <p className="mt-2 text-sm text-slate-600">
            {preview?.planName} · {amountLabel}/month
          </p>
          <p className="mt-4 text-xs text-slate-400">Redirecting to subscription…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-slate-800">
            <FiLock className="text-indigo-600" />
            <span className="font-semibold">Paarsiv Checkout</span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Test mode
            </span>
          </div>
          <Link
            to="/organization/subscription?checkout=cancelled"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <FiArrowLeft /> Cancel
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-5">
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{amountLabel}</p>
          <p className="mt-1 text-sm text-slate-500">per month · subscription</p>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Organization</span>
              <span className="font-medium text-slate-800">{preview?.organizationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-800">{preview?.planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Billing</span>
              <span className="font-medium text-slate-800">Monthly</span>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-900">
            <div className="mb-1 flex items-center gap-1 font-semibold">
              <FiShield /> Test payment (no real charge)
            </div>
            Use card <strong>4242 4242 4242 4242</strong>, any future expiry, any CVC.
            <button
              type="button"
              onClick={fillTestCard}
              className="mt-2 block font-semibold text-indigo-700 underline"
            >
              Autofill test card
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FiCreditCard /> Card details
          </h1>
          <p className="mt-1 text-sm text-slate-500">Enter payment information to complete your upgrade.</p>

          <form onSubmit={handlePay} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Cardholder name
              </label>
              <input
                required
                value={form.cardholderName}
                onChange={(e) => setForm((f) => ({ ...f, cardholderName: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="Name on card"
                autoComplete="cc-name"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Card number
              </label>
              <input
                required
                value={form.cardNumber}
                onChange={(e) => setForm((f) => ({ ...f, cardNumber: formatCardInput(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Month
                </label>
                <input
                  required
                  value={form.expMonth}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      expMonth: e.target.value.replace(/\D/g, '').slice(0, 2),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="MM"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Year
                </label>
                <input
                  required
                  value={form.expYear}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      expYear: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="YY"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  CVC
                </label>
                <input
                  required
                  value={form.cvc}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cvc: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={paying}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              <FiLock /> Pay {amountLabel}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Secured checkout · Test mode · No real money is charged
            </p>
          </form>
        </section>
      </div>
    </div>
  );
};

export default CheckoutPaymentPage;
