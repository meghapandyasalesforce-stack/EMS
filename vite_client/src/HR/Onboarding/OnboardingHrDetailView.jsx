import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { format, differenceInCalendarDays, isValid } from 'date-fns';
import {
    FaArrowLeft, FaCheckCircle, FaTasks, FaLaptop,
    FaUser, FaHistory, FaChevronDown, FaChevronUp,
    FaCalendarAlt, FaIdBadge, FaUsers, FaMoneyCheckAlt,
    FaPlay, FaEdit, FaThLarge, FaFolderOpen, FaShieldAlt,
    FaGraduationCap, FaPause, FaTimes, FaExclamationTriangle, FaMapMarkerAlt,
    FaFlag, FaTruck, FaBuilding, FaFileSignature, FaLock, FaPlus,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ADMIN_ONBOARDING_ENDPOINT } from '../../utils/constant';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import {
    TASK_GROUPS_BY_ROLE, getTaskCompletionBlockers, canCompleteTask,
} from '../../constants/onboardingConstants';
import {
    CmBadge, CmButton, CmRing, cmInitials,
} from '../../components/corporateModern';
import OnboardingVerificationTab from './OnboardingVerificationTab';
import OnboardingTrainingTab from './OnboardingTrainingTab';
import OnboardingActivityTab from './OnboardingActivityTab';
import OnboardingOverviewSnapshot from './OnboardingOverviewSnapshot';
import OnboardingBgvPanel from './OnboardingBgvPanel';
import { formatStatusLabel } from '../../utils/textFormat.js';

const DETAIL_TABS_ALL = [
    { id: 'overview', label: 'Overview', Icon: FaThLarge },
    { id: 'tasks', label: 'Tasks', Icon: FaTasks },
    { id: 'documents', label: 'Documents', Icon: FaFolderOpen },
    { id: 'bgv', label: 'Background Check', Icon: FaShieldAlt },
    { id: 'training', label: 'Training & LMS', Icon: FaGraduationCap },
    { id: 'activity', label: 'Activity & Notes', Icon: FaHistory },
];

function tabsForViewer(viewerRole, isFeatureEnabled) {
    return DETAIL_TABS_ALL.filter((tab) => {
        if (tab.id === 'bgv') return typeof isFeatureEnabled === 'function' ? isFeatureEnabled('backgroundVerification') : true;
        if (tab.id === 'documents') return typeof isFeatureEnabled !== 'function' || isFeatureEnabled('documentCollection');
        if (tab.id === 'training') {
            if (typeof isFeatureEnabled !== 'function') return true;
            return isFeatureEnabled('mandatoryTraining') || isFeatureEnabled('trainingLms');
        }
        return true;
    });
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
    employee: { title: 'Pre-Boarding & Self Tasks', Icon: FaUser },
    hr: { title: 'HR Department', Icon: FaIdBadge },
    it: { title: 'IT & Infrastructure', Icon: FaLaptop },
    manager: { title: 'Manager & Buddy', Icon: FaUsers },
    buddy: { title: 'Buddy Program', Icon: FaUsers },
    payroll: { title: 'Payroll', Icon: FaMoneyCheckAlt },
};

const ASSIGNEE_ROLE_LABEL = {
    employee: 'Candidate',
    hr: 'HR Ops',
    it: 'IT Helpdesk',
    manager: 'Manager',
    buddy: 'Buddy',
    payroll: 'Payroll',
};

const ADD_TASK_STAGES = [
    'Pre-Boarding',
    'Day 1 Induction',
    'First Week',
    'First 30 Days',
];

const ADD_TASK_OWNERS = [
    { label: 'HR Ops', role: 'hr' },
    { label: 'IT Helpdesk', role: 'it' },
    { label: 'Manager', role: 'manager' },
    { label: 'Buddy', role: 'buddy' },
    { label: 'Candidate', role: 'employee' },
    { label: 'Payroll', role: 'payroll' },
];

const EMPTY_ADD_TASK_FORM = {
    title: '',
    stage: 'Pre-Boarding',
    ownerRole: 'hr',
    dueDate: '',
    blockingPrerequisite: false,
};

function stageToCategory(stage) {
    if (stage === 'Pre-Boarding') return 'HR Paperwork';
    if (stage === 'Day 1 Induction') return 'Orientation';
    if (stage === 'First Week') return 'Training';
    return 'Other';
}

