import React, { useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FiSend, FiLoader, FiClock } from 'react-icons/fi';
import '../../styles/wfhRequestUI.css';

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
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatWfhDateRange = (from, to) => {
  if (!from) return '--';
  const fromStr = formatDate(from);
  if (!to || new Date(to).toDateString() === new Date(from).toDateString()) {
    return fromStr;
  }
  return `${fromStr} – ${formatDate(to)}`;
};

const formatWfhType = (wfhType, halfDayType) => {
  const type = wfhType || 'full_day';
  if (type === 'half_day') {
    return halfDayType === 'first_half' ? 'Half Day · Morning' : 'Half Day · Afternoon';
  }
  return 'Full Day';
};

const statusClass = (status) => {
  if (status === 'approved') return 'wfh-ui__pill wfh-ui__pill--approved';
  if (status === 'rejected') return 'wfh-ui__pill wfh-ui__pill--rejected';
  return 'wfh-ui__pill wfh-ui__pill--pending';
};

const emptyToday = () => toDateInput(new Date());

/**
 * Work From Home request panel (informational).
 * Submits a WFH intimation that emails the reporting manager, HR, and admin.
 */
const WfhRequestPanel = () => {
  const [wfhDateFrom, setWfhDateFrom] = useState(emptyToday);
  const [wfhDateTo, setWfhDateTo] = useState(emptyToday);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const isSameDay = Boolean(wfhDateFrom && wfhDateTo && wfhDateFrom === wfhDateTo);

  const resetForm = () => {
    setWfhDateFrom(emptyToday());
    setWfhDateTo(emptyToday());
    setIsHalfDay(false);
    setHalfDayType('');
    setReason('');
    setRemarks('');
  };

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
    if (isHalfDay && !halfDayType) {
      toast.error('Please select First Half or Second Half');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason');
      return;
    }

    try {
      setSubmitting(true);
      const wfhType = isHalfDay ? 'half_day' : 'full_day';
      const res = await axios.post(
        '/v1/both/wfh-requests',
        { wfhDateFrom, wfhDateTo, wfhType, halfDayType, reason: reason.trim(), remarks: remarks.trim() },
        { withCredentials: true }
      );
      toast.success(res.data?.message || 'Work From Home request submitted');
      resetForm();
      fetchMyRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to submit Work From Home request');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (r) => {
    const status = r.status === 'submitted' ? 'pending' : r.status || 'pending';
    return (
      <span
        className={statusClass(status)}
        title={status === 'rejected' && r.reviewNote ? r.reviewNote : undefined}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="wfh-ui space-y-4">
      <form onSubmit={handleSubmit} className="wfh-ui__form">
        <h2 className="wfh-ui__title">New Work From Home Request</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="wfh-ui__label" htmlFor="wfh-date-from">
              From date <span className="text-red-500">*</span>
            </label>
            <input
              id="wfh-date-from"
              type="date"
              value={wfhDateFrom}
              onChange={(e) => {
                const next = e.target.value;
                setWfhDateFrom(next);
                if (wfhDateTo && next > wfhDateTo) {
                  setWfhDateTo(next);
                }
                if (isHalfDay && next !== wfhDateTo) {
                  setIsHalfDay(false);
                  setHalfDayType('');
                }
              }}
              className="wfh-ui__field"
              required
            />
          </div>
          <div>
            <label className="wfh-ui__label" htmlFor="wfh-date-to">
              To date <span className="text-red-500">*</span>
            </label>
            <input
              id="wfh-date-to"
              type="date"
              value={wfhDateTo}
              min={wfhDateFrom}
              onChange={(e) => {
                const next = e.target.value;
                setWfhDateTo(next);
                if (isHalfDay && next !== wfhDateFrom) {
                  setIsHalfDay(false);
                  setHalfDayType('');
                }
              }}
              disabled={isHalfDay}
              className="wfh-ui__field"
              required
            />
          </div>
        </div>

        <div className="wfh-ui__half">
          <label
            className={`wfh-ui__half-check ${!isSameDay ? 'wfh-ui__half-check--disabled' : ''}`}
            htmlFor="half-day-wfh"
            title={!isSameDay ? 'Half day is only available when From and To are the same day' : undefined}
          >
            <input
              type="checkbox"
              id="half-day-wfh"
              checked={isHalfDay}
              disabled={!isSameDay}
              onChange={(e) => {
                setIsHalfDay(e.target.checked);
                if (e.target.checked) {
                  setWfhDateTo(wfhDateFrom);
                }
                setHalfDayType('');
              }}
            />
            Half day WFH
          </label>
          {isHalfDay && (
            <select
              id="half-day-type"
              value={halfDayType}
              onChange={(e) => setHalfDayType(e.target.value)}
              className="wfh-ui__field max-w-[240px] py-1.5"
              required
              aria-label="Half day type"
            >
              <option value="">Select half</option>
              <option value="first_half">First half (morning)</option>
              <option value="second_half">Second half (afternoon)</option>
            </select>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="wfh-ui__label" htmlFor="wfh-reason">
              Reason <span className="text-red-500">*</span>
            </label>
            <div className="wfh-ui__textarea-wrap">
              <textarea
                id="wfh-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Why do you plan to work from home during this period?"
                className="wfh-ui__field"
                required
              />
              <span className="wfh-ui__count">{reason.length}/500</span>
            </div>
          </div>
          <div>
            <label className="wfh-ui__label" htmlFor="wfh-remarks">
              Remarks <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="wfh-ui__textarea-wrap">
              <textarea
                id="wfh-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Any additional information"
                className="wfh-ui__field"
              />
              <span className="wfh-ui__count">{remarks.length}/500</span>
            </div>
          </div>
        </div>

        <div className="wfh-ui__actions">
          <button type="submit" disabled={submitting} className="wfh-ui__submit">
            {submitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSend className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit WFH request'}
          </button>
          <button type="button" className="wfh-ui__cancel" onClick={resetForm} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>

      <section className="wfh-ui__list">
        <div className="wfh-ui__list-head">
          <h3>My WFH requests</h3>
          <p>
            {loadingRequests
              ? 'Loading…'
              : `${requests.length} request${requests.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loadingRequests ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[#64748b]">
            <FiLoader className="h-4 w-4 animate-spin text-[var(--wfh-primary)]" />
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="wfh-ui__empty">No Work From Home requests yet.</div>
        ) : (
          <>
            <div className="wfh-ui__desktop wfh-ui__table-wrap">
              <table className="wfh-ui__table">
                <thead>
                  <tr>
                    <th>WFH period</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Remarks</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r._id}>
                      <td className="whitespace-nowrap font-semibold text-[var(--wfh-navy)]">
                        {formatWfhDateRange(r.wfhDate, r.wfhDateTo)}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="wfh-ui__type">
                          {formatWfhType(r.wfhType, r.halfDayType)}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="max-w-[160px] truncate text-slate-500" title={r.remarks || ''}>
                        {r.remarks || '—'}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <FiClock className="h-3 w-3" />
                          {formatDate(r.createdAt)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">{renderStatus(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="wfh-ui__cards">
              {requests.map((r) => (
                <article key={r._id} className="wfh-ui__card">
                  <div className="wfh-ui__card-row">
                    <div>
                      <p className="text-sm font-semibold text-[var(--wfh-navy)]">
                        {formatWfhDateRange(r.wfhDate, r.wfhDateTo)}
                      </p>
                      <p className="mt-1">
                        <span className="wfh-ui__type">
                          {formatWfhType(r.wfhType, r.halfDayType)}
                        </span>
                      </p>
                    </div>
                    {renderStatus(r)}
                  </div>
                  <dl className="wfh-ui__meta">
                    <div>
                      <dt>Reason</dt>
                      <dd>{r.reason || '—'}</dd>
                    </div>
                    <div>
                      <dt>Remarks</dt>
                      <dd>{r.remarks || '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt>Submitted</dt>
                      <dd className="inline-flex items-center gap-1">
                        <FiClock className="h-3 w-3 text-slate-400" />
                        {formatDate(r.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default WfhRequestPanel;
