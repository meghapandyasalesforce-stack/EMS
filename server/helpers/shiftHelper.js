/**
 * Shift Management helpers — Shift 1 / Shift 2 on AttendanceRule.shifts
 */

export const SHIFT_1_KEY = 'shift1';
export const SHIFT_2_KEY = 'shift2';

export const DEFAULT_SHIFT_DEFINITIONS = [
    {
        key: SHIFT_1_KEY,
        name: 'Shift 1',
        startTime: '09:00',
        endTime: '17:00',
        isDefault: true,
    },
    {
        key: SHIFT_2_KEY,
        name: 'Shift 2',
        startTime: '21:00',
        endTime: '06:00',
        isDefault: false,
    },
];

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidHHmm = (value) => typeof value === 'string' && HHMM_RE.test(value.trim());

/**
 * Normalize rule.shifts to exactly Shift 1 + Shift 2 (stable keys).
 * Preserves configured times when present.
 */
export const normalizeShiftSettings = (shiftsInput) => {
    const list = Array.isArray(shiftsInput) ? shiftsInput : [];

    const findByKeyOrName = (key, name) =>
        list.find(
            (s) =>
                s &&
                (String(s.key || '').toLowerCase() === key ||
                    String(s.name || '').trim().toLowerCase() === name.toLowerCase())
        );

    const build = (def) => {
        const existing = findByKeyOrName(def.key, def.name);
        const startTime =
            existing && isValidHHmm(existing.startTime) ? existing.startTime.trim() : def.startTime;
        const endTime =
            existing && isValidHHmm(existing.endTime) ? existing.endTime.trim() : def.endTime;
        return {
            key: def.key,
            name: def.name,
            startTime,
            endTime,
            isDefault: Boolean(def.isDefault),
        };
    };

    return DEFAULT_SHIFT_DEFINITIONS.map(build);
};

/**
 * Build Shift 1 / Shift 2 from explicit admin payload.
 * @param {{ shift1StartTime, shift1EndTime, shift2StartTime, shift2EndTime }} body
 */
export const buildShiftsFromTimingPayload = (body = {}) => {
    const shift1Start = body.shift1StartTime ?? body.shift1?.startTime;
    const shift1End = body.shift1EndTime ?? body.shift1?.endTime;
    const shift2Start = body.shift2StartTime ?? body.shift2?.startTime;
    const shift2End = body.shift2EndTime ?? body.shift2?.endTime;

    if (!isValidHHmm(shift1Start) || !isValidHHmm(shift1End)) {
        throw new Error('Shift 1 start and end times are required (HH:mm)');
    }
    if (!isValidHHmm(shift2Start) || !isValidHHmm(shift2End)) {
        throw new Error('Shift 2 start and end times are required (HH:mm)');
    }

    return [
        {
            key: SHIFT_1_KEY,
            name: 'Shift 1',
            startTime: shift1Start.trim(),
            endTime: shift1End.trim(),
            isDefault: true,
        },
        {
            key: SHIFT_2_KEY,
            name: 'Shift 2',
            startTime: shift2Start.trim(),
            endTime: shift2End.trim(),
            isDefault: false,
        },
    ];
};

export const shiftsToTimingResponse = (shifts) => {
    const normalized = normalizeShiftSettings(shifts);
    const s1 = normalized.find((s) => s.key === SHIFT_1_KEY) || DEFAULT_SHIFT_DEFINITIONS[0];
    const s2 = normalized.find((s) => s.key === SHIFT_2_KEY) || DEFAULT_SHIFT_DEFINITIONS[1];
    return {
        shifts: normalized,
        shift1: { startTime: s1.startTime, endTime: s1.endTime, name: s1.name, key: s1.key },
        shift2: { startTime: s2.startTime, endTime: s2.endTime, name: s2.name, key: s2.key },
    };
};

/**
 * Resolve assigned shift from employee + rule. Returns null if employee has no assignment
 * (keeps existing officeHours behavior for unassigned / legacy employees).
 * When rule.enableShifts is false, shifts are disabled org-wide and ignored.
 */
export const resolveEmployeeShift = (rule, employee) => {
    if (!employee) return null;
    if (rule && rule.enableShifts === false) return null;
    const shifts = normalizeShiftSettings(rule?.shifts);
    const shiftId = employee.shiftId != null ? String(employee.shiftId).trim() : '';
    const shiftName = employee.shiftName != null ? String(employee.shiftName).trim() : '';

    if (!shiftId && !shiftName) return null;

    if (shiftId) {
        const byKey = shifts.find(
            (s) => s.key === shiftId || String(s._id || '') === shiftId
        );
        if (byKey) return byKey;
        // Accept shift1 / shift2 aliases
        const lower = shiftId.toLowerCase();
        if (lower === SHIFT_1_KEY || lower === '1' || lower === 'shift 1') {
            return shifts.find((s) => s.key === SHIFT_1_KEY) || null;
        }
        if (lower === SHIFT_2_KEY || lower === '2' || lower === 'shift 2') {
            return shifts.find((s) => s.key === SHIFT_2_KEY) || null;
        }
    }

    if (shiftName) {
        const byName = shifts.find(
            (s) => s.name.toLowerCase() === shiftName.toLowerCase()
        );
        if (byName) return byName;
    }

    return null;
};

