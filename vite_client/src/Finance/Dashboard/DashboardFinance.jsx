import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FiArrowUpRight,
    FiFileText,
    FiHeadphones,
    FiPlus,
} from 'react-icons/fi';
import {
    FaChartLine,
    FaCheckCircle,
    FaMoneyBillWave,
    FaReceipt,
} from 'react-icons/fa';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import { useExpenses, usePayrolls } from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';

const MINT = '#0E9370';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

const formatCompactInr = (amount) => {
    const n = Number(amount) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
    return formatCurrency(n);
};

const statusOf = (value) => String(value || '').toLowerCase();

const expenseDateOf = (expense) => new Date(expense?.expenseDate || expense?.date || expense?.createdAt);

const expenseName = (expense) => {
    const employee = expense?.employeeId;
    if (employee && typeof employee === 'object') {
        const name = [employee.name, employee.lastName].filter(Boolean).join(' ');
        if (name) return name;
    }
    return expense?.employeeName || 'Employee';
};

const payrollAmount = (payroll) =>
    Number(payroll?.totalAmount ?? payroll?.inHandSalary ?? payroll?.amount ?? payroll?.earnings?.totalEarnings ?? 0) || 0;

const isMonthlyPayroll = (payroll) => !payroll?.type || payroll.type === 'monthly';

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const monthIndexFrom = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const asNumber = Number(raw);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) return asNumber - 1;
    if (raw.length < 3) return -1;
    return MONTH_NAMES.findIndex((name) => name === raw || name.startsWith(raw));
};

const monthKey = (year, monthIndex) => `${year}-${monthIndex}`;

const emptyBucket = (year, monthIndex) => ({
    key: monthKey(year, monthIndex),
    label: new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'short' }),
    monthName: new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' }),
    year,
    total: 0,
    count: 0,
});

