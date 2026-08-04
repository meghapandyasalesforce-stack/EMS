import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaFileAlt, FaFileContract, FaUser,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const STAGE_TONE = {
    Application: 'border-sky-200 bg-sky-50 text-sky-800',
    Screening: 'border-amber-200 bg-amber-50 text-amber-900',
    Interview: 'border-violet-200 bg-violet-50 text-violet-900',
    Offer: 'border-teal-200 bg-teal-50 text-teal-900',
    Hired: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    Rejected: 'border-red-200 bg-red-50 text-red-800',
};

const PipelinePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const jobPostingId = searchParams.get('jobPostingId') || '';
    const [loading, setLoading] = useState(true);
    const [pipeline, setPipeline] = useState([]);
    const [selected, setSelected] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [bulkStatus, setBulkStatus] = useState('Screening');
    const [busy, setBusy] = useState(false);

    const fetchPipeline = useCallback(async () => {
        try {
            setLoading(true);
            const qs = jobPostingId ? `?jobPostingId=${jobPostingId}` : '';
            const { data } = await axios.get(`/v1/admin/recruitment/pipeline${qs}`, { withCredentials: true });
            setPipeline(data.data || []);
        } catch {
            toast.error('Failed to load pipeline');
        } finally {
            setLoading(false);
        }
    }, [jobPostingId]);

    useEffect(() => {
        fetchPipeline();
        axios.get('/v1/admin/recruitment/jobs?limit=100', { withCredentials: true })
            .then((res) => setJobs(res.data?.data || []))
            .catch(() => {});
    }, [fetchPipeline]);

    const totalCandidates = useMemo(
        () => pipeline.reduce((sum, col) => sum + (col.count || 0), 0),
        [pipeline]
    );

    const toggle = (id) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const runBulk = async () => {
        if (!selected.length) {
            toast.error('Select at least one candidate');
            return;
        }
        try {
            setBusy(true);
            const { data } = await axios.post('/v1/admin/recruitment/candidates/bulk', {
                ids: selected,
                status: bulkStatus,
            }, { withCredentials: true });
            toast.success(data.message || 'Updated');
            setSelected([]);
            fetchPipeline();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk update failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading pipeline…" />;

    return (
        <div className="flex h-[calc(100dvh-3.75rem)] max-h-[calc(100dvh-3.75rem)] flex-col overflow-hidden bg-gray-50 p-3 sm:p-4">
            <div className="mx-auto flex min-h-0 w-full max-w-[100%] flex-1 flex-col">
                <div className="mb-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/recruitment')}
                        className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                        <FaArrowLeft /> Back to Recruitment
                    </button>
                    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Recruitment Pipeline</h1>
                            <p className="mt-0.5 text-sm text-gray-600">
                                 {totalCandidates} candidate{totalCandidates === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Job</label>
                            <select
                                className="min-w-[12rem] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20"
                                value={jobPostingId}
                                onChange={(e) => navigate(e.target.value ? `/recruitment/pipeline?jobPostingId=${e.target.value}` : '/recruitment/pipeline')}
                            >
                                <option value="">All jobs</option>
                                {jobs.map((j) => (
                                    <option key={j._id} value={j._id}>{j.jobTitle}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {selected.length > 0 && (
                    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-theme-secondary/30 bg-white px-4 py-3 shadow-sm">
                        <span className="text-sm font-semibold text-gray-800">{selected.length} selected</span>
                        <select className="rounded-lg border px-2.5 py-1.5 text-sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                            {['Screening', 'Phone Interview', 'Technical Interview', 'Final Interview', 'Offer Extended', 'Rejected', 'On Hold', 'Withdrawn'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <button type="button" disabled={busy} onClick={runBulk} className="rounded-lg bg-theme-secondary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                            Bulk update status
                        </button>
                        <button type="button" onClick={() => setSelected([])} className="text-sm text-gray-500 hover:underline">Clear</button>
                    </div>
                )}

                <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
                    {pipeline.map((col) => {
                        const tone = STAGE_TONE[col.stage] || 'border-gray-200 bg-gray-50 text-gray-800';
                        return (
                            <div
                                key={col.stage}
                                className="flex min-h-0 w-[min(85vw,280px)] shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:w-auto sm:min-w-[200px] sm:flex-1"
                            >
                                <div className={`shrink-0 border-b px-3 py-3 ${tone.split(' ').filter((c) => c.startsWith('bg-') || c.startsWith('border-') || c.startsWith('text-')).join(' ')}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="font-semibold">{col.stage}</h2>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-black/5">
                                            {col.count}
                                        </span>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
                                    {(col.candidates || []).map((c) => (
                                        <div
                                            key={c.id}
                                            className={`rounded-xl border bg-white p-3 text-sm shadow-sm transition hover:border-theme-secondary/50 hover:shadow ${
                                                selected.includes(c.id) ? 'border-theme-secondary ring-1 ring-theme-secondary/30' : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(c.id)}
                                                    onChange={() => toggle(c.id)}
                                                    className="mt-1 rounded border-gray-300"
                                                    aria-label={`Select ${c.name}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <button
                                                        type="button"
                                                        className="block w-full truncate text-left font-semibold text-gray-900 hover:text-theme-secondary"
                                                        onClick={() => navigate(`/recruitment/candidates/${c.id}`)}
                                                    >
                                                        {c.name}
                                                    </button>
                                                    {c.email && (
                                                        <p className="mt-0.5 truncate text-xs text-gray-500">{c.email}</p>
                                                    )}
                                                    <p className="mt-1 truncate text-xs text-gray-600">{c.jobTitle || '—'}</p>
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700">
                                                            {c.status}
                                                        </span>
                                                        {c.overallScore != null && (
                                                            <span className="rounded-md bg-theme-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-theme-primary">
                                                                Score {Math.round(c.overallScore)}
                                                            </span>
                                                        )}
                                                        {c.source && (
                                                            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                                                                {c.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                                                        {c.hasResume && (
                                                            <span className="inline-flex items-center gap-1" title="Resume uploaded">
                                                                <FaFileAlt className="text-theme-secondary" /> Resume
                                                            </span>
                                                        )}
                                                        {c.hasCoverLetter && (
                                                            <span className="inline-flex items-center gap-1" title="Cover letter uploaded">
                                                                <FaFileAlt className="text-theme-secondary" /> Cover
                                                            </span>
                                                        )}
                                                        {['Offer', 'Hired'].includes(col.stage) && (
                                                            <span className="inline-flex items-center gap-1" title="Offer stage">
                                                                <FaFileContract className="text-teal-600" /> Offer
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!col.candidates?.length && (
                                        <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-3 py-8 text-center">
                                            <FaUser className="mb-2 text-lg text-gray-300" />
                                            <p className="text-xs text-gray-400">No candidates</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PipelinePage;
