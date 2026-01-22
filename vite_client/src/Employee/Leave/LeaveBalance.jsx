import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const LeaveBalance = () => {
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const employee = useSelector(state => state.auth.employee || state.auth.user);

    useEffect(() => {
        if (employee?._id) {
            fetchBalance();
        }
    }, [year, employee?._id]);

    const fetchBalance = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `/v1/admin/leave-policy/balance/${employee?._id}`,
                { params: { year } }
            );
            setBalance(res.data.balance);
        } catch (error) {
            console.error('Error fetching balance:', error);
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800">
                        <strong>Policy:</strong> {balance.policy.policyName}
                    </p>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Accrued</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {balance.balances?.reduce((sum, b) => sum + (b.accrued || 0) + (b.carriedForward || 0), 0) || 0} days
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Used</p>
                    <p className="text-2xl font-bold text-red-600">
                        {balance.balances?.reduce((sum, b) => sum + (b.used || 0), 0) || 0} days
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                        {balance.balances?.reduce((sum, b) => sum + (b.pending || 0), 0) || 0} days
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-600 mb-1">Available</p>
                    <p className="text-2xl font-bold text-green-600">
                        {balance.balances?.reduce((sum, b) => sum + (b.available || 0), 0) || 0} days
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
                                data={balance.balances?.map(b => ({
                                    name: balance.policy?.leaveTypes?.find(lt => lt.type === b.leaveType)?.displayName || b.leaveType,
                                    value: b.available
                                })) || []}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {balance.balances?.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][index % 5]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Leave Usage Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={balance.balances?.map(b => ({
                            name: balance.policy?.leaveTypes?.find(lt => lt.type === b.leaveType)?.displayName || b.leaveType,
                            used: b.used || 0,
                            available: b.available || 0
                        })) || []}>
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

            {/* Detailed Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {balance.balances?.map((typeBalance) => {
                    const policyType = balance.policy?.leaveTypes?.find(lt => lt.type === typeBalance.leaveType);
                    const total = (typeBalance.accrued || 0) + (typeBalance.carriedForward || 0);
                    const usedPercent = total > 0 ? ((typeBalance.used || 0) / total) * 100 : 0;
                    
                    return (
                        <div key={typeBalance.leaveType} className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold mb-4 capitalize">
                                {policyType?.displayName || typeBalance.leaveType} Leave
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Accrued:</span>
                                    <span className="font-medium">{typeBalance.accrued} days</span>
                                </div>
                                {typeBalance.carriedForward > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Carried Forward:</span>
                                        <span className="font-medium text-blue-600">
                                            +{typeBalance.carriedForward} days
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Used:</span>
                                    <span className="font-medium text-red-600">
                                        -{typeBalance.used} days
                                    </span>
                                </div>
                                {typeBalance.pending > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Pending:</span>
                                        <span className="font-medium text-yellow-600">
                                            -{typeBalance.pending} days
                                        </span>
                                    </div>
                                )}
                                {typeBalance.expired > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Expired:</span>
                                        <span className="font-medium text-gray-600">
                                            -{typeBalance.expired} days
                                        </span>
                                    </div>
                                )}
                                <div className="border-t pt-2 mt-2">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-semibold">Available:</span>
                                        <span className={`font-bold text-lg ${
                                            typeBalance.available > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {typeBalance.available} days
                                        </span>
                                    </div>
                                    {total > 0 && (
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${
                                                    usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.min(usedPercent, 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {balance.balances?.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-600">No leave types configured for this policy.</p>
                </div>
            )}
        </div>
    );
};

export default LeaveBalance;

