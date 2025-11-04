import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaCalendarAlt, 
  FaMoneyBillWave, 
  FaBirthdayCake, 
  FaTasks, 
  FaBell,
  FaClock,
  FaEdit,
  FaEye,
  FaPlus,
  FaDownload
} from 'react-icons/fa';
import Todo from './Todo';
import AttendanceBox from '../Attendance/AttendanceBox';
import NotificationFeed from './NotificationFeed';
import PasswordResetPopup from '../PasswordResetPopup';
import ProfilePicture from '../../Shared/ProfilePicture';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { format } from 'date-fns';
import axios from 'axios';

import { 
    BOTH_ATTENDANCE_ENDPOINT, 
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT 
} from '../../utils/constant';

const BOTH_PAYROLL_ENDPOINT = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/employee/payroll`;

function DashboardEmployee() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResetPopup, setShowResetPopup] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [dashboardStats, setDashboardStats] = useState({
        todayHours: '0h',
        thisMonth: '₹0',
        leaveBalance: '0 days',
        tasksCount: '0',
        currentMonthSalary: '₹0',
        leaveDaysRemaining: '0',
        birthdays: null
    });
    const [statsLoading, setStatsLoading] = useState(true);

    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const dispatch = useDispatch();

    const handleEditProfile = () => navigate('/profile-details');

    useEffect(() => {
        const fetchData = async () => {
            if (hasFetched) {
                return;
            }
            
            try {
                setLoading(true);
                setHasFetched(true);
                const result = await dispatch(fetchEmployeeOwnInfo());
                if (fetchEmployeeOwnInfo.rejected.match(result)) {
                    setError(result.payload || 'Failed to load employee information');
                }
            } catch {
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [dispatch, hasFetched]);

    // Fetch dashboard statistics
    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                setStatsLoading(true);
                const today = format(new Date(), 'yyyy-MM-dd');
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                // Fetch today's attendance
                const todayLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: today, endDate: today },
                    withCredentials: true
                });

                // Fetch this month's attendance for hours calculation
                const firstDayOfMonth = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');
                const lastDayOfMonth = format(new Date(currentYear, currentMonth, 0), 'yyyy-MM-dd');
                
                const monthLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: firstDayOfMonth, endDate: lastDayOfMonth },
                    withCredentials: true
                });

                // Fetch current month payroll
                let payrollAmount = 0;
                try {
                    const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
                    const payrollRes = await axios.get(`${BASE_URL}/employee/payroll/current`, {
                        withCredentials: true
                    });
                    if (payrollRes.data?.inHandSalary) {
                        payrollAmount = payrollRes.data.inHandSalary;
                    }
                } catch (err) {
                    console.log('No payroll data for current month');
                }

                // Fetch leave balance from Leave data
                let leaveBalance = 0;
                try {
                    const leaveRes = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
                        withCredentials: true
                    });
                    if (leaveRes.data?.statistics?.remainingLeaves !== undefined) {
                        leaveBalance = leaveRes.data.statistics.remainingLeaves;
                    }
                } catch (err) {
                    console.log('No leave data available');
                }

                // Fetch tasks count
                let tasksCount = 0;
                try {
                    const tasksRes = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, {
                        withCredentials: true
                    });
                    tasksCount = tasksRes.data?.tasks?.length || 0;
                } catch (err) {
                    console.log('No tasks data');
                }

                // Fetch upcoming birthdays
                let birthdays = [];
                try {
                    const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
                    const birthdaysRes = await axios.get(`${BASE_URL}/both/profile-details/upcoming-birthdays`, {
                        withCredentials: true
                    });
                    if (birthdaysRes.data?.birthdays) {
                        birthdays = birthdaysRes.data.birthdays;
                    }
                } catch (err) {
                    console.log('No birthdays data available');
                }

                // Calculate today's hours
                const todaySession = todayLogs.data?.sessions?.[0];
                let todayHours = '0h';
                if (todaySession && todaySession.clockOut) {
                    const hoursWorked = todaySession.effectiveHours || 0;
                    todayHours = `${hoursWorked.toFixed(1)}h`;
                } else if (todaySession && todaySession.clockIn && !todaySession.clockOut) {
                    // User is currently checked in but not yet out
                    todayHours = 'In Progress';
                } else {
                    todayHours = '0h';
                }

                // Calculate month's total hours
                const monthHours = monthLogs.data?.summary?.totalEffectiveHours || 0;

                // Update state
                setDashboardStats({
                    todayHours,
                    thisMonth: `₹${payrollAmount.toLocaleString('en-IN')}`,
                    leaveBalance: `${leaveBalance} days`,
                    tasksCount: tasksCount.toString(),
                    currentMonthSalary: `₹${payrollAmount.toLocaleString('en-IN')}`,
                    leaveDaysRemaining: leaveBalance.toString(),
                    birthdays: birthdays
                });
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error);
                // Keep default values
            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);


    useEffect(() => {
        if (user?.mustResetPassword) {
            setShowResetPopup(true);
        }
    }, [user]);


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-5 ml-64 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-5 ml-64 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 font-medium mb-4">Error: {error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 p-5 ml-64 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 font-medium mb-4">Please log in to access the dashboard</p>
                    <button 
                        onClick={() => navigate('/login')} 
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-5 ml-64 transition-all duration-300">
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}
            
            {/* Welcome Header */}
            <div className="mb-6">
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <ProfilePicture 
                                user={user} 
                                size="lg"
                            />
                            <div>
                                <h1 className="text-xl font-semibold text-gray-800 mb-1">
                                    Welcome back, {user?.name || 'User'}!
                                </h1>
                                <p className="text-sm text-gray-600">{user?.jobTitle || 'Employee'}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button 
                                onClick={handleEditProfile}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2 text-sm font-medium"
                            >
                                <FaEdit className="w-4 h-4" />
                                Edit
                            </button>
                            <Link to="/view-profile">
                                <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm font-medium">
                                    <FaEye className="w-4 h-4" />
                                    View
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">Today's Hours</p>
                            <p className="text-xl font-semibold text-blue-600">{statsLoading ? '...' : dashboardStats.todayHours}</p>
                        </div>
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <FaClock className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                            </div>
                
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">This Month</p>
                            <p className="text-xl font-semibold text-green-600">{statsLoading ? '...' : dashboardStats.thisMonth}</p>
                        </div>
                        <div className="bg-green-100 p-2 rounded-lg">
                            <FaMoneyBillWave className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">Leave Balance</p>
                            <p className="text-xl font-semibold text-purple-600">{statsLoading ? '...' : dashboardStats.leaveBalance}</p>
                        </div>
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <FaCalendarAlt className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">Tasks</p>
                            <p className="text-xl font-semibold text-orange-600">{statsLoading ? '...' : dashboardStats.tasksCount}</p>
                        </div>
                        <div className="bg-orange-100 p-2 rounded-lg">
                            <FaTasks className="w-5 h-5 text-orange-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Section */}
            <div className="mb-8">
                <AttendanceBox/>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Notifications */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-blue-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaBell className="w-4 h-4" />
                                Announcements
                            </h3>
                        </div>
                        <div className="p-0">
                            <NotificationFeed/>
                        </div>
                    </div>

                    {/* Tasks */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-orange-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaTasks className="w-4 h-4" />
                                My Tasks
                            </h3>
                        </div>
                        <div className="p-6">
                    <Todo/>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Payroll Card */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-green-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaMoneyBillWave className="w-4 h-4" />
                                Payroll
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-600">Current Month</span>
                                        <span className="text-lg font-bold text-green-700">{statsLoading ? '...' : dashboardStats.currentMonthSalary}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">Net Salary</div>
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span>View detailed breakdown</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span>Download payslips</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span>Track payment history</span>
                                    </div>
                                </div>
                                
                                <Link to="/employee-payroll" className="block">
                                    <button className="w-full bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2 text-sm">
                                        <FaDownload className="w-4 h-4" />
                                        View All Payslips
                        </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                    
                    {/* Leave Management */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-purple-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaCalendarAlt className="w-4 h-4" />
                                Leave Management
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-700 mb-1">{statsLoading ? '...' : dashboardStats.leaveDaysRemaining}</div>
                                        <div className="text-sm text-gray-600">Days Remaining</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                        <button 
                            onClick={() => navigate('/leave')}
                                        className="w-full bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2 text-sm"
                        >
                                        <FaPlus className="w-4 h-4" />
                            Apply for Leave
                        </button>
                                    
                                    <button 
                                        onClick={() => navigate('/my-leave')}
                                        className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm"
                                    >
                                        <FaEye className="w-4 h-4" />
                                        View My Leaves
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Birthdays */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-pink-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaBirthdayCake className="w-4 h-4" />
                                Upcoming Birthdays
                            </h3>
                        </div>
                        <div className="p-6">
                            {dashboardStats.birthdays ? (
                                dashboardStats.birthdays.length > 0 ? (
                                    <div className="space-y-3">
                                        {dashboardStats.birthdays.map((item, idx) => (
                                            <div key={idx} className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200 hover:shadow-md transition-all duration-200">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-medium text-gray-800">{item.name}</div>
                                                        <div className="text-sm text-gray-600">{item.birthday}</div>
                                                    </div>
                                                    <button className="bg-pink-500 text-white px-3 py-1 rounded-lg hover:bg-pink-600 transition text-sm font-medium">
                                                        Send Wishes
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-500">
                                        No upcoming birthdays
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardEmployee;