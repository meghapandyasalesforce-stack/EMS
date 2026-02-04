import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaPlus, FaCalendar } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const MyRegularizationRequests = () => {
    const user = useSelector((state) => state.auth.user);
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        attendanceDate: '',
        regularizationType: 'missing_clock_in',
        requestedClockIn: '',
        requestedClockOut: '',
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/attendance-regularization/request', {
                params: { status: filterStatus === 'all' ? undefined : filterStatus },
                withCredentials: true
            });
            setRequests(response.data?.requests || []);
        } catch (error) {
            toast.error('Failed to load regularization requests');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.attendanceDate || !formData.reason) {
            toast.warning('Please fill in all required fields');
            return;
        }

        // Validate based on regularization type
        if ((formData.regularizationType === 'missing_clock_in' || 
             formData.regularizationType === 'both' || 
             formData.regularizationType === 'incorrect_time') && !formData.requestedClockIn) {
            toast.warning('Requested Clock In time is required');
            return;
        }

        if ((formData.regularizationType === 'missing_clock_out' || 
             formData.regularizationType === 'both' || 
             formData.regularizationType === 'incorrect_time') && !formData.requestedClockOut) {
            toast.warning('Requested Clock Out time is required');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post(
                '/v1/both/attendance-regularization/request',
                {
                    ...formData,
                    attendanceDate: new Date(formData.attendanceDate).toISOString(),
                    requestedClockIn: formData.requestedClockIn ? new Date(`${formData.attendanceDate}T${formData.requestedClockIn}`).toISOString() : undefined,
                    requestedClockOut: formData.requestedClockOut ? new Date(`${formData.attendanceDate}T${formData.requestedClockOut}`).toISOString() : undefined
                },
                { withCredentials: true }
            );
            toast.success('Regularization request submitted successfully');
            setShowCreateModal(false);
            setFormData({
                attendanceDate: '',
                regularizationType: 'missing_clock_in',
                requestedClockIn: '',
                requestedClockOut: '',
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
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel request');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
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
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">My Attendance Regularization Requests</h1>
                            <p className="text-gray-600 mt-1">Request corrections for your attendance records</p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        >
                            <FaPlus />
                            New Request
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-6 border-b">
                        {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === status
                                        ? 'border-b-2 border-blue-500 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)} ({requests.filter(r => status === 'all' || r.status === status).length})
                            </button>
                        ))}
                    </div>

                    {/* Requests List */}
                    {requests.length === 0 ? (
                        <div className="text-center py-12">
                            <FaClock className="mx-auto text-gray-400 text-4xl mb-4" />
                            <p className="text-gray-600 mb-4">No regularization requests found</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
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
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                                                    {request.status}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    {getTypeLabel(request.regularizationType)}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {format(new Date(request.attendanceDate), 'MMM dd, yyyy')}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
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
                                                    <p className="text-green-600"><strong>Manager Response:</strong> {request.managerResponse}</p>
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
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">Create Attendance Regularization Request</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Attendance Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.attendanceDate}
                                    onChange={(e) => setFormData({ ...formData, attendanceDate: e.target.value })}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Regularization Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.regularizationType}
                                    onChange={(e) => setFormData({ ...formData, regularizationType: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
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
                                        onChange={(e) => setFormData({ ...formData, requestedClockIn: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                            )}

                            {(formData.regularizationType === 'missing_clock_out' || 
                              formData.regularizationType === 'both' || 
                              formData.regularizationType === 'incorrect_time') && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Requested Clock Out Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.requestedClockOut}
                                        onChange={(e) => setFormData({ ...formData, requestedClockOut: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="Please provide a reason for this regularization request..."
                                    className="w-full p-3 border rounded-lg"
                                    rows="4"
                                    required
                                    maxLength={500}
                                />
                                <p className="text-xs text-gray-500 mt-1">{formData.reason.length}/500 characters</p>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData({
                                            attendanceDate: '',
                                            regularizationType: 'missing_clock_in',
                                            requestedClockIn: '',
                                            requestedClockOut: '',
                                            reason: ''
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                </div>
            )}
        </div>
    );
};

export default MyRegularizationRequests;

