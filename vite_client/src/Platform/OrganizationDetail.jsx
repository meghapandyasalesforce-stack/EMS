import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  clearCurrentOrg,
  extendPlatformTrial,
  fetchPlatformOrganization,
  fetchPlatformPlans,
  restorePlatformOrganization,
  softDeletePlatformOrganization,
  updatePlatformAdmin,
  updatePlatformFeatures,
  updatePlatformOrganization,
  updatePlatformSubscription,
} from '../context/platformSlice';
import { FiArrowLeft, FiUsers } from 'react-icons/fi';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'features', label: 'Features' },
  { id: 'access', label: 'Effective Access' },
  { id: 'usage', label: 'Usage' },
  { id: 'admins', label: 'Admins' },
  { id: 'audit', label: 'Audit' },
  { id: 'billing', label: 'Billing' },
];

const sessionMsg = (err, fallback) => {
  const message = typeof err === 'string' ? err : fallback;
  if (/session expired|log in again|not authenticated|unauthorized/i.test(message)) return null;
  return message;
};

const OrganizationDetail = () => {
  const { orgId } = useParams();
  const dispatch = useDispatch();
  const { currentOrg, usage, featureLabels, plans, loading, admins, auditLogs } = useSelector(
    (state) => state.platform
  );
  const [tab, setTab] = useState('overview');

  const [subscriptionForm, setSubscriptionForm] = useState({
    subscriptionPlan: 'free',
    subscriptionStatus: 'trial',
    maxEmployees: 10,
    subscriptionEndDate: '',
    trialEndDate: '',
    isTrialActive: false,
  });
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    domain: '',
    verificationStatus: 'pending',
    platformNotes: '',
    platformTags: '',
    paymentMethod: 'none',
    razorpayCustomerId: '',
    razorpaySubscriptionId: '',
    stripeCustomerId: '',
    stripeSubscriptionId: '',
  });
  const [featureDraft, setFeatureDraft] = useState({});
  const [savingSub, setSavingSub] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  useEffect(() => {
    dispatch(fetchPlatformPlans());
    dispatch(fetchPlatformOrganization(orgId));
    return () => {
      dispatch(clearCurrentOrg());
    };
  }, [dispatch, orgId]);

  useEffect(() => {
    if (!currentOrg) return;
    setSubscriptionForm({
      subscriptionPlan: currentOrg.subscriptionPlan || 'free',
      subscriptionStatus: currentOrg.subscriptionStatus || 'trial',
      maxEmployees: currentOrg.maxEmployees || 10,
      subscriptionEndDate: currentOrg.subscriptionEndDate
        ? String(currentOrg.subscriptionEndDate).slice(0, 10)
        : '',
      trialEndDate: currentOrg.trialEndDate ? String(currentOrg.trialEndDate).slice(0, 10) : '',
      isTrialActive: !!currentOrg.isTrialActive,
    });
    setProfileForm({
      name: currentOrg.name || '',
      email: currentOrg.email || '',
      phone: currentOrg.phone || '',
      website: currentOrg.website || '',
      domain: currentOrg.domain || '',
      verificationStatus: currentOrg.verificationStatus || 'pending',
      platformNotes: currentOrg.platformNotes || '',
      platformTags: (currentOrg.platformTags || []).join(', '),
      paymentMethod: currentOrg.paymentMethod || 'none',
      razorpayCustomerId: currentOrg.razorpayCustomerId || '',
      razorpaySubscriptionId: currentOrg.razorpaySubscriptionId || '',
      stripeCustomerId: currentOrg.stripeCustomerId || '',
      stripeSubscriptionId: currentOrg.stripeSubscriptionId || '',
    });
    setFeatureDraft({ ...(currentOrg.featureOverrides || {}) });
  }, [currentOrg]);

  const featureKeys = useMemo(() => {
    const fromOrg = Object.keys(currentOrg?.planFeatures || {});
    const fromLabels = Object.keys(featureLabels || {});
    return [...new Set([...fromOrg, ...fromLabels])].sort();
  }, [currentOrg, featureLabels]);

  const effectiveAccess = currentOrg?.entitlement?.effectiveAccess || [];

  const reload = () => dispatch(fetchPlatformOrganization(orgId));

  const handleSaveSubscription = async (e) => {
    e.preventDefault();
    setSavingSub(true);
    try {
      await dispatch(
        updatePlatformSubscription({
          orgId,
          payload: {
            subscriptionPlan: subscriptionForm.subscriptionPlan,
            subscriptionStatus: subscriptionForm.subscriptionStatus,
            maxEmployees: Number(subscriptionForm.maxEmployees),
            subscriptionEndDate: subscriptionForm.subscriptionEndDate || null,
            trialEndDate: subscriptionForm.trialEndDate || null,
            isTrialActive: subscriptionForm.isTrialActive,
          },
        })
      ).unwrap();
      toast.success('Subscription updated');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Failed to update subscription');
      if (msg) toast.error(msg);
    } finally {
      setSavingSub(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await dispatch(
        updatePlatformOrganization({
          orgId,
          payload: {
            name: profileForm.name,
            email: profileForm.email,
            phone: profileForm.phone,
            website: profileForm.website,
            domain: profileForm.domain,
            verificationStatus: profileForm.verificationStatus,
            platformNotes: profileForm.platformNotes,
            platformTags: profileForm.platformTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            paymentMethod: profileForm.paymentMethod,
            razorpayCustomerId: profileForm.razorpayCustomerId || null,
            razorpaySubscriptionId: profileForm.razorpaySubscriptionId || null,
            stripeCustomerId: profileForm.stripeCustomerId || null,
            stripeSubscriptionId: profileForm.stripeSubscriptionId || null,
          },
        })
      ).unwrap();
      toast.success('Organization profile updated');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Failed to update organization');
      if (msg) toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveFeatures = async () => {
    setSavingFeatures(true);
    try {
      const features = {};
      featureKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(featureDraft, key)) {
          features[key] = featureDraft[key];
        }
      });
      await dispatch(updatePlatformFeatures({ orgId, features, replace: true })).unwrap();
      toast.success('Feature overrides saved');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Failed to update features');
      if (msg) toast.error(msg);
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleToggleActive = async () => {
    if (!currentOrg) return;
    setTogglingActive(true);
    try {
      await dispatch(
        updatePlatformOrganization({
          orgId,
          payload: { isActive: !currentOrg.isActive },
        })
      ).unwrap();
      toast.success(currentOrg.isActive ? 'Organization suspended' : 'Organization activated');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Failed to update organization');
      if (msg) toast.error(msg);
    } finally {
      setTogglingActive(false);
    }
  };

  if (!currentOrg && loading) {
    return <div className="py-16 text-center text-slate-500">Loading organization…</div>;
  }

  if (!currentOrg) {
    return (
      <div className="space-y-4">
        <Link to="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-600">
          <FiArrowLeft /> Back
        </Link>
        <p className="text-slate-600">Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-600">
            <FiArrowLeft /> Organizations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{currentOrg.name}</h1>
          <p className="text-sm text-slate-600">{currentOrg.email}</p>
          {currentOrg.deletedAt && (
            <p className="mt-1 text-sm font-medium text-rose-700">Soft-deleted</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await dispatch(extendPlatformTrial({ orgId, days: 14 })).unwrap();
                toast.success('Trial extended 14 days');
                await reload();
              } catch (err) {
                const msg = sessionMsg(err, 'Failed to extend trial');
                if (msg) toast.error(msg);
              }
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Extend trial +14d
          </button>
          <button
            type="button"
            disabled={togglingActive}
            onClick={handleToggleActive}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              currentOrg.isActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {currentOrg.isActive ? 'Suspend' : 'Activate'}
          </button>
          {currentOrg.deletedAt ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await dispatch(restorePlatformOrganization(orgId)).unwrap();
                  toast.success('Organization restored');
                  await reload();
                } catch (err) {
                  const msg = sessionMsg(err, 'Restore failed');
                  if (msg) toast.error(msg);
                }
              }}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Soft-delete this organization?')) return;
                try {
                  await dispatch(softDeletePlatformOrganization(orgId)).unwrap();
                  toast.success('Organization soft-deleted');
                  await reload();
                } catch (err) {
                  const msg = sessionMsg(err, 'Delete failed');
                  if (msg) toast.error(msg);
                }
              }}
              className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700"
            >
              Soft delete
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <form onSubmit={handleSaveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Profile & verification</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.domain} onChange={(e) => setProfileForm((f) => ({ ...f, domain: e.target.value }))} placeholder="Domain" />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={profileForm.website} onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))} placeholder="Website" />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.verificationStatus} onChange={(e) => setProfileForm((f) => ({ ...f, verificationStatus: e.target.value }))}>
              <option value="pending">Pending verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.platformTags} onChange={(e) => setProfileForm((f) => ({ ...f, platformTags: e.target.value }))} placeholder="Tags (comma-separated)" />
            <textarea rows={3} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={profileForm.platformNotes} onChange={(e) => setProfileForm((f) => ({ ...f, platformNotes: e.target.value }))} placeholder="Internal notes" />
          </div>
          <button type="submit" disabled={savingProfile} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}

      {tab === 'subscription' && (
        <form onSubmit={handleSaveSubscription} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <select value={subscriptionForm.subscriptionPlan} onChange={(e) => {
              const planId = e.target.value;
              const plan = plans.find((p) => p.id === planId);
              setSubscriptionForm((f) => ({ ...f, subscriptionPlan: planId, maxEmployees: plan?.maxEmployees || f.maxEmployees }));
            }} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {(plans.length ? plans : [{ id: 'free' }, { id: 'basic' }, { id: 'premium' }, { id: 'enterprise' }]).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name || plan.id}</option>
              ))}
            </select>
            <select value={subscriptionForm.subscriptionStatus} onChange={(e) => setSubscriptionForm((f) => ({ ...f, subscriptionStatus: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="past_due">Past due</option>
            </select>
            <input type="number" min={1} value={subscriptionForm.maxEmployees} onChange={(e) => setSubscriptionForm((f) => ({ ...f, maxEmployees: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={subscriptionForm.isTrialActive} onChange={(e) => setSubscriptionForm((f) => ({ ...f, isTrialActive: e.target.checked }))} /> Trial active</label>
            <input type="date" value={subscriptionForm.subscriptionEndDate} onChange={(e) => setSubscriptionForm((f) => ({ ...f, subscriptionEndDate: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={subscriptionForm.trialEndDate} onChange={(e) => setSubscriptionForm((f) => ({ ...f, trialEndDate: e.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={savingSub} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {savingSub ? 'Saving…' : 'Save subscription'}
          </button>
        </form>
      )}

      {tab === 'features' && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Feature overrides</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {featureKeys.map((key) => {
              const override = featureDraft[key];
              const selectValue = typeof override === 'boolean' ? String(override) : 'default';
              return (
                <div key={key} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm font-medium">{featureLabels[key] || key}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Plan: {currentOrg.planFeatures?.[key] ? 'On' : 'Off'} · Effective:{' '}
                    {currentOrg.effectiveFeatures?.[key] ? 'On' : 'Off'}
                  </div>
                  <select
                    value={selectValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFeatureDraft((prev) => {
                        const next = { ...prev };
                        if (val === 'default') delete next[key];
                        else next[key] = val === 'true';
                        return next;
                      });
                    }}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="default">Plan default</option>
                    <option value="true">Force on</option>
                    <option value="false">Force off</option>
                  </select>
                </div>
              );
            })}
          </div>
          <button type="button" disabled={savingFeatures} onClick={handleSaveFeatures} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {savingFeatures ? 'Saving…' : 'Save feature overrides'}
          </button>
        </div>
      )}

      {tab === 'access' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Effective Access</h2>
            <p className="mt-1 text-sm text-slate-600">
              Plan → override → effective. Explains why a module is on or off for this tenant.
            </p>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Override</th>
                <th className="px-4 py-3">Effective</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {effectiveAccess.map((row) => (
                <tr key={row.featureKey}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="px-4 py-3">{row.planEnabled ? 'On' : 'Off'}</td>
                  <td className="px-4 py-3">
                    {row.hasOverride ? (row.overrideEnabled ? 'Force on' : 'Force off') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={row.effective ? 'text-emerald-700' : 'text-rose-700'}>
                      {row.effective ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                </tr>
              ))}
              {!effectiveAccess.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No entitlement data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'usage' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <FiUsers /> Employee usage
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {usage?.employees?.current ?? 0} / {usage?.employees?.max || '∞'}
          </div>
          {currentOrg.entitlement?.limits && (
            <p className="mt-2 text-sm text-slate-500">
              Plan seat default: {currentOrg.entitlement.limits.planMaxEmployees ?? '—'}
              {currentOrg.entitlement.limitOverrides?.maxEmployees != null &&
                ` · Override: ${currentOrg.entitlement.limitOverrides.maxEmployees}`}
            </p>
          )}
        </div>
      )}

      {tab === 'admins' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Admins</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {(admins || []).map((admin) => (
              <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium text-slate-900">{admin.name}</div>
                  <div className="text-xs text-slate-500">
                    {admin.email} · {(admin.roles || []).join(', ') || admin.role}
                    {!admin.isActive && ' · inactive'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={async () => {
                      const password = window.prompt(`New password for ${admin.email}`);
                      if (!password) return;
                      try {
                        await dispatch(updatePlatformAdmin({ orgId, userId: admin.id, payload: { password } })).unwrap();
                        toast.success('Password reset');
                      } catch (err) {
                        const msg = sessionMsg(err, 'Password reset failed');
                        if (msg) toast.error(msg);
                      }
                    }}
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={async () => {
                      try {
                        await dispatch(
                          updatePlatformAdmin({
                            orgId,
                            userId: admin.id,
                            payload: { isActive: !admin.isActive },
                          })
                        ).unwrap();
                        toast.success('Admin updated');
                        await reload();
                      } catch (err) {
                        const msg = sessionMsg(err, 'Update failed');
                        if (msg) toast.error(msg);
                      }
                    }}
                  >
                    {admin.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
            {!admins?.length && <p className="py-4 text-sm text-slate-500">No admin users</p>}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Audit log</h2>
          <div className="mt-3 divide-y divide-slate-100 text-sm">
            {(auditLogs || []).map((log) => (
              <div key={log.id} className="py-3">
                <div className="font-medium text-slate-900">{log.summary || log.action}</div>
                <div className="text-xs text-slate-500">
                  {log.operatorEmail} · {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                </div>
              </div>
            ))}
            {!auditLogs?.length && <p className="py-4 text-slate-500">No audit events yet</p>}
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <form onSubmit={handleSaveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
          <p className="text-sm text-slate-600">Payment method and Razorpay IDs for ops reference.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.paymentMethod} onChange={(e) => setProfileForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="none">No payment method</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe (legacy)</option>
              <option value="paypal">PayPal</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={profileForm.razorpayCustomerId} onChange={(e) => setProfileForm((f) => ({ ...f, razorpayCustomerId: e.target.value }))} placeholder="Razorpay customer ID" />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" value={profileForm.razorpaySubscriptionId} onChange={(e) => setProfileForm((f) => ({ ...f, razorpaySubscriptionId: e.target.value }))} placeholder="Razorpay subscription ID" />
          </div>
          <button type="submit" disabled={savingProfile} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {savingProfile ? 'Saving…' : 'Save billing fields'}
          </button>
        </form>
      )}
    </div>
  );
};

export default OrganizationDetail;
