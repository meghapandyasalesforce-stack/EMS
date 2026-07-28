import React, { useMemo, useState } from 'react';
import {
    format, isToday, isYesterday, isValid, differenceInCalendarDays,
} from 'date-fns';
import {
    FaLaptop, FaShieldAlt, FaCheckCircle, FaFileAlt, FaUser,
    FaTasks, FaGraduationCap, FaComment, FaHistory, FaSync,
    FaFilter, FaBroadcastTower, FaPlay, FaPause, FaFlag,
} from 'react-icons/fa';
import { getProfilePhotoUrl } from '../../utils/axios';
import { CmButton, cmInitials } from '../../components/corporateModern';

const ACTIVITY_INITIAL = 6;
const ACTIVITY_STEP = 4;

function formatActivityWhen(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!isValid(date)) return '';
    const time = format(date, 'h:mm a');
    if (isToday(date)) return `Today, ${time}`;
    if (isYesterday(date)) return `Yesterday, ${time}`;
    return format(date, "MMM d, yyyy '·' h:mm a");
}

function activityIcon(action = '', description = '') {
    const text = `${action} ${description}`.toLowerCase();
    if (/asset|laptop|macbook|provision|hardware|it_/.test(text)) return FaLaptop;
    if (/document|verif|identity|bgv|i-9|passport/.test(text)) return FaShieldAlt;
    if (/train|lms|course|module|cert/.test(text)) return FaGraduationCap;
    if (/task|checklist/.test(text)) return FaTasks;
    if (/note|comment/.test(text)) return FaComment;
    if (/pause/.test(text)) return FaPause;
    if (/resume|start|publish/.test(text)) return FaPlay;
    if (/cancel|flag|overdue/.test(text)) return FaFlag;
    if (/complete|done|finish/.test(text)) return FaCheckCircle;
    if (/file|upload/.test(text)) return FaFileAlt;
    if (/assign|buddy|manager|hr/.test(text)) return FaUser;
    return FaHistory;
}

function titleParts(act) {
    const raw = (act.description || (act.action || 'Activity').replaceAll('_', ' ')).trim();
    const colon = raw.indexOf(':');
    if (colon > 0 && colon < raw.length - 1) {
        return {
            prefix: raw.slice(0, colon + 1).trim(),
            highlight: raw.slice(colon + 1).trim(),
        };
    }
    const actionLabel = String(act.action || '')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    if (actionLabel && act.description && actionLabel.toLowerCase() !== act.description.toLowerCase()) {
        return { prefix: `${actionLabel}:`, highlight: act.description };
    }
    return { prefix: '', highlight: raw };
}

function contactPerson(field, fallbackRole) {
    if (!field) return null;
    if (typeof field === 'object' && (field.name || field.lastName)) {
        return {
            name: [field.name, field.lastName].filter(Boolean).join(' ').trim(),
            photo: getProfilePhotoUrl(field.profilePhoto),
            role: fallbackRole,
        };
    }
    if (typeof field === 'string' && field.trim()) {
        return { name: field.trim(), photo: null, role: fallbackRole };
    }
    return null;
}

/**
 * Activity tab — Recent Activity timeline + progress / assigned team sidebar (TalentFlow mock).
 */
