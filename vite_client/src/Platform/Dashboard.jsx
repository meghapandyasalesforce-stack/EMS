import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchPlatformDashboard } from '../context/platformSlice';

const StatCard = ({ label, value, hint, to }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
    {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    {to && (
      <Link to={to} className="mt-3 inline-block text-sm font-medium text-slate-900 underline">
        View
      </Link>
    )}
  </div>
);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-tenant snapshot of subscriptions, trials, and verification.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organizations" value={stats?.totalOrgs ?? '—'} to="/platform/organizations" />
        <StatCard label="Active" value={stats?.activeOrgs ?? '—'} />
        <StatCard label="On trial" value={stats?.trialOrgs ?? '—'} hint={`${stats?.trialsEndingSoon ?? 0} ending in 7 days`} />
        <StatCard label="Pending verification" value={stats?.pendingVerification ?? '—'} />
        <StatCard label="Suspended" value={stats?.suspendedOrgs ?? '—'} />
        <StatCard
          label="Est. MRR"
          value={stats?.estimatedMrr != null ? `$${stats.estimatedMrr}` : '—'}
          hint="Active/past_due × plan price"
        />
      </div>

      {stats?.planCounts && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Orgs by plan</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(stats.planCounts).map(([plan, count]) => (
              <Link
                key={plan}
                to={`/platform/organizations?plan=${plan}`}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="capitalize font-medium">{plan}</span>
                <span className="ml-2 text-slate-500">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent organizations</h2>
          <Link to="/platform/organizations" className="text-sm font-medium underline">
            All orgs
          </Link>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {(recentOrganizations || []).map((org) => (
            <Link
              key={org.id}
              to={`/platform/organizations/${org.id}`}
              className="flex items-center justify-between py-3 hover:bg-slate-50"
            >
              <div>
                <div className="font-medium text-slate-900">{org.name}</div>
                <div className="text-xs text-slate-500">{org.email}</div>
              </div>
              <div className="text-right text-sm capitalize text-slate-600">
                {org.subscriptionPlan} · {org.subscriptionStatus}
              </div>
            </Link>
          ))}
          {!recentOrganizations?.length && (
            <p className="py-6 text-center text-sm text-slate-500">No organizations yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
