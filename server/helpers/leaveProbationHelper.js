/**
 * Leave probation: status from Lifecycle (preferred) or employee.probation fallback.
 * Accrual profile switches by calendar month using status as of the 1st of that month
 * (mid-month confirmation → normal rates from the 1st of the next month).
 */

export const LIFECYCLE_ACTIVE_PROBATION_STATUSES = ['Active', 'Extended'];
export const LIFECYCLE_EXITED_PROBATION_STATUSES = [
    'Confirmed',
    'Waived',
    'Rejected',
    'Terminated',
];

export function isLifecycleProbationBlocking(status) {
    return LIFECYCLE_ACTIVE_PROBATION_STATUSES.includes(String(status || ''));
}

/** @deprecated tenure day-count removed; kept for older imports/tests */
export function daysSinceJoiningOn(joiningDate, asOfDate = new Date()) {
    if (!joiningDate) return null;
    const join = new Date(joiningDate);
    if (Number.isNaN(join.getTime())) return null;
    const asOf = new Date(asOfDate);
    const joinDay = new Date(join.getFullYear(), join.getMonth(), join.getDate());
    const asOfDay = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    return Math.floor((asOfDay - joinDay) / (1000 * 60 * 60 * 24));
}

export function startOfLocalDay(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function firstOfMonth(dateInput = new Date()) {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function normalizeProbationSource(source = {}) {
    if (!source || typeof source !== 'object') return null;
    const status = source.status != null ? String(source.status) : '';
    if (!status || status === 'None' || status === 'Not Started') {
        return null;
    }
    return {
        status,
        startDate: source.startDate || null,
        endDate: source.endDate || null,
        confirmedAt: source.confirmedAt || null,
        rejectedAt: source.rejectedAt || null,
    };
}

/**
 * Build a reusable probation context for balance/validation.
 * Lifecycle wins when it has a real status; otherwise employee.probation.
 */
export function buildLeaveProbationContext({
    employee = null,
    lifecycleProbation = null,
} = {}) {
    const joiningDate = employee?.joiningDate || null;
    const lifecycle = normalizeProbationSource(lifecycleProbation);
    const employeeProbation = normalizeProbationSource(employee?.probation);
    return {
        joiningDate,
        lifecycle,
        employee: employeeProbation,
        primary: lifecycle || employeeProbation,
    };
}

/**
 * Whether the employee is on probation as of a calendar day.
 * Exit is effective on confirmedAt / rejectedAt (day of confirmation → not on probation that day).
 * Accrual uses the 1st of each month, so mid-month confirmation keeps probation rates for that month.
 */
export function isOnProbationAsOf(probationContext, asOfDate = new Date()) {
    const primary = probationContext?.primary;
    if (!primary?.status) return false;

    const asOf = startOfLocalDay(asOfDate);
    if (!asOf) return false;

    const start =
        startOfLocalDay(primary.startDate) ||
        startOfLocalDay(probationContext.joiningDate);
    if (start && asOf < start) return false;

    const confirmedAt = startOfLocalDay(primary.confirmedAt);
    const rejectedAt = startOfLocalDay(primary.rejectedAt);
    const exitAt = confirmedAt || rejectedAt;
    // Historical: even if status is already Confirmed, days before exit remain probation.
    if (exitAt) {
        return asOf < exitAt;
    }

    const status = primary.status;
    if (LIFECYCLE_ACTIVE_PROBATION_STATUSES.includes(status)) {
        return true;
    }

    if (LIFECYCLE_EXITED_PROBATION_STATUSES.includes(status)) {
        const endDate = startOfLocalDay(primary.endDate);
        if (endDate && asOf < endDate) {
            return true;
        }
        return false;
    }

    return false;
}

/** Accrual month YYYY-M uses status as of the 1st of that month. */
export function isProbationAccrualMonth(probationContext, year, monthIndex) {
    return isOnProbationAsOf(probationContext, new Date(year, monthIndex, 1));
}

/**
 * Merge probation accrual onto a leave-type config when in probation.
 * Yearly probation is encoded as fixed monthly engine with amount=annual and cap=annual
 * so the first probation month of the year takes the lump; later months credit 0 via cap.
 */
export function applyProbationAccrualOverlay(leaveTypeConfig, probationContext, asOfDate = new Date()) {
    if (!leaveTypeConfig || leaveTypeConfig.enabled === false) {
        return leaveTypeConfig;
    }
    const restrictions = leaveTypeConfig.probationRestrictions;
    if (!restrictions?.enabled) {
        return leaveTypeConfig;
    }
    if (!isOnProbationAsOf(probationContext, asOfDate)) {
        return leaveTypeConfig;
    }

    const accrualIn = restrictions.accrual || {};
    const frequency = String(accrualIn.frequency || accrualIn.method || 'monthly').toLowerCase();
    const annual = Math.max(
        0,
        Number(accrualIn.maxAccrual) || Number(accrualIn.amount) || 0
    );
    const monthly = Math.max(0, Number(accrualIn.amount) || 0);

    if (frequency === 'yearly' || accrualIn.method === 'yearly') {
        const grant = annual > 0 ? annual : monthly;
        return {
            ...leaveTypeConfig,
            accrual: {
                method: 'fixed',
                frequency: 'yearly',
                amount: grant,
                maxAccrual: grant,
                anniversaryBased: false,
            },
            maxDaysPerMonth:
                restrictions.maxDaysPerMonth != null && Number(restrictions.maxDaysPerMonth) > 0
                    ? Number(restrictions.maxDaysPerMonth)
                    : grant > 0
                      ? grant
                      : leaveTypeConfig.maxDaysPerMonth,
            _probationOverlay: true,
            _probationFrequency: 'yearly',
        };
    }

    const monthlyRate = monthly > 0 ? monthly : annual > 0 ? annual / 12 : 0;
    const cap = annual > 0 ? annual : leaveTypeConfig.accrual?.maxAccrual;
    return {
        ...leaveTypeConfig,
        accrual: {
            method: 'fixed',
            frequency: 'yearly',
            amount: monthlyRate,
            maxAccrual: Number(cap) >= 0 ? Number(cap) : 0,
            anniversaryBased: false,
        },
        maxDaysPerMonth:
            restrictions.maxDaysPerMonth != null && Number(restrictions.maxDaysPerMonth) > 0
                ? Number(restrictions.maxDaysPerMonth)
                : monthlyRate > 0
                  ? monthlyRate
                  : leaveTypeConfig.maxDaysPerMonth,
        _probationOverlay: true,
        _probationFrequency: 'monthly',
    };
}

/**
 * Apply-time gate: only blocks when allowLeave is false while on probation.
 * Entitlement differences come from balance/accrual overlay.
 */
export function evaluateLeaveProbationRestriction({
    probationContext = null,
    allowLeave = true,
    asOfDate = new Date(),
    leaveTypeLabel = 'leave',
    // legacy unused args kept so older callers do not crash
    joiningDate = null,
    minServiceDays = 0,
    maxDaysDuringProbation = 0,
    lifecycleProbationStatus = null,
    usedDays = 0,
    requestedDays = 0,
} = {}) {
    void minServiceDays;
    void maxDaysDuringProbation;
    void usedDays;
    void requestedDays;

    let context = probationContext;
    if (!context) {
        context = buildLeaveProbationContext({
            employee: joiningDate ? { joiningDate, probation: null } : null,
            lifecycleProbation: lifecycleProbationStatus
                ? { status: lifecycleProbationStatus }
                : null,
        });
        // Legacy path: status-only lifecycle without dates
        if (lifecycleProbationStatus && isLifecycleProbationBlocking(lifecycleProbationStatus)) {
            context = {
                ...context,
                primary: { status: lifecycleProbationStatus },
            };
        }
    }

    const inProbation = isOnProbationAsOf(context, asOfDate);
    if (!inProbation) {
        return { allowed: true, inProbation: false, remaining: null };
    }

    if (allowLeave === false) {
        return {
            allowed: false,
            reason: `${leaveTypeLabel} is not allowed during probation.`,
            inProbation: true,
            remaining: 0,
        };
    }

    return { allowed: true, inProbation: true, remaining: null };
}

/**
 * @deprecated Use isOnProbationAsOf + buildLeaveProbationContext.
 * Tenure minServiceDays is no longer part of leave probation.
 */
export function resolveLeaveProbationWindow({
    daysSinceJoining,
    minServiceDays = 0,
    lifecycleProbationStatus = null,
} = {}) {
    void daysSinceJoining;
    void minServiceDays;
    const lifecycleBlocks = isLifecycleProbationBlocking(lifecycleProbationStatus);
    return {
        inProbation: lifecycleBlocks,
        reasons: lifecycleBlocks
            ? [`lifecycle probation is ${lifecycleProbationStatus}`]
            : [],
        withinTenure: false,
        lifecycleBlocks,
        minServiceDays: Math.max(0, Number(minServiceDays) || 0),
    };
}

/** Normalize probationRestrictions on policy save / read. */
export function normalizeProbationRestrictions(raw = {}) {
    const enabled = Boolean(raw?.enabled);
    const allowLeave = raw?.allowLeave !== false;
    const accrualIn = raw?.accrual || {};
    let frequency = String(accrualIn.frequency || accrualIn.method || 'monthly').toLowerCase();
    if (frequency !== 'yearly' && frequency !== 'monthly') {
        frequency = 'monthly';
    }

    // Migrate legacy maxDaysDuringProbation when new accrual is absent
    const hasNewAccrual =
        accrualIn.amount != null ||
        accrualIn.maxAccrual != null ||
        accrualIn.frequency != null ||
        accrualIn.method != null;
    let amount = Math.max(0, Number(accrualIn.amount) || 0);
    let maxAccrual = Math.max(0, Number(accrualIn.maxAccrual) || 0);
    let migratedAllowLeave = allowLeave;

    if (enabled && !hasNewAccrual && raw?.maxDaysDuringProbation != null) {
        const legacyMax = Math.max(0, Number(raw.maxDaysDuringProbation) || 0);
        if (legacyMax <= 0) {
            migratedAllowLeave = false;
            frequency = 'monthly';
            amount = 0;
            maxAccrual = 0;
        } else {
            frequency = 'yearly';
            amount = 0;
            maxAccrual = legacyMax;
        }
    }

    return {
        enabled,
        allowLeave: migratedAllowLeave,
        accrual: {
            method: frequency === 'yearly' ? 'yearly' : 'fixed',
            frequency,
            amount: frequency === 'monthly' ? amount : 0,
            maxAccrual: maxAccrual > 0 ? maxAccrual : frequency === 'yearly' ? amount : 0,
        },
        maxDaysPerMonth:
            raw?.maxDaysPerMonth != null && Number(raw.maxDaysPerMonth) > 0
                ? Number(raw.maxDaysPerMonth)
                : frequency === 'monthly' && amount > 0
                  ? amount
                  : undefined,
    };
}
