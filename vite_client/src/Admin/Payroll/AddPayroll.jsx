import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEmployees } from '../../context/employeeSlice';
import { createPayroll, updatePayroll } from '../../context/payrollSlice';
import { FiUser, FiDollarSign, FiCalendar, FiSave, FiArrowLeft } from 'react-icons/fi';

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

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        dispatch(fetchEmployees());
    }, [dispatch]);

    useEffect(() => {
        if (employeeId && employees.length > 0) {
            const employee = employees.find(emp => emp._id === employeeId);
            if (employee) {
                setSelectedEmployee(employee);
                setFormData(prev => ({
                    ...prev,
                    employeeId: employee._id,
                    basicSalary: employee.salary || 0,
                    earnings: {
                        ...prev.earnings,
                        basicWage: employee.salary || 0
                    }
                }));
            }
        }
    }, [employeeId, employees]);

    const handleEmployeeSelect = (selectedEmployeeId) => {
        const employee = employees.find(emp => emp._id === selectedEmployeeId);
        setSelectedEmployee(employee);
        setFormData(prev => ({
            ...prev,
            employeeId: selectedEmployeeId,
            basicSalary: employee?.salary || 0,
            earnings: {
                ...prev.earnings,
                basicWage: employee?.salary || 0
            }
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleEarningsChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            earnings: {
                ...prev.earnings,
                [name]: parseFloat(value) || 0
            }
        }));
    };

    const handleDeductionsChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            deductions: {
                ...prev.deductions,
                [name]: parseFloat(value) || 0
            }
        }));
    };

    const calculateTotals = () => {
        const earningsTotal = Object.values(formData.earnings).reduce((sum, val) => sum + (val || 0), 0);
        const deductionsTotal = Object.values(formData.deductions).reduce((sum, val) => sum + (val || 0), 0);
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

        try {
            if (isEditMode) {
                await dispatch(updatePayroll({ payrollId: formData._id, updatedData: payload }));
            } else {
                await dispatch(createPayroll(payload));
            }
            
            navigate('/admin-payroll');
        } catch (error) {
            console.error('Error saving payroll:', error);
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                    disabled={!!employeeId} // Disable if employee is pre-selected
                                >
                                    <option value="">Choose an employee...</option>
                                    {employees.map(employee => (
                                        <option key={employee._id} value={employee._id}>
                                            {employee.name} {employee.lastName} - {employee.jobTitle}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedEmployee && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h3 className="font-medium text-blue-900 mb-2">Selected Employee</h3>
                                    <p className="text-blue-800">
                                        <strong>{selectedEmployee.name} {selectedEmployee.lastName}</strong>
                                    </p>
                                    <p className="text-sm text-blue-600">
                                        {selectedEmployee.jobTitle} • {selectedEmployee.department}
                                    </p>
                                    <p className="text-sm text-blue-600">
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Basic Salary */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                            <FiDollarSign className="w-5 h-5 mr-2" />
                            Basic Salary
                        </h2>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary (₹)</label>
                            <input
                                type="number"
                                name="basicSalary"
                                value={formData.basicSalary}
                                onChange={handleInputChange}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter basic salary"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            {Object.entries(formData.deductions).map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name={key}
                                        value={value}
                                        onChange={handleDeductionsChange}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            <div className="bg-green-50 rounded-lg p-4">
                                <h3 className="font-medium text-green-800 mb-2">Total Earnings</h3>
                                <p className="text-2xl font-bold text-green-700">₹{earningsTotal.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4">
                                <h3 className="font-medium text-red-800 mb-2">Total Deductions</h3>
                                <p className="text-2xl font-bold text-red-700">₹{deductionsTotal.toLocaleString()}</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="font-medium text-blue-800 mb-2">In-Hand Salary</h3>
                                <p className="text-2xl font-bold text-blue-700">₹{inHandSalary.toLocaleString()}</p>
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
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
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
