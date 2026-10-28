import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
    FaUsers, FaChartLine, FaDollarSign, FaCalendarAlt, 
    FaGraduationCap, FaHandshake, FaHeadset, FaProjectDiagram,
    FaArrowUp, FaArrowDown, FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
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

const HRAnalyticsPage = () => {
    const [startDate, setStartDate] = useState(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['hr-analytics', startDate, endDate],
        queryFn: async () => {
            const response = await axios.get('/v1/admin/analytics/hr', {
                params: { startDate, endDate },
                withCredentials: true
            });
            return response.data?.data || {};
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    if (isLoading) {
        return <LoadingSpinner message="Loading HR analytics..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-transparent p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">Failed to load analytics data. Please try again later.</p>
                </div>
            </div>
        );
    }

    const formatCurrency = (amount) => {
        if (!amount || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Prepare chart data
    const employeeStats = analytics?.employees || {};
    const attendanceStats = analytics?.attendance || {};
    const leaveStats = analytics?.leave || {};
    const recruitmentStats = analytics?.recruitment || {};
    const learningStats = analytics?.learning || {};
    const engagementStats = analytics?.engagement || {};
    const helpdeskStats = analytics?.helpdesk || {};
    const performanceStats = analytics?.performance || {};
    const departmentDistribution = analytics?.departmentDistribution || [];

    // Employee Growth Chart
    const employeeGrowthData = {
        labels: ['Total', 'Active', 'New Hires', 'Terminations'],
        datasets: [{
            label: 'Employee Statistics',
            data: [
                employeeStats.total || 0,
                employeeStats.active || 0,
                employeeStats.newHires || 0,
                employeeStats.terminations || 0
            ],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ],
            borderColor: [
                'rgb(59, 130, 246)',
                'rgb(34, 197, 94)',
                'rgb(251, 191, 36)',
                'rgb(239, 68, 68)'
            ],
            borderWidth: 2
        }]
    };

    // Department Distribution
    const departmentData = {
        labels: departmentDistribution.map(dept => dept._id || 'Unknown'),
        datasets: [{
            label: 'Employees by Department',
            data: departmentDistribution.map(dept => dept.count || 0),
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(147, 51, 234, 0.8)',
                'rgba(236, 72, 153, 0.8)'
            ],
            borderWidth: 2
        }]
    };

    // Leave Status Distribution
    const leaveStatusData = {
        labels: leaveStats.byStatus?.map(item => item._id) || [],
        datasets: [{
            label: 'Leave Requests',
            data: leaveStats.byStatus?.map(item => item.count) || [],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)',
                'rgba(156, 163, 175, 0.8)'
            ],
            borderWidth: 2
        }]
    };

    // Helpdesk Status
    const helpdeskStatusData = {
        labels: helpdeskStats.byStatus?.map(item => item._id) || [],
        datasets: [{
            label: 'Tickets',
            data: helpdeskStats.byStatus?.map(item => item.count) || [],
            backgroundColor: [
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(251, 191, 36, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ],
            borderWidth: 2
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

    // Calculate attrition rate
    const avgEmployees = ((employeeStats.total || 0) + (employeeStats.active || 0)) / 2;
    const attritionRate = avgEmployees > 0 
        ? (((employeeStats.terminations || 0) / avgEmployees) * 100).toFixed(2)
        : 0;

    return (
        <div className="page-shell min-h-screen bg-transparent">
            <div className="page-shell-inner hrms-stack">
                {/* Header */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">HR Analytics Dashboard</h1>
                            <p className="text-gray-600 mt-1">Comprehensive insights into your HR metrics</p>
                        </div>
                        <div className="flex gap-4">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-theme-secondary">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Total Employees</p>
                                <p className="text-3xl font-bold text-gray-900">{employeeStats.total || 0}</p>
                                <p className="text-sm text-gray-500 mt-1">{employeeStats.active || 0} active</p>
                            </div>
                            <div className="bg-theme-secondary/10 p-4 rounded-full">
                                <FaUsers className="w-8 h-8 text-theme-secondary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-theme-primary">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Attendance Rate</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {attendanceStats.rate || 0}%
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {attendanceStats.totalHours || 0} total hours
                                </p>
                            </div>
                            <div className="bg-theme-primary/10 p-4 rounded-full">
                                <FaCalendarAlt className="w-8 h-8 text-theme-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Attrition Rate</p>
                                <p className="text-3xl font-bold text-gray-900">{attritionRate}%</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {employeeStats.terminations || 0} terminations
                                </p>
                            </div>
                            <div className="bg-purple-100 p-4 rounded-full">
                                <FaChartLine className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Time to Hire</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {recruitmentStats.avgTimeToHire ? Math.round(recruitmentStats.avgTimeToHire) : 0} days
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {recruitmentStats.totalCandidates || 0} candidates
                                </p>
                            </div>
                            <div className="bg-yellow-100 p-4 rounded-full">
                                <FaHandshake className="w-8 h-8 text-yellow-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Employee Statistics */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Statistics</h3>
                        <div className="h-64">
                            <Bar data={employeeGrowthData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Department Distribution */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
                        <div className="h-64">
                            <Doughnut data={departmentData} options={doughnutOptions} />
                        </div>
                    </div>

                    {/* Leave Status */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Request Status</h3>
                        <div className="h-64">
                            <Pie data={leaveStatusData} options={doughnutOptions} />
                        </div>
                    </div>

                    {/* Helpdesk Status */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Helpdesk Ticket Status</h3>
                        <div className="h-64">
                            <Doughnut data={helpdeskStatusData} options={doughnutOptions} />
                        </div>
                    </div>
                </div>

                {/* Detailed Statistics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Recruitment Metrics */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FaHandshake className="w-5 h-5 text-theme-secondary" />
                            Recruitment Metrics
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-theme-secondary/10 rounded-lg">
                                <span className="text-gray-700">Total Postings</span>
                                <span className="font-bold text-theme-secondary">{recruitmentStats.totalPostings || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-theme-primary/10 rounded-lg">
                                <span className="text-gray-700">Open Postings</span>
                                <span className="font-bold text-theme-primary">{recruitmentStats.openPostings || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                <span className="text-gray-700">Total Candidates</span>
                                <span className="font-bold text-purple-600">{recruitmentStats.totalCandidates || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                                <span className="text-gray-700">Offer Acceptance</span>
                                <span className="font-bold text-yellow-600">
                                    {recruitmentStats.offerAcceptanceRate || 0}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Learning & Development */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FaGraduationCap className="w-5 h-5 text-theme-primary" />
                            Learning Metrics
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-theme-primary/10 rounded-lg">
                                <span className="text-gray-700">Total Courses</span>
                                <span className="font-bold text-theme-primary">{learningStats.totalCourses || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-theme-secondary/10 rounded-lg">
                                <span className="text-gray-700">Total Enrollments</span>
                                <span className="font-bold text-theme-secondary">{learningStats.totalEnrollments || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                <span className="text-gray-700">Completion Rate</span>
                                <span className="font-bold text-purple-600">
                                    {learningStats.completionRate || 0}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                                <span className="text-gray-700">Certificates Issued</span>
                                <span className="font-bold text-yellow-600">{learningStats.certificatesIssued || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Performance & Engagement */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FaChartLine className="w-5 h-5 text-purple-600" />
                            Performance & Engagement
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                <span className="text-gray-700">Avg Performance</span>
                                <span className="font-bold text-purple-600">
                                    {performanceStats.avgRating ? performanceStats.avgRating.toFixed(1) : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-theme-secondary/10 rounded-lg">
                                <span className="text-gray-700">Survey Responses</span>
                                <span className="font-bold text-theme-secondary">{engagementStats.totalResponses || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-theme-primary/10 rounded-lg">
                                <span className="text-gray-700">Helpdesk Tickets</span>
                                <span className="font-bold text-theme-primary">{helpdeskStats.total || 0}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                                <span className="text-gray-700">Resolved Tickets</span>
                                <span className="font-bold text-yellow-600">{helpdeskStats.resolved || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HRAnalyticsPage;

