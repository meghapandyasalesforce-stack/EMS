import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    fetchOrganizationStatistics,
    fetchOrganizationActivity
} from '../../context/organizationSlice';
import {
    FiUsers,
    FiUserCheck,
    FiCalendar,
    FiDollarSign,
    FiFolder,
    FiTrendingUp,
    FiClock,
    FiAlertCircle,
    FiCheckCircle,
    FiX
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OrganizationDashboard = () => {
    const dispatch = useDispatch();
    const { statistics, activity, loading } = useSelector((state) => state.organization);
    const navigate = useNavigate();

    useEffect(() => {
        dispatch(fetchOrganizationStatistics());
        dispatch(fetchOrganizationActivity());
    }, [dispatch]);

    if (loading && !statistics) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!statistics) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No statistics available</p>
            </div>
        );
    }

    // Prepare chart data (Recharts format)
    const departmentData = statistics.departments?.map(d => ({
        name: d._id,
        employees: d.count
    })) || [];

    const attendanceData = statistics.attendance?.byStatus?.map(s => ({
        name: s._id,
        count: s.count
    })) || [];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    const leaveData = statistics.leaves?.byType?.map(l => ({
        name: l._id,
        days: l.totalDays
    })) || [];

    return (
        <div className="p-4 md:p-6 space-y-6 min-h-screen bg-gray-50">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Organization Dashboard</h1>
                    <p className="text-sm text-gray-600">Overview of your organization's key metrics and activities</p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/organization/profile')}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    Organization Profile
                </button>
            </div>

            {/* Statistics Cards - Consistent Icon Placement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Total Employees</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                                {statistics.employees?.total || 0}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                                {statistics.employees?.active || 0} active
                            </p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full ml-4 flex-shrink-0">
                            <FiUsers className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    {statistics.subscription && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-xs text-gray-600 mb-2">
                                <span className="font-medium">Subscription Usage</span>
                                <span className="font-semibold text-gray-900">{statistics.subscription.employeeUsage || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(statistics.subscription.employeeUsage || 0, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {statistics.employees?.total || 0} / {statistics.subscription.maxEmployees || 0} employees
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Attendance Records</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                                {statistics.attendance?.total || 0}
                            </p>
                            <p className="text-sm text-green-600 mt-1 font-medium">
                                {statistics.attendance?.recent || 0} this week
                            </p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full ml-4 flex-shrink-0">
                            <FiCalendar className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Leave Requests</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                                {statistics.leaves?.total || 0}
                            </p>
                            <p className="text-sm text-orange-600 mt-1 font-medium">
                                {statistics.leaves?.pending || 0} pending
                            </p>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-full ml-4 flex-shrink-0">
                            <FiClock className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Active Projects</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                                {statistics.projects?.total || 0}
                            </p>
                            {statistics.projects?.completed !== undefined && (
                                <p className="text-sm text-purple-600 mt-1 font-medium">
                                    {statistics.projects.completed || 0} completed
                                </p>
                            )}
                        </div>
                        <div className="bg-purple-100 p-3 rounded-full ml-4 flex-shrink-0">
                            <FiFolder className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Department Distribution */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Employees by Department
                    </h3>
                    {statistics.departments && statistics.departments.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={departmentData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="employees" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <FiUsers className="w-12 h-12 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">No department data available</p>
                            <p className="text-xs text-gray-400 mt-1">Add employees to see department distribution</p>
                        </div>
                    )}
                </div>

                {/* Attendance Status */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Attendance Status
                    </h3>
                    {statistics.attendance?.byStatus && statistics.attendance.byStatus.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={attendanceData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {attendanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <div className="bg-gray-100 p-6 rounded-full mb-4">
                                <FiCalendar className="w-12 h-12 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">No attendance data available</p>
                            <p className="text-xs text-gray-400 mt-1">Attendance records will appear here</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Leave Statistics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Leave Statistics by Type
                </h3>
                {statistics.leaves?.byType && statistics.leaves.byType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={leaveData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="days" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <div className="bg-gray-100 p-6 rounded-full mb-4">
                            <FiClock className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">No leave data available</p>
                        <p className="text-xs text-gray-400 mt-1">Leave requests will appear here</p>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Activity
                </h3>
                <div className="space-y-4">
                    {activity?.recentEmployees && activity.recentEmployees.length > 0 ? (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Recent Employees
                            </h4>
                            <div className="space-y-2">
                                {activity.recentEmployees.slice(0, 5).map((emp, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center">
                                            <FiUserCheck className="text-green-600 mr-2" />
                                            <span className="text-sm">{emp.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {new Date(emp.joiningDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <FiUserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No recent employees</p>
                        </div>
                    )}

                    {activity?.recentLeaves && activity.recentLeaves.length > 0 ? (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Recent Leave Requests
                            </h4>
                            <div className="space-y-2">
                                {activity.recentLeaves.slice(0, 5).map((leave, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center">
                                            {leave.status === 'approved' ? (
                                                <FiCheckCircle className="text-green-600 mr-2" />
                                            ) : leave.status === 'pending' ? (
                                                <FiAlertCircle className="text-yellow-600 mr-2" />
                                            ) : (
                                                <FiX className="text-red-600 mr-2" />
                                            )}
                                            <span className="text-sm">
                                                {leave.employee?.name} - {leave.leaveType}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {new Date(leave.startDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        !activity?.recentEmployees && (
                            <div className="text-center py-8 text-gray-400">
                                <FiClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No recent leave requests</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizationDashboard;

