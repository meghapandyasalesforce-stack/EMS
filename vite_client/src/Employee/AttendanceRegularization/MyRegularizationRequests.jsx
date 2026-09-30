import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaPlus, FaCalendar } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate, useLocation } from 'react-router-dom';

import { isHR as checkIsHR } from '../../utils/managerHelper';
import { formatStatusLabel, formatUiLabel } from '../../utils/textFormat.js';

const canAccessTeamRegularization = (userObj) => {
    const role = userObj?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') : '') || '';
    const roles = Array.isArray(userObj?.functionalRoles) ? userObj.functionalRoles : [];
    return (
        role === 'admin' ||
        checkIsHR(userObj) ||
        roles.some((r) => ['manager', 'executive', 'ceo', 'cto', 'cfo', 'vp', 'hr'].includes(String(r).toLowerCase()))
    );
};

const teamRegularizationPath = (userObj) => {
    const roles = Array.isArray(userObj?.functionalRoles) ? userObj.functionalRoles : [];
    const role = userObj?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') : '') || '';
    const isManagerOnly =
        role !== 'admin' &&
        !checkIsHR(userObj) &&
        roles.some((r) => String(r).toLowerCase() === 'manager') &&
        !roles.some((r) => ['hr', 'executive', 'ceo', 'cto', 'cfo', 'vp'].includes(String(r).toLowerCase()));
    return isManagerOnly ? '/manager/attendance-regularization' : '/attendance-regularization';
};

