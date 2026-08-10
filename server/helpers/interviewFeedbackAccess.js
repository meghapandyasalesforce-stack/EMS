/**
 * Interview feedback access helpers (recruitment).
 * Feedback is per interviewSchedule subdocument — not candidate-level.
 */

export function getInterviewInterviewerId(interview) {
    if (!interview?.interviewer) return null;
    return interview.interviewer._id || interview.interviewer;
}

export function isInterviewCompleted(interview) {
    return String(interview?.status || '') === 'Completed';
}

export function isAssignedInterviewer(interview, employeeId) {
    if (!employeeId) return false;
    const interviewerId = getInterviewInterviewerId(interview);
    if (!interviewerId) return false;
    return String(interviewerId) === String(employeeId);
}

export function hasSubmittedFeedback(interview) {
    return !!(interview?.feedback?.submittedAt);
}

/**
 * Whether feedback may be written.
 * Source of truth: interview.status === 'Completed' (or request is marking it Completed now).
 */
export function canAcceptFeedbackSubmission(interview, { nextStatus } = {}) {
    if (isInterviewCompleted(interview)) return true;
    return String(nextStatus || '') === 'Completed';
}
