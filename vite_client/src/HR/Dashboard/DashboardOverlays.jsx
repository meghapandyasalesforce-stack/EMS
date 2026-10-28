import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { updateLeave } from '../../context/leaveSlice';
import { BOTH_CELEBRATION_ENDPOINT } from '../../utils/constant';
import '../../styles/dashboardOverlays.css';

const initials = (name = '') =>
    String(name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || '?';

const approvalTitle = (approval) => {
    if (approval?.entityType === 'TaxRegimeChange') return 'Tax Regime Change';
    return `${approval?.entityType || 'Request'}`.replace(/([a-z])([A-Z])/g, '$1 $2');
};

const leaveDaysLabel = (leave) => {
    const days = leave?.numberOfDays ?? leave?.days ?? leave?.totalDays;
    if (days == null || days === '') return leave?.leaveType || 'Leave';
    return `${leave?.leaveType || 'Leave'} (${days}d)`;
};

function useOverlayOpenClass(open) {
    useEffect(() => {
        if (!open) return undefined;
        document.body.classList.add('hr-ov-open');
        return () => {
            document.body.classList.remove('hr-ov-open');
        };
    }, [open]);
}

function Backdrop({ onClose }) {
    return <button type="button" className="hr-ov-backdrop" aria-label="Close overlay" onClick={onClose} />;
}

function DrawerShell({ eyebrow, eyebrowUrgent, title, onClose, children, footer }) {
    useOverlayOpenClass(true);
    return createPortal(
        <>
            <Backdrop onClose={onClose} />
            <aside className="hr-ov-drawer" role="dialog" aria-modal="true" aria-label={title}>
                <header className="hr-ov-drawer__head">
                    <p className={`hr-ov-drawer__eyebrow ${eyebrowUrgent ? 'hr-ov-drawer__eyebrow--urgent' : ''}`}>
                        {eyebrow}
                    </p>
                    <div className="hr-ov-drawer__title-row">
                        <h2 className="hr-ov-drawer__title">{title}</h2>
                        <button type="button" className="hr-ov-close" onClick={onClose} aria-label="Close">
                            <FiX className="h-5 w-5" />
                        </button>
                    </div>
                </header>
                <div className="hr-ov-drawer__body">{children}</div>
                {footer ? <footer className="hr-ov-drawer__foot">{footer}</footer> : null}
            </aside>
        </>,
        document.body
    );
}

/** Shared Stitch popup chrome — navy header, white body, soft footer. Use for all dashboard modals. */
export function ModalShell({ eyebrow, title, wide, onClose, children, footer, footerSpread }) {
    useOverlayOpenClass(true);
    return createPortal(
        <div className="hr-ov-modal-wrap">
            <Backdrop onClose={onClose} />
            <div
                className={`hr-ov-modal ${wide ? 'hr-ov-modal--wide' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="hr-ov-modal__head">
                    {eyebrow ? <p className="hr-ov-drawer__eyebrow">{eyebrow}</p> : null}
                    <div className="hr-ov-drawer__title-row">
                        <h2 className="hr-ov-drawer__title">{title}</h2>
                        <button type="button" className="hr-ov-close" onClick={onClose} aria-label="Close">
                            <FiX className="h-5 w-5" />
                        </button>
                    </div>
                </header>
                <div className="hr-ov-modal__body">{children}</div>
                {footer ? (
                    <footer className={`hr-ov-modal__foot ${footerSpread ? 'hr-ov-modal__foot--spread' : ''}`}>
                        {footer}
                    </footer>
                ) : null}
            </div>
        </div>,
        document.body
    );
}

export function ApprovalsDrawer({ open, escalatedOnly = false, approvals = [], onClose, onChanged }) {
    const [busyId, setBusyId] = useState(null);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const list = useMemo(() => {
        const rows = Array.isArray(approvals) ? approvals : [];
        return escalatedOnly ? rows.filter((item) => item?.slaEscalated) : rows;
    }, [approvals, escalatedOnly]);

    useEffect(() => {
        if (!open) {
            setRejectingId(null);
            setRejectReason('');
            setBusyId(null);
        }
    }, [open]);

    if (!open) return null;

    const processApproval = async (approval, action, comments = '') => {
        const key = approval?.taxRegimeRequestId ? `tax-${approval.taxRegimeRequestId}` : approval?._id;
        setBusyId(key);
        try {
            const isDirectTax = Boolean(approval?.isDirectTaxRegimeRequest || approval?.taxRegimeRequestId);
            const stepNumber = approval?.currentPendingStep?.stepNumber || approval?.currentStep || 1;
            if (isDirectTax || approval?.entityType === 'TaxRegimeChange') {
                const requestId = approval.taxRegimeRequestId || approval.entityId || approval._id;
                if (action === 'Approve') {
                    await axios.patch(`/v1/both/tax-regime-change/admin/approve/${requestId}`, {
                        stepNumber,
                        comments,
                    });
                } else {
                    await axios.patch(`/v1/both/tax-regime-change/admin/reject/${requestId}`, {
                        stepNumber,
                        comments,
                        rejectionReason: comments,
                    });
                }
            } else {
                await axios.post(`/v1/admin/approvals/process/${approval._id}`, {
                    stepNumber,
                    action,
                    comments,
                    ...(approval.hrOverrideAvailable ? { hrOverride: true } : {}),
                    ...(approval.timeoutEscalationAvailable && !approval.hrOverrideAvailable
                        ? { timeoutEscalation: true }
                        : {}),
                });
            }
            toast.success(`Request ${action.toLowerCase()}ed successfully`);
            setRejectingId(null);
            setRejectReason('');
            onChanged?.();
        } catch (error) {
            toast.error(error.response?.data?.message || `Failed to ${action.toLowerCase()} request`);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DrawerShell
            eyebrow={escalatedOnly ? 'Escalated priority' : 'Action queue'}
            eyebrowUrgent={escalatedOnly}
            title={escalatedOnly ? 'Pending Approvals Queue' : `Pending Approvals (${list.length})`}
            onClose={onClose}
            footer={
                <>
                    <span className="text-sm text-[#666666]">{list.length} in queue</span>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Close
                    </button>
                </>
            }
        >
            {list.length === 0 ? (
                <div className="hr-ov-empty">No pending approvals right now.</div>
            ) : (
                list.map((approval) => {
                    const key = approval?.taxRegimeRequestId ? `tax-${approval.taxRegimeRequestId}` : approval?._id;
                    const requester = approval?.requestedBy?.name || 'Pending review';
                    const busy = busyId === key;
                    return (
                        <article
                            key={key}
                            className={`hr-ov-card ${approval?.slaEscalated ? 'hr-ov-card--escalated' : ''}`}
                        >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="hr-ov-tag hr-ov-tag--ok">In review</span>
                                <span className="text-[11px] font-medium text-[#94A3B8]">
                                    {(approval?._id || approval?.taxRegimeRequestId || '').toString().slice(-8).toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-[#111C2D]">{approvalTitle(approval)}</p>
                            <p className="mt-1 text-xs text-[#666666]">Requested by {requester}</p>
                            {approval?.currentPendingStep?.dueDate ? (
                                <p className="mt-1 text-xs text-[#64748B]">
                                    Due {new Date(approval.currentPendingStep.dueDate).toLocaleDateString()}
                                </p>
                            ) : null}

                            {rejectingId === key ? (
                                <div className="mt-3 space-y-2">
                                    <textarea
                                        className="hr-ov-textarea"
                                        rows={3}
                                        value={rejectReason}
                                        onChange={(event) => setRejectReason(event.target.value)}
                                        placeholder="Rejection reason"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            className="hr-ov-btn hr-ov-btn--ghost"
                                            onClick={() => {
                                                setRejectingId(null);
                                                setRejectReason('');
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="hr-ov-btn hr-ov-btn--primary"
                                            disabled={busy}
                                            onClick={() => {
                                                if (!rejectReason.trim()) {
                                                    toast.warning('Please enter a rejection reason');
                                                    return;
                                                }
                                                processApproval(approval, 'Reject', rejectReason.trim());
                                            }}
                                        >
                                            Confirm reject
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        className="hr-ov-btn hr-ov-btn--danger-text"
                                        disabled={busy}
                                        onClick={() => {
                                            setRejectingId(key);
                                            setRejectReason('');
                                        }}
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        className="hr-ov-btn hr-ov-btn--primary"
                                        disabled={busy}
                                        onClick={() => processApproval(approval, 'Approve')}
                                    >
                                        Approve
                                    </button>
                                </div>
                            )}
                        </article>
                    );
                })
            )}
        </DrawerShell>
    );
}

export function LeaveDrawer({ open, leaves = [], onClose, onChanged }) {
    const dispatch = useDispatch();
    const [busyId, setBusyId] = useState(null);
    const [rejectingId, setRejectingId] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const pending = useMemo(
        () =>
            (leaves || []).filter(
                (leave) => String(leave?.status || '').trim().toLowerCase() === 'pending'
            ),
        [leaves]
    );

    useEffect(() => {
        if (!open) {
            setRejectingId(null);
            setRejectReason('');
            setBusyId(null);
        }
    }, [open]);

    if (!open) return null;

    const decide = async (leave, status, rejectionReason) => {
        setBusyId(leave._id);
        try {
            const updatedData = { status };
            if (status === 'rejected') updatedData.rejectionReason = rejectionReason;
            await dispatch(updateLeave({ id: leave._id, updatedData })).unwrap();
            toast.success(status === 'approved' ? 'Leave approved successfully!' : 'Leave rejected successfully!');
            setRejectingId(null);
            setRejectReason('');
            onChanged?.(leave._id, status);
        } catch (err) {
            const msg = typeof err === 'string' ? err : err?.message || err?.error || 'Failed to update leave';
            toast.error(msg);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DrawerShell
            eyebrow="Action queue"
            title={`Pending Leave Approvals (${pending.length})`}
            onClose={onClose}
            footer={
                <>
                    <span className="text-sm text-[#666666]">Bulk action</span>
                    <button
                        type="button"
                        className="hr-ov-btn hr-ov-btn--primary"
                        disabled={!pending.length || busyId}
                        onClick={async () => {
                            for (const leave of pending) {
                                // Sequential to avoid hammering API; same approve path as single cards
                                // eslint-disable-next-line no-await-in-loop
                                await decide(leave, 'approved');
                            }
                        }}
                    >
                        Approve All ({pending.length})
                    </button>
                </>
            }
        >
            {pending.length === 0 ? (
                <div className="hr-ov-empty">No pending leave requests.</div>
            ) : (
                pending.map((leave) => {
                    const name = leave?.employee?.name || leave?.employeeName || leave?.name || 'Employee';
                    const role = leave?.employee?.jobTitle || leave?.employee?.position || leave?.department || '';
                    const busy = busyId === leave._id;
                    return (
                        <article key={leave._id} className="hr-ov-card">
                            <div className="flex items-start gap-3">
                                <span className="hr-ov-avatar">{initials(name)}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[#111C2D]">{name}</p>
                                            {role ? <p className="truncate text-xs text-[#666666]">{role}</p> : null}
                                        </div>
                                        <span className="hr-ov-tag hr-ov-tag--warn">{leaveDaysLabel(leave)}</span>
                                    </div>
                                    {leave?.reason ? (
                                        <p className="mt-2 rounded-lg bg-[#F8FAFC] px-2.5 py-2 text-xs text-[#475569]">
                                            {leave.reason}
                                        </p>
                                    ) : null}

                                    {rejectingId === leave._id ? (
                                        <div className="mt-3 space-y-2">
                                            <textarea
                                                className="hr-ov-textarea"
                                                rows={3}
                                                value={rejectReason}
                                                onChange={(event) => setRejectReason(event.target.value)}
                                                placeholder="Rejection reason"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    className="hr-ov-btn hr-ov-btn--ghost"
                                                    onClick={() => {
                                                        setRejectingId(null);
                                                        setRejectReason('');
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className="hr-ov-btn hr-ov-btn--primary"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (!rejectReason.trim()) {
                                                            toast.warning('Please provide a rejection reason');
                                                            return;
                                                        }
                                                        decide(leave, 'rejected', rejectReason.trim());
                                                    }}
                                                >
                                                    Confirm reject
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                className="hr-ov-btn hr-ov-btn--danger-text"
                                                disabled={busy}
                                                onClick={() => {
                                                    setRejectingId(leave._id);
                                                    setRejectReason('');
                                                }}
                                            >
                                                Reject
                                            </button>
                                            <button
                                                type="button"
                                                className="hr-ov-btn hr-ov-btn--primary"
                                                disabled={busy}
                                                onClick={() => decide(leave, 'approved')}
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })
            )}
        </DrawerShell>
    );
}

export function WishModal({ open, item, eventId, onClose }) {
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const name = item?.name || 'teammate';
    const isAnniversary = item?.type === 'anniversary';
    const isMarriage = item?.type === 'marriage_anniversary';
    const title = isAnniversary
        ? `Wish ${name}${item?.completedYears ? ` (${item.completedYears}${item.completedYears === 1 ? 'st' : 'th'} Work Anniversary)` : ''}`
        : isMarriage
            ? `Wish ${name} (Marriage Anniversary)`
            : `Wish ${name}${item?.daysUntil === 0 ? ' (Birthday)' : ''}`;

    const defaultNote = isAnniversary
        ? 'Heartiest congratulations on this wonderful milestone! Wishing you continued brilliance and great health from all of us at EMS HRMS.'
        : isMarriage
            ? 'Happy Marriage Anniversary! Wishing you both a wonderful journey together.'
            : 'Happy Birthday! Hope you have a wonderful year ahead.';

    useEffect(() => {
        if (open) setComment(defaultNote);
    }, [open, defaultNote]);

    if (!open || !item) return null;

    const sendWish = async () => {
        if (!comment.trim()) {
            toast.warning('Please write a greeting note');
            return;
        }
        setSubmitting(true);
        try {
            let id = eventId;
            if (!id) {
                const { data } = await axios.post(
                    `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
                    { employeeId: item.employeeId, type: item.type || 'birthday' },
                    { withCredentials: true }
                );
                id = data?.data?._id;
            }
            if (!id) throw new Error('Celebration event unavailable');
            await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${id}/wish`, { comment: comment.trim() });
            toast.success('Wish sent');
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send wish');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalShell
            eyebrow="Celebrations"
            title={title}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="hr-ov-btn hr-ov-btn--primary"
                        disabled={submitting}
                        onClick={sendWish}
                    >
                        {submitting ? 'Sending…' : 'Send'}
                    </button>
                </>
            }
        >
            <label className="hr-ov-label" htmlFor="hr-dash-wish-note">
                Personal Greeting Note
            </label>
            <textarea
                id="hr-dash-wish-note"
                className="hr-ov-textarea"
                maxLength={500}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
            />
            <p className="mt-2 text-right text-xs text-[#94A3B8]">{comment.length}/500</p>
        </ModalShell>
    );
}

export function EmployeeQuickViewModal({ open, employee, onClose, onEditFull }) {
    if (!open || !employee) return null;

    const name = [employee?.name, employee?.lastName].filter(Boolean).join(' ') || employee?.email || 'Employee';
    const status = employee?.status || 'Active';
    const role = employee?.jobTitle || employee?.position || '—';
    const dept = employee?.department || '—';
    const empId = employee?.employeeId || employee?.empId || employee?._id?.toString?.()?.slice(-6) || '—';
    const location = employee?.workLocation || employee?.location || employee?.campus || '—';
    const manager =
        employee?.reportingManager?.name ||
        employee?.manager?.name ||
        employee?.reportingTo ||
        '—';
    const joining = employee?.joiningDate
        ? new Date(employee.joiningDate).toLocaleDateString()
        : '—';

    return (
        <ModalShell
            wide
            eyebrow="Talent dossier"
            title="Employee Quick View"
            onClose={onClose}
            footerSpread
            footer={
                <>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Close
                    </button>
                    <button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={() => onEditFull?.(employee)}>
                        Edit Full Record
                    </button>
                </>
            }
        >
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#0E2B3D] p-4 text-white">
                <span className="hr-ov-avatar">{initials(name)}</span>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-bold">{name}</p>
                        <span className="hr-ov-tag hr-ov-tag--ok">{status}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-white/75">
                        {role} • {dept}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-white/55">
                        {empId} • {location}
                    </p>
                </div>
            </div>

            <div className="hr-ov-metric-grid">
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Email</p>
                    <p className="hr-ov-metric__value truncate">{employee?.email || '—'}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Phone</p>
                    <p className="hr-ov-metric__value">{employee?.phone || employee?.mobile || '—'}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Joined</p>
                    <p className="hr-ov-metric__value">{joining}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Leave balance</p>
                    <p className="hr-ov-metric__value" style={{ color: '#0E9370' }}>
                        {employee?.leaveBalance ?? employee?.availableLeaves ?? '—'}
                    </p>
                </div>
            </div>

            <p className="mb-2 mt-4 text-[0.6875rem] font-semibold uppercase tracking-wider text-[#666666]">
                Reporting &amp; allocation
            </p>
            <div className="rounded-xl bg-[#F0F3FF] p-3">
                <div className="hr-ov-grid-2 text-sm">
                    <div>
                        <p className="text-xs text-[#666666]">Direct reporting lead</p>
                        <p className="font-semibold text-[#111C2D]">{manager}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[#666666]">Work location</p>
                        <p className="font-semibold text-[#111C2D]">{location}</p>
                    </div>
                </div>
            </div>
        </ModalShell>
    );
}

export function JobsDrawer({ open, jobs = [], onClose }) {
    if (!open) return null;
    const list = Array.isArray(jobs) ? jobs : [];
    return (
        <DrawerShell
            eyebrow="Recruitment"
            title={`Open Positions (${list.length})`}
            onClose={onClose}
            footer={
                <>
                    <span className="text-sm text-[#666666]">{list.length} roles</span>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Close
                    </button>
                </>
            }
        >
            {list.length === 0 ? (
                <div className="hr-ov-empty">No open positions right now.</div>
            ) : (
                list.map((job) => (
                    <article key={job._id || job.id || job.title} className="hr-ov-card">
                        <p className="text-sm font-bold text-[#111C2D]">{job.title || job.jobTitle || 'Open role'}</p>
                        <p className="mt-1 text-xs text-[#666666]">
                            {[job.department, job.location, job.status].filter(Boolean).join(' • ') || 'Recruitment'}
                        </p>
                    </article>
                ))
            )}
        </DrawerShell>
    );
}

const CELEB_REACTIONS = ['❤️', '🎉', '👏', '🥳'];

const celebrationTypeLabel = (item) => {
    if (item?.type === 'marriage_anniversary') return 'Marriage anniversary';
    if (item?.type === 'anniversary') return 'Work anniversary';
    return 'Birthday';
};

const celebrationItemKey = (item) => `${item?.type || 'birthday'}_${item?.employeeId}`;

/**
 * Side drawer: upcoming celebrations with reactions (and private wish for today).
 */
export function CelebrationsDrawer({
    open,
    items = [],
    focusItem = null,
    eventsByKey = {},
    reacting = false,
    onClose,
    onReact,
    onEnsureEvent,
}) {
    const [activeKey, setActiveKey] = useState(null);
    const [wishText, setWishText] = useState('');
    const [wishBusy, setWishBusy] = useState(false);
    const [localEvents, setLocalEvents] = useState({});
    const [reactionFilter, setReactionFilter] = useState('all');
    const [showAllReactors, setShowAllReactors] = useState(false);
    const ensureInFlightRef = useRef(new Set());
    const onEnsureEventRef = useRef(onEnsureEvent);
    onEnsureEventRef.current = onEnsureEvent;

    const list = useMemo(() => {
        const rows = Array.isArray(items) ? [...items] : [];
        rows.sort((a, b) => {
            const aDays = Number.isFinite(Number(a?.daysUntil)) ? Number(a.daysUntil) : 9999;
            const bDays = Number.isFinite(Number(b?.daysUntil)) ? Number(b.daysUntil) : 9999;
            return aDays - bDays;
        });
        return rows;
    }, [items]);

    const focusKey = focusItem?.employeeId ? celebrationItemKey(focusItem) : null;

    useEffect(() => {
        if (!open) {
            setActiveKey(null);
            setWishText('');
            setReactionFilter('all');
            setShowAllReactors(false);
            ensureInFlightRef.current.clear();
            return;
        }
        if (focusKey) {
            setActiveKey(focusKey);
        } else if (list[0]) {
            setActiveKey(celebrationItemKey(list[0]));
        }
    }, [open, focusKey, list]);

    useEffect(() => {
        setReactionFilter('all');
        setShowAllReactors(false);
    }, [activeKey]);

    useEffect(() => {
        if (!open || !activeKey) return undefined;
        const item = list.find((row) => celebrationItemKey(row) === activeKey);
        if (!item || item.daysUntil !== 0) return undefined;

        // Already have event from parent or prior open — do not POST again
        if (eventsByKey[activeKey]?._id || localEvents[activeKey]?._id) return undefined;
        if (ensureInFlightRef.current.has(activeKey)) return undefined;

        const ensure = onEnsureEventRef.current;
        if (!ensure) return undefined;

        let cancelled = false;
        ensureInFlightRef.current.add(activeKey);
        (async () => {
            try {
                const event = await ensure(item);
                if (!cancelled && event?._id) {
                    setLocalEvents((prev) => {
                        if (prev[activeKey]?._id) return prev;
                        return { ...prev, [activeKey]: event };
                    });
                }
            } catch {
                /* toast handled by caller if needed */
            } finally {
                ensureInFlightRef.current.delete(activeKey);
            }
        })();
        return () => {
            cancelled = true;
        };
        // intentionally omit onEnsureEvent / list identity — use activeKey + cache gates
        // eslint-disable-next-line react-hooks/exhaustive-deps -- stabilize open calls
    }, [open, activeKey, eventsByKey, localEvents, list]);

    // All hooks must run before any early return (Rules of Hooks)
    const activeItem = list.find((row) => celebrationItemKey(row) === activeKey) || null;
    const activeEvent = useMemo(() => {
        if (!activeKey) return null;
        const fromParent = eventsByKey[activeKey];
        const fromLocal = localEvents[activeKey];
        if (fromParent && fromLocal) return { ...fromLocal, ...fromParent };
        return fromParent || fromLocal || null;
    }, [activeKey, eventsByKey, localEvents]);
    const reactionCounts = activeEvent?.reactionCounts || {};
    const reactors = Array.isArray(activeEvent?.reactions) ? activeEvent.reactions : [];
    const isToday = activeItem?.daysUntil === 0;
    const REACTOR_PREVIEW = 8;

    const filteredReactors = useMemo(() => {
        const rows = reactors.filter((row) => {
            if (reactionFilter === 'all') return true;
            return row?.emoji === reactionFilter;
        });
        // Dedupe same person+emoji if API ever doubles up
        const seen = new Set();
        return rows.filter((row) => {
            const name =
                row.name || row.userName || row.employeeName || row.userId || row.employeeId || '';
            const key = `${name}::${row.emoji || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [reactors, reactionFilter]);

    const visibleReactors = showAllReactors
        ? filteredReactors
        : filteredReactors.slice(0, REACTOR_PREVIEW);
    const hiddenReactorCount = Math.max(0, filteredReactors.length - REACTOR_PREVIEW);

    if (!open) return null;

    const sendWish = async () => {
        if (!activeItem || !wishText.trim()) {
            toast.warning('Please write a greeting note');
            return;
        }
        setWishBusy(true);
        try {
            let event = activeEvent;
            if (!event?._id && onEnsureEvent) {
                event = await onEnsureEvent(activeItem);
            }
            if (!event?._id) throw new Error('Celebration event unavailable');
            await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${event._id}/wish`, {
                comment: wishText.trim(),
            });
            toast.success('Wish sent privately');
            setWishText('');
            setLocalEvents((prev) => ({ ...prev, [celebrationItemKey(activeItem)]: event }));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to send wish');
        } finally {
            setWishBusy(false);
        }
    };

    return (
        <DrawerShell
            eyebrow="Celebrations"
            title="Upcoming celebrations"
            onClose={onClose}
            footer={
                <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                    Close
                </button>
            }
        >
            {list.length === 0 ? (
                <div className="hr-ov-empty">No upcoming celebrations right now.</div>
            ) : (
                <div className="space-y-3">
                    {list.map((item) => {
                        const key = celebrationItemKey(item);
                        const selected = key === activeKey;
                        const event = localEvents[key] || eventsByKey[key];
                        const counts = event?.reactionCounts || {};
                        const totalReact = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);
                        const when =
                            item.daysUntil === 0
                                ? 'Today'
                                : item.daysUntil === 1
                                  ? 'Tomorrow'
                                  : `in ${item.daysUntil} days`;
                        return (
                            <button
                                key={key}
                                type="button"
                                className={`hr-ov-card w-full text-left transition ${
                                    selected ? 'ring-2 ring-[#0E9370]/35' : ''
                                }`}
                                onClick={() => setActiveKey(key)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                                            {celebrationTypeLabel(item)}
                                        </p>
                                        <p className="truncate text-sm font-bold text-[#111C2D]">
                                            {item.name || 'Team member'}
                                        </p>
                                        <p className="text-xs text-[#666666]">{when}</p>
                                    </div>
                                    {item.daysUntil === 0 ? (
                                        <span className="shrink-0 rounded-full bg-[#D1F5EA] px-2 py-0.5 text-[10px] font-bold text-[#07523E]">
                                            {totalReact} react{totalReact === 1 ? '' : 's'}
                                        </span>
                                    ) : (
                                        <span className="shrink-0 text-[10px] font-semibold uppercase text-[#94A3B8]">
                                            Upcoming
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}

                    {activeItem ? (
                        <div className="hr-ov-card !bg-[#F8FAFC]">
                            <p className="text-sm font-bold text-[#111C2D]">
                                {activeItem.name || 'Team member'} · {celebrationTypeLabel(activeItem)}
                            </p>
                            {!isToday ? (
                                <p className="mt-2 text-xs text-[#666666]">
                                    Wishes and reactions open on their{' '}
                                    {celebrationTypeLabel(activeItem).toLowerCase()}.
                                </p>
                            ) : (
                                <>
                                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#666666]">
                                        Reactions
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {CELEB_REACTIONS.map((emoji) => {
                                            const count = Number(reactionCounts[emoji] || 0);
                                            return (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    disabled={reacting || !onReact}
                                                    onClick={() => onReact?.(activeItem, emoji)}
                                                    className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-[#0E9370]/40 disabled:opacity-50 ${
                                                        count > 0
                                                            ? 'border-[#0E9370]/35'
                                                            : 'border-slate-200'
                                                    }`}
                                                    aria-label={`React ${emoji}`}
                                                >
                                                    <span>{emoji}</span>
                                                    {count > 0 ? (
                                                        <span className="text-[10px] font-semibold text-[#666666]">
                                                            {count}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {reactors.length > 0 ? (
                                        <div className="mt-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                                        reactionFilter === 'all'
                                                            ? 'bg-[#0E9370] text-white'
                                                            : 'bg-white text-[#475569] ring-1 ring-slate-200'
                                                    }`}
                                                    onClick={() => {
                                                        setReactionFilter('all');
                                                        setShowAllReactors(false);
                                                    }}
                                                >
                                                    All ({reactors.length})
                                                </button>
                                                {CELEB_REACTIONS.map((emoji) => {
                                                    const count = Number(reactionCounts[emoji] || 0);
                                                    if (count <= 0) return null;
                                                    return (
                                                        <button
                                                            key={`filter-${emoji}`}
                                                            type="button"
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                                                reactionFilter === emoji
                                                                    ? 'bg-[#0E9370] text-white'
                                                                    : 'bg-white text-[#475569] ring-1 ring-slate-200'
                                                            }`}
                                                            onClick={() => {
                                                                setReactionFilter(emoji);
                                                                setShowAllReactors(false);
                                                            }}
                                                        >
                                                            <span aria-hidden="true">{emoji}</span>
                                                            {count}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="hr-ov-reactors-scroll mt-2">
                                                <ul className="space-y-1">
                                                    {visibleReactors.map((row, idx) => (
                                                        <li
                                                            key={`${row.userId || row.employeeId || idx}-${row.emoji}`}
                                                            className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-xs text-[#475569]"
                                                        >
                                                            <span className="truncate font-medium text-[#111C2D]">
                                                                {row.name ||
                                                                    row.userName ||
                                                                    row.employeeName ||
                                                                    'Someone'}
                                                            </span>
                                                            <span aria-hidden="true">{row.emoji}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {hiddenReactorCount > 0 && !showAllReactors ? (
                                                <button
                                                    type="button"
                                                    className="mt-2 text-[11px] font-semibold text-[#0E9370] hover:underline"
                                                    onClick={() => setShowAllReactors(true)}
                                                >
                                                    Show {hiddenReactorCount} more
                                                </button>
                                            ) : null}
                                            {showAllReactors && filteredReactors.length > REACTOR_PREVIEW ? (
                                                <button
                                                    type="button"
                                                    className="mt-2 text-[11px] font-semibold text-[#666666] hover:underline"
                                                    onClick={() => setShowAllReactors(false)}
                                                >
                                                    Show less
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <p className="mt-3 text-xs text-[#94A3B8]">
                                            No reactions yet. Tap an emoji above.
                                        </p>
                                    )}

                                    <label
                                        className="hr-ov-label mt-4"
                                        htmlFor="hr-celeb-drawer-wish"
                                    >
                                        Private wish
                                    </label>
                                    <textarea
                                        id="hr-celeb-drawer-wish"
                                        className="hr-ov-textarea"
                                        maxLength={500}
                                        rows={3}
                                        value={wishText}
                                        onChange={(e) => setWishText(e.target.value)}
                                        placeholder="Write a short greeting…"
                                    />
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-[#94A3B8]">
                                            {wishText.length}/500
                                        </span>
                                        <button
                                            type="button"
                                            className="hr-ov-btn hr-ov-btn--primary"
                                            disabled={wishBusy || !wishText.trim()}
                                            onClick={sendWish}
                                        >
                                            {wishBusy ? 'Sending…' : 'Send wish'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </DrawerShell>
    );
}

export function AnnouncementsListModal({ open, items = [], onClose, onNew }) {
    if (!open) return null;
    return (
        <ModalShell
            wide
            eyebrow="Communications"
            title="Announcements"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Cancel
                    </button>
                    {onNew ? (
                        <button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={onNew}>
                            New
                        </button>
                    ) : null}
                </>
            }
        >
            {items.length === 0 ? (
                <div className="hr-ov-empty">No announcements yet.</div>
            ) : (
                <div className="space-y-2.5">
                    {items.map((item) => {
                        const important =
                            item.priority === 'high' ||
                            item.metadata?.important === true ||
                            item.metadata?.priority === 'high';
                        const title =
                            String(item.metadata?.title || '').trim() ||
                            String(item.message || '')
                                .replace(/<[^>]+>/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                        return (
                            <div key={item._id} className="rounded-xl border border-[rgba(109,122,115,0.2)] bg-[#F0F3FF] p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs text-[#666666]">
                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                    </p>
                                    {important ? (
                                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 border border-red-200">
                                            Important
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-1 text-sm font-medium text-[#111C2D]">{title}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </ModalShell>
    );
}

export function ProfilePeekModal({ open, user, onClose }) {
    if (!open || !user) return null;
    const name = user?.name || 'HR Manager';
    return (
        <ModalShell
            eyebrow="Profile"
            title={name}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="hr-ov-btn hr-ov-btn--primary" onClick={onClose}>
                        Done
                    </button>
                </>
            }
        >
            <div className="hr-ov-metric-grid">
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Role</p>
                    <p className="hr-ov-metric__value">{user?.jobTitle || user?.position || user?.role || 'HR Manager'}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Email</p>
                    <p className="hr-ov-metric__value truncate">{user?.email || '—'}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Department</p>
                    <p className="hr-ov-metric__value">{user?.department || '—'}</p>
                </div>
                <div className="hr-ov-metric">
                    <p className="hr-ov-metric__label">Employee ID</p>
                    <p className="hr-ov-metric__value">{user?.employeeId || '—'}</p>
                </div>
            </div>
        </ModalShell>
    );
}

export function AddEmployeeModal({ open, onClose, onContinueFull }) {
    const [form, setForm] = useState({
        name: '',
        jobTitle: '',
        department: '',
        workLocation: '',
        joiningDate: '',
    });

    useEffect(() => {
        if (open) {
            setForm({
                name: '',
                jobTitle: '',
                department: '',
                workLocation: '',
                joiningDate: '',
            });
        }
    }, [open]);

    if (!open) return null;

    const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

    return (
        <ModalShell
            wide
            eyebrow="Quick onboarding provision"
            title="Add New Employee"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="hr-ov-btn hr-ov-btn--ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="hr-ov-btn hr-ov-btn--primary"
                        onClick={() => onContinueFull?.(form)}
                    >
                        Save
                    </button>
                </>
            }
        >
            <div className="hr-ov-grid-2">
                <div>
                    <label className="hr-ov-label" htmlFor="hr-add-name">Full Legal Name *</label>
                    <input
                        id="hr-add-name"
                        className="hr-ov-input"
                        placeholder="e.g. Rahul Sharma"
                        value={form.name}
                        onChange={setField('name')}
                    />
                </div>
                <div>
                    <label className="hr-ov-label" htmlFor="hr-add-title">Designation</label>
                    <input
                        id="hr-add-title"
                        className="hr-ov-input"
                        placeholder="e.g. Lead Systems Architect"
                        value={form.jobTitle}
                        onChange={setField('jobTitle')}
                    />
                </div>
                <div>
                    <label className="hr-ov-label" htmlFor="hr-add-dept">Department</label>
                    <input
                        id="hr-add-dept"
                        className="hr-ov-input"
                        placeholder="e.g. Engineering"
                        value={form.department}
                        onChange={setField('department')}
                    />
                </div>
                <div>
                    <label className="hr-ov-label" htmlFor="hr-add-loc">Campus Hub</label>
                    <input
                        id="hr-add-loc"
                        className="hr-ov-input"
                        placeholder="e.g. Bengaluru HQ"
                        value={form.workLocation}
                        onChange={setField('workLocation')}
                    />
                </div>
                <div>
                    <label className="hr-ov-label" htmlFor="hr-add-doj">Date of Joining</label>
                    <input
                        id="hr-add-doj"
                        type="date"
                        className="hr-ov-input"
                        value={form.joiningDate}
                        onChange={setField('joiningDate')}
                    />
                </div>
            </div>
        </ModalShell>
    );
}
