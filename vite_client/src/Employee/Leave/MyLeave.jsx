import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getEmployeeLeaves, cancelEmployeeLeave } from '../../context/employeeLeaveSlice'; 
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FaCalendarAlt, FaUmbrellaBeach, FaChartPie, FaChartBar } from 'react-icons/fa';
import { MdSick } from 'react-icons/md';
import { BsCalendarCheck } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { EMPLOYEE_LEAVE_ENDPOINT } from '../../utils/constant';
import { toast } from 'react-toastify';
import {
  getLeaveDisplayLabel,
  getLeaveSummary,
  formatLeaveDurationDisplay,
  formatLeaveHistoryEndDate,
  isHalfDayLeaveRecord,
  getTakeableDaysThisMonth,
  hasNoCarryProbationLeave,
} from '../../constants/leaveConstants';
import { formatLeaveApprovalStageDisplay } from '../../utils/approvalStatusDisplay';


const COLORS = ['#FF6384', '#36A2EB', '#FFCE56'];

const MyLeavePage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const dispatch = useDispatch();
  const state = useSelector((state) => state.employeeLeave);
  const [activeTab, setActiveTab] = useState('leaves');
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const cancelLoading = useSelector(state => state.employeeLeave.cancelLoading);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(getEmployeeLeaves());
  }, [dispatch]);

  // Fetch leave balance from employee leave API
  useEffect(() => {
    fetchLeaveBalance();
  }, [selectedYear]);

  const fetchLeaveBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/balance`, {
        params: { year: selectedYear },
        withCredentials: true,
      });
      setLeaveBalance(res.data.balance);
    } catch (error) {
      setLeaveBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Cancel this pending leave request?')) {
      return;
    }
    try {
      await dispatch(cancelEmployeeLeave(leaveId)).unwrap();
      toast.success('Leave request cancelled');
      dispatch(getEmployeeLeaves());
      fetchLeaveBalance();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : error?.message || 'Failed to cancel leave');
    }
  };

  const leaveSummary = getLeaveSummary(leaveBalance);

  const getMaxLeaves = () => {
    if (leaveBalance?.leaveSummary || leaveBalance?.totalAvailableLeave != null) {
      const totalEntitlement = leaveSummary.totalAccrued + leaveSummary.totalCarriedForward;
      return {
        sick: totalEntitlement,
        annual: totalEntitlement,
        casual: totalEntitlement,
      };
    }
    if (leaveBalance?.balances) {
      const maxLeaves = {};
      leaveBalance.balances.forEach(balance => {
        const policyType = leaveBalance.policy?.leaveTypes?.find(lt => lt.type === balance.leaveType);
        const displayName = policyType?.displayName?.toLowerCase() || balance.leaveType;
        
        // Map leave types
        if (displayName.includes('sick') || balance.leaveType === 'sick') {
          maxLeaves.sick = balance.accrued + balance.carriedForward;
        } else if (displayName.includes('annual') || displayName.includes('paid') || balance.leaveType === 'paid') {
          maxLeaves.annual = balance.accrued + balance.carriedForward;
        } else if (displayName.includes('casual') || balance.leaveType === 'casual') {
          maxLeaves.casual = balance.accrued + balance.carriedForward;
        }
      });
      return maxLeaves;
    }
    return { sick: 0, annual: 0, casual: 0 };
  };

  const MAX_LEAVES = getMaxLeaves();

  const leavesData = state.myLeaves || [];
  const statsData = state.leaveStats || null;

  // Safely derive stats even if backend statistics are missing or still loading.
  // This prevents crashes when navigating here right after submitting a leave.
  const safeLeavesByType = statsData?.leavesByType || {};
  const statsBalanceByType = statsData?.balanceByType || {};

  const getTypeRemaining = (type, takenKey) => {
    if (leaveBalance?.leaveSummary || leaveBalance?.totalAvailableLeave != null) {
      return leaveSummary.totalAvailableLeave;
    }
    if (leaveBalance?.balances) {
      return Math.max(0, (MAX_LEAVES[type] || 0) - (safeLeavesByType[takenKey] || 0));
    }
    if (statsData?.hasBalanceData && statsBalanceByType[type]) {
      return statsBalanceByType[type].available;
    }
    return null;
  };

  const calculatedStats = {
    totalLeaves: leaveBalance?.leaveSummary || leaveBalance?.totalAvailableLeave != null
      ? leaveSummary.totalAccrued + leaveSummary.totalCarriedForward
      : leaveBalance?.balances
      ? leaveBalance.balances.reduce((sum, b) => sum + (b.accrued + b.carriedForward), 0)
      : (statsData?.totalLeaves || 0),
    remainingLeaves: leaveBalance?.leaveSummary || leaveBalance?.totalAvailableLeave != null
      ? (leaveSummary.totalTakeableThisMonth ?? leaveSummary.totalAvailableLeave)
      : leaveBalance?.balances
      ? leaveSummary.totalTakeableThisMonth ?? leaveBalance.balances.reduce((sum, b) => sum + b.available, 0)
      : (statsData?.monthlyLeaveCaps?.types?.length
        ? statsData.monthlyLeaveCaps.types.reduce(
            (sum, t) => sum + getTakeableDaysThisMonth(t),
            0
          )
        : (statsData?.remainingLeaves || 0)),
    sickLeaves: {
      taken: safeLeavesByType.sick || 0,
      remaining: getTypeRemaining('sick', 'sick')
    },
    annualLeaves: {
      taken: safeLeavesByType.annual || 0,
      remaining: getTypeRemaining('annual', 'annual')
    },
    casualLeaves: {
      taken: safeLeavesByType.casual || 0,
      remaining: getTypeRemaining('casual', 'casual')
    }
  };

  // Get monthly leave usage
  const getMonthlyLeaves = () => {
    const monthlyData = {};
    leavesData.forEach(leave => {
      const leaveDate = new Date(leave.startDate);
      const month = leaveDate.getMonth();
      const monthKey = `${leaveDate.getFullYear()}-${month}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: leaveDate.toLocaleString('default', { month: 'long' }),
          year: leaveDate.getFullYear(),
          sick: 0,
          annual: 0,
          casual: 0,
          total: 0
        };
      }
      
      const leaveType = leave.leaveType?.toLowerCase();
      if (leaveType === 'sick') {
        monthlyData[monthKey].sick += leave.duration || 0;
      } else if (leaveType === 'annual' || leaveType === 'paid') {
        monthlyData[monthKey].annual += leave.duration || 0;
      } else if (leaveType === 'casual') {
        monthlyData[monthKey].casual += leave.duration || 0;
      }
      monthlyData[monthKey].total += leave.duration || 0;
    });
    
    return Object.values(monthlyData).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return new Date(`${b.month} 1, ${b.year}`).getMonth() - new Date(`${a.month} 1, ${a.year}`).getMonth();
    });
  };

  const monthlyLeaves = getMonthlyLeaves();

  const leaveHistory = (leavesData || [])
    .map((raw) => {
      const leave = raw?.leave || raw;
      if (!leave || !leave.startDate || !leave.endDate) return null;

      let start, end;
      try {
        start = new Date(leave.startDate);
        end = new Date(leave.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return null;
        }
      } catch {
        return null;
      }

      const startIso = start.toISOString().split('T')[0];
      const endIso = end.toISOString().split('T')[0];

      return {
        id: leave._id,
        rawStatus: leave.status,
        type: leave.leaveType
          ? leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)
          : 'Unknown',
        startDate: startIso,
        endDate: formatLeaveHistoryEndDate(leave, startIso, endIso),
        status: leave.status
          ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1)
          : 'Unknown',
          approvalStage: leave.approvalStage || (leave.status === 'pending' ? 'Pending' : leave.status),
          workflowSummary: leave.workflowSummary,
          days: formatLeaveDurationDisplay(leave),
          isHalfDay: Boolean(leave.isHalfDay) || isHalfDayLeaveRecord(leave),
        };
    })
    .filter(Boolean);

  if (state.loading || balanceLoading) {
    return <div className="text-center py-10 text-gray-500">Loading leave data...</div>;
  }

  if (state.error) {
    return <div className="text-center py-10 text-red-500">Error: {state.error}</div>;
  }

  if (!statsData && !leaveBalance && leavesData.length === 0) {
    return <div className="text-center py-10 text-gray-500">No leave data available.</div>;
  }

  // Chart data (Recharts format)
  const pieChartData = [
    { name: 'Sick Leaves', value: calculatedStats.sickLeaves.taken },
    { name: 'Annual Leaves', value: calculatedStats.annualLeaves.taken },
    { name: 'Casual Leaves', value: calculatedStats.casualLeaves.taken }
  ];

  const barChartData = [
    {
      name: 'Sick',
      taken: calculatedStats.sickLeaves.taken,
      remaining: calculatedStats.sickLeaves.remaining ?? 0
    },
    {
      name: 'Annual',
      taken: calculatedStats.annualLeaves.taken,
      remaining: calculatedStats.annualLeaves.remaining ?? 0
    },
    {
      name: 'Casual',
      taken: calculatedStats.casualLeaves.taken,
      remaining: calculatedStats.casualLeaves.remaining ?? 0
    }
  ];

  const formatRemaining = (value) => (value == null ? '—' : value);

  return (
    <div className="page-shell min-h-screen bg-gray-100 transition-all duration-300">
      <div className="page-shell-inner hrms-stack">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Leave Dashboard</h1>
          <div className="flex w-full flex-wrap gap-2 md:w-auto md:space-x-0">
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'leaves' ? 'bg-theme-primary text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FaCalendarAlt className="inline mr-1 md:mr-2" />
              My Leaves
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'stats' ? 'bg-theme-primary text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FaChartPie className="inline mr-1 md:mr-2" />
              Statistics
            </button>
            <button 
              onClick={() => navigate('/leave')}
              className="bg-theme-primary text-white rounded-xl px-3 py-1 md:px-4 md:py-2  hover:opacity-90 transition text-sm md:text-base"
            >
              Apply for Leave
            </button>
          </div>
        </header>

        {/* Leave Balance from Policy */}
        <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold">Leave Balance ({selectedYear})</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full rounded border px-3 py-2 sm:w-auto"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {leaveBalance ? (
            <>
              {leaveBalance.policy && (
                <p className="text-sm text-gray-600 mb-4">
                  Policy: <strong>{leaveBalance.policy.policyName}</strong>
                </p>
              )}
              {(() => {
                return (
                  <div className="w-full min-w-0 rounded-lg bg-gray-50 p-4">
                    <h3 className="font-semibold mb-2">Employee Leave Summary</h3>
                    {(leaveSummary.inProbation || leaveBalance?.probation?.inProbation) && (
                      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {leaveSummary.probationNote ||
                          leaveBalance?.probation?.note ||
                          'On probation — leave accrues at probation rates from leave policy until confirmation.'}
                      </p>
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">This Month Leave:</span>
                        <span className="font-medium">{leaveSummary.earnedThisMonth} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Used:</span>
                        <span className="font-medium text-red-600">-{leaveSummary.totalUsed} days</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="font-semibold">Can apply this month:</span>
                          <span className={`font-bold text-lg ${
                            (leaveSummary.totalTakeableThisMonth ?? leaveSummary.totalAvailableLeave) > 0
                              ? 'text-theme-primary'
                              : 'text-red-600'
                          }`}>
                            {leaveSummary.totalTakeableThisMonth ?? leaveSummary.totalAvailableLeave} days
                          </span>
                        </div>
                        {leaveSummary.noCarryProbation ? (
                          <p className="mt-1 text-xs text-amber-800">
                            Frozen until confirmation is not included in this total.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                {leavesData.length > 0
                  ? 'Leave balance is not yet configured. Your applied leaves are shown below. Contact HR for entitlement details.'
                  : 'No leave policy configured yet. Please contact HR to set up your leave policy.'}
              </p>
            </div>
          )}

          {statsData?.monthlyLeaveCaps?.types?.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                This month ({statsData.monthlyLeaveCaps.monthLabel})
              </h3>
              {(statsData.monthlyLeaveCaps.inProbation ||
                statsData.monthlyLeaveCaps.types.some((t) => t.probationAccrualActive)) && (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {statsData.monthlyLeaveCaps.probationNote ||
                    'On probation — monthly leave rates follow leave policy probation rules.'}
                </p>
              )}
              <ul className="space-y-2">
                {statsData.monthlyLeaveCaps.types.map((t) => {
                  const takeable = getTakeableDaysThisMonth(t);
                  const frozen =
                    t.probationFrozenBalance != null ? Number(t.probationFrozenBalance) : null;
                  return (
                  <li
                    key={t.leaveType}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium capitalize">
                      {t.displayName || t.leaveType}
                      {t.probationAccrualActive ? (
                        <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                          Probation
                        </span>
                      ) : null}
                    </span>
                    <span className="text-gray-600">
                      <span className="font-semibold text-theme-primary">{takeable}</span> can apply this month
                      · earns {t.monthlyEntitlement ?? 0}/month
                      {frozen != null && frozen > 0 ? ` · ${frozen} frozen` : ''}
                    </span>
                    {t.probationNote ? (
                      <span className="w-full text-xs text-amber-800">{t.probationNote}</span>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
              {hasNoCarryProbationLeave(statsData.monthlyLeaveCaps.types) ? (
                <p className="mt-2 text-xs text-amber-800">
                  Totals above are what you can apply this month. Frozen balance unlocks on confirmation.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Monthly Leave Usage */}
        <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
          <h2 className="mb-4 text-xl font-bold">Monthly Leave Usage</h2>
          {monthlyLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sick</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Annual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Casual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthlyLeaves.map((month, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {month.month} {month.year}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{month.sick} days</td>
                      <td className="px-4 py-3 whitespace-nowrap">{month.annual} days</td>
                      <td className="px-4 py-3 whitespace-nowrap">{month.casual} days</td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">{month.total} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No leave usage recorded for this period.</p>
            </div>
          )}
        </div>

        {activeTab === 'leaves' ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-theme-secondary/10 text-theme-secondary mr-3">
                    <FaCalendarAlt size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Total Leaves</p>
                    <h3 className="text-xl font-bold">{calculatedStats.totalLeaves}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-theme-primary/10 text-theme-primary mr-3">
                    <BsCalendarCheck size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Can apply this month</p>
                    <h3 className="text-xl font-bold">{calculatedStats.remainingLeaves}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-red-100 text-red-600 mr-3">
                    <MdSick size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Sick Leaves Taken</p>
                    <h3 className="text-xl font-bold">{calculatedStats.sickLeaves.taken}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-yellow-100 text-yellow-600 mr-3">
                    <FaUmbrellaBeach size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Annual Leaves Taken</p>
                    <h3 className="text-xl font-bold">{calculatedStats.annualLeaves.taken}</h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Leave History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveHistory.map((leave) => (
                      <tr key={leave.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${leave.type === 'Sick' ? 'bg-red-100 text-red-800' :
                              leave.type === 'Annual' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-theme-secondary/10 text-theme-secondary'}`}>
                            {leave.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.startDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.endDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.days}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${leave.status === 'Approved' ? 'bg-theme-primary/10 text-theme-primary' :
                              leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              leave.status === 'Cancelled' ? 'bg-gray-100 text-gray-600' :
                                'bg-red-100 text-red-800'}`}>
                            {formatLeaveApprovalStageDisplay({
                              status: leave.rawStatus,
                              approvalStage: leave.approvalStage,
                              workflowSummary: leave.workflowSummary,
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm">
                          {leave.rawStatus === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleCancelLeave(leave.id)}
                              disabled={cancelLoading}
                              className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaChartPie className="mr-2" /> Leave Distribution
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaChartBar className="mr-2" /> Leave Usage
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="taken" stackId="a" fill="#3B82F6" name="Taken" />
                    <Bar dataKey="remaining" stackId="a" fill="#10B981" name="Remaining" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Leave Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <MdSick className="mr-2 text-red-500" /> Sick Leaves
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs md:text-sm text-gray-600">Taken: {calculatedStats.sickLeaves.taken}</p>
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {formatRemaining(calculatedStats.sickLeaves.remaining)}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-red-500 h-2.5 rounded-full"
                        style={{ width: `${(calculatedStats.sickLeaves.taken / MAX_LEAVES.sick) * 100}%` }}>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <FaUmbrellaBeach className="mr-2 text-yellow-500" /> Annual Leaves
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs md:text-sm text-gray-600">Taken: {calculatedStats.annualLeaves.taken}</p>
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {formatRemaining(calculatedStats.annualLeaves.remaining)}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-yellow-500 h-2.5 rounded-full"
                        style={{ width: `${(calculatedStats.annualLeaves.taken / MAX_LEAVES.annual) * 100}%` }}>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-3">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <FaCalendarAlt className="mr-2 text-theme-secondary" /> Casual Leaves
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs md:text-sm text-gray-600">Taken: {calculatedStats.casualLeaves.taken}</p>
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {formatRemaining(calculatedStats.casualLeaves.remaining)}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-theme-primary h-2.5 rounded-full"
                        style={{ width: `${(calculatedStats.casualLeaves.taken / MAX_LEAVES.casual) * 100}%` }}>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyLeavePage;
