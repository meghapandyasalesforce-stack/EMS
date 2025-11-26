import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaUsers, FaTasks, FaChartLine, FaCheckCircle,
    FaProjectDiagram, FaUserCheck, FaExclamationTriangle
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useProjects, 
  useTasks,
  useLeaves,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const DashboardManager = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    
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

    const userDepartment = user?.department || '';
    const userId = user?._id || user?.id || '';

    // Filter team members by department
    const teamMembers = userDepartment 
      ? employees.filter(emp => 
          emp.department?.toLowerCase() === userDepartment.toLowerCase()
        )
      : employees;
    
    // Filter projects by manager or department
    const managerProjects = userId
      ? projects.filter(proj => 
          proj.managerId === userId || 
          proj.manager?._id === userId ||
          proj.department?.toLowerCase() === userDepartment.toLowerCase()
        )
      : projects;
    
    // Filter tasks by team members
    const teamMemberIds = teamMembers.map(emp => emp._id || emp.id);
    const teamTasks = tasks.filter(task => 
        teamMemberIds.includes(task.assignedTo?._id) ||
        teamMemberIds.includes(task.assignedTo) ||
        teamMemberIds.includes(task.employeeId)
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
    const pendingTasks = teamTasks.filter(task => task.status === 'pending').length;
    const completedTasks = teamTasks.filter(task => task.status === 'completed').length;
    const teamAttendance = Math.round(attendanceData?.attendanceRate || 0);
    
    // Filter leaves by team members
    const teamPendingLeaves = leaves.filter(leave => 
        teamMemberIds.includes(leave.employeeId?._id) ||
        teamMemberIds.includes(leave.employeeId)
    );
    const pendingApprovals = teamPendingLeaves.length;

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'Manager Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
    }, [employeesError]);
    
    if (isLoading) {
        return <LoadingSpinner message="Loading Manager Dashboard..." />;
    }
    
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Manager Dashboard</h1>
                <div className="text-sm text-gray-600">
                    Welcome, {user?.name || user?.username || 'Manager'}
                </div>
            </div>
            
            {/* Statistics Cards - Using StatCard component */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Team Size"
                    value={teamSize}
                    subtitle="Team members"
                    icon={<FaUsers className="w-8 h-8" />}
                    color="blue"
                />
                
                <StatCard
                    label="Active Projects"
                    value={activeProjects}
                    subtitle="In progress"
                    icon={<FaProjectDiagram className="w-8 h-8" />}
                    color="green"
                />
                
                <StatCard
                    label="Pending Tasks"
                    value={pendingTasks}
                    subtitle={`${completedTasks} completed`}
                    icon={<FaTasks className="w-8 h-8" />}
                    color="yellow"
                />
                
                <StatCard
                    label="Pending Approvals"
                    value={pendingApprovals}
                    subtitle="Requires action"
                    icon={<FaCheckCircle className="w-8 h-8" />}
                    color="purple"
                />
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/projects')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-4 rounded-lg">
                            <FaProjectDiagram className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Project Management</h3>
                            <p className="text-sm text-gray-600">View and manage team projects</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/employees')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-lg">
                            <FaUsers className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Team Members</h3>
                            <p className="text-sm text-gray-600">Manage your team</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/leave-management')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-100 p-4 rounded-lg">
                            <FaCheckCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Approvals</h3>
                            <p className="text-sm text-gray-600">Review leave and expense requests</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin/reports')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-4 rounded-lg">
                            <FaChartLine className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Team Reports</h3>
                            <p className="text-sm text-gray-600">View team performance reports</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/today-attendance')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-4 rounded-lg">
                            <FaCheckCircle className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Team Attendance</h3>
                            <p className="text-sm text-gray-600">Monitor team attendance</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin-payroll')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-4 rounded-lg">
                            <FaChartLine className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Team Payroll</h3>
                            <p className="text-sm text-gray-600">View team payroll information</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardManager;
