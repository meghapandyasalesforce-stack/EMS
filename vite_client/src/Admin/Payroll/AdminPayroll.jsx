import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayrolls, generatePayrolls } from '../../context/payrollSlice';
import axios from '../../utils/axios';

const AdminPayroll = () => {
    const dispatch = useDispatch();
    const payrollData = useSelector((state) => state.payroll.data) || [];
    const payrollPagination = useSelector((state) => state.payroll.pagination);
    const loading = useSelector((state) => state.payroll.status === 'loading');
    const error = useSelector((state) => state.payroll.error);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [disburseLoading, setDisburseLoading] = useState(false);
    const [disburseResult, setDisburseResult] = useState(null);
    const [listPage, setListPage] = useState(1);
    const resultsRef = useRef(null);
    const navigate = useNavigate();

    const months = useMemo(() => [
        { value: 0, label: 'January' },
        { value: 1, label: 'February' },
        { value: 2, label: 'March' },
        { value: 3, label: 'April' },
        { value: 4, label: 'May' },
        { value: 5, label: 'June' },
        { value: 6, label: 'July' },
        { value: 7, label: 'August' },
        { value: 8, label: 'September' },
        { value: 9, label: 'October' },
        { value: 10, label: 'November' },
        { value: 11, label: 'December' }
    ], []);

    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - i);

    const currentUser = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails?.employee);
    
    // Check if user is CEO
    const isCEO = useMemo(() => {
        const userObj = currentUser || employee;
        if (!userObj) return false;
        const position = (userObj.position || '').toLowerCase().trim();
        return position === 'ceo' || position.includes('chief executive');
    }, [currentUser, employee]);
    
    useEffect(() => {
        if (!currentUser && !employee) {
            navigate('/login');
            return;
        }

        dispatch(
            fetchPayrolls({
                month: months[selectedMonth].label,
                year: selectedYear,
                page: listPage,
                limit: 20
            })
        );
    }, [selectedMonth, selectedYear, listPage, dispatch, navigate, months, currentUser, employee]);

    const runGenerate = async (mode) => {
        if (mode === 'final') {
            const ok = window.confirm(
                'Run FINAL payroll for this period? This is meant for month-end closes; the server will reject early final runs unless you use a forced flag. Continue?'
            );
            if (!ok) return;
        }
        const monthLabel = months[selectedMonth].label;
        const result = await dispatch(
            generatePayrolls({
                month: monthLabel,
                year: selectedYear,
                mode,
                forceFinalBeforePeriodEnd: false
            })
        );
        if (generatePayrolls.fulfilled.match(result)) {
            dispatch(
                fetchPayrolls({
                    month: monthLabel,
                    year: selectedYear,
                    page: listPage,
                    limit: 20
                })
            );
        }
    };

    const hasProvisional = useMemo(
        () =>
            (payrollData || []).some(
                (row) => row.isProvisional || row.generationType === 'preview'
            ),
        [payrollData]
    );

    // Ensure selected month is not in the future for the selected year
    useEffect(() => {
        // For past years, all months are allowed
        if (selectedYear < currentYear) return;

        // For the current year, allow months up to and including the current month
        const allowedMonths = months.filter((m) => m.value <= currentMonthIndex);
        if (!allowedMonths.length) return;

        const isSelectedAllowed = allowedMonths.some((m) => m.value === selectedMonth);
        if (!isSelectedAllowed) {
            setListPage(1);
            setSelectedMonth(allowedMonths[allowedMonths.length - 1].value);
        }
    }, [selectedYear, currentYear, currentMonthIndex, months, selectedMonth]);

    const handleDisburse = async () => {
        if (!isCEO) return;
        try {
            setDisburseLoading(true);
            setDisburseResult(null);
            const payload = {
                month: months[selectedMonth].label,
                year: selectedYear
            };
            // Use configured axios instance - baseURL already includes /api
            const res = await axios.post('/v1/admin/payroll/disburse', payload);
            setDisburseResult(res.data);
            dispatch(
                fetchPayrolls({
                    month: payload.month,
                    year: payload.year,
                    page: listPage,
                    limit: 20
                })
            );
        } catch (e) {
            setDisburseResult({ success: false, message: e?.response?.data?.message || e.message });
        } finally {
            setDisburseLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!disburseResult?.results) return;
        const rows = disburseResult.results;
        const header = ['Employee','Email','Amount','Status','Reference/Error'];
        const lines = [header.join(',')];
        rows.forEach(r => {
            const cols = [
                (r.employeeName || r.employee || '').toString().replaceAll(',', ' '),
                (r.employeeEmail || '').toString().replaceAll(',', ' '),
                (r.amount ?? 0).toString(),
                (r.status || '').toString(),
                (r.reference || r.error || '').toString().replaceAll(',', ' ')
            ];
            lines.push(cols.join(','));
        });
        const csv = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const m = months[selectedMonth].label;
        a.href = url;
        a.download = `disbursement_${m}_${selectedYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = async () => {
        if (!resultsRef.current) return;
        const m = months[selectedMonth].label;
        const summary = disburseResult?.success
            ? `Total: ${disburseResult.total}  •  Paid: ${disburseResult.paid}  •  Failed: ${disburseResult.failed}`
            : (disburseResult?.message || '');

        // Build a wrapper and attach to DOM so computed styles (Tailwind) apply
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-10000px';
        wrapper.style.top = '0';
        wrapper.style.padding = '16px';
        wrapper.style.background = '#ffffff';

        const titleEl = document.createElement('div');
        titleEl.style.fontSize = '18px';
        titleEl.style.fontWeight = '600';
        titleEl.style.marginBottom = '8px';
        titleEl.textContent = `Disbursement Results - ${m} ${selectedYear}`;

        const metaEl = document.createElement('div');
        metaEl.style.fontSize = '12px';
        metaEl.style.marginBottom = '12px';
        metaEl.textContent = summary;

        const tableClone = resultsRef.current.cloneNode(true);
        wrapper.appendChild(titleEl);
        wrapper.appendChild(metaEl);
        wrapper.appendChild(tableClone);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 40; // margins
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);

        // If content exceeds one page, add extra pages with appropriate offsets
        let remaining = imgHeight - (pageHeight - 40);
        let offsetY = 20 - (imgHeight - (pageHeight - 40));
        while (remaining > 0) {
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 20, offsetY, imgWidth, imgHeight);
            remaining -= (pageHeight - 40);
            offsetY -= (pageHeight - 40);
        }

        pdf.save(`disbursement_${m}_${selectedYear}.pdf`);

        // Cleanup
        document.body.removeChild(wrapper);
    };

    const handleViewDetails = (employee) => {
        setSelectedEmployee(employee);
        setIsDialogOpen(true);
    };

    const handleCreatePayroll = () => {
        navigate('/add-payroll');
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setSelectedEmployee(null);
    };

    // Function to determine payroll status
    const getPayrollStatus = (employee) => {
        const base =
            employee?.status ||
            (employee?.inHandSalary !== undefined && employee.inHandSalary > 0
                ? 'Generated'
                : 'Not Generated');
        if (employee?.isProvisional || employee?.generationType === 'preview') {
            if (base === 'Not Generated') return 'Provisional';
            return `${base} · Provisional`;
        }
        return base;
    };

    const getStatusBadgeClass = (status) => {
        if (status === 'Paid') return 'bg-theme-primary/10 text-theme-primary';
        if (status === 'Processed') return 'bg-theme-secondary/10 text-theme-secondary';
        if (status === 'Pending') return 'bg-orange-100 text-orange-700';
        if (status === 'Generated') return 'bg-theme-primary/10 text-theme-primary';
        return 'bg-red-100 text-red-800';
    };

    // Helper to format amounts in Indian Rupees
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="p-5 transition-all duration-300 ease-in-out min-h-screen bg-gray-50">
            {/* Mobile header - only shown on small screens */}
            <div className="sm:block lg:hidden md:hidden mb-4 bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-800">Employee Payroll</h2>
            </div>

            <div className="flex justify-between items-center mb-5">
                <h2 className="text-2xl font-semibold text-gray-800 hidden sm:hidden lg:block">Employee Payroll</h2>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => runGenerate('preview')}
                        disabled={loading}
                        className="bg-slate-700 text-white px-4 py-2 rounded hover:opacity-90 text-sm disabled:opacity-50"
                    >
                        Preview payroll
                    </button>
                    <button
                        type="button"
                        onClick={() => runGenerate('final')}
                        disabled={loading}
                        className="bg-theme-primary text-white px-4 py-2 rounded hover:opacity-90 text-sm disabled:opacity-50"
                    >
                        Run final payroll
                    </button>
                    <button
                        className="px-3 py-2 bg-theme-secondary text-white rounded disabled:opacity-50"
                        onClick={handleDisburse}
                        disabled={disburseLoading || !isCEO}
                        title={isCEO ? "Disburse in-hand amounts to employees' bank accounts (CEO only)" : "Only CEO can disburse payroll"}
                    >
                        {disburseLoading ? 'Disbursing…' : 'Disburse Salaries'}
                    </button>
                    <Link to="/add-payroll">
                        <button
                            onClick={handleCreatePayroll}
                            className="bg-theme-secondary text-white px-4 py-2 rounded hover:opacity-90 text-sm"
                        >
                            + Create Payroll
                        </button>
                    </Link>
                </div>
            </div>

            {disburseResult && (
                <div className={`p-3 rounded mb-4 ${disburseResult.success ? 'bg-theme-primary/10' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium">{disburseResult.success ? 'Disbursement complete' : 'Disbursement failed'}</div>
                            <div className="text-sm">
                                {disburseResult.success ? (
                                    <>Total: {disburseResult.total} • Paid: {disburseResult.paid} • Failed: {disburseResult.failed}</>
                                ) : (
                                    <>{disburseResult.message}</>
                                )}
                            </div>
                        </div>
                        {disburseResult.success && (
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1.5 bg-white border rounded" onClick={handleExportCSV}>Export CSV</button>
                                <button className="px-3 py-1.5 bg-white border rounded" onClick={handleExportPDF}>Export PDF</button>
                            </div>
                        )}
                    </div>
                    {Array.isArray(disburseResult.results) && disburseResult.results.length > 0 && (
                        <div ref={resultsRef} className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left">
                                        <th className="px-2 py-1">Employee</th>
                                        <th className="px-2 py-1">Email</th>
                                        <th className="px-2 py-1">Amount</th>
                                        <th className="px-2 py-1">Status</th>
                                        <th className="px-2 py-1">Reference / Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(disburseResult?.results) ? disburseResult.results : []).map((r, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="px-2 py-1">{r.employeeName || r.employee}</td>
                                            <td className="px-2 py-1">{r.employeeEmail || '-'}</td>
                                            <td className="px-2 py-1">{formatCurrency(r.amount || 0)}</td>
                                            <td className="px-2 py-1">
                                                <span className={`px-2 py-0.5 rounded text-white ${r.status === 'Success' ? 'bg-theme-primary' : 'bg-red-600'}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1 break-all">{r.reference || r.error || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white p-5 rounded-lg shadow">
                <div className="flex flex-col md:flex-row gap-5 mb-5">
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="font-medium text-gray-700">Month</label>
                        <select
                            className="p-2 border border-gray-300 rounded-md text-sm"
                            value={selectedMonth}
                            onChange={(e) => {
                                setListPage(1);
                                setSelectedMonth(parseInt(e.target.value, 10));
                            }}
                            disabled={loading}
                        >
                            {months
                                .filter((month) =>
                                    // For previous years: allow all months
                                    selectedYear < currentYear
                                        ? true
                                        // For current year: allow months up to current month
                                        : month.value <= currentMonthIndex
                                )
                                .map((month) => (
                                    <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="font-medium text-gray-700">Year</label>
                        <select
                            className="p-2 border border-gray-300 rounded-md text-sm"
                            value={selectedYear}
                            onChange={(e) => {
                                setListPage(1);
                                setSelectedYear(parseInt(e.target.value, 10));
                            }}
                            disabled={loading}
                        >
                            {years.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="text-red-700 bg-red-100 p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {hasProvisional && (
                    <div className="mb-4 p-3 rounded bg-amber-50 text-amber-950 text-sm border border-amber-200">
                        This list includes <strong>provisional preview</strong> payroll data. Run{' '}
                        <strong>final payroll</strong> after month-end so employee-facing numbers match the closed
                        period.
                    </div>
                )}

                {loading ? (
                    <div className="text-center text-gray-500 py-6">Loading payroll data...</div>
                ) : payrollData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Name</th>
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Total Earnings</th>
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Leaves</th>
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Net Salary</th>
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Status</th>
                                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(payrollData) ? payrollData : []).map((employee, index) => {
                                    const status = getPayrollStatus(employee);
                                    return (
                                        <tr key={employee._id || employee.employeeId || `employee-${index}`} className="hover:bg-gray-50">
                                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm">{employee.name}</td>
                                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm">{formatCurrency(employee.totalEarnings)}</td>
                                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm">{employee.leaves}</td>
                                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm">{formatCurrency(employee.inHandSalary)}</td>
                                            <td className="py-2 px-2 sm:px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm">
                                                <div className="flex space-x-2">
                                                    <button
                                                        className="bg-theme-primary text-white px-3 py-1 rounded hover:opacity-90 text-sm"
                                                        onClick={() => handleViewDetails(employee)}
                                                    >
                                                        View Details
                                                    </button>
                                                    <Link to={`/admin-employee-payroll/${employee.employeeId}`}>
                                                        <button className="bg-theme-secondary text-white px-3 py-1 rounded hover:opacity-90 text-sm">
                                                            Manage Payroll
                                                        </button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-gray-600 bg-gray-100 p-4 rounded">
                        No payroll data available for the selected period
                    </div>
                )}

                {payrollPagination && payrollPagination.pages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200 text-sm">
                        <span className="text-gray-600">
                            Page {payrollPagination.page} of {payrollPagination.pages} ({payrollPagination.total} employees)
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={loading || !payrollPagination.hasPrev}
                                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                disabled={loading || !payrollPagination.hasNext}
                                onClick={() => setListPage((p) => p + 1)}
                                className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Payroll Details Dialog */}
            {isDialogOpen && selectedEmployee && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-semibold text-gray-800">
                                    Payroll Details for {selectedEmployee.name}
                                </h3>
                                <button
                                    onClick={closeDialog}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Basic Information</h4>
                                    <div className="space-y-2">
                                        <p><span className="font-medium">Employee ID:</span> {selectedEmployee.employeeId}</p>
                                        <p><span className="font-medium">Month:</span> {months[selectedMonth].label} {selectedYear}</p>
                                        <p><span className="font-medium">Department:</span> {selectedEmployee.department || 'N/A'}</p>
                                        <p><span className="font-medium">Position:</span> {selectedEmployee.position || 'N/A'}</p>
                                        <p><span className="font-medium">Status:</span> 
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${getStatusBadgeClass(getPayrollStatus(selectedEmployee))}`}>
                                                {getPayrollStatus(selectedEmployee)}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Salary Breakdown</h4>
                                    <div className="space-y-2">
                                        <p><span className="font-medium">Gross/Current Salary:</span> {formatCurrency(selectedEmployee.basicSalary || 0)}</p>
                                        <p><span className="font-medium">Base Earnings:</span> {formatCurrency(selectedEmployee.earnings?.totalEarnings || 0)}</p>
                                        <p><span className="font-medium">Base Deductions:</span> {formatCurrency(selectedEmployee.deductions?.total || 0)}</p>
                                        <p className="pt-1"><span className="font-medium">Final Earnings (Base + Adjustments):</span> {formatCurrency(selectedEmployee.totalEarnings || 0)}</p>
                                        <p><span className="font-medium">Final Deductions (Base + Adjustments):</span> {formatCurrency(selectedEmployee.totalDeductions || 0)}</p>
                                        <p><span className="font-medium">Final Net Salary:</span> {formatCurrency(selectedEmployee.inHandSalary || 0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-medium text-gray-700 mb-2">Allowances</h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    <ul className="divide-y divide-gray-200">
                                        {selectedEmployee.earnings ? (
                                            [
                                                ['basicWage', 'Basic Wage'],
                                                ['houseRentAllowance', 'House Rent'],
                                                ['transportAllowance', 'Transport'],
                                                ['medicalAllowance', 'Medical'],
                                                ['overtime', 'Overtime'],
                                                ['gratuity', 'Gratuity'],
                                                ['specialAllowance', 'Special Allowance'],
                                                ['performanceBonus', 'Performance Bonus'],
                                                ['projectBonus', 'Project Bonus'],
                                                ['attendanceBonus', 'Attendance Bonus']
                                            ].map(([key, label]) => (
                                                <li key={key} className="py-2 flex justify-between">
                                                    <span>{label}:</span>
                                                    <span>{formatCurrency(selectedEmployee.earnings?.[key] || 0)}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="py-2 flex justify-between">
                                                <span>Total Earnings:</span>
                                                <span>{formatCurrency(selectedEmployee.totalEarnings || 0)}</span>
                                            </li>
                                        )}
                                        <li className="py-2 flex justify-between font-semibold">
                                            <span>Total Earnings (Base):</span>
                                            <span>{formatCurrency(selectedEmployee.earnings?.totalEarnings || 0)}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-medium text-gray-700 mb-2">Deductions</h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    <ul className="divide-y divide-gray-200">
                                        {selectedEmployee.deductions ? (
                                            [
                                                ['pfEmployee', 'PF (Employee)'],
                                                ['esiEmployee', 'ESI (Employee)'],
                                                ['professionalTax', 'Professional Tax'],
                                                ['incomeTax', 'Income Tax'],
                                                ['advanceSalary', 'Advance Salary'],
                                                ['loanDeduction', 'Loan Deduction'],
                                                ['otherDeductions', 'Other Deductions']
                                            ].map(([key, label]) => (
                                                <li key={key} className="py-2 flex justify-between">
                                                    <span>{label}:</span>
                                                    <span>{formatCurrency(selectedEmployee.deductions?.[key] || 0)}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="py-2 flex justify-between">
                                                <span>Total Deductions:</span>
                                                <span>{formatCurrency(selectedEmployee.totalDeductions || 0)}</span>
                                            </li>
                                        )}
                                        <li className="py-2 flex justify-between font-semibold">
                                            <span>Total Deductions (Base):</span>
                                            <span>{formatCurrency(selectedEmployee.deductions?.total || 0)}</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-medium text-gray-700 mb-2">Adjustments (Off-cycle)</h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    {Array.isArray(selectedEmployee.adjustments) && selectedEmployee.adjustments.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {selectedEmployee.adjustments.map((adj) => (
                                                <li key={adj.payrollId || adj._id} className="py-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm font-medium text-gray-800">
                                                            {adj.subType || 'off-cycle'}{" "}
                                                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(adj.status || 'Pending')}`}>
                                                                {adj.status || 'Pending'}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm font-semibold">
                                                            {formatCurrency(adj.netDelta || 0)}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        Earnings: {formatCurrency(adj.earningsTotal || 0)} • Deductions: {formatCurrency(adj.deductionsTotal || 0)}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-1">
                                                        Paid Amount: {formatCurrency(adj.paidAmount || 0)}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="py-2 text-sm text-gray-600">
                                            No off-cycle adjustments for this period.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={closeDialog}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Close
                                </button>
                               <Link to={`/add-payroll/${selectedEmployee.employeeId}/${months[selectedMonth].label}/${selectedYear}`}>
                               <button
                                    onClick={() => {
                                        closeDialog();
                                    }}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-md hover:opacity-90"
                                >
                                    Edit Payroll
                                </button> </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPayroll;