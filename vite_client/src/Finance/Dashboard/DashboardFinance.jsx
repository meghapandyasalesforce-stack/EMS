import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaChartLine, FaMoneyBillWave, FaReceipt,
    FaFileInvoiceDollar, FaCreditCard, FaCalculator, FaChartBar, FaCheckCircle,
    FaHeadset
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatCard from '../../components/StatCard';
import { 
  usePayrolls, 
  useExpenses 
} from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import AnnouncementBanner from '../../components/AnnouncementBanner';
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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6 transition-all duration-300">
            <AnnouncementBanner />
            <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="truncate text-2xl font-bold text-gray-800 sm:text-3xl">Finance Dashboard</h1>
                    <div className="flex items-center gap-3">
                        <div className="truncate text-xs text-gray-600 sm:text-sm">
                            Welcome, {user?.name || user?.username || 'Finance Manager'}
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/helpdesk')}
                            className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-50"
                            title="HR Helpdesk"
                        >
                            <FaHeadset />
                        </button>
                    </div>
                </div>
            
                {/* Statistics Cards — full width */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
                    <div
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/admin-payroll')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-theme-primary/10 p-3 sm:p-4">
                                <FaMoneyBillWave className="h-5 w-5 text-theme-primary sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Payroll Management</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Manage employee payroll</p>
                            </div>
                        </div>
                    </div>
            
                    <div 
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/admin/expenses')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-yellow-100 p-3 sm:p-4">
                                <FaReceipt className="h-5 w-5 text-yellow-600 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Expense Management</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Review and approve expenses</p>
                            </div>
                        </div>
                    </div>
            
                    <div 
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/admin/reports')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-theme-secondary/10 p-3 sm:p-4">
                                <FaChartBar className="h-5 w-5 text-theme-secondary sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Financial Reports</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Generate financial reports</p>
                            </div>
                        </div>
                    </div>
            
                    <div 
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/salary-structure')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-purple-100 p-3 sm:p-4">
                                <FaFileInvoiceDollar className="h-5 w-5 text-purple-600 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Salary Structure</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Manage salary structures</p>
                            </div>
                        </div>
                    </div>
            
                    <div 
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/admin-settings')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-theme-accent/10 p-3 sm:p-4">
                                <FaCalculator className="h-5 w-5 text-theme-accent sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Financial Settings</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Configure financial rules</p>
                            </div>
                        </div>
                    </div>
            
                    <div 
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-md transition-shadow hover:shadow-lg active:scale-[0.98] sm:p-6"
                        onClick={() => navigate('/admin-payroll')}
                    >
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex-shrink-0 rounded-lg bg-gray-100 p-3 sm:p-4">
                                <FaCreditCard className="h-5 w-5 text-gray-600 sm:h-6 sm:w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold text-gray-800 sm:text-lg">Budget Management</h3>
                                <p className="truncate text-xs text-gray-600 sm:text-sm">Track and manage budgets</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardFinance;
