import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiMapPin, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';

const EmployeeCalendar = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCalendar();
  }, [currentYear]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      setError(null);
      // This page is used by admin/HR as well, so prefer admin endpoint.
      // Fallback to employee endpoint for employee sessions.
      let response;
      try {
        response = await axios.get(`/v1/admin/calendar/${currentYear}`);
      } catch (adminError) {
        response = await axios.get(`/v1/employee/calendar/${currentYear}`);
      }

      const calendarData = response?.data?.data || response?.data;
      if (calendarData) {
        setCalendar(calendarData);
        return;
      }

      setCalendar({
        holidays: [],
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
    } catch (error) {
      setError('Failed to fetch calendar data');
      toast.error('Failed to fetch calendar');
      
      setCalendar({
        holidays: [],
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
          startTime: '09:00',
          endTime: '17:00',
          breakDuration: 60
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getHolidaysForMonth = (month) => {
    if (!calendar?.holidays) return [];
    return calendar.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === month - 1 && holiday.isActive;
    });
  };

  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const getHolidayTypeColor = (type) => {
    const colors = {
      national: 'bg-red-100 text-red-800 border-red-200',
      religious: 'bg-purple-100 text-purple-800 border-purple-200',
      company: 'bg-theme-secondary/10 text-theme-secondary border-theme-secondary',
      regional: 'bg-theme-primary/10 text-theme-primary border-theme-primary'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getWorkingDaysInfo = () => {
    if (!calendar?.workingDays) return null;
    
    const workingDays = Object.entries(calendar.workingDays)
      .filter(([, isWorking]) => isWorking)
      .map(([day]) => day.charAt(0).toUpperCase() + day.slice(1));
    
    return workingDays;
  };

  const getWorkingHoursInfo = () => {
    if (!calendar?.workingHours) return null;
    
    return {
      start: calendar.workingHours.startTime,
      end: calendar.workingHours.endTime,
      break: calendar.workingHours.breakDuration
    };
  };

  const generateCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const firstDay = firstDayOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const getHolidaysForDay = (day) => {
    if (!calendar?.holidays || !day) return [];
    return calendar.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getDate() === day && 
             holidayDate.getMonth() === currentMonth - 1 && 
             holidayDate.getFullYear() === currentYear &&
             holiday.isActive;
    });
  };

  const getHolidayBgColor = (type) => {
    const colors = {
      national: 'bg-red-50',
      religious: 'bg-purple-50',
      company: 'bg-blue-50',
      regional: 'bg-emerald-50'
    };
    return colors[type] || 'bg-gray-50';
  };

  const isToday = (day) => {
    if (!day) return false;
    const now = new Date();
    return (
      now.getDate() === day &&
      now.getMonth() + 1 === currentMonth &&
      now.getFullYear() === currentYear
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const holidays = getHolidaysForMonth(currentMonth);
  const workingDays = getWorkingDaysInfo();
  const workingHours = getWorkingHoursInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 sm:p-6 transition-all duration-300">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Company Calendar</h1>
              <p className="text-sm sm:text-base text-slate-600 mt-1">
                View holidays and weekly schedule for {currentYear}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium">
                <FiCalendar className="w-4 h-4 mr-2 text-slate-500" />
                {getMonthName(currentMonth)} {currentYear}
              </div>
              <div className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium">
                {holidays.length} holiday{holidays.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center">
              <FiAlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error Loading Calendar</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button
                onClick={fetchCalendar}
                className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors flex items-center"
              >
                <FiRefreshCw className="w-4 h-4 mr-1" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Working Days & Hours Info */}
        {(workingDays || workingHours) && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center">
              <FiClock className="w-4 h-4 mr-2 text-blue-600" />
              Working Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workingDays && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Working Days</h4>
                  <p className="text-sm text-blue-800 font-medium leading-relaxed">{workingDays.join(', ')}</p>
                </div>
              )}
              {workingHours && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <h4 className="text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Working Hours</h4>
                  <p className="text-sm text-emerald-800 font-medium">
                    {workingHours.start} - {workingHours.end} 
                    {workingHours.break > 0 && (
                      <span className="block text-xs text-emerald-700 mt-1">
                        Break: {workingHours.break} minutes
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Filters</h2>
              <p className="text-xs sm:text-sm text-slate-600">Choose year and month to view the calendar</p>
            </div>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <FiCalendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Show Month:</span>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{getMonthName(month)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {getMonthName(currentMonth)} {currentYear}
          </h3>

          {/* Weekdays Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-[11px] text-center text-white font-semibold tracking-wide">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} className="py-2 bg-slate-700 rounded-lg">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {generateCalendarDays().map((day, idx) => {
              const holidaysOnDay = day ? getHolidaysForDay(day) : [];
              const hasHoliday = holidaysOnDay.length > 0;
              const firstHoliday = hasHoliday ? holidaysOnDay[0] : null;
              
              // Determine background color: holiday takes precedence, then non-working day, then default
              let bgClass = 'bg-white';
              if (hasHoliday) {
                bgClass = getHolidayBgColor(firstHoliday.type);
              } else if (
                day &&
                isNonWorkingDay(calendar?.workingDays, currentYear, currentMonth, day)
              ) {
                bgClass = 'bg-gray-100';
              }
              
              const holidayNames = holidaysOnDay.map(h => h.name).join(', ');

              return (
                <div
                  key={idx}
                  className={`h-24 p-2 rounded-xl border flex flex-col justify-between transition-all hover:shadow-md
                    ${day ? bgClass : 'bg-slate-50'}
                    ${hasHoliday ? 'border-red-300' : 'border-slate-200'}
                    ${isToday(day) ? 'ring-2 ring-blue-300' : ''}
                    relative group
                  `}
                  title={
                    hasHoliday
                      ? holidayNames
                      : (
                        day &&
                        isNonWorkingDay(calendar?.workingDays, currentYear, currentMonth, day)
                      )
                        ? 'Non-working day'
                        : ''
                  }
                >
                  <span className={`font-semibold text-sm ${isToday(day) ? 'text-blue-700' : 'text-slate-700'}`}>
                    {day || ''}
                  </span>
                  {hasHoliday && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 truncate font-medium w-fit">
                      {firstHoliday.name}
                      {holidaysOnDay.length > 1 && ` +${holidaysOnDay.length - 1}`}
                    </span>
                  )}
                  {!hasHoliday && day && isNonWorkingDay(calendar?.workingDays, currentYear, currentMonth, day) && (
                    <span className="text-[10px] text-slate-500 truncate">
                      Non-working day
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar Legend */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 border border-slate-200">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">Holiday Types</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-100 border border-red-200 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">National</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">Religious</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">Company</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">Regional</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">Non-working day</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCalendar;