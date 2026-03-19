import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaUsers, FaChartLine, FaDollarSign, FaProjectDiagram,
    FaBuilding, FaCog, FaFileAlt, FaCalendarAlt, FaExclamationTriangle,
    FaArrowUp, FaArrowDown, FaCheckCircle, FaClock,
    FaChartBar, FaMoneyBillWave, FaTasks, FaUserCheck, FaBell
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  useEmployees, 
  useProjects, 
  usePayrolls,
  useAttendanceSummary,
  useFinancialSummary,
  useExecutiveKPIs,
  useCriticalAlerts,
  useProjectPortfolio,
  useDepartmentPerformance,
  useEmployeeTrends,
  useStrategicInsights,
  usePredictiveAnalytics
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const DashboardAdministration = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [selectedPeriod, setSelectedPeriod] = useState('month');
    
    // Get position (case-insensitive matching)
    const position = (employee?.position || user?.position || '').toLowerCase().trim();
    const isCEO = position === 'ceo';
    const isCTO = position === 'cto';
    const isCFO = position === 'cfo';
    const isVP = position === 'vp';
    
    // Get display name for the executive
    const executiveTitle = employee?.position || user?.position || 'Executive';
    
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
      data: attendanceData = {}, 
      isLoading: attendanceLoading 
    } = useAttendanceSummary({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });

    // Phase 1: Executive Data Hooks
    const {
      data: financialData = {},
      isLoading: financialLoading
    } = useFinancialSummary({ period: selectedPeriod });

    const {
      data: kpiData = {},
      isLoading: kpiLoading
    } = useExecutiveKPIs();

    const {
      data: alertsData = { alerts: [], total: 0, critical: 0 },
      isLoading: alertsLoading
    } = useCriticalAlerts();

    const {
      data: portfolioData = {},
      isLoading: portfolioLoading
    } = useProjectPortfolio();

    // Phase 2: Department Performance & Employee Trends
    const {
      data: departmentData = {},
      isLoading: departmentLoading
    } = useDepartmentPerformance({ period: selectedPeriod });

    const {
      data: trendsData = {},
      isLoading: trendsLoading
    } = useEmployeeTrends({ months: 12 });

    // Phase 3: Strategic Insights & Predictive Analytics
    const {
      data: insightsData = { insights: [], summary: {} },
      isLoading: insightsLoading
    } = useStrategicInsights();

    const {
      data: predictiveData = {},
      isLoading: predictiveLoading
    } = usePredictiveAnalytics({ forecastMonths: 6 });

    const isLoading = employeesLoading || projectsLoading || payrollsLoading || attendanceLoading;

    // Calculate statistics
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(emp => emp.status === 'active' || emp.active).length;
    const totalProjects = projects.length;
    const activeProjects = projects.filter(proj => proj.status === 'active' || proj.status === 'in-progress').length;
    const totalPayroll = payrolls.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const attendanceRate = Math.round(attendanceData?.attendanceRate || 0);

    // Handle errors
    React.useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, { 
                context: 'Administration Dashboard', 
                showToast: employeesError.response?.status !== 401 
            });
        }
    }, [employeesError]);

    const formatCurrency = (amount) => {
        if (!amount || isNaN(amount)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatNumber = (num) => {
        if (!num || isNaN(num)) return '0';
        return new Intl.NumberFormat('en-US').format(num);
    };

    const getDashboardTitle = () => {
        if (isCEO) return 'CEO Dashboard';
        if (isCTO) return 'CTO Dashboard';
        if (isCFO) return 'CFO Dashboard';
        if (isVP) return 'VP Dashboard';
        return `${executiveTitle} Dashboard`;
    };
    
    const getWelcomeMessage = () => {
        if (isCEO) return 'Welcome, Chief Executive Officer';
        if (isCTO) return 'Welcome, Chief Technology Officer';
        if (isCFO) return 'Welcome, Chief Financial Officer';
        if (isVP) return 'Welcome, Vice President';
        return 'Welcome to your Executive Dashboard';
    };

    const getAlertIcon = (type) => {
        switch(type) {
            case 'leave': return <FaCalendarAlt className="w-5 h-5" />;
            case 'project': return <FaProjectDiagram className="w-5 h-5" />;
            case 'attendance': return <FaUserCheck className="w-5 h-5" />;
            case 'payroll': return <FaMoneyBillWave className="w-5 h-5" />;
            case 'approval': return <FaCheckCircle className="w-5 h-5" />;
            default: return <FaExclamationTriangle className="w-5 h-5" />;
        }
    };

    const getSeverityColor = (severity) => {
        switch(severity) {
            case 'high': return 'bg-red-100 border-red-500 text-red-700';
            case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-700';
            case 'low': return 'bg-theme-secondary/10 border-theme-secondary text-theme-secondary';
            default: return 'bg-gray-100 border-gray-500 text-gray-700';
        }
    };

    if (isLoading) {
        return <LoadingSpinner message="Loading administration dashboard..." />;
    }

    const financialSummary = financialData?.summary || {};
    const kpis = kpiData || {};
    const alerts = alertsData?.alerts || [];
    const portfolio = portfolioData || {};

    return (
        <div className="p-4 md:p-6 space-y-6 min-h-screen bg-gradient-to-br from-gray-50/50 to-white">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{getDashboardTitle()}</h1>
                        <p className="text-base text-gray-600 font-medium">{getWelcomeMessage()}</p>
                        <p className="text-sm text-gray-500 mt-1">Comprehensive overview of organization operations and performance metrics</p>
                    </div>
                    {/* Period Selector for Financial Data */}
                    <div className="flex gap-2">
                        {['week', 'month', 'quarter', 'year'].map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    selectedPeriod === period
                                        ? 'bg-theme-primary text-white shadow-md'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Critical Alerts Section - Phase 1 */}
            {alerts.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border-l-4 border-red-500 p-5 animate-slideDown">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 p-2 rounded-lg">
                                <FaBell className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Critical Alerts</h2>
                                <p className="text-sm text-gray-600">{alertsData.critical} critical, {alertsData.total} total</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {alerts.map((alert, index) => (
                            <div
                                key={index}
                                onClick={() => navigate(alert.action)}
                                className={`p-4 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all ${getSeverityColor(alert.severity)}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-1">{getAlertIcon(alert.type)}</div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{alert.title}</h3>
                                        <p className="text-sm opacity-90">{alert.message}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Executive Summary - Phase 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* KPI Cards */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FaChartBar className="w-5 h-5 text-theme-primary" />
                        Key Performance Indicators
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard
                            label="Employee Utilization"
                            value={`${kpis.employees?.utilizationRate || 0}%`}
                            subtitle={`${kpis.employees?.active || 0} of ${kpis.employees?.total || 0} active`}
                            icon={<FaUsers className="w-6 h-6" />}
                            color="blue"
                        />
                        <StatCard
                            label="Project Completion Rate"
                            value={`${kpis.projects?.completionRate || 0}%`}
                            subtitle={`${kpis.projects?.active || 0} active projects`}
                            icon={<FaProjectDiagram className="w-6 h-6" />}
                            color="green"
                        />
                        <StatCard
                            label="Attendance Rate"
                            value={`${kpis.attendance?.rate || 0}%`}
                            subtitle={`${formatNumber(kpis.attendance?.totalHours || 0)} total hours`}
                            icon={<FaUserCheck className="w-6 h-6" />}
                            color="orange"
                        />
                        <StatCard
                            label="Avg Payroll per Employee"
                            value={formatCurrency(kpis.payroll?.avgPerEmployee || 0)}
                            subtitle={`${formatCurrency(kpis.payroll?.total || 0)} total`}
                            icon={<FaDollarSign className="w-6 h-6" />}
                            color="purple"
                        />
                    </div>
                </div>

                {/* Financial Summary Widget - Phase 1 */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaMoneyBillWave className="w-5 h-5 text-theme-primary" />
                        Financial Summary
                    </h2>
                    {financialLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Total Payroll</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(financialSummary.totalPayroll || 0)}
                                </p>
                                {financialSummary.growth !== undefined && (
                                    <div className={`flex items-center gap-1 mt-1 ${financialSummary.growth >= 0 ? 'text-theme-primary' : 'text-red-600'}`}>
                                        {financialSummary.growth >= 0 ? (
                                            <FaArrowUp className="w-4 h-4" />
                                        ) : (
                                            <FaArrowDown className="w-4 h-4" />
                                        )}
                                        <span className="text-sm font-medium">{Math.abs(financialSummary.growth)}% vs previous period</span>
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600 mb-1">Average Payroll</p>
                                <p className="text-xl font-semibold text-gray-800">
                                    {formatCurrency(financialSummary.averagePayroll || 0)}
                                </p>
                            </div>
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-600 mb-2">By Department</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {(financialData.byDepartment || []).slice(0, 5).map((dept, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="text-sm text-gray-700">{dept._id || 'Unknown'}</span>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {formatCurrency(dept.total || 0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Statistics Cards - Enhanced */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    label="Total Employees"
                    value={totalEmployees}
                    subtitle={`${activeEmployees} active`}
                    icon={<FaUsers className="w-6 h-6" />}
                    color="blue"
                />
                
                <StatCard
                    label="Active Projects"
                    value={activeProjects}
                    subtitle={`${totalProjects} total`}
                    icon={<FaProjectDiagram className="w-6 h-6" />}
                    color="green"
                />
                
                <StatCard
                    label="Total Payroll"
                    value={formatCurrency(totalPayroll)}
                    subtitle="All time"
                    icon={<FaDollarSign className="w-6 h-6" />}
                    color="purple"
                />
                
                <StatCard
                    label="Attendance Rate"
                    value={`${attendanceRate}%`}
                    subtitle="Last 30 days"
                    icon={<FaCalendarAlt className="w-6 h-6" />}
                    color="orange"
                />
            </div>

            {/* Project Portfolio Overview - Phase 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <FaProjectDiagram className="w-5 h-5 text-theme-primary" />
                            Project Portfolio
                        </h2>
                        <button
                            onClick={() => navigate('/projects')}
                            className="text-sm text-theme-primary hover:opacity-80 font-medium"
                        >
                            View All →
                        </button>
                    </div>
                    {portfolioLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-theme-secondary/10 rounded-lg">
                                    <p className="text-2xl font-bold text-theme-secondary">{portfolio.overview?.total || 0}</p>
                                    <p className="text-xs text-gray-600 mt-1">Total</p>
                                </div>
                                <div className="text-center p-4 bg-theme-primary/10 rounded-lg">
                                    <p className="text-2xl font-bold text-theme-primary">{portfolio.overview?.active || 0}</p>
                                    <p className="text-xs text-gray-600 mt-1">Active</p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                    <p className="text-2xl font-bold text-purple-600">{portfolio.overview?.healthScore || 0}%</p>
                                    <p className="text-xs text-gray-600 mt-1">Health</p>
                                </div>
                            </div>
                            {portfolio.atRisk && portfolio.atRisk.length > 0 && (
                                <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FaExclamationTriangle className="w-5 h-5 text-red-600" />
                                        <h3 className="font-semibold text-red-900">Projects at Risk ({portfolio.atRiskCount})</h3>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {portfolio.atRisk.slice(0, 5).map((project, idx) => (
                                            <div key={idx} className="text-sm text-red-700">
                                                • {project.name} - {project.priority || 'N/A'} priority
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Recent Projects */}
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaClock className="w-5 h-5 text-theme-primary" />
                        Recent Projects
                    </h2>
                    {portfolioLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {(portfolio.recentProjects || []).length > 0 ? (
                                portfolio.recentProjects.map((project, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => navigate('/projects')}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900">{project.name}</h3>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {project.status || 'N/A'} • {project.priority || 'N/A'} priority
                                                </p>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                                                project.status === 'completed' ? 'bg-theme-primary/10 text-theme-primary' :
                                                project.status === 'active' || project.status === 'in-progress' ? 'bg-theme-secondary/10 text-theme-secondary' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {project.status || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-8">No recent projects</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div 
                    className="modern-card p-5 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/employees')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-secondary)] p-4 rounded-xl shadow-lg">
                            <FaUsers className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Employee Management</h3>
                            <p className="text-sm text-gray-600">View and manage all employees</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="modern-card p-5 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/projects')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] p-4 rounded-xl shadow-lg">
                            <FaProjectDiagram className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Project Management</h3>
                            <p className="text-sm text-gray-600">View and manage all projects</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="modern-card p-5 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/admin-payroll')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-purple-400 to-purple-600 p-4 rounded-xl shadow-lg">
                            <FaDollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Payroll Management</h3>
                            <p className="text-sm text-gray-600">View and manage payroll</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="modern-card p-5 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/organization/dashboard')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-indigo-400 to-indigo-600 p-4 rounded-xl shadow-lg">
                            <FaBuilding className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">Organization Overview</h3>
                            <p className="text-sm text-gray-600">View organization analytics</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="modern-card p-5 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/admin-settings')}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-gray-400 to-gray-600 p-4 rounded-xl shadow-lg">
                            <FaCog className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">System Settings</h3>
                            <p className="text-sm text-gray-600">Configure system settings</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Phase 2: Department Performance */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FaChartBar className="w-5 h-5 text-theme-primary" />
                        Department Performance
                    </h2>
                </div>
                {departmentLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(departmentData.departments || []).length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {departmentData.departments.map((dept, idx) => (
                                    <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all">
                                        <h3 className="font-semibold text-gray-900 mb-2">{dept.name}</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Performance Score:</span>
                                                <span className={`font-bold ${
                                                    dept.metrics?.performanceScore >= 80 ? 'text-theme-primary' :
                                                    dept.metrics?.performanceScore >= 60 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                    {dept.metrics?.performanceScore || 0}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Employees:</span>
                                                <span className="font-medium">{dept.employees?.active || 0}/{dept.employees?.total || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Payroll:</span>
                                                <span className="font-medium">{formatCurrency(dept.payroll?.total || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No department data available</p>
                        )}
                    </div>
                )}
            </div>

            {/* Phase 2: Employee Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaChartLine className="w-5 h-5 text-theme-primary" />
                        Employee Growth Trends
                    </h2>
                    {trendsLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {(trendsData.trends?.employeeGrowth || []).slice(-6).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <span className="text-sm text-gray-700">{item.month}</span>
                                        <span className="font-semibold text-gray-900">{item.count} employees</span>
                                    </div>
                                ))}
                            </div>
                            {trendsData.growthRates && (
                                <div className="pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Growth Rate:</span>
                                        <span className={`font-bold ${
                                            trendsData.growthRates.employees >= 0 ? 'text-theme-primary' : 'text-red-600'
                                        }`}>
                                            {trendsData.growthRates.employees >= 0 ? '+' : ''}{trendsData.growthRates.employees}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaChartLine className="w-5 h-5 text-theme-primary" />
                        Payroll Trends
                    </h2>
                    {trendsLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {(trendsData.trends?.payroll || []).slice(-6).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <span className="text-sm text-gray-700">{item.month}</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(item.total || 0)}</span>
                                    </div>
                                ))}
                            </div>
                            {trendsData.growthRates && (
                                <div className="pt-4 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Growth Rate:</span>
                                        <span className={`font-bold ${
                                            trendsData.growthRates.payroll >= 0 ? 'text-theme-primary' : 'text-red-600'
                                        }`}>
                                            {trendsData.growthRates.payroll >= 0 ? '+' : ''}{trendsData.growthRates.payroll}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Phase 3: Strategic Insights */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FaExclamationTriangle className="w-5 h-5 text-yellow-500" />
                        Strategic Insights
                    </h2>
                    {insightsData.summary && (
                        <div className="flex gap-4 text-sm">
                            <span className="text-red-600 font-semibold">{insightsData.summary.critical || 0} Critical</span>
                            <span className="text-yellow-600 font-semibold">{insightsData.summary.warnings || 0} Warnings</span>
                            <span className="text-theme-primary font-semibold">{insightsData.summary.successes || 0} Positive</span>
                        </div>
                    )}
                </div>
                {insightsLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {(insightsData.insights || []).length > 0 ? (
                            insightsData.insights.map((insight, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border-l-4 ${
                                        insight.type === 'critical' ? 'bg-red-50 border-red-500' :
                                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                                        'bg-theme-primary/10 border-theme-primary'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 ${
                                            insight.type === 'critical' ? 'text-red-600' :
                                            insight.type === 'warning' ? 'text-yellow-600' :
                                            'text-theme-primary'
                                        }`}>
                                            {insight.type === 'critical' || insight.type === 'warning' ? 
                                                <FaExclamationTriangle className="w-5 h-5" /> :
                                                <FaCheckCircle className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                                            <p className="text-sm text-gray-700 mb-2">{insight.message}</p>
                                            <p className="text-xs text-gray-600 italic">💡 {insight.recommendation}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-8">No insights available at this time</p>
                        )}
                    </div>
                )}
            </div>

            {/* Phase 3: Predictive Analytics */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FaChartLine className="w-5 h-5 text-purple-600" />
                        Predictive Analytics
                    </h2>
                    {predictiveData.riskIndicators && (
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            predictiveData.riskIndicators.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                            predictiveData.riskIndicators.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-theme-primary/10 text-theme-primary'
                        }`}>
                            Risk: {predictiveData.riskIndicators.riskLevel?.toUpperCase()}
                        </div>
                    )}
                </div>
                {predictiveLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Payroll Forecast */}
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Payroll Forecast (6 Months)</h3>
                            <div className="space-y-2">
                                {(predictiveData.forecasts?.payroll || []).slice(0, 6).map((forecast, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <span className="text-sm text-gray-700">{forecast.month}</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(forecast.predicted || 0)}</span>
                                    </div>
                                ))}
                            </div>
                            {predictiveData.trends?.payroll && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Trend:</span>
                                        {predictiveData.trends.payroll.direction === 'increasing' ? (
                                            <FaArrowUp className="w-4 h-4 text-theme-primary" />
                                        ) : predictiveData.trends.payroll.direction === 'decreasing' ? (
                                            <FaArrowDown className="w-4 h-4 text-red-600" />
                                        ) : (
                                            <FaChartLine className="w-4 h-4 text-gray-600" />
                                        )}
                                        <span className="text-sm font-medium text-gray-700 capitalize">
                                            {predictiveData.trends.payroll.direction}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Employee Forecast */}
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-3">Employee Growth Forecast (6 Months)</h3>
                            <div className="space-y-2">
                                {(predictiveData.forecasts?.employees || []).slice(0, 6).map((forecast, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <span className="text-sm text-gray-700">{forecast.month}</span>
                                        <span className="font-semibold text-gray-900">{Math.round(forecast.predicted || 0)} employees</span>
                                    </div>
                                ))}
                            </div>
                            {predictiveData.trends?.employees && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Trend:</span>
                                        {predictiveData.trends.employees.direction === 'increasing' ? (
                                            <FaArrowUp className="w-4 h-4 text-theme-primary" />
                                        ) : predictiveData.trends.employees.direction === 'decreasing' ? (
                                            <FaArrowDown className="w-4 h-4 text-red-600" />
                                        ) : (
                                            <FaChartLine className="w-4 h-4 text-gray-600" />
                                        )}
                                        <span className="text-sm font-medium text-gray-700 capitalize">
                                            {predictiveData.trends.employees.direction}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardAdministration;
