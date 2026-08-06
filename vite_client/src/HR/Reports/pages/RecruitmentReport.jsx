import React, { useEffect, useMemo, useState } from 'react';
import { FaClock, FaBriefcase, FaCheckDouble, FaUsers } from 'react-icons/fa';
import axios from '../../../utils/axios';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportKpiCard from '../components/ReportKpiCard';
import ReportPageHeader from '../components/ReportPageHeader';
import ReportChartCard from '../components/ReportChartCard';
import ReportDataTable from '../components/ReportDataTable';

const RecruitmentReport = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const { data: res } = await axios.get('/v1/admin/recruitment/analytics', { withCredentials: true });
                if (!cancelled) setData(res.data || {});
            } catch {
                if (!cancelled) setError('Failed to load recruitment analytics');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const funnelRows = useMemo(() => {
        const funnel = data?.funnelPct || data?.funnel || [];
        const max = Math.max(...funnel.map((f) => f.count || 0), 1);
        return funnel.map((stage, i) => ({
            id: stage.stage,
            stage: stage.stage,
            count: stage.count || 0,
            pct: `${stage.pct != null ? stage.pct : Math.round(((stage.count || 0) / max) * 100)}%`,
            width: `${Math.max(8, ((stage.count || 0) / max) * 100)}%`,
            color: `rgba(32, 201, 151, ${1 - i * 0.12})`,
        }));
    }, [data]);

    const jobRows = useMemo(() => (
        (data?.jobBreakdown || []).map((j, idx) => ({
            id: j._id || idx,
            title: j.jobTitle || 'Untitled',
            idCode: String(j._id || '').slice(-6).toUpperCase() || '—',
            dept: j.department || '—',
            apps: j.apps || 0,
            interviewed: j.interviewed || 0,
            offers: j.offers || 0,
            conversion: `${Math.round((j.conversion || 0) * 10) / 10}%`,
        }))
    ), [data]);

    const sourceRows = useMemo(() => (
        (data?.sourcePerformance || data?.sourceStatistics || []).map((s, i) => ({
            id: s._id || i,
            source: s._id || 'Unknown',
            applicants: s.count || 0,
            hired: s.hired || 0,
        }))
    ), [data]);

    if (loading) return <LoadingSpinner message="Loading recruitment report..." />;
    if (error) return <p className="p-4 text-red-600">{error}</p>;

    const timeToHire = Math.round(data?.averageTimeToHire || data?.timeToHire?.avgTimeToHire || 0);
    const offerRate = data?.offerAcceptanceRate || 0;

    return (
        <div>
            <ReportPageHeader
                title="Recruitment Pipeline Analytics"
                subtitle="Live data from ATS candidates and job postings"
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpiCard title="Time to Hire" value={`${timeToHire} days`} icon={FaClock} />
                <ReportKpiCard
                    title="Time to Fill"
                    value={`${Math.round(data?.averageTimeToFill || timeToHire)} days`}
                    icon={FaClock}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                />
                <ReportKpiCard
                    title="Offer Acceptance"
                    value={`${offerRate}%`}
                    icon={FaCheckDouble}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                />
                <ReportKpiCard
                    title="Open Jobs"
                    value={data?.openPostings || 0}
                    subtitle={`${data?.totalCandidates || 0} candidates`}
                    icon={FaBriefcase}
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ReportKpiCard title="Interview Success" value={`${data?.interviewSuccessRate || 0}%`} icon={FaUsers} />
                <ReportKpiCard title="Offers Extended" value={data?.offers?.offered || 0} icon={FaCheckDouble} />
                <ReportKpiCard title="Total Hires" value={(data?.funnel || []).find((f) => f.stage === 'Hired')?.count || 0} icon={FaBriefcase} />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ReportChartCard title="Hiring Funnel" subtitle="Live candidate stages">
                        <div className="flex h-full flex-col justify-center gap-3 py-2">
                            {funnelRows.length === 0 ? (
                                <p className="text-sm text-slate-500">No candidate data yet.</p>
                            ) : funnelRows.map((row) => (
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
                                    <span className="w-12 text-right text-xs text-slate-500">{row.pct}</span>
                                </div>
                            ))}
                        </div>
                    </ReportChartCard>
                </div>
                <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="mb-3 text-sm font-semibold text-slate-800">Monthly Hiring</p>
                    {(data?.monthlyHiring || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No hires recorded yet.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {data.monthlyHiring.map((m) => (
                                <li key={m._id} className="flex justify-between border-b py-1">
                                    <span className="text-slate-600">{m._id}</span>
                                    <span className="font-semibold">{m.hires}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ReportDataTable
                    title="Source Performance"
                    columns={[
                        { key: 'source', label: 'Source' },
                        { key: 'applicants', label: 'Applicants' },
                        { key: 'hired', label: 'Hired' },
                    ]}
                    rows={sourceRows}
                    emptyMessage="No source data"
                />
                <ReportDataTable
                    title="Recruiter Performance"
                    columns={[
                        { key: 'name', label: 'Recruiter' },
                        { key: 'candidates', label: 'Candidates' },
                        { key: 'hired', label: 'Hired' },
                    ]}
                    rows={(data?.recruiterPerformance || []).map((r, i) => ({
                        id: r._id || i,
                        name: r.name || 'Unassigned',
                        candidates: r.candidates || 0,
                        hired: r.hired || 0,
                    }))}
                    emptyMessage="No recruiter assignments yet"
                />
            </div>

            <ReportDataTable
                title="Jobs Breakdown"
                columns={[
                    { key: 'title', label: 'Role' },
                    { key: 'dept', label: 'Department' },
                    { key: 'apps', label: 'Apps' },
                    { key: 'interviewed', label: 'Interviewed' },
                    { key: 'offers', label: 'Offers' },
                    { key: 'conversion', label: 'Hire %' },
                ]}
                rows={jobRows}
                emptyMessage="No job applications yet"
            />
        </div>
    );
};

export default RecruitmentReport;
