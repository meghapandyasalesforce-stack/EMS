import React, { useMemo } from 'react';
import { format, isValid, differenceInCalendarDays } from 'date-fns';
import {
    FaTasks, FaFileAlt, FaGraduationCap, FaCalendarAlt, FaChevronRight,
} from 'react-icons/fa';

function formatShortDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (!isValid(d)) return '—';
    return format(d, 'MMM d, yyyy');
}

/**
 * Overview sidebar — dates, progress chips, and tab shortcuts (replaces Key Contacts).
 */
export default function OnboardingOverviewSnapshot({
    wf,
    progressPct,
    onDetailTabChange,
    isFeatureEnabled,
}) {
    const tasks = wf.tasks || [];
    const pendingTasks = tasks.filter((t) => t.status !== 'Completed').length;
    const overdueTasks = tasks.filter((t) => t.status === 'Overdue').length;

    const docTotal = wf.documentSummary?.total ?? (wf.documents?.length || 0);
    const docVerified = wf.documentSummary?.verified
        ?? (wf.documents || []).filter((d) => d.status === 'Verified').length;
    const docsPending = Math.max(0, docTotal - docVerified);

    const modules = wf.trainingModules || [];
    const trainingPending = modules.filter((m) => m.status !== 'Completed').length;

    const targetDate = wf.expectedCompletionDate || wf.joiningDate;
    const daysLeft = targetDate
        ? Math.max(0, differenceInCalendarDays(new Date(targetDate), new Date()))
        : null;

    const shortcuts = useMemo(() => {
        const items = [
            {
                id: 'tasks',
                label: 'Tasks',
                sub: overdueTasks > 0
                    ? `${overdueTasks} overdue · ${pendingTasks} open`
                    : `${pendingTasks} open`,
                icon: FaTasks,
                show: tasks.length > 0,
                attention: overdueTasks > 0,
            },
        ];
        if (isFeatureEnabled('documentCollection') && docTotal > 0) {
            items.push({
                id: 'documents',
                label: 'Documents',
                sub: docsPending > 0 ? `${docsPending} pending verification` : 'All verified',
                icon: FaFileAlt,
                show: true,
                attention: docsPending > 0,
            });
        }
        if (modules.length > 0 || isFeatureEnabled('mandatoryTraining')) {
            items.push({
                id: 'training',
                label: 'Training',
                sub: trainingPending > 0 ? `${trainingPending} module${trainingPending === 1 ? '' : 's'} left` : 'Complete',
                icon: FaGraduationCap,
                show: modules.length > 0,
                attention: trainingPending > 0,
            });
        }
        return items.filter((i) => i.show);
    }, [
        tasks.length, pendingTasks, overdueTasks, docTotal, docsPending,
        modules.length, trainingPending, isFeatureEnabled,
    ]);

    return (
        <div className="cm-card cm-overview-snapshot">
            <h2 className="cm-title-sm mb-4">Onboarding snapshot</h2>

            <dl className="cm-overview-snapshot__dates">
                <div>
                    <dt className="cm-label flex items-center gap-1.5">
                        <FaCalendarAlt className="text-[10px]" aria-hidden />
                        Join date
                    </dt>
                    <dd className="mt-0.5 text-sm font-bold text-[var(--cm-on-surface)]">
                        {formatShortDate(wf.joiningDate)}
                    </dd>
                </div>
                <div>
                    <dt className="cm-label">Task completion</dt>
                    <dd className="mt-0.5 text-sm font-bold text-[var(--cm-on-surface)]">
                        {formatShortDate(wf.expectedCompletionDate)}
                    </dd>
                </div>
            </dl>

            <div className="cm-overview-snapshot__stats">
                <div className="cm-overview-snapshot__stat">
                    <span className="cm-label">Overall</span>
                    <span className="text-xl font-bold text-[var(--cm-primary-deep)]">{progressPct}%</span>
                </div>
                <div className="cm-overview-snapshot__stat">
                    <span className="cm-label">Days left</span>
                    <span className="text-xl font-bold text-[var(--cm-tertiary)]">
                        {daysLeft != null ? daysLeft : '—'}
                    </span>
                </div>
            </div>

            {shortcuts.length > 0 && (
                <>
                    <p className="cm-label mb-2 mt-5">Jump to</p>
                    <ul className="cm-overview-snapshot__links">
                        {shortcuts.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className="cm-overview-snapshot__link"
                                        onClick={() => onDetailTabChange(item.id)}
                                    >
                                        <span className="cm-overview-snapshot__link-icon" aria-hidden>
                                            <Icon />
                                        </span>
                                        <span className="min-w-0 flex-1 text-left">
                                            <span className="block text-sm font-bold text-[var(--cm-on-surface)]">
                                                {item.label}
                                            </span>
                                            <span className={`block text-xs ${item.attention ? 'text-[var(--cm-tertiary-deep)] font-semibold' : 'text-[var(--cm-muted)]'}`}>
                                                {item.sub}
                                            </span>
                                        </span>
                                        <FaChevronRight className="shrink-0 text-xs text-[var(--cm-muted)]" aria-hidden />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {wf.status && (
                <p className="mt-4 text-center text-xs text-[var(--cm-muted)]">
                    Workflow status:{' '}
                    <span className="font-semibold text-[var(--cm-on-surface)]">{wf.status}</span>
                </p>
            )}
        </div>
    );
}
