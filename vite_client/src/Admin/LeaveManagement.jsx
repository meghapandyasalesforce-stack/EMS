import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiSearch,
  FiCheck,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiClock,
  FiUser,
  FiPaperclip,
  FiEye,
} from 'react-icons/fi';
import { getAllLeaves, updateLeave } from '../context/leaveSlice';
import { toast } from 'react-toastify';
import axios, { getUploadUrl } from '../utils/axios';
import { ADMIN_LEAVE_ENDPOINT } from '../utils/constant';
import useAuthPermissions from '../Hooks/useAuthPermissions';
import { isHR } from '../utils/managerHelper';
import {
  formatAuditTimelineEvent,
  formatCapitalRequestStatus,
  formatLeaveApprovalStageDisplay,
  getWorkflowWaitingLabel,
} from '../utils/approvalStatusDisplay';
import 'react-toastify/dist/ReactToastify.css';

const TEAL = '#20C997';
const TEAL_DARK = '#0a8f6c';

function leaveStatusPillStyle(status) {
  const st = (status || '').toLowerCase();
  if (st === 'approved') {
    return { background: `${TEAL}14`, color: TEAL_DARK, border: `1px solid ${TEAL}44` };
  }
  if (st === 'rejected') {
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
  }
  if (st === 'cancelled') {
    return { background: '#fafafa', color: '#737373', border: '1px solid #e5e5e5' };
  }
  return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
}

function closeLeavePanel(setSelectedId, setRejectReason) {
  setSelectedId(null);
  setRejectReason('');
}

