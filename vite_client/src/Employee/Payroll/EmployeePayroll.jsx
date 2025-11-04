import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    fetchPayrollHistory, 
    fetchCurrentMonthPayroll, 
    fetchPayrollDetails,
    downloadPayslip,
    clearError 
} from '../../context/employeePayrollSlice';
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
    FiX
} from 'react-icons/fi';
import { format } from 'date-fns';

const EmployeePayroll = () => {
    const dispatch = useDispatch();
    const { 
        loading, 
        error, 
        payrollHistory, 
        currentMonthPayroll, 
        selectedPayroll,
        payslipData 
    } = useSelector(state => state.employeePayroll);

    const [currentPage, setCurrentPage] = useState(1);
    const [showPayrollDetails, setShowPayrollDetails] = useState(false);
    const [showPayslipModal, setShowPayslipModal] = useState(false);

    useEffect(() => {
        dispatch(fetchCurrentMonthPayroll());
        dispatch(fetchPayrollHistory({ page: currentPage, limit: 12 }));
    }, [dispatch, currentPage]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                dispatch(clearError());
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, dispatch]);

    const handleViewDetails = async (payrollId) => {
        await dispatch(fetchPayrollDetails(payrollId));
        setShowPayrollDetails(true);
    };

    const handleDownloadPayslip = async (payrollId) => {
        await dispatch(downloadPayslip(payrollId));
        setShowPayslipModal(true);
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
                return 'text-green-600 bg-green-100';
            case 'Processed':
                return 'text-blue-600 bg-blue-100';
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
            <div className="min-h-screen bg-gray-50 p-5 ml-64 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading payroll data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-5 ml-64">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-gray-900 mb-1">Payroll</h1>
                    <p className="text-sm text-gray-600">View your payroll details and download payslips</p>
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
                    <div className="bg-white rounded-lg shadow-md p-5 mb-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <FiDollarSign className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Current Month</h2>
                                    <p className="text-sm text-gray-600">
                                        {currentMonthPayroll.month} {currentMonthPayroll.year}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-lg flex items-center gap-2 text-sm ${getStatusColor(currentMonthPayroll.status)}`}>
                                {getStatusIcon(currentMonthPayroll.status)}
                                <span className="font-medium">{currentMonthPayroll.status}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">In-Hand Salary</p>
                                        <p className="text-xl font-semibold text-green-600">
                                            {formatCurrency(currentMonthPayroll.inHandSalary)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-6 h-6 text-green-500" />
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">Total Earnings</p>
                                        <p className="text-xl font-semibold text-blue-600">
                                            {formatCurrency(currentMonthPayroll.earnings?.totalEarnings)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-6 h-6 text-blue-500" />
                                </div>
                            </div>

                            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">Total Deductions</p>
                                        <p className="text-xl font-semibold text-red-600">
                                            {formatCurrency(currentMonthPayroll.deductions?.total)}
                                        </p>
                                    </div>
                                    <FiTrendingDown className="w-6 h-6 text-red-500" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleViewDetails(currentMonthPayroll._id)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                            >
                                <FiEye className="w-4 h-4" />
                                <span>View Details</span>
                            </button>
                            <button
                                onClick={() => handleDownloadPayslip(currentMonthPayroll._id)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
                            >
                                <FiDownload className="w-4 h-4" />
                                <span>Download Payslip</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Payroll History */}
                <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Payroll History</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FiCalendar className="w-4 h-4" />
                            <span>All Months</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center space-x-2">
                                <FiLoader className="animate-spin w-6 h-6 text-blue-600" />
                                <span className="text-gray-600">Loading history...</span>
                            </div>
                        </div>
                    ) : payrollHistory.payrolls.length === 0 ? (
                        <div className="text-center py-12">
                            <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Payroll Records</h3>
                            <p className="text-gray-500">Your payroll history will appear here once available.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {payrollHistory.payrolls.map((payroll) => (
                                <div key={payroll._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <FiCalendar className="w-5 h-5 text-blue-600" />
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
                                        <div className="flex items-center gap-3">
                                            <div className={`px-3 py-1 rounded-lg flex items-center gap-2 text-sm ${getStatusColor(payroll.status)}`}>
                                                {getStatusIcon(payroll.status)}
                                                <span className="font-medium">{payroll.status}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewDetails(payroll._id)}
                                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="View Details"
                                                >
                                                    <FiEye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPayslip(payroll._id)}
                                                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
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

            {/* Payroll Details Modal */}
            {showPayrollDetails && selectedPayroll && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-5 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Payroll Details</h3>
                                <button
                                    onClick={() => setShowPayrollDetails(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-5">
                            {/* Employee Info */}
                            <div className="mb-5">
                                <h4 className="text-base font-semibold text-gray-900 mb-3">Employee Information</h4>
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
                            <div className="mb-5">
                                <h4 className="text-base font-semibold text-gray-900 mb-3">Earnings</h4>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
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
                                        <div className="border-t border-green-200 pt-2 mt-2">
                                            <div className="flex justify-between font-bold text-green-700">
                                                <span>Total Earnings</span>
                                                <span>{formatCurrency(selectedPayroll.earnings?.totalEarnings)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deductions Breakdown */}
                            <div className="mb-5">
                                <h4 className="text-base font-semibold text-gray-900 mb-3">Deductions</h4>
                                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
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
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-lg">
                                        <span className="font-semibold text-gray-900">In-Hand Salary</span>
                                        <span className="font-bold text-green-600">{formatCurrency(selectedPayroll.inHandSalary)}</span>
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

            {/* Payslip Download Modal */}
            {showPayslipModal && payslipData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <FiDownload className="w-7 h-7 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payslip Ready</h3>
                            <p className="text-sm text-gray-600 mb-5">Your payslip has been generated successfully.</p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        // In a real app, this would trigger the actual PDF download
                                        window.open(payslipData.downloadUrl, '_blank');
                                        setShowPayslipModal(false);
                                    }}
                                    className="w-full bg-green-500 text-white py-2.5 px-4 rounded-lg hover:bg-green-600 transition text-sm font-medium"
                                >
                                    Download PDF
                                </button>
                                <button
                                    onClick={() => setShowPayslipModal(false)}
                                    className="w-full bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeePayroll;
