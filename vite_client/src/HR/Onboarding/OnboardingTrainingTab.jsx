import React, { useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import axios from 'axios';
import {
    FaUsers, FaGavel, FaLaptop, FaShieldAlt, FaGraduationCap,
    FaCheck, FaTimes, FaProjectDiagram, FaExclamationTriangle,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';

const EMPTY_ASSIGN_FORM = {
    title: '',
    description: '',
    courseUrl: '',
    dueDate: '',
    mandatory: true,
    type: 'video',
};

function moduleProgress(mod) {
    const status = String(mod?.status || 'Not Started');
    if (status === 'Completed') return 100;
    if (typeof mod?.score === 'number') return Math.max(0, Math.min(100, Math.round(mod.score)));
    if (status === 'In Progress') return 45;
    if (status === 'Failed') return Math.max(0, Math.min(100, Math.round(mod?.score || 0)));
    return 0;
}

function moduleIcon(title = '') {
    const t = title.toLowerCase();
    if (/culture|value|people|team/.test(t)) return FaUsers;
    if (/privacy|legal|complian|policy|gavel|posh|labor/.test(t)) return FaGavel;
    if (/it |tech|laptop|system|kafka|micro|hub|network/.test(t)) return FaProjectDiagram;
    if (/safety|security|shield|health|infosec|soc|zero-trust/.test(t)) return FaShieldAlt;
    if (/incident|pager|emergency|response|sre/.test(t)) return FaExclamationTriangle;
    if (/tech|laptop|system|best practice/.test(t)) return FaLaptop;
    return FaGraduationCap;
}

function moduleSubtitle(mod) {
    if (mod?.description) return mod.description;
    if (mod?.phase) return mod.phase;
    if (mod?.type === 'quiz') return 'Mandatory assessment & certification track';
    if (mod?.type === 'document') return 'Policy library reading & acknowledgment';
    if (mod?.type === 'video') return 'EMS Academy LMS curriculum';
    return 'EMS Academy LMS curriculum';
}

function statusBadge(mod, pct) {
    const s = String(mod?.status || 'Not Started');
    if (s === 'Completed') {
        return { label: `Completed ${pct}%`, tone: 'done', showCheck: true };
    }
    if (s === 'In Progress') {
        return { label: `${pct}% Completed`, tone: 'progress', showCheck: false };
    }
    if (s === 'Failed') {
        return { label: 'Failed', tone: 'failed', showCheck: false };
    }
    return { label: 'Not Started', tone: 'pending', showCheck: false };
}

function progressBarClass(status) {
    const s = String(status || 'Not Started');
    if (s === 'Completed') return 'cm-dossier-train__bar-fill cm-dossier-train__bar-fill--done';
    if (s === 'In Progress') return 'cm-dossier-train__bar-fill cm-dossier-train__bar-fill--progress';
    if (s === 'Failed') return 'cm-dossier-train__bar-fill cm-dossier-train__bar-fill--failed';
    return 'cm-dossier-train__bar-fill';
}

/**
 * Training tab — Mandatory Learning Paths layout (ZIP / dossier screenshot).
 * Assign Course opens a form wired to existing LMS assign-course API.
 */
export default function OnboardingTrainingTab({
    wf,
    viewerRole = 'hr',
    completeTraining,
    submitting,
    onUpdated,
}) {
    const isHr = viewerRole === 'hr';
    const isEmployee = viewerRole === 'employee';
    const modules = wf?.trainingModules || [];
    const workflowId = wf?._id;

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
    const [assignSubmitting, setAssignSubmitting] = useState(false);

    const activeOrDone = useMemo(
        () => modules.filter((m) => ['Completed', 'In Progress'].includes(String(m.status || ''))).length,
        [modules],
    );

    const openAssignModal = () => {
        setAssignForm(EMPTY_ASSIGN_FORM);
        setShowAssignModal(true);
    };

    const closeAssignModal = () => {
        if (assignSubmitting) return;
        setShowAssignModal(false);
        setAssignForm(EMPTY_ASSIGN_FORM);
    };

    const handleMarkComplete = async (mod) => {
        if (!completeTraining || !mod?._id) {
            toast.info('Training completion is not available for this view.');
            return;
        }
        await completeTraining(mod._id);
    };

    const submitAssignCourse = async (e) => {
        e.preventDefault();
        const title = assignForm.title.trim();
        if (!title) {
            toast.error('Course title is required.');
            return;
        }
        if (!workflowId) {
            toast.error('Workflow not found.');
            return;
        }
        try {
            setAssignSubmitting(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/lms/assign-course`,
                {
                    title,
                    mandatory: Boolean(assignForm.mandatory),
                    courseUrl: assignForm.courseUrl.trim() || undefined,
                    description: assignForm.description.trim() || undefined,
                    type: assignForm.type || 'video',
                    dueDate: assignForm.dueDate || undefined,
                },
                { withCredentials: true },
            );
            toast.success(`“${title}” assigned to LMS queue`);
            setShowAssignModal(false);
            setAssignForm(EMPTY_ASSIGN_FORM);
            await onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign course');
        } finally {
            setAssignSubmitting(false);
        }
    };

    return (
        <div className="cm-dossier-train">
            <div className="cm-card cm-dossier-train__panel">
                <div className="cm-dossier-train__header">
                    <div className="min-w-0">
                        <h2 className="cm-dossier-train__title">
                            Mandatory Learning Paths &amp; Technical Inductions
                        </h2>
                        <p className="cm-dossier-train__subtitle">
                            EMS Academy LMS Track
                            {modules.length > 0
                                ? ` • ${activeOrDone} of ${modules.length} Curriculums in Progress or Completed`
                                : ' • No curriculums assigned yet'}
                        </p>
                    </div>
                    {isHr && (
                        <button
                            type="button"
                            className="cm-dossier-train__assign"
                            onClick={openAssignModal}
                        >
                            <FaGraduationCap aria-hidden />
                            + Assign Course
                        </button>
                    )}
                </div>

                {modules.length === 0 ? (
                    <div className="cm-dossier-train__empty">
                        <FaGraduationCap aria-hidden />
                        <p className="font-semibold">No learning paths assigned</p>
                        <p className="text-sm">
                            {isHr
                                ? 'Assign a course from the form to begin induction tracking.'
                                : 'Your manager or HR will assign mandatory LMS curriculums shortly.'}
                        </p>
                    </div>
                ) : (
                    <div className="cm-dossier-train__list">
                        {modules.map((mod) => {
                            const Icon = moduleIcon(mod.title);
                            const pct = moduleProgress(mod);
                            const badge = statusBadge(mod, pct);
                            const status = String(mod.status || 'Not Started');
                            const isDone = status === 'Completed';
                            const inProgress = status === 'In Progress';
                            const notStarted = !isDone && !inProgress && status !== 'Failed';

                            let footerLeft = null;
                            if (isDone) {
                                footerLeft = typeof mod.score === 'number'
                                    ? `Score: ${mod.score}/${mod.passingScore || 100} on Final Assessment`
                                    : 'Final assessment completed';
                            } else if (inProgress) {
                                footerLeft = `${pct}% complete • Continue your EMS Academy modules`;
                            } else if (mod.dueDate && isValid(new Date(mod.dueDate))) {
                                footerLeft = `Due by ${format(new Date(mod.dueDate), 'd MMM yyyy')}`;
                            } else {
                                footerLeft = mod.mandatory === false ? 'Optional curriculum' : 'Mandatory induction track';
                            }

                            let footerRight = null;
                            if (isDone) {
                                const certDate = mod.completedAt && isValid(new Date(mod.completedAt))
                                    ? format(new Date(mod.completedAt), 'd MMM yyyy')
                                    : null;
                                const certId = mod.certificateUrl
                                    ? `#${String(mod.certificateUrl).replace(/^.*\//, '').slice(0, 18).toUpperCase()}`
                                    : (mod._id ? `#CERT-${String(mod._id).slice(-6).toUpperCase()}` : null);
                                footerRight = (
                                    <span>
                                        {certDate ? `Certified on ${certDate}` : 'Certified'}
                                        {certId ? ` • ID: ${certId}` : ''}
                                    </span>
                                );
                            } else if (inProgress && isEmployee) {
                                footerRight = (
                                    <button
                                        type="button"
                                        className="cm-dossier-train__link cm-dossier-train__link--accent"
                                        disabled={submitting}
                                        onClick={() => handleMarkComplete(mod)}
                                    >
                                        Continue Learning →
                                    </button>
                                );
                            } else if (inProgress && isHr) {
                                footerRight = (
                                    <button
                                        type="button"
                                        className="cm-dossier-train__link cm-dossier-train__link--accent"
                                        onClick={() => toast.info(`Reminder sent for “${mod.title}”.`)}
                                    >
                                        Continue Learning →
                                    </button>
                                );
                            } else if (notStarted && isHr) {
                                footerRight = (
                                    <button
                                        type="button"
                                        className="cm-dossier-train__link"
                                        onClick={() => toast.info(`Friendly ping sent for “${mod.title}”.`)}
                                    >
                                        Send Friendly Ping
                                    </button>
                                );
                            } else if ((notStarted || status === 'Failed') && isEmployee && mod._id && completeTraining) {
                                footerRight = (
                                    <button
                                        type="button"
                                        className="cm-dossier-train__link cm-dossier-train__link--accent"
                                        disabled={submitting}
                                        onClick={() => handleMarkComplete(mod)}
                                    >
                                        {status === 'Failed' ? 'Retry Course →' : 'Start Learning →'}
                                    </button>
                                );
                            }

                            return (
                                <article key={mod._id || mod.title} className="cm-dossier-train__course">
                                    <div className="cm-dossier-train__course-top">
                                        <div className="cm-dossier-train__course-identity">
                                            <span
                                                className={`cm-dossier-train__course-icon${isDone ? ' is-done' : ''}${inProgress ? ' is-progress' : ''}`}
                                                aria-hidden
                                            >
                                                <Icon />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="cm-dossier-train__course-title">{mod.title}</h3>
                                                <p className="cm-dossier-train__course-desc">{moduleSubtitle(mod)}</p>
                                            </div>
                                        </div>
                                        <span className={`cm-dossier-train__badge cm-dossier-train__badge--${badge.tone}`}>
                                            {badge.showCheck && <FaCheck aria-hidden />}
                                            {badge.label}
                                        </span>
                                    </div>

                                    <div className="cm-dossier-train__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                        <div className={progressBarClass(status)} style={{ width: `${pct}%` }} />
                                    </div>

                                    <div className="cm-dossier-train__course-foot">
                                        <span>{footerLeft}</span>
                                        {footerRight}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAssignModal && (
                <div
                    className="cm-dossier-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="assign-course-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeAssignModal();
                    }}
                >
                    <form
                        className="cm-dossier-modal cm-dossier-train__assign-modal"
                        onSubmit={submitAssignCourse}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="cm-dossier-modal__head">
                            <h3 id="assign-course-modal-title" className="cm-dossier-modal__title">
                                Assign EMS Academy Course
                            </h3>
                            <button
                                type="button"
                                className="cm-dossier-modal__close"
                                aria-label="Close"
                                onClick={closeAssignModal}
                                disabled={assignSubmitting}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="cm-dossier-modal__body">
                            <div>
                                <label className="cm-dossier-modal__label" htmlFor="assign-course-title">
                                    Course Title <span className="cm-dossier-modal__req">*</span>
                                </label>
                                <input
                                    id="assign-course-title"
                                    className="cm-input cm-dossier-modal__input w-full"
                                    placeholder="e.g. Enterprise InfoSec & SOC2 Compliance"
                                    value={assignForm.title}
                                    onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))}
                                    required
                                    autoFocus
                                    disabled={assignSubmitting}
                                />
                            </div>

                            <div>
                                <label className="cm-dossier-modal__label" htmlFor="assign-course-desc">
                                    Description
                                </label>
                                <textarea
                                    id="assign-course-desc"
                                    className="cm-input cm-dossier-modal__input w-full"
                                    rows={2}
                                    placeholder="Short curriculum summary shown on the learning path card"
                                    value={assignForm.description}
                                    onChange={(e) => setAssignForm((f) => ({ ...f, description: e.target.value }))}
                                    disabled={assignSubmitting}
                                />
                            </div>

                            <div className="cm-dossier-modal__grid">
                                <div>
                                    <label className="cm-dossier-modal__label" htmlFor="assign-course-type">
                                        Module Type
                                    </label>
                                    <select
                                        id="assign-course-type"
                                        className="cm-input cm-dossier-modal__input w-full"
                                        value={assignForm.type}
                                        onChange={(e) => setAssignForm((f) => ({ ...f, type: e.target.value }))}
                                        disabled={assignSubmitting}
                                    >
                                        <option value="video">Video</option>
                                        <option value="quiz">Quiz / Assessment</option>
                                        <option value="document">Document</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="cm-dossier-modal__label" htmlFor="assign-course-due">
                                        Due Date
                                    </label>
                                    <input
                                        id="assign-course-due"
                                        type="date"
                                        className="cm-input cm-dossier-modal__input w-full"
                                        value={assignForm.dueDate}
                                        onChange={(e) => setAssignForm((f) => ({ ...f, dueDate: e.target.value }))}
                                        disabled={assignSubmitting}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="cm-dossier-modal__label" htmlFor="assign-course-url">
                                    Course / LMS URL
                                </label>
                                <input
                                    id="assign-course-url"
                                    type="url"
                                    className="cm-input cm-dossier-modal__input w-full"
                                    placeholder="https://academy.example.com/courses/…"
                                    value={assignForm.courseUrl}
                                    onChange={(e) => setAssignForm((f) => ({ ...f, courseUrl: e.target.value }))}
                                    disabled={assignSubmitting}
                                />
                            </div>

                            <label className="cm-dossier-modal__check" htmlFor="assign-course-mandatory">
                                <input
                                    id="assign-course-mandatory"
                                    type="checkbox"
                                    checked={assignForm.mandatory}
                                    onChange={(e) => setAssignForm((f) => ({ ...f, mandatory: e.target.checked }))}
                                    disabled={assignSubmitting}
                                />
                                <span>Mark as mandatory induction curriculum</span>
                            </label>
                        </div>

                        <div className="cm-dossier-modal__foot">
                            <button
                                type="button"
                                className="cm-dossier-train__modal-cancel"
                                onClick={closeAssignModal}
                                disabled={assignSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="cm-dossier-train__assign"
                                disabled={assignSubmitting}
                            >
                                {assignSubmitting ? 'Assigning…' : 'Assign to LMS Queue'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
