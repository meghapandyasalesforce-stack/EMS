import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaChartLine,
    FaComments,
    FaClipboardList,
    FaPlus,
    FaSearch,
    FaPoll,
    FaInbox,
    FaAward,
    FaChartBar,
    FaLightbulb,
    FaDownload,
    FaTasks,
    FaCog,
    FaUsers,
    FaTrash,
    FaStream,
    FaUserClock,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import { canManageEngagement, surveyStatusStyle } from './engagementUtils';
import { downloadEngagementExport, exportFilename } from './engagementExportUtils';
import FeedbackPanel from './FeedbackPanel';
import SuggestionsPanel from './SuggestionsPanel';
import RecognitionPanel from './RecognitionPanel';
import EngagementDashboard from './EngagementDashboard';
import PulsePrograms from './PulsePrograms';
import ActionPlansPanel from './ActionPlansPanel';
import EngagementSettingsPanel from './EngagementSettingsPanel';
import ClosedLoopInsightsPanel from './ClosedLoopInsightsPanel';
import LifecycleEngagementPanel from './LifecycleEngagementPanel';
import TeamEngagementPanel from './TeamEngagementPanel';
import DraftAwaitingBanner from '../../components/DraftAwaitingBanner';
import { useAuthPermissions } from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';

const MINT = '#20C997';
const MINT_DARK = '#0d9488';

