import React, { useMemo, useState, useEffect } from 'react';
import { format, differenceInCalendarDays, isValid } from 'date-fns';
import {
    FaArrowLeft, FaCheckCircle, FaTasks, FaFileAlt, FaClock, FaLaptop,
    FaUser, FaHistory, FaChevronDown, FaChevronUp,
    FaCalendarAlt, FaIdBadge, FaUsers, FaMoneyCheckAlt, FaBoxOpen,
    FaExternalLinkAlt, FaPlay, FaFlag, FaEdit,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import {
    TASK_GROUPS_BY_ROLE, ASSET_STATUSES, getTaskCompletionBlockers, canCompleteTask,
} from '../../constants/onboardingConstants';
import {
    CmBadge, CmButton, CmRing, statusTone, cmInitials,
} from '../../components/corporateModern';
import OnboardingVerificationTab from './OnboardingVerificationTab';
import OnboardingTrainingTab from './OnboardingTrainingTab';
import OnboardingActivityTab from './OnboardingActivityTab';
import OnboardingAccessControl from './OnboardingAccessControl';
import OnboardingOverviewSnapshot from './OnboardingOverviewSnapshot';

const DETAIL_TABS_ALL = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'documents', label: 'Documents & Verification' },
    { id: 'training', label: 'Training' },
    { id: 'activity', label: 'Activity' },
];

function tabsForViewer(viewerRole) {
    return DETAIL_TABS_ALL;
}

function toDateInputValue(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (!isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
}

function formatDisplayDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (!isValid(date)) return null;
    return format(date, 'MMM dd, yyyy');
}

const TASK_GROUP_META = {
    employee: { title: 'Employee (Self)', Icon: FaUser },
    hr: { title: 'HR Department', Icon: FaIdBadge },
    it: { title: 'IT & Infrastructure', Icon: FaLaptop },
    manager: { title: 'Manager & Buddy', Icon: FaUsers },
    buddy: { title: 'Buddy Program', Icon: FaUsers },
    payroll: { title: 'Payroll', Icon: FaMoneyCheckAlt },
};

const TASK_ACTION_SECTIONS = {
    'Assign laptop and equipment': 'onboarding-assets',
    'Manager induction session': 'onboarding-manager-actions',
    'Buddy welcome meeting': 'onboarding-buddy-checkins',
};

const TASK_ACTION_ROUTES = {
    'Upload identity documents': '/employee/documents-id',
    'Upload bank details': '/financial-details',
    'Verify employee documents': '/documents',
};

const ACTIVITY_INITIAL_VISIBLE = 4;
const ACTIVITY_LOAD_MORE_STEP = 4;

const DEFAULT_OVERVIEW_PHASES = [
    {
        title: 'Pre-boarding',
        description: 'Contracts signed, equipment ordered, and welcome kit dispatched.',
    },
    {
        title: 'First Day',
        description: 'Office tour, security badge, and initial team introductions.',
    },
    {
        title: 'Week 1',
        description: 'Setting up development environment and first 1:1 with manager.',
    },
    {
        title: 'Month 1',
        description: 'Full project integration and first monthly performance review.',
    },
];

function mapApiMilestoneStatus(status) {
    if (status === 'Completed') return 'complete';
    if (status === 'In Progress') return 'active';
    return 'upcoming';
}

function buildOverviewMilestones(wf, progressPct) {
    const api = wf?.milestones || [];
    if (api.length) {
        return api.map((m, idx) => ({
            id: m._id || m.day || idx,
            title: m.title || `${m.day}-Day Review`,
            description: m.goals?.[0]?.title
                || m.actionItems?.[0]?.title
                || 'Review goals and checkpoints for this milestone.',
            phase: mapApiMilestoneStatus(m.status),
            last: idx === api.length - 1,
        }));
    }

    let activeIndex = 0;
    if (progressPct >= 90) activeIndex = 3;
    else if (progressPct >= 65) activeIndex = 2;
    else if (progressPct >= 35) activeIndex = 1;

    return DEFAULT_OVERVIEW_PHASES.map((phase, idx) => {
        let phaseStatus = 'upcoming';
        if (progressPct >= 100) phaseStatus = 'complete';
        else if (idx < activeIndex) phaseStatus = 'complete';
        else if (idx === activeIndex) phaseStatus = 'active';
        return {
            id: phase.title,
            ...phase,
            phase: phaseStatus,
            last: idx === DEFAULT_OVERVIEW_PHASES.length - 1,
        };
    });
}

