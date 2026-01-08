import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { FaClock, FaCheckCircle, FaTimesCircle, FaSpinner, FaEye } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';

const RegularizationRequests = () => {
    const user = useSelector((state) => state.auth.user);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('pending');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/attendance-regularization/manager/requests', {
                params: { status: filterStatus === 'all' ? undefined : filterStatus },
                withCredentials: true
            });
            setRequests(response.data?.requests || []);
        } catch (error) {
            console.error('Error fetching regularization requests:', error);
            toast.error('Failed to load regularization requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId) => {
        try {
            setActionLoading(requestId);
            await axios.patch(
                `/v1/both/attendance-regularization/manager/approve/${requestId}`,
                { managerResponse: 'Approved' },
                { withCredentials: true }
            );
            toast.success('Regularization request approved successfully');
            fetchRequests();
            setSelectedRequest(null);
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error(error.response?.data?.message || 'Failed to approve request');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (requestId) => {
        if (!rejectReason.trim()) {
            toast.warning('Please provide a rejection reason');
            return;
        }

        try {
            setActionLoading(requestId);
            await axios.patch(
                `/v1/both/attendance-regularization/manager/reject/${requestId}`,
                { rejectionReason: rejectReason },
                { withCredentials: true }
            );
            toast.success('Regularization request rejected');
            fetchRequests();
            setSelectedRequest(null);
            setRejectReason('');
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error(error.response?.data?.message || 'Failed to reject request');
        } finally {
            setActionLoading(null);
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
        return <LoadingSpinner message="Loading regularization requests..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Attendance Regularization Requests</h1>
                            <p className="text-gray-600 mt-1">Review and manage team attendance regularization requests</p>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-6 border-b">
                        {['all', 'pending', 'approved', 'rejected'].map((status) => (
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
                            <p className="text-gray-600">No regularization requests found</p>
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
                                                <h3 className="font-semibold text-gray-800">
                                                    {request.employeeId?.name} {request.employeeId?.lastName}
                                                </h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                                                    {request.status}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    {getTypeLabel(request.regularizationType)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                                <p><strong>Date:</strong> {format(new Date(request.attendanceDate), 'MMM dd, yyyy')}</p>
                                                {request.requestedClockIn && (
                                                    <p><strong>Requested Clock In:</strong> {format(new Date(request.requestedClockIn), 'hh:mm a')}</p>
                                                )}
                                                {request.requestedClockOut && (
                                                    <p><strong>Requested Clock Out:</strong> {format(new Date(request.requestedClockOut), 'hh:mm a')}</p>
                                                )}
                                                <p><strong>Reason:</strong> {request.reason}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {request.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(request._id)}
                                                        disabled={actionLoading === request._id}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                    >
                                                        {actionLoading === request._id ? (
                                                            <FaSpinner className="animate-spin" />
                                                        ) : (
                                                            <FaCheckCircle />
                                                        )}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedRequest(request)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                                                    >
                                                        <FaTimesCircle />
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => setSelectedRequest(request)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                            >
                                                <FaEye />
                                                View
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Reject Modal */}
            {selectedRequest && selectedRequest.status === 'pending' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Reject Regularization Request</h3>
                        <p className="text-gray-600 mb-4">
                            Please provide a reason for rejecting this request.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full p-3 border rounded-lg mb-4"
                            rows="4"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setSelectedRequest(null);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(selectedRequest._id)}
                                disabled={!rejectReason.trim() || actionLoading === selectedRequest._id}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {actionLoading === selectedRequest._id ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {selectedRequest && selectedRequest.status !== 'pending' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Request Details</h3>
                        <div className="space-y-2 text-sm">
                            <p><strong>Employee:</strong> {selectedRequest.employeeId?.name} {selectedRequest.employeeId?.lastName}</p>
                            <p><strong>Date:</strong> {format(new Date(selectedRequest.attendanceDate), 'MMM dd, yyyy')}</p>
                            <p><strong>Type:</strong> {getTypeLabel(selectedRequest.regularizationType)}</p>
                            {selectedRequest.requestedClockIn && (
                                <p><strong>Requested Clock In:</strong> {format(new Date(selectedRequest.requestedClockIn), 'hh:mm a')}</p>
                            )}
                            {selectedRequest.requestedClockOut && (
                                <p><strong>Requested Clock Out:</strong> {format(new Date(selectedRequest.requestedClockOut), 'hh:mm a')}</p>
                            )}
                            <p><strong>Reason:</strong> {selectedRequest.reason}</p>
                            <p><strong>Status:</strong> <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(selectedRequest.status)}`}>{selectedRequest.status}</span></p>
                            {selectedRequest.rejectionReason && (
                                <p><strong>Rejection Reason:</strong> {selectedRequest.rejectionReason}</p>
                            )}
                            {selectedRequest.managerResponse && (
                                <p><strong>Manager Response:</strong> {selectedRequest.managerResponse}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedRequest(null)}
                            className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegularizationRequests;