function serializeTaskForUpdate(task) {
    return {
        _id: task._id,
        title: task.title,
        description: task.description,
        category: task.category || 'Other',
        assignedTo: task.assignedTo?._id || task.assignedTo || undefined,
        assigneeRole: task.assigneeRole || 'employee',
        dueDate: task.dueDate || undefined,
        startedDate: task.startedDate || undefined,
        completedDate: task.completedDate || undefined,
        status: task.status || 'Pending',
        priority: task.priority || 'Medium',
        mandatory: task.mandatory !== false,
        phase: task.phase,
        dependencies: task.dependencies || [],
        requiredDocuments: task.requiredDocuments || [],
        requiresAllMandatoryDocsVerified: Boolean(task.requiresAllMandatoryDocsVerified),
        notes: task.notes,
        completionNotes: task.completionNotes,
    };
}

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

/** Induction Runway stages — fixed 4-card layout (dossier mock). */
const DEFAULT_OVERVIEW_PHASES = [
    {
        title: 'Offer Accepted & Signed',
        description: 'Formal Letter of Appointment countersigned via DocuSign.',
        Icon: FaFileSignature,
        completeBadge: 'Completed',
    },
    {
        title: 'Welcome Swag Kit Dispatched',
        description: 'EMS hoodie, thermos flask, notebook delivered via courier.',
        Icon: FaTruck,
        completeBadge: 'Delivered',
    },
    {
        title: 'IT Hardware Handover',
        description: 'Laptop and security key staged at IT Desk for pickup.',
        Icon: FaLaptop,
        activeBadge: 'Ready for Pickup',
    },
    {
        title: 'Official Induction Day 1',
        description: 'Orientation with Executive Leadership & team introductions.',
        Icon: FaBuilding,
        upcomingBadge: 'Upcoming',
    },
];

function buildOverviewMilestones(wf, progressPct) {
    let activeIndex = 0;
    if (progressPct >= 90) activeIndex = 3;
    else if (progressPct >= 65) activeIndex = 2;
    else if (progressPct >= 35) activeIndex = 1;

    // Prefer real joining / start dates for stage meta when present.
    const joinLabel = formatDisplayDate(wf?.joiningDate);
    const startLabel = formatDisplayDate(wf?.scheduledStartDate) || joinLabel;
    const targetLabel = formatDisplayDate(wf?.expectedCompletionDate);

    return DEFAULT_OVERVIEW_PHASES.map((phase, idx) => {
        let phaseStatus = 'upcoming';
        if (progressPct >= 100) phaseStatus = 'complete';
        else if (idx < activeIndex) phaseStatus = 'complete';
        else if (idx === activeIndex) phaseStatus = 'active';

        let meta = null;
        if (phaseStatus === 'complete') {
            meta = joinLabel ? `${joinLabel}${idx === 1 ? ' • Signature Verified' : ''}` : null;
        } else if (phaseStatus === 'active') {
            meta = startLabel || targetLabel;
        } else if (targetLabel) {
            meta = targetLabel;
        }

        return {
            id: phase.title,
            title: phase.title,
            description: phase.description,
            Icon: phase.Icon,
            completeBadge: phase.completeBadge,
            activeBadge: phase.activeBadge,
            upcomingBadge: phase.upcomingBadge,
            phase: phaseStatus,
            meta,
            last: idx === DEFAULT_OVERVIEW_PHASES.length - 1,
        };
    });
}

function workflowStatusLabel(status) {
    if (['In Progress', 'Not Started', 'Scheduled', 'Draft', 'Overdue'].includes(status)) return 'In Onboarding';
    if (status === 'Completed') return 'Onboarded';
    return status;
}

function milestonePhaseBadge(item, idx) {
    if (item.phase === 'complete') {
        const label = item.completeBadge
            || (idx === 1 ? 'Delivered' : 'Completed');
        return { label, className: 'cm-milestone-badge cm-milestone-badge--solid' };
    }
    if (item.phase === 'active') {
        const label = item.activeBadge
            || (idx === 2 ? 'Ready for Pickup' : 'Active');
        return { label, className: 'cm-milestone-badge cm-milestone-badge--ready' };
    }
    return {
        label: item.upcomingBadge || 'Upcoming',
        className: 'cm-milestone-badge cm-milestone-badge--upcoming',
    };
}

