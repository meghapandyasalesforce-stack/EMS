import React from 'react';
import { useSelector } from 'react-redux';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useProjects, 
  usePayrolls,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const DashboardTech = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    const position = employee?.position || user?.position || '';
    const department = employee?.department || user?.department || '';
    
    // Use React Query hooks for parallel data fetching
    const {
        data: employeeData = { employees: [], total: 0 },
        isLoading: employeesLoading,
        error: employeesError
    } = useEmployees();
    const employees = employeeData?.employees ?? [];
    const employeeTotal = employeeData?.total ?? employees.length;
    
    const { 
        data: projectsData, 
        isLoading: projectsLoading, 
        error: projectsError 
    } = useProjects();
    
    const { 
        data: payrollsData, 
        isLoading: payrollsLoading, 
        error: payrollsError 
    } = usePayrolls();
    
    const { 
        data: attendanceData, 
        isLoading: attendanceLoading, 
        error: attendanceError 
    } = useAttendanceSummary();
    
    // Handle errors
    if (employeesError) handleApiError(employeesError);
    if (projectsError) handleApiError(projectsError);
    if (payrollsError) handleApiError(payrollsError);
    if (attendanceError) handleApiError(attendanceError);
    
    const isLoading = employeesLoading || projectsLoading || payrollsLoading || attendanceLoading;
    
    if (isLoading) {
        return <LoadingSpinner message="Loading technology dashboard..." />;
    }
    
    const totalEmployees = employeeTotal;
    const totalProjects = projectsData?.length || 0;
    const totalPayrolls = payrollsData?.length || 0;
    const attendanceRate = attendanceData?.attendanceRate || 0;
    
    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Technology Dashboard</h1>
                <p className="text-gray-600 mt-2">
                    Welcome to the Technology Department Dashboard
                </p>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard
                    title="Total Employees"
                    value={totalEmployees}
                    icon="👥"
                    color="blue"
                />
                <StatCard
                    title="Active Projects"
                    value={totalProjects}
                    icon="📊"
                    color="green"
                />
                <StatCard
                    title="Payroll Records"
                    value={totalPayrolls}
                    icon="💰"
                    color="yellow"
                />
                <StatCard
                    title="Attendance Rate"
                    value={`${attendanceRate}%`}
                    icon="✅"
                    color="purple"
                />
            </div>
            
            {/* Department Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Department Information</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-gray-600">Department:</p>
                        <p className="text-lg font-semibold">{department || 'Technology'}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Position:</p>
                        <p className="text-lg font-semibold">{position || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardTech;

