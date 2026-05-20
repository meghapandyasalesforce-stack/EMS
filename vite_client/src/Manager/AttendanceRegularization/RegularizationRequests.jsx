import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import axios, { getUploadUrl } from '../../utils/axios';
import { isHR as checkIsHR } from '../../utils/managerHelper';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
  FiSearch,
  FiCheck,
  FiX,
  FiEye,
  FiClock,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import LoadingSpinner from '../../components/LoadingSpinner';

const TEAL = '#0a8f6c';
const RED = '#dc2626';
const GREY_BORDER = '#e2e8f0';

const API_LIST = '/v1/both/attendance-regularization/manager/requests';

/** Matches server manager list default/max from parsePagination usage */
const PAGE_SIZE = 100;

function padYmd(year, month0, day) {
  const m = String(month0 + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function currentMonthBounds() {
  const n = new Date();
  const year = n.getFullYear();
  const month0 = n.getMonth();
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return {
    start: padYmd(year, month0, 1),
    end: padYmd(year, month0, lastDay),
  };
}

function initialsEmp(emp) {
  const bits = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim();
  return bits
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';
}

function profileSrc(emp) {
  const photoRef = emp?.profilePhoto?.url || emp?.profilePhoto;
  if (!photoRef) return null;
  if (typeof photoRef === 'string') {
    return getUploadUrl(photoRef.startsWith('/') ? photoRef : `/uploads/${photoRef}`);
  }
  return getUploadUrl(photoRef.url || photoRef);
}

function RowAvatar({ employee, sizeClass = 'h-10 w-10' }) {
  const [broken, setBroken] = useState(false);
  const url = profileSrc(employee);
  const letter = initialsEmp(employee);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${sizeClass}`}
      style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #14b887 100%)` }}
    >
      {url && !broken ? (
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-xs">{letter}</span>
      )}
    </div>
  );
}

function getTypeLabel(type) {
  const labels = {
    missing_clock_in: 'Missing clock-in',
    missing_clock_out: 'Missing clock-out',
    both: 'Both missing',
    incorrect_time: 'Incorrect time',
    full_day: 'Full day',
  };
  return labels[type] || type || '—';
}

const APPROVER_TYPE_WAITING = {
  Manager: 'Waiting for manager',
  HR: 'Waiting for HR',
  Executive: 'Waiting for executive',
  Finance: 'Waiting for finance',
};

function getWorkflowWaitingLabel(req) {
  const pending = req?.workflowSummary?.pendingStep;
  if (!req?.workflowSummary?.hasWorkflow || !pending) return null;
  return (
    APPROVER_TYPE_WAITING[pending.approverType] ||
    `Waiting: ${pending.stepName || `step ${pending.stepNumber}`}`
  );
}

/** HR acting before the natural approver for the current step */
function requestNeedsEarlyConfirm(req, isHrUser) {
  if (!isHrUser) return false;
  const type = req?.workflowSummary?.pendingStep?.approverType;
  return Boolean(type && type !== 'HR');
}

function WorkflowStepPill({ req }) {
  const label = getWorkflowWaitingLabel(req);
  if (!label || req.status !== 'pending') return null;
  return (
    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      {label}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: {
      label: 'PENDING',
      style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
    },
    approved: {
      label: 'APPROVED',
      style: { background: `${TEAL}14`, color: TEAL, border: `1px solid ${TEAL}44` },
    },
    rejected: {
      label: 'REJECTED',
      style: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
    },
    cancelled: {
      label: 'CANCELLED',
      style: { background: '#fafafa', color: '#737373', border: '1px solid #e5e5e5' },
    },
  };
  const m = map[status] || map.pending;
  return (
    <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={m.style}>
      {m.label}
    </span>
  );
}

