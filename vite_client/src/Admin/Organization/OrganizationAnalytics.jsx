import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT } from '../../utils/constant';
import { FiUsers, FiTrendingUp, FiCalendar, FiDollarSign, FiActivity } from 'react-icons/fi';
import logger from '../../utils/logger';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

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
            if (response.data.success && response.data.analytics) {
                setAnalytics(response.data.analytics);
            } else {
                setAnalytics(null);
                toast.error(response.data?.message || 'Could not load organization analytics.');
            }
        } catch (error) {
            logger.error('Failed to fetch analytics', { error: error.message });
            setAnalytics(null);
            toast.error(
                error.response?.data?.message || error.message || 'Failed to load organization analytics.'
            );
        } finally {
            setLoading(false);
        }
    };

    const formatInr = (n) => {
        const v = Number(n) || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(v);
    };

    if (loading) {
        return <LoadingSpinner message="Loading analytics..." />;
    }

    const stats = analytics?.stats || {};
    const trends = analytics?.trends || {};

    // Prepare chart data
    const employeeGrowthData = {
        labels: trends.employeeGrowthData?.map(item => item.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Employee Count',
            data: trends.employeeGrowthData?.map(item => item.count) || [0, 0, 0, 0, 0, 0],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }]
    };

    const projectStatusData = {
        labels: ['Active', 'Completed', 'On Hold', 'Cancelled'],
        datasets: [{
            label: 'Projects',
            data: [
                stats.activeProjects || 0,
                stats.completedProjects || 0,
                stats.onHoldProjects || 0,
                stats.cancelledProjects || 0
            ],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ],
            borderColor: [
                'rgb(34, 197, 94)',
                'rgb(59, 130, 246)',
                'rgb(251, 191, 36)',
                'rgb(239, 68, 68)'
            ],
            borderWidth: 2
        }]
    };

    const payrollTrendData = {
        labels: trends.payrollTrendData?.map(item => item.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Payroll (₹)',
            data: trends.payrollTrendData?.map(item => item.amount) || [0, 0, 0, 0, 0, 0],
            backgroundColor: 'rgba(147, 51, 234, 0.2)',
            borderColor: 'rgb(147, 51, 234)',
            borderWidth: 2,
            fill: true
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Organization Analytics</h1>
                        <p className="mt-2 text-gray-600">
                            Insights and metrics for your organization
                        </p>
                    </div>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                    </select>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Employees</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {stats.totalEmployees || 0}
                                </p>
                                <p className="text-sm text-theme-primary mt-2 flex items-center">
                                    <FiTrendingUp className="w-4 h-4 mr-1" />
                                    {trends.employeeGrowth || 0}% growth
                                </p>
                            </div>
                            <div className="bg-theme-secondary/10 rounded-full p-3">
                                <FiUsers className="w-8 h-8 text-theme-secondary" />
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
                                <p className="text-sm text-theme-secondary mt-2 flex items-center">
                                    <FiActivity className="w-4 h-4 mr-1" />
                                    {stats.completedProjects || 0} completed
                                </p>
                            </div>
                            <div className="bg-theme-primary/10 rounded-full p-3">
                                <FiCalendar className="w-8 h-8 text-theme-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Payroll</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {formatInr(stats.totalPayroll || 0)}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Growth Trend</h3>
                        <div className="h-64">
                            <Line data={employeeGrowthData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
                        <div className="h-64">
                            <Doughnut data={projectStatusData} options={doughnutOptions} />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Trend</h3>
                        <div className="h-64">
                            <Bar data={payrollTrendData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Overview</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-theme-primary/10 rounded-lg">
                                <span className="text-gray-700">Average Attendance Rate</span>
                                <span className="text-2xl font-bold text-theme-primary">{stats.attendanceRate || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-theme-secondary/10 rounded-lg">
                                <span className="text-gray-700">Total Hours Logged</span>
                                <span className="text-xl font-semibold text-theme-secondary">
                                    {stats.totalHours || 0} hrs
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                                <span className="text-gray-700">Average Hours/Day</span>
                                <span className="text-xl font-semibold text-purple-600">
                                    {stats.avgHoursPerDay || 0} hrs
                                </span>
                            </div>
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
                                    <div className="bg-theme-secondary/10 rounded-full p-2">
                                        <FiActivity className="w-5 h-5 text-theme-secondary" />
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
            </div>
        </div>
    );
};

export default OrganizationAnalytics;