export default function OnboardingActivityTab({
    wf,
    breakdown,
    viewerRole = 'hr',
    refreshWorkflow,
    newNote,
    setNewNote,
    addNote,
}) {
    const isHr = viewerRole === 'hr';
    const [visibleCount, setVisibleCount] = useState(ACTIVITY_INITIAL);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterKey, setFilterKey] = useState('all');

    const allActivities = useMemo(() => {
        const feed = [...(wf.activityFeed || [])];
        feed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return feed;
    }, [wf.activityFeed]);

    const filtered = useMemo(() => {
        if (filterKey === 'all') return allActivities;
        return allActivities.filter((act) => {
            const text = `${act.action || ''} ${act.description || ''}`.toLowerCase();
            if (filterKey === 'tasks') return /task|checklist|complete/.test(text);
            if (filterKey === 'documents') return /document|verif|identity|upload|bgv/.test(text);
            if (filterKey === 'system') {
                const noActor = !act.actor && !act.actorName;
                return noActor || /system|auto|sync|schedule/.test(text);
            }
        });
    }, [allActivities, filterKey]);

    const visible = filtered.slice(0, visibleCount);
    const hasMore = filtered.length > visibleCount;

    const allTasks = wf.tasks || [];
    const completedTasks = allTasks.filter((t) => t.status === 'Completed').length;
    const progressPct = Math.max(0, Math.min(100, Number(wf.progress) || Number(breakdown?.overall) || 0));
    const targetDate = wf.expectedCompletionDate || wf.joiningDate;
    const daysLeft = targetDate
        ? Math.max(0, differenceInCalendarDays(new Date(targetDate), new Date()))
        : null;

    const team = useMemo(() => {
        const rows = [];
        const hr = contactPerson(wf.assignedHR, 'HR Specialist');
        if (hr) rows.push(hr);
        const mgr = contactPerson(wf.assignedManager, 'Hiring Manager');
        if (mgr) rows.push(mgr);
        const buddy = contactPerson(wf.assignedBuddy, 'Onboarding Buddy');
        if (buddy) rows.push(buddy);
        return rows;
    }, [wf.assignedHR, wf.assignedManager, wf.assignedBuddy]);

    return (
        <div className="space-y-4">
            <div className="hrms-main-rail">
                <div className="cm-card">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="cm-title-sm mb-0">Recent Activity</h2>
                        <div className="relative flex items-center gap-1">
                            <button
                                type="button"
                                className="cm-icon-btn"
                                aria-label="Filter activity"
                                aria-expanded={filterOpen}
                                onClick={() => setFilterOpen((o) => !o)}
                            >
                                <FaFilter />
                            </button>
                            <button
                                type="button"
                                className="cm-icon-btn"
                                aria-label="Refresh activity"
                                onClick={() => refreshWorkflow?.()}
                            >
                                <FaSync />
                            </button>
                            {filterOpen && (
                                <div className="cm-activity-filter-menu" role="menu">
                                    {[
                                        { key: 'all', label: 'All activity' },
                                        { key: 'tasks', label: 'Tasks' },
                                        { key: 'documents', label: 'Documents' },
                                        { key: 'system', label: 'System' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            role="menuitem"
                                            className={filterKey === opt.key ? 'is-active' : ''}
                                            onClick={() => {
                                                setFilterKey(opt.key);
                                                setVisibleCount(ACTIVITY_INITIAL);
                                                setFilterOpen(false);
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {visible.length === 0 ? (
                        <p className="py-10 text-center text-sm text-[var(--cm-muted)]">
                            No activity recorded yet.
                        </p>
                    ) : (
                        <div className="cm-activity-feed">
                            {visible.map((act, i) => {
                                const Icon = activityIcon(act.action, act.description);
                                const { prefix, highlight } = titleParts(act);
                                const actorLabel = act.actor?.name
                                    || act.actorName
                                    || 'Automated System';
                                const isSystem = !act.actor && (!act.actorName || /system|auto/i.test(act.actorName || ''));
                                return (
                                    <article key={act._id || `${act.action}-${i}`} className="cm-activity-feed__item">
                                        <span className="cm-activity-feed__icon" aria-hidden>
                                            <Icon />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <h3 className="text-sm font-semibold text-[var(--cm-on-surface)]">
                                                    {prefix ? (
                                                        <>
                                                            {prefix}{' '}
                                                            <span className="font-bold">{highlight}</span>
                                                        </>
                                                    ) : (
                                                        <span className="font-bold">{highlight}</span>
                                                    )}
                                                </h3>
                                                <time className="shrink-0 text-xs font-medium text-[var(--cm-muted)]">
                                                    {formatActivityWhen(act.createdAt)}
                                                </time>
                                            </div>
                                            {act.metadata?.detail || act.metadata?.notes ? (
                                                <p className="mt-1 text-sm text-[var(--cm-on-variant)]">
                                                    {act.metadata.detail || act.metadata.notes}
                                                </p>
                                            ) : act.description && prefix ? (
                                                <p className="mt-1 text-sm text-[var(--cm-on-variant)]">
                                                    {act.description}
                                                </p>
                                            ) : null}
                                            <p className="cm-activity-feed__actor mt-2">
                                                {isSystem ? (
                                                    <FaBroadcastTower aria-hidden />
                                                ) : (
                                                    <FaUser aria-hidden />
                                                )}
                                                <span>{actorLabel}</span>
                                            </p>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {hasMore && (
                        <div className="mt-6 flex justify-center">
                            <CmButton
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => setVisibleCount((n) => Math.min(n + ACTIVITY_STEP, filtered.length))}
                            >
                                Load more activity
                            </CmButton>
                        </div>
                    )}

                </div>

                <aside className="flex flex-col gap-4">
                    <div className="cm-card">
                        <h3 className="mb-4 font-bold text-[var(--cm-on-surface)]">Onboarding Progress</h3>
                        <div className="mb-1.5 flex justify-between text-sm">
                            <span className="text-[var(--cm-muted)]">Overall Completion</span>
                            <span className="font-bold text-[var(--cm-on-surface)]">{progressPct}%</span>
                        </div>
                        <div className="cm-progress cm-progress--lg" role="progressbar" aria-valuenow={progressPct}>
                            <div className="cm-progress__bar" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="cm-activity-stat">
                                <p className="cm-label mb-1">Tasks Done</p>
                                <p className="text-2xl font-bold text-[var(--cm-on-surface)]">
                                    {completedTasks}/{allTasks.length}
                                </p>
                            </div>
                            <div className="cm-activity-stat">
                                <p className="cm-label mb-1">Days Left</p>
                                <p className="text-2xl font-bold text-[var(--cm-tertiary)]">
                                    {daysLeft != null ? daysLeft : '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="cm-card">
                        <h3 className="mb-4 font-bold text-[var(--cm-on-surface)]">Assigned Team</h3>
                        {team.length === 0 ? (
                            <p className="text-sm text-[var(--cm-muted)]">No assignees yet.</p>
                        ) : (
                            <ul className="space-y-4">
                                {team.map((member) => (
                                    <li key={`${member.role}-${member.name}`} className="flex items-center gap-3">
                                        {member.photo ? (
                                            <img
                                                src={member.photo}
                                                alt=""
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cm-surface-low)] text-xs font-bold text-[var(--cm-primary-deep)]">
                                                {cmInitials(member.name)}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-[var(--cm-on-surface)]">
                                                {member.name}
                                            </p>
                                            <p className="text-xs text-[var(--cm-muted)]">{member.role}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {isHr && (
                        <div className="cm-card">
                            <label className="cm-label mb-2 block">Internal Notes</label>
                            <div className="flex flex-col gap-3">
                                <input
                                    className="cm-input w-full"
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Add a note for the team..."
                                />
                                <CmButton variant="primary" onClick={addNote}>Post</CmButton>
                            </div>
                            <div className="mt-4 space-y-2">
                                {(wf.notes || []).map((n, i) => (
                                    <div
                                        key={n._id || i}
                                        className="rounded-xl border border-[rgba(255,152,106,0.28)] bg-[rgba(255,219,205,0.45)] p-3 text-sm"
                                    >
                                        <p>{n.note}</p>
                                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                                            {n.addedBy?.name || 'HR'}
                                            {n.addedAt ? ` · ${format(new Date(n.addedAt), 'MMM dd, yyyy')}` : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
