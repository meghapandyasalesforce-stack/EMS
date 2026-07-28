import React, { useCallback, useEffect, useState } from 'react';
import { format, differenceInCalendarDays, getWeek } from 'date-fns';
import { toast } from 'react-toastify';
import { FaSync, FaUserCheck, FaCalendarAlt, FaUserPlus, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CmBadge, CmButton, CmStat, CmPerson, CmEmpty } from '../../components/corporateModern';

/**
 * Probation Manager — Corporate-Modern HR view. Always HR-only (no employee
 * caller exists for this component). UI-only restyle; all handlers/state
 * (load/extend/submitReview) are unchanged.
 */

// ── Display-only derivations (no API/handler impact) ──
function daysUntil(date) {
    if (!date) return null;
    return differenceInCalendarDays(new Date(date), new Date());
}

function probationStage(probation = {}) {
    const status = probation.status || 'Active';
    const midDone = probation.midReview?.status === 'Completed';
    const finalDone = probation.finalReview?.status === 'Completed';
    if (status === 'Confirmed') return { segs: ['done', 'done', 'done', 'done'], label: 'Confirmed' };
    if (status === 'Rejected') return { segs: ['attention', 'attention', 'attention', 'attention'], label: 'Rejected' };
    if (status === 'Extended') return { segs: ['attention', 'attention', 'attention', 'attention'], label: 'Under Extension' };
    if (finalDone) return { segs: ['done', 'done', 'done', 'done'], label: 'Final Review Completed' };
    if (midDone) return { segs: ['progress', 'progress', 'progress', 'done'], label: 'Mid Review Completed' };
    return { segs: ['progress', 'progress', 'progress', 'progress'], label: 'Probation In Progress' };
}

function signOffStatus(probation = {}) {
    const done = probation.finalReview?.status === 'Completed' || ['Confirmed', 'Rejected'].includes(probation.status);
    return done ? 'Done' : 'Pending';
}

function outcomeStatus(probation = {}) {
    if (probation.status === 'Confirmed') return { label: 'Confirmed', tone: 'done' };
    if (probation.status === 'Extended') return { label: 'Extended', tone: 'progress' };
    if (probation.status === 'Rejected') return { label: 'Rejected', tone: 'attention' };
    return { label: 'Pending', tone: 'neutral' };
}

