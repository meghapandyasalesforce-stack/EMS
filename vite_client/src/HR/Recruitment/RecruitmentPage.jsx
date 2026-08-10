import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaBriefcase, FaUsers, FaFileContract, FaColumns, FaHome, FaClipboardList, FaCalendarAlt, FaEnvelopeOpenText, FaCog } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferTemplateManager from '../../components/recruitment/OfferTemplateManager';
import { normalizeResumeScreening, getScreeningBadgeClasses, parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';

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
                if (jobs[0]?.organizationId) setOrgId(jobs[0].organizationId);
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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 transition-all duration-300">
            <div className="w-full">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Recruitment & ATS</h1>
                        <p className="text-gray-600 mt-1">Manage job postings and candidates</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => navigate('/recruitment/workspace')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaHome className="w-4 h-4" /> Workspace
                        </button>
                        <button type="button" onClick={() => navigate('/recruitment/pipeline')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaColumns className="w-4 h-4" /> Pipeline
                        </button>
                        <button type="button" onClick={() => navigate('/recruitment/requisitions')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaClipboardList className="w-4 h-4" /> Requisitions
                        </button>
                        <button type="button" onClick={() => navigate('/recruitment/calendar')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaCalendarAlt className="w-4 h-4" /> Calendar
                        </button>
                        <button type="button" onClick={() => navigate('/recruitment/inbox')} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaEnvelopeOpenText className="w-4 h-4" /> Resume Inbox
                        </button>
                        <button type="button" onClick={openScreeningSettings} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                            <FaCog className="w-4 h-4" /> Screening Settings
                        </button>
                        {orgId && (
                            <a href={`/careers/${orgId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white">
                                Career Portal
                            </a>
                        )}
                        <button type="button" onClick={() => navigate('/recruitment/create-job')} className="bg-theme-secondary text-white px-4 py-2 rounded-lg hover:bg-theme-primary transition flex items-center gap-2">
                            <FaPlus className="w-4 h-4" />
                            Post New Job
                        </button>
                    </div>
                </div>

                {screeningDash && (
                    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                            { label: 'Approved Candidates', value: screeningDash.approvedCandidates, tone: 'text-emerald-700' },
                            { label: 'Rejected Candidates', value: screeningDash.rejectedCandidates, tone: 'text-red-700' },
                            { label: 'Pending Screening', value: screeningDash.pendingScreening, tone: 'text-amber-700' },
                            { label: 'Average Match Score', value: screeningDash.averageMatchScore != null ? `${screeningDash.averageMatchScore}%` : '—', tone: 'text-gray-800' },
                            { label: 'Auto-Deleted', value: screeningDash.candidatesDeletedAutomatically, tone: 'text-gray-600' },
                        ].map((w) => (
                            <div key={w.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{w.label}</p>
                                <p className={`mt-1 text-2xl font-semibold ${w.tone}`}>{w.value ?? 0}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b overflow-x-auto">
                        <button type="button" onClick={() => setActiveTab('jobs')} className={`px-6 py-3 font-medium ${activeTab === 'jobs' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}>
                            <FaBriefcase className="inline mr-2" />
                            Job Postings ({jobPostings.length})
                        </button>
                        <button type="button" onClick={() => setActiveTab('candidates')} className={`px-6 py-3 font-medium ${activeTab === 'candidates' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}>
                            <FaUsers className="inline mr-2" />
                            Candidates ({candidates.length})
                        </button>
                        <button type="button" onClick={() => setActiveTab('offers')} className={`px-6 py-3 font-medium ${activeTab === 'offers' ? 'border-b-2 border-theme-secondary text-theme-secondary' : 'text-gray-600'}`}>
                            <FaFileContract className="inline mr-2" />
                            Offer Templates
                        </button>
                    </div>
                </div>

                {activeTab === 'jobs' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {jobPostings.map((job) => (
                            <div key={job._id} className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800">{job.jobTitle}</h3>
                                        <p className="text-gray-600">{job.department} · {job.location}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        job.status === 'Open' ? 'bg-theme-primary/10 text-theme-primary' :
                                        job.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {job.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">{job.currentApplications || 0} applications</span>
                                    <button type="button" onClick={() => navigate(`/recruitment/jobs/${job._id}`)} className="text-theme-secondary hover:text-theme-primary font-medium">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
                        {jobPostings.length === 0 && (
                            <div className="col-span-3 text-center py-8 sm:py-10">
                                <p className="text-gray-500">No job postings yet. Create your first job posting!</p>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'candidates' ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 items-end rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <label className="text-sm">
                                <span className="mb-1 block text-gray-600">Screening</span>
                                <select
                                    className="rounded-lg border px-3 py-2 text-sm"
                                    value={candFilter.screeningStatus}
                                    onChange={(e) => setCandFilter((p) => ({ ...p, screeningStatus: e.target.value, searchRejected: false }))}
                                >
                                    <option value="">All</option>
                                    <option value="passed">Approved</option>
                                    <option value="failed">Rejected</option>
                                    <option value="pending">Pending / Not Screened</option>
                                </select>
                            </label>
                            <label className="text-sm">
                                <span className="mb-1 block text-gray-600"></span>
                                {/* <input type="number" className="w-24 rounded-lg border px-3 py-2 text-sm" value={candFilter.matchMin} onChange={(e) => setCandFilter((p) => ({ ...p, matchMin: e.target.value }))} /> */}
                            </label>
                            <label className="text-sm">
                                <span className="mb-1 block text-gray-600"></span>
                                {/* <input type="number" className="w-24 rounded-lg border px-3 py-2 text-sm" value={candFilter.matchMax} onChange={(e) => setCandFilter((p) => ({ ...p, matchMax: e.target.value }))} /> */}
                            </label>
                            <label className="text-sm flex-1 min-w-[160px]">
                                <span className="mb-1 block text-gray-600">Search</span>
                                <input
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                    placeholder="Name, email, phone"
                                    value={candFilter.q}
                                    onChange={(e) => setCandFilter((p) => ({ ...p, q: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
                                />
                            </label>
                            <button
                                type="button"
                                onClick={() => setCandFilter((p) => ({ ...p, searchRejected: !p.searchRejected, screeningStatus: '' }))}
                                className={`rounded-lg border px-3 py-2 text-sm ${candFilter.searchRejected ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white text-gray-700'}`}
                            >
                                Rejected only
                            </button>
                            <button type="button" onClick={fetchData} className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white">
                                Apply
                            </button>
                        </div>
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-[720px] w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Screening</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {candidates.map((candidate) => {
                                            const screening = normalizeResumeScreening(candidate.resumeScreening);
                                            return (
                                            <tr key={candidate._id}>
                                                <td className="px-6 py-4 whitespace-nowrap">{candidate.firstName} {candidate.lastName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                    {(candidate.tags || []).includes('Unassigned')
                                                        || (candidate.jobPostingId?.tags || []).includes('__resume_inbox_holding__')
                                                        || /unassigned/i.test(candidate.jobPostingId?.jobTitle || '')
                                                        ? 'Unassigned'
                                                        : (candidate.jobPostingId?.jobTitle || 'N/A')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                                        candidate.status === 'Offer Accepted' ? 'bg-theme-primary/10 text-theme-primary' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {candidate.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScreeningBadgeClasses(screening)}`}>
                                                        {screening.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{new Date(candidate.applicationDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button type="button" onClick={() => navigate(`/recruitment/candidates/${candidate._id}`)} className="text-theme-secondary hover:text-theme-secondary">
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {candidates.length === 0 && (
                                <div className="text-center py-8 sm:py-10">
                                    <p className="text-gray-500">No candidates yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
                        <OfferTemplateManager />
                    </div>
                )}
            </div>

            {showScreeningSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b px-5 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">Resume Screening Settings</h3>
                            <button type="button" onClick={() => setShowScreeningSettings(false)} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                        </div>
                        <div className="flex gap-2 border-b px-5 pt-3">
                            <button
                                type="button"
                                onClick={() => setSettingsTab('general')}
                                className={`border-b-2 px-3 pb-2 text-sm font-medium ${settingsTab === 'general' ? 'border-theme-secondary text-theme-secondary' : 'border-transparent text-gray-600'}`}
                            >
                                General
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsTab('templates')}
                                className={`border-b-2 px-3 pb-2 text-sm font-medium ${settingsTab === 'templates' ? 'border-theme-secondary text-theme-secondary' : 'border-transparent text-gray-600'}`}
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
                                        Default Minimum Match %
                                        <input type="number" min="0" max="100" className="mt-1 w-full rounded-lg border px-3 py-2" value={screeningSettings.defaultMinimumMatchPercent} onChange={(e) => setScreeningSettings((p) => ({ ...p, defaultMinimumMatchPercent: e.target.value }))} />
                                    </label>
                                    <label className="block text-sm">
                                        Retention Period (days)
                                        <input type="number" min="1" max="365" className="mt-1 w-full rounded-lg border px-3 py-2" value={screeningSettings.retentionDays} onChange={(e) => setScreeningSettings((p) => ({ ...p, retentionDays: e.target.value }))} />
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block text-sm">
                                            Required Keyword Weight
                                            <input type="number" step="0.1" min="0" className="mt-1 w-full rounded-lg border px-3 py-2" value={screeningSettings.requiredKeywordWeight} onChange={(e) => setScreeningSettings((p) => ({ ...p, requiredKeywordWeight: e.target.value }))} />
                                        </label>
                                        <label className="block text-sm">
                                            Optional Keyword Weight
                                            <input type="number" step="0.1" min="0" className="mt-1 w-full rounded-lg border px-3 py-2" value={screeningSettings.optionalKeywordWeight} onChange={(e) => setScreeningSettings((p) => ({ ...p, optionalKeywordWeight: e.target.value }))} />
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={screeningSettings.autoDeleteEnabled !== false} onChange={(e) => setScreeningSettings((p) => ({ ...p, autoDeleteEnabled: e.target.checked }))} />
                                        Auto-delete failed candidates after retention period
                                    </label>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button type="submit" disabled={savingSettings} className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white disabled:opacity-60">
                                            {savingSettings ? 'Saving…' : 'Save Settings'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-5">
                                    <form onSubmit={saveTemplate} className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/30 p-4">
                                        <h4 className="text-sm font-semibold text-gray-800">
                                            {templateForm._id ? 'Edit Template' : 'Create Template'}
                                        </h4>
                                        <label className="block text-sm">
                                            Template Name
                                            <input
                                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                                value={templateForm.name}
                                                onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                                                placeholder="e.g. MERN Developer"
                                                required
                                            />
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="block text-sm">
                                                Required Keywords (one per line)
                                                <textarea
                                                    rows={4}
                                                    className="mt-1 w-full rounded-lg border px-3 py-2"
                                                    value={templateForm.requiredKeywords}
                                                    onChange={(e) => setTemplateForm((p) => ({ ...p, requiredKeywords: e.target.value }))}
                                                    placeholder={'React\nNode.js\nMongoDB'}
                                                />
                                            </label>
                                            <label className="block text-sm">
                                                Optional Keywords (one per line)
                                                <textarea
                                                    rows={4}
                                                    className="mt-1 w-full rounded-lg border px-3 py-2"
                                                    value={templateForm.optionalKeywords}
                                                    onChange={(e) => setTemplateForm((p) => ({ ...p, optionalKeywords: e.target.value }))}
                                                    placeholder={'Docker\nAWS'}
                                                />
                                            </label>
                                        </div>
                                        <label className="block text-sm">
                                            Minimum Match %
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="mt-1 w-full rounded-lg border px-3 py-2"
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
                                            <button type="submit" disabled={savingTemplate} className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white disabled:opacity-60">
                                                {savingTemplate ? 'Saving…' : (templateForm._id ? 'Update Template' : 'Create Template')}
                                            </button>
                                            {templateForm._id && (
                                                <button type="button" onClick={resetTemplateForm} className="rounded-lg border px-4 py-2 text-sm">
                                                    Cancel Edit
                                                </button>
                                            )}
                                        </div>
                                    </form>

                                    <div>
                                        <h4 className="mb-2 text-sm font-semibold text-gray-800">Saved Templates ({screeningTemplates.length})</h4>
                                        {screeningTemplates.length === 0 ? (
                                            <p className="text-sm text-gray-500">No templates yet. Create one above (e.g. MERN Developer, Java Developer).</p>
                                        ) : (
                                            <ul className="divide-y rounded-xl border border-gray-200">
                                                {screeningTemplates.map((t) => (
                                                    <li key={t._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900">
                                                                {t.name}
                                                                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {t.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </p>
                                                            <p className="truncate text-xs text-gray-500">
                                                                Min {t.minimumMatchPercent ?? 70}% · Required: {(t.requiredKeywords || []).join(', ') || '—'}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button type="button" onClick={() => editTemplate(t)} className="rounded-lg border px-3 py-1.5 text-xs">Edit</button>
                                                            <button type="button" onClick={() => toggleTemplateActive(t)} className="rounded-lg border px-3 py-1.5 text-xs">
                                                                {t.isActive ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                            <button type="button" onClick={() => deleteTemplate(t)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">Delete</button>
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
        </div>
    );
};

export default RecruitmentPage;
