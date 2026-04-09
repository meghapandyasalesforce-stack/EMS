import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiEdit, FiTrash2, FiClock, FiMapPin, FiUpload } from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';

// ======================== Axios Configuration ========================
const API_BASE_URL = '/api/v1';

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
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [uploading, setUploading] = useState(false);
  const todayDateString = new Date().toISOString().split('T')[0];

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
          holiday.isActive
        );
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getHolidaysForDay = (day) => {
    return getHolidaysForMonth(selectedMonth).filter(h => {
      const d = new Date(h.date);
      return d.getDate() === day;
    });
  };

  const getHolidayBgColor = (type) => {
    const bgColors = {
      national: 'bg-red-50',
      religious: 'bg-purple-50',
      company: 'bg-blue-50',
      regional: 'bg-emerald-50'
    };
    return bgColors[type] || 'bg-red-50';
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

  const getHolidayTypeColor = (type) => {
    const colors = {
      national: 'bg-red-100 text-red-800 ',
      religious: 'bg-purple-100 text-purple-800',
      company: 'bg-blue-100 text-blue-800',
      regional: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Calendar</h3>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-6 lg:p-8">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Calendar Management</h1>
              <p className="text-lg text-slate-600">Manage holidays and working days for {currentYear}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[120px] shadow-sm transition-all duration-200 hover:shadow-md font-medium"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 5).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md font-medium"
              >
                <FiUpload className="w-4 h-4" />
                <span>Upload Calendar</span>
              </button>
              <button
                onClick={() => setShowHolidayModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md font-medium"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md font-medium"
              >
                <FiClock className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-1">View Month</h3>
              <p className="text-slate-600">Select a month to view calendar</p>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-6 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[180px] shadow-sm transition-all duration-200 hover:shadow-md font-medium"
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
            {getMonthName(selectedMonth)} {currentYear}
          </h3>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-[11px] text-center text-white font-semibold tracking-wide">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} className="py-2 bg-slate-700 rounded-lg">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-2">
            {generateCalendarDays().map((day, idx) => {
              const holidays = day ? getHolidaysForDay(day) : [];
              const hasHoliday = holidays.length > 0;
              const firstHoliday = hasHoliday ? holidays[0] : null;
              const isNonWorking = day
                ? isNonWorkingDay(calendar?.workingDays, currentYear, selectedMonth, day)
                : false;
              let bgClass = 'bg-white';
              
              if (hasHoliday) {
                bgClass = getHolidayBgColor(firstHoliday.type);
              } else if (isNonWorking && day) {
                bgClass = 'bg-yellow-50';
              } else if (!day) {
                bgClass = 'bg-gray-50';
              }
              
              const holidayNames = holidays.map(h => h.name).join(', ');

              return (
                <div
                  key={idx}
                  className={`h-24 p-2 rounded-xl border flex flex-col justify-between transition-all hover:shadow-md
                    ${bgClass}
                    ${isNonWorking && day ? 'border-amber-300' : hasHoliday ? 'border-red-300' : 'border-slate-200'}
                    ${isToday(day) ? 'ring-2 ring-blue-300' : ''}
                    relative group
                  `}
                  title={hasHoliday ? holidayNames : isNonWorking && day ? 'Non-working day' : ''}
                >
                  <span className={`font-semibold text-sm ${isToday(day) ? 'text-blue-700' : isNonWorking && day ? 'text-amber-700' : 'text-slate-700'}`}>
                    {day || ''}
                  </span>
                  {isNonWorking && day && !hasHoliday && (
                    <span className="text-xs font-medium text-amber-600">Non-working day</span>
                  )}
                  {hasHoliday && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getHolidayTypeColor(firstHoliday.type)} truncate font-medium w-fit`}>
                      {firstHoliday.name}
                      {holidays.length > 1 && ` +${holidays.length - 1}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Holiday Button below calendar */}
          {/* <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowHolidayModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
            >
              <FiPlus className="w-5 h-5" />
              <span>Add Holiday for this Month</span>
            </button>
          </div> */}
        </div>

        {/* Holiday List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Holidays in {getMonthName(selectedMonth)} {currentYear}
            </h2>
            <p className="text-slate-600">
              {getHolidaysForMonth(selectedMonth).length} holiday{getHolidaysForMonth(selectedMonth).length !== 1 ? 's' : ''} found this month
            </p>
          </div>
          <div className="p-6">
            {getHolidaysForMonth(selectedMonth).length === 0 ? (
              <div className="text-center py-16">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
                    <FiCalendar className="w-12 h-12 text-gray-400" />
                  </div>
                   <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 text-lg">📅</span>
                  </div> 
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No holidays in this month</h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">This month doesn't have any holidays scheduled. Add some holidays to make it more exciting!</p>
                 <button
                  onClick={() => setShowHolidayModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-3 rounded-xl flex items-center space-x-2 mx-auto transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <FiPlus className="w-5 h-5" />
                  <span>Add Holiday</span>
                </button> 
              </div>
            ) : (
              <div className="space-y-4">
                {getHolidaysForMonth(selectedMonth).map(holiday => (
                  <div key={holiday._id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getHolidayTypeColor(holiday.type)}`}>
                            {holiday.type.charAt(0).toUpperCase() + holiday.type.slice(1)}
                          </span>
                          {isUploadedHoliday(holiday) ? (
                            <span
                              className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-900"
                              title={holiday.sourceFileName ? `From file: ${holiday.sourceFileName}` : 'Imported from uploaded calendar file'}
                            >
                              Uploaded
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                              Manual
                            </span>
                          )}
                          {holiday.isRecurring && (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                              Recurring ({holiday.recurringPattern})
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-800 text-xl mb-2 break-words">
                          {holiday.name}
                        </h4>
                        <div className="flex items-center text-gray-600 mb-2">
                          <FiMapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base">
                            {new Date(holiday.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {holiday.sourceFileName && isUploadedHoliday(holiday) && (
                          <p className="text-gray-500 text-xs break-words mb-1">
                            Source file: <span className="font-medium text-gray-600">{holiday.sourceFileName}</span>
                          </p>
                        )}
                        {holiday.description && (
                          <p className="text-gray-500 text-sm break-words leading-relaxed">{holiday.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 sm:ml-6 flex-shrink-0">
                        <button
                          onClick={() => openEditHoliday(holiday)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            isPastHoliday(holiday.date)
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={isPastHoliday(holiday.date) ? 'Past holidays cannot be edited' : 'Edit holiday'}
                          disabled={isPastHoliday(holiday.date)}
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(holiday._id)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            isPastHoliday(holiday.date)
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={isPastHoliday(holiday.date) ? 'Past holidays cannot be deleted' : 'Delete holiday'}
                          disabled={isPastHoliday(holiday.date)}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
    </div>
  );
};

// Modal Components (same as before, but included for completeness)
const HolidayModal = ({ title, formData, setFormData, onSubmit, onClose }) => {
  const todayDateString = new Date().toISOString().split('T')[0];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform animate-slideUp">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Holiday Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
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
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Recurring Holiday</span>
            </label>
            
            {formData.isRecurring && (
              <div className="ml-7 animate-slideDown">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Recurring Pattern</label>
                <select
                  value={formData.recurringPattern}
                  onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              {title.includes('Add') ? 'Add Holiday' : 'Update Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsModal = ({ formData, setFormData, onSubmit, onClose }) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform animate-slideUp">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiClock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Calendar Settings</h3>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Working Days
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {days.map(day => (
                <label key={day} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.workingDays[day]}
                    onChange={(e) => setFormData({
                      ...formData,
                      workingDays: { ...formData.workingDays, [day]: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="capitalize font-medium text-gray-700">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
              Working Hours
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={formData.workingHours.startTime}
                  onChange={(e) => setFormData({
                    ...formData,
                    workingHours: { ...formData.workingHours, startTime: e.target.value }
                  })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={formData.workingHours.endTime}
                  onChange={(e) => setFormData({
                    ...formData,
                    workingHours: { ...formData.workingHours, endTime: e.target.value }
                  })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Break Duration (minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={formData.workingHours.breakDuration}
                  onChange={(e) => setFormData({
                    ...formData,
                    workingHours: { ...formData.workingHours, breakDuration: parseInt(e.target.value) }
                  })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              Update Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UploadModal = ({ onSubmit, onClose, uploading }) => {
  const [fileName, setFileName] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform animate-slideUp">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiUpload className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Upload Calendar File</h3>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Select Calendar File</label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-green-400 hover:bg-green-50 transition-all duration-300 group">
              <div className="relative">
                <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4 group-hover:text-green-500 transition-colors duration-300" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📄</span>
                </div>
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
                className="cursor-pointer bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-semibold inline-block transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
              Supported Features
            </h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>Automatic holiday detection from PDF text</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>Common holidays (New Year, Christmas, etc.)</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>Date pattern recognition</li>
              <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></span>Duplicate prevention</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200" disabled={uploading}>
              Cancel
            </button>
            <button type="submit" className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" disabled={uploading}>
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
    </div>
  );
};

export default CalendarManagement;