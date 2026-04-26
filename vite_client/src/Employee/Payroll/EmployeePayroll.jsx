import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    fetchPayrollHistory, 
    fetchCurrentMonthPayroll, 
    fetchPayrollByMonth,
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
import { toast } from 'react-toastify';

const EmployeePayroll = () => {
    const dispatch = useDispatch();
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

    const { 
        loading, 
        error, 
        payrollHistory, 
        currentMonthPayroll, 
        selectedMonthPayroll,
        selectedPayroll,
        payslipData 
    } = useSelector(state => state.employeePayroll);

    const [currentPage, setCurrentPage] = useState(1);
    const [showPayrollDetails, setShowPayrollDetails] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [viewYear, setViewYear] = useState(currentYear);

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

    const handleViewMonth = async () => {
        const result = await dispatch(fetchPayrollByMonth({ month: viewMonth, year: viewYear }));
        if (fetchPayrollByMonth.fulfilled.match(result)) {
            dispatch(fetchPayrollHistory({ page: 1, limit: 12 }));
            toast.success(`${viewMonth} ${viewYear} payroll loaded.`);
        }
    };

    const handleDownloadPayslip = async (payrollId) => {
        try {
            const result = await dispatch(downloadPayslip(payrollId));
            
            if (downloadPayslip.fulfilled.match(result)) {
                // Create blob from the PDF data
                const blob = new Blob([result.payload], { type: 'application/pdf' });
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Generate filename
                const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                link.download = `Payslip_${currentMonth}.pdf`;
                
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

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    const canDownloadPayslip = (payroll) => {
        if (!payroll) return false;
        if (payroll.status === 'Paid') return true;

        const monthIndex = MONTHS.indexOf(payroll.month);
        if (monthIndex < 0) return false;

        const current = new Date();
        const payrollRank = (Number(payroll.year) || 0) * 12 + (monthIndex + 1);
        const currentRank = current.getFullYear() * 12 + (current.getMonth() + 1);
        const isPreviousMonthOrOlder = payrollRank < currentRank;
        const isFinalMonthly = payroll.isProvisional !== true && payroll.generationType !== 'preview';

        return isPreviousMonthOrOlder && isFinalMonthly;
    };

    const getDownloadTitle = (payroll) => (
        canDownloadPayslip(payroll)
            ? 'Download Payslip'
            : 'Payslip is available after payroll is paid or once a previous month is finalized.'
    );

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
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading payroll data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1">Payroll</h1>
                    <p className="text-xs sm:text-sm text-gray-600">View your payroll details and download payslips</p>
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
                    <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 mb-6 border border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-theme-secondary rounded-lg flex items-center justify-center">
                                    <FiDollarSign className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">Current Month</h2>
                                    <p className="text-xs sm:text-sm text-gray-600">
                                        {currentMonthPayroll.month} {currentMonthPayroll.year}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-lg flex items-center gap-2 text-sm ${getStatusColor(currentMonthPayroll.status)}`}>
                                {getStatusIcon(currentMonthPayroll.status)}
                                <span className="font-medium">{currentMonthPayroll.status}</span>
                            </div>
                        </div>

                        {(currentMonthPayroll.isProvisional || currentMonthPayroll.generationType === 'preview') && (
                            <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200 text-amber-950 text-sm">
                                Estimated (provisional) payroll preview. Final figures will be generated after month-end.
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                            <div className="bg-theme-primary/10 rounded-lg p-4 border border-theme-primary">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">In-Hand Salary</p>
                                        <p className="text-lg sm:text-xl font-semibold text-theme-primary">
                                            {formatCurrency(currentMonthPayroll.inHandSalary)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-6 h-6 text-green-500" />
                                </div>
                            </div>

                            <div className="bg-theme-secondary/10 rounded-lg p-4 border border-theme-secondary">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">Total Earnings</p>
                                        <p className="text-lg sm:text-xl font-semibold text-theme-secondary">
                                            {formatCurrency(currentMonthPayroll.earnings?.totalEarnings)}
                                        </p>
                                    </div>
                                    <FiTrendingUp className="w-6 h-6 text-theme-secondary" />
                                </div>
                            </div>

                            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">Total Deductions</p>
                                        <p className="text-lg sm:text-xl font-semibold text-red-600">
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
                                className="flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition text-sm font-medium"
                            >
                                <FiEye className="w-4 h-4" />
                                <span>View Details</span>
                            </button>
                            <button
                                onClick={() => handleDownloadPayslip(currentMonthPayroll._id)}
                                disabled={!canDownloadPayslip(currentMonthPayroll)}
                                title={getDownloadTitle(currentMonthPayroll)}
                                className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiDownload className="w-4 h-4" />
                                <span>Download Payslip</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* View another month */}
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 mb-6 border border-gray-200">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">View any month</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">Select a month and year to view payroll. Payroll is generated by the payroll run (preview for the current month, final after month-end).</p>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                            <select
                                value={viewMonth}
                                onChange={(e) => setViewMonth(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                            >
                                {MONTHS.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                            <select
                                value={viewYear}
                                onChange={(e) => setViewYear(Number(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleViewMonth}
                            disabled={loading}
                            className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                            {loading ? <FiLoader className="animate-spin w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            View
                        </button>
                    </div>
                    {selectedMonthPayroll && selectedMonthPayroll._id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{selectedMonthPayroll.month} {selectedMonthPayroll.year}</p>
                                    {(selectedMonthPayroll.isProvisional || selectedMonthPayroll.generationType === 'preview') && (
                                        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 inline-block px-3 py-1 rounded mt-2">
                                            Estimated (provisional)
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-600">In-Hand: {formatCurrency(selectedMonthPayroll.inHandSalary)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleViewDetails(selectedMonthPayroll._id)}
                                        className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary text-sm font-medium"
                                    >
                                        <FiEye className="w-4 h-4" /> View Details
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPayslip(selectedMonthPayroll._id)}
                                        disabled={!canDownloadPayslip(selectedMonthPayroll)}
                                        title={getDownloadTitle(selectedMonthPayroll)}
                                        className="flex items-center gap-2 px-3 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FiDownload className="w-4 h-4" /> Download Payslip
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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
                                <FiLoader className="animate-spin w-6 h-6 text-theme-secondary" />
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
                                            <div className="w-10 h-10 bg-theme-secondary/10 rounded-lg flex items-center justify-center">
                                                <FiCalendar className="w-5 h-5 text-theme-secondary" />
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
                                                    className="p-2 text-gray-600 hover:text-theme-secondary hover:bg-theme-secondary/10 rounded-lg transition"
                                                    title="View Details"
                                                >
                                                    <FiEye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPayslip(payroll._id)}
                                                    disabled={!canDownloadPayslip(payroll)}
                                                    title={getDownloadTitle(payroll)}
                                                    className="p-2 text-gray-600 hover:text-theme-primary hover:bg-theme-primary/10 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
                        <div className="p-4 sm:p-5 border-b border-gray-200">
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
                                <div className="bg-theme-primary/10 rounded-lg p-4 border border-theme-primary">
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

export default EmployeePayroll;