/**
 * Validate optional shift assignment from request body.
 * Returns { shiftId, shiftName } or null if not provided.
 */
export const parseEmployeeShiftAssignment = (body = {}, ruleShifts = null) => {
    const rawId = body.shiftId != null ? String(body.shiftId).trim() : '';
    const rawName = body.shiftName != null ? String(body.shiftName).trim() : '';
    if (!rawId && !rawName) return null;

    const shifts = normalizeShiftSettings(ruleShifts);
    const pseudoEmployee = { shiftId: rawId || undefined, shiftName: rawName || undefined };
    const matched = resolveEmployeeShift({ shifts }, pseudoEmployee);
    if (!matched) {
        throw new Error('Invalid shift. Choose Shift 1 or Shift 2.');
    }
    return { shiftId: matched.key, shiftName: matched.name };
};

/**
 * Rule view with officeHours overridden by employee shift when assigned.
 */
export const applyEmployeeShiftToRule = (rule, employee) => {
    const shift = resolveEmployeeShift(rule, employee);
    if (!shift?.startTime || !shift?.endTime) return rule;
    return {
        ...(rule || {}),
        officeHours: {
            ...(rule?.officeHours || {}),
            startTime: shift.startTime,
            endTime: shift.endTime,
        },
        _resolvedShift: shift,
    };
};

/**
 * Full-shift punch-in window for an assigned shift = [shift start, shift end].
 * Late arrival still uses normal grace after shift start (separate from this window).
 * Returns null when employee has no assigned shift (no hard block).
 */
export const formatMinutesAsHHmm = (totalMinutes) => {
    const mins = ((Number(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * @returns {{ shift, windowStartHHmm, windowEndHHmm, isOvernight } | null}
 */
export const getAssignedShiftCheckInWindow = (rule, employee) => {
    const shift = resolveEmployeeShift(rule, employee);
    if (!shift?.startTime || !shift?.endTime) return null;
    if (!isValidHHmm(shift.startTime) || !isValidHHmm(shift.endTime)) return null;

    const start = shift.startTime.trim();
    const end = shift.endTime.trim();
    const [sh, sm] = start.split(':').map((p) => Number(p));
    const [eh, em] = end.split(':').map((p) => Number(p));
    const startMins = (Number.isFinite(sh) ? sh : 0) * 60 + (Number.isFinite(sm) ? sm : 0);
    const endMins = (Number.isFinite(eh) ? eh : 0) * 60 + (Number.isFinite(em) ? em : 0);

    return {
        shift,
        windowStartHHmm: start,
        windowEndHHmm: end,
        isOvernight: endMins <= startMins,
    };
};

/**
 * Whether clockIn falls inside the employee's full shift window for the attendance day.
 * Overnight shifts also accept punches in the early morning of the following calendar day
 * (e.g. Shift 21:00–06:00 → punch at 02:00 is valid).
 */
export const isClockInWithinShiftWindow = ({
    clockInTime,
    startOfDay,
    windowStartHHmm,
    windowEndHHmm,
    orgTimezone,
    combineDateAndTimeInTimezone,
}) => {
    const buildWindow = (dayAnchor) => {
        let windowStart = combineDateAndTimeInTimezone(dayAnchor, windowStartHHmm, orgTimezone);
        let windowEnd = combineDateAndTimeInTimezone(dayAnchor, windowEndHHmm, orgTimezone);
        if (windowEnd <= windowStart) {
            windowEnd = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
        }
        return { windowStart, windowEnd };
    };

    const current = buildWindow(startOfDay);
    if (clockInTime >= current.windowStart && clockInTime <= current.windowEnd) {
        return { allowed: true, ...current };
    }

    // Overnight: check previous day's shift span covering early morning
    const overnight =
        combineDateAndTimeInTimezone(startOfDay, windowEndHHmm, orgTimezone) <=
        combineDateAndTimeInTimezone(startOfDay, windowStartHHmm, orgTimezone);
    if (overnight) {
        const prevDay = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
        const previous = buildWindow(prevDay);
        if (clockInTime >= previous.windowStart && clockInTime <= previous.windowEnd) {
            return { allowed: true, ...previous };
        }
    }

    return { allowed: false, ...current };
};
