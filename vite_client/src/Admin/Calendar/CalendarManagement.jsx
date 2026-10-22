import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiEdit, FiTrash2, FiClock, FiMapPin, FiUpload, FiArrowLeft, FiList } from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from '../../utils/axios';
import { isNonWorkingDay } from '../../utils/calendarUtils';
import '../../styles/holidayCalendarUI.css';

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
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'holidays'
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
                : `Manage holidays and working days for ${currentYear}`}
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
                  const isNonWorking = day
                    ? isNonWorkingDay(calendar?.workingDays, currentYear, selectedMonth, day)
                    : false;
                  const holidayNames = holidays.map((h) => h.name).join(', ');

                  return (
                    <div
                      key={idx}
                      className={[
                        'hol-cal__day',
                        !day && 'hol-cal__day--empty',
                        hasHoliday && getHolidayBgColor(firstHoliday.type),
                        isNonWorking && day && !hasHoliday && 'hol-cal__day--off',
                        isToday(day) && 'hol-cal__day--today',
                      ].filter(Boolean).join(' ')}
                      title={
                        hasHoliday
                          ? holidayNames
                          : isNonWorking && day
                            ? 'Non-working day'
                            : undefined
                      }
                    >
                      {day ? (
                        <>
                          <span className="hol-cal__day-num">{day}</span>
                          {isNonWorking && !hasHoliday ? (
                            <span className="hol-cal__day-tag hol-cal__day-tag--off">Non-working</span>
                          ) : null}
                          {hasHoliday ? (
                            <span className={`hol-cal__day-tag ${getTypeClass(firstHoliday.type)}`}>
                              {firstHoliday.name}
                              {holidays.length > 1 ? ` +${holidays.length - 1}` : ''}
                            </span>
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
                      {holidays.map((holiday) => (
                        <li key={holiday._id} className="hol-cal__item">
                          <span className="hol-cal__accent" aria-hidden />
                          <div className="hol-cal__item-body">
                            <div className="hol-cal__item-top">
                              <h3 className="hol-cal__item-name">{holiday.name}</h3>
                              <span className={`hol-cal__type ${getTypeClass(holiday.type)}`}>
                                {getTypeLabel(holiday.type)}
                              </span>
                            </div>
                            <p className="hol-cal__item-date">{formatHolidayDate(holiday.date)}</p>
                            <p className="hol-cal__item-loc">
                              <FiMapPin size={12} />
                              {getHolidayLocation(holiday)}
                            </p>
                          </div>
                          <div className="hol-cal__item-actions">
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
                      ))}
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
    </div>
  );
};

// Modal Components (same as before, but included for completeness)
const HolidayModal = ({ title, formData, setFormData, onSubmit, onClose }) => {
  const todayDateString = new Date().toISOString().split('T')[0];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform animate-slideUp">
        <div className="p-6 rounded-t-2xl" style={{ background: 'linear-gradient(165deg, #0e2b3d 0%, #134056 100%)' }}>
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
            <button type="submit" className="px-8 py-3 bg-[#0e9370] hover:bg-[#0b7458] text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform animate-slideUp">
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
              <div className="w-2 h-2 bg-[#0e9370] rounded-full mr-3"></div>
              Working Days
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
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
              <div className="w-2 h-2 bg-[#0e9370] rounded-full mr-3"></div>
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform animate-slideUp">
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