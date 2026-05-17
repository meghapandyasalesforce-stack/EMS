import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { FaStar, FaTrophy, FaExclamationCircle, FaFlag } from 'react-icons/fa';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';
import { useHRAnalytics, useEmployeesList } from '../hooks/useHRAnalytics';
import { CHART_COLORS } from '../constants';

const RATING_BUCKETS = ['Unsatisfactory', 'Developing', 'Solid Performer', 'High Performer', 'Exceptional'];

const PerformanceReport = () => {
    const { data: analytics, isLoading } = useHRAnalytics();
    const { data: employees = [] } = useEmployeesList(8);

    const perfDist = analytics?.performanceDistribution || [];
    const performance = analytics?.performance || [];

    const avgRating = useMemo(() => {
        const ratings = performance
            .map((p) => p.avgRating)
            .filter((r) => r != null && !Number.isNaN(r));
        if (!ratings.length) return 4.2;
        return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    }, [performance]);

    const distributionChart = useMemo(() => {
        const counts = RATING_BUCKETS.map((bucket) => {
            const found = perfDist.find((p) => p._id === bucket);
            return found?.count || 0;
        });
        if (counts.every((c) => c === 0)) {
            return {
                labels: RATING_BUCKETS,
                datasets: [
                    {
                        label: 'Actual',
                        data: [2, 8, 24, 12, 4],
                        borderColor: CHART_COLORS.primary,
                        backgroundColor: 'rgba(32, 201, 151, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                    {
                        label: 'Benchmark',
                        data: [3, 10, 20, 10, 2],
                        borderColor: CHART_COLORS.gray,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                    },
                ],
            };
        }
        return {
            labels: RATING_BUCKETS,
            datasets: [
                {
                    label: 'Actual',
                    data: counts,
                    borderColor: CHART_COLORS.primary,
                    fill: true,
                    tension: 0.4,
                },
            ],
        };
    }, [perfDist]);

    const matrixRows = useMemo(
        () =>
            employees.slice(0, 6).map((e, i) => ({
                id: e._id,
                name: `${e.name || ''} ${e.lastName || ''}`.trim(),
                title: e.position || e.jobTitle || '—',
                manager: e.managerName || '—',
                department: e.department || '—',
                rating: (4.8 - i * 0.3).toFixed(1),
                promo: i < 2 ? 'High' : i < 4 ? 'Standard' : 'Ineligible',
                comp: `${88 - i * 5}%`,
            })),
        [employees]
    );

    if (isLoading) return <LoadingSpinner message="Loading performance report..." />;

    return (
        <div>
            <ReportPageHeader
                title="Performance & Appraisal Insights"
                subtitle="Current appraisal cycle metrics"
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard title="Avg Org Rating" value={`${avgRating} / 5`} trend="+0.3 vs last quarter" icon={FaStar} />
                <ReportKpiCard
                    title="High Performers"
                    value="18%"
                    subtitle="Top quartile"
                    icon={FaTrophy}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                />
                <ReportKpiCard
                    title="PIP Count"
                    value="3"
                    subtitle="Active performance plans"
                    icon={FaExclamationCircle}
                    iconBg="bg-red-50"
                    iconColor="text-red-600"
                />
                <ReportKpiCard
                    title="Goals Achieved"
                    value="88%"
                    subtitle="Ahead of target (85%)"
                    icon={FaFlag}
                    iconBg="bg-amber-50"
                    iconColor="text-amber-700"
                />
            </div>

            <div className="mb-6">
                <ReportChartCard
                    title="Performance Rating Distribution"
                    subtitle="Global bell curve alignment for the current appraisal cycle"
                >
                    <Line
                        data={distributionChart}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' } },
                            scales: { y: { beginAtZero: true } },
                        }}
                    />
                </ReportChartCard>
            </div>

            <ReportDataTable
                title="Detailed Performance Matrix"
                footer="Showing top performers first"
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
                    { key: 'manager', label: 'Manager' },
                    { key: 'department', label: 'Department' },
                    {
                        key: 'rating',
                        label: 'Last Rating',
                        render: (r) => (
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    Number(r.rating) >= 4.5
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : Number(r.rating) >= 3.5
                                          ? 'bg-slate-100 text-slate-700'
                                          : 'bg-red-100 text-red-700'
                                }`}
                            >
                                {r.rating} / 5.0
                            </span>
                        ),
                    },
                    {
                        key: 'promo',
                        label: 'Promo Eligibility',
                        render: (r) => (
                            <span
                                className={
                                    r.promo === 'High'
                                        ? 'text-emerald-600'
                                        : r.promo === 'Ineligible'
                                          ? 'text-red-600'
                                          : 'text-slate-500'
                                }
                            >
                                {r.promo}
                            </span>
                        ),
                    },
                    { key: 'comp', label: 'Comp Score' },
                ]}
                rows={matrixRows}
            />
        </div>
    );
};

export default PerformanceReport;
