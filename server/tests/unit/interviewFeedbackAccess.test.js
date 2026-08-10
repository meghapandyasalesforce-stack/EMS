import { describe, it, expect } from '@jest/globals';
import {
    isInterviewCompleted,
    isAssignedInterviewer,
    hasSubmittedFeedback,
    canAcceptFeedbackSubmission,
} from '../../helpers/interviewFeedbackAccess.js';

describe('interviewFeedbackAccess', () => {
    const interviewerId = '64a111111111111111111111';
    const otherId = '64a222222222222222222222';

    it('detects completed status only', () => {
        expect(isInterviewCompleted({ status: 'Completed' })).toBe(true);
        expect(isInterviewCompleted({ status: 'Scheduled' })).toBe(false);
        expect(isInterviewCompleted({ status: 'Cancelled' })).toBe(false);
    });

    it('matches assigned interviewer by id or populated object', () => {
        expect(isAssignedInterviewer({ interviewer: interviewerId }, interviewerId)).toBe(true);
        expect(isAssignedInterviewer({ interviewer: { _id: interviewerId } }, interviewerId)).toBe(true);
        expect(isAssignedInterviewer({ interviewer: interviewerId }, otherId)).toBe(false);
        expect(isAssignedInterviewer({ interviewer: null }, interviewerId)).toBe(false);
    });

    it('detects submitted feedback via submittedAt', () => {
        expect(hasSubmittedFeedback({ feedback: { submittedAt: new Date() } })).toBe(true);
        expect(hasSubmittedFeedback({ feedback: { rating: 4 } })).toBe(false);
        expect(hasSubmittedFeedback({})).toBe(false);
    });

    it('allows feedback only when completed or completing in same request', () => {
        expect(canAcceptFeedbackSubmission({ status: 'Completed' })).toBe(true);
        expect(canAcceptFeedbackSubmission({ status: 'Scheduled' })).toBe(false);
        expect(canAcceptFeedbackSubmission({ status: 'Scheduled' }, { nextStatus: 'Completed' })).toBe(true);
    });
});
