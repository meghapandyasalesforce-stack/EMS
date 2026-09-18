import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchPlatformAuditLogs } from '../context/platformSlice';

const AuditLogsPage = () => {
  const dispatch = useDispatch();
  const { globalAuditLogs, globalAuditPagination } = useSelector((state) => state.platform);
  const [organizationId, setOrganizationId] = useState('');
  const [page, setPage] = useState(1);

  const load = (nextPage = page) => {
    const params = { page: nextPage, limit: 50 };
    if (organizationId.trim()) params.organizationId = organizationId.trim();
    return dispatch(fetchPlatformAuditLogs(params))
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load audit logs';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cross-tenant platform operator actions (subscription, features, org lifecycle).
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load(1);
        }}
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="Filter by organization ID"
          className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Org</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(globalAuditLogs || []).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{log.summary || log.action}</div>
                  <div className="text-xs text-slate-400">{log.entityType}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{log.operatorEmail || '—'}</td>
                <td className="px-4 py-3">
                  {log.organizationId ? (
                    <Link
                      to={`/platform/organizations/${log.organizationId}`}
                      className="font-mono text-xs underline"
                    >
                      {String(log.organizationId).slice(-8)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!globalAuditLogs?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No audit events
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {globalAuditPagination?.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {globalAuditPagination.page} of {globalAuditPagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                load(next);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= globalAuditPagination.totalPages}
              onClick={() => {
                const next = page + 1;
                setPage(next);
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

export default AuditLogsPage;
