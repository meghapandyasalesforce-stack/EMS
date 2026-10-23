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
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiEdit2,
  FiGrid,
  FiLayers,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import '../styles/platformOrgDetail.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiGrid },
  { id: 'features', label: 'Features', icon: FiLayers },
  { id: 'subscription', label: 'Subscription', icon: FiCreditCard },
  { id: 'access', label: 'Access', icon: FiShield },
  { id: 'usage', label: 'Usage', icon: FiActivity },
  { id: 'admins', label: 'Admins', icon: FiUsers },
  { id: 'audit', label: 'Audit', icon: FiClock },
  { id: 'billing', label: 'Billing', icon: FiCreditCard },
  { id: 'danger', label: 'Danger', icon: FiAlertTriangle, danger: true },
];

const PAYMENT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank' },
];

const formatPlanPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return `$${n.toLocaleString()}/mo`;
};

const sessionMsg = (err, fallback) => {
  const message = typeof err === 'string' ? err : fallback;
  if (/session expired|log in again|not authenticated|unauthorized/i.test(message)) return null;
  return message;
};

const orgInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const planLabel = (plan) => {
  const p = String(plan || 'free');
  return p.charAt(0).toUpperCase() + p.slice(1);
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

  const seatCurrent = usage?.employees?.current ?? 0;
  const seatMax = usage?.employees?.max ?? currentOrg?.maxEmployees ?? null;
  const seatPct =
    seatMax && Number(seatMax) > 0
      ? Math.min(100, Math.round((Number(seatCurrent) / Number(seatMax)) * 1000) / 10)
      : 0;

  const overrideCount = useMemo(
    () => Object.keys(currentOrg?.featureOverrides || {}).length,
    [currentOrg]
  );

  const enabledFeatureCount = useMemo(() => {
    const eff = currentOrg?.effectiveFeatures || {};
    return Object.values(eff).filter(Boolean).length;
  }, [currentOrg]);

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

  const handleExtendTrial = async () => {
    try {
      await dispatch(extendPlatformTrial({ orgId, days: 14 })).unwrap();
      toast.success('Trial extended 14 days');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Failed to extend trial');
      if (msg) toast.error(msg);
    }
  };

  const handleSoftDelete = async () => {
    if (!window.confirm('Soft-delete this organization?')) return;
    try {
      await dispatch(softDeletePlatformOrganization(orgId)).unwrap();
      toast.success('Organization soft-deleted');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Delete failed');
      if (msg) toast.error(msg);
    }
  };

  const handleRestore = async () => {
    try {
      await dispatch(restorePlatformOrganization(orgId)).unwrap();
      toast.success('Organization restored');
      await reload();
    } catch (err) {
      const msg = sessionMsg(err, 'Restore failed');
      if (msg) toast.error(msg);
    }
  };

  if (!currentOrg && loading) {
    return (
      <div className="platform-org-detail">
        <div className="od-empty">Loading organization…</div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="platform-org-detail space-y-4">
        <Link to="/platform/organizations" className="od-link-btn">
          ← Back to organizations
        </Link>
        <p className="od-empty">Organization not found.</p>
      </div>
    );
  }

  const domainLabel = currentOrg.domain || currentOrg.email || orgId;

  return (
    <div className="platform-org-detail">
      <nav aria-label="Breadcrumbs" className="od-crumb">
        <Link to="/platform/organizations">Organizations</Link>
        <span className="od-crumb-sep" aria-hidden>
          /
        </span>
        <span style={{ color: '#788882', fontWeight: 600 }}>{domainLabel}</span>
        <span className="od-crumb-sep" aria-hidden>
          /
        </span>
        <span className="od-crumb-current">{tab === 'danger' ? 'Danger' : tab}</span>
      </nav>

      <div className="od-header">
        <div className="od-identity">
          <div className="od-avatar" aria-hidden>
            {orgInitials(currentOrg.name)}
          </div>
          <div>
            <h1 className="od-title">
              {currentOrg.name}
              {currentOrg.verificationStatus === 'verified' && (
                <FiCheckCircle className="od-title-check h-5 w-5" aria-label="Verified" />
              )}
            </h1>
            <p className="od-sub">{currentOrg.email || 'No email on file'}</p>
            <div className="od-badges">
              {currentOrg.deletedAt ? (
                <span className="od-pill od-pill-danger">Soft-deleted</span>
              ) : currentOrg.isActive ? (
                <span className="od-pill od-pill-ok">Active Tenant</span>
              ) : (
                <span className="od-pill od-pill-warn">Suspended</span>
              )}
              <span className="od-pill od-pill-plan">{planLabel(currentOrg.subscriptionPlan)} Plan</span>
              <span className="od-pill od-pill-muted">
                {String(currentOrg.subscriptionStatus || 'trial').replace(/_/g, ' ')}
              </span>
              {currentOrg.isTrialActive && (
                <span className="od-pill od-pill-warn">Trial active</span>
              )}
            </div>
          </div>
        </div>

        <div className="od-header-actions">
          <button type="button" className="od-btn od-btn-secondary" onClick={() => setTab('overview')}>
            <FiEdit2 className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
          <button
            type="button"
            className="od-btn od-btn-secondary"
            onClick={() => setTab('subscription')}
          >
            Change subscription
          </button>
          <button type="button" className="od-btn od-btn-warn" onClick={handleExtendTrial}>
            Extend trial +14d
          </button>
        </div>
      </div>

      <div className="od-tabs-wrap">
        <div className="od-tabs" role="tablist">
          {TABS.map((t) => {
            const Icon = t.icon;
            let count = null;
            if (t.id === 'features') count = `${enabledFeatureCount}/${overrideCount}`;
            if (t.id === 'admins') count = String(admins?.length || 0);
            if (t.id === 'audit') count = String(auditLogs?.length || 0);
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`od-tab ${tab === t.id ? 'is-active' : ''} ${t.danger ? 'od-tab-danger' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
                {count != null && <span className="od-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="od-grid-2">
            <section className="od-card">
              <div className="od-card-head">
                <div>
                  <h2 className="od-card-title">Contract lifecycle</h2>
                  <p className="od-card-sub">
                    {planLabel(currentOrg.subscriptionPlan)} subscription ·{' '}
                    {String(currentOrg.subscriptionStatus || '—').replace(/_/g, ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  className="od-btn od-btn-secondary od-btn-sm"
                  onClick={() => setTab('subscription')}
                >
                  Manage
                </button>
              </div>
              <div className="od-stat-row">
                <div className="od-stat">
                  <div className="od-stat-label">Plan</div>
                  <div className="od-stat-value">{planLabel(currentOrg.subscriptionPlan)}</div>
                </div>
                <div className="od-stat">
                  <div className="od-stat-label">Seats</div>
                  <div className="od-stat-value">
                    {seatMax != null ? Number(seatMax).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="od-stat">
                  <div className="od-stat-label">Renewal / end</div>
                  <div className="od-stat-value" style={{ fontSize: '0.95rem' }}>
                    {formatDate(currentOrg.subscriptionEndDate || currentOrg.trialEndDate)}
                  </div>
                </div>
              </div>
            </section>

            <section className="od-card">
              <div className="od-card-head">
                <div>
                  <h2 className="od-card-title">Capacity utilization</h2>
                  <p className="od-card-sub">Quotas for this tenant</p>
                </div>
                {seatPct >= 90 && <span className="od-pill od-pill-warn">Peak alert</span>}
              </div>
              <div className="od-meter">
                <div className="od-meter-top">
                  <span className="od-meter-label">Employee seats</span>
                  <span className="od-meter-val">
                    {Number(seatCurrent).toLocaleString()}
                    {seatMax != null ? ` / ${Number(seatMax).toLocaleString()}` : ' / ∞'}
                    {seatMax != null ? ` · ${seatPct}%` : ''}
                  </span>
                </div>
                <div className="od-meter-track">
                  <div
                    className={`od-meter-fill ${seatPct >= 90 ? 'is-high' : ''}`}
                    style={{ width: seatMax != null ? `${seatPct}%` : '0%' }}
                  />
                </div>
              </div>
              {currentOrg.entitlement?.limits && (
                <p className="od-card-sub" style={{ marginTop: '0.75rem' }}>
                  Plan seat default: {currentOrg.entitlement.limits.planMaxEmployees ?? '—'}
                  {currentOrg.entitlement.limitOverrides?.maxEmployees != null &&
                    ` · Override: ${currentOrg.entitlement.limitOverrides.maxEmployees}`}
                </p>
              )}
            </section>
          </div>

          <div className="od-grid-meta">
            <section className="od-card">
              <h2 className="od-card-title" style={{ marginBottom: '1rem' }}>
                Metadata & routing
              </h2>
              <div className="od-meta-list">
                <div className="od-meta-item">
                  <label>Domain</label>
                  <div className="od-mono">{currentOrg.domain || '—'}</div>
                </div>
                <div className="od-meta-item">
                  <label>Website</label>
                  <div>{currentOrg.website || '—'}</div>
                </div>
                <div className="od-meta-item">
                  <label>Phone</label>
                  <div>{currentOrg.phone || '—'}</div>
                </div>
                <div className="od-meta-item">
                  <label>Verification</label>
                  <div>{currentOrg.verificationStatus || 'pending'}</div>
                </div>
                <div className="od-meta-item">
                  <label>Tags</label>
                  <div>
                    {(currentOrg.platformTags || []).length
                      ? currentOrg.platformTags.join(', ')
                      : '—'}
                  </div>
                </div>
              </div>
            </section>

            <section className="od-card">
              <div className="od-card-head">
                <div>
                  <h2 className="od-card-title">Feature entitlements</h2>
                  <p className="od-card-sub">
                    {enabledFeatureCount} enabled · {overrideCount} override
                    {overrideCount === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  className="od-btn od-btn-secondary od-btn-sm"
                  onClick={() => setTab('features')}
                >
                  Manage
                </button>
              </div>
              <div className="od-feat-grid">
                {featureKeys.slice(0, 8).map((key) => {
                  const on = !!currentOrg.effectiveFeatures?.[key];
                  const hasOverride = Object.prototype.hasOwnProperty.call(
                    currentOrg.featureOverrides || {},
                    key
                  );
                  return (
                    <div key={key} className={`od-feat ${hasOverride ? 'is-override' : ''}`}>
                      <div className="od-feat-left">
                        <div className="od-feat-icon">
                          <FiLayers className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <div>
                          <div className="od-feat-name">{featureLabels[key] || key}</div>
                          <div className="od-feat-hint">
                            Plan: {currentOrg.planFeatures?.[key] ? 'On' : 'Off'}
                            {hasOverride ? ' · Override' : ''}
                          </div>
                        </div>
                      </div>
                      <label className="od-switch" title="View only — edit in Features tab">
                        <input type="checkbox" checked={on} disabled readOnly />
                        <span />
                      </label>
                    </div>
                  );
                })}
                {!featureKeys.length && <div className="od-empty">No feature data</div>}
              </div>
            </section>
          </div>

          <section className="od-card">
            <div className="od-card-head">
              <div>
                <h2 className="od-card-title">
                  Assigned tenant administrators ({admins?.length || 0})
                </h2>
                <p className="od-card-sub">Primary owners and org admins</p>
              </div>
              <button
                type="button"
                className="od-btn od-btn-secondary od-btn-sm"
                onClick={() => setTab('admins')}
              >
                View all
              </button>
            </div>
            <div className="od-table-wrap">
              <table className="od-table">
                <thead>
                  <tr>
                    <th>Administrator</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(admins || []).slice(0, 5).map((admin) => (
                    <tr key={admin.id}>
                      <td>
                        <div className="od-admin">
                          <div className="od-admin-av">{orgInitials(admin.name)}</div>
                          <div>
                            <div className="od-admin-name">{admin.name}</div>
                            <div className="od-admin-email">{admin.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{(admin.roles || []).join(', ') || admin.role || '—'}</td>
                      <td>
                        <span
                          className={`od-pill ${admin.isActive ? 'od-pill-ok' : 'od-pill-muted'}`}
                        >
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="od-link-btn"
                          onClick={async () => {
                            const password = window.prompt(`New password for ${admin.email}`);
                            if (!password) return;
                            try {
                              await dispatch(
                                updatePlatformAdmin({
                                  orgId,
                                  userId: admin.id,
                                  payload: { password },
                                })
                              ).unwrap();
                              toast.success('Password reset');
                            } catch (err) {
                              const msg = sessionMsg(err, 'Password reset failed');
                              if (msg) toast.error(msg);
                            }
                          }}
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!admins?.length && (
                    <tr>
                      <td colSpan={4} className="od-empty">
                        No admin users
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <form onSubmit={handleSaveProfile} className="od-panel">
            <div className="od-panel-head">
              <div className="od-panel-head-main">
                <div className="od-panel-icon">
                  <FiEdit2 className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="od-card-title">Edit profile</h2>
                  <p className="od-card-sub">Update tenant identity and internal notes</p>
                </div>
              </div>
            </div>
            <div className="od-panel-body">
              <div className="od-form-grid">
                <div>
                  <label className="od-label" htmlFor="od-name">
                    Organization name
                  </label>
                  <input
                    id="od-name"
                    className="od-input"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="od-label" htmlFor="od-email">
                    Email
                  </label>
                  <input
                    id="od-email"
                    className="od-input"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="od-label" htmlFor="od-phone">
                    Phone
                  </label>
                  <input
                    id="od-phone"
                    className="od-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="od-label" htmlFor="od-domain">
                    Domain
                  </label>
                  <input
                    id="od-domain"
                    className="od-input"
                    value={profileForm.domain}
                    onChange={(e) => setProfileForm((f) => ({ ...f, domain: e.target.value }))}
                  />
                </div>
                <div className="od-span-2">
                  <label className="od-label" htmlFor="od-website">
                    Website
                  </label>
                  <input
                    id="od-website"
                    className="od-input"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="od-label" htmlFor="od-verify">
                    Verification
                  </label>
                  <select
                    id="od-verify"
                    className="od-select"
                    value={profileForm.verificationStatus}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, verificationStatus: e.target.value }))
                    }
                  >
                    <option value="pending">Pending verification</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="od-label" htmlFor="od-tags">
                    Tags
                  </label>
                  <input
                    id="od-tags"
                    className="od-input"
                    value={profileForm.platformTags}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, platformTags: e.target.value }))
                    }
                    placeholder="Comma-separated"
                  />
                </div>
                <div className="od-span-2">
                  <label className="od-label" htmlFor="od-notes">
                    Internal notes
                  </label>
                  <textarea
                    id="od-notes"
                    className="od-textarea"
                    rows={3}
                    value={profileForm.platformNotes}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, platformNotes: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="od-panel-foot">
              <button type="submit" disabled={savingProfile} className="od-btn od-btn-primary">
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'subscription' && (
        <form onSubmit={handleSaveSubscription} className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiCreditCard className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Subscription</h2>
                <p className="od-card-sub">Choose a plan, status, seats, and trial dates</p>
              </div>
            </div>
          </div>
          <div className="od-panel-body">
            <div className="od-label" style={{ marginBottom: '0.55rem' }}>
              Plan
            </div>
            <div className="od-plan-grid">
              {(plans.length
                ? plans
                : [
                    { id: 'free', name: 'Free', price: 0, maxEmployees: 10 },
                    { id: 'basic', name: 'Basic', price: 49, maxEmployees: 50 },
                    { id: 'premium', name: 'Premium', price: 149, maxEmployees: 200 },
                    { id: 'enterprise', name: 'Enterprise', price: 499, maxEmployees: 1000 },
                  ]
              ).map((plan) => {
                const selected = subscriptionForm.subscriptionPlan === plan.id;
                return (
                  <label
                    key={plan.id}
                    className={`od-plan-card ${selected ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="subscriptionPlan"
                      value={plan.id}
                      checked={selected}
                      onChange={() => {
                        setSubscriptionForm((f) => ({
                          ...f,
                          subscriptionPlan: plan.id,
                          maxEmployees: plan?.maxEmployees || f.maxEmployees,
                        }));
                      }}
                    />
                    <span className="od-plan-card-name">{plan.name || plan.id}</span>
                    <span className="od-plan-card-meta">
                      {formatPlanPrice(plan.price)}
                      {plan.maxEmployees != null
                        ? ` · ${Number(plan.maxEmployees).toLocaleString()} seats`
                        : ''}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="od-form-grid">
              <div>
                <label className="od-label">Status</label>
                <select
                  value={subscriptionForm.subscriptionStatus}
                  onChange={(e) =>
                    setSubscriptionForm((f) => ({ ...f, subscriptionStatus: e.target.value }))
                  }
                  className="od-select"
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past due</option>
                </select>
              </div>
              <div>
                <label className="od-label">Max employees</label>
                <input
                  type="number"
                  min={1}
                  value={subscriptionForm.maxEmployees}
                  onChange={(e) =>
                    setSubscriptionForm((f) => ({ ...f, maxEmployees: e.target.value }))
                  }
                  className="od-input"
                />
              </div>
              <div>
                <label className="od-label">Subscription end</label>
                <input
                  type="date"
                  value={subscriptionForm.subscriptionEndDate}
                  onChange={(e) =>
                    setSubscriptionForm((f) => ({ ...f, subscriptionEndDate: e.target.value }))
                  }
                  className="od-input"
                />
              </div>
              <div>
                <label className="od-label">Trial end</label>
                <input
                  type="date"
                  value={subscriptionForm.trialEndDate}
                  onChange={(e) =>
                    setSubscriptionForm((f) => ({ ...f, trialEndDate: e.target.value }))
                  }
                  className="od-input"
                />
              </div>
              <div className="od-span-2">
                <div className="od-toggle-row">
                  <span>Trial active</span>
                  <label className="od-switch">
                    <input
                      type="checkbox"
                      checked={subscriptionForm.isTrialActive}
                      onChange={(e) =>
                        setSubscriptionForm((f) => ({ ...f, isTrialActive: e.target.checked }))
                      }
                    />
                    <span />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="od-panel-foot">
            <button type="submit" disabled={savingSub} className="od-btn od-btn-primary">
              {savingSub ? 'Saving…' : 'Save subscription'}
            </button>
            <button type="button" className="od-btn od-btn-warn" onClick={handleExtendTrial}>
              Extend trial +14d
            </button>
          </div>
        </form>
      )}

      {tab === 'features' && (
        <div className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiLayers className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Feature modules & overrides</h2>
                <p className="od-card-sub">
                  {enabledFeatureCount} enabled · {overrideCount} override
                  {overrideCount === 1 ? '' : 's'} · Force on/off or keep plan default
                </p>
              </div>
            </div>
          </div>
          <div className="od-panel-body">
            <div className="od-feat-grid">
              {featureKeys.map((key) => {
                const override = featureDraft[key];
                const selectValue = typeof override === 'boolean' ? String(override) : 'default';
                const hasOverride = typeof override === 'boolean';
                const setOverride = (val) => {
                  setFeatureDraft((prev) => {
                    const next = { ...prev };
                    if (val === 'default') delete next[key];
                    else next[key] = val === 'true';
                    return next;
                  });
                };
                return (
                  <div key={key} className={`od-feat-edit ${hasOverride ? 'is-override' : ''}`}>
                    <div className="od-feat-edit-top">
                      <div className="od-feat-icon">
                        <FiLayers className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="od-feat-name">{featureLabels[key] || key}</div>
                        <div className="od-feat-hint">
                          Plan:{' '}
                          <span className={currentOrg.planFeatures?.[key] ? 'od-chip-on' : 'od-chip-off'}>
                            {currentOrg.planFeatures?.[key] ? 'On' : 'Off'}
                          </span>{' '}
                          · Effective:{' '}
                          <span
                            className={
                              currentOrg.effectiveFeatures?.[key] ? 'od-chip-on' : 'od-chip-off'
                            }
                          >
                            {currentOrg.effectiveFeatures?.[key] ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="od-seg" role="group" aria-label={`Override ${key}`}>
                      <label className={selectValue === 'default' ? 'is-default' : ''}>
                        <input
                          type="radio"
                          name={`feat-${key}`}
                          checked={selectValue === 'default'}
                          onChange={() => setOverride('default')}
                        />
                        Default
                      </label>
                      <label className={selectValue === 'true' ? 'is-on' : ''}>
                        <input
                          type="radio"
                          name={`feat-${key}`}
                          checked={selectValue === 'true'}
                          onChange={() => setOverride('true')}
                        />
                        Force on
                      </label>
                      <label className={selectValue === 'false' ? 'is-off' : ''}>
                        <input
                          type="radio"
                          name={`feat-${key}`}
                          checked={selectValue === 'false'}
                          onChange={() => setOverride('false')}
                        />
                        Force off
                      </label>
                    </div>
                  </div>
                );
              })}
              {!featureKeys.length && <div className="od-empty">No feature data</div>}
            </div>
          </div>
          <div className="od-panel-foot">
            <button
              type="button"
              disabled={savingFeatures}
              onClick={handleSaveFeatures}
              className="od-btn od-btn-primary"
            >
              {savingFeatures ? 'Saving…' : 'Save feature overrides'}
            </button>
          </div>
        </div>
      )}

      {tab === 'access' && (
        <div className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiShield className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Effective access</h2>
                <p className="od-card-sub">
                  Plan → override → effective. Why each module is on or off.
                </p>
              </div>
            </div>
          </div>
          <div className="od-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="od-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Plan</th>
                  <th>Override</th>
                  <th>Effective</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {effectiveAccess.map((row) => (
                  <tr key={row.featureKey}>
                    <td style={{ fontWeight: 700 }}>{row.label}</td>
                    <td>
                      <span className={row.planEnabled ? 'od-chip-on' : 'od-chip-off'}>
                        {row.planEnabled ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td>
                      {row.hasOverride ? (
                        <span className={row.overrideEnabled ? 'od-chip-on' : 'od-chip-off'}>
                          {row.overrideEnabled ? 'Force on' : 'Force off'}
                        </span>
                      ) : (
                        <span className="od-chip-neutral">—</span>
                      )}
                    </td>
                    <td>
                      <span className={row.effective ? 'od-chip-on' : 'od-chip-off'}>
                        {row.effective ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td style={{ color: '#5a7a70' }}>{row.reason}</td>
                  </tr>
                ))}
                {!effectiveAccess.length && (
                  <tr>
                    <td colSpan={5} className="od-empty">
                      No entitlement data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'usage' && (
        <div className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiActivity className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Usage</h2>
                <p className="od-card-sub">Live seat consumption for this tenant</p>
              </div>
            </div>
            {seatPct >= 90 && <span className="od-pill od-pill-warn">Peak alert</span>}
          </div>
          <div className="od-panel-body">
            <div className="od-usage-hero">
              <div className="od-usage-big">
                <div className="od-usage-big-num">
                  {Number(seatCurrent).toLocaleString()}
                  <span style={{ fontSize: '1.15rem', color: '#5a7a70', fontWeight: 700 }}>
                    {seatMax != null ? ` / ${Number(seatMax).toLocaleString()}` : ' / ∞'}
                  </span>
                </div>
                <div className="od-usage-big-label">Employee seats in use</div>
                <div className="od-meter" style={{ marginTop: '1rem' }}>
                  <div className="od-meter-track" style={{ height: '0.55rem' }}>
                    <div
                      className={`od-meter-fill ${seatPct >= 90 ? 'is-high' : ''}`}
                      style={{ width: seatMax != null ? `${seatPct}%` : '0%' }}
                    />
                  </div>
                  <div className="od-meter-val" style={{ marginTop: '0.45rem' }}>
                    {seatMax != null ? `${seatPct}% of capacity` : 'No seat cap set'}
                  </div>
                </div>
              </div>
              <div className="od-stat-row" style={{ gridTemplateColumns: '1fr' }}>
                <div className="od-stat">
                  <div className="od-stat-label">Plan seat default</div>
                  <div className="od-stat-value">
                    {currentOrg.entitlement?.limits?.planMaxEmployees ?? '—'}
                  </div>
                </div>
                <div className="od-stat">
                  <div className="od-stat-label">Seat override</div>
                  <div className="od-stat-value">
                    {currentOrg.entitlement?.limitOverrides?.maxEmployees != null
                      ? currentOrg.entitlement.limitOverrides.maxEmployees
                      : 'None'}
                  </div>
                </div>
                <div className="od-stat">
                  <div className="od-stat-label">Current plan</div>
                  <div className="od-stat-value">{planLabel(currentOrg.subscriptionPlan)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'admins' && (
        <div className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiUsers className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Admins ({admins?.length || 0})</h2>
                <p className="od-card-sub">Reset passwords or activate / deactivate users</p>
              </div>
            </div>
          </div>
          <div className="od-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="od-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(admins || []).map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      <div className="od-admin">
                        <div className="od-admin-av">{orgInitials(admin.name)}</div>
                        <div>
                          <div className="od-admin-name">{admin.name}</div>
                          <div className="od-admin-email">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="od-chip-neutral">
                        {(admin.roles || []).join(', ') || admin.role || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`od-pill ${admin.isActive ? 'od-pill-ok' : 'od-pill-muted'}`}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="od-link-btn"
                          onClick={async () => {
                            const password = window.prompt(`New password for ${admin.email}`);
                            if (!password) return;
                            try {
                              await dispatch(
                                updatePlatformAdmin({
                                  orgId,
                                  userId: admin.id,
                                  payload: { password },
                                })
                              ).unwrap();
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
                          className="od-link-btn"
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
                    </td>
                  </tr>
                ))}
                {!admins?.length && (
                  <tr>
                    <td colSpan={4} className="od-empty">
                      No admin users
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiClock className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Platform audit</h2>
                <p className="od-card-sub">
                  {auditLogs?.length || 0} recent event
                  {(auditLogs?.length || 0) === 1 ? '' : 's'} for this tenant
                </p>
              </div>
            </div>
          </div>
          <div className="od-panel-body">
            <div className="od-audit-list">
              {(auditLogs || []).map((log) => (
                <div key={log.id} className="od-audit-item">
                  <div className="od-audit-dot">
                    <FiClock className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <div>
                    <div className="od-audit-title">{log.summary || log.action}</div>
                    <div className="od-audit-meta">
                      {log.operatorEmail || 'System'} ·{' '}
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              ))}
              {!auditLogs?.length && <div className="od-empty">No audit events yet</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'billing' && (
        <form onSubmit={handleSaveProfile} className="od-panel">
          <div className="od-panel-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon">
                <FiCreditCard className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-card-title">Billing</h2>
                <p className="od-card-sub">Payment method and gateway IDs for ops reference</p>
              </div>
            </div>
          </div>
          <div className="od-panel-body">
            <div className="od-label" style={{ marginBottom: '0.55rem' }}>
              Payment method
            </div>
            <div className="od-pay-grid">
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = profileForm.paymentMethod === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`od-pay-card ${selected ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.value}
                      checked={selected}
                      onChange={() =>
                        setProfileForm((f) => ({ ...f, paymentMethod: opt.value }))
                      }
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {profileForm.paymentMethod === 'razorpay' && (
              <div className="od-form-grid">
                <div>
                  <label className="od-label">Razorpay customer ID</label>
                  <input
                    className="od-input"
                    value={profileForm.razorpayCustomerId}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, razorpayCustomerId: e.target.value }))
                    }
                    placeholder="cust_…"
                  />
                </div>
                <div>
                  <label className="od-label">Razorpay subscription ID</label>
                  <input
                    className="od-input"
                    value={profileForm.razorpaySubscriptionId}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, razorpaySubscriptionId: e.target.value }))
                    }
                    placeholder="sub_…"
                  />
                </div>
              </div>
            )}

            {profileForm.paymentMethod === 'stripe' && (
              <div className="od-form-grid">
                <div>
                  <label className="od-label">Stripe customer ID</label>
                  <input
                    className="od-input"
                    value={profileForm.stripeCustomerId}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, stripeCustomerId: e.target.value }))
                    }
                    placeholder="cus_…"
                  />
                </div>
                <div>
                  <label className="od-label">Stripe subscription ID</label>
                  <input
                    className="od-input"
                    value={profileForm.stripeSubscriptionId}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, stripeSubscriptionId: e.target.value }))
                    }
                    placeholder="sub_…"
                  />
                </div>
              </div>
            )}

            {(profileForm.paymentMethod === 'none' ||
              profileForm.paymentMethod === 'paypal' ||
              profileForm.paymentMethod === 'bank_transfer') && (
              <div className="od-stat" style={{ marginTop: '0.15rem' }}>
                <div className="od-stat-label">Gateway IDs</div>
                <div className="od-card-sub" style={{ marginTop: '0.35rem', lineHeight: 1.45 }}>
                  {profileForm.paymentMethod === 'none' &&
                    'No payment gateway selected. Choose Razorpay or Stripe to enter customer / subscription IDs.'}
                  {profileForm.paymentMethod === 'paypal' &&
                    'PayPal does not use Razorpay or Stripe IDs. Save this method as-is for ops reference.'}
                  {profileForm.paymentMethod === 'bank_transfer' &&
                    'Bank transfer does not use Razorpay or Stripe IDs. Save this method as-is for ops reference.'}
                </div>
              </div>
            )}
          </div>
          <div className="od-panel-foot">
            <button type="submit" disabled={savingProfile} className="od-btn od-btn-primary">
              {savingProfile ? 'Saving…' : 'Save billing fields'}
            </button>
          </div>
        </form>
      )}

      {tab === 'danger' && (
        <section className="od-danger">
          <div className="od-danger-head">
            <div className="od-panel-head-main">
              <div className="od-panel-icon is-danger">
                <FiAlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="od-danger-title">Danger zone</h2>
                <p className="od-card-sub" style={{ color: '#9b4122' }}>
                  Irreversible or high-impact tenant actions
                </p>
              </div>
            </div>
            <span className="od-danger-badge">Platform operator</span>
          </div>
          <div className="od-danger-grid">
            <div className="od-danger-card">
              <h4>Extend trial</h4>
              <p>Add 14 days to the current trial window without changing the plan.</p>
              <button type="button" className="od-btn od-btn-warn" onClick={handleExtendTrial}>
                Extend trial +14d
              </button>
            </div>
            <div className="od-danger-card">
              <h4>{currentOrg.isActive ? 'Suspend tenant access' : 'Activate tenant'}</h4>
              <p>
                {currentOrg.isActive
                  ? 'Blocks login for this organization until reactivated.'
                  : 'Restore access for a previously suspended organization.'}
              </p>
              <button
                type="button"
                disabled={togglingActive}
                onClick={handleToggleActive}
                className={`od-btn ${currentOrg.isActive ? 'od-btn-danger-outline' : 'od-btn-primary'}`}
              >
                {togglingActive
                  ? 'Working…'
                  : currentOrg.isActive
                    ? 'Suspend organization'
                    : 'Activate organization'}
              </button>
            </div>
            <div className="od-danger-card">
              <h4>{currentOrg.deletedAt ? 'Restore organization' : 'Soft-delete organization'}</h4>
              <p>
                {currentOrg.deletedAt
                  ? 'Undo a soft delete and bring the tenant back into the directory.'
                  : 'Marks the tenant deleted without permanently removing data.'}
              </p>
              {currentOrg.deletedAt ? (
                <button type="button" className="od-btn od-btn-primary" onClick={handleRestore}>
                  Restore organization
                </button>
              ) : (
                <button type="button" className="od-btn od-btn-danger" onClick={handleSoftDelete}>
                  Soft-delete organization
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default OrganizationDetail;
