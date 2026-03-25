import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchEmployees } from '../../context/employeeSlice';
import { createPayroll, updatePayroll } from '../../context/payrollSlice';
import { FiUser, FiDollarSign, FiCalendar, FiSave, FiArrowLeft } from 'react-icons/fi';

// Salary formula: Basic = 50% Gross, HRA = 40% Basic, Gratuity = 4.81% Basic, Special = balance
function computeEarningsFromGross(gross) {
    const g = Number(gross) || 0;
    const basicWage = Math.round(0.5 * g);
    const houseRentAllowance = Math.round(0.4 * basicWage);
    const gratuity = Math.round(0.0481 * basicWage);
    const specialAllowance = Math.round(g - basicWage - houseRentAllowance - gratuity);
    return { basicWage, houseRentAllowance, gratuity, specialAllowance };
}

function pfEmployeeFromBasicWage(basicWage) {
    return Math.round((Number(basicWage) || 0) * 0.12);
}

const AddPayroll = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { employeeId, month, year } = useParams();
    
    const { employees } = useSelector(state => state.employees);
    const { loading, error } = useSelector(state => state.payroll);
    
    const [formData, setFormData] = useState({
        employeeId: employeeId || '',
        month: month || new Date().toLocaleString('default', { month: 'long' }),
        year: year ? parseInt(year) : new Date().getFullYear(),
        basicSalary: 0,
        earnings: {
            basicWage: 0,
            houseRentAllowance: 0,
            transportAllowance: 0,
            medicalAllowance: 0,
            overtime: 0,
            gratuity: 0,
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
        status: 'Pending'
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

    useEffect(() => {
        dispatch(fetchEmployees());
    }, [dispatch]);

    useEffect(() => {
        if (employeeId && employees.length > 0) {
            const employee = employees.find(emp => emp._id === employeeId);
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
                        gratuity: formula.gratuity,
                        specialAllowance: formula.specialAllowance
                    },
                    deductions: {
                        ...prev.deductions,
                        pfEmployee: pfEmployeeFromBasicWage(formula.basicWage)
                    }
                }));
            }
        }
    }, [employeeId, employees]);

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
                gratuity: formula.gratuity,
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
                    gratuity: formula.gratuity,
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
            .filter(([key]) => key !== 'totalEarnings')
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
                toast.success('Payroll created successfully.');
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
                        {isEditMode ? 'Edit Payroll' : 'Add New Payroll'}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {isEditMode ? 'Update employee payroll information' : 'Create payroll for an employee'}
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
                                    disabled={!!employeeId} // Disable if employee is pre-selected
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

                    {/* Gross / Current Salary */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <FiDollarSign className="w-5 h-5 mr-2" />
                            Gross/Current Salary
                        </h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Gross/Current Salary (₹)</label>
                            <input
                                type="number"
                                name="basicSalary"
                                value={formData.basicSalary}
                                onChange={handleInputChange}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                placeholder="Enter gross/current salary"
                                required
                            />
                        </div>
                    </div>

                    {/* Earnings */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Earnings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(formData.earnings).map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name={key}
                                        value={value}
                                        onChange={handleEarningsChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                        placeholder="0"
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
                                    Pf Employee — 12% of basic wage (₹)
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
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>
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
