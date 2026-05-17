import React, { useState } from 'react';
import { FaComments, FaPlus, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import { feedbackStatusStyle } from './engagementUtils';

const MINT = '#20C997';

const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20';

const FeedbackPanel = ({
    feedback,
    filteredFeedback,
    isManagerUser,
    canSubmitFeedback,
    searchQuery,
    onRefresh,
}) => {
    const [submitOpen, setSubmitOpen] = useState(false);
    const [detailItem, setDetailItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hrResponse, setHrResponse] = useState('');
    const [statusDraft, setStatusDraft] = useState('Open');
    const [form, setForm] = useState({
        subject: '',
        message: '',
        type: 'Suggestion',
        category: 'Other',
        priority: 'Medium',
        anonymous: false,
    });

    const openDetail = (item) => {
        setDetailItem(item);
        setStatusDraft(item.status || 'Open');
        setHrResponse('');
    };

    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.message.trim()) {
            toast.error('Subject and message are required');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post('/v1/both/engagement/feedback', form, { withCredentials: true });
            toast.success('Feedback submitted');
            setSubmitOpen(false);
            setForm({
                subject: '',
                message: '',
                type: 'Suggestion',
                category: 'Other',
                priority: 'Medium',
                anonymous: false,
            });
            onRefresh();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateFeedback = async () => {
        if (!detailItem?._id) return;
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/feedback/${detailItem._id}`,
                {
                    status: statusDraft,
                    hrResponse: hrResponse.trim() || undefined,
                },
                { withCredentials: true }
            );
            toast.success('Feedback updated');
            setDetailItem(null);
            onRefresh();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update feedback');
        } finally {
            setSaving(false);
        }
    };

    const employeeLabel = (item) => {
        if (item.anonymous) return 'Anonymous';
        const emp = item.employeeId || {};
        return `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—';
    };

    return (
        <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                    {isManagerUser
                        ? 'Review and respond to employee feedback'
                        : 'Your submitted feedback'}
                </p>
                {canSubmitFeedback && (
                    <button
                        type="button"
                        onClick={() => setSubmitOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: MINT_GRADIENT }}
                    >
                        <FaPlus className="h-3.5 w-3.5" />
                        Submit Feedback
                    </button>
                )}
            </div>

            {filteredFeedback.length === 0 ? (
                <div className="py-16 text-center">
                    <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                        style={{ background: `${MINT}20` }}
                    >
                        <FaComments className="h-8 w-8" style={{ color: MINT }} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No feedback yet</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        {searchQuery
                            ? 'Try a different search term.'
                            : canSubmitFeedback
                              ? 'Share a suggestion or concern with HR.'
                              : 'No feedback records to show.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                {isManagerUser && (
                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Employee
                                    </th>
                                )}
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Subject
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Type
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Date
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFeedback.map((item) => (
                                <tr
                                    key={item._id}
                                    className="border-b border-slate-50 hover:bg-slate-50/50"
                                >
                                    {isManagerUser && (
                                        <td className="px-5 py-4 text-slate-700">
                                            {employeeLabel(item)}
                                        </td>
                                    )}
                                    <td className="px-5 py-4 font-medium text-slate-900">
                                        {item.subject}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="rounded-full bg-[#20C997]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0d9488]">
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(item.status)}`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-slate-600">
                                        {item.createdAt
                                            ? new Date(item.createdAt).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td className="px-5 py-4">
                                        <button
                                            type="button"
                                            onClick={() => openDetail(item)}
                                            className="text-sm font-semibold text-[#0d9488] hover:underline"
                                        >
                                            {isManagerUser ? 'Manage' : 'View'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {submitOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Submit Feedback</h3>
                            <button
                                type="button"
                                onClick={() => setSubmitOpen(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitFeedback} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Subject *
                                </label>
                                <input
                                    className={inputClass}
                                    value={form.subject}
                                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Message *
                                </label>
                                <textarea
                                    className={inputClass}
                                    rows={4}
                                    value={form.message}
                                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                                    <select
                                        className={inputClass}
                                        value={form.type}
                                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                                    >
                                        <option value="Suggestion">Suggestion</option>
                                        <option value="Complaint">Complaint</option>
                                        <option value="Appreciation">Appreciation</option>
                                        <option value="Question">Question</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">
                                        Category
                                    </label>
                                    <select
                                        className={inputClass}
                                        value={form.category}
                                        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                                    >
                                        <option value="Work Environment">Work Environment</option>
                                        <option value="Management">Management</option>
                                        <option value="Benefits">Benefits</option>
                                        <option value="Process">Process</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Training">Training</option>
                                        <option value="Culture">Culture</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={form.anonymous}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, anonymous: e.target.checked }))
                                    }
                                />
                                Submit anonymously
                            </label>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSubmitOpen(false)}
                                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    {submitting ? 'Sending...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">{detailItem.subject}</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {employeeLabel(detailItem)} • {detailItem.type}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailItem(null)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{detailItem.message}</p>
                        {Array.isArray(detailItem.responses) && detailItem.responses.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-xs font-semibold uppercase text-slate-500">HR replies</p>
                                {detailItem.responses.map((r, i) => (
                                    <div key={i} className="rounded-lg border border-slate-100 bg-emerald-50/50 p-3 text-sm">
                                        {r.response}
                                    </div>
                                ))}
                            </div>
                        )}
                        {isManagerUser && (
                            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                        Status
                                    </label>
                                    <select
                                        className={inputClass}
                                        value={statusDraft}
                                        onChange={(e) => setStatusDraft(e.target.value)}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="In Review">In Review</option>
                                        <option value="Resolved">Resolved</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                        HR reply (optional)
                                    </label>
                                    <textarea
                                        className={inputClass}
                                        rows={3}
                                        value={hrResponse}
                                        onChange={(e) => setHrResponse(e.target.value)}
                                        placeholder="Add a response to the employee..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleUpdateFeedback}
                                    disabled={saving}
                                    className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    {saving ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default FeedbackPanel;
