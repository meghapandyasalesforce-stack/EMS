import React, { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiPlus, FiEdit, FiTrash2, FiClock, FiMapPin, FiUpload, FiFile, FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

const CalendarManagement = () => {
  // Add custom CSS animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0; 
          transform: translateY(20px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      @keyframes slideDown {
        from { 
          opacity: 0; 
          transform: translateY(-10px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }
      .animate-slideUp {
        animation: slideUp 0.4s ease-out;
      }
      .animate-slideDown {
        animation: slideDown 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploading, setUploading] = useState(false);

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
      startTime: '09:00',
      endTime: '17:00',
      breakDuration: 60
    }
  });

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/v1/admin/calendar/${currentYear}`);
      setCalendar(response.data);
      
      // Update settings form with calendar data
      if (response.data.workingDays) {
        setSettingsForm(prev => ({
          ...prev,
          workingDays: { ...prev.workingDays, ...response.data.workingDays }
        }));
      }
      if (response.data.workingHours) {
        setSettingsForm(prev => ({
          ...prev,
          workingHours: { ...prev.workingHours, ...response.data.workingHours }
        }));
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Failed to fetch calendar');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  const fetchUploadHistory = useCallback(async () => {
    try {
      const response = await axios.get(`/v1/admin/calendar/${currentYear}/upload-history`);
      setUploadHistory(response.data.uploads || []);
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchCalendar();
    fetchUploadHistory();
  }, [fetchCalendar, fetchUploadHistory]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/v1/admin/calendar/${currentYear}/holidays`, holidayForm);
      toast.success('Holiday added successfully');
      setShowHolidayModal(false);
      resetHolidayForm();
      fetchCalendar();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error(error.response?.data?.message || 'Failed to add holiday');
    }
  };

  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/v1/admin/calendar/${currentYear}/holidays/${selectedHoliday._id}`, holidayForm);
      toast.success('Holiday updated successfully');
      setShowHolidayModal(false);
      resetHolidayForm();
      fetchCalendar();
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast.error(error.response?.data?.message || 'Failed to update holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await axios.delete(`/v1/admin/calendar/${currentYear}/holidays/${holidayId}`);
        toast.success('Holiday deleted successfully');
        fetchCalendar();
      } catch (error) {
        console.error('Error deleting holiday:', error);
        toast.error(error.response?.data?.message || 'Failed to delete holiday');
      }
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      await Promise.all([
        axios.put(`/v1/admin/calendar/${currentYear}/working-days`, { workingDays: settingsForm.workingDays }),
        axios.put(`/v1/admin/calendar/${currentYear}/working-hours`, { workingHours: settingsForm.workingHours })
      ]);
      toast.success('Settings updated successfully');
      setShowSettingsModal(false);
      fetchCalendar();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
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
      national: 'bg-red-100 text-red-800',
      religious: 'bg-purple-100 text-purple-800',
      company: 'bg-blue-100 text-blue-800',
      regional: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
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
      const response = await axios.post(`/v1/admin/calendar/${currentYear}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(`Calendar file processed successfully! ${response.data.extractedHolidays} holidays added.`);
      setShowUploadModal(false);
      fetchCalendar();
      fetchUploadHistory();
    } catch (error) {
      console.error('Error uploading calendar file:', error);
      toast.error(error.response?.data?.message || 'Failed to upload calendar file');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-500 mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-blue-300 animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Calendar</h3>
          <p className="text-gray-600">Please wait while we fetch your calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ml-0 lg:ml-64 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Calendar Management</h1>
              <p className="text-lg text-gray-600">Manage holidays and working days for {currentYear}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[120px] shadow-sm transition-all duration-200 hover:shadow-md font-medium"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                <FiUpload className="w-4 h-4" />
                <span>Upload Calendar</span>
              </button>
              <button
                onClick={() => setShowHolidayModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                <FiClock className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">View Month</h3>
              <p className="text-gray-600">Select a month to view holidays</p>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-6 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[180px] shadow-sm transition-all duration-200 hover:shadow-md font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{getMonthName(month)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Holidays for Selected Month */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Holidays in {getMonthName(selectedMonth)} {currentYear}
            </h2>
            <p className="text-gray-600">
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
                        <div className="flex items-center space-x-3 mb-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getHolidayTypeColor(holiday.type)}`}>
                            {holiday.type.charAt(0).toUpperCase() + holiday.type.slice(1)}
                          </span>
                        </div>
                        <h4 className="font-bold text-blue-600 text-xl mb-2 break-words">
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
                        {holiday.description && (
                          <p className="text-gray-500 text-sm break-words leading-relaxed">{holiday.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 sm:ml-6 flex-shrink-0">
                        <button
                          onClick={() => openEditHoliday(holiday)}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit holiday"
                        >
                          <FiEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(holiday._id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete holiday"
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

      {/* Holiday Modal */}
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          formData={settingsForm}
          setFormData={setSettingsForm}
          onSubmit={handleUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onSubmit={handleFileUpload}
          onClose={() => setShowUploadModal(false)}
          uploading={uploading}
        />
      )}

        {/* Upload History */}
        {uploadHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload History</h2>
              <p className="text-gray-600">
                {uploadHistory.length} file{uploadHistory.length !== 1 ? 's' : ''} uploaded successfully
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {uploadHistory.map((upload, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <FiFile className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 break-words text-lg">
                            {upload.name}
                          </h4>
                          <div className="flex items-center space-x-4 mt-2">
                            <p className="text-sm text-gray-600 flex items-center">
                              <FiClock className="w-4 h-4 mr-1 text-gray-400" />
                              {new Date(upload.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              Uploaded: {new Date(upload.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {upload.description && (
                            <p className="text-sm text-gray-500 break-words mt-2 leading-relaxed">{upload.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200">
                          <FiDownload className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Holiday Modal Component
const HolidayModal = ({ title, formData, setFormData, onSubmit, onClose }) => {
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Holiday Name
            </label>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Type
            </label>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
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
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Recurring Holiday</span>
            </label>
            
            {formData.isRecurring && (
              <div className="ml-7 animate-slideDown">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recurring Pattern
                </label>
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
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {title.includes('Add') ? 'Add Holiday' : 'Update Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ formData, setFormData, onSubmit, onClose }) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl transform animate-slideUp">
        <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <FiClock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Calendar Settings</h3>
          </div>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-8">
          {/* Working Days */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
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
                      workingDays: {
                        ...formData.workingDays,
                        [day]: e.target.checked
                      }
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="capitalize font-medium text-gray-700">{day}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Working Hours */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              Working Hours
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Time
                </label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Time
                </label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Break Duration (minutes)
                </label>
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
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Update Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Upload Modal Component
const UploadModal = ({ onSubmit, onClose, uploading }) => {
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
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Calendar File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-green-400 hover:bg-green-50 transition-all duration-300 group">
              <div className="relative">
                <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4 group-hover:text-green-500 transition-colors duration-300" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">📄</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4 font-medium">
                Upload PNG, JPG, or PDF calendar file
              </p>
              <input
                id="calendarFile"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const fileName = document.getElementById('fileName');
                    if (fileName) fileName.textContent = file.name;
                  }
                }}
                required
              />
              <label
                htmlFor="calendarFile"
                className="cursor-pointer bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-semibold inline-block transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Choose File
              </label>
              <p id="fileName" className="text-xs text-gray-500 mt-3 font-medium"></p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Supported Features
            </h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></span>
                Automatic holiday detection from PDF text
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></span>
                Common holidays (New Year, Christmas, etc.)
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></span>
                Date pattern recognition
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3"></span>
                Duplicate prevention
              </li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={uploading}
            >
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