const MyRegularizationRequests = () => {
    const user = useSelector((state) => state.auth.user);
    const employeeProfile = useSelector((state) => state.employeeDetails.employee);
    const userObj = user || employeeProfile;
    const navigate = useNavigate();
    const location = useLocation();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        attendanceDate: '',
        regularizationType: 'missing_clock_in',
        requestedClockIn: '',
        requestedClockOut: '',
        clockOutNextDay: false,
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [limits, setLimits] = useState(null);
    const [limitsLoading, setLimitsLoading] = useState(true);

    const canCreateRequest = !limitsLoading && limits?.canSubmit === true;

    const getLimitBlockMessage = () => {
        if (!limits) return 'Unable to verify regularization limits. Please try again later.';
        if (!limits.enabled) return 'Regularization is currently disabled for your organization.';
        if (!limits.unlimited && limits.remaining === 0) {
            return `Monthly regularization limit reached (max ${limits.allowedPerMonth} requests).`;
        }
        return 'You cannot submit a regularization request right now.';
    };

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    useEffect(() => {
        fetchLimits();
    }, []);

    const fetchLimits = async () => {
        setLimitsLoading(true);
        try {
            const response = await axios.get('/v1/both/attendance-regularization/limits', {
                withCredentials: true
            });
            setLimits(response.data?.data ?? null);
        } catch {
            setLimits(null);
        } finally {
            setLimitsLoading(false);
        }
    };

    useEffect(() => {
        const prefill = location.state?.prefillRegularization;
        if (!prefill || limitsLoading) return;

        navigate(location.pathname, { replace: true, state: null });

        if (!canCreateRequest) {
            toast.warning(getLimitBlockMessage());
            return;
        }

        setFormData({
            attendanceDate: prefill.attendanceDate || '',
            regularizationType: prefill.regularizationType || 'missing_clock_in',
            requestedClockIn: prefill.requestedClockIn || '',
            requestedClockOut: prefill.requestedClockOut || '',
            clockOutNextDay: Boolean(prefill.clockOutNextDay),
            reason: prefill.reason || ''
        });
        setShowCreateModal(true);
    }, [location.pathname, location.state, navigate, limitsLoading, canCreateRequest]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/attendance-regularization/request', {
                params: { status: filterStatus === 'all' ? undefined : filterStatus },
                withCredentials: true
            });
            setRequests(response.data?.data ?? []);
        } catch (error) {
            toast.error('Failed to load regularization requests');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canCreateRequest) {
            toast.warning(getLimitBlockMessage());
            return;
        }
        
        const needsClockIn = formData.regularizationType === 'missing_clock_in'
            || formData.regularizationType === 'both'
            || formData.regularizationType === 'incorrect_time';
        const needsClockOut = formData.regularizationType === 'missing_clock_out'
            || formData.regularizationType === 'both'
            || formData.regularizationType === 'incorrect_time';

        if (!formData.attendanceDate) {
            setFormError('attendanceDate');
            return;
        }
        if (needsClockIn && !formData.requestedClockIn) {
            setFormError('requestedClockIn');
            return;
        }
        if (needsClockOut && !formData.requestedClockOut) {
            setFormError('requestedClockOut');
            return;
        }
        if (!formData.reason.trim()) {
            setFormError('reason');
            return;
        }
        setFormError('');

        try {
            setSubmitting(true);
            const buildWallIsoFromDateStr = (dateStr, hhmm) => {
                if (!dateStr || !hhmm) return undefined;
                return new Date(`${dateStr}T${hhmm}:00`).toISOString();
            };
            const payload = {
                attendanceDate: new Date(formData.attendanceDate).toISOString(),
                regularizationType: formData.regularizationType,
                reason: formData.reason
            };
            if (formData.regularizationType !== 'full_day') {
                payload.requestedClockIn = formData.requestedClockIn
                    ? buildWallIsoFromDateStr(formData.attendanceDate, formData.requestedClockIn)
                    : undefined;
                payload.requestedClockOut = formData.requestedClockOut
                    ? buildWallIsoFromDateStr(formData.attendanceDate, formData.requestedClockOut)
                    : undefined;
                if (formData.clockOutNextDay && formData.regularizationType !== 'full_day') {
                    payload.clockOutNextDay = true;
                }
            }
            await axios.post('/v1/both/attendance-regularization/request', payload, { withCredentials: true });
            toast.success('Regularization request submitted successfully');
            setShowCreateModal(false);
            fetchLimits();
            setFormError('');
            setFormData({
                attendanceDate: '',
                regularizationType: 'missing_clock_in',
                requestedClockIn: '',
                requestedClockOut: '',
                clockOutNextDay: false,
                reason: ''
            });
            fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (requestId) => {
        if (!window.confirm('Are you sure you want to cancel this request?')) {
            return;
        }

        try {
            await axios.patch(
                `/v1/both/attendance-regularization/request/${requestId}/cancel`,
                {},
                { withCredentials: true }
            );
            toast.success('Request cancelled successfully');
            fetchRequests();
            fetchLimits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel request');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-theme-primary/10 text-theme-primary border-theme-primary',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return badges[status] || badges.pending;
    };

    const getTypeLabel = (type) => {
        const labels = {
            missing_clock_in: 'Missing Clock In',
            missing_clock_out: 'Missing Clock Out',
            both: 'Both Missing',
            incorrect_time: 'Incorrect Time',
            full_day: 'Full Day'
        };
        return labels[type] || type;
    };

    if (loading) {
        return <LoadingSpinner message="Loading your regularization requests..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-5 transition-all duration-300">
            <div className="w-full">
                <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">My Attendance Regularization Requests</h1>
                            <p className="text-gray-600 mt-1">Request corrections for your attendance records</p>
                            {/* {limitsLoading ? (
                                <p className="text-sm text-gray-500 mt-1">Loading monthly regularization limit...</p>
                            ) : limits ? (
                                <p className="text-sm text-gray-500 mt-1">
                                    {!limits.enabled
                                        ? 'Regularization is currently disabled for your organization.'
                                        : limits.unlimited
                                            ? `${limits.usedThisMonth} request(s) submitted this month (no monthly limit).`
                                            : `${limits.usedThisMonth} of ${limits.allowedPerMonth} monthly request(s) used (${limits.remaining} remaining).`}
                                </p>
                            ) : (
                                <p className="text-sm text-amber-600 mt-1">
                                    Could not load regularization limits. New requests are temporarily unavailable.
                                </p>
                            )} */}
                        </div>
                        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2 shrink-0">
                            {canAccessTeamRegularization(userObj) && (
                                <button
                                    type="button"
                                    onClick={() => navigate(teamRegularizationPath(userObj))}
                                    className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Team Requests
                                </button>
                            )}
                            <button
                            onClick={() => {
                                if (!canCreateRequest) {
                                    toast.warning(getLimitBlockMessage());
                                    return;
                                }
                                setShowCreateModal(true);
                            }}
                            disabled={!canCreateRequest}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaPlus />
                            New Request
                        </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="mb-6 w-full min-w-0 max-w-full touch-pan-x overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                        <div className="flex w-max min-w-full gap-2 border-b">
                            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`shrink-0 whitespace-nowrap px-4 py-2 font-medium text-sm transition-colors ${
                                        filterStatus === status
                                            ? 'border-b-2 border-theme-secondary text-theme-secondary'
                                            : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    {status === 'all' ? formatUiLabel('all') : formatStatusLabel(status)} ({requests.filter(r => status === 'all' || r.status === status).length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Requests List */}
                    {requests.length === 0 ? (
                        <div className="text-center py-12">
                            <FaClock className="mx-auto text-gray-400 text-4xl mb-4" />
                            <p className="text-gray-600 mb-4">No regularization requests found</p>
                            <button
                                onClick={() => {
                                    if (!canCreateRequest) {
                                        toast.warning(getLimitBlockMessage());
                                        return;
                                    }
                                    setShowCreateModal(true);
                                }}
                                disabled={!canCreateRequest}
                                className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Your First Request
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((request) => (
                                <div
                                    key={request._id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                                                    {formatStatusLabel(request.status)}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    {getTypeLabel(request.regularizationType)}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {format(new Date(request.attendanceDate), 'MMM dd, yyyy')}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1 break-words">
                                                {request.requestedClockIn && (
                                                    <p><strong>Requested Clock In:</strong> {format(new Date(request.requestedClockIn), 'hh:mm a')}</p>
                                                )}
                                                {request.requestedClockOut && (
                                                    <p><strong>Requested Clock Out:</strong> {format(new Date(request.requestedClockOut), 'hh:mm a')}</p>
                                                )}
                                                <p><strong>Reason:</strong> {request.reason}</p>
                                                {request.rejectionReason && (
                                                    <p className="text-red-600"><strong>Rejection Reason:</strong> {request.rejectionReason}</p>
                                                )}
                                                {request.managerResponse && (
                                                    <p className="text-theme-primary"><strong>Manager Response:</strong> {request.managerResponse}</p>
                                                )}
                                            </div>
                                        </div>
                                        {request.status === 'pending' && (
                                            <button
                                                onClick={() => handleCancel(request._id)}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Request Modal */}
            {showCreateModal && createPortal(
                <div className="fixed inset-0 z-[11000] flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
                    <div className="my-auto w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-lg bg-white p-4 sm:p-6 max-h-[calc(100dvh-1.5rem)]">
                        <h3 className="text-lg font-semibold mb-4">Create Attendance Regularization Request</h3>
                        <form noValidate onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Attendance Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.attendanceDate}
                                    onChange={(e) => {
                                        setFormError('');
                                        setFormData({ ...formData, attendanceDate: e.target.value });
                                    }}
                                    max={new Date().toISOString().split('T')[0]}
                                    className={`w-full p-3 border rounded-lg ${formError === 'attendanceDate' ? 'border-red-500' : ''}`}
                                />
                                {formError === 'attendanceDate' && (
                                    <p className="mt-1 text-sm text-red-600">Please fill out this field</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Regularization Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.regularizationType}
                                    onChange={(e) => {
                                        setFormError('');
                                        setFormData({
                                            ...formData,
                                            regularizationType: e.target.value,
                                            ...(e.target.value === 'full_day'
                                                ? { requestedClockIn: '', requestedClockOut: '', clockOutNextDay: false }
                                                : {})
                                        });
                                    }}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="missing_clock_in">Missing Clock In</option>
                                    <option value="missing_clock_out">Missing Clock Out</option>
                                    <option value="both">Both Missing</option>
                                    <option value="incorrect_time">Incorrect Time</option>
                                    <option value="full_day">Full Day</option>
                                </select>
                            </div>

                            {(formData.regularizationType === 'missing_clock_in' || 
                              formData.regularizationType === 'both' || 
                              formData.regularizationType === 'incorrect_time') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Requested Clock In Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.requestedClockIn}
                                        onChange={(e) => {
                                            setFormError('');
                                            setFormData({ ...formData, requestedClockIn: e.target.value });
                                        }}
                                        className={`w-full p-3 border rounded-lg ${formError === 'requestedClockIn' ? 'border-red-500' : ''}`}
                                    />
                                    {formError === 'requestedClockIn' && (
                                        <p className="mt-1 text-sm text-red-600">Please fill out this field</p>
                                    )}
                                </div>
                            )}

                            {(formData.regularizationType === 'missing_clock_out' || 
                              formData.regularizationType === 'both' || 
                              formData.regularizationType === 'incorrect_time') && (
                                <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Requested Clock Out Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.requestedClockOut}
                                        onChange={(e) => {
                                            setFormError('');
                                            setFormData({ ...formData, requestedClockOut: e.target.value });
                                        }}
                                        className={`w-full p-3 border rounded-lg ${formError === 'requestedClockOut' ? 'border-red-500' : ''}`}
                                    />
                                    {formError === 'requestedClockOut' && (
                                        <p className="mt-1 text-sm text-red-600">Please fill out this field</p>
                                    )}
                                </div>
                                <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={formData.clockOutNextDay}
                                        onChange={(e) =>
                                            setFormData({ ...formData, clockOutNextDay: e.target.checked })}
                                        className="mt-1 rounded border-gray-300"
                                    />
                                    <span>
                                        Clock-out was on the <strong>next calendar day</strong> (e.g. night shift / punched out morning after midnight).
                                        Check this so hours calculate correctly when your out-time is earlier in the clock than your in-time on the attendance date.
                                    </span>
                                </label>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => {
                                        setFormError('');
                                        setFormData({ ...formData, reason: e.target.value });
                                    }}
                                    placeholder="Please provide a reason for this regularization request..."
                                    className={`w-full p-3 border rounded-lg ${formError === 'reason' ? 'border-red-500' : ''}`}
                                    rows="4"
                                    maxLength={500}
                                />
                                {formError === 'reason' && (
                                    <p className="mt-1 text-sm text-red-600">Please fill out this field</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{formData.reason.length}/500 characters</p>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormError('');
                                        setFormData({
                                            attendanceDate: '',
                                            regularizationType: 'missing_clock_in',
                                            requestedClockIn: '',
                                            requestedClockOut: '',
                                            clockOutNextDay: false,
                                            reason: ''
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !canCreateRequest}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin inline mr-2" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Request'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MyRegularizationRequests;

