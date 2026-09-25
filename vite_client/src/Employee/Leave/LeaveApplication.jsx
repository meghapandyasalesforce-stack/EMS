import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { submitLeave, resetStatus } from '../../context/employeeLeaveSlice';
import { toast } from 'react-toastify';
import { useMediaQuery } from 'react-responsive';
import { DEFAULT_LEAVE_TYPE, getAllLeaveTypeOptions } from '../../constants/leaveConstants';
import axios from '../../utils/axios';
import { EMPLOYEE_LEAVE_ENDPOINT } from '../../utils/constant';
import useAuthPermissions from '../../Hooks/useAuthPermissions';

const SICK_DOC_MESSAGE =
  'Medical certificate is required when Sick Leave exceeds 1 day in a calendar month.';

/**
 * Submission window is based on the selected leave start date (not a rolling today range).
 * Leave Date + 4 calendar days = last valid submission day (5 days inclusive through 23:59).
 * Example: leave on 8 Sep → can submit on 8–12 Sep; from 13 Sep the application is rejected.
 */
const LEAVE_APPLICATION_WINDOW_DAYS = 5;

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateInputValue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return toDateInputValue(today);
}

/**
 * Calendar bounds for leave start: the 5 leave dates still submittable today.
 * today = 8 Sep → selectable leave starts are 4–8 Sep (leave date + 4 includes today).
 */
function getLeaveStartCalendarBounds(todayStr = getTodayDateInputValue()) {
  const today = parseLocalDateInput(todayStr) || new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - (LEAVE_APPLICATION_WINDOW_DAYS - 1));
  return {
    todayStr: toDateInputValue(today),
    minStartStr: toDateInputValue(minDate),
    maxStartStr: toDateInputValue(today),
  };
}

function parseLocalDateInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns error message if leave start is outside its own submission window; otherwise ''. */
function getLeaveApplicationWindowError(startDateStr, todayStr = getTodayDateInputValue()) {
  const startDate = parseLocalDateInput(startDateStr);
  const today = parseLocalDateInput(todayStr);
  if (!startDate || !today) return '';

  if (startDate > today) {
    return 'Leave start date cannot be in the future.';
  }

  const lastSubmissionDate = new Date(startDate);
  lastSubmissionDate.setDate(lastSubmissionDate.getDate() + (LEAVE_APPLICATION_WINDOW_DAYS - 1));
  if (today > lastSubmissionDate) {
    return `Leave for ${startDateStr} can only be submitted until ${toDateInputValue(lastSubmissionDate)} (within ${LEAVE_APPLICATION_WINDOW_DAYS} days of the leave date).`;
  }

  return '';
}

function leaveErrorText(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return 'Leave could not be submitted.';
}

/** Days of an existing leave that fall in a given calendar month. */
function getLeaveDaysInMonth(leave, year, monthIndex) {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const lStart = new Date(leave.startDate);
  const lEnd = new Date(leave.endDate);
  if (lEnd < monthStart || lStart > monthEnd) return 0;

  const duration = Number(leave.duration);
  if (leave.isHalfDay || duration === 0.5) return 0.5;
  if (Number.isFinite(duration) && duration > 0) {
    const totalMs = Math.max(lEnd - lStart, 0);
    const totalDays = Math.floor(totalMs / (1000 * 60 * 60 * 24)) + 1;
    const overlapStart = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
    const overlapEnd = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));
    const overlapDays = Math.floor((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
    if (totalDays <= 0) return 0;
    return (duration * overlapDays) / totalDays;
  }
  return 0;
}

function getSickDaysUsedInMonth(leaves, year, monthIndex) {
  return (leaves || [])
    .filter(
      (l) =>
        l.leaveType === 'sick' &&
        (l.status === 'pending' || l.status === 'approved')
    )
    .reduce((sum, leave) => sum + getLeaveDaysInMonth(leave, year, monthIndex), 0);
}

const LeaveApplication = () => {
  const dispatch = useDispatch();
  const { loading: submitting, success, error } = useSelector((state) => state.employeeLeave);
  const user = useSelector((state) => state.auth.user);
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const location = useLocation();
  const { isOrgOwner, isHrManager, isHrExecutive } = useAuthPermissions();

  /** HR staff have no manager→HR chain for their own leave; the org admin decides. */
  const isHrApplicant = !isOrgOwner && (isHrManager || isHrExecutive);
  const submitNotice = isHrApplicant
    ? 'Your leave request goes straight to the organization admin for approval. HR cannot approve its own leave.'
    : 'After you submit, your manager must approve first. Then HR completes final approval before leave is deducted from your balance.';
  const submitToast = isHrApplicant
    ? 'Leave submitted. It is pending organization admin approval.'
    : 'Leave submitted. It goes to your manager first, then HR for final approval.';

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
  const [myLeaves, setMyLeaves] = useState([]);
  const leaveTypeOptions = useMemo(() => getAllLeaveTypeOptions(), []);
  const { todayStr, minStartStr, maxStartStr } = getLeaveStartCalendarBounds();

  useEffect(() => {
    if (user) {
      setLeaveForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
          withCredentials: true,
        });
        if (!cancelled) {
          setMyLeaves(response.data?.leaves || []);
        }
      } catch {
        if (!cancelled) setMyLeaves([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSickLeave = leaveForm.leaveType === 'sick';

  const sickDocumentRequired = useMemo(() => {
    if (!isSickLeave || !leaveForm.startDate || !leaveForm.endDate) return false;

    const start = new Date(`${leaveForm.startDate}T00:00:00`);
    const end = new Date(`${leaveForm.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return false;
    }

    const epsilon = 1e-9;
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor.getTime() <= lastMonth.getTime()) {
      const year = cursor.getFullYear();
      const monthIndex = cursor.getMonth();
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const segmentStart = new Date(Math.max(start.getTime(), monthStart.getTime()));
      const segmentEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()));
      if (segmentStart <= segmentEnd) {
        const requestedInMonth = leaveForm.isHalfDay
          ? 0.5
          : Math.floor((segmentEnd - segmentStart) / (1000 * 60 * 60 * 24)) + 1;
        const usedInMonth = getSickDaysUsedInMonth(myLeaves, year, monthIndex);
        if (usedInMonth + requestedInMonth > 1 + epsilon) {
          return true;
        }
      }
      cursor = new Date(year, monthIndex + 1, 1);
    }
    return false;
  }, [
    isSickLeave,
    leaveForm.startDate,
    leaveForm.endDate,
    leaveForm.isHalfDay,
    myLeaves,
  ]);

  // Show optional upload for non-sick; for sick only when monthly total exceeds 1 day
  const showDocumentUpload = !isSickLeave || sickDocumentRequired;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLeaveForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'startDate') {
        if (prev.isHalfDay) {
          next.endDate = value;
        } else if (next.endDate && value > next.endDate) {
          next.endDate = value;
        }
      }
      if (name === 'endDate' && value !== prev.startDate) {
        next.isHalfDay = false;
      }
      return next;
    });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, document: 'File size must be less than 5MB' });
      return;
    }

    if (sickDocumentRequired) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
      const extOk = /\.(pdf|jpe?g|png)$/i.test(file.name);
      if (!allowed.includes(file.type) && !extOk) {
        setErrors({
          ...errors,
          document: 'Only PDF, JPG, JPEG, or PNG files are allowed',
        });
        return;
      }
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
        formErrors.endDate = 'End date must be on or after start date';
      }
      if (leaveForm.isHalfDay && leaveForm.endDate !== leaveForm.startDate) {
        formErrors.endDate =
          'Half-day leave must be on a single day (end date matches start date).';
      }
      const windowError = getLeaveApplicationWindowError(leaveForm.startDate, todayStr);
      if (windowError) {
        formErrors.startDate = windowError;
      }
    }

    if (leaveForm.isHalfDay && !leaveForm.startDate) {
      formErrors.startDate = 'Start date is required for half-day leave';
    }

    if (sickDocumentRequired && !(leaveForm.document instanceof File)) {
      formErrors.document = SICK_DOC_MESSAGE;
    }

    return formErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      const message = Object.values(formErrors).filter(Boolean).join(' ');
      if (message) toast.error(message);
      return;
    }

    const endDateForSubmit = leaveForm.isHalfDay ? leaveForm.startDate : leaveForm.endDate;
    const isHalfDaySubmit =
      Boolean(leaveForm.isHalfDay) && endDateForSubmit === leaveForm.startDate;

    dispatch(submitLeave({
      name: leaveForm.name,
      email: leaveForm.email,
      startDate: leaveForm.startDate,
      endDate: endDateForSubmit,
      leaveType: leaveForm.leaveType,
      reason: leaveForm.reason.trim(),
      isHalfDay: isHalfDaySubmit,
      halfDayType: isHalfDaySubmit ? leaveForm.halfDayType : null,
      document: isSickLeave && !sickDocumentRequired ? null : leaveForm.document,
    }));
  };

  useEffect(() => {
    if (success) {
      toast.success(submitToast);
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
      // Refresh leaves so next sick application uses updated monthly totals
      axios
        .get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, { withCredentials: true })
        .then((response) => setMyLeaves(response.data?.leaves || []))
        .catch(() => {});
    }
    if (error) {
      toast.error(leaveErrorText(error));
      dispatch(resetStatus());
    }
  }, [success, error, dispatch, user, submitToast]);

  // Clear selected file when sick document upload is no longer required
  useEffect(() => {
    if (isSickLeave && !sickDocumentRequired && leaveForm.document) {
      setLeaveForm((prev) => ({ ...prev, document: null }));
      setErrors((prev) => ({ ...prev, document: '' }));
    }
  }, [isSickLeave, sickDocumentRequired]); // eslint-disable-line react-hooks/exhaustive-deps

  // If date range spans multiple days, half-day mode is invalid (checkbox may be hidden but flag still set).
  useEffect(() => {
    if (!leaveForm.startDate || !leaveForm.endDate) return;
    if (leaveForm.startDate === leaveForm.endDate) return;
    if (!leaveForm.isHalfDay) return;
    setLeaveForm((prev) => ({ ...prev, isHalfDay: false }));
  }, [leaveForm.startDate, leaveForm.endDate, leaveForm.isHalfDay]);

  return (
    <div className="page-shell w-full min-w-0">
      <div className="page-shell-inner">
        <div className="mt-4 w-full min-w-0 rounded-xl bg-white p-3 shadow-md transition-all duration-300 sm:p-4 md:p-6 lg:mt-6">
        <h2 className="mb-2 text-xl font-bold text-gray-800 md:text-2xl">Leave Application Form</h2>
        <p className="mb-4 text-sm text-gray-600 md:mb-6">{submitNotice}</p>
        <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-4 md:space-y-6">
          {/* Name and Email */}
          <div className="hrms-form-grid">
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
          <div className="hrms-form-grid">
            {['startDate', 'endDate'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700">
                  {field === 'startDate' ? 'Start Date' : 'End Date'}
                </label>
                <input
                  type="date"
                  name={field}
                  value={leaveForm[field]}
                  onChange={(e) => {
                    e.target.setCustomValidity('');
                    handleChange(e);
                  }}
                  onInvalid={(e) => {
                    if (field !== 'startDate') return;
                    const message = `Leave can only be applied from ${minStartStr} to ${maxStartStr}.`;
                    e.target.setCustomValidity(message);
                    toast.error(message);
                  }}
                  disabled={
                    submitting || (field === 'endDate' && leaveForm.isHalfDay)
                  }
                  min={
                    field === 'startDate'
                      ? minStartStr
                      : leaveForm.startDate || minStartStr
                  }
                  max={field === 'startDate' ? maxStartStr : undefined}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base disabled:bg-gray-100"
                />
                {field === 'endDate' && leaveForm.isHalfDay && (
                  <p className="text-xs text-gray-500 mt-1">
                    Same as start date for half-day leave (0.5 day).
                  </p>
                )}
                {errors[field] && <p className="text-red-500 text-xs md:text-sm mt-1">{errors[field]}</p>}
              </div>
            ))}
          </div>

          {/* Half Day Option */}
          {leaveForm.startDate && (
            <div className="bg-theme-secondary/10 border border-theme-secondary rounded-lg p-4">
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  name="isHalfDay"
                  checked={leaveForm.isHalfDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLeaveForm((prev) => ({
                      ...prev,
                      isHalfDay: checked,
                      endDate: checked ? prev.startDate : prev.endDate,
                    }));
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
            <textarea
              name="reason"
              value={leaveForm.reason}
              onChange={handleChange}
              disabled={submitting}
              rows="3"
              placeholder="Enter reason for leave"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary text-sm md:text-base"
            />
            {errors.reason && <p className="text-red-500 text-xs md:text-sm mt-1">{errors.reason}</p>}
          </div>

          {/* Document Upload — for Sick Leave only when monthly total exceeds 1 day; optional for other types */}
          {showDocumentUpload && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {sickDocumentRequired
                  ? 'Medical Certificate (Required)'
                  : 'Supporting Document (Optional)'}
              </label>
              {sickDocumentRequired && (
                <p className="text-xs text-amber-700 mt-1">{SICK_DOC_MESSAGE}</p>
              )}
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
                accept={
                  sickDocumentRequired
                    ? '.pdf,.jpg,.jpeg,.png'
                    : '.pdf,.doc,.docx,.jpg,.jpeg,.png'
                }
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                {sickDocumentRequired
                  ? 'Max size: 5MB. Formats: PDF, JPG, JPEG, PNG'
                  : 'Max size: 5MB. Formats: PDF, DOC, DOCX, JPG, PNG'}
              </p>
              {errors.document && (
                <p className="text-red-500 text-xs md:text-sm mt-1">{errors.document}</p>
              )}
            </div>
          )}

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
    </div>
  );
};

export default LeaveApplication;
