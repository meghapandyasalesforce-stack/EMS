/**
 * Leave-policy probation restrictions (hybrid).
 *
 * Tenure gate: days since joiningDate < minServiceDays
 * Lifecycle gate: onboarding probation status is Active or Extended
 *   (missing workflow / Confirmed / Waived / etc. → ignore Lifecycle)
 *
 * While either gate applies, maxDaysDuringProbation is a total cap for that leave type
 * (pending + approved). 0 means no leave of that type during probation.
 * When neither gate applies, probation rules do not restrict leave.
 */

export const LIFECYCLE_ACTIVE_PROBATION_STATUSES = ['Active', 'Extended'];

export function isLifecycleProbationBlocking(status) {
    return LIFECYCLE_ACTIVE_PROBATION_STATUSES.includes(String(status || ''));
}

export function daysSinceJoiningOn(joiningDate, asOfDate = new Date()) {
    if (!joiningDate) return null;
    const join = new Date(joiningDate);
    if (Number.isNaN(join.getTime())) return null;
    const asOf = new Date(asOfDate);
    const joinDay = new Date(join.getFullYear(), join.getMonth(), join.getDate());
    const asOfDay = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    return Math.floor((asOfDay - joinDay) / (1000 * 60 * 60 * 24));
}

/**
 * @returns {{ inProbation: boolean, reasons: string[] }}
 */
export function resolveLeaveProbationWindow({
    daysSinceJoining,
    minServiceDays = 0,
    lifecycleProbationStatus = null,
} = {}) {
    const minDays = Math.max(0, Number(minServiceDays) || 0);
    const reasons = [];
    const withinTenure = daysSinceJoining != null && daysSinceJoining < minDays;
    const lifecycleBlocks = isLifecycleProbationBlocking(lifecycleProbationStatus);

    if (withinTenure) {
        reasons.push(`minimum ${minDays} days of service`);
    }
    if (lifecycleBlocks) {
        reasons.push(`lifecycle probation is ${lifecycleProbationStatus}`);
    }

    return {
        inProbation: withinTenure || lifecycleBlocks,
        reasons,
        withinTenure,
        lifecycleBlocks,
        minServiceDays: minDays,
    };
}

/**
 * Evaluate whether a leave request is allowed under probation restrictions.
 * @returns {{ allowed: boolean, reason?: string, inProbation: boolean, remaining?: number }}
 */
export function evaluateLeaveProbationRestriction({
    joiningDate,
    minServiceDays = 0,
    maxDaysDuringProbation = 0,
    lifecycleProbationStatus = null,
    usedDays = 0,
    requestedDays = 0,
    asOfDate = new Date(),
    leaveTypeLabel = 'leave',
} = {}) {
    if (!joiningDate) {
        return {
            allowed: false,
            reason: 'Joining date not set for employee',
            inProbation: true,
        };
    }

    const days = daysSinceJoiningOn(joiningDate, asOfDate);
    if (days == null) {
        return {
            allowed: false,
            reason: 'Joining date not set for employee',
            inProbation: true,
        };
    }

    const window = resolveLeaveProbationWindow({
        daysSinceJoining: days,
        minServiceDays,
        lifecycleProbationStatus,
    });

    if (!window.inProbation) {
        return { allowed: true, inProbation: false, remaining: null };
    }

    const maxAllowed = Math.max(0, Number(maxDaysDuringProbation) || 0);
    const used = Math.max(0, Number(usedDays) || 0);
    const requested = Math.max(0, Number(requestedDays) || 0);
    const remaining = Math.max(0, maxAllowed - used);

    if (maxAllowed <= 0) {
        const why =
            window.reasons.length > 0
                ? ` (${window.reasons.join('; ')})`
                : '';
        return {
            allowed: false,
            reason: `${leaveTypeLabel} is not allowed during probation${why}.`,
            inProbation: true,
            remaining: 0,
        };
    }

    if (used + requested > maxAllowed + 1e-9) {
        return {
            allowed: false,
            reason: `During probation, maximum ${maxAllowed} day(s) of ${leaveTypeLabel} allowed. You have used ${used} and requested ${requested} (remaining ${remaining}).`,
            inProbation: true,
            remaining,
        };
    }

    return { allowed: true, inProbation: true, remaining: remaining - requested };
}
