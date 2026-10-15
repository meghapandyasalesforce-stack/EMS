import React, { useState } from 'react';
import { FaLightbulb, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import { feedbackStatusStyle } from './engagementUtils';

const MINT = '#20C997';

const SUGGESTION_STATUSES = [
    'Submitted',
    'Under Review',
    'Accepted',
    'Rejected',
    'In Progress',
    'Implemented',
];

const CATEGORIES = [
    'Work Environment',
    'Management',
    'Benefits',
    'Process',
    'Technology',
    'Training',
    'Culture',
    'Other',
];

const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20';

const SuggestionsPanel = ({ suggestions, filteredSuggestions, isManagerUser, onRefresh }) => {
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [saving, setSaving] = useState(false);
    const [statusDraft, setStatusDraft] = useState('Submitted');
    const [hrResponse, setHrResponse] = useState('');
    const [internalRemark, setInternalRemark] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [implementationDate, setImplementationDate] = useState('');

    const visible = filteredSuggestions.filter((s) => {
        if (statusFilter && s.status !== statusFilter) return false;
        if (categoryFilter && s.category !== categoryFilter) return false;
        return true;
    });

    const employeeLabel = (item) => {
        if (item.anonymous) return 'Anonymous';
        const emp = item.employeeId || {};
        return `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—';
    };

    const openDetail = async (item) => {
        setDetailItem(item);
        setStatusDraft(item.status || 'Submitted');
        setHrResponse('');
        setInternalRemark('');
        setResolutionNote(item.resolutionNote || '');
        setImplementationDate(
            item.implementationDate ? item.implementationDate.slice(0, 10) : ''
        );

        try {
            setLoadingDetail(true);
            const { data } = await axios.get(`/v1/both/engagement/feedback/${item._id}`, {
                withCredentials: true,
            });
            const fresh = data?.data || item;
            setDetailItem(fresh);
            setStatusDraft(fresh.status || 'Submitted');
            setResolutionNote(fresh.resolutionNote || '');
            setImplementationDate(
                fresh.implementationDate ? fresh.implementationDate.slice(0, 10) : ''
            );
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load suggestion');
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleUpdate = async () => {
        if (!detailItem?._id || !isManagerUser) return;
        if (statusDraft === 'Implemented' && !resolutionNote.trim() && !detailItem.resolutionNote) {
            toast.error('Add a short outcome / resolution note before marking Implemented');
            return;
        }
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/feedback/${detailItem._id}`,
                {
                    status: statusDraft,
                    hrResponse: hrResponse.trim() || undefined,
                    internalRemark: internalRemark.trim() || undefined,
                    resolutionNote: resolutionNote.trim() || undefined,
                    implementationDate:
                        statusDraft === 'Implemented'
                            ? implementationDate || new Date().toISOString().slice(0, 10)
                            : implementationDate || undefined,
                },
                { withCredentials: true }
            );
            toast.success(
                statusDraft === 'Implemented'
                    ? 'Suggestion marked Implemented — employee will be notified'
                    : 'Suggestion updated'
            );
            setDetailItem(null);
            onRefresh();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update suggestion');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-sm text-slate-500">
                        Review employee suggestions through the full workflow lifecycle.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        {SUGGESTION_STATUSES.join(' → ')}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {SUGGESTION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                    <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All categories</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {visible.length === 0 ? (
                <div className="py-8 text-center sm:py-10">
                    <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                        style={{ background: `${MINT}20` }}
                    >
                        <FaLightbulb className="h-8 w-8" style={{ color: MINT }} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No suggestions found</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        {suggestions.length === 0
                            ? 'Employee suggestions will appear here.'
                            : 'Try adjusting your filters or search term.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[720px] text-left text-sm">
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
                                    Category
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Updated
                                </th>
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((item) => (
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
                                    <td className="px-5 py-4 text-slate-600">{item.category || '—'}</td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(item.status)}`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-slate-600">
                                        {item.updatedAt
                                            ? new Date(item.updatedAt).toLocaleDateString()
                                            : item.createdAt
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

            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">{detailItem.subject}</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {employeeLabel(detailItem)} • {detailItem.category || 'Other'}
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

                        {loadingDetail ? (
                            <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
                        ) : (
                            <>
                                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                    {detailItem.message}
                                </p>

                                {Array.isArray(detailItem.responses) && detailItem.responses.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            HR replies
                                        </p>
                                        {detailItem.responses.map((r, i) => (
                                            <div
                                                key={i}
                                                className="rounded-lg border border-slate-100 bg-emerald-50/50 p-3 text-sm"
                                            >
                                                {r.response}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {detailItem.resolutionNote && (
                                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-slate-700">
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            Resolution
                                        </p>
                                        <p className="mt-1">{detailItem.resolutionNote}</p>
                                        {detailItem.implementationDate && (
                                            <p className="mt-2 text-xs text-slate-500">
                                                Implemented:{' '}
                                                {new Date(detailItem.implementationDate).toLocaleDateString()}
                                            </p>
                                        )}
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
                                                {SUGGESTION_STATUSES.map((s) => (
                                                    <option key={s} value={s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                                HR reply (visible to employee)
                                            </label>
                                            <textarea
                                                className={inputClass}
                                                rows={3}
                                                value={hrResponse}
                                                onChange={(e) => setHrResponse(e.target.value)}
                                                placeholder="Add a response to the employee..."
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                                Internal remark (HR only)
                                            </label>
                                            <textarea
                                                className={inputClass}
                                                rows={2}
                                                value={internalRemark}
                                                onChange={(e) => setInternalRemark(e.target.value)}
                                                placeholder="Notes not visible to the employee..."
                                            />
                                        </div>
                                        {Array.isArray(detailItem.internalRemarks) &&
                                            detailItem.internalRemarks.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold uppercase text-slate-500">
                                                        Previous internal remarks
                                                    </p>
                                                    {detailItem.internalRemarks.map((r, i) => (
                                                        <div
                                                            key={i}
                                                            className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm text-slate-700"
                                                        >
                                                            {r.remark}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                                Outcome / resolution note
                                                {statusDraft === 'Implemented' ? ' (required)' : ' (visible to employee)'}
                                            </label>
                                            <textarea
                                                className={inputClass}
                                                rows={2}
                                                value={resolutionNote}
                                                onChange={(e) => setResolutionNote(e.target.value)}
                                                placeholder="What was delivered or changed as a result of this suggestion?"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                                Implementation date
                                            </label>
                                            <input
                                                type="date"
                                                className={inputClass}
                                                value={implementationDate}
                                                onChange={(e) => setImplementationDate(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleUpdate}
                                            disabled={saving}
                                            className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                            style={{ background: MINT_GRADIENT }}
                                        >
                                            {saving ? 'Saving...' : 'Save changes'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default SuggestionsPanel;
