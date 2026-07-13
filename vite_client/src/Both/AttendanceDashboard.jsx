import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from '../utils/constant';

const AttendanceDashboard = () => {
    const [attendanceStats, setAttendanceStats] = useState({
        avgHoursPerDay: 0,
        onTimePercentage: 0
    });
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        fetchAttendanceData();
        return () => clearInterval(timer);
    }, []);

    const fetchAttendanceData = async () => {
        try {
            const logsRes = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`);
            // Backend returns { sessions, dailyStats, summary, period }
            const logs = logsRes.data?.sessions || [];
            setAttendanceLogs(logs);

            if (logs.length > 0) {
                const completedLogs = logs.filter(log => log.clockIn && log.clockOut);
                const totalHours = completedLogs.reduce((sum, log) => {
                    return sum + ((new Date(log.clockOut) - new Date(log.clockIn)) / (1000 * 60 * 60));
                }, 0);
                const avgHours = completedLogs.length > 0 ? totalHours / completedLogs.length : 0;
                const onTimeCount = logs.filter(log => !log.isLateArrival).length;
                const onTimePercentage = logs.length > 0 ? (onTimeCount / logs.length) * 100 : 0;

                setAttendanceStats({ avgHoursPerDay: avgHours, onTimePercentage });
            } else {
                setAttendanceStats({ avgHoursPerDay: 0, onTimePercentage: 0 });
            }
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
        }
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const handleClockOut = async () => {
        try {
            // Find today's open session using attendanceDateKey or date
            const todayStr = new Date().toISOString().slice(0, 10);
            const todayLog = attendanceLogs.find(log => {
                const key = log.attendanceDateKey || new Date(log.date).toISOString().slice(0, 10);
                return key === todayStr && !log.clockOut;
            });
            if (todayLog) {
                await axios.post(`${BOTH_ATTENDANCE_ENDPOINT}/clock-out`, {});
                fetchAttendanceData();
            }
        } catch (error) {
            // Removed console.error for production
        }
    };

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Loading...</div>;
    }

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-gray-900 min-h-screen text-white">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
                <h1 className="text-xl sm:text-2xl font-bold">Attendance Dashboard</h1>
                <div className="text-right">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold">{formatTime(currentTime)}</div>
                    <div className="text-xs sm:text-sm text-gray-400 mt-2">{formatDate(currentTime)}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
                <div className="lg:col-span-2 bg-gray-800 rounded-xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-semibold mb-4">Attendance Stats</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                        <div>
                            <label className="text-sm text-gray-400 block mb-2">AVG HRS / DAY</label>
                            <div className="text-xl font-bold">{formatDuration(attendanceStats.avgHoursPerDay)}</div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 block mb-2">ON TIME ARRIVAL</label>
                            <div className="text-xl font-bold">{Math.round(attendanceStats.onTimePercentage)}%</div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 sm:p-6 flex flex-col justify-center items-center gap-4">
                    <button 
                        className="bg-red-400 hover:bg-red-500 text-white py-2 sm:py-3 px-6 sm:px-8 rounded-lg transition-colors duration-200 text-sm sm:text-base w-full sm:w-auto"
                        onClick={handleClockOut}
                    >
                        Web Clock-out
                    </button>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                        <span className="text-theme-secondary text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 before:content-[''] before:inline-block before:w-2 before:h-2 before:rounded-full before:bg-theme-secondary">
                            Work From Home
                        </span>
                        <span className="text-theme-secondary text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 before:content-[''] before:inline-block before:w-2 before:h-2 before:rounded-full before:bg-theme-secondary">
                            On Duty
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">Attendance Log</h2>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8 mt-4">
                    <button className="bg-theme-secondary text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm">30 DAYS</button>
                    <button className="text-gray-400 hover:text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm">FEB</button>
                    <button className="text-gray-400 hover:text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm">JAN</button>
                    <button className="text-gray-400 hover:text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm">DEC</button>
                    <button className="text-gray-400 hover:text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm">NOV</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-full">
                        <thead>
                            <tr>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">DATE</th>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">ATTENDANCE VISUAL</th>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">EFFECTIVE HOURS</th>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">GROSS HOURS</th>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">ARRIVAL</th>
                                <th className="text-left p-3 sm:p-4 text-gray-400 font-normal border-b border-gray-700 text-xs sm:text-sm">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceLogs.map(log => (
                                <tr key={log._id}>
                                    <td className="p-3 sm:p-4 border-b border-gray-700 text-xs sm:text-sm">{formatDate(new Date(log.date))}</td>
                                    <td className="p-3 sm:p-4 border-b border-gray-700">
                                        <div className="bg-gray-700 h-2 rounded relative w-full">
                                            <div 
                                                className="absolute h-full bg-theme-secondary rounded"
                                                style={{
                                                    left: '30%',
                                                    width: '40%'
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-3 sm:p-4 border-b border-gray-700 text-xs sm:text-sm">{formatDuration(log.effectiveHours)}</td>
                                    <td className="p-3 sm:p-4 border-b border-gray-700 text-xs sm:text-sm">{formatDuration(log.grossHours)}</td>
                                    <td className={`p-3 sm:p-4 border-b border-gray-700 text-xs sm:text-sm ${log.isOnTime ? 'text-green-400' : 'text-red-400'}`}>
                                        {log.isOnTime ? 'On Time' : 'Late'}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b border-gray-700">
                                        <span className={`inline-block w-2 h-2 rounded-full ${
                                            log.status === 'present' ? 'bg-green-400' : 
                                            log.status === 'absent' ? 'bg-red-400' : 
                                            'bg-yellow-400'
                                        }`} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendanceDashboard;