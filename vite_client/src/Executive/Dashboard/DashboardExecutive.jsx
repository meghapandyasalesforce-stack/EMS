import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaUsers, FaChartLine, FaDollarSign, FaProjectDiagram,
    FaArrowUp, FaArrowDown, FaCheckCircle,
    FaExclamationTriangle, FaUserTie,
    FaCog, FaChartBar, FaMoneyBillWave,
    FaLaptopCode, FaServer, FaCodeBranch, FaRocket
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useProjects, 
  usePayrolls,
  useExpenses,
  useLeaves,
  useAttendanceSummary 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const DashboardExecutive = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    const position = employee?.position || user?.position || '';
    const department = employee?.department || user?.department || '';
    
    // Determine executive type
    const isCEO = position === 'CEO';
    const isCTO = position === 'CTO' || (department === 'Engineering' && position === 'VP');
    const isCFO = position === 'CFO' || (department === 'Finance' && position === 'VP');
    const isVP = position === 'VP' && !isCTO && !isCFO;
    
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
      data: payrolls = [], 
      isLoading: payrollsLoading 
    } = usePayrolls();

    const { 
      data: expenses = [], 
      isLoading: expensesLoading 
    } = useExpenses();

    const { 
      data: leaves = [], 
      isLoading: leavesLoading 
    } = useLeaves();

    const { 
      data: attendanceData = {}, 
      isLoading: attendanceLoading 
    } = useAttendanceSummary({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    const isLoading = employeesLoading || projectsLoading || payrollsLoading || 
                     expensesLoading || leavesLoading || attendanceLoading;

    // Calculate statistics using useMemo for performance
    const stats = useMemo(() => {
        const totalEmployees = employees.length;
        const activeEmployees = employees.filter(emp => emp.status === 'active').length;
        const activeProjects = projects.filter(proj => proj.status === 'active').length;
        const completedProjects = projects.filter(proj => proj.status === 'completed').length;
        
        // Calculate revenue (simplified)
        const totalPayroll = payrolls.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
        const totalRevenue = totalPayroll * 1.5; // Simplified calculation
        
        const monthlyExpenses = expenses
            .filter(exp => {
                const expDate = new Date(exp.date);
                const now = new Date();
                return expDate.getMonth() === now.getMonth() && 
                       expDate.getFullYear() === now.getFullYear();
            })
            .reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // Department performance
        const departmentPerformance = {};
        employees.forEach(emp => {
            const dept = emp.department || 'Other';
            if (!departmentPerformance[dept]) {
                departmentPerformance[dept] = { total: 0, active: 0 };
            }
            departmentPerformance[dept].total++;
            if (emp.status === 'active') {
                departmentPerformance[dept].active++;
            }
        });
        
        // New hires (last 30 days)
        const newHires = employees.filter(emp => {
            if (!emp.joiningDate) return false;
            const joiningDate = new Date(emp.joiningDate);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return joiningDate >= thirtyDaysAgo;
        }).length;
        
        const attendanceRate = Math.round(attendanceData?.attendanceRate || 0);
        const pendingApprovals = leaves.filter(l => l.status === 'pending').length + 
                                 expenses.filter(e => e.status === 'pending').length;
        
        return {
            totalEmployees,
            activeEmployees,
            totalRevenue,
            monthlyExpenses,
            activeProjects,
            completedProjects,
            departmentPerformance,
            attendanceRate,
            pendingApprovals,
            newHires,
            terminations: employees.filter(emp => emp.status === 'terminated').length
        };
    }, [employees, projects, payrolls, expenses, leaves, attendanceData]);

    // CTO-specific stats
    const techStats = useMemo(() => {
        if (!isCTO) return null;
        
        const engineeringEmployees = employees.filter(emp => 
            emp.department === 'Engineering' || emp.department === 'IT Support'
        );
        
        return {
            activeProjects: stats.activeProjects,
            completedProjects: stats.completedProjects,
            teamSize: engineeringEmployees.length,
            codeCommits: 0, // TODO: Integrate with version control
            deployments: 0, // TODO: Integrate with CI/CD
            technicalDebt: 0, // TODO: Calculate technical debt
            infrastructureStatus: 'healthy'
        };
    }, [isCTO, employees, stats]);

    // CFO-specific stats
    const financeStats = useMemo(() => {
        if (!isCFO) return null;
        
        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const netProfit = stats.totalRevenue - totalExpenses;
        
        // Department spending
        const departmentSpending = {};
        expenses.forEach(exp => {
            const dept = exp.department || 'Other';
            if (!departmentSpending[dept]) {
                departmentSpending[dept] = 0;
            }
            departmentSpending[dept] += exp.amount || 0;
        });
        
        return {
            totalRevenue: stats.totalRevenue,
            totalExpenses,
            netProfit,
            monthlyBudget: 0, // TODO: Get from organization settings
            departmentSpending,
            cashFlow: netProfit,
            pendingApprovals: expenses.filter(exp => exp.status === 'pending').length
        };
    }, [isCFO, expenses, stats]);

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'Executive Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
    }, [employeesError]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getDashboardTitle = () => {
        if (isCEO) return 'CEO Dashboard';
        if (isCTO) return 'CTO Dashboard';
        if (isCFO) return 'CFO Dashboard';
        if (isVP) return 'VP Dashboard';
        return 'Executive Dashboard';
    };

    const getWelcomeName = () => {
        return user?.name || employee?.name || 'Executive';
    };

    if (isLoading) {
        return <LoadingSpinner message={`Loading ${getDashboardTitle()}...`} />;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">{getDashboardTitle()}</h1>
                <div className="text-sm text-gray-600">
                    Welcome, {getWelcomeName()}
                </div>
            </div>
            
            {/* CEO Dashboard - Organization Overview */}
            {isCEO && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            label="Total Employees"
                            value={stats.totalEmployees}
                            subtitle={`${stats.activeEmployees} active`}
                            icon={<FaUsers className="w-8 h-8" />}
                            color="blue"
                        />
                        
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(stats.totalRevenue)}
                            subtitle="All time"
                            icon={<FaDollarSign className="w-8 h-8" />}
                            color="green"
                        />
                        
                        <StatCard
                            label="Active Projects"
                            value={stats.activeProjects}
                            subtitle={`${stats.completedProjects} completed`}
                            icon={<FaProjectDiagram className="w-8 h-8" />}
                            color="purple"
                        />
                        
                        <StatCard
                            label="New Hires (30d)"
                            value={stats.newHires}
                            subtitle="This month"
                            icon={<FaUserTie className="w-8 h-8" />}
                            color="orange"
                        />
                    </div>
                    
                    {/* Department Performance */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Department Performance</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(stats.departmentPerformance).map(([dept, data]) => (
                                <div key={dept} className="border rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-800">{dept}</h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-600">Total: {data.total}</p>
                                        <p className="text-sm text-green-600">Active: {data.active}</p>
                                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                                            <div 
                                                className="bg-blue-600 h-2 rounded-full" 
                                                style={{ width: `${(data.active / data.total) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
            
            {/* CTO Dashboard - Technology Focus */}
            {isCTO && techStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Engineering Team"
                        value={techStats.teamSize}
                        subtitle="Developers"
                        icon={<FaLaptopCode className="w-8 h-8" />}
                        color="blue"
                    />
                    
                    <StatCard
                        label="Active Projects"
                        value={techStats.activeProjects}
                        subtitle={`${techStats.completedProjects} completed`}
                        icon={<FaRocket className="w-8 h-8" />}
                        color="green"
                    />
                    
                    <StatCard
                        label="Infrastructure"
                        value={techStats.infrastructureStatus}
                        subtitle="Status"
                        icon={<FaServer className="w-8 h-8" />}
                        color="purple"
                    />
                    
                    <StatCard
                        label="Code Commits"
                        value={techStats.codeCommits}
                        subtitle="This month"
                        icon={<FaCodeBranch className="w-8 h-8" />}
                        color="orange"
                    />
                </div>
            )}
            
            {/* CFO Dashboard - Financial Focus */}
            {isCFO && financeStats && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(financeStats.totalRevenue)}
                            subtitle="All time"
                            icon={<FaArrowUp className="w-8 h-8" />}
                            color="green"
                        />
                        
                        <StatCard
                            label="Total Expenses"
                            value={formatCurrency(financeStats.totalExpenses)}
                            subtitle="All time"
                            icon={<FaArrowDown className="w-8 h-8" />}
                            color="red"
                        />
                        
                        <StatCard
                            label="Net Profit"
                            value={formatCurrency(financeStats.netProfit)}
                            subtitle="Current"
                            icon={<FaMoneyBillWave className="w-8 h-8" />}
                            color={financeStats.netProfit >= 0 ? "green" : "red"}
                        />
                        
                        <StatCard
                            label="Pending Approvals"
                            value={financeStats.pendingApprovals}
                            subtitle="Requires action"
                            icon={<FaExclamationTriangle className="w-8 h-8" />}
                            color="yellow"
                        />
                    </div>
                    
                    {/* Department Spending */}
                    {Object.keys(financeStats.departmentSpending).length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Department Spending</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(financeStats.departmentSpending).map(([dept, amount]) => (
                                    <div key={dept} className="border rounded-lg p-4">
                                        <h3 className="font-semibold text-gray-800">{dept}</h3>
                                        <p className="text-2xl font-bold text-gray-800 mt-2">
                                            {formatCurrency(amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {/* VP Dashboard - Department Focus */}
            {isVP && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Department Size"
                        value={stats.departmentPerformance[department]?.total || 0}
                        subtitle={`${stats.departmentPerformance[department]?.active || 0} active`}
                        icon={<FaUsers className="w-8 h-8" />}
                        color="blue"
                    />
                    
                    <StatCard
                        label="Active Projects"
                        value={stats.activeProjects}
                        subtitle="In progress"
                        icon={<FaProjectDiagram className="w-8 h-8" />}
                        color="green"
                    />
                    
                    <StatCard
                        label="Attendance Rate"
                        value={`${stats.attendanceRate}%`}
                        subtitle="Department average"
                        icon={<FaCheckCircle className="w-8 h-8" />}
                        color="purple"
                    />
                    
                    <StatCard
                        label="Pending Approvals"
                        value={stats.pendingApprovals}
                        subtitle="Requires action"
                        icon={<FaCheckCircle className="w-8 h-8" />}
                        color="orange"
                    />
                </div>
            )}
            
            {/* Quick Actions - Common for all executives */}
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
                            <p className="text-sm text-gray-600">View and manage all employees</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/projects')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-4 rounded-lg">
                            <FaProjectDiagram className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Project Management</h3>
                            <p className="text-sm text-gray-600">View and manage all projects</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin/reports')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-4 rounded-lg">
                            <FaChartBar className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Analytics & Reports</h3>
                            <p className="text-sm text-gray-600">View comprehensive reports</p>
                        </div>
                    </div>
                </div>
                
                {(isCEO || isCFO) && (
                    <div 
                        className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate('/admin-payroll')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-green-100 p-4 rounded-lg">
                                <FaMoneyBillWave className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Financial Overview</h3>
                                <p className="text-sm text-gray-600">View payroll and expenses</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {(isCEO || isCTO) && (
                    <div 
                        className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate('/organization/analytics')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-100 p-4 rounded-lg">
                                <FaChartLine className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Organization Analytics</h3>
                                <p className="text-sm text-gray-600">View organization insights</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div 
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate('/admin-settings')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-4 rounded-lg">
                            <FaCog className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Settings</h3>
                            <p className="text-sm text-gray-600">Configure system settings</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardExecutive;
