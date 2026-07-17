import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { FiCheck, FiChevronLeft, FiChevronRight, FiEye, FiHome, FiLoader, FiSearch, FiX } from 'react-icons/fi';
import axios, { getUploadUrl } from '../../utils/axios';

const PAGE_SIZE = 25;

function safeFormat(value, pattern = 'MMM d, yyyy') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, pattern);
}

/** Legacy records created before the approval flow have status 'submitted'. */
function normalizeStatus(status) {
  return status === 'submitted' ? 'pending' : status || 'pending';
}

function WfhStatusPill({ status }) {
  const map = {
    pending: { label: 'PENDING', className: 'bg-red-50 text-red-700 border border-red-200' },
    approved: { label: 'APPROVED', className: 'bg-emerald-50 text-[#0a8f6c] border border-emerald-200' },
    rejected: { label: 'REJECTED', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  };
  const m = map[normalizeStatus(status)] || map.pending;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${m.className}`}>
      {m.label}
    </span>
  );
}

function employeeInitials(employee) {
  return [employee?.name, employee?.lastName]
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function profileSource(employee) {
  const photo = employee?.profilePhoto?.url || employee?.profilePhoto;
  if (!photo || typeof photo !== 'string') return null;
  return getUploadUrl(photo.startsWith('/') ? photo : `/uploads/${photo}`);
}

function EmployeeAvatar({ employee }) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = profileSource(employee);

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0a8f6c] to-[#14b887] text-xs font-bold text-white">
      {source && !imageFailed ? (
        <img
          src={source}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        employeeInitials(employee)
      )}
    </div>
  );
}

const TeamWfhRequestsPanel = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionBusy, setActionBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewTarget, setViewTarget] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/v1/both/wfh-requests/all', {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
        withCredentials: true,
      });
      setRequests(response.data?.requests || []);
      setTotal(response.data?.total || 0);
    } catch {
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endDate, page, startDate]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => {
      const employee = request.employeeId || {};
      return [
        employee.name,
        employee.lastName,
        employee.email,
        employee.employeeId,
        employee.department,
        employee.manager,
        employee.managerId?.name,
        employee.managerId?.lastName,
        request.reason,
        request.remarks,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [requests, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleReview = async (requestId, action, note) => {
    try {
      setActionBusy(requestId);
      const response = await axios.put(
        `/v1/both/wfh-requests/${requestId}/review`,
        { action, ...(note ? { note } : {}) },
        { withCredentials: true }
      );
      toast.success(response.data?.message || `Request ${action}d`);
      setRejectTarget(null);
      setRejectReason('');
      fetchRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${action} request`);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search applications
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by employee, email or reason..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="mt-3 text-xs font-semibold text-[#0a8f6c] hover:underline"
            >
              Clear filters
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date from
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
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
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <FiHome className="h-5 w-5 text-[#0a8f6c]" />
          <h2 className="font-semibold text-slate-900">Work From Home applications</h2>
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#0a8f6c]">
            {total} total
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <FiLoader className="h-5 w-5 animate-spin text-[#0a8f6c]" />
            Loading applications…
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center text-slate-500">
            <FiHome className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No Work From Home applications match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">WFH date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Manager Name</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => {
                  const employee = request.employeeId || {};
                  const name = [employee.name, employee.lastName].filter(Boolean).join(' ') || 'Unknown employee';
                  const linkedManagerName = employee.managerId && typeof employee.managerId === 'object'
                    ? [employee.managerId.name, employee.managerId.lastName].filter(Boolean).join(' ').trim()
                    : '';
                  const managerName = linkedManagerName || employee.manager || '—';
                  const status = normalizeStatus(request.status);
                  const isPending = status === 'pending';
                  const busy = actionBusy === request._id;
                  return (
                    <tr key={request._id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar employee={employee} />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{name}</p>
                            <p className="text-xs text-slate-500">{employee.department || employee.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-700">
                        {safeFormat(request.wfhDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 italic text-slate-400">
                        Work From Home
                      </td>
                      <td className="max-w-[260px] px-4 py-4 text-slate-700">{request.reason || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <WfhStatusPill status={status} />
                        {isPending ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Waiting for manager
                          </p>
                        ) : request.reviewerName ? (
                          <p className="mt-1 text-[11px] text-slate-500">by {request.reviewerName}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {managerName}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        {isPending ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              title="Approve"
                              disabled={!!actionBusy}
                              onClick={() => handleReview(request._id, 'approve')}
                              className="rounded-lg bg-[#0a8f6c] p-2 text-white disabled:opacity-40"
                            >
                              {busy ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              title="Reject"
                              disabled={!!actionBusy}
                              onClick={() => {
                                setRejectTarget(request);
                                setRejectReason('');
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 disabled:opacity-40"
                            >
                              <FiX className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="View"
                              onClick={() => setViewTarget(request)}
                              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                            >
                              <FiEye className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="View"
                            onClick={() => setViewTarget(request)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-xs text-slate-600">
            Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45"
            >
              <FiChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45"
            >
              Next <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewTarget ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close details"
            onClick={() => setViewTarget(null)}
          />
          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">WFH request details</h3>
                <p className="text-xs text-slate-500">Submitted {safeFormat(viewTarget.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close details"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <EmployeeAvatar employee={viewTarget.employeeId} />
                <div>
                  <p className="font-semibold text-slate-900">
                    {[viewTarget.employeeId?.name, viewTarget.employeeId?.lastName].filter(Boolean).join(' ') || 'Unknown employee'}
                  </p>
                  <p className="text-xs text-slate-500">{viewTarget.employeeId?.department || '—'}</p>
                </div>
              </div>
              <section className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WFH date</p>
                <p className="mt-1 font-semibold text-slate-900">{safeFormat(viewTarget.wfhDate, 'EEEE, MMM d, yyyy')}</p>
              </section>
              <section className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</p>
                <p className="mt-2 text-sm text-slate-700">{viewTarget.reason || '—'}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
                <p className="mt-2 text-sm text-slate-700">{viewTarget.remarks || '—'}</p>
              </section>
              <section className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                  <WfhStatusPill status={viewTarget.status} />
                </div>
                {viewTarget.reviewerName ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Reviewed by <span className="font-semibold text-slate-800">{viewTarget.reviewerName}</span>
                  </p>
                ) : null}
                {viewTarget.reviewNote ? (
                  <p className="mt-2 text-sm text-slate-600">{viewTarget.reviewNote}</p>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setRejectTarget(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Reject WFH request</h3>
            <p className="mt-1 text-sm text-slate-600">
              {[rejectTarget.employeeId?.name, rejectTarget.employeeId?.lastName].filter(Boolean).join(' ')} ·{' '}
              {safeFormat(rejectTarget.wfhDate)}
            </p>
            <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rejection reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this request being rejected?"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || actionBusy === rejectTarget._id}
                onClick={() => handleReview(rejectTarget._id, 'reject', rejectReason.trim())}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionBusy === rejectTarget._id ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiX className="h-4 w-4" />}
                Reject request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TeamWfhRequestsPanel;