const KpiCard = ({ label, value, detail, icon: Icon, tone = 'mint', onClick, title }) => {
    const tones = {
        mint: 'bg-[#0E9370]/10 text-[#0E9370]',
        amber: 'bg-amber-50 text-amber-600',
        slate: 'bg-slate-100 text-slate-600',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            title={title || detail}
            className="flex h-full w-full min-w-0 items-start justify-between gap-3 rounded-2xl border border-[rgba(14,43,61,0.08)] bg-white p-4 text-left shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(14,43,61,0.1)] sm:p-5"
        >
            <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <span className="mt-1 block truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</span>
                {detail ? <span className="mt-1 block truncate text-xs font-medium text-slate-500">{detail}</span> : null}
            </span>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.mint}`}>
                <Icon className="h-5 w-5" />
            </span>
        </button>
    );
};

const DashboardFinance = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);

    const {
        data: payrolls = [],
        isLoading: payrollsLoading,
        error: payrollsError,
    } = usePayrolls();

    const {
        data: expenses = [],
        isLoading: expensesLoading,
        error: expensesError,
    } = useExpenses();

    useEffect(() => {
        if (payrollsError) {
            handleApiError(payrollsError, {
                context: 'Finance Dashboard',
                showToast: payrollsError.response?.status !== 401,
            });
        }
        if (expensesError) {
            handleApiError(expensesError, {
                context: 'Finance Dashboard - Expenses',
                showToast: expensesError.response?.status !== 401,
            });
        }
    }, [payrollsError, expensesError]);

    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
    const currentYear = now.getFullYear();

    const stats = useMemo(() => {
        const payrollList = Array.isArray(payrolls) ? payrolls : [];
        const expenseList = Array.isArray(expenses) ? expenses : [];
        const monthlyPayrolls = payrollList.filter(isMonthlyPayroll);
        const byPeriod = new Map();

        monthlyPayrolls.forEach((payroll) => {
            const monthIndex = monthIndexFrom(payroll.month);
            const year = Number(payroll.year);
            if (monthIndex < 0 || !Number.isInteger(year)) return;
            const key = monthKey(year, monthIndex);
            const bucket = byPeriod.get(key) || emptyBucket(year, monthIndex);
            bucket.total += payrollAmount(payroll);
            bucket.count += 1;
            byPeriod.set(key, bucket);
        });

        const recentWindow = [];
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date(currentYear, currentMonthIndex - i, 1);
            const key = monthKey(date.getFullYear(), date.getMonth());
            recentWindow.push(byPeriod.get(key) || emptyBucket(date.getFullYear(), date.getMonth()));
        }

        const periods = [...byPeriod.values()].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return MONTH_NAMES.indexOf(a.monthName.toLowerCase()) - MONTH_NAMES.indexOf(b.monthName.toLowerCase());
        });
        const buckets = recentWindow.some((item) => item.count > 0) ? recentWindow : periods.slice(-6);
        const currentKey = monthKey(currentYear, currentMonthIndex);
        const currentBucket = byPeriod.get(currentKey);
        const latestBucket = periods[periods.length - 1];
        const showingCurrent = Boolean(currentBucket?.count);

        const pending = expenseList.filter((expense) => statusOf(expense.status) === 'pending');
        const inThisMonth = (expense) => {
            const date = expenseDateOf(expense);
            return date.getMonth() === currentMonthIndex && date.getFullYear() === currentYear && !Number.isNaN(date.getTime());
        };
        const thisMonthExpenses = expenseList.filter(inThisMonth);
        const approvedThisMonth = thisMonthExpenses.filter((expense) =>
            ['approved', 'paid'].includes(statusOf(expense.status))
        );

        const sumAmounts = (items) => items.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

        return {
            buckets,
            period: showingCurrent
                ? { label: `${currentMonthName} ${currentYear}`, total: currentBucket.total, count: currentBucket.count, isCurrent: true }
                : {
                    label: latestBucket ? `${latestBucket.monthName} ${latestBucket.year}` : `${currentMonthName} ${currentYear}`,
                    total: latestBucket?.total || 0,
                    count: latestBucket?.count || 0,
                    isCurrent: false,
                },
            runs: [...periods].reverse().slice(0, 4),
            pending,
            pendingAmount: sumAmounts(pending),
            monthlyExpenseTotal: sumAmounts(thisMonthExpenses),
            approvedCount: approvedThisMonth.length,
            approvedAmount: sumAmounts(approvedThisMonth),
        };
    }, [payrolls, expenses, currentMonthIndex, currentMonthName, currentYear]);

    if (payrollsLoading || expensesLoading) {
        return <LoadingSpinner message="Loading Finance Dashboard..." />;
    }

    const periodDetail = stats.period.count
        ? `${stats.period.count} ${stats.period.count === 1 ? 'employee' : 'employees'}${stats.period.isCurrent ? '' : ' · latest run'}`
        : 'No payroll run yet';

    const shortcuts = [
        {
            title: 'Payroll',
            detail: 'Review, generate, and disburse salaries',
            icon: FaMoneyBillWave,
            onClick: () => navigate('/admin-payroll'),
        },
        {
            title: 'Salary structure',
            detail: 'Earnings, deductions, and bonus rules',
            icon: FiFileText,
            onClick: () => navigate('/salary-structure'),
        },
        {
            title: 'Create payroll',
            detail: 'Add a record for one employee',
            icon: FiPlus,
            onClick: () => navigate('/add-payroll'),
        },
    ];

    return (
        <div className="min-h-screen bg-[#F3F7F5]">
            <div className="page-shell">
                <div className="page-shell-inner">
                    <div className="hrms-stack">
                        <AnnouncementBanner />

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Finance</h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    {currentMonthName} {currentYear} · Welcome, {user?.name || user?.username || 'Finance'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin-payroll')}
                                    className="inline-flex h-10 items-center justify-center rounded-full bg-[#0E9370] px-4 text-sm font-semibold text-white hover:bg-[#0B7458]"
                                >
                                    Open payroll
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/helpdesk')}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                    title="Helpdesk"
                                >
                                    <FiHeadphones className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <KpiCard
                                label="Payroll"
                                value={formatCompactInr(stats.period.total)}
                                detail={periodDetail}
                                title={`${stats.period.label}: ${formatCurrency(stats.period.total)}`}
                                icon={FaMoneyBillWave}
                                onClick={() => navigate('/admin-payroll')}
                            />
                            <KpiCard
                                label="Pending expenses"
                                value={stats.pending.length}
                                detail={stats.pending.length ? `${formatCompactInr(stats.pendingAmount)} waiting` : 'Nothing waiting'}
                                title={formatCurrency(stats.pendingAmount)}
                                icon={FaReceipt}
                                tone={stats.pending.length ? 'amber' : 'mint'}
                                onClick={() => document.getElementById('finance-expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            />
                            <KpiCard
                                label="Expenses this month"
                                value={formatCompactInr(stats.monthlyExpenseTotal)}
                                detail="Recorded this month"
                                title={formatCurrency(stats.monthlyExpenseTotal)}
                                icon={FaChartLine}
                                tone="slate"
                                onClick={() => document.getElementById('finance-expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            />
                            <KpiCard
                                label="Approved this month"
                                value={stats.approvedCount}
                                detail={stats.approvedCount ? formatCompactInr(stats.approvedAmount) : 'No approvals yet'}
                                title={formatCurrency(stats.approvedAmount)}
                                icon={FaCheckCircle}
                                onClick={() => document.getElementById('finance-expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                            <section className="rounded-2xl border border-[rgba(14,43,61,0.08)] bg-white p-4 shadow-sm sm:p-5 xl:col-span-3">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">Payroll trend</h2>
                                        <p className="mt-0.5 text-xs text-slate-500">Net pay by month</p>
                                    </div>
                                    <p className="text-sm font-semibold tabular-nums text-[#0E9370]" title={formatCurrency(stats.period.total)}>
                                        {formatCompactInr(stats.period.total)}
                                    </p>
                                </div>
                                <div className="h-[220px] min-w-0 sm:h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.buckets} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="financePayrollFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={MINT} stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor={MINT} stopOpacity={0.04} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="label"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }}
                                                dy={6}
                                            />
                                            <YAxis hide />
                                            <Tooltip
                                                formatter={(value) => [formatCurrency(value), 'Net pay']}
                                                contentStyle={{
                                                    borderRadius: 16,
                                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="total"
                                                stroke={MINT}
                                                fill="url(#financePayrollFill)"
                                                strokeWidth={3}
                                                dot={{ r: 0 }}
                                                activeDot={{ r: 5, fill: MINT }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-[rgba(14,43,61,0.08)] bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">Recent payroll runs</h2>
                                        <p className="mt-0.5 text-xs text-slate-500">Monthly net pay</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/admin-payroll')}
                                        className="text-xs font-semibold text-[#0E9370] hover:text-[#0B7458]"
                                    >
                                        View all
                                    </button>
                                </div>
                                {stats.runs.length ? (
                                    <ul className="divide-y divide-slate-100">
                                        {stats.runs.map((run) => (
                                            <li key={run.key} className="flex items-center justify-between gap-3 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900">
                                                        {run.monthName} {run.year}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {run.count} {run.count === 1 ? 'employee' : 'employees'}
                                                    </p>
                                                </div>
                                                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900" title={formatCurrency(run.total)}>
                                                    {formatCompactInr(run.total)}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="py-8 text-center text-sm text-slate-500">No payroll has been generated yet.</p>
                                )}
                            </section>
                        </div>

                        <section id="finance-expenses" className="rounded-2xl border border-[rgba(14,43,61,0.08)] bg-white p-4 shadow-sm sm:p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Expenses waiting</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {stats.pending.length
                                            ? `${stats.pending.length} pending · ${formatCurrency(stats.pendingAmount)}`
                                            : 'The approval queue is clear'}
                                    </p>
                                </div>
                            </div>
                            {stats.pending.length ? (
                                <ul className="divide-y divide-slate-100">
                                    {stats.pending.slice(0, 6).map((expense) => {
                                        const date = expenseDateOf(expense);
                                        const dateLabel = Number.isNaN(date.getTime())
                                            ? '—'
                                            : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                        return (
                                            <li key={expense._id || `${expenseName(expense)}-${expense.amount}`} className="flex items-center justify-between gap-3 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900">{expenseName(expense)}</p>
                                                    <p className="truncate text-xs text-slate-500">
                                                        {expense.category || 'Expense'} · {dateLabel}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>
                                                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                                                        {formatCurrency(expense.amount)}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="py-8 text-center text-sm text-slate-500">No expenses are waiting for approval.</p>
                            )}
                        </section>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {shortcuts.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.title}
                                        type="button"
                                        onClick={item.onClick}
                                        className="flex items-center gap-3 rounded-2xl border border-[rgba(14,43,61,0.08)] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0E9370]/10 text-[#0E9370]">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                                            <span className="mt-0.5 block truncate text-xs text-slate-500">{item.detail}</span>
                                        </span>
                                        <FiArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardFinance;
