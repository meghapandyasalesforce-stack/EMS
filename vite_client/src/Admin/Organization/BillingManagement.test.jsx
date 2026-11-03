import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BillingManagement from './BillingManagement';
import SubscriptionManagement from './SubscriptionManagement';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn(() => ({ unwrap: async () => ({}) })) }));
vi.mock('react-redux', () => ({ useDispatch: () => dispatch }));
vi.mock('../../context/Auth/authSlice', () => ({ checkAuthSession: () => ({ type: 'auth/check' }) }));
vi.mock('../../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const subscription = { planName: 'Enterprise', subscriptionPlan: 'enterprise', subscriptionStatus: 'active',
  planPrice: 199, currency: 'INR', maxEmployees: 1000, usage: { employees: { current: 14 } },
  paymentMethod: 'razorpay', subscriptionEndDate: '2026-11-23', recurring: true };
const payments = [
  { id: 'paid', invoiceNumber: 'INV-001', planId: 'enterprise', status: 'succeeded', amount: 199, currency: 'INR', createdAt: '2026-10-23' },
  { id: 'failed', planId: 'premium', status: 'failed', amount: 79, currency: 'INR', failureReason: 'Payment declined' },
];
function mount(path = '/organization/billing') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/organization/billing" element={<BillingManagement />} />
    <Route path="/organization/subscription" element={<SubscriptionManagement />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  delete window.Razorpay;
  axios.get.mockImplementation(async url => ({ data: url.includes('/payments?') ? { payments } : { subscription, availablePlans: [], recentPayments: payments } }));
  axios.post.mockResolvedValue({ data: { subscription: { ...subscription, usage: null, cancelAtPeriodEnd: true } } });
});

describe('billing management', () => {
  it('opens a dedicated billing page from Manage billing without creating a portal or payment', async () => {
    mount('/organization/subscription');
    fireEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));
    await screen.findByRole('heading', { name: 'Billing management' });
    await screen.findByText('INV-001');
    expect(screen.getByText('14 / 1000')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/payments?limit=100'), expect.objectContaining({ withCredentials: true }));
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('provides a working Change plan link back to subscription options', async () => {
    mount(); await screen.findByText('Enterprise');
    fireEvent.click(screen.getByRole('link', { name: 'Change plan' }));
    await screen.findByRole('heading', { name: 'Subscription & billing' });
  });

  it('downloads invoices only for successful payments', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:invoice'); URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Download invoice INV-001' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/payments/paid/invoice'), expect.objectContaining({ responseType: 'blob', withCredentials: true }));
    expect(screen.getAllByRole('button', { name: /Download invoice/ })).toHaveLength(1);
    expect(screen.getByText('Payment declined')).toBeInTheDocument();
  });

  it('requires confirmation to stop renewal and preserves access until the period end', async () => {
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Stop auto-renewal', exact: true }));
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep auto-renewal' }));
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop auto-renewal', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop auto-renewal' }));
    await screen.findByText(/Auto-renewal is stopped/);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/cancel'), { atCycleEnd: true }, { withCredentials: true });
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('14 / 1000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop auto-renewal', exact: true })).not.toBeInTheDocument();
  });

  it('shows persisted renewal cancellation after reopening the page', async () => {
    axios.get.mockImplementation(async url => ({ data: url.includes('/payments?') ? { payments: [] } : { subscription: { ...subscription, cancelAtPeriodEnd: true } } }));
    mount(); await screen.findByText(/Auto-renewal is stopped/);
    expect(screen.getByText(/No payments yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop auto-renewal', exact: true })).not.toBeInTheDocument();
  });

  it('reports failed cancellation without claiming that auto-renewal stopped', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Provider unavailable' } } });
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Stop auto-renewal', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop auto-renewal' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Provider unavailable'));
    expect(screen.queryByText(/Auto-renewal is stopped/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm stop auto-renewal' })).toBeEnabled();
  });

  it('shows a retry action after loading fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network unavailable'));
    mount(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Enterprise');
  });

  it('offers renewal for an expired paid plan and hides cancellation for one-time payments', async () => {
    axios.get.mockImplementation(async url => ({ data: url.includes('/payments?') ? { payments: [] } : { subscription: { ...subscription, recurring: false, subscriptionStatus: 'expired' } } }));
    mount();
    expect(await screen.findByRole('link', { name: 'Renew plan' })).toHaveAttribute('href', '/organization/subscription?startCheckout=enterprise');
    expect(screen.queryByRole('button', { name: 'Stop auto-renewal', exact: true })).not.toBeInTheDocument();
  });

  it('starts plan checkout and verifies payment before refreshing plan access', async () => {
    const plans = [
      { id: 'basic', name: 'Basic', price: 29, maxEmployees: 50 },
      { id: 'enterprise', name: 'Enterprise', price: 199, maxEmployees: 1000 },
    ];
    let current = subscription;
    let options;
    const open = vi.fn();
    window.Razorpay = vi.fn(function (checkoutOptions) { options = checkoutOptions; this.open = open; this.on = vi.fn(); });
    axios.get.mockImplementation(async () => ({ data: { subscription: current, availablePlans: plans, recentPayments: [] } }));
    axios.post.mockImplementation(async (url) => {
      if (url.endsWith('/verify-payment')) {
        current = { ...subscription, planName: 'Basic', subscriptionPlan: 'basic' };
        return { data: { message: 'Payment verified' } };
      }
      return { data: { checkout: { mode: 'razorpay', keyId: 'fixture-key', planId: 'basic', subscriptionId: 'sub_fixture' } } };
    });
    mount('/organization/subscription');
    fireEvent.click(await screen.findByRole('button', { name: 'Change plan' }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/checkout'), { planId: 'basic' }, { withCredentials: true });
    await act(async () => options.handler({ razorpay_payment_id: 'pay_fixture', razorpay_subscription_id: 'sub_fixture', razorpay_signature: 'fixture-signature' }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/verify-payment'), expect.objectContaining({ razorpay_payment_id: 'pay_fixture', planId: 'basic' }), { withCredentials: true });
    expect(dispatch).toHaveBeenCalled();
    expect(screen.getAllByText('Basic').length).toBeGreaterThan(1);
  });

  it('does not switch to Free unless the user confirms', async () => {
    axios.get.mockResolvedValue({ data: { subscription, availablePlans: [{ id: 'free', name: 'Free', price: 0, maxEmployees: 10 }], recentPayments: [] } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount('/organization/subscription');
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to Free' }));
    expect(axios.post).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Free' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/switch-free'), {}, { withCredentials: true }));
  });
});
