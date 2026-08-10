import { describe, it, expect } from '@jest/globals';
import {
    validateInterviewForInvite,
    validateInterviewForReminder,
    validateOfferForReminder,
    validateJoiningForReminder,
    validateRealJobForEmail,
    isHoldingJobPosting,
    resolveJobTitle,
    findRecentCommunication,
    formatInterviewTypeLabel,
    isValidEmailAddress,
} from '../../services/recruitmentEmailService.js';

describe('recruitmentEmailService validation', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('rejects incomplete interview invite', () => {
        expect(validateInterviewForInvite(null).ok).toBe(false);
        expect(validateInterviewForInvite({
            interviewType: 'Video',
            scheduledDate: futureDate,
            scheduledTime: '10:00',
            meetingLink: '',
            location: '',
            status: 'Scheduled',
        }).ok).toBe(false);
    });

    it('accepts complete video interview invite', () => {
        expect(validateInterviewForInvite({
            interviewType: 'Video',
            scheduledDate: futureDate,
            scheduledTime: '10:00 – 11:00',
            meetingLink: 'https://meet.example.com/abc',
            status: 'Scheduled',
        }).ok).toBe(true);
    });

    it('rejects reminder for cancelled or past interviews', () => {
        expect(validateInterviewForReminder({
            interviewType: 'Phone',
            scheduledDate: futureDate,
            scheduledTime: '10:00',
            location: 'Call candidate',
            status: 'Cancelled',
        }).ok).toBe(false);

        expect(validateInterviewForReminder({
            interviewType: 'Phone',
            scheduledDate: new Date('2020-01-01'),
            scheduledTime: '10:00',
            location: 'Call candidate',
            status: 'Scheduled',
        }).ok).toBe(false);
    });

    it('validates offer reminder states', () => {
        expect(validateOfferForReminder(null).ok).toBe(false);
        expect(validateOfferForReminder({ status: 'Draft', portalToken: 'x' }).ok).toBe(false);
        expect(validateOfferForReminder({ status: 'Sent', portalToken: 'tok' }).ok).toBe(true);
        expect(validateOfferForReminder({ status: 'Cancelled', portalToken: 'tok' }).ok).toBe(false);
    });

    it('validates joining reminder requirements', () => {
        expect(validateJoiningForReminder({
            status: 'Offer Accepted',
            joiningStatus: 'Confirmed',
            expectedJoiningDate: futureDate,
            email: 'a@b.com',
        }).ok).toBe(true);

        expect(validateJoiningForReminder({
            status: 'Offer Accepted',
            joiningStatus: 'Confirmed',
            expectedJoiningDate: null,
        }).ok).toBe(false);

        expect(validateJoiningForReminder({
            status: 'Rejected',
            joiningStatus: 'None',
            expectedJoiningDate: futureDate,
        }).ok).toBe(false);

        expect(validateJoiningForReminder({
            status: 'Screening',
            joiningStatus: 'None',
            expectedJoiningDate: futureDate,
        }).ok).toBe(false);
    });

    it('finds recent communication of matching type', () => {
        const candidate = {
            communications: [
                {
                    emailType: 'joining_reminder',
                    channel: 'email',
                    direction: 'outbound',
                    createdAt: new Date(),
                },
            ],
        };
        expect(findRecentCommunication(candidate, 'joining_reminder')).toBeTruthy();
        expect(findRecentCommunication(candidate, 'interview_invite')).toBeNull();
    });

    it('maps On-site to In-Person and validates emails', () => {
        expect(formatInterviewTypeLabel('On-site')).toBe('In-Person');
        expect(isValidEmailAddress('a@b.com')).toBe(true);
        expect(isValidEmailAddress('bad')).toBe(false);
    });

    it('rejects holding job title for candidate-facing emails', () => {
        expect(isHoldingJobPosting({
            jobTitle: 'Unassigned (Resume Inbox)',
            tags: ['__resume_inbox_holding__'],
        })).toBe(true);

        expect(validateRealJobForEmail({
            jobPostingId: { jobTitle: 'Unassigned (Resume Inbox)', tags: ['__resume_inbox_holding__'] },
        }).ok).toBe(false);

        expect(validateRealJobForEmail({
            jobPostingId: { jobTitle: 'Unassigned (Resume Inbox)', tags: ['__resume_inbox_holding__'] },
        }).message).toMatch(/assign this candidate to a job/i);

        expect(validateRealJobForEmail({
            jobPostingId: { jobTitle: 'MERN Developer', tags: [] },
        })).toEqual({ ok: true, jobTitle: 'MERN Developer' });

        expect(resolveJobTitle({
            jobPostingId: { jobTitle: 'Unassigned (Resume Inbox)', tags: ['__resume_inbox_holding__'] },
        })).toBeNull();

        expect(resolveJobTitle({
            jobPostingId: { jobTitle: 'MERN Developer' },
        })).toBe('MERN Developer');
    });
});
