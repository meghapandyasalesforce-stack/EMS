import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  FiArrowRight,
  FiPlus,
  FiDownload,
  FiTrendingUp,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiShield,
  FiDollarSign,
  FiGrid,
} from 'react-icons/fi';
import { fetchPlatformDashboard } from '../context/platformSlice';
import '../styles/platformDashboard.css';

const PLAN_COLORS = ['#2A6B52', '#1CCA9B', '#0F2D26', '#5A7A70', '#FF7F50', '#788882'];

const formatMrr = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
};

const formatRelativeDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

const orgInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const statusPill = (status, isActive) => {
  const s = String(status || '').toLowerCase();
  if (!isActive || s === 'suspended' || s === 'cancelled') {
    return {
      label: s === 'cancelled' ? 'Cancelled' : 'Suspended',
      bg: 'rgba(198, 40, 40, 0.12)',
      color: '#C62828',
      dot: '#C62828',
    };
  }
  if (s === 'trial') {
    return {
      label: 'Trial',
      bg: 'rgba(255, 127, 80, 0.15)',
      color: '#9B4122',
      dot: '#FF7F50',
    };
  }
  if (s === 'past_due') {
    return {
      label: 'Past due',
      bg: 'rgba(229, 152, 25, 0.15)',
      color: '#8A5700',
      dot: '#E59819',
    };
  }
  return {
    label: 'Active',
    bg: 'rgba(28, 202, 155, 0.15)',
    color: '#1F523E',
    dot: '#1CCA9B',
  };
};

