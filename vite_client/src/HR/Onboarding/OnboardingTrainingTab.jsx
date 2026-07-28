import React, { useMemo, useState } from 'react';
import { format, addDays, isValid, isTomorrow, isToday } from 'date-fns';
import {
    FaUsers, FaGavel, FaLaptop, FaShieldAlt, FaGraduationCap,
    FaCheckCircle, FaEdit, FaRocket, FaMedal, FaCertificate,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { CmButton } from '../../components/corporateModern';

function moduleProgress(mod) {
    const status = String(mod?.status || 'Not Started');
    if (status === 'Completed') return 100;
    if (typeof mod?.score === 'number') return Math.max(0, Math.min(100, Math.round(mod.score)));
    if (status === 'In Progress') return 45;
    if (status === 'Failed') return Math.max(0, Math.min(100, Math.round(mod?.score || 0)));
    return 0;
}

function statusMeta(status) {
    const s = String(status || 'Not Started');
    if (s === 'Completed') return { label: 'COMPLETE', className: 'cm-train-status cm-train-status--done' };
    if (s === 'In Progress') return { label: 'IN PROGRESS', className: 'cm-train-status cm-train-status--progress' };
    if (s === 'Failed') return { label: 'FAILED', className: 'cm-train-status cm-train-status--failed' };
    return { label: 'NOT STARTED', className: 'cm-train-status cm-train-status--pending' };
}

function moduleIcon(title = '') {
    const t = title.toLowerCase();
    if (/culture|value|people|team/.test(t)) return FaUsers;
    if (/privacy|legal|complian|policy|gavel/.test(t)) return FaGavel;
    if (/it |tech|laptop|system|best practice/.test(t)) return FaLaptop;
    if (/safety|security|shield|health/.test(t)) return FaShieldAlt;
    return FaGraduationCap;
}

function moduleSource(mod) {
    if (mod?.phase) return mod.phase;
    if (mod?.type === 'quiz') return 'Assessment';
    if (mod?.type === 'document') return 'Policy Library';
    if (mod?.type === 'video') return 'Internal Academy';
    return 'Internal Academy';
}

function formatSessionWhen(date) {
    if (!date || !isValid(date)) return 'TBD';
    if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, h:mm a');
}

function badgeIconForTitle(title = '') {
    const t = title.toLowerCase();
    if (/culture|value/.test(t)) return FaMedal;
    if (/secur|privacy|safety/.test(t)) return FaShieldAlt;
    if (/fast|track|rocket|onboard/.test(t)) return FaRocket;
    return FaCertificate;
}

/**
 * Training tab — mandatory modules grid, LMS rules, live sessions, badges (TalentFlow mock).
 */
export default function OnboardingTrainingTab({
    wf,
    viewerRole = 'hr',
    completeTraining,
    submitting,
}) {
    const isHr = viewerRole === 'hr';
    const isEmployee = viewerRole === 'employee';
    const modules = wf?.trainingModules || [];
    const [editingModuleId, setEditingModuleId] = useState(null);
    const [editDueDate, setEditDueDate] = useState('');

    const requiredCount = useMemo(
        () => modules.filter((m) => m.mandatory !== false).length || modules.length,
        [modules],
    );

    const enrollmentDeadline = useMemo(() => {
        const withDue = modules.map((m) => m.dueDate).filter(Boolean).map((d) => new Date(d));
        if (withDue.length) {
            return new Date(Math.min(...withDue.map((d) => d.getTime())));
        }
        const start = wf?.scheduledStartDate || wf?.joiningDate;
        if (start) return addDays(new Date(start), 15);
        return null;
    }, [modules, wf?.scheduledStartDate, wf?.joiningDate]);

    const liveSessions = useMemo(() => {
        const fromBuddy = (wf?.buddyCheckins || [])
            .filter((c) => c.scheduledDate && c.status !== 'Completed')
            .map((c) => ({
                id: c._id || c.title,
                when: new Date(c.scheduledDate),
                title: c.title || 'Buddy check-in',
                place: 'Virtual',
                kind: 'Mandatory',
            }));

        const fromModules = modules
            .filter((m) => m.status !== 'Completed' && m.dueDate)
            .slice(0, 2)
            .map((m) => ({
                id: `mod-${m._id || m.title}`,
                when: new Date(m.dueDate),
                title: m.title,
                place: 'Virtual',
                kind: m.mandatory === false ? 'Optional' : 'Mandatory',
            }));

        const fallback = [
            {
                id: 'fallback-1',
                when: addDays(new Date(), 1),
                title: 'Product Strategy Sync',
                place: 'Virtual',
                kind: 'Mandatory',
            },
            {
                id: 'fallback-2',
                when: addDays(new Date(), 3),
                title: 'Security Deep Dive',
                place: 'Room 402',
                kind: 'Optional',
            },
        ];

        const merged = [...fromBuddy, ...fromModules];
        const list = (merged.length ? merged : fallback)
            .sort((a, b) => a.when - b.when)
            .slice(0, 4);
        return list;
    }, [wf?.buddyCheckins, modules]);

    const earnedBadges = useMemo(() => {
        return modules
            .filter((m) => m.status === 'Completed')
            .map((m) => ({
                id: m._id || m.title,
                title: m.title.length > 18 ? `${m.title.slice(0, 16)}…` : m.title,
                fullTitle: m.title,
                date: m.completedAt ? format(new Date(m.completedAt), 'MMM d, yyyy') : null,
                Icon: badgeIconForTitle(m.title),
                certificateUrl: m.certificateUrl,
            }));
    }, [modules]);

    const startDateLabel = (() => {
        const d = wf?.scheduledStartDate || wf?.joiningDate;
        if (!d) return null;
        const date = new Date(d);
        return isValid(date) ? format(date, 'MMM d, yyyy') : null;
    })();

    const handleMarkComplete = async (mod) => {
        if (!completeTraining || !mod?._id) {
            toast.info('Training completion is not available for this view.');
            return;
        }
        await completeTraining(mod._id);
    };

    const openEdit = (mod) => {
        setEditingModuleId(mod._id || mod.title);
        setEditDueDate(mod.dueDate ? format(new Date(mod.dueDate), 'yyyy-MM-dd') : '');
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <h2 className="cm-title-sm mb-0">Mandatory Training</h2>
                        <span className="text-sm font-medium text-[var(--cm-muted)]">
                            {requiredCount} Module{requiredCount === 1 ? '' : 's'} Required
                        </span>
                    </div>

                    {modules.length === 0 ? (
                        <div className="cm-card py-12 text-center">
                            <FaGraduationCap className="mx-auto mb-3 text-3xl text-[var(--cm-muted)]" />
                            <p className="text-sm text-[var(--cm-muted)]">
                                No training modules assigned yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {modules.map((mod) => {
                                const Icon = moduleIcon(mod.title);
                                const st = statusMeta(mod.status);
                                const pct = moduleProgress(mod);
                                const isEditing = editingModuleId === (mod._id || mod.title);
                                return (
                                    <article key={mod._id || mod.title} className="cm-train-card">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="cm-train-card__icon" aria-hidden>
                                                <Icon />
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={st.className}>{st.label}</span>
                                                {isHr && (
                                                    <button
                                                        type="button"
                                                        className="cm-icon-btn"
                                                        aria-label={`Edit ${mod.title}`}
                                                        onClick={() => openEdit(mod)}
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="mt-3 text-base font-bold text-[var(--cm-on-surface)]">
                                            {mod.title}
                                        </h3>
                                        <p className="mt-0.5 text-sm text-[var(--cm-muted)]">
                                            {moduleSource(mod)}
                                        </p>

                                        {mod.status === 'Completed' && mod.completedAt && (
                                            <p className="mt-2 text-xs font-semibold text-[var(--cm-primary-deep)]">
                                                Completed {format(new Date(mod.completedAt), 'MMM d, yyyy')}
                                            </p>
                                        )}

                                        <div className="mt-4">
                                            <div className="mb-1.5 flex justify-between text-xs font-semibold text-[var(--cm-muted)]">
                                                <span>Progress</span>
                                                <span className="text-[var(--cm-on-surface)]">{pct}%</span>
                                            </div>
                                            <div className="cm-progress" role="progressbar" aria-valuenow={pct}>
                                                <div className="cm-progress__bar" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="mt-3 space-y-2 rounded-xl bg-[var(--cm-surface-low)] p-3">
                                                <label className="cm-label">Completion due date</label>
                                                <input
                                                    type="date"
                                                    className="cm-input mt-1 w-full"
                                                    value={editDueDate}
                                                    onChange={(e) => setEditDueDate(e.target.value)}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <CmButton
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setEditingModuleId(null)}
                                                    >
                                                        Cancel
                                                    </CmButton>
                                                    <CmButton
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => {
                                                            toast.info('Module due date will sync from LMS settings.');
                                                            setEditingModuleId(null);
                                                        }}
                                                    >
                                                        Save
                                                    </CmButton>
                                                </div>
                                            </div>
                                        )}

                                        {isEmployee && mod.status !== 'Completed' && mod._id && completeTraining && (
                                            <CmButton
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="mt-3 w-full"
                                                disabled={submitting}
                                                onClick={() => handleMarkComplete(mod)}
                                            >
                                                Mark complete
                                            </CmButton>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>

                <aside className="flex flex-col gap-4">
                    <div className="cm-card">
                        <p className="cm-label mb-3">LMS Enrollment Rules</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3">
                                <span className="cm-train-rule-check" aria-hidden>
                                    <FaCheckCircle />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-[var(--cm-on-surface)]">
                                        Auto-enrollment: Active
                                    </p>
                                    <p className="text-xs text-[var(--cm-muted)]">
                                        New hires are automatically enrolled in Tier 1 modules.
                                    </p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="cm-train-rule-check" aria-hidden>
                                    <FaCheckCircle />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-[var(--cm-on-surface)]">
                                        Completion Deadline
                                    </p>
                                    <p className="text-xs text-[var(--cm-muted)]">
                                        15 days from start date
                                        {enrollmentDeadline
                                            ? ` (${format(enrollmentDeadline, 'MMM d, yyyy')})`
                                            : startDateLabel
                                                ? ` (from ${startDateLabel})`
                                                : ''}
                                        .
                                    </p>
                                </div>
                            </li>
                        </ul>
                        {isHr && (
                            <CmButton
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-4 w-full"
                                onClick={() => toast.info('Enrollment rules are managed in LMS settings.')}
                            >
                                Update Rules
                            </CmButton>
                        )}
                    </div>

                    <div className="cm-card">
                        <p className="cm-label mb-3">Upcoming Live Sessions</p>
                        <div className="space-y-2">
                            {liveSessions.map((session) => (
                                <div key={session.id} className="cm-train-session">
                                    <p className="text-xs font-medium text-[var(--cm-muted)]">
                                        {formatSessionWhen(session.when)}
                                    </p>
                                    <p className="mt-0.5 text-sm font-bold text-[var(--cm-on-surface)]">
                                        {session.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-[var(--cm-muted)]">
                                        {session.place} • {session.kind}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            <div className="cm-card">
                <h3 className="mb-4 font-bold text-[var(--cm-on-surface)]">Earned Certificates & Badges</h3>
                <div className="cm-train-badges">
                    {earnedBadges.length > 0 && (
                        <div className="flex flex-wrap gap-6">
                            {earnedBadges.map((badge) => {
                                const Icon = badge.Icon;
                                return (
                                    <div key={badge.id} className="cm-train-badge" title={badge.fullTitle}>
                                        <span className="cm-train-badge__ring">
                                            <Icon />
                                        </span>
                                        <p className="mt-2 text-xs font-bold text-[var(--cm-on-surface)]">
                                            {badge.title}
                                        </p>
                                        {badge.date && (
                                            <p className="text-[11px] text-[var(--cm-muted)]">{badge.date}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className={`cm-train-badge-cta ${earnedBadges.length ? '' : 'cm-train-badge-cta--solo'}`}>
                        <p className="text-sm text-[var(--cm-muted)]">
                            Complete more modules to unlock professional badges
                        </p>
                        <button
                            type="button"
                            className="cm-link mt-2 text-sm font-semibold"
                            onClick={() => toast.info('Badge gallery opens when more certifications are earned.')}
                        >
                            View Badge Gallery
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
