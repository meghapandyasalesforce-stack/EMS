import { describe, it, expect } from '@jest/globals';
import {
    DEFAULT_LEAVE_ENTITLEMENT_DAYS,
    getEffectiveEntitlementAmount,
    getEffectiveCarryForwardConfig,
    applyLeaveTypeEntitlementDefaults,
} from '../../constants/leaveDefaults.js';

describe('leaveDefaults', () => {
    it('uses 18 days when accrual amount is missing or zero', () => {
        expect(getEffectiveEntitlementAmount({ accrual: { amount: 0 } })).toBe(18);
        expect(getEffectiveEntitlementAmount({ accrual: {} })).toBe(18);
        expect(getEffectiveEntitlementAmount({})).toBe(DEFAULT_LEAVE_ENTITLEMENT_DAYS);
    });

    it('keeps configured accrual amount when positive', () => {
        expect(getEffectiveEntitlementAmount({ accrual: { amount: 24 } })).toBe(24);
    });

    it('enables carry forward by default with no cap (full balance carries)', () => {
        const cfg = getEffectiveCarryForwardConfig({ type: 'casual', accrual: { amount: 0 } });
        expect(cfg.enabled).toBe(true);
        expect(cfg.maxDays).toBeNull();
    });

    it('disables carry forward for loss of pay', () => {
        const cfg = getEffectiveCarryForwardConfig({ type: 'loss_of_pay', accrual: { amount: 0 } });
        expect(cfg.enabled).toBe(false);
    });

    it('applyLeaveTypeEntitlementDefaults sets monthly allocation and carry forward', () => {
        const result = applyLeaveTypeEntitlementDefaults({ type: 'paid', displayName: 'Paid' });
        expect(result.accrual.amount).toBe(1.5);
        expect(result.accrual.method).toBe('monthly');
        expect(result.maxDaysPerMonth).toBe(1.5);
        expect(result.carryForward.enabled).toBe(true);
        expect(result.carryForward.maxDays).toBeNull();
        expect(result.enabled).toBe(true);
    });
});
