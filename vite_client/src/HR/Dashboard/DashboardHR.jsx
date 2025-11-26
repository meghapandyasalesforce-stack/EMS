import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaUsers, FaCalendarAlt, FaFileAlt, FaChartLine,
    FaUserCheck, FaUserTie, FaClipboardList, FaGavel
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useLeaves, 
  usePolicyCompliance,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const DashboardHR = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    
    // Use React Query hooks for parallel data fetching
    const { 
      data: employees = [], 
      isLoading: employeesLoading,
      error: employeesError 
    } = useEmployees();

    const { 
      data: leaves = [], 
      isLoading: leavesLoading,
      error: leavesError 
    } = useLeaves();

    const { 
      data: compliance = [], 
      isLoading: complianceLoading 
    } = usePolicyCompliance();

    const { 
      data: attendanceData = {}, 
      isLoading: attendanceLoading 
    } = useAttendanceSummary({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    const isLoading = employeesLoading || leavesLoading || complianceLoading || attendanceLoading;

    // Calculate statistics
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'active').length;
    const pendingLeaves = leaves.filter(leave => leave.status === 'pending').length;
    const newHires = employees.filter(emp => {
        if (!emp.joiningDate) return false;
        const joiningDate = new Date(emp.joiningDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joiningDate >= thirtyDaysAgo;
    }).length;
    
    // Calculate policy compliance rate
    let totalCompliance = 0;
    if (compliance.length > 0) {
        const avgCompliance = compliance.reduce((sum, item) => 
            sum + parseFloat(item.complianceRate || 0), 0) / compliance.length;
        totalCompliance = avgCompliance;
    }
    
    const attendanceRate = Math.round(attendanceData?.attendanceRate || 0);

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'HR Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
        if (leavesError) {
            handleApiError(leavesError, { 
                context: 'HR Dashboard - Leaves', 
                showToast: leavesError.response?.status !== 401 
            });
        }
    }, [employeesError, leavesError]);
    
    if (isLoading) {
        return <LoadingSpinner message="Loading HR Dashboard..." />;
    }
    
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">HR Manager Dashboard</h1>
                <div className="text-sm text-gray-600">
                    Welcome, {user?.name || user?.username || 'HR Manager'}
                </div>
            </div>
            
            {/* Statistics Cards - Using StatCard component */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Total Employees"
                    value={totalEmployees}
                    subtitle={`${activeEmployees} active`}
                    icon={<FaUsers className="w-8 h-8" />}
                    color="blue"
                />
                
                <StatCard
                    label="Pending Leaves"
                    value={pendingLeaves}
                    subtitle="Requires review"
                    icon={<FaCalendarAlt className="w-8 h-8" />}
                    color="yellow"
                />
                
                <StatCard
                    label="New Hires (30d)"
                    value={newHires}
                    subtitle="This month"
                    icon={<FaUserCheck className="w-8 h-8" />}
                    color="green"
                />
                
                <StatCard
                    label="Policy Compliance"
                    value={`${totalCompliance.toFixed(1)}%`}
                    subtitle="Average rate"
                    icon={<FaClipboardList className="w-8 h-8" />}
                    color="purple"
                />
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/employees')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-4 rounded-lg">
                            <FaUsers className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Employee Management</h3>
                            <p className="text-sm text-gray-600">Manage employees, roles, and departments</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin/policies')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-lg">
                            <FaFileAlt className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Company Policies</h3>
                            <p className="text-sm text-gray-600">Create and manage company policies</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/leave-management')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-100 p-4 rounded-lg">
                            <FaCalendarAlt className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Leave Management</h3>
                            <p className="text-sm text-gray-600">Review and approve leave requests</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/role-hierarchy')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-4 rounded-lg">
                            <FaUserTie className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Role Management</h3>
                            <p className="text-sm text-gray-600">Define roles and permissions</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin/reports')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-4 rounded-lg">
                            <FaChartLine className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">HR Reports</h3>
                            <p className="text-sm text-gray-600">Generate HR analytics and reports</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin-settings')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-4 rounded-lg">
                            <FaGavel className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">HR Settings</h3>
                            <p className="text-sm text-gray-600">Configure HR policies and rules</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHR;
