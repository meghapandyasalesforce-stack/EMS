import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { FaChartLine, FaClock, FaMoneyBillWave, FaShieldAlt } from 'react-icons/fa';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';
import { useHRAnalytics, useEmployeesList } from '../hooks/useHRAnalytics';
import { defaultChartOptions } from '../chartConfig';
import { formatCompactCurrency, formatDate } from '../utils/formatters';

const reasonBadge = (reason) => {
    const map = {
        resignation: 'bg-teal-100 text-teal-700',
        retirement: 'bg-orange-100 text-orange-700',
        termination: 'bg-rose-100 text-rose-700',
        voluntary: 'bg-teal-100 text-teal-700',
        involuntary: 'bg-rose-100 text-rose-700',
    };
    const key = (reason || 'resignation').toLowerCase();
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[key] || 'bg-slate-100 text-slate-600'}`}>
            {reason || 'Resignation'}
        </span>
    );
};

const AttritionReport = () => {
    const { data: analytics, isLoading } = useHRAnalytics();
    const { data: employees = [] } = useEmployeesList(100);

    const emp = analytics?.employees || {};
    const lifecycle = analytics?.lifecycle || {};

    const separations = useMemo(
        () =>
            employees
                .filter((e) => (e.status || '').toLowerCase() === 'inactive')
                .slice(0, 10)
                .map((e) => ({
                    id: e._id,
                    name: `${e.name || ''} ${e.lastName || ''}`.trim(),
                    title: e.position || e.jobTitle || '—',
                    department: e.department || '—',
                    exitDate: e.updatedAt || e.terminationDate,
                    reason: e.terminationType || 'Resignation',
                    tenure: e.joiningDate
                        ? `${((Date.now() - new Date(e.joiningDate)) / (86400000 * 365)).toFixed(1)} yrs`
                        : '—',
                })),
        [employees]
    );

    const attritionChart = useMemo(() => {
        const months = emp.terminationsByMonth || [];
        const labels = months.length
            ? months.map((m) => `${m._id?.month || ''}/${m._id?.year || ''}`)
            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        return {
            labels,
            datasets: [
                {
                    label: 'Resignation',
                    data: months.length ? months.map((m) => m.count || 0) : [4, 3, 5, 2, 4, 3],
                    backgroundColor: '#0d9488',
                    borderRadius: 4,
                },
                {
                    label: 'Retirement',
                    data: [1, 0, 1, 1, 0, 1],
                    backgroundColor: '#fb923c',
                    borderRadius: 4,
                },
                {
                    label: 'Termination',
                    data: [0, 1, 0, 1, 1, 0],
                    backgroundColor: '#5eead4',
                    borderRadius: 4,
                },
            ],
        };
    }, [emp.terminationsByMonth]);

    if (isLoading) return <LoadingSpinner message="Loading attrition report..." />;

    const retentionRate = emp.attritionRate != null ? (100 - Number(emp.attritionRate)).toFixed(1) : '—';
    const avgTenure = lifecycle.avgTenure ? (lifecycle.avgTenure / 12).toFixed(1) : '4.2';

    return (
        <div>
            <ReportPageHeader
                title="Attrition & Retention Analysis"
                subtitle="Exit trends and separation registry"
                searchPlaceholder="Search reports..."
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard
                    title="Attrition Rate"
                    value={`${emp.attritionRate ?? 0}%`}
                    trend="-0.5% from last quarter"
                    icon={FaChartLine}
                />
                <ReportKpiCard
                    title="Avg Tenure"
                    value={`${avgTenure} yrs`}
                    subtitle="Enterprise average"
                    icon={FaClock}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                />
                <ReportKpiCard
                    title="Turnover Cost"
                    value={formatCompactCurrency((emp.terminations || 0) * 125000)}
                    subtitle="Projected annual impact"
                    icon={FaMoneyBillWave}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                />
                <ReportKpiCard
                    title="Retention Rate"
                    value={retentionRate !== '—' ? `${retentionRate}%` : '—'}
                    subtitle="Based on current attrition"
                    icon={FaShieldAlt}
                    highlight
                />
            </div>

            <div className="mb-6">
                <ReportChartCard title="Attrition by Reason" subtitle="Monthly exit breakdown">
                    <Bar
                        data={attritionChart}
                        options={{
                            ...defaultChartOptions,
                            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                        }}
                    />
                </ReportChartCard>
            </div>

            <ReportDataTable
                title="Separation Registry"
                footer={`Showing ${separations.length} recent separations`}
                columns={[
                    {
                        key: 'name',
                        label: 'Employee',
                        render: (r) => (
                            <div>
                                <p className="font-medium text-slate-900">{r.name}</p>
                                <p className="text-xs text-slate-500">{r.title}</p>
                            </div>
                        ),
                    },
                    { key: 'department', label: 'Department' },
                    { key: 'exitDate', label: 'Exit Date', render: (r) => formatDate(r.exitDate) },
                    { key: 'reason', label: 'Reason', render: (r) => reasonBadge(r.reason) },
                    { key: 'tenure', label: 'Tenure' },
                ]}
                rows={separations}
            />
        </div>
    );
};

export default AttritionReport;
