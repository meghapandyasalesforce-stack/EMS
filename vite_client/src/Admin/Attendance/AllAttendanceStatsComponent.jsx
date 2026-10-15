import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch,
  FiDownload,
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
  FiMoreHorizontal,
  FiAlertTriangle,
  FiClock,
  FiHome,
  FiBriefcase,
  FiCoffee,
  FiX,
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import axios from '../../utils/axios';
import { BOTH_ATTENDANCE_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import { useSignedProfilePhoto } from '../../Hooks/useSignedProfilePhoto';
import {
  fetchTeamAttendanceHistory,
  fetchEmployeeAttendanceDetails,
  clearEmployeeDetails,
} from '../../context/attendanceSlice';
import { fetchOrganizationTimezone } from '../../context/timezoneSlice';
import {
  formatAttendanceDateKey,
  resolveAttendanceDateKeyFromRow,
} from '../../utils/orgTimezone';
import { formatAttendanceStatusLabel, UI_BADGE_TEXT_CLASS } from '../../utils/textFormat.js';

const TEAL = '#0a8f6c';
const TEAL_LIGHT = '#e8f7f2';
const ORANGE = '#ea580c';
const RED = '#dc2626';
const SKY = '#0ea5e9';
const VIOLET = '#7c3aed';

/** When redux-persist rehydrates old state without teamAttendanceHistory */
const EMPTY_TEAM_HISTORY = Object.freeze({
  loading: false,
  error: null,
  records: [],
  total: 0,
  page: 1,
  limit: 25,
  kpis: null,
  dailyTrend: [],
  memberBreakdown: [],
});

const MONTH_SHORT = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Local calendar yyyy-MM-dd for month filter UI only (API interprets keys in org TZ). */
function toLocalDateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateInput(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonthDate(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonthDate(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
}

function initials(emp) {
  const bits = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim();
  return (
    bits
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function RowAvatar({ employee, sizeClass = 'h-10 w-10' }) {
  const [broken, setBroken] = useState(false);
  const userId = employee?._id || employee?.id || null;
  const { photoUrl: url } = useSignedProfilePhoto(
    employee?.profilePhoto || employee?.profilePicture,
    { userType: 'employee', userId }
  );
  const letter = initials(employee);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-bold text-white ${sizeClass}`}
      style={{
        background: `linear-gradient(135deg, ${TEAL} 0%, #14b887 100%)`,
      }}
    >
      {url && !broken ? (
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-xs">{letter}</span>
      )}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatHours(dec) {
  if (dec == null || Number.isNaN(Number(dec))) return '0h 0m';
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  return `${h}h ${m}m`;
}

function toBreakMinutes(record) {
  if (record?.breakMinutes != null && Number.isFinite(Number(record.breakMinutes))) {
    return Math.max(0, Number(record.breakMinutes));
  }
  let mins = 0;
  const breaks = record?.breaks;
  if (Array.isArray(breaks)) {
    for (const b of breaks) {
      if (!b?.breakIn || !b?.breakOut) continue;
      const ms = new Date(b.breakOut) - new Date(b.breakIn);
      if (Number.isFinite(ms) && ms > 0) mins += Math.round(ms / 60000);
    }
  }
  return mins;
}

function formatBreakMinutes(minsRaw) {
  const mins = Math.max(0, Math.round(Number(minsRaw) || 0));
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusBadge(uiStatus) {
  const map = {
    present: {
      label: formatAttendanceStatusLabel('present'),
      className: UI_BADGE_TEXT_CLASS,
      style: { background: `${TEAL}18`, color: TEAL },
    },
    late: {
      label: formatAttendanceStatusLabel('late'),
      className: UI_BADGE_TEXT_CLASS,
      style: { background: `${ORANGE}18`, color: ORANGE },
    },
    absent: {
      label: formatAttendanceStatusLabel('absent'),
      className: UI_BADGE_TEXT_CLASS,
      style: { background: `${RED}18`, color: RED },
    },
    wfh: {
      label: formatAttendanceStatusLabel('wfh'),
      className: UI_BADGE_TEXT_CLASS,
      style: { background: `${SKY}18`, color: SKY },
    },
    leave: {
      label: formatAttendanceStatusLabel('leave'),
      className: UI_BADGE_TEXT_CLASS,
      style: { background: `${VIOLET}18`, color: VIOLET },
    },
  };
  const m = map[uiStatus] || map.present;
  return (
    <span className={m.className} style={m.style}>
      {m.label}
    </span>
  );
}

const AllAttendanceStatsComponent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const attendanceState = useSelector((s) => s.attendance) ?? {};
  const { employeeDetails, employeeStats } = attendanceState;
  const team = attendanceState.teamAttendanceHistory ?? EMPTY_TEAM_HISTORY;
  const orgTimezone = useSelector((s) => s.timezone?.timezone) || 'UTC';

  const formatRowDate = useCallback(
    (row) => formatAttendanceDateKey(resolveAttendanceDateKeyFromRow(row, orgTimezone), 'd MMM yyyy', orgTimezone),
    [orgTimezone]
  );

  const formatRowDateIso = useCallback(
    (row) => resolveAttendanceDateKeyFromRow(row, orgTimezone) || '—',
    [orgTimezone]
  );

  useEffect(() => {
    dispatch(fetchOrganizationTimezone());
  }, [dispatch]);

  const now = useMemo(() => new Date(), []);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [activeMonth, setActiveMonth] = useState(now.getMonth());
  const [{ startDate, endDate }, setRange] = useState(() => ({
    ...monthRange(now.getFullYear(), now.getMonth()),
  }));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [selectedBreaksRow, setSelectedBreaksRow] = useState(null);
  const [showBreaksModal, setShowBreaksModal] = useState(false);
  
  // Export selection state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null); // 'date' or 'month'
  const [exportScope, setExportScope] = useState(null); // 'all' or 'particular'
  const [selectedExportEmployee, setSelectedExportEmployee] = useState(null);
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [loadingEmployeesList, setLoadingEmployeesList] = useState(false);
  const [selectedExportDate, setSelectedExportDate] = useState(new Date());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  /** Keep year + month pills aligned when From/To match a full calendar month */
  useEffect(() => {
    const s = new Date(`${startDate}T12:00:00`);
    if (Number.isNaN(s.getTime())) return;
    const y = s.getFullYear();
    const m = s.getMonth();
    const { startDate: expStart, endDate: expEnd } = monthRange(y, m);
    if (startDate === expStart && endDate === expEnd) {
      setFilterYear(y);
      setActiveMonth(m);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${BOTH_ATTENDANCE_ENDPOINT}/all-employee-list`)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data?.employees || [];
        const next = new Set();
        for (const e of rows) {
          const d = String(e?.department || '').trim();
          if (d) next.add(d);
        }
        setDepartmentOptions(Array.from(next).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
      })
      .catch(() => {
        if (!cancelled) setDepartmentOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const departmentSelectOptions = useMemo(() => {
    const list = [...departmentOptions];
    if (departmentFilter && !list.includes(departmentFilter)) {
      list.push(departmentFilter);
    }
    return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [departmentOptions, departmentFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, debouncedSearch, statusFilter, sortBy, startDate, endDate, rowsPerPage]);

  useEffect(() => {
    dispatch(
      fetchTeamAttendanceHistory({
        startDate,
        endDate,
        department: departmentFilter || undefined,
        search: debouncedSearch || undefined,
        status: statusFilter,
        sort: sortBy,
        page,
        limit: rowsPerPage,
      })
    );
  }, [
    dispatch,
    startDate,
    endDate,
    departmentFilter,
    debouncedSearch,
    statusFilter,
    sortBy,
    page,
    rowsPerPage,
  ]);

  const selectMonth = (monthIndex) => {
    setActiveMonth(monthIndex);
    setRange(monthRange(filterYear, monthIndex));
  };

  const selectYear = (y) => {
    setFilterYear(y);
    setRange(monthRange(y, activeMonth));
  };

  const handleEmployeeView = useCallback(
    (employeeId) => {
      setSelectedEmployeeId(employeeId);
      setShowEmployeeDetails(true);
      dispatch(clearEmployeeDetails());
    },
    [dispatch]
  );

  useEffect(() => {
    if (!showEmployeeDetails || !selectedEmployeeId) return;
    dispatch(
      fetchEmployeeAttendanceDetails({
        employeeId: selectedEmployeeId,
        params: { startDate, endDate, full: true },
      })
    );
  }, [dispatch, showEmployeeDetails, selectedEmployeeId, startDate, endDate]);

  const handleBackToList = () => {
    setShowEmployeeDetails(false);
    setSelectedEmployeeId(null);
    dispatch(clearEmployeeDetails());
  };

  const handleViewBreaks = (row) => {
    setSelectedBreaksRow(row);
    setShowBreaksModal(true);
  };

  const handleCloseBreaksModal = () => {
    setShowBreaksModal(false);
    setSelectedBreaksRow(null);
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
        startDate: toLocalDateKey(monthStart),
        endDate: toLocalDateKey(monthEnd),
        limit: 1000
      };
      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/team-attendance-history`, { params });
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
        startDate: toLocalDateKey(targetDate),
        endDate: toLocalDateKey(targetDate),
        limit: 1000
      };

      toast.loading('Exporting date-wise data...', { toastId: 'exportDate' });

      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/team-attendance-history`, { params });
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
        const breakDurations = getIndividualBreakDurations(record);
        const totalDuration = breakDurations.reduce((sum, b) => sum + b.duration, 0);
        const empName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ');
        
        const getBreakDuration = (breakType) => {
          const found = breakDurations.find(b => b.breakType === breakType);
          return found ? formatBreakDuration(found.duration) : '--';
        };

        exportData.push({
          'Employee Name': empName,
          'Employee ID': record.employee?.employeeId || '--',
          'Date': formatRowDate(record),
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
      
      const dateStr = toLocalDateKey(targetDate);
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
        startDate: toLocalDateKey(monthStart),
        endDate: toLocalDateKey(monthEnd),
        limit: 1000
      };

      toast.loading('Exporting month-wise data...', { toastId: 'exportMonth' });

      const res = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/team-attendance-history`, { params });
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
        const breakDurations = getIndividualBreakDurations(record);
        const totalDuration = breakDurations.reduce((sum, b) => sum + b.duration, 0);
        const empName = [record.employee?.name, record.employee?.lastName].filter(Boolean).join(' ');
        
        const getBreakDuration = (breakType) => {
          const found = breakDurations.find(b => b.breakType === breakType);
          return found ? formatBreakDuration(found.duration) : '--';
        };

        exportData.push({
          'Employee Name': empName,
          'Employee ID': record.employee?.employeeId || '--',
          'Date': formatRowDate(record),
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

  const formatBreakDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getIndividualBreakDurations = (row) => {
    if (!row?.breaks || !Array.isArray(row.breaks)) return [];
    return row.breaks.map((entry, index) => {
      if (!entry?.breakIn) return null;
      const breakIn = new Date(entry.breakIn).getTime();
      if (!Number.isFinite(breakIn)) return null;
      const breakOut = entry.breakOut ? new Date(entry.breakOut).getTime() : new Date().getTime();
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

  const totalPages = Math.max(1, Math.ceil((team.total || 0) / (team.limit || rowsPerPage)));

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const paramsBase = {
        startDate,
        endDate,
        department: departmentFilter || undefined,
        search: debouncedSearch || undefined,
        status: statusFilter,
        sort: sortBy,
        limit: 500,
      };
      const rowsOut = [];
      let p = 1;
      /* eslint-disable no-await-in-loop */
      while (true) {
        const { data } = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/team-attendance-history`, {
          params: { ...paramsBase, page: p },
        });
        const chunk = data?.records || [];
        rowsOut.push(...chunk);
        if (!chunk.length || rowsOut.length >= (data.total ?? 0)) break;
        p += 1;
        if (p > 40) break;
      }
      /* eslint-enable no-await-in-loop */

      const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      // Existing columns preserved; new columns appended at the end only.
      const headers = [
        'Name', 'Email', 'Department', 'Date', 'In', 'Out', 'Hours', 'Break', 'Status', 'Location',
        'Employee ID', 'Attendance Type', 'Verified Status',
      ];
      const lines = [headers.join(',')];
      for (const r of rowsOut) {
        const name = [r.employee?.name, r.employee?.lastName].filter(Boolean).join(' ').trim();
        const isWfh = r.uiStatus === 'wfh' || r.workLocation === 'work_from_home';
        const hasPunch = !!r.clockIn;
        const loc =
          r.uiStatus === 'wfh'
            ? 'Remote'
            : r.uiStatus === 'absent' || r.uiStatus === 'leave'
              ? '—'
              : 'Office';
        const attendanceType = !hasPunch ? '—' : isWfh ? 'Work From Home' : 'Office';
        // Verified applies to office punches only (GPS geofence match)
        const verifiedStatus = !hasPunch || isWfh
          ? 'N/A'
          : r.locationVerified === true
            ? 'Verified'
            : 'Non-Verified';
        lines.push(
          [
            escape(name),
            escape(r.employee?.email),
            escape(r.employee?.department),
            escape(resolveAttendanceDateKeyFromRow(r, orgTimezone)),
            escape(formatTime(r.clockIn)),
            escape(formatTime(r.clockOut)),
            escape(formatHours(r.effectiveHours)),
            escape(formatBreakMinutes(toBreakMinutes(r))),
            escape(r.uiStatus),
            escape(loc),
            escape(r.employee?.employeeId),
            escape(attendanceType),
            escape(verifiedStatus),
          ].join(',')
        );
      }
      // UTF-8 BOM so Excel decodes special characters (e.g. em dash) correctly
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-history-${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const kpis = team.kpis || {};
  const dailyData = team.dailyTrend || [];
  const memberData = (team.memberBreakdown || []).map((m) => ({
    ...m,
    stackTotal: m.present + m.late + m.absent + m.wfh + m.leave,
  }));

  if (team.loading && !team.records?.length) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-500">
        Loading attendance history…
      </div>
    );
  }

  const errMsg = team.error?.message || team.error?.data?.message;

  if (showEmployeeDetails && !employeeDetails) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-500">
        Loading employee details…
      </div>
    );
  }

  if (showEmployeeDetails && employeeDetails) {
    const recordsFull = employeeStats?.recentRecords || [];
    return (
      <div className="page-shell min-h-screen bg-[#f4f7f6]">
        <div className="page-shell-inner hrms-stack">
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: TEAL }}
          >
            <FiChevronLeft className="h-5 w-5" />
            Back to team history
          </button>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {employeeDetails.name} {employeeDetails.lastName || ''}
              {employeeDetails.employeeId ? (
                <span className="text-slate-500 font-normal text-lg ml-2">({employeeDetails.employeeId})</span>
              ) : null}
            </h2>
            <p className="text-slate-600 text-sm">
              {employeeDetails.position} · {employeeDetails.department}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="rounded-xl p-4" style={{ background: TEAL_LIGHT }}>
                <p className="text-xs text-slate-600 uppercase tracking-wide">Present</p>
                <p className="text-2xl font-bold" style={{ color: TEAL }}>
                  {employeeStats?.statistics?.presentDays ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-600 uppercase tracking-wide">Absent</p>
                <p className="text-2xl font-bold text-slate-900">{employeeStats?.statistics?.absentDays ?? '—'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-600 uppercase tracking-wide">Rate</p>
                <p className="text-2xl font-bold text-slate-900">
                  {employeeStats?.statistics?.attendanceRate != null
                    ? `${(employeeStats.statistics.attendanceRate * 100).toFixed(1)}%`
                    : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-600 uppercase tracking-wide">Late arrivals</p>
                <p className="text-2xl font-bold text-slate-900">{employeeStats?.statistics?.lateArrivals ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">
                Records in selected range ({startDate} → {endDate})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/80">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Check in</th>
                    <th className="px-6 py-3">Check out</th>
                    <th className="px-6 py-3">Hours</th>
                    <th className="px-6 py-3">Break</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recordsFull.map((record) => (
                    <tr key={record._id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        {formatRowDateIso(record)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">{formatTime(record.clockIn)}</td>
                      <td className="px-6 py-3 whitespace-nowrap">{formatTime(record.clockOut)}</td>
                      <td className="px-6 py-3">{formatHours(record.effectiveHours)}</td>
                      <td className="px-6 py-3 whitespace-nowrap">{formatBreakMinutes(toBreakMinutes(record))}</td>
                      <td className="px-6 py-3 capitalize">{record.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recordsFull.length ? (
                <p className="px-6 py-8 text-center text-slate-500">No records in this period.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusActions = {
    absent: FiAlertTriangle,
    late: FiClock,
    wfh: FiHome,
  };

  return (
    <div className="page-shell min-h-screen bg-[#f4f7f6]">
      <div className="page-shell-inner hrms-stack">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Attendance History</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/today-attendance')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-white/80 bg-white disabled:opacity-50"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              <FiActivity className="h-4 w-4" />
              Today's live roster
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || team.loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              style={{ background: TEAL }}
            >
              <FiDownload className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </header>

        {errMsg ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errMsg}</div>
        ) : null}

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Search team member
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <input
                  type="search"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/30 focus:border-[#0a8f6c]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setRange({ startDate: e.target.value, endDate })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setRange({ startDate, endDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">Year</span>
            <select
              value={filterYear}
              onChange={(e) => selectYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {MONTH_SHORT.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => selectMonth(idx)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeMonth === idx ? 'text-white shadow' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                style={
                  activeMonth === idx ? { background: TEAL, boxShadow: `0 1px 2px ${TEAL}44` } : undefined
                }
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { id: 'all', label: 'All' },
              { id: 'present', label: 'Present' },
              { id: 'late', label: 'Late' },
              { id: 'absent', label: 'Absent' },
              { id: 'leave', label: 'On Leave' },
              { id: 'office', label: 'Office' },
              { id: 'wfh', label: 'WFH' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  statusFilter === chip.id
                    ? chip.id === 'all'
                      ? 'border-2 shadow-sm'
                      : 'border-transparent text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
                style={
                  statusFilter === chip.id && chip.id === 'all'
                    ? { borderColor: TEAL, background: TEAL_LIGHT, color: TEAL }
                    : statusFilter === chip.id && chip.id !== 'all'
                      ? { background: TEAL, borderColor: TEAL }
                      : undefined
                }
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm min-w-0 w-full sm:min-w-[200px] max-w-full"
              >
                <option value="">All departments</option>
                {departmentSelectOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm min-w-0 w-full sm:min-w-[200px]"
              >
                <option value="date_desc">Date descending</option>
                <option value="date_asc">Date ascending</option>
              </select>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Avg attendance %',
              value: `${kpis.avgAttendancePct ?? 0}%`,
              sub: 'Days with a record, not absent',
              accent: TEAL,
            },
            {
              title: 'Total late days',
              value: String(kpis.totalLateDays ?? 0).padStart(2, '0'),
              sub: 'In selected range',
              accent: ORANGE,
            },
            {
              title: 'Total absent days',
              value: String(kpis.totalAbsentDays ?? 0).padStart(2, '0'),
              sub: 'Unplanned absence',
              accent: RED,
            },
            {
              title: 'WFH days',
              value: String(kpis.wfhDays ?? 0),
              sub: 'Remote',
              accent: SKY,
            },
          ].map((card) => (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-5 shadow-sm"
            >
              <div
                className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10 pointer-events-none"
                style={{ background: card.accent }}
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{card.title}</p>
              <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              <p className="text-sm text-slate-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Daily attendance %</h3>
            <div className="h-[280px] w-full">
              {dailyData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip formatter={(value) => [`${value}%`, 'Attendance']} />
                    <ReferenceLine y={85} stroke="#94a3b8" strokeDasharray="6 6" label={{ value: '85%', fill: '#64748b', fontSize: 10 }} />
                    <Bar dataKey="pct" fill={TEAL} radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  No trend data for this filter
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Status distribution (by member)</h3>
            <div className="h-[280px] w-full">
              {memberData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={memberData}
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="present" name="Present" stackId="s" fill={TEAL} />
                    <Bar dataKey="late" name="Late" stackId="s" fill={ORANGE} />
                    <Bar dataKey="absent" name="Absent" stackId="s" fill={RED} />
                    <Bar dataKey="wfh" name="WFH" stackId="s" fill={SKY} />
                    <Bar dataKey="leave" name="Leave" stackId="s" fill={VIOLET} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  No member breakdown yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/90 border-b border-slate-100">
                  <th className="px-4 py-4 pl-6">Team member</th>
                  <th className="px-4 py-4">Shift</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Check in / out</th>
                  <th className="px-4 py-4">Hours</th>
                  <th className="px-4 py-4">Break</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Location</th>
                  <th className="px-4 py-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(team.records || []).map((row) => {
                  const emp = row.employee;
                  const title = emp?.position || '—';
                  const displayName = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim();
                  const hasPunch = row.clockIn || row.clockOut;
                  const locMeta =
                    row.uiStatus === 'wfh'
                      ? { Icon: FiHome, label: 'Remote' }
                      : row.uiStatus === 'absent' || row.uiStatus === 'leave'
                        ? null
                        : { Icon: FiBriefcase, label: 'Office' };
                  const ActionIcon = statusActions[row.uiStatus];
                  const LocIcon = locMeta?.Icon;
                  const empId = emp?._id;
                  const canOpenProfile = !!empId;

                  return (
                    <tr key={row._id} className="hover:bg-[#fafcfc] transition-colors">
                      <td className="px-4 py-4 pl-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <RowAvatar employee={emp} />
                          <div>
                            <p className="font-semibold text-slate-900">{displayName}</p>
                            <p className="text-xs text-slate-500">{title}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-700">
                        {row.shiftName || emp?.shiftName || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-700">
                        {formatRowDate(row)}
                      </td>
                      <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                        {hasPunch ? (
                          <div className="text-xs sm:text-sm">
                            <span className="font-medium text-slate-900">IN:</span> {formatTime(row.clockIn)}
                            {' · '}
                            <span className="font-medium text-slate-900">OUT:</span> {formatTime(row.clockOut)}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No entry recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                        {!hasPunch && row.uiStatus === 'absent' ? (
                          <span className="text-slate-400">0h 0m</span>
                        ) : (
                          formatHours(row.effectiveHours)
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-slate-800">
                            {formatBreakMinutes(toBreakMinutes(row))}
                          </div>
                          {row.breaks && row.breaks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleViewBreaks(row)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a8f6c] text-white text-xs font-semibold hover:bg-[#0d9488] transition-all shadow-sm hover:shadow-md"
                            >
                              <FiCoffee className="h-3.5 w-3.5" />
                              View Breaks
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{statusBadge(row.uiStatus)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                        {locMeta && LocIcon ? (
                          <span className="inline-flex items-center gap-1">
                            <LocIcon className="h-4 w-4 shrink-0" />
                            {locMeta.label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-4 pr-6 text-right whitespace-nowrap">
                        {ActionIcon ? (
                          <button
                            type="button"
                            disabled={!canOpenProfile}
                            onClick={() => canOpenProfile && handleEmployeeView(empId)}
                            className="inline-flex disabled:opacity-40 disabled:pointer-events-none"
                            title="Employee details"
                            aria-label="Employee details"
                          >
                            <ActionIcon
                              className="inline h-5 w-5"
                              style={{
                                color: row.uiStatus === 'absent' ? RED : row.uiStatus === 'late' ? ORANGE : SKY,
                              }}
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canOpenProfile}
                            onClick={() => canOpenProfile && handleEmployeeView(empId)}
                            className="inline-flex p-1 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-40 disabled:pointer-events-none"
                            aria-label="Employee details"
                          >
                            <FiMoreHorizontal className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!canOpenProfile}
                          onClick={() => canOpenProfile && handleEmployeeView(empId)}
                          className="ml-3 text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
                          style={{ color: TEAL }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!team.records?.length && !team.loading ? (
            <p className="py-8 sm:py-10 text-center text-slate-500 text-sm">No attendance rows match your filters.</p>
          ) : null}

          <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-slate-600">
              Showing{' '}
              {team.total ? (team.page - 1) * team.limit + 1 : 0}
              –
              {Math.min(team.page * team.limit, team.total || 0)} of {team.total || 0} records
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <FiChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-slate-600">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
              >
                <FiChevronRight className="h-5 w-5" />
              </button>
            </div>
          </footer>
        </div>

        {/* Break Details Modal */}
        {showBreaksModal && selectedBreaksRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#ecfdf5] flex items-center justify-center shrink-0">
                    <FiCoffee className="h-6 w-6 text-[#0a8f6c]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Break Details</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selectedBreaksRow.employee?.name} {selectedBreaksRow.employee?.lastName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatRowDate(selectedBreaksRow)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportEmployeeDateToExcel}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a8f6c] text-white text-xs font-semibold hover:bg-[#0d9488] transition-colors"
                  >
                    <FiDownload className="h-3.5 w-3.5" />
                    Export Date
                  </button>
                  <button
                    type="button"
                    onClick={handleExportEmployeeMonthToExcel}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a8f6c] text-white text-xs font-semibold hover:bg-[#0d9488] transition-colors"
                  >
                    <FiDownload className="h-3.5 w-3.5" />
                    Export Month
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseBreaksModal}
                    className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
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
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${breakInfo.isActive ? 'bg-amber-100' : 'bg-[#ecfdf5]'}`}>
                          <FiCoffee className={`h-5 w-5 ${breakInfo.isActive ? 'text-amber-600' : 'text-[#0a8f6c]'}`} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900">
                            {breakInfo.breakType === 'LUNCH' ? 'Lunch' : breakInfo.breakType.replace('BREAK_', 'Break ')}
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

        {/* Export Selection Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#ecfdf5] flex items-center justify-center shrink-0">
                    <FiDownload className="h-6 w-6 text-[#0a8f6c]" />
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
                            ? 'border-[#0a8f6c] bg-[#ecfdf5] text-[#0a8f6c]'
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
                            ? 'border-[#0a8f6c] bg-[#ecfdf5] text-[#0a8f6c]'
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
                          className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a8f6c] focus:border-transparent"
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
                        value={toLocalDateKey(selectedExportDate)}
                        onChange={(e) => setSelectedExportDate(new Date(e.target.value))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a8f6c] focus:border-transparent"
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
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a8f6c] focus:border-transparent"
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
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0a8f6c] text-white font-semibold hover:bg-[#0d9488] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiDownload className="h-5 w-5" />
                  Export Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllAttendanceStatsComponent;
