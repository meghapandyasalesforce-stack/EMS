import React, { useState, useEffect, useMemo } from 'react';
import { FiCalendar, FiClock, FiAlertCircle, FiRefreshCw, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';

const EmployeeCalendar = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [oneOnOneEvents, setOneOnOneEvents] = useState([]);
  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [showMobileDateDetails, setShowMobileDateDetails] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);

  const canUseAdminCalendarEndpoint = useMemo(() => {
    const role = String(user?.role || employee?.role || '').toLowerCase();
    return ['admin', 'hr', 'executive'].includes(role);
  }, [user, employee]);

  useEffect(() => {
    fetchCalendar();
  }, [currentYear, canUseAdminCalendarEndpoint]);

  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < 640;
      setIsSmallScreen(small);
      if (!small) {
        setShowMobileDateDetails(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      setError(null);
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      const endpoint = canUseAdminCalendarEndpoint
        ? `/v1/admin/calendar/${currentYear}`
        : `/v1/employee/calendar/${currentYear}`;
      const [calendarResponse, oneOnOneResponse] = await Promise.all([
        axios.get(endpoint),
        axios.get('/v1/both/one-on-one/one-on-ones', {
          params: { startDate: yearStart, endDate: yearEnd }
        })
      ]);

      const calendarData = calendarResponse?.data?.data || calendarResponse?.data;
      const meetings = oneOnOneResponse?.data?.data || [];
      const mappedMeetings = meetings
        .filter((meeting) => {
          const status = String(meeting?.status || '').toLowerCase();
          // Keep active meetings on calendar; hide declined/cancelled
          return !['declined', 'cancelled'].includes(status);
        })
        .map((meeting) => {
          const managerName = `${meeting?.managerId?.name || ''} ${meeting?.managerId?.lastName || ''}`.trim();
          const employeeName = `${meeting?.employeeId?.name || ''} ${meeting?.employeeId?.lastName || ''}`.trim();
          const currentId = String(user?._id || user?.id || employee?._id || employee?.id || '');
          const isOrganizer = String(meeting?.managerId?._id || meeting?.managerId) === currentId;
          const counterpartFull = isOrganizer ? employeeName : managerName;
          const counterpartFirst = (counterpartFull || '1:1').split(/\s+/)[0];
          const status = meeting.status || 'Pending';
          const timeLabel = meeting.scheduledTime ? String(meeting.scheduledTime).slice(0, 5) : '';
          // Short label for month grid; full name kept for detail panels
          const shortTitle = timeLabel
            ? `1:1 ${counterpartFirst} · ${timeLabel}`
            : `1:1 ${counterpartFirst}`;
          const fullTitle = counterpartFull
            ? `1:1 with ${counterpartFull}${timeLabel ? ` at ${timeLabel}` : ''}`
            : '1:1 Meeting';
          return {
            _id: meeting.calendarEventKey || `meeting-${meeting._id}`,
            name: shortTitle,
            fullName: fullTitle,
            date: meeting.scheduledDate,
            type: 'company',
            isActive: true,
            eventKind: 'meeting',
            meetingStatus: status,
            scheduledTime: meeting.scheduledTime,
            meetingId: meeting._id
          };
        });
      // De-dupe by calendar event key / meeting id
      const seen = new Set();
      const uniqueMeetings = mappedMeetings.filter((ev) => {
        const key = String(ev._id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setOneOnOneEvents(uniqueMeetings);
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
      setOneOnOneEvents([]);
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
      setOneOnOneEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getAllEvents = () => {
    const holidayEvents = Array.isArray(calendar?.holidays) ? calendar.holidays : [];
    const meetingEvents = Array.isArray(oneOnOneEvents) ? oneOnOneEvents : [];
    return [...holidayEvents, ...meetingEvents];
  };

  const getHolidaysForMonth = (month) => {
    const events = getAllEvents();
    return events.filter((event) => {
      const holidayDate = new Date(event.date);
      return holidayDate.getMonth() === month - 1 && event.isActive;
    });
  };

  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
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

  const getEventTypeColor = (type, event = null) => {
    if (event?.eventKind === 'meeting') {
      const status = String(event.meetingStatus || '').toLowerCase();
      if (status === 'pending') return 'bg-amber-400';
      if (status === 'accepted' || status === 'scheduled' || status === 'rescheduled') return 'bg-emerald-500';
      if (status === 'reschedule requested') return 'bg-violet-500';
      if (status === 'completed') return 'bg-slate-400';
      return 'bg-teal-500';
    }
    const key = String(type || '').toLowerCase();
    if (key === 'national') return 'bg-red-500';
    if (key === 'religious') return 'bg-purple-500';
    if (key === 'company') return 'bg-emerald-500';
    if (key === 'regional') return 'bg-yellow-400';
    return 'bg-slate-400';
  };

  const getEventTypeLabel = (type, event = null) => {
    if (event?.eventKind === 'meeting') {
      const status = event.meetingStatus || 'Pending';
      return `1:1 · ${status}`;
    }
    const key = String(type || '').toLowerCase();
    if (key === 'national' || key === 'regional') return 'Holiday';
    if (key === 'company') return 'Meeting';
    if (key === 'religious') return 'Deadline';
    return 'Event';
  };

  const getUpcomingEvents = () => {
    const events = getAllEvents();
    if (!events.length) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return [...events]
      .filter((event) => event.isActive)
      .map((event) => ({
        ...event,
        dateObj: new Date(event.date)
      }))
      .filter((event) => event.dateObj >= now)
      .sort((a, b) => a.dateObj - b.dateObj)
      .slice(0, 7);
  };

  const getEventsForDateObj = (dateObj) => {
    const events = getAllEvents();
    if (!events.length || !dateObj) return [];
    const yyyy = dateObj.getFullYear();
    const mm = dateObj.getMonth();
    const dd = dateObj.getDate();

    return events.filter((event) => {
      if (!event.isActive) return false;
      const hd = new Date(event.date);
      return hd.getFullYear() === yyyy && hd.getMonth() === mm && hd.getDate() === dd;
    });
  };

  const getWeekDays = (baseDate) => {
    const base = new Date(baseDate);
    const mondayOffset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - mondayOffset);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const generateCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    // Convert JS day index (Sun=0) to Monday-first index (Mon=0 ... Sun=6)
    const firstDay = (firstDayOfMonth.getDay() + 6) % 7;
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
    const events = getAllEvents();
    if (!events.length || !day) return [];
    return events.filter((event) => {
      const holidayDate = new Date(event.date);
      return holidayDate.getDate() === day && 
             holidayDate.getMonth() === currentMonth - 1 && 
             holidayDate.getFullYear() === currentYear &&
             event.isActive;
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

  const isSelectedDay = (day) => {
    if (!day) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() + 1 === currentMonth &&
      selectedDate.getFullYear() === currentYear
    );
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((prev) => prev - 1);
      setCurrentMonth(12);
      setSelectedDate(new Date(currentYear - 1, 11, 1));
      return;
    }
    setCurrentMonth((prev) => prev - 1);
    setSelectedDate(new Date(currentYear, currentMonth - 2, 1));
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((prev) => prev + 1);
      setCurrentMonth(1);
      setSelectedDate(new Date(currentYear + 1, 0, 1));
      return;
    }
    setCurrentMonth((prev) => prev + 1);
    setSelectedDate(new Date(currentYear, currentMonth, 1));
  };

  const goToToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    // Midnight local — avoids time-of-day selection quirks
    const today = new Date(y, m - 1, d);

    setCurrentYear(y);
    setCurrentMonth(m);
    setSelectedDate(today);
    setViewMode('month');
    setShowMobileDateDetails(false);
  };

  if (loading) {
    return (
      <div className="page-shell min-h-screen bg-gray-50 transition-all duration-300">
        <div className="page-shell-inner flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-theme-secondary"></div>
            <p className="text-gray-600">Loading calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  const holidays = getHolidaysForMonth(currentMonth);
  const workingDays = getWorkingDaysInfo();
  const workingHours = getWorkingHoursInfo();
  const upcomingEvents = getUpcomingEvents();
  const selectedDateEvents = getEventsForDateObj(selectedDate);

  return (
    <div className="page-shell min-h-screen bg-[#F4F6FB] transition-all duration-300">
      <div className="page-shell-inner hrms-stack">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employee Calendar</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage your schedule and milestones.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={`rounded-lg px-4 py-1.5 font-semibold ${viewMode === 'month' ? 'bg-[#20C997] text-white' : 'text-slate-600'}`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`rounded-lg px-4 py-1.5 font-medium ${viewMode === 'week' ? 'bg-[#20C997] text-white' : 'text-slate-600'}`}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`rounded-lg px-4 py-1.5 font-medium ${viewMode === 'day' ? 'bg-[#20C997] text-white' : 'text-slate-600'}`}
                >
                  Day
                </button>
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

        <div className="hrms-main-rail">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <FiCalendar className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-slate-700">Month:</span>
                  <select
                    value={currentMonth}
                    onChange={(e) => {
                      const month = parseInt(e.target.value, 10);
                      setCurrentMonth(month);
                      setSelectedDate(new Date(currentYear, month - 1, 1));
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{getMonthName(month)}</option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">Year:</span>
                  <select
                    value={currentYear}
                    onChange={(e) => {
                      const year = parseInt(e.target.value, 10);
                      setCurrentYear(year);
                      setSelectedDate(new Date(year, currentMonth - 1, 1));
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                  >
                    {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {holidays.length} holiday{holidays.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900">{getMonthName(currentMonth)} {currentYear}</h3>
                  <button type="button" onClick={goToPreviousMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={goToNextMonth} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0a8f6c] hover:bg-[#20C997]/10"
                >
                  Go to today
                </button>
              </div>

              {viewMode === 'month' && (
                <>
                  {/* Weekdays Header */}
                  <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className="py-2">{d}</div>
                    ))}
                  </div>

                  {/* Days */}
                  <div className="grid grid-cols-7 gap-2">
                    {generateCalendarDays().map((day, idx) => {
                      const holidaysOnDay = day ? getHolidaysForDay(day) : [];
                      const hasHoliday = holidaysOnDay.length > 0;
                      const firstHoliday = hasHoliday ? holidaysOnDay[0] : null;
                      const today = isToday(day);
                      const selected = isSelectedDay(day);

                      let bgClass = 'bg-white';
                      if (today) {
                        bgClass = 'bg-[#20C997] text-white';
                      } else if (hasHoliday) {
                        bgClass = getHolidayBgColor(firstHoliday.type);
                      } else if (
                        day &&
                        isNonWorkingDay(calendar?.workingDays, currentYear, currentMonth, day)
                      ) {
                        bgClass = 'bg-gray-100';
                      }

                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => {
                            if (!day) return;
                            setSelectedDate(new Date(currentYear, currentMonth - 1, day));
                            if (isSmallScreen) {
                              setShowMobileDateDetails(true);
                            }
                          }}
                          className={`min-h-[112px] rounded-xl border border-slate-100 p-2 text-left transition ${day ? bgClass : 'bg-slate-50'} ${selected ? 'ring-2 ring-[#20C997]/50' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className={`text-sm font-semibold ${today ? 'text-white' : 'text-slate-700'}`}>{day || ''}</span>
                            {today && (
                              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">Today</span>
                            )}
                          </div>
                          {day && (
                            <div className="mt-1.5 space-y-1">
                              {holidaysOnDay.slice(0, 2).map((holiday) => {
                                const isMeeting = holiday.eventKind === 'meeting';
                                return (
                                  <div
                                    key={holiday._id || holiday.name}
                                    title={holiday.fullName || holiday.name}
                                    className={`flex items-start gap-1 rounded-md px-1 py-0.5 ${
                                      today
                                        ? 'bg-white/95 text-slate-800 shadow-sm'
                                        : isMeeting
                                          ? 'bg-teal-50 text-teal-900'
                                          : ''
                                    }`}
                                  >
                                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${getEventTypeColor(holiday.type, holiday)}`} />
                                    <span className={`line-clamp-2 text-[10px] font-semibold leading-tight ${today || isMeeting ? '' : 'text-slate-700'}`}>
                                      {holiday.name}
                                    </span>
                                  </div>
                                );
                              })}
                              {holidaysOnDay.length > 2 && (
                                <p className={`text-[10px] font-semibold ${today ? 'text-white/90' : 'text-slate-500'}`}>
                                  +{holidaysOnDay.length - 2} more
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showMobileDateDetails && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:hidden">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {selectedDate.toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>

                      <div className="mt-3 space-y-2">
                        {selectedDateEvents.length === 0 ? (
                          <p className="text-sm text-slate-600">No events for this day.</p>
                        ) : (
                          selectedDateEvents.map((event) => (
                            <div key={event._id || event.name} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${getEventTypeColor(event.type, event)}`} />
                                <p className="text-sm font-semibold text-slate-900">{event.fullName || event.name}</p>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {getEventTypeLabel(event.type, event)}
                              </p>
                            </div>
                          ))
                        )}

                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-800">Day status</p>
                          {isNonWorkingDay(
                            calendar?.workingDays,
                            selectedDate.getFullYear(),
                            selectedDate.getMonth() + 1,
                            selectedDate.getDate()
                          ) ? (
                            <p className="mt-1 text-sm text-slate-600">Non-working day</p>
                          ) : (
                            <p className="mt-1 text-sm text-slate-600">
                              Working day{workingHours ? ` • ${workingHours.start} - ${workingHours.end}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {viewMode === 'week' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                    {getWeekDays(selectedDate).map((dateObj) => {
                      const day = dateObj.getDate();
                      const month = dateObj.getMonth() + 1;
                      const year = dateObj.getFullYear();
                      const inCurrentMonth = month === currentMonth && year === currentYear;
                      const today =
                        new Date().toDateString() === dateObj.toDateString();
                      const events = getEventsForDateObj(dateObj);

                      return (
                        <button
                          type="button"
                          key={dateObj.toISOString()}
                          onClick={() => setSelectedDate(dateObj)}
                          className={`rounded-xl border p-3 text-left ${inCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'} ${today ? 'ring-2 ring-[#20C997]/40' : ''}`}
                        >
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {dateObj.toLocaleDateString(undefined, { weekday: 'short' })}
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-800">{day}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {events.slice(0, 3).map((event) => (
                              <span key={event._id || event.name} className={`h-2 w-2 rounded-full ${getEventTypeColor(event.type, event)}`} />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      Events this week
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {getWeekDays(selectedDate)
                        .flatMap((d) => getEventsForDateObj(d).map((evt) => ({ evt, d })))
                        .slice(0, 8)
                        .map(({ evt, d }, idx) => (
                          <li key={`${evt._id || evt.name}-${idx}`} className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${getEventTypeColor(evt.type, evt)}`} />
                            <span>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {evt.fullName || evt.name}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}

              {viewMode === 'day' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="mt-4 space-y-3">
                    {getEventsForDateObj(selectedDate).length === 0 ? (
                      <p className="text-sm text-slate-600">No events for this day.</p>
                    ) : (
                      getEventsForDateObj(selectedDate).map((event) => (
                        <div key={event._id || event.name} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${getEventTypeColor(event.type, event)}`} />
                            <p className="font-semibold text-slate-900">{event.fullName || event.name}</p>
                          </div>
                          <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                            {getEventTypeLabel(event.type, event)}
                          </p>
                        </div>
                      ))
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-800">Day status</p>
                      {isNonWorkingDay(
                        calendar?.workingDays,
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() + 1,
                        selectedDate.getDate()
                      ) ? (
                        <p className="mt-1 text-sm text-slate-600">Non-working day</p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">
                          Working day{workingHours ? ` • ${workingHours.start} - ${workingHours.end}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" /> Leave</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Holiday</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> 1:1 Meeting</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Pending 1:1</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Deadline</span>
              </div>
            </div>

            {/* Working Days & Hours Info */}
            {(workingDays || workingHours) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center text-base font-semibold text-slate-900">
                  <FiClock className="mr-2 h-4 w-4 text-[#20C997]" />
                  Working Schedule
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {workingDays && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Working Days</h4>
                      <p className="text-sm font-medium text-slate-700">{workingDays.join(', ')}</p>
                    </div>
                  )}
                  {workingHours && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Working Hours</h4>
                      <p className="text-sm font-medium text-slate-700">
                        {workingHours.start} - {workingHours.end}
                        {workingHours.break > 0 && (
                          <span className="mt-1 block text-xs text-slate-500">Break: {workingHours.break} minutes</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-3xl font-bold tracking-tight text-slate-900">Upcoming Events</h3>
              <span className="rounded-lg bg-[#ECFDF5] px-2 py-1 text-xs font-semibold text-[#0a8f6c]">
                {upcomingEvents.length} Upcoming
              </span>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming events.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event._id || `${event.name}-${event.date}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {event.dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{event.fullName || event.name}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getEventTypeColor(event.type, event)}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{getEventTypeLabel(event.type, event)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-[#F0FDF9] p-4 text-sm text-[#0a8f6c]">
              Keep an eye on upcoming events and holidays to plan your work week better.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCalendar;