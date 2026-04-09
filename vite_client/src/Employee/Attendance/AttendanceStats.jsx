import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchLogs } from '../../context/attendanceSlice';
import { FiCalendar, FiClock, FiTrendingUp, FiHome, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from '../../utils/axios';

const AttendanceStats = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { summary, sessions, loading, error, period } = useSelector((state) => state.attendance);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [rangePreset, setRangePreset] = useState('month'); // week | month | year | custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 10;
  const [regSummary, setRegSummary] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toDateInput = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const computePresetRange = (preset) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (preset === 'week') {
      const day = now.getDay(); // 0 Sun ... 6 Sat
      const diffToMonday = (day + 6) % 7; // Monday as first day
      start.setDate(now.getDate() - diffToMonday);
      end.setDate(start.getDate() + 6);
    } else if (preset === 'year') {
      start.setMonth(0, 1);
      end.setMonth(11, 31);
    } else {
      // month (default)
      start.setDate(1);
      end.setMonth(now.getMonth() + 1, 0);
    }
    return { startDate: toDateInput(start), endDate: toDateInput(end) };
  };

  useEffect(() => {
    // Default: current month
    const { startDate, endDate } = computePresetRange(rangePreset);
    if (rangePreset !== 'custom') {
      dispatch(fetchLogs({ startDate, endDate }));
      setTablePage(1);
    }
  }, [dispatch, rangePreset]);

  useEffect(() => {
    if (rangePreset !== 'custom') return;
    if (!customStart || !customEnd) return;
    dispatch(fetchLogs({ startDate: customStart, endDate: customEnd }));
    setTablePage(1);
  }, [dispatch, rangePreset, customStart, customEnd]);

  useEffect(() => {
    // Regularization summary for employee (counts by status)
    const load = async () => {
      try {
        const [pending, approved, rejected] = await Promise.all([
          axios.get('/v1/both/attendance-regularization/request', { params: { status: 'pending' }, withCredentials: true }),
          axios.get('/v1/both/attendance-regularization/request', { params: { status: 'approved' }, withCredentials: true }),
          axios.get('/v1/both/attendance-regularization/request', { params: { status: 'rejected' }, withCredentials: true }),
        ]);
        const getCount = (resp) => Array.isArray(resp?.data?.data) ? resp.data.data.length : (resp?.data?.pagination?.total ?? 0);
        setRegSummary({
          pending: getCount(pending),
          approved: getCount(approved),
          rejected: getCount(rejected)
        });
      } catch {
        // ignore (page should still render without this)
      }
    };
    load();
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

  const periodLabel = (() => {
    const start = period?.startDate || summary?.periodStart;
    const end = period?.endDate || summary?.periodEnd;
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
    return `${s.toLocaleDateString()} - ${e.toLocaleDateString()}`;
  })();

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

  const calcBreakMinutes = (session) => {
    const breaks = session?.breaks || [];
    let ms = 0;
    breaks.forEach((b) => {
      if (b?.breakIn && b?.breakOut) {
        ms += (new Date(b.breakOut) - new Date(b.breakIn));
      }
    });
    return Math.max(0, Math.round(ms / 60000));
  };

  const exportCsv = () => {
    const rows = (sessions || []).map((s) => ({
      date: s?.date ? new Date(s.date).toISOString().slice(0, 10) : '',
      clockIn: s?.clockIn || '',
      clockOut: s?.clockOut || '',
      effectiveHours: s?.effectiveHours ?? '',
      overtimeHours: s?.overtimeHours ?? '',
      status: s?.status ?? '',
      workLocation: s?.workLocation ?? '',
      breakMinutes: calcBreakMinutes(s),
      autoCheckedOut: s?.autoCheckedOut ? 'yes' : 'no',
      clockInAddress: s?.clockInLocation?.address ?? '',
      clockOutAddress: s?.clockOutLocation?.address ?? '',
    }));
    const header = Object.keys(rows[0] || { date: '' });
    const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [header.join(','), ...rows.map(r => header.map(k => escape(r[k])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${toDateInput(period?.startDate || summary?.periodStart)}_${toDateInput(period?.endDate || summary?.periodEnd)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil((sessions?.length || 0) / pageSize));
  const pagedSessions = sessions.slice((tablePage - 1) * pageSize, tablePage * pageSize);

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
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Go back to dashboard"
          >
            <FiArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Attendance Statistics</h1>
            {periodLabel && <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>}
          </div>
        </div>

        {/* Period Filters */}
        <div className="bg-white rounded-lg shadow p-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setRangePreset(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    rangePreset === p.id
                      ? 'bg-theme-secondary text-white border-theme-secondary'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-end">
              {rangePreset === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  />
                </>
              )}
              <button
                onClick={exportCsv}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition"
                title="Export current period to CSV"
              >
                Export CSV
              </button>
              <button
                onClick={() => navigate('/my-attendance-regularization')}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-theme-secondary text-white hover:opacity-90 transition"
                title="Raise or track regularization requests"
              >
                Regularization ({regSummary.pending} pending)
              </button>
            </div>
          </div>
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
            <div className="bg-green-100 p-2 rounded-full mr-3">
              <FiCalendar className="text-green-600 text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Working / Present / Absent</p>
              <p className="text-lg sm:text-xl font-bold text-gray-800">
                {summary.workingDays ?? '--'} / {summary.presentDays ?? summary.totalDays ?? '--'} / {summary.absentDays ?? '--'}
              </p>
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
                {summary.issueDays ?? (summary.totalLateArrivals + summary.totalEarlyDepartures)}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Avg Effective Hours / Day</p>
            <p className="text-lg sm:text-xl font-bold text-gray-800">{Number(summary.avgEffectiveHours || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Compliance Rate</p>
            <p className="text-lg sm:text-xl font-bold text-gray-800">{Math.round((Number(summary.complianceRate || 0)) * 100)}%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Regularization</p>
            <p className="text-sm text-gray-700 mt-1">Pending: <span className="font-semibold">{regSummary.pending}</span></p>
            <p className="text-sm text-gray-700">Rejected: <span className="font-semibold">{regSummary.rejected}</span></p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Work Location Split</p>
            <p className="text-sm text-gray-700 mt-1">Office: <span className="font-semibold">{workLocationCounts.office}</span></p>
            <p className="text-sm text-gray-700">WFH: <span className="font-semibold">{workLocationCounts.wfh}</span></p>
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
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">Sessions</h2>
            <div className="text-xs text-gray-500">
              Page {tablePage} / {totalPages}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagedSessions.map((session, index) => (
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
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {calcBreakMinutes(session)}m
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {session.autoCheckedOut ? 'Yes' : 'No'}
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
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
              disabled={tablePage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStats;