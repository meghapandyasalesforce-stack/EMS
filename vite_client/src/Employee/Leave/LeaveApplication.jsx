import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { submitLeave, resetStatus } from '../../context/employeeLeaveSlice';
import { toast } from 'react-toastify';
import { useMediaQuery } from 'react-responsive';
import { DEFAULT_LEAVE_TYPE, getAllLeaveTypeOptions, LEAVE_REASON_OPTIONS } from '../../constants/leaveConstants';

const LeaveApplication = () => {
  const dispatch = useDispatch();
  const { loading: submitting, success, error } = useSelector((state) => state.employeeLeave);
  const user = useSelector((state) => state.auth.user);
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const location = useLocation();

  const [leaveForm, setLeaveForm] = useState({
    name: '',
    email: '',
    startDate: '',
    endDate: '',
    leaveType: location.state?.leaveType || DEFAULT_LEAVE_TYPE,
    reason: '',
    document: null,
    isHalfDay: false,
    halfDayType: 'first_half',
  });

  const [errors, setErrors] = useState({});
  const leaveTypeOptions = useMemo(() => getAllLeaveTypeOptions(), []);

  useEffect(() => {
    if (user) {
      setLeaveForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLeaveForm({ ...leaveForm, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, document: 'File size must be less than 5MB' });
      return;
    }
    setLeaveForm({ ...leaveForm, document: file });
    setErrors({ ...errors, document: '' });
  };

  const validateForm = () => {
    const formErrors = {};
    if (!leaveForm.name) formErrors.name = 'Name is required';
    if (!leaveForm.email) formErrors.email = 'Email is required';
    if (!leaveForm.startDate) formErrors.startDate = 'Start date is required';
    if (!leaveForm.endDate) formErrors.endDate = 'End date is required';
    if (!leaveForm.reason.trim()) formErrors.reason = 'Please select or enter a reason';
    
    if (leaveForm.startDate && leaveForm.endDate) {
      if (new Date(leaveForm.startDate) > new Date(leaveForm.endDate)) {
        formErrors.endDate = 'End date must be after start date';
      }
    }

    return formErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    dispatch(submitLeave({
      name: leaveForm.name,
      email: leaveForm.email,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      leaveType: leaveForm.leaveType,
      reason: leaveForm.reason.trim(),
      isHalfDay: leaveForm.isHalfDay,
      halfDayType: leaveForm.isHalfDay ? leaveForm.halfDayType : null,
      document: leaveForm.document,
    }));
  };

  useEffect(() => {
    if (success) {
      toast.success('Leave submitted. It goes to your manager first, then HR for final approval.');
      setLeaveForm({
        name: user?.name || '',
        email: user?.email || '',
        startDate: '',
        endDate: '',
        leaveType: DEFAULT_LEAVE_TYPE,
        reason: '',
        document: null,
        isHalfDay: false,
        halfDayType: 'first_half',
      });
      setErrors({});
      dispatch(resetStatus());
    }
    if (error) {
      toast.error(`Submission failed: ${error}`);
      dispatch(resetStatus());
    }
  }, [success, error, dispatch, user]);

  return (
    <div className="bg-white p-4 md:p-8 rounded-xl shadow-md mt-4 lg:mt-10 transition-all duration-300">
      <div className="mx-auto w-full lg:max-w-2xl">
        <h2 className="text-xl md:text-2xl font-bold mb-2 text-gray-800">Leave Application Form</h2>
        <p className="mb-4 md:mb-6 text-sm text-gray-600">
          After you submit, your manager must approve first. Then HR completes final approval before leave is deducted from your balance.
        </p>
        <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4 md:space-y-6">
          {/* Name and Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {['name', 'email'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700">
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  type="text"
                  name={field}
                  value={leaveForm[field]}
                  onChange={handleChange}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-sm md:text-base"
                />
              </div>
            ))}
          </div>

          {/* Leave type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Leave type</label>
            <select
              name="leaveType"
              value={leaveForm.leaveType}
              onChange={handleChange}
              disabled={submitting}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base"
            >
              {leaveTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {['startDate', 'endDate'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700">
                  {field === 'startDate' ? 'Start Date' : 'End Date'}
                </label>
                <input
                  type="date"
                  name={field}
                  value={leaveForm[field]}
                  onChange={handleChange}
                  disabled={submitting}
                  min={field === 'endDate' ? leaveForm.startDate : new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base"
                />
                {errors[field] && <p className="text-red-500 text-xs md:text-sm mt-1">{errors[field]}</p>}
              </div>
            ))}
          </div>

          {/* Half Day Option */}
          {leaveForm.startDate && leaveForm.endDate && 
           new Date(leaveForm.startDate).toDateString() === new Date(leaveForm.endDate).toDateString() && (
            <div className="bg-theme-secondary/10 border border-theme-secondary rounded-lg p-4">
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  name="isHalfDay"
                  checked={leaveForm.isHalfDay}
                  onChange={(e) => {
                    setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked });
                    if (errors.isHalfDay) {
                      setErrors({ ...errors, isHalfDay: '' });
                    }
                  }}
                  disabled={submitting}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Half Day Leave</span>
              </label>
              {leaveForm.isHalfDay && (
                <div className="mt-2 ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Half Day Type</label>
                  <select
                    name="halfDayType"
                    value={leaveForm.halfDayType}
                    onChange={handleChange}
                    disabled={submitting}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base"
                  >
                    <option value="first_half">First Half (Morning)</option>
                    <option value="second_half">Second Half (Afternoon)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <select
              name="reason"
              value={leaveForm.reason}
              onChange={handleChange}
              disabled={submitting}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base"
            >
              <option value="">Select a reason</option>
              {LEAVE_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            {errors.reason && <p className="text-red-500 text-xs md:text-sm mt-1">{errors.reason}</p>}
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Supporting Document (Optional)
            </label>
            <div className="flex items-center space-x-2 md:space-x-4 mt-2">
              <label
                htmlFor="document"
                className={`cursor-pointer inline-flex items-center px-3 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded ${
                  submitting 
                    ? 'bg-gray-400 text-gray-700' 
                    : 'bg-theme-primary text-white hover:opacity-90'
                }`}
              >
                Upload File
              </label>
              <span className="text-xs md:text-sm text-gray-600 truncate max-w-[120px] md:max-w-xs">
                {leaveForm.document ? leaveForm.document.name : 'No file chosen'}
              </span>
            </div>
            <input
              type="file"
              id="document"
              name="document"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: PDF, DOC, DOCX, JPG, PNG</p>
            {errors.document && <p className="text-red-500 text-xs md:text-sm mt-1">{errors.document}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full px-4 py-2 md:px-6 md:py-3 rounded-md ${
              submitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-theme-primary hover:opacity-90 text-white'
            } text-sm md:text-base`}
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Application'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LeaveApplication;