import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FiCheck,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiLoader,
    FiSearch,
    FiX,
} from 'react-icons/fi';
import LoadingSpinner from '../../components/LoadingSpinner';

const TEAL = '#0a8f6c';
const PAGE_SIZE = 20;
const STATUSES = ['pending', 'approved', 'rejected'];

const unitLabel = (unit) => {
    if (unit === 'half_day') return 'Half day';
    if (unit === 'full_day') return 'Full day';
    return 'Hours';
};

const formatDay = (key) => {
    if (!key) return '—';
    const dt = new Date(`${String(key).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return key;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatClock = (value) => {
    if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return value || '';
    const [hours, minutes] = value.split(':').map(Number);
    const dt = new Date();
    dt.setHours(hours, minutes, 0, 0);
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatHours = (hours) => {
    const n = Number(hours) || 0;
    const h = Math.floor(n);
    const m = Math.round((n - h) * 60);
    if (!m) return `${h}h`;
    return `${h}h ${String(m).padStart(2, '0')}m`;
};

const personName = (item) => {
    if (item.employeeId?.name) {
        return `${item.employeeId.name} ${item.employeeId.lastName || ''}`.trim();
    }
    return item.employeeName || 'Unknown';
};

const initialsOf = (name) =>
    String(name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || '?';

const claimPrimary = (item) => {
    if (item.requestUnit === 'hours' && item.startTime && item.endTime) {
        return `${formatClock(item.startTime)} – ${formatClock(item.endTime)}`;
    }
    return unitLabel(item.requestUnit);
};

const claimSecondary = (item) => {
    if (item.requestUnit === 'hours' && item.requestedHours) return formatHours(item.requestedHours);
    if (item.requestUnit === 'half_day') return '0.5 day';
    if (item.requestUnit === 'full_day') return '1 day';
    return null;
};

const StatusPill = ({ status }) => {
    const map = {
        pending: { label: 'PENDING', style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' } },
        approved: { label: 'APPROVED', style: { background: `${TEAL}14`, color: TEAL, border: `1px solid ${TEAL}44` } },
        rejected: { label: 'REJECTED', style: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' } },
    };
    const tone = map[status] || map.pending;
    return (
        <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide" style={tone.style}>
            {tone.label}
        </span>
    );
};

const Avatar = ({ name }) => (
    <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #14b887 100%)` }}
        aria-hidden
    >
        {initialsOf(name)}
    </div>
);

