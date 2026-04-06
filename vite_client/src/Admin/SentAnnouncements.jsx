import React, { useEffect, useState, useCallback } from 'react';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';
import { FiRefreshCw, FiSpeaker } from 'react-icons/fi';

/**
 * Lists broadcast announcements for the admin dashboard (your sends, or whole org).
 */
const SentAnnouncements = ({ refreshKey = 0 }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scopeOrg, setScopeOrg] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (scopeOrg) params.scope = 'organization';
      const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements`, { params });
      if (res.data?.success) {
        setItems(res.data.announcements || []);
        setPagination(res.data.pagination || { current: 1, pages: 1, total: 0 });
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, scopeOrg]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 w-full mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <FiSpeaker className="w-5 h-5 text-theme-secondary" style={{ color: 'var(--color-secondary)' }} />
            Announcement history
          </h2>
          <p className="text-xs text-gray-500">
            {scopeOrg ? 'All broadcast announcements in your organization' : 'Announcements you sent'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={scopeOrg}
              onChange={(e) => {
                setScopeOrg(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-theme-primary focus:ring-theme-secondary"
            />
            Show whole organization
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-50"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {loading && items.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No announcements yet{scopeOrg ? ' for this organization' : ' sent by you'}.
        </div>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto divide-y divide-gray-100">
          {items.map((row) => (
            <li key={row._id} className="pt-3 first:pt-0">
              <p className="text-gray-800 text-sm font-medium whitespace-pre-wrap">{row.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{new Date(row.createdAt).toLocaleString()}</span>
                {scopeOrg && row.sender && (
                  <span>
                    By {row.sender.name || row.sender.email || 'Admin'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Page {pagination.current} of {pagination.pages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentAnnouncements;
