/**
 * HRMS migration — imported previous leave balance for employees who existed before go-live.
 *
 * Manual Correction (unchanged UI):
 * - Pre-HRMS employee, first save at go-live month → openingLeaveBalance; accrual starts there only
 * - Re-edit opening month → update opening; future months rebuild automatically
 * - Save at a later month → anchor only; latest value becomes base for following months (+1.5/mo)
 * - Post-HRMS joiners and existing HRMS users → legacy manualOverride behaviour (unchanged)
 */
import { calendarMonthSortKey } from './leaveBalanceRulesHelper.js';

/** HRMS leave tracking start (June 2026). Months before this are never calculated. */
export const HRMS_LEAVE_START = { year: 2026, month: 6 };

/** Gap after which a save at a later month replaces (not anchors) a stale opening snap. */
export const STALE_OPENING_RELOCATE_GAP_MONTHS = 12;

export function isPreHrmsMigrationEmployee(joiningDate) {
    if (!joiningDate) {
        return false;
    }
    const date = joiningDate instanceof Date ? joiningDate : new Date(joiningDate);
    if (Number.isNaN(date.getTime())) {
        return false;
    }
    const joinKey = calendarMonthSortKey(date.getFullYear(), date.getMonth() + 1);
    const hrmsKey = calendarMonthSortKey(HRMS_LEAVE_START.year, HRMS_LEAVE_START.month);
    return joinKey < hrmsKey;
}

export function chooseCanonicalOpening(candidates) {
    if (!candidates.length) {
        return null;
    }

    return candidates.reduce((best, candidate) => {
        if (!best) {
            return candidate;
        }
        const candidateSetAt = candidate.setAt ?? 0;
        const bestSetAt = best.setAt ?? 0;
        if (candidateSetAt > bestSetAt) {
            return candidate;
        }
        if (candidateSetAt < bestSetAt) {
            return best;
        }
        return candidate.sortKey >= best.sortKey ? candidate : best;
    }, null);
}

/**
 * @param {object} persistedOpening - Active openingLeaveBalance record
 * @returns {'opening'|'anchor'}
 */
export function classifyMigrationManualCorrection(persistedOpening, targetYear, targetMonth) {
    const targetKey = calendarMonthSortKey(targetYear, targetMonth);
    const openingKey = calendarMonthSortKey(
        persistedOpening.openingYear,
        persistedOpening.openingMonth
    );

    if (targetKey === openingKey) {
        return 'opening';
    }

    if (targetKey - openingKey > STALE_OPENING_RELOCATE_GAP_MONTHS) {
        return 'opening';
    }

    if (targetKey > openingKey) {
        return 'anchor';
    }

    return 'opening';
}

/**
 * @returns {'opening'|'anchor'|'legacy'}
 */
export function resolveManualCorrectionSaveKind(
    persistedOpening,
    hasLegacyManualOverride,
    targetYear,
    targetMonth,
    joiningDate = null
) {
    if (!persistedOpening) {
        if (hasLegacyManualOverride) {
            return 'legacy';
        }
        if (isPreHrmsMigrationEmployee(joiningDate)) {
            return 'opening';
        }
        return 'legacy';
    }
    return classifyMigrationManualCorrection(persistedOpening, targetYear, targetMonth);
}

export function isOpeningRelocate(persistedOpening, saveKind, targetYear, targetMonth) {
    if (!persistedOpening || saveKind !== 'opening') {
        return false;
    }
    return (
        persistedOpening.openingYear !== targetYear ||
        persistedOpening.openingMonth !== targetMonth
    );
}