const RegularizationRequests = () => {
  const authUser = useSelector((state) => state.auth.user);
  const employeeProfile = useSelector((state) => state.employeeDetails.employee);
  const userObj = authUser || employeeProfile;

  const userRole = userObj?.role || localStorage.getItem('role') || 'employee';
  const isAdmin = userRole === 'admin';
  const isHr = useMemo(() => {
    const roles = Array.isArray(userObj?.functionalRoles) ? userObj.functionalRoles : [];
    return (
      checkIsHR(userObj) ||
      roles.some((r) => String(r).toLowerCase() === 'hr')
    );
  }, [userObj]);

  const { start: defaultStart, end: defaultEnd } = useMemo(() => currentMonthBounds(), []);
  const [requests, setRequests] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [statusDropdown, setStatusDropdown] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawerReq, setDrawerReq] = useState(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetIds, setRejectTargetIds] = useState([]);
  const [rejectReason, setRejectReason] = useState('');

  const [actionBusy, setActionBusy] = useState(null);

  const closeRejectModal = useCallback(() => {
    setRejectModalOpen(false);
    setRejectTargetIds([]);
    setRejectReason('');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  /** Escape closes modal first (it sits above drawer), then drawer */
  useEffect(() => {
    if (!drawerReq && !rejectModalOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (rejectModalOpen) closeRejectModal();
      else setDrawerReq(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerReq, rejectModalOpen, closeRejectModal]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      if (iso.test((startDate || '').trim())) params.startDate = startDate.trim();
      if (iso.test((endDate || '').trim())) params.endDate = endDate.trim();
      if (statusDropdown !== 'all') {
        params.status = statusDropdown;
      }
      const response = await axios.get(API_LIST, { params, withCredentials: true });
      setRequests(response.data?.data ?? []);
      setStatusCounts(
        response.data?.statusCounts ?? {
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
        }
      );
      const pag = response.data?.pagination ?? {};
      setPagination({
        total: pag.total ?? 0,
        page: pag.page ?? page,
        limit: pag.limit ?? PAGE_SIZE,
        pages: Math.max(1, pag.pages ?? 1),
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load regularization requests');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusDropdown, page]);

  /** If totals shrink (e.g. after approvals), clamp so we do not stay on an empty page */
  useEffect(() => {
    const maxP = pagination.pages ?? 1;
    if (maxP >= 1 && page > maxP) {
      setPage(maxP);
    }
  }, [pagination.pages, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    if (!debouncedSearch) return requests;
    const q = debouncedSearch.toLowerCase();
    return requests.filter((r) => {
      const emp = r.employeeId;
      const name = `${emp?.name || ''} ${emp?.lastName || ''} ${emp?.email || ''}`.toLowerCase();
      const reason = (r.reason || '').toLowerCase();
      return name.includes(q) || reason.includes(q);
    });
  }, [requests, debouncedSearch]);

  useEffect(() => {
    const validPending = new Set(requests.filter((r) => r.status === 'pending').map((r) => String(r._id)));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => validPending.has(String(id))));
      if (prev.size === next.size) {
        for (const id of prev) if (!next.has(id)) return next;
        return prev;
      }
      return next;
    });
  }, [requests]);

  const toggleSelectAllPending = () => {
    const pendingIds = filteredRequests.filter((r) => r.status === 'pending').map((r) => String(r._id));
    if (!pendingIds.length) return;
    const allChosen = pendingIds.every((id) => selectedIds.has(id));
    if (allChosen) {
      const next = new Set(selectedIds);
      pendingIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      pendingIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const toggleRow = (id, status) => {
    if (status !== 'pending') return;
    const sid = String(id);
    const next = new Set(selectedIds);
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    setSelectedIds(next);
  };

  const clearFilters = () => {
    const b = currentMonthBounds();
    setPage(1);
    setStartDate(b.start);
    setEndDate(b.end);
    setStatusDropdown('all');
    setSearch('');
    setDebouncedSearch('');
  };

  const statusSummary = useMemo(
    () =>
      (statusCounts.pending ?? 0) +
      (statusCounts.approved ?? 0) +
      (statusCounts.rejected ?? 0) +
      (statusCounts.cancelled ?? 0),
    [statusCounts]
  );

  const getRequestById = useCallback(
    (id) => requests.find((r) => String(r._id) === String(id)),
    [requests]
  );

  const promptEarlyApprovalConfirm = (targetRequests) => {
    if (!targetRequests.length) return true;
    const stepLabel =
      targetRequests[0]?.workflowSummary?.pendingStep?.stepName ||
      targetRequests[0]?.workflowSummary?.pendingStep?.approverType ||
      'current step';
    const count = targetRequests.length;
    return window.confirm(
      `The assigned approver has not completed the current step yet (${stepLabel}).\n\n` +
        `If you continue, only this workflow step will be completed for ${count === 1 ? 'this request' : `${count} requests`}, ` +
        `and ${count === 1 ? 'it' : 'they'} will move to the next approver.\n\nProceed?`
    );
  };

  const handleApproveIds = async (ids, { adminBypass = false } = {}) => {
    if (!ids.length) return;

    const targets = ids.map((id) => getRequestById(id)).filter(Boolean);
    let confirmEarlyApproval = false;
    const useAdminBypass = adminBypass || isAdmin;

    if (!useAdminBypass) {
      const needsEarly = targets.filter((r) => requestNeedsEarlyConfirm(r, isHr));
      if (needsEarly.length && !promptEarlyApprovalConfirm(needsEarly)) {
        return;
      }
      if (needsEarly.length) confirmEarlyApproval = true;
    }

    setActionBusy(ids.length === 1 ? `${ids[0]}` : '__bulk');
    try {
      await Promise.all(
        ids.map((requestId) =>
          axios.patch(
            `/v1/both/attendance-regularization/manager/approve/${requestId}`,
            {
              managerResponse: 'Approved',
              ...(confirmEarlyApproval ? { confirmEarlyApproval: true } : {}),
              ...(useAdminBypass ? { adminBypass: true } : {}),
            },
            { withCredentials: true }
          )
        )
      );
      toast.success(
        useAdminBypass
          ? ids.length === 1
            ? 'Request approved (all workflow steps completed)'
            : `${ids.length} requests approved (all steps completed)`
          : ids.length === 1
            ? 'Request approved'
            : `${ids.length} requests approved`
      );
      setSelectedIds(new Set());
      setDrawerReq(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approve failed');
    } finally {
      setActionBusy(null);
    }
  };

  const openRejectModal = (ids) => {
    if (!ids.length) return;
    setRejectTargetIds(ids);
    setRejectReason('');
    setRejectModalOpen(true);
    setDrawerReq(null);
  };

  const submitRejectModal = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Provide a rejection reason');
      return;
    }

    const rejectTargets = rejectTargetIds.map((id) => getRequestById(id)).filter(Boolean);
    let confirmEarlyApproval = false;
    if (!isAdmin) {
      const needsEarly = rejectTargets.filter((r) => requestNeedsEarlyConfirm(r, isHr));
      if (needsEarly.length && !promptEarlyApprovalConfirm(needsEarly)) {
        return;
      }
      if (needsEarly.length) confirmEarlyApproval = true;
    }

    setActionBusy(rejectTargetIds.length === 1 ? String(rejectTargetIds[0]) : '__bulk');
    try {
      for (const requestId of rejectTargetIds) {
        /* eslint-disable no-await-in-loop */
        await axios.patch(
          `/v1/both/attendance-regularization/manager/reject/${requestId}`,
          {
            rejectionReason: rejectReason,
            ...(confirmEarlyApproval ? { confirmEarlyApproval: true } : {}),
          },
          { withCredentials: true }
        );
        /* eslint-enable no-await-in-loop */
      }
      toast.success(
        rejectTargetIds.length === 1 ? 'Request rejected' : `${rejectTargetIds.length} requests rejected`
      );
      closeRejectModal();
      setSelectedIds(new Set());
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reject failed');
    } finally {
      setActionBusy(null);
    }
  };

  const allPendingSelected =
    filteredRequests.filter((r) => r.status === 'pending').length > 0 &&
    filteredRequests
      .filter((r) => r.status === 'pending')
      .every((r) => selectedIds.has(String(r._id)));

  if (loading && !requests.length) {
    return <LoadingSpinner message="Loading regularization requests..." />;
  }

  const currentPageNum = pagination.page ?? page;
  const totalPagesNum = pagination.pages ?? 1;
  const canPrev = currentPageNum > 1 && !loading;
  const canNext = currentPageNum < totalPagesNum && !loading;

  return (
    <div className="min-h-screen bg-[#f4f7f6] p-4 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">Regularization Requests</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review and approve or reject team attendance correction requests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3" role="tablist" aria-label="Quick filter by status">
            {[
              { key: 'all', label: 'All', n: statusSummary, bg: '#ffffff', color: '#0f172a' },
              { key: 'pending', label: 'Pending', n: statusCounts.pending, bg: '#fef2f2', color: '#b91c1c' },
              { key: 'approved', label: 'Approved', n: statusCounts.approved, bg: `${TEAL}18`, color: TEAL },
              { key: 'rejected', label: 'Rejected', n: statusCounts.rejected, bg: '#f1f5f9', color: '#64748b' },
              { key: 'cancelled', label: 'Cancelled', n: statusCounts.cancelled, bg: '#fafafa', color: '#737373' },
            ].map((b) => {
              const active = statusDropdown === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={`Show ${b.label}${b.key === 'all' ? ' statuses' : ' only'}`}
                  onClick={() => {
                    setPage(1);
                    setStatusDropdown(b.key === 'all' ? 'all' : b.key);
                  }}
                  className={`rounded-full border px-4 py-2 text-center text-xs font-bold uppercase tracking-wide shadow-sm transition hover:brightness-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0a8f6c]/35 ${
                    active ? 'ring-2 ring-[#0a8f6c] ring-offset-2 ring-offset-[#f4f7f6]' : ''
                  }`}
                  style={{ borderColor: active ? TEAL : GREY_BORDER, background: b.bg, color: b.color }}
                >
                  {(b.n ?? 0)} {b.label}
                </button>
              );
            })}
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search requests
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search by name, email or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25"
                />
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-xs font-semibold hover:underline"
                style={{ color: TEAL }}
              >
                Clear filters
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={statusDropdown}
                  onChange={(e) => {
                    setPage(1);
                    setStatusDropdown(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div />
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date from
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPage(1);
                    setStartDate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date to
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPage(1);
                    setEndDate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {selectedIds.size > 0 ? (
          <div
            className="mb-4 flex flex-col gap-3 rounded-xl border px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
            style={{ borderColor: GREY_BORDER, background: '#fffbeb' }}
          >
            <p className="text-sm font-medium text-slate-800">
              {selectedIds.size} selected · bulk actions apply to pending requests only
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!actionBusy}
                onClick={() => handleApproveIds([...selectedIds], { adminBypass: isAdmin })}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50"
                style={{ background: TEAL }}
              >
                {isAdmin ? 'Approve & finalize selected' : 'Approve selected'}
              </button>
              <button
                type="button"
                disabled={!!actionBusy}
                onClick={() => openRejectModal([...selectedIds])}
                className="rounded-xl border-2 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm disabled:opacity-50"
                style={{ borderColor: RED }}
              >
                Reject selected
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {loading && requests.length > 0 ? (
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3 pl-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0a8f6c]"
                      checked={allPendingSelected}
                      disabled={!filteredRequests.some((r) => r.status === 'pending')}
                      onChange={toggleSelectAllPending}
                      aria-label="Select all pending"
                    />
                  </th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="min-w-[180px] px-4 py-3">Check-in / out (requested)</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const emp = req.employeeId;
                  const name = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
                  const dept = emp?.department || '—';
                  const isPending = req.status === 'pending';
                  const inFmt = req.requestedClockIn
                    ? format(new Date(req.requestedClockIn), 'hh:mm a')
                    : null;
                  const outFmt = req.requestedClockOut
                    ? format(new Date(req.requestedClockOut), 'hh:mm a')
                    : null;

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-4 pl-5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#0a8f6c]"
                          disabled={!isPending}
                          checked={selectedIds.has(String(req._id))}
                          onChange={() => toggleRow(req._id, req.status)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <RowAvatar employee={emp} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{name}</div>
                            <div className="text-xs text-slate-500">{dept}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {format(new Date(req.attendanceDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {inFmt || outFmt ? (
                          <>
                            <span className="font-medium" style={{ color: TEAL }}>
                              {inFmt ?? '—'}
                            </span>
                            {' · '}
                            <span className="text-slate-600">{outFmt ?? '—'}</span>
                            <div className="mt-0.5 text-xs text-slate-400">{getTypeLabel(req.regularizationType)}</div>
                          </>
                        ) : (
                          <span className="italic text-slate-400">{getTypeLabel(req.regularizationType)}</span>
                        )}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-slate-600">
                        <span className="line-clamp-2" title={req.reason}>
                          {req.reason || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusPill status={req.status} />
                        <WorkflowStepPill req={req} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 pr-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                title={isAdmin ? 'Approve and complete all steps' : 'Approve current step'}
                                disabled={!!actionBusy}
                                onClick={() =>
                                  handleApproveIds([req._id], { adminBypass: isAdmin })
                                }
                                className="rounded-lg p-2 text-white disabled:opacity-40"
                                style={{ background: TEAL }}
                              >
                                {actionBusy === `${req._id}` ? (
                                  <FiLoader className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FiCheck className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Reject"
                                disabled={!!actionBusy}
                                onClick={() => openRejectModal([req._id])}
                                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-40"
                              >
                                <FiX className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="View"
                                onClick={() => setDrawerReq(req)}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                              >
                                <FiEye className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredRequests.length ? (
            <div className="flex flex-col items-center py-14 text-center text-slate-500">
              <FiClock className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No regularization requests match your filters</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <p className="text-xs leading-relaxed text-slate-600">
              Page <span className="font-semibold text-slate-800">{currentPageNum}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalPagesNum}</span> ·{' '}
              <span className="font-semibold text-slate-800">{pagination.limit ?? PAGE_SIZE}</span> per page · Showing{' '}
              <span className="font-semibold text-slate-800">{filteredRequests.length}</span> row(s) on this page (client search). Matching{' '}
              <span className="font-semibold text-slate-800">{pagination.total ?? 0}</span> requests for{' '}
              <span className="font-semibold text-slate-800">
                {statusDropdown === 'all' ? 'all statuses' : statusDropdown}
              </span>
              .
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setPage((p) => Math.min(totalPagesNum, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <FiChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawerReq ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close panel"
            onClick={() => setDrawerReq(null)}
          />
          <aside
            className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
            style={{ boxShadow: '-8px 0 32px rgba(0,0,0,.12)' }}
          >
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Regularization Request</p>
                  <StatusPill status={drawerReq.status} />
                  <WorkflowStepPill req={drawerReq} />
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerReq(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-8 flex gap-4">
                <RowAvatar employee={drawerReq.employeeId} sizeClass="h-14 w-14" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {[drawerReq.employeeId?.name, drawerReq.employeeId?.lastName].filter(Boolean).join(' ').trim()}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {drawerReq.employeeId?.position || drawerReq.employeeId?.department || 'Employee'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{drawerReq.employeeId?.email}</p>
                </div>
              </div>

              <section className="mb-6 rounded-xl bg-slate-50 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Attendance date</h3>
                <p className="text-sm font-semibold text-slate-900">
                  {format(new Date(drawerReq.attendanceDate), 'EEEE, MMM d, yyyy')}
                </p>
                <p className="mt-1 text-xs text-slate-500">{getTypeLabel(drawerReq.regularizationType)}</p>
              </section>

              <section className="mb-6 rounded-xl border border-slate-100 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-teal-800">Requested correction</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  {drawerReq.requestedClockIn ? (
                    <p>
                      <span className="text-slate-500">Requested check-in:</span>{' '}
                      <span className="font-medium">{format(new Date(drawerReq.requestedClockIn), 'hh:mm a')}</span>
                    </p>
                  ) : null}
                  {drawerReq.requestedClockOut ? (
                    <p>
                      <span className="text-slate-500">Requested check-out:</span>{' '}
                      <span className="font-medium">{format(new Date(drawerReq.requestedClockOut), 'hh:mm a')}</span>
                    </p>
                  ) : null}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Reason for change</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-800">{drawerReq.reason}</p>
                  </div>
                </div>
              </section>

              {drawerReq.status !== 'pending' && drawerReq.managerResponse ? (
                <section className="rounded-xl border border-slate-100 p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Decision / notes</h3>
                  <p className="text-sm text-slate-700">{drawerReq.managerResponse}</p>
                </section>
              ) : null}

              {drawerReq.workflowSummary?.steps?.length > 1 ? (
                <section className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Workflow steps</h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {drawerReq.workflowSummary.steps.map((step) => (
                      <li key={step.stepNumber} className="flex justify-between gap-2">
                        <span>
                          {step.stepNumber}. {step.stepName}
                        </span>
                        <span className="text-xs font-semibold uppercase text-slate-500">{step.status}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {drawerReq.status === 'pending' ? (
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    disabled={!!actionBusy}
                    onClick={() =>
                      handleApproveIds([drawerReq._id], { adminBypass: isAdmin })
                    }
                    className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow"
                    style={{ background: TEAL }}
                  >
                    {isAdmin ? 'Approve & finalize' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={!!actionBusy}
                    onClick={() => openRejectModal([drawerReq._id])}
                    className="flex-1 rounded-xl border-2 border-red-400 py-3 text-sm font-semibold text-red-600"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {/* Reject modal (single & bulk) */}
      {rejectModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-slate-900">
              Reject {rejectTargetIds.length === 1 ? 'regularization request' : `${rejectTargetIds.length} requests`}
            </h3>
            <p className="mb-4 text-sm text-slate-600">Provide a reason. It will apply to each selected request.</p>
            <textarea
              rows={5}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason…"
              className="mb-6 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/20"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectModal}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || !!actionBusy}
                onClick={submitRejectModal}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: RED }}
              >
                {actionBusy ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default RegularizationRequests;
