import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiMapPin, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

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
      const response = await axios.get(`/v1/employee/calendar/${currentYear}`);
      
      if (response.data) {
        setCalendar(response.data);
      } else {
        // Set fallback data if no calendar data is available
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
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
      setError('Failed to fetch calendar data');
      toast.error('Failed to fetch calendar');
      
      // Set fallback data on error
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
      company: 'bg-blue-100 text-blue-800 border-blue-200',
      regional: 'bg-green-100 text-green-800 border-green-200'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 ml-64 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const holidays = getHolidaysForMonth(currentMonth);
  const workingDays = getWorkingDaysInfo();
  const workingHours = getWorkingHoursInfo();

  return (
    <div className="min-h-screen bg-gray-50 p-5 ml-64">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Company Calendar</h2>
              <p className="text-sm text-gray-600">Holidays and working days for {currentYear}</p>
            </div>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <FiCalendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Show Month:</span>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{getMonthName(month)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Working Days & Hours Info */}
        {(workingDays || workingHours) && (
          <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
              <FiClock className="w-4 h-4 mr-2 text-blue-500" />
              Working Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workingDays && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-800 mb-2">Working Days</h4>
                  <p className="text-sm text-blue-700 font-medium">{workingDays.join(', ')}</p>
                </div>
              )}
              {workingHours && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="text-xs font-semibold text-green-800 mb-2">Working Hours</h4>
                  <p className="text-sm text-green-700 font-medium">
                    {workingHours.start} - {workingHours.end} 
                    {workingHours.break > 0 && (
                      <span className="block text-xs text-green-600 mt-1">
                        Break: {workingHours.break} minutes
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Holidays for Selected Month */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 flex items-center">
              <FiCalendar className="w-4 h-4 mr-2 text-green-500" />
              Holidays in {getMonthName(currentMonth)} {currentYear}
              {holidays.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-lg">
                  {holidays.length} {holidays.length === 1 ? 'holiday' : 'holidays'}
                </span>
              )}
            </h3>
          </div>
          <div className="p-5">
            {holidays.length === 0 ? (
              <div className="text-center py-12">
                <FiCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No holidays this month</h4>
                <p className="text-gray-500">Enjoy your regular working days!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {holidays.map(holiday => (
                  <div key={holiday._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getHolidayTypeColor(holiday.type)}`}>
                            {holiday.type.charAt(0).toUpperCase() + holiday.type.slice(1)}
                          </div>
                          {holiday.isRecurring && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-lg font-medium">
                              Recurring
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{holiday.name}</h4>
                        <p className="text-sm text-gray-600 mb-2 flex items-center">
                          <FiCalendar className="w-4 h-4 mr-1" />
                          {new Date(holiday.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        {holiday.description && (
                          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">{holiday.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calendar Legend */}
        <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Holiday Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-100 border border-red-200 rounded-full"></div>
              <span className="text-sm text-gray-600 font-medium">National</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded-full"></div>
              <span className="text-sm text-gray-600 font-medium">Religious</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded-full"></div>
              <span className="text-sm text-gray-600 font-medium">Company</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-100 border border-green-200 rounded-full"></div>
              <span className="text-sm text-gray-600 font-medium">Regional</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCalendar;
