import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaExternalLinkAlt } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { normalizeResumeScreening, getScreeningBadgeClasses, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';

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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="mx-auto max-w-5xl">
                <button type="button" onClick={() => navigate('/recruitment')} className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                    <FaArrowLeft /> Back to Recruitment
                </button>

                <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{job.jobTitle}</h1>
                        <p className="mt-1 text-gray-600">{job.department} · {job.location} · {job.employmentType}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{job.status}</span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{job.priority} priority</span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{job.filledPositions || 0}/{job.numberOfPositions || 1} filled</span>
                            {job.archivedAt && <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">Archived</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['Draft', 'Open', 'On Hold', 'Closed'].map((s) => (
                            <button
                                key={s}
                                type="button"
                                disabled={saving || job.status === s}
                                onClick={() => updateStatus(s)}
                                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
                            >
                                {s}
                            </button>
                        ))}
                        {job.archivedAt ? (
                            <button type="button" disabled={saving} onClick={() => archiveJob(true)} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50">
                                Restore
                            </button>
                        ) : (
                            <>
                                <button type="button" disabled={saving} onClick={() => archiveJob(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
                                    Archive
                                </button>
                                <button type="button" disabled={saving} onClick={deleteJob} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-3 text-lg font-semibold">Description</h2>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{job.jobDescription}</p>
                        {(job.requirements || []).length > 0 && (
                            <>
                                <h3 className="mb-2 mt-4 font-medium">Requirements</h3>
                                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                                    {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                            </>
                        )}
                    </section>
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-3 text-lg font-semibold">Details</h2>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between gap-4"><dt className="text-gray-500">Position</dt><dd>{job.position}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-gray-500">Posted</dt><dd>{job.postedDate ? format(new Date(job.postedDate), 'dd MMM yyyy') : '—'}</dd></div>
                            <div className="flex justify-between gap-4"><dt className="text-gray-500">Applications</dt><dd>{job.currentApplications || candidates.length}</dd></div>
                            {screeningStats && (
                                <>
                                    <div className="flex justify-between gap-4"><dt className="text-gray-500">Approved (screening)</dt><dd className="text-emerald-700 font-medium">{screeningStats.approvedCandidates}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-gray-500">Rejected (screening)</dt><dd className="text-red-700 font-medium">{screeningStats.rejectedCandidates}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-gray-500">Avg Match Score</dt><dd>{screeningStats.averageMatchScore != null ? `${screeningStats.averageMatchScore}%` : '—'}</dd></div>
                                </>
                            )}
                        </dl>
                        {(job.screeningCriteria?.requiredKeywords || []).length > 0 && (
                            <div className="mt-4 border-t pt-3">
                                <p className="text-xs font-medium uppercase text-gray-500">Screening Criteria</p>
                                <p className="mt-1 text-sm text-gray-700">Min match: {job.screeningCriteria.minimumMatchPercent ?? 70}%</p>
                                <p className="mt-1 text-xs text-gray-600">Required: {(job.screeningCriteria.requiredKeywords || []).join(', ')}</p>
                            </div>
                        )}
                        <div className="mt-4 space-y-2 border-t pt-3">
                            <p className="text-sm font-semibold text-gray-800">Edit Screening Criteria</p>
                            <label className="flex items-center gap-2 text-xs text-gray-700">
                                <input type="checkbox" checked={criteriaForm.enabled} onChange={(e) => setCriteriaForm((p) => ({ ...p, enabled: e.target.checked }))} />
                                Enable auto-screening
                            </label>
                            <select
                                className="w-full rounded-lg border px-2 py-1.5 text-xs"
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
                                className="w-full rounded-lg border px-2 py-1.5 text-xs"
                                placeholder="Required keywords (one per line)"
                                value={criteriaForm.requiredKeywords}
                                onChange={(e) => setCriteriaForm((p) => ({ ...p, requiredKeywords: e.target.value }))}
                            />
                            <textarea
                                rows={2}
                                className="w-full rounded-lg border px-2 py-1.5 text-xs"
                                placeholder="Optional keywords (one per line)"
                                value={criteriaForm.optionalKeywords}
                                onChange={(e) => setCriteriaForm((p) => ({ ...p, optionalKeywords: e.target.value }))}
                            />
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-full rounded-lg border px-2 py-1.5 text-xs"
                                value={criteriaForm.minimumMatchPercent}
                                onChange={(e) => setCriteriaForm((p) => ({ ...p, minimumMatchPercent: e.target.value }))}
                            />
                            <button type="button" disabled={saving} onClick={saveScreeningCriteria} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">
                                Save criteria
                            </button>
                        </div>
                        {careerUrl && job.status === 'Open' && !job.archivedAt && (
                            <a href={careerUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-theme-secondary hover:underline">
                                Open career apply page <FaExternalLinkAlt className="text-xs" />
                            </a>
                        )}
                        {job.status === 'Open' && !job.archivedAt && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={notifyEmployees}
                                className="mt-3 block text-sm text-theme-secondary hover:underline disabled:opacity-50"
                            >
                                Notify employees in-app (internal board)
                            </button>
                        )}
                    </section>
                </div>

                {screeningStats?.topMatchingCandidates?.length > 0 && (
                    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-3 text-lg font-semibold">Top Matching Candidates</h2>
                        <ul className="divide-y text-sm">
                            {screeningStats.topMatchingCandidates.slice(0, 5).map((c) => (
                                <li key={c._id} className="flex items-center justify-between py-2">
                                    <button type="button" className="text-left text-theme-secondary hover:underline" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>
                                        {c.firstName} {c.lastName}
                                    </button>
                                    <span className="font-medium">{c.resumeScreening?.matchScore != null ? `${c.resumeScreening.matchScore}%` : '—'}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="mb-4 flex gap-2">
                    <button type="button" onClick={() => setTab('candidates')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'candidates' ? 'bg-theme-primary/10 text-theme-primary' : 'text-gray-600 hover:bg-gray-100'}`}>
                        Candidates ({candidates.length})
                    </button>
                    <button type="button" onClick={() => setTab('ranked')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'ranked' ? 'bg-theme-primary/10 text-theme-primary' : 'text-gray-600 hover:bg-gray-100'}`}>
                        Ranked by score
                    </button>
                    <button type="button" onClick={() => navigate(`/recruitment/pipeline?jobPostingId=${id}`)} className="ml-auto text-sm text-theme-secondary hover:underline">
                        View in pipeline
                    </button>
                </div>

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    {tab === 'candidates' ? (
                        candidates.length === 0 ? (
                            <p className="text-sm text-gray-500">No candidates yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Name</th>
                                            <th className="px-4 py-2 text-left">Status</th>
                                            <th className="px-4 py-2 text-left">Screening</th>
                                            <th className="px-4 py-2 text-left">Match</th>
                                            <th className="px-4 py-2 text-left">Applied</th>
                                            <th className="px-4 py-2 text-left" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {candidates.map((c) => {
                                            const screening = normalizeResumeScreening(c.resumeScreening);
                                            return (
                                            <tr key={c._id}>
                                                <td className="px-4 py-2">{c.firstName} {c.lastName}</td>
                                                <td className="px-4 py-2">{c.status}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScreeningBadgeClasses(screening)}`}>
                                                        {screening.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</td>
                                                <td className="px-4 py-2">{c.applicationDate ? format(new Date(c.applicationDate), 'dd MMM yyyy') : '—'}</td>
                                                <td className="px-4 py-2">
                                                    <button type="button" className="text-theme-secondary hover:underline" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>View</button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : ranked.length === 0 ? (
                        <p className="text-sm text-gray-500">No scored candidates yet. Add scores on candidate profiles to rank them.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Rank</th>
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Overall</th>
                                        <th className="px-4 py-2 text-left">Resume</th>
                                        <th className="px-4 py-2 text-left">Technical</th>
                                        <th className="px-4 py-2 text-left">Cultural</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-left" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {ranked.map((c, idx) => (
                                        <tr key={c._id}>
                                            <td className="px-4 py-2 font-semibold">#{idx + 1}</td>
                                            <td className="px-4 py-2">{c.firstName} {c.lastName}</td>
                                            <td className="px-4 py-2">{c.scores?.overallScore != null ? Math.round(c.scores.overallScore) : '—'}</td>
                                            <td className="px-4 py-2">{c.scores?.resumeScore ?? '—'}</td>
                                            <td className="px-4 py-2">{c.scores?.technicalScore ?? '—'}</td>
                                            <td className="px-4 py-2">{c.scores?.culturalFitScore ?? '—'}</td>
                                            <td className="px-4 py-2">{c.status}</td>
                                            <td className="px-4 py-2">
                                                <button type="button" className="text-theme-secondary hover:underline" onClick={() => navigate(`/recruitment/candidates/${c._id}`)}>View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default JobDetailPage;
