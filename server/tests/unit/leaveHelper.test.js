import { describe, it, expect } from '@jest/globals';
import {
    normalizeLeaveTypeForPolicy,
    getLeaveTypeVariantsForBalance
} from '../../helpers/leaveTypeHelper.js';
import { shouldApplyDirectLeaveStatusUpdate } from '../../helpers/leaveStatusHelper.js';

describe('leaveTypeHelper', () => {
    it('normalizes annual to paid for policy lookup', () => {
        expect(normalizeLeaveTypeForPolicy('annual')).toBe('paid');
        expect(normalizeLeaveTypeForPolicy('Annual')).toBe('paid');
    });

    it('passes through other leave types unchanged', () => {
        expect(normalizeLeaveTypeForPolicy('sick')).toBe('sick');
        expect(normalizeLeaveTypeForPolicy('casual')).toBe('casual');
    });

    it('includes annual when querying paid balance usage', () => {
        expect(getLeaveTypeVariantsForBalance('paid')).toEqual(['paid', 'annual']);
        expect(getLeaveTypeVariantsForBalance('sick')).toEqual(['sick']);
    });
});

describe('leaveStatusHelper', () => {
    it('allows direct update when no approval workflow exists', () => {
        expect(shouldApplyDirectLeaveStatusUpdate({
            hasApprovalInstance: false,
            workflowProcessed: false,
            workflowStillInProgress: false
        })).toBe(true);
    });

    it('blocks direct update while multi-step workflow is still in progress', () => {
        expect(shouldApplyDirectLeaveStatusUpdate({
            hasApprovalInstance: true,
            workflowProcessed: true,
            workflowStillInProgress: true
        })).toBe(false);
    });

    it('blocks direct update after workflow handled the action', () => {
        expect(shouldApplyDirectLeaveStatusUpdate({
            hasApprovalInstance: true,
            workflowProcessed: true,
            workflowStillInProgress: false
        })).toBe(false);
    });

    it('allows direct update fallback when workflow processing failed', () => {
        expect(shouldApplyDirectLeaveStatusUpdate({
            hasApprovalInstance: true,
            workflowProcessed: false,
            workflowStillInProgress: false
        })).toBe(true);
    });
});
