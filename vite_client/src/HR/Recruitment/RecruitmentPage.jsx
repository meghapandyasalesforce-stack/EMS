import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaBriefcase, FaUsers, FaFileContract, FaColumns, FaHome, FaClipboardList, FaCalendarAlt, FaEnvelopeOpenText, FaCog, FaSearch, FaTimes, FaExternalLinkAlt, FaEdit, FaRegBookmark } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferTemplateManager from '../../components/recruitment/OfferTemplateManager';
import { normalizeResumeScreening, getScreeningBadgeClasses, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsPageHeader, AtsEmpty, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';

const postedAgoLabel = (dateVal) => {
    if (!dateVal) return 'Posted recently';
    const t = new Date(dateVal).getTime();
    if (Number.isNaN(t)) return 'Posted recently';
    const days = Math.floor((Date.now() - t) / 86400000);
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted 1d ago';
    if (days < 7) return `Posted ${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `Posted ${weeks}w ago`;
    const months = Math.floor(days / 30);
    return months <= 1 ? 'Posted 1mo ago' : `Posted ${months}mo ago`;
};

const jobExcerpt = (text = '', max = 120) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return 'No description yet — open to review full posting details.';
    return t.length > max ? `${t.slice(0, max).trim()}…` : t;
};

const RecruitmentPage = () => {
    const navigate = useNavigate();
    const [jobPostings, setJobPostings] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('jobs');
    const [orgId, setOrgId] = useState('');
    const [screeningDash, setScreeningDash] = useState(null);
    const [candFilter, setCandFilter] = useState({ screeningStatus: '', q: '', matchMin: '', matchMax: '', searchRejected: false });
    const [showScreeningSettings, setShowScreeningSettings] = useState(false);
    const [screeningSettings, setScreeningSettings] = useState({
        enabled: true,
        defaultMinimumMatchPercent: 70,
        retentionDays: 7,
        requiredKeywordWeight: 1,
        optionalKeywordWeight: 0.5,
        autoDeleteEnabled: true,
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('general');
    const [screeningTemplates, setScreeningTemplates] = useState([]);
    const [templateForm, setTemplateForm] = useState({
        _id: null,
        name: '',
        requiredKeywords: '',
        optionalKeywords: '',
        minimumMatchPercent: 70,
        isActive: true,
    });
    const [savingTemplate, setSavingTemplate] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('organizationId');
            if (stored) setOrgId(stored);
        } catch { /* ignore */ }
    }, []);

    const loadScreeningTemplates = useCallback(async () => {
        try {
            const res = await axios.get('/v1/admin/recruitment/screening/templates', { withCredentials: true });
            setScreeningTemplates(res.data?.data || []);
        } catch { /* optional */ }
    }, []);

    const loadScreeningDash = useCallback(async () => {
        try {
            const res = await axios.get('/v1/admin/recruitment/screening/dashboard', { withCredentials: true });
            setScreeningDash(res.data?.data || null);
            if (res.data?.data?.settings) {
                setScreeningSettings((prev) => ({ ...prev, ...res.data.data.settings }));
            }
        } catch { /* optional widget */ }
    }, []);

    useEffect(() => {
        fetchData();
        loadScreeningDash();
    }, [activeTab, candFilter.screeningStatus, candFilter.searchRejected, loadScreeningDash]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'jobs') {
                const response = await axios.get('/v1/admin/recruitment/jobs', { withCredentials: true });
                const jobs = response.data?.data || [];
                setJobPostings(jobs);
                const rawOrg = jobs[0]?.organizationId;
                const resolvedOrg = typeof rawOrg === 'object' && rawOrg ? (rawOrg._id || rawOrg.id) : rawOrg;
                if (resolvedOrg) setOrgId(String(resolvedOrg));
            } else if (activeTab === 'candidates') {
                const params = { limit: 100 };
                if (candFilter.screeningStatus) params.screeningStatus = candFilter.screeningStatus;
                if (candFilter.q) params.q = candFilter.q;
                if (candFilter.matchMin !== '') params.matchMin = candFilter.matchMin;
                if (candFilter.matchMax !== '') params.matchMax = candFilter.matchMax;
                if (candFilter.searchRejected) params.searchRejected = 'true';
                const response = await axios.get('/v1/admin/recruitment/candidates', { withCredentials: true, params });
                setCandidates(response.data?.data || []);
            }
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false);
        }
    };

    const openScreeningSettings = async () => {
        try {
            const res = await axios.get('/v1/admin/recruitment/screening/settings', { withCredentials: true });
            setScreeningSettings((prev) => ({ ...prev, ...(res.data?.data || {}) }));
            await loadScreeningTemplates();
            setSettingsTab('general');
            setTemplateForm({
                _id: null,
                name: '',
                requiredKeywords: '',
                optionalKeywords: '',
                minimumMatchPercent: 70,
                isActive: true,
            });
            setShowScreeningSettings(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load settings');
        }
    };

    const saveScreeningSettings = async (e) => {
        e.preventDefault();
        try {
            setSavingSettings(true);
            const res = await axios.put('/v1/admin/recruitment/screening/settings', screeningSettings, { withCredentials: true });
            toast.success(res.data?.message || 'Settings saved');
            loadScreeningDash();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const resetTemplateForm = () => {
        setTemplateForm({
            _id: null,
            name: '',
            requiredKeywords: '',
            optionalKeywords: '',
            minimumMatchPercent: 70,
            isActive: true,
        });
    };

    const editTemplate = (t) => {
        setTemplateForm({
            _id: t._id,
            name: t.name || '',
            requiredKeywords: normalizeKeywordList(t.requiredKeywords).join('\n'),
            optionalKeywords: normalizeKeywordList(t.optionalKeywords).join('\n'),
            minimumMatchPercent: t.minimumMatchPercent ?? 70,
            isActive: t.isActive !== false,
        });
        setSettingsTab('templates');
    };

    const saveTemplate = async (e) => {
        e.preventDefault();
        if (!templateForm.name.trim()) {
            toast.error('Template name is required');
            return;
        }
        const payload = {
            name: templateForm.name.trim(),
            requiredKeywords: normalizeKeywordList(templateForm.requiredKeywords),
            optionalKeywords: normalizeKeywordList(templateForm.optionalKeywords),
            minimumMatchPercent: parseMinimumMatchPercent(templateForm.minimumMatchPercent, 70),
            isActive: templateForm.isActive !== false,
        };
        try {
            setSavingTemplate(true);
            if (templateForm._id) {
                await axios.put(`/v1/admin/recruitment/screening/templates/${templateForm._id}`, payload, { withCredentials: true });
                toast.success('Template updated');
            } else {
                await axios.post('/v1/admin/recruitment/screening/templates', payload, { withCredentials: true });
                toast.success('Template created');
            }
            resetTemplateForm();
            await loadScreeningTemplates();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save template');
        } finally {
            setSavingTemplate(false);
        }
    };

    const toggleTemplateActive = async (t) => {
        try {
            const path = t.isActive ? 'deactivate' : 'activate';
            await axios.post(`/v1/admin/recruitment/screening/templates/${t._id}/${path}`, {}, { withCredentials: true });
            toast.success(t.isActive ? 'Template deactivated' : 'Template activated');
            await loadScreeningTemplates();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update template');
        }
    };

    const deleteTemplate = async (t) => {
        if (!window.confirm(`Delete template "${t.name}"? Jobs that already used it keep their copied keywords.`)) return;
        try {
            await axios.delete(`/v1/admin/recruitment/screening/templates/${t._id}`, { withCredentials: true });
            toast.success('Template deleted');
            if (templateForm._id === t._id) resetTemplateForm();
            await loadScreeningTemplates();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete template');
        }
    };

    if (loading && activeTab !== 'offers') {
        return <LoadingSpinner message="Loading recruitment data..." />;
    }

    return (
        <AtsPage>
            <AtsPageHeader
                eyebrow="Recruitment"
                title="Recruitment & ATS"
                subtitle="Manage job postings and candidates"
                actions={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {orgId ? (
                            <a href={`/careers/${orgId}`} target="_blank" rel="noreferrer" className="ats-module-nav__btn">
                                Career Portal <FaExternalLinkAlt className="h-3 w-3 opacity-70" />
                            </a>
                        ) : (
                            <button
                                type="button"
                                className="ats-module-nav__btn"
                                onClick={() => toast.info('Organization ID not available yet — open a job posting first or refresh.')}
                            >
                                Career Portal
                            </button>
                        )}
                        <Link to="/recruitment/create-job" className="ats-module-nav__btn ats-module-nav__btn--primary">
                            <FaPlus className="h-3.5 w-3.5" /> Post New Job
                        </Link>
                    </div>
                }
            />

            <div className="ats-module-nav">
                <div className="ats-module-nav__links">
                    <Link to="/recruitment/workspace" className="ats-module-nav__btn">
                        <FaHome className="h-3.5 w-3.5" /> Workspace
                    </Link>
                    <Link to="/recruitment/pipeline" className="ats-module-nav__btn">
                        <FaColumns className="h-3.5 w-3.5" /> Pipeline
                    </Link>
                    <Link to="/recruitment/requisitions" className="ats-module-nav__btn">
                        <FaClipboardList className="h-3.5 w-3.5" /> Requisitions
                    </Link>
                    <Link to="/recruitment/calendar" className="ats-module-nav__btn">
                        <FaCalendarAlt className="h-3.5 w-3.5" /> Calendar
                    </Link>
                    <Link to="/recruitment/inbox" className="ats-module-nav__btn">
                        <FaEnvelopeOpenText className="h-3.5 w-3.5" /> Resume Inbox
                    </Link>
                    <button type="button" className="ats-module-nav__btn" onClick={openScreeningSettings}>
                        <FaCog className="h-3.5 w-3.5" /> Screening Settings
                    </button>
                </div>
                {screeningDash && (
                    <div className="ats-module-nav__meta">
                        <div className="ats-nav-chip">
                            <span className="ats-nav-chip__label">Open jobs</span>
                            <span className="ats-nav-chip__value">{jobPostings.length}</span>
                        </div>
                        <div className="ats-nav-chip">
                            <span className="ats-nav-chip__label">Pending screen</span>
                            <span className="ats-nav-chip__value">{screeningDash.pendingScreening ?? 0}</span>
                        </div>
                        <div className="ats-nav-chip">
                            <span className="ats-nav-chip__label">Avg match</span>
                            <span className="ats-nav-chip__value">
                                {screeningDash.averageMatchScore != null ? `${screeningDash.averageMatchScore}%` : '—'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {screeningDash && (
                <div className="ats-kpi-strip">
                    {[
                        { label: 'Approved Candidates', value: screeningDash.approvedCandidates },
                        { label: 'Rejected Candidates', value: screeningDash.rejectedCandidates, tone: 'attention' },
                        { label: 'Pending Screening', value: screeningDash.pendingScreening, tone: 'attention' },
                        { label: 'Avg Match Score', value: screeningDash.averageMatchScore != null ? `${screeningDash.averageMatchScore}%` : '—' },
                        { label: 'Auto-Deleted', value: screeningDash.candidatesDeletedAutomatically },
                    ].map((w) => (
                        <div key={w.label} className="cm-stat">
                            <p className="cm-stat__label">{w.label}</p>
                            <p className={`cm-stat__value ${w.tone === 'attention' ? 'cm-stat__value--attention' : ''}`}>{w.value ?? 0}</p>
                        </div>
                    ))}
                </div>
            )}

            <nav className="ats-tabs" aria-label="Recruitment sections">
                <button type="button" onClick={() => setActiveTab('jobs')} className={`ats-tab ${activeTab === 'jobs' ? 'ats-tab--active' : ''}`}>
                    <FaBriefcase className="h-3.5 w-3.5 opacity-80" />
                    Job Postings
                    <span className="ats-tab-count">{jobPostings.length}</span>
                </button>
                <button type="button" onClick={() => setActiveTab('candidates')} className={`ats-tab ${activeTab === 'candidates' ? 'ats-tab--active' : ''}`}>
                    <FaUsers className="h-3.5 w-3.5 opacity-80" />
                    Candidates
                    <span className="ats-tab-count">{candidates.length}</span>
                </button>
                <button type="button" onClick={() => setActiveTab('offers')} className={`ats-tab ${activeTab === 'offers' ? 'ats-tab--active' : ''}`}>
                    <FaFileContract className="h-3.5 w-3.5 opacity-80" />
                    Offer Templates
                </button>
            </nav>

            {activeTab === 'jobs' ? (
                jobPostings.length === 0 ? (
                    <AtsEmpty icon={FaBriefcase} title="No job postings yet" hint="Create your first job posting to start receiving applications." />
                ) : (
                    <div className="ats-job-grid">
                        {jobPostings.map((job) => (
                            <div
                                key={job._id}
                                role="button"
                                tabIndex={0}
                                className="ats-role-card"
                                onClick={() => navigate(`/recruitment/jobs/${job._id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate(`/recruitment/jobs/${job._id}`);
                                    }
                                }}
                            >
                                <div className="ats-role-card__head">
                                    <h4 className="ats-role-card__title">{job.jobTitle}</h4>
                                    <FaRegBookmark className="ats-role-card__bookmark h-4 w-4" aria-hidden />
                                </div>
                                <div className="ats-role-card__tags">
                                    {job.status && (
                                        <span className="ats-role-card__tag" style={{ background: 'rgba(28,202,155,0.12)', color: '#006c51' }}>
                                            {job.status}
                                        </span>
                                    )}
                                    {job.department && <span className="ats-role-card__tag">{job.department}</span>}
                                    {job.location && <span className="ats-role-card__tag">{job.location}</span>}
                                </div>
                                <p className="ats-role-card__desc">{jobExcerpt(job.jobDescription)}</p>
                                <div className="ats-role-card__footer">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <AtsAvatar name={job.department || job.jobTitle || 'Job'} />
                                        <span className="truncate text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                            {job.currentApplications || 0} applications
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <span className="ats-role-card__posted">
                                            {postedAgoLabel(job.postedDate || job.createdAt || job.postedAt)}
                                        </span>
                                        <button
                                            type="button"
                                            className="ats-link inline-flex items-center gap-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/recruitment/jobs/${job._id}/edit`);
                                            }}
                                        >
                                            <FaEdit className="h-3 w-3" /> Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'candidates' ? (
                <div className="flex flex-col gap-4">
                    <div className="ats-toolbar cm-card" style={{ padding: '1rem' }}>
                        <label className="text-sm">
                            <span className="ats-form-label">Screening</span>
                            <select
                                className="cm-select"
                                value={candFilter.screeningStatus}
                                onChange={(e) => setCandFilter((p) => ({ ...p, screeningStatus: e.target.value, searchRejected: false }))}
                            >
                                <option value="">All</option>
                                <option value="passed">Approved</option>
                                <option value="failed">Rejected</option>
                                <option value="pending">Pending / Not Screened</option>
                            </select>
                        </label>
                        <label className="text-sm flex-1" style={{ minWidth: 200 }}>
                            <span className="ats-form-label">Search</span>
                            <div className="cm-search">
                                <FaSearch className="cm-search__icon h-3.5 w-3.5" />
                                <input
                                    className="cm-input"
                                    placeholder="Name, email, phone"
                                    value={candFilter.q}
                                    onChange={(e) => setCandFilter((p) => ({ ...p, q: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
                                />
                            </div>
                        </label>
                        <CmButton
                            variant={candFilter.searchRejected ? 'tertiary' : 'outline'}
                            size="sm"
                            onClick={() => setCandFilter((p) => ({ ...p, searchRejected: !p.searchRejected, screeningStatus: '' }))}
                        >
                            Rejected only
                        </CmButton>
                        <CmButton size="sm" onClick={fetchData}>Apply</CmButton>
                    </div>
                    {candidates.length === 0 ? (
                        <AtsEmpty icon={FaUsers} title="No candidates yet" hint="Candidates will appear here once they apply to your job postings." />
                    ) : (
                        <div className="ats-table-wrap">
                            <div className="overflow-x-auto">
                                <table className="ats-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Position</th>
                                            <th>Status</th>
                                            <th>Screening</th>
                                            <th>Match</th>
                                            <th>Applied</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.map((candidate) => {
                                            const screening = normalizeResumeScreening(candidate.resumeScreening);
                                            return (
                                            <tr key={candidate._id}>
                                                <td className="font-semibold">{candidate.firstName} {candidate.lastName}</td>
                                                <td>
                                                    {(candidate.tags || []).includes('Unassigned')
                                                        || (candidate.jobPostingId?.tags || []).includes('__resume_inbox_holding__')
                                                        || /unassigned/i.test(candidate.jobPostingId?.jobTitle || '')
                                                        ? 'Unassigned'
                                                        : (candidate.jobPostingId?.jobTitle || 'N/A')}
                                                </td>
                                                <td><AtsBadge status={candidate.status}>{candidate.status}</AtsBadge></td>
                                                <td><AtsBadge status={screening.label}>{screening.label}</AtsBadge></td>
                                                <td>{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</td>
                                                <td>{new Date(candidate.applicationDate).toLocaleDateString()}</td>
                                                <td>
                                                    <button type="button" onClick={() => navigate(`/recruitment/candidates/${candidate._id}`)} className="ats-link">
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="ats-table-footer">
                                <span>Showing {candidates.length} of {candidates.length} candidates</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="cm-card">
                    <OfferTemplateManager />
                </div>
            )}

            {showScreeningSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-[rgba(15,45,38,0.08)] px-5 py-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Resume Screening Settings</h3>
                            <button type="button" onClick={() => setShowScreeningSettings(false)} className="ats-back !mb-0">
                                <FaTimes className="h-3.5 w-3.5" /> Close
                            </button>
                        </div>
                        <div className="flex gap-1 border-b border-[rgba(15,45,38,0.08)] px-5 pt-3">
                            <button
                                type="button"
                                onClick={() => setSettingsTab('general')}
                                className={`ats-tab ${settingsTab === 'general' ? 'ats-tab--active' : ''}`}
                            >
                                General
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsTab('templates')}
                                className={`ats-tab ${settingsTab === 'templates' ? 'ats-tab--active' : ''}`}
                            >
                                Resume Screening Templates
                            </button>
                        </div>
                        <div className="overflow-y-auto p-5">
                            {settingsTab === 'general' ? (
                                <form onSubmit={saveScreeningSettings} className="space-y-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={!!screeningSettings.enabled} onChange={(e) => setScreeningSettings((p) => ({ ...p, enabled: e.target.checked }))} />
                                        Enable automatic resume screening
                                    </label>
                                    <label className="block text-sm">
                                        <span className="ats-form-label">Default Minimum Match %</span>
                                        <input type="number" min="0" max="100" className="cm-input w-full" value={screeningSettings.defaultMinimumMatchPercent} onChange={(e) => setScreeningSettings((p) => ({ ...p, defaultMinimumMatchPercent: e.target.value }))} />
                                    </label>
                                    <label className="block text-sm">
                                        <span className="ats-form-label">Retention Period (days)</span>
                                        <input type="number" min="1" max="365" className="cm-input w-full" value={screeningSettings.retentionDays} onChange={(e) => setScreeningSettings((p) => ({ ...p, retentionDays: e.target.value }))} />
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block text-sm">
                                            <span className="ats-form-label">Required Keyword Weight</span>
                                            <input type="number" step="0.1" min="0" className="cm-input w-full" value={screeningSettings.requiredKeywordWeight} onChange={(e) => setScreeningSettings((p) => ({ ...p, requiredKeywordWeight: e.target.value }))} />
                                        </label>
                                        <label className="block text-sm">
                                            <span className="ats-form-label">Optional Keyword Weight</span>
                                            <input type="number" step="0.1" min="0" className="cm-input w-full" value={screeningSettings.optionalKeywordWeight} onChange={(e) => setScreeningSettings((p) => ({ ...p, optionalKeywordWeight: e.target.value }))} />
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={screeningSettings.autoDeleteEnabled !== false} onChange={(e) => setScreeningSettings((p) => ({ ...p, autoDeleteEnabled: e.target.checked }))} />
                                        Auto-delete failed candidates after retention period
                                    </label>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <CmButton type="submit" disabled={savingSettings}>
                                            {savingSettings ? 'Saving…' : 'Save Settings'}
                                        </CmButton>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-5">
                                    <form onSubmit={saveTemplate} className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(28,202,155,0.06)' }}>
                                        <h4 className="text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                            {templateForm._id ? 'Edit Template' : 'Create Template'}
                                        </h4>
                                        <label className="block text-sm">
                                            <span className="ats-form-label">Template Name</span>
                                            <input
                                                className="cm-input w-full"
                                                value={templateForm.name}
                                                onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                                                placeholder="e.g. MERN Developer"
                                                required
                                            />
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="block text-sm">
                                                <span className="ats-form-label">Required Keywords (one per line)</span>
                                                <textarea
                                                    rows={4}
                                                    className="cm-input w-full"
                                                    value={templateForm.requiredKeywords}
                                                    onChange={(e) => setTemplateForm((p) => ({ ...p, requiredKeywords: e.target.value }))}
                                                    placeholder={'React\nNode.js\nMongoDB'}
                                                />
                                            </label>
                                            <label className="block text-sm">
                                                <span className="ats-form-label">Optional Keywords (one per line)</span>
                                                <textarea
                                                    rows={4}
                                                    className="cm-input w-full"
                                                    value={templateForm.optionalKeywords}
                                                    onChange={(e) => setTemplateForm((p) => ({ ...p, optionalKeywords: e.target.value }))}
                                                    placeholder={'Docker\nAWS'}
                                                />
                                            </label>
                                        </div>
                                        <label className="block text-sm">
                                            <span className="ats-form-label">Minimum Match %</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="cm-input w-full"
                                                value={templateForm.minimumMatchPercent}
                                                onChange={(e) => setTemplateForm((p) => ({ ...p, minimumMatchPercent: e.target.value }))}
                                            />
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={templateForm.isActive}
                                                onChange={(e) => setTemplateForm((p) => ({ ...p, isActive: e.target.checked }))}
                                            />
                                            Active (available when creating jobs)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <CmButton type="submit" size="sm" disabled={savingTemplate}>
                                                {savingTemplate ? 'Saving…' : (templateForm._id ? 'Update Template' : 'Create Template')}
                                            </CmButton>
                                            {templateForm._id && (
                                                <CmButton type="button" size="sm" variant="outline" onClick={resetTemplateForm}>
                                                    Cancel Edit
                                                </CmButton>
                                            )}
                                        </div>
                                    </form>

                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>Saved Templates ({screeningTemplates.length})</h4>
                                        {screeningTemplates.length === 0 ? (
                                            <p className="text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>No templates yet. Create one above (e.g. MERN Developer, Java Developer).</p>
                                        ) : (
                                            <ul className="divide-y rounded-2xl border border-[rgba(15,45,38,0.08)]">
                                                {screeningTemplates.map((t) => (
                                                    <li key={t._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="font-medium" style={{ color: 'var(--ats-secondary)' }}>
                                                                {t.name}
                                                                <AtsBadge tone={t.isActive ? 'success' : 'neutral'} className="ml-2">
                                                                    {t.isActive ? 'Active' : 'Inactive'}
                                                                </AtsBadge>
                                                            </p>
                                                            <p className="truncate text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                                                Min {t.minimumMatchPercent ?? 70}% · Required: {(t.requiredKeywords || []).join(', ') || '—'}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <CmButton type="button" size="sm" variant="outline" onClick={() => editTemplate(t)}>Edit</CmButton>
                                                            <CmButton type="button" size="sm" variant="outline" onClick={() => toggleTemplateActive(t)}>
                                                                {t.isActive ? 'Deactivate' : 'Activate'}
                                                            </CmButton>
                                                            <CmButton type="button" size="sm" variant="outline" className="!text-[var(--ats-error)]" onClick={() => deleteTemplate(t)}>Delete</CmButton>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AtsPage>
    );
};

export default RecruitmentPage;
