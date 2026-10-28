import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  fetchPlatformOrganizations,
  fetchPlatformDashboard,
} from '../context/platformSlice';
import {
  FiSearch,
  FiRefreshCw,
  FiDownload,
  FiPlus,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiEye,
  FiSettings,
  FiUsers,
  FiDollarSign,
  FiActivity,
} from 'react-icons/fi';
import { PLATFORM_ENDPOINT } from '../utils/constant';
import axios from '../utils/axios';
import '../styles/platformOrganizations.css';

const DEFAULT_FILTERS = {
  search: '',
  plan: '',
  status: '',
  isActive: '',
  verificationStatus: '',
  tag: '',
  includeDeleted: '',
  onlyDeleted: '',
  page: 1,
  limit: 20,
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

const formatMrr = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
};

const daysLeft = (trialEndDate) => {
  if (!trialEndDate) return null;
  const end = new Date(trialEndDate);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const planPill = (plan) => {
  const p = String(plan || '').toLowerCase();
  if (p.includes('enterprise')) return { bg: 'rgba(42, 107, 82, 0.18)', color: '#1F523E' };
  if (p.includes('premium') || p.includes('scale') || p.includes('pro')) {
    return { bg: 'rgba(28, 202, 155, 0.22)', color: '#1F523E' };
  }
  if (p.includes('basic') || p.includes('growth')) return { bg: 'rgba(15, 45, 38, 0.1)', color: '#0F2D26' };
  return { bg: '#D9DEDC', color: '#0F2D26' };
};

const statusPill = (org) => {
  const s = String(org.subscriptionStatus || '').toLowerCase();
  const deleted = Boolean(org.deletedAt);
  if (deleted) {
    return { label: 'Soft-Deleted', bg: 'rgba(120,136,130,0.18)', color: '#4B5753', dot: '#788882' };
  }
  if (org.isActive === false || s === 'cancelled' || s === 'expired') {
    return {
      label: s === 'expired' ? 'Expired' : s === 'cancelled' ? 'Cancelled' : 'Suspended',
      bg: 'rgba(198,40,40,0.12)',
      color: '#C62828',
      dot: '#C62828',
    };
  }
  if (s === 'trial') {
    const left = daysLeft(org.trialEndDate);
    const label = left != null && left >= 0 ? `Trial (${left}d left)` : 'Trial';
    return { label, bg: 'rgba(255,127,80,0.15)', color: '#9B4122', dot: '#FF7F50', urgent: left != null && left <= 3 };
  }
  if (s === 'past_due') return { label: 'Past due', bg: 'rgba(229,152,25,0.15)', color: '#8A5700', dot: '#E59819' };
  return { label: 'Active', bg: 'rgba(28,202,155,0.15)', color: '#1F523E', dot: '#1CCA9B' };
};

const verificationDisplay = (status) => {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'verified') return { label: 'Verified', color: '#2A6B52', Icon: FiCheckCircle };
  if (s === 'rejected') return { label: 'Rejected', color: '#C62828', Icon: FiAlertCircle };
  return { label: 'Review Pending', color: '#9B4122', Icon: FiClock };
};

