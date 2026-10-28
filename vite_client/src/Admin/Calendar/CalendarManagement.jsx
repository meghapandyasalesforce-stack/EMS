import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FiCalendar, FiPlus, FiEdit, FiTrash2, FiClock, FiMapPin, FiUpload, FiArrowLeft, FiList, FiHome, FiX, FiSearch } from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';
import '../../styles/holidayCalendarUI.css';

// ======================== Axios Configuration ========================
const API_BASE_URL = '/api/v1';

const toLocalDateKey = (value) => {
  if (!value) return '';
  // Date-only strings are local civil dates
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }
  // ISO datetimes from API must use local Y/M/D — never slice the UTC prefix
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const employeeDisplayName = (emp) =>
  [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.email || 'Employee';

const formatDisplayDate = (key) => {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || '';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shiftDateKey = (key, days) => {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toLocalDateKey(dt);
};

/** Expand a date key to the full contiguous WFH block that contains it */
const expandContiguousWfhRange = (key, wfhMap) => {
  if (!key || !wfhMap?.has(key)) return null;
  let from = key;
  let to = key;
  while (wfhMap.has(shiftDateKey(from, -1))) from = shiftDateKey(from, -1);
  while (wfhMap.has(shiftDateKey(to, 1))) to = shiftDateKey(to, 1);
  return { from, to };
};

/** Collapse consecutive YYYY-MM-DD keys into "from … to …" segments for display */
const formatExistingWfhRanges = (keys) => {
  if (!keys?.length) return '';
  const sorted = [...keys].sort();
  const segments = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    if (cur === shiftDateKey(prev, 1)) {
      prev = cur;
      continue;
    }
    segments.push(`${formatDisplayDate(start)} to ${formatDisplayDate(prev)}`);
    start = cur;
    prev = cur;
  }
  segments.push(`${formatDisplayDate(start)} to ${formatDisplayDate(prev)}`);
  return segments.join(', ');
};

const UPLOAD_LEGACY_DESC_MARKERS = [
  'Auto-generated from calendar',
  'Auto-detected from calendar file',
];

const isUploadedHoliday = (holiday) => {
  if (!holiday) return false;
  if (holiday.source === 'upload') return true;
  const desc = holiday.description || '';
  return UPLOAD_LEGACY_DESC_MARKERS.some((m) => desc.includes(m));
};

// ======================== Main Component ========================
const CalendarManagement = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true );
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWfhModal, setShowWfhModal] = useState(false);
  const [wfhSaving, setWfhSaving] = useState(false);
  const [wfhForm, setWfhForm] = useState({
    dateFrom: '',
    dateTo: '',
    note: '',
    employeeAccess: 'all_except', // all_except | only_these
    excludedEmployeeIds: [],
  });
  const [excludedEmployees, setExcludedEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState([]);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const [wfhDepartments, setWfhDepartments] = useState([]);
  const [wfhDepartment, setWfhDepartment] = useState('');
  const [wfhDepartmentLoading, setWfhDepartmentLoading] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'holidays'
  const [uploading, setUploading] = useState(false);
  const todayDateString = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Holiday form state
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'national',
    description: '',
    isRecurring: false,
    recurringPattern: 'yearly'
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    workingDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    },
    workingHours: {
      startTime: '10:00',
      endTime: '19:00',
      breakDuration: 60
    }
  });

  // Add CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      .animate-slideUp { animation: slideUp 0.4s ease-out; }
      .animate-slideDown { animation: slideDown 0.3s ease-out; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/admin/calendar/${currentYear}`);
      const calendarData = response.data.data || response.data;
      setCalendar(calendarData);
      if (calendarData.workingDays) {
        setSettingsForm(prev => ({
          ...prev,
          workingDays: { ...prev.workingDays, ...calendarData.workingDays }
        }));
      }
      if (calendarData.workingHours) {
        setSettingsForm(prev => ({
          ...prev,
          workingHours: { ...prev.workingHours, ...calendarData.workingHours }
        }));
      }
    } catch (error) {
      toast.error('Failed to fetch calendar');
      console.error('Fetch calendar error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Holiday CRUD
  const getValidationMessage = (error, fallbackMessage) => {
    const data = error?.response?.data;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const firstError = data.errors[0];
      if (typeof firstError === 'string') return firstError;
      if (firstError?.date) return firstError.date;
      if (firstError?.message) return firstError.message;
      if (firstError?.year) return firstError.year;
    }
    if (data?.message) return data.message;
    return fallbackMessage;
  };

  const isPastHoliday = (dateValue) => {
    if (!dateValue) return false;
    const holidayDate = new Date(dateValue);
    holidayDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return holidayDate < today;
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (isPastHoliday(holidayForm.date)) {
      toast.error('Cannot add holidays for past dates. Select today or a future date.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/admin/calendar/${currentYear}/holidays`, holidayForm);
      toast.success('Holiday added successfully');
      setShowHolidayModal(false);
      resetHolidayForm();
      fetchCalendar(); // refresh
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to add holiday'));
      console.error('Add holiday error:', error);
    }
  };

  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    if (isPastHoliday(holidayForm.date)) {
      toast.error('Cannot update holiday to a past date. Select today or a future date.');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/admin/calendar/${currentYear}/holidays/${selectedHoliday._id}`, holidayForm);
      toast.success('Holiday updated successfully');
      setShowHolidayModal(false);
      resetHolidayForm();
      fetchCalendar();
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to update holiday'));
      console.error('Update holiday error:', error);
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    const targetHoliday = calendar?.holidays?.find((h) => h._id === holidayId);
    if (targetHoliday && isPastHoliday(targetHoliday.date)) {
      toast.error('Past holidays cannot be deleted.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await axios.delete(`${API_BASE_URL}/admin/calendar/${currentYear}/holidays/${holidayId}`);
        toast.success('Holiday deleted successfully');
        fetchCalendar();
      } catch (error) {
        toast.error(getValidationMessage(error, 'Failed to delete holiday'));
        console.error('Delete holiday error:', error);
      }
    }
  };

  const [convertHoliday, setConvertHoliday] = useState(null);
  const [convertSaving, setConvertSaving] = useState(false);

  const handleConvertHolidayToWorking = async (workMode) => {
    if (!convertHoliday?._id) return;
    try {
      setConvertSaving(true);
      const res = await axios.post(
        `${API_BASE_URL}/admin/calendar/${currentYear}/holidays/${convertHoliday._id}/convert-to-working`,
        { workMode }
      );
      const data = res.data?.data || res.data;
      if (data?.holidays || data?.wfhDates) {
        setCalendar((prev) =>
          prev
            ? {
                ...prev,
                holidays: data.holidays || prev.holidays,
                wfhDates: data.wfhDates || prev.wfhDates,
              }
            : prev
        );
      }
      toast.success(res.data?.message || 'Holiday converted to working day');
      setConvertHoliday(null);
      fetchCalendar();
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to convert holiday'));
    } finally {
      setConvertSaving(false);
    }
  };

  const handleRestoreHoliday = async (holiday) => {
    if (!holiday?._id) return;
    if (!window.confirm(`Restore “${holiday.name}” as a holiday (non-working day)?`)) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/calendar/${currentYear}/holidays/${holiday._id}/restore-holiday`
      );
      const data = res.data?.data || res.data;
      if (data?.holidays || data?.wfhDates) {
        setCalendar((prev) =>
          prev
            ? {
                ...prev,
                holidays: data.holidays || prev.holidays,
                wfhDates: data.wfhDates || prev.wfhDates,
              }
            : prev
        );
      }
      toast.success(res.data?.message || 'Holiday restored');
      fetchCalendar();
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to restore holiday'));
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      await Promise.all([
        axios.put(`${API_BASE_URL}/admin/calendar/${currentYear}/working-days`, { workingDays: settingsForm.workingDays }),
        axios.put(`${API_BASE_URL}/admin/calendar/${currentYear}/working-hours`, { workingHours: settingsForm.workingHours })
      ]);
      toast.success('Settings updated successfully');
      setShowSettingsModal(false);
      fetchCalendar();
    } catch (error) {
      toast.error('Failed to update settings');
      console.error('Update settings error:', error);
    }
  };

  const resetHolidayForm = () => {
    setHolidayForm({
      name: '',
      date: '',
      type: 'national',
      description: '',
      isRecurring: false,
      recurringPattern: 'yearly'
    });
    setSelectedHoliday(null);
  };

  const openEditHoliday = (holiday) => {
    setSelectedHoliday(holiday);
    setHolidayForm({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      type: holiday.type,
      description: holiday.description || '',
      isRecurring: holiday.isRecurring,
      recurringPattern: holiday.recurringPattern
    });
    setShowHolidayModal(true);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const fileInput = document.getElementById('calendarFile');
    if (!fileInput.files[0]) {
      toast.error('Please select a file to upload');
      return;
    }
    formData.append('calendarFile', fileInput.files[0]);
    try {
      setUploading(true);
      const response = await axios.post(`${API_BASE_URL}/admin/calendar/${currentYear}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const extractedHolidays = response.data.data?.extractedHolidays || response.data.extractedHolidays || 0;
      toast.success(`Calendar file processed successfully! ${extractedHolidays} holidays added.`);
      setShowUploadModal(false);
      fetchCalendar();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload calendar file');
      console.error('File upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  // Calendar helpers
  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const getHolidaysForMonth = (month) => {
    if (!calendar?.holidays) return [];
    return calendar.holidays
      .filter((holiday) => {
        const holidayDate = new Date(holiday.date);
        return (
          holidayDate.getMonth() === month - 1 &&
          holidayDate.getFullYear() === currentYear &&
          holiday.isActive !== false
        );
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatHolidayDate = (dateValue) => {
    const d = new Date(dateValue);
    const day = d.getDate();
    const mon = d.toLocaleDateString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
    return `${day} ${mon} ${year} • ${weekday}`;
  };

  const getTypeLabel = (type) => {
    if (type === 'company') return 'Optional';
    if (!type) return 'National';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTypeClass = (type) => {
    if (type === 'company') return 'hol-cal__type--optional';
    if (type === 'national') return 'hol-cal__type--national';
    if (type === 'regional') return 'hol-cal__type--regional';
    if (type === 'religious') return 'hol-cal__type--religious';
    return 'hol-cal__type--national';
  };

  const getHolidayLocation = (holiday) => {
    if (holiday?.location) return holiday.location;
    const desc = String(holiday?.description || '').trim();
    if (desc && !isUploadedHoliday(holiday) && desc.length <= 48) return desc;
    return 'All locations';
  };

  const openAddForMonth = (month) => {
    setSelectedHoliday(null);
    setSelectedMonth(month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(currentYear, month - 1, 1);
    let dateStr;
    if (firstOfMonth >= today) {
      dateStr = `${currentYear}-${String(month).padStart(2, '0')}-01`;
    } else if (
      currentYear === today.getFullYear() &&
      month === today.getMonth() + 1
    ) {
      dateStr = todayDateString;
    } else {
      dateStr = todayDateString;
    }
    setHolidayForm({
      name: '',
      date: dateStr,
      type: 'national',
      description: '',
      isRecurring: false,
      recurringPattern: 'yearly',
    });
    setShowHolidayModal(true);
  };

  const getHolidaysForDay = (day) => {
    if (!day) return [];
    return getHolidaysForMonth(selectedMonth).filter((h) => {
      const d = new Date(h.date);
      return d.getDate() === day;
    });
  };

  const wfhByDateKey = useMemo(() => {
    const map = new Map();
    (calendar?.wfhDates || []).forEach((entry) => {
      const key = toLocalDateKey(entry.date);
      if (key) map.set(key, entry);
    });
    return map;
  }, [calendar?.wfhDates]);

  const getWfhForDay = (day) => {
    if (!day) return null;
    const key = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return wfhByDateKey.get(key) || null;
  };

  const applyExistingWfhToForm = useCallback((dateFrom, dateTo) => {
    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      return {
        note: '',
        employeeAccess: 'all_except',
        excluded: [],
        excludedIds: [],
        hasExisting: false,
      };
    }
    // Prefer an existing entry in the selected range (first match) so edits keep exclusions.
    const cursor = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    let entry = null;
    while (cursor <= end) {
      const key = toLocalDateKey(cursor);
      if (wfhByDateKey.has(key)) {
        entry = wfhByDateKey.get(key);
        break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (!entry) {
      return {
        note: '',
        employeeAccess: 'all_except',
        excluded: [],
        excludedIds: [],
        hasExisting: false,
      };
    }
    const excluded = (entry.excludedEmployeeIds || []).map((emp) =>
      typeof emp === 'object' && emp ? emp : { _id: emp }
    );
    return {
      note: entry.note || '',
      employeeAccess: entry.employeeAccess === 'only_these' ? 'only_these' : 'all_except',
      excluded,
      excludedIds: excluded.map((e) => String(e._id || e)),
      hasExisting: true,
    };
  }, [wfhByDateKey]);

  const loadWfhDepartments = useCallback(async () => {
    try {
      const [orgRes, empRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/organization/profile`).catch(() => null),
        axios
          .get(`${API_BASE_URL}/admin/employee`, { params: { limit: 100, status: 'active' } })
          .catch(() => null),
      ]);
      const orgDepts = (orgRes?.data?.organization?.orgDepartments || [])
        .map((d) => (typeof d === 'string' ? d : d?.name))
        .filter(Boolean);
      const empRows = empRes?.data?.data || empRes?.data?.employees || empRes?.data || [];
      const empDepts = (Array.isArray(empRows) ? empRows : [])
        .map((e) => e?.department)
        .filter(Boolean);
      setWfhDepartments([...new Set([...orgDepts, ...empDepts])].sort());
    } catch {
      setWfhDepartments([]);
    }
  }, []);

  const openEnableWfhModal = (day = null) => {
    const key = day
      ? `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : todayDateString;
    const start = key < todayDateString ? todayDateString : key;
    // If this day sits in an existing WFH block, open the full from–to span
    const block = expandContiguousWfhRange(start, wfhByDateKey);
    const dateFrom = block ? (block.from < todayDateString ? todayDateString : block.from) : start;
    const dateTo = block ? block.to : start;
    const existing = applyExistingWfhToForm(dateFrom, dateTo);
    setWfhForm({
      dateFrom,
      dateTo,
      note: existing.note,
      employeeAccess: 'all_except',
      excludedEmployeeIds: existing.excludedIds,
    });
    setExcludedEmployees(existing.excluded);
    setEmployeeSearch('');
    setEmployeeResults([]);
    setWfhDepartment('');
    setShowWfhModal(true);
    loadWfhDepartments();
  };

  const handleWfhDatesChange = (nextFrom, nextTo) => {
    const existing = applyExistingWfhToForm(nextFrom, nextTo);
    setWfhForm((prev) => ({
      ...prev,
      dateFrom: nextFrom,
      dateTo: nextTo,
      // When switching onto an already-enabled date/range, load saved note/exclusions.
      // Otherwise keep whatever the user already typed/selected in this modal.
      note: existing.hasExisting ? existing.note : prev.note,
      employeeAccess: 'all_except',
      excludedEmployeeIds: existing.hasExisting ? existing.excludedIds : prev.excludedEmployeeIds,
    }));
    if (existing.hasExisting) {
      setExcludedEmployees(existing.excluded);
    }
  };

  const existingWfhInRange = useMemo(() => {
    if (!wfhForm.dateFrom || !wfhForm.dateTo || wfhForm.dateTo < wfhForm.dateFrom) {
      return { keys: [], label: '', hasExisting: false };
    }
    // Collect full contiguous WFH blocks that overlap the selected range
    const covered = new Set();
    const cursor = new Date(`${wfhForm.dateFrom}T00:00:00`);
    const end = new Date(`${wfhForm.dateTo}T00:00:00`);
    while (cursor <= end) {
      const key = toLocalDateKey(cursor);
      if (wfhByDateKey.has(key) && !covered.has(key)) {
        const block = expandContiguousWfhRange(key, wfhByDateKey);
        if (block) {
          let walk = new Date(`${block.from}T00:00:00`);
          const walkEnd = new Date(`${block.to}T00:00:00`);
          while (walk <= walkEnd) {
            covered.add(toLocalDateKey(walk));
            walk.setDate(walk.getDate() + 1);
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    const keys = [...covered].sort();
    return {
      keys,
      label: formatExistingWfhRanges(keys),
      hasExisting: keys.length > 0,
    };
  }, [wfhForm.dateFrom, wfhForm.dateTo, wfhByDateKey]);

  const rangeHasExistingWfh = existingWfhInRange.hasExisting;

  const handleEnableWfh = async (e) => {
    e.preventDefault();
    if (!wfhForm.dateFrom || !wfhForm.dateTo) {
      toast.error('Please select a date range');
      return;
    }
    if (wfhForm.dateTo < wfhForm.dateFrom) {
      toast.error('End date cannot be before start date');
      return;
    }
    const exclusionIds = [...new Set((wfhForm.excludedEmployeeIds || []).map(String).filter(Boolean))];
    try {
      setWfhSaving(true);
      const res = await axios.post(`${API_BASE_URL}/admin/calendar/${currentYear}/wfh`, {
        dateFrom: wfhForm.dateFrom,
        dateTo: wfhForm.dateTo,
        note: wfhForm.note || '',
        employeeAccess: 'all_except',
        excludedEmployeeIds: exclusionIds,
      });
      const savedDates = res.data?.data?.wfhDates || res.data?.wfhDates;
      if (Array.isArray(savedDates)) {
        setCalendar((prev) => (prev ? { ...prev, wfhDates: savedDates } : prev));
      }
      toast.success(res.data?.message || (rangeHasExistingWfh ? 'WFH updated' : 'WFH enabled'));
      setShowWfhModal(false);
      fetchCalendar();
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to save WFH'));
    } finally {
      setWfhSaving(false);
    }
  };

  const handleDisableWfh = async () => {
    if (!wfhForm.dateFrom || !wfhForm.dateTo) return;
    if (!window.confirm('Disable WFH for the selected date range? Employees will no longer be able to apply.')) {
      return;
    }
    try {
      setWfhSaving(true);
      // Prefer explicit date keys so contiguous enabled days in view are cleared even if
      // From/To were edited oddly; fall back to the form range.
      const datesToClear =
        existingWfhInRange.keys?.length > 0
          ? existingWfhInRange.keys
          : null;
      const res = await axios.delete(`${API_BASE_URL}/admin/calendar/${currentYear}/wfh`, {
        data: datesToClear
          ? { dates: datesToClear }
          : { dateFrom: wfhForm.dateFrom, dateTo: wfhForm.dateTo },
      });
      const savedDates = res.data?.data?.wfhDates || res.data?.wfhDates;
      if (Array.isArray(savedDates)) {
        setCalendar((prev) => (prev ? { ...prev, wfhDates: savedDates } : prev));
      }
      toast.success(res.data?.message || 'WFH disabled');
      setShowWfhModal(false);
      fetchCalendar();
    } catch (error) {
      toast.error(getValidationMessage(error, 'Failed to disable WFH'));
    } finally {
      setWfhSaving(false);
    }
  };

  const searchEmployeesForExclusion = async (query) => {
    setEmployeeSearch(query);
    if (!query || query.trim().length < 2) {
      setEmployeeResults([]);
      return;
    }
    try {
      setEmployeeSearchLoading(true);
      const res = await axios.get(`${API_BASE_URL}/admin/employee`, {
        params: { search: query.trim(), limit: 20, status: 'active' },
      });
      const rows = res.data?.data || res.data?.employees || res.data || [];
      setEmployeeResults(Array.isArray(rows) ? rows : []);
    } catch {
      setEmployeeResults([]);
    } finally {
      setEmployeeSearchLoading(false);
    }
  };

  const toggleExcludedEmployee = (emp) => {
    const id = String(emp._id || emp.id);
    const selected = new Set(wfhForm.excludedEmployeeIds.map(String));
    if (selected.has(id)) {
      selected.delete(id);
      setExcludedEmployees((prev) => prev.filter((e) => String(e._id || e) !== id));
    } else {
      selected.add(id);
      setExcludedEmployees((prev) => {
        if (prev.some((e) => String(e._id || e) === id)) return prev;
        return [...prev, emp];
      });
    }
    setWfhForm((prev) => ({ ...prev, excludedEmployeeIds: [...selected] }));
  };

  const mergeEmployeesIntoSelection = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return 0;
    const selected = new Set(wfhForm.excludedEmployeeIds.map(String));
    const toAdd = [];
    rows.forEach((emp) => {
      const id = String(emp._id || emp.id);
      if (!id || selected.has(id)) return;
      selected.add(id);
      toAdd.push(emp);
    });
    if (!toAdd.length) return 0;
    setExcludedEmployees((prev) => {
      const seen = new Set(prev.map((e) => String(e._id || e)));
      const next = [...prev];
      toAdd.forEach((emp) => {
        const id = String(emp._id || emp.id);
        if (!seen.has(id)) {
          next.push(emp);
          seen.add(id);
        }
      });
      return next;
    });
    setWfhForm((prev) => ({ ...prev, excludedEmployeeIds: [...selected] }));
    return toAdd.length;
  };

  const selectAllSearchResults = () => {
    const n = mergeEmployeesIntoSelection(employeeResults);
    if (n > 0) toast.success(`Added ${n} employee(s) from search results`);
    else toast.info('Those employees are already in the list');
  };

  const clearSelectedEmployees = () => {
    setExcludedEmployees([]);
    setWfhForm((prev) => ({ ...prev, excludedEmployeeIds: [] }));
  };

  const addWholeDepartment = async () => {
    if (!wfhDepartment) {
      toast.error('Select a department first');
      return;
    }
    try {
      setWfhDepartmentLoading(true);
      const collected = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await axios.get(`${API_BASE_URL}/admin/employee`, {
          params: {
            department: wfhDepartment,
            status: 'active',
            limit: 100,
            page,
          },
        });
        const rows = res.data?.data || res.data?.employees || [];
        if (Array.isArray(rows)) collected.push(...rows);
        const pag = res.data?.pagination;
        totalPages = pag?.totalPages || pag?.pages || 1;
        page += 1;
      } while (page <= totalPages && page <= 50);

      if (!collected.length) {
        toast.info(`No active employees found in ${wfhDepartment}`);
        return;
      }
      const added = mergeEmployeesIntoSelection(collected);
      toast.success(
        added > 0
          ? `Added ${added} from “${wfhDepartment}”. Review the list, then Save.`
          : `Everyone from “${wfhDepartment}” is already in the list.`
      );
    } catch {
      toast.error('Failed to load department employees');
    } finally {
      setWfhDepartmentLoading(false);
    }
  };

  const getHolidayBgColor = (type) => {
    const bgColors = {
      national: 'hol-cal__day--national',
      religious: 'hol-cal__day--religious',
      company: 'hol-cal__day--company',
      regional: 'hol-cal__day--regional',
    };
    return bgColors[type] || 'hol-cal__day--national';
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, selectedMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const isToday = (day) => {
    if (!day) return false;
    const now = new Date();
    return (
      now.getDate() === day &&
      now.getMonth() + 1 === selectedMonth &&
      now.getFullYear() === currentYear
    );
  };

  if (loading) {
    return (
      <div className="hol-cal__loading">
        <div className="hol-cal__spinner" aria-hidden />
        <h3 className="text-lg font-semibold">Loading calendar</h3>
        <p className="text-sm text-slate-500">Please wait…</p>
      </div>
    );
  }

  return (
    <div className="hol-cal">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="hol-cal__inner">
        <header className="hol-cal__header">
          <div>
            <p className="hol-cal__eyebrow">Time &amp; attendance</p>
            <h1 className="hol-cal__title">
              {viewMode === 'holidays' ? 'Holiday Calendar' : 'Calendar Management'}
            </h1>
            <p className="hol-cal__sub">
              {viewMode === 'holidays'
                ? `National, regional, and optional holidays for ${currentYear}`
                : `Manage holidays, working days, and WFH availability for ${currentYear}`}
            </p>
          </div>
          <div className="hol-cal__actions">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="hol-cal__select"
              aria-label="Select year"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 5).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {viewMode === 'holidays' ? (
              <button
                type="button"
                className="hol-cal__btn hol-cal__btn--ghost"
                onClick={() => setViewMode('calendar')}
              >
                <FiArrowLeft /> Back to Calendar
              </button>
            ) : null}
            <button type="button" className="hol-cal__btn hol-cal__btn--ghost" onClick={() => setShowUploadModal(true)}>
              <FiUpload /> Upload
            </button>
            <button type="button" className="hol-cal__btn hol-cal__btn--navy" onClick={() => setShowSettingsModal(true)}>
              <FiClock /> Settings
            </button>
            {viewMode === 'calendar' ? (
              <button type="button" className="hol-cal__btn hol-cal__btn--ghost" onClick={() => openEnableWfhModal()}>
                <FiHome /> WFH
              </button>
            ) : null}
            <button type="button" className="hol-cal__btn hol-cal__btn--primary" onClick={() => openAddForMonth(selectedMonth)}>
              <FiPlus /> Add Holiday
            </button>
          </div>
        </header>

        {viewMode === 'calendar' ? (
          <>
            <div className="hol-cal__toolbar">
              <div>
                <h3 className="hol-cal__toolbar-title">View Month</h3>
                <p className="hol-cal__toolbar-sub">Select a month to view the calendar</p>
              </div>
              <div className="hol-cal__toolbar-actions">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="hol-cal__select"
                  aria-label="Select month"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>{getMonthName(month)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hol-cal__btn hol-cal__btn--primary"
                  onClick={() => setViewMode('holidays')}
                >
                  <FiList /> Holiday Calendar
                </button>
              </div>
            </div>

            <section className="hol-cal__month-panel">
              <h3 className="hol-cal__month-panel-title">
                {getMonthName(selectedMonth)} {currentYear}
              </h3>

              <div className="hol-cal__weekdays">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                  <div key={d} className="hol-cal__weekday">{d}</div>
                ))}
              </div>

              <div className="hol-cal__days">
                {generateCalendarDays().map((day, idx) => {
                  const holidays = day ? getHolidaysForDay(day) : [];
                  const hasHoliday = holidays.length > 0;
                  const firstHoliday = hasHoliday ? holidays[0] : null;
                  const workMode = firstHoliday?.workModeOverride;
                  const isConvertedWorking = workMode === 'office' || workMode === 'home';
                  const blocksAsHoliday = hasHoliday && !isConvertedWorking;
                  const wfhEntry = day ? getWfhForDay(day) : null;
                  const isNonWorking = day
                    ? isNonWorkingDay(calendar?.workingDays, currentYear, selectedMonth, day)
                    : false;
                  // WFH only on working days — not on off days or unconverted holidays
                  const hasWfh = Boolean(wfhEntry) && !isNonWorking && !blocksAsHoliday;
                  const holidayNames = holidays.map((h) => h.name).join(', ');
                  const titleParts = [];
                  if (hasHoliday) titleParts.push(holidayNames);
                  if (isConvertedWorking) {
                    titleParts.push(workMode === 'home' ? 'Working from home' : 'Working from office');
                  }
                  if (hasWfh) titleParts.push('WFH enabled');
                  if (isNonWorking && day && !hasHoliday) titleParts.push('Non-working day');

                  return (
                    <div
                      key={idx}
                      className={[
                        'hol-cal__day',
                        !day && 'hol-cal__day--empty',
                        hasHoliday && !isConvertedWorking && getHolidayBgColor(firstHoliday.type),
                        isConvertedWorking && 'hol-cal__day--converted',
                        hasWfh && 'hol-cal__day--wfh',
                        isNonWorking && day && !hasHoliday && 'hol-cal__day--off',
                        isToday(day) && 'hol-cal__day--today',
                      ].filter(Boolean).join(' ')}
                      title={titleParts.length ? titleParts.join(' · ') : undefined}
                    >
                      {day ? (
                        <>
                          <span className="hol-cal__day-num">{day}</span>
                          {isNonWorking && !hasHoliday ? (
                            <span className="hol-cal__day-tag hol-cal__day-tag--off">Non-working</span>
                          ) : null}
                          {hasHoliday ? (
                            <span className={`hol-cal__day-tag ${isConvertedWorking ? 'hol-cal__day-tag--converted' : getTypeClass(firstHoliday.type)}`}>
                              {isConvertedWorking
                                ? `${workMode === 'home' ? 'Home' : 'Office'}: ${firstHoliday.name}`
                                : firstHoliday.name}
                              {holidays.length > 1 ? ` +${holidays.length - 1}` : ''}
                            </span>
                          ) : null}
                          {hasWfh && !isConvertedWorking ? (
                            <span className="hol-cal__day-tag hol-cal__day-tag--wfh">WFH</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <div className="hol-cal__grid">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const holidays = getHolidaysForMonth(month);
              const count = holidays.length;
              const monthLabel = getMonthName(month);
              return (
                <article key={month} className="hol-cal__month">
                  <div className="hol-cal__month-head">
                    <h2 className="hol-cal__month-title">
                      {monthLabel} {currentYear}
                    </h2>
                    <span className="hol-cal__count">
                      {count} Holiday{count === 1 ? '' : 's'}
                    </span>
                  </div>

                  {count === 0 ? (
                    <div className="hol-cal__empty">
                      <span className="hol-cal__empty-icon" aria-hidden>
                        <FiCalendar />
                      </span>
                      <p className="hol-cal__empty-text">
                        No holidays scheduled in {monthLabel}
                      </p>
                      <button
                        type="button"
                        className="hol-cal__empty-add"
                        onClick={() => openAddForMonth(month)}
                      >
                        + Add holiday to {monthLabel}
                      </button>
                    </div>
                  ) : (
                    <ul className="hol-cal__list">
                      {holidays.map((holiday) => {
                        const converted = holiday.workModeOverride === 'office' || holiday.workModeOverride === 'home';
                        return (
                        <li key={holiday._id} className={`hol-cal__item${converted ? ' hol-cal__item--converted' : ''}`}>
                          <span className="hol-cal__accent" aria-hidden />
                          <div className="hol-cal__item-body">
                            <div className="hol-cal__item-top">
                              <h3 className="hol-cal__item-name">{holiday.name}</h3>
                              <span className={`hol-cal__type ${getTypeClass(holiday.type)}`}>
                                {getTypeLabel(holiday.type)}
                              </span>
                              {converted ? (
                                <span className="hol-cal__type hol-cal__type--converted">
                                  {holiday.workModeOverride === 'home' ? 'Working · Home' : 'Working · Office'}
                                </span>
                              ) : null}
                            </div>
                            <p className="hol-cal__item-date">{formatHolidayDate(holiday.date)}</p>
                            <p className="hol-cal__item-loc">
                              <FiMapPin size={12} />
                              {getHolidayLocation(holiday)}
                            </p>
                          </div>
                          <div className="hol-cal__item-actions">
                            {converted ? (
                              <button
                                type="button"
                                className="hol-cal__text-btn"
                                onClick={() => handleRestoreHoliday(holiday)}
                                title="Restore as holiday"
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="hol-cal__text-btn"
                                onClick={() => setConvertHoliday(holiday)}
                                title="Make this a working day (office or home)"
                                disabled={isPastHoliday(holiday.date)}
                              >
                                Make working
                              </button>
                            )}
                            <button
                              type="button"
                              className="hol-cal__icon-btn"
                              onClick={() => openEditHoliday(holiday)}
                              title={isPastHoliday(holiday.date) ? 'Past holidays cannot be edited' : 'Edit'}
                              disabled={isPastHoliday(holiday.date)}
                            >
                              <FiEdit size={14} />
                            </button>
                            <button
                              type="button"
                              className="hol-cal__icon-btn hol-cal__icon-btn--danger"
                              onClick={() => handleDeleteHoliday(holiday._id)}
                              title={isPastHoliday(holiday.date) ? 'Past holidays cannot be deleted' : 'Delete'}
                              disabled={isPastHoliday(holiday.date)}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showHolidayModal && (
        <HolidayModal
          title={selectedHoliday ? 'Edit Holiday' : 'Add Holiday'}
          formData={holidayForm}
          setFormData={setHolidayForm}
          onSubmit={selectedHoliday ? handleUpdateHoliday : handleAddHoliday}
          onClose={() => {
            setShowHolidayModal(false);
            resetHolidayForm();
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          formData={settingsForm}
          setFormData={setSettingsForm}
          onSubmit={handleUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showUploadModal && (
        <UploadModal
          onSubmit={handleFileUpload}
          onClose={() => setShowUploadModal(false)}
          uploading={uploading}
        />
      )}

      {convertHoliday && createPortal(
        <div className="cal-modal-overlay animate-fadeIn" role="dialog" aria-modal="true">
          <div className="cal-modal bg-white rounded-2xl shadow-2xl animate-slideUp" style={{ maxWidth: '24rem' }}>
            <div className="wfh-modal__header">
              <h3 className="text-lg font-bold text-white">Make working day</h3>
              <button
                type="button"
                onClick={() => setConvertHoliday(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-white"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[#0e2b3d]">
                Convert <strong>{convertHoliday.name}</strong> ({formatHolidayDate(convertHoliday.date)}) into a
                working day. The holiday stays on the calendar with a working label.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={convertSaving}
                  onClick={() => handleConvertHolidayToWorking('office')}
                  className="w-full text-left rounded-xl border border-[rgba(14,43,61,0.12)] px-4 py-3 hover:border-[#0e9370] hover:bg-[#e8faf4] disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-[#0e2b3d]">Work from office</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Normal office working day</span>
                </button>
                <button
                  type="button"
                  disabled={convertSaving}
                  onClick={() => handleConvertHolidayToWorking('home')}
                  className="w-full text-left rounded-xl border border-[rgba(14,43,61,0.12)] px-4 py-3 hover:border-[#0e9370] hover:bg-[#e8faf4] disabled:opacity-50"
                >
                  <span className="block text-sm font-semibold text-[#0e2b3d]">Work from home</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Enables WFH for this date</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setConvertHoliday(null)}
                className="w-full px-4 py-2.5 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showWfhModal && (
        <WfhAvailabilityModal
          formData={wfhForm}
          todayDateString={todayDateString}
          excludedEmployees={excludedEmployees}
          employeeSearch={employeeSearch}
          employeeResults={employeeResults}
          employeeSearchLoading={employeeSearchLoading}
          departments={wfhDepartments}
          selectedDepartment={wfhDepartment}
          departmentLoading={wfhDepartmentLoading}
          onDepartmentChange={setWfhDepartment}
          onAddDepartment={addWholeDepartment}
          onSelectAllResults={selectAllSearchResults}
          onClearSelected={clearSelectedEmployees}
          onSearchEmployees={searchEmployeesForExclusion}
          onToggleEmployee={toggleExcludedEmployee}
          onDatesChange={handleWfhDatesChange}
          onNoteChange={(note) => setWfhForm((prev) => ({ ...prev, note }))}
          onSubmit={handleEnableWfh}
          onDisable={rangeHasExistingWfh ? handleDisableWfh : null}
          hasExisting={rangeHasExistingWfh}
          existingRangeLabel={existingWfhInRange.label}
          onClose={() => setShowWfhModal(false)}
          saving={wfhSaving}
        />
      )}
    </div>
  );
};

const WfhAvailabilityModal = ({
  formData,
  todayDateString,
  excludedEmployees,
  employeeSearch,
  employeeResults,
  employeeSearchLoading,
  departments,
  selectedDepartment,
  departmentLoading,
  onDepartmentChange,
  onAddDepartment,
  onSelectAllResults,
  onClearSelected,
  onSearchEmployees,
  onToggleEmployee,
  onDatesChange,
  onNoteChange,
  onSubmit,
  onDisable,
  hasExisting,
  existingRangeLabel,
  onClose,
  saving,
}) => {
  const selectedIds = new Set((formData.excludedEmployeeIds || []).map(String));
  const peopleCount = excludedEmployees.length;

  // Portal to document.body so position:fixed is viewport-relative (not trapped by
  // .app-shell / .main-scroll-area overflow). Safe-centering CSS avoids align-items:center
  // clipping the top when the dialog is taller than the viewport.
  const modal = (
    <div className="wfh-modal-overlay animate-fadeIn" role="dialog" aria-modal="true" aria-labelledby="wfh-modal-title">
      <div className="wfh-modal bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slideUp">
          <div className="wfh-modal__header">
            <h3 id="wfh-modal-title" className="text-lg font-bold text-white">Enable Work From Home</h3>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white shrink-0" aria-label="Close">
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="wfh-modal__form">
            <div className="wfh-modal__body space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="wfh-modal__label">From date</label>
                  <input
                    type="date"
                    value={formData.dateFrom}
                    min={todayDateString}
                    onChange={(e) => {
                      const next = e.target.value;
                      const nextTo =
                        formData.dateTo && formData.dateTo < next ? next : formData.dateTo || next;
                      onDatesChange(next, nextTo);
                    }}
                    className="wfh-modal__input"
                    required
                  />
                </div>
                <div>
                  <label className="wfh-modal__label">To date</label>
                  <input
                    type="date"
                    value={formData.dateTo}
                    min={formData.dateFrom || todayDateString}
                    onChange={(e) => onDatesChange(formData.dateFrom, e.target.value)}
                    className="wfh-modal__input"
                    required
                  />
                </div>
              </div>

              {hasExisting ? (
                <div className="wfh-modal__notice">
                  Already enabled
                  {existingRangeLabel ? (
                    <>
                      {' '}
                      <strong>{existingRangeLabel}</strong>
                    </>
                  ) : null}
                  . Saving updates the note and excluded list.
                </div>
              ) : null}

              <div>
                <label className="wfh-modal__label">Note (optional)</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  className="wfh-modal__input"
                  placeholder="e.g. Diwali week WFH"
                  maxLength={500}
                />
              </div>

              <div className="wfh-modal__section">
                <label className="wfh-modal__label">Exclude employees (optional)</label>
                <p className="text-xs text-[#666] mb-3">
                  Everyone can apply by default. Add people or a whole department here to stop them from applying.
                </p>

                <div className="flex gap-2 mb-2">
                  <select
                    value={selectedDepartment || ''}
                    onChange={(e) => onDepartmentChange(e.target.value)}
                    className="wfh-modal__input flex-1"
                  >
                    <option value="">Choose department</option>
                    {(departments || []).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onAddDepartment}
                    disabled={departmentLoading || !selectedDepartment}
                    className="wfh-modal__btn-secondary whitespace-nowrap disabled:opacity-50"
                  >
                    {departmentLoading ? '…' : 'Exclude department'}
                  </button>
                </div>

                <div className="wfh-modal__search">
                  <FiSearch className="wfh-modal__search-icon" aria-hidden />
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={(e) => onSearchEmployees(e.target.value)}
                    className="wfh-modal__input wfh-modal__input--search"
                    placeholder="Or search one employee to exclude"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {employeeSearchLoading ? (
                  <p className="text-xs text-gray-500 mb-2">Searching…</p>
                ) : null}

                {employeeResults.length > 0 ? (
                  <div className="mb-2">
                    <div className="flex justify-end mb-1">
                      <button
                        type="button"
                        onClick={onSelectAllResults}
                        className="text-xs font-semibold text-[#0e9370] hover:underline"
                      >
                        Exclude all results ({employeeResults.length})
                      </button>
                    </div>
                    <ul className="max-h-36 overflow-y-auto border border-[rgba(14,43,61,0.08)] rounded-xl divide-y divide-gray-100 bg-white">
                      {employeeResults.map((emp) => {
                        const id = String(emp._id);
                        const checked = selectedIds.has(id);
                        return (
                          <li key={id}>
                            <label className="flex items-start gap-3 px-3 py-2 hover:bg-[#e8faf4] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggleEmployee(emp)}
                                className="mt-1 accent-[#0e9370]"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-[#0e2b3d]">
                                  {employeeDisplayName(emp)}
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {[emp.employeeId, emp.department].filter(Boolean).join(' · ') || '—'}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-[#666]">
                    {peopleCount === 0
                      ? 'No one excluded'
                      : `${peopleCount} excluded — click a name to remove`}
                  </p>
                  {peopleCount > 0 ? (
                    <button
                      type="button"
                      onClick={onClearSelected}
                      className="text-xs font-semibold text-[#0e2b3d]/60 hover:text-[#0e2b3d]"
                    >
                      Clear list
                    </button>
                  ) : null}
                </div>

                {peopleCount > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {excludedEmployees.map((emp) => {
                      const id = String(emp._id || emp);
                      return (
                        <button
                          key={id}
                          type="button"
                          title="Remove from excluded list"
                          onClick={() => onToggleEmployee(emp._id ? emp : { _id: emp })}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#e8faf4] px-2.5 py-1 text-xs font-medium text-[#00694f]"
                        >
                          {employeeDisplayName(emp)}
                          <FiX className="h-3.5 w-3.5 opacity-70" />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="wfh-modal__footer">
              {onDisable ? (
                <button
                  type="button"
                  onClick={onDisable}
                  disabled={saving}
                  className="px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  Disable WFH
                </button>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 font-medium rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="wfh-modal__btn-primary disabled:opacity-50">
                  {saving ? 'Saving…' : hasExisting ? 'Save changes' : 'Enable WFH'}
                </button>
              </div>
            </div>
          </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

// Modal Components — portaled + safe-centered (same positioning as WFH)
const HolidayModal = ({ title, formData, setFormData, onSubmit, onClose }) => {
  const todayDateString = new Date().toISOString().split('T')[0];
  return createPortal(
    <div className="cal-modal-overlay animate-fadeIn" role="dialog" aria-modal="true">
      <div className="cal-modal bg-white rounded-2xl shadow-2xl animate-slideUp">
        <div className="p-6 rounded-t-2xl shrink-0" style={{ background: 'linear-gradient(165deg, #0e2b3d 0%, #134056 100%)' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
        </div>

        <form onSubmit={onSubmit} className="cal-modal__form">
          <div className="cal-modal__body p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Holiday Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                placeholder="Enter holiday name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={todayDateString}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
              >
                <option value="national">National</option>
                <option value="religious">Religious</option>
                <option value="company">Company</option>
                <option value="regional">Regional</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200 resize-none"
                rows="3"
                placeholder="Enter holiday description (optional)"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 text-[#0e9370] bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#0e9370]"
                />
                <span className="font-medium text-gray-700">Recurring Holiday</span>
              </label>

              {formData.isRecurring && (
                <div className="ml-7 animate-slideDown">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Recurring Pattern</label>
                  <select
                    value={formData.recurringPattern}
                    onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                  >
                    <option value="yearly">Yearly</option>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="cal-modal__footer flex justify-end space-x-3 px-6 py-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-[#0e9370] hover:bg-[#0b7458] text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl">
              {title.includes('Add') ? 'Add Holiday' : 'Update Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const SettingsModal = ({ formData, setFormData, onSubmit, onClose }) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return createPortal(
    <div className="cal-modal-overlay animate-fadeIn" role="dialog" aria-modal="true">
      <div className="cal-modal cal-modal--xl bg-white rounded-2xl shadow-2xl animate-slideUp">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-6 rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiClock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Calendar Settings</h3>
          </div>
        </div>

        <form onSubmit={onSubmit} className="cal-modal__form">
          <div className="cal-modal__body p-6 space-y-8">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-[#0e9370] rounded-full mr-3"></div>
                Working Days
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                {days.map((day) => (
                  <label key={day} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.workingDays[day]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          workingDays: { ...formData.workingDays, [day]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-[#0e9370] bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-[#0e9370]"
                    />
                    <span className="capitalize font-medium text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <div className="w-2 h-2 bg-[#0e9370] rounded-full mr-3"></div>
                Working Hours
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={formData.workingHours.startTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workingHours: { ...formData.workingHours, startTime: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={formData.workingHours.endTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workingHours: { ...formData.workingHours, endTime: e.target.value },
                      })
                    }
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Break Duration (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.workingHours.breakDuration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workingHours: { ...formData.workingHours, breakDuration: parseInt(e.target.value, 10) },
                      })
                    }
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0e9370] focus:border-[#0e9370] transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="cal-modal__footer flex justify-end space-x-3 px-6 py-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl">
              Update Settings
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const UploadModal = ({ onSubmit, onClose, uploading }) => {
  const [fileName, setFileName] = useState('');

  return createPortal(
    <div className="cal-modal-overlay animate-fadeIn" role="dialog" aria-modal="true">
      <div className="cal-modal bg-white rounded-2xl shadow-2xl animate-slideUp">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiUpload className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Upload Calendar File</h3>
          </div>
        </div>

        <form onSubmit={onSubmit} className="cal-modal__form">
          <div className="cal-modal__body p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Select Calendar File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-green-400 hover:bg-green-50 transition-all duration-300 group">
                <div className="relative inline-block">
                  <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4 group-hover:text-green-500 transition-colors duration-300" />
                </div>
                <p className="text-sm text-gray-600 mb-4 font-medium">Upload PNG, JPG, or PDF calendar file</p>
                <input
                  id="calendarFile"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) setFileName(file.name);
                  }}
                  required
                />
                <label
                  htmlFor="calendarFile"
                  className="cursor-pointer bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-semibold inline-block transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Choose File
                </label>
                {fileName && (
                  <p className="text-xs text-gray-600 mt-3 font-medium truncate">Selected: {fileName}</p>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                <div className="w-2 h-2 bg-[#0e9370] rounded-full mr-2"></div>
                Supported Features
              </h4>
              <ul className="text-sm text-blue-700 space-y-2">
                <li className="flex items-center"><span className="w-1.5 h-1.5 bg-[#0e9370] rounded-full mr-3"></span>Automatic holiday detection from PDF text</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 bg-[#0e9370] rounded-full mr-3"></span>Common holidays (New Year, Christmas, etc.)</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 bg-[#0e9370] rounded-full mr-3"></span>Date pattern recognition</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 bg-[#0e9370] rounded-full mr-3"></span>Duplicate prevention</li>
              </ul>
            </div>
          </div>

          <div className="cal-modal__footer flex justify-end space-x-3 px-6 py-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200" disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed" disabled={uploading}>
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FiUpload className="w-5 h-5" />
                  <span>Upload & Process</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CalendarManagement;