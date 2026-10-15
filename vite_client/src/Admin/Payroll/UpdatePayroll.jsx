import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import useUpdatePayroll from '../../Hooks/useUpdatePayroll';

function pfEmployeeFromBasicWage(basicWage) {
  const pfWage = Math.min(Math.max(Number(basicWage) || 0, 0), 15000);
  return Math.round(pfWage * 0.12);
}

function resolvePfEmployee(basicWage, employee) {
  if (employee?.financialDetails?.deductPf === false) return 0;
  return pfEmployeeFromBasicWage(basicWage);
}

function computeEarningsFromGross(gross) {
  const g = Number(gross) || 0;
  const basicWage = Math.round(0.5 * g);
  const houseRentAllowance = Math.round(0.4 * basicWage);
  const specialAllowance = Math.round(g - basicWage - houseRentAllowance);
  return { basicWage, houseRentAllowance, specialAllowance };
}

function earningsWithoutGratuity(earnings) {
  if (!earnings || typeof earnings !== 'object') return {};
  const gratuityLegacy = Number(earnings.gratuity) || 0;
  const { gratuity: _omit, ...rest } = earnings;
  // Legacy split had specialAllowance reduced by gratuity.
  // Fold gratuity into specialAllowance so SPA becomes gross - (Basic + HRA).
  if (gratuityLegacy > 0) {
    rest.specialAllowance = (Number(rest.specialAllowance) || 0) + gratuityLegacy;
  }
  return rest;
}