const planPillStyle = (plan) => {
  const p = String(plan || '').toLowerCase();
  if (p.includes('enterprise')) return { bg: 'rgba(42, 107, 82, 0.12)', color: '#2A6B52' };
  if (p.includes('scale') || p.includes('pro')) return { bg: 'rgba(28, 202, 155, 0.18)', color: '#1F523E' };
  if (p.includes('starter') || p.includes('free')) return { bg: '#D9DEDC', color: '#0F2D26' };
  return { bg: 'rgba(15, 45, 38, 0.08)', color: '#0F2D26' };
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const { dashboardStats: stats, recentOrganizations } = useSelector((state) => state.platform);

  useEffect(() => {
    dispatch(fetchPlatformDashboard())
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load dashboard';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  }, [dispatch]);

  const totalOrgs = stats?.totalOrgs ?? 0;
  const activeOrgs = stats?.activeOrgs ?? 0;
  const trialOrgs = stats?.trialOrgs ?? 0;
  const trialsEndingSoon = stats?.trialsEndingSoon ?? 0;
  const pendingVerification = stats?.pendingVerification ?? 0;
  const suspendedOrgs = stats?.suspendedOrgs ?? 0;
  const activePct = totalOrgs > 0 ? ((activeOrgs / totalOrgs) * 100).toFixed(1) : '0.0';

  const planEntries = useMemo(() => {
    const counts = stats?.planCounts || {};
    const entries = Object.entries(counts);
    const sum = entries.reduce((acc, [, c]) => acc + Number(c || 0), 0) || 1;
    return entries.map(([plan, count], index) => ({
      plan,
      count: Number(count || 0),
      pct: (Number(count || 0) / sum) * 100,
      color: PLAN_COLORS[index % PLAN_COLORS.length],
    }));
  }, [stats?.planCounts]);

  return (
    <div className="platform-dashboard space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: '#2A6B52' }}
            >
              Executive Telemetry Hub
            </span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#1CCA9B' }} />
            <span className="text-[11px] font-medium" style={{ color: '#788882' }}>
              Live Feed
            </span>
          </div>
          <h1
            className="text-2xl font-extrabold tracking-tight sm:text-3xl"
            style={{ color: '#0F2D26' }}
          >
            Platform Overview &amp; Health
          </h1>
          <p className="mt-1 text-sm sm:text-[15px]" style={{ color: '#5A7A70' }}>
            Real-time telemetry and multi-tenant performance
            {stats?.totalOrgs != null ? ` across ${Number(stats.totalOrgs).toLocaleString()} organizations` : ''}.
          </p>
        </div>

        <div className="pd-header-actions">
          <Link
            to="/platform/organizations"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
          >
            <FiDownload className="h-4 w-4 shrink-0" aria-hidden />
            <span>Org directory</span>
          </Link>
          <Link
            to="/platform/organizations/new"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
            style={{ backgroundColor: '#2A6B52' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1F523E';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2A6B52';
            }}
          >
            <FiPlus className="h-4 w-4 shrink-0" aria-hidden />
            <span>Provision tenant</span>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="pd-kpi-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Link to="/platform/organizations" className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Total Organizations
            </span>
            <span
              className="shrink-0 rounded-lg p-1.5"
              style={{ backgroundColor: '#FFFFFF', color: '#2A6B52' }}
            >
              <FiGrid className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div>
            <div className="pd-kpi-value mt-2">
              {stats?.totalOrgs != null ? Number(stats.totalOrgs).toLocaleString() : '—'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="pd-pill"
                style={{ backgroundColor: 'rgba(28, 202, 155, 0.2)', color: '#1F523E' }}
              >
                <FiTrendingUp className="h-3 w-3" aria-hidden />
                Directory
              </span>
            </div>
          </div>
          <div className="pd-spark" aria-hidden>
            <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ color: '#1CCA9B' }}>
              <path
                d="M0,16 Q20,14 35,9 T70,11 T100,2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </Link>

        <div className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Active Tenants
            </span>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: '#1CCA9B' }} />
          </div>
          <div>
            <div className="pd-kpi-value mt-2">
              {stats?.activeOrgs != null ? Number(stats.activeOrgs).toLocaleString() : '—'}
            </div>
            <div className="mt-2">
              <span
                className="pd-pill"
                style={{ backgroundColor: 'rgba(28, 202, 155, 0.25)', color: '#1F523E' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#1CCA9B' }} />
                {activePct}% of total
              </span>
            </div>
          </div>
          <div className="pd-bar-track mt-2">
            <div
              className="pd-bar-fill"
              style={{ width: `${Math.min(100, Number(activePct) || 0)}%`, backgroundColor: '#2A6B52' }}
            />
          </div>
        </div>

        <div className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Trial Instances
            </span>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(255,127,80,0.2)', color: '#9B4122' }}>
              <FiClock className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div>
            <div className="pd-kpi-value mt-2">
              {stats?.trialOrgs != null ? Number(stats.trialOrgs).toLocaleString() : '—'}
            </div>
            <div className="mt-2">
              <span
                className="pd-pill"
                style={{ backgroundColor: 'rgba(255, 127, 80, 0.2)', color: '#9B4122' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#FF7F50' }} />
                {trialsEndingSoon} ending in 7 days
              </span>
            </div>
          </div>
          <div className="pd-bar-track mt-2">
            <div
              className="pd-bar-fill"
              style={{
                width: `${trialOrgs > 0 ? Math.min(100, (trialsEndingSoon / trialOrgs) * 100) : 0}%`,
                backgroundColor: '#FF7F50',
              }}
            />
          </div>
        </div>

        <div className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Pending Review
            </span>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(15,45,38,0.08)', color: '#0F2D26' }}>
              <FiShield className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div>
            <div className="pd-kpi-value mt-2">
              {stats?.pendingVerification != null
                ? Number(stats.pendingVerification).toLocaleString()
                : '—'}
            </div>
            <div className="mt-2">
              <span className="pd-pill" style={{ backgroundColor: '#D9DEDC', color: '#0F2D26' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#0F2D26' }} />
                Requires verification
              </span>
            </div>
          </div>
          <div className="pd-bar-track mt-2">
            <div
              className="pd-bar-fill"
              style={{
                width: `${totalOrgs > 0 ? Math.min(100, (pendingVerification / totalOrgs) * 100) : 0}%`,
                backgroundColor: '#0F2D26',
              }}
            />
          </div>
        </div>

        <div className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Suspended
            </span>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(198,40,40,0.12)', color: '#C62828' }}>
              <FiAlertTriangle className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div>
            <div className="pd-kpi-value mt-2" style={{ color: '#C62828' }}>
              {stats?.suspendedOrgs != null ? Number(stats.suspendedOrgs).toLocaleString() : '—'}
            </div>
            <div className="mt-2 text-xs font-medium" style={{ color: '#C62828' }}>
              Inactive / suspended tenants
            </div>
          </div>
          <div className="pd-bar-track mt-2">
            <div
              className="pd-bar-fill"
              style={{
                width: `${totalOrgs > 0 ? Math.min(100, (suspendedOrgs / totalOrgs) * 100) : 0}%`,
                backgroundColor: '#C62828',
              }}
            />
          </div>
        </div>

        <div className="pd-card flex min-h-[160px] flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Estimated MRR
            </span>
            <span className="rounded-lg p-1.5" style={{ backgroundColor: 'rgba(28,202,155,0.2)', color: '#1F523E' }}>
              <FiDollarSign className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div>
            <div className="pd-kpi-value mt-2">{formatMrr(stats?.estimatedMrr)}</div>
            <div className="mt-2 text-xs" style={{ color: '#788882' }}>
              Active / past_due × plan price
            </div>
          </div>
          <div className="pd-bar-track mt-2">
            <div className="pd-bar-fill" style={{ width: '84%', backgroundColor: '#2A6B52' }} />
          </div>
        </div>
      </div>

      {/* Expiring trials alert */}
      {trialsEndingSoon > 0 && (
        <div
          className="relative flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          style={{ backgroundColor: 'rgba(255, 127, 80, 0.14)', color: '#0F2D26' }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(255, 127, 80, 0.35)', color: '#9B4122' }}
            >
              <FiAlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold" style={{ color: '#9B4122' }}>
                Expiring trials · {trialsEndingSoon} tenant{trialsEndingSoon === 1 ? '' : 's'}
              </div>
              <p className="mt-1 text-sm leading-snug" style={{ color: '#5A7A70' }}>
                {trialsEndingSoon} trial organization{trialsEndingSoon === 1 ? '' : 's'} will reach trial end
                within the next 7 days. Review conversion status in the organization directory.
              </p>
            </div>
          </div>
          <Link
            to="/platform/organizations?status=trial"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm sm:w-auto"
            style={{ backgroundColor: '#FF7F50' }}
          >
            Review Expiring Trials
            <FiArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {/* Plan distribution */}
      {planEntries.length > 0 && (
        <div className="pd-card p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#0F2D26' }}>
                Per-Plan Tenant Distribution
              </h2>
              <p className="mt-0.5 text-sm" style={{ color: '#5A7A70' }}>
                License mix across commercial tiers.
              </p>
            </div>
            <span className="text-xs font-medium" style={{ color: '#788882' }}>
              Live counts
            </span>
          </div>

          <div className="mb-5 flex h-4 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#D9DEDC' }}>
            {planEntries.map(({ plan, pct, color, count }) =>
              count > 0 ? (
                <div
                  key={plan}
                  title={`${plan}: ${count} orgs`}
                  style={{ width: `${Math.max(pct, 0)}%`, backgroundColor: color }}
                  className="transition-opacity hover:opacity-90"
                />
              ) : null
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {planEntries.map(({ plan, count, color }) => (
              <Link
                key={plan}
                to={`/platform/organizations?plan=${encodeURIComponent(plan)}`}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-white"
                style={{ borderColor: '#D1DCD8', color: '#0F2D26' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-semibold capitalize">{plan}</span>
                <span style={{ color: '#788882' }}>{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent organizations */}
      <div className="pd-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F2D26' }}>
              Recent Organizations
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: '#5A7A70' }}>
              Latest tenants provisioned on the platform.
            </p>
          </div>
          <Link
            to="/platform/organizations"
            className="inline-flex items-center gap-1 text-sm font-bold hover:underline"
            style={{ color: '#2A6B52' }}
          >
            View All in Directory
            <FiArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="pd-table-wrap rounded-2xl border" style={{ borderColor: '#D1DCD8' }}>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(recentOrganizations || []).map((org) => {
                const pill = statusPill(org.subscriptionStatus, org.isActive !== false);
                const planStyle = planPillStyle(org.subscriptionPlan);
                return (
                  <tr key={org.id}>
                    <td>
                      <Link
                        to={`/platform/organizations/${org.id}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                          style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
                        >
                          {orgInitials(org.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold" style={{ color: '#0F2D26' }}>
                            {org.name}
                          </div>
                          <div className="truncate text-xs" style={{ color: '#788882' }}>
                            {org.domain || org.email || '—'}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span
                        className="pd-pill capitalize"
                        style={{ backgroundColor: planStyle.bg, color: planStyle.color }}
                      >
                        {org.subscriptionPlan || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="pd-pill" style={{ backgroundColor: pill.bg, color: pill.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
                        {pill.label}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm font-medium" style={{ color: '#0F2D26' }}>
                        {org.email || '—'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm" style={{ color: '#5A7A70' }}>
                      {formatRelativeDate(org.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!recentOrganizations?.length && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <FiCheckCircle className="h-8 w-8" style={{ color: '#788882' }} aria-hidden />
              <p className="text-sm" style={{ color: '#5A7A70' }}>
                No organizations yet. Provision your first tenant to get started.
              </p>
              <Link
                to="/platform/organizations/new"
                className="mt-1 text-sm font-bold hover:underline"
                style={{ color: '#2A6B52' }}
              >
                Create organization
              </Link>
            </div>
          )}
        </div>

        {!!recentOrganizations?.length && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm" style={{ color: '#788882' }}>
              Showing {recentOrganizations.length} recent
              {stats?.totalOrgs != null ? ` of ${Number(stats.totalOrgs).toLocaleString()} organizations` : ''}
            </span>
            <Link
              to="/platform/organizations"
              className="text-sm font-bold hover:underline"
              style={{ color: '#2A6B52' }}
            >
              Open full directory →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
