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
  FaDownload,
  FaUserTie,
  FaGraduationCap,
  FaFolderOpen,
  FaGift,
  FaHandshake,
  FaHeadset,
  FaChartBar,
  FaProjectDiagram,
  FaChartLine,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight
} from 'react-icons/fa';
import Todo from './Todo';
import AttendanceBox from '../Attendance/AttendanceBox';
import NotificationFeed from './NotificationFeed';
import PasswordResetPopup from '../PasswordResetPopup';
import ProfilePicture from '../../Shared/ProfilePicture';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { format } from 'date-fns';
import axios from '../../utils/axios';

import { 
    BOTH_ATTENDANCE_ENDPOINT, 
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT 
} from '../../utils/constant';

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
        birthdays: null,
        projects: [],
        monthHours: 0,
        attendanceRate: 0
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
            
            // SECURITY FIX: Tokens are in httpOnly cookies, not localStorage
            // Note: httpOnly cookies are sent automatically with requests
            // We proceed with the request and let the server validate authentication
            // If authentication fails, the server will return 401 and axios interceptor will handle it
            
            try {
                setLoading(true);
                setHasFetched(true);
                const result = await dispatch(fetchEmployeeOwnInfo());
                if (fetchEmployeeOwnInfo.rejected.match(result)) {
                    setError(result.payload || 'Failed to load employee information');
                }
            } catch (error) {
                // Handle errors gracefully
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    // Authentication failed - redirect to login
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    setError('An unexpected error occurred');
                }
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
                    const payrollRes = await axios.get('/v1/employee/payroll/current', {
                        withCredentials: true
                    });
                    if (payrollRes.data?.inHandSalary) {
                        payrollAmount = payrollRes.data.inHandSalary;
                    }
                } catch (err) {
                    // Removed console.log for production
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
                    // Removed console.log for production
                }

                // Fetch tasks count
                let tasksCount = 0;
                try {
                    const tasksRes = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, {
                        withCredentials: true
                    });
                    tasksCount = tasksRes.data?.tasks?.length || 0;
                } catch (err) {
                    // Removed console.log for production
                }

                // Fetch upcoming birthdays
                let birthdays = [];
                try {
                    const birthdaysRes = await axios.get('/v1/both/profile-details/upcoming-birthdays', {
                        withCredentials: true
                    });
                    if (birthdaysRes.data?.birthdays) {
                        birthdays = birthdaysRes.data.birthdays;
                    }
                } catch (err) {
                    // Removed console.log for production
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
                
                // Calculate attendance rate (assuming 8 hours per day, ~22 working days per month)
                const expectedHours = 22 * 8; // 176 hours per month
                const attendanceRate = expectedHours > 0 ? Math.round((monthHours / expectedHours) * 100) : 0;

                // Fetch employee projects
                let projects = [];
                try {
                    const projectsRes = await axios.get(`${BOTH_TASK_ENDPOINT}/get-my-projects`, {
                        withCredentials: true
                    });
                    if (projectsRes.data?.projects) {
                        projects = projectsRes.data.projects.slice(0, 5); // Get latest 5 projects
                    } else if (Array.isArray(projectsRes.data)) {
                        projects = projectsRes.data.slice(0, 5); // Handle array response
                    }
                } catch (err) {
                    // Removed console.log for production
                }

                // Update state
                setDashboardStats({
                    todayHours,
                    thisMonth: `₹${payrollAmount.toLocaleString('en-IN')}`,
                    leaveBalance: `${leaveBalance} days`,
                    tasksCount: tasksCount.toString(),
                    currentMonthSalary: `₹${payrollAmount.toLocaleString('en-IN')}`,
                    leaveDaysRemaining: leaveBalance.toString(),
                    birthdays: birthdays,
                    projects: projects,
                    monthHours: monthHours,
                    attendanceRate: attendanceRate
                });
            } catch (error) {
                // Removed console.error for production
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


    if (user?.mustResetPassword) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300 flex items-center justify-center">
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
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300 flex items-center justify-center">
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
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
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
                <div className="lg:col-span-2 space-y-6 min-h-[400px]">
                    {/* Attendance Summary */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-indigo-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaChartLine className="w-4 h-4" />
                                Attendance Summary
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">This Month</span>
                                        <FaClock className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="text-2xl font-bold text-indigo-700">
                                        {statsLoading ? '...' : `${dashboardStats.monthHours.toFixed(1)}h`}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Total Hours</div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Attendance Rate</span>
                                        <FaCheckCircle className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div className="text-2xl font-bold text-green-700">
                                        {statsLoading ? '...' : `${dashboardStats.attendanceRate}%`}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">This Month</div>
                                </div>
                                
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Today</span>
                                        <FaClock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {statsLoading ? '...' : dashboardStats.todayHours}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">Hours Worked</div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <Link to="/attendance-stats" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                    View Detailed Stats <FaArrowRight className="w-3 h-3 ml-2" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* My Projects */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-purple-500 p-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <FaProjectDiagram className="w-4 h-4" />
                                    My Projects
                                </h3>
                                <Link to="/employee/projects">
                                    <button className="text-white text-sm hover:underline flex items-center gap-1">
                                        View All <FaArrowRight className="w-3 h-3" />
                                    </button>
                                </Link>
                            </div>
                        </div>
                        <div className="p-6">
                            {statsLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                                </div>
                            ) : dashboardStats.projects && dashboardStats.projects.length > 0 ? (
                                <div className="space-y-3">
                                    {dashboardStats.projects.map((project) => (
                                        <div 
                                            key={project._id} 
                                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
                                            onClick={() => navigate(`/employee/projects/${project._id}`)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-800 mb-1">{project.name}</h4>
                                                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                                        {project.description || 'No description available'}
                                                    </p>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <span className={`px-2 py-1 rounded-full ${
                                                            project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            project.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                                                            project.status === 'on-hold' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {project.status?.replace('-', ' ') || 'pending'}
                                                        </span>
                                                        {project.priority && (
                                                            <span className={`px-2 py-1 rounded-full ${
                                                                project.priority === 'high' || project.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                                                project.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {project.priority}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <FaArrowRight className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FaProjectDiagram className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 mb-4">No projects assigned</p>
                                    <Link to="/employee/projects">
                                        <button className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition text-sm font-medium">
                                            View All Projects
                                        </button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-blue-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaBell className="w-4 h-4" />
                                Announcements
                            </h3>
                        </div>
                        <div className="p-4 min-h-[200px]">
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
                        <div className="p-6 min-h-[200px]">
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

                    {/* Manager Features Section */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-indigo-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaUserTie className="w-4 h-4" />
                                Manager Resources
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <button 
                                    onClick={() => navigate('/one-on-one')}
                                    className="w-full bg-indigo-500 text-white py-2 rounded-lg font-medium hover:bg-indigo-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaUserTie className="w-4 h-4" />
                                    One-on-One Meetings
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/team-learning')}
                                    className="w-full bg-purple-500 text-white py-2 rounded-lg font-medium hover:bg-purple-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaGraduationCap className="w-4 h-4" />
                                    Team Learning
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/my-attendance-regularization')}
                                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaClock className="w-4 h-4" />
                                    Attendance Regularization
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* HR Features Section */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                        <div className="bg-teal-500 p-3">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FaHandshake className="w-4 h-4" />
                                HR Resources
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <button 
                                    onClick={() => navigate('/benefits')}
                                    className="w-full bg-teal-500 text-white py-2 rounded-lg font-medium hover:bg-teal-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaGift className="w-4 h-4" />
                                    My Benefits
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/documents')}
                                    className="w-full bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaFolderOpen className="w-4 h-4" />
                                    My Documents
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/onboarding')}
                                    className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaHandshake className="w-4 h-4" />
                                    Onboarding Status
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/learning')}
                                    className="w-full bg-purple-500 text-white py-2 rounded-lg font-medium hover:bg-purple-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaGraduationCap className="w-4 h-4" />
                                    Learning & Development
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/engagement')}
                                    className="w-full bg-pink-500 text-white py-2 rounded-lg font-medium hover:bg-pink-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaChartBar className="w-4 h-4" />
                                    Employee Engagement
                                </button>
                                
                                <button 
                                    onClick={() => navigate('/helpdesk')}
                                    className="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600 transition flex items-center justify-center gap-2 text-sm"
                                >
                                    <FaHeadset className="w-4 h-4" />
                                    Helpdesk
                                </button>
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