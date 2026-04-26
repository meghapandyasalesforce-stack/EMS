import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchEmployees } from '../../context/employeeSlice';
import { createPayroll, updatePayroll } from '../../context/payrollSlice';
import { FiUser, FiDollarSign, FiCalendar, FiSave, FiArrowLeft } from 'react-icons/fi';

// Salary formula: Basic = 50% Gross, HRA = 40% Basic, Special = Gross − Basic − HRA
function computeEarningsFromGross(gross) {
    const g = Number(gross) || 0;
    const basicWage = Math.round(0.5 * g);
    const houseRentAllowance = Math.round(0.4 * basicWage);
    const specialAllowance = Math.round(g - basicWage - houseRentAllowance);
    return { basicWage, houseRentAllowance, specialAllowance };
}

function pfEmployeeFromBasicWage(basicWage) {
    const pfWage = Math.min(Math.max(Number(basicWage) || 0, 0), 15000);
    return Math.round(pfWage * 0.12);
}

const AddPayroll = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { employeeId, month, year } = useParams();
    const [searchParams] = useSearchParams();
    const queryEmployeeId = searchParams.get('employeeId') || '';
    const queryMonth = searchParams.get('month') || '';
    const queryYearRaw = searchParams.get('year');
    const queryYear = queryYearRaw ? Number(queryYearRaw) : NaN;
    const queryType = searchParams.get('type') === 'off_cycle' ? 'off_cycle' : 'monthly';
    const querySubType = searchParams.get('subType') || 'correction';
    const queryAdjustmentMode = searchParams.get('adjustmentMode') || 'full_override';
    const prefilledEmployeeId = employeeId || queryEmployeeId;
    const prefilledMonth = month || queryMonth;
    const prefilledYear = year || (Number.isFinite(queryYear) ? queryYear : undefined);
    
    const { employees } = useSelector(state => state.employees);
    const { loading, error } = useSelector(state => state.payroll);
    
    const [formData, setFormData] = useState({
        employeeId: prefilledEmployeeId || '',
        month: prefilledMonth || new Date().toLocaleString('default', { month: 'long' }),
        year: prefilledYear ? parseInt(prefilledYear) : new Date().getFullYear(),
        basicSalary: 0,
        type: queryType,
        subType: querySubType,
        adjustmentMode: queryAdjustmentMode,
        earnings: {
            basicWage: 0,
            houseRentAllowance: 0,
            transportAllowance: 0,
            medicalAllowance: 0,
            overtime: 0,
            specialAllowance: 0,
            performanceBonus: 0,
            projectBonus: 0,
            attendanceBonus: 0,
            pfEmployer: 0,
            esiEmployer: 0
        },
        deductions: {
            pfEmployee: 0,
            esiEmployee: 0,
            professionalTax: 0,
            incomeTax: 0,
            advanceSalary: 0,
            loanDeduction: 0,
            otherDeductions: 0
        },
        notes: '',
        status: 'Pending'
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const isOffCycleMode = formData.type === 'off_cycle';
    const isMonthlyMode = !isOffCycleMode;
    const employeeSelectionLocked = Boolean(prefilledEmployeeId);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

    useEffect(() => {
        dispatch(fetchEmployees({ fetchAllPages: true }));
    }, [dispatch]);

    useEffect(() => {
        if (prefilledEmployeeId && employees.length > 0) {
            const employee = employees.find(emp => emp._id === prefilledEmployeeId);
            if (employee) {
                setSelectedEmployee(employee);
                const gross = employee.salary || 0;
                const formula = computeEarningsFromGross(gross);
                setFormData(prev => ({
                    ...prev,
                    employeeId: employee._id,
                    // Store gross/current salary into the top "basicSalary" field (backend field name),
                    // while earnings.basicWage below remains derived from gross.
                    basicSalary: gross,
                    earnings: {
                        ...prev.earnings,
                        basicWage: formula.basicWage,
                        houseRentAllowance: formula.houseRentAllowance,
                        specialAllowance: formula.specialAllowance
                    },
                    deductions: {
                        ...prev.deductions,
                        pfEmployee: pfEmployeeFromBasicWage(formula.basicWage)
                    }
                }));
            }
        }
    }, [prefilledEmployeeId, employees]);

    const handleEmployeeSelect = (selectedEmployeeId) => {
        const employee = employees.find(emp => emp._id === selectedEmployeeId);
        setSelectedEmployee(employee);
        const gross = employee?.salary || 0;
        const formula = computeEarningsFromGross(gross);
        setFormData(prev => ({
            ...prev,
            employeeId: selectedEmployeeId,
            // Top field should represent gross/current salary for this employee.
            basicSalary: gross,
            earnings: {
                ...prev.earnings,
                basicWage: formula.basicWage,
                houseRentAllowance: formula.houseRentAllowance,
                specialAllowance: formula.specialAllowance
            },
            deductions: {
                ...prev.deductions,
                pfEmployee: pfEmployeeFromBasicWage(formula.basicWage)
            }
        }));
    };

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;

        if (isMonthlyMode && name === 'basicSalary') {
            return;
        }

        // For numeric inputs (e.g. basicSalary), keep a numeric value so we don't get leading zeros like "012"
        let nextValue;
        if (type === 'number') {
            // Allow the field to be cleared completely
            if (value === '') {
                nextValue = '';
            } else {
                nextValue = Number(value);
            }
        } else {
            nextValue = value;
        }

        // If the top salary (gross/current) changes, recompute earnings breakdown from that gross.
        if (name === 'basicSalary') {
            if (nextValue === '') {
                setFormData(prev => ({ ...prev, basicSalary: '' }));
                return;
            }

            const gross = Number(nextValue) || 0;
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
                    pfEmployee: pfEmployeeFromBasicWage(formula.basicWage)
                }
            }));
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: nextValue
        }));
    };

    const handleEarningsChange = (e) => {
        if (isMonthlyMode) return;
        const { name, value } = e.target;
        // Strip leading zeros when there are multiple digits so \"0\" + \"12\" doesn't become \"012\"
        const normalized = value.replace(/^0+(?=\\d)/, '');
        setFormData(prev => {
            const nextEarnings = {
                ...prev.earnings,
                [name]: normalized
            };
            const basicWage = Number(nextEarnings.basicWage) || 0;
            return {
                ...prev,
                earnings: nextEarnings,
                deductions: {
                    ...prev.deductions,
                    pfEmployee: pfEmployeeFromBasicWage(basicWage)
                }
            };
        });
    };

    const handleDeductionsChange = (e) => {
        if (isMonthlyMode) return;
        const { name, value } = e.target;
        const normalized = value.replace(/^0+(?=\\d)/, '');
        setFormData(prev => ({
            ...prev,
            deductions: {
                ...prev.deductions,
                [name]: normalized
            }
        }));
    };

    const calculateTotals = () => {
        const earningsTotal = Object.entries(formData.earnings)
            .filter(([key]) => key !== 'totalEarnings' && key !== 'gratuity')
            .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);
        const deductionsTotal = Object.entries(formData.deductions)
            .filter(([key]) => key !== 'total')
            .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);
        const inHandSalary = earningsTotal - deductionsTotal;

        return { earningsTotal, deductionsTotal, inHandSalary };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { earningsTotal, deductionsTotal, inHandSalary } = calculateTotals();

        const payload = {
            ...formData,
            earnings: {
                ...formData.earnings,
                totalEarnings: earningsTotal
            },
            deductions: {
                ...formData.deductions,
                total: deductionsTotal
            },
            type: formData.type,
            subType: formData.type === 'off_cycle' ? formData.subType : undefined,
            adjustmentMode: formData.type === 'off_cycle' ? formData.adjustmentMode : undefined,
            ctc: earningsTotal,
            inHandSalary: inHandSalary
        };

        if (isEditMode) {
            const result = await dispatch(updatePayroll({ payrollId: formData._id, updatedData: payload }));
            if (updatePayroll.fulfilled.match(result)) {
                toast.success('Payroll updated successfully.');
                navigate('/admin-payroll');
            } else if (updatePayroll.rejected.match(result)) {
                const errMsg = result.payload || 'Failed to update payroll';
                toast.error(errMsg);
            }
        } else {
            const result = await dispatch(createPayroll(payload));
            if (createPayroll.fulfilled.match(result)) {
                toast.success(formData.type === 'off_cycle' ? 'Payroll correction created successfully.' : 'Payroll created successfully.');
                navigate('/admin-payroll');
            } else if (createPayroll.rejected.match(result)) {
                const errMsg = result.payload || 'Failed to create payroll';
                toast.error(errMsg);
            }
        }
    };

    const { earningsTotal, deductionsTotal, inHandSalary } = calculateTotals();

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center space-x-4 mb-4">
                        <button
                            onClick={() => navigate('/admin-payroll')}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                            <span>Back to Payroll</span>
                        </button>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEditMode ? 'Edit Payroll' : (isOffCycleMode ? 'Add Payroll Correction' : 'Add New Payroll')}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {isEditMode
                            ? 'Update employee payroll information'
                            : isOffCycleMode
                              ? 'Create an off-cycle correction for a generated payroll period'
                              : 'Create payroll for an employee'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <span className="text-red-800">{error}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8">
                    {/* Employee Selection */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <FiUser className="w-5 h-5 mr-2" />
                            Employee Information
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Employee *
                                </label>
                                <select
                                    value={formData.employeeId}
                                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    required
                                    disabled={employeeSelectionLocked} // Disable if employee is pre-selected
                                >
                                    <option value="">Choose an employee...</option>
                                    {(Array.isArray(employees) ? employees : []).map(employee => (
                                        <option key={employee._id} value={employee._id}>
                                            {employee.name} {employee.lastName} - {employee.jobTitle}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedEmployee && (
                                <div className="bg-theme-secondary/10 rounded-lg p-4">
                                    <h3 className="font-medium text-[var(--color-text)] mb-2">Selected Employee</h3>
                                    <p className="text-theme-secondary">
                                        <strong>{selectedEmployee.name} {selectedEmployee.lastName}</strong>
                                    </p>
                                    <p className="text-sm text-theme-secondary">
                                        {selectedEmployee.jobTitle} • {selectedEmployee.department}
                                    </p>
                                    <p className="text-sm text-theme-secondary">
                                        Current Salary: ₹{selectedEmployee.salary?.toLocaleString() || 'Not set'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Month and Year */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <FiCalendar className="w-5 h-5 mr-2" />
                            Payroll Period
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                                <select
                                    name="month"
                                    value={formData.month}
                                    onChange={handleInputChange}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    required
                                >
                                    {months.map(month => (
                                        <option key={month} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                                <select
                                    name="year"
                                    value={formData.year}
                                    onChange={handleInputChange}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    required
                                >
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Payroll Entry Type */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payroll Entry Type</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    disabled={queryType === 'off_cycle'}
                                >
                                    <option value="monthly">Monthly Payroll</option>
                                    <option value="off_cycle">Off-cycle Correction</option>
                                </select>
                            </div>
                            {isOffCycleMode && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm font-medium text-amber-800">Correction Mode</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        This creates a separate adjustment record without editing locked processed payroll.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {isOffCycleMode && (
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Correction Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Correction Category</label>
                                    <select
                                        name="subType"
                                        value={formData.subType}
                                        onChange={handleInputChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    >
                                        <option value="correction">Correction</option>
                                        <option value="bonus">Bonus</option>
                                        <option value="fnf">Full and Final (F&F)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Correction Impact</label>
                                    <select
                                        name="adjustmentMode"
                                        value={formData.adjustmentMode}
                                        onChange={handleInputChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                    >
                                        <option value="deduction">Reduce net pay</option>
                                        <option value="earning">Increase net pay</option>
                                        <option value="full_override">Full override (special case)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Correction Notes</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        rows={3}
                                        required={isOffCycleMode}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                        placeholder="Reason for this correction (recommended for audit trail)"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gross / Current Salary */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <FiDollarSign className="w-5 h-5 mr-2" />
                            {isOffCycleMode ? 'Correction Amount Inputs' : 'Gross/Current Salary'}
                        </h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Gross/Current Salary (₹)</label>
                            <input
                                type="number"
                                name="basicSalary"
                                value={formData.basicSalary}
                                onChange={handleInputChange}
                                className={`w-full p-3 rounded-lg ${
                                    isMonthlyMode
                                        ? 'border border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                        : 'border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                                }`}
                                placeholder="Enter gross/current salary"
                                required
                                readOnly={isMonthlyMode}
                            />
                            {isMonthlyMode && (
                                <p className="mt-2 text-sm text-gray-500">
                                    Monthly payroll amount is auto-calculated from employee salary, attendance, approved leaves, and payroll period dates.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Earnings */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Earnings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(formData.earnings)
                                .filter(([key]) => key !== 'gratuity')
                                .map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name={key}
                                        value={value}
                                        onChange={handleEarningsChange}
                                        className={`w-full p-3 rounded-lg ${
                                            isMonthlyMode
                                                ? 'border border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                                : 'border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                                        }`}
                                        placeholder="0"
                                        readOnly={isMonthlyMode}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Deductions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pf Employee — 12% of min(basic wage, ₹15,000) (₹)
                                </label>
                                <input
                                    type="number"
                                    readOnly
                                    value={formData.deductions.pfEmployee}
                                    className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                                />
                            </div>
                            {Object.entries(formData.deductions)
                                .filter(([key]) => key !== 'pfEmployee')
                                .map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name={key}
                                        value={value}
                                        onChange={handleDeductionsChange}
                                        className={`w-full p-3 rounded-lg ${
                                            isMonthlyMode
                                                ? 'border border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                                : 'border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]'
                                        }`}
                                        placeholder="0"
                                        readOnly={isMonthlyMode}
                                    />
                                </div>
                            ))}
                        </div>
                        {isMonthlyMode && (
                            <p className="mt-3 text-sm text-gray-500">
                                These values are preview-only here. The backend recalculates monthly payroll at save time from attendance and leave data.
                            </p>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="mb-8 bg-gray-50 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payroll Summary</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-theme-primary/10 rounded-lg p-4">
                                <h3 className="font-medium text-theme-primary mb-2">Total Earnings</h3>
                                <p className="text-2xl font-bold text-theme-primary">₹{earningsTotal.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4">
                                <h3 className="font-medium text-red-800 mb-2">Total Deductions</h3>
                                <p className="text-2xl font-bold text-red-700">₹{deductionsTotal.toLocaleString()}</p>
                            </div>
                            <div className="bg-theme-secondary/10 rounded-lg p-4">
                                <h3 className="font-medium text-theme-secondary mb-2">In-Hand Salary</h3>
                                <p className="text-2xl font-bold text-theme-secondary">₹{inHandSalary.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate('/admin-payroll')}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2 disabled:opacity-50"
                        >
                            <FiSave className="w-4 h-4" />
                            <span>{loading ? 'Saving...' : (isEditMode ? 'Update Payroll' : 'Create Payroll')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPayroll;
