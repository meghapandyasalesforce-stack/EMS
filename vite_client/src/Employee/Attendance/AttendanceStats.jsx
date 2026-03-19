import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchLogs } from '../../context/attendanceSlice';
import { FiCalendar, FiClock, FiTrendingUp, FiHome, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AttendanceStats = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { summary, sessions, loading, error } = useSelector((state) => state.attendance);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Group sessions by date for dailyStats
  const groupedStats = useMemo(() => {
    const result = {};
    if (sessions && sessions.length > 0) {
      sessions.forEach((session) => {
        const dateKey = new Date(session.date).toISOString().split('T')[0];
        if (!result[dateKey]) {
          result[dateKey] = { sessions: [] };
        }
        result[dateKey].sessions.push(session);
      });
    }
    return result;
  }, [sessions]);

  useEffect(() => {
    dispatch(fetchLogs());
  }, [dispatch]);

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading attendance data...</div>;
  }

  if (error) {
    // Extract error message whether it's a string or object
    const errorMessage = typeof error === 'string' ? error : error.message || JSON.stringify(error);
    return (
      <div className="text-center py-10 text-red-500">
        <p className="font-semibold mb-2">Error loading attendance data</p>
        <p className="text-sm">{errorMessage}</p>
      </div>
    );
  }

  if (!summary || !sessions || sessions.length === 0) {
    return <div className="text-center py-10 text-gray-500">No attendance data available.</div>;
  }

  // Calculate work location distribution
  const workLocationCounts = sessions.reduce(
    (acc, session) => {
      if (session.workLocation === 'work_from_home') acc.wfh += 1;
      else acc.office += 1;
      return acc;
    },
    { wfh: 0, office: 0 }
  );

  // Prepare data for the bar chart (Recharts format)
  const chartData = [
    {
      name: 'Effective Hours',
      value: summary.totalEffectiveHours,
      label: 'Hours'
    },
    {
      name: 'Overtime',
      value: summary.totalOvertime,
      label: 'Hours'
    },
    {
      name: 'Late Arrivals',
      value: summary.totalLateArrivals,
      label: 'Count'
    },
    {
      name: 'Early Departures',
      value: summary.totalEarlyDepartures,
      label: 'Count'
    }
  ];

  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-100 pt-16 lg:pt-0 transition-all duration-300">
      <div className="mx-auto p-4 max-w-screen-2xl">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Go back to dashboard"
          >
            <FiArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Attendance Statistics</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="bg-theme-secondary/10 p-2 rounded-full mr-3">
              <FiCalendar className="text-theme-secondary text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Days</p>
              <p className="text-lg sm:text-xl font-bold text-gray-800">{summary.totalDays}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="bg-theme-primary/10 p-2 rounded-full mr-3">
              <FiClock className="text-theme-primary text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Effective Hours</p>
              <p className="text-lg sm:text-xl font-bold text-gray-800">{summary.totalEffectiveHours.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="bg-purple-100 p-2 rounded-full mr-3">
              <FiTrendingUp className="text-purple-600 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Overtime</p>
              <p className="text-lg sm:text-xl font-bold text-gray-800">{summary.totalOvertime.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="bg-red-100 p-2 rounded-full mr-3">
              <FiAlertTriangle className="text-red-600 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Attendance Issues</p>
              <p className="text-lg sm:text-xl font-bold text-gray-800">
                {summary.totalLateArrivals + summary.totalEarlyDepartures}
              </p>
            </div>
          </div>
        </div>

        {/* Work Location Stats */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Work Location Distribution</h2>
          <div className="flex justify-between">
            <div className="text-center">
              <div className="text-xl font-bold text-theme-secondary">{workLocationCounts.office}</div>
              <div className="text-xs text-gray-500">Office</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{workLocationCounts.wfh}</div>
              <div className="text-xs text-gray-500">Work From Home</div>
            </div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Attendance Overview</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => {
                    const item = chartData.find(d => d.value === value);
                    if (item && item.label === 'Hours') {
                      return `${value.toFixed(2)} hours`;
                    }
                    return value;
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Sessions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.slice(0, 10).map((session, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {formatDate(session.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {formatTime(session.clockIn)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {session.clockOut ? formatTime(session.clockOut) : '--:--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {session.effectiveHours > 0 ? `${session.effectiveHours.toFixed(2)}` : '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {session.status === 'present' ? (
                        session.isLateArrival || session.isEarlyDeparture ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Partial
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-theme-primary/10 text-theme-primary">
                            Present
                          </span>
                        )
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          {session.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      <div className="flex items-center">
                        <FiHome className="mr-1" />
                        {session.workLocation === 'work_from_home' ? 'WFH' : 'Office'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStats;