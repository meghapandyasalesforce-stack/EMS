import React, { useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FiHome, FiSend, FiLoader, FiClock } from 'react-icons/fi';

const toDateInput = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (value) => {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const formatWfhDateRange = (from, to) => {
  if (!from) return '--';
  const fromStr = formatDate(from);
  if (!to || new Date(to).toDateString() === new Date(from).toDateString()) {
    return fromStr;
  }
  return `${fromStr} – ${formatDate(to)}`;
};

/**
 * Work From Home request panel (informational).
 * Submits a WFH intimation that emails the reporting manager, HR, and admin.
 * Completely independent from punch-in, leave, and regularization.
 */
const WfhRequestPanel = () => {
  const [wfhDateFrom, setWfhDateFrom] = useState(toDateInput(new Date()));
  const [wfhDateTo, setWfhDateTo] = useState(toDateInput(new Date()));
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchMyRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await axios.get('/v1/both/wfh-requests/my', { withCredentials: true });
      setRequests(res.data?.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wfhDateFrom) {
      toast.error('Please select the WFH start date');
      return;
    }
    if (!wfhDateTo) {
      toast.error('Please select the WFH end date');
      return;
    }
    if (new Date(wfhDateTo) < new Date(wfhDateFrom)) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(
        '/v1/both/wfh-requests',
        { wfhDateFrom, wfhDateTo, reason: reason.trim(), remarks: remarks.trim() },
        { withCredentials: true }
      );
      toast.success(res.data?.message || 'Work From Home request submitted');
      setReason('');
      setRemarks('');
      fetchMyRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit Work From Home request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] px-4 py-3 text-sm text-[#0C4A6E]">
        <p className="font-semibold">Work From Home intimation</p>
        <p className="mt-1">
          Use this form to formally inform your reporting manager, HR, and admin that you plan to work from home.
          An email will be sent on your behalf. This does not block or approve your punch-in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FiHome className="h-5 w-5 text-[#20C997]" />
          <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">New WFH request</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#475569]" htmlFor="wfh-date-from">
              From Date <span className="text-red-500">*</span>
            </label>
            <input
              id="wfh-date-from"
              type="date"
              value={wfhDateFrom}
              onChange={(e) => {
                setWfhDateFrom(e.target.value);
                if (wfhDateTo && e.target.value > wfhDateTo) {
                  setWfhDateTo(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#20C997] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#475569]" htmlFor="wfh-date-to">
              To Date <span className="text-red-500">*</span>
            </label>
            <input
              id="wfh-date-to"
              type="date"
              value={wfhDateTo}
              min={wfhDateFrom}
              onChange={(e) => setWfhDateTo(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#20C997] focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#475569]" htmlFor="wfh-reason">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="wfh-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why do you plan to work from home during this period?"
            className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#20C997] focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#475569]" htmlFor="wfh-remarks">
            Remarks <span className="text-[#94A3B8]">(optional)</span>
          </label>
          <textarea
            id="wfh-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Any additional information"
            className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#20C997] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition ${
            submitting ? 'cursor-not-allowed bg-slate-300' : 'bg-[#20C997] hover:bg-[#1ab589]'
          }`}
        >
          {submitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSend className="h-4 w-4" />}
          {submitting ? 'Submitting…' : 'Submit WFH Request'}
        </button>
      </form>

      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#334155]">My WFH requests</p>
        {loadingRequests ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#64748B]">
            <FiLoader className="h-4 w-4 animate-spin" />
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-8 text-center text-sm text-[#64748B]">
            No Work From Home requests yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
            <table className="min-w-full divide-y divide-[#E2E8F0] text-sm">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">WFH Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">Remarks</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] bg-white">
                {requests.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0F172A]">{formatWfhDateRange(r.wfhDate, r.wfhDateTo)}</td>
                    <td className="max-w-[240px] px-4 py-3 text-[#334155]">{r.reason}</td>
                    <td className="max-w-[200px] px-4 py-3 text-[#64748B]">{r.remarks || '--'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <FiClock className="h-3.5 w-3.5" />
                        {formatDate(r.createdAt)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {(() => {
                        const status = r.status === 'submitted' ? 'pending' : (r.status || 'pending');
                        const styles = {
                          pending: 'bg-[#FEF3C7] text-[#B45309]',
                          approved: 'bg-[#D1FAE5] text-[#047857]',
                          rejected: 'bg-[#FEE2E2] text-[#B91C1C]',
                        };
                        return (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[status] || styles.pending}`}
                            title={status === 'rejected' && r.reviewNote ? r.reviewNote : undefined}
                          >
                            {status}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WfhRequestPanel;
