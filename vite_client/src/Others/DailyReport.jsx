import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiCoffee, FiFileText, FiRefreshCw } from 'react-icons/fi';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT, EMPLOYEE_LEAVE_ENDPOINT } from '../utils/constant';
import { formatAttendanceDateKey, formatInOrgTimezone } from '../utils/orgTimezone';
import { formatStatusLabel } from '../utils/textFormat';
import { buildDailyReport, calendarKey, durationLabel, monthRange, requestLabel } from './dailyReportUtils';
import '../styles/dailyReport.css';

const REGULARIZATION_ENDPOINT = '/v1/both/attendance-regularization/request';

async function getRegularizations() {
    const requests = [];
    let pages = 1;
    for (let page = 1; page <= pages; page += 1) {
        const { data } = await axios.get(REGULARIZATION_ENDPOINT, { params: { page, limit: 100 }, withCredentials: true });
        if (!Array.isArray(data?.data)) throw new Error('Regularization records unavailable');
        requests.push(...data.data);
        pages = Number(data.pagination?.pages) || 1;
    }
    return requests;
}

function DailyReport() {
    const timezone = useSelector((state) => state.timezone?.timezone);
    const employee = useSelector((state) => state.employeeDetails?.employee);
    const [month, setMonth] = useState(() => formatInOrgTimezone(new Date(), 'yyyy-MM', timezone));
    const [sources, setSources] = useState(null);
    const [error, setError] = useState('');
    const [warnings, setWarnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [filter, setFilter] = useState('all');
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            setWarnings([]);
            setExpanded(null);
            const range = monthRange(month);
            const results = await Promise.allSettled([
                axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, { params: range, withCredentials: true }),
                axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, { withCredentials: true }),
                getRegularizations(),
                axios.get(`/v1/employee/calendar/${month.slice(0, 4)}`, { withCredentials: true }),
            ]);
            if (cancelled) return;
            const [attendance, leave, regularization, calendar] = results;
            if (attendance.status === 'rejected' || !Array.isArray(attendance.value?.data?.sessions) || !attendance.value?.data?.dailyStats || typeof attendance.value.data.dailyStats !== 'object' || Array.isArray(attendance.value.data.dailyStats)) {
                const failure = attendance.reason;
                setError(failure?.response?.data?.message || failure?.message || 'Failed to fetch daily report');
                setLoading(false);
                return;
            }
            const missing = [];
            const leaveData = leave.status === 'fulfilled' && Array.isArray(leave.value?.data?.leaves) ? leave.value.data.leaves : null;
            const calendarData = calendar.status === 'fulfilled' ? (calendar.value?.data?.data || calendar.value?.data) : null;
            if (!leaveData) missing.push('Leave and LOP records');
            if (regularization.status === 'rejected') missing.push('Regularization records');
            if (!calendarData?.workingDays) missing.push('Company holidays and weekly offs');
            setWarnings(missing);
            setSources({
                logs: attendance.value.data,
                leaves: leaveData || [],
                regularizations: regularization.status === 'fulfilled' ? regularization.value : [],
                calendar: calendarData?.workingDays ? calendarData : null,
                now: new Date(),
            });
            setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [month, retry, timezone]);

    const rows = useMemo(() => sources ? buildDailyReport({ ...sources, month, timezone, employee }) : [], [sources, month, timezone, employee]);
    const filtered = rows.filter((row) => filter === 'all' || (filter === 'punched' && row.hasPunch) || (filter === 'no-punch' && row.noPunch) || (filter === 'leave' && row.leaves.length) || (filter === 'regularization' && row.requests.length));
    const counts = [
        { label: 'Days with punch', value: rows.filter((r) => r.hasPunch).length, icon: <FiCheckCircle />, tone: 'green' },
        { label: 'Without punch', value: rows.filter((r) => r.noPunch).length, icon: <FiClock />, tone: 'orange' },
        { label: 'Leave / LOP records', value: sources?.leaves.filter((l) => calendarKey(l.startDate) <= monthRange(month).endDate && calendarKey(l.endDate) >= monthRange(month).startDate).length || 0, icon: <FiCalendar />, tone: 'purple' },
        { label: 'Regularized days', value: rows.filter((r) => r.regularized).length, icon: <FiFileText />, tone: 'blue' },
    ];
    const time = (value) => value != null ? formatInOrgTimezone(value, 'hh:mm a', timezone) || '—' : '—';
    const moveMonth = (step) => {
        const [year, number] = month.split('-').map(Number);
        const date = new Date(year, number - 1 + step, 1, 12);
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2050) setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    return (
        <div className="daily-report-page">
            <header className="daily-report__header">
                <div><span className="daily-report__eyebrow">MY WORKSPACE</span><h1>Daily Report</h1><p>Your complete attendance, leave and regularization log.</p></div>
                <Link className="daily-report__back" to="/dashboard-employee">Back to dashboard</Link>
            </header>
            <div className="daily-report__toolbar">
                <div className="daily-report__month">
                    <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" disabled={month === '2020-01'}><FiChevronLeft /></button>
                    <label><FiCalendar aria-hidden="true" /><span className="sr-only">Report month</span><input type="month" min="2020-01" max="2050-12" value={month} onChange={(e) => { if (/^(20[2-4]\d|2050)-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label>
                    <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" disabled={month === '2050-12'}><FiChevronRight /></button>
                </div>
                <div className="daily-report__tools">
                    <label><span className="sr-only">Filter logs</span><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All days</option><option value="punched">With punch</option><option value="no-punch">Without punch</option><option value="leave">Leave &amp; LOP</option><option value="regularization">Regularization</option></select></label>
                    <button type="button" className="daily-report__refresh" disabled={loading} onClick={() => setRetry((value) => value + 1)}><FiRefreshCw aria-hidden="true" /> Refresh</button>
                </div>
            </div>
            {loading ? <div className="daily-report__message" role="status">Loading daily report…</div> : error ? <div className="daily-report__message"><p role="alert">{error}</p><button type="button" onClick={() => setRetry((v) => v + 1)}>Retry</button></div> : <>
                {warnings.length > 0 ? <div className="daily-report__warning" role="status">{warnings.join('; ')} unavailable. The remaining logs are shown. <button type="button" onClick={() => setRetry((v) => v + 1)}>Retry missing records</button></div> : null}
                <div className="daily-report__stats">{counts.map((item) => <div key={item.label} className="daily-report__stat"><span className={`daily-report__stat-icon daily-report__stat-icon--${item.tone}`}>{item.icon}</span><div><p>{item.label}</p><strong>{item.value}</strong></div></div>)}</div>
                <section className="daily-report__card" aria-label="Daily attendance logs">
                    <div className="daily-report__card-heading"><div><h2>{formatAttendanceDateKey(`${month}-01`, 'MMMM yyyy', timezone)}</h2><p>{rows.length} calendar days · Times in {timezone || 'organization timezone'}</p></div><span>{filtered.length} day{filtered.length !== 1 ? 's' : ''} shown</span></div>
                    <div className="daily-report__table-wrap"><table className="daily-report__table"><thead><tr><th scope="col">Day</th><th scope="col">Attendance</th><th scope="col">Punch in / out</th><th scope="col">Working hours</th><th scope="col">Breaks</th><th scope="col">Leave &amp; regularization</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>
                        {!filtered.length ? <tr><td colSpan={7} className="daily-report__empty">No days match this filter.</td></tr> : filtered.map((row) => <Fragment key={row.day}>
                            <tr className={[expanded === row.day && 'is-expanded', !row.sessions.length && 'is-empty-day', !row.leaves.length && !row.requests.length && 'has-no-requests'].filter(Boolean).join(' ')}>
                                <td data-label="Day"><strong>{formatAttendanceDateKey(row.day, 'dd MMM', timezone)}</strong><small>{formatAttendanceDateKey(row.day, 'EEEE', timezone)}</small></td>
                                <td data-label="Attendance"><span className={`daily-report__badge daily-report__badge--${row.tone}`}>{row.status}</span>{row.late || row.early ? <small>{[row.late && 'Late arrival', row.early && 'Early departure'].filter(Boolean).join(' · ')}</small> : null}{row.holidays.map((h) => <small key={h._id || h.name}>{h.name}{h.workModeOverride ? ` · Working (${h.workModeOverride})` : h.isHalfDay ? ' · Half-day holiday' : ''}</small>)}</td>
                                <td data-label="Punch in / out"><span className="daily-report__punch">{time(row.checkIn)} <span>→</span> {time(row.checkOut)}</span>{row.checkOut != null && formatInOrgTimezone(row.checkOut, 'yyyy-MM-dd', timezone) > row.day ? <small>Out on {formatInOrgTimezone(row.checkOut, 'dd MMM', timezone)}</small> : null}<small>{row.locations.map((location) => location === 'work_from_home' ? 'Home' : formatStatusLabel(location)).join(' / ') || '—'}</small></td>
                                <td data-label="Working hours"><strong>{row.active ? 'In progress' : row.netHours != null ? `${row.netHours.toFixed(2)} hrs` : '—'}</strong><small>{row.hasPunch ? 'Effective hours' : 'No punch recorded'}</small></td>
                                <td data-label="Breaks"><span className="daily-report__break"><FiCoffee aria-hidden="true" />{row.breaks.length ? durationLabel(row.breakSeconds) : '—'}</span><small>{row.breaks.length ? `${row.breaks.length} break${row.breaks.length === 1 ? '' : 's'}` : 'No breaks'}{row.breaks.some((b) => b.ongoing) ? ' · Ongoing' : ''}</small></td>
                                <td data-label="Leave & regularization"><div className="daily-report__records">{row.leaves.map((leave, i) => <span key={leave._id || `leave-${i}`} className={`daily-report__badge daily-report__badge--${leave.leaveType === 'loss_of_pay' ? 'orange' : 'purple'}`}>{row.leaveLabel(leave)} · {formatStatusLabel(leave.status)}</span>)}{row.requests.map((request, i) => <span key={request._id || `reg-${i}`} className="daily-report__badge daily-report__badge--blue">{requestLabel(request)}</span>)}{!row.leaves.length && !row.requests.length ? <span className="daily-report__muted">—</span> : null}</div></td>
                                <td><button type="button" className="daily-report__details-button" aria-label={`Details for ${row.day}`} aria-expanded={expanded === row.day} aria-controls={`report-${row.day}`} onClick={() => setExpanded(expanded === row.day ? null : row.day)}><FiChevronDown aria-hidden="true" /></button></td>
                            </tr>
                            {expanded === row.day ? <tr className="daily-report__details" id={`report-${row.day}`}><td colSpan={7}><div className="daily-report__detail-grid">
                                <div><h3>Punch &amp; break log</h3>{!row.sessions.length ? <p>No punch events recorded.</p> : row.sessions.map((session, i) => <div className="daily-report__event" key={session._id || i}><p><strong>Punch in</strong> {time(session.clockIn)} <span>→</span> <strong>Punch out</strong> {time(session.clockOut)}</p>{session.shiftName ? <p>Shift: {session.shiftName}</p> : null}{(session.breaks || []).map((b, j) => <p key={j}><FiCoffee aria-hidden="true" /> {b.breakType === 'LUNCH' ? 'Lunch' : formatStatusLabel(b.breakType || 'Break')} · {time(b.breakIn)} → {b.breakOut ? time(b.breakOut) : session.clockOut ? 'End not recorded' : 'Ongoing'}</p>)}</div>)}</div>
                                <div><h3>Leave &amp; regularization history</h3>{!row.leaves.length && !row.requests.length ? <p>No requests for this day.</p> : null}{row.leaves.map((leave, i) => <div className="daily-report__event" key={leave._id || i}><strong>{row.leaveLabel(leave)} · {formatStatusLabel(leave.status)}</strong><p>{leave.reason || 'No reason provided.'}</p>{leave.rejectionReason ? <p>Response: {leave.rejectionReason}</p> : null}</div>)}{row.requests.map((request, i) => <div className="daily-report__event" key={request._id || i}><strong>{requestLabel(request)} · {formatStatusLabel(request.regularizationType)}</strong><p>{request.reason || 'No reason provided.'}</p>{request.requestedClockIn || request.requestedClockOut ? <p>Requested times: {time(request.requestedClockIn)} → {time(request.requestedClockOut)}</p> : null}{request.managerResponse ? <p>Response: {request.managerResponse}</p> : null}</div>)}</div>
                            </div></td></tr> : null}
                        </Fragment>)}
                    </tbody></table></div>
                    <footer className="daily-report__footer"><p>LOP is shown from approved loss-of-pay leave records. A missing punch does not determine payroll deductions.</p><span>Updated {time(sources.now)}</span></footer>
                </section>
            </>}
        </div>
    );
}

export default DailyReport;
