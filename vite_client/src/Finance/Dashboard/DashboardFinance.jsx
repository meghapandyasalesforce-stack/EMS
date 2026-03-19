import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaDollarSign, FaChartLine, FaMoneyBillWave, FaReceipt,
    FaFileInvoiceDollar, FaCreditCard, FaCalculator, FaChartBar, FaCheckCircle
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  usePayrolls, 
  useExpenses 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import axios from '../../utils/axios';
import { retryAxios } from '../../utils/retry';
import { useQuery } from '@tanstack/react-query';

const DashboardFinance = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    
    // Use React Query hooks for parallel data fetching
    const { 
      data: payrolls = [], 
      isLoading: payrollsLoading,
      error: payrollsError 
    } = usePayrolls();

    const { 
      data: expenses = [], 
      isLoading: expensesLoading,
      error: expensesError 
    } = useExpenses();

    // Fetch organization budget
    const { 
      data: orgData = {}, 
      isLoading: orgLoading 
    } = useQuery({
      queryKey: ['organization-settings'],
      queryFn: async () => {
        try {
          const response = await retryAxios(() => 
            axios.get('/v1/organization/settings', { withCredentials: true }),
            { maxRetries: 2 }
          );
          return response.data?.organization || {};
        } catch (error) {
          return {};
        }
      },
      staleTime: 1000 * 60 * 5,
    });

    const isLoading = payrollsLoading || expensesLoading || orgLoading;

    // Calculate statistics
    const totalPayroll = payrolls.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const pendingExpenses = expenses.filter(exp => exp.status === 'pending').length;
    const approvedExpenses = expenses.filter(exp => exp.status === 'approved').length;
    const monthlyBudget = orgData?.monthlyBudget || 0;
    
    const expensesThisMonth = expenses
        .filter(exp => {
            const expDate = new Date(exp.date);
            const now = new Date();
            return expDate.getMonth() === now.getMonth() && 
                   expDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    // Handle errors
    React.useEffect(() => {
        if (payrollsError) {
            handleApiError(payrollsError, { 
                context: 'Finance Dashboard', 
                showToast: payrollsError.response?.status !== 401 
            });
        }
        if (expensesError) {
            handleApiError(expensesError, { 
                context: 'Finance Dashboard - Expenses', 
                showToast: expensesError.response?.status !== 401 
            });
        }
    }, [payrollsError, expensesError]);
    
    if (isLoading) {
        return <LoadingSpinner message="Loading Finance Dashboard..." />;
    }
    
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-4 sm:space-y-6 transition-all duration-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 truncate">Finance Dashboard</h1>
                <div className="text-xs sm:text-sm text-gray-600 truncate">
                    Welcome, {user?.name || user?.username || 'Finance Manager'}
                </div>
            </div>
            
            {/* Statistics Cards - Using StatCard component */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard
                    label="Total Payroll"
                    value={formatCurrency(totalPayroll)}
                    subtitle="All time"
                    icon={<FaMoneyBillWave className="w-8 h-8" />}
                    color="green"
                />
                
                <StatCard
                    label="Pending Expenses"
                    value={pendingExpenses}
                    subtitle="Requires approval"
                    icon={<FaReceipt className="w-8 h-8" />}
                    color="yellow"
                />
                
                <StatCard
                    label="Monthly Expenses"
                    value={formatCurrency(expensesThisMonth)}
                    subtitle="This month"
                    icon={<FaChartLine className="w-8 h-8" />}
                    color="blue"
                />
                
                <StatCard
                    label="Approved Expenses"
                    value={approvedExpenses}
                    subtitle="This month"
                    icon={<FaCheckCircle className="w-8 h-8" />}
                    color="purple"
                />
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/admin-payroll')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-theme-primary/10 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaMoneyBillWave className="w-5 h-5 sm:w-6 sm:h-6 text-theme-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Payroll Management</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Manage employee payroll</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/admin/expenses')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-yellow-100 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaReceipt className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Expense Management</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Review and approve expenses</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/admin/reports')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-theme-secondary/10 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaChartBar className="w-5 h-5 sm:w-6 sm:h-6 text-theme-secondary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Financial Reports</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Generate financial reports</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/salary-structure')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-purple-100 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaFileInvoiceDollar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Salary Structure</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Manage salary structures</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/admin-settings')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-theme-accent/10 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaCalculator className="w-5 h-5 sm:w-6 sm:h-6 text-theme-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Financial Settings</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Configure financial rules</p>
                        </div>
                    </div>
                </div>
                
                <div 
                    className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
                    onClick={() => navigate('/admin-payroll')}
                >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="bg-gray-100 p-3 sm:p-4 rounded-lg flex-shrink-0">
                            <FaCreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">Budget Management</h3>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">Track and manage budgets</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardFinance;
