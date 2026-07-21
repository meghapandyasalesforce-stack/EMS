import { describe, it, expect } from '@jest/globals';
import {
    DEFAULT_LEAVE_ENTITLEMENT_DAYS,
    DEFAULT_MONTHLY_LEAVE_DAYS,
    getLegacyDefaultAnnualEntitlement,
    getLegacyDefaultMonthlyAccrual,
    getEffectiveEntitlementAmount,
    getEffectiveCarryForwardConfig,
    applyLeaveTypeEntitlementDefaults,
    getEffectiveMonthlyAccrual,
} from '../../constants/leaveDefaults.js';

describe('leaveDefaults', () => {
    it('legacy constants are exposed only via explicit accessors', () => {
        expect(getLegacyDefaultAnnualEntitlement()).toBe(DEFAULT_LEAVE_ENTITLEMENT_DAYS);
        expect(getLegacyDefaultMonthlyAccrual()).toBe(DEFAULT_MONTHLY_LEAVE_DAYS);
    });

    it('getEffectiveEntitlementAmount returns 0 when policy maxAccrual is missing (no 18 fallback)', () => {
        expect(getEffectiveEntitlementAmount({ accrual: { amount: 1.5 } })).toBe(0);
        expect(getEffectiveEntitlementAmount({ accrual: { amount: 0 } })).toBe(0);
        expect(getEffectiveEntitlementAmount({ accrual: {} })).toBe(0);
        expect(getEffectiveEntitlementAmount({})).toBe(0);
    });

    it('getEffectiveEntitlementAmount uses accrual.maxAccrual from policy', () => {
        expect(getEffectiveEntitlementAmount({ accrual: { maxAccrual: 24 } })).toBe(24);
        expect(getEffectiveEntitlementAmount({ accrual: { amount: 2, maxAccrual: 18 } })).toBe(18);
    });

    it('getEffectiveMonthlyAccrual uses accrual.amount from policy', () => {
        expect(getEffectiveMonthlyAccrual({ accrual: { method: 'monthly', amount: 2 } })).toBe(2);
        expect(getEffectiveMonthlyAccrual({ accrual: { method: 'monthly' } })).toBe(0);
        expect(getEffectiveMonthlyAccrual({})).toBe(0);
    });

    it('carry forward follows policy configuration only', () => {
        const enabled = getEffectiveCarryForwardConfig({
            type: 'casual',
            carryForward: { enabled: true, maxDays: 5 },
        });
        expect(enabled.enabled).toBe(true);
        expect(enabled.maxDays).toBe(5);
    });

    it('carry forward is disabled when not configured in policy', () => {
        const cfg = getEffectiveCarryForwardConfig({ type: 'casual', accrual: { amount: 1.5 } });
        expect(cfg.enabled).toBe(false);
        expect(cfg.maxDays).toBeNull();
    });

    it('disables carry forward when explicitly disabled in policy', () => {
        const cfg = getEffectiveCarryForwardConfig({
            type: 'loss_of_pay',
            carryForward: { enabled: false },
        });
        expect(cfg.enabled).toBe(false);
    });

    it('applyLeaveTypeEntitlementDefaults does not inject 18/1.5', () => {
        const result = applyLeaveTypeEntitlementDefaults({ type: 'paid', displayName: 'Paid' });
        expect(result.accrual.amount).toBeUndefined();
        expect(result.accrual.maxAccrual).toBeUndefined();
        expect(result.accrual.method).toBe('monthly');
        expect(result.maxDaysPerMonth).toBeUndefined();
        expect(result.carryForward.enabled).toBe(false);
        expect(result.enabled).toBe(true);
    });

    it('applyLeaveTypeEntitlementDefaults preserves HR-configured values', () => {
        const result = applyLeaveTypeEntitlementDefaults({
            type: 'casual',
            accrual: { amount: 2, maxAccrual: 24 },
            maxDaysPerMonth: 3,
            carryForward: { enabled: true, maxDays: 10 },
        });
        expect(result.accrual.amount).toBe(2);
        expect(result.accrual.maxAccrual).toBe(24);
        expect(result.maxDaysPerMonth).toBe(3);
        expect(result.carryForward.maxDays).toBe(10);
    });
});