function taskStatusPill(status) {
    const s = String(status || 'Pending');
    const text = formatStatusLabel(s);
    if (s === 'Overdue') return { className: 'cm-status-pill cm-status-pill--overdue', text };
    if (s === 'Completed') return { className: 'cm-status-pill cm-status-pill--done', text };
    if (s === 'In Progress') return { className: 'cm-status-pill cm-status-pill--progress', text };
    return { className: 'cm-status-pill cm-status-pill--pending', text };
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
    const detailTabs = useMemo(
        () => tabsForViewer(viewerRole, isFeatureEnabled),
        [viewerRole, isFeatureEnabled],
    );

    useEffect(() => {
        if (!detailTabs.some((t) => t.id === detailTab) && detailTabs[0]) {
            onDetailTabChange?.(detailTabs[0].id);
        }
    }, [detailTabs, detailTab, onDetailTabChange]);

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
    const [showScheduleEdit, setShowScheduleEdit] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);
    const [addTaskForm, setAddTaskForm] = useState(EMPTY_ADD_TASK_FORM);
    const [pinging, setPinging] = useState(false);
    const [photoBroken, setPhotoBroken] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        joiningDate: '',
        scheduledStartDate: '',
        expectedCompletionDate: '',
    });

    useEffect(() => {
        setPhotoBroken(false);
    }, [photoUrl, emp?._id]);

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

    const openAddTaskModal = () => {
        setAddTaskForm({
            ...EMPTY_ADD_TASK_FORM,
            dueDate: toDateInputValue(wf.joiningDate || wf.expectedCompletionDate),
        });
        setShowAddTaskModal(true);
    };

    const closeAddTaskModal = () => {
        if (addTaskSubmitting) return;
        setShowAddTaskModal(false);
        setAddTaskForm(EMPTY_ADD_TASK_FORM);
    };

    const submitAddTask = async (e) => {
        e.preventDefault();
        const title = String(addTaskForm.title || '').trim();
        if (!title) {
            toast.error('Task title is required');
            return;
        }
        if (!wf?._id) return;
        try {
            setAddTaskSubmitting(true);
            const newTask = {
                title,
                description: addTaskForm.blockingPrerequisite
                    ? 'Blocking prerequisite for subsequent stages'
                    : undefined,
                category: stageToCategory(addTaskForm.stage),
                assigneeRole: addTaskForm.ownerRole || 'hr',
                dueDate: addTaskForm.dueDate || undefined,
                status: 'Pending',
                priority: addTaskForm.blockingPrerequisite ? 'High' : 'Medium',
                mandatory: true,
                phase: addTaskForm.stage,
                notes: addTaskForm.blockingPrerequisite
                    ? 'Blocking prerequisite for subsequent stages'
                    : undefined,
            };
            const updatedTasks = [
                ...(wf.tasks || []).map(serializeTaskForUpdate),
                newTask,
            ];
            await axios.put(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}`,
                { tasks: updatedTasks },
                { withCredentials: true },
            );
            toast.success('Task added to dossier');
            setShowAddTaskModal(false);
            setAddTaskForm(EMPTY_ADD_TASK_FORM);
            if (refreshWorkflow) await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add task');
        } finally {
            setAddTaskSubmitting(false);
        }
    };

    const sendInstantPing = useCallback(async () => {
        if (!wf?._id || pinging) return;
        try {
            setPinging(true);
            const { data } = await axios.post(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/ping`,
                {},
                { withCredentials: true },
            );
            toast.success(data?.message || 'Notification sent to the employee');
            if (refreshWorkflow) await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send notification');
        } finally {
            setPinging(false);
        }
    }, [wf?._id, pinging, refreshWorkflow]);

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
        const priorityLabel = formatStatusLabel(task.priority || 'Normal');
        const done = task.status === 'Completed';
        const blocked = !done && blockers.length > 0;
        const roleKey = task.assigneeRole || task.assignedRole || '';
        const ownerLabel = task.assignedTo?.name
            || ASSIGNEE_ROLE_LABEL[roleKey]
            || (roleKey ? formatStatusLabel(roleKey) : null);
        const dueLabel = task.dueDate && isValid(new Date(task.dueDate))
            ? format(new Date(task.dueDate), 'dd MMM yyyy')
            : null;
        const subtitle = task.description
            || (done && task.completedAt && isValid(new Date(task.completedAt))
                ? `Completed ${format(new Date(task.completedAt), 'dd MMM yyyy')}`
                : null)
            || `${priorityLabel} priority`;

        return (
            <div
                key={task._id}
                className={`cm-task-row${done ? ' cm-task-row--done' : ''}${blocked ? ' cm-task-row--blocked' : ''}`}
            >
                <button
                    type="button"
                    aria-label={done ? 'Completed' : 'Mark task'}
                    disabled={submitting || done || !canActOnTask(task)}
                    onClick={() => {
                        if (done) return;
                        if (task.status === 'Pending') updateTask(task._id, 'In Progress');
                        else if (readyToComplete) updateTask(task._id, 'Completed');
                    }}
                    className={`cm-task-row__check ${done ? 'cm-task-row__check--done' : ''}`}
                >
                    {done ? <FaCheckCircle className="text-sm" /> : null}
                </button>
                <div className="cm-task-row__content min-w-0 flex-1">
                    <div className="cm-task-row__title-row">
                        <h4 className={`cm-task-row__title${done ? ' cm-task-row__title--done' : ''}`}>
                            {task.title}
                        </h4>
                        {blocked && (
                            <span className="cm-task-row__prereq">
                                <FaLock aria-hidden />
                                Prerequisite Required
                            </span>
                        )}
                    </div>
                    <p className="cm-task-row__subtitle">{subtitle}</p>
                    {['In Progress', 'Overdue'].includes(task.status) && canActOnTask(task) && blockers.length > 0 && (
                        <div className="cm-task-row__blockers">
                            <p className="font-medium">Before you can mark this complete:</p>
                            <ul className="mt-1 list-inside list-disc">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                        </div>
                    )}
                </div>
                <div className="cm-task-row__side">
                    {ownerLabel && <span className="cm-task-row__owner">{ownerLabel}</span>}
                    {dueLabel && (
                        <span className={`cm-task-row__due${blocked || task.status === 'Overdue' ? ' cm-task-row__due--alert' : ''}`}>
                            {dueLabel}
                        </span>
                    )}
                    {!done && (
                        <span className={`${pill.className} cm-task-row__status`}>{pill.text}</span>
                    )}
                    {!done && canActOnTask(task) && (
                        <div className="cm-task-row__actions">
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
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTaskAccordions = () => {
        const groups = isEmployeeView
            ? [{ key: '_all', label: 'My Tasks' }]
            : TASK_GROUPS_BY_ROLE;

        return (
        <div className="cm-dossier-tasks__groups">
            {groups.map((group, groupIndex) => {
                const groupTasks = isEmployeeView
                    ? visibleTasks
                    : (tasksByRole[group.key] || []);
                const meta = TASK_GROUP_META[group.key] || { title: group.label, Icon: FaTasks };
                const { Icon } = meta;
                const overdueCount = groupTasks.filter((t) => t.status === 'Overdue').length;
                const completedCount = groupTasks.filter((t) => t.status === 'Completed').length;
                const pendingCount = groupTasks.filter((t) => t.status !== 'Completed').length;
                const expanded = expandedTaskGroups.has(group.key);
                const titleBase = isEmployeeView ? group.label : meta.title;
                const sectionTitle = isEmployeeView
                    ? titleBase
                    : `${groupIndex + 1}. ${titleBase}`;

                let summaryClass = 'cm-accordion__chip';
                let summaryBadge = 'No tasks';
                if (groupTasks.length) {
                    if (pendingCount === 0) {
                        summaryBadge = `All ${groupTasks.length} Completed`;
                        summaryClass = 'cm-accordion__chip cm-accordion__chip--done';
                    } else if (overdueCount > 0) {
                        summaryBadge = `${overdueCount} Overdue`;
                        summaryClass = 'cm-accordion__chip cm-accordion__chip--alert';
                    } else if (completedCount > 0) {
                        summaryBadge = `${completedCount} of ${groupTasks.length} Done`;
                        summaryClass = 'cm-accordion__chip cm-accordion__chip--progress';
                    } else {
                        summaryBadge = 'Pending Progression';
                        summaryClass = 'cm-accordion__chip cm-accordion__chip--muted';
                    }
                }

                return (
                    <div key={group.key} className="cm-accordion cm-dossier-tasks__group">
                        <button
                            type="button"
                            onClick={() => toggleTaskGroup(group.key)}
                            className="cm-accordion__trigger"
                        >
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span className={`cm-accordion__icon${pendingCount === 0 && groupTasks.length ? ' cm-accordion__icon--done' : ''}`}>
                                    <Icon className="text-sm" />
                                </span>
                                <span className="cm-accordion__title">{sectionTitle}</span>
                            </div>
                            <div className="cm-accordion__trailing">
                                <span className={summaryClass}>{summaryBadge}</span>
                                {expanded
                                    ? <FaChevronUp className="cm-accordion__chevron" />
                                    : <FaChevronDown className="cm-accordion__chevron" />}
                            </div>
                        </button>
                        {expanded && (
                            <div className="cm-accordion__body">
                                {groupTasks.length === 0 ? (
                                    <p className="cm-dossier-tasks__empty">No tasks in this category.</p>
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

    const empCode = emp.employeeCode || emp.employeeId || null;
    const locationLine = [emp.workLocation || emp.location, emp.city].filter(Boolean).join(' · ');
    const pendingDoc = (wf.documents || []).find((d) =>
        ['Pending', 'Uploaded', 'Submitted', 'Pending Signature', 'Pending Verification'].includes(d.status)
        || /sign/i.test(d.status || '')
        || /sign/i.test(d.name || d.documentType || ''));
    const docsPendingCount = Math.max(0, docTotal - docVerified);
    const trainingDone = (wf.trainingModules || []).filter((m) => m.status === 'Completed').length;
    const trainingTotal = (wf.trainingModules || []).length;
    const bgvPctLabel = (() => {
        const checks = wf.bgvCase?.checks || wf.bgv?.checks || [];
        if (checks.length) {
            const cleared = checks.filter((c) => /clear|pass|complet/i.test(c.status || '')).length;
            return `${Math.round((cleared / checks.length) * 100)}%`;
        }
        return docPct > 0 ? `${Math.min(98, docPct + 12)}%` : null;
    })();
    const nextCheckpoint = overviewMilestones.find((m) => m.phase === 'active')
        || overviewMilestones.find((m) => m.phase === 'upcoming');

    return (
        <div ref={detailSectionRef} className="cm-detail-view cm-dossier">
            {(isHr || isManagerView) && (
                <nav className="cm-dossier-crumbs" aria-label="Breadcrumb">
                    <button type="button" onClick={closeWorkflow} className="cm-dossier-crumbs__back">
                        <FaArrowLeft className="text-[10px]" />
                        Hub
                    </button>
                    <span aria-hidden>›</span>
                    <span>Dashboard</span>
                    <span aria-hidden>›</span>
                    <span>Hire &amp; Lifecycle</span>
                    <span aria-hidden>›</span>
                    <button type="button" onClick={closeWorkflow} className="hover:underline">
                        Onboarding Hub
                    </button>
                    <span aria-hidden>›</span>
                    <span className="cm-dossier-crumbs__current">
                        {empCode || 'Employee'}{fullName ? ` (${fullName})` : ''}
                    </span>
                </nav>
            )}

            {/* Profile summary — mockup dossier header */}
            <div className="cm-card cm-profile-summary cm-profile-summary--dossier">
                <div className="cm-dossier-hero">
                    <div className="cm-dossier-hero__identity">
                        <div className="relative inline-flex shrink-0 self-start">
                            {photoUrl && !photoBroken ? (
                                <img
                                    src={photoUrl}
                                    alt=""
                                    className="cm-profile-summary__photo cm-profile-summary__photo--lg"
                                    onError={() => setPhotoBroken(true)}
                                />
                            ) : (
                                <div className="cm-profile-summary__photo cm-profile-summary__photo--lg cm-profile-summary__photo--initials">
                                    {cmInitials(fullName)}
                                </div>
                            )}
                            <span className="cm-profile-summary__status-dot" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="cm-dossier-hero__name">
                                    {fullName || 'Employee'}
                                </h2>
                                <span className="cm-onboarding-pill">{formatStatusLabel(workflowStatusLabel(wf.status))}</span>
                                {empCode && (
                                    <span className="cm-dossier-hero__empcode">
                                        {empCode}
                                    </span>
                                )}
                            </div>
                            {roleLine && (
                                <p className="cm-dossier-hero__role">{roleLine}</p>
                            )}
                            <div className="cm-dossier-hero__meta">
                                {locationLine && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaMapMarkerAlt aria-hidden />
                                        {locationLine}
                                    </span>
                                )}
                                {wf.joiningDate && (
                                    <span className="cm-dossier-hero__join">
                                        <FaCalendarAlt aria-hidden />
                                        Joining: {format(new Date(wf.joiningDate), 'dd MMM yyyy')}
                                    </span>
                                )}
                                {remainingDays != null && (
                                    <span className="cm-dossier-hero__remaining">{remainingDays} Days Remaining</span>
                                )}
                                {isHr && updateWorkflowSchedule && (
                                    <button
                                        type="button"
                                        className="cm-overall-progress__edit"
                                        onClick={openScheduleEdit}
                                        disabled={submitting}
                                    >
                                        <FaEdit aria-hidden /> Edit schedule
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="cm-dossier-hero__progress">
                        <CmRing
                            value={progressPct}
                            size={80}
                            strokeColor="#00694f"
                        />
                        <div>
                            <p className="cm-dossier-hero__progress-label">Induction</p>
                            <p className="cm-dossier-hero__progress-value">
                                {completedTasks} of {allTasks.length || 0} Tasks Completed
                            </p>
                            <p className="cm-dossier-hero__progress-sub">
                                {Math.max(0, (allTasks.length || 0) - completedTasks)} milestones remaining before onboarding sign-off
                            </p>
                        </div>
                    </div>

                    {isHr && (
                        <div className="cm-dossier-hero__actions">
                            {['Scheduled', 'Not Started', 'In Progress', 'Overdue'].includes(wf.status) && (
                                <CmButton
                                    variant="outline"
                                    onClick={() => performWorkflowAction('pause')}
                                    disabled={submitting}
                                >
                                    <FaPause className="text-xs" /> Pause Onboarding
                                </CmButton>
                            )}
                            {wf.status === 'Paused' && (
                                <CmButton
                                    variant="outline"
                                    onClick={() => performWorkflowAction('resume')}
                                    disabled={submitting}
                                >
                                    <FaPlay className="text-xs" /> Resume Onboarding
                                </CmButton>
                            )}
                            {!['Completed', 'Cancelled'].includes(wf.status) && (
                                <button
                                    type="button"
                                    onClick={() => setShowCancelConfirm(true)}
                                    disabled={submitting}
                                    className="cm-btn cm-btn--outline cm-profile-cancel"
                                >
                                    <FaTimes className="text-xs" /> Cancel Onboarding
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <nav className="cm-detail-tabs cm-detail-tabs--pills cm-dossier-tabs" role="tablist" aria-label="Onboarding sections">
                {detailTabs.map((tab) => {
                    const TabIcon = tab.Icon;
                    let badge = null;
                    if (tab.id === 'tasks' && allTasks.length) badge = `${completedTasks}/${allTasks.length}`;
                    if (tab.id === 'documents' && docTotal) badge = `${docVerified}/${docTotal}`;
                    if (tab.id === 'bgv' && bgvPctLabel) badge = bgvPctLabel;
                    if (tab.id === 'training' && trainingTotal) badge = `${trainingDone}/${trainingTotal}`;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={detailTab === tab.id}
                            onClick={() => onDetailTabChange(tab.id)}
                            className={`cm-detail-tab ${detailTab === tab.id ? 'cm-detail-tab--active' : ''}`}
                        >
                            {TabIcon ? <TabIcon className="cm-detail-tab__icon" aria-hidden /> : null}
                            <span>{tab.label}</span>
                            {badge && <span className="cm-detail-tab__badge">{badge}</span>}
                        </button>
                    );
                })}
            </nav>

            {detailTab === 'overview' && (pendingDoc || docsPendingCount > 0) && (
                <div className="cm-dossier-alert" role="status">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="cm-dossier-alert__icon" aria-hidden>
                            <FaExclamationTriangle />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--cm-error,#93000a)]">
                                Pending Digital Signature
                            </p>
                            <p className="mt-0.5 text-sm text-[var(--cm-on-variant)]">
                                {pendingDoc
                                    ? `${documentCheckLabel(pendingDoc)} still needs action before Day-1 readiness.`
                                    : `${docsPendingCount} document${docsPendingCount === 1 ? '' : 's'} awaiting verification or signature.`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <CmButton
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pinging || submitting}
                            onClick={sendInstantPing}
                        >
                            {pinging ? 'Sending…' : 'Send Instant Ping'}
                        </CmButton>
                        <CmButton
                            type="button"
                            variant="primary"
                            size="sm"
                            className="!bg-[var(--cm-error,#93000a)] !border-[var(--cm-error,#93000a)]"
                            onClick={() => onDetailTabChange('documents')}
                        >
                            View Document
                        </CmButton>
                    </div>
                </div>
            )}

            {detailTab === 'overview' && (
                <div className="cm-dossier-overview">
                    <div className="cm-card cm-induction-runway min-w-0 w-full">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold tracking-tight text-[var(--cm-on-surface)] mb-0">
                                    Induction Runway &amp; Key Milestones
                                </h2>
                                <p className="mt-0.5 text-sm leading-snug text-[var(--cm-muted)]">
                                    Scheduled physical &amp; virtual touchpoints
                                </p>
                            </div>
                            <span className="cm-runway-batch">
                                {(() => {
                                    const d = wf.joiningDate ? new Date(wf.joiningDate) : new Date();
                                    if (!isValid(d)) return `${progressPct}% Complete`;
                                    const q = Math.floor(d.getMonth() / 3) + 1;
                                    return `Batch ${d.getFullYear()}-Q${q}`;
                                })()}
                            </span>
                        </div>
                        <div className="cm-runway-grid">
                            {overviewMilestones.slice(0, 4).map((item, idx) => {
                                const badge = milestonePhaseBadge(item, idx);
                                const stage = String(idx + 1).padStart(2, '0');
                                const StageIcon = item.Icon || FaCalendarAlt;
                                const metaTone = item.phase === 'upcoming' ? 'cm-runway-card__meta--muted' : '';
                                return (
                                    <article
                                        key={item.id}
                                        className={`cm-runway-card ${item.phase === 'upcoming' ? 'cm-runway-card--muted' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cm-runway-card__stage">Stage {stage}</span>
                                            <span className={badge.className}>{badge.label}</span>
                                        </div>
                                        <h3 className="mt-2.5 text-[0.9375rem] font-bold leading-snug text-[var(--cm-on-surface)]">
                                            {item.title}
                                        </h3>
                                        <p className="mt-1 text-sm leading-relaxed text-[var(--cm-muted)]">
                                            {item.description}
                                        </p>
                                        {item.meta && (
                                            <p className={`cm-runway-card__meta ${metaTone}`}>
                                                <StageIcon aria-hidden />
                                                {item.meta}
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                        {nextCheckpoint && (
                            <div className="cm-runway-footer">
                                <p className="cm-runway-footer__text min-w-0">
                                    <FaFlag className="cm-runway-footer__icon" aria-hidden />
                                    <span>
                                        Next Critical Checkpoint:{' '}
                                        <strong>{nextCheckpoint.title}</strong>
                                        {wf.expectedCompletionDate && isValid(new Date(wf.expectedCompletionDate))
                                            ? ` on ${format(new Date(wf.expectedCompletionDate), 'dd MMM yyyy')}`
                                            : ''}
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>

                    <aside className="cm-dossier-overview__side min-w-0 w-full">
                        <OnboardingOverviewSnapshot wf={wf} />
                    </aside>
                </div>
            )}

            {detailTab === 'tasks' && (
                <div className="cm-dossier-tasks">
                    <div className="cm-card cm-dossier-tasks__panel">
                        <div className="cm-dossier-tasks__header">
                            <div className="min-w-0">
                                <h2 className="cm-dossier-tasks__title">
                                    Induction Checklist &amp; Prerequisite Chain
                                </h2>
                                <p className="cm-dossier-tasks__subtitle">
                                    Interactive verification tasks. Checking items recalibrates dossier metrics in real-time.
                                </p>
                            </div>
                            {isHr && (
                                <button
                                    type="button"
                                    className="cm-dossier-add-task"
                                    onClick={openAddTaskModal}
                                >
                                    <FaPlus className="cm-dossier-add-task__icon" aria-hidden />
                                    Add Task
                                </button>
                            )}
                        </div>
                        {renderTaskAccordions()}
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
                <div className="cm-card py-10 text-center">
                    <FaFolderOpen className="mx-auto mb-3 text-3xl text-[var(--cm-primary-deep)] opacity-60" />
                    <p className="font-semibold text-[var(--cm-on-surface)]">Documents &amp; Verification</p>
                    <p className="mt-2 text-sm text-[var(--cm-muted)]">Document collection is not enabled for this organization.</p>
                </div>
            )}

            {detailTab === 'bgv' && isFeatureEnabled('backgroundVerification') && (
                <OnboardingBgvPanel
                    workflowId={wf._id}
                    employeeId={emp?._id}
                    isHRView={isHr}
                    onUpdated={refreshWorkflow}
                />
            )}

            {detailTab === 'training' && (
                <div className="space-y-4">
                    {(isFeatureEnabled('mandatoryTraining')
                        || isFeatureEnabled('trainingLms')
                        || (wf.trainingModules?.length > 0)) ? (
                        <OnboardingTrainingTab
                            wf={wf}
                            viewerRole={viewerRole}
                            completeTraining={completeTraining}
                            submitting={submitting}
                            onUpdated={refreshWorkflow}
                        />
                    ) : (
                        <div className="cm-card py-10 text-center">
                            <FaGraduationCap className="mx-auto mb-3 text-3xl text-[var(--cm-primary-deep)] opacity-60" />
                            <p className="font-semibold text-[var(--cm-on-surface)]">Training</p>
                            <p className="mt-2 text-sm text-[var(--cm-muted)]">
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

            {showAddTaskModal && (
                <div
                    className="cm-dossier-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-task-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeAddTaskModal();
                    }}
                >
                    <form className="cm-dossier-modal" onSubmit={submitAddTask}>
                        <div className="cm-dossier-modal__head">
                            <h3 id="add-task-modal-title" className="cm-dossier-modal__title">
                                Add Induction Task to Dossier
                            </h3>
                            <button
                                type="button"
                                className="cm-dossier-modal__close"
                                aria-label="Close"
                                onClick={closeAddTaskModal}
                                disabled={addTaskSubmitting}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="cm-dossier-modal__body">
                            <div>
                                <label className="cm-dossier-modal__label" htmlFor="new-task-title">
                                    Task Title <span className="cm-dossier-modal__req">*</span>
                                </label>
                                <input
                                    id="new-task-title"
                                    className="cm-input cm-dossier-modal__input w-full"
                                    placeholder="e.g. Complete AWS Security Token Setup"
                                    value={addTaskForm.title}
                                    onChange={(e) => setAddTaskForm((f) => ({ ...f, title: e.target.value }))}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="cm-dossier-modal__grid">
                                <div>
                                    <label className="cm-dossier-modal__label" htmlFor="new-task-stage">
                                        Lifecycle Stage
                                    </label>
                                    <select
                                        id="new-task-stage"
                                        className="cm-input cm-dossier-modal__input w-full"
                                        value={addTaskForm.stage}
                                        onChange={(e) => setAddTaskForm((f) => ({ ...f, stage: e.target.value }))}
                                    >
                                        {ADD_TASK_STAGES.map((stage) => (
                                            <option key={stage} value={stage}>{stage}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="cm-dossier-modal__label" htmlFor="new-task-owner">
                                        Assignee Owner
                                    </label>
                                    <select
                                        id="new-task-owner"
                                        className="cm-input cm-dossier-modal__input w-full"
                                        value={addTaskForm.ownerRole}
                                        onChange={(e) => setAddTaskForm((f) => ({ ...f, ownerRole: e.target.value }))}
                                    >
                                        {ADD_TASK_OWNERS.map((owner) => (
                                            <option key={owner.role} value={owner.role}>{owner.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="cm-dossier-modal__label" htmlFor="new-task-due">
                                    Due Date
                                </label>
                                <input
                                    id="new-task-due"
                                    type="date"
                                    className="cm-input cm-dossier-modal__input w-full"
                                    value={addTaskForm.dueDate}
                                    onChange={(e) => setAddTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                                />
                            </div>

                            <label className="cm-dossier-modal__check" htmlFor="new-task-prereq">
                                <input
                                    id="new-task-prereq"
                                    type="checkbox"
                                    checked={addTaskForm.blockingPrerequisite}
                                    onChange={(e) => setAddTaskForm((f) => ({
                                        ...f,
                                        blockingPrerequisite: e.target.checked,
                                    }))}
                                />
                                <span>Mark as Blocking Prerequisite for subsequent stages</span>
                            </label>
                        </div>

                        <div className="cm-dossier-modal__foot">
                            <CmButton
                                type="button"
                                variant="outline"
                                onClick={closeAddTaskModal}
                                disabled={addTaskSubmitting}
                            >
                                Cancel
                            </CmButton>
                            <CmButton type="submit" variant="primary" disabled={addTaskSubmitting}>
                                {addTaskSubmitting ? 'Adding…' : 'Add Task to Dossier'}
                            </CmButton>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
