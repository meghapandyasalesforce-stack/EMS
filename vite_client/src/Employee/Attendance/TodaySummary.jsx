import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLogs } from '../../context/attendanceSlice';
import { format } from 'date-fns';
import { 
  FiCalendar, 
  FiClock, 
  FiTrendingUp, 
  FiCoffee, 
  FiTarget,
  FiAward,
  FiBarChart3
} from 'react-icons/fi';

const TodaySummary = () => {
  const dispatch = useDispatch();
  const {
    dailyStats,
    loading,
    error
  } = useSelector((state) => state.attendance);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [initialLoading, setInitialLoading] = useState(true);

  // Calculate derived values
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayStats = dailyStats?.[todayKey] || { 
    sessions: [], 
    totalEffectiveHours: 0, 
    totalGrossHours: 0 
  };

  const totalSessions = todayStats.sessions.length;
  const totalHours = todayStats.totalEffectiveHours || 0;
  const breakTime = (todayStats.totalGrossHours || 0) - (todayStats.totalEffectiveHours || 0);
  const overtime = Math.max(0, (todayStats.totalEffectiveHours || 0) - 8);
  const progressPercentage = Math.min((todayStats.totalEffectiveHours || 0) / 8 * 100, 100);

  // Fetch attendance data on component mount
  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setInitialLoading(true);
        const today = format(new Date(), 'yyyy-MM-dd');
        await dispatch(fetchLogs({
          startDate: today,
          endDate: today
        })).unwrap();
      } catch (error) {
        console.error('Failed to fetch attendance data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAttendanceData();
  }, [dispatch]);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'from-green-500 to-emerald-600';
    if (percentage >= 75) return 'from-blue-500 to-indigo-600';
    if (percentage >= 50) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-600';
  };

  const getProgressText = (percentage) => {
    if (percentage >= 100) return 'Excellent!';
    if (percentage >= 75) return 'Great progress!';
    if (percentage >= 50) return 'Halfway there!';
    return 'Keep going!';
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 px-8 py-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <FiBarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Today's Summary</h2>
              <p className="text-purple-100 text-sm font-medium">Track your daily progress and achievements</p>
            </div>
          </div>
          
          {/* Current Date */}
          <div className="bg-white/15 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-lg border border-white/20">
            <div className="text-right">
              <div className="text-lg font-bold">{format(currentTime, 'EEEE')}</div>
              <div className="text-sm text-purple-100 font-medium">{format(currentTime, 'MMM dd, yyyy')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-8 mt-6">
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-red-800 p-6 rounded-2xl shadow-lg" role="alert">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <FiClock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800 mb-1">Error Loading Data</h4>
                <p className="text-sm text-red-700">{typeof error === 'string' ? error : error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading || initialLoading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-purple-400"></div>
          </div>
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Loading Today's Summary</h3>
            <p className="text-gray-600 text-sm">Please wait while we fetch your data...</p>
          </div>
        </div>
      ) : (
        <div className="p-8">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {/* Total Hours */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <FiClock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total Hours</p>
                  <p className="text-2xl font-bold text-blue-800">{totalHours.toFixed(1)}h</p>
                </div>
              </div>
              <div className="text-sm text-blue-600 font-medium">
                {totalSessions} session{totalSessions !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Break Time */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                  <FiCoffee className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Break Time</p>
                  <p className="text-2xl font-bold text-green-800">{breakTime.toFixed(1)}h</p>
                </div>
              </div>
              <div className="text-sm text-green-600 font-medium">
                {breakTime > 0 ? 'Well deserved!' : 'No breaks taken'}
              </div>
            </div>

            {/* Effective Hours */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <FiTrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Effective</p>
                  <p className="text-2xl font-bold text-purple-800">{totalHours.toFixed(1)}h</p>
                </div>
              </div>
              <div className="text-sm text-purple-600 font-medium">
                {totalHours >= 8 ? 'Target achieved!' : `${(8 - totalHours).toFixed(1)}h to go`}
              </div>
            </div>

            {/* Overtime */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <FiAward className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Overtime</p>
                  <p className="text-2xl font-bold text-orange-800">{overtime.toFixed(1)}h</p>
                </div>
              </div>
              <div className="text-sm text-orange-600 font-medium">
                {overtime > 0 ? 'Great dedication!' : 'No overtime'}
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-3xl p-8 border border-indigo-200 shadow-xl mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <FiTarget className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Daily Progress</h3>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-gray-700">8-Hour Target</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-indigo-600">
                    {progressPercentage.toFixed(0)}%
                  </span>
                  <p className="text-sm text-gray-600 font-medium">
                    {getProgressText(progressPercentage)}
                  </p>
                </div>
              </div>
              
              {/* Enhanced Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-6 shadow-inner mb-4">
                <div 
                  className={`bg-gradient-to-r ${getProgressColor(progressPercentage)} h-6 rounded-full transition-all duration-1000 shadow-lg`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-sm text-gray-600 font-medium">
                <span>0h</span>
                <span className="text-indigo-600 font-bold">{totalHours.toFixed(1)}h worked</span>
                <span>8h Target</span>
              </div>
            </div>
          </div>

          {/* Achievement Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sessions Completed */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <FiCalendar className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="font-bold text-gray-800">Sessions</h4>
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">{totalSessions}</div>
              <p className="text-sm text-emerald-600 font-medium">
                {totalSessions === 0 ? 'No sessions today' : 
                 totalSessions === 1 ? '1 session completed' : 
                 `${totalSessions} sessions completed`}
              </p>
            </div>

            {/* Productivity Score */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-violet-600" />
                </div>
                <h4 className="font-bold text-gray-800">Productivity</h4>
              </div>
              <div className="text-3xl font-bold text-violet-600 mb-2">
                {Math.round((totalHours / 8) * 100)}%
              </div>
              <p className="text-sm text-violet-600 font-medium">
                {totalHours >= 8 ? 'Excellent work!' : 
                 totalHours >= 6 ? 'Good progress!' : 
                 'Keep pushing!'}
              </p>
            </div>

            {/* Efficiency Rating */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <FiAward className="w-5 h-5 text-amber-600" />
                </div>
                <h4 className="font-bold text-gray-800">Efficiency</h4>
              </div>
              <div className="text-3xl font-bold text-amber-600 mb-2">
                {breakTime > 0 ? Math.round((totalHours / (totalHours + breakTime)) * 100) : 100}%
              </div>
              <p className="text-sm text-amber-600 font-medium">
                {breakTime === 0 ? 'Perfect focus!' : 
                 breakTime < totalHours * 0.2 ? 'Great balance!' : 
                 'Consider more breaks'}
              </p>
            </div>
          </div>

          {/* Motivational Message */}
          {totalHours > 0 && (
            <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiAward className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">
                  {totalHours >= 8 ? '🎉 Outstanding Work!' : 
                   totalHours >= 6 ? '💪 Great Progress!' : 
                   '🚀 Keep Going!'}
                </h3>
                <p className="text-green-700 font-medium">
                  {totalHours >= 8 ? 
                    `You've exceeded your daily target with ${overtime.toFixed(1)} hours of overtime!` :
                    totalHours >= 6 ?
                    `You're ${(8 - totalHours).toFixed(1)} hours away from your daily target.` :
                    `You've worked ${totalHours.toFixed(1)} hours today. Every hour counts!`
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TodaySummary;
