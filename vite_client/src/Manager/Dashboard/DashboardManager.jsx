import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
    FaUsers, FaTasks, FaChartLine, FaCheckCircle,
    FaProjectDiagram, FaUserCheck, FaExclamationTriangle,
    FaMoneyBill, FaGraduationCap, FaCalendarCheck,
    FaCalendarAlt, FaMoneyBillWave, FaBirthdayCake,
    FaBell, FaClock, FaEdit, FaEye, FaPlus, FaDownload
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import Todo from '../../Employee/Dashboard/Todo';
import AttendanceBox from '../../Employee/Attendance/AttendanceBox';
import NotificationFeed from '../../Employee/Dashboard/NotificationFeed';
import PasswordResetPopup from '../../Employee/PasswordResetPopup';
import ProfilePicture from '../../Shared/ProfilePicture';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { format } from 'date-fns';
import axios from '../../utils/axios';
import { 
  useEmployees, 
  useProjects, 
  useTasks,
  useLeaves,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import { 
    BOTH_ATTENDANCE_ENDPOINT, 
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT 
} from '../../utils/constant';

const DashboardManager = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    
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
    
    // Use React Query hooks for parallel data fetching
    const { 
      data: employees = [], 
      isLoading: employeesLoading,
      error: employeesError 
    } = useEmployees();

    const { 
      data: projects = [], 
      isLoading: projectsLoading 
    } = useProjects();

    const { 
      data: tasks = [], 
      isLoading: tasksLoading 
    } = useTasks();

    const { 
      data: leaves = [], 
      isLoading: leavesLoading 
    } = useLeaves();

    const userId = user?._id || user?.id || '';
    const managerName = user?.name ? `${user.name} ${user.lastName || ''}`.trim() : '';
    const managerFirstName = user?.name || '';

    // Filter team members by manager field (employees linked to this manager)
    const teamMembers = managerName 
      ? employees.filter(emp => {
          const empManager = emp.manager || '';
          return empManager === managerName || 
                 empManager === managerFirstName ||
                 empManager.toLowerCase().startsWith(managerFirstName.toLowerCase());
        })
      : employees;
    
    // Filter projects by manager or team members
    const teamMemberIds = teamMembers.map(emp => emp._id || emp.id);
    const managerProjects = userId
      ? projects.filter(proj => 
          proj.managerId === userId || 
          proj.manager?._id === userId ||
          proj.projectLeader?._id && teamMemberIds.includes(proj.projectLeader._id.toString()) ||
          proj.projectMembers?.some(member => 
            teamMemberIds.includes(member._id?.toString()) || 
            teamMemberIds.includes(member.toString())
          )
        )
      : projects;
    
    // Filter tasks by team members (employees linked to manager)
    const teamTasks = tasks.filter(task => 
        teamMemberIds.includes(task.employee?._id?.toString()) ||
        teamMemberIds.includes(task.employee?.toString()) ||
        teamMemberIds.includes(task.assignedTo?._id?.toString()) ||
        teamMemberIds.includes(task.assignedTo?.toString()) ||
        teamMemberIds.includes(task.employeeId?.toString())
    );

    // Get attendance summary for team
    const { 
      data: attendanceData = {}, 
      isLoading: attendanceLoading 
    } = useAttendanceSummary({
      employeeIds: teamMemberIds.join(','),
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    const isLoading = employeesLoading || projectsLoading || tasksLoading || leavesLoading || attendanceLoading;

    // Calculate statistics
    const teamSize = teamMembers.length;
    const activeProjects = managerProjects.filter(proj => proj.status === 'active').length;
    const pendingTasks = teamTasks.filter(task => 
        task.status === 'Not Started' || task.status === 'In Progress' || task.status === 'pending'
    ).length;
    const completedTasks = teamTasks.filter(task => task.status === 'Completed' || task.status === 'completed').length;
    const teamAttendance = Math.round(attendanceData?.attendanceRate || 0);
    
    // Filter leaves by team members
    const teamPendingLeaves = leaves.filter(leave => 
        teamMemberIds.includes(leave.employeeId?._id) ||
        teamMemberIds.includes(leave.employeeId)
    );
    const pendingApprovals = teamPendingLeaves.length;

    // Fetch employee own info
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
            } catch (error) {
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
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
                    // Silently handle error
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
                    // Silently handle error
                }

                // Fetch tasks count
                let tasksCount = 0;
                try {
                    const tasksRes = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, {
                        withCredentials: true
                    });
                    tasksCount = tasksRes.data?.tasks?.length || 0;
                } catch (err) {
                    // Silently handle error
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
                    // Silently handle error
                }

                // Calculate today's hours
                const todaySession = todayLogs.data?.sessions?.[0];
                let todayHours = '0h';
                if (todaySession && todaySession.clockOut) {
                    const hoursWorked = todaySession.effectiveHours || 0;
                    todayHours = `${hoursWorked.toFixed(1)}h`;
                } else if (todaySession && todaySession.clockIn && !todaySession.clockOut) {
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

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'Manager Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
    }, [employeesError]);

    const handleEditProfile = () => navigate('/profile-details');
    
    if (user?.mustResetPassword) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (loading || isLoading) {
        return <LoadingSpinner message="Loading Manager Dashboard..." />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300 flex items-center justify-center">
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
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300 flex items-center justify-center">
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
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
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
                                    Welcome back, {user?.name || user?.username || 'Manager'}!
                                </h1>
                                <p className="text-sm text-gray-600">{user?.jobTitle || user?.position || 'Manager'}</p>
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
            
            {/* Statistics Cards - Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Active Projects"
                    value={activeProjects}
                    subtitle="In progress"
                    icon={<FaProjectDiagram className="w-8 h-8" />}
                    color="blue"
                />
                
                <StatCard
                    label="Pending Tasks"
                    value={pendingTasks}
                    subtitle={`${completedTasks} completed`}
                    icon={<FaTasks className="w-8 h-8" />}
                    color="green"
                />
                
                <StatCard
                    label="Pending Approvals"
                    value={pendingApprovals}
                    subtitle="Requires action"
                    icon={<FaCheckCircle className="w-8 h-8" />}
                    color="yellow"
                    className="border-purple-500 border-2 relative"
                    onClick={() => navigate('/leave-management')}
                />
            </div>
            
            {/* Quick Actions - Middle Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/employees')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-lg flex-shrink-0">
                            <FaUsers className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Team Members</h3>
                            <p className="text-sm text-gray-600">Manage your team</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/leave-management')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-100 p-4 rounded-lg flex-shrink-0">
                            <FaCheckCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Approvals</h3>
                            <p className="text-sm text-gray-600">Review leave and expense requests</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/attendance-regularization')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-4 rounded-lg flex-shrink-0">
                            <FaClock className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Attendance Regularization</h3>
                            <p className="text-sm text-gray-600">Review team attendance requests</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/admin/reports')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-4 rounded-lg flex-shrink-0">
                            <FaChartLine className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Team Reports</h3>
                            <p className="text-sm text-gray-600">View team performance reports</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Quick Actions - Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/admin-payroll')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-4 rounded-lg flex-shrink-0">
                            <FaMoneyBill className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Team Payroll</h3>
                            <p className="text-sm text-gray-600">View team payroll information</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/one-on-one')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-4 rounded-lg flex-shrink-0">
                            <FaUserCheck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">One-on-Ones</h3>
                            <p className="text-sm text-gray-600">Schedule and manage 1-on-1 meetings</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/team-learning')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-4 rounded-lg flex-shrink-0">
                            <FaGraduationCap className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Team Learning</h3>
                            <p className="text-sm text-gray-600">Share learning resources with your team</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                    onClick={() => navigate('/team-learning')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-lg flex-shrink-0">
                            <FaGraduationCap className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Team Learning</h3>
                            <p className="text-sm text-gray-600">View team training progress</p>
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

                                    <button 
                                        onClick={() => navigate('/leave-management')}
                                        className="w-full bg-yellow-500 text-white py-2 rounded-lg font-medium hover:bg-yellow-600 transition flex items-center justify-center gap-2 text-sm"
                                    >
                                        <FaCalendarAlt className="w-4 h-4" />
                                        Manage Team Leaves
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
};

export default DashboardManager;
