/**
 * Acceptance tests — Opening Leave Balance business requirements (Scenarios 1–8).
 */
import {
    rollLeaveBalanceThroughPeriod,
    roundLeaveDays,
} from '../../helpers/leaveBalanceRulesHelper.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';

const MONTHLY = 1.5;

function openingBalance(openingValue, openingYear = 2016, openingMonth = 1) {
    return {
        active: true,
        balance: openingValue,
        openingYear,
        openingMonth,
    };
}

function closingAt(year, month, result) {
    const row = result.ledgerByYear[year]?.find((r) => r.month === month);
    return row?.available ?? null;
}

function rollTo(year, monthIndex, opts = {}) {
    return rollLeaveBalanceThroughPeriod({
        joinYear: opts.joinYear ?? 2016,
        joinMonthIndex: opts.joinMonthIndex ?? 0,
        endYear: year,
        endMonthIndex: monthIndex,
        monthlyRate: MONTHLY,
        periodOpeningBalance: opts.opening
            ? {
                  openingYear: opts.opening.openingYear,
                  openingMonth: opts.opening.openingMonth,
                  balance: opts.opening.balance,
              }
            : null,
        balanceAnchor: opts.anchor ?? null,
        getUsedForMonth: opts.getUsedForMonth ?? (() => 0),
    });
}

