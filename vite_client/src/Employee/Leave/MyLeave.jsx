import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getEmployeeLeaves } from '../../context/employeeLeaveSlice'; 
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FaCalendarAlt, FaUmbrellaBeach, FaChartPie, FaChartBar } from 'react-icons/fa';
import { MdSick } from 'react-icons/md';
import { BsCalendarCheck } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56'];

const MyLeavePage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const dispatch = useDispatch();
  const state = useSelector((state) => state.employeeLeave);
  const [activeTab, setActiveTab] = useState('leaves');
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const employee = useSelector(state => state.auth.employee || state.auth.user);

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

  // Fetch leave balance from LeavePolicyManagement
  useEffect(() => {
    if (employee?._id) {
      fetchLeaveBalance();
    }
  }, [employee?._id, selectedYear]);

  const fetchLeaveBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await axios.get(
        `/v1/admin/leave-policy/balance/${employee?._id}`,
        { params: { year: selectedYear } }
      );
      setLeaveBalance(res.data.balance);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      // Set to null explicitly so we can show a message
      setLeaveBalance(null);
      // Only show error if it's not a 404 (no policy configured)
      if (error.response?.status !== 404) {
        // Silently fail - don't show toast for missing policy
      }
    } finally {
      setBalanceLoading(false);
    }
  };

  // Use leave balance from policy if available, otherwise use hardcoded values
  const getMaxLeaves = () => {
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
    return { sick: 12, annual: 12, casual: 12 };
  };

  const MAX_LEAVES = getMaxLeaves();

  const leavesData = state.myLeaves || [];
  const statsData = state.leaveStats || null;

  const calculatedStats = statsData && {
    totalLeaves: leaveBalance?.balances 
      ? leaveBalance.balances.reduce((sum, b) => sum + (b.accrued + b.carriedForward), 0)
      : statsData.totalLeaves,
    remainingLeaves: leaveBalance?.balances
      ? leaveBalance.balances.reduce((sum, b) => sum + b.available, 0)
      : statsData.remainingLeaves,
    sickLeaves: {
      taken: statsData.leavesByType?.sick || 0,
      remaining: MAX_LEAVES.sick - (statsData.leavesByType?.sick || 0)
    },
    annualLeaves: {
      taken: statsData.leavesByType?.annual || 0,
      remaining: MAX_LEAVES.annual - (statsData.leavesByType?.annual || 0)
    },
    casualLeaves: {
      taken: statsData.leavesByType?.casual || 0,
      remaining: MAX_LEAVES.casual - (statsData.leavesByType?.casual || 0)
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

  const leaveHistory = leavesData.map((leave) => ({
    id: leave._id,
    type: leave.leaveType?.charAt(0).toUpperCase() + leave.leaveType?.slice(1),
    startDate: new Date(leave.startDate).toISOString().split('T')[0],
    endDate: new Date(leave.endDate).toISOString().split('T')[0],
    status: leave.status?.charAt(0).toUpperCase() + leave.status?.slice(1),
    days: leave.duration
  }));

  if (state.loading || balanceLoading) {
    return <div className="text-center py-10 text-gray-500">Loading leave data...</div>;
  }

  if (state.error) {
    return <div className="text-center py-10 text-red-500">Error: {state.error}</div>;
  }

  if (!statsData && !leaveBalance) {
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
      remaining: calculatedStats.sickLeaves.remaining
    },
    {
      name: 'Annual',
      taken: calculatedStats.annualLeaves.taken,
      remaining: calculatedStats.annualLeaves.remaining
    },
    {
      name: 'Casual',
      taken: calculatedStats.casualLeaves.taken,
      remaining: calculatedStats.casualLeaves.remaining
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 pt-16 lg:pt-0 ml-0 lg:ml-64 transition-all duration-300">
      <div className="p-4 md:p-8 max-w-screen-2xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Leave Dashboard</h1>
          <div className="flex space-x-2 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'leaves' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FaCalendarAlt className="inline mr-1 md:mr-2" />
              My Leaves
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm md:text-base ${
                activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FaChartPie className="inline mr-1 md:mr-2" />
              Statistics
            </button>
            <button 
              onClick={() => navigate('/leave')}
              className="bg-green-500 text-white rounded-xl px-3 py-1 md:px-4 md:py-2  hover:bg-green-800 transition text-sm md:text-base"
            >
              Apply for Leave
            </button>
          </div>
        </header>

        {/* Leave Balance from Policy */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Leave Balance ({selectedYear})</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="border rounded px-3 py-2"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaveBalance.balances?.map((typeBalance) => {
                  const policyType = leaveBalance.policy?.leaveTypes?.find(lt => lt.type === typeBalance.leaveType);
                  return (
                    <div key={typeBalance.leaveType} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-2 capitalize">
                        {policyType?.displayName || typeBalance.leaveType} Leave
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accrued:</span>
                          <span className="font-medium">{typeBalance.accrued} days</span>
                        </div>
                        {typeBalance.carriedForward > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Carried Forward:</span>
                            <span className="font-medium text-blue-600">+{typeBalance.carriedForward} days</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Used:</span>
                          <span className="font-medium text-red-600">-{typeBalance.used} days</span>
                        </div>
                        {typeBalance.pending > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pending:</span>
                            <span className="font-medium text-yellow-600">-{typeBalance.pending} days</span>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-semibold">Available:</span>
                            <span className={`font-bold text-lg ${
                              typeBalance.available > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {typeBalance.available} days
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                No leave policy configured yet. Please contact HR to set up your leave policy.
              </p>
            </div>
          )}
        </div>

        {/* Monthly Leave Usage */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Monthly Leave Usage</h2>
          {monthlyLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
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
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
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
                  <div className="p-2 rounded-full bg-green-100 text-green-600 mr-3">
                    <BsCalendarCheck size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-500">Remaining Leaves</p>
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
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveHistory.map((leave) => (
                      <tr key={leave.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${leave.type === 'Sick' ? 'bg-red-100 text-red-800' :
                              leave.type === 'Annual' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'}`}>
                            {leave.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.startDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.endDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-500">{leave.days}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${leave.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              leave.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'}`}>
                            {leave.status}
                          </span>
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
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {calculatedStats.sickLeaves.remaining}</p>
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
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {calculatedStats.annualLeaves.remaining}</p>
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
                    <FaCalendarAlt className="mr-2 text-blue-500" /> Casual Leaves
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs md:text-sm text-gray-600">Taken: {calculatedStats.casualLeaves.taken}</p>
                    <p className="text-xs md:text-sm text-gray-600">Remaining: {calculatedStats.casualLeaves.remaining}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full"
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
