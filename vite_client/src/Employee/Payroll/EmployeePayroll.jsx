import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchPayrollHistory,
    fetchCurrentMonthPayroll,
    fetchPayrollByMonth,
    fetchPayrollDetails,
    downloadPayslip,
    clearError,
    clearMonthPayrollView,
} from '../../context/employeePayrollSlice';
import {
    FiDownload,
    FiEye,
    FiCalendar,
    FiClock,
    FiCheckCircle,
    FiAlertCircle,
    FiLoader,
    FiX,
    FiCheck,
} from 'react-icons/fi';
import { format, lastDayOfMonth } from 'date-fns';
import { toast } from 'react-toastify';

const TEAL = '#0a8f6c';
const TEAL_LIGHT = '#14b887';
const DEDUCTION_ORANGE = '#f97316';
const PAGE_BG = '#f4f7f6';
const HISTORY_PAGE_SIZE = 24;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EARN_ITEMS = [
    { key: 'basicWage', label: 'Basic Pay' },
    { key: 'houseRentAllowance', label: 'House Rent Allowance' },
    { key: 'transportAllowance', label: 'Transport Allowance' },
    { key: 'medicalAllowance', label: 'Medical Allowance' },
    { key: 'specialAllowance', label: 'Special Allowance' },
    { key: 'overtime', label: 'Overtime' },
    { key: 'performanceBonus', label: 'Performance Bonus' },
    { key: 'projectBonus', label: 'Project Bonus' },
    { key: 'attendanceBonus', label: 'Attendance Bonus' },
    { key: 'pfEmployer', label: 'PF (Employer)' },
    { key: 'esiEmployer', label: 'ESI (Employer)' },
];

const DEDUCT_ITEMS = [
    { key: 'pfEmployee', label: 'Provident Fund (PF)' },
    { key: 'esiEmployee', label: 'ESI Contribution' },
    { key: 'professionalTax', label: 'Professional Tax' },
    { key: 'incomeTax', label: 'Income Tax (TDS)' },
    { key: 'advanceSalary', label: 'Advance Salary' },
    { key: 'loanDeduction', label: 'Loan Deduction' },
    { key: 'otherDeductions', label: 'Other Deductions' },
];

function ProgressRow({ label, amount, formatCurrency, total, barColor }) {
    const pct = total > 0 ? Math.min(100, Math.round((amount / total) * 100)) : 0;
    return (
        <div className="mb-4 last:mb-0">
            <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="text-slate-600">{label}</span>
                <span className="shrink-0 font-semibold text-slate-900">{formatCurrency(amount)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: barColor }}
                />
            </div>
        </div>
    );
}

function creditFallbackLabel(monthStr, yr) {
    try {
        const idx = MONTHS.indexOf(monthStr);
        if (idx < 0 || yr == null) return null;
        const y = Number(yr);
        if (!Number.isFinite(y)) return null;
        const d = lastDayOfMonth(new Date(y, idx, 1));
        return format(d, 'd MMM yyyy');
    } catch {
        return null;
    }
}

function statusHeroLabel(status) {
    if (status === 'Paid') return 'Paid';
    if (status === 'Processed') return 'Processed';
    if (status === 'Pending') return 'Pending';
    if (status === 'Cancelled') return 'Cancelled';
    return status || '—';
}

