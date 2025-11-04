import React, { useState, useEffect, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPayrolls, generatePayrolls } from '../../context/payrollSlice'; // adjust path as needed
import axios from '../../utils/axios';

const AdminPayroll = () => {
    const dispatch = useDispatch();
    const payrollData = useSelector((state) => state.payroll.data) || [];
    const loading = useSelector((state) => state.payroll.status === 'loading');
    const error = useSelector((state) => state.payroll.error);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [disburseLoading, setDisburseLoading] = useState(false);
    const [disburseResult, setDisburseResult] = useState(null);
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

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    const currentUser = useSelector((state) => state.auth.user);
    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        dispatch(fetchPayrolls({
            month: months[selectedMonth].label,
            year: selectedYear
        }));
    }, [selectedMonth, selectedYear, dispatch, navigate, months, currentUser]);

    const handleDisburse = async () => {
        if (!currentUser || currentUser.role !== 'admin') return;
        try {
            setDisburseLoading(true);
            setDisburseResult(null);
            const payload = {
                month: months[selectedMonth].label,
                year: selectedYear
            };
            const base = typeof axios.defaults.baseURL === 'string' ? axios.defaults.baseURL : '';
            const path = base.includes('/api') ? '/v1/admin/payroll/disburse' : '/api/v1/admin/payroll/disburse';
            const res = await axios.post(path, payload);
            setDisburseResult(res.data);
            // Refresh list to reflect Paid statuses
            dispatch(fetchPayrolls(payload));
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
        navigate('/payroll/add');
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setSelectedEmployee(null);
    };

    // Function to determine payroll status
    const getPayrollStatus = (employee) => {
        return employee.inHandSalary !== undefined && employee.inHandSalary > 0 ? 'Generated' : 'Not Generated';
    };

    return (
        <div className="p-5 transition-all duration-300 ease-in-out ml-0 lg:ml-64 min-h-screen bg-gray-50">
            {/* Mobile header - only shown on small screens */}
            <div className="sm:block lg:hidden md:hidden mb-4 bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-800">Employee Payroll</h2>
            </div>

            <div className="flex justify-between items-center mb-5">
                <h2 className="text-2xl font-semibold text-gray-800 hidden sm:hidden lg:block">Employee Payroll</h2>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            await dispatch(generatePayrolls({ month: months[selectedMonth].label, year: selectedYear }));
                            dispatch(fetchPayrolls({ month: months[selectedMonth].label, year: selectedYear }));
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                    >
                        Auto Generate
                    </button>
                    <button
                        className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                        onClick={handleDisburse}
                        disabled={disburseLoading || !currentUser || currentUser.role !== 'admin'}
                        title="Disburse in-hand amounts to employees' bank accounts"
                    >
                        {disburseLoading ? 'Disbursing…' : 'Disburse Salaries'}
                    </button>
                    <Link to="/add-payroll">
                        <button
                            onClick={handleCreatePayroll}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                        >
                            + Create Payroll
                        </button>
                    </Link>
                </div>
            </div>

            {disburseResult && (
                <div className={`p-3 rounded mb-4 ${disburseResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
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
                                    {disburseResult.results.map((r, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="px-2 py-1">{r.employeeName || r.employee}</td>
                                            <td className="px-2 py-1">{r.employeeEmail || '-'}</td>
                                            <td className="px-2 py-1">${`$${(r.amount || 0).toLocaleString()}`}</td>
                                            <td className="px-2 py-1">
                                                <span className={`px-2 py-0.5 rounded text-white ${r.status === 'Success' ? 'bg-green-600' : 'bg-red-600'}`}>
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
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            disabled={loading}
                        >
                            {months.map((month) => (
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
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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

                {loading ? (
                    <div className="text-center text-gray-500 py-6">Loading payroll data...</div>
                ) : payrollData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Allowance</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Leaves</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Net Salary</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollData.map((employee) => {
                                    const status = getPayrollStatus(employee);
                                    return (
                                        <tr key={employee.employeeId} className="hover:bg-gray-50">
                                            <td className="py-2 px-4">{employee.name}</td>
                                            <td className="py-2 px-4">${employee.totalEarnings}</td>
                                            <td className="py-2 px-4">{employee.leaves}</td>
                                            <td className="py-2 px-4">${employee.inHandSalary}</td>
                                            <td className="py-2 px-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    status === 'Generated' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4">
                                                <div className="flex space-x-2">
                                                    <button
                                                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                                                        onClick={() => handleViewDetails(employee)}
                                                    >
                                                        View Details
                                                    </button>
                                                    <Link to={`/admin-employee-payroll/${employee.employeeId}`}>
                                                        <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">
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
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${
                                                getPayrollStatus(selectedEmployee) === 'Generated' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {getPayrollStatus(selectedEmployee)}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Salary Breakdown</h4>
                                    <div className="space-y-2">
                                        <p><span className="font-medium">Basic Salary:</span> ${selectedEmployee.basicSalary || '0'}</p>
                                        <p><span className="font-medium">Allowances:</span> ${selectedEmployee.totalEarnings || '0'}</p>
                                        <p><span className="font-medium">Deductions:</span> ${selectedEmployee.totalDeductions || '0'}</p>
                                        <p><span className="font-medium">Net Salary:</span> ${selectedEmployee.inHandSalary || '0'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-medium text-gray-700 mb-2">Allowances</h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    {selectedEmployee.allowances && selectedEmployee.allowances.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {selectedEmployee.allowances.map((allowance, index) => (
                                                <li key={index} className="py-2 flex justify-between">
                                                    <span>{allowance.type}:</span>
                                                    <span>${allowance.amount}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No allowances for this period</p>
                                    )}
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-medium text-gray-700 mb-2">Deductions</h4>
                                <div className="bg-gray-50 p-3 rounded">
                                    {selectedEmployee.deductions && selectedEmployee.deductions.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {selectedEmployee.deductions.map((deduction, index) => (
                                                <li key={index} className="py-2 flex justify-between">
                                                    <span>{deduction.type}:</span>
                                                    <span>${deduction.amount}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No deductions for this period</p>
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
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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