function contactPerson(field) {
    if (!field) return null;
    if (typeof field === 'object' && field.name) {
        return {
            name: [field.name, field.lastName].filter(Boolean).join(' ').trim(),
            photo: null,
        };
    }
    return { name: String(field), photo: null };
}

function workflowStatusLabel(status) {
    if (['In Progress', 'Not Started', 'Scheduled', 'Draft', 'Overdue'].includes(status)) return 'In Onboarding';
    if (status === 'Completed') return 'Onboarded';
    return status;
}

function formatContactShortName(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
    return parts[0] || '';
}

function milestonePhaseBadge(phase) {
    if (phase === 'complete') return { label: 'Complete', className: 'cm-milestone-badge cm-milestone-badge--done' };
    if (phase === 'active') return { label: 'Active', className: 'cm-milestone-badge cm-milestone-badge--active' };
    return { label: 'Upcoming', className: 'cm-milestone-badge cm-milestone-badge--upcoming' };
}

function taskPriorityClass(priority) {
    const p = String(priority || 'Medium').toLowerCase();
    if (p === 'high' || p === 'critical') return 'cm-task-priority cm-task-priority--high';
    return 'cm-task-priority';
}

function taskStatusPill(status) {
    const s = String(status || 'Pending');
    if (s === 'Overdue') return { className: 'cm-status-pill cm-status-pill--overdue', text: 'OVERDUE' };
    if (s === 'Completed') return { className: 'cm-status-pill cm-status-pill--done', text: 'COMPLETED' };
    if (s === 'In Progress') return { className: 'cm-status-pill cm-status-pill--progress', text: 'IN PROGRESS' };
    return { className: 'cm-status-pill cm-status-pill--pending', text: 'PENDING' };
}

function assetDisplayStatus(status) {
    if (status === 'Assigned') return { tone: 'done', label: 'ASSIGNED' };
    if (status === 'Pending') return { tone: 'attention', label: 'IN TRANSIT' };
    return { tone: 'neutral', label: String(status || 'PENDING').toUpperCase() };
}

function documentCheckLabel(doc) {
    return doc.name || doc.documentType?.replace(/_/g, ' ') || 'Document';
}

/**
 * HR onboarding employee detail — Ethan Caldwell / TalentFlow tabbed layout.
 */
