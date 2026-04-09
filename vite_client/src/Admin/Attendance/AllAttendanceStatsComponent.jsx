import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';
import { 
  fetchAllAttendanceStats, 
  fetchEmployeeList, 
  fetchEmployeeAttendanceDetails,
  clearEmployeeDetails
} from '../../context/attendanceSlice';

const AllAttendanceStatsComponent = () => {
  const dispatch = useDispatch();
  const { 
    employeeList, 
    employeeDetails, 
    employeeStats,
    loading, 
    error 
  } = useSelector((state) => state.attendance);
  
  const [timeRange, setTimeRange] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetails, setShowEmployeeDetails] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [calendar, setCalendar] = useState(null);

   const currentYear = year;
  const selectedMonth = month;

  useEffect(() => {
    const params = { range: timeRange };
    if (timeRange === 'monthly') params.year = year;
    if (timeRange === 'daily') {
      params.year = year;
      params.month = month;
    }
    dispatch(fetchAllAttendanceStats(params));
    dispatch(fetchEmployeeList({ department: departmentFilter }));
  }, [dispatch, timeRange, year, month, departmentFilter]);

  // Fetch calendar data from API so it stays in sync with admin/employee calendar pages
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const response = await axios.get(`/v1/admin/calendar/${currentYear}`);
        const calendarData = response.data?.data || response.data;
        setCalendar(calendarData);
      } catch {
        setCalendar({
          year: currentYear,
          holidays: [],
          workingDays: {
            monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false
          },
          workingHours: { startTime: '09:00', endTime: '17:00', breakDuration: 60 }
        });
      }
    };
    fetchCalendar();
  }, [currentYear]);

  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };

  const getEmployeeDetailsDateRange = () => {
    const toDateInputString = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (timeRange === 'daily') {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const startDate = toDateInputString(start);
      const endDate = toDateInputString(end);
      return { startDate, endDate };
    }

    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    };
  };

  const handleEmployeeSelect = (employeeId) => {
    setSelectedEmployee(employeeId);
    setShowEmployeeDetails(true);
  };

  useEffect(() => {
    if (!showEmployeeDetails || !selectedEmployee) return;
    dispatch(fetchEmployeeAttendanceDetails({
      employeeId: selectedEmployee,
      params: getEmployeeDetailsDateRange()
    }));
  }, [dispatch, showEmployeeDetails, selectedEmployee, timeRange, year, month]);
