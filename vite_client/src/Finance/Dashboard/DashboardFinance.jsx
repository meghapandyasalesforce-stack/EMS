import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaDollarSign, FaChartLine, FaMoneyBillWave, FaReceipt,
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
import { toast } from 'react-toastify';
import { retryAxios } from '../../utils/retry';
import { useQuery } from '@tanstack/react-query';
import { BOTH_CELEBRATION_ENDPOINT } from '../../utils/constant';


const CELEBRATION_REACTIONS = ['❤️', '🎉', '👏', '🥳'];
const sortCelebrations = (items = []) => [...items].sort((a,b)=>{const ad=Number.isFinite(Number(a?.daysUntil))?Number(a.daysUntil):9999; const bd=Number.isFinite(Number(b?.daysUntil))?Number(b.daysUntil):9999; if(ad!==bd) return ad-bd; const order={birthday:1, marriage_anniversary:2, anniversary:3}; return (order[a?.type]||99)-(order[b?.type]||99);});
function CelebrationDashboardCard({ item, isSelf=false, event, reacting=false, onReact, onWishes }) {
  const isToday=item?.daysUntil===0; const isMarriage=item?.type==='marriage_anniversary'; const isWork=item?.type==='anniversary';
  const icon=isMarriage?'💍':isWork?'🎉':'🎂'; const typeLabel=isMarriage?'Marriage Anniversary':isWork?'Work Anniversary':'Birthday';
  const dateLabel=item?.birthday||item?.anniversaryDate||item?.date||''; const whenLabel=item?.daysUntil===0?'Today':item?.daysUntil===1?'Tomorrow':`in ${item?.daysUntil} days`;
  const counts=event?.reactionCounts||{}; const header=isSelf?(isMarriage?'YOUR MARRIAGE ANNIVERSARY':isWork?'YOUR WORK ANNIVERSARY':"IT'S YOUR BIRTHDAY"):(isMarriage?'MARRIAGE ANNIVERSARY':isWork?'WORK ANNIVERSARY':'BIRTHDAY');
  return <li className={`relative min-w-0 overflow-hidden rounded-2xl border p-3.5 ${isToday?'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm':'border-slate-100 bg-[#F8F9FB]'}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0 pr-24"><p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">{header}</p><p className="truncate font-semibold text-slate-800">{icon} {isSelf?'You':item?.name||'Team member'}</p><p className="text-xs text-slate-500">{(isMarriage||isWork)&&item?.completedYears?`${item.completedYears} ${item.completedYears===1?'year':'years'} · `:''}{dateLabel?`${dateLabel} · `:''}{typeLabel} · {whenLabel}</p></div>{onWishes?<button type="button" onClick={()=>onWishes(item)} className="absolute right-3.5 top-3.5 shrink-0 whitespace-nowrap rounded-full bg-[#20C997] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1ab589] sm:px-3 sm:text-xs">{isToday ? 'Wishes' : 'Upcoming'}</button>:null}</div>
    {isToday&&onReact?<div className="mt-3 flex flex-wrap gap-1.5">{CELEBRATION_REACTIONS.map((emoji)=>{const count=counts[emoji]||0; return <button key={emoji} type="button" disabled={reacting} onClick={()=>onReact(item,emoji)} className={`inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${count>0?'border-emerald-200':'border-slate-200'}`} aria-label={`React ${emoji}`}><span>{emoji}</span>{count>0?<span className="text-xs font-semibold text-slate-600">{count}</span>:null}</button>})}</div>:null}
  </li>;
}

const DashboardFinance = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [celebrations, setCelebrations] = useState([]);
    const [celebrationEvents, setCelebrationEvents] = useState({});
    const [celebrationReacting, setCelebrationReacting] = useState(false);
    
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
    

    useEffect(() => {
        const fetchCelebrations = async () => {
            try {
                const { data } = await axios.get('/v1/both/profile-details/upcoming-birthdays', { withCredentials: true });
                const birthdays = data?.birthdays || [];
                const marriageAnniversaries = data?.marriageAnniversaries || [];
                const celebrationItems = data?.celebrations || [
                    ...birthdays.map((item) => ({ ...item, type: item.type || 'birthday' })),
                    ...marriageAnniversaries.map((item) => ({ ...item, type: 'marriage_anniversary' })),
                ];
                setCelebrations(sortCelebrations(celebrationItems));
            } catch {
                setCelebrations([]);
            }
        };
        fetchCelebrations();
    }, []);

    const selfEmployeeId = String(employee?._id || user?.employeeId || user?._id || '');
    const getCelebrationItemKey = (item) => `${item?.type || 'birthday'}_${item?.employeeId}`;
    const openTodayCelebrationEvent = async (item) => {
        const { data } = await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/open`, { employeeId: item.employeeId, type: item.type || 'birthday' }, { withCredentials: true });
        const event = data?.data;
        if (event?._id) setCelebrationEvents((prev) => ({ ...prev, [getCelebrationItemKey(item)]: event }));
        return event;
    };
    const handleOpenCelebrationWishes = async (item) => {
        if (!item?.employeeId) return;
        try {
            if (item.daysUntil !== 0) { const label = item?.type === 'marriage_anniversary' ? 'marriage anniversary' : item?.type === 'anniversary' ? 'work anniversary' : 'birthday'; toast.info(`Wishes and reactions open on their ${label}.`); return; }
            const itemKey = getCelebrationItemKey(item);
            const event = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            navigate(event?._id ? `/celebrations/${event._id}` : '/celebrations');
        } catch { navigate('/celebrations'); }
    };
    const handleCelebrationReact = async (item, emoji) => {
        if (item?.daysUntil !== 0) return;
        setCelebrationReacting(true);
        try {
            const itemKey = getCelebrationItemKey(item);
            const opened = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            if (!opened?._id) return;
            const { data } = await axios.post(`${BOTH_CELEBRATION_ENDPOINT}/events/${opened._id}/react`, { emoji }, { withCredentials: true });
            const eventStateKey = data?.data?.type && data?.data?.employeeId ? `${data.data.type}_${data.data.employeeId}` : itemKey;
            setCelebrationEvents((prev) => ({ ...prev, [eventStateKey]: { ...opened, ...(prev[eventStateKey] || {}), reactions: data?.data?.reactions || [], reactionCounts: data?.data?.reactionCounts || {} } }));
        } finally { setCelebrationReacting(false); }
    };

    if (isLoading) {
        return <LoadingSpinner message="Loading Finance Dashboard..." />;
    }
    
    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 transition-all duration-300">
            <AnnouncementBanner />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 truncate">Finance Dashboard</h1>
                <div className="flex items-center gap-3">
                    <div className="text-xs sm:text-sm text-gray-600 truncate">
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

            {celebrations.length > 0 ? (
                <div className="mb-6 rounded-2xl border bg-white shadow-sm">
                    <div className="rounded-t-2xl bg-[#20C997] px-5 py-3">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">🎂 Upcoming celebrations</h2>
                    </div>
                    <div className="p-5">
                        <ul className="space-y-3">
                            {celebrations.slice(0, 3).map((item, idx) => {
                                const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                                return (
                                    <CelebrationDashboardCard key={`${item.type || 'birthday'}_${item.employeeId || idx}`} item={item} isSelf={Boolean(selfEmployeeId) && String(item.employeeId) === selfEmployeeId} event={celebrationEvents[itemKey]} reacting={celebrationReacting} onReact={handleCelebrationReact} onWishes={handleOpenCelebrationWishes} />
                                );
                            })}
                        </ul>
                    </div>
                </div>
            ) : null}
            
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