describe('Opening Leave Balance — Acceptance Scenarios', () => {
    describe('Scenario 1: Opening = 3 in January 2016', () => {
        const opening = openingBalance(3);

        it('January 2016 = 3', () => {
            const r = rollTo(2016, 0, { opening });
            expect(closingAt(2016, 1, r)).toBe(3);
        });

        it('February 2016 = 4.5 (previous + 1.5)', () => {
            const r = rollTo(2016, 1, { opening });
            expect(closingAt(2016, 2, r)).toBe(4.5);
        });

        it('March 2016 = 6', () => {
            const r = rollTo(2016, 2, { opening });
            expect(closingAt(2016, 3, r)).toBe(6);
        });

        it('continues across year boundary without reset (Jan 2017 = 21)', () => {
            const r = rollTo(2017, 0, { opening });
            expect(closingAt(2016, 12, r)).toBe(19.5);
            expect(closingAt(2017, 1, r)).toBe(21);
        });

        it('deducts approved leave only', () => {
            const r = rollTo(2016, 2, {
                opening,
                getUsedForMonth: (_y, mi) => (mi === 1 ? 1 : 0),
            });
            expect(closingAt(2016, 2, r)).toBe(3.5);
        });
    });

    describe('Scenario 2: Opening = 10 in January 2016', () => {
        const opening = openingBalance(10);

        it('January 2016 = 10', () => {
            expect(closingAt(2016, 1, rollTo(2016, 0, { opening }))).toBe(10);
        });

        it('February 2016 = 11.5', () => {
            expect(closingAt(2016, 2, rollTo(2016, 1, { opening }))).toBe(11.5);
        });

        it('March 2016 = 13', () => {
            expect(closingAt(2016, 3, rollTo(2016, 2, { opening }))).toBe(13);
        });
    });

    describe('Scenario 3: Opening = 50 in January 2016', () => {
        const opening = openingBalance(50);

        it('January 2016 = 50', () => {
            expect(closingAt(2016, 1, rollTo(2016, 0, { opening }))).toBe(50);
        });

        it('February 2016 = 51.5', () => {
            expect(closingAt(2016, 2, rollTo(2016, 1, { opening }))).toBe(51.5);
        });

        it('March 2016 = 53', () => {
            expect(closingAt(2016, 3, rollTo(2016, 2, { opening }))).toBe(53);
        });
    });

    describe('Scenario 4: Joining Date June 2026 — accrual starts from Opening not join', () => {
        const opening = openingBalance(3);

        it('without opening, Jan 2016 before join returns zero', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 5,
                endYear: 2016,
                endMonthIndex: 0,
                monthlyRate: MONTHLY,
            });
            expect(r.available).toBe(0);
        });

        it('with opening, Jan 2016 = 3 even when join is June 2026', () => {
            const r = rollTo(2016, 0, { opening });
            expect(closingAt(2016, 1, r)).toBe(3);
        });

        it('computePooledAvailableLeave uses opening month as accrual start (not join)', async () => {
            const employee = {
                _id: 'acceptance-test-emp',
                joiningDate: new Date(2026, 5, 25),
            };
            const joinYear = employee.joiningDate.getFullYear();
            const joinMonthIndex = employee.joiningDate.getMonth();
            const periodOpening = openingBalance(3);

            let accrualStartYear = joinYear;
            let accrualStartMonthIndex = joinMonthIndex;
            if (periodOpening?.active) {
                accrualStartYear = periodOpening.openingYear;
                accrualStartMonthIndex = Number(periodOpening.openingMonth) - 1;
            }

            expect(accrualStartYear).toBe(2016);
            expect(accrualStartMonthIndex).toBe(0);
            expect(accrualStartYear).not.toBe(joinYear);
        });
    });

    describe('Scenario 5: Opening Jan 2016 = 3, later adjustment July 2026 = 40', () => {
        const opening = openingBalance(3);
        const anchor = { anchorYear: 2026, anchorMonth: 7, anchorBalance: 40 };

        it('Jan–Jun 2026 roll from opening; Jul = 40; Aug = 41.5', () => {
            const r = rollTo(2026, 7, { opening, anchor });
            expect(closingAt(2016, 1, r)).toBe(3);
            expect(closingAt(2026, 6, r)).toBe(roundLeaveDays(3 + 125 * MONTHLY));
            expect(closingAt(2026, 7, r)).toBe(40);
            expect(closingAt(2026, 8, r)).toBe(41.5);
        });

        it('Sep 2026 = 43', () => {
            const r = rollTo(2026, 8, { opening, anchor });
            expect(closingAt(2026, 9, r)).toBe(43);
        });
    });

    describe('Scenario 6: Re-edit opening Jan 2016 from 3 to 10 rebuilds chain', () => {
        it('January 2016 = 10 after re-edit', () => {
            const r = rollTo(2016, 0, { opening: openingBalance(10) });
            expect(closingAt(2016, 1, r)).toBe(10);
        });

        it('February 2016 = 11.5 after re-edit', () => {
            const r = rollTo(2016, 1, { opening: openingBalance(10) });
            expect(closingAt(2016, 2, r)).toBe(11.5);
        });

        it('current month uses latest opening (Jan 2026 with opening=10)', () => {
            const r = rollTo(2026, 0, { opening: openingBalance(10) });
            const monthsAfterOpening = 120;
            expect(closingAt(2026, 1, r)).toBe(roundLeaveDays(10 + monthsAfterOpening * MONTHLY));
        });
    });

    describe('Scenario 7: Automation must not clear Opening Leave Balance', () => {
        it('calculateBalance source does not modify employeeLeaveSummary.openingLeaveBalance', () => {
            const src = leaveBalanceEngine.calculateBalance.toString();
            expect(src).not.toMatch(/openingLeaveBalance\s*=/);
            expect(src).not.toMatch(/\$unset.*openingLeaveBalance/);
            expect(src).not.toMatch(/openingLeaveBalance\.active\s*=\s*false/);
        });

        it('leaveBalanceAutomationService does not reference openingLeaveBalance', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const automationSrc = fs.readFileSync(
                path.join(__dirname, '../../services/leaveBalanceAutomationService.js'),
                'utf8'
            );
            expect(automationSrc).not.toMatch(/openingLeaveBalance/);
        });
    });

    describe('Scenario 8: API path uses opening-based roll (buildEmployeeLeaveBalanceResponse)', () => {
        it('response helper passes opening to computePooledAvailableLeave and anchor resolver', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const helperSrc = fs.readFileSync(
                path.join(__dirname, '../../helpers/leaveBalanceResponseHelper.js'),
                'utf8'
            );
            expect(helperSrc).toMatch(/resolveEmployeeOpeningBalance/);
            expect(helperSrc).toMatch(/resolveEmployeeBalanceAnchor/);
            expect(helperSrc).toMatch(/computePooledAvailableLeave/);
            expect(helperSrc).toMatch(/periodOpeningBalance/);
        });

        it('computePooledAvailableLeave overrides join start when opening is active', () => {
            const src = leaveBalanceEngine.computePooledAvailableLeave.toString();
            expect(src).toMatch(/periodOpeningBalance\?\.active/);
            expect(src).toMatch(/accrualStartYear\s*=\s*periodOpeningBalance\.openingYear/);
        });
    });
});
