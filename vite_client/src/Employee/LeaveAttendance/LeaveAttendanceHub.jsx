import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { getAuthEmployeeId } from '../../utils/authUser';
import { fetchLogs, hydrateLogsFromMonthCache } from '../../context/attendanceSlice';
import { getEmployeeLeaves } from '../../context/employeeLeaveSlice';
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiCoffee,
  FiX,
  FiUsers,
  FiArrowLeft,
  FiLoader,
  FiDownload,
  FiFileText,
  FiCalendar,
  FiClock,
  FiHome,
} from 'react-icons/fi';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import * as XLSX from 'xlsx';
import {
  getLeaveTypeDisplayName,
  getLeaveDisplayLabel,
  getLeaveWidgetStats,
  getLeaveTypeCards,
  formatLeaveDurationDisplay,
  isHalfDayLeaveRecord,
  LEAVE_UI,
  monthlyEarnsLabel,
} from '../../constants/leaveConstants';
import { formatLeaveApprovalStageDisplay } from '../../utils/approvalStatusDisplay';
import {
  formatAttendanceStatusLabel,
  formatStatusLabel,
} from '../../utils/textFormat.js';
import WfhRequestPanel from '../Wfh/WfhRequestPanel';
import '../../styles/wfhRequestUI.css';

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

const formatBreakDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getIndividualBreakDurations = (row) => {
  if (!row?.breaks || !Array.isArray(row.breaks)) return [];
  const nowMs = Date.now();
  return row.breaks.map((entry, index) => {
    if (!entry?.breakIn) return null;
    const breakIn = new Date(entry.breakIn).getTime();
    if (!Number.isFinite(breakIn)) return null;
    const breakOut = entry.breakOut ? new Date(entry.breakOut).getTime() : nowMs;
    if (!Number.isFinite(breakOut) || breakOut <= breakIn) return null;
    const duration = (breakOut - breakIn) / 1000; // in seconds
    const breakType = entry.breakType || `BREAK_${index + 1}`; // Backward compatibility
    return {
      breakType,
      duration,
      isActive: !entry.breakOut
    };
  }).filter(Boolean);
};

const formatBreakDisplayName = (breakType) => {
  if (!breakType) return 'Break';
  if (breakType === 'LUNCH') return 'Lunch';
  return breakType.replace('BREAK_', 'Break ');
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

const getLeaveDisplayStatus = (leave) => formatLeaveApprovalStageDisplay(leave);

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

const CircleMeter = ({ value, total, label, used, valueLabel = LEAVE_UI.youCanTakeThisMonth }) => {
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
        <span>{value} {valueLabel}</span>
      </div>
    </div>
  );
};

