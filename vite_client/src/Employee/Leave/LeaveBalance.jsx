import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { getAuthEmployeeId } from '../../utils/authUser';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { getLeaveDisplayLabel, getLeaveSummary } from '../../constants/leaveConstants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const LeaveBalance = () => {
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const employee = useSelector(state => state.auth.employee || state.auth.user);
    const employeeDocId = getAuthEmployeeId(employee);

    useEffect(() => {
        if (employeeDocId) {
            fetchBalance();
        }
    }, [year, employeeDocId]);

    const fetchBalance = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `/v1/admin/leave-policy/balance/${employeeDocId}`,
                { params: { year } }
            );
            setBalance(res.data.balance);
        } catch (error) {
            if (error.response?.status !== 404) {
                toast.error('Failed to fetch leave balance');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="text-center py-8">Loading leave balance...</div>
            </div>
        );
    }

    if (!balance) {
        return (
            <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">No leave balance found. Please contact HR to set up your leave policy.</p>
                </div>
            </div>
        );
    }

    const leaveSummary = getLeaveSummary(balance);
    const leaveLabel = getLeaveDisplayLabel();

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">My Leave Balance</h2>
                <select
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="border rounded px-3 py-2"
                >
                    {[year - 1, year, year + 1].map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {balance.policy && (
                <div className="bg-theme-secondary/10 border border-theme-secondary rounded-lg p-4 mb-6">
                    <p className="text-theme-secondary">
                        <strong>Policy:</strong> {balance.policy.policyName}
                    </p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">This Month Leave</p>
                    <p className="text-2xl font-bold text-theme-secondary">
                        {leaveSummary.earnedThisMonth} days
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Used</p>
                    <p className="text-2xl font-bold text-red-600">
                        {leaveSummary.totalUsed} days
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Available</p>
                    <p className="text-2xl font-bold text-theme-primary">
                        {leaveSummary.totalAvailableLeave} days
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Leave Balance Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[{ name: leaveLabel, value: leaveSummary.totalAvailableLeave || 0 }]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {[{ name: leaveLabel, value: leaveSummary.totalAvailableLeave || 0 }].length > 0 ? (
                                    <Cell fill="#0088FE" />
                                ) : null}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Leave Usage Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[{
                            name: leaveLabel,
                            used: leaveSummary.totalUsed || 0,
                            available: leaveSummary.totalAvailableLeave || 0,
                        }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="used" fill="#ef4444" name="Used" />
                            <Bar dataKey="available" fill="#10b981" name="Available" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Employee leave summary */}
            <div className="max-w-md mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Employee Leave Summary</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-600">This Month Leave:</span>
                            <span className="font-medium">{leaveSummary.earnedThisMonth} days</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Total Used:</span>
                            <span className="font-medium text-red-600">
                                -{leaveSummary.totalUsed} days
                            </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between mb-2">
                                <span className="font-semibold">Available:</span>
                                <span className={`font-bold text-lg ${
                                    leaveSummary.totalAvailableLeave > 0 ? 'text-theme-primary' : 'text-red-600'
                                }`}>
                                    {leaveSummary.totalAvailableLeave} days
                                </span>
                            </div>
                            {leaveSummary.totalAccrued > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${
                                            (leaveSummary.totalUsed / leaveSummary.totalAccrued) * 100 > 80
                                                ? 'bg-red-500'
                                                : (leaveSummary.totalUsed / leaveSummary.totalAccrued) * 100 > 50
                                                    ? 'bg-yellow-500'
                                                    : 'bg-theme-primary'
                                        }`}
                                        style={{
                                            width: `${Math.min(
                                                (leaveSummary.totalUsed / leaveSummary.totalAccrued) * 100,
                                                100
                                            )}%`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaveBalance;

