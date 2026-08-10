import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaExternalLinkAlt, FaEdit } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { normalizeResumeScreening, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsBadge, CmButton } from '../../components/recruitment/atsUi';

const JobDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [job, setJob] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [ranked, setRanked] = useState([]);
    const [orgId, setOrgId] = useState('');
    const [tab, setTab] = useState('candidates');
    const [screeningStats, setScreeningStats] = useState(null);
    const [criteriaForm, setCriteriaForm] = useState({
        enabled: true,
        requiredKeywords: '',
        optionalKeywords: '',
        minimumMatchPercent: 70,
        experienceRequired: '',
        education: '',
        certifications: '',
        templateId: '',
    });
    const [screeningTemplates, setScreeningTemplates] = useState([]);

    useEffect(() => {
        axios.get('/v1/admin/recruitment/screening/templates', {
            withCredentials: true,
            params: { activeOnly: 'true' },
        }).then((res) => setScreeningTemplates(res.data?.data || [])).catch(() => {});
    }, []);

    const fetchJob = useCallback(async () => {
        try {
            setLoading(true);
            const [jobRes, candRes, rankedRes, statsRes] = await Promise.all([
                axios.get(`/v1/admin/recruitment/jobs/${id}`, { withCredentials: true }),
                axios.get(`/v1/admin/recruitment/candidates?jobPostingId=${id}&limit=50`, { withCredentials: true }),
                axios.get(`/v1/admin/recruitment/jobs/${id}/candidates/ranked?limit=50`, { withCredentials: true }),
                axios.get(`/v1/admin/recruitment/jobs/${id}/screening-stats`, { withCredentials: true }).catch(() => null),
            ]);
            if (!jobRes.data.success) {
                toast.error('Job not found');
                navigate('/recruitment');
                return;
            }
            const jobData = jobRes.data.data;
            setJob(jobData);
            setCandidates(candRes.data?.data || []);
            setRanked(rankedRes.data?.data || []);
            setOrgId(jobData.organizationId || '');
            setScreeningStats(statsRes?.data?.data || null);
            const sc = jobData.screeningCriteria || {};
            setCriteriaForm({
                enabled: sc.enabled !== false,
                requiredKeywords: normalizeKeywordList(sc.requiredKeywords).join('\n'),
                optionalKeywords: normalizeKeywordList(sc.optionalKeywords).join('\n'),
                minimumMatchPercent: sc.minimumMatchPercent ?? 70,
                experienceRequired: sc.experienceRequired || '',
                education: sc.education || '',
                certifications: (sc.certifications || []).join('\n'),
                templateId: sc.templateId || '',
            });
        } catch {
            toast.error('Failed to load job');
            navigate('/recruitment');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchJob(); }, [fetchJob]);

    const updateStatus = async (status) => {
        try {
            setSaving(true);
            const { data } = await axios.put(`/v1/admin/recruitment/jobs/${id}`, { status }, { withCredentials: true });
            if (data.success) {
                setJob(data.data);
                toast.success(`Status set to ${status}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const notifyEmployees = async () => {
        try {
            setSaving(true);
            const { data } = await axios.put(
                `/v1/admin/recruitment/jobs/${id}`,
                { forceNotify: true, internalVisible: true, status: 'Open' },
                { withCredentials: true }
            );
            if (data.success) {
                setJob(data.data);
                toast.success('In-app notification sent for this internal opening');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Notify failed');
        } finally {
            setSaving(false);
        }
    };

    const applyTemplateToCriteria = (templateId) => {
        if (!templateId) {
            setCriteriaForm((p) => ({ ...p, templateId: '' }));
            return;
        }
        const t = screeningTemplates.find((x) => x._id === templateId);
        if (!t) return;
        setCriteriaForm((p) => ({
            ...p,
            templateId,
            enabled: true,
            requiredKeywords: normalizeKeywordList(t.requiredKeywords).join('\n'),
            optionalKeywords: normalizeKeywordList(t.optionalKeywords).join('\n'),
            minimumMatchPercent: t.minimumMatchPercent ?? 70,
        }));
    };

    const saveScreeningCriteria = async () => {
        try {
            setSaving(true);
            const selected = screeningTemplates.find((t) => t._id === criteriaForm.templateId);
            const { data } = await axios.put(
                `/v1/admin/recruitment/jobs/${id}`,
                {
                    screeningCriteria: {
                        enabled: criteriaForm.enabled !== false,
                        requiredKeywords: normalizeKeywordList(criteriaForm.requiredKeywords),
                        optionalKeywords: normalizeKeywordList(criteriaForm.optionalKeywords),
                        minimumMatchPercent: parseMinimumMatchPercent(criteriaForm.minimumMatchPercent, 70),
                        experienceRequired: criteriaForm.experienceRequired.trim(),
                        education: criteriaForm.education.trim(),
                        certifications: criteriaForm.certifications.split('\n').map((s) => s.trim()).filter(Boolean),
                        templateId: criteriaForm.templateId || null,
                        templateName: selected?.name || '',
                    },
                },
                { withCredentials: true }
            );
            if (data.success) {
                setJob(data.data);
                toast.success('Screening criteria saved');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save criteria');
        } finally {
            setSaving(false);
        }
    };

    const archiveJob = async (restore = false) => {
        try {
            setSaving(true);
            const { data } = await axios.post(
                `/v1/admin/recruitment/jobs/${id}/archive`,
                { restore },
                { withCredentials: true }
            );
            toast.success(data.message || (restore ? 'Restored' : 'Archived'));
            if (restore) setJob(data.data);
            else navigate('/recruitment');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Archive failed');
        } finally {
            setSaving(false);
        }
    };

    const deleteJob = async () => {
        if (!window.confirm('Soft-delete (archive) this job? Candidates are kept.')) return;
        try {
            setSaving(true);
            await axios.delete(`/v1/admin/recruitment/jobs/${id}`, { withCredentials: true });
            toast.success('Job deleted (archived)');
            navigate('/recruitment');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading job…" />;
    if (!job) return null;

    const careerUrl = orgId ? `${window.location.origin}/careers/${orgId}/jobs/${job._id}` : '';

    return (
        <AtsPage>
            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <div className="cm-card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="ats-page-title" style={{ fontSize: '1.5rem', lineHeight: '2rem' }}>{job.jobTitle}</h1>
                    <p className="ats-page-subtitle">{job.department} · {job.location} · {job.employmentType}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <AtsBadge status={job.status}>{job.status}</AtsBadge>
                        <span className="ats-chip ats-chip--neutral" style={{ textTransform: 'none', letterSpacing: 0 }}>{job.priority} priority</span>
                        <span className="ats-chip ats-chip--neutral" style={{ textTransform: 'none', letterSpacing: 0 }}>{job.filledPositions || 0}/{job.numberOfPositions || 1} filled</span>
                        {job.archivedAt && <AtsBadge tone="error">Archived</AtsBadge>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <CmButton
                        type="button"
                        size="sm"
                        onClick={() => navigate(`/recruitment/jobs/${id}/edit`)}
                    >
                        <FaEdit className="h-3.5 w-3.5" /> Edit Job
                    </CmButton>
                    {['Draft', 'Open', 'On Hold', 'Closed'].map((s) => (
                        <CmButton
                            key={s}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving || job.status === s}
                            onClick={() => updateStatus(s)}
                        >
                            {s}
                        </CmButton>
                    ))}
                    {job.archivedAt ? (
                        <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={() => archiveJob(true)} style={{ color: '#006c51', borderColor: 'rgba(28,202,155,0.4)' }}>
                            Restore
                        </CmButton>
                    ) : (
                        <>
                            <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={() => archiveJob(false)}>
                                Archive
                            </CmButton>
                            <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={deleteJob} style={{ color: 'var(--ats-error)', borderColor: 'rgba(229,62,62,0.35)' }}>
                                Delete
                            </CmButton>
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="cm-card">
                    <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Description</h2>
                    <p className="whitespace-pre-wrap text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>{job.jobDescription}</p>
                    {(job.requirements || []).length > 0 && (
                        <>
                            <h3 className="mb-2 mt-4 font-medium" style={{ color: 'var(--ats-secondary)' }}>Requirements</h3>
                            <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>
                                {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </>
                    )}
                </section>
                <section className="cm-card">
                    <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Details</h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Position</dt><dd>{job.position}</dd></div>
                        <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Posted</dt><dd>{job.postedDate ? format(new Date(job.postedDate), 'dd MMM yyyy') : '—'}</dd></div>
                        <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Applications</dt><dd>{job.currentApplications || candidates.length}</dd></div>
                        {screeningStats && (
                            <>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Approved (screening)</dt><dd className="font-medium" style={{ color: '#006c51' }}>{screeningStats.approvedCandidates}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Rejected (screening)</dt><dd className="font-medium" style={{ color: 'var(--ats-error)' }}>{screeningStats.rejectedCandidates}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Avg Match Score</dt><dd>{screeningStats.averageMatchScore != null ? `${screeningStats.averageMatchScore}%` : '—'}</dd></div>
                            </>
                        )}
                    </dl>
                    {(job.screeningCriteria?.requiredKeywords || []).length > 0 && (
                        <div className="mt-4 border-t border-[rgba(15,45,38,0.08)] pt-3">
                            <p className="text-xs font-medium uppercase" style={{ color: 'rgba(15,45,38,0.5)' }}>Screening Criteria</p>
                            <p className="mt-1 text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>Min match: {job.screeningCriteria.minimumMatchPercent ?? 70}%</p>
                            <p className="mt-1 text-xs" style={{ color: 'rgba(15,45,38,0.6)' }}>Required: {(job.screeningCriteria.requiredKeywords || []).join(', ')}</p>
                        </div>
                    )}
                    <div className="mt-4 space-y-2 border-t border-[rgba(15,45,38,0.08)] pt-3">
                        <p className="text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>Edit Screening Criteria</p>
                        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--ats-secondary)' }}>
                            <input type="checkbox" checked={criteriaForm.enabled} onChange={(e) => setCriteriaForm((p) => ({ ...p, enabled: e.target.checked }))} />
                            Enable auto-screening
                        </label>
                        <select
                            className="cm-select w-full !text-xs"
                            value={criteriaForm.templateId || ''}
                            onChange={(e) => applyTemplateToCriteria(e.target.value)}
                        >
                            <option value="">None — enter keywords manually</option>
                            {screeningTemplates.map((t) => (
                                <option key={t._id} value={t._id}>{t.name}</option>
                            ))}
                        </select>
                        <textarea
                            rows={3}
                            className="cm-input w-full !text-xs"
                            placeholder="Required keywords (one per line)"
                            value={criteriaForm.requiredKeywords}
                            onChange={(e) => setCriteriaForm((p) => ({ ...p, requiredKeywords: e.target.value }))}
                        />
                        <textarea
                            rows={2}
                            className="cm-input w-full !text-xs"
                            placeholder="Optional keywords (one per line)"
                            value={criteriaForm.optionalKeywords}
                            onChange={(e) => setCriteriaForm((p) => ({ ...p, optionalKeywords: e.target.value }))}
                        />
                        <input
                            type="number"
                            min="0"
                            max="100"
                            className="cm-input w-full !text-xs"
                            value={criteriaForm.minimumMatchPercent}
                            onChange={(e) => setCriteriaForm((p) => ({ ...p, minimumMatchPercent: e.target.value }))}
                        />
                        <CmButton type="button" size="sm" variant="outline" disabled={saving} onClick={saveScreeningCriteria}>
                            Save criteria
                        </CmButton>
                    </div>
                    {careerUrl && job.status === 'Open' && !job.archivedAt && (
                        <a href={careerUrl} target="_blank" rel="noreferrer" className="ats-link mt-4 inline-flex items-center gap-2">
                            Open career apply page <FaExternalLinkAlt className="text-xs" />
                        </a>
                    )}
                    {job.status === 'Open' && !job.archivedAt && (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={notifyEmployees}
                            className="ats-link mt-3 block disabled:opacity-50"
                        >
                            Notify employees in-app (internal board)
                        </button>
                    )}
                </section>
            </div>

            {screeningStats?.topMatchingCandidates?.length > 0 && (
                <section className="cm-card">
                    <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Top Matching Candidates</h2>
                    <ul className="divide-y divide-[rgba(15,45,38,0.06)] text-sm">
                        {screeningStats.topMatchingCandidates.slice(0, 5).map((c) => (
                            <li key={c._id} className="flex items-center justify-between py-2">
                                <button type="button" className="ats-link" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>
                                    {c.firstName} {c.lastName}
                                </button>
                                <span className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{c.resumeScreening?.matchScore != null ? `${c.resumeScreening.matchScore}%` : '—'}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="flex items-center gap-1">
                <nav className="ats-tabs !border-b-0 !mb-0 flex-1">
                    <button type="button" onClick={() => setTab('candidates')} className={`ats-tab ${tab === 'candidates' ? 'ats-tab--active' : ''}`}>
                        Candidates
                        <span className="ats-tab-count">{candidates.length}</span>
                    </button>
                    <button type="button" onClick={() => setTab('ranked')} className={`ats-tab ${tab === 'ranked' ? 'ats-tab--active' : ''}`}>
                        Ranked by score
                    </button>
                </nav>
                <button type="button" onClick={() => navigate(`/recruitment/pipeline?jobPostingId=${id}`)} className="ats-link shrink-0">
                    View in pipeline
                </button>
            </div>

            <div className="ats-table-wrap">
                {tab === 'candidates' ? (
                    candidates.length === 0 ? (
                        <p className="p-6 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No candidates yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="ats-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Screening</th>
                                        <th>Match</th>
                                        <th>Applied</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map((c) => {
                                        const screening = normalizeResumeScreening(c.resumeScreening);
                                        return (
                                        <tr key={c._id}>
                                            <td className="font-semibold">{c.firstName} {c.lastName}</td>
                                            <td>{c.status}</td>
                                            <td>
                                                <AtsBadge status={screening.label}>{screening.label}</AtsBadge>
                                            </td>
                                            <td>{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</td>
                                            <td>{c.applicationDate ? format(new Date(c.applicationDate), 'dd MMM yyyy') : '—'}</td>
                                            <td>
                                                <button type="button" className="ats-link" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>View</button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : ranked.length === 0 ? (
                    <p className="p-6 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No scored candidates yet. Add scores on candidate profiles to rank them.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="ats-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Name</th>
                                    <th>Overall</th>
                                    <th>Resume</th>
                                    <th>Technical</th>
                                    <th>Cultural</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {ranked.map((c, idx) => (
                                    <tr key={c._id}>
                                        <td className="font-semibold">#{idx + 1}</td>
                                        <td>{c.firstName} {c.lastName}</td>
                                        <td>{c.scores?.overallScore != null ? Math.round(c.scores.overallScore) : '—'}</td>
                                        <td>{c.scores?.resumeScore ?? '—'}</td>
                                        <td>{c.scores?.technicalScore ?? '—'}</td>
                                        <td>{c.scores?.culturalFitScore ?? '—'}</td>
                                        <td>{c.status}</td>
                                        <td>
                                            <button type="button" className="ats-link" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AtsPage>
    );
};

export default JobDetailPage;
