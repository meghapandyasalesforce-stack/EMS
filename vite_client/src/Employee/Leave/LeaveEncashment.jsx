import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { getAuthEmployeeId } from '../../utils/authUser';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { getLeaveSummary } from '../../constants/leaveConstants';

const LeaveEncashment = () => {
    const employee = useSelector(state => state.auth.employee || state.auth.user);
    const employeeDocId = getAuthEmployeeId(employee);
    const [loading, setLoading] = useState(false);
    const [encashmentHistory, setEncashmentHistory] = useState([]);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [formData, setFormData] = useState({
        leaveType: '',
        days: '',
        reason: ''
    });
    const [availableBalances, setAvailableBalances] = useState({});

    useEffect(() => {
        if (employeeDocId) {
            fetchEncashmentHistory();
            fetchLeaveBalances();
        }
    }, [employeeDocId]);

    const fetchEncashmentHistory = async () => {
        try {
            const res = await axios.get(`/v1/employee/leave-encashment/history/${employeeDocId}`);
            setEncashmentHistory(res.data.encashments || []);
        } catch (error) {
            // Error handled silently for production
        }
    };

    const fetchLeaveBalances = async () => {
        try {
            const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeDocId}`, {
                params: { year: new Date().getFullYear() }
            });
            if (res.data.balance) {
                const summary = getLeaveSummary(res.data.balance);
                const balances = {};
                (res.data.balance.balances || []).forEach((b) => {
                    balances[b.leaveType] = b.isPooledCategory
                        ? summary.totalAvailableLeave
                        : (b.availableDays ?? b.available ?? 0);
                });
                setAvailableBalances(balances);
            }
        } catch (error) {
            // Error handled silently for production
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post('/v1/employee/leave-encashment/request', formData);
            toast.success('Leave encashment request submitted successfully');
            setFormData({ leaveType: '', days: '', reason: '' });
            setShowRequestForm(false);
            await fetchEncashmentHistory();
            await fetchLeaveBalances();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit encashment request');
        } finally {
            setLoading(false);
        }
    };

    const leaveTypes = [
        { value: 'casual', label: 'Casual Leave' },
        { value: 'paid', label: 'Paid Leave' },
        { value: 'sick', label: 'Sick Leave' },
        { value: 'vacation', label: 'Vacation Leave' },
        { value: 'privileged', label: 'Privileged Leave' }
    ];

    return (
        <div className="min-h-screen bg-gray-100 pt-16 lg:pt-0 transition-all duration-300">
            <div className="p-4 md:p-8 max-w-screen-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Leave Encashment</h1>
                    <button
                        onClick={() => setShowRequestForm(!showRequestForm)}
                        className="bg-theme-primary text-white px-4 py-2 rounded-lg hover:opacity-90"
                    >
                        {showRequestForm ? 'Cancel' : 'Request Encashment'}
                    </button>
                </div>

                {showRequestForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-bold mb-4">Request Leave Encashment</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Leave Type *
                                </label>
                                <select
                                    value={formData.leaveType}
                                    onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    required
                                >
                                    <option value="">Select leave type</option>
                                    {leaveTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label} {availableBalances[type.value] !== undefined && `(Available: ${availableBalances[type.value]} days)`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Number of Days *
                                </label>
                                <input
                                    type="number"
                                    value={formData.days}
                                    onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    min="0.5"
                                    step="0.5"
                                    required
                                    max={availableBalances[formData.leaveType] || 0}
                                />
                                {formData.leaveType && availableBalances[formData.leaveType] !== undefined && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Available balance: {availableBalances[formData.leaveType]} days
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason
                                </label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    rows="3"
                                    placeholder="Optional reason for encashment"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full px-4 py-2 rounded-md ${
                                    loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-theme-primary hover:opacity-90 text-white'
                                }`}
                            >
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Encashment History</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested Date</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {encashmentHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                            No encashment requests found
                                        </td>
                                    </tr>
                                ) : (
                                    encashmentHistory.map((encashment) => (
                                        <tr key={encashment._id}>
                                            <td className="px-4 py-3 whitespace-nowrap capitalize">
                                                {encashment.leaveType}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {encashment.duration} days
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                ₹{encashment.encashmentAmount?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    encashment.status === 'approved'
                                                        ? 'bg-theme-primary/10 text-theme-primary'
                                                        : encashment.status === 'rejected'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {encashment.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(encashment.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaveEncashment;

