/**
 * Acceptance tests — HRMS migration opening balance (effective month workflow).
 */
import {
    rollLeaveBalanceThroughPeriod,
    roundLeaveDays,
    calendarMonthSortKey,
} from '../../helpers/leaveBalanceRulesHelper.js';
import {
    chooseCanonicalOpening,
    classifyMigrationManualCorrection,
    isPreHrmsMigrationEmployee,
    resolveManualCorrectionSaveKind,
} from '../../helpers/openingLeaveBalanceHelper.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';
import {
    manualAvailableFromOverride,
    pickBestManualOverrideAtView,
} from '../../helpers/leaveBalanceResponseHelper.js';

const MONTHLY = 1.5;
const HRMS_YEAR = 2026;
const HRMS_MONTH = 6;

function openingBalance(openingValue, openingYear = HRMS_YEAR, openingMonth = HRMS_MONTH) {
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
    const opening = opts.opening ?? null;
    const joinYear = opening ? opening.openingYear : (opts.joinYear ?? HRMS_YEAR);
    const joinMonthIndex = opening
        ? Number(opening.openingMonth) - 1
        : (opts.joinMonthIndex ?? HRMS_MONTH - 1);

    return rollLeaveBalanceThroughPeriod({
        joinYear,
        joinMonthIndex,
        endYear: year,
        endMonthIndex: monthIndex,
        monthlyRate: MONTHLY,
        periodOpeningBalance: opening
            ? {
                  openingYear: opening.openingYear,
                  openingMonth: opening.openingMonth,
                  balance: opening.balance,
              }
            : null,
        balanceAnchor: opts.anchor ?? null,
        getUsedForMonth: opts.getUsedForMonth ?? (() => 0),
    });
}

