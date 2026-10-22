import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';
import { toast } from 'react-toastify';
import {
  FiRefreshCw,
  FiSpeaker,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiSend,
  FiEdit2,
  FiSearch,
  FiEye,
  FiFileText,
  FiMoreVertical,
  FiX,
} from 'react-icons/fi';

const formatWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const titleFromRow = (row = {}) => {
  const titled = String(row.metadata?.title || '').replace(/\s+/g, ' ').trim();
  if (titled) return titled.length > 72 ? `${titled.slice(0, 72)}…` : titled;
  const cleaned = String(row.message || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled announcement';
  return cleaned.length > 72 ? `${cleaned.slice(0, 72)}…` : cleaned;
};

const previewFromRow = (row = {}) => {
  const cleaned = String(row.message || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (row.metadata?.title) {
    return cleaned.length > 110 ? `${cleaned.slice(0, 110)}…` : cleaned;
  }
  if (cleaned.length <= 72) return '';
  return cleaned.slice(0, 110) + (cleaned.length > 110 ? '…' : '');
};

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const statusMeta = (row) => {
  if (row.broadcastStatus === 'draft') return { cls: 'ann-ui__badge--draft', label: 'Draft' };
  if (row.broadcastStatus === 'scheduled') return { cls: 'ann-ui__badge--scheduled', label: 'Scheduled' };
  return { cls: 'ann-ui__badge--sent', label: 'Sent' };
};

const isImportantRow = (row = {}) =>
  row.priority === 'high' || row.metadata?.important === true || row.metadata?.priority === 'high';

const SentAnnouncements = ({ refreshKey = 0, onCountsChange, onEditDraft, onNew }) => {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ sent: 0, drafts: 0, scheduled: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [receiptsById, setReceiptsById] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [readModal, setReadModal] = useState(null); // { row, loading }
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10 };
      if (['sent', 'draft', 'scheduled'].includes(statusTab)) params.status = statusTab;
      if (searchApplied.trim()) params.q = searchApplied.trim();
      const res = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements`, { params });
      if (res.data?.success) {
        const payload = res.data.data || res.data;
        const list = payload.announcements || res.data.announcements || [];
        setItems(list);
        setPagination(payload.pagination || res.data.pagination || { current: 1, pages: 1, total: 0 });
        const nextCounts = payload.counts || res.data.counts || { sent: 0, drafts: 0, scheduled: 0, total: 0 };
        setCounts(nextCounts);
        onCountsChange?.(nextCounts);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusTab, searchApplied, onCountsChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchApplied(search);
      setPage(1);
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Prefetch read summaries for sent rows on the current page
  useEffect(() => {
    const sent = items.filter((r) => r.broadcastStatus !== 'draft' && r.broadcastStatus !== 'scheduled');
    sent.forEach(async (row) => {
      if (receiptsById[row._id]) return;
      try {
        const res = await axios.get(
          `${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements/${row._id}/receipts`
        );
        if (res.data?.success) {
          const data = res.data.data || res.data;
          setReceiptsById((prev) => (prev[row._id] ? prev : { ...prev, [row._id]: data }));
        }
      } catch {
        /* ignore prefetch errors */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when item ids change
  }, [items.map((i) => i._id).join(',')]);

  const openReadStatus = async (row) => {
    if (row.broadcastStatus === 'draft' || row.broadcastStatus === 'scheduled') {
      toast.info('Read status is available after the announcement is sent');
      return;
    }
    setReadModal({ row, loading: !receiptsById[row._id] });
    if (receiptsById[row._id]) return;
    try {
      const res = await axios.get(
        `${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements/${row._id}/receipts`
      );
      if (res.data?.success) {
        const data = res.data.data || res.data;
        setReceiptsById((prev) => ({ ...prev, [row._id]: data }));
        setReadModal({ row, loading: false });
      } else {
        setReadModal({ row, loading: false, error: true });
      }
    } catch {
      setReadModal({ row, loading: false, error: true });
    }
  };

  const handleDelete = async (row) => {
    setMenuId(null);
    if (!window.confirm('Delete this announcement? This cannot be undone.')) return;
    try {
      setBusyId(row._id);
      await axios.delete(`${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements/${row._id}`);
      toast.success('Announcement deleted');
      if (readModal?.row?._id === row._id) setReadModal(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (row) => {
    setMenuId(null);
    try {
      setBusyId(row._id);
      await axios.post(`${BOTH_NOTIFICATION_ENDPOINT}/sent-announcements/${row._id}/publish`);
      toast.success('Announcement sent');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Send failed');
    } finally {
      setBusyId(null);
    }
  };

  const rangeLabel = useMemo(() => {
    if (!pagination.total) return 'Showing 0 announcements';
    const start = (pagination.current - 1) * 10 + 1;
    const end = Math.min(pagination.current * 10, pagination.total);
    return `Showing ${start}–${end} of ${pagination.total} announcements`;
  }, [pagination]);

  const modalReceipts = readModal?.row ? receiptsById[readModal.row._id] : null;

  return (
    <section className="ann-ui__card ann-ui__board !mb-0">
      <div className="ann-ui__board-toolbar">
        <div className="ann-ui__search">
          <FiSearch className="ann-ui__search-icon" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements…"
            aria-label="Search announcements"
          />
        </div>
        <select className="ann-ui__select" defaultValue="all" aria-label="Audience filter" disabled>
          <option value="all">All audiences</option>
        </select>
        <div className="ann-ui__tabs ann-ui__tabs--status">
          {[
            { id: 'all', label: 'All', count: counts.total },
            { id: 'sent', label: 'Sent', count: counts.sent },
            { id: 'scheduled', label: 'Scheduled', count: counts.scheduled || 0 },
            { id: 'draft', label: 'Drafts', count: counts.drafts },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ann-ui__tab${statusTab === tab.id ? ' is-active' : ''}`}
              onClick={() => { setStatusTab(tab.id); setPage(1); }}
            >
              {tab.label}
              <span className="ann-ui__tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={load} disabled={loading} className="ann-ui__btn ann-ui__btn--ghost">
          <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Mobile cards */}
      <div className="ann-ui__mobile-list">
        {loading && items.length === 0 ? (
          <div className="ann-ui__table-empty">
            <FiRefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading announcements…
          </div>
        ) : items.length === 0 ? (
          <div className="ann-ui__table-empty">
            <FiSpeaker className="mx-auto mb-2 h-6 w-6 opacity-35" />
            <p className="font-semibold text-slate-800">No announcements found</p>
            {onNew ? (
              <button type="button" className="ann-ui__btn ann-ui__btn--primary mt-3" onClick={onNew}>
                New announcement
              </button>
            ) : null}
          </div>
        ) : (
          items.map((row) => {
            const badge = statusMeta(row);
            const author = row.sender?.name || row.sender?.email || '—';
            const isPending = row.broadcastStatus === 'draft' || row.broadcastStatus === 'scheduled';
            const receipts = receiptsById[row._id];
            const reachTotal = receipts
              ? (Number(receipts.seenCount) || 0) + (Number(receipts.notSeenCount) || 0)
              : null;
            const seenCount = receipts ? Number(receipts.seenCount) || 0 : null;
            const pct = reachTotal > 0 ? Math.round((seenCount / reachTotal) * 100) : 0;
            const when = row.broadcastStatus === 'scheduled' && row.scheduledFor
              ? row.scheduledFor
              : (row.createdAt || row.updatedAt);
            return (
              <article key={`m-${row._id}`} className="ann-ui__mobile-card">
                <div className="ann-ui__title-cell">
                  <span className={`ann-ui__row-icon ${isPending ? 'is-muted' : ''}`}>
                    {row.broadcastStatus === 'draft' ? <FiFileText /> : row.broadcastStatus === 'scheduled' ? <FiClock /> : <FiSpeaker />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="ann-ui__row-title-wrap">
                      <p className="ann-ui__row-title">{titleFromRow(row)}</p>
                      {isImportantRow(row) ? (
                        <span className="ann-ui__badge ann-ui__badge--important">Important</span>
                      ) : null}
                    </div>
                    {previewFromRow(row) ? (
                      <p className="ann-ui__row-preview">{previewFromRow(row)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`ann-ui__badge ${badge.cls}`}>{badge.label}</span>
                      <span className="ann-ui__pill">All employees</span>
                      <span className="ann-ui__date">{formatWhen(when)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{author}</p>
                    {!isPending ? (
                      <button
                        type="button"
                        className="ann-ui__reach-btn mt-2"
                        onClick={() => openReadStatus(row)}
                      >
                        <FiEye className="ann-ui__reach-eye" />
                        <span className="ann-ui__reach-frac">
                          {receipts ? `${seenCount} / ${reachTotal}` : '…'}
                        </span>
                        {receipts && reachTotal > 0 ? (
                          <span className="ann-ui__reach-pct">{pct}%</span>
                        ) : null}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="ann-ui__mobile-actions">
                  {!isPending ? (
                    <button type="button" className="ann-ui__btn ann-ui__btn--ghost !h-8" onClick={() => openReadStatus(row)}>
                      <FiEye /> Read
                    </button>
                  ) : (
                    <>
                      <button type="button" className="ann-ui__btn ann-ui__btn--ghost !h-8" onClick={() => onEditDraft?.(row)}>
                        <FiEdit2 /> Edit
                      </button>
                      <button type="button" className="ann-ui__btn ann-ui__btn--ghost !h-8" onClick={() => handlePublish(row)}>
                        <FiSend /> Send
                      </button>
                    </>
                  )}
                  <button type="button" className="ann-ui__btn ann-ui__btn--ghost !h-8 text-red-600" onClick={() => handleDelete(row)}>
                    <FiTrash2 />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="ann-ui__table-wrap ann-ui__table-wrap--desktop">
        <table className="ann-ui__table">
          <thead>
            <tr>
              <th>Title &amp; message</th>
              <th>Audience</th>
              <th>Sent / scheduled</th>
              <th>Read / reach</th>
              <th>Author</th>
              <th>Status</th>
              <th className="ann-ui__th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="ann-ui__table-empty">
                  <FiRefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading announcements…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="ann-ui__table-empty">
                  <FiSpeaker className="mx-auto mb-2 h-6 w-6 opacity-35" />
                  <p className="font-semibold text-slate-800">No announcements found</p>
                  <p className="mt-1 text-xs">Try another filter, or create a new announcement.</p>
                  {onNew ? (
                    <button type="button" className="ann-ui__btn ann-ui__btn--primary mt-3" onClick={onNew}>
                      New announcement
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const badge = statusMeta(row);
                const author = row.sender?.name || row.sender?.email || '—';
                const isPending = row.broadcastStatus === 'draft' || row.broadcastStatus === 'scheduled';
                const receipts = receiptsById[row._id];
                const reachTotal = receipts
                  ? (Number(receipts.seenCount) || 0) + (Number(receipts.notSeenCount) || 0)
                  : null;
                const seenCount = receipts ? Number(receipts.seenCount) || 0 : null;
                const pct = reachTotal > 0 ? Math.round((seenCount / reachTotal) * 100) : 0;
                const when = row.broadcastStatus === 'scheduled' && row.scheduledFor
                  ? row.scheduledFor
                  : (row.createdAt || row.updatedAt);

                return (
                  <tr key={row._id}>
                    <td>
                      <div className="ann-ui__title-cell">
                        <span className={`ann-ui__row-icon ${isPending ? 'is-muted' : ''}`}>
                          {row.broadcastStatus === 'draft' ? <FiFileText /> : row.broadcastStatus === 'scheduled' ? <FiClock /> : <FiSpeaker />}
                        </span>
                        <div className="min-w-0">
                          <div className="ann-ui__row-title-wrap">
                            <p className="ann-ui__row-title">{titleFromRow(row)}</p>
                            {isImportantRow(row) ? (
                              <span className="ann-ui__badge ann-ui__badge--important">Important</span>
                            ) : null}
                          </div>
                          {previewFromRow(row) ? (
                            <p className="ann-ui__row-preview">{previewFromRow(row)}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ann-ui__pill">All employees</span>
                    </td>
                    <td>
                      <p className="ann-ui__date">{formatWhen(when)}</p>
                    </td>
                    <td>
                      {isPending ? (
                        <span className="ann-ui__reach-muted">—</span>
                      ) : (
                        <button
                          type="button"
                          className="ann-ui__reach-btn"
                          onClick={() => openReadStatus(row)}
                          title="View read status"
                        >
                          <FiEye className="ann-ui__reach-eye" />
                          <span className="ann-ui__reach-frac">
                            {receipts ? `${seenCount} / ${reachTotal}` : '…'}
                          </span>
                          {receipts && reachTotal > 0 ? (
                            <span className="ann-ui__reach-pct">{pct}%</span>
                          ) : null}
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="ann-ui__author">
                        <span className="ann-ui__avatar">{initials(author)}</span>
                        <span className="ann-ui__author-name">{author}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`ann-ui__badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="ann-ui__td-actions">
                      <div className="ann-ui__menu-wrap" ref={menuId === row._id ? menuRef : null}>
                        <button
                          type="button"
                          className="ann-ui__icon-btn"
                          aria-label="Row actions"
                          disabled={busyId === row._id}
                          onClick={() => setMenuId((id) => (id === row._id ? null : row._id))}
                        >
                          <FiMoreVertical />
                        </button>
                        {menuId === row._id ? (
                          <div className="ann-ui__menu" role="menu">
                            {!isPending ? (
                              <button type="button" role="menuitem" onClick={() => { setMenuId(null); openReadStatus(row); }}>
                                <FiEye /> Read status
                              </button>
                            ) : (
                              <>
                                <button type="button" role="menuitem" onClick={() => { setMenuId(null); onEditDraft?.(row); }}>
                                  <FiEdit2 /> Edit
                                </button>
                                <button type="button" role="menuitem" onClick={() => handlePublish(row)}>
                                  <FiSend /> Send now
                                </button>
                              </>
                            )}
                            <button type="button" role="menuitem" className="is-danger" onClick={() => handleDelete(row)}>
                              <FiTrash2 /> Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="ann-ui__pager">
        <span>{rangeLabel}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="ann-ui__btn ann-ui__btn--ghost !h-8"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pagination.pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="ann-ui__btn ann-ui__btn--ghost !h-8"
          >
            Next
          </button>
        </div>
      </div>

      {readModal ? (
        <div className="ann-ui__modal-backdrop" onClick={() => setReadModal(null)}>
          <div
            className="ann-ui__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ann-read-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ann-ui__modal-head">
              <div>
                <p className="ann-ui__eyebrow">Read status</p>
                <h3 id="ann-read-title" className="ann-ui__card-title">
                  {titleFromRow(readModal.row)}
                  {isImportantRow(readModal.row) ? (
                    <span className="ann-ui__badge ann-ui__badge--important ml-2 align-middle">Important</span>
                  ) : null}
                </h3>
              </div>
              <button type="button" className="ann-ui__icon-btn" aria-label="Close" onClick={() => setReadModal(null)}>
                <FiX />
              </button>
            </div>

            {readModal.loading ? (
              <div className="ann-ui__empty py-10">
                <FiRefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading read status…
              </div>
            ) : readModal.error || !modalReceipts ? (
              <div className="ann-ui__empty py-10 text-red-600">Failed to load read status</div>
            ) : (
              <>
                <div className="ann-ui__modal-stats">
                  <div>
                    <p className="ann-ui__kpi-label">Seen</p>
                    <p className="ann-ui__kpi-value">{modalReceipts.seenCount}</p>
                  </div>
                  <div>
                    <p className="ann-ui__kpi-label">Not seen</p>
                    <p className="ann-ui__kpi-value">{modalReceipts.notSeenCount}</p>
                  </div>
                  <div>
                    <p className="ann-ui__kpi-label">Reach</p>
                    <p className="ann-ui__kpi-value">
                      {(() => {
                        const total = (Number(modalReceipts.seenCount) || 0) + (Number(modalReceipts.notSeenCount) || 0);
                        return total ? `${Math.round(((Number(modalReceipts.seenCount) || 0) / total) * 100)}%` : '0%';
                      })()}
                    </p>
                  </div>
                </div>
                <div className="ann-ui__receipts">
                  <div className="ann-ui__receipt-panel">
                    <h4><FiCheckCircle className="mr-1 inline" /> Seen ({modalReceipts.seenCount})</h4>
                    <ul>
                      {(modalReceipts.seen || []).length === 0 ? (
                        <li>No one has seen this yet</li>
                      ) : (
                        (modalReceipts.seen || []).map((person) => (
                          <li key={String(person._id)} className="flex justify-between gap-2">
                            <span className="font-medium">{person.name}</span>
                            {person.readAt ? (
                              <span className="text-slate-500">{formatWhen(person.readAt)}</span>
                            ) : null}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="ann-ui__receipt-panel">
                    <h4><FiClock className="mr-1 inline" /> Not seen ({modalReceipts.notSeenCount})</h4>
                    <ul>
                      {(modalReceipts.notSeen || []).length === 0 ? (
                        <li>Everyone has seen this</li>
                      ) : (
                        (modalReceipts.notSeen || []).map((person) => (
                          <li key={String(person._id)} className="font-medium">{person.name}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SentAnnouncements;