function checkinLabel(probation = {}) {
    return probation.midReview?.status !== 'Completed' ? 'Mid-Term Check-in' : 'Final Review Check-in';
}
const ProbationCenter = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [reviewForm, setReviewForm] = useState({ reviewType: 'final', rating: 3, feedback: '', decision: 'confirm' });
    const [extensionDays, setExtensionDays] = useState('30');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const { data: res } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/probation/center`);
            setData(res.data);
        } catch (err) {
            setData(null);
            setError(err.response?.data?.message || 'Could not load probation center');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const extend = async (workflowId) => {
        try {
            setSubmitting(true);
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/probation/extend`, {
                extensionDays: Number(extensionDays), reason: 'HR extension',
            });
            toast.success('Probation extended');
            setSelected(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    const submitReview = async (workflowId) => {
        try {
            setSubmitting(true);
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/probation/review`, reviewForm);
            toast.success('Review submitted');
            setSelected(null);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading probation center..." />;

    const dash = data?.dashboard || {};
    const upcoming = data?.upcoming || [];
    const pipeline = (data?.all || []).filter((w) => w.probation?.status && w.probation.status !== 'Waived');

    return (
        <div className="cm-hrms">
            <div className="cm-page">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="cm-title">Probation Manager</p>
                        <p className="cm-subtitle">Active confirmations, endings soon, and review actions</p>
                    </div>
                    <CmButton variant="outline" size="sm" onClick={load}>
                        <FaSync /> Refresh
                    </CmButton>
                </div>

                {error && <div className="cm-banner cm-banner--attention">{error}</div>}

                <div className="cm-kpi-row cm-kpi-row--3">
                    <CmStat
                        label="Active Probations"
                        value={dash.active || 0}
                        meta="On track this month"
                        metaTone="positive"
                        icon={<FaUserCheck />}
                    />
                    <CmStat
                        label="Reviews Due Today"
                        value={dash.endingSoon || 0}
                        attention={(dash.endingSoon || 0) > 0}
                        meta={(dash.endingSoon || 0) > 0 ? 'High priority' : 'All caught up'}
                        metaTone={(dash.endingSoon || 0) > 0 ? 'attention' : 'positive'}
                        icon={<FaCalendarAlt />}
                        iconAttention={(dash.endingSoon || 0) > 0}
                    />
                    <CmStat
                        label="Sign-off Pending"
                        value={dash.confirmed || 0}
                        meta="Waiting for Managers"
                        metaTone="attention"
                        icon={<FaUserCheck />}
                    />
                </div>

                <div className="cm-split">
                    <div className="cm-card">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="cm-title-sm">Employee Probation Pipeline</p>
                                <p className="cm-subtitle">Stage, review sign-off, and outcome for every active probation</p>
                            </div>
                            <CmButton variant="inverted" size="sm">
                                <FaUserPlus /> Add Employee
                            </CmButton>
                        </div>
                        {pipeline.length === 0 ? (
                            <CmEmpty icon={<FaUserCheck />} title="No probation records yet">
                                Employees on probation will appear here once onboarding starts their probation period.
                            </CmEmpty>
                        ) : (
                            <>
                                <div className="cm-table-wrap">
                                    <table className="cm-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Probation Stage</th>
                                                <th>Next Review</th>
                                                <th>Sign-off</th>
                                                <th>Outcome</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pipeline.slice(0, 4).map((w) => {
                                                const stage = probationStage(w.probation);
                                                const outcome = outcomeStatus(w.probation);
                                                const days = daysUntil(w.probation?.endDate);
                                                return (
                                                    <tr key={w._id}>
                                                        <td>
                                                            <CmPerson
                                                                name={[w.employeeId?.name, w.employeeId?.lastName].filter(Boolean).join(' ') || '—'}
                                                                meta={w.employeeId?.department || 'Employee'}
                                                            />
                                                        </td>
                                                        <td>
                                                            <div className="cm-stage-track">
                                                                {stage.segs.map((tone, idx) => (
                                                                    <span key={idx} className={`cm-stage-seg cm-stage-seg--${tone}`} />
                                                                ))}
                                                            </div>
                                                            <p className="cm-stage-label">{stage.label}</p>
                                                        </td>
                                                        <td>
                                                            <p className="text-sm" style={{ color: 'var(--cm-on-surface)' }}>
                                                                {w.probation?.endDate ? format(new Date(w.probation.endDate), 'MMM dd, yyyy') : '—'}
                                                            </p>
                                                            {days !== null && (
                                                                <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>
                                                                    {days >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : 'overdue'}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <CmBadge tone={signOffStatus(w.probation) === 'Done' ? 'done' : 'attention'}>
                                                                {signOffStatus(w.probation)}
                                                            </CmBadge>
                                                        </td>
                                                        <td><CmBadge tone={outcome.tone}>{outcome.label}</CmBadge></td>
                                                        <td>
                                                            <CmButton size="sm" onClick={() => setSelected(w)}>Confirm / Extend</CmButton>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="cm-pagination">
                                    <span>Showing 1-{Math.min(4, pipeline.length)} of {pipeline.length} employees</span>
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" className="cm-icon-btn" aria-label="Previous page" disabled>
                                            <FaChevronLeft />
                                        </button>
                                        <button type="button" className="cm-icon-btn" aria-label="Next page" disabled={pipeline.length <= 4}>
                                            <FaChevronRight />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="cm-card">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="cm-label">Upcoming Check-ins</p>
                            <CmBadge tone="neutral" dot={false}>WEEK {getWeek(new Date())}</CmBadge>
                        </div>
                        {upcoming.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--cm-muted)' }}>Nothing scheduled.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcoming.slice(0, 8).map((w) => {
                                    const days = daysUntil(w.probation?.endDate);
                                    const dateLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : (w.probation?.endDate ? format(new Date(w.probation.endDate), 'MMM dd') : '—');
                                    return (
                                        <div key={w._id} className="cm-card cm-card--inset flex items-center gap-3">
                                            <span className="cm-stat__icon" style={{ width: '2.25rem', height: '2.25rem', flexShrink: 0 }}>
                                                <FaCalendarAlt />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="cm-person__name truncate">
                                                    {[w.employeeId?.name, w.employeeId?.lastName].filter(Boolean).join(' ') || '—'}
                                                </p>
                                                <p className="cm-person__meta truncate">{checkinLabel(w.probation)} · {dateLabel}</p>
                                                <p className="text-[11px]" style={{ color: 'var(--cm-muted)' }}>Reviewer: HR Team</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {selected && (
                    <div className="cm-modal-overlay" onClick={() => setSelected(null)}>
                        <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
                            <p className="cm-title-sm mb-4">Probation — {selected.employeeId?.name}</p>

                            <div className="space-y-3.5">
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Review type</span>
                                    <select
                                        value={reviewForm.reviewType}
                                        onChange={(e) => setReviewForm((p) => ({ ...p, reviewType: e.target.value }))}
                                        className="cm-select w-full"
                                    >
                                        <option value="mid">Mid review</option>
                                        <option value="final">Final review</option>
                                    </select>
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Rating (1-5)</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={reviewForm.rating}
                                        onChange={(e) => setReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                                        className="cm-input w-full"
                                    />
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Feedback</span>
                                    <textarea
                                        rows={3}
                                        value={reviewForm.feedback}
                                        onChange={(e) => setReviewForm((p) => ({ ...p, feedback: e.target.value }))}
                                        className="cm-input w-full"
                                        style={{ borderRadius: 'var(--cm-radius-card)' }}
                                    />
                                </label>
                                {reviewForm.reviewType === 'final' && (
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Decision</span>
                                        <select
                                            value={reviewForm.decision}
                                            onChange={(e) => setReviewForm((p) => ({ ...p, decision: e.target.value }))}
                                            className="cm-select w-full"
                                        >
                                            <option value="confirm">Confirm</option>
                                            <option value="extend">Extend</option>
                                            <option value="reject">Reject</option>
                                        </select>
                                    </label>
                                )}
                                <div className="flex items-end gap-2">
                                    <label className="flex-1 text-sm">
                                        <span className="cm-label mb-1 block">Extend days</span>
                                        <input
                                            type="number"
                                            value={extensionDays}
                                            onChange={(e) => setExtensionDays(e.target.value)}
                                            className="cm-input w-full"
                                        />
                                    </label>
                                    <CmButton variant="outline" disabled={submitting} onClick={() => extend(selected._id)}>Extend</CmButton>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <CmButton variant="secondary" onClick={() => setSelected(null)}>Cancel</CmButton>
                                    <CmButton disabled={submitting} onClick={() => submitReview(selected._id)}>Submit Review</CmButton>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProbationCenter;
