import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import NotificationSender from "./NotificationSender";
import { FiCoffee, FiClock, FiUser } from "react-icons/fi";
import { FaUsers, FaFolder, FaMoneyBillWave } from "react-icons/fa";
import LoadingSpinner from "../components/LoadingSpinner";
import StatCard from "../components/StatCard";
import { 
  useEmployees, 
  useProjects, 
  usePayrolls, 
  useEmployeesOnBreak 
} from "../Hooks/useDashboardData";
import { useAttendanceRealtime } from "../Hooks/useAttendanceRealtime";
import { handleApiError } from "../utils/errorHandler";

// Memoized selectors
const selectAuth = (state) => state.auth || {};

function DashboardAdmin() {
  const navigate = useNavigate();
  const authState = useSelector(selectAuth);
  const user = authState?.user;

  // Use React Query hooks for data fetching with caching
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
    data: employeesOnBreak = [], 
    isLoading: breaksLoading,
    error: breaksError 
  } = useEmployeesOnBreak();

  // Real-time: when an employee starts/ends break, server emits; we invalidate and refetch
  useAttendanceRealtime();

  const isLoading = employeesLoading || projectsLoading || payrollsLoading;
  const employeeCount = employees?.length || 0;

  useEffect(() => {
    // Check authentication
    const userRole = localStorage.getItem('role');
    
    if (!user && userRole !== 'admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [user, navigate]);

  // Handle errors
  useEffect(() => {
    if (employeesError) {
      handleApiError(employeesError, { 
        context: 'Admin Dashboard', 
        showToast: employeesError.response?.status !== 401 
      });
    }
    if (breaksError) {
      handleApiError(breaksError, { 
        context: 'Employees on Break', 
        showToast: breaksError.response?.status !== 401 
      });
    }
  }, [employeesError, breaksError]);

  const formatBreakDuration = (minutes) => {
    if (!minutes || isNaN(minutes) || minutes < 0) {
      return '0m';
    }
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
        {/* Header - Clean and Professional */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                Dashboard
              </h1>
              <p className="text-sm md:text-base text-gray-600">
                Your organization's key metrics and activities
              </p>
            </div>
            {user && (
              <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm bg-theme-primary" style={{ backgroundColor: 'var(--color-primary)' }}>
                  <FiUser className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Welcome back</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {user.name || user.email?.split('@')[0] || 'Admin'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Messages */}
        {employeesError && employeesError.response?.status !== 401 && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm">
            <p className="font-semibold">Error Loading Data</p>
            <p className="text-sm mt-1">{employeesError.response?.data?.message || 'Failed to load employees'}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-6 md:mb-8">
          <StatCard
            label="Employees"
            value={employeeCount}
            icon={<FaUsers className="w-6 h-6" />}
            color="primary"
          />
          
          <StatCard
            label="Projects"
            value={projects.length}
            icon={<FaFolder className="w-6 h-6" />}
            color="secondary"
          />
          
          <StatCard
            label="Payrolls"
            value={payrolls.length}
            icon={<FaMoneyBillWave className="w-6 h-6" />}
            color="accent"
          />
        </div>

        {/* Announcement Section */}
        <div className="mb-6 md:mb-8">
          <NotificationSender />
        </div>

        {/* Projects and Employees Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8">
          {/* Projects Section */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Recent Projects</h2>
                <p className="text-xs text-gray-500">Latest project activities</p>
              </div>
              <button
                onClick={() => navigate("/add-project")}
                className="text-white py-2 px-3 rounded-md transition-colors flex items-center text-sm font-medium whitespace-nowrap bg-theme-primary hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <span className="mr-1.5">+</span> Add Project
              </button>
            </div>

            <div className="overflow-x-auto">
              {!Array.isArray(projects) || projects.length === 0 ? (
                <div className="text-center py-10">
                  <FaFolder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-2">No projects found</p>
                  <button
                    onClick={() => navigate("/add-project")}
                    className="mt-2 text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                  >
                    Create your first project →
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {projects.slice(0, 5).map((project) => (
                      <div 
                        key={project._id || project.id} 
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer"
                        onClick={() => navigate(`/projects/${project._id || project.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm md:text-base text-gray-800 truncate">
                            {project.name || 'Unnamed Project'}
                          </div>
                          <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                            {project.status || 'N/A'}
                          </div>
                        </div>
                        <FaFolder className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                  {projects.length > 5 && (
                    <div className="text-center mt-4 pt-3 border-t border-gray-100">
                      <button 
                        onClick={() => navigate("/projects")}
                        className="text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                      >
                        View All Projects →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Employees Section */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Recent Employees</h2>
                <p className="text-xs text-gray-500">Newly added team members</p>
              </div>
              <button
                onClick={() => navigate("/add-employee")}
                className="text-white py-2 px-3 rounded-md transition-colors flex items-center text-sm font-medium whitespace-nowrap bg-theme-primary hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <span className="mr-1.5">+</span> Add Employee
              </button>
            </div>

            <div className="overflow-x-auto">
              {employeesLoading ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"
            style={{ borderBottomColor: 'var(--color-primary)' }}></div>
                  <p className="text-gray-500 mt-2 text-sm">Loading employees...</p>
                </div>
              ) : !Array.isArray(employees) || employees.length === 0 ? (
                <div className="text-center py-10">
                  <FaUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-2">No employees found</p>
                  <button
                    onClick={() => navigate("/add-employee")}
                    className="mt-2 text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                  >
                    Add your first employee →
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {employees.slice(0, 5).map((emp) => (
                      <div 
                        key={emp._id || emp.id} 
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer"
                        onClick={() => navigate(`/employees/${emp._id || emp.id}`)}
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 bg-theme-secondary/10" style={{ backgroundColor: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)' }}>
                            <FiUser className="w-5 h-5 text-theme-secondary" style={{ color: 'var(--color-secondary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm md:text-base text-gray-800 truncate">
                              {emp.name || ''} {emp.lastName || ''}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                              {emp.position || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {employees.length > 5 && (
                    <div className="text-center mt-4 pt-3 border-t border-gray-100">
                      <button 
                        onClick={() => navigate("/employees")}
                        className="text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                      >
                        View All Employees →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Employees on Break Section */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-orange-500 mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-full bg-orange-100 text-orange-600">
                <FiCoffee className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">Employees on Break</h2>
                <p className="text-xs text-gray-500 mt-0.5">Currently on break ({employeesOnBreak.length})</p>
              </div>
            </div>
          </div>
          
          {breaksLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              <p className="text-gray-500 mt-2 text-sm">Loading...</p>
            </div>
          ) : employeesOnBreak.length === 0 ? (
            <div className="text-center py-8">
              <FiCoffee className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No employees on break at the moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employeesOnBreak.map((item, index) => (
                <div 
                  key={item.attendanceId || index} 
                  className="flex items-center justify-between p-3 md:p-4 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {item.employee?.profilePhoto ? (
                        <img 
                          src={item.employee.profilePhoto.url || item.employee.profilePhoto} 
                          alt={item.employee.name}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-orange-300"
                        />
                      ) : (
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-200 flex items-center justify-center">
                          <FiUser className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">
                        {item.employee?.name} {item.employee?.lastName || ''}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs md:text-sm text-gray-600">
                        <span>{item.employee?.department || 'N/A'}</span>
                        <span>•</span>
                        <span>{item.employee?.position || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-orange-600">
                        <FiClock className="w-4 h-4" />
                        <span className="font-semibold text-sm md:text-base">
                          {formatBreakDuration(item.breakDuration)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Started {formatTime(item.breakStartTime)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Section */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Attendance Management</h2>
              <p className="text-xs text-gray-500">View and manage employee attendance</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <button
                onClick={() => navigate("/today-attendance")}
                className="text-white py-2 px-3 rounded-md transition-colors text-sm font-medium whitespace-nowrap bg-theme-primary hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Today's Attendance
              </button>
              <button
                onClick={() => navigate("/all-attendance-history")}
                className="text-white py-2 px-3 rounded-md transition-colors text-sm font-medium whitespace-nowrap bg-theme-secondary hover:opacity-90"
            style={{ backgroundColor: 'var(--color-secondary)' }}
              >
                All Attendance Report
              </button>
            </div>
          </div>
        </div>

        {/* Payrolls Section */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="mb-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">Recent Payrolls</h2>
            <p className="text-xs text-gray-500">Latest payroll transactions</p>
          </div>
          <div className="overflow-x-auto">
            {!Array.isArray(payrolls) || payrolls.length === 0 ? (
              <div className="text-center py-10">
                <FaMoneyBillWave className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-2">No payroll records found</p>
                <button
                  onClick={() => navigate("/add-payroll")}
                  className="mt-2 text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                >
                  Create your first payroll →
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {payrolls.slice(0, 5).map((payroll) => (
                    <div 
                      key={payroll._id || payroll.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all cursor-pointer"
                      onClick={() => {
                        const employeeId = payroll.employeeId?._id || payroll.employeeId;
                        if (employeeId) {
                          navigate(`/admin-employee-payroll/${employeeId}`);
                        } else {
                          navigate('/admin-payroll');
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm md:text-base text-gray-800">
                          {payroll.employeeName || 'Unknown Employee'}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                          {formatCurrency(payroll.amount || payroll.totalAmount || 0)} • {payroll.status || 'N/A'}
                        </div>
                      </div>
                      <FaMoneyBillWave className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                    </div>
                  ))}
                </div>
                {payrolls.length > 5 && (
                  <div className="text-center mt-4 pt-3 border-t border-gray-100">
                    <button 
                      onClick={() => navigate("/admin-payroll")}
                      className="text-sm font-medium transition-colors text-theme-secondary hover:opacity-80"
            style={{ color: 'var(--color-secondary)' }}
                    >
                      View All Payrolls →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardAdmin;
