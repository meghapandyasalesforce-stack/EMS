import React, { useMemo } from 'react';
import { FaClock, FaRupeeSign, FaCheckDouble, FaBriefcase } from 'react-icons/fa';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';
import { useHRAnalytics } from '../hooks/useHRAnalytics';
import { formatCompactCurrency } from '../utils/formatters';

const FUNNEL_STAGES = [
    { label: 'Applications', pct: 100 },
    { label: 'Screening', pct: 65 },
    { label: 'Interview', pct: 32 },
    { label: 'Offer', pct: 12 },
    { label: 'Hired', pct: 8.2 },
];

const RecruitmentReport = () => {
    const { data: analytics, isLoading } = useHRAnalytics();
    const recruitment = analytics?.recruitment || {};

    const timeToHire = Math.round(
        recruitment.timeToHire?.avgTimeToHire || recruitment.avgTimeToFill || 22
    );
    const offerRate = recruitment.offerAcceptanceRate || 92;
    const totalCandidates = recruitment.totalCandidates || 0;

    const funnelRows = useMemo(() => {
        const base = totalCandidates || 1240;
        return FUNNEL_STAGES.map((stage, i) => ({
            id: stage.label,
            stage: stage.label,
            count: Math.round(base * (stage.pct / 100)),
            pct: `${stage.pct}%`,
            width: `${stage.pct}%`,
            color: `rgba(32, 201, 151, ${1 - i * 0.15})`,
        }));
    }, [totalCandidates]);

    const jobRows = useMemo(
        () => [
            { id: 1, title: 'Senior Product Designer', idCode: 'REQ-2024-082', dept: 'Product & Design', apps: 342, interviewed: 45, offers: 4, conversion: '1.2%' },
            { id: 2, title: 'Backend Engineer (Go)', idCode: 'REQ-2024-091', dept: 'Engineering', apps: 189, interviewed: 28, offers: 2, conversion: '1.1%' },
            { id: 3, title: 'Marketing Lead', idCode: 'REQ-2024-077', dept: 'Growth', apps: 215, interviewed: 12, offers: 1, conversion: '0.5%' },
            { id: 4, title: 'HR Generalist', idCode: 'REQ-2024-095', dept: 'People Operations', apps: 92, interviewed: 18, offers: 3, conversion: '3.2%' },
        ],
        []
    );

    if (isLoading) return <LoadingSpinner message="Loading recruitment report..." />;

    return (
        <div>
            <ReportPageHeader
                title="Recruitment Pipeline Analytics"
                subtitle="Last 90 days candidate progression"
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard title="Time to Hire" value={`${timeToHire} days`} trend="-3 days" icon={FaClock} />
                <ReportKpiCard
                    title="Cost per Hire"
                    value={formatCompactCurrency(recruitment.costPerHire || 45000)}
                    subtitle="On budget"
                    icon={FaRupeeSign}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <ReportKpiCard
                    title="Offer Acceptance"
                    value={`${offerRate}%`}
                    trend="+4%"
                    icon={FaCheckDouble}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                />
                <ReportKpiCard
                    title="Active Openings"
                    value={recruitment.totalPostings || 24}
                    subtitle="Open requisitions"
                    icon={FaBriefcase}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ReportChartCard title="Hiring Funnel Conversion" subtitle="Candidate progression">
                        <div className="flex h-full flex-col justify-center gap-3 py-2">
                            {funnelRows.map((row) => (
                                <div key={row.id} className="flex items-center gap-3">
                                    <span className="w-24 shrink-0 text-xs font-medium text-slate-600">{row.stage}</span>
                                    <div className="flex-1">
                                        <div
                                            className="flex h-8 items-center rounded-md px-3 text-xs font-semibold text-white"
                                            style={{ width: row.width, minWidth: '60px', backgroundColor: row.color }}
                                        >
                                            {row.count}
                                        </div>
                                    </div>
                                    <span className="w-10 text-right text-xs text-slate-500">{row.pct}</span>
                                </div>
                            ))}
                        </div>
                    </ReportChartCard>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-[#0d9488] to-[#14b8a6] p-6 text-white shadow-lg">
                    <p className="text-sm font-semibold opacity-90">Pipeline Optimization</p>
                    <p className="mt-3 text-sm leading-relaxed opacity-95">
                        Your screening-to-interview stage may be slower than industry average. Consider batching screening tasks.
                    </p>
                    <button
                        type="button"
                        className="mt-6 w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0d9488] transition hover:bg-slate-50"
                    >
                        View Optimization Guide
                    </button>
                </div>
            </div>

            <ReportDataTable
                title="Detailed Job Performance"
                columns={[
                    {
                        key: 'title',
                        label: 'Job Title',
                        render: (r) => (
                            <div>
                                <p className="font-medium">{r.title}</p>
                                <p className="text-xs text-slate-500">{r.idCode}</p>
                            </div>
                        ),
                    },
                    { key: 'dept', label: 'Department' },
                    { key: 'apps', label: 'Applications' },
                    { key: 'interviewed', label: 'Interviewed' },
                    { key: 'offers', label: 'Offers Made' },
                    {
                        key: 'conversion',
                        label: 'Conversion',
                        render: (r) => (
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    parseFloat(r.conversion) >= 2
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-orange-100 text-orange-700'
                                }`}
                            >
                                {r.conversion}
                            </span>
                        ),
                    },
                ]}
                rows={jobRows}
            />
        </div>
    );
};

export default RecruitmentReport;
