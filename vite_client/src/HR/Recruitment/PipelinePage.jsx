import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaFileAlt, FaFileContract, FaUser,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsBadge } from '../../components/recruitment/atsUi';

const STAGE_TONE = {
    Application: { bg: 'rgba(56,161,255,0.12)', text: '#1a5aa8' },
    Screening: { bg: 'rgba(255,127,80,0.15)', text: '#c45a2a' },
    Interview: { bg: 'rgba(155,109,255,0.14)', text: '#6941c6' },
    Offer: { bg: 'rgba(28,202,155,0.15)', text: '#006c51' },
    Hired: { bg: 'rgba(28,202,155,0.22)', text: '#006c51' },
    Rejected: { bg: 'rgba(229,62,62,0.12)', text: '#c53030' },
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
        <div className="cm-hrms ats-ui flex h-[calc(100dvh-3.75rem)] max-h-[calc(100dvh-3.75rem)] flex-col overflow-hidden" style={{ background: 'var(--ats-neutral)', padding: '0.75rem' }}>
            <div className="mx-auto flex min-h-0 w-full max-w-[100%] flex-1 flex-col">
                <div className="mb-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/recruitment')}
                        className="ats-back"
                    >
                        <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
                    </button>
                    <div className="cm-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ padding: '1.25rem' }}>
                        <div>
                            <h1 className="ats-page-title" style={{ fontSize: '1.5rem', lineHeight: '2rem' }}>Recruitment Pipeline</h1>
                            <p className="ats-page-subtitle">
                                 {totalCandidates} candidate{totalCandidates === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.5)' }}>Job</label>
                            <select
                                className="cm-select"
                                style={{ minWidth: '12rem' }}
                                value={jobPostingId}
                                onChange={(e) => navigate(e.target.value ? `/recruitment/pipeline?jobPostingId=${e.target.value}` : '/recruitment/pipeline')}
                            >
                                <option value="">All jobs</option>
                                {jobs.map((j) => (
                                    <option key={j._id} value={j._id}>{j.jobTitle}</option>
                                ))}
                            </select>
                            {jobPostingId ? (
                                <button
                                    type="button"
                                    className="ats-link inline-flex items-center gap-1"
                                    onClick={() => navigate(`/recruitment/jobs/${jobPostingId}/edit`)}
                                >
                                    Edit Job
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {selected.length > 0 && (
                    <div className="cm-card mb-3 flex shrink-0 flex-wrap items-center gap-3" style={{ padding: '0.875rem 1.25rem', border: '1.5px solid rgba(28,202,155,0.35)' }}>
                        <span className="text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>{selected.length} selected</span>
                        <select className="cm-select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                            {['Screening', 'Phone Interview', 'Technical Interview', 'Final Interview', 'Offer Extended', 'Rejected', 'On Hold', 'Withdrawn'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <button type="button" disabled={busy} onClick={runBulk} className="cm-btn cm-btn--primary cm-btn--sm">
                            Bulk update status
                        </button>
                        <button type="button" onClick={() => setSelected([])} className="ats-link">Clear</button>
                    </div>
                )}

                <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
                    {pipeline.map((col) => {
                        const tone = STAGE_TONE[col.stage] || { bg: 'rgba(15,45,38,0.06)', text: 'var(--ats-secondary)' };
                        return (
                            <div
                                key={col.stage}
                                className="flex min-h-0 w-[min(85vw,280px)] shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm sm:w-auto sm:min-w-[200px] sm:flex-1"
                                style={{ boxShadow: 'var(--ats-shadow)' }}
                            >
                                <div className="shrink-0 px-3 py-3" style={{ background: tone.bg, color: tone.text }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="font-semibold">{col.stage}</h2>
                                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold" style={{ color: tone.text }}>
                                            {col.count}
                                        </span>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
                                    {(col.candidates || []).map((c) => (
                                        <div
                                            key={c.id}
                                            className="rounded-xl bg-white p-3 text-sm shadow-sm transition hover:shadow-md"
                                            style={{
                                                border: selected.includes(c.id) ? '1.5px solid var(--ats-primary)' : '1px solid rgba(15,45,38,0.08)',
                                            }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(c.id)}
                                                    onChange={() => toggle(c.id)}
                                                    className="mt-1 rounded"
                                                    aria-label={`Select ${c.name}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <button
                                                        type="button"
                                                        className="block w-full truncate text-left font-semibold hover:underline"
                                                        style={{ color: 'var(--ats-secondary)' }}
                                                        onClick={() => navigate(`/recruitment/candidates/${c.id}`)}
                                                    >
                                                        {c.name}
                                                    </button>
                                                    {c.email && (
                                                        <p className="mt-0.5 truncate text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>{c.email}</p>
                                                    )}
                                                    <p className="mt-1 truncate text-xs" style={{ color: 'rgba(15,45,38,0.6)' }}>{c.jobTitle || '—'}</p>
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                        <AtsBadge status={c.status}>{c.status}</AtsBadge>
                                                        {c.overallScore != null && (
                                                            <span className="ats-chip ats-chip--primary" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                                                Score {Math.round(c.overallScore)}
                                                            </span>
                                                        )}
                                                        {c.source && (
                                                            <span className="ats-chip ats-chip--neutral" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                                                {c.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                        {c.hasResume && (
                                                            <span className="inline-flex items-center gap-1" title="Resume uploaded">
                                                                <FaFileAlt style={{ color: 'var(--ats-primary)' }} /> Resume
                                                            </span>
                                                        )}
                                                        {c.hasCoverLetter && (
                                                            <span className="inline-flex items-center gap-1" title="Cover letter uploaded">
                                                                <FaFileAlt style={{ color: 'var(--ats-primary)' }} /> Cover
                                                            </span>
                                                        )}
                                                        {['Offer', 'Hired'].includes(col.stage) && (
                                                            <span className="inline-flex items-center gap-1" title="Offer stage">
                                                                <FaFileContract style={{ color: '#006c51' }} /> Offer
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!col.candidates?.length && (
                                        <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed px-3 py-8 text-center" style={{ borderColor: 'rgba(15,45,38,0.12)', background: 'rgba(245,250,249,0.6)' }}>
                                            <FaUser className="mb-2 text-lg" style={{ color: 'rgba(15,45,38,0.2)' }} />
                                            <p className="text-xs" style={{ color: 'rgba(15,45,38,0.35)' }}>No candidates</p>
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
