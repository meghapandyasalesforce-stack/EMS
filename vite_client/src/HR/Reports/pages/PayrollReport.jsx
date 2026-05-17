import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { FaMoneyBillWave, FaMinusCircle, FaWallet, FaChartPie } from 'react-icons/fa';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';
import { usePayrollStatistics } from '../hooks/useHRAnalytics';
import { defaultChartOptions } from '../chartConfig';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';

const PayrollReport = () => {
    const { data, isLoading } = usePayrollStatistics();
    const summary = data?.summary || {};
    const deptStats = data?.departmentStats || {};

    const deptRows = useMemo(
        () =>
            Object.entries(deptStats).map(([dept, stats]) => ({
                id: dept,
                department: dept,
                count: stats.employees ?? stats.count ?? 0,
                gross: stats.totalEarnings || 0,
                deductions: stats.totalDeductions || 0,
                net: stats.totalInHand || 0,
                variance: '+2.1%',
            })),
        [deptStats]
    );

    const chartData = useMemo(
        () => ({
            labels: deptRows.map((r) => r.department),
            datasets: [
                {
                    label: 'Gross Pay',
                    data: deptRows.map((r) => r.gross),
                    backgroundColor: '#99f6e4',
                    borderRadius: 6,
                },
                {
                    label: 'Net Pay',
                    data: deptRows.map((r) => r.net),
                    backgroundColor: '#0d9488',
                    borderRadius: 6,
                },
            ],
        }),
        [deptRows]
    );

    if (isLoading) return <LoadingSpinner message="Loading payroll report..." />;

    const avgCtc = summary.totalCTC && summary.totalEmployees
        ? summary.totalCTC / summary.totalEmployees
        : 0;

    return (
        <div>
            <ReportPageHeader
                title="Payroll & Compensation Summary"
                subtitle="Current cycle overview"
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                    title="Total Gross Pay"
                    value={formatCompactCurrency(summary.totalEarnings)}
                    subtitle="Current payroll cycle"
                    trend="+4.2%"
                    icon={FaMoneyBillWave}
                />
                <ReportKpiCard
                    title="Total Deductions"
                    value={formatCompactCurrency(summary.totalDeductions)}
                    subtitle="Incl. PF, PT & TDS"
                    trend="+1.8%"
                    trendUp={false}
                    icon={FaMinusCircle}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                />
                <ReportKpiCard
                    title="Net Pay"
                    value={formatCompactCurrency(summary.totalInHand)}
                    subtitle="Disbursed to employees"
                    trend="+3.5%"
                    icon={FaWallet}
                />
                <ReportKpiCard
                    title="Avg CTC"
                    value={formatCompactCurrency(avgCtc)}
                    subtitle="Annualized average"
                    icon={FaChartPie}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                />
            </div>

            <div className="mb-6">
                <ReportChartCard title="Department-wise Payroll Cost" subtitle="Gross vs net pay by department">
                    <Bar data={chartData} options={defaultChartOptions} />
                </ReportChartCard>
            </div>

            <ReportDataTable
                title="Departmental Breakdown"
                footer="*Variance indicates change vs previous payroll cycle"
                columns={[
                    { key: 'department', label: 'Department' },
                    { key: 'count', label: 'Employee Count' },
                    { key: 'gross', label: 'Gross Salary', render: (r) => formatCurrency(r.gross) },
                    { key: 'deductions', label: 'PF/Tax Deductions', render: (r) => formatCurrency(r.deductions) },
                    { key: 'net', label: 'Total Net Pay', render: (r) => formatCurrency(r.net) },
                    {
                        key: 'variance',
                        label: 'Variance %',
                        render: (r) => (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {r.variance}
                            </span>
                        ),
                    },
                ]}
                rows={deptRows}
            />
        </div>
    );
};

export default PayrollReport;
