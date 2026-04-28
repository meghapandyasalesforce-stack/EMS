/**
 * Night-shift / next-morning clock-out: when clock-out is on or before clock-in in wall time,
 * roll clock-out forward by one calendar day. Optional explicit `clockOutNextDay` forces +1 day
 * on clock-out (e.g. forgot punch-out at 6 AM next morning).
 */

export function addCalendarDays(date, deltaDays) {
    const out = new Date(date.getTime());
    out.setDate(out.getDate() + deltaDays);
    return out;
}

export function isExplicitNextDayFlag(clockOutNextDay) {
    if (clockOutNextDay == null) return false;
    if (typeof clockOutNextDay === 'boolean') return clockOutNextDay;
    const s = String(clockOutNextDay).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/**
 * @param {object} opts
 * @param {Date|string} opts.attendanceDate - anchor (validated by caller)
 * @param {Date|null|undefined} [opts.clockIn]
 * @param {Date|null|undefined} [opts.clockOut]
 * @param {boolean|string|undefined} [opts.clockOutNextDay]
 * @returns {{ clockIn: Date|null, clockOut: Date|null }}
 */
export function harmonizeRegularizationRequestedTimes(opts) {
    let clockIn = opts.clockIn || null;
    let clockOut = opts.clockOut || null;

    if (clockIn) {
        clockIn = new Date(clockIn.getTime ? clockIn.getTime() : clockIn);
        if (Number.isNaN(clockIn.getTime())) {
            throw new Error('Invalid requested clock-in');
        }
    }
    if (clockOut) {
        clockOut = new Date(clockOut.getTime ? clockOut.getTime() : clockOut);
        if (Number.isNaN(clockOut.getTime())) {
            throw new Error('Invalid requested clock-out');
        }
    }

    const explicitNextDay = isExplicitNextDayFlag(opts.clockOutNextDay);

    if (!clockOut) {
        return { clockIn, clockOut: null };
    }

    let out = new Date(clockOut.getTime());

    if (explicitNextDay) {
        out = addCalendarDays(out, 1);
    }

    if (clockIn && out.getTime() <= clockIn.getTime()) {
        out = addCalendarDays(out, 1);
    }

    return { clockIn, clockOut: out };
}

/**
 * Align stored timestamps when approving (fixes legacy payloads where out was same calendar morning before in).
 */
export function ensureClockOutAfterClockIn(clockInTime, clockOutTime) {
    if (!clockInTime || !clockOutTime) return { clockInTime, clockOutTime };
    const ci = new Date(clockInTime.getTime ? clockInTime.getTime() : clockInTime);
    let co = new Date(clockOutTime.getTime ? clockOutTime.getTime() : clockOutTime);
    if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
        return { clockInTime: ci, clockOutTime: co };
    }
    if (co.getTime() <= ci.getTime()) {
        co = addCalendarDays(co, 1);
    }
    return { clockInTime: ci, clockOutTime: co };
}
