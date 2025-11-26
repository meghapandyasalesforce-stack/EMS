import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiUsers, FiTrendingUp, FiCalendar, FiDollarSign, FiActivity } from 'react-icons/fi';
import logger from '../../utils/logger';

const OrganizationAnalytics = () => {
    const { user } = useSelector((state) => state.auth || {});
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, 1y

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    const fetchAnalytics = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/analytics`, {
                params: { timeRange }
            });
            if (response.data.success) {
                setAnalytics(response.data.analytics);
            }
        } catch (error) {
            logger.error('Failed to fetch analytics', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const stats = analytics?.stats || {};
    const trends = analytics?.trends || {};

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Organization Analytics</h1>
                        <p className="mt-2 text-gray-600">
                            Insights and metrics for your organization
                        </p>
                    </div>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                    </select>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Employees</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.totalEmployees || 0}
                                </p>
                                <p className="text-sm text-green-600 mt-2 flex items-center">
                                    <FiTrendingUp className="w-4 h-4 mr-1" />
                                    {trends.employeeGrowth || 0}% growth
                                </p>
                            </div>
                            <div className="bg-blue-100 rounded-full p-3">
                                <FiUsers className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Projects</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.activeProjects || 0}
                                </p>
                                <p className="text-sm text-blue-600 mt-2 flex items-center">
                                    <FiActivity className="w-4 h-4 mr-1" />
                                    {stats.completedProjects || 0} completed
                                </p>
                            </div>
                            <div className="bg-green-100 rounded-full p-3">
                                <FiCalendar className="w-8 h-8 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Payroll</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    ${(stats.totalPayroll || 0).toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    This {timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : 'period'}
                                </p>
                            </div>
                            <div className="bg-purple-100 rounded-full p-3">
                                <FiDollarSign className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Attendance Rate</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.attendanceRate || 0}%
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    Average daily attendance
                                </p>
                            </div>
                            <div className="bg-yellow-100 rounded-full p-3">
                                <FiActivity className="w-8 h-8 text-yellow-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Growth</h3>
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <p>Chart visualization would go here</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h3>
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <p>Chart visualization would go here</p>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {analytics?.recentActivity?.length > 0 ? (
                            analytics.recentActivity.map((activity, idx) => (
                                <div key={idx} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="bg-blue-100 rounded-full p-2">
                                        <FiActivity className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                                        <p className="text-xs text-gray-500">{activity.timestamp}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-center py-8">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationAnalytics;