const CompOffRequests = () => {
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('pending');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        return [0, 1, 2].map((offset) => String(current - offset));
    }, []);

    const loadCounts = useCallback(async (selectedYear) => {
        const results = await Promise.all(
            STATUSES.map((key) =>
                axios
                    .get('/v1/admin/comp-off/requests', {
                        params: { status: key, year: selectedYear || undefined, page: 1, limit: 1 },
                        withCredentials: true,
                    })
                    .then((response) => [key, Number(response.data?.pagination?.total) || 0])
                    .catch(() => [key, 0])
            )
        );
        setCounts(Object.fromEntries(results));
    }, []);

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get('/v1/admin/comp-off/requests', {
                params: { status, year: year || undefined, page, limit: PAGE_SIZE },
                withCredentials: true,
            });
            setRows(Array.isArray(response.data?.data) ? response.data.data : []);
            setPagination(response.data?.pagination || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load comp-off requests');
        } finally {
            setLoading(false);
        }
    }, [status, year, page]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    useEffect(() => {
        loadCounts(year);
    }, [year, loadCounts]);

    const refresh = async () => {
        await Promise.all([loadList(), loadCounts(year)]);
    };

    const decide = async (id, action, reason = '') => {
        setBusyId(id);
        try {
            await axios.put(
                `/v1/admin/comp-off/${action}/${id}`,
                action === 'reject' ? { rejectionReason: reason } : {},
                { withCredentials: true }
            );
            toast.success(action === 'approve' ? 'Comp-off request approved' : 'Comp-off request rejected');
            setRejectTarget(null);
            setRejectReason('');
            await refresh();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update the request');
        } finally {
            setBusyId(null);
        }
    };

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((item) => {
            const name = personName(item);
            const department = item.employeeId?.department || '';
            return `${name} ${department} ${item.reason || ''}`.toLowerCase().includes(query);
        });
    }, [rows, search]);

    const totalPages = Math.max(1, Number(pagination?.pages) || 1);
    const canPrev = page > 1;
    const canNext = Boolean(pagination?.hasNext);

    const openReject = (item) => {
        setRejectTarget(item);
        setRejectReason('');
    };

    if (loading && rows.length === 0) {
        return <LoadingSpinner message="Loading comp-off requests..." />;
    }

    return (
        <div className="page-shell min-h-screen bg-[#f4f7f6]">
            <div className="page-shell-inner hrms-stack">
                <header className="flex flex-col gap-3">
                    <div>
                        <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                            Comp-off requests
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">
                            Review extra-work claims before they become compensatory leave.
                        </p>
                    </div>

                    <div className="hrms-chip-scroll">
                        <div className="hrms-chip-scroll-track" role="tablist" aria-label="Filter by status">
                            {[
                                { key: 'pending', label: 'Pending', n: counts.pending, bg: '#fef2f2', color: '#b91c1c' },
                                { key: 'approved', label: 'Approved', n: counts.approved, bg: `${TEAL}18`, color: TEAL },
                                { key: 'rejected', label: 'Rejected', n: counts.rejected, bg: '#f1f5f9', color: '#64748b' },
                            ].map((chip) => {
                                const active = status === chip.key;
                                return (
                                    <div key={chip.key} className="hrms-chip-scroll-item">
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => {
                                                setPage(1);
                                                setStatus(chip.key);
                                            }}
                                            className={`whitespace-nowrap rounded-full border px-4 py-2 text-center text-xs font-bold uppercase tracking-wide transition hover:brightness-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0a8f6c]/35 ${
                                                active ? 'border-[#0a8f6c]' : 'border-[#e2e8f0]'
                                            }`}
                                            style={{ background: chip.bg, color: chip.color }}
                                        >
                                            {chip.n} {chip.label}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </header>

                <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="min-w-0 flex-1 sm:min-w-[180px]">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Search
                            </label>
                            <div className="relative">
                                <FiSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    placeholder="Name, department, or reason…"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-xs focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/20 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-[8.5rem]">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Status
                            </label>
                            <select
                                value={status}
                                onChange={(event) => {
                                    setPage(1);
                                    setStatus(event.target.value);
                                }}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:text-sm"
                            >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div className="w-full sm:w-[8.5rem]">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Year
                            </label>
                            <select
                                value={year}
                                onChange={(event) => {
                                    setPage(1);
                                    setYear(event.target.value);
                                }}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:text-sm"
                            >
                                <option value="">All years</option>
                                {yearOptions.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setStatus('pending');
                                setYear(String(new Date().getFullYear()));
                                setPage(1);
                            }}
                            className="shrink-0 self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-[#0a8f6c]/5 sm:self-end"
                            style={{ color: TEAL }}
                        >
                            Clear
                        </button>
                    </div>
                </section>

                <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    {loading ? (
                        <div
                            className="absolute inset-0 z-[4] flex items-center justify-center bg-white/65 backdrop-blur-[1px]"
                            aria-busy="true"
                            aria-label="Refreshing list"
                        >
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
                                <FiLoader className="h-5 w-5 animate-spin" style={{ color: TEAL }} />
                                <span className="text-sm font-semibold text-slate-700">Updating list…</span>
                            </div>
                        </div>
                    ) : null}

                    <div className="divide-y divide-slate-100 md:hidden">
                        {filteredRows.map((item) => {
                            const name = personName(item);
                            const department = item.employeeId?.department || '—';
                            const secondary = claimSecondary(item);
                            return (
                                <article key={`m-${item._id}`} className="space-y-2.5 p-3.5">
                                    <div className="flex items-start gap-3">
                                        <Avatar name={name} />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-900">{name}</p>
                                            <p className="text-xs text-slate-500">{department}</p>
                                            <p className="mt-1 text-xs text-slate-600">
                                                {formatDay(item.workDateKey || item.date)}
                                                {' · '}
                                                <span className="font-medium" style={{ color: TEAL }}>{claimPrimary(item)}</span>
                                                {secondary ? ` · ${secondary}` : ''}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.reason || '—'}</p>
                                            {item.status === 'rejected' && item.rejectionReason ? (
                                                <p className="mt-1 text-xs text-slate-400">Note: {item.rejectionReason}</p>
                                            ) : null}
                                            <div className="mt-1.5">
                                                <StatusPill status={item.status} />
                                            </div>
                                        </div>
                                    </div>
                                    {item.status === 'pending' ? (
                                        <ActionButtons
                                            busy={busyId === item._id}
                                            spinning={busyId === item._id && !rejectTarget}
                                            onApprove={() => decide(item._id, 'approve')}
                                            onReject={() => openReject(item)}
                                        />
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>

                    <div className="hidden max-w-full overflow-x-auto md:block">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-4 py-3 pl-5">Employee</th>
                                    <th className="px-4 py-3">Work date</th>
                                    <th className="px-4 py-3">Claim</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 pr-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.map((item) => {
                                    const name = personName(item);
                                    const department = item.employeeId?.department || '—';
                                    const secondary = claimSecondary(item);
                                    return (
                                        <tr key={item._id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-4 pl-5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar name={name} />
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-slate-900">{name}</div>
                                                        <div className="text-xs text-slate-500">{department}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                                                {formatDay(item.workDateKey || item.date)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                                                <span className="font-medium" style={{ color: TEAL }}>{claimPrimary(item)}</span>
                                                {secondary ? (
                                                    <div className="mt-0.5 text-xs text-slate-400">{secondary}</div>
                                                ) : null}
                                            </td>
                                            <td className="max-w-[240px] px-4 py-4 text-slate-600">
                                                <span className="line-clamp-2" title={item.reason}>{item.reason || '—'}</span>
                                                {item.status === 'rejected' && item.rejectionReason ? (
                                                    <span className="mt-1 block text-xs text-slate-400">Note: {item.rejectionReason}</span>
                                                ) : null}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <StatusPill status={item.status} />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 pr-5 text-right">
                                                {item.status === 'pending' ? (
                                                    <ActionButtons
                                                        busy={busyId === item._id}
                                                        spinning={busyId === item._id && !rejectTarget}
                                                        onApprove={() => decide(item._id, 'approve')}
                                                        onReject={() => openReject(item)}
                                                        compact
                                                    />
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredRows.length === 0 ? (
                        <div className="flex flex-col items-center py-14 text-center text-slate-500">
                            <FiClock className="mb-3 h-10 w-10 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">
                                No {status} comp-off requests match your filters
                            </p>
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
                        <p className="text-xs leading-relaxed text-slate-600">
                            Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
                            <span className="font-semibold text-slate-800">{totalPages}</span>
                            {' · '}
                            Showing <span className="font-semibold text-slate-800">{filteredRows.length}</span> on this page
                            {' · '}
                            <span className="font-semibold text-slate-800">{pagination?.total ?? 0}</span> {status} in {year || 'all years'}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                disabled={!canPrev || loading}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <FiChevronLeft className="h-4 w-4" aria-hidden />
                                Previous
                            </button>
                            <button
                                type="button"
                                disabled={!canNext || loading}
                                onClick={() => setPage((current) => current + 1)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                Next
                                <FiChevronRight className="h-4 w-4" aria-hidden />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {rejectTarget ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reject-comp-off-title">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/30"
                        aria-label="Close"
                        onClick={() => {
                            if (busyId) return;
                            setRejectTarget(null);
                            setRejectReason('');
                        }}
                    />
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl">
                        <h2 id="reject-comp-off-title" className="text-lg font-semibold text-slate-900">
                            Reject comp-off
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {personName(rejectTarget)} · {formatDay(rejectTarget.workDateKey || rejectTarget.date)}
                        </p>
                        <label className="mt-4 block text-sm">
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Reason (optional)
                            </span>
                            <textarea
                                rows={3}
                                value={rejectReason}
                                onChange={(event) => setRejectReason(event.target.value)}
                                placeholder="Why is this claim being rejected?"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/20"
                            />
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => {
                                    setRejectTarget(null);
                                    setRejectReason('');
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => decide(rejectTarget._id, 'reject', rejectReason.trim())}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                {busyId === rejectTarget._id ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const ActionButtons = ({ busy, spinning = false, onApprove, onReject, compact = false }) => (
    <div className={compact ? 'inline-flex items-center justify-end gap-2' : 'flex items-center justify-end gap-2 border-t border-slate-100 pt-2'}>
        <button
            type="button"
            title="Approve"
            disabled={busy}
            onClick={onApprove}
            className="rounded-lg p-2 text-white disabled:opacity-40"
            style={{ background: TEAL }}
        >
            {spinning ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
        </button>
        <button
            type="button"
            title="Reject"
            disabled={busy}
            onClick={onReject}
            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-40"
        >
            <FiX className="h-4 w-4" />
        </button>
    </div>
);

export default CompOffRequests;