export default function OnboardingHrDetailView({
    wf,
    breakdown,
    tasksByRole,
    visibleTasks = [],
    viewerRole = 'hr',
    isManagerView = false,
    detailTab,
    onDetailTabChange,
    detailSectionRef,
    closeWorkflow,
    performWorkflowAction,
    setShowCancelConfirm,
    submitting,
    expandedTaskGroups,
    toggleTaskGroup,
    updateTask,
    canActOnTask,
    openTaskAction,
    updateAsset,
    newNote,
    setNewNote,
    addNote,
    navigate,
    isFeatureEnabled,
    filterByFeature,
    refreshWorkflow,
    updateWorkflowSchedule,
    isOnboardingEmployee,
    completeTraining,
}) {
    const isHr = viewerRole === 'hr';
    const isEmployeeView = viewerRole === 'employee';
    const detailTabs = useMemo(() => tabsForViewer(viewerRole), [viewerRole]);

    const emp = wf.employeeId || {};
    const fullName = [emp.name, emp.lastName].filter(Boolean).join(' ');
    const { photoUrl } = useSignedProfilePhoto(
      emp.profilePhoto,
      { userType: 'employee', userId: emp?._id || null }
    );
    const roleLine = [emp.jobTitle || emp.position, emp.department].filter(Boolean).join(' • ');

    const allTasks = useMemo(() => filterByFeature(wf.tasks || []), [wf.tasks, filterByFeature]);
    const completedTasks = allTasks.filter((t) => t.status === 'Completed').length;
    const progressPct = Math.max(0, Math.min(100, Number(wf.progress) || 0));
    const taskCompletionDate = wf.expectedCompletionDate;
    const targetDate = taskCompletionDate || wf.joiningDate;
    const remainingDays = targetDate
        ? Math.max(0, differenceInCalendarDays(new Date(targetDate), new Date()))
        : null;
    const actualCompletionLabel = formatDisplayDate(wf.actualCompletionDate)
        || (wf.status === 'Completed' ? formatDisplayDate(wf.completedAt) : null);

    const [showScheduleEdit, setShowScheduleEdit] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        joiningDate: '',
        scheduledStartDate: '',
        expectedCompletionDate: '',
    });

    useEffect(() => {
        setScheduleForm({
            joiningDate: toDateInputValue(wf.joiningDate),
            scheduledStartDate: toDateInputValue(wf.scheduledStartDate),
            expectedCompletionDate: toDateInputValue(wf.expectedCompletionDate),
        });
    }, [wf._id, wf.joiningDate, wf.scheduledStartDate, wf.expectedCompletionDate]);

    const openScheduleEdit = () => {
        setScheduleForm({
            joiningDate: toDateInputValue(wf.joiningDate),
            scheduledStartDate: toDateInputValue(wf.scheduledStartDate),
            expectedCompletionDate: toDateInputValue(wf.expectedCompletionDate),
        });
        setShowScheduleEdit(true);
    };

    const saveScheduleEdit = async (e) => {
        e.preventDefault();
        if (!updateWorkflowSchedule) {
            toast.error('Schedule update is not available');
            return;
        }
        if (!scheduleForm.expectedCompletionDate) {
            toast.error('Task completion date is required');
            return;
        }
        const ok = await updateWorkflowSchedule(wf._id, {
            joiningDate: scheduleForm.joiningDate || undefined,
            scheduledStartDate: scheduleForm.scheduledStartDate || undefined,
            expectedCompletionDate: scheduleForm.expectedCompletionDate,
        });
        if (ok) {
            setShowScheduleEdit(false);
            if (refreshWorkflow) await refreshWorkflow();
        }
    };

    const hrContactName = contactPerson(wf.assignedHR)?.name;
    const buddyContactName = contactPerson(wf.assignedBuddy)?.name;

    const documents = (wf.documents || []).slice(0, 8);
    const assets = wf.assets || [];
    const softwareRequests = wf.softwareRequests || [];
    const showAssetsSection = isFeatureEnabled('itAssetProvisioning') && assets.length > 0;
    const showAccessSection = isFeatureEnabled('softwareAccessRequest');

    const [activityVisibleCount, setActivityVisibleCount] = useState(ACTIVITY_INITIAL_VISIBLE);

    useEffect(() => {
        setActivityVisibleCount(ACTIVITY_INITIAL_VISIBLE);
    }, [wf._id]);

    const allActivities = wf.activityFeed || [];
    const visibleActivities = allActivities.slice(0, activityVisibleCount);
    const hasMoreActivity = allActivities.length > activityVisibleCount;

    const overviewMilestones = useMemo(
        () => buildOverviewMilestones(wf, progressPct),
        [wf, progressPct],
    );

    const docTotal = wf.documentSummary?.total ?? (wf.documents?.length || 0);
    const docVerified = wf.documentSummary?.verified
        ?? (wf.documents || []).filter((d) => d.status === 'Verified').length;
    const docPct = docTotal > 0 ? Math.round((docVerified / docTotal) * 100) : (breakdown.documents || 0);

    const renderTaskRow = (task) => {
        const blockers = getTaskCompletionBlockers(wf, task);
        const readyToComplete = canCompleteTask(wf, task);
        const pill = taskStatusPill(task.status);
        const priorityLabel = String(task.priority || 'Normal').toUpperCase();

        return (
            <div key={task._id} className="cm-task-row">
                <button
                    type="button"
                    aria-label={task.status === 'Completed' ? 'Completed' : 'Mark task'}
                    disabled={submitting || task.status === 'Completed' || !canActOnTask(task)}
                    onClick={() => {
                        if (task.status === 'Completed') return;
                        if (task.status === 'Pending') updateTask(task._id, 'In Progress');
                        else if (readyToComplete) updateTask(task._id, 'Completed');
                    }}
                    className={`cm-task-row__check ${task.status === 'Completed' ? 'cm-task-row__check--done' : ''}`}
                >
                    {task.status === 'Completed' ? <FaCheckCircle className="text-sm" /> : null}
                </button>
                <div className="cm-task-row__content min-w-0 flex-1">
                    <h4 className="font-semibold text-[var(--cm-on-surface)]">{task.title}</h4>
                    <div className="cm-task-row__meta mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className={taskPriorityClass(task.priority)}>{priorityLabel} PRIORITY</span>
                        {task.dueDate && (
                            <span className="text-[var(--cm-muted)]">
                                Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="cm-task-row__actions flex shrink-0 flex-wrap items-center justify-end gap-3">
                    <span className={pill.className}>{pill.text}</span>
                    {task.status !== 'Completed' && canActOnTask(task) && (
                        <>
                            {task.status === 'Pending' && (
                                <CmButton variant="primary" size="sm" onClick={() => updateTask(task._id, 'In Progress')} disabled={submitting}>
                                    Start
                                </CmButton>
                            )}
                            {['In Progress', 'Overdue'].includes(task.status) && (
                                <>
                                    {(TASK_ACTION_SECTIONS[task.title] || TASK_ACTION_ROUTES[task.title]) && (
                                        <CmButton variant="outline" size="sm" onClick={() => openTaskAction(task)}>
                                            Continue
                                        </CmButton>
                                    )}
                                    <CmButton
                                        variant="primary"
                                        size="sm"
                                        disabled={submitting || !readyToComplete}
                                        onClick={() => updateTask(task._id, 'Completed')}
                                    >
                                        Complete
                                    </CmButton>
                                </>
                            )}
                        </>
                    )}
                </div>
                {['In Progress', 'Overdue'].includes(task.status) && canActOnTask(task) && blockers.length > 0 && (
                    <div className="cm-task-row__blockers col-span-full">
                        <p className="font-medium">Before you can mark this complete:</p>
                        <ul className="mt-1 list-inside list-disc">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                    </div>
                )}
            </div>
        );
    };

    const renderTaskAccordions = () => {
        const groups = isEmployeeView
            ? [{ key: '_all', label: 'My Tasks' }]
            : TASK_GROUPS_BY_ROLE;

        return (
        <div className="space-y-3">
            {groups.map((group) => {
                const groupTasks = isEmployeeView
                    ? visibleTasks
                    : (tasksByRole[group.key] || []);
                const meta = TASK_GROUP_META[group.key] || { title: group.label, Icon: FaTasks };
                const { Icon } = meta;
                const overdueCount = groupTasks.filter((t) => t.status === 'Overdue').length;
                const pendingCount = groupTasks.filter((t) => t.status !== 'Completed').length;
                const expanded = expandedTaskGroups.has(group.key);
                const summaryBadge = !groupTasks.length
                    ? 'No tasks'
                    : pendingCount === 0
                        ? 'All Clear'
                        : `${pendingCount} Pending`;

                return (
                    <div key={group.key} className="cm-accordion">
                        <button
                            type="button"
                            onClick={() => toggleTaskGroup(group.key)}
                            className="cm-accordion__trigger"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="cm-accordion__icon">
                                    <Icon className="text-sm" />
                                </span>
                                <span className="font-semibold text-[var(--cm-on-surface)]">
                                    {isEmployeeView ? group.label : meta.title}
                                </span>
                                <span className="flex flex-wrap gap-1.5">
                                    {groupTasks.length > 0 && (
                                        <span className="cm-accordion__chip">{groupTasks.length} Total</span>
                                    )}
                                    {overdueCount > 0 && (
                                        <span className="cm-accordion__chip cm-accordion__chip--alert">
                                            {overdueCount} Overdue
                                        </span>
                                    )}
                                    {groupTasks.length > 0 && pendingCount > 0 && overdueCount === 0 && (
                                        <span className="cm-accordion__chip">{summaryBadge}</span>
                                    )}
                                    {pendingCount === 0 && groupTasks.length > 0 && (
                                        <span className="cm-accordion__chip">{summaryBadge}</span>
                                    )}
                                </span>
                            </div>
                            {expanded ? <FaChevronUp className="text-[var(--cm-muted)]" /> : <FaChevronDown className="text-[var(--cm-muted)]" />}
                        </button>
                        {expanded && (
                            <div className="cm-accordion__body">
                                {groupTasks.length === 0 ? (
                                    <p className="text-sm text-[var(--cm-muted)]">No tasks in this category.</p>
                                ) : (
                                    groupTasks.map(renderTaskRow)
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        );
    };

    const activityTimeline = (
        <div className="cm-timeline">
            {visibleActivities.map((act, i) => (
                <div key={act._id || i} className="cm-timeline__item">
                    <span className={`cm-timeline__dot ${i % 2 === 1 ? 'cm-timeline__dot--accent' : ''}`} />
                    <div>
                        <p className="text-sm font-semibold text-[var(--cm-on-surface)]">
                            {act.description || (act.action || 'Activity').replaceAll('_', ' ')}
                        </p>
                        <p className="text-xs text-[var(--cm-muted)]">
                            {act.actor?.name || act.actorName || 'System'}
                            {act.createdAt ? ` · ${format(new Date(act.createdAt), "MMM dd, yyyy '·' HH:mm")}` : ''}
                        </p>
                    </div>
                </div>
            ))}
            {!allActivities.length && (
                <p className="py-6 text-center text-sm text-[var(--cm-muted)]">No activity recorded yet.</p>
            )}
        </div>
    );

    const activityLoadMore = hasMoreActivity ? (
        <div className="mt-6 flex justify-center">
            <CmButton
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setActivityVisibleCount((n) => Math.min(n + ACTIVITY_LOAD_MORE_STEP, allActivities.length))}
            >
                Load more activity
            </CmButton>
        </div>
    ) : null;

    const internalNotesBlock = (
        <div className="mt-8 border-t border-[rgba(187,202,193,0.45)] pt-6">
            <label className="cm-label mb-2 block">Internal Notes</label>
            <div className="flex flex-col gap-3 sm:flex-row">
                <input
                    className="cm-input flex-1"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note for the team..."
                />
                <CmButton variant="primary" onClick={addNote}>Post</CmButton>
            </div>
            <div className="mt-4 space-y-2">
                {(wf.notes || []).map((n, i) => (
                    <div key={n._id || i} className="rounded-xl border border-[rgba(255,152,106,0.28)] bg-[rgba(255,219,205,0.45)] p-3 text-sm">
                        <p>{n.note}</p>
                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                            {n.addedBy?.name || 'HR'}
                            {n.addedAt ? ` · ${format(new Date(n.addedAt), 'MMM dd, yyyy')}` : ''}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div ref={detailSectionRef} className="cm-detail-view space-y-4">
            {isHr && (
                <header className="cm-card">
                    <p className="cm-label">HR Dashboard</p>
                    <h1 className="cm-title mt-1">Employee Onboarding</h1>
                </header>
            )}

            {(isHr || isManagerView) && (
            <button type="button" onClick={closeWorkflow} className="cm-link inline-flex items-center gap-2 text-[var(--cm-primary-deep)]">
                <FaArrowLeft /> {isManagerView ? 'Back to team' : 'Back to all employees'}
            </button>
            )}

            {/* Profile summary — shared across all tabs */}
            <div className="cm-card cm-profile-summary">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="relative inline-flex shrink-0 self-start">
                            {photoUrl ? (
                                <img src={photoUrl} alt="" className="cm-profile-summary__photo" />
                            ) : (
                                <div className="cm-profile-summary__photo cm-profile-summary__photo--initials">
                                    {cmInitials(fullName)}
                                </div>
                            )}
                            <span className="cm-profile-summary__status-dot" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-2xl font-bold tracking-tight text-[var(--cm-inverted)]">{fullName}</h2>
                                <span className="cm-onboarding-pill">{workflowStatusLabel(wf.status).toUpperCase()}</span>
                            </div>
                            {roleLine && <p className="mt-1 font-medium text-[var(--cm-on-variant)]">{roleLine}</p>}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--cm-muted)]">
                                {wf.joiningDate && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaCalendarAlt className="text-[var(--cm-primary-deep)]" />
                                        Join Date: {format(new Date(wf.joiningDate), 'MMM dd, yyyy')}
                                    </span>
                                )}
                                {hrContactName && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaUser className="text-[var(--cm-primary-deep)]" />
                                        HR: {formatContactShortName(hrContactName)}
                                    </span>
                                )}
                                {buddyContactName && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaUsers className="text-[var(--cm-primary-deep)]" />
                                        Buddy: {formatContactShortName(buddyContactName)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {isHr && (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        {['Scheduled', 'Not Started', 'In Progress', 'Overdue'].includes(wf.status) && (
                            <CmButton variant="outline" size="sm" onClick={() => performWorkflowAction('pause')} disabled={submitting}>
                                Pause
                            </CmButton>
                        )}
                        {wf.status === 'Paused' && (
                            <CmButton variant="outline" size="sm" onClick={() => performWorkflowAction('resume')} disabled={submitting}>
                                Resume
                            </CmButton>
                        )}
                        {!['Completed', 'Cancelled'].includes(wf.status) && (
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirm(true)}
                                disabled={submitting}
                                className="cm-btn cm-btn--outline cm-btn--sm cm-profile-cancel"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                    )}
                </div>
            </div>

            {/* Overall progress — shared across all tabs */}
            <div className="cm-card cm-overall-progress">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="cm-label mb-0">Overall Progress</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--cm-muted)]">
                        {taskCompletionDate ? (
                            <span>
                                Task completion date:{' '}
                                <span className="text-[var(--cm-on-surface)]">
                                    {formatDisplayDate(taskCompletionDate)}
                                </span>
                            </span>
                        ) : targetDate ? (
                            <span>
                                Target: {formatDisplayDate(targetDate)}
                            </span>
                        ) : null}
                        {actualCompletionLabel && (
                            <span className="text-[var(--cm-primary-deep)]">
                                Completed {actualCompletionLabel}
                            </span>
                        )}
                        {isHr && updateWorkflowSchedule && (
                            <button
                                type="button"
                                className="cm-overall-progress__edit"
                                onClick={openScheduleEdit}
                                disabled={submitting}
                                aria-label="Edit schedule dates"
                            >
                                <FaEdit aria-hidden />
                                Edit
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                        <div className="cm-progress cm-progress--lg" role="progressbar" aria-valuenow={progressPct}>
                            <div className="cm-progress__bar" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                            <span className="text-3xl font-bold text-[var(--cm-primary-deep)]">{progressPct}%</span>
                            <span className="text-sm font-medium text-[var(--cm-muted)]">
                                {completedTasks} / {allTasks.length} Tasks Completed
                            </span>
                        </div>
                    </div>
                    {remainingDays != null && (
                        <div className="md:border-l md:border-[rgba(187,202,193,0.5)] md:pl-8">
                            <p className="cm-label mb-1">Remaining</p>
                            <p className="text-3xl font-bold text-[var(--cm-tertiary)]">{remainingDays} Days</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <nav className="cm-detail-tabs" role="tablist" aria-label="Onboarding sections">
                {detailTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={detailTab === tab.id}
                        onClick={() => onDetailTabChange(tab.id)}
                        className={`cm-detail-tab ${detailTab === tab.id ? 'cm-detail-tab--active' : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {detailTab === 'overview' && (
                <div className="hrms-main-rail">
                    <div className="cm-card">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                            <h2 className="cm-title-sm">Onboarding Milestones</h2>
                            <span className="text-sm font-bold text-[var(--cm-primary-deep)]">
                                {progressPct}% Complete
                            </span>
                        </div>
                        <div className="cm-milestone-track">
                            {overviewMilestones.map((item, idx) => {
                                const badge = milestonePhaseBadge(item.phase);
                                const isLast = item.last ?? idx === overviewMilestones.length - 1;
                                const Icon = item.phase === 'complete'
                                    ? FaCheckCircle
                                    : item.phase === 'active'
                                        ? FaPlay
                                        : (item.title === 'Month 1' || String(item.title).includes('Month'))
                                            ? FaFlag
                                            : FaClock;
                                return (
                                    <div
                                        key={item.id}
                                        className={`cm-milestone-item ${item.phase === 'upcoming' ? 'cm-milestone-item--muted' : ''}`}
                                    >
                                        {!isLast && <span className="cm-milestone-item__line" aria-hidden />}
                                        <span className={`cm-milestone-item__icon cm-milestone-item__icon--${item.phase}`}>
                                            <Icon className="text-sm" />
                                        </span>
                                        <div className="min-w-0 flex-1 pb-8">
                                            <h3 className="font-bold text-[var(--cm-on-surface)]">{item.title}</h3>
                                            <p className="mt-1 text-sm text-[var(--cm-muted)]">{item.description}</p>
                                            <span className={`mt-2 inline-block ${badge.className}`}>{badge.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <OnboardingOverviewSnapshot
                            wf={wf}
                            progressPct={progressPct}
                            onDetailTabChange={onDetailTabChange}
                            isFeatureEnabled={isFeatureEnabled}
                        />

                        <div className="cm-card cm-doc-summary">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-[var(--cm-on-surface)]">Required Documents</h3>
                                    <p className="mt-1 text-sm text-[var(--cm-muted)]">
                                        {docTotal > 0
                                            ? `${docVerified} of ${docTotal} documents completed`
                                            : 'Document checklist syncs from employee profile'}
                                    </p>
                                    <button
                                        type="button"
                                        className="cm-link mt-4 text-sm font-bold"
                                        onClick={() => onDetailTabChange('documents')}
                                    >
                                        View all documents →
                                    </button>
                                </div>
                                <CmRing value={docPct} size={72} strokeColor="var(--cm-primary-deep)" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {detailTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="cm-card">
                        <h2 className="cm-title-sm mb-4 flex items-center gap-2">
                            <FaTasks className="text-[var(--cm-primary-deep)]" /> Tasks
                        </h2>
                        {renderTaskAccordions()}
                    </div>

                    <div className={`grid grid-cols-1 gap-4 ${showAssetsSection && showAccessSection ? 'lg:grid-cols-2' : ''}`}>
                        {showAssetsSection && (
                            <div className="cm-card">
                                <h3 className="cm-title-sm mb-4 flex items-center gap-2 text-base">
                                    <FaBoxOpen className="text-[var(--cm-primary-deep)]" /> Hardware &amp; Assets
                                </h3>
                                <ul className="divide-y divide-[var(--cm-surface-low)]">
                                    {assets.map((asset) => {
                                        const st = assetDisplayStatus(asset.status);
                                        return (
                                            <li key={asset._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                                                <span className="text-sm font-medium">{asset.name || asset.assetType}</span>
                                                <div className="flex items-center gap-2">
                                                    <CmBadge tone={st.tone} dot={false}>{st.label}</CmBadge>
                                                    {isHr && (
                                                    <select
                                                        value={asset.status}
                                                        disabled={submitting}
                                                        onChange={(e) => updateAsset(asset._id, { status: e.target.value })}
                                                        className="cm-input max-w-[7.5rem] py-1 text-xs"
                                                        aria-label={`Update status for ${asset.name || asset.assetType}`}
                                                    >
                                                        {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        {showAccessSection && (
                            <OnboardingAccessControl
                                workflowId={wf._id}
                                softwareRequests={softwareRequests}
                                viewerRole={viewerRole}
                                onUpdated={refreshWorkflow}
                            />
                        )}
                    </div>

                    <div className="cm-card">
                        <h3 className="cm-title-sm mb-6 flex items-center gap-2">
                            <FaHistory className="text-[var(--cm-primary-deep)]" /> Recent Activity
                        </h3>
                        {activityTimeline}
                        {activityLoadMore}
                        {isHr && internalNotesBlock}
                    </div>
                </div>
            )}

            {detailTab === 'documents' && isFeatureEnabled('documentCollection') && (
                <OnboardingVerificationTab
                    wf={wf}
                    breakdown={breakdown}
                    viewerRole={viewerRole}
                    navigate={navigate}
                    onRefresh={refreshWorkflow}
                    returnToOnboarding={`/onboarding?id=${wf._id}&detailTab=documents`}
                />
            )}

            {detailTab === 'documents' && !isFeatureEnabled('documentCollection') && (
                <div className="cm-card">
                    <p className="text-sm text-[var(--cm-muted)]">Document collection is not enabled for this organization.</p>
                </div>
            )}

            {detailTab === 'training' && (
                <div className="space-y-4">
                    {(isFeatureEnabled('mandatoryTraining')
                        || isFeatureEnabled('trainingLms')
                        || isFeatureEnabled('lmsDashboard')
                        || (wf.trainingModules?.length > 0)) ? (
                        <OnboardingTrainingTab
                            wf={wf}
                            viewerRole={viewerRole}
                            completeTraining={completeTraining}
                            submitting={submitting}
                        />
                    ) : (
                        <div className="cm-card">
                            <p className="text-sm text-[var(--cm-muted)]">
                                Training is not enabled for this organization.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {detailTab === 'activity' && (
                <OnboardingActivityTab
                    wf={wf}
                    breakdown={breakdown}
                    viewerRole={viewerRole}
                    refreshWorkflow={refreshWorkflow}
                    newNote={newNote}
                    setNewNote={setNewNote}
                    addNote={addNote}
                />
            )}

            {showScheduleEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="schedule-edit-title">
                    <div className="cm-card w-full max-w-md p-6 shadow-xl">
                        <h3 id="schedule-edit-title" className="cm-title-sm mb-1">Edit schedule</h3>
                        <p className="mb-4 text-sm text-[var(--cm-muted)]">Update joining, start, and task completion dates for this onboarding.</p>
                        <form onSubmit={saveScheduleEdit} className="space-y-4">
                            <div>
                                <label className="cm-label">Joining date</label>
                                <input
                                    type="date"
                                    className="cm-input mt-1 w-full"
                                    value={scheduleForm.joiningDate}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, joiningDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="cm-label">Start date</label>
                                <input
                                    type="date"
                                    className="cm-input mt-1 w-full"
                                    value={scheduleForm.scheduledStartDate}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledStartDate: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="cm-label">Task completion date *</label>
                                <input
                                    type="date"
                                    required
                                    className="cm-input mt-1 w-full"
                                    value={scheduleForm.expectedCompletionDate}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, expectedCompletionDate: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <CmButton type="button" variant="outline" size="sm" onClick={() => setShowScheduleEdit(false)} disabled={submitting}>
                                    Cancel
                                </CmButton>
                                <CmButton type="submit" variant="primary" size="sm" disabled={submitting}>
                                    {submitting ? 'Saving…' : 'Save'}
                                </CmButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
