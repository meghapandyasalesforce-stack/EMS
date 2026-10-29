import { formatInOrgTimezone, resolveAttendanceDateKeyFromRow } from '../utils/orgTimezone';
import { formatAttendanceStatusLabel, formatStatusLabel } from '../utils/textFormat';
import { getLeaveTypeDisplayName, isHalfDayLeaveRecord } from '../constants/leaveConstants';
import { DAY_NAMES } from '../utils/calendarUtils';

// Leave, regularization and holiday dates are calendar fields, not punch instants.
export function calendarKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    return formatInOrgTimezone(value, 'yyyy-MM-dd');
}

export function monthRange(month) {
    const [year, number] = month.split('-').map(Number);
    return { startDate: `${month}-01`, endDate: `${month}-${new Date(year, number, 0).getDate()}` };
}

export function durationLabel(seconds) {
    const minutes = Math.max(0, Math.floor((Number(seconds) || 0) / 60));
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

const instant = (value) => value ? new Date(value).getTime() : NaN;
const covers = (item, day) => calendarKey(item.startDate) <= day && calendarKey(item.endDate) >= day;
export const halfLabel = (value) => value === 'first_half' ? 'First half' : value === 'second_half' ? 'Second half' : 'Half day';

export function buildDailyReport({ month, logs, leaves = [], regularizations = [], calendar, employee, timezone, now = new Date() }) {
    const range = monthRange(month);
    const today = formatInOrgTimezone(now, 'yyyy-MM-dd', timezone);
    const sessionsByDay = new Map();
    for (const session of logs.sessions || []) {
        const day = resolveAttendanceDateKeyFromRow(session, timezone);
        if (!sessionsByDay.has(day)) sessionsByDay.set(day, []);
        sessionsByDay.get(day).push(session);
    }
    const joining = calendarKey(employee?.joiningDate);
    const leaving = calendarKey(employee?.lastWorkingDate || employee?.terminationDate);
    const rows = [];
    for (let number = 1; number <= Number(range.endDate.slice(-2)); number += 1) {
        const day = `${month}-${String(number).padStart(2, '0')}`;
        const sessions = sessionsByDay.get(day) || [];
        const stats = logs.dailyStats?.[day];
        const clockIns = sessions.map((s) => instant(s.clockIn)).filter(Number.isFinite);
        const clockOuts = sessions.map((s) => instant(s.clockOut)).filter(Number.isFinite);
        const active = sessions.some((s) => s.clockIn && !s.clockOut);
        const holidays = (calendar?.holidays || []).filter((h) => h.isActive !== false && calendarKey(h.date) === day);
        const override = holidays.find((h) => h.workModeOverride);
        const fullHoliday = holidays.find((h) => !h.workModeOverride && !h.isHalfDay);
        const weekday = DAY_NAMES[new Date(`${day}T12:00:00`).getDay()];
        const weekOff = calendar?.workingDays?.[weekday] === false && !override;
        const dayLeaves = leaves.filter((leave) => covers(leave, day));
        const approvedLeaves = dayLeaves.filter((leave) => leave.status === 'approved');
        const fullLeave = approvedLeaves.find((leave) => !isHalfDayLeaveRecord(leave));
        const requests = regularizations.filter((r) => calendarKey(r.attendanceDate) === day);
        const outsideEmployment = (joining && day < joining) || (leaving && day > leaving);
        const breaks = sessions.flatMap((session) => (session.breaks || []).map((entry) => {
            const start = instant(entry.breakIn);
            const end = entry.breakOut ? instant(entry.breakOut) : Math.min(now.getTime(), instant(session.clockOut) || now.getTime());
            return { ...entry, ongoing: Boolean(entry.breakIn && !entry.breakOut && !session.clockOut), seconds: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 1000) : 0 };
        }));
        let status = 'No punch';
        let tone = 'orange';
        if (clockIns.length) {
            const onBreak = breaks.some((b) => b.ongoing);
            status = onBreak ? 'On break' : active ? 'In progress' : formatAttendanceStatusLabel(stats?.status || sessions[0]?.status || 'present');
            tone = onBreak || active ? 'blue' : 'green';
        } else if (outsideEmployment) { status = 'Outside employment'; tone = 'muted'; }
        else if (fullHoliday && !override) { status = 'Holiday'; tone = 'purple'; }
        else if (weekOff) { status = 'Weekly off'; tone = 'muted'; }
        else if (fullLeave) { status = fullLeave.leaveType === 'loss_of_pay' ? 'LOP' : 'On leave'; tone = fullLeave.leaveType === 'loss_of_pay' ? 'orange' : 'purple'; }
        else if (approvedLeaves.length) { status = 'Half-day leave'; tone = 'purple'; }
        else if (day > today) { status = 'Upcoming'; tone = 'muted'; }
        else if (day === today) { status = 'Not punched in'; tone = 'blue'; }
        const netHours = Number.isFinite(stats?.effectiveHours) ? stats.effectiveHours : null;
        rows.push({
            day, sessions, status, tone, active, breaks, holidays, requests, leaves: dayLeaves,
            checkIn: clockIns.length ? Math.min(...clockIns) : null,
            checkOut: !active && clockOuts.length ? Math.max(...clockOuts) : null,
            netHours, breakSeconds: breaks.reduce((sum, b) => sum + b.seconds, 0),
            locations: [...new Set(sessions.flatMap((s) => [s.workLocation, s.secondaryWorkLocation]).filter(Boolean))],
            late: sessions.some((s) => s.isLateArrival), early: sessions.some((s) => s.isEarlyDeparture),
            hasPunch: clockIns.length > 0,
            leaveLabel: (leave) => `${getLeaveTypeDisplayName(leave.leaveType)}${isHalfDayLeaveRecord(leave) ? ` · ${halfLabel(leave.halfDayType)}` : ''}`,
            noPunch: !clockIns.length && day <= today && !outsideEmployment && !weekOff && !fullHoliday && !fullLeave,
            regularized: requests.some((r) => r.status === 'approved'),
        });
    }
    return rows.reverse();
}

export const requestLabel = (request) => `${formatStatusLabel(request.status)} regularization`;
