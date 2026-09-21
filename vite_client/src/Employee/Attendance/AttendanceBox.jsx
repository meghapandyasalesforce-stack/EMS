import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clockIn, clockOut, breakIn, breakOut, fetchLogs, fetchMyTodayStatus } from '../../context/attendanceSlice';
import { fetchOrganizationTimezone } from '../../context/timezoneSlice';
import { format } from 'date-fns';
import {
  formatInOrgTimezone,
  todayDateKeyInTimezone,
  isSessionForToday,
} from '../../utils/orgTimezone';

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
import { FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiCoffee, FiArrowLeft, FiMapPin, FiHome, FiUsers, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { usePermissions } from '../../Hooks/usePermissions';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { isHR } from '../../utils/managerHelper';
import { isLocationRequiredForPunch } from '../../utils/attendanceLocationUtils';

/**
 * @param {{ variant?: 'default' | 'dashboard' }} [props]
 * dashboard = compact strip for employee home (mint / workspace theme)
 */
const AttendanceBox = ({ variant = 'default' }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    sessions,
    error,
    loading,
    _dailyStats, // Marked as unused to satisfy lint rule
    _breakSession // Marked as unused to satisfy lint rule
  } = useSelector((state) => state.attendance);
  
  const currentUser = useSelector((state) => state.auth.user);
  const sessionEmployee = useSelector((state) => state.employeeDetails?.employee);
  const { isHrManager, isHrExecutive } = useAuthPermissions();
  const orgTimezone = useSelector((state) => state.timezone.timezone);

  /** HR portal uses workforce employee id for attendance rows, not admin user id. */
  const isHrAttendanceUser =
    isHrManager || isHrExecutive || isHR(currentUser || sessionEmployee);

  const attendanceUserId = useMemo(() => {
    if (isHrAttendanceUser) {
      const hrEmployeeId =
        sessionEmployee?._id ||
        sessionEmployee?.id ||
        currentUser?.employeeProfileId ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('employeeProfileId') : null);
      if (hrEmployeeId) return String(hrEmployeeId);
    }
    return String(currentUser?.id || currentUser?._id || '');
  }, [isHrAttendanceUser, sessionEmployee, currentUser]);

  const [currentSession, setCurrentSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [initialLoading, setInitialLoading] = useState(true);
  const [breakCount, setBreakCount] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [attendanceRule, setAttendanceRule] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cachedLocation, setCachedLocation] = useState(null);
  const [workLocation, setWorkLocation] = useState('office');
  /** UI-only schedule hint: null | { type:'full_day' } | { type:'half_day', halfDayType } */
  const [todayWfhSchedule, setTodayWfhSchedule] = useState(null);
  const [wfhNoticeDismissed, setWfhNoticeDismissed] = useState(false);
  const [showAllEmployeesModal, setShowAllEmployeesModal] = useState(false);
  const [selectedAllEmployeesDate, setSelectedAllEmployeesDate] = useState(new Date());
  const [allEmployeesBreaksData, setAllEmployeesBreaksData] = useState([]);
  const [loadingAllEmployeesData, setLoadingAllEmployeesData] = useState(false);

  const locationRequiredForPunch = isLocationRequiredForPunch(attendanceRule);
  // Org-level WFH availability (defaults to allowed when the rule doesn't specify)
  const wfhAllowed = attendanceRule?.allowWorkFromHome !== false;
  const isWfhSelected = wfhAllowed && workLocation === 'work_from_home';

  const parseHmToMinutes = (hm) => {
    const parts = String(hm || '').split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h)) return null;
    return h * 60 + (Number.isFinite(m) ? m : 0);
  };

  // Office hours from employee rule API (rule → employee shift if assigned → calendar → 09:00–17:00)
  const officeHoursForUi = useMemo(() => ({
    startTime: attendanceRule?.officeHours?.startTime || '09:00',
    endTime: attendanceRule?.officeHours?.endTime || '17:00',
  }), [attendanceRule]);

  const shiftLabel = useMemo(() => {
    const fromSession = currentSession?.shiftName;
    const fromRule = attendanceRule?.assignedShift?.name;
    const name = fromSession || fromRule;
    if (!name) return null;
    const start =
      currentSession?.shiftStartTime ||
      attendanceRule?.assignedShift?.startTime ||
      officeHoursForUi.startTime;
    const end =
      currentSession?.shiftEndTime ||
      attendanceRule?.assignedShift?.endTime ||
      officeHoursForUi.endTime;
    return start && end ? `${name} (${start}–${end})` : name;
  }, [currentSession, attendanceRule, officeHoursForUi]);

  const shiftCheckInHint = useMemo(() => {
    const win = attendanceRule?.shiftCheckInWindow;
    if (!win?.enforced || !win.windowStart || !win.windowEnd) return null;
    return `Punch-in during your shift only (${win.windowStart}–${win.windowEnd})`;
  }, [attendanceRule]);

  const halfDaySplitMinutes = useMemo(() => {
    const fromServer = attendanceRule?.daySchedule?.midpointHHmm;
    if (fromServer) {
      const mid = parseHmToMinutes(fromServer);
      if (mid != null) return mid;
    }
    const start = parseHmToMinutes(officeHoursForUi.startTime) ?? 9 * 60;
    const end = parseHmToMinutes(officeHoursForUi.endTime) ?? 17 * 60;
    if (end <= start) return start + 4 * 60;
    return Math.floor((start + end) / 2);
  }, [officeHoursForUi, attendanceRule]);

  // Same timezone the server used for daySchedule. If org TZ is still default UTC,
  // fall back to the browser zone so afternoon IST is not treated as morning UTC.
  const punchHalfTimezone = useMemo(() => {
    const scheduled = attendanceRule?.daySchedule?.timezone;
    if (scheduled && scheduled !== 'UTC') return scheduled;
    if (orgTimezone && orgTimezone !== 'UTC') return orgTimezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || orgTimezone || 'UTC';
    } catch {
      return orgTimezone || 'UTC';
    }
  }, [attendanceRule?.daySchedule?.timezone, orgTimezone]);

  const nowMinutes = useMemo(() => {
    const hm = formatInOrgTimezone(currentTime, 'HH:mm', punchHalfTimezone);
    return parseHmToMinutes(hm) ?? 0;
  }, [currentTime, punchHalfTimezone]);

  // Browser-local half: if org TZ is UTC, afternoon IST still looks like morning — use both clocks for WFH lock
  const inFirstHalfBrowser = useMemo(() => {
    let browserTz = 'UTC';
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      browserTz = 'UTC';
    }
    const hm = formatInOrgTimezone(currentTime, 'HH:mm', browserTz);
    const mins = parseHmToMinutes(hm) ?? 0;
    const mid = halfDaySplitMinutes;
    return mins < mid;
  }, [currentTime, halfDaySplitMinutes]);

  const inFirstHalfOfDay = useMemo(() => {
    const start =
      parseHmToMinutes(
        attendanceRule?.daySchedule?.dayStartHHmm || officeHoursForUi.startTime
      ) ?? 9 * 60;
    const end =
      parseHmToMinutes(
        attendanceRule?.daySchedule?.dayEndHHmm || officeHoursForUi.endTime
      ) ?? 17 * 60;
    const mid = halfDaySplitMinutes;
    const overnight = end <= start;
    if (!overnight) {
      return nowMinutes < mid;
    }
    // Overnight first half: [start → mid], mid may be after midnight
    if (mid > start) {
      return nowMinutes >= start && nowMinutes < mid;
    }
    return nowMinutes >= start || nowMinutes < mid;
  }, [
    nowMinutes,
    halfDaySplitMinutes,
    officeHoursForUi.startTime,
    officeHoursForUi.endTime,
    attendanceRule?.daySchedule?.dayStartHHmm,
    attendanceRule?.daySchedule?.dayEndHHmm,
  ]);

  const canContinueSecondHalf = useMemo(() => {
    if (!currentSession || currentSession.clockOut) return false;
    const ds = attendanceRule?.daySchedule;
    if (!ds || inFirstHalfOfDay) return false;
    if (currentSession.secondaryWorkLocation) return false;
    const primary =
      currentSession.workLocation === 'home' ? 'work_from_home' : currentSession.workLocation;
    const expected = ds.expectedWorkLocationSecondHalf || ds.expectedWorkLocation;
    if (!expected || expected === primary) return false;
    return (
      expected === 'work_from_home' ||
      ds.wfhType === 'second_half' ||
      ds.wfhType === 'full' ||
      ds.firstHalfOff
    );
  }, [currentSession, attendanceRule, inFirstHalfOfDay]);

  // Prefer server daySchedule.wfhType when present (approved only)
  useEffect(() => {
    const ds = attendanceRule?.daySchedule;
    if (!ds) return;
    if (ds.wfhType === 'full') {
      setTodayWfhSchedule({ type: 'full_day' });
    } else if (ds.wfhType === 'first_half' || ds.wfhType === 'second_half') {
      setTodayWfhSchedule({ type: 'half_day', halfDayType: ds.wfhType });
    }
  }, [attendanceRule?.daySchedule]);

  // Hide Office when approved WFH covers the current working half/day
  const lockWfhOnly = useMemo(() => {
    if (!wfhAllowed) return false;
    const ds = attendanceRule?.daySchedule;
    if (ds?.lockWfhOnly === true) return true;
    if (ds?.expectedWorkLocation === 'work_from_home') return true;
    if (ds?.wfhType === 'full') return true;

    const schedule =
      todayWfhSchedule ||
      (ds?.wfhType === 'first_half' || ds?.wfhType === 'second_half'
        ? { type: 'half_day', halfDayType: ds.wfhType }
        : ds?.wfhType === 'full'
          ? { type: 'full_day' }
          : null);
    if (!schedule) return false;
    if (schedule.type === 'full_day') return true;
    if (schedule.type === 'half_day') {
      // Require BOTH clocks to agree it's still first half before allowing Office during second-half WFH
      const stillFirstHalfEverywhere = inFirstHalfOfDay && inFirstHalfBrowser;
      if (schedule.halfDayType === 'first_half') {
        if (ds?.secondHalfOff) return true;
        // Lock Home-only while either clock still says first half
        return inFirstHalfOfDay || inFirstHalfBrowser;
      }
      if (schedule.halfDayType === 'second_half') {
        if (ds?.firstHalfOff) return true;
        if (ds?.currentHalf === 'second_half') return true;
        return !stillFirstHalfEverywhere;
      }
    }
    return false;
  }, [
    wfhAllowed,
    todayWfhSchedule,
    inFirstHalfOfDay,
    inFirstHalfBrowser,
    attendanceRule?.daySchedule,
  ]);

  // Half leave/holiday with no approved WFH on the working half → Office only
  const lockOfficeOnly = useMemo(() => {
    if (lockWfhOnly) return false;
    const ds = attendanceRule?.daySchedule;
    if (!ds) return false;
    if (ds.wfhType && ds.wfhType !== 'none') return false;
    if (ds.firstHalfOff && !ds.secondHalfOff) return true;
    if (ds.secondHalfOff && !ds.firstHalfOff) return true;
    return false;
  }, [lockWfhOnly, attendanceRule?.daySchedule]);

  // Non-working day punch: blocked unless admin enables allowNonWorkingDayPunch
  const allowNonWorkingDayPunch = attendanceRule?.allowNonWorkingDayPunch === true;
  const isWorkingDayToday = attendanceRule?.isWorkingDay !== false;
  const punchBlockedByDayPlan = attendanceRule?.daySchedule?.punchAllowed === false;
  const punchBlockedByNonWorkingDay =
    (attendanceRule != null && !isWorkingDayToday && !allowNonWorkingDayPunch) ||
    punchBlockedByDayPlan;
  const showNonWorkingDayNotice =
    attendanceRule != null && !isWorkingDayToday;

  const nonWorkingDayLabel = (() => {
    if (attendanceRule?.nonWorkingReason === 'holiday') {
      return attendanceRule.holidayName
        ? `Holiday (${attendanceRule.holidayName})`
        : 'Holiday';
    }
    return 'Non-working day';
  })();

  const isHolidayToday = attendanceRule?.nonWorkingReason === 'holiday';

  // Informational only — does not change punch APIs or attendance calculation
  const halfDayWfhNotice = useMemo(() => {
    if (!todayWfhSchedule || todayWfhSchedule.type !== 'half_day') return null;
    const half = todayWfhSchedule.halfDayType === 'second_half' ? 'second_half' : 'first_half';

    if (isHolidayToday && half === 'second_half') {
      return {
        title: 'Half-day schedule',
        body: 'Today is a holiday and you have approved WFH for the second half. No first-half punch-in is required. You can punch in for second-half WFH when your organization allows punch on this day. Attendance calculation is unchanged.',
      };
    }
    if (isHolidayToday && half === 'first_half') {
      return {
        title: 'Half-day schedule',
        body: 'Today is a holiday and you have approved WFH for the first half. Punch-in follows your organization holiday rules. Attendance calculation is unchanged.',
      };
    }
    if (half === 'second_half') {
      if (currentSession && !currentSession.clockOut) {
        return {
          title: 'Second-half WFH scheduled',
          body: 'Second-half WFH is scheduled for today. Your first-half attendance will remain unchanged. You can continue your attendance from home.',
        };
      }
      return {
        title: 'Half-day schedule',
        body: 'You are scheduled to work normally during the first half and work from home during the second half. Your first-half attendance will remain unchanged.',
      };
    }
    return {
      title: 'Half-day schedule',
      body: 'You are scheduled to work from home during the first half and attend normally during the second half.',
    };
  }, [todayWfhSchedule, isHolidayToday, currentSession]);

  // Load approved WFH for today (UI schedule only — no attendance/payroll impact)
  useEffect(() => {
    let cancelled = false;
    setWfhNoticeDismissed(false);
    (async () => {
      try {
        const { data } = await axios.get('/v1/both/wfh-requests/my', { withCredentials: true });
        if (cancelled) return;
        const todayKey = todayDateKeyInTimezone(orgTimezone);
        const covering = (data?.requests || []).filter((req) => {
          if (req?.status !== 'approved' || !req?.wfhDate) return false;
          const fromKey = formatInOrgTimezone(req.wfhDate, 'yyyy-MM-dd', orgTimezone);
          if (!fromKey) return false;
          const toKey = req.wfhDateTo
            ? formatInOrgTimezone(req.wfhDateTo, 'yyyy-MM-dd', orgTimezone) || fromKey
            : fromKey;
          return todayKey >= fromKey && todayKey <= toKey;
        });
        const fullDay = covering.find((req) => (req.wfhType || 'full_day') === 'full_day');
        const halfDay = covering.find((req) => req.wfhType === 'half_day');
        if (fullDay) {
          setTodayWfhSchedule({ type: 'full_day' });
        } else if (halfDay) {
          setTodayWfhSchedule({
            type: 'half_day',
            halfDayType: halfDay.halfDayType === 'second_half' ? 'second_half' : 'first_half',
          });
        } else {
          // Do not clear schedule already set from daySchedule (server approved WFH)
          setTodayWfhSchedule((prev) => {
            const ds = attendanceRule?.daySchedule;
            if (ds?.wfhType === 'full') return { type: 'full_day' };
            if (ds?.wfhType === 'first_half' || ds?.wfhType === 'second_half') {
              return { type: 'half_day', halfDayType: ds.wfhType };
            }
            return prev;
          });
        }
      } catch {
        // Keep daySchedule-derived schedule on fetch failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgTimezone, attendanceRule?.daySchedule?.wfhType]);

  // If org disables WFH, fall back to office selection
  useEffect(() => {
    if (!wfhAllowed && workLocation !== 'office') {
      setWorkLocation('office');
    }
  }, [wfhAllowed, workLocation]);

  // When WFH-only window is active, force Home (same existing punch path)
  useEffect(() => {
    if (wfhAllowed && lockWfhOnly && workLocation !== 'work_from_home') {
      setWorkLocation('work_from_home');
    }
  }, [wfhAllowed, lockWfhOnly, workLocation]);

  // When office-only working half (leave/holiday other half, no approved WFH), force Office
  useEffect(() => {
    if (lockOfficeOnly && workLocation !== 'office') {
      setWorkLocation('office');
    }
  }, [lockOfficeOnly, workLocation]);

  // Permission management (do not block GPS before browser prompt)
  usePermissions();

  // Load org timezone first, then today's logs, then my-today-status (authoritative merge last)
  useEffect(() => {
    const fetchTodayLogs = async () => {
      try {
        setInitialLoading(true);
        let tz = orgTimezone;
        try {
          const ctx = await dispatch(fetchOrganizationTimezone()).unwrap();
          tz = ctx?.timezone || tz;
        } catch {
          // keep existing Redux timezone
        }
        const today = todayDateKeyInTimezone(tz);
        try {
          await dispatch(
            fetchLogs({
              startDate: today,
              endDate: today,
            })
          ).unwrap();
        } catch {
          // non-fatal
        }
        try {
          await dispatch(fetchMyTodayStatus()).unwrap();
        } catch {
          // non-fatal
        }
      } catch {
        // If fetch fails, don't show error - might be page refresh issue
      } finally {
        setInitialLoading(false);
      }
    };

    fetchTodayLogs();
  }, [dispatch, orgTimezone]);

  // Removed automatic refresh - data will only refresh on user actions (button clicks)

  // Today's row for this user (open or punched out — both need correct UI)
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const todaySession = sessions.find((session) => {
        const sessionUserId = session.userId?._id || session.userId;
        const belongsToUser = sessionUserId?.toString() === attendanceUserId;
        return belongsToUser && isSessionForToday(session, orgTimezone);
      });

      setCurrentSession(todaySession || null);

      if (todaySession && !todaySession.clockOut && todaySession.breaks) {
        const activeBreak = todaySession.breaks.find(
          (b) => b.breakIn && !b.breakOut
        );
        setIsOnBreak(!!activeBreak);
        setBreakCount(todaySession.breaks.length);
      } else {
        setIsOnBreak(false);
        setBreakCount(todaySession?.breaks?.length || 0);
      }
    } else {
      setCurrentSession(null);
      setIsOnBreak(false);
      setBreakCount(0);
    }
  }, [sessions, attendanceUserId, orgTimezone]);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Calculate elapsed time when checked in (stop when clocked out)
  useEffect(() => {
    let interval;
    if (currentSession && !currentSession.clockOut) {
      // Only calculate elapsed time if not clocked out
      interval = setInterval(() => {
        const now = new Date();
        const checkInTime = new Date(currentSession.clockIn);
        const elapsed = (now - checkInTime) / 1000; // in seconds
        setElapsedTime(elapsed);
      }, 1000);
    } else if (currentSession && currentSession.clockOut) {
      // If clocked out, calculate static duration
      const checkInTime = new Date(currentSession.clockIn);
      const checkOutTime = new Date(currentSession.clockOut);
      const elapsed = (checkOutTime - checkInTime) / 1000; // in seconds
      setElapsedTime(elapsed);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  // Fetch attendance rule on mount; refetch when org TZ resolves or half-boundary flips
  useEffect(() => {
    const fetchAttendanceRule = async () => {
      try {
        const response = await axios.get('/v1/both/attendance/rule');
        if (response.data.success && response.data.rule) {
          setAttendanceRule(response.data.rule);
        }
      } catch {
        // Rule refetch on punch will use server response if clock-in fails
      }
    };
    fetchAttendanceRule();
    // Refresh so second-half WFH lock updates after midpoint without a full page reload
    const id = setInterval(fetchAttendanceRule, 60_000);
    return () => clearInterval(id);
  }, [orgTimezone, inFirstHalfBrowser]);

  const mapGeolocationError = (error) => {
    const errorCode = error?.code;
    if (errorCode === 1 || error?.message?.includes('permission')) {
      return 'Location permission denied. Please enable it in browser settings for this site.';
    }
    if (errorCode === 2 || error?.message?.includes('unavailable')) {
      return 'GPS position unavailable. Please check your device location settings.';
    }
    if (errorCode === 3 || error?.message?.includes('timeout')) {
      return 'Location request timed out. Please try again.';
    }
    return error?.message || 'Unable to get location. Please enable location services and try again.';
  };

  const readPosition = (options) =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);
          if (
            Number.isNaN(latitude) ||
            Number.isNaN(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180 ||
            (latitude === 0 && longitude === 0)
          ) {
            reject(new Error('Invalid location coordinates received'));
            return;
          }
          resolve({
            latitude,
            longitude,
            accuracy: Number(position.coords.accuracy) || 0,
            address: 'Location detected',
          });
        },
        (err) => reject(err),
        options
      );
    });

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const isSecure =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isSecure) {
      throw new Error('Geolocation requires HTTPS or localhost');
    }

    try {
      return await readPosition({
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 0,
      });
    } catch (highAccuracyError) {
      return readPosition({
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000,
      }).catch(() => {
        throw new Error(mapGeolocationError(highAccuracyError));
      });
    }
  };

  // Prefetch GPS when rule requires it so punch-in is not sent without coordinates
  useEffect(() => {
    if (!locationRequiredForPunch || cachedLocation) return;

    let cancelled = false;
    (async () => {
      try {
        const loc = await getCurrentLocation();
        if (!cancelled) setCachedLocation(loc);
      } catch {
        // User will be prompted again on punch
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationRequiredForPunch, attendanceRule]);

  const resolveLocationForPunch = async () => {
    if (cachedLocation?.latitude != null && cachedLocation?.longitude != null) {
      return cachedLocation;
    }
    const loc = await getCurrentLocation();
    setCachedLocation(loc);
    return loc;
  };

  const handleClockIn = async () => {
    try {
      if (punchBlockedByNonWorkingDay) {
        toast.info(
          attendanceRule?.nonWorkingReason === 'holiday'
            ? `${nonWorkingDayLabel} — punch-in is not available.`
            : 'Non-working day — punch-in is not available.'
        );
        return;
      }

      // Hard stop: approved WFH for this half/day → never submit Office
      if (lockWfhOnly && workLocation === 'office' && !canContinueSecondHalf) {
        setWorkLocation('work_from_home');
        toast.error(
          'Office punch is not allowed during your approved Work From Home period. Please punch in as Home.'
        );
        return;
      }

      // Check if user already has an active session
      const openSession = sessions.find(session => {
        if (session.clockOut) return false;
        const sessionUserId = session.userId?._id || session.userId;
        const belongsToUser = sessionUserId?.toString() === attendanceUserId;
        return belongsToUser && isSessionForToday(session, orgTimezone);
      });

      const ds = attendanceRule?.daySchedule;
      const requestedLocation = canContinueSecondHalf
        ? (ds?.expectedWorkLocationSecondHalf ||
            ds?.expectedWorkLocation ||
            (lockWfhOnly ? 'work_from_home' : 'office'))
        : lockWfhOnly
          ? 'work_from_home'
          : isWfhSelected
            ? 'work_from_home'
            : 'office';

      if (lockWfhOnly && requestedLocation === 'office') {
        toast.error(
          'Office punch is not allowed during your approved Work From Home period. Please punch in as Home.'
        );
        return;
      }
      const primaryLocation =
        openSession?.workLocation === 'home' ? 'work_from_home' : openSession?.workLocation;
      const allowContinue =
        openSession &&
        !openSession.clockOut &&
        (canContinueSecondHalf ||
          (ds?.currentHalf === 'second_half' &&
            requestedLocation !== primaryLocation &&
            (ds.expectedWorkLocation === requestedLocation ||
              ds.wfhType === 'second_half' ||
              ds.wfhType === 'full' ||
              ds.firstHalfOff)));

      if (openSession && !allowContinue) {
        try {
          await dispatch(fetchMyTodayStatus()).unwrap();
        } catch {
          // non-fatal
        }
        setCurrentSession(openSession);
        return;
      }

      setIsProcessing(true);

      const requiresLocation = isLocationRequiredForPunch(attendanceRule);

      const clockInData = {
        workLocation: requestedLocation,
      };

      if (isWfhSelected) {
        // WFH punch: capture location for record purposes only — never block the punch
        try {
          const locationData = await resolveLocationForPunch();
          clockInData.latitude = locationData.latitude;
          clockInData.longitude = locationData.longitude;
          clockInData.address = locationData.address;
          clockInData.accuracy = locationData.accuracy;
        } catch {
          // proceed without location for WFH punches
        }
      } else if (requiresLocation) {
        try {
          const locationData = await resolveLocationForPunch();
          clockInData.latitude = locationData.latitude;
          clockInData.longitude = locationData.longitude;
          clockInData.address = locationData.address;
          clockInData.accuracy = locationData.accuracy;
        } catch (error) {
          toast.error(`Location is required for punch-in. ${mapGeolocationError(error)}`);
          setIsProcessing(false);
          return;
        }
      }

      // Try to punch in
      try {
        const result = await dispatch(clockIn(clockInData)).unwrap();
        // State is updated in clockIn.fulfilled; don't refetch or cached get-logs can overwrite with stale data
        const successMessage = result?.message || 'Punched in successfully!';
        toast.success(successMessage);
        
        if (result?.warning) {
          toast.warning(result.warning);
        }

        if (isHrAttendanceUser) {
          try {
            const status = await dispatch(fetchMyTodayStatus()).unwrap();
            if (status?.session) {
              setCurrentSession(status.session);
            }
          } catch {
            // session already merged via clockIn.fulfilled when ids match
          }
        }
      } catch (err) {
        // Extract error message with better handling
        const errorData = err?.response?.data || err?.payload?.data || err?.payload;
        let errorMessage = 'Failed to punch in. Please try again.';
        
        // Handle validation errors (array of errors)
        if (errorData?.errors && Array.isArray(errorData.errors)) {
          errorMessage = errorData.errors.map(e => e.message || e.msg).join(', ');
        } 
        // Handle single error message
        else if (errorData?.message) {
          errorMessage = errorData.message;
        } 
        // Handle payload message
        else if (err?.payload?.message) {
          errorMessage = err.payload.message;
        }
        // Handle direct error message
        else if (err?.message) {
          errorMessage = err.message;
        }
        
        toast.error(errorMessage);

        if (
          errorData?.code === 'ALREADY_CLOCKED_IN' ||
          errorMessage.includes('Already clocked in')
        ) {
          if (errorData?.session) {
            setCurrentSession(errorData.session);
          }
          try {
            await dispatch(fetchMyTodayStatus()).unwrap();
          } catch {
            // non-fatal
          }
        }
      } finally {
        setIsProcessing(false);
      }
      
    } catch {
      setIsProcessing(false);
      try {
        await dispatch(fetchMyTodayStatus()).unwrap();
      } catch {
        // Silently fail
      }
    }
  };

  const handleClockOut = async () => {
    if (!currentSession) {
      toast.warning('No active session to punch out from.');
      return;
    }
    
    // Check if already clocked out
    if (currentSession.clockOut) {
      toast.info('You have already punched out for today.');
      return;
    }
    
    // Don't allow clock out while on break
    if (isOnBreak) {
      toast.warning('Please end your break before punching out!');
      return;
    }
    
    try {
      setIsProcessing(true);

      const requiresLocation = isLocationRequiredForPunch(attendanceRule);
      const isWfhSession =
        currentSession?.workLocation === 'work_from_home' ||
        currentSession?.secondaryWorkLocation === 'work_from_home';
      const clockOutData = {};

      if (isWfhSession) {
        // WFH session: capture location for record purposes only — never block the punch-out
        try {
          const locationData = await resolveLocationForPunch();
          clockOutData.latitude = locationData.latitude;
          clockOutData.longitude = locationData.longitude;
          clockOutData.address = locationData.address;
          clockOutData.accuracy = locationData.accuracy;
        } catch {
          // proceed without location for WFH punch-out
        }
      } else if (requiresLocation) {
        try {
          const locationData = await resolveLocationForPunch();
          clockOutData.latitude = locationData.latitude;
          clockOutData.longitude = locationData.longitude;
          clockOutData.address = locationData.address;
          clockOutData.accuracy = locationData.accuracy;
        } catch (error) {
          toast.error(`Location is required for punch-out. ${mapGeolocationError(error)}`);
          setIsProcessing(false);
          return;
        }
      }

      await dispatch(clockOut(clockOutData)).unwrap();
      toast.success('Punched out successfully!');
      setIsOnBreak(false);
      setBreakCount(0);
      try {
        await dispatch(fetchMyTodayStatus()).unwrap();
      } catch {
        // non-fatal
      }
    } catch (err) {
      const errorMessage = err?.message || 'Failed to punch out';
      toast.error(errorMessage);
      // Removed console.error for production
      
      // If already clocked out, fetch fresh state
      if (errorMessage.includes('Already clocked out')) {
        dispatch(fetchMyTodayStatus());
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBreakIn = async () => {
    if (!currentSession) {
      toast.warning('Please punch in first!');
      return;
    }
    
    if (isOnBreak) {
      toast.info('You are already on break!');
      return;
    }
    
    // Check break limit (3 or 4 breaks)
    const MAX_BREAKS = 4;
    if (breakCount >= MAX_BREAKS) {
      toast.warning(`You can only take ${MAX_BREAKS} breaks per day.`);
      return;
    }
    
    try {
      await dispatch(breakIn()).unwrap();
      // State is updated in breakIn.fulfilled; do not refetch here or cached get-logs can overwrite with stale data
      toast.success('Break started!');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to start break';
      toast.error(errorMessage);
      // If server says already on break, refetch to sync UI (cache is invalidated on break-in so this gets fresh data)
      if (errorMessage.toLowerCase().includes('already on break')) {
        dispatch(fetchMyTodayStatus());
      }
    }
  };

  const handleBreakOut = async () => {
    if (!isOnBreak) {
      toast.info('You are not on break!');
      return;
    }
    
    try {
      await dispatch(breakOut()).unwrap();
      // State is updated in breakOut.fulfilled; do not refetch or cached get-logs can overwrite with stale data
      toast.success('Break ended!');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to end break';
      toast.error(errorMessage);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return format(new Date(dateString), 'h:mm a'); // 12-hour format with AM/PM
  };

  const formatElapsedTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHours = (seconds) => {
    const hours = seconds / 3600;
    return hours.toFixed(2);
  };

  const getTodayBreakSeconds = (session, now = new Date()) => {
    if (!session?.breaks || !Array.isArray(session.breaks)) return 0;
    return session.breaks.reduce((total, entry) => {
      if (!entry?.breakIn) return total;
      const breakIn = new Date(entry.breakIn).getTime();
      if (!Number.isFinite(breakIn)) return total;
      const breakOut = entry.breakOut ? new Date(entry.breakOut).getTime() : now.getTime();
      if (!Number.isFinite(breakOut) || breakOut <= breakIn) return total;
      return total + ((breakOut - breakIn) / 1000);
    }, 0);
  };

  const getIndividualBreakDurations = (session, now = new Date()) => {
    if (!session?.breaks || !Array.isArray(session.breaks)) return [];
    return session.breaks.map((entry, index) => {
      if (!entry?.breakIn) return null;
      const breakIn = new Date(entry.breakIn).getTime();
      if (!Number.isFinite(breakIn)) return null;
      const breakOut = entry.breakOut ? new Date(entry.breakOut).getTime() : now.getTime();
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

  const formatBreakDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBreakDisplayName = (breakType) => {
    if (!breakType) return 'Break';
    if (breakType === 'LUNCH') return 'Lunch';
    return breakType.replace('BREAK_', 'Break ');
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

  const breakTakenTodaySeconds = getTodayBreakSeconds(currentSession, currentTime);
  const individualBreaks = getIndividualBreakDurations(currentSession, currentTime);

  if (initialLoading || loading) {
    return (
      <div className={`flex items-center justify-center ${variant === 'dashboard' ? 'rounded-2xl bg-white border border-slate-100 py-14' : 'p-12'}`}>
        <div className="text-center">
          <div
            className={`animate-spin rounded-full h-12 w-12 border-2 border-transparent mx-auto mb-4 ${
              variant === 'dashboard' ? 'border-t-[#20C997] border-r-[#20C997]' : 'border-b-2 border-indigo-600'
            }`}
          />
          <p className="text-gray-600 text-sm">Loading attendance…</p>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    const activeBreakEntry = currentSession?.breaks?.find((b) => b.breakIn && !b.breakOut);
    const currentBreakElapsedSec =
      activeBreakEntry && currentTime
        ? Math.max(0, (currentTime.getTime() - new Date(activeBreakEntry.breakIn).getTime()) / 1000)
        : 0;

    const breakTodayRow = (
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
        <div className="flex items-center gap-2">
          <FiCoffee className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="text-sm font-medium">Break taken today</span>
        </div>
        <span className="text-sm font-semibold tabular-nums">{formatBreakDuration(breakTakenTodaySeconds)}</span>
      </div>
    );

    const individualBreaksRow = individualBreaks.length > 0 && (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <FiCoffee className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="text-xs font-medium text-slate-600">Individual breaks</span>
        </div>
        <div className="space-y-1">
          {individualBreaks.map((breakInfo) => (
            <div key={breakInfo.breakType} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{breakInfo.breakType.replace('BREAK_', 'Break ')}</span>
              <span className={`font-medium tabular-nums ${breakInfo.isActive ? 'text-amber-600' : 'text-slate-700'}`}>
                {formatBreakDuration(breakInfo.duration)}
                {breakInfo.isActive && ' (active)'}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 mt-1">
            <span className="font-medium text-slate-700">Total</span>
            <span className="font-semibold tabular-nums text-slate-700">{formatBreakDuration(breakTakenTodaySeconds)}</span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="relative rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {typeof error === 'string' ? error : error.message}
          </div>
        )}
        {showNonWorkingDayNotice && !currentSession && (
          <div
            className={`mx-4 mt-4 rounded-xl px-4 py-3 text-sm ${
              punchBlockedByNonWorkingDay
                ? 'border border-slate-200 bg-slate-50 text-slate-700'
                : 'border border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <p className="font-semibold">{nonWorkingDayLabel}</p>
            <p className="mt-0.5 text-xs opacity-90">
              {punchBlockedByNonWorkingDay
                ? "Punch-in isn't available on non-working days."
                : 'Non-working day — punch-in is allowed by your organization.'}
            </p>
          </div>
        )}
        {halfDayWfhNotice && !wfhNoticeDismissed && (
          <div className="mx-4 mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{halfDayWfhNotice.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed opacity-90">{halfDayWfhNotice.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setWfhNoticeDismissed(true)}
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
                aria-label="Dismiss"
              >
                OK
              </button>
            </div>
          </div>
        )}
        <div className="relative p-5 md:p-6">
          {punchBlockedByNonWorkingDay && !currentSession && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-white/70 backdrop-blur-[1px]"
              aria-hidden="true"
            >
              <div className="mx-4 max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
                <p className="text-sm font-semibold text-slate-800">{nonWorkingDayLabel}</p>
                <p className="mt-1 text-xs text-slate-500">Can&apos;t punch in today</p>
              </div>
            </div>
          )}
          {currentSession ? (
            <div className="space-y-4">
              {currentSession.clockOut ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#20C997]/15 flex items-center justify-center">
                        <FiCheckCircle className="w-6 h-6 text-[#20C997]" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
                        <p className="text-lg font-semibold text-slate-800">Punched out</p>
                        <p className="text-sm text-slate-500">
                          In {formatTime(currentSession.clockIn)} · Out {formatTime(currentSession.clockOut)}
                        </p>
                        {shiftLabel ? (
                          <p className="mt-0.5 text-xs font-medium text-slate-500">{shiftLabel}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-semibold text-slate-800 tabular-nums">{formatElapsedTime(elapsedTime)}</p>
                      <p className="text-xs text-slate-500">Total duration</p>
                    </div>
                  </div>
                  {breakTodayRow}
                  {individualBreaksRow}
                </>
              ) : (
                <>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="font-mono text-3xl sm:text-4xl font-semibold text-slate-800 tabular-nums tracking-tight shrink-0">
                        {formatElapsedTime(elapsedTime)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                            isOnBreak
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-[#20C997]/12 text-[#006D4E]'
                          }`}
                        >
                          {isOnBreak ? 'On break' : 'Punched in'}
                        </span>
                        {currentSession.workLocation === 'work_from_home' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">
                            <FiHome className="h-3.5 w-3.5" />
                            WFH
                          </span>
                        )}
                        {shiftLabel ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                            {shiftLabel}
                          </span>
                        ) : null}
                        <span className="text-sm text-slate-500">
                          Since {formatTime(currentSession.clockIn)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
                      {canContinueSecondHalf ? (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkLocation('work_from_home');
                            handleClockIn();
                          }}
                          disabled={isProcessing || loading || isOnBreak}
                          className="rounded-full border-2 border-sky-500 px-5 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-40"
                        >
                          Continue · WFH
                        </button>
                      ) : null}
                      {!isOnBreak ? (
                        <button
                          type="button"
                          onClick={handleBreakIn}
                          disabled={loading || breakCount >= 4}
                          className="rounded-full border-2 border-[#20C997] px-5 py-2.5 text-sm font-semibold text-[#20C997] transition hover:bg-[#20C997]/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {breakCount >= 4 ? 'Max breaks' : 'Start break'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleBreakOut}
                          disabled={loading}
                          className="rounded-full border-2 border-[#20C997] px-5 py-2.5 text-sm font-semibold text-[#20C997] transition hover:bg-[#20C997]/10 disabled:opacity-50"
                        >
                          End break
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClockOut}
                        disabled={loading || isOnBreak}
                        className="rounded-full bg-[#20C997] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ab589] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isOnBreak ? 'End break to punch out' : 'Punch out'}
                      </button>
                    </div>
                  </div>
                  {isOnBreak && activeBreakEntry && (
                    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                            <FiCoffee className="h-6 w-6 text-amber-800" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/90">Break timer</p>
                            <p className="font-mono text-2xl font-bold tabular-nums text-amber-950 sm:text-3xl">
                              {formatElapsedTime(currentBreakElapsedSec)}
                            </p>
                            <p className="text-xs text-amber-900/80">
                              Started {formatTime(activeBreakEntry.breakIn)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-amber-900/85 sm:max-w-[200px] sm:text-right">
                          This break counts toward &quot;break taken today&quot; below.
                        </p>
                      </div>
                    </div>
                  )}
                  {breakTodayRow}
                  {individualBreaksRow}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance</p>
                <p className="text-lg font-semibold text-slate-800">Ready to start your day?</p>
                <p className="text-sm text-slate-500">Punch in to begin tracking your hours.</p>
                {attendanceRule?.assignedShift?.name || shiftLabel ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {shiftLabel ||
                      `${attendanceRule.assignedShift.name}${
                        attendanceRule.officeHours?.startTime && attendanceRule.officeHours?.endTime
                          ? ` · ${attendanceRule.officeHours.startTime}–${attendanceRule.officeHours.endTime}`
                          : ''
                      }`}
                  </p>
                ) : null}
                {shiftCheckInHint ? (
                  <p className="mt-0.5 text-xs font-medium text-[#0F766E]">{shiftCheckInHint}</p>
                ) : null}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                {wfhAllowed && (
                  <div className="flex w-full sm:w-auto rounded-full border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Work location">
                    {!lockWfhOnly && (
                      <button
                        type="button"
                        onClick={() => setWorkLocation('office')}
                        className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                          workLocation === 'office'
                            ? 'bg-white text-[#006D4E] shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <FiMapPin className="h-3.5 w-3.5" />
                        Office
                      </button>
                    )}
                    {!lockOfficeOnly && (
                      <button
                        type="button"
                        onClick={() => setWorkLocation('work_from_home')}
                        className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                          workLocation === 'work_from_home'
                            ? 'bg-white text-[#006D4E] shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <FiHome className="h-3.5 w-3.5" />
                        Home
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleClockIn}
                  disabled={isProcessing || loading || punchBlockedByNonWorkingDay}
                  className="rounded-full bg-[#20C997] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ab589] disabled:bg-slate-300 shrink-0"
                >
                  {isProcessing || loading
                    ? 'Processing…'
                    : punchBlockedByNonWorkingDay
                      ? 'Unavailable today'
                      : isWfhSelected
                        ? 'Punch in · WFH'
                        : 'Punch in'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-theme-primary" style={{ background: 'var(--color-primary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  // Fire-and-forget notify admins about back action
                  axios.post('/v1/both/notification/employee-back', {}, { withCredentials: true }).catch(() => {});
                } catch {
                  // Ignore notification errors
                }
                navigate('/dashboard');
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Go back to dashboard"
            >
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FiClock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Attendance Tracker</h2>
              <p className="text-white/80 text-xs">Track your work hours</p>
            </div>
          </div>
          
          {/* Real-time Clock */}
          <div className="text-white">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="w-2 h-2 rounded-full animate-pulse bg-theme-primary" style={{ backgroundColor: 'var(--color-primary)' }}></div>
              {formatInOrgTimezone(currentTime, 'h:mm:ss a', orgTimezone)}
            </div>
            <div className="text-xs text-white/80">{formatInOrgTimezone(currentTime, 'EEEE, MMM dd', orgTimezone)}</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-8 mt-6">
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-800 p-6 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <FiAlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800 mb-1">Error</h4>
                <p className="text-sm text-red-700">{typeof error === 'string' ? error : error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative p-6">
          {showNonWorkingDayNotice && !currentSession && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                punchBlockedByNonWorkingDay
                  ? 'border border-slate-200 bg-slate-50 text-slate-700'
                  : 'border border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <p className="font-semibold">{nonWorkingDayLabel}</p>
              <p className="mt-0.5 text-xs opacity-90">
                {punchBlockedByNonWorkingDay
                  ? "Punch-in isn't available on non-working days."
                  : 'Non-working day — punch-in is allowed by your organization.'}
              </p>
            </div>
          )}
          {halfDayWfhNotice && !wfhNoticeDismissed && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <div className="flex items-start justify-between gap-3">
                <div className="text-left">
                  <p className="font-semibold">{halfDayWfhNotice.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed opacity-90">{halfDayWfhNotice.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWfhNoticeDismissed(true)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
                  aria-label="Dismiss"
                >
                  OK
                </button>
              </div>
            </div>
          )}
          {punchBlockedByNonWorkingDay && !currentSession && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]"
              aria-hidden="true"
            >
              <div className="mx-4 max-w-sm rounded-xl border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
                <p className="text-base font-semibold text-slate-800">{nonWorkingDayLabel}</p>
                <p className="mt-1 text-sm text-slate-500">Can&apos;t punch in on a non-working day</p>
              </div>
            </div>
          )}
          {currentSession ? (
          <div className="space-y-4">
            {/* Checked In/Out Status */}
            <div className={`rounded-xl p-6 border ${
              currentSession.clockOut 
                ? 'bg-theme-primary/10 border-theme-primary' 
                : 'bg-theme-secondary/10 border-theme-secondary'
            }`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    currentSession.clockOut 
                      ? 'bg-theme-primary' 
                      : 'bg-theme-primary'
                  }`}>
                    <FiCheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold mb-1 ${
                      currentSession.clockOut 
                        ? 'text-theme-primary' 
                        : 'text-theme-primary'
                    }`}>
                      {currentSession.clockOut ? 'Punched Out' : 'Punched In'}
                      {currentSession.workLocation === 'work_from_home' && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 align-middle">
                          <FiHome className="w-3 h-3" />
                          WFH
                        </span>
                      )}
                    </h3>
                    <p className={`text-sm font-medium ${
                      currentSession.clockOut 
                        ? 'text-theme-primary' 
                        : 'text-theme-primary'
                    }`}>
                      {currentSession.clockOut 
                        ? `Punch-Out Time: ${formatTime(currentSession.clockOut)}` 
                        : `Punch-In Time: ${formatTime(currentSession.clockIn)}`}
                    </p>
                    {shiftLabel ? (
                      <p className="mt-1 text-xs font-medium text-slate-600">{shiftLabel}</p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono mb-1 ${
                    currentSession.clockOut 
                      ? 'text-theme-primary' 
                      : 'text-theme-primary'
                  }`}>
                    {formatElapsedTime(elapsedTime)}
                  </div>
                  <div className={`text-sm font-medium ${
                    currentSession.clockOut 
                      ? 'text-theme-primary' 
                      : 'text-theme-primary'
                  }`}>
                    {currentSession.clockOut 
                      ? 'Total work duration' 
                      : `${formatHours(elapsedTime)} hours`}
                  </div>
                </div>
              </div>

              {/* Break Status */}
              {isOnBreak && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <FiCoffee className="w-5 h-5" />
                    <span className="font-medium">On Break</span>
                  </div>
                </div>
              )}

              {currentSession && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2">
                      <FiCoffee className="w-5 h-5" />
                      <span className="font-medium">Break Taken Today</span>
                    </div>
                    <span className="text-sm font-semibold">{formatBreakDuration(breakTakenTodaySeconds)}</span>
                  </div>
                </div>
              )}

              {/* Checked Out Status */}
              {currentSession?.clockOut && (
                <div className="border rounded-lg p-3 mb-4 bg-theme-primary/10 border-theme-primary">
                  <div className="flex items-center justify-between text-theme-primary" style={{ color: 'var(--color-primary)' }}>
                    <div className="flex items-center gap-2">
                      <FiCheckCircle className="w-5 h-5" />
                      <span className="font-medium">Punched Out</span>
                    </div>
                    <span className="text-sm">{formatTime(currentSession.clockOut)}</span>
                  </div>
                </div>
              )}
                </div>
                
            {/* Break Buttons - Only show when not clocked out */}
            {!currentSession.clockOut && (
              <div className="grid grid-cols-2 gap-3">
                {isOnBreak ? (
                      <button
                    onClick={handleBreakOut}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-lg text-white font-semibold shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                      loading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-theme-primary hover:opacity-90'
                    }`}
                  >
                    {loading ? (
                      <FiLoader className="animate-spin w-4 h-4" />
                    ) : (
                      <>
                        <FiCoffee className="w-4 h-4" />
                        End Break
                      </>
                    )}
                  </button>
                ) : (
                    <button
                    onClick={handleBreakIn}
                    disabled={loading || breakCount >= 4}
                    className={`w-full py-3 px-4 rounded-lg text-white font-semibold shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                      loading || breakCount >= 4
                          ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-theme-primary hover:opacity-90'
                      }`}
                    >
                    {loading ? (
                      <FiLoader className="animate-spin w-4 h-4" />
                    ) : breakCount >= 4 ? (
                      <>
                        <FiCoffee className="w-4 h-4" />
                        Max Reached
                      </>
                    ) : (
                      <>
                        <FiCoffee className="w-4 h-4" />
                        Start Break
                      </>
                    )}
                      </button>
                    )}

                      <button
                        onClick={handleClockOut}
                        disabled={loading || isOnBreak}
                        className={`w-full py-3 px-4 rounded-lg text-white font-semibold shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                          loading || isOnBreak
                                  ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {loading ? (
                          <FiLoader className="animate-spin w-4 h-4" />
                        ) : (
                          <>
                            <FiClock className="w-4 h-4" />
                            Punch Out
                          </>
                        )}
                      </button>
              </div>
            )}
                </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-xl bg-theme-primary/10 flex items-center justify-center mx-auto mb-4">
              <FiClock className="w-8 h-8 text-theme-primary" style={{ color: 'var(--color-primary)' }} />
                      </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Start?</h3>
            <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
              Click below to punch in and start tracking your work hours
            </p>

            {/* Work Location Selection (Office / Work From Home) */}
            {wfhAllowed && (
              <div className="flex justify-center gap-3 mb-6" role="group" aria-label="Work location">
                {!lockWfhOnly && (
                  <button
                    type="button"
                    onClick={() => setWorkLocation('office')}
                    className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                      workLocation === 'office'
                        ? 'border-theme-primary bg-theme-primary/10 text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <FiMapPin className="w-4 h-4" />
                    Punch In – Office
                  </button>
                )}
                {!lockOfficeOnly && (
                  <button
                    type="button"
                    onClick={() => setWorkLocation('work_from_home')}
                    className={`flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all ${
                      workLocation === 'work_from_home'
                        ? 'border-theme-primary bg-theme-primary/10 text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <FiHome className="w-4 h-4" />
                    Punch In – Work From Home
                  </button>
                )}
              </div>
            )}

            {/* Punch In Button */}
              <button
                onClick={handleClockIn}
              disabled={isProcessing || loading || punchBlockedByNonWorkingDay}
              className={`w-full py-4 px-6 rounded-lg text-white font-semibold shadow-lg transition-all duration-200 ${
                isProcessing || loading || punchBlockedByNonWorkingDay
                    ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-theme-primary hover:opacity-90'
                }`}
              >
              {isProcessing || loading ? (
                  <div className="flex items-center justify-center">
                  <FiLoader className="animate-spin w-5 h-5 mr-2" />
                    Processing...
                  </div>
                ) : punchBlockedByNonWorkingDay ? (
                  <div className="flex items-center justify-center">
                    <FiAlertCircle className="w-5 h-5 mr-2" />
                    Unavailable today
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                  {isWfhSelected ? <FiHome className="w-5 h-5 mr-2" /> : <FiClock className="w-5 h-5 mr-2" />}
                    {isWfhSelected ? 'Punch In (Work From Home)' : 'Punch In'}
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        {/* All Employee Breaks Modal */}
        {showAllEmployeesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] flex items-center justify-center shrink-0">
                    <FiUsers className="h-6 w-6 text-[#0F766E]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">All Employee Breaks</h3>
                    <p className="text-sm text-slate-500 mt-0.5">View break details for all employees</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllEmployeesModal(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
                >
                  <FiX className="h-6 w-6" />
                </button>
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
    </div>
  );
};

export default AttendanceBox;