const EmployeePayroll = () => {
    const dispatch = useDispatch();
    const currentCalendarYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentCalendarYear - i);

    const {
        loading,
        historyLoading,
        payslipDownloading,
        error,
        payrollHistory,
        currentMonthPayroll,
        selectedMonthPayroll,
        selectedPayroll,
    } = useSelector((state) => state.employeePayroll);

    const [currentPage, setCurrentPage] = useState(1);
    const [historyYear, setHistoryYear] = useState(currentCalendarYear);
    const [showPayrollDetails, setShowPayrollDetails] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [viewYear, setViewYear] = useState(currentCalendarYear);

    const featured = useMemo(() => {
        if (selectedMonthPayroll && (selectedMonthPayroll._id || selectedMonthPayroll.payrollId)) {
            return selectedMonthPayroll;
        }
        return currentMonthPayroll;
    }, [selectedMonthPayroll, currentMonthPayroll]);

    const earningsTotal = Number(featured?.earnings?.totalEarnings) || 0;
    const deductionsTotal = Number(featured?.deductions?.total) || 0;

    const earningRows = useMemo(() => {
        if (!featured?.earnings) return [];
        const e = featured.earnings;
        return EARN_ITEMS.map(({ key, label }) => ({
            key,
            label,
            amount: Number(e[key]) || 0,
        })).filter((r) => r.amount > 0);
    }, [featured]);

    const deductionRows = useMemo(() => {
        if (!featured?.deductions) return [];
        const d = featured.deductions;
        return DEDUCT_ITEMS.map(({ key, label }) => ({
            key,
            label,
            amount: Number(d[key]) || 0,
        })).filter((r) => r.amount > 0);
    }, [featured]);

    useEffect(() => {
        dispatch(fetchCurrentMonthPayroll());
    }, [dispatch]);

    useEffect(() => {
        dispatch(fetchPayrollHistory({ page: currentPage, limit: HISTORY_PAGE_SIZE, year: historyYear }));
    }, [dispatch, currentPage, historyYear]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => dispatch(clearError()), 5000);
            return () => clearTimeout(timer);
        }
    }, [error, dispatch]);

  const handleViewDetails = async (payroll) => {
    const result = await dispatch(fetchPayrollDetails(payroll));
    if (fetchPayrollDetails.fulfilled.match(result)) {
      setShowPayrollDetails(true);
    } else {
      toast.error(result.payload || 'Failed to fetch payroll details');
    }
  };

    const handleViewMonth = async () => {
        const result = await dispatch(fetchPayrollByMonth({ month: viewMonth, year: viewYear }));
        if (fetchPayrollByMonth.fulfilled.match(result)) {
            setHistoryYear(viewYear);
            setCurrentPage(1);
            dispatch(fetchPayrollHistory({ page: 1, limit: HISTORY_PAGE_SIZE, year: viewYear }));
            toast.success(`${viewMonth} ${viewYear} payroll loaded.`);
        }
    };

    const handleDownloadPayslip = async (payroll) => {
        if (!payroll?._id && !payroll?.payrollId) {
            toast.error('Payroll record ID is missing. Refresh the page and try again.');
            return;
        }
        try {
            const result = await dispatch(downloadPayslip(payroll));
            if (downloadPayslip.fulfilled.match(result)) {
                const blob = new Blob([result.payload], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const safeMonth = (payroll.month || 'Payroll').replace(/\s+/g, '_');
                link.download = `Payslip_${safeMonth}_${payroll.year || ''}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast.success('Payslip downloaded successfully!');
            } else {
                toast.error(result.payload || 'Failed to download payslip');
            }
        } catch {
            toast.error('Failed to download payslip. Please try again.');
        }
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

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

    const getDownloadTitle = (payroll) =>
        canDownloadPayslip(payroll)
            ? 'Download Payslip'
            : 'Payslip is available after payroll is paid or once a previous month is finalized.';

    const getStatusTableClass = (status) => {
        switch (status) {
            case 'Paid':
                return { wrap: 'bg-emerald-50 text-emerald-800 border border-emerald-200', icon: FiCheckCircle };
            case 'Processed':
                return { wrap: 'bg-sky-50 text-sky-800 border border-sky-200', icon: FiClock };
            case 'Pending':
                return { wrap: 'bg-amber-50 text-amber-900 border border-amber-200', icon: FiAlertCircle };
            default:
                return { wrap: 'bg-slate-100 text-slate-700 border border-slate-200', icon: FiAlertCircle };
        }
    };

    const creditedLine = useMemo(() => {
        if (!featured) return null;
        if (featured.paymentDate) {
            try {
                return `Credited on ${format(new Date(featured.paymentDate), 'd MMM yyyy')}`;
            } catch {
                /* fall through */
            }
        }
        const fb = creditFallbackLabel(featured.month, featured.year);
        if (fb && (featured.isProvisional || featured.generationType === 'preview')) {
            return `Estimated · period ends ${fb}`;
        }
        if (fb) return `Typical credit by ${fb}`;
        return null;
    }, [featured]);

    if (loading && !currentMonthPayroll && !selectedMonthPayroll) {
        return (
            <div className="page-shell flex items-center justify-center py-16" style={{ background: PAGE_BG }}>
                <div className="page-shell-inner text-center">
                    <FiLoader className="mx-auto mb-4 h-10 w-10 animate-spin" style={{ color: TEAL }} />
                    <p className="text-sm text-slate-600">Loading payroll…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell transition-all duration-300" style={{ background: PAGE_BG }}>
            <div className="page-shell-inner hrms-stack">
                <header>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">My Payroll</h1>
                    <p className="mt-1 text-sm text-slate-600">View your salary details and download payslips.</p>
                </header>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <div className="flex items-center gap-2">
                            <FiAlertCircle className="h-5 w-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Hero payslip card */}
                {featured ? (
                    <section
                        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8 lg:p-10"
                        style={{
                            background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_LIGHT} 55%, #0d7a5c 100%)`,
                        }}
                    >
                        <div className="relative z-[1] flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                    <p className="text-sm font-semibold uppercase tracking-wide text-white/90">
                                        {featured.month} {featured.year} Payslip
                                    </p>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                                        {featured.status === 'Paid' || featured.status === 'Processed' ? (
                                            <FiCheck className="h-3.5 w-3.5" />
                                        ) : (
                                            <FiClock className="h-3.5 w-3.5" />
                                        )}
                                        {statusHeroLabel(featured.status)}
                                    </span>
                                </div>
                                <p className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                                    {formatCurrency(featured.inHandSalary)}
                                </p>
                                <p className="mt-2 text-sm text-white/85">{creditedLine || 'Net pay for this period'}</p>
                                {(featured.isProvisional || featured.generationType === 'preview') && (
                                    <p className="mt-3 max-w-xl rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs text-white/95">
                                        Estimated (provisional) preview. Final figures after month-end payroll run.
                                    </p>
                                )}
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Gross</p>
                                        <p className="text-lg font-semibold">{formatCurrency(earningsTotal)}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Deductions</p>
                                        <p className="text-lg font-semibold">{formatCurrency(deductionsTotal)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadPayslip(featured)}
                                    disabled={!canDownloadPayslip(featured) || payslipDownloading}
                                    title={getDownloadTitle(featured)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold shadow-md transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ color: TEAL }}
                                >
                                    {payslipDownloading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiDownload className="h-4 w-4" />}
                                    Download Payslip
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleViewDetails(featured)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/70 bg-transparent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                                >
                                    <FiEye className="h-4 w-4" />
                                    Full breakdown
                                </button>
                            </div>
                        </div>
                        {selectedMonthPayroll && selectedMonthPayroll._id ? (
                            <button
                                type="button"
                                onClick={() => dispatch(clearMonthPayrollView())}
                                className="relative z-[1] mt-6 text-xs font-semibold underline decoration-white/50 hover:decoration-white"
                            >
                                Show current month payroll in summary
                            </button>
                        ) : null}
                    </section>
                ) : (
                    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <FiCalendar className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                        <h2 className="text-lg font-semibold text-slate-800">No payroll published yet</h2>
                        <p className="mt-1 text-sm text-slate-500">Once your organization publishes payroll, it will show here.</p>
                    </section>
                )}

                {/* Breakdown cards */}
                {featured ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                            <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Component</p>
                                    <p className="text-lg font-bold text-slate-900">Total Earnings</p>
                                </div>
                                <p className="text-xl font-bold" style={{ color: TEAL }}>
                                    {formatCurrency(earningsTotal)}
                                </p>
                            </div>
                            <div className="pt-1">
                                {earningRows.length ? (
                                    earningRows.map((row) => (
                                        <ProgressRow
                                            key={row.key}
                                            label={row.label}
                                            amount={row.amount}
                                            total={earningsTotal}
                                            formatCurrency={formatCurrency}
                                            barColor={TEAL_LIGHT}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">No earning line items for this payslip.</p>
                                )}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                            <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Component</p>
                                    <p className="text-lg font-bold text-slate-900">Total Deductions</p>
                                </div>
                                <p className="text-xl font-bold" style={{ color: DEDUCTION_ORANGE }}>
                                    {formatCurrency(deductionsTotal)}
                                </p>
                            </div>
                            <div className="pt-1">
                                {deductionRows.length ? (
                                    deductionRows.map((row) => (
                                        <ProgressRow
                                            key={row.key}
                                            label={row.label}
                                            amount={row.amount}
                                            total={deductionsTotal || 1}
                                            formatCurrency={formatCurrency}
                                            barColor={DEDUCTION_ORANGE}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">No deduction line items for this payslip.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* View any month */}
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-base font-bold text-slate-900">View any month</h2>
                    <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                        Select a month and year. Payroll reflects the payroll run (preview may show for the current month).
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Month</label>
                            <select
                                value={viewMonth}
                                onChange={(e) => setViewMonth(e.target.value)}
                                className="w-full min-w-[140px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25"
                            >
                                {MONTHS.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Year</label>
                            <select
                                value={viewYear}
                                onChange={(e) => setViewYear(Number(e.target.value))}
                                className="w-full min-w-[100px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={handleViewMonth}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow transition disabled:opacity-50"
                            style={{ background: TEAL }}
                        >
                            {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiEye className="h-4 w-4" />}
                            View
                        </button>
                    </div>
                </section>

                {/* Payroll history table */}
                <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Payroll History</h2>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter history by year">
                            {[currentCalendarYear, currentCalendarYear - 1, currentCalendarYear - 2].map((y) => (
                                <button
                                    key={y}
                                    type="button"
                                    onClick={() => {
                                        setHistoryYear(y);
                                        setCurrentPage(1);
                                    }}
                                    className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                        historyYear === y
                                            ? 'text-white shadow'
                                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                    style={
                                        historyYear === y ? { background: TEAL } : undefined
                                    }
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {historyLoading ? (
                            <div className="flex justify-center py-14">
                                <FiLoader className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : payrollHistory.payrolls?.length === 0 ? (
                            <div className="py-14 text-center text-slate-500">
                                <FiCalendar className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                                <p className="font-medium text-slate-700">No payroll records for {historyYear}</p>
                                <p className="mt-1 text-sm">Records appear after payroll is published.</p>
                            </div>
                        ) : (
                            <table className="min-w-[640px] w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                        <th className="whitespace-nowrap px-5 py-3">Month</th>
                                        <th className="whitespace-nowrap px-5 py-3">Gross pay</th>
                                        <th className="whitespace-nowrap px-5 py-3">Deductions</th>
                                        <th className="whitespace-nowrap px-5 py-3">Net pay</th>
                                        <th className="whitespace-nowrap px-5 py-3">Status</th>
                                        <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {payrollHistory.payrolls.map((row) => {
                                        const st = getStatusTableClass(row.status);
                                        const Icon = st.icon;
                                        return (
                                            <tr key={row._id} className="hover:bg-slate-50/80">
                                                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                                                    {row.month} {row.year}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                                                    {formatCurrency(row.earnings?.totalEarnings)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                                                    {formatCurrency(row.deductions?.total)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                                                    {formatCurrency(row.inHandSalary)}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${st.wrap}`}
                                                    >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-4 text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewDetails(row)}
                                                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                                            title="View details"
                                                        >
                                                            <FiEye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadPayslip(row)}
                                                            disabled={!canDownloadPayslip(row) || payslipDownloading}
                                                            title={getDownloadTitle(row)}
                                                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            <FiDownload className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {payrollHistory.totalPages > 1 ? (
                        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-600">
                                Page {currentPage} of {payrollHistory.totalPages} · {payrollHistory.total} record(s) in {historyYear}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1 || historyLoading}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(payrollHistory.totalPages, p + 1))}
                                    disabled={currentPage === payrollHistory.totalPages || historyLoading}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>

            {/* Details modal */}
            {showPayrollDetails && selectedPayroll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                            <h3 className="text-lg font-bold text-slate-900">Payroll Details</h3>
                            <button
                                type="button"
                                onClick={() => setShowPayrollDetails(false)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Close"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-5 sm:p-6">
                            <div className="mb-6">
                                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Employee</h4>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs text-slate-500">Name</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedPayroll.employeeId?.name} {selectedPayroll.employeeId?.lastName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Employee ID</p>
                                        <p className="font-medium text-slate-900">{selectedPayroll.employeeId?.employeeId}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Job title</p>
                                        <p className="font-medium text-slate-900">{selectedPayroll.employeeId?.jobTitle}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Department</p>
                                        <p className="font-medium text-slate-900">{selectedPayroll.employeeId?.department}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mb-6 grid gap-6 lg:grid-cols-2">
                                <div className="rounded-xl border border-slate-100 p-4" style={{ borderLeftWidth: 4, borderLeftColor: TEAL }}>
                                    <h4 className="mb-3 font-bold text-slate-900">Earnings</h4>
                                    <div className="space-y-2 text-sm">
                                        {EARN_ITEMS.map(({ key, label }) =>
                                            Number(selectedPayroll.earnings?.[key]) ? (
                                                <div key={key} className="flex justify-between gap-2">
                                                    <span className="text-slate-600">{label}</span>
                                                    <span className="font-medium">{formatCurrency(selectedPayroll.earnings?.[key])}</span>
                                                </div>
                                            ) : null
                                        )}
                                        <div className="flex justify-between border-t border-slate-100 pt-2 font-bold" style={{ color: TEAL }}>
                                            <span>Total earnings</span>
                                            <span>{formatCurrency(selectedPayroll.earnings?.totalEarnings)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="rounded-xl border border-slate-100 p-4"
                                    style={{ borderLeftWidth: 4, borderLeftColor: DEDUCTION_ORANGE }}
                                >
                                    <h4 className="mb-3 font-bold text-slate-900">Deductions</h4>
                                    <div className="space-y-2 text-sm">
                                        {DEDUCT_ITEMS.map(({ key, label }) =>
                                            Number(selectedPayroll.deductions?.[key]) ? (
                                                <div key={key} className="flex justify-between gap-2">
                                                    <span className="text-slate-600">{label}</span>
                                                    <span className="font-medium">{formatCurrency(selectedPayroll.deductions?.[key])}</span>
                                                </div>
                                            ) : null
                                        )}
                                        <div
                                            className="flex justify-between border-t border-slate-100 pt-2 font-bold"
                                            style={{ color: DEDUCTION_ORANGE }}
                                        >
                                            <span>Total deductions</span>
                                            <span>{formatCurrency(selectedPayroll.deductions?.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <div className="flex flex-wrap justify-between gap-2 text-lg font-bold text-slate-900">
                                    <span>Net pay</span>
                                    <span style={{ color: TEAL }}>{formatCurrency(selectedPayroll.inHandSalary)}</span>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">CTC · {formatCurrency(selectedPayroll.ctc)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeePayroll;
