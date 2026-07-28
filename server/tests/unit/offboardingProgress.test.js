import { describe, expect, it } from '@jest/globals';
import {
    applyOffboardingProgress,
    calculateOffboardingProgress,
    synchronizeOffboardingDerivedTasks,
} from '../../services/offboardingService.js';
import '../../helpers/notificationEventRegistry.js';
import { getRegisteredEventTypes } from '../../helpers/notificationManager.js';
import { createPushPayload } from '../../helpers/pushNotificationService.js';

const completedWorkflow = () => ({
    status: 'In Progress',
    tasks: [{ title: 'Manual task', status: 'Completed', mandatory: true, assigneeRole: 'employee' }],
    clearanceChecklist: [{ completed: true, mandatory: true }],
    assets: [{ status: 'Returned', returned: true, mandatory: true }],
    knowledgeTransfer: [{ status: 'Completed', mandatory: true }],
    experienceLetter: { status: 'Issued' },
    finalSettlement: { status: 'Cleared', mandatory: true },
    accessRevocation: [{ status: 'Completed', mandatory: true }],
    progressBreakdown: {},
});

describe('offboarding progress', () => {
    it('calculates completion from every mandatory workflow category', () => {
        expect(calculateOffboardingProgress(completedWorkflow())).toMatchObject({
            tasks: 100,
            checklist: 100,
            assets: 100,
            knowledgeTransfer: 100,
            payrollClearance: 100,
            accessRevocation: 100,
            overall: 100,
        });
    });

    it('uses weighted progress and ignores optional pending records', () => {
        const workflow = completedWorkflow();
        workflow.tasks.push({ status: 'Pending', mandatory: true, assigneeRole: 'hr' });
        workflow.assets.push({ status: 'Pending', mandatory: false });

        const result = calculateOffboardingProgress(workflow);

        expect(result.tasks).toBe(50);
        expect(result.assets).toBe(100);
        expect(result.overall).toBe(88);
    });

    it('automatically completes an active workflow at 100 percent', () => {
        const workflow = completedWorkflow();

        applyOffboardingProgress(workflow);

        expect(workflow.progress).toBe(100);
        expect(workflow.status).toBe('Completed');
        expect(workflow.actualCompletionDate).toBeInstanceOf(Date);
    });

    it('automatically marks an incomplete past-due workflow overdue', () => {
        const workflow = completedWorkflow();
        workflow.tasks[0].status = 'Pending';
        workflow.lastWorkingDate = new Date('2024-01-01');

        applyOffboardingProgress(workflow, new Date('2024-01-02'));

        expect(workflow.status).toBe('Overdue');
        expect(workflow.progress).toBeLessThan(100);
    });

    it('derives linked task completion from clearance records', () => {
        const workflow = completedWorkflow();
        workflow.tasks = [
            { title: 'Collect company assets', status: 'Pending' },
            { title: 'Revoke system and physical access', status: 'Pending' },
            { title: 'Issue experience letter', status: 'Pending' },
            { title: 'Complete final settlement clearance', status: 'Pending' },
        ];

        synchronizeOffboardingDerivedTasks(workflow);

        expect(workflow.tasks.every((task) => task.status === 'Completed')).toBe(true);
    });

    it('replaces the retired exit interview task with experience-letter issuance', () => {
        const workflow = completedWorkflow();
        workflow.tasks = [{ title: 'Complete exit interview', status: 'Pending', mandatory: true }];
        workflow.experienceLetter = { status: 'Pending' };

        applyOffboardingProgress(workflow);

        expect(workflow.tasks).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: 'Issue experience letter', status: 'Pending' }),
        ]));
        expect(workflow.tasks.some((task) => task.title === 'Complete exit interview')).toBe(false);
    });
});

describe('offboarding notifications', () => {
    it('registers all offboarding lifecycle events', () => {
        const events = getRegisteredEventTypes();
        expect(events).toEqual(expect.arrayContaining([
            'offboarding_workflow_initiated',
            'offboarding_task_assigned',
            'offboarding_task_completed',
            'offboarding_asset_returned',
            'offboarding_experience_letter_issued',
            'offboarding_workflow_completed',
            'offboarding_workflow_overdue',
            'offboarding_reminder',
        ]));
    });

    it('preserves the offboarding lifecycle deep link in push payloads', () => {
        const payload = createPushPayload('Offboarding updated', 'onboarding', {
            workflowId: 'workflow-1',
            lifecycle: 'offboarding',
            url: '/onboarding?lifecycle=offboarding&id=workflow-1',
        });

        expect(payload.data.url).toBe('/onboarding?lifecycle=offboarding&id=workflow-1');
    });
});

