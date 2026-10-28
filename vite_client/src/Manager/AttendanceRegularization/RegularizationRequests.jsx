import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
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
  FiDownload,
  FiPlus,
  FiLock,
  FiUser,
  FiCalendar,
} from 'react-icons/fi';
import TeamWfhRequestsPanel from './TeamWfhRequestsPanel';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import {
  formatAuditTimelineEvent,
  formatCapitalRequestStatus,
  formatHrOverrideOutcome,
  formatLeaveApprovalStageDisplay,
  getWorkflowWaitingLabel,
} from '../../utils/approvalStatusDisplay';

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

function RowAvatar({ employee, sizeClass = 'h-10 w-10' }) {
  const [broken, setBroken] = useState(false);
  const userId = employee?._id || employee?.id || null;
  const { photoUrl: url } = useSignedProfilePhoto(
    employee?.profilePhoto || employee?.profilePicture,
    { userType: 'employee', userId }
  );
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

function formatAttendanceDateLine(date) {
  if (!date) return '—';
  return format(new Date(date), 'MMM d, yyyy');
}

function getRegWorkflowWaitingLabel(req) {
  return getWorkflowWaitingLabel(req?.workflowSummary);
}

/**
 * Returns true if the current viewer can act on the pending workflow step.
 * Admin always gets full actions. HR may override while Manager step is pending.
 * Requests raised by HR staff are admin-only, whatever the viewer's role.
 * No workflow = always actionable.
 */
function isMyTurn(req, { isAdmin, isHr, isExecutive, isManager }) {
  if (isAdmin) return true;
  if (req?.requiresAdminApproval) return false;
  const summary = req?.workflowSummary;
  if (!summary?.hasWorkflow || !summary?.pendingStep) return true;
  const type = summary.pendingStep.approverType;
  if (type === 'HR') return isHr;
  if (type === 'Executive') return isExecutive;
  if (type === 'Manager') return isManager || isHr;
  if (type && type !== 'HR' && isHr) return true;
  return true;
}

function WorkflowStepPill({ req }) {
  const label = getRegWorkflowWaitingLabel(req);
  if (!label || req.status !== 'pending') return null;
  return (
    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-amber-600">
      {label}
    </span>
  );
}

function StatusPill({ status, workflowSummary }) {
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
  const hrByline = formatHrOverrideOutcome(workflowSummary, status);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full" style={m.style}>
        {formatCapitalRequestStatus(status)}
      </span>
      {hrByline ? (
        <span className="text-[10px] font-semibold text-slate-600">{hrByline}</span>
      ) : null}
    </span>
  );
}

