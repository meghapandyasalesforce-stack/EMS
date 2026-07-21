import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { getAuthEmployeeId } from '../../utils/authUser';
import { fetchLogs, hydrateLogsFromMonthCache } from '../../context/attendanceSlice';
import { getEmployeeLeaves } from '../../context/employeeLeaveSlice';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { getLeaveTypeDisplayName, getLeaveWidgetStats, getLeaveTypeCards } from '../../constants/leaveConstants';
import WfhRequestPanel from '../Wfh/WfhRequestPanel';

const toDateInput = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const startOfMonthDate = (d) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
};

const endOfMonthDate = (d) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth() + 1, 0);
};

const formatTime = (value) => {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(' ', '');
};

const toTimeInput = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const getRegularizationTypeForRow = (row) => {
  if (!row?.clockIn && !row?.clockOut) return 'both';
  if (!row?.clockIn) return 'missing_clock_in';
  if (!row?.clockOut) return 'missing_clock_out';
  return 'incorrect_time';
};

const LOGS_PER_PAGE = 10;

const monthCacheKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};

const formatHours = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '--';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const formatBreakTime = (row) => {
  if (!row || !Array.isArray(row.breaks) || row.breaks.length === 0) return '--';
  const nowMs = Date.now();
  const totalMs = row.breaks.reduce((sum, b) => {
    if (!b?.breakIn) return sum;
    const breakIn = new Date(b.breakIn).getTime();
    if (!Number.isFinite(breakIn)) return sum;
    const breakOut = b.breakOut ? new Date(b.breakOut).getTime() : nowMs;
    if (!Number.isFinite(breakOut) || breakOut <= breakIn) return sum;
    return sum + (breakOut - breakIn);
  }, 0);
  if (totalMs <= 0) return '--';
  const totalMinutes = Math.round(totalMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const statusPill = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('present')) return 'bg-[#DCFCE7] text-[#15803D]';
  if (s.includes('late')) return 'bg-[#FEF3C7] text-[#92400E]';
  if (s.includes('absent')) return 'bg-[#FEE2E2] text-[#B91C1C]';
  if (s.includes('weekend') || s.includes('holiday')) return 'bg-[#E5E7EB] text-[#374151]';
  return 'bg-[#E5E7EB] text-[#374151]';
};

const leaveStatusPill = (displayStatus) => {
  const s = String(displayStatus || '').toLowerCase();
  if (s.includes('approved')) return 'bg-[#DCFCE7] text-[#166534]';
  if (s.includes('rejected')) return 'bg-[#FEE2E2] text-[#B91C1C]';
  if (s.includes('manager')) return 'bg-[#FEF3C7] text-[#92400E]';
  if (s.includes('hr')) return 'bg-[#DBEAFE] text-[#1D4ED8]';
  if (s.includes('pending')) return 'bg-[#FEF3C7] text-[#92400E]';
  return 'bg-[#E5E7EB] text-[#374151]';
};

const getLeaveDisplayStatus = (leave) => {
  const status = String(leave?.status || 'pending').toLowerCase();
  if (status === 'pending' && leave?.approvalStage) return leave.approvalStage;
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'cancelled') return 'Cancelled';
  return leave?.approvalStage || 'Pending';
};

const heatmapCellClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'present') return 'bg-[#DDF7F1] text-[#0F766E]';
  if (s === 'late') return 'bg-[#FFF3D6] text-[#92400E]';
  if (s === 'absent') return 'bg-[#FDECEC] text-[#B91C1C]';
  return 'bg-[#F3F4F6] text-[#9CA3AF]';
};

const buildMonthMatrix = (cursor, sessionsByDate) => {
  const first = startOfMonthDate(cursor);
  const last = endOfMonthDate(cursor);
  const startWeekday = (first.getDay() + 6) % 7; // monday-first
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ key: `pad-start-${i}`, day: null, status: 'empty' });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const dt = new Date(first.getFullYear(), first.getMonth(), day);
    const dateKey = toDateInput(dt);
    const session = sessionsByDate.get(dateKey);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    let status = isWeekend ? 'weekend' : 'empty';
    if (session) {
      const s = String(session.status || '').toLowerCase();
      if (s.includes('late')) status = 'late';
      else if (s.includes('absent')) status = 'absent';
      else status = 'present';
    }
    cells.push({ key: dateKey, day, status, session });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-end-${cells.length}`, day: null, status: 'empty' });
  }
  return cells;
};

const CircleMeter = ({ value, total, label, used }) => {
  const percentage = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-4">
      <p className="text-center text-xs font-semibold text-[#0F172A]">{label}</p>
      <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#20C997 ${percentage * 3.6}deg, #D1D5DB 0deg)`
        }}
      >
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-[#FFFFFF]">
          <span className="text-lg font-bold text-[#20C997]">{value}</span>
          <span className="text-[10px] text-[#64748B]">of {total}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#334155]">
        <span>{used} Used</span>
        <span>{value} Available</span>
      </div>
    </div>
  );
};

