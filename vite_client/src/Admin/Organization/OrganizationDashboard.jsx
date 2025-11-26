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
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const OrganizationDashboard = () => {
    const dispatch = useDispatch();
    const { statistics, activity, loading } = useSelector((state) => state.organization);

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

    // Prepare chart data
    const departmentData = {
        labels: statistics.departments?.map(d => d._id) || [],
        datasets: [{
            label: 'Employees',
            data: statistics.departments?.map(d => d.count) || [],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(139, 92, 246, 0.8)',
            ]
        }]
    };

    const attendanceData = {
        labels: statistics.attendance?.byStatus?.map(s => s._id) || [],
        datasets: [{
            label: 'Attendance Records',
            data: statistics.attendance?.byStatus?.map(s => s.count) || [],
            backgroundColor: [
                'rgba(16, 185, 129, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(245, 158, 11, 0.8)',
            ]
        }]
    };

    const leaveData = {
        labels: statistics.leaves?.byType?.map(l => l._id) || [],
        datasets: [{
            label: 'Leave Days',
            data: statistics.leaves?.byType?.map(l => l.totalDays) || [],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
            ]
        }]
    };

    return (
        <div className="p-6 space-y-6 min-h-screen bg-gray-50">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Total Employees</p>
                            <p className="text-3xl font-bold text-gray-800 mt-2">
                                {statistics.employees?.total || 0}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                {statistics.employees?.active || 0} active
                            </p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full ml-4">
                            <FiUsers className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                    {statistics.subscription && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span className="font-medium">Subscription Usage</span>
                                <span className="font-semibold">{statistics.subscription.employeeUsage || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(statistics.subscription.employeeUsage || 0, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {statistics.employees?.total || 0} / {statistics.subscription.maxEmployees || 0} employees
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Attendance Records</p>
                            <p className="text-3xl font-bold text-gray-800 mt-2">
                                {statistics.attendance?.total || 0}
                            </p>
                            <p className="text-sm text-green-600 mt-1 font-medium">
                                {statistics.attendance?.recent || 0} this week
                            </p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full ml-4">
                            <FiCalendar className="w-8 h-8 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Leave Requests</p>
                            <p className="text-3xl font-bold text-gray-800 mt-2">
                                {statistics.leaves?.total || 0}
                            </p>
                            <p className="text-sm text-yellow-600 mt-1 font-medium">
                                {statistics.leaves?.pending || 0} pending
                            </p>
                        </div>
                        <div className="bg-yellow-100 p-3 rounded-full ml-4">
                            <FiClock className="w-8 h-8 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <p className="text-gray-500 text-sm font-medium">Active Projects</p>
                            <p className="text-3xl font-bold text-gray-800 mt-2">
                                {statistics.projects?.total || 0}
                            </p>
                            {statistics.projects?.completed !== undefined && (
                                <p className="text-sm text-purple-600 mt-1 font-medium">
                                    {statistics.projects.completed || 0} completed
                                </p>
                            )}
                        </div>
                        <div className="bg-purple-100 p-3 rounded-full ml-4">
                            <FiFolder className="w-8 h-8 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Department Distribution */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Employees by Department
                    </h3>
                    {statistics.departments && statistics.departments.length > 0 ? (
                        <Bar
                            data={departmentData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                plugins: {
                                    legend: {
                                        display: false
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <div className="text-center">
                                <FiUsers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No department data available</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Attendance Status */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Attendance Status
                    </h3>
                    {statistics.attendance?.byStatus && statistics.attendance.byStatus.length > 0 ? (
                        <Pie
                            data={attendanceData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: true
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <div className="text-center">
                                <FiCalendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No attendance data available</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Leave Statistics */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Leave Statistics by Type
                </h3>
                {statistics.leaves?.byType && statistics.leaves.byType.length > 0 ? (
                    <Bar
                        data={leaveData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: {
                                    display: false
                                }
                            }
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                        <div className="text-center">
                            <FiClock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No leave data available</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
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