const LeaveAttendanceHub = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const attendance = useSelector((state) => state.attendance);
  const leaveState = useSelector((state) => state.employeeLeave);
  const authUser = useSelector((state) => state.auth.user);
  const employeeProfile = useSelector((state) => state.employeeDetails.employee);
  const monthCache = attendance.monthCache || {};
  const employeeDocId =
    getAuthEmployeeId(employeeProfile) || getAuthEmployeeId(authUser);
  const { isHrManager, isHrExecutive } = useAuthPermissions();

  const [calendarCursor, setCalendarCursor] = useState(startOfMonthDate(new Date()));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveBalanceError, setLeaveBalanceError] = useState('');
  const requestedPanel = location.state?.panelTab;
  const [panelTab, setPanelTab] = useState(
    ['attendance-log', 'leave-summary', 'regularization-history', 'wfh-request'].includes(requestedPanel)
      ? requestedPanel
      : 'attendance-log'
  );
  const [selectedMobileDateKey, setSelectedMobileDateKey] = useState(null);
  const [regularizationRequestsAll, setRegularizationRequestsAll] = useState([]);
  const [regularizationLimits, setRegularizationLimits] = useState(null);
  const [currentLogPage, setCurrentLogPage] = useState(1);
  const [selectedBreaksRow, setSelectedBreaksRow] = useState(null);
  const [showBreaksModal, setShowBreaksModal] = useState(false);
  const [showAllEmployeesModal, setShowAllEmployeesModal] = useState(false);
  const [selectedAllEmployeesDate, setSelectedAllEmployeesDate] = useState(new Date());
  const [allEmployeesBreaksData, setAllEmployeesBreaksData] = useState([]);
  const [loadingAllEmployeesData, setLoadingAllEmployeesData] = useState(false);
  
  // Export selection state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null); // 'date' or 'month'
  const [exportScope, setExportScope] = useState(null); // 'all' or 'particular'
  const [selectedExportEmployee, setSelectedExportEmployee] = useState(null);
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [loadingEmployeesList, setLoadingEmployeesList] = useState(false);
  const [selectedExportDate, setSelectedExportDate] = useState(new Date());

  const getIndividualBreakDurationsFromRow = (row) => {
    if (!row?.breaks || !Array.isArray(row.breaks)) return [];
    const nowMs = Date.now();
    return row.breaks.map((entry, index) => {
      if (!entry?.breakIn) return null;
      const breakIn = new Date(entry.breakIn).getTime();
      if (!Number.isFinite(breakIn)) return null;
      const breakOut = entry.breakOut ? new Date(entry.breakOut).getTime() : nowMs;
      if (!Number.isFinite(breakOut) || breakOut <= breakIn) return null;
      const duration = (breakOut - breakIn) / 1000;
      const breakType = entry.breakType || `BREAK_${index + 1}`;
      return {
        breakType,
        duration,
        isActive: !entry.breakOut
      };
    }).filter(Boolean);
  };

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
    if (!employeeDocId) {
      setLeaveBalance(null);
      setLeaveBalanceError('No employee profile is linked to this account, so leave balances cannot be loaded.');
      return;
    }
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
          setLeaveBalanceError(error?.response?.data?.message || 'No applicable leave policy found for your account in the selected year.');
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
      .map((leave) => {
        const startDate = leave.startDate ? new Date(leave.startDate) : null;
        let endDate = leave.endDate ? new Date(leave.endDate) : null;
        const halfDay = Boolean(leave.isHalfDay) || isHalfDayLeaveRecord(leave);
        if (halfDay && startDate) {
          endDate = new Date(startDate);
        }
        return {
          id: leave._id,
          type: leave.leaveType || 'unknown',
          startDate,
          endDate,
          duration: Number(leave.duration || 0),
          durationLabel: formatLeaveDurationDisplay(leave),
          status: String(leave.status || 'pending').toLowerCase(),
          approvalStage: leave.approvalStage || '',
          displayStatus: getLeaveDisplayStatus(leave),
        };
      });
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

  const handleViewBreaks = (row) => {
    setSelectedBreaksRow(row);
    setShowBreaksModal(true);
  };

  const handleCloseBreaksModal = () => {
    setShowBreaksModal(false);
    setSelectedBreaksRow(null);
  };

  const handleExportEmployeeDateToExcel = () => {
    setExportType('date');
    setExportScope('particular');
    setSelectedExportEmployee(selectedBreaksRow.employee);
    setShowExportModal(true);
    loadEmployeesList();
  };

  const handleExportEmployeeMonthToExcel = () => {
    setExportType('month');
    setExportScope('particular');
    setSelectedExportEmployee(selectedBreaksRow.employee);
    setShowExportModal(true);
    loadEmployeesList();
  };

  const handleCloseAllEmployeesModal = () => {
    setShowAllEmployeesModal(false);
    setAllEmployeesBreaksData([]);
  };

  const handleExportClick = (type) => {
    setExportType(type);
    setExportScope(null);
    setSelectedExportEmployee(null);
    setShowExportModal(true);
    loadEmployeesList();
  };

  const loadEmployeesList = async () => {
    setLoadingEmployeesList(true);
    try {
      const monthStart = startOfMonthDate(new Date());
      const monthEnd = endOfMonthDate(new Date());
      const params = {
        startDate: toDateInput(monthStart),
        endDate: toDateInput(monthEnd),
        limit: 1000
      };
      const res = await axios.get('/v1/both/attendance/team-attendance-history', { params });
      const records = res.data?.records || [];
      
      // Extract unique employees
      const employeesMap = new Map();
      records.forEach(record => {
        if (record.employee) {
          const empId = record.employee._id || record.employee.employeeId;
          if (!employeesMap.has(empId)) {
            employeesMap.set(empId, record.employee);
          }
        }
      });
      
      setAllEmployeesList(Array.from(employeesMap.values()));
    } catch (error) {
      console.error('Failed to load employees list:', error);
    } finally {
      setLoadingEmployeesList(false);
    }
  };

  const handleExportConfirm = async () => {
    if (!exportScope) {
      toast.error('Please select export scope');
      return;
    }

    if (exportScope === 'particular' && !selectedExportEmployee) {
      toast.error('Please select an employee');
      return;
    }

    setShowExportModal(false);

    if (exportType === 'date') {
      await handleExportByDate();
    } else {
      await handleExportByMonth();
    }
  };

  const handleExportByDate = async () => {
    try {
      const targetDate = selectedExportDate;
      const params = {
        startDate: toDateInput(targetDate),
        endDate: toDateInput(targetDate),
        limit: 1000
      };

      toast.loading('Exporting date-wise data...', { toastId: 'exportDate' });

      const res = await axios.get('/v1/both/attendance/team-attendance-history', { params });
      const records = res.data?.records || [];

      // Filter records based on scope
      let filteredRecords = records;
      if (exportScope === 'particular' && selectedExportEmployee) {
        filteredRecords = records.filter(record => {
          const empId = selectedExportEmployee._id;
          const empEmpId = selectedExportEmployee.employeeId;
          const selectedEmpName = [selectedExportEmployee.name, selectedExportEmployee.lastName].filter(Boolean).join(' ').toLowerCase();
          
          const recordEmpId = record.employee?._id;
          const recordEmpEmpId = record.employee?.employeeId;
          const recordEmpName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ').toLowerCase();
          
          return recordEmpId === empId || 
                 recordEmpEmpId === empEmpId ||
                 record.employee?.id === empId ||
                 recordEmpName === selectedEmpName ||
                 (empEmpId && recordEmpEmpId === empEmpId);
        });
      }

      if (filteredRecords.length === 0) {
        toast.dismiss('exportDate');
        toast.error('No data found for the selected criteria');
        return;
      }

      const exportData = [];
      filteredRecords.forEach((record) => {
        const breakDurations = getIndividualBreakDurationsFromRow(record);
        const totalDuration = breakDurations.reduce((sum, b) => sum + b.duration, 0);
        const empName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ');
        
        const getBreakDuration = (breakType) => {
          const found = breakDurations.find(b => b.breakType === breakType);
          return found ? formatBreakDuration(found.duration) : '--';
        };

        exportData.push({
          'Employee Name': empName,
          'Employee ID': record.employee?.employeeId || '--',
          'Date': record.date || toDateInput(record.dateKey),
          'Break 1': getBreakDuration('BREAK_1'),
          'Break 2': getBreakDuration('BREAK_2'),
          'Break 3': getBreakDuration('BREAK_3'),
          'Break 4': getBreakDuration('BREAK_4'),
          'Total Break Time': formatBreakDuration(totalDuration)
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Breaks');
      
      const dateStr = toDateInput(targetDate);
      const scopeName = exportScope === 'particular' ? selectedExportEmployee.name : 'All_Employees';
      const fileName = `${scopeName.replace(/\s+/g, '_')}_Breaks_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.dismiss('exportDate');
      toast.success('Date-wise export successful!');
    } catch (error) {
      toast.dismiss('exportDate');
      toast.error('Failed to export date-wise data');
      console.error('Export error:', error);
    }
  };

  const handleExportByMonth = async () => {
    try {
      const targetDate = selectedExportDate;
      const monthStart = startOfMonthDate(targetDate);
      const monthEnd = endOfMonthDate(targetDate);
      const params = {
        startDate: toDateInput(monthStart),
        endDate: toDateInput(monthEnd),
        limit: 1000
      };

      toast.loading('Exporting month-wise data...', { toastId: 'exportMonth' });

      const res = await axios.get('/v1/both/attendance/team-attendance-history', { params });
      const records = res.data?.records || [];

      // Filter records based on scope
      let filteredRecords = records;
      if (exportScope === 'particular' && selectedExportEmployee) {
        filteredRecords = records.filter(record => {
          const empId = selectedExportEmployee._id;
          const empEmpId = selectedExportEmployee.employeeId;
          const selectedEmpName = [selectedExportEmployee.name, selectedExportEmployee.lastName].filter(Boolean).join(' ').toLowerCase();
          
          const recordEmpId = record.employee?._id;
          const recordEmpEmpId = record.employee?.employeeId;
          const recordEmpName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ').toLowerCase();
          
          return recordEmpId === empId || 
                 recordEmpEmpId === empEmpId ||
                 record.employee?.id === empId ||
                 recordEmpName === selectedEmpName ||
                 (empEmpId && recordEmpEmpId === empEmpId);
        });
      }

      if (filteredRecords.length === 0) {
        toast.dismiss('exportMonth');
        toast.error('No data found for the selected criteria');
        return;
      }

      const exportData = [];
      filteredRecords.forEach((record) => {
        const breakDurations = getIndividualBreakDurationsFromRow(record);
        const totalDuration = breakDurations.reduce((sum, b) => sum + b.duration, 0);
        const empName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ');
        
        const getBreakDuration = (breakType) => {
          const found = breakDurations.find(b => b.breakType === breakType);
          return found ? formatBreakDuration(found.duration) : '--';
        };

        exportData.push({
          'Employee Name': empName,
          'Employee ID': record.employee?.employeeId || '--',
          'Date': record.date || toDateInput(record.dateKey),
          'Break 1': getBreakDuration('BREAK_1'),
          'Break 2': getBreakDuration('BREAK_2'),
          'Break 3': getBreakDuration('BREAK_3'),
          'Break 4': getBreakDuration('BREAK_4'),
          'Total Break Time': formatBreakDuration(totalDuration)
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Breaks');
      
      const monthName = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const scopeName = exportScope === 'particular' ? selectedExportEmployee.name : 'All_Employees';
      const fileName = `${scopeName.replace(/\s+/g, '_')}_Breaks_${monthName}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.dismiss('exportMonth');
      toast.success('Month-wise export successful!');
    } catch (error) {
      toast.dismiss('exportMonth');
      toast.error('Failed to export month-wise data');
      console.error('Export error:', error);
    }
  };

  const handleViewAllEmployeeBreaks = async (date) => {
    if (loadingAllEmployeesData) return;
    setLoadingAllEmployeesData(true);
    try {
      const targetDate = date || selectedAllEmployeesDate;
      const monthStart = startOfMonthDate(targetDate);
      const monthEnd = endOfMonthDate(targetDate);
      const params = {
        startDate: toDateInput(monthStart),
        endDate: toDateInput(monthEnd),
        limit: 100
      };
      const res = await axios.get('/v1/both/attendance/team-attendance-history', { params });
      const records = res.data?.records || [];
      // Group by employee and get breaks for selected date
      const selectedDateKey = toDateInput(targetDate);
      const employeeBreaksMap = new Map();
      records.forEach((record) => {
        if (record.dateKey === selectedDateKey) {
          const empId = record.employee?._id;
          if (!empId) return;
          if (!employeeBreaksMap.has(empId)) {
            employeeBreaksMap.set(empId, {
              employee: record.employee,
              date: record.date,
              breaks: record.breaks || []
            });
          }
        }
      });
      setAllEmployeesBreaksData(Array.from(employeeBreaksMap.values()));
      setShowAllEmployeesModal(true);
    } catch (error) {
      console.error('Failed to fetch all employees breaks:', error);
      toast.error('Failed to load employee breaks');
    } finally {
      setLoadingAllEmployeesData(false);
    }
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
          {formatStatusLabel(requestStatus)}
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
            {calendarCursor.toLocaleString('default', { month: 'long' })} {calendarCursor.getFullYear()} - {employeeProfile?.name || authUser?.name || 'Employee'}
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

        <section className="leave-attendance-hub la-hub--stitch hrms-mobile-full min-w-0 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 shadow-sm md:p-4">
          <div className="la-panel-tabs la-panel-tabs--stitch" role="tablist">
            {[
              { id: 'attendance-log', label: 'Attendance log', short: 'Attendance', Icon: FiFileText },
              { id: 'leave-summary', label: 'Leave summary', short: 'Leave', Icon: FiCalendar },
              { id: 'regularization-history', label: 'Regularization history', short: 'Regularization', Icon: FiClock },
              { id: 'wfh-request', label: 'Work From Home', short: 'WFH', Icon: FiHome },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={panelTab === tab.id}
                title={tab.label}
                onClick={() => setPanelTab(tab.id)}
                className={panelTab === tab.id ? 'is-active' : ''}
              >
                <tab.Icon aria-hidden />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
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
                                  <span className="rounded-full bg-[#F59E0B] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white">
                                    {formatAttendanceStatusLabel('late')}
                                  </span>
                                )}
                                {notPunchedOut && (
                                  <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white">
                                    Not punched out
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
                      const mobileDate = mobileSession?.date
                        || new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), selectedMobileCell.day);
                      const regularizationRow = {
                        ...(mobileSession || {}),
                        date: mobileDate,
                        status: mobileIsLate ? 'late' : (mobileSession?.status || selectedMobileCell.status),
                        clockIn: mobileSession?.clockIn,
                        clockOut: mobileSession?.clockOut,
                        isLateArrival: mobileIsLate,
                      };
                      const todayKey = toDateInput(new Date());
                      const selectedDateKey = toDateInput(mobileDate);
                      const showRegularizeAction =
                        selectedMobileCell.status !== 'weekend' &&
                        selectedMobileCell.status !== 'holiday' &&
                        selectedDateKey <= todayKey;
                      return (
                        <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), selectedMobileCell.day).toLocaleDateString()}
                      </p>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill(selectedMobileCell.status)}`}>
                          {selectedMobileCell.status === 'weekend'
                            ? 'Weekend'
                            : formatAttendanceStatusLabel(selectedMobileCell.status)}
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
                    {showRegularizeAction && (
                      <div className="mt-3 flex items-center justify-end border-t border-[#E2E8F0] pt-2">
                        {renderRegularizationAction(regularizationRow)}
                      </div>
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
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">Attendance Log</p>
                  {(isHrManager || isHrExecutive) && (
                    <button
                      type="button"
                      onClick={() => handleViewAllEmployeeBreaks()}
                      disabled={loadingAllEmployeesData}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0F766E] bg-[#ECFDF5] text-[#0F766E] text-xs font-semibold hover:bg-[#D1FAE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiUsers className="h-3.5 w-3.5" />
                      {loadingAllEmployeesData ? 'Loading...' : 'View All Employee Breaks'}
                    </button>
                  )}
                </div>
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
                            {s.includes('weekend') ? 'Weekend' : formatAttendanceStatusLabel(s || 'N/A')}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#475569]">
                          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2 col-span-2">
                            <p className="text-[11px] text-[#64748B]">Shift</p>
                            <p className="mt-0.5 font-semibold text-[#1E293B]">{row?.shiftName || '—'}</p>
                          </div>
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
                          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 px-3 py-3 col-span-2 border border-slate-200">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Break time</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="font-bold text-base text-slate-800">{formatBreakTime(row)}</p>
                              {row?.breaks && row.breaks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleViewBreaks(row)}
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D9488] transition-all shadow-sm hover:shadow-md"
                                >
                                  <FiCoffee className="h-3.5 w-3.5" />
                                  View Breaks
                                </button>
                              )}
                            </div>
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
                        <th className="px-4 py-3">Shift</th>
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
                          <td colSpan={8} className="px-4 py-6 text-center text-sm text-[#64748B]">No attendance logs found.</td>
                        </tr>
                      ) : paginatedLogs.map((row) => {
                        const s = String(row?.status || '').toLowerCase();
                        return (
                          <tr key={row._id || `${row.date}-${row.clockIn || 'x'}`} className="border-b border-[#F1F5F9] text-sm text-[#1E293B] last:border-b-0">
                            <td className="px-4 py-3">{row?.date ? new Date(row.date).toLocaleDateString() : '--'}</td>
                            <td className="px-4 py-3">{row?.shiftName || '—'}</td>
                            <td className="px-4 py-3">{formatTime(row?.clockIn)}</td>
                            <td className="px-4 py-3">{formatTime(row?.clockOut)}</td>
                            <td className="px-4 py-3">{formatHours(row?.grossHours || row?.effectiveHours)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="font-semibold text-slate-800">
                                  {formatBreakTime(row)}
                                </div>
                                {row?.breaks && row.breaks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewBreaks(row)}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0D9488] transition-all shadow-sm hover:shadow-md"
                                  >
                                    <FiCoffee className="h-3.5 w-3.5" />
                                    View Breaks
                                  </button>
                                )}
                              </div>
                            </td>
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

          {/* Break Details Modal */}
          {showBreaksModal && selectedBreaksRow && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] sm:h-12 sm:w-12">
                        <FiCoffee className="h-5 w-5 text-[#0F766E] sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Break Details</h3>
                        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                          {selectedBreaksRow?.date ? new Date(selectedBreaksRow.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '--'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseBreaksModal}
                      className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 sm:hidden"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportEmployeeDateToExcel}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D9488] sm:flex-none"
                    >
                      <FiDownload className="h-3.5 w-3.5" />
                      Export Date
                    </button>
                    <button
                      type="button"
                      onClick={handleExportEmployeeMonthToExcel}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D9488] sm:flex-none"
                    >
                      <FiDownload className="h-3.5 w-3.5" />
                      Export Month
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseBreaksModal}
                      className="hidden shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 sm:inline-flex"
                    >
                      <FiX className="h-6 w-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                  <div className="space-y-3">
                    {getIndividualBreakDurations(selectedBreaksRow).map((breakInfo) => (
                      <div key={breakInfo.breakType} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${breakInfo.isActive ? 'bg-amber-100' : 'bg-[#ECFDF5]'}`}>
                            <FiCoffee className={`h-5 w-5 ${breakInfo.isActive ? 'text-amber-600' : 'text-[#0F766E]'}`} />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-900">
                              {formatBreakDisplayName(breakInfo.breakType)}
                            </span>
                            {breakInfo.isActive && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {formatBreakDuration(breakInfo.duration)}
                        </span>
                      </div>
                    ))}
                    {getIndividualBreakDurations(selectedBreaksRow).length > 0 && (
                      <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl border border-slate-200 mt-4">
                        <span className="text-sm font-bold text-slate-700">Total Break Time</span>
                        <span className="text-lg font-bold tabular-nums text-slate-900">
                          {formatBreakDuration(
                            getIndividualBreakDurations(selectedBreaksRow).reduce((sum, b) => sum + b.duration, 0)
                          )}
                        </span>
                      </div>
                    )}
                    {getIndividualBreakDurations(selectedBreaksRow).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                        <FiCoffee className="h-10 w-10 mb-3 text-slate-300" />
                        <p className="text-sm font-medium">No breaks recorded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Employee Breaks Modal */}
          {showAllEmployeesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] sm:h-12 sm:w-12">
                        <FiUsers className="h-5 w-5 text-[#0F766E] sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 sm:text-xl">All Employee Breaks</h3>
                        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">View break details for all employees</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseAllEmployeesModal}
                      className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 sm:hidden"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportClick('date')}
                      disabled={loadingAllEmployeesData}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4 sm:text-sm"
                    >
                      <FiDownload className="h-4 w-4" />
                      Export Date
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportClick('month')}
                      disabled={loadingAllEmployeesData}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4 sm:text-sm"
                    >
                      <FiDownload className="h-4 w-4" />
                      Export Month
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseAllEmployeesModal}
                      className="hidden shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 sm:inline-flex"
                    >
                      <FiX className="h-6 w-6" />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                  {/* Date Selector */}
                  <div className="mb-6 bg-white rounded-xl p-4 border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date</label>
                    <input
                      type="date"
                      value={toDateInput(selectedAllEmployeesDate)}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setSelectedAllEmployeesDate(newDate);
                        handleViewAllEmployeeBreaks(newDate);
                      }}
                      className="w-full sm:max-w-xs px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent font-medium"
                    />
                  </div>

                  {/* Employee Breaks Table */}
                  {loadingAllEmployeesData ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200">
                      <FiLoader className="h-10 w-10 mb-3 animate-spin text-slate-300" />
                      <p className="text-sm font-medium">Loading employee breaks...</p>
                    </div>
                  ) : allEmployeesBreaksData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200">
                      <FiUsers className="h-10 w-10 mb-3 text-slate-300" />
                      <p className="text-sm font-medium">No employee breaks recorded for this date</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-slate-200 text-left text-xs uppercase tracking-wider text-slate-600 bg-slate-50">
                              <th className="px-5 py-4 font-semibold rounded-tl-lg">Employee</th>
                              <th className="px-4 py-4 font-semibold text-center">Break 1</th>
                              <th className="px-4 py-4 font-semibold text-center">Break 2</th>
                              <th className="px-4 py-4 font-semibold text-center">Break 3</th>
                              <th className="px-4 py-4 font-semibold text-center">Break 4</th>
                              <th className="px-5 py-4 font-semibold text-right rounded-tr-lg">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allEmployeesBreaksData.map((empBreak) => {
                              const breakDurations = getIndividualBreakDurationsFromRow(empBreak);
                              const totalDuration = breakDurations.reduce((sum, b) => sum + b.duration, 0);
                              const empName = [empBreak.employee?.name, empBreak.employee?.lastName].filter(Boolean).join(' ');
                              
                              const getBreakDuration = (breakType) => {
                                const found = breakDurations.find(b => b.breakType === breakType);
                                return found ? formatBreakDuration(found.duration) : '--';
                              };

                              return (
                                <tr key={empBreak.employee?._id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-5 py-4 font-medium text-slate-900">{empName}</td>
                                  <td className="px-4 py-4 text-center tabular-nums text-slate-700">{getBreakDuration('BREAK_1')}</td>
                                  <td className="px-4 py-4 text-center tabular-nums text-slate-700">{getBreakDuration('BREAK_2')}</td>
                                  <td className="px-4 py-4 text-center tabular-nums text-slate-700">{getBreakDuration('BREAK_3')}</td>
                                  <td className="px-4 py-4 text-center tabular-nums text-slate-700">{getBreakDuration('BREAK_4')}</td>
                                  <td className="px-5 py-4 text-right font-bold tabular-nums text-slate-900">{formatBreakDuration(totalDuration)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Export Selection Modal */}
          {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] flex items-center justify-center shrink-0">
                      <FiDownload className="h-6 w-6 text-[#0F766E]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Export Break Data</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {exportType === 'date' ? 'Export by Date' : 'Export by Month'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                  <div className="space-y-6">
                    {/* Scope Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Do you want to export data for:
                      </label>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExportScope('all');
                            setSelectedExportEmployee(null);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                            exportScope === 'all'
                              ? 'border-[#0F766E] bg-[#ECFDF5] text-[#0F766E]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <FiUsers className="h-5 w-5" />
                          <span className="font-medium">All Employees</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportScope('particular')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                            exportScope === 'particular'
                              ? 'border-[#0F766E] bg-[#ECFDF5] text-[#0F766E]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <FiCoffee className="h-5 w-5" />
                          <span className="font-medium">Particular Employee</span>
                        </button>
                      </div>
                    </div>

                    {/* Employee Selection */}
                    {exportScope === 'particular' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Select Employee:
                        </label>
                        {loadingEmployeesList ? (
                          <div className="flex items-center justify-center py-8 text-slate-500">
                            <FiLoader className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-sm">Loading employees...</span>
                          </div>
                        ) : (
                          <select
                            value={selectedExportEmployee?._id || ''}
                            onChange={(e) => {
                              const emp = allEmployeesList.find(emp => emp._id === e.target.value);
                              setSelectedExportEmployee(emp);
                            }}
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent"
                          >
                            <option value="">Select an employee</option>
                            {allEmployeesList.map(emp => (
                              <option key={emp._id} value={emp._id}>
                                {emp.name} {emp.lastName} ({emp.employeeId || 'N/A'})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Date Selection for Date Export */}
                    {exportType === 'date' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Select Date:
                        </label>
                        <input
                          type="date"
                          value={toDateInput(selectedExportDate)}
                          onChange={(e) => setSelectedExportDate(new Date(e.target.value))}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent"
                        />
                      </div>
                    )}

                    {/* Month Selection for Month Export */}
                    {exportType === 'month' && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Select Month:
                        </label>
                        <input
                          type="month"
                          value={`${selectedExportDate.getFullYear()}-${String(selectedExportDate.getMonth() + 1).padStart(2, '0')}`}
                          onChange={(e) => {
                            const [year, month] = e.target.value.split('-');
                            setSelectedExportDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                          }}
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 border-t border-slate-100 bg-white">
                  <button
                    type="button"
                    onClick={handleExportConfirm}
                    disabled={!exportScope || (exportScope === 'particular' && !selectedExportEmployee)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0F766E] text-white font-semibold hover:bg-[#0D9488] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiDownload className="h-5 w-5" />
                    Export Data
                  </button>
                </div>
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

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">Leave Balance</p>
                  <button
                    type="button"
                    onClick={() => navigate('/leave')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#20C997] bg-[#20C997] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#10B981]"
                  >
                    <FiPlus className="h-3.5 w-3.5" /> Apply for Leave
                  </button>
                </div>
                {leaveBalanceError ? (
                  <p className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">{leaveBalanceError}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {leaveTypeCards.length === 0 ? (
                        <p className="col-span-full rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#64748B]">No leave balance data available.</p>
                      ) : (
                        leaveTypeCards.map((card) => {
                          const takeable = card.takeableThisMonth ?? card.available;
                          const meterTotal =
                            card.probationAccrualActive && card.carryForwardDuringProbation !== true
                              ? Math.max(card.monthlyAccrual || 0, takeable, 1)
                              : card.chartTotal;
                          return (
                          <div key={card.leaveType} className="space-y-2">
                            <CircleMeter
                              label={card.displayName}
                              value={takeable}
                              total={meterTotal}
                              used={card.used}
                              valueLabel={LEAVE_UI.youCanTakeThisMonth}
                            />
                            {(card.inProbation || card.probationAccrualActive) && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                                <span className="font-semibold">On probation</span>
                                {card.probationNote ? (
                                  <span> — {card.probationNote.replace(/^On probation —\s*/i, '')}</span>
                                ) : card.probationAccrualActive ? (
                                  <span>
                                    {' '}
                                    — you earn {card.monthlyAccrual} day(s) per month
                                    {card.normalMonthlyAccrual != null &&
                                    card.normalMonthlyAccrual !== card.monthlyAccrual
                                      ? ` (then ${card.normalMonthlyAccrual}/month after confirmation)`
                                      : ''}
                                    {card.carryForwardDuringProbation !== true
                                      ? '. Unused days this month do not move to next month. Your old balance stays locked until confirmation.'
                                      : ''}
                                  </span>
                                ) : (
                                  <span> — normal leave rules apply for this type</span>
                                )}
                              </div>
                            )}
                            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#475569]">
                              <div className="flex items-center justify-between">
                                <span>{LEAVE_UI.yearlyLimit}</span>
                                <span className="font-semibold text-[#0F172A]">{card.annualEntitlement}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>{monthlyEarnsLabel(card.probationAccrualActive)}</span>
                                <span className="font-semibold text-[#0F172A]">{card.monthlyAccrual}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>{LEAVE_UI.addedThisMonth}</span>
                                <span className="font-semibold text-[#0F766E]">
                                  {card.currentMonthAccrual > 0 ? `+${card.currentMonthAccrual}` : card.currentMonthAccrual}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>{LEAVE_UI.used}</span>
                                <span className="font-semibold text-[#0F172A]">{card.used}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>{LEAVE_UI.savedFromEarlier}</span>
                                <span className="font-semibold text-[#0F172A]">{card.carriedForward}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span>{LEAVE_UI.youCanTakeThisMonth}</span>
                                <span className="font-semibold text-[#0F766E]">{takeable}</span>
                              </div>
                              {card.probationFrozenBalance != null && card.probationFrozenBalance > 0 ? (
                                <div className="mt-1 flex items-center justify-between">
                                  <span>{LEAVE_UI.lockedUntilConfirmation}</span>
                                  <span className="font-semibold text-[#0F172A]">{card.probationFrozenBalance}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                    {(leaveBalance?.probation?.inProbation || leaveTypeCards.some((c) => c.inProbation)) && (
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                        {leaveBalance?.probation?.note || LEAVE_UI.probationBanner}
                      </p>
                    )}
                    {leaveStats && (
                      <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#475569]">
                        <p className="font-semibold text-[#0F172A] mb-2">Leave summary</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <span>{LEAVE_UI.yearlyLimitAll}: <strong>{leaveStats.annualQuota}</strong></span>
                          <span>{LEAVE_UI.addedThisMonth}: <strong>+{leaveStats.earnedThisMonth}</strong></span>
                          <span>{LEAVE_UI.youCanTakeThisMonth}: <strong>{leaveStats.takeableThisMonth ?? leaveStats.available}</strong></span>
                          <span>{LEAVE_UI.used}: <strong>{leaveStats.used}</strong></span>
                          <span>{LEAVE_UI.savedFromEarlier}: <strong>{leaveStats.carriedForward}</strong></span>
                          <span>{LEAVE_UI.hrAdjustment}: <strong>{leaveStats.manualAdjustment}</strong></span>
                        </div>
                      </div>
                    )}
                  </>
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
                          {formatStatusLabel(row.displayStatus)}
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
                          <p className="mt-0.5 font-semibold text-[#1E293B]">{row.durationLabel}</p>
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
                          <td className="px-4 py-3">{row.durationLabel}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${leaveStatusPill(row.displayStatus)}`}>
                              {formatStatusLabel(row.displayStatus)}
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
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#334155]">
                  Regularization history —{' '}
                  {calendarCursor.toLocaleString('default', { month: 'long' })} {calendarCursor.getFullYear()}
                </p>
                <button
                  onClick={() => navigate('/my-attendance-regularization')}
                  className="w-full rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#475569] hover:border-[#20C997] hover:text-[#0F766E] sm:w-auto"
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
                        {formatStatusLabel(row.status)}
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
                            {formatStatusLabel(row.status)}
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