describe('HRMS Migration Opening Balance — Acceptance Scenarios', () => {
    describe('Scenario 1: Opening = 10 at June 2026 (HRMS start)', () => {
        const opening = openingBalance(10);

        it('June 2026 = 10', () => {
            expect(closingAt(2026, 6, rollTo(2026, 5, { opening }))).toBe(10);
        });

        it('July 2026 = 11.5', () => {
            expect(closingAt(2026, 7, rollTo(2026, 6, { opening }))).toBe(11.5);
        });

        it('August 2026 = 13', () => {
            expect(closingAt(2026, 8, rollTo(2026, 7, { opening }))).toBe(13);
        });

        it('December 2026 = 19', () => {
            expect(closingAt(2026, 12, rollTo(2026, 11, { opening }))).toBe(19);
        });

        it('January 2027 = 20.5 (no yearly reset)', () => {
            const r = rollTo(2027, 0, { opening });
            expect(closingAt(2026, 12, r)).toBe(19);
            expect(closingAt(2027, 1, r)).toBe(20.5);
        });

        it('does not accrue before opening month', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: HRMS_YEAR,
                joinMonthIndex: HRMS_MONTH - 1,
                endYear: 2016,
                endMonthIndex: 0,
                monthlyRate: MONTHLY,
                periodOpeningBalance: {
                    openingYear: opening.openingYear,
                    openingMonth: opening.openingMonth,
                    balance: opening.balance,
                },
            });
            expect(r.available).toBe(0);
        });

        it('ignores join date 2016 — roll starts at imported June 2026 only', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2016,
                joinMonthIndex: 0,
                endYear: 2026,
                endMonthIndex: 8,
                monthlyRate: MONTHLY,
                periodOpeningBalance: {
                    openingYear: 2026,
                    openingMonth: 6,
                    balance: 10,
                },
            });
            expect(r.calculationStartYear).toBe(2026);
            expect(r.calculationStartMonth).toBe(6);
            expect(r.firstProcessedMonth).toBe(6);
            expect(r.firstClosingBalance).toBe(10);
            expect(r.ledgerByYear[2026]?.some((row) => row.month < 6)).toBe(false);
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(11.5);
            expect(closingAt(2026, 9, r)).toBe(14.5);
        });

        it('join July 2026 — no accrual before join month', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 6,
                endYear: 2026,
                endMonthIndex: 5,
                monthlyRate: MONTHLY,
            });
            expect(r.available).toBe(0);
            expect(r.ledgerByYear[2026] ?? []).toHaveLength(0);
        });

        it('join July 2026 — accrual from July only', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 6,
                endYear: 2026,
                endMonthIndex: 7,
                monthlyRate: MONTHLY,
            });
            expect(r.calculationStartMonth).toBe(7);
            expect(r.firstProcessedMonth).toBe(7);
            expect(closingAt(2026, 7, r)).toBe(1.5);
            expect(closingAt(2026, 8, r)).toBe(3);
        });

        it('stale opening before join is ignored — join June 2026 wins', () => {
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 5,
                endYear: 2026,
                endMonthIndex: 6,
                monthlyRate: MONTHLY,
                periodOpeningBalance: {
                    openingYear: 2016,
                    openingMonth: 1,
                    balance: 3,
                },
            });
            expect(r.calculationStartYear).toBe(2026);
            expect(r.calculationStartMonth).toBe(6);
            expect(r.firstProcessedMonth).toBe(6);
            expect(closingAt(2026, 6, r)).toBe(1.5);
        });
    });

    describe('Scenario 2: Opening = 3 at June 2026', () => {
        const opening = openingBalance(3);

        it('June 2026 = 3', () => {
            expect(closingAt(2026, 6, rollTo(2026, 5, { opening }))).toBe(3);
        });

        it('July 2026 = 4.5', () => {
            expect(closingAt(2026, 7, rollTo(2026, 6, { opening }))).toBe(4.5);
        });
    });

    describe('Scenario 3: Opening = 50 at June 2026', () => {
        const opening = openingBalance(50);

        it('June 2026 = 50', () => {
            expect(closingAt(2026, 6, rollTo(2026, 5, { opening }))).toBe(50);
        });

        it('July 2026 = 51.5', () => {
            expect(closingAt(2026, 7, rollTo(2026, 6, { opening }))).toBe(51.5);
        });
    });

    describe('Scenario 4: Joining Date June 2026 — opening overrides join for accrual start', () => {
        it('accrual starts at opening month, not pre-HRMS history', () => {
            const opening = openingBalance(10);
            const joinYear = 2026;
            const joinMonthIndex = 5;

            let accrualStartYear = joinYear;
            let accrualStartMonthIndex = joinMonthIndex;
            if (opening?.active) {
                accrualStartYear = opening.openingYear;
                accrualStartMonthIndex = Number(opening.openingMonth) - 1;
            }

            expect(accrualStartYear).toBe(2026);
            expect(accrualStartMonthIndex).toBe(5);
        });
    });

    describe('Scenario 5: Later Manual Correction is anchor only — opening unchanged', () => {
        const opening = openingBalance(10);
        const julyAnchor = {
            anchorYear: 2026,
            anchorMonth: 7,
            anchorBalance: 20,
        };

        it('June snap = 10; July without anchor = 11.5', () => {
            const r = rollTo(2026, 6, { opening });
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(11.5);
        });

        it('July anchor = 20 — June still 10, July = 20, August = 21.5', () => {
            const r = rollTo(2026, 8, { opening, anchor: julyAnchor });
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(20);
            expect(closingAt(2026, 8, r)).toBe(21.5);
            expect(closingAt(2026, 9, r)).toBe(23);
        });

        it('October anchor = 30 — June–Sep unchanged, Oct = 30, Nov = 31.5, Dec = 33', () => {
            const octoberAnchor = {
                anchorYear: 2026,
                anchorMonth: 10,
                anchorBalance: 30,
            };
            const r = rollTo(2026, 11, { opening, anchor: octoberAnchor });
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(11.5);
            expect(closingAt(2026, 8, r)).toBe(13);
            expect(closingAt(2026, 9, r)).toBe(14.5);
            expect(closingAt(2026, 10, r)).toBe(30);
            expect(closingAt(2026, 11, r)).toBe(31.5);
            expect(closingAt(2026, 12, r)).toBe(33);
        });

        it('later correction 18 → 25 rebuilds forward only (25, 26.5, 28, 29.5)', () => {
            const correctionAnchor = {
                anchorYear: 2026,
                anchorMonth: 10,
                anchorBalance: 25,
            };
            const r = rollTo(2027, 0, { opening, anchor: correctionAnchor });
            expect(closingAt(2026, 9, r)).toBe(14.5);
            expect(closingAt(2026, 10, r)).toBe(25);
            expect(closingAt(2026, 11, r)).toBe(26.5);
            expect(closingAt(2026, 12, r)).toBe(28);
            expect(closingAt(2027, 1, r)).toBe(29.5);
        });
    });

    describe('Scenario 5b: Approved leave deduction after opening', () => {
        it('July 11.5 minus 2 approved leave = 9.5, August = 11', () => {
            const opening = openingBalance(10);
            const usedInJuly = (year, monthIndex) =>
                year === 2026 && monthIndex === 6 ? 2 : 0;

            const r = rollTo(2026, 8, { opening, getUsedForMonth: usedInJuly });
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(9.5);
            expect(closingAt(2026, 8, r)).toBe(11);
            expect(closingAt(2026, 9, r)).toBe(12.5);
        });
    });

    describe('Scenario 6: Re-edit June 2026 from 10 to 15 rebuilds chain', () => {
        it('June 2026 = 15 after re-edit', () => {
            expect(closingAt(2026, 6, rollTo(2026, 5, { opening: openingBalance(15) }))).toBe(15);
        });

        it('July 2026 = 16.5 after re-edit', () => {
            expect(closingAt(2026, 7, rollTo(2026, 6, { opening: openingBalance(15) }))).toBe(16.5);
        });

        it('August 2026 = 18 after re-edit', () => {
            expect(closingAt(2026, 8, rollTo(2026, 7, { opening: openingBalance(15) }))).toBe(18);
        });

        it('re-edit June to 20 rebuilds forward (June = 20, July = 21.5, October = 26)', () => {
            const opening = openingBalance(20);
            const r = rollTo(2026, 9, { opening });
            expect(closingAt(2026, 6, r)).toBe(20);
            expect(closingAt(2026, 7, r)).toBe(21.5);
            expect(closingAt(2026, 10, r)).toBe(26);
        });
    });

    describe('Scenario 7: Persisted opening selection', () => {
        it('prefers latest calendar month over stale earlier opening (June 2026 beats Jan 2016)', () => {
            const chosen = leaveBalanceEngine.pickCanonicalPersistedOpening([
                {
                    sortKey: calendarMonthSortKey(2016, 1),
                    setAt: 9999,
                    balance: 3,
                    openingYear: 2016,
                    openingMonth: 1,
                },
                {
                    sortKey: calendarMonthSortKey(2026, 6),
                    setAt: 1000,
                    balance: 10,
                    openingYear: 2026,
                    openingMonth: 6,
                },
            ]);
            expect(chosen.openingYear).toBe(2026);
            expect(chosen.openingMonth).toBe(6);
            expect(chosen.balance).toBe(10);
        });

        it('chooseCanonicalOpening uses latest setAt for same-month tie-break', () => {
            const chosen = chooseCanonicalOpening([
                {
                    sortKey: calendarMonthSortKey(2016, 1),
                    setAt: 1000,
                    balance: 3,
                    openingYear: 2016,
                    openingMonth: 1,
                },
                {
                    sortKey: calendarMonthSortKey(2026, 6),
                    setAt: 2000,
                    balance: 10,
                    openingYear: 2026,
                    openingMonth: 6,
                },
            ]);
            expect(chosen.openingYear).toBe(2026);
            expect(chosen.openingMonth).toBe(6);
            expect(chosen.balance).toBe(10);
        });

        it('accepts January 2026 opening before June joining month', () => {
            const chosen = chooseCanonicalOpening([
                {
                    sortKey: calendarMonthSortKey(2026, 1),
                    setAt: Date.now(),
                    balance: 10,
                    openingYear: 2026,
                    openingMonth: 1,
                },
            ]);
            expect(chosen).not.toBeNull();
            expect(chosen.openingMonth).toBe(1);
            expect(chosen.balance).toBe(10);
        });
    });

    describe('Scenario 8: Automation must not clear Opening Leave Balance', () => {
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

    describe('Scenario 9: API path uses opening-based roll', () => {
        it('response helper passes opening to computePooledAvailableLeave and anchor resolver', async () => {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const helperSrc = fs.readFileSync(
                path.join(__dirname, '../../helpers/leaveBalanceResponseHelper.js'),
                'utf8'
            );
            expect(helperSrc).toMatch(/resolvePersistedOpeningLeaveBalance/);
            expect(helperSrc).toMatch(/resolveEmployeeBalanceAnchor/);
            expect(helperSrc).toMatch(/computePooledAvailableLeave/);
            expect(helperSrc).toMatch(/persistedOpening/);
        });

        it('resolveEmployeeBalanceAnchor skips anchors at or before opening month', async () => {
            const src = leaveBalanceEngine.resolveEmployeeBalanceAnchor.toString();
            expect(src).toMatch(/openingSortKey/);
            expect(src).toMatch(/anchorSortKey <= openingSortKey/);
        });
    });

    describe('Scenario 10: Any HR-selected effective month (e.g. January 2026)', () => {
        it('January 2026 = 10 with accrual from that month only', () => {
            const opening = openingBalance(10, 2026, 1);
            const r = rollTo(2026, 5, { opening });
            expect(closingAt(2026, 1, r)).toBe(10);
            expect(closingAt(2026, 2, r)).toBe(11.5);
            expect(closingAt(2026, 6, r)).toBe(17.5);
        });

        it('does not roll from years before the effective month', () => {
            const opening = openingBalance(10, 2026, 1);
            const r = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 0,
                endYear: 2025,
                endMonthIndex: 11,
                monthlyRate: MONTHLY,
                periodOpeningBalance: {
                    openingYear: opening.openingYear,
                    openingMonth: opening.openingMonth,
                    balance: opening.balance,
                },
            });
            expect(r.available).toBe(0);
        });
    });

    describe('Scenario 11: Replace legacy opening year when HR picks new effective month', () => {
        it('January 2026 opening replaces January 2016 — Jan 2026 shows entered value only', () => {
            const oldOpening = openingBalance(3, 2016, 1);
            const newOpening = openingBalance(10, 2026, 1);

            const rolledFromOld = rollTo(2026, 0, { opening: oldOpening });
            expect(closingAt(2026, 1, rolledFromOld)).toBe(183);

            const rolledFromNew = rollTo(2026, 1, { opening: newOpening });
            expect(closingAt(2026, 1, rolledFromNew)).toBe(10);
            expect(closingAt(2026, 2, rolledFromNew)).toBe(11.5);
        });
    });

    describe('Scenario 12: Save kind classification', () => {
        const persistedJune = {
            openingYear: 2026,
            openingMonth: 6,
            balance: 10,
        };

        it('first import for pre-HRMS employee → opening', () => {
            expect(
                resolveManualCorrectionSaveKind(null, false, 2026, 6, new Date('2016-03-01'))
            ).toBe('opening');
        });

        it('post-HRMS joiner manual adjust → legacy (unchanged behaviour)', () => {
            expect(
                resolveManualCorrectionSaveKind(null, false, 2026, 9, new Date('2026-08-01'))
            ).toBe('legacy');
            expect(isPreHrmsMigrationEmployee(new Date('2026-08-01'))).toBe(false);
        });

        it('legacy manual employee → legacy', () => {
            expect(resolveManualCorrectionSaveKind(null, true, 2026, 6)).toBe('legacy');
        });

        it('re-edit opening month → opening', () => {
            expect(classifyMigrationManualCorrection(persistedJune, 2026, 6)).toBe('opening');
        });

        it('October correction → anchor', () => {
            expect(classifyMigrationManualCorrection(persistedJune, 2026, 10)).toBe('anchor');
        });

        it('stale Jan 2016 → June 2026 save → opening', () => {
            expect(
                classifyMigrationManualCorrection(
                    { openingYear: 2016, openingMonth: 1, balance: 3 },
                    2026,
                    6
                )
            ).toBe('opening');
        });
    });

    describe('Scenario 13: Manual carry forward before accrual start (display preserved)', () => {
        it('picks latest manual override at or before view month', () => {
            const overrides = [
                {
                    anchorYear: 2016,
                    anchorMonth: 1,
                    adjustedAt: 100,
                    carriedForward: 3,
                    accrued: 0,
                    used: 0,
                },
                {
                    anchorYear: 2020,
                    anchorMonth: 6,
                    adjustedAt: 200,
                    carriedForward: 10,
                    accrued: 0,
                    used: 0,
                },
            ];

            const atJune2020 = pickBestManualOverrideAtView(overrides, 2020, 6);
            expect(atJune2020.carriedForward).toBe(10);

            const atMarch2020 = pickBestManualOverrideAtView(overrides, 2020, 3);
            expect(atMarch2020.carriedForward).toBe(3);
        });

        it('manual carry forward computes available as accrued + carry − used', () => {
            expect(
                manualAvailableFromOverride({
                    accrued: 0,
                    carriedForward: 10,
                    used: 0,
                })
            ).toBe(10);

            expect(
                manualAvailableFromOverride({
                    accrued: 5,
                    carriedForward: 10,
                    used: 2,
                })
            ).toBe(13);
        });

        it('roll-based accrual after opening month is unchanged (carry forward chain intact)', () => {
            const opening = openingBalance(10, 2026, 6);
            const r = rollTo(2026, 8, { opening });
            expect(closingAt(2026, 6, r)).toBe(10);
            expect(closingAt(2026, 7, r)).toBe(11.5);
            expect(closingAt(2026, 8, r)).toBe(13);
        });

        it('manual anchor after opening deducts approved leave from carry-forward balance', () => {
            const anchor = { anchorYear: 2016, anchorMonth: 1, anchorBalance: 3 };
            const result = rollLeaveBalanceThroughPeriod({
                joinYear: 2016,
                joinMonthIndex: 0,
                endYear: 2017,
                endMonthIndex: 0,
                monthlyRate: MONTHLY,
                balanceAnchor: anchor,
                getUsedForMonth: (year, monthIndex) =>
                    year === 2017 && monthIndex === 0 ? 1 : 0,
            });

            expect(result.ledgerByYear[2017][0].available).toBe(20);
        });

        it('carry forward before join (May 2026) seeds balance from join month (June 2026) onward', () => {
            const result = rollLeaveBalanceThroughPeriod({
                joinYear: 2026,
                joinMonthIndex: 5,
                endYear: 2026,
                endMonthIndex: 6,
                monthlyRate: MONTHLY,
                initialBalance: 10,
            });

            expect(result.ledgerByYear[2026]).toHaveLength(2);
            expect(result.ledgerByYear[2026][0].previousBalance).toBe(10);
            expect(result.ledgerByYear[2026][0].month).toBe(6);
            expect(result.ledgerByYear[2026][0].available).toBe(11.5);
            expect(result.ledgerByYear[2026][1].month).toBe(7);
            expect(result.ledgerByYear[2026][1].available).toBe(13);
        });
    });
});
