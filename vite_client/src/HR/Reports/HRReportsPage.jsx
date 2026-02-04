import React, { useState, useEffect } from 'react';
import { FaChartLine, FaDownload, FaFileAlt, FaFileExcel, FaFilePdf } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { exportHRReport } from '../../utils/exportUtils';

const HRReportsPage = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/admin/analytics/hr', { withCredentials: true });
            setAnalytics(response.data?.data);
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading HR reports..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">HR Reports & Analytics</h1>
                        <p className="text-gray-600 mt-1">Generate HR analytics and reports</p>
                    </div>
                    <div className="relative">
                        <button 
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                        >
                            <FaDownload className="w-4 h-4" />
                            Export Report
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                <button
                                    onClick={() => {
                                        exportHRReport(analytics, 'csv', 'hr-report');
                                        setShowExportMenu(false);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <FaFileAlt className="w-4 h-4 text-gray-600" />
                                    Export as CSV
                                </button>
                                <button
                                    onClick={() => {
                                        exportHRReport(analytics, 'excel', 'hr-report');
                                        setShowExportMenu(false);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <FaFileExcel className="w-4 h-4 text-green-600" />
                                    Export as Excel
                                </button>
                                <button
                                    onClick={async () => {
                                        await exportHRReport(analytics, 'pdf', 'hr-report');
                                        setShowExportMenu(false);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                                >
                                    <FaFilePdf className="w-4 h-4 text-red-600" />
                                    Export as PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Employees</p>
                                    <p className="text-2xl font-bold text-gray-800">{analytics.employees?.total || 0}</p>
                                    <p className="text-xs text-gray-500 mt-1">{analytics.employees?.active || 0} active</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <FaChartLine className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">New Hires (30d)</p>
                                    <p className="text-2xl font-bold text-green-600">{analytics.employees?.newHires || 0}</p>
                                    <p className="text-xs text-gray-500 mt-1">This month</p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg">
                                    <FaFileAlt className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Attrition Rate</p>
                                    <p className="text-2xl font-bold text-red-600">{analytics.employees?.attritionRate || 0}%</p>
                                    <p className="text-xs text-gray-500 mt-1">Terminations</p>
                                </div>
                                <div className="bg-red-100 p-3 rounded-lg">
                                    <FaChartLine className="w-6 h-6 text-red-600" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Avg Time to Fill</p>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {analytics.recruitment?.avgTimeToFill ? Math.round(analytics.recruitment.avgTimeToFill) : 0}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Days</p>
                                </div>
                                <div className="bg-purple-100 p-3 rounded-lg">
                                    <FaFileAlt className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Available Reports</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                            <h3 className="font-semibold text-gray-800 mb-2">Employee Report</h3>
                            <p className="text-sm text-gray-600">Comprehensive employee data and statistics</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                            <h3 className="font-semibold text-gray-800 mb-2">Attendance Report</h3>
                            <p className="text-sm text-gray-600">Attendance patterns and statistics</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                            <h3 className="font-semibold text-gray-800 mb-2">Recruitment Report</h3>
                            <p className="text-sm text-gray-600">Hiring metrics and candidate pipeline</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                            <h3 className="font-semibold text-gray-800 mb-2">Performance Report</h3>
                            <p className="text-sm text-gray-600">Employee performance and reviews</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HRReportsPage;

