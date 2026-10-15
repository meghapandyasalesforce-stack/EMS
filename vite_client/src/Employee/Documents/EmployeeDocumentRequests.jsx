import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT } from '../../utils/constant';
import useDocumentModeSettings from '../../Hooks/useDocumentModeSettings';

const DOCUMENT_TYPES = [
  'Experience Letter', 'Employment Letter', 'Appreciation Letter',
  'Salary Certificate', 'Employment Verification Letter',
  'Joining/Appointment Letter', 'Promotion/Increment Letter',
  'Relieving Letter', 'Other',
];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Other'];
const SIZES = ['A4', 'Letter', 'Legal'];
const FORMATS = ['PDF', 'DOCX', 'TXT'];
const SIGNATURES = ['Authorized Signatory', 'HR Signature', 'Admin Signature', 'Digital Signature'];

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  approved: { label: 'Approved', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  uploaded: { label: 'Uploaded', bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
  generated: { label: 'Generated', bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  completed: { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getEmployeeDisplayName(item) {
  const employee = item?.employeeId;
  if (employee && typeof employee === 'object') {
    const name = [employee.name, employee.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
  }
  const requester = item?.requestedBy;
  if (requester && typeof requester === 'object') {
    const name = [requester.name, requester.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
  }
  return null;
}

const ACTION_MODAL_CONFIG = {
  approve: {
    title: 'Approve request',
    description: 'You can add optional remarks for the employee.',
    label: 'Remarks (optional)',
    placeholder: 'Add any notes for this approval…',
    confirmLabel: 'Approve',
    required: false,
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    iconBg: 'bg-emerald-50 text-emerald-700',
  },
  reject: {
    title: 'Reject request',
    description: 'Please provide a reason so the employee understands the decision.',
    label: 'Rejection reason',
    placeholder: 'Why is this request being rejected?',
    confirmLabel: 'Reject',
    required: true,
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    iconBg: 'bg-red-50 text-red-700',
  },
  complete: {
    title: 'Mark as completed',
    description: 'Optionally add completion remarks for your records.',
    label: 'Remarks (optional)',
    placeholder: 'Add completion notes…',
    confirmLabel: 'Complete',
    required: false,
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    iconBg: 'bg-emerald-50 text-emerald-700',
  },
  delete: {
    title: 'Delete request',
    description: 'This will permanently remove the document request. This action cannot be undone.',
    label: null,
    placeholder: '',
    confirmLabel: 'Delete',
    required: false,
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    iconBg: 'bg-red-50 text-red-700',
  },
};

function ActionModal({ open, action, item, note, setNote, busy, onClose, onConfirm }) {
  if (!open || !action) return null;
  const cfg = ACTION_MODAL_CONFIG[action];
  if (!cfg) return null;
  const employeeName = getEmployeeDisplayName(item);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-request-action-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${cfg.iconBg}`}>
              {action === 'approve' ? '✓' : action === 'reject' ? '!' : action === 'delete' ? '✕' : '•'}
            </div>
            <div className="min-w-0">
              <h3 id="doc-request-action-title" className="text-base font-semibold text-slate-900">
                {cfg.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">{cfg.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          {item && (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{item.documentType}</p>
              {employeeName && <p className="mt-0.5">Requested by {employeeName}</p>}
            </div>
          )}

          {cfg.label && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {cfg.label}
                {cfg.required ? <span className="text-red-500"> *</span> : null}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={cfg.placeholder}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (cfg.required && !note.trim())}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${cfg.confirmClass}`}
          >
            {busy ? 'Please wait…' : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeDocumentRequests({ mode = 'employee' }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    documentType: 'Experience Letter',
    purpose: '',
    country: 'India',
    documentSize: 'A4',
    documentFormat: 'PDF',
    signatureFormat: 'Authorized Signatory',
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = mode === 'admin';
  const isApproval = mode === 'admin' || mode === 'hr';
  const documentModes = useDocumentModeSettings();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [actionModal, setActionModal] = useState(null); // { type, item }
  const [actionNote, setActionNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = isApproval
        ? `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/approvals`
        : `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/my`;
      const { data } = await axios.get(url, { withCredentials: true });
      setItems(data?.data || []);
    } catch (err) {
      toast.error('Failed to load document requests');
    } finally {
      setLoading(false);
    }
  }, [isApproval]);

  useEffect(() => { load(); }, [load]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openActionModal = (type, item) => {
    setActionNote('');
    setActionModal({ type, item });
  };

  const closeActionModal = () => {
    if (actionBusy) return;
    setActionModal(null);
    setActionNote('');
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.purpose.trim()) {
      toast.error('Please provide a purpose/reason for the request');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/request`,
        { ...form, ...(mode === 'employee' ? { requestAsEmployee: true } : {}) },
        { withCredentials: true }
      );
      toast.success('Document request submitted successfully');
      setForm((prev) => ({ ...prev, purpose: '' }));
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAction = async () => {
    if (!actionModal?.item?._id || !actionModal?.type) return;
    const { type, item } = actionModal;
    const cfg = ACTION_MODAL_CONFIG[type];
    if (cfg?.required && !actionNote.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setActionBusy(true);
    try {
      if (type === 'approve') {
        await axios.patch(
          `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${item._id}/approve`,
          { remarks: actionNote.trim() },
          { withCredentials: true }
        );
        toast.success('Request approved');
      } else if (type === 'reject') {
        await axios.patch(
          `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${item._id}/reject`,
          { reason: actionNote.trim() },
          { withCredentials: true }
        );
        toast.success('Request rejected');
      } else if (type === 'complete') {
        await axios.patch(
          `${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${item._id}/complete`,
          { remarks: actionNote.trim() },
          { withCredentials: true }
        );
        toast.success('Request marked as completed');
      } else if (type === 'delete') {
        await axios.delete(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${item._id}`, { withCredentials: true });
        toast.success('Request deleted');
      }
      setActionModal(null);
      setActionNote('');
      if (['approve', 'reject', 'delete', 'complete'].includes(type)) {
        setStatusFilter('all');
      }
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setActionBusy(false);
    }
  };

  const upload = async (id, file) => {
    const fd = new FormData();
    fd.append('document', file);
    try {
      await axios.post(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/upload`, fd, { withCredentials: true });
      toast.success('Document uploaded successfully');
      setStatusFilter('all');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to upload document'); }
  };

  const download = (id) => {
    window.open(`/api${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/download`, '_blank');
  };

  // Filter items by status
  const filteredItems = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter);

  // Status counts for filter pills
  const statusCounts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});

  if (isApproval && documentModes.ready && !documentModes.enableDocumentRequests) {
    return (
      <div className="px-4 py-10 text-sm text-slate-500 sm:px-6">
        Document requests are turned off in settings.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          {isApproval ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#20C997]">Approvals</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">Employee Document Requests</h2>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-900">Raise a request</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ask HR for an official document with purpose and format details.</p>
            </>
          )}
        </div>
        {(!isApproval || isAdmin) && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="shrink-0 self-start rounded-xl bg-[#20C997] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1bae83] sm:self-center"
          >
            + New Request
          </button>
        ) : null}
      </div>

      {(!isApproval || isAdmin) && showForm ? (
            <form onSubmit={submitRequest} className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#20C997]">New request</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-800">Document Request</h3>
                </div>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs font-medium text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Document Type</label>
                  <select value={form.documentType} onChange={(e) => update('documentType', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15">
                    {DOCUMENT_TYPES.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Country</label>
                  <select value={form.country} onChange={(e) => update('country', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15">
                    {COUNTRIES.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Format</label>
                  <select value={form.documentFormat} onChange={(e) => update('documentFormat', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15">
                    {FORMATS.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Purpose / Remarks *</label>
                  <input
                    value={form.purpose}
                    onChange={(e) => update('purpose', e.target.value)}
                    placeholder="Why do you need this document?"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15"
                    required
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button type="submit" disabled={submitting} className="rounded-xl bg-[#20C997] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1bae83] disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
      ) : null}

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All ({items.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = statusCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === key ? 'bg-slate-900 text-white' : `${cfg.bg} ${cfg.text} hover:opacity-80`}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 sm:py-12">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#20C997]" />
            <p className="mt-3 text-xs text-slate-400">Loading requests...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6 sm:py-12">
            <p className="text-sm text-slate-500">
              {items.length === 0
                ? (isApproval ? 'No employee document requests yet.' : 'No document requests yet.')
                : 'No requests match the selected filter.'}
            </p>
            {statusFilter !== 'all' && items.length > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="mt-3 text-xs font-medium text-[#20C997] hover:underline"
              >
                Show all requests
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <div key={item._id} className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{item.documentType}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  {isApproval && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {getEmployeeDisplayName(item)
                          ? `Requested by ${getEmployeeDisplayName(item)}`
                          : 'Requested by employee'}
                      </span>
                      {item.employeeId?.email ? (
                        <span> · {item.employeeId.email}</span>
                      ) : null}
                      {item.employeeId?.employeeId ? (
                        <span> · ID: {item.employeeId.employeeId}</span>
                      ) : null}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span className="rounded-md bg-slate-50 px-2 py-0.5 font-medium text-slate-600">{item.documentFormat}</span>
                    <span className="rounded-md bg-slate-50 px-2 py-0.5 font-medium text-slate-600">{item.documentSize}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.purpose ? <span className="text-slate-400" title={item.purpose}>{item.purpose}</span> : null}
                  </div>
                  {(item.adminRemarks || item.rejectionReason) && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {item.status === 'rejected' ? <span className="text-red-600">Rejected: {item.rejectionReason}</span> : <span>Remarks: {item.adminRemarks}</span>}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:shrink-0 sm:border-0 sm:pt-0">
                  {isApproval && item.status === 'pending' && (
                    <>
                      <button onClick={() => openActionModal('approve', item)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Approve</button>
                      <button onClick={() => openActionModal('reject', item)} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100">Reject</button>
                    </>
                  )}
                  {isApproval && ['approved', 'uploaded'].includes(item.status) && (
                    <label className="cursor-pointer rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100">
                      {item.status === 'uploaded' || item.fileName || item.fileBinary ? 'Reupload' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) upload(item._id, file);
                        }}
                      />
                    </label>
                  )}
                  {isApproval && ['approved', 'uploaded', 'generated'].includes(item.status) && (
                    <button onClick={() => openActionModal('complete', item)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Complete</button>
                  )}
                  {(item.fileName || item.fileBinary) && (
                    <button onClick={() => download(item._id)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Download</button>
                  )}
                  <button onClick={() => openActionModal('delete', item)} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ActionModal
        open={Boolean(actionModal)}
        action={actionModal?.type}
        item={actionModal?.item}
        note={actionNote}
        setNote={setActionNote}
        busy={actionBusy}
        onClose={closeActionModal}
        onConfirm={confirmAction}
      />
    </div>
  );
}
