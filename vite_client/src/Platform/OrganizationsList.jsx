import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchPlatformOrganizations } from '../context/platformSlice';
import { FiSearch, FiRefreshCw, FiDownload, FiPlus } from 'react-icons/fi';
import { PLATFORM_ENDPOINT } from '../utils/constant';
import axios from '../utils/axios';

const statusTone = (status) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'trial':
      return 'bg-sky-100 text-sky-800';
    case 'expired':
    case 'cancelled':
      return 'bg-rose-100 text-rose-800';
    case 'past_due':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const PRESETS = [
  { id: 'all', label: 'All', filters: { status: '', isActive: '', verificationStatus: '', onlyDeleted: '' } },
  { id: 'trial', label: 'Trials', filters: { status: 'trial', isActive: '', verificationStatus: '', onlyDeleted: '' } },
  { id: 'active', label: 'Active', filters: { status: 'active', isActive: 'true', verificationStatus: '', onlyDeleted: '' } },
  { id: 'suspended', label: 'Suspended', filters: { status: '', isActive: 'false', verificationStatus: '', onlyDeleted: '' } },
  { id: 'pending', label: 'Pending verification', filters: { status: '', isActive: '', verificationStatus: 'pending', onlyDeleted: '' } },
  { id: 'deleted', label: 'Deleted', filters: { status: '', isActive: '', verificationStatus: '', onlyDeleted: 'true' } },
];

const OrganizationsList = () => {
  const dispatch = useDispatch();
  const { organizations, pagination, loading } = useSelector((state) => state.platform);
  const [preset, setPreset] = useState('all');
  const [filters, setFilters] = useState({
    search: '',
    plan: '',
    status: '',
    isActive: '',
    verificationStatus: '',
    onlyDeleted: '',
    page: 1,
  });

  const load = async (next = filters) => {
    try {
      const params = {
        page: next.page,
        limit: 20,
      };
      if (next.search.trim()) params.search = next.search.trim();
      if (next.plan) params.plan = next.plan;
      if (next.status) params.status = next.status;
      if (next.isActive) params.isActive = next.isActive;
      if (next.verificationStatus) params.verificationStatus = next.verificationStatus;
      if (next.onlyDeleted === 'true') params.onlyDeleted = 'true';
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (id) => {
    const found = PRESETS.find((p) => p.id === id) || PRESETS[0];
    const next = {
      ...filters,
      ...found.filters,
      page: 1,
    };
    setPreset(id);
    setFilters(next);
    load(next);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setPreset('all');
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage tenant plans, subscription status, limits, and feature overrides.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/platform/organizations/new"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <FiPlus /> Create
          </Link>
          <button
            type="button"
            onClick={async () => {
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
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <FiDownload /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              preset === p.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Search
          </label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Name or email"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Plan
          </label>
          <select
            value={filters.plan}
            onChange={(e) => setFilters((f) => ({ ...f, plan: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past due</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Verification
          </label>
          <select
            value={filters.verificationStatus}
            onChange={(e) => setFilters((f) => ({ ...f, verificationStatus: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <select
            value={filters.isActive}
            onChange={(e) => setFilters((f) => ({ ...f, isActive: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Active / inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Employees cap</th>
              <th className="px-4 py-3">Org active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {organizations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {loading ? 'Loading…' : 'No organizations found'}
                </td>
              </tr>
            )}
            {organizations.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{org.name}</div>
                  <div className="text-xs text-slate-500">{org.email}</div>
                </td>
                <td className="px-4 py-3 capitalize">{org.subscriptionPlan}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusTone(
                      org.subscriptionStatus
                    )}`}
                  >
                    {org.subscriptionStatus}
                  </span>
                </td>
                <td className="px-4 py-3">{org.maxEmployees}</td>
                <td className="px-4 py-3">
                  {org.isActive ? (
                    <span className="text-emerald-700">Yes</span>
                  ) : (
                    <span className="text-rose-700">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/platform/organizations/${org.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => {
                const next = { ...filters, page: pagination.page - 1 };
                setFilters(next);
                load(next);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                const next = { ...filters, page: pagination.page + 1 };
                setFilters(next);
                load(next);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsList;
