import { describe, expect, it } from '@jest/globals';
import {
    applyEmployeeFinancialDetails,
    applyEmployeeProfilePhoto,
    applyProgressToWorkflow,
    calculateProgressBreakdown,
    getOnboardingReminderStage,
    silenceCurrentOnboardingReminders,
    getTaskCompletionBlockers,
    hasWorkflowActivity,
    resolveInitialWorkflowStatus,
    synchronizeDocumentDrivenTasks,
} from '../../services/onboardingService.js';
import '../../helpers/notificationEventRegistry.js';
import { getRegisteredEventTypes } from '../../helpers/notificationManager.js';
import { createPushPayload } from '../../helpers/pushNotificationService.js';

const completeWorkflowData = () => ({
    tasks: [{ status: 'Completed', assigneeRole: 'employee' }],
    documents: [{ mandatory: true, status: 'Verified', url: '/document.pdf' }],
    checklist: [{ mandatory: true, completed: true }],
    trainingModules: [{ mandatory: true, status: 'Completed', documentUrl: '/training.pdf' }],
    policySignatures: [{ mandatory: true, status: 'Signed', documentUrl: '/policy.pdf' }],
    assets: [{ mandatory: true, status: 'Assigned' }],
});

describe('onboarding progress', () => {
    it('derives 100 percent only from completed mandatory records', () => {
        const result = calculateProgressBreakdown(completeWorkflowData());

        expect(result).toMatchObject({
            tasks: 100,
            documents: 100,
            checklist: 100,
            training: 100,
            policies: 100,
            assets: 100,
            overall: 100,
        });
    });

    it('applies normalized weights across every requirement group', () => {
        const workflow = completeWorkflowData();
        workflow.tasks.push({ status: 'Pending', assigneeRole: 'employee' });

        const result = calculateProgressBreakdown(workflow);

        expect(result.tasks).toBe(50);
        expect(result.overall).toBe(85);
    });

    it('counts only verified mandatory documents and ignores optional requirements', () => {
        const workflow = completeWorkflowData();
        workflow.documents = [
            { mandatory: true, status: 'Uploaded', url: '/pending.pdf' },
            { mandatory: false, status: 'Pending' },
        ];
        workflow.assets.push({ mandatory: false, status: 'Pending' });

        const result = calculateProgressBreakdown(workflow);

        expect(result.documents).toBe(0);
        expect(result.assets).toBe(100);
        expect(result.overall).toBe(75);
    });

    it('automatically completes an active workflow when mandatory work is done', () => {
        const workflow = {
            ...completeWorkflowData(),
            status: 'In Progress',
            progress: 0,
            progressBreakdown: {},
        };

        applyProgressToWorkflow(workflow);

        expect(workflow.progress).toBe(100);
        expect(workflow.status).toBe('Completed');
        expect(workflow.actualCompletionDate).toBeInstanceOf(Date);
    });

    it('keeps a ready workflow Not Started until real activity occurs', () => {
        const workflow = {
            tasks: [{ status: 'Pending' }],
            documents: [{ mandatory: true, status: 'Pending' }],
            checklist: [{ mandatory: true, completed: false }],
            trainingModules: [],
            policySignatures: [],
            assets: [{ mandatory: true, status: 'Pending' }],
            status: 'Not Started',
        };

        applyProgressToWorkflow(workflow);

        expect(workflow.status).toBe('Not Started');
        expect(hasWorkflowActivity(workflow)).toBe(false);

        workflow.checklist[0].completed = true;
        applyProgressToWorkflow(workflow);
        expect(workflow.status).toBe('In Progress');
    });

    it('uses Scheduled before joining and Not Started on joining day', () => {
        expect(resolveInitialWorkflowStatus({
            joiningDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })).toBe('Scheduled');
        expect(resolveInitialWorkflowStatus({
            joiningDate: new Date(),
        })).toBe('Not Started');
    });

    it('blocks task completion until persisted dependencies are complete', () => {
        const dependency = { _id: 'dependency-1', title: 'Create account', status: 'In Progress' };
        const task = {
            status: 'In Progress',
            dependencies: ['dependency-1'],
            requiredDocuments: [],
        };

        expect(getTaskCompletionBlockers({ tasks: [dependency, task], documents: [] }, task))
            .toContain('Complete dependency: Create account');
    });

    it('automatically advances upload tasks as canonical documents arrive', () => {
        const task = {
            title: 'Upload identity documents',
            status: 'Pending',
            requiredDocuments: ['AADHAAR', 'PAN', 'PHOTO'],
            dependencies: [],
        };
        const workflow = {
            tasks: [task],
            documents: [
                { documentType: 'AADHAAR', status: 'Uploaded', url: '/aadhaar.pdf' },
                { documentType: 'PAN', status: 'Pending' },
                { documentType: 'PHOTO', status: 'Pending' },
            ],
            activityFeed: [],
        };

        synchronizeDocumentDrivenTasks(workflow);
        expect(task.status).toBe('In Progress');

        workflow.documents[1] = { documentType: 'PAN', status: 'Verified', url: '/pan.pdf' };
        workflow.documents[2] = { documentType: 'PHOTO', status: 'Uploaded', url: '/photo.jpg' };
        synchronizeDocumentDrivenTasks(workflow);

        expect(task.status).toBe('Completed');
        expect(task.completedDate).toBeInstanceOf(Date);
    });

    it('uses the employee profile photo for the onboarding photograph requirement', () => {
        const workflow = {
            documents: [{ documentType: 'PHOTO', mandatory: true, status: 'Pending' }],
        };
        const uploadedAt = new Date('2026-07-21T10:00:00.000Z');

        expect(applyEmployeeProfilePhoto(workflow, {
            _id: 'employee-1',
            profilePhoto: {
                url: '/uploads/profile-photos/profile-1.jpg',
                filename: 'profile-1.jpg',
                uploadedAt,
            },
        })).toBe(true);
        expect(workflow.documents[0]).toMatchObject({
            status: 'Verified',
            url: '/uploads/profile-photos/profile-1.jpg',
            originalFileName: 'profile-1.jpg',
            uploadedBy: 'employee-1',
        });
    });

    it('uses completed financial profile data for bank details', () => {
        const workflow = {
            documents: [{ documentType: 'BANK_DETAILS', mandatory: true, status: 'Pending' }],
        };

        expect(applyEmployeeFinancialDetails(workflow, {
            _id: 'employee-1',
            updatedAt: new Date('2026-07-21T10:00:00.000Z'),
            financialDetails: {
                bankName: 'Test Bank',
                ifsc: 'TEST0001234',
                accountNo: '123456789',
                accountName: 'Test Employee',
            },
        })).toBe(true);
        expect(workflow.documents[0]).toMatchObject({
            status: 'Verified',
            url: '/financial-details',
            uploadedBy: 'employee-1',
        });
    });

    it('automatically completes verification only when all mandatory documents are verified', () => {
        const task = {
            title: 'Verify employee documents',
            status: 'Pending',
            requiresAllMandatoryDocsVerified: true,
            dependencies: [],
        };
        const workflow = {
            tasks: [task],
            documents: [
                { documentType: 'AADHAAR', mandatory: true, status: 'Verified', url: '/aadhaar.pdf' },
                { documentType: 'PAN', mandatory: true, status: 'Uploaded', url: '/pan.pdf' },
                { documentType: 'PASSPORT', mandatory: false, status: 'Pending' },
            ],
            activityFeed: [],
        };

        synchronizeDocumentDrivenTasks(workflow);
        expect(task.status).toBe('In Progress');

        workflow.documents[1].status = 'Verified';
        synchronizeDocumentDrivenTasks(workflow);
        expect(task.status).toBe('Completed');
    });

    it('holds the reminder that is already due when onboarding is assigned', () => {
        const now = new Date('2026-07-21T10:00:00.000Z');
        const workflow = {
            status: 'Not Started',
            startDate: now,
            employeeId: 'employee-1',
            notificationHistory: [],
            tasks: [{
                _id: 'task-1',
                title: 'Upload identity documents',
                status: 'Pending',
                dueDate: new Date('2026-07-24T18:00:00.000Z'),
                assignedTo: 'employee-1',
            }],
            documents: [],
            checklist: [],
            trainingModules: [],
            policySignatures: [],
        };

        expect(silenceCurrentOnboardingReminders(workflow, now)).toBe(true);
        expect(workflow.notificationHistory.map((entry) => entry.key))
            .toEqual(['digest:employee-1:due-in-3-days']);

        workflow.status = 'Scheduled';
        const before = workflow.notificationHistory.length;
        expect(silenceCurrentOnboardingReminders(workflow, now)).toBe(false);
        expect(workflow.notificationHistory).toHaveLength(before);
    });

    it('schedules reminders three days, one day, on due date, and weekly overdue', () => {
        const now = new Date('2026-07-21T10:00:00.000Z'); // Tuesday; week starts Monday 2026-07-20

        expect(getOnboardingReminderStage(new Date('2026-07-24T18:00:00.000Z'), now)?.key)
            .toBe('due-in-3-days');
        expect(getOnboardingReminderStage(new Date('2026-07-22T18:00:00.000Z'), now)?.key)
            .toBe('due-in-1-days');
        expect(getOnboardingReminderStage(new Date('2026-07-21T18:00:00.000Z'), now)?.key)
            .toBe('due-today');
        expect(getOnboardingReminderStage(new Date('2026-07-20T18:00:00.000Z'), now)?.key)
            .toBe('overdue-week-2026-07-20');
        expect(getOnboardingReminderStage(new Date('2026-07-23T18:00:00.000Z'), now))
            .toBeNull();

        // Same overdue week key later the same week (Thursday)
        const laterSameWeek = new Date('2026-07-23T10:00:00.000Z');
        expect(getOnboardingReminderStage(new Date('2026-07-20T18:00:00.000Z'), laterSameWeek)?.key)
            .toBe('overdue-week-2026-07-20');
        // Next week gets a new key
        const nextWeek = new Date('2026-07-27T10:00:00.000Z');
        expect(getOnboardingReminderStage(new Date('2026-07-20T18:00:00.000Z'), nextWeek)?.key)
            .toBe('overdue-week-2026-07-27');
    });

    it('registers every onboarding-only notification event', () => {
        const registered = getRegisteredEventTypes();
        expect(registered).toEqual(expect.arrayContaining([
            'onboarding_workflow_assigned',
            'onboarding_task_assigned',
            'onboarding_task_started',
            'onboarding_task_completed',
            'onboarding_document_uploaded',
            'onboarding_document_approved',
            'onboarding_document_rejected',
            'onboarding_checklist_completed',
            'onboarding_training_completed',
            'onboarding_policy_signed',
            'onboarding_asset_assigned',
            'onboarding_asset_returned',
            'onboarding_workflow_completed',
            'onboarding_workflow_overdue',
            'onboarding_reminder',
        ]));
        expect(registered.filter((event) => event.startsWith('onboarding_')))
            .not.toContain('onboarding_email');
    });

    it('routes onboarding pushes to the matching workflow', () => {
        const payload = createPushPayload('Task started', 'onboarding', {
            title: 'Task Started',
            workflowId: 'workflow-123',
        });

        expect(payload.body).toContain('Task Started');
        expect(payload.data.url).toBe('/onboarding?id=workflow-123');
    });
});