const OrganizationsList = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { organizations, pagination, loading, plans, dashboardStats: stats } = useSelector(
    (state) => state.platform
  );
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });

  const load = async (next = filters) => {
    try {
      const params = {
        page: next.page,
        limit: next.limit || 20,
      };
      if (next.search.trim()) params.search = next.search.trim();
      if (next.plan) params.plan = next.plan;
      if (next.status) params.status = next.status;
      if (next.isActive) params.isActive = next.isActive;
      if (next.verificationStatus) params.verificationStatus = next.verificationStatus;
      if (next.tag) params.tag = next.tag;
      if (next.onlyDeleted === 'true') params.onlyDeleted = 'true';
      else if (next.includeDeleted === 'true') params.includeDeleted = 'true';
      await dispatch(fetchPlatformOrganizations(params)).unwrap();
    } catch (err) {
      const message = typeof err === 'string' ? err : 'Failed to load organizations';
      if (/session expired|log in again|not authenticated|unauthorized/i.test(message)) {
        return;
      }
      toast.error(message);
    }
  };

  useEffect(() => {
    dispatch(fetchPlatformDashboard());
    const next = {
      ...DEFAULT_FILTERS,
      search: searchParams.get('search') || '',
      plan: searchParams.get('plan') || '',
      status: searchParams.get('status') || '',
      verificationStatus: searchParams.get('verificationStatus') || '',
      tag: searchParams.get('tag') || '',
    };
    setFilters(next);
    load(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  };

  const clearFilters = () => {
    const next = { ...DEFAULT_FILTERS };
    setFilters(next);
    load(next);
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${PLATFORM_ENDPOINT}/organizations/export`, {
        responseType: 'blob',
        withCredentials: true,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'organizations.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const planOptions =
    Array.isArray(plans) && plans.length
      ? plans.map((p) => p.id || p.planId).filter(Boolean)
      : ['free', 'basic', 'premium', 'enterprise'];

  const tagOptions = useMemo(() => {
    const set = new Set();
    (organizations || []).forEach((o) => {
      (o.platformTags || []).forEach((t) => set.add(t));
    });
    return [...set].sort();
  }, [organizations]);

  const total = pagination?.total ?? 0;
  const page = pagination?.page || 1;
  const limit = pagination?.limit || filters.limit || 20;
  const totalPages = pagination?.totalPages || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const totalOrgs = stats?.totalOrgs ?? 0;
  const activeOrgs = stats?.activeOrgs ?? 0;
  const fleetPct = totalOrgs > 0 ? ((activeOrgs / totalOrgs) * 100).toFixed(1) : '0.0';
  const pendingVerification = stats?.pendingVerification ?? 0;

  return (
    <div className="platform-orgs flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: '#0F2D26' }}>
              Client Organizations
            </h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
            >
              ({Number(total).toLocaleString()})
            </span>
          </div>
          <p className="mt-1 text-sm sm:text-[15px]" style={{ color: '#5A7A70' }}>
            Manage tenant provisioning, feature quotas, employee seat limits, and lifecycle states.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 shrink-0 sm:w-auto">
          <button type="button" onClick={handleExport} className="po-btn po-btn-secondary flex-1 sm:flex-none">
            <FiDownload className="h-4 w-4" aria-hidden />
            Export
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="po-btn po-btn-secondary flex-1 sm:flex-none"
            disabled={loading}
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
          <Link
            to="/platform/organizations/new"
            className="po-btn po-btn-primary w-full sm:w-auto sm:flex-none"
          >
            <FiPlus className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Create org</span>
            <span className="hidden sm:inline">Create Organization</span>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <form onSubmit={onSubmit} className="po-card flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="relative xl:col-span-4">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: '#788882' }}
              aria-hidden
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Filter by org name, slug, domain, or ID…"
              className="po-input po-input-search"
            />
          </div>
          <div className="xl:col-span-2">
            <select
              value={filters.plan}
              onChange={(e) => setFilters((f) => ({ ...f, plan: e.target.value }))}
              className="po-select"
            >
              <option value="">All Plans</option>
              {planOptions.map((id) => (
                <option key={id} value={id}>
                  {String(id).charAt(0).toUpperCase() + String(id).slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="po-select"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="past_due">Past due</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <select
              value={filters.verificationStatus}
              onChange={(e) => setFilters((f) => ({ ...f, verificationStatus: e.target.value }))}
              className="po-select"
            >
              <option value="">Verification</option>
              <option value="pending">Pending Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <select
              value={filters.tag}
              onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
              className="po-select"
            >
              <option value="">All Tags</option>
              {tagOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: '#F5FAF9', color: '#5A7A70' }}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#2A6B52]"
                checked={filters.includeDeleted === 'true'}
                onChange={(e) => {
                  const next = {
                    ...filters,
                    includeDeleted: e.target.checked ? 'true' : '',
                    onlyDeleted: e.target.checked ? filters.onlyDeleted : '',
                    page: 1,
                  };
                  setFilters(next);
                  load(next);
                }}
              />
              Include Soft-deleted
            </label>
            <label
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: '#F5FAF9', color: '#5A7A70' }}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#2A6B52]"
                checked={filters.onlyDeleted === 'true'}
                onChange={(e) => {
                  const next = {
                    ...filters,
                    onlyDeleted: e.target.checked ? 'true' : '',
                    includeDeleted: e.target.checked ? '' : filters.includeDeleted,
                    page: 1,
                  };
                  setFilters(next);
                  load(next);
                }}
              />
              Only Deleted
            </label>
            <span className="hidden text-xs sm:inline" style={{ color: '#788882' }}>
              Showing active fleet filters
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold hover:underline"
              style={{ color: '#2A6B52' }}
            >
              Clear Filters
            </button>
            <button type="submit" className="po-btn po-btn-primary" style={{ height: '2rem', fontSize: '0.75rem' }}>
              Apply
            </button>
          </div>
        </div>
      </form>

      {/* KPI cards — real dashboard stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="po-card flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Fleet Health
            </span>
            <FiActivity className="h-4 w-4" style={{ color: '#2A6B52' }} aria-hidden />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: '#0F2D26' }}>
              {fleetPct}%
            </div>
            <div className="mt-1 text-xs font-semibold" style={{ color: '#2A6B52' }}>
              Active &amp; Healthy
            </div>
          </div>
          <div className="po-bar-track mt-3">
            <div className="po-bar-fill" style={{ width: `${Math.min(100, Number(fleetPct) || 0)}%` }} />
          </div>
        </div>

        <div className="po-card flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Active Tenants
            </span>
            <FiUsers className="h-4 w-4" style={{ color: '#0F2D26' }} aria-hidden />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: '#0F2D26' }}>
              {Number(activeOrgs).toLocaleString()}
            </span>
            <span className="text-xs" style={{ color: '#788882' }}>
              / {Number(totalOrgs).toLocaleString()} total
            </span>
          </div>
          <div className="po-bar-track mt-3">
            <div
              className="po-bar-fill"
              style={{
                width: `${totalOrgs > 0 ? Math.min(100, (activeOrgs / totalOrgs) * 100) : 0}%`,
                backgroundColor: '#0F2D26',
              }}
            />
          </div>
        </div>

        <div className="po-card flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Pending Review
            </span>
            <FiClock className="h-4 w-4" style={{ color: '#FF7F50' }} aria-hidden />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight" style={{ color: '#0F2D26' }}>
              {Number(pendingVerification).toLocaleString()}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#9B4122' }}>
              Requires SuperAdmin
            </span>
          </div>
          <div className="po-bar-track mt-3">
            <div
              className="po-bar-fill"
              style={{
                width: `${totalOrgs > 0 ? Math.min(100, (pendingVerification / totalOrgs) * 100) : 0}%`,
                backgroundColor: '#FF7F50',
              }}
            />
          </div>
        </div>

        <div className="po-card flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: '#5A7A70' }}>
              Estimated MRR
            </span>
            <FiDollarSign className="h-4 w-4" style={{ color: '#1CCA9B' }} aria-hidden />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: '#0F2D26' }}>
              {formatMrr(stats?.estimatedMrr)}
            </div>
            <div className="mt-1 text-xs" style={{ color: '#788882' }}>
              Active / past_due × plan price
            </div>
          </div>
          <div className="po-bar-track mt-3">
            <div className="po-bar-fill" style={{ width: '78%', backgroundColor: '#1CCA9B' }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="po-surface overflow-hidden">
        <div className="po-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization &amp; Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Seat Limit</th>
                <th>Verification</th>
                <th>Tags</th>
                <th>Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#5A7A70' }}>
                    {loading ? 'Loading…' : 'No organizations found'}
                  </td>
                </tr>
              )}
              {organizations.map((org) => {
                const planStyle = planPill(org.subscriptionPlan);
                const status = statusPill(org);
                const verification = verificationDisplay(org.verificationStatus);
                const VerificationIcon = verification.Icon;
                const tags = Array.isArray(org.platformTags) ? org.platformTags.slice(0, 3) : [];
                const seatCap = org.maxEmployees != null ? Number(org.maxEmployees).toLocaleString() : '—';
                const isDeleted = Boolean(org.deletedAt);
                const rowBg = status.urgent
                  ? 'rgba(255, 127, 80, 0.08)'
                  : isDeleted
                    ? 'rgba(120, 136, 130, 0.08)'
                    : undefined;

                return (
                  <tr key={org.id} style={{ background: rowBg, opacity: isDeleted ? 0.72 : 1 }}>
                    <td>
                      <Link
                        to={`/platform/organizations/${org.id}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                          style={{ backgroundColor: '#ECF0EE', color: '#2A6B52' }}
                        >
                          {orgInitials(org.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold" style={{ color: '#0F2D26' }}>
                            {org.name}
                          </div>
                          <div className="truncate font-mono text-[11px]" style={{ color: '#788882' }}>
                            {org.domain || org.email || '—'}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <span
                        className="po-pill capitalize"
                        style={{ backgroundColor: planStyle.bg, color: planStyle.color }}
                      >
                        {org.subscriptionPlan || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="po-pill" style={{ backgroundColor: status.bg, color: status.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <div className="flex w-32 flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold" style={{ color: '#0F2D26' }}>
                            {seatCap}
                          </span>
                          <span style={{ color: '#788882' }}>cap</span>
                        </div>
                        <div className="po-bar-track">
                          <div
                            className="po-bar-fill"
                            style={{
                              width: '70%',
                              backgroundColor: status.urgent ? '#FF7F50' : '#2A6B52',
                              opacity: 0.55,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className="inline-flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: verification.color }}
                      >
                        <VerificationIcon className="h-3.5 w-3.5" aria-hidden />
                        {verification.label}
                      </div>
                    </td>
                    <td>
                      <div className="flex max-w-[11rem] flex-wrap gap-1">
                        {tags.length === 0 && (
                          <span className="text-xs" style={{ color: '#788882' }}>
                            —
                          </span>
                        )}
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: '#ECF0EE', color: '#5A7A70' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm" style={{ color: '#5A7A70' }}>
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Link
                          to={`/platform/organizations/${org.id}`}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[#ECF0EE]"
                          style={{ color: '#2A6B52' }}
                          title="Manage"
                        >
                          <FiSettings className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/platform/organizations/${org.id}`}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[#ECF0EE]"
                          style={{ color: '#5A7A70' }}
                          title="View"
                        >
                          <FiEye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: '#D1DCD8' }}
        >
          <span className="text-sm" style={{ color: '#788882' }}>
            Showing {from}-{to} of {Number(total).toLocaleString()} organizations
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs" style={{ color: '#5A7A70' }}>
              Rows per page
              <select
                value={filters.limit}
                onChange={(e) => {
                  const next = { ...filters, limit: Number(e.target.value) || 20, page: 1 };
                  setFilters(next);
                  load(next);
                }}
                className="po-select"
                style={{ width: 'auto', height: '2rem' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const next = { ...filters, page: page - 1 };
                  setFilters(next);
                  load(next);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
              >
                Previous
              </button>
              <span
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                style={{ backgroundColor: '#2A6B52' }}
              >
                {page}
              </span>
              <span className="text-xs" style={{ color: '#788882' }}>
                / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = { ...filters, page: page + 1 };
                  setFilters(next);
                  load(next);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationsList;