// ✅ Calendar helpers
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, selectedMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return days;
  };

  const getAttendanceByDay = (day) => {
    if (!day) return null;

    return employeeStats?.recentRecords?.find(record => {
      const d = new Date(record.date);
      return (
        d.getDate() === day &&
        d.getMonth() + 1 === selectedMonth &&
        d.getFullYear() === currentYear
      );
    });
  };

  // Holiday helpers
  const getHolidaysForMonth = () => {
    if (!calendar?.holidays) return [];
    return calendar.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === selectedMonth - 1 && holiday.isActive;
    });
  };

  const getHolidaysForDay = (day) => {
    return getHolidaysForMonth().filter(h => {
      const d = new Date(h.date);
      return d.getDate() === day;
    });
  };

  const getHolidayBgColor = (type) => {
    const bgColors = {
      national: 'bg-red-100',
      religious: 'bg-purple-100',
      company: 'bg-blue-100',
      regional: 'bg-green-100'
    };
    return bgColors[type] || 'bg-red-50';
  };

  const getHolidayTypeColor = (type) => {
    const colors = {
      national: 'bg-red-100 text-red-800',
      religious: 'bg-purple-100 text-purple-800',
      company: 'bg-blue-100 text-blue-800',
      regional: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const handleBackToList = () => {
    setShowEmployeeDetails(false);
    setSelectedEmployee(null);
    dispatch(clearEmployeeDetails());
  };

  if (loading) return <div className="text-center py-8">Loading statistics...</div>;
  if (error) return <div className="text-red-500 text-center py-8">Error: {error.message}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Main Content - responsive to sidebar state */}
      <div className="transition-all duration-300 ease-in-out lg:pl-8 p-4 lg:p-8">
        {!showEmployeeDetails ? (
          <>
            <h2 className="text-xl lg:text-2xl font-bold mb-6 text-gray-800">Employee Attendance</h2>
            
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <label htmlFor="timeRange" className="text-sm font-medium text-gray-700">Time Range:</label>
                <select
                  id="timeRange"
                  value={timeRange}
                  onChange={handleTimeRangeChange}
                  className="rounded-md border-gray-300 shadow-sm focus:border-theme-secondary focus:ring-2 focus:ring-[var(--color-primary)] text-sm lg:text-base"
                >
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {timeRange !== 'yearly' && (
                <div className="flex items-center gap-2">
                  <label htmlFor="year" className="text-sm font-medium text-gray-700">Year:</label>
                  <select
                    id="year"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm focus:border-theme-secondary focus:ring-2 focus:ring-[var(--color-primary)] text-sm lg:text-base"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {timeRange === 'daily' && (
                <div className="flex items-center gap-2">
                  <label htmlFor="month" className="text-sm font-medium text-gray-700">Month:</label>
                  <select
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="rounded-md border-gray-300 shadow-sm focus:border-theme-secondary focus:ring-2 focus:ring-[var(--color-primary)] text-sm lg:text-base"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'short' })}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label htmlFor="department" className="text-sm font-medium text-gray-700">Department:</label>
                <select
                  id="department"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-theme-secondary focus:ring-2 focus:ring-[var(--color-primary)] text-sm lg:text-base"
                >
                  <option value="">All</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Sales">Sales</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Employee List</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeList.map((employee) => (
                      <tr key={employee._id}>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">{employee.name}</td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">{employee.department}</td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">{employee.position}</td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${employee.active ? 'bg-theme-primary/10 text-theme-primary' : 'bg-red-100 text-red-800'}`}>
                            {employee.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleEmployeeSelect(employee._id)}
                            className="text-theme-secondary hover:text-[var(--color-text)] text-sm lg:text-base"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div>
            <button 
              onClick={handleBackToList}
              className="mb-4 flex items-center text-theme-secondary hover:text-theme-secondary text-sm lg:text-base"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Employee List
            </button>

            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl lg:text-2xl font-bold mb-2 text-gray-800">
                {employeeDetails?.name} ({employeeDetails?.employeeId})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium text-sm lg:text-base">{employeeDetails?.department}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Position</p>
                  <p className="font-medium text-sm lg:text-base">{employeeDetails?.position}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-sm lg:text-base">{employeeDetails?.email}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 lg:p-4 rounded-lg mb-6">
                <h3 className="text-base lg:text-lg font-semibold mb-4">Attendance Summary ({employeeStats?.period?.start?.substring(0, 4)} - {employeeStats?.period?.end?.substring(0, 4)})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Working Days</p>
                    <p className="text-lg lg:text-xl font-bold">{employeeStats?.period?.workingDays}</p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Present Days</p>
                    <p className="text-lg lg:text-xl font-bold">{employeeStats?.statistics?.presentDays}</p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Half Days</p>
                    <p className="text-lg lg:text-xl font-bold">{employeeStats?.statistics?.halfDays}</p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Absent Days</p>
                    <p className="text-lg lg:text-xl font-bold">{employeeStats?.statistics?.absentDays}</p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Attendance Rate</p>
                    <p className="text-lg lg:text-xl font-bold">
                      {(employeeStats?.statistics?.attendanceRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded shadow">
                    <p className="text-xs lg:text-sm text-gray-500">Total Overtime</p>
                    <p className="text-lg lg:text-xl font-bold">{employeeStats?.statistics?.totalOvertime} hours</p>
                  </div>
                </div>
              </div>

            <h3 className="text-primary lg:text-lg font-semibold mb-4">Recent Attendance Records</h3>
              {/* <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-3 py-2 lg:px-6 lg:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeStats?.recentRecords?.map((record, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                            ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                              record.status === 'half-day' ? 'bg-yellow-100 text-yellow-800' :
                              record.status === 'absent' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'}`}>
                            {record.status || 'No Record'}
                          </span>
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">
                          {record.clockIn ? new Date(record.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">
                          {record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">
                          {record.effectiveHours?.toFixed(2) || '--'}h
                        </td>
                        <td className="px-3 py-2 lg:px-6 lg:py-4 whitespace-nowrap text-sm">
                          {record.overtimeHours?.toFixed(2) || '0'}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div> */}
              <div className="flex flex-wrap gap-3 mb-4">
  
  {/* Month */}
  <select
    value={selectedMonth}
    onChange={(e) => setMonth(parseInt(e.target.value))}
    className="border rounded-md px-3 py-1 text-sm"
  >
    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
      <option key={m} value={m}>
        {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
      </option>
    ))}
  </select>

  {/* Year */}
  <select
    value={currentYear}
    onChange={(e) => setYear(parseInt(e.target.value))}
    className="border rounded-md px-3 py-1 text-sm"
  >
    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </select>

</div>
               <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-gray-100">
                {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(day => (
                  <div key={day} className="py-2 bg-gray-700 rounded-lg">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((day, index) => {
                  const attendance = day ? getAttendanceByDay(day) : null;
                  const holidays = day ? getHolidaysForDay(day) : [];
                  const hasHoliday = holidays.length > 0;
                  const firstHoliday = hasHoliday ? holidays[0] : null;

                  const nonWorkingDay = day
                    ? isNonWorkingDay(calendar?.workingDays, currentYear, selectedMonth, day)
                    : false;

                  let style = 'border-gray-200';
                  let bgClass = 'bg-white';

                  if (hasHoliday) {
                    bgClass = getHolidayBgColor(firstHoliday.type);
                    style = 'border-red-300';
                  } else if (nonWorkingDay) {
                    bgClass = 'bg-red-100';
                    style = 'border-red-300';
                  } else if (attendance?.status === 'present') {
                    bgClass = 'bg-green-100';
                    style = 'border-green-300';
                  } else if (attendance?.status === 'half-day') {
                    bgClass = 'bg-yellow-100';
                    style = 'border-yellow-300';
                  } else if (attendance?.status === 'absent') {
                    bgClass = 'bg-red-50';
                    style = 'border-red-200';
                  }

                  const holidayNames = holidays.map(h => h.name).join(', ');

                  return (
                    <div
                      key={index}
                      className={`h-24 p-2 rounded-xl border flex flex-col justify-between
                        ${day ? bgClass : 'bg-gray-50'}
                        ${style}
                        relative group
                      `}
                      title={hasHoliday ? holidayNames : ''}
                    >
                      <span className="font-semibold text-sm">
                        {day || ''}
                      </span>

                      {attendance && (
                        <span className={`text-[15px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 w-fit 
                              ${attendance.status === 'present' ? 'bg-theme-primary/10 text-theme-primary' :
                                attendance.status === 'half-day' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'}`}>
                          {attendance.status}
                        </span>
                      )}

                      {hasHoliday && (
                        <span className={`text-[13px] px-1 py-0.5 rounded ${getHolidayTypeColor(firstHoliday.type)} truncate font-medium`}>
                          {firstHoliday.name}
                          {holidays.length > 1 && ` +${holidays.length - 1}`}
                        </span>
                      )}

                      {nonWorkingDay && day && !hasHoliday && (
                        <span className="text-[15px] text-red-600">
                          Non-working day
                        </span>
                      )}

                      {attendance?.overtimeHours > 0 && !nonWorkingDay && !hasHoliday && (
                        <span className="text-[15px] text-blue-600">
                          +{attendance.overtimeHours}h
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Holiday List */}
              {/* {getHolidaysForMonth().length > 0 && (
                <div className="mt-6 bg-white p-4 rounded-lg shadow-md border">
                  <h4 className="text-lg font-semibold mb-4 text-gray-800">
                    Holidays in {new Date(currentYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {currentYear}
                  </h4>
                  <div className="space-y-3">
                    {getHolidaysForMonth().map(holiday => (
                      <div key={holiday._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getHolidayTypeColor(holiday.type)}`}>
                            {holiday.type.charAt(0).toUpperCase() + holiday.type.slice(1)}
                          </span>
                          <span className="font-medium text-gray-800">{holiday.name}</span>
                          <span className="text-sm text-gray-600">
                            {new Date(holiday.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {holiday.description && (
                          <span className="text-sm text-gray-500 italic">{holiday.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )} */}

              {/* Holiday Legend */}
              {/* <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold mb-3 text-gray-800">Holiday Types</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                    <span className="text-xs text-gray-700">National Holiday</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
                    <span className="text-xs text-gray-700">Religious Holiday</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span className="text-xs text-gray-700">Company Holiday</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                    <span className="text-xs text-gray-700">Regional Holiday</span>
                  </div>
                </div>
              </div>*/}
            
            </div>
          
          </div> 
          
        )}
      </div>
    </div>
    
  );
};

export default AllAttendanceStatsComponent;