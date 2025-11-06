import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { clockIn, clockOut, breakIn, breakOut, fetchLogs, fetchMyTodayStatus } from '../../context/attendanceSlice';
import { format } from 'date-fns';
import { FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiCoffee, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const AttendanceBox = () => {
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
          } catch (e) {
            // swallow - optional enrichment
          }
        }
        } catch (error) {
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
        // Removed console.log for production
        const today = format(new Date(), 'yyyy-MM-dd');
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
        // Also reflect currentSession instantly for UX
        setCurrentSession(openSession);
        return; // Don't try to check in again
      }

      // Try to check in
      const result = await dispatch(clockIn({ workLocation: 'office' }));
      
      if (result.type === 'attendance/clockIn/fulfilled') {
        // Refetch logs to update the state immediately (don't await to avoid blocking)
        const today = format(new Date(), 'yyyy-MM-dd');
        dispatch(fetchLogs({
          startDate: today,
          endDate: today
        }));
        toast.success('Checked in successfully!');
        } else if (result.type === 'attendance/clockIn/rejected') {
          // Handle the rejected case - might be already checked in
          // Removed console.log for production
          const today = format(new Date(), 'yyyy-MM-dd');
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
      }
      
    } catch (err) {
      // Removed console.error for production
      // If already checked in, try to fetch logs anyway
      const today = format(new Date(), 'yyyy-MM-dd');
      try {
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
      } catch (fetchErr) {
        // Removed console.error for production
      }
    }
  };

  const handleClockOut = async () => {
    if (!currentSession) {
      toast.warning('No active session to clock out from.');
      return;
    }
    
    // Check if already clocked out
    if (currentSession.clockOut) {
      toast.info('You have already clocked out for today.');
      return;
    }
    
    // Don't allow clock out while on break
    if (isOnBreak) {
      toast.warning('Please end your break before clocking out!');
      return;
    }
    
    try {
      const result = await dispatch(clockOut({})).unwrap();
      
      // Update the currentSession with the clockOut data
      if (result) {
        setCurrentSession(result);
      }
      
      // Refetch logs to update the state (don't await to avoid blocking)
      const today = format(new Date(), 'yyyy-MM-dd');
      dispatch(fetchLogs({
        startDate: today,
        endDate: today
      }));
      
      toast.success('Checked out successfully!');
      setIsOnBreak(false);
      setBreakCount(0);
    } catch (err) {
      const errorMessage = err?.message || 'Failed to check out';
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
    }
  };

  const handleBreakIn = async () => {
    if (!currentSession) {
      toast.warning('Please check in first!');
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
      
      // Refetch logs to update the state (but don't await to avoid blocking)
      const today = format(new Date(), 'yyyy-MM-dd');
      dispatch(fetchLogs({
        startDate: today,
        endDate: today
      }));
      
      toast.success('Break started!');
    } catch (err) {
      const errorMessage = err?.message || 'Failed to start break';
      toast.error(errorMessage);
      // If server says already on break, sync state immediately
      if (errorMessage.toLowerCase().includes('already on break')) {
        try {
          const today = format(new Date(), 'yyyy-MM-dd');
          dispatch(fetchLogs({
            startDate: today,
            endDate: today
          }));
        } catch {}
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
      
      // Refetch logs to update the state (but don't await to avoid blocking)
      const today = format(new Date(), 'yyyy-MM-dd');
      dispatch(fetchLogs({
        startDate: today,
        endDate: today
      }));
      
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

  if (initialLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                try {
                  // Fire-and-forget notify admins about back action
                  axios.post('/v1/both/notification/employee-back', {}, { withCredentials: true }).catch(() => {});
                } catch {}
                navigate('/dashboard-employee');
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
              <p className="text-blue-100 text-xs">Track your work hours</p>
            </div>
          </div>
          
          {/* Real-time Clock */}
          <div className="text-white">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {format(currentTime, 'h:mm:ss a')}
            </div>
            <div className="text-xs text-blue-100">{format(currentTime, 'EEEE, MMM dd')}</div>
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
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    currentSession.clockOut 
                      ? 'bg-blue-500' 
                      : 'bg-green-500'
                  }`}>
                    <FiCheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold mb-1 ${
                      currentSession.clockOut 
                        ? 'text-blue-800' 
                        : 'text-green-800'
                    }`}>
                      {currentSession.clockOut ? 'Checked Out' : 'Checked In'}
                    </h3>
                    <p className={`text-sm font-medium ${
                      currentSession.clockOut 
                        ? 'text-blue-600' 
                        : 'text-green-600'
                    }`}>
                      {currentSession.clockOut 
                        ? `Check-Out Time: ${formatTime(currentSession.clockOut)}` 
                        : `Check-In Time: ${formatTime(currentSession.clockIn)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono mb-1 ${
                    currentSession.clockOut 
                      ? 'text-blue-600' 
                      : 'text-green-600'
                  }`}>
                    {formatElapsedTime(elapsedTime)}
                  </div>
                  <div className={`text-sm font-medium ${
                    currentSession.clockOut 
                      ? 'text-blue-600' 
                      : 'text-green-600'
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

              {/* Checked Out Status */}
              {currentSession?.clockOut && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-blue-800">
                    <div className="flex items-center gap-2">
                      <FiCheckCircle className="w-5 h-5" />
                      <span className="font-medium">Checked Out</span>
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
                        : 'bg-green-500 hover:bg-green-600'
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
                        : 'bg-blue-500 hover:bg-blue-600'
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
                            Check Out
                          </>
                        )}
                      </button>
              </div>
            )}
                </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FiClock className="w-8 h-8 text-blue-600" />
                      </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Start?</h3>
            <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
              Click below to check in and start tracking your work hours
            </p>

            {/* Check In Button */}
              <button
                onClick={handleClockIn}
              disabled={loading}
              className={`w-full py-4 px-6 rounded-lg text-white font-semibold shadow-lg transition-all duration-200 ${
                loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-500 hover:bg-green-600'
                }`}
              >
              {loading ? (
                  <div className="flex items-center justify-center">
                  <FiLoader className="animate-spin w-5 h-5 mr-2" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                  <FiClock className="w-5 h-5 mr-2" />
                    Check In
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