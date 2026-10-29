import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from '../utils/constant';
import { formatAttendanceDateKey, formatInOrgTimezone, resolveAttendanceDateKeyFromRow } from '../utils/orgTimezone';
import { formatAttendanceStatusLabel } from '../utils/textFormat';

function DailyReport() {
    const [report, setReport] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const timezone = useSelector((state) => state.timezone?.timezone);

    useEffect(() => {
        let cancelled = false;
        const fetchDailyReport = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, { withCredentials: true });
                const { sessions, dailyStats } = response.data || {};
                if (!Array.isArray(sessions) || !dailyStats || typeof dailyStats !== 'object' || Array.isArray(dailyStats)) {
                    throw new Error('Failed to fetch daily report');
                }

                const rows = Object.entries(dailyStats).map(([date, stats]) => {
                    const daySessions = sessions.filter((session) => resolveAttendanceDateKeyFromRow(session, timezone) === date);
                    const clockIns = daySessions.map((session) => session.clockIn && new Date(session.clockIn).getTime()).filter(Number.isFinite);
                    const clockOuts = daySessions.map((session) => session.clockOut && new Date(session.clockOut).getTime()).filter(Number.isFinite);
                    const inProgress = daySessions.some((session) => session.clockIn && !session.clockOut);
                    return {
                        date,
                        checkInTime: clockIns.length ? Math.min(...clockIns) : null,
                        checkOutTime: !inProgress && clockOuts.length ? Math.max(...clockOuts) : null,
                        effectiveHours: Number.isFinite(stats.effectiveHours) ? stats.effectiveHours : 0,
                        status: inProgress ? 'In progress' : formatAttendanceStatusLabel(stats.status),
                    };
                }).sort((a, b) => b.date.localeCompare(a.date));
                if (!cancelled) setReport(rows);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to fetch daily report');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDailyReport();
        return () => { cancelled = true; };
    }, [retry, timezone]);

    if (loading) return <p className="p-5">Loading daily report...</p>;
    if (error) return (
        <div className="p-5">
            <p role="alert" className="text-red-500">{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-white">Retry</button>
        </div>
    );

    return (
        <div className="p-5">
            <h2 className="text-xl font-bold mb-4">Daily Report</h2>
            <p className="mb-4 text-sm text-slate-500">Your daily attendance for the current month.</p>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Date</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Check-In Time</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Check-Out Time</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Total Working Hours</th>
                            <th className="border border-gray-300 bg-gray-100 p-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.length === 0 ? <tr><td colSpan={5} className="border border-gray-300 p-4 text-center text-slate-500">No attendance records for this month.</td></tr> : null}
                        {report.map((entry) => (
                                <tr key={entry.date}>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {formatAttendanceDateKey(entry.date, 'dd MMM yyyy', timezone)}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {entry.checkInTime != null ? formatInOrgTimezone(entry.checkInTime, 'hh:mm a', timezone) : '—'}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {entry.checkOutTime != null ? formatInOrgTimezone(entry.checkOutTime, 'hh:mm a', timezone) : '—'}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {entry.effectiveHours.toFixed(2)} hrs
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        {entry.status}
                                    </td>
                                </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DailyReport;