const LEAVE_TYPE_META = {
  sick: { label: 'SICK LEAVE', className: 'bg-rose-50 text-rose-700 border border-rose-100' },
  annual: { label: 'ANNUAL LEAVE', className: 'bg-teal-50 text-teal-800 border border-teal-100' },
  casual: { label: 'CASUAL LEAVE', className: 'bg-teal-50 text-teal-800 border border-teal-100' },
  paid: { label: 'PAID LEAVE', className: 'bg-teal-50 text-teal-800 border border-teal-100' },
  vacation: { label: 'VACATION', className: 'bg-teal-50 text-teal-800 border border-teal-100' },
  maternity: { label: 'MATERNITY', className: 'bg-sky-50 text-sky-800 border border-sky-100' },
  paternity: { label: 'PATERNITY', className: 'bg-sky-50 text-sky-800 border border-sky-100' },
  privileged: { label: 'PRIVILEGED', className: 'bg-teal-50 text-teal-800 border border-teal-100' },
  compensatory: { label: 'COMP OFF', className: 'bg-amber-50 text-amber-800 border border-amber-100' },
  sabbatical: { label: 'SABBATICAL', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  loss_of_pay: { label: 'UNPAID / LOP', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

function formatLeaveRange(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const optShort = { month: 'short', day: 'numeric' };
  const optLong = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  if (sameMonth) {
    return `${a.toLocaleDateString('en-US', optShort)} – ${b.toLocaleDateString('en-US', optShort)}, ${b.getFullYear()}`;
  }
  return `${a.toLocaleDateString('en-US', optLong)} – ${b.toLocaleDateString('en-US', optLong)}`;
}

function formatShortRange(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const shortFmt = { month: 'short', day: 'numeric' };
  if (sameMonth) {
    return `${a.toLocaleDateString('en-US', shortFmt)} – ${b.toLocaleDateString('en-US', shortFmt)}`;
  }
  return `${a.toLocaleDateString('en-US', shortFmt)} – ${b.toLocaleDateString('en-US', shortFmt)}`;
}

function initialsFromLeave(leave) {
  const em = leave?.employee;
  if (em?.name) {
    const bit = [em.name, em.lastName].filter(Boolean).join(' ').trim();
    return bit
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }
  const n = leave?.employeeName || '?';
  return (
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function employeeDisplayName(leave) {
  const em = leave?.employee;
  if (em?.name) {
    return [em.name, em.lastName].filter(Boolean).join(' ').trim() || leave.employeeName;
  }
  return leave?.employeeName || 'Unknown';
}

function jobTitleLabel(leave) {
  const em = leave?.employee;
  return em?.jobTitle || em?.designation || em?.position || '—';
}

function managerDisplayName(leave) {
  const em = leave?.employee;
  if (em?.manager) {
    if (typeof em.manager === 'string' && em.manager.trim()) return em.manager.trim();
    if (typeof em.manager === 'object') {
      const name = [em.manager.name, em.manager.lastName].filter(Boolean).join(' ').trim();
      if (name) return name;
    }
  }

  const steps = leave?.workflowSummary?.steps || [];
  const managerStep = steps.find(
    (s) =>
      s?.approverType === 'Manager' ||
      /manager/i.test(String(s?.stepName || ''))
  );
  if (managerStep?.approverName) return managerStep.approverName;

  const pending = leave?.workflowSummary?.pendingStep;
  if (pending?.approverType === 'Manager' && pending.approverName) {
    return pending.approverName;
  }

  return '—';
}

function profilePhotoSrc(leave) {
  const emp = leave?.employee;
  const photoRef = emp?.profilePhoto?.url || emp?.profilePhoto;
  if (!photoRef) return null;
  if (typeof photoRef === 'string') {
    return getUploadUrl(photoRef.startsWith('/') ? photoRef : `/uploads/${photoRef}`);
  }
  return getUploadUrl(photoRef.url || photoRef);
}

function leaveDocumentUrl(documentPath) {
  if (!documentPath || typeof documentPath !== 'string') return null;
  const normalized = documentPath.startsWith('/')
    ? documentPath
    : `/uploads/${documentPath.replace(/^uploads\//, '')}`;
  return getUploadUrl(normalized);
}

function RowAvatar({ leave, sizeClass = 'h-10 w-10 text-xs', roundedClass = 'rounded-full' }) {
  const [broken, setBroken] = useState(false);
  const url = profilePhotoSrc(leave);
  const initials = initialsFromLeave(leave);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#20C997]/90 to-[#0a8f6c] font-bold text-white ${roundedClass} ${sizeClass}`}
    >
      {url && !broken ? (
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </div>
  );
}

function computeStatusCounts(list, year) {
  const base = { pending: 0, approved: 0, rejected: 0 };
  (list || []).forEach((l) => {
    const y = Number(l.year) || new Date(l.startDate).getFullYear();
    if (y !== year) return;
    const s = (l.status || '').toLowerCase();
    if (s === 'pending') base.pending += 1;
    else if (s === 'approved') base.approved += 1;
    else if (s === 'rejected') base.rejected += 1;
  });
  return base;
}

const LeaveManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { leaves, loading, error } = useSelector((state) => state.leave);
  const currentUser = useSelector((state) => state.auth?.user);
  const sessionEmployee = useSelector((state) => state.employeeDetails?.employee);
  const { isHrManager, isHrExecutive } = useAuthPermissions();
  const showManagerColumn =
    isHrManager || isHrExecutive || isHR(currentUser) || isHR(sessionEmployee);

  const [selectedId, setSelectedId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(null);
  const [page, setPage] = useState(1);
  /** Unfiltered slice (same year cap) so header badges stay meaningful when tab filters API results */
  const [summaryLeaves, setSummaryLeaves] = useState([]);

  const fetchParams = useMemo(() => {
    const params = {
      year: filterYear,
      limit: 100,
      page,
    };
    if (filterStatus !== 'all') params.status = filterStatus;
    return params;
  }, [filterYear, filterStatus, page]);

  const reload = useCallback(() => {
    dispatch(getAllLeaves(fetchParams));
  }, [dispatch, fetchParams]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${ADMIN_LEAVE_ENDPOINT}/get-all-leaves`, {
          params: { year: filterYear, limit: 100, page: 1 },
          withCredentials: true,
        });
        if (!cancelled) setSummaryLeaves(Array.isArray(data.leaves) ? data.leaves : []);
      } catch {
        if (!cancelled) setSummaryLeaves([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterYear]);

  const selectedLeave = useMemo(
    () => (leaves || []).find((l) => l._id === selectedId) || null,
    [leaves, selectedId]
  );

  const statusCounts = useMemo(
    () => computeStatusCounts(summaryLeaves, filterYear),
    [summaryLeaves, filterYear]
  );

  const clientFiltered = useMemo(() => {
    let list = leaves || [];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const name = employeeDisplayName(l).toLowerCase();
        return name.includes(q) || (l.employeeName || '').toLowerCase().includes(q);
      });
    }

    if (typeFilter !== 'all') {
      list = list.filter((l) => l.leaveType === typeFilter);
    }

    if (monthFilter != null) {
      list = list.filter((l) => {
        const d = new Date(l.startDate);
        return d.getMonth() === monthFilter && d.getFullYear() === filterYear;
      });
    }

    return list;
  }, [leaves, search, typeFilter, monthFilter, filterYear]);

  const handleTab = (tab) => {
    setFilterStatus(tab);
    setPage(1);
    setSelectedId(null);
    setRejectReason('');
  };

  const handleApprove = async (id) => {
    try {
      const result = await dispatch(updateLeave({ id, updatedData: { status: 'approved' } })).unwrap();
      const workflowStillInProgress = Boolean(result?.workflowStillInProgress);
      const updatedLeave = result?.leave;

      if (workflowStillInProgress) {
        toast.info(result?.message || 'Leave approved at current step. Pending HR verification.');
      } else {
        toast.success(result?.message || 'Leave approved successfully!');
      }

      reload();
      if (updatedLeave?._id) {
        setSummaryLeaves((prev) =>
          prev.map((l) => (String(l._id) === String(id) ? { ...l, ...updatedLeave } : l))
        );
      }
      setRejectReason('');
    } catch (err) {
      const msg =
        typeof err === 'string' ? err : err?.message || err?.error || 'Failed to approve leave';
      toast.error(`Failed to approve: ${msg}`);
    }
  };

  const handleReject = async (id) => {
    const trimmed = rejectReason?.trim();
    if (!trimmed) {
      toast.warning('Please provide a rejection reason');
      return;
    }

    try {
      await dispatch(
        updateLeave({
          id,
          updatedData: { status: 'rejected', rejectionReason: trimmed },
        })
      ).unwrap();
      toast.success('Leave rejected successfully!');
      setRejectReason('');
      setSelectedId(null);
      reload();
      setSummaryLeaves((prev) =>
        prev.map((l) =>
          String(l._id) === String(id) ? { ...l, status: 'rejected', rejectionReason: trimmed } : l
        )
      );
    } catch (err) {
      const msg =
        typeof err === 'string' ? err : err?.message || err?.error || 'Failed to reject leave';
      toast.error(`Failed to reject: ${msg}`);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading && (!leaves || leaves.length === 0)) {
    return (
      <div className="mt-5 flex min-h-[60vh] items-center justify-center lg:mt-0">
        <div className="text-sm text-slate-500">Loading leave requests…</div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen bg-[#F4F6FB] pb-10 transition-all duration-300 lg:mt-0">
      <div className="page-shell-inner hrms-stack">
        <div className="min-w-0 space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leave Management</h1>
              <p className="mt-1 text-sm text-slate-600">
                Review and manage team absence requests.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {statusCounts.pending} Pending
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#20C997]" />
                {statusCounts.approved} Approved
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {statusCounts.rejected} Rejected
              </span>
              <p className="w-full text-[11px] text-slate-400 sm:w-auto sm:pl-1">
                Counts: first 100 in {filterYear}
              </p>
            </div>
          </header>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {typeof error === 'string' ? error : error?.message || 'An error occurred'}
            </div>
          )}

          <div className="flex min-w-0 max-w-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative min-w-0 w-full sm:min-w-[200px] flex-1 lg:max-w-md">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none ring-[#20C997]/25 transition focus:border-[#20C997]/40 focus:ring-2"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-[#20C997]/40"
              >
                <option value="all">All Types</option>
                {Object.keys(LEAVE_TYPE_META).map((key) => (
                  <option key={key} value={key}>
                    {(LEAVE_TYPE_META[key]?.label || key).replace(/\s+/g, ' ')}
                  </option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {monthNames.map((label, idx) => {
                const active = monthFilter === idx;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMonthFilter(active ? null : idx)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'bg-[#20C997]/15 text-[#0a8f6c] ring-2 ring-[#20C997]/35'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                    {active ? (
                      <span className="ml-1 text-slate-500" aria-hidden>
                        ×
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 border-b border-slate-100 pb-0 overflow-x-auto">
              {[
                { key: 'all', label: 'ALL' },
                { key: 'pending', label: 'PENDING REVIEW' },
                { key: 'approved', label: 'APPROVED' },
                { key: 'rejected', label: 'REJECTED' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTab(t.key)}
                  className={`relative shrink-0 pb-3 whitespace-nowrap text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
                    filterStatus === t.key ? 'text-[#0a8f6c]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {filterStatus === t.key && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ backgroundColor: TEAL }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="min-w-0 max-w-full rounded-xl border border-slate-100 lg:overflow-hidden">
              {clientFiltered.length === 0 ? (
                <div className="bg-white px-6 py-8 sm:py-10 text-center">
                  <FiCalendar className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-900">No leave requests match filters</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another status tab, search, or year.
                  </p>
                </div>
              ) : (
                <div
                  className="table-scroll-container leave-requests-table-scroll bg-white"
                  role="region"
                  aria-label="Leave requests table"
                >
                  <table className="leave-requests-table text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="w-10 px-3 py-3" aria-hidden />
                        <th className="px-3 py-3">Employee</th>
                        <th className="px-3 py-3">Leave Type</th>
                        <th className="px-3 py-3">From – To</th>
                        <th className="px-3 py-3">Days</th>
                        <th className="px-3 py-3">Status</th>
                        {showManagerColumn && <th className="px-3 py-3">Manager</th>}
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientFiltered.map((leave) => {
                        const id = leave._id;
                        const selected = selectedId === id;
                        const meta =
                          LEAVE_TYPE_META[leave.leaveType] || {
                            label: (leave.leaveType || '').replace(/_/g, ' ').toUpperCase(),
                            className: 'bg-slate-100 text-slate-700 border border-slate-200',
                          };
                        const st = (leave.status || '').toLowerCase();
                        let statusDot = 'bg-amber-500';
                        let statusBg = 'text-amber-800';
                        if (st === 'approved') {
                          statusDot = 'bg-[#20C997]';
                          statusBg = 'text-teal-800';
                        } else if (st === 'rejected') {
                          statusDot = 'bg-slate-400';
                          statusBg = 'text-slate-700';
                        }

                        return (
                          <tr
                            key={String(id)}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedId(id);
                              setRejectReason('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedId(id);
                                setRejectReason('');
                              }
                            }}
                            className={`cursor-pointer transition ${
                              selected ? 'bg-[#20C997]/08' : 'hover:bg-slate-50/90'
                            }`}
                          >
                            <td className="px-3 py-3" />
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <RowAvatar leave={leave} />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {employeeDisplayName(leave)}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {jobTitleLabel(leave)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-block rounded-md px-2 py-1 text-[10px] font-bold ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-700">
                              {formatShortRange(leave.startDate, leave.endDate)}
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-800">
                              {leave.duration ?? '—'}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-semibold capitalize ${statusBg}`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${statusDot}`} />
                                  {formatLeaveApprovalStageDisplay(leave)}
                                </span>
                              </div>
                            </td>
                            {showManagerColumn && (
                              <td className="px-3 py-3 text-slate-700">
                                <span className="font-medium text-slate-800">
                                  {managerDisplayName(leave)}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-3 text-right">
                              <div
                                className="inline-flex items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {st === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      title="Approve"
                                      onClick={() => handleApprove(id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#20C997]/15 text-[#0a8f6c] hover:bg-[#20C997]/25"
                                    >
                                      <FiCheck className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Reject"
                                      onClick={() => {
                                        setSelectedId(id);
                                        setRejectReason('');
                                      }}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                                    >
                                      <FiX className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  title="View"
                                  onClick={() => {
                                    setSelectedId(id);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing{' '}
                <span className="font-semibold text-slate-900">{clientFiltered.length}</span>{' '}
                request{clientFiltered.length === 1 ? '' : 's'} (matching filters)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center text-xs font-semibold text-slate-700">
                  Page {page}
                </span>
                <button
                  type="button"
                  disabled={(leaves?.length || 0) < 100 || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/leave')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 sm:w-auto lg:hidden"
            style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_DARK})` }}
          >
            + New Request
          </button>
        </div>
      </div>

      {selectedLeave ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Leave request details"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close panel"
            onClick={() => closeLeavePanel(setSelectedId, setRejectReason)}
          />
          <aside
            className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
            style={{ boxShadow: '-8px 0 32px rgba(0,0,0,.12)' }}
          >
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Leave request</p>
                  <div className="mt-2">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                      style={leaveStatusPillStyle(selectedLeave.status)}
                    >
                      {formatCapitalRequestStatus(selectedLeave.status)}
                    </span>
                  </div>
                  {(selectedLeave.status || '').toLowerCase() === 'pending' ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                      {getWorkflowWaitingLabel(selectedLeave.workflowSummary) ||
                        formatLeaveApprovalStageDisplay(selectedLeave)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => closeLeavePanel(setSelectedId, setRejectReason)}
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
                    <RowAvatar
                      leave={selectedLeave}
                      sizeClass="h-14 w-14 text-lg"
                      roundedClass="rounded-2xl"
                    />
                    <div className="min-w-0 pt-1">
                      <p className="truncate text-lg font-bold text-slate-900">
                        {employeeDisplayName(selectedLeave)}
                      </p>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {(selectedLeave.employee?.department || '—').toUpperCase()}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <FiUser className="h-3.5 w-3.5 shrink-0" />
                        {selectedLeave.employee?.email || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-teal-100 bg-gradient-to-br from-[#20C997]/08 to-transparent p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Requested days
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Full leave balance sync is available under HR/admin tools.
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div
                      className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white shadow-inner ring-2 ring-[#20C997]/25"
                      style={{
                        background: `conic-gradient(${TEAL} 0deg 230deg, #e2e8f0 230deg 360deg)`,
                      }}
                    >
                      <div className="flex h-[4.75rem] w-[4.75rem] flex-col items-center justify-center rounded-full bg-white">
                        <span className="text-lg font-black text-[#0a8f6c]">
                          {selectedLeave.duration}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-slate-500">
                          days
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{selectedLeave.duration} days requested</p>
                      <p className="text-xs text-slate-600">
                        {formatLeaveRange(selectedLeave.startDate, selectedLeave.endDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Leave type &amp; duration
                  </p>
                  <span
                    className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${(LEAVE_TYPE_META[selectedLeave.leaveType] || LEAVE_TYPE_META.casual).className}`}
                  >
                    {(LEAVE_TYPE_META[selectedLeave.leaveType]?.label || selectedLeave.leaveType || '')
                      .toString()
                      .replace(/_/g, ' ')
                      .toUpperCase()}
                  </span>
                  <p className="text-sm font-semibold text-[#0a8f6c]">
                    {selectedLeave.duration} Days Total
                  </p>
                  <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                    <FiCalendar className="mt-0.5 h-4 w-4 shrink-0 text-[#20C997]" />
                    {formatLeaveRange(selectedLeave.startDate, selectedLeave.endDate)}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Reason for absence
                  </p>
                  <div className="min-h-[80px] rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-700 shadow-sm">
                    {selectedLeave.reason || '—'}
                  </div>
                </div>

                {selectedLeave.document && leaveDocumentUrl(selectedLeave.document) && (
                  <div className="mt-5">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <FiPaperclip className="h-3.5 w-3.5" />
                      Supporting document
                    </p>
                    <a
                      href={leaveDocumentUrl(selectedLeave.document)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-2.5 text-sm font-semibold text-[#0a8f6c] hover:bg-teal-50"
                    >
                      <FiPaperclip className="h-4 w-4" />
                      View attached document
                    </a>
                  </div>
                )}

                {selectedLeave.status === 'rejected' && selectedLeave.rejectionReason && (
                  <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Rejection reason
                    </p>
                    <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-sm text-rose-900">
                      {selectedLeave.rejectionReason}
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <FiClock className="h-3.5 w-3.5" />
                    Activity
                  </p>
                  <ul className="relative space-y-4 border-l-2 border-slate-100 pl-4">
                    {(Array.isArray(selectedLeave.workflowSummary?.auditTrail) &&
                    selectedLeave.workflowSummary.auditTrail.length > 0
                      ? selectedLeave.workflowSummary.auditTrail.map((event, idx) => {
                          const label = formatAuditTimelineEvent(event);
                          if (!label) return null;
                          return (
                            <li key={`${event.action}-${idx}`} className="relative">
                              <span
                                className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#20C997]"
                                aria-hidden
                              />
                              <p className="text-xs font-bold text-slate-800">{label}</p>
                              <p className="text-xs text-slate-500">
                                {event.at ? new Date(event.at).toLocaleString() : '—'}
                              </p>
                            </li>
                          );
                        }).filter(Boolean)
                      : [
                          <li key="submitted" className="relative">
                            <span
                              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#20C997]"
                              aria-hidden
                            />
                            <p className="text-xs font-bold text-slate-800">Request submitted</p>
                            <p className="text-xs text-slate-500">
                              {selectedLeave.createdAt
                                ? new Date(selectedLeave.createdAt).toLocaleString()
                                : '—'}
                            </p>
                          </li>,
                          (selectedLeave.status || '').toLowerCase() === 'pending' &&
                          selectedLeave.approvalStage ? (
                            <li key="stage" className="relative">
                              <span
                                className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-400"
                                aria-hidden
                              />
                              <p className="text-xs font-bold text-slate-800">
                                {formatLeaveApprovalStageDisplay(selectedLeave)}
                              </p>
                            </li>
                          ) : null,
                          (selectedLeave.status || '').toLowerCase() !== 'pending' ? (
                            <li key="final" className="relative">
                              <span
                                className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500"
                                aria-hidden
                              />
                              <p className="text-xs font-bold text-slate-800">
                                {formatLeaveApprovalStageDisplay(selectedLeave)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {selectedLeave.updatedAt
                                  ? new Date(selectedLeave.updatedAt).toLocaleString()
                                  : '—'}
                              </p>
                            </li>
                          ) : null,
                        ].filter(Boolean))}
                  </ul>
                </div>

                {(selectedLeave.status || '').toLowerCase() === 'pending' && (
                  <div className="mt-5">
                    <label
                      htmlFor="lm-reject-reason"
                      className="text-[10px] font-bold uppercase text-slate-500"
                    >
                      Provide context if rejecting…
                    </label>
                    <textarea
                      id="lm-reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Explain briefly for the employee…"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-[#20C997]/20 focus:border-[#20C997]/35 focus:ring-2"
                    />
                  </div>
                )}
              </div>

              {(selectedLeave.status || '').toLowerCase() === 'pending' && (
                <div className="flex gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedLeave._id)}
                    className="flex-1 rounded-xl py-3 text-sm font-bold text-white shadow-md"
                    style={{ background: TEAL_DARK }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedLeave._id)}
                    className="flex-1 rounded-xl border-2 border-red-400 py-3 text-sm font-bold text-red-600"
                  >
                    Reject
                  </button>
                </div>
              )}
          </aside>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-8 right-8 z-30 hidden lg:block">
        <button
          type="button"
          onClick={() => navigate('/leave')}
          className="pointer-events-auto rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
          style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_DARK})` }}
        >
          + New Request
        </button>
      </div>
    </div>
  );
};

export default LeaveManagement;
