import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import useUpdatePayroll from '../../Hooks/useUpdatePayroll';

const UpdatePayroll = () => {
  const navigate = useNavigate();
  const { employeeId, month, year } = useParams();
  const { updateEmployeePayroll } = useUpdatePayroll();
  const payrolls = useSelector(state => state.payroll.data);
  const { selectedPayroll } = useSelector(state => state.adminEmployeePayroll);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const [formData, setFormData] = useState(() => {
    // Handle month - it could be a number (index) or string (month name)
    let monthIndex = 0;
    if (month) {
      const monthNum = parseInt(month);
      if (!isNaN(monthNum)) {
        monthIndex = monthNum;
      } else {
        // It's a month name, find its index
        monthIndex = months.indexOf(month);
      }
    }
    
    return {
      employeeId: employeeId || '',
      payrollId: '', // Add payrollId to track the actual payroll record
      month: monthIndex >= 0 ? monthIndex : 0,
      year: parseInt(year) || new Date().getFullYear(),
      earnings: {
        basicWage: 0,
        houseRentAllowance: 0,
        overtime: 0,
        gratuity: 0,
        specialAllowance: 0,
        pfEmployer: 0,
        esiEmployer: 0,
      },
      deductions: {
        pfEmployee: 0,
        esiEmployee: 0,
        tax: 0,
        otherDeductions: 0,
      },
      status: 'Pending',
    };
  });

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  // Find payroll data for current employee/month/year
  useEffect(() => {
    const loadPayrollData = async () => {
      // Prevent multiple simultaneous fetches
      if (isFetching) {
        return;
      }
      
      setDataLoading(true);
      setIsFetching(true);
      
      if (employeeId && month && year) {
        // First try to find in selectedPayroll (from admin employee payroll page)
        if (selectedPayroll && selectedPayroll.employeeId === employeeId) {
          setFormData({
            employeeId: selectedPayroll.employeeId,
            payrollId: selectedPayroll._id,
            month: months.indexOf(selectedPayroll.month),
            year: selectedPayroll.year,
            earnings: selectedPayroll.earnings || {},
            deductions: selectedPayroll.deductions || {},
            status: selectedPayroll.status || 'Pending',
          });
          setDataLoading(false);
          setIsFetching(false);
          setError(null);
          return;
        }

        // If not found in selectedPayroll, try to find in payrolls array
        if (payrolls.length > 0) {
          const payroll = payrolls.find(
            (p) =>
              p.employeeId === employeeId &&
              p.month === months[parseInt(month)] &&
              p.year === parseInt(year)
          );
          if (payroll) {
            setFormData({
              employeeId: payroll.employeeId,
              payrollId: payroll._id,
              month: months.indexOf(payroll.month),
              year: payroll.year,
              earnings: payroll.earnings || {},
              deductions: payroll.deductions || {},
              status: payroll.status || 'Pending',
            });
            setDataLoading(false);
            setIsFetching(false);
            setError(null);
            return;
          }
        }

        // If still not found, try to fetch from API
        try {
          // Handle month - it could be a number (index) or string (month name)
          let monthName;
          if (month && !isNaN(parseInt(month))) {
            // If month is a number, get the month name
            monthName = months[parseInt(month)];
          } else if (month && isNaN(parseInt(month))) {
            // If month is already a string (month name), use it directly
            monthName = month;
          } else {
            // Fallback to January
            monthName = months[0];
          }

          const response = await fetch(`http://localhost:5000/api/v1/admin/payroll/admin-payroll/${employeeId}/${encodeURIComponent(monthName)}/${year}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            const payroll = await response.json();
            
            // Check if response has data property (new API format) or is direct object
            const payrollData = payroll.data || payroll;
            
            if (payrollData._id) {
              setFormData({
                employeeId: payrollData.employeeId?._id || payrollData.employeeId,
                payrollId: payrollData._id,
                month: months.indexOf(payrollData.month),
                year: payrollData.year,
                earnings: payrollData.earnings || {},
                deductions: payrollData.deductions || {},
                status: payrollData.status || 'Pending',
              });
              setError(null);
            } else {
              setError('Payroll data structure is invalid');
            }
          } else if (response.status === 404) {
            // Payroll doesn't exist yet - that's okay, user can create it
            setFormData(prev => ({
              ...prev,
              employeeId,
              month: parseInt(month),
              year: parseInt(year),
              payrollId: '', // No existing payroll, will create on update
            }));
            setError(null);
          } else {
            const errorData = await response.json();
            setError(errorData.message || 'Failed to fetch payroll data');
          }
        } catch (error) {
          console.error('Error loading payroll data:', error);
          if (!error.message.includes('Failed to fetch') || !error.message.includes('ERR_INSUFFICIENT')) {
            setError('Failed to load payroll data. Please check your connection.');
          } else {
            setError(null); // Silently ignore network errors to prevent infinite loops
          }
        } finally {
          setDataLoading(false);
          setIsFetching(false);
        }
      } else {
        setDataLoading(false);
        setIsFetching(false);
      }
    };

    loadPayrollData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, month, year]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEarningsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      earnings: { ...prev.earnings, [name]: parseFloat(value) || 0 },
    }));
  };

  const handleDeductionsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [name]: parseFloat(value) || 0 },
    }));
  };

  const calculateTotals = () => {
    const earningsTotal = Object.values(formData.earnings).reduce((sum, val) => sum + (val || 0), 0);
    const deductionsTotal = Object.values(formData.deductions).reduce((sum, val) => sum + (val || 0), 0);
    const inHandSalary = earningsTotal - deductionsTotal;
    return { earningsTotal, deductionsTotal, inHandSalary };
  };

  const { earningsTotal, deductionsTotal, inHandSalary } = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      ...formData,
      month: months[formData.month],
      earnings: { ...formData.earnings, totalEarnings: earningsTotal },
      deductions: { ...formData.deductions, total: deductionsTotal },
      ctc: earningsTotal,
      inHandSalary,
    };

    try {
      const result = await updateEmployeePayroll(formData.payrollId, payload);
      if (result.success) {
        setSuccess('Payroll updated successfully!');
        setTimeout(() => navigate('/admin-payroll'), 2000);
      } else {
        setError(result.error?.message || result.error || 'Failed to update payroll');
      }
    } catch (error) {
      setError('Failed to update payroll');
      console.error('Update error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="p-5 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payroll data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5 ml-64">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Update Payroll</h2>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg px-6 py-5 mb-4 border border-gray-200">
        {/* Employee Select - disabled */}
        {/* <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employeeId">Employee</label>
          <select
            id="employeeId"
            name="employeeId"
            value={formData.employeeId}
            disabled
            className="shadow appearance-none border rounded w-full py-2 px-3"
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>{emp.name} ({emp.designation})</option>
            ))}
          </select>
        </div> */}

        {/* Month and Year selects - disabled */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="month">Month</label>
            <select id="month" name="month" value={formData.month}  className="shadow appearance-none border rounded w-full py-2 px-3">
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="year">Year</label>
            <select id="year" name="year" value={formData.year} className="shadow appearance-none border rounded w-full py-2 px-3">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div> */}

        {/* Earnings inputs */}
        <div className="mb-5">
          <h3 className="text-base font-semibold mb-3">Earnings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div key="basicWage">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-basicWage">Basic Wage</label>
              <input
                type="number"
                id="earnings-basicWage"
                name="basicWage"
                value={formData.earnings.basicWage || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="houseRentAllowance">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-houseRentAllowance">House Rent Allowance</label>
              <input
                type="number"
                id="earnings-houseRentAllowance"
                name="houseRentAllowance"
                value={formData.earnings.houseRentAllowance || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="overtime">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-overtime">Overtime</label>
              <input
                type="number"
                id="earnings-overtime"
                name="overtime"
                value={formData.earnings.overtime || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="gratuity">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-gratuity">Gratuity</label>
              <input
                type="number"
                id="earnings-gratuity"
                name="gratuity"
                value={formData.earnings.gratuity || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="specialAllowance">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-specialAllowance">Special Allowance</label>
              <input
                type="number"
                id="earnings-specialAllowance"
                name="specialAllowance"
                value={formData.earnings.specialAllowance || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="pfEmployer">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-pfEmployer">PF Employer</label>
              <input
                type="number"
                id="earnings-pfEmployer"
                name="pfEmployer"
                value={formData.earnings.pfEmployer || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="esiEmployer">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="earnings-esiEmployer">ESI Employer</label>
              <input
                type="number"
                id="earnings-esiEmployer"
                name="esiEmployer"
                value={formData.earnings.esiEmployer || 0}
                onChange={handleEarningsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Deductions inputs */}
        <div className="mb-5">
          <h3 className="text-base font-semibold mb-3">Deductions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div key="pfEmployee">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-pfEmployee">PF Employee</label>
              <input
                type="number"
                id="deductions-pfEmployee"
                name="pfEmployee"
                value={formData.deductions.pfEmployee || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="esiEmployee">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-esiEmployee">ESI Employee</label>
              <input
                type="number"
                id="deductions-esiEmployee"
                name="esiEmployee"
                value={formData.deductions.esiEmployee || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="tax">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-tax">Tax</label>
              <input
                type="number"
                id="deductions-tax"
                name="tax"
                value={formData.deductions.tax || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
            <div key="otherDeductions">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-otherDeductions">Other Deductions</label>
              <input
                type="number"
                id="deductions-otherDeductions"
                name="otherDeductions"
                value={formData.deductions.otherDeductions || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-5">
          <h3 className="text-base font-semibold mb-3">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h4 className="text-xs font-medium text-blue-800 mb-1">Total Earnings</h4>
              <p className="text-lg font-semibold">${earningsTotal.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <h4 className="text-xs font-medium text-red-800 mb-1">Total Deductions</h4>
              <p className="text-lg font-semibold">${deductionsTotal.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <h4 className="text-xs font-medium text-green-800 mb-1">In-Hand Salary</h4>
              <p className="text-lg font-semibold">${inHandSalary.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Status select */}
        <div className="mb-4">
          <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Pending">Pending</option>
            <option value="Processed">Processed</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition text-sm disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Payroll'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

export default UpdatePayroll;