const UpdatePayroll = () => {
  const navigate = useNavigate();
  const { employeeId, month, year } = useParams();
  const { updateEmployeePayroll } = useUpdatePayroll();
  const payrolls = useSelector(state => state.payroll.data);
  const { selectedPayroll } = useSelector(state => state.adminEmployeePayroll);
  const { employees } = useSelector(state => state.employees);

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
      basicSalary: 0, // Gross salary/CTC for the period
      month: monthIndex >= 0 ? monthIndex : 0,
      year: parseInt(year) || new Date().getFullYear(),
      earnings: {
        basicWage: 0,
        houseRentAllowance: 0,
        overtime: 0,
        specialAllowance: 0,
        pfEmployer: 0,
        esiEmployer: 0,
      },
      deductions: {
        pfEmployee: 0,
        esiEmployee: 0,
        professionalTax: 0,
        incomeTax: 0,
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

  const payrollEmployee = (Array.isArray(employees) ? employees : []).find(
    (emp) => String(emp._id) === String(formData.employeeId)
  );

  const extractId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') return value._id || value.id || '';
    return String(value);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const resolveGrossSalary = (payrollRecord) => {
    const direct = Number(payrollRecord?.basicSalary);
    const e = payrollRecord?.earnings || {};
    const componentGross =
      (Number(e.basicWage) || 0) +
      (Number(e.houseRentAllowance) || 0) +
      (Number(e.transportAllowance) || 0) +
      (Number(e.medicalAllowance) || 0) +
      (Number(e.specialAllowance) || 0);
    const isLegacyBasicStoredAsGross =
      Number.isFinite(direct) &&
      direct > 0 &&
      direct === (Number(e.basicWage) || 0) &&
      componentGross > direct;

    if (Number.isFinite(direct) && direct > 0 && !isLegacyBasicStoredAsGross) return direct;
    if (componentGross > 0) return componentGross;
    const ctc = Number(payrollRecord?.ctc);
    if (Number.isFinite(ctc) && ctc > 0) return ctc;
    const totalEarnings = Number(payrollRecord?.earnings?.totalEarnings);
    if (Number.isFinite(totalEarnings) && totalEarnings > 0) return totalEarnings;
    return componentGross;
  };

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
        // 1) Deterministic lookup: route param may actually be payrollId in some edit flows.
        try {
          const { default: axiosInstance } = await import('../../utils/axios');
          const detailsResponse = await axiosInstance.get(`/v1/admin/payroll/details/${employeeId}`);
          const detailsData = detailsResponse.data?.data || detailsResponse.data;
          if (detailsData?._id) {
            setFormData({
              employeeId: detailsData.employeeId?._id || detailsData.employeeId || employeeId,
              payrollId: detailsData._id,
              basicSalary: resolveGrossSalary(detailsData),
              month: months.indexOf(detailsData.month),
              year: detailsData.year,
              earnings: earningsWithoutGratuity(detailsData.earnings),
              deductions: detailsData.deductions || {},
              status: detailsData.status || 'Pending',
            });
            setDataLoading(false);
            setIsFetching(false);
            setError(null);
            return;
          }
        } catch (_) {
          // Ignore and continue with employeeId + month/year lookup.
        }

        // Try local payroll list first (fresh list data when available)
        if (payrolls.length > 0) {
          const payroll = payrolls.find((p) => (
            extractId(p.employeeId) === String(employeeId) &&
            p.month === months[parseInt(month)] &&
            p.year === parseInt(year)
          ));
          if (payroll) {
            setFormData({
              employeeId: extractId(payroll.employeeId),
              payrollId: payroll._id,
              basicSalary: resolveGrossSalary(payroll),
              month: months.indexOf(payroll.month),
              year: payroll.year,
              earnings: earningsWithoutGratuity(payroll.earnings),
              deductions: payroll.deductions || {},
              status: payroll.status || 'Pending',
            });
            setDataLoading(false);
            setIsFetching(false);
            setError(null);
            return;
          }
        }

        // Always fetch canonical record from API before falling back to selectedPayroll.
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

          // Use configured axios instance instead of fetch
          const { default: axiosInstance } = await import('../../utils/axios');
          const response = await axiosInstance.get(`/v1/admin/payroll/admin-payroll/${employeeId}/${encodeURIComponent(monthName)}/${year}`);
          
          // Check if response has data property (new API format) or is direct object
          const payrollData = response.data?.data || response.data;
          
          if (payrollData?._id) {
            setFormData({
              employeeId: payrollData.employeeId?._id || payrollData.employeeId,
              payrollId: payrollData._id,
              basicSalary: resolveGrossSalary(payrollData),
              month: months.indexOf(payrollData.month),
              year: payrollData.year,
              earnings: earningsWithoutGratuity(payrollData.earnings),
              deductions: payrollData.deductions || {},
              status: payrollData.status || 'Pending',
            });
            setError(null);
          } else {
            // Last fallback for navigation from details modal state
            if (selectedPayroll && extractId(selectedPayroll.employeeId) === String(employeeId)) {
              setFormData({
                employeeId: extractId(selectedPayroll.employeeId),
                payrollId: selectedPayroll._id,
                basicSalary: resolveGrossSalary(selectedPayroll),
                month: months.indexOf(selectedPayroll.month),
                year: selectedPayroll.year,
                earnings: earningsWithoutGratuity(selectedPayroll.earnings),
                deductions: selectedPayroll.deductions || {},
                status: selectedPayroll.status || 'Pending',
              });
              setError(null);
            } else {
              setFormData(prev => ({
                ...prev,
                employeeId,
                basicSalary: 0,
                month: parseInt(month),
                year: parseInt(year),
                payrollId: '', // No existing payroll, will create on update
              }));
              setError(null);
            }
          }
        } catch (error) {
          // Removed console.error for production
          if (error.response?.status === 404) {
            // Fallback for routes where param can be a payrollId.
            try {
              const { default: axiosInstance } = await import('../../utils/axios');
              const detailsResponse = await axiosInstance.get(`/v1/admin/payroll/details/${employeeId}`);
              const detailsData = detailsResponse.data?.data || detailsResponse.data;

              if (detailsData?._id) {
                setFormData({
                  employeeId: detailsData.employeeId?._id || detailsData.employeeId || employeeId,
                  payrollId: detailsData._id,
                  basicSalary: resolveGrossSalary(detailsData),
                  month: months.indexOf(detailsData.month),
                  year: detailsData.year,
                  earnings: earningsWithoutGratuity(detailsData.earnings),
                  deductions: detailsData.deductions || {},
                  status: detailsData.status || 'Pending',
                });
                setError(null);
              } else {
                setFormData(prev => ({
                  ...prev,
                  employeeId,
                  basicSalary: 0,
                  month: parseInt(month),
                  year: parseInt(year),
                  payrollId: '', // No existing payroll, will create on update
                }));
                setError(null);
              }
            } catch (_) {
              // Payroll doesn't exist yet - that's okay, user can create it
              setFormData(prev => ({
                ...prev,
                employeeId,
                basicSalary: 0,
                month: parseInt(month),
                year: parseInt(year),
                payrollId: '', // No existing payroll, will create on update
              }));
              setError(null);
            }
          } else if (!error.message?.includes('Failed to fetch') && !error.message?.includes('ERR_INSUFFICIENT')) {
            setError(error.response?.data?.message || 'Failed to load payroll data. Please check your connection.');
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
    if (name === 'basicSalary') {
      const gross = Number(value) || 0;
      const formula = computeEarningsFromGross(gross);
      setFormData(prev => ({
        ...prev,
        basicSalary: gross,
        earnings: {
          ...prev.earnings,
          basicWage: formula.basicWage,
          houseRentAllowance: formula.houseRentAllowance,
          specialAllowance: formula.specialAllowance
        },
        deductions: {
          ...prev.deductions,
          pfEmployee: resolvePfEmployee(formula.basicWage, payrollEmployee)
        }
      }));
      return;
    }
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
    const earningsTotal = Object.entries(formData.earnings)
      .filter(([key]) => key !== 'totalEarnings' && key !== 'gratuity')
      .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);
    const pfEmployee = resolvePfEmployee(formData.earnings.basicWage, payrollEmployee);
    const deductionsTotal =
      Object.entries(formData.deductions)
        .filter(([key]) => key !== 'total' && key !== 'pfEmployee')
        .reduce((sum, [, val]) => sum + (Number(val) || 0), 0) + pfEmployee;
    const inHandSalary = earningsTotal - deductionsTotal;
    return { earningsTotal, deductionsTotal, inHandSalary, pfEmployee };
  };

  const { earningsTotal, deductionsTotal, inHandSalary, pfEmployee } = calculateTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const monthName = months[formData.month];
    if (!formData.payrollId) {
      setLoading(false);
      setError('No payroll record exists for this period. Redirecting to create payroll.');
      setTimeout(() => {
        navigate(`/add-payroll/${employeeId}/${encodeURIComponent(monthName)}/${formData.year}`);
      }, 800);
      return;
    }

    const payload = {
      ...formData,
      month: monthName,
      earnings: { ...formData.earnings, totalEarnings: earningsTotal },
      deductions: { ...formData.deductions, pfEmployee, total: deductionsTotal },
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
      // Removed console.error for production
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="p-5 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payroll data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell bg-gray-50 transition-all duration-300">
      <div className="page-shell-inner">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Update Payroll</h2>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-theme-primary/10 border border-theme-primary text-theme-primary px-4 py-2 rounded-lg mb-4 text-sm">{success}</div>}

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
          <h3 className="text-base font-semibold mb-3">Gross Salary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="basicSalary">
                Gross Salary (CTC)
              </label>
              <input
                type="number"
                id="basicSalary"
                name="basicSalary"
                value={formData.basicSalary || 0}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                min="0"
                step="0.01"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Updating gross recalculates Basic Wage, HRA, Special Allowance, and PF Employee.
              </p>
            </div>
          </div>
        </div>

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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-pfEmployee">
                PF Employee (12% of min(basic wage, ₹15,000))
              </label>
              <input
                type="number"
                id="deductions-pfEmployee"
                readOnly
                value={pfEmployee}
                className="border border-gray-200 rounded-lg w-full py-2 px-3 text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                min="0"
                step="0.01"
              />
            </div>
            <div key="professionalTax">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-professionalTax">Professional Tax</label>
              <input
                type="number"
                id="deductions-professionalTax"
                name="professionalTax"
                value={formData.deductions.professionalTax || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                min="0"
                step="0.01"
              />
            </div>
            <div key="incomeTax">
              <label className="block text-gray-700 text-xs font-medium mb-1.5" htmlFor="deductions-incomeTax">Income Tax</label>
              <input
                type="number"
                id="deductions-incomeTax"
                name="incomeTax"
                value={formData.deductions.incomeTax || 0}
                onChange={handleDeductionsChange}
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
            <div className="bg-theme-secondary/10 p-3 rounded-lg border border-theme-secondary">
              <h4 className="text-xs font-medium text-theme-secondary mb-1">Total Earnings</h4>
              <p className="text-lg font-semibold">{formatCurrency(earningsTotal)}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <h4 className="text-xs font-medium text-red-800 mb-1">Total Deductions</h4>
              <p className="text-lg font-semibold">{formatCurrency(deductionsTotal)}</p>
            </div>
            <div className="bg-theme-primary/10 p-3 rounded-lg border border-theme-primary">
              <h4 className="text-xs font-medium text-theme-primary mb-1">In-Hand Salary</h4>
              <p className="text-lg font-semibold">{formatCurrency(inHandSalary)}</p>
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
            className="border border-gray-300 rounded-lg w-full py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
            className="bg-theme-primary hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg transition text-sm disabled:opacity-50"
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
