import useCareerPortalIdentifier from '../../Hooks/useCareerPortalIdentifier';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaPlus, FaBriefcase, FaUsers, FaFileContract, FaColumns, FaClipboardList,
    FaCalendarAlt, FaEnvelopeOpenText, FaCog, FaSearch, FaTimes, FaEdit,
    FaTh, FaList, FaDownload, FaCheckCircle, FaBuilding,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferTemplateManager from '../../components/recruitment/OfferTemplateManager';
import { normalizeResumeScreening, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsEmpty, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';
import DraftAwaitingBanner from '../../components/DraftAwaitingBanner';

const formatSalaryRange = (salaryRange) => {
    if (!salaryRange || (salaryRange.min == null && salaryRange.max == null)) return null;
    const currency = salaryRange.currency === 'INR' || !salaryRange.currency ? '₹' : `${salaryRange.currency} `;
    const fmt = (n) => {
        const num = Number(n);
        if (!Number.isFinite(num)) return null;
        if (num >= 100000) return `${Math.round(num / 100000)}L`;
        return num.toLocaleString('en-IN');
    };
    const min = fmt(salaryRange.min);
    const max = fmt(salaryRange.max);
    if (min && max) return `${currency}${min} - ${currency}${max}`;
    if (min) return `From ${currency}${min}`;
    if (max) return `Up to ${currency}${max}`;
    return null;
};

const jobReqId = (job) => {
    if (job?.requisitionId) return String(job.requisitionId);
    if (job?.jobCode) return String(job.jobCode);
    const id = String(job?._id || '').slice(-6).toUpperCase();
    return id ? `REQ-${id}` : 'REQ—';
};

const RecruitmentPage = () => {
    const navigate = useNavigate();
    const [jobPostings, setJobPostings] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('jobs');
    const careerIdentifier = useCareerPortalIdentifier();
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
    const [jobSearch, setJobSearch] = useState('');
    const [jobStatusFilter, setJobStatusFilter] = useState('');
    const [jobDeptFilter, setJobDeptFilter] = useState('');
    const [jobView, setJobView] = useState('grid');
    const [candidateCount, setCandidateCount] = useState(0);
    const [offerTemplateCount, setOfferTemplateCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await axios.get('/v1/admin/recruitment/candidates', {
                    withCredentials: true,
                    params: { limit: 1 },
                });
                const total = response.data?.total ?? response.data?.pagination?.total ?? (response.data?.data || []).length;
                if (!cancelled) setCandidateCount(Number(total) || 0);
            } catch { /* optional */ }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get('/v1/admin/lifecycle/offers/templates', { withCredentials: true });
                if (!cancelled && data?.success) setOfferTemplateCount((data.data || []).length);
            } catch { /* optional */ }
        })();
        return () => { cancelled = true; };
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
            } else if (activeTab === 'candidates') {
                const params = { limit: 100 };
                if (candFilter.screeningStatus) params.screeningStatus = candFilter.screeningStatus;
                if (candFilter.q) params.q = candFilter.q;
                if (candFilter.matchMin !== '') params.matchMin = candFilter.matchMin;
                if (candFilter.matchMax !== '') params.matchMax = candFilter.matchMax;
                if (candFilter.searchRejected) params.searchRejected = 'true';
                const response = await axios.get('/v1/admin/recruitment/candidates', { withCredentials: true, params });
                const list = response.data?.data || [];
                setCandidates(list);
                const total = response.data?.total ?? response.data?.pagination?.total ?? list.length;
                setCandidateCount(Number(total) || list.length);
            }
        } catch (error) {
            // Error handled silently for production
        } finally {
            setLoading(false);
        }
    };

    const filteredJobs = useMemo(() => {
        const q = jobSearch.trim().toLowerCase();
        return jobPostings.filter((job) => {
            if (jobStatusFilter && String(job.status || '') !== jobStatusFilter) return false;
            if (jobDeptFilter && String(job.department || '') !== jobDeptFilter) return false;
            if (!q) return true;
            const hay = `${job.jobTitle || ''} ${job.department || ''} ${job.location || ''} ${jobReqId(job)}`.toLowerCase();
            return hay.includes(q);
        });
    }, [jobPostings, jobSearch, jobStatusFilter, jobDeptFilter]);

    const jobDepartments = useMemo(() => {
        const set = new Set(jobPostings.map((j) => j.department).filter(Boolean));
        return Array.from(set).sort();
    }, [jobPostings]);

    const openJobsCount = useMemo(
        () => jobPostings.filter((j) => String(j.status || '').toLowerCase() === 'open').length || jobPostings.length,
        [jobPostings]
    );

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

    if (loading && activeTab !== 'offers' && jobPostings.length === 0 && candidates.length === 0) {
        return <LoadingSpinner message="Loading recruitment data..." />;
    }

    const pendingScreen = screeningDash?.pendingScreening ?? 0;
    const approvedCand = screeningDash?.approvedCandidates ?? candidateCount;
    const avgMatch = screeningDash?.averageMatchScore;

    return (
        <AtsPage fullWidth className="rec-hub">
            <div className="rec-hub__crumb">
                <span>Dashboard</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span>Hire &amp; Lifecycle</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Recruitment Hub</span>
            </div>

            <div className="rec-hub__header">
                <div className="rec-hub__header-main">
                    <div className="rec-hub__title-row">
                        <h1 className="rec-hub__title">Recruitment &amp; Talent Acquisition Hub</h1>
                        <div className="rec-hub__badges">
                            <span className="rec-hub__badge rec-hub__badge--mint">
                                <FaCheckCircle className="h-3 w-3" aria-hidden="true" />
                                Active hiring
                            </span>
                            <span className="rec-hub__badge rec-hub__badge--soft">
                                <FaBuilding className="h-3 w-3" aria-hidden="true" />
                                Talent acquisition
                            </span>
                        </div>
                    </div>
                </div>
                <div className="rec-hub__header-actions">
                    <button type="button" className="rec-hub__btn" onClick={openScreeningSettings}>
                        <FaCog className="h-3.5 w-3.5" /> Screening Settings
                    </button>
                    {careerIdentifier ? (
                        <Link to={`/careers/${careerIdentifier}`} className="rec-hub__btn">Career Portal</Link>
                    ) : null}
                    <Link to="/recruitment/create-job" className="rec-hub__btn rec-hub__btn--primary">
                        <FaPlus className="h-3.5 w-3.5" /> Post New Job
                    </Link>
                </div>
            </div>

            <div className="rec-hub__quick">
                <Link to="/recruitment/pipeline" className="rec-hub__pill">
                    <FaColumns className="h-3.5 w-3.5 text-[var(--color-primary)]" /> Pipeline
                </Link>
                <Link to="/recruitment/requisitions" className="rec-hub__pill">
                    <FaClipboardList className="h-3.5 w-3.5 text-[var(--color-primary)]" /> Requisitions
                </Link>
                <Link to="/recruitment/calendar" className="rec-hub__pill">
                    <FaCalendarAlt className="h-3.5 w-3.5 text-[var(--color-primary)]" /> Interview Calendar
                </Link>
                <Link to="/recruitment/inbox" className="rec-hub__pill">
                    <FaEnvelopeOpenText className="h-3.5 w-3.5 text-[var(--color-primary)]" /> Resume Inbox
                    {pendingScreen > 0 ? <span className="rec-hub__pill-count">{pendingScreen}</span> : null}
                </Link>
            </div>

            <div className="rec-hub__kpi">
                <button type="button" className="rec-hub__kpi-card" onClick={() => setActiveTab('jobs')}>
                    <div className="rec-hub__kpi-top">
                        <div>
                            <p className="rec-hub__kpi-label">Open Jobs</p>
                            <p className="rec-hub__kpi-value">{openJobsCount}</p>
                            <p className="rec-hub__kpi-meta">{jobPostings.length} total postings</p>
                        </div>
                        <span className="rec-hub__kpi-icon rec-hub__kpi-icon--mint"><FaBriefcase /></span>
                    </div>
                    <p className="rec-hub__kpi-link">View open requisitions →</p>
                </button>
                <button type="button" className="rec-hub__kpi-card" onClick={() => setActiveTab('candidates')}>
                    <div className="rec-hub__kpi-top">
                        <div>
                            <p className="rec-hub__kpi-label">Active Candidates</p>
                            <p className="rec-hub__kpi-value">{approvedCand ?? candidateCount}</p>
                            <p className="rec-hub__kpi-meta">
                                {avgMatch != null ? `Avg match ${avgMatch}%` : `${pendingScreen} pending screen`}
                            </p>
                        </div>
                        <span className="rec-hub__kpi-icon rec-hub__kpi-icon--blue"><FaUsers /></span>
                    </div>
                    <p className="rec-hub__kpi-link">Review candidate funnel →</p>
                </button>
                <button type="button" className="rec-hub__kpi-card" onClick={() => navigate('/recruitment/calendar')}>
                    <div className="rec-hub__kpi-top">
                        <div>
                            <p className="rec-hub__kpi-label">Interview Calendar</p>
                            <p className="rec-hub__kpi-value">—</p>
                            <p className="rec-hub__kpi-meta">Manage schedule &amp; rooms</p>
                        </div>
                        <span className="rec-hub__kpi-icon rec-hub__kpi-icon--mint"><FaCalendarAlt /></span>
                    </div>
                    <p className="rec-hub__kpi-link">Open calendar →</p>
                </button>
                <button type="button" className="rec-hub__kpi-card" onClick={() => setActiveTab('offers')}>
                    <div className="rec-hub__kpi-top">
                        <div>
                            <p className="rec-hub__kpi-label">Pending Screening</p>
                            <p className="rec-hub__kpi-value">{pendingScreen}</p>
                            <p className="rec-hub__kpi-meta">Resume inbox queue</p>
                        </div>
                        <span className="rec-hub__kpi-icon rec-hub__kpi-icon--blue"><FaFileContract /></span>
                    </div>
                    <p className="rec-hub__kpi-link">Review screening →</p>
                </button>
            </div>

            <div className="rec-hub__board">
                <div className="rec-hub__tabs-bar">
                    <nav className="rec-hub__tabs" aria-label="Recruitment sections">
                        <button type="button" onClick={() => setActiveTab('jobs')} className={`rec-hub__tab${activeTab === 'jobs' ? ' is-active' : ''}`}>
                            <FaBriefcase className="h-3.5 w-3.5" />
                            <span className="rec-hub__tab-label-full">Jobs</span>
                            <span className="rec-hub__tab-label-short">Jobs</span>
                            <span className="rec-hub__tab-count">{jobPostings.length}</span>
                        </button>
                        <button type="button" onClick={() => setActiveTab('candidates')} className={`rec-hub__tab${activeTab === 'candidates' ? ' is-active' : ''}`}>
                            <FaUsers className="h-3.5 w-3.5" />
                            <span className="rec-hub__tab-label-full">Candidates</span>
                            <span className="rec-hub__tab-label-short">Candidates</span>
                            <span className="rec-hub__tab-count">{candidateCount || candidates.length}</span>
                        </button>
                        <button type="button" onClick={() => setActiveTab('offers')} className={`rec-hub__tab${activeTab === 'offers' ? ' is-active' : ''}`}>
                            <FaFileContract className="h-3.5 w-3.5" />
                            <span className="rec-hub__tab-label-full">Offer Templates</span>
                            <span className="rec-hub__tab-label-short">Offers</span>
                            <span className="rec-hub__tab-count">{offerTemplateCount}</span>
                        </button>
                    </nav>
                    <div className="rec-hub__tabs-meta">
                        <span>Filtered by: <strong>All Entities</strong></span>
                        <button type="button" className="rec-hub__icon-btn" title="Export" aria-label="Export">
                            <FaDownload className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

            {activeTab === 'jobs' ? (
                jobPostings.length === 0 ? (
                    <AtsEmpty icon={FaBriefcase} title="No job postings yet" hint="Create your first job posting to start receiving applications." />
                ) : (
                    <>
                    <DraftAwaitingBanner
                        count={jobPostings.filter((j) => j.status === 'Draft').length}
                        entityLabel="job posting"
                    />
                    <div className="rec-hub__toolbar">
                        <div className="rec-hub__search">
                            <FaSearch className="rec-hub__search-icon" aria-hidden="true" />
                            <input
                                value={jobSearch}
                                onChange={(e) => setJobSearch(e.target.value)}
                                placeholder="Search job title, req ID..."
                                aria-label="Search jobs"
                            />
                        </div>
                        <select
                            className="rec-hub__select"
                            value={jobStatusFilter}
                            onChange={(e) => setJobStatusFilter(e.target.value)}
                            aria-label="Filter by status"
                        >
                            <option value="">All Statuses</option>
                            {['Draft', 'Open', 'Closed', 'On Hold', 'Cancelled'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <select
                            className="rec-hub__select"
                            value={jobDeptFilter}
                            onChange={(e) => setJobDeptFilter(e.target.value)}
                            aria-label="Filter by department"
                        >
                            <option value="">All Departments</option>
                            {jobDepartments.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <div className="rec-hub__view-toggle" role="group" aria-label="Job view">
                            <button
                                type="button"
                                className={jobView === 'grid' ? 'is-active' : ''}
                                onClick={() => setJobView('grid')}
                                aria-label="Grid view"
                            >
                                <FaTh />
                            </button>
                            <button
                                type="button"
                                className={jobView === 'list' ? 'is-active' : ''}
                                onClick={() => setJobView('list')}
                                aria-label="List view"
                            >
                                <FaList />
                            </button>
                        </div>
                        <Link to="/recruitment/create-job" className="rec-hub__btn rec-hub__btn--mint">
                            <FaPlus className="h-3 w-3" /> Quick Requisition
                        </Link>
                    </div>
                    <div className={jobView === 'list' ? 'rec-hub__job-list' : 'rec-hub__job-grid'}>
                        {filteredJobs.map((job) => {
                            const salary = formatSalaryRange(job.salaryRange);
                            const apps = job.currentApplications || 0;
                            return (
                                <article
                                    key={job._id}
                                    className="rec-hub__job-card"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(`/recruitment/jobs/${job._id}`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate(`/recruitment/jobs/${job._id}`);
                                        }
                                    }}
                                >
                                    <div className="rec-hub__job-card-head">
                                        <div>
                                            <p className="rec-hub__job-req">{jobReqId(job)}</p>
                                            <h3 className="rec-hub__job-title">{job.jobTitle}</h3>
                                        </div>
                                        <button
                                            type="button"
                                            className="rec-hub__job-edit"
                                            title="Edit job"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/recruitment/jobs/${job._id}/edit`);
                                            }}
                                        >
                                            <FaEdit />
                                        </button>
                                    </div>
                                    <div className="rec-hub__job-tags">
                                        {job.department ? <span>{job.department}</span> : null}
                                        {job.location ? <span>{job.location}</span> : null}
                                        {salary ? <span className="is-salary">{salary}</span> : null}
                                    </div>
                                    <div className="rec-hub__job-pipeline">
                                        <div className="rec-hub__job-pipeline-top">
                                            <span>Active pipeline</span>
                                            <span>{apps} candidate{apps === 1 ? '' : 's'}</span>
                                        </div>
                                        <div className="rec-hub__job-pipeline-pills">
                                            <span>{job.employmentType || 'Role'}</span>
                                            {job.priority ? <span>{job.priority} priority</span> : null}
                                        </div>
                                    </div>
                                    <div className="rec-hub__job-footer">
                                        <span className={`rec-hub__job-status is-${String(job.status || 'draft').toLowerCase().replace(/\s+/g, '-')}`}>
                                            {job.status || 'Draft'}
                                        </span>
                                        <span className="rec-hub__job-view">View Requisition →</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    {filteredJobs.length === 0 ? (
                        <p className="rec-hub__empty-filter">No jobs match your filters.</p>
                    ) : null}
                    </>
                )
            ) : activeTab === 'candidates' ? (
                <div className="rec-hub__cand">
                    <div className="rec-hub__toolbar rec-hub__toolbar--cand">
                        <div className="rec-hub__search rec-hub__search--grow">
                            <FaSearch className="rec-hub__search-icon" aria-hidden="true" />
                            <input
                                value={candFilter.q}
                                onChange={(e) => setCandFilter((p) => ({ ...p, q: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
                                placeholder="Search candidate name, email, or skill..."
                                aria-label="Search candidates"
                            />
                        </div>
                        <div className="rec-hub__cand-filters">
                            <select
                                className="rec-hub__select"
                                value={candFilter.screeningStatus}
                                onChange={(e) => setCandFilter((p) => ({ ...p, screeningStatus: e.target.value, searchRejected: false }))}
                                aria-label="Filter by screening stage"
                            >
                                <option value="">All Stages</option>
                                <option value="passed">Approved</option>
                                <option value="failed">Rejected</option>
                                <option value="pending">Pending / Not Screened</option>
                            </select>
                            <label
                                className={`rec-hub__toggle${candFilter.searchRejected ? ' is-on' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={candFilter.searchRejected}
                                    onChange={() => setCandFilter((p) => ({
                                        ...p,
                                        searchRejected: !p.searchRejected,
                                        screeningStatus: '',
                                    }))}
                                />
                                <span className="rec-hub__toggle-box" aria-hidden="true" />
                                <span>Rejected only</span>
                            </label>
                            <button type="button" className="rec-hub__btn rec-hub__btn--primary rec-hub__cand-apply" onClick={fetchData}>
                                Apply
                            </button>
                        </div>
                    </div>
                    {candidates.length === 0 ? (
                        <AtsEmpty icon={FaUsers} title="No candidates yet" hint="Candidates will appear here once they apply to your job postings." />
                    ) : (
                        <div className="ats-table-wrap rec-hub__table-wrap">
                            <div className="overflow-x-auto">
                                <table className="ats-table rec-hub__table">
                                    <thead>
                                        <tr>
                                            <th>Candidate Profile</th>
                                            <th>Applied Role &amp; Req</th>
                                            <th>Current Stage</th>
                                            <th>Match Score</th>
                                            <th>Applied Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.map((candidate) => {
                                            const screening = normalizeResumeScreening(candidate.resumeScreening);
                                            const roleTitle =
                                                (candidate.tags || []).includes('Unassigned')
                                                || (candidate.jobPostingId?.tags || []).includes('__resume_inbox_holding__')
                                                || /unassigned/i.test(candidate.jobPostingId?.jobTitle || '')
                                                    ? 'Unassigned'
                                                    : (candidate.jobPostingId?.jobTitle || 'N/A');
                                            const req = candidate.jobPostingId ? jobReqId(candidate.jobPostingId) : null;
                                            return (
                                            <tr key={candidate._id}>
                                                <td>
                                                    <div className="rec-hub__cand-profile">
                                                        <AtsAvatar name={`${candidate.firstName || ''} ${candidate.lastName || ''}`} />
                                                        <div>
                                                            <p className="rec-hub__cand-name">{candidate.firstName} {candidate.lastName}</p>
                                                            <p className="rec-hub__cand-meta">
                                                                {[candidate.email, candidate.phone].filter(Boolean).join(' · ') || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <p className="rec-hub__cand-role">{roleTitle}</p>
                                                    {req ? <p className="rec-hub__cand-req">{req}</p> : null}
                                                </td>
                                                <td><AtsBadge status={candidate.status}>{candidate.status}</AtsBadge></td>
                                                <td>
                                                    <span className="rec-hub__match">
                                                        {screening.matchScore != null ? `${screening.matchScore}%` : '—'}
                                                    </span>
                                                    {screening.label ? (
                                                        <span className="rec-hub__match-label">{screening.label}</span>
                                                    ) : null}
                                                </td>
                                                <td>{candidate.applicationDate ? new Date(candidate.applicationDate).toLocaleDateString() : '—'}</td>
                                                <td>
                                                    <button type="button" onClick={() => navigate(`/recruitment/candidates/${candidate._id}`)} className="rec-hub__profile-btn">
                                                        Profile
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="ats-table-footer">
                                <span>Showing {candidates.length} candidates</span>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rec-hub__offers">
                    <OfferTemplateManager onCountChange={setOfferTemplateCount} />
                </div>
            )}
            </div>

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
