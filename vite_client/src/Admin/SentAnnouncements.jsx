import React, { useEffect, useState, useCallback } from 'react';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';
import {
  FiRefreshCw,
  FiSpeaker,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiClock,
  FiUser,
} from 'react-icons/fi';

/**
 * Lists broadcast announcements for the admin/manager dashboard (org-wide history).
 */
const SentAnnouncements = ({ refreshKey = 0 }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [receiptsById, setReceiptsById] = useState({});
  const [receiptsLoading, setReceiptsLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (mineOnly) params.scope = 'mine';
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
  }, [page, mineOnly]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const loadReceipts = async (announcementId) => {
    if (receiptsById[announcementId]) return;
    setReceiptsLoading(announcementId);
    try {
      const res = await axios.get(
        `${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements/${announcementId}/receipts`
      );
      if (res.data?.success) {
        setReceiptsById((prev) => ({
          ...prev,
          [announcementId]: res.data,
        }));
      }
    } catch {
      setReceiptsById((prev) => ({
        ...prev,
        [announcementId]: { error: true },
      }));
    } finally {
      setReceiptsLoading(null);
    }
  };

  const toggleReceipts = async (announcementId) => {
    if (expandedId === announcementId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(announcementId);
    await loadReceipts(announcementId);
  };

  const setScope = (nextMineOnly) => {
    setMineOnly(nextMineOnly);
    setPage(1);
    setExpandedId(null);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-secondary) 14%, white)', color: 'var(--color-secondary)' }}
            >
              <FiSpeaker className="h-4 w-4" />
            </span>
            Announcement history
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mineOnly
              ? 'Showing announcements you sent'
              : 'Showing all announcements in your organization'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setScope(false)}
              className={`rounded-lg px-3 py-1.5 transition ${
                !mineOnly
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All announcements
            </button>
            <button
              type="button"
              onClick={() => setScope(true)}
              className={`rounded-lg px-3 py-1.5 transition ${
                mineOnly
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sent by me
            </button>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <FiRefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            Loading announcements…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
            <FiSpeaker className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">No announcements yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {mineOnly
                ? 'You have not sent any announcements.'
                : 'Broadcasts sent from this page will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
            {items.map((row) => {
              const receipts = receiptsById[row._id];
              const isExpanded = expandedId === row._id;
              const senderName = row.sender?.name || row.sender?.email || null;
              const seenLabel =
                receipts && !receipts.error
                  ? `${receipts.seenCount} of ${receipts.audienceTotal} seen`
                  : 'View read status';

              return (
                <li
                  key={row._id}
                  className={`rounded-xl border transition ${
                    isExpanded
                      ? 'border-slate-300 bg-slate-50/80'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="p-4">
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                      {row.message}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <FiClock className="h-3.5 w-3.5 shrink-0" />
                        {new Date(row.createdAt).toLocaleString()}
                      </span>
                      {senderName && (
                        <span className="inline-flex items-center gap-1">
                          <FiUser className="h-3.5 w-3.5 shrink-0" />
                          {senderName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleReceipts(row._id)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                        style={
                          isExpanded
                            ? { borderColor: 'color-mix(in srgb, var(--color-secondary) 35%, white)', color: 'var(--color-secondary)' }
                            : undefined
                        }
                      >
                        <FiCheckCircle className="h-3.5 w-3.5" />
                        {seenLabel}
                        {isExpanded ? (
                          <FiChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <FiChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      {receiptsLoading === row._id ? (
                        <p className="py-4 text-center text-xs text-slate-500">Loading read status…</p>
                      ) : receipts?.error ? (
                        <p className="py-2 text-xs text-red-600">Failed to load read status</p>
                      ) : receipts ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                              <FiCheckCircle className="h-3.5 w-3.5" />
                              Seen ({receipts.seenCount})
                            </p>
                            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                              {(receipts.seen || []).length === 0 ? (
                                <li className="text-xs text-emerald-700/70">No one has seen this yet</li>
                              ) : (
                                receipts.seen.map((person) => (
                                  <li
                                    key={String(person._id)}
                                    className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-slate-700"
                                  >
                                    <span className="font-medium">{person.name}</span>
                                    {person.readAt && (
                                      <span className="text-slate-500">
                                        {new Date(person.readAt).toLocaleString()}
                                      </span>
                                    )}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>

                          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                              <FiClock className="h-3.5 w-3.5" />
                              Not seen ({receipts.notSeenCount})
                            </p>
                            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                              {(receipts.notSeen || []).length === 0 ? (
                                <li className="text-xs text-amber-800/70">Everyone has seen this</li>
                              ) : (
                                receipts.notSeen.map((person) => (
                                  <li key={String(person._id)} className="text-xs font-medium text-slate-700">
                                    {person.name}
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-xs text-slate-500">
            Page {pagination.current} of {pagination.pages}
            <span className="text-slate-400"> · {pagination.total} total</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SentAnnouncements;
