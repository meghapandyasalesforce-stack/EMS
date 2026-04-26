import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clockIn, clockOut, breakIn, breakOut, fetchLogs, fetchMyTodayStatus } from '../../context/attendanceSlice';
import { format } from 'date-fns';
import { FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiCoffee, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { usePermissions } from '../../Hooks/usePermissions';

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
  
  // Get current user from auth state
  const currentUser = useSelector((state) => state.auth.user);

  const [currentSession, setCurrentSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [initialLoading, setInitialLoading] = useState(true);
  const [breakCount, setBreakCount] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [attendanceRule, setAttendanceRule] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Permission management
  const {
    isPermissionDenied
  } = usePermissions();

  // Fetch today's logs on component mount
  useEffect(() => {
    const fetchTodayLogs = async () => {
      try {
        setInitialLoading(true);
        const today = format(new Date(), 'yyyy-MM-dd');
        // Removed console.log for production
        const result = await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
        // Removed console.log statements for production

        // Fallback: if no sessions returned but user is already checked in, try today-status
        if (!result?.sessions || result.sessions.length === 0) {
          try {
            const status = await dispatch(fetchMyTodayStatus()).unwrap();
            if (status?.session && !status.session.clockOut) {
              setCurrentSession(status.session);
            }
          } catch {
            // swallow - optional enrichment
          }
        }
      } catch {
        // Removed console.error for production
        // If fetch fails, don't show error - might be page refresh issue
      } finally {
        setInitialLoading(false);
      }
    };

    fetchTodayLogs();
  }, [dispatch]);

  // Removed automatic refresh - data will only refresh on user actions (button clicks)

  // Find current active session and check break status
  useEffect(() => {
    // Removed console.log statements for production
    
    if (sessions && sessions.length > 0) {
      // Find open session that belongs to the current user
      const openSession = sessions.find(session => {
        // Check if this session belongs to current user
        const sessionUserId = session.userId?._id || session.userId;
        const currentUserId = currentUser?.id || currentUser?._id;
        const belongsToUser = sessionUserId?.toString() === currentUserId?.toString();
        
        // Get today's date for comparison
        const today = format(new Date(), 'yyyy-MM-dd');
        const sessionDate = format(new Date(session.date), 'yyyy-MM-dd');
        const isToday = sessionDate === today;
        
        return belongsToUser && isToday;
      });
      
      // Set the session (will be null if no session for today)
      setCurrentSession(openSession || null);
      
      // Check if user is on break
      if (openSession?.breaks) {
        const activeBreak = openSession.breaks.find(b => b.breakIn && !b.breakOut);
        setIsOnBreak(!!activeBreak);
        setBreakCount(openSession.breaks.length);
      } else {
        setIsOnBreak(false);
        setBreakCount(0);
      }
    } else {
      setCurrentSession(null);
      setIsOnBreak(false);
      setBreakCount(0);
    }
  }, [sessions, currentUser]);

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

  // Fetch attendance rule on component mount
  useEffect(() => {
    const fetchAttendanceRule = async () => {
      try {
        const response = await axios.get('/v1/both/attendance/rule');
        if (response.data.success && response.data.rule) {
          setAttendanceRule(response.data.rule);
        }
      } catch {
        // Silently fail - location validation will still work
      }
    };
    fetchAttendanceRule();
  }, []);

  // Get current location with permission check
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      return Promise.reject(new Error('Geolocation not supported'));
    }

    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      return Promise.reject(new Error('Geolocation requires HTTPS'));
    }

    if (isPermissionDenied('location')) {
      return Promise.reject(new Error('Location permission denied'));
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Location request timed out'));
      }, 30000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const locationData = {
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude),
            accuracy: Number(position.coords.accuracy) || 0,
            address: 'Location detected'
          };
          resolve(locationData);
        },
        (error) => {
          clearTimeout(timeoutId);
          let errorMessage = 'Location error: ';
          const errorCode = error?.code;
          
          if (errorCode === 1 || errorCode === error?.PERMISSION_DENIED) {
            errorMessage = 'Location permission denied. Please enable it in browser settings.';
          } else if (errorCode === 2 || errorCode === error?.POSITION_UNAVAILABLE) {
            errorMessage = 'GPS position unavailable. Please check your device settings and ensure GPS is enabled.';
          } else if (errorCode === 3 || errorCode === error?.TIMEOUT) {
            errorMessage = 'Location request timed out. Please try again or check your GPS settings.';
          } else {
            errorMessage += error.message || 'Unknown error';
          }
          
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 25000,
          maximumAge: 0
        }
      );
    });
  };

  const handleClockIn = async () => {
    try {
      // Check if user already has an active session
      const openSession = sessions.find(session => {
        if (session.clockOut) return false;
        // Ensure it is for current user and today
        const sessionUserId = session.userId?._id || session.userId;
        const currentUserId = currentUser?.id || currentUser?._id;
        const belongsToUser = sessionUserId?.toString() === currentUserId?.toString();
        const today = format(new Date(), 'yyyy-MM-dd');
        const sessionDate = format(new Date(session.date), 'yyyy-MM-dd');
        return belongsToUser && sessionDate === today;
      });

      if (openSession) {
        // User already checked in - just refresh logs silently
        const today = format(new Date(), 'yyyy-MM-dd');
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
        // Also reflect currentSession instantly for UX
        setCurrentSession(openSession);
        return; // Don't try to punch in again
      }

      setIsProcessing(true);

      // Check attendance rule to see if location is required
      const hasRuleWithCoordinates = attendanceRule && 
                                      attendanceRule.coordinates && 
                                      attendanceRule.coordinates.latitude && 
                                      attendanceRule.coordinates.longitude;
      
      const requiresLocation = !!(hasRuleWithCoordinates && (
        typeof attendanceRule.locationRequired === 'boolean'
          ? attendanceRule.locationRequired
          : !attendanceRule.enableSimplePunches
      ));

      let locationData = null;

      // Get location if required
      if (requiresLocation || hasRuleWithCoordinates) {
        try {
          locationData = await getCurrentLocation();
        } catch (error) {
          if (requiresLocation) {
            let errorMsg = 'Location is required for punch-in. ';
            if (error.code === 1 || error.message.includes('permission')) {
              errorMsg += 'Please enable location permission in browser settings.';
            } else if (error.code === 2) {
              errorMsg += 'GPS position unavailable. Please enable GPS on your device.';
            } else if (error.code === 3 || error.message.includes('timeout')) {
              errorMsg += 'Location request timed out. Please try again.';
            } else {
              errorMsg += error.message || 'Please enable location services and try again.';
            }
            
            toast.error(errorMsg);
            setIsProcessing(false);
            return;
          }
        }
      }

      // Build clock-in payload
      const clockInData = {
        workLocation: 'office'
      };

      // Add location if available
      if (locationData && locationData.latitude && locationData.longitude) {
        clockInData.latitude = locationData.latitude;
        clockInData.longitude = locationData.longitude;
        clockInData.address = locationData.address;
        clockInData.accuracy = locationData.accuracy;
      }

      // Final validation before sending
      if (requiresLocation && (!clockInData.latitude || !clockInData.longitude)) {
        toast.error('Location is required for punch-in at this site. Please enable location services and try again.');
        setIsProcessing(false);
        return;
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
        
        // If already checked in, refetch logs to show current session
        if (errorData?.code === 'ALREADY_CLOCKED_IN' || errorMessage.includes('Already clocked in')) {
          const today = format(new Date(), 'yyyy-MM-dd');
          await dispatch(fetchLogs({
            startDate: today,
            endDate: today
          })).unwrap();
        }
      } finally {
        setIsProcessing(false);
      }
      
    } catch {
      setIsProcessing(false);
      // If already checked in, try to fetch logs anyway
      const today = format(new Date(), 'yyyy-MM-dd');
      try {
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
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

      // Check attendance rule to see if location is required for clock-out
      const hasRuleWithCoordinates = attendanceRule && 
                                      attendanceRule.coordinates && 
                                      attendanceRule.coordinates.latitude && 
                                      attendanceRule.coordinates.longitude;
      
      const requiresLocation = !!(hasRuleWithCoordinates && (
        typeof attendanceRule.locationRequired === 'boolean'
          ? attendanceRule.locationRequired
          : !attendanceRule.enableSimplePunches
      ));

      let locationData = null;

      if (requiresLocation || hasRuleWithCoordinates) {
        try {
          locationData = await getCurrentLocation();
        } catch (error) {
          if (requiresLocation) {
            let errorMsg = 'Location is required for punch-out. ';
            if (error.code === 1 || error.message.includes('permission')) {
              errorMsg += 'Please enable location permission in browser settings.';
            } else if (error.code === 2) {
              errorMsg += 'GPS position unavailable. Please enable GPS on your device.';
            } else if (error.code === 3 || error.message.includes('timeout')) {
              errorMsg += 'Location request timed out. Please try again.';
            } else {
              errorMsg += error.message || 'Please enable location services and try again.';
            }

            toast.error(errorMsg);
            setIsProcessing(false);
            return;
          }
        }
      }

      const clockOutData = {};
      if (locationData && locationData.latitude && locationData.longitude) {
        clockOutData.latitude = locationData.latitude;
        clockOutData.longitude = locationData.longitude;
        clockOutData.address = locationData.address;
        clockOutData.accuracy = locationData.accuracy;
      }

      // Final validation before sending
      if (requiresLocation && (!clockOutData.latitude || !clockOutData.longitude)) {
        toast.error('Location is required for punch-out at this site. Please enable location services and try again.');
        setIsProcessing(false);
        return;
      }

      await dispatch(clockOut(clockOutData)).unwrap();
      // State is updated in clockOut.fulfilled; don't refetch or cached get-logs can overwrite with stale data
      toast.success('Punched out successfully!');
      setIsOnBreak(false);
      setBreakCount(0);
    } catch (err) {
      const errorMessage = err?.message || 'Failed to punch out';
      toast.error(errorMessage);
      // Removed console.error for production
      
      // If already clocked out, fetch fresh state
      if (errorMessage.includes('Already clocked out')) {
        const today = format(new Date(), 'yyyy-MM-dd');
        dispatch(fetchLogs({
          startDate: today,
          endDate: today
        }));
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
        const today = format(new Date(), 'yyyy-MM-dd');
        dispatch(fetchLogs({ startDate: today, endDate: today }));
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

  const formatBreakDuration = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const breakTakenTodaySeconds = getTodayBreakSeconds(currentSession, currentTime);

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

    return (
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {typeof error === 'string' ? error : error.message}
          </div>
        )}
        <div className="p-5 md:p-6">
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
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-semibold text-slate-800 tabular-nums">{formatElapsedTime(elapsedTime)}</p>
                      <p className="text-xs text-slate-500">Total duration</p>
                    </div>
                  </div>
                  {breakTodayRow}
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
                        <span className="text-sm text-slate-500">
                          Since {formatTime(currentSession.clockIn)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
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
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance</p>
                <p className="text-lg font-semibold text-slate-800">Ready to start your day?</p>
                <p className="text-sm text-slate-500">Punch in to begin tracking your hours.</p>
              </div>
              <button
                type="button"
                onClick={handleClockIn}
                disabled={isProcessing || loading}
                className="rounded-full bg-[#20C997] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1ab589] disabled:bg-slate-300 shrink-0"
              >
                {isProcessing || loading ? 'Processing…' : 'Punch in'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
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
              {format(currentTime, 'h:mm:ss a')}
            </div>
            <div className="text-xs text-white/80">{format(currentTime, 'EEEE, MMM dd')}</div>
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
      <div className="p-6">
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

            {/* Punch In Button */}
              <button
                onClick={handleClockIn}
              disabled={isProcessing || loading}
              className={`w-full py-4 px-6 rounded-lg text-white font-semibold shadow-lg transition-all duration-200 ${
                isProcessing || loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-theme-primary hover:opacity-90'
                }`}
              >
              {isProcessing || loading ? (
                  <div className="flex items-center justify-center">
                  <FiLoader className="animate-spin w-5 h-5 mr-2" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                  <FiClock className="w-5 h-5 mr-2" />
                    Punch In
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
    </div>
  );
};

export default AttendanceBox;