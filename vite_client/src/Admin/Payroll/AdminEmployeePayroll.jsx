import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
    fetchAdminEmployeePayrollHistory, 
    fetchAdminCurrentMonthPayroll, 
    fetchAdminPayrollDetails,
    downloadAdminPayslip,
    clearSelectedPayroll
} from '../../context/adminEmployeePayrollSlice';
import { fetchEmployees } from '../../context/employeeSlice';
import { 
    FiDollarSign, 
    FiDownload, 
    FiEye, 
    FiCalendar, 
    FiUser, 
    FiTrendingUp,
    FiTrendingDown,
    FiFileText,
    FiClock,
    FiCheckCircle,
    FiAlertCircle,
    FiLoader,
    FiArrowLeft,
    FiEdit,
    FiPlus,
    FiX
} from 'react-icons/fi';

const AdminEmployeePayroll = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { employeeId } = useParams();
    
    const { 
        loading, 
        error, 
        payrollHistory, 
        currentMonthPayroll, 
        selectedPayroll 
    } = useSelector(state => state.adminEmployeePayroll);
    
    const { employees } = useSelector(state => state.employees);
    const [currentPage, setCurrentPage] = useState(1);
    const [showPayrollDetails, setShowPayrollDetails] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        dispatch(fetchEmployees({ fetchAllPages: true }));
    }, [dispatch]);

    useEffect(() => {
        if (!employeeId) {
            setSelectedEmployee(null);
            return;
        }
        const fromList = (employees || []).find(
            (emp) => emp._id === employeeId || String(emp.employeeId) === String(employeeId)
        );
        const payrollEmployee = currentMonthPayroll?.employeeId;
        const fromPayroll = payrollEmployee && typeof payrollEmployee === 'object' ? payrollEmployee : null;
        setSelectedEmployee(fromList || fromPayroll || null);
    }, [employeeId, employees, currentMonthPayroll]);

    useEffect(() => {
        if (employeeId) {
            dispatch(fetchAdminCurrentMonthPayroll(employeeId));
            dispatch(fetchAdminEmployeePayrollHistory({ employeeId, page: currentPage, limit: 12 }));
        }
    }, [dispatch, employeeId, currentPage]);

    const handleViewDetails = async (payroll) => {
        const result = await dispatch(fetchAdminPayrollDetails(payroll));
        if (fetchAdminPayrollDetails.fulfilled.match(result)) {
            setShowPayrollDetails(true);
        } else {
            toast.error(result.payload || 'Failed to fetch payroll details');
        }
    };

    const handleDownloadPayslip = async (payroll) => {
        try {
            const result = await dispatch(downloadAdminPayslip(payroll));
            
            if (downloadAdminPayslip.fulfilled.match(result)) {
                // Create blob from the PDF data
                const blob = new Blob([result.payload], { type: 'application/pdf' });
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Generate filename - try to get employee info from current payroll or selected employee
                const employeeInfo = selectedEmployee || currentMonthPayroll?.employeeId;
                const employeeId = employeeInfo?.employeeId || employeeInfo?._id || 'employee';
                const month = currentMonthPayroll?.month || new Date().toLocaleString('default', { month: 'long' });
                const year = currentMonthPayroll?.year || new Date().getFullYear();
                link.download = `Payslip_${employeeId}_${month}_${year}.pdf`;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                
                // Cleanup
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                // Show success message
                toast.success('Payslip downloaded successfully!');
            } else {
                // Handle error
                const errorMessage = result.payload || 'Failed to download payslip';
                toast.error(errorMessage);
            }
        } catch (error) {
            toast.error('Failed to download payslip. Please try again.');
        }
    };

    const handleCreatePayroll = () => {
        if (!employeeId) return;
        navigate(`/add-payroll?employeeId=${encodeURIComponent(employeeId)}`);
    };

    const handleEditPayroll = (payroll) => {
        dispatch(clearSelectedPayroll());
        // Removed console.log for production
        
        // Get employee ID from various sources - employeeId from URL param is most reliable
        let empId = payroll?._id || employeeId || selectedEmployee?._id;
        
        // If still no employee ID, try to get it from payroll object
        if (!empId && payroll?.employeeId) {
            empId = typeof payroll.employeeId === 'object' ? payroll.employeeId._id : payroll.employeeId;
        }
        
        // Removed console.log for production
        
        if (empId && payroll?.month && payroll?.year) {
            const url = `/add-payroll/${empId}/${encodeURIComponent(payroll.month)}/${payroll.year}`;
            // Removed console.log for production
            navigate(url);
        } else {
            // Removed console.error for production
            
            const missingFields = [];
            if (!empId) missingFields.push('Employee ID');
            if (!payroll) missingFields.push('Payroll data');
            if (!payroll?.month) missingFields.push('Month');
            if (!payroll?.year) missingFields.push('Year');
            
            alert(`Unable to edit payroll. Missing: ${missingFields.join(', ')}`);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Paid':
                return 'text-theme-primary bg-theme-primary/10';
            case 'Processed':
                return 'text-theme-secondary bg-theme-secondary/10';
            case 'Pending':
                return 'text-orange-600 bg-orange-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Paid':
                return <FiCheckCircle className="w-4 h-4" />;
            case 'Processed':
                return <FiClock className="w-4 h-4" />;
            case 'Pending':
                return <FiAlertCircle className="w-4 h-4" />;
            default:
                return <FiAlertCircle className="w-4 h-4" />;
        }
    };

    if (loading && !currentMonthPayroll) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex items-center space-x-2">
                    <FiLoader className="animate-spin w-6 h-6 text-theme-secondary" />
                    <span className="text-gray-600">Loading payroll data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack">
                {/* Header */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={() => navigate('/admin-payroll')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                            <span>← Back to Payroll</span>
                        </button>
                        <button
                            onClick={handleCreatePayroll}
                            className="flex items-center gap-2 bg-theme-primary text-white px-3 py-1.5 rounded-lg hover:bg-theme-primary transition text-sm font-medium"
                        >
                            <FiPlus className="w-4 h-4" />
                            <span>+ Create Payroll</span>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-theme-secondary rounded-lg flex items-center justify-center">
                            <FiUser className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                {selectedEmployee
                                    ? [selectedEmployee.name, selectedEmployee.lastName].filter(Boolean).join(' ')
                                    : 'Employee Payroll'}
                            </h1>
                            <p className="text-sm text-gray-600">
                                {selectedEmployee?.jobTitle} • {selectedEmployee?.department}
                            </p>
                            <p className="text-xs text-gray-500">
                                Employee ID: {selectedEmployee?.employeeId}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <FiAlertCircle className="w-5 h-5 text-red-600 mr-2" />
                            <span className="text-red-800">{error}</span>
                        </div>
                    </div>
                )}

                {/* Current Month Payroll Card */}
                {currentMonthPayroll && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <FiDollarSign className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Current Month</h2>
                                    <p className="text-gray-600">
                                        {currentMonthPayroll.month} {currentMonthPayroll.year}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className={`px-4 py-2 rounded-full flex items-center space-x-2 ${getStatusColor(currentMonthPayroll.status)}`}>
                                    {getStatusIcon(currentMonthPayroll.status)}
                                    <span className="font-semibold">{currentMonthPayroll.status}</span>
                                </div>
                                <button
                                    onClick={() => handleEditPayroll(currentMonthPayroll)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
                                >
                                    <FiEdit className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-white to-theme-primary/10 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">In-Hand Salary</p>
                                        <p className="text-2xl font-bold text-theme-primary">
                                            {formatCurrency(currentMonthPayroll.inHandSalary)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-8 h-8 text-theme-primary" />
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
                                        <p className="text-2xl font-bold text-theme-secondary">
                                            {formatCurrency(currentMonthPayroll.earnings?.totalEarnings)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-8 h-8 text-theme-secondary" />
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Total Deductions</p>
                                        <p className="text-2xl font-bold text-red-700">
                                            {formatCurrency(currentMonthPayroll.deductions?.total)}
                                        </p>
                                    </div>
                                    <FiTrendingDown className="w-8 h-8 text-red-600" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex space-x-4">
                            <button
                                onClick={() => handleViewDetails(currentMonthPayroll)}
                                className="flex items-center space-x-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
                            >
                                <FiEye className="w-4 h-4" />
                                <span>View Details</span>
                            </button>
                            <button
                                onClick={() => handleDownloadPayslip(currentMonthPayroll)}
                                className="flex items-center space-x-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
                            >
                                <FiDownload className="w-4 h-4" />
                                <span>Download Payslip</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Payroll History */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Payroll History</h2>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <FiCalendar className="w-4 h-4" />
                            <span>All Months</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center space-x-2">
                                <FiLoader className="animate-spin w-6 h-6 text-theme-secondary" />
                                <span className="text-gray-600">Loading history...</span>
                            </div>
                        </div>
                    ) : payrollHistory.payrolls.length === 0 ? (
                        <div className="text-center py-12">
                            <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Payroll Records</h3>
                            <p className="text-gray-500">This employee has no payroll history yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(Array.isArray(payrollHistory?.payrolls) ? payrollHistory.payrolls : []).map((payroll) => (
                                <div key={payroll._id || payroll.payrollId || `${payroll.month}-${payroll.year}`} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                                                <FiCalendar className="w-6 h-6 text-theme-accent" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">
                                                    {payroll.month} {payroll.year}
                                                </h3>
                                                <p className="text-sm text-gray-600">
                                                    In-Hand: {formatCurrency(payroll.inHandSalary)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className={`px-3 py-1 rounded-full flex items-center space-x-1 ${getStatusColor(payroll.status)}`}>
                                                {getStatusIcon(payroll.status)}
                                                <span className="text-sm font-medium">{payroll.status}</span>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleViewDetails(payroll)}
                                                    className="p-2 text-gray-600 hover:text-theme-secondary hover:bg-theme-secondary/10 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FiEye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditPayroll(payroll)}
                                                    className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                    title="Edit Payroll"
                                                >
                                                    <FiEdit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPayslip(payroll)}
                                                    className="p-2 text-gray-600 hover:text-theme-primary hover:bg-theme-primary/10 rounded-lg transition-colors"
                                                    title="Download Payslip"
                                                >
                                                    <FiDownload className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {payrollHistory.totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing {((currentPage - 1) * 12) + 1} to {Math.min(currentPage * 12, payrollHistory.total)} of {payrollHistory.total} results
                            </p>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, payrollHistory.totalPages))}
                                    disabled={currentPage === payrollHistory.totalPages}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </div>
            </div>

            {/* Payroll Details Modal */}
            {showPayrollDetails && selectedPayroll && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900">Payroll Details</h3>
                                <button
                                    onClick={() => setShowPayrollDetails(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            {/* Employee Info */}
                            <div className="mb-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-3">Employee Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="font-medium">{selectedPayroll.employeeId?.name} {selectedPayroll.employeeId?.lastName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Employee ID</p>
                                        <p className="font-medium">{selectedPayroll.employeeId?.employeeId}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Job Title</p>
                                        <p className="font-medium">{selectedPayroll.employeeId?.jobTitle}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Department</p>
                                        <p className="font-medium">{selectedPayroll.employeeId?.department}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Earnings Breakdown */}
                            <div className="mb-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-3">Earnings</h4>
                                <div className="bg-theme-primary/10 rounded-xl p-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Basic Wage</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.basicWage)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">House Rent Allowance</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.houseRentAllowance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Transport Allowance</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.transportAllowance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Medical Allowance</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.medicalAllowance)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Overtime</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.overtime)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Performance Bonus</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.performanceBonus)}</span>
                                        </div>
                                        <div className="border-t border-theme-primary pt-2 mt-2">
                                            <div className="flex justify-between font-bold text-theme-primary">
                                                <span>Total Earnings</span>
                                                <span>{formatCurrency(selectedPayroll.earnings?.totalEarnings)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deductions Breakdown */}
                            <div className="mb-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-3">Deductions</h4>
                                <div className="bg-red-50 rounded-xl p-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">PF Employee</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.pfEmployee)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">ESI Employee</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.esiEmployee)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Professional Tax</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.professionalTax)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Income Tax</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.incomeTax)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Other Deductions</span>
                                            <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.otherDeductions)}</span>
                                        </div>
                                        <div className="border-t border-red-200 pt-2 mt-2">
                                            <div className="flex justify-between font-bold text-red-700">
                                                <span>Total Deductions</span>
                                                <span>{formatCurrency(selectedPayroll.deductions?.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-lg">
                                        <span className="font-semibold text-gray-900">In-Hand Salary</span>
                                        <span className="font-bold text-theme-primary">{formatCurrency(selectedPayroll.inHandSalary)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">CTC</span>
                                        <span className="font-medium">{formatCurrency(selectedPayroll.ctc)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminEmployeePayroll;