const RegularizationRequests = ({ embedded = false } = {}) => {
  const navigate = useNavigate();
  const { isOrgOwner } = useAuthPermissions();
  const [activeSection, setActiveSection] = useState('regularization');
  const authUser = useSelector((state) => state.auth.user);
  const employeeProfile = useSelector((state) => state.employeeDetails.employee);
  const userObj = authUser || employeeProfile;
  const org = useSelector((state) => state.organization?.profile);
  const orgName = org?.name || org?.companyName || 'Your organization';
  const [wfhTotal, setWfhTotal] = useState(0);

  const isAdmin = isOrgOwner;
  const isHr = useMemo(() => {
    const roles = Array.isArray(userObj?.functionalRoles) ? userObj.functionalRoles : [];
    return (
      checkIsHR(userObj) ||
      roles.some((r) => String(r).toLowerCase() === 'hr')
    );
  }, [userObj]);
  const isExecutive = useMemo(() => {
    const roles = Array.isArray(userObj?.functionalRoles) ? userObj.functionalRoles : [];
    return roles.some((r) => ['executive', 'ceo', 'cto', 'cfo', 'vp'].includes(String(r).toLowerCase()));
  }, [userObj]);
  const isManager = !isAdmin && !isHr && !isExecutive;
  const actorRoles = { isAdmin, isHr, isExecutive, isManager };

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
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [drawerReq, setDrawerReq] = useState(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetIds, setRejectTargetIds] = useState([]);
  const [rejectReason, setRejectReason] = useState('');

  const [actionBusy, setActionBusy] = useState(null);
  const [exporting, setExporting] = useState(false);

  const closeRejectModal = useCallback(() => {
    setRejectModalOpen(false);
    setRejectTargetIds([]);
    setRejectReason('');
  }, []);

  useEffect(() => {
    const next = search.trim();
    const t = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
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

  const buildListParams = useCallback((pageNum, limit = PAGE_SIZE) => {
    const params = { page: pageNum, limit };
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const start = (startDate || '').trim();
    const end = (endDate || '').trim();
    if (iso.test(start)) params.startDate = start;
    if (iso.test(end)) params.endDate = end;
    if (statusDropdown !== 'all') params.status = statusDropdown;
    if (typeFilter !== 'all') params.regularizationType = typeFilter;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [startDate, endDate, statusDropdown, typeFilter, debouncedSearch]);

  const fetchRequests = useCallback(async () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const start = (startDate || '').trim();
    const end = (endDate || '').trim();
    if (iso.test(start) && iso.test(end) && start > end) {
      toast.warning('From date must be on or before the To date');
      setRequests([]);
      setPagination((prev) => ({ ...prev, total: 0, page: 1, pages: 1 }));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get(API_LIST, { params: buildListParams(page), withCredentials: true });
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
  }, [buildListParams, page, startDate, endDate]);

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

  useEffect(() => {
    if (!drawerReq?._id) return;
    const updated = requests.find((r) => String(r._id) === String(drawerReq._id));
    if (updated) setDrawerReq(updated);
  }, [requests, drawerReq?._id]);

  const filteredRequests = requests;

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
    const pendingIds = filteredRequests
      .filter((r) => r.status === 'pending' && isMyTurn(r, actorRoles))
      .map((r) => String(r._id));
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

  const toggleRow = (id, status, req) => {
    if (status !== 'pending') return;
    if (!isMyTurn(req, actorRoles)) return;
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
    setTypeFilter('all');
    setSearch('');
    setDebouncedSearch('');
  };

  useEffect(() => {
    let cancelled = false;
    axios.get('/v1/both/wfh-requests/all', { params: { page: 1, limit: 1 }, withCredentials: true })
      .then((response) => {
        if (!cancelled) setWfhTotal(response.data?.allTotal ?? response.data?.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setWfhTotal(0);
      });
    return () => { cancelled = true; };
  }, []);

  const exportCsv = async () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const start = (startDate || '').trim();
    const end = (endDate || '').trim();
    if (iso.test(start) && iso.test(end) && start > end) {
      toast.warning('From date must be on or before the To date');
      return;
    }
    setExporting(true);
    try {
      const collected = [];
      let pageNum = 1;
      let pages = 1;
      do {
        const response = await axios.get(API_LIST, {
          params: buildListParams(pageNum, 500),
          withCredentials: true,
        });
        collected.push(...(response.data?.data ?? []));
        pages = Math.max(1, response.data?.pagination?.pages ?? 1);
        pageNum += 1;
      } while (pageNum <= pages && pageNum <= 40);
      if (!collected.length) {
        toast.info('Nothing to export for these filters');
        return;
      }
      const header = ['Employee', 'Employee ID', 'Date', 'Type', 'Requested in', 'Requested out', 'Reason', 'Status'];
      const cell = (value) => `"${String(value ?? '').split('"').join('""')}"`;
      const lines = collected.map((req) => {
        const emp = req.employeeId || {};
        const name = [emp.name, emp.lastName].filter(Boolean).join(' ').trim();
        return [
          name,
          emp.employeeId || '',
          req.attendanceDate ? format(new Date(req.attendanceDate), 'yyyy-MM-dd') : '',
          getTypeLabel(req.regularizationType),
          req.requestedClockIn ? format(new Date(req.requestedClockIn), 'HH:mm') : '',
          req.requestedClockOut ? format(new Date(req.requestedClockOut), 'HH:mm') : '',
          req.reason || '',
          req.status || '',
        ].map(cell).join(',');
      });
      const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'attendance-regularization.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const statusSummary = useMemo(
    () =>
      (statusCounts.pending ?? 0) +
      (statusCounts.approved ?? 0) +
      (statusCounts.rejected ?? 0) +
      (statusCounts.cancelled ?? 0),
    [statusCounts]
  );

  const handleApproveIds = async (ids, { adminBypass = false } = {}) => {
    if (!ids.length) return;

    const useAdminBypass = adminBypass || isAdmin;

    setActionBusy(ids.length === 1 ? `${ids[0]}` : '__bulk');
    try {
      const results = await Promise.allSettled(
        ids.map((requestId) =>
          axios.patch(
            `/v1/both/attendance-regularization/manager/approve/${requestId}`,
            {
              managerResponse: 'Approved',
              ...(useAdminBypass ? { adminBypass: true } : {}),
            },
            { withCredentials: true }
          )
        )
      );
      const failed = results.filter((result) => result.status === 'rejected').length;
      const approved = results.length - failed;
      if (approved) {
        toast.success(
          useAdminBypass
            ? approved === 1
              ? 'Request approved (all workflow steps completed)'
              : `${approved} requests approved (all steps completed)`
            : approved === 1
              ? 'Request approved'
              : `${approved} requests approved`
        );
      }
      if (failed) {
        const reason = results.find((result) => result.status === 'rejected')?.reason;
        toast.error(reason?.response?.data?.message || (approved ? `${failed} could not be approved` : 'Approve failed'));
      }
      setSelectedIds(new Set());
      setDrawerReq(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Approve failed');
    } finally {
      setActionBusy(null);
    }
  };

  const openRejectModal = (ids, { keepDrawer = false } = {}) => {
    if (!ids.length) return;
    setRejectTargetIds(ids);
    setRejectReason('');
    setRejectModalOpen(true);
    if (!keepDrawer) setDrawerReq(null);
  };

  const handleRejectFromDrawer = async () => {
    if (!drawerReq) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      toast.warning('Provide a rejection reason');
      return;
    }
    setActionBusy(String(drawerReq._id));
    try {
      await axios.patch(
        `/v1/both/attendance-regularization/manager/reject/${drawerReq._id}`,
        { rejectionReason: trimmed },
        { withCredentials: true }
      );
      toast.success('Request rejected');
      setDrawerReq(null);
      setRejectReason('');
      setSelectedIds(new Set());
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reject failed');
    } finally {
      setActionBusy(null);
    }
  };

  const submitRejectModal = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Provide a rejection reason');
      return;
    }

    setActionBusy(rejectTargetIds.length === 1 ? String(rejectTargetIds[0]) : '__bulk');
    let rejected = 0;
    let failed = 0;
    let failMessage = '';
    try {
      for (const requestId of rejectTargetIds) {
        try {
          /* eslint-disable no-await-in-loop */
          await axios.patch(
            `/v1/both/attendance-regularization/manager/reject/${requestId}`,
            { rejectionReason: rejectReason },
            { withCredentials: true }
          );
          /* eslint-enable no-await-in-loop */
          rejected += 1;
        } catch (error) {
          failed += 1;
          failMessage = error.response?.data?.message || failMessage;
        }
      }
      if (rejected) {
        toast.success(rejected === 1 ? 'Request rejected' : `${rejected} requests rejected`);
      }
      if (failed) {
        toast.error(failMessage || (rejected ? `${failed} could not be rejected` : 'Reject failed'));
      }
      closeRejectModal();
      setDrawerReq(null);
      setSelectedIds(new Set());
      if (rejected) fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Reject failed');
    } finally {
      setActionBusy(null);
    }
  };

  const allPendingSelected =
    filteredRequests.filter((r) => r.status === 'pending' && isMyTurn(r, actorRoles)).length > 0 &&
    filteredRequests
      .filter((r) => r.status === 'pending' && isMyTurn(r, actorRoles))
      .every((r) => selectedIds.has(String(r._id)));

  const currentPageNum = pagination.page ?? page;
  const totalPagesNum = pagination.pages ?? 1;
  const canPrev = currentPageNum > 1 && !loading;
  const canNext = currentPageNum < totalPagesNum && !loading;

  return (
    <div className={embedded ? 'min-w-0' : 'page-shell min-h-screen bg-[#f4f7f6]'}>
      <div className={embedded ? 'hrms-stack' : 'page-shell-inner hrms-stack'}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0a8f6c]">{orgName}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0E2B3D] lg:text-[1.7rem]">
              Attendance Regularization &amp; WFH
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review punch corrections and work-from-home requests for your organization.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {activeSection === 'regularization' ? (
              <button
                type="button"
                disabled={exporting}
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <FiDownload className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (activeSection === 'wfh') {
                  navigate('/my-leave', { state: { panelTab: 'wfh-request' } });
                  return;
                }
                navigate('/my-attendance-regularization');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a8f6c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#087a5c]"
            >
              <FiPlus className="h-4 w-4" />
              {activeSection === 'wfh' ? 'Request WFH' : 'Request Regularization'}
            </button>
          </div>
        </header>

        <div className="flex gap-6 border-b border-slate-200" role="tablist" aria-label="Request type">
          {[
            { key: 'regularization', label: 'Regularization', count: statusSummary },
            { key: 'wfh', label: 'WFH Requests', count: wfhTotal },
          ].map((tab) => {
            const active = activeSection === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSection(tab.key)}
                className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${
                  active ? 'border-[#0a8f6c] text-[#0a8f6c]' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-[#0a8f6c]/10 text-[#0a8f6c]' : 'bg-slate-100 text-slate-500'}`}>
                  {tab.count ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className={activeSection === 'regularization' ? 'block' : 'hidden'}>
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.9fr_0.7fr_0.7fr_auto] xl:items-end">
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Name, ID, email, or reason"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <select
                value={statusDropdown}
                onChange={(e) => {
                  setPage(1);
                  setStatusDropdown(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Request type</label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setPage(1);
                  setTypeFilter(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="all">All types</option>
                <option value="missing_clock_in">Missing clock in</option>
                <option value="missing_clock_out">Missing clock out</option>
                <option value="both">Both punches</option>
                <option value="incorrect_time">Incorrect time</option>
                <option value="full_day">Full day</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</label>
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
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</label>
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
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#0a8f6c] hover:bg-[#0a8f6c]/5"
            >
              Reset
            </button>
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
          {/* Mobile cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredRequests.map((req) => {
              const emp = req.employeeId;
              const name = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
              const dept = emp?.department || '—';
              const managerObj = req.managerId;
              const managerName = managerObj && typeof managerObj === 'object'
                ? [managerObj.name, managerObj.lastName].filter(Boolean).join(' ').trim() || '—'
                : (typeof managerObj === 'string' && managerObj.trim() ? managerObj : '—');
              const isPending = req.status === 'pending';
              const canAct = isPending && isMyTurn(req, actorRoles);
              const inFmt = req.requestedClockIn
                ? format(new Date(req.requestedClockIn), 'hh:mm a')
                : null;
              const outFmt = req.requestedClockOut
                ? format(new Date(req.requestedClockOut), 'hh:mm a')
                : null;
              return (
                <article key={`m-${req._id}`} className="space-y-2.5 p-3.5">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[#0a8f6c]"
                      disabled={!isPending || !isMyTurn(req, actorRoles)}
                      checked={selectedIds.has(String(req._id))}
                      onChange={() => toggleRow(req._id, req.status, req)}
                      aria-label={`Select ${name}`}
                    />
                    <RowAvatar employee={emp} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-500">{dept}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {format(new Date(req.attendanceDate), 'MMM d, yyyy')}
                        {' · '}
                        <span style={{ color: TEAL }} className="font-medium">
                          {inFmt ?? '—'}
                        </span>
                        {' / '}
                        {outFmt ?? '—'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{getTypeLabel(req.regularizationType)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{req.reason || '—'}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusPill status={req.status} workflowSummary={req.workflowSummary} />
                        <WorkflowStepPill req={req} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Manager: {managerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          title={
                            !canAct
                              ? `Waiting for ${req.workflowSummary?.pendingStep?.approverType || 'next approver'}`
                              : isAdmin ? 'Approve and complete all steps' : 'Approve current step'
                          }
                          disabled={!!actionBusy || !canAct}
                          onClick={() => canAct && handleApproveIds([req._id], { adminBypass: isAdmin })}
                          className="rounded-lg p-2 text-white disabled:opacity-40"
                          style={{ background: canAct ? TEAL : '#94a3b8' }}
                        >
                          {actionBusy === `${req._id}` ? (
                            <FiLoader className="h-4 w-4 animate-spin" />
                          ) : (
                            <FiCheck className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          title={!canAct ? `Waiting for ${req.workflowSummary?.pendingStep?.approverType || 'next approver'}` : 'Reject'}
                          disabled={!!actionBusy || !canAct}
                          onClick={() => canAct && openRejectModal([req._id])}
                          className={`rounded-lg border p-2 disabled:opacity-40 ${
                            canAct
                              ? 'border-red-200 bg-red-50 text-red-600'
                              : 'border-slate-200 bg-slate-100 text-slate-400'
                          }`}
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      title="View"
                      onClick={() => {
                        setRejectReason('');
                        setDrawerReq(req);
                      }}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden max-w-full overflow-x-auto overscroll-x-contain md:block [-webkit-overflow-scrolling:touch]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3 pl-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#0a8f6c]"
                      checked={allPendingSelected}
                      disabled={!filteredRequests.some((r) => r.status === 'pending' && isMyTurn(r, actorRoles))}
                      onChange={toggleSelectAllPending}
                      aria-label="Select all pending"
                    />
                  </th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Request type</th>
                  <th className="min-w-[180px] px-4 py-3">Requested time</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const emp = req.employeeId;
                  const name = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
                  const dept = emp?.department || '';
                  const isPending = req.status === 'pending';
                  const canAct = isPending && isMyTurn(req, actorRoles);
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
                          disabled={!isPending || !isMyTurn(req, actorRoles)}
                          checked={selectedIds.has(String(req._id))}
                          onChange={() => toggleRow(req._id, req.status, req)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <RowAvatar employee={emp} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{name}</div>
                            <div className="text-xs text-slate-500">
                              {[emp?.employeeId, dept].filter((part) => part && part !== '—').join(' · ') || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {getTypeLabel(req.regularizationType)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs text-slate-400">{format(new Date(req.attendanceDate), 'MMM d, yyyy')}</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#0a8f6c]">
                          {inFmt || '—'}
                          <span className="mx-1 font-normal text-slate-400">→</span>
                          {outFmt || '—'}
                        </p>
                      </td>
                      <td className="max-w-[220px] px-4 py-4 text-slate-600">
                        <span className="line-clamp-2" title={req.reason}>
                          {req.reason || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusPill status={req.status} workflowSummary={req.workflowSummary} />
                        <WorkflowStepPill req={req} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 pr-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {isPending && !canAct ? (
                            <span
                              title={`Waiting for ${req.workflowSummary?.pendingStep?.approverType || 'next approver'}`}
                              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-400"
                            >
                              <FiLock className="h-4 w-4" />
                            </span>
                          ) : null}
                          {isPending && canAct ? (
                            <>
                              <button
                                type="button"
                                title={isAdmin ? 'Approve and complete all steps' : 'Approve current step'}
                                disabled={!!actionBusy}
                                onClick={() => handleApproveIds([req._id], { adminBypass: isAdmin })}
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
                            </>
                          ) : null}
                          <button
                            type="button"
                            title="View"
                            onClick={() => {
                              setRejectReason('');
                              setDrawerReq(req);
                            }}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !filteredRequests.length ? (
            <div className="flex flex-col items-center py-14 text-center text-slate-500">
              <FiClock className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No regularization requests match your filters</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-800">{filteredRequests.length}</span> on this page
              {' · '}
              <span className="font-semibold text-slate-800">{pagination.total ?? 0}</span> matching
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

        {activeSection === 'wfh' ? <TeamWfhRequestsPanel onTotalChange={setWfhTotal} /> : null}
      </div>

      {activeSection === 'regularization' && drawerReq ? (() => {
        const inFmt = drawerReq.requestedClockIn
          ? format(new Date(drawerReq.requestedClockIn), 'hh:mm a')
          : null;
        const outFmt = drawerReq.requestedClockOut
          ? format(new Date(drawerReq.requestedClockOut), 'hh:mm a')
          : null;
        const correctionCount = [drawerReq.requestedClockIn, drawerReq.requestedClockOut].filter(Boolean).length;
        const typeLabel = getTypeLabel(drawerReq.regularizationType);
        const auditEvents = (Array.isArray(drawerReq.workflowSummary?.auditTrail)
          ? drawerReq.workflowSummary.auditTrail
          : []
        )
          .map((event) => ({ event, label: formatAuditTimelineEvent(event) }))
          .filter((x) => x.label);
        const drawerCanAct = drawerReq.status === 'pending' && isMyTurn(drawerReq, actorRoles);
        const closeDrawer = () => {
          setDrawerReq(null);
          setRejectReason('');
        };

        return createPortal(
          <div className="fixed inset-0 z-[12000] flex justify-end" role="dialog" aria-modal="true" aria-label="Regularization request">
            <button
              type="button"
              className="absolute inset-0 bg-[#0E2B3D]/60"
              aria-label="Close panel"
              onClick={closeDrawer}
            />
            <aside
              className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
              style={{ boxShadow: '-8px 0 32px rgba(0,0,0,.12)' }}
            >
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Regularization request</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={drawerReq.status} workflowSummary={drawerReq.workflowSummary} />
                    </div>
                    <WorkflowStepPill req={drawerReq} />
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex gap-4">
                    <RowAvatar employee={drawerReq.employeeId} sizeClass="h-14 w-14" />
                    <div className="min-w-0 pt-1">
                      <p className="truncate text-lg font-bold text-slate-900">
                        {[drawerReq.employeeId?.name, drawerReq.employeeId?.lastName]
                          .filter(Boolean)
                          .join(' ')
                          .trim()}
                      </p>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {(drawerReq.employeeId?.position ||
                          drawerReq.employeeId?.department ||
                          'Employee').toUpperCase()}
                      </p>
                      <p className="mt-1 flex items-center gap-1 break-all text-xs text-slate-500">
                        <FiUser className="h-3.5 w-3.5 shrink-0" />
                        {drawerReq.employeeId?.email || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-teal-100 bg-gradient-to-br from-[#0a8f6c]/08 to-transparent p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Attendance correction</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Requested times replace logged attendance for this date.
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div
                      className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white shadow-inner ring-2 ring-[#0a8f6c]/25"
                      style={{
                        background: `conic-gradient(${TEAL} 0deg 280deg, #e2e8f0 280deg 360deg)`,
                      }}
                    >
                      <div className="flex h-[4.75rem] w-[4.75rem] flex-col items-center justify-center rounded-full bg-white px-1 text-center">
                        <span className="text-lg font-black text-[#0a8f6c]">{correctionCount || 1}</span>
                        <span className="text-[9px] font-semibold uppercase leading-tight text-slate-500">
                          {correctionCount === 1 ? 'field' : 'fields'}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {inFmt || outFmt ? 'Corrected times requested' : 'Attendance correction'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {format(new Date(drawerReq.attendanceDate), 'EEEE, MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Correction type &amp; schedule
                  </p>
                  <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase text-slate-800">
                    {typeLabel}
                  </span>
                  {(inFmt || outFmt) && (
                    <p className="text-sm font-semibold text-[#0a8f6c]">
                      {inFmt && outFmt ? `${inFmt} – ${outFmt}` : inFmt || outFmt}
                    </p>
                  )}
                  <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                    <FiCalendar className="mt-0.5 h-4 w-4 shrink-0 text-[#0a8f6c]" />
                    {formatAttendanceDateLine(drawerReq.attendanceDate)}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Reason for change
                  </p>
                  <div className="min-h-[80px] rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-700 shadow-sm">
                    {drawerReq.reason || '—'}
                  </div>
                </div>

                {drawerReq.status === 'rejected' && drawerReq.rejectionReason ? (
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Rejection reason
                    </p>
                    <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-sm text-rose-900">
                      {drawerReq.rejectionReason}
                    </div>
                  </div>
                ) : null}

                {drawerReq.status !== 'pending' && drawerReq.managerResponse ? (
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Decision / notes
                    </p>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                      {drawerReq.managerResponse}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <FiClock className="h-3.5 w-3.5" />
                    Activity
                  </p>
                  <ul className="relative space-y-4 border-l-2 border-slate-100 pl-4">
                    {auditEvents.length > 0
                      ? auditEvents.map(({ event, label }, idx) => (
                          <li key={`${event.action}-${idx}`} className="relative">
                            <span
                              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#0a8f6c]"
                              aria-hidden
                            />
                            <p className="text-xs font-bold text-slate-800">{label}</p>
                            <p className="text-xs text-slate-500">
                              {event.at ? new Date(event.at).toLocaleString() : '—'}
                            </p>
                          </li>
                        ))
                      : [
                          <li key="submitted" className="relative">
                            <span
                              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#0a8f6c]"
                              aria-hidden
                            />
                            <p className="text-xs font-bold text-slate-800">Request submitted</p>
                            <p className="text-xs text-slate-500">
                              {drawerReq.createdAt ? new Date(drawerReq.createdAt).toLocaleString() : '—'}
                            </p>
                          </li>,
                        ]}
                    {drawerReq.status !== 'pending' ? (
                      <li key="final" className="relative">
                        <span
                          className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500"
                          aria-hidden
                        />
                        <p className="text-xs font-bold text-slate-800">
                          {formatLeaveApprovalStageDisplay({
                            status: drawerReq.status,
                            workflowSummary: drawerReq.workflowSummary,
                          })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {drawerReq.updatedAt ? new Date(drawerReq.updatedAt).toLocaleString() : '—'}
                        </p>
                      </li>
                    ) : null}
                  </ul>
                </div>

                {drawerReq.status === 'pending' && drawerCanAct ? (
                  <div className="mt-5">
                    <label
                      htmlFor="reg-drawer-reject-reason"
                      className="text-[10px] font-bold uppercase text-slate-500"
                    >
                      Provide context if rejecting…
                    </label>
                    <textarea
                      id="reg-drawer-reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Explain briefly for the employee…"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-[#0a8f6c]/20 focus:border-[#0a8f6c]/35 focus:ring-2"
                    />
                  </div>
                ) : null}
              </div>

              {drawerReq.status === 'pending' && drawerCanAct ? (
                <div className="flex gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    disabled={!!actionBusy}
                    onClick={() => handleApproveIds([drawerReq._id], { adminBypass: isAdmin })}
                    className="flex-1 rounded-xl py-3 text-sm font-bold text-white shadow disabled:opacity-50"
                    style={{ background: TEAL }}
                  >
                    {isAdmin ? 'Approve & finalize' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={!!actionBusy}
                    onClick={handleRejectFromDrawer}
                    className="flex-1 rounded-xl border-2 py-3 text-sm font-bold text-red-600 disabled:opacity-50"
                    style={{ borderColor: RED }}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </aside>
          </div>,
          document.body
        );
      })() : null}

      {/* Reject modal (single & bulk) */}
      {activeSection === 'regularization' && rejectModalOpen ? createPortal(
        <div className="fixed inset-0 z-[12050] flex items-center justify-center bg-[#0E2B3D]/70 p-4">
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
            <div className="flex flex-wrap justify-end gap-2">
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
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default RegularizationRequests;