const KpiStat = ({ label, value, icon: Icon, accent = MINT, subtext, muted = false }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p
                    className={`mt-1 truncate font-bold ${
                        muted ? 'text-xl text-slate-400' : 'text-2xl text-slate-900'
                    }`}
                >
                    {value}
                </p>
                {subtext && (
                    <p className="mt-1 text-xs leading-snug text-slate-500">{subtext}</p>
                )}
            </div>
            <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}18`, color: accent }}
            >
                <Icon className="h-5 w-5" />
            </div>
        </div>
    </div>
);

const EngagementPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isManagerUser = useMemo(() => canManageEngagement(user, employee), [user, employee]);
    const { permissions, isOrgOwner } = useAuthPermissions();
    const canViewAnalytics = useMemo(() => {
        if (isManagerUser || isOrgOwner) return true;
        const keys = [
            PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG,
            PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM,
            PERMISSIONS.ENGAGEMENT_MANAGE,
        ];
        if (!Array.isArray(permissions) || !permissions.length) return false;
        if (permissions.includes('*')) return true;
        return keys.some((k) => permissions.includes(k));
    }, [isManagerUser, isOrgOwner, permissions]);
    const hasTeamAnalyticsPermission = useMemo(() => {
        if (!Array.isArray(permissions) || !permissions.length) return false;
        if (permissions.includes('*')) return true;
        return permissions.includes(PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM);
    }, [permissions]);
    const [hasDirectReports, setHasDirectReports] = useState(false);
    /** My Team: only managers with direct reports + team analytics permission (not normal employees) */
    const canViewTeamAnalytics = useMemo(() => {
        if (!hasDirectReports) return false;
        return hasTeamAnalyticsPermission;
    }, [hasDirectReports, hasTeamAnalyticsPermission]);
    const canSubmitFeedback = Boolean(employee?._id || employee?.id);
    const [engSettings, setEngSettings] = useState(null);

    const [surveys, setSurveys] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [recognitions, setRecognitions] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(
        location.state?.tab || new URLSearchParams(location.search).get('tab') || 'surveys'
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [surveysError, setSurveysError] = useState(null);
    const [feedbackError, setFeedbackError] = useState(null);
    const [recognitionError, setRecognitionError] = useState(null);
    const [analyticsError, setAnalyticsError] = useState(null);
    const [exporting, setExporting] = useState(null);

    useEffect(() => {
        const empId = employee?._id || employee?.id;
        // Only managers with team-analytics permission (or org *) should probe; employees never see My Team
        if (!empId || !hasTeamAnalyticsPermission) {
            setHasDirectReports(false);
            return;
        }
        let cancelled = false;
        axios
            .get('/v1/both/engagement/analytics', {
                params: { range: '7d', scope: 'team' },
                withCredentials: true,
            })
            .then(({ data }) => {
                if (cancelled) return;
                setHasDirectReports((data?.data?.surveys?.teamSize || 0) > 0);
            })
            .catch(() => {
                if (!cancelled) setHasDirectReports(false);
            });
        return () => {
            cancelled = true;
        };
    }, [employee?._id, employee?.id, hasTeamAnalyticsPermission]);

    useEffect(() => {
        if (activeTab === 'team' && !canViewTeamAnalytics) {
            setActiveTab('surveys');
        }
    }, [activeTab, canViewTeamAnalytics]);

    const fetchAll = async () => {
        setLoading(true);
        setSurveysError(null);
        setFeedbackError(null);
        setRecognitionError(null);
        setAnalyticsError(null);

        const requests = [
            axios.get('/v1/both/engagement/surveys?limit=500', { withCredentials: true }),
            axios.get('/v1/both/engagement/feedback?limit=500', { withCredentials: true }),
            axios.get('/v1/both/engagement/recognition?limit=100', { withCredentials: true }),
        ];
        if (canViewAnalytics) {
            requests.push(axios.get('/v1/both/engagement/analytics', { withCredentials: true }));
        }
        requests.push(axios.get('/v1/both/engagement/settings', { withCredentials: true }));

        const results = await Promise.allSettled(requests);

        if (results[0].status === 'fulfilled') {
            setSurveys(results[0].value.data?.data || []);
        } else {
            setSurveys([]);
            setSurveysError(
                results[0].reason?.response?.data?.message || 'Failed to load surveys'
            );
        }

        if (results[1].status === 'fulfilled') {
            setFeedback(results[1].value.data?.data || []);
        } else {
            setFeedback([]);
            setFeedbackError(
                results[1].reason?.response?.data?.message || 'Failed to load feedback'
            );
        }

        if (results[2].status === 'fulfilled') {
            setRecognitions(results[2].value.data?.data || []);
        } else {
            setRecognitions([]);
            setRecognitionError(
                results[2].reason?.response?.data?.message || 'Failed to load recognition'
            );
        }

        if (canViewAnalytics && results[3]) {
            if (results[3].status === 'fulfilled') {
                setAnalytics(results[3].value.data?.data || null);
            } else {
                setAnalytics(null);
                setAnalyticsError(
                    results[3].reason?.response?.data?.message || 'Failed to load analytics'
                );
            }
        }

        const settingsIdx = canViewAnalytics ? 4 : 3;
        if (results[settingsIdx]?.status === 'fulfilled') {
            setEngSettings(results[settingsIdx].value.data?.data || null);
        }

        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0 && failed === results.length) {
            toast.error('Failed to load engagement data');
        }

        setLoading(false);
    };

    const handleExport = async (type) => {
        const map = {
            feedback: {
                url: '/v1/admin/engagement/export/feedback',
                file: exportFilename('employee-feedback'),
            },
            suggestions: {
                url: '/v1/admin/engagement/export/suggestions',
                file: exportFilename('employee-suggestions'),
            },
            recognition: {
                url: '/v1/admin/engagement/export/recognition',
                file: exportFilename('employee-recognition'),
            },
            summary: {
                url: '/v1/admin/engagement/export/summary',
                file: exportFilename('employee-engagement-summary'),
            },
        };
        const cfg = map[type];
        if (!cfg) return;
        try {
            setExporting(type);
            await downloadEngagementExport(cfg.url, cfg.file);
            toast.success('Export downloaded');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Export failed');
        } finally {
            setExporting(null);
        }
    };

    const handleDeleteSurvey = async (survey) => {
        const hasResponses = (survey.responseCount || 0) > 0;
        const confirmed = window.confirm(
            hasResponses
                ? `Delete "${survey.title}"? This will permanently remove the survey and all responses.`
                : `Delete "${survey.title}"? This cannot be undone.`
        );
        if (!confirmed) return;
        try {
            await axios.delete(`/v1/admin/engagement/surveys/${survey._id}`, {
                withCredentials: true,
            });
            toast.success('Survey deleted');
            setSurveys((prev) => prev.filter((s) => s._id !== survey._id));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete survey');
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canViewAnalytics]);

    const stats = useMemo(() => {
        const active = surveys.filter((s) => s.status === 'Active').length;
        const totalResponses = surveys.reduce((sum, s) => sum + (Number(s.responseCount) || 0), 0);
        const openFeedback = feedback.filter(
            (f) => f.type !== 'Suggestion' && ['Open', 'In Review'].includes(f.status)
        ).length;
        return {
            totalSurveys: surveys.length,
            active,
            totalResponses,
            openFeedback,
            recognitionCount: recognitions.length,
            eNPS: analytics?.eNPSDetail?.available ? analytics.eNPS : '—',
            participation: analytics?.surveys?.participationRate
                ? `${Number(analytics.surveys.participationRate).toFixed(0)}%`
                : '—',
        };
    }, [surveys, feedback, recognitions, analytics]);

    const suggestions = useMemo(
        () => feedback.filter((f) => f.type === 'Suggestion'),
        [feedback]
    );
    const generalFeedback = useMemo(
        () => feedback.filter((f) => f.type !== 'Suggestion'),
        [feedback]
    );

    const draftSurveyCount = useMemo(
        () => surveys.filter((s) => s.status === 'Draft').length,
        [surveys]
    );

    const filteredSurveys = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || activeTab !== 'surveys') return surveys;
        return surveys.filter((s) =>
            [s.title, s.description, s.status, s.type]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [surveys, searchQuery, activeTab]);

    const filteredFeedback = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || activeTab !== 'feedback') return generalFeedback;
        return generalFeedback.filter((f) =>
            [f.subject, f.type, f.status, f.category, f.employeeId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [generalFeedback, searchQuery, activeTab]);

    const filteredSuggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || activeTab !== 'suggestions') return suggestions;
        return suggestions.filter((s) =>
            [s.subject, s.status, s.category, s.employeeId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [suggestions, searchQuery, activeTab]);

    const personName = (p) => `${p?.name || ''} ${p?.lastName || ''}`.trim() || 'Someone';

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
                    <p className="text-sm font-medium text-slate-600">Loading engagement data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
            <div className="page-shell-inner hrms-stack">
                <header className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaChartLine className="h-7 w-7" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    HR Workspace
                                </p>
                                <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                                    Employee Engagement
                                </h1>
                                <p className="mt-0.5 text-sm text-slate-500">
                                    Dashboard, insights, action plans, suggestions, recognition, and lifecycle
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <label className="relative block min-w-[240px] flex-1 sm:max-w-sm">
                                <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={
                                        activeTab === 'surveys'
                                            ? 'Search surveys...'
                                            : activeTab === 'suggestions'
                                              ? 'Search suggestions...'
                                              : 'Search feedback...'
                                    }
                                    className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-[#20C997] focus:bg-white focus:ring-2 focus:ring-[#20C997]/20"
                                />
                            </label>
                            {isManagerUser && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/engagement/create-survey')}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    <FaPlus className="h-5 w-5" />
                                    Create Survey
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
                    <KpiStat label="Total Surveys" value={stats.totalSurveys} icon={FaClipboardList} accent={MINT} />
                    <KpiStat label="Active" value={stats.active} icon={FaPoll} accent="#10b981" />
                    <KpiStat label="Survey Responses" value={stats.totalResponses} icon={FaInbox} accent={MINT_DARK} />
                    <KpiStat label="Open Feedback" value={stats.openFeedback} icon={FaComments} accent="#8b5cf6" />
                    <KpiStat label="Recognition" value={stats.recognitionCount} icon={FaAward} accent="#f59e0b" />
                    <KpiStat label="eNPS" value={stats.eNPS ?? '—'} icon={FaChartBar} accent="#0ea5e9" />
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        {[
                            ...(canViewAnalytics
                                ? [{ id: 'analytics', label: 'Dashboard', icon: FaChartBar, show: true }]
                                : []),
                            ...(isManagerUser
                                ? [{ id: 'insights', label: 'Insights', icon: FaStream, show: true }]
                                : []),
                            { id: 'surveys', label: `Surveys (${surveys.length})`, icon: FaClipboardList, show: engSettings?.features?.surveys !== false },
                            ...(isManagerUser && engSettings?.features?.pulse !== false ? [{ id: 'pulse', label: 'Pulse', icon: FaPoll, show: true }] : []),
                            { id: 'feedback', label: `Feedback (${generalFeedback.length})`, icon: FaComments, show: engSettings?.features?.feedback !== false },
                            { id: 'suggestions', label: `Suggestions (${suggestions.length})`, icon: FaLightbulb, show: engSettings?.features?.suggestions !== false },
                            { id: 'recognition', label: `Recognition (${recognitions.length})`, icon: FaAward, show: engSettings?.features?.recognition !== false },
                            ...(canViewTeamAnalytics
                                ? [{ id: 'team', label: 'My Team', icon: FaUsers, show: true }]
                                : []),
                            ...(isManagerUser
                                ? [
                                      { id: 'actions', label: 'Action Plans', icon: FaTasks, show: true },
                                      { id: 'lifecycle', label: 'Lifecycle', icon: FaUserClock, show: engSettings?.features?.surveys !== false },
                                      { id: 'settings', label: 'Settings', icon: FaCog, show: true },
                                  ]
                                : []),
                        ].filter((tab) => tab.show !== false).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                                    activeTab === tab.id
                                        ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <section className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                        <h2 className="text-lg font-semibold text-slate-900">
                            {activeTab === 'surveys' && `Surveys (${filteredSurveys.length})`}
                            {activeTab === 'pulse' && 'Employee Pulse'}
                            {activeTab === 'feedback' && `Feedback (${filteredFeedback.length})`}
                            {activeTab === 'suggestions' && `Suggestions (${filteredSuggestions.length})`}
                            {activeTab === 'recognition' && 'Recognition Wall'}
                            {activeTab === 'team' && 'Team Engagement'}
                            {activeTab === 'analytics' && 'Engagement Dashboard'}
                            {activeTab === 'insights' && 'Closed-Loop Insights'}
                            {activeTab === 'actions' && 'Action Plans'}
                            {activeTab === 'lifecycle' && 'Lifecycle Engagement'}
                            {activeTab === 'settings' && 'Engagement Settings'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'surveys' && 'Pulse checks, annual surveys, and custom forms'}
                            {activeTab === 'pulse' && 'Recurring pulse survey programs'}
                            {activeTab === 'feedback' && 'Complaints, questions, and support requests'}
                            {activeTab === 'suggestions' && 'Employee ideas with full review workflow'}
                            {activeTab === 'recognition' && 'Approved public peer and HR recognition'}
                            {activeTab === 'team' && 'Engagement for your direct reports only. Anonymous identities are never shown.'}
                            {activeTab === 'analytics' &&
                                'Organization engagement health, closed-loop actions, lifecycle participation, and trends.'}
                            {activeTab === 'insights' &&
                                'Insight identified → action plan → owner → due date → completion — privacy-safe.'}
                            {activeTab === 'actions' && 'Convert engagement insights into assigned follow-up.'}
                            {activeTab === 'lifecycle' &&
                                'Automated Day 7 / 30 / 90 and Exit surveys using the existing Survey engine.'}
                            {activeTab === 'settings' && 'Organization-wide Engagement configuration.'}
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        {activeTab === 'surveys' && (
                            <>
                            <DraftAwaitingBanner count={draftSurveyCount} entityLabel="survey" />
                            {surveysError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                    <p className="text-sm text-red-800">{surveysError}</p>
                                    <button
                                        type="button"
                                        onClick={fetchAll}
                                        className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : filteredSurveys.length === 0 ? (
                                <div className="py-16 text-center">
                                    <h3 className="text-lg font-semibold text-slate-900">No surveys found</h3>
                                    {isManagerUser && !searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/engagement/create-survey')}
                                            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
                                            style={{ background: MINT_GRADIENT }}
                                        >
                                            <FaPlus className="h-4 w-4" />
                                            Create Survey
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredSurveys.map((survey) => (
                                        <article
                                            key={survey._id}
                                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 transition hover:border-[#20C997]/30 hover:shadow-md"
                                        >
                                            <div className="flex-1 border-b border-slate-100 bg-white p-5">
                                                <h3 className="truncate text-lg font-semibold text-slate-900">
                                                    {survey.title}
                                                </h3>
                                                {survey.type && (
                                                    <p className="text-xs text-slate-500">{survey.type}</p>
                                                )}
                                                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                                                    {survey.description || 'No description provided.'}
                                                </p>
                                                <div className="mt-4 flex items-center justify-between gap-2">
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${surveyStatusStyle(survey.status)}`}
                                                    >
                                                        {survey.status || 'Draft'}
                                                    </span>
                                                    <span className="text-sm text-slate-500">
                                                        {survey.responseCount || 0} responses
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 p-4">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate(`/engagement/surveys/${survey._id}`)
                                                    }
                                                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                                                    style={{ background: MINT_GRADIENT }}
                                                >
                                                    View Survey
                                                </button>
                                                {isManagerUser && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSurvey(survey)}
                                                        className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 text-red-600 hover:bg-red-50"
                                                        title="Delete survey"
                                                    >
                                                        <FaTrash className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                            </>
                        )}

                        {activeTab === 'pulse' && <PulsePrograms />}

                        {activeTab === 'feedback' && (
                            <>
                            {isManagerUser && (
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={exporting === 'feedback'}
                                        onClick={() => handleExport('feedback')}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                    >
                                        <FaDownload className="h-3 w-3" />
                                        {exporting === 'feedback' ? 'Exporting...' : 'Export CSV'}
                                    </button>
                                </div>
                            )}
                            {feedbackError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                    <p className="text-sm text-red-800">{feedbackError}</p>
                                    <button type="button" onClick={fetchAll} className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700">Retry</button>
                                </div>
                            ) : (
                            <FeedbackPanel
                                feedback={generalFeedback}
                                filteredFeedback={filteredFeedback}
                                isManagerUser={isManagerUser}
                                canSubmitFeedback={canSubmitFeedback}
                                searchQuery={searchQuery}
                                onRefresh={fetchAll}
                            />
                            )}
                            </>
                        )}

                        {activeTab === 'suggestions' && (
                            <>
                            {isManagerUser && (
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={exporting === 'suggestions'}
                                        onClick={() => handleExport('suggestions')}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                    >
                                        <FaDownload className="h-3 w-3" />
                                        {exporting === 'suggestions' ? 'Exporting...' : 'Export CSV'}
                                    </button>
                                </div>
                            )}
                            {feedbackError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                    <p className="text-sm text-red-800">{feedbackError}</p>
                                    <button type="button" onClick={fetchAll} className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700">Retry</button>
                                </div>
                            ) : (
                            <SuggestionsPanel
                                suggestions={suggestions}
                                filteredSuggestions={filteredSuggestions}
                                isManagerUser={isManagerUser}
                                onRefresh={fetchAll}
                            />
                            )}
                            </>
                        )}

                        {activeTab === 'recognition' && (
                            <>
                            {isManagerUser && (
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={exporting === 'recognition'}
                                        onClick={() => handleExport('recognition')}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                    >
                                        <FaDownload className="h-3 w-3" />
                                        {exporting === 'recognition' ? 'Exporting...' : 'Export CSV'}
                                    </button>
                                </div>
                            )}
                            {recognitionError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                    <p className="text-sm text-red-800">{recognitionError}</p>
                                    <button type="button" onClick={fetchAll} className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700">Retry</button>
                                </div>
                            ) : (
                            <RecognitionPanel
                                isManagerUser={isManagerUser}
                                onRefresh={fetchAll}
                            />
                            )}
                            </>
                        )}

                        {activeTab === 'analytics' && canViewAnalytics && (
                            <>
                            {isManagerUser && (
                                <div className="mb-4 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={exporting === 'summary'}
                                        onClick={() => handleExport('summary')}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                    >
                                        <FaDownload className="h-3 w-3" />
                                        {exporting === 'summary' ? 'Exporting...' : 'Export Summary CSV'}
                                    </button>
                                </div>
                            )}
                            {analyticsError ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                    <p className="text-sm text-red-800">{analyticsError}</p>
                                    <button type="button" onClick={fetchAll} className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700">Retry</button>
                                </div>
                            ) : (
                            <EngagementDashboard onNavigateTab={setActiveTab} />
                            )}
                            </>
                        )}

                        {activeTab === 'team' && canViewTeamAnalytics && (
                            <TeamEngagementPanel onNavigateTab={setActiveTab} />
                        )}

                        {activeTab === 'insights' && isManagerUser && (
                            <ClosedLoopInsightsPanel onNavigateTab={setActiveTab} />
                        )}

                        {activeTab === 'actions' && isManagerUser && (
                            <ActionPlansPanel canCreate={isManagerUser} />
                        )}

                        {activeTab === 'lifecycle' && isManagerUser && (
                            <LifecycleEngagementPanel />
                        )}

                        {activeTab === 'settings' && isManagerUser && (
                            <EngagementSettingsPanel />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default EngagementPage;