const LeaveAttendanceHub = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const attendance = useSelector((state) => state.attendance);
  const leaveState = useSelector((state) => state.employeeLeave);
  const employee = useSelector((state) => state.auth.employee || state.auth.user);
  const monthCache = attendance.monthCache || {};
  const employeeDocId = getAuthEmployeeId(employee);

  const [calendarCursor, setCalendarCursor] = useState(startOfMonthDate(new Date()));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveBalanceError, setLeaveBalanceError] = useState('');
  const [panelTab, setPanelTab] = useState('attendance-log');
  const [selectedMobileDateKey, setSelectedMobileDateKey] = useState(null);
  const [regularizationRequestsAll, setRegularizationRequestsAll] = useState([]);
  const [regularizationLimits, setRegularizationLimits] = useState(null);
  const [currentLogPage, setCurrentLogPage] = useState(1);

  const canRegularize = regularizationLimits?.canSubmit === true;

  const getRegularizationBlockMessage = () => {
    if (!regularizationLimits) {
      return 'Unable to verify regularization limits. Please try again from the regularization page.';
    }
    if (!regularizationLimits.enabled) {
      return 'Regularization is currently disabled for your organization.';
    }
    if (!regularizationLimits.unlimited && regularizationLimits.remaining === 0) {
      return `Monthly regularization limit reached (max ${regularizationLimits.allowedPerMonth} requests).`;
    }
    return 'You cannot submit a regularization request right now.';
  };

  useEffect(() => {
    const monthStart = startOfMonthDate(calendarCursor);
    const monthEnd = endOfMonthDate(calendarCursor);
    const cacheKey = monthCacheKey(calendarCursor);
    const cached = monthCache[cacheKey];

    if (cached) {
      dispatch(hydrateLogsFromMonthCache({ cacheKey }));
    }

    // Always revalidate selected month once per mount/month-change.
    // Cache gives instant paint; fetch guarantees latest attendance after approvals/updates.
    dispatch(fetchLogs({ startDate: toDateInput(monthStart), endDate: toDateInput(monthEnd), cacheKey }));
  }, [dispatch, calendarCursor]);

  useEffect(() => {
    dispatch(getEmployeeLeaves());
  }, [dispatch]);

  useEffect(() => {
    if (!employeeDocId) return;
    const fetchLeaveBalance = async () => {
      try {
        const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeDocId}`, {
          params: { year: selectedYear }
        });
        setLeaveBalance(res.data.balance);
        setLeaveBalanceError('');
      } catch (error) {
        setLeaveBalance(null);
        if (error?.response?.status === 404) {
          setLeaveBalanceError('No applicable leave policy found for your account in the selected year.');
        } else {
          setLeaveBalanceError('Unable to load leave balances right now. Please try again.');
        }
      }
    };
    fetchLeaveBalance();
  }, [employeeDocId, selectedYear]);

  useEffect(() => {
    const fetchAllRegularizationRequests = async () => {
      try {
        let page = 1;
        const combined = [];
        const maxPages = 50;

        while (page <= maxPages) {
          const res = await axios.get('/v1/both/attendance-regularization/request', {
            params: { page, limit: 100 },
            withCredentials: true
          });
          const chunk = res.data?.data || [];
          const totalPages = res.data?.pagination?.pages ?? page;
          combined.push(...chunk);
          if (page >= totalPages || chunk.length === 0) break;
          page += 1;
        }

        combined.sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
        setRegularizationRequestsAll(combined);
      } catch {
        setRegularizationRequestsAll([]);
      }
    };

    fetchAllRegularizationRequests();
  }, []);

  useEffect(() => {
    const fetchRegularizationLimits = async () => {
      try {
        const res = await axios.get('/v1/both/attendance-regularization/limits', {
          withCredentials: true
        });
        setRegularizationLimits(res.data?.data ?? null);
      } catch {
        setRegularizationLimits(null);
      }
    };

    fetchRegularizationLimits();
  }, []);

  const regularizationStatusByDate = useMemo(() => {
    const statusMap = {};
    regularizationRequestsAll.forEach((request) => {
      const dateKey = toDateInput(request?.attendanceDate);
      if (!dateKey || statusMap[dateKey]) return;
      statusMap[dateKey] = {
        status: String(request.status || '').toLowerCase(),
        requestId: request._id
      };
    });
    return statusMap;
  }, [regularizationRequestsAll]);

  const sessions = attendance.sessions || [];
  const summary = attendance.summary || {};
  const leaveRows = useMemo(() => {
    return (leaveState.myLeaves || [])
      .map((raw) => raw?.leave || raw)
      .filter(Boolean)
      .map((leave) => ({
        id: leave._id,
        type: leave.leaveType || 'unknown',
        startDate: leave.startDate ? new Date(leave.startDate) : null,
        endDate: leave.endDate ? new Date(leave.endDate) : null,
        duration: Number(leave.duration || 0),
        status: String(leave.status || 'pending').toLowerCase(),
        approvalStage: leave.approvalStage || '',
        displayStatus: getLeaveDisplayStatus(leave),
      }));
  }, [leaveState.myLeaves]);

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((session) => {
      const key = toDateInput(session?.date);
      if (key) map.set(key, session);
    });
    return map;
  }, [sessions]);

  const monthMatrix = useMemo(() => buildMonthMatrix(calendarCursor, sessionsByDate), [calendarCursor, sessionsByDate]);
  const selectedMobileCell = useMemo(
    () => monthMatrix.find((cell) => cell.day && cell.key === selectedMobileDateKey) || null,
    [monthMatrix, selectedMobileDateKey]
  );
  const sortedLogs = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
    [sessions]
  );
  const totalLogPages = Math.max(1, Math.ceil(sortedLogs.length / LOGS_PER_PAGE));
  const safeCurrentLogPage = Math.min(currentLogPage, totalLogPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentLogPage - 1) * LOGS_PER_PAGE;
    return sortedLogs.slice(start, start + LOGS_PER_PAGE);
  }, [sortedLogs, safeCurrentLogPage]);
  const logsRangeStart = sortedLogs.length === 0 ? 0 : (safeCurrentLogPage - 1) * LOGS_PER_PAGE + 1;
  const logsRangeEnd = Math.min(sortedLogs.length, safeCurrentLogPage * LOGS_PER_PAGE);

  useEffect(() => {
    const validMonthCells = monthMatrix.filter((cell) => cell.day);
    if (validMonthCells.length === 0) {
      setSelectedMobileDateKey(null);
      return;
    }

    if (selectedMobileDateKey && validMonthCells.some((cell) => cell.key === selectedMobileDateKey)) {
      return;
    }

    const todayKey = toDateInput(new Date());
    const todayCell = validMonthCells.find((cell) => cell.key === todayKey);
    const sessionCell = validMonthCells.find((cell) => cell.session);
    const fallbackCell = todayCell || sessionCell || validMonthCells[0];
    setSelectedMobileDateKey(fallbackCell?.key || null);
  }, [monthMatrix, selectedMobileDateKey]);

  useEffect(() => {
    setCurrentLogPage(1);
  }, [calendarCursor]);

  useEffect(() => {
    if (currentLogPage > totalLogPages) {
      setCurrentLogPage(totalLogPages);
    }
  }, [currentLogPage, totalLogPages]);

  const leaveTypeCards = useMemo(() => getLeaveTypeCards(leaveBalance), [leaveBalance]);
  const leaveStats = useMemo(() => getLeaveWidgetStats(leaveBalance), [leaveBalance]);

  const regTypeLabel = (type) =>
    ({
      missing_clock_in: 'Missing Clock In',
      missing_clock_out: 'Missing Clock Out',
      both: 'Both Missing',
      incorrect_time: 'Incorrect Time',
      full_day: 'Full Day'
    })[type] || type;

  const regularizationHistoryRows = useMemo(() => {
    const cy = calendarCursor.getFullYear();
    const cm = calendarCursor.getMonth();
    return regularizationRequestsAll
      .filter((r) => {
        const dt = new Date(r?.attendanceDate);
        return !Number.isNaN(dt.getTime()) && dt.getFullYear() === cy && dt.getMonth() === cm;
      })
      .sort((a, b) => new Date(b.attendanceDate || 0) - new Date(a.attendanceDate || 0));
  }, [regularizationRequestsAll, calendarCursor]);

  const presentCount = Number(summary.presentDays || 0);
  const totalWorking = Number(summary.workingDays || 0);
  const absentCount = Math.max(0, totalWorking - presentCount);
  const lateCount = sessions.reduce((acc, session) => {
    const s = String(session?.status || '').toLowerCase();
    return acc + (session?.isLateArrival || s.includes('late') ? 1 : 0);
  }, 0);
  const regularizedCount = useMemo(() => {
    const cy = calendarCursor.getFullYear();
    const cm = calendarCursor.getMonth();
    return regularizationRequestsAll.reduce((acc, r) => {
      if (String(r.status || '').toLowerCase() !== 'approved') return acc;
      const dt = new Date(r?.attendanceDate);
      if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === cy && dt.getMonth() === cm) return acc + 1;
      return acc;
    }, 0);
  }, [regularizationRequestsAll, calendarCursor]);

  const navigateToRegularizationWithRow = (row) => {
    if (!canRegularize) {
      toast.warning(getRegularizationBlockMessage());
      return;
    }

    navigate('/my-attendance-regularization', {
      state: {
        prefillRegularization: {
          attendanceDate: toDateInput(row?.date),
          regularizationType: getRegularizationTypeForRow(row),
          requestedClockIn: toTimeInput(row?.clockIn),
          requestedClockOut: toTimeInput(row?.clockOut),
          reason: ''
        }
      }
    });
  };

  const renderRegularizationAction = (row, compact = false) => {
    const attendanceIssue =
      String(row?.status || '').toLowerCase().includes('late') ||
      String(row?.status || '').toLowerCase().includes('absent') ||
      !row?.clockIn ||
      !row?.clockOut;

    if (!attendanceIssue) {
      return <span className={`text-xs ${compact ? 'text-[#94A3B8]' : 'text-[#94A3B8]'}`}>{compact ? 'No action needed' : '--'}</span>;
    }

    const dateKey = toDateInput(row?.date);
    const requestMeta = regularizationStatusByDate[dateKey];
    const requestStatus = requestMeta?.status;

    if (!requestStatus || requestStatus === 'cancelled') {
      if (!canRegularize) {
        return (
          <span
            className={`text-xs ${compact ? 'text-[#94A3B8]' : 'text-[#94A3B8]'}`}
            title={getRegularizationBlockMessage()}
          >
            {compact ? 'Unavailable' : 'Regularization unavailable'}
          </span>
        );
      }

      return (
        <button
          onClick={() => navigateToRegularizationWithRow(row)}
          className="text-xs font-semibold text-[#0F766E] hover:text-[#10B981]"
        >
          Regularize
        </button>
      );
    }

    const badgeClassByStatus = {
      pending: 'bg-[#FEF3C7] text-[#92400E]',
      approved: 'bg-[#DCFCE7] text-[#166534]',
      rejected: 'bg-[#FEE2E2] text-[#B91C1C]'
    };
    const badgeClass = badgeClassByStatus[requestStatus] || 'bg-[#E5E7EB] text-[#374151]';

    return (
      <div className={`flex ${compact ? 'items-center justify-between' : 'items-center gap-2'}`}>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
          {requestStatus}
        </span>
        {requestStatus === 'rejected' && (
          <button
            onClick={() => navigateToRegularizationWithRow(row)}
            className="text-xs font-semibold text-[#0F766E] hover:text-[#10B981]"
          >
            Re-apply
          </button>
        )}
      </div>
    );
  };

  if (attendance.loading && !attendance.summary && !sessions.length) {
    return <div className="py-10 text-center text-gray-500">Loading leave and attendance data...</div>;
  }
  if (attendance.error) {
    const errorMessage =
      typeof attendance.error === 'string' ? attendance.error : attendance.error.message || 'Error loading attendance';
    return <div className="py-10 text-center text-red-500">{errorMessage}</div>;
  }

  return (
    <div className="page-shell min-h-screen bg-[#f4f6fb]">
      <div className="page-shell-inner hrms-stack">
        <div>
          <p className="text-xs text-slate-500">
            {calendarCursor.toLocaleString('default', { month: 'long' })} {calendarCursor.getFullYear()} - {employee?.name || 'Employee'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="hrms-mobile-full min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 text-[#0F172A] shadow-sm">
            <p className="text-xs text-[#64748B]">Days present</p>
            <p className="mt-2 text-3xl font-bold text-[#20C997]">{presentCount}</p>
          </div>
          <div className="hrms-mobile-full min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 text-[#0F172A] shadow-sm">
            <p className="text-xs text-[#64748B]">Days absent</p>
            <p className="mt-2 text-3xl font-bold text-[#EF4444]">{absentCount}</p>
          </div>
          <div className="hrms-mobile-full min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 text-[#0F172A] shadow-sm">
            <p className="text-xs text-[#64748B]">Late check-ins</p>
            <p className="mt-2 text-3xl font-bold text-[#F59E0B]">{lateCount}</p>
          </div>
          <div className="hrms-mobile-full min-w-0 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 text-[#0F172A] shadow-sm">
            <p className="text-xs text-[#64748B]">Regularized</p>
            <p className="mt-2 text-3xl font-bold text-[#34D399]">{regularizedCount}</p>
          </div>
        </div>

        <section className="hrms-mobile-full min-w-0 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 shadow-sm md:p-4">
          <div className="hrms-tabs-scroll mb-4">
            {[
              { id: 'attendance-log', label: 'Attendance log' },
              { id: 'leave-summary', label: 'Leave summary' },
              { id: 'regularization-history', label: 'Regularization history' },
              { id: 'wfh-request', label: 'Work From Home' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPanelTab(tab.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  panelTab === tab.id
                    ? 'border-[#20C997] bg-[#ECFDF5] text-[#0F766E]'
                    : 'border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {panelTab === 'attendance-log' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">
                    Monthly heatmap - {calendarCursor.toLocaleString('default', { month: 'long' })} {calendarCursor.getFullYear()}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded p-1.5 text-[#475569] hover:bg-[#E2E8F0]"
                    >
                      <FiChevronLeft />
                    </button>
                    <button
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded p-1.5 text-[#475569] hover:bg-[#E2E8F0]"
                    >
                      <FiChevronRight />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[#64748B] sm:gap-2 sm:text-[11px]">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                  {monthMatrix.map((cell) => {
                    const session = cell.session;
                    const isLate = Boolean(session?.isLateArrival) || cell.status === 'late';
                    const notPunchedOut = Boolean(session?.clockIn) && !session?.clockOut;
                    const inTime = formatTime(session?.clockIn);
                    const outTime = formatTime(session?.clockOut);
                    const worked = formatHours(session?.grossHours || session?.effectiveHours);
                    const hasSessionDetails = Boolean(session?.clockIn || session?.clockOut || session?.grossHours || session?.effectiveHours);
                    const cellTitle = !cell.day
                      ? ''
                      : session
                        ? `${new Date(session.date || `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`).toLocaleDateString()} | In: ${inTime} | Out: ${outTime} | Hours: ${worked}${isLate ? ' | Late check-in' : ''}${notPunchedOut ? ' | Not punched out' : ''}`
                        : `${new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), cell.day).toLocaleDateString()} | ${cell.status === 'weekend' ? 'Weekend' : 'No attendance record'}`;

                    return (
                      <div
                        key={cell.key}
                        title={cellTitle}
                        onClick={() => {
                          if (cell.day) setSelectedMobileDateKey(cell.key);
                        }}
                        className={`h-16 overflow-hidden rounded-md p-1 text-xs font-semibold sm:h-24 sm:p-2 ${cell.day ? 'cursor-pointer' : ''} ${selectedMobileDateKey === cell.key ? 'ring-1 ring-inset ring-[#20C997] sm:ring-0' : ''} ${heatmapCellClass(cell.status)}`}
                      >
                        {cell.day ? (
                          <div className="flex h-full flex-col">
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[11px] sm:text-sm">{cell.day}</span>
                              <div className="flex items-center gap-1 sm:hidden">
                                {isLate && <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" title="Late check-in" />}
                                {notPunchedOut && <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" title="Not punched out" />}
                              </div>
                              <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-0.5">
                                {isLate && (
                                  <span className="rounded-full bg-[#F59E0B] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                    Late
                                  </span>
                                )}
                                {notPunchedOut && (
                                  <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                    Not Punch out
                                  </span>
                                )}
                              </div>
                            </div>

                            {hasSessionDetails ? (
                              <div className="mt-1 hidden space-y-0.5 text-[9px] leading-tight text-[#334155] sm:block sm:text-[10px]">
                                <p className="truncate">In: {inTime}</p>
                                <p className="truncate">Out: {outTime}</p>
                                <p className="truncate">Hours: {worked}</p>
                              </div>
                            ) : (
                              <p className="mt-auto hidden text-[9px] leading-tight text-[#94A3B8] sm:block sm:text-[10px]">
                                {cell.status === 'weekend' ? 'Weekend' : '--'}
                              </p>
                            )}

                            <div className="mt-auto flex items-center justify-end sm:hidden">
                              {session ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E]" />
                              ) : cell.status === 'weekend' ? (
                                <span className="text-[8px] text-[#94A3B8]">W</span>
                              ) : (
                                <span className="text-[8px] text-[#94A3B8]">--</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {selectedMobileCell?.day && (
                  <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 sm:hidden">
                    {(() => {
                      const mobileSession = selectedMobileCell.session;
                      const mobileIsLate = Boolean(mobileSession?.isLateArrival) || selectedMobileCell.status === 'late';
                      const mobileNotPunchedOut = Boolean(mobileSession?.clockIn) && !mobileSession?.clockOut;
                      return (
                        <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), selectedMobileCell.day).toLocaleDateString()}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill(selectedMobileCell.status)}`}>
                          {selectedMobileCell.status === 'weekend' ? 'Weekend' : selectedMobileCell.status.replaceAll('-', ' ')}
                        </span>
                        {mobileIsLate && (
                          <span className="inline-flex rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Late
                          </span>
                        )}
                        {mobileNotPunchedOut && (
                          <span className="inline-flex rounded-full bg-[#EF4444] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Not punched out
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedMobileCell.session ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#475569]">
                        <div className="rounded-md bg-[#F8FAFC] px-2 py-1.5">
                          <p className="text-[10px] text-[#64748B]">In</p>
                          <p className="font-semibold text-[#1E293B]">{formatTime(selectedMobileCell.session.clockIn)}</p>
                        </div>
                        <div className="rounded-md bg-[#F8FAFC] px-2 py-1.5">
                          <p className="text-[10px] text-[#64748B]">Out</p>
                          <p className="font-semibold text-[#1E293B]">{formatTime(selectedMobileCell.session.clockOut)}</p>
                        </div>
                        <div className="col-span-2 rounded-md bg-[#F8FAFC] px-2 py-1.5">
                          <p className="text-[10px] text-[#64748B]">Hours</p>
                          <p className="font-semibold text-[#1E293B]">
                            {formatHours(selectedMobileCell.session.grossHours || selectedMobileCell.session.effectiveHours)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[#64748B]">
                        {selectedMobileCell.status === 'weekend' ? 'Weekend - no attendance required.' : 'No attendance data for this date.'}
                      </p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-full bg-[#DDF7F1] px-3 py-1 text-[#0F766E]">{presentCount} Present</span>
                  <span className="rounded-full bg-[#FDECEC] px-3 py-1 text-[#B91C1C]">{absentCount} Absent</span>
                  <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-[#92400E]">{lateCount} Late</span>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#334155]">Attendance Log</p>
                <div className="space-y-3 md:hidden">
                  {paginatedLogs.length === 0 ? (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-6 text-center text-sm text-[#64748B]">
                      No attendance logs found.
                    </div>
                  ) : paginatedLogs.map((row) => {
                    const s = String(row?.status || '').toLowerCase();
                    return (
                      <div key={row._id || `${row.date}-${row.clockIn || 'x'}`} className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[#1E293B]">
                            {row?.date ? new Date(row.date).toLocaleDateString() : '--'}
                          </p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(s)}`}>
                            {s.includes('weekend') ? 'Weekend' : (s || 'N/A').replaceAll('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#475569]">
                          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
                            <p className="text-[11px] text-[#64748B]">Check-in</p>
                            <p className="mt-0.5 font-semibold text-[#1E293B]">{formatTime(row?.clockIn)}</p>
                          </div>
                          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
                            <p className="text-[11px] text-[#64748B]">Check-out</p>
                            <p className="mt-0.5 font-semibold text-[#1E293B]">{formatTime(row?.clockOut)}</p>
                          </div>
                          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2 col-span-2">
                            <p className="text-[11px] text-[#64748B]">Hours</p>
                            <p className="mt-0.5 font-semibold text-[#1E293B]">{formatHours(row?.grossHours || row?.effectiveHours)}</p>
                          </div>
                          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2 col-span-2">
                            <p className="text-[11px] text-[#64748B]">Break time</p>
                            <p className="mt-0.5 font-semibold text-[#1E293B]">{formatBreakTime(row)}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          {renderRegularizationAction(row, true)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] md:block">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#64748B]">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Check-in</th>
                        <th className="px-4 py-3">Check-out</th>
                        <th className="px-4 py-3">Hours</th>
                        <th className="px-4 py-3">Break time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#64748B]">No attendance logs found.</td>
                        </tr>
                      ) : paginatedLogs.map((row) => {
                        const s = String(row?.status || '').toLowerCase();
                        return (
                          <tr key={row._id || `${row.date}-${row.clockIn || 'x'}`} className="border-b border-[#F1F5F9] text-sm text-[#1E293B] last:border-b-0">
                            <td className="px-4 py-3">{row?.date ? new Date(row.date).toLocaleDateString() : '--'}</td>
                            <td className="px-4 py-3">{formatTime(row?.clockIn)}</td>
                            <td className="px-4 py-3">{formatTime(row?.clockOut)}</td>
                            <td className="px-4 py-3">{formatHours(row?.grossHours || row?.effectiveHours)}</td>
                            <td className="px-4 py-3">{formatBreakTime(row)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(s)}`}>
                                {s.includes('weekend') ? 'Weekend' : (s || 'N/A').replaceAll('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {renderRegularizationAction(row)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sortedLogs.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#64748B]">
                      Showing {logsRangeStart}-{logsRangeEnd} of {sortedLogs.length} logs
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentLogPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentLogPage <= 1}
                        className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#F8FAFC]"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-medium text-[#334155]">
                        Page {safeCurrentLogPage} / {totalLogPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentLogPage((p) => Math.min(totalLogPages, p + 1))}
                        disabled={safeCurrentLogPage >= totalLogPages}
                        className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#F8FAFC]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {panelTab === 'leave-summary' && (
            <div className="space-y-5">
               {/* <div className="rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] px-4 py-3 text-sm text-[#0C4A6E]"> */}
                {/* <p className="font-semibold">Leave approval flow</p>
                <p className="mt-1 text-xs text-[#0369A1]">
                  Apply for leave → Manager approves → HR gives final approval. Balance updates only after HR approval.
                // </p> */} 
              {/* </div> */}

              <button
                onClick={() => navigate('/leave')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#20C997] bg-[#20C997] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#10B981]"
              >
                <FiPlus /> Apply for Leave
              </button>

              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#334155]">Leave Balance</p>
                {leaveBalanceError ? (
                  <p className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{leaveBalanceError}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {leaveTypeCards.length === 0 ? (
                      <p className="col-span-full rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#64748B]">No leave balance data available.</p>
                    ) : (
                      leaveTypeCards.map((card) => (
                        <div key={card.leaveType} className="space-y-2">
                          <CircleMeter
                            label={card.displayName}
                            value={card.available}
                            total={card.chartTotal}
                            used={card.used}
                          />
                          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#475569]">
                            <div className="flex items-center justify-between">
                              <span>Annual entitlement</span>
                              <span className="font-semibold text-[#0F172A]">{card.annualEntitlement}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Monthly accrual</span>
                              <span className="font-semibold text-[#0F172A]">{card.monthlyAccrual}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Current month accrual</span>
                              <span className="font-semibold text-[#0F766E]">
                                {card.currentMonthAccrual > 0 ? `+${card.currentMonthAccrual}` : card.currentMonthAccrual}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Used</span>
                              <span className="font-semibold text-[#0F172A]">{card.used}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Carry forward</span>
                              <span className="font-semibold text-[#0F172A]">{card.carriedForward}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>Available</span>
                              <span className="font-semibold text-[#0F766E]">{card.available}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {leaveStats && (
                    <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#475569]">
                      <p className="font-semibold text-[#0F172A] mb-2">Leave summary</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <span>Total annual: <strong>{leaveStats.annualQuota}</strong></span>
                        <span>Current month: <strong>+{leaveStats.earnedThisMonth}</strong></span>
                        <span>Available: <strong>{leaveStats.available}</strong></span>
                        <span>Used: <strong>{leaveStats.used}</strong></span>
                        <span>Carry forward: <strong>{leaveStats.carriedForward}</strong></span>
                        <span>Manual adj.: <strong>{leaveStats.manualAdjustment}</strong></span>
                      </div>
                    </div>
                  )}
                )}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#334155]">Leave History</p>
                <div className="space-y-3 md:hidden">
                  {leaveRows.length === 0 ? (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-6 text-center text-sm text-[#64748B]">
                      No leave requests found.
                    </div>
                  ) : leaveRows.slice(0, 8).map((row) => (
                    <div key={row.id} className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[#1E293B]">
                          {getLeaveDisplayLabel()}
                        </p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${leaveStatusPill(row.displayStatus)}`}>
                          {row.displayStatus}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#475569]">
                        <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
                          <p className="text-[11px] text-[#64748B]">From</p>
                          <p className="mt-0.5 font-semibold text-[#1E293B]">
                            {row.startDate ? row.startDate.toLocaleDateString() : '--'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
                          <p className="text-[11px] text-[#64748B]">To</p>
                          <p className="mt-0.5 font-semibold text-[#1E293B]">
                            {row.endDate ? row.endDate.toLocaleDateString() : '--'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2 col-span-2">
                          <p className="text-[11px] text-[#64748B]">Days</p>
                          <p className="mt-0.5 font-semibold text-[#1E293B]">{row.duration}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] md:block">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#64748B]">
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">From</th>
                        <th className="px-4 py-3">To</th>
                        <th className="px-4 py-3">Days</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#64748B]">No leave requests found.</td>
                        </tr>
                      ) : leaveRows.slice(0, 8).map((row) => (
                        <tr key={row.id} className="border-b border-[#F1F5F9] text-sm text-[#1E293B] last:border-b-0">
                          <td className="px-4 py-3">{getLeaveDisplayLabel()}</td>
                          <td className="px-4 py-3">{row.startDate ? row.startDate.toLocaleDateString() : '--'}</td>
                          <td className="px-4 py-3">{row.endDate ? row.endDate.toLocaleDateString() : '--'}</td>
                          <td className="px-4 py-3">{row.duration}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${leaveStatusPill(row.displayStatus)}`}>
                              {row.displayStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {panelTab === 'regularization-history' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">
                  Regularization history —{' '}
                  {calendarCursor.toLocaleString('default', { month: 'long' })} {calendarCursor.getFullYear()}
                </p>
                <button
                  onClick={() => navigate('/my-attendance-regularization')}
                  className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:border-[#20C997] hover:text-[#0F766E]"
                >
                  View Full Regularization Page
                </button>
              </div>

              <div className="space-y-3 md:hidden">
                {regularizationHistoryRows.length === 0 ? (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-6 text-center text-sm text-[#64748B]">
                    No regularization requests for this month.
                  </div>
                ) : regularizationHistoryRows.map((row) => (
                  <div key={row._id || row.createdAt} className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {row.attendanceDate ? new Date(row.attendanceDate).toLocaleDateString() : '--'}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          String(row.status) === 'pending'
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : String(row.status) === 'approved'
                              ? 'bg-[#DCFCE7] text-[#166534]'
                              : String(row.status) === 'rejected'
                                ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                : 'bg-[#E5E7EB] text-[#374151]'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#475569]">{regTypeLabel(row.regularizationType)}</p>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] md:block">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#64748B]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Request type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularizationHistoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#64748B]">
                          No regularization requests for this month.
                        </td>
                      </tr>
                    ) : regularizationHistoryRows.map((row) => (
                      <tr key={row._id} className="border-b border-[#F1F5F9] text-sm text-[#1E293B] last:border-b-0">
                        <td className="px-4 py-3">
                          {row.attendanceDate ? new Date(row.attendanceDate).toLocaleDateString() : '--'}
                        </td>
                        <td className="px-4 py-3">{regTypeLabel(row.regularizationType)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              String(row.status) === 'pending'
                                ? 'bg-[#FEF3C7] text-[#92400E]'
                                : String(row.status) === 'approved'
                                  ? 'bg-[#DCFCE7] text-[#166534]'
                                  : String(row.status) === 'rejected'
                                    ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                    : 'bg-[#E5E7EB] text-[#374151]'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate('/my-attendance-regularization')}
                            className="text-xs font-semibold text-[#0F766E] hover:text-[#10B981]"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {panelTab === 'wfh-request' && <WfhRequestPanel />}
        </section>
      </div>
    </div>
  );
};

export default LeaveAttendanceHub;

