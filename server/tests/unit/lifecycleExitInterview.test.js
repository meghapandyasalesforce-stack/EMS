import { describe, expect, it } from '@jest/globals';
import {
    buildExitInterviewAnalytics,
    syncWorkflowExitInterview,
    DEFAULT_FEEDBACK_AREAS,
} from '../../services/lifecycleExitInterviewService.js';

describe('lifecycleExitInterviewService', () => {
    it('syncs workflow exit interview status from sessions', () => {
        const workflow = { exitInterview: { status: 'Not Scheduled', mandatory: true, questions: [] } };
        syncWorkflowExitInterview(workflow, [
            { _id: 's1', interviewType: 'employee_self', status: 'Scheduled', scheduledDate: new Date() },
            { _id: 's2', interviewType: 'manager', status: 'Draft' },
        ]);
        expect(workflow.exitInterview.status).toBe('Scheduled');
        expect(workflow.exitInterview.sessions).toHaveLength(2);
    });

    it('marks workflow completed when all sessions closed', () => {
        const workflow = { exitInterview: { status: 'In Progress', mandatory: true, questions: [] } };
        syncWorkflowExitInterview(workflow, [
            { _id: 's1', interviewType: 'employee_self', status: 'Closed' },
            { _id: 's2', interviewType: 'hr', status: 'Approved' },
        ]);
        expect(workflow.exitInterview.status).toBe('Completed');
        expect(workflow.exitInterview.completionPercent).toBe(100);
    });

    it('builds analytics with attrition and ratings', () => {
        const analytics = buildExitInterviewAnalytics([
            { status: 'Submitted', rating: 4, employeeId: { department: 'Engineering' }, responses: { primary_exit_reason: 'Career Growth' }, rehireEligible: true },
            { status: 'Closed', rating: 2, employeeId: { department: 'HR' }, responses: { exit_reason: 'Salary' }, rehireEligible: false },
            { status: 'Draft', employeeId: { department: 'Engineering' }, actionItems: [{ status: 'Open' }] },
        ]);
        expect(analytics.total).toBe(3);
        expect(analytics.completed).toBe(2);
        expect(analytics.avgRating).toBe(3);
        expect(analytics.byDepartment.Engineering).toBe(2);
        expect(analytics.openActionItems).toBe(1);
    });

    it('exposes default feedback areas', () => {
        expect(DEFAULT_FEEDBACK_AREAS).toContain('Manager');
        expect(DEFAULT_FEEDBACK_AREAS).toContain('Suggestions');
    });
});
