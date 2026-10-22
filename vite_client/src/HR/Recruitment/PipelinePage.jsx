import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaFileAlt, FaFileContract, FaUser,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage, AtsBadge, AtsPageHeader, CmButton } from '../../components/recruitment/atsUi';

const STAGE_CLASS = {
    Application: 'is-application',
    Screening: 'is-screening',
    Interview: 'is-interview',
    Offer: 'is-offer',
    Hired: 'is-hired',
    Rejected: 'is-rejected',
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
        <AtsPage fullWidth className="rec-hub ats-pipeline-page">
            <div className="rec-hub__crumb">
                <span>Recruitment</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Pipeline</span>
            </div>

            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <AtsPageHeader
                eyebrow="Talent acquisition"
                title="Recruitment Pipeline"
                subtitle={`${totalCandidates} candidate${totalCandidates === 1 ? '' : 's'} across stages`}
                actions={(
                    <div className="ats-pipeline-toolbar">
                        <label className="ats-pipeline-toolbar__label">
                            Job
                            <select
                                className="rec-hub__select"
                                value={jobPostingId}
                                onChange={(e) => navigate(e.target.value ? `/recruitment/pipeline?jobPostingId=${e.target.value}` : '/recruitment/pipeline')}
                            >
                                <option value="">All jobs</option>
                                {jobs.map((j) => (
                                    <option key={j._id} value={j._id}>{j.jobTitle}</option>
                                ))}
                            </select>
                        </label>
                        {jobPostingId ? (
                            <button
                                type="button"
                                className="rec-hub__btn"
                                onClick={() => navigate(`/recruitment/jobs/${jobPostingId}/edit`)}
                            >
                                Edit Job
                            </button>
                        ) : null}
                    </div>
                )}
            />

            {selected.length > 0 ? (
                <div className="ats-pipeline-bulk">
                    <span className="ats-pipeline-bulk__count">{selected.length} selected</span>
                    <select className="rec-hub__select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                        {['Screening', 'Phone Interview', 'Technical Interview', 'Final Interview', 'Offer Extended', 'Rejected', 'On Hold', 'Withdrawn'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <CmButton size="sm" disabled={busy} onClick={runBulk}>Bulk update status</CmButton>
                    <button type="button" onClick={() => setSelected([])} className="ats-link">Clear</button>
                </div>
            ) : null}

            <div className="ats-pipeline-board">
                {pipeline.map((col) => {
                    const toneClass = STAGE_CLASS[col.stage] || 'is-default';
                    return (
                        <div key={col.stage} className={`ats-pipeline-col ${toneClass}`}>
                            <div className="ats-pipeline-col__head">
                                <h2>{col.stage}</h2>
                                <span className="ats-pipeline-col__count">{col.count}</span>
                            </div>
                            <div className="ats-pipeline-col__body">
                                {(col.candidates || []).map((c) => (
                                    <div
                                        key={c.id}
                                        className={`ats-pipeline-card${selected.includes(c.id) ? ' is-selected' : ''}`}
                                    >
                                        <div className="ats-pipeline-card__row">
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(c.id)}
                                                onChange={() => toggle(c.id)}
                                                className="ats-pipeline-card__check"
                                                aria-label={`Select ${c.name}`}
                                            />
                                            <div className="ats-pipeline-card__main">
                                                <button
                                                    type="button"
                                                    className="ats-pipeline-card__name"
                                                    onClick={() => navigate(`/recruitment/candidates/${c.id}`)}
                                                >
                                                    {c.name}
                                                </button>
                                                {c.email ? <p className="ats-pipeline-card__meta">{c.email}</p> : null}
                                                <p className="ats-pipeline-card__meta">{c.jobTitle || '—'}</p>
                                                <div className="ats-pipeline-card__tags">
                                                    <AtsBadge status={c.status}>{c.status}</AtsBadge>
                                                    {c.overallScore != null ? (
                                                        <span className="ats-chip ats-chip--primary">Score {Math.round(c.overallScore)}</span>
                                                    ) : null}
                                                    {c.source ? (
                                                        <span className="ats-chip ats-chip--neutral">{c.source}</span>
                                                    ) : null}
                                                </div>
                                                <div className="ats-pipeline-card__flags">
                                                    {c.hasResume ? (
                                                        <span title="Resume uploaded"><FaFileAlt /> Resume</span>
                                                    ) : null}
                                                    {c.hasCoverLetter ? (
                                                        <span title="Cover letter uploaded"><FaFileAlt /> Cover</span>
                                                    ) : null}
                                                    {['Offer', 'Hired'].includes(col.stage) ? (
                                                        <span title="Offer stage"><FaFileContract /> Offer</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!col.candidates?.length ? (
                                    <div className="ats-pipeline-empty">
                                        <FaUser />
                                        <p>No candidates</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AtsPage>
    );
};

export default PipelinePage;
