import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT } from '../../utils/constant';

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const isAdmin = mode === 'admin';
  const isApproval = mode === 'admin' || mode === 'hr';

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

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.purpose.trim()) {
      toast.error('Please provide a purpose/reason for the request');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/request`, form, { withCredentials: true });
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

  const approve = async (id) => {
    const remarks = window.prompt('Add remarks (optional):') || '';
    try {
      await axios.patch(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/approve`, { remarks }, { withCredentials: true });
      toast.success('Request approved');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to approve'); }
  };

  const reject = async (id) => {
    const reason = window.prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await axios.patch(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/reject`, { reason }, { withCredentials: true });
      toast.success('Request rejected');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to reject'); }
  };

  const upload = async (id, file) => {
    const fd = new FormData();
    fd.append('document', file);
    try {
      await axios.post(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/upload`, fd, { withCredentials: true });
      toast.success('Document uploaded successfully');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to upload document'); }
  };

  const markComplete = async (id) => {
    const remarks = window.prompt('Add completion remarks (optional):') || '';
    try {
      await axios.patch(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/complete`, { remarks }, { withCredentials: true });
      toast.success('Request marked as completed');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to mark as complete'); }
  };

  const deleteRequest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await axios.delete(`${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}`, { withCredentials: true });
      toast.success('Request deleted');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to delete request'); }
  };

  const download = (id) => {
    window.open(`/api${BOTH_EMPLOYEE_DOCUMENT_REQUEST_ENDPOINT}/${id}/download`, '_blank');
  };

  // Filter items by status
  const filteredItems = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter);

  // Status counts for filter pills
  const statusCounts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      {/* Header — HR/Admin mode */}
      {isApproval && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Document Requests</h2>
            <p className="text-xs text-slate-500">Review, approve, and manage employee document requests</p>
          </div>
        </div>
      )}

      {/* New Request Button / Form Toggle — Employee + Admin */}
      {(!isApproval || isAdmin) && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-[#20C997] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1bae83]"
            >
              + New Request
            </button>
          ) : (
            <form onSubmit={submitRequest} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">New Document Request</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Document Type</label>
                  <select value={form.documentType} onChange={(e) => update('documentType', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none">
                    {DOCUMENT_TYPES.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Country</label>
                  <select value={form.country} onChange={(e) => update('country', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none">
                    {COUNTRIES.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Format</label>
                  <select value={form.documentFormat} onChange={(e) => update('documentFormat', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none">
                    {FORMATS.map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Purpose / Remarks *</label>
                  <input
                    value={form.purpose}
                    onChange={(e) => update('purpose', e.target.value)}
                    placeholder="Why do you need this document?"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={submitting} className="rounded-lg bg-[#20C997] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1bae83] disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
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
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === key ? 'bg-slate-900 text-white' : `${cfg.bg} ${cfg.text} hover:opacity-80`}`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Request List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-14">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#20C997]" />
          <p className="mt-3 text-xs text-slate-400">Loading requests...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">{items.length === 0 ? 'No document requests yet.' : 'No requests match the selected filter.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item._id} className="rounded-xl border border-slate-100 bg-white p-4 transition hover:shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900">{item.documentType}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    <span>{item.documentFormat} · {item.documentSize}</span>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.purpose && <span className="truncate max-w-[200px]" title={item.purpose}>{item.purpose}</span>}
                  </div>
                  {/* Remarks / Rejection reason */}
                  {(item.adminRemarks || item.rejectionReason) && (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {item.status === 'rejected' ? <span className="text-red-600">Rejected: {item.rejectionReason}</span> : <span>Remarks: {item.adminRemarks}</span>}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {isApproval && item.status === 'pending' && (
                    <>
                      <button onClick={() => approve(item._id)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Approve</button>
                      <button onClick={() => reject(item._id)} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100">Reject</button>
                    </>
                  )}
                  {isApproval && ['approved', 'uploaded'].includes(item.status) && (
                    <label className="cursor-pointer rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100">
                      Upload
                      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(item._id, e.target.files[0])} />
                    </label>
                  )}
                  {isApproval && ['approved', 'uploaded', 'generated'].includes(item.status) && (
                    <button onClick={() => markComplete(item._id)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Complete</button>
                  )}
                  {(item.fileName || item.fileBinary) && (
                    <button onClick={() => download(item._id)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Download</button>
                  )}
                  <button onClick={() => deleteRequest(item._id)} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
