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
    FaTrash,
    FaStream,
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

const MINT = '#0E9370';
const MINT_DARK = '#0d9488';

/** Map legacy tab ids (and new section ids) → { section, sub } for deep links. */
const resolveEngagementNav = (rawTab, rawSub) => {
    const tab = String(rawTab || '').trim() || 'dashboard';
    const sub = rawSub != null && String(rawSub).trim() ? String(rawSub).trim() : null;
    const legacy = {
        analytics: { section: 'dashboard', sub: 'overview' },
        insights: { section: 'dashboard', sub: 'insights' },
        dashboard: { section: 'dashboard', sub: sub || 'overview' },
        surveys: { section: 'surveys', sub: sub === 'pulse' ? 'pulse' : 'surveys' },
        pulse: { section: 'surveys', sub: 'pulse' },
        feedback: { section: 'feedback', sub: sub === 'suggestions' ? 'suggestions' : 'feedback' },
        suggestions: { section: 'feedback', sub: 'suggestions' },
        recognition: { section: 'recognition', sub: null },
        actions: { section: 'actions', sub: null },
        settings: { section: 'settings', sub: null },
        // Kept for deep links only — not shown in main nav
        lifecycle: { section: 'lifecycle', sub: null },
        team: { section: 'team', sub: null },
    };
    if (legacy[tab]) {
        const mapped = legacy[tab];
        if (sub && ['dashboard', 'surveys', 'feedback'].includes(mapped.section)) {
            return { section: mapped.section, sub };
        }
        return mapped;
    }
    return { section: 'dashboard', sub: 'overview' };
};

const SubTabBar = ({ tabs, active, onChange, trailing = null }) => {
    if (!tabs?.length && !trailing) return null;
    return (
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex flex-wrap gap-2">
                {tabs?.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
                            active === tab.id
                                ? 'bg-[#0E9370] text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {tab.icon ? <tab.icon className="h-3.5 w-3.5 shrink-0" /> : null}
                        <span className="truncate">{tab.label}</span>
                    </button>
                ))}
            </div>
            {trailing ? <div className="shrink-0 sm:ml-auto">{trailing}</div> : null}
        </div>
    );
};

const KpiStat = ({ label, value, icon: Icon, accent = MINT, subtext, muted = false }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-2">
            <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl"
                style={{ backgroundColor: `${accent}18`, color: accent }}
            >
                <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            </div>
        </div>
        <p
            className={`mt-2 truncate font-bold tabular-nums sm:mt-3 ${
                muted ? 'text-lg text-slate-400 sm:text-xl' : 'text-xl text-slate-900 sm:text-2xl'
            }`}
        >
            {value}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs sm:leading-normal">
            {label}
        </p>
        {subtext && <p className="mt-1 text-xs leading-snug text-slate-500">{subtext}</p>}
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
    const initialNav = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return resolveEngagementNav(
            location.state?.tab || params.get('tab'),
            location.state?.sub || params.get('sub')
        );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial deep link only
    const [activeSection, setActiveSection] = useState(initialNav.section);
    const [activeSub, setActiveSub] = useState(initialNav.sub);
    const [searchQuery, setSearchQuery] = useState('');
    const [surveysError, setSurveysError] = useState(null);
    const [feedbackError, setFeedbackError] = useState(null);
    const [recognitionError, setRecognitionError] = useState(null);
    const [analyticsError, setAnalyticsError] = useState(null);
    const [exporting, setExporting] = useState(null);

    const goToNav = (section, sub = null) => {
        setActiveSection(section);
        setActiveSub(sub);
    };

    /** Supports legacy tab ids from dashboards / pulse create / deep links. */
    const onNavigateTab = (tabId) => {
        const mapped = resolveEngagementNav(tabId, null);
        goToNav(mapped.section, mapped.sub);
    };

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
        if (activeSection === 'team' && !canViewTeamAnalytics) {
            goToNav(canViewAnalytics ? 'dashboard' : 'surveys', canViewAnalytics ? 'overview' : 'surveys');
        }
    }, [activeSection, canViewTeamAnalytics, canViewAnalytics]);

    useEffect(() => {
        if (activeSection === 'dashboard' && !canViewAnalytics) {
            goToNav('surveys', 'surveys');
        }
    }, [activeSection, canViewAnalytics]);

    useEffect(() => {
        if (activeSection === 'dashboard' && !activeSub) setActiveSub('overview');
        if (activeSection === 'surveys' && !activeSub) setActiveSub('surveys');
        if (activeSection === 'feedback' && !activeSub) setActiveSub('feedback');
    }, [activeSection, activeSub]);

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
                url: '/v1/both/engagement/export/summary',
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
            toast.error(error.response?.data?.message || error.message || 'Export failed');
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
        if (!q || !(activeSection === 'surveys' && activeSub === 'surveys')) return surveys;
        return surveys.filter((s) =>
            [s.title, s.description, s.status, s.type]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [surveys, searchQuery, activeSection, activeSub]);

    const filteredFeedback = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || !(activeSection === 'feedback' && activeSub === 'feedback')) return generalFeedback;
        return generalFeedback.filter((f) =>
            [f.subject, f.type, f.status, f.category, f.employeeId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [generalFeedback, searchQuery, activeSection, activeSub]);

    const filteredSuggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q || !(activeSection === 'feedback' && activeSub === 'suggestions')) return suggestions;
        return suggestions.filter((s) =>
            [s.subject, s.status, s.category, s.employeeId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [suggestions, searchQuery, activeSection, activeSub]);

    const mainNavItems = useMemo(() => {
        const surveysEnabled = engSettings?.features?.surveys !== false;
        const pulseEnabled = isManagerUser && engSettings?.features?.pulse !== false;
        const feedbackEnabled = engSettings?.features?.feedback !== false;
        const suggestionsEnabled = engSettings?.features?.suggestions !== false;
        const recognitionEnabled = engSettings?.features?.recognition !== false;

        return [
            ...(canViewAnalytics
                ? [{ id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: FaChartBar, defaultSub: 'overview' }]
                : []),
            ...((surveysEnabled || pulseEnabled)
                ? [{
                    id: 'surveys',
                    label: `Surveys (${surveys.length})`,
                    shortLabel: `Surveys (${surveys.length})`,
                    icon: FaClipboardList,
                    defaultSub: surveysEnabled ? 'surveys' : 'pulse',
                }]
                : []),
            ...((feedbackEnabled || suggestionsEnabled)
                ? [{
                    id: 'feedback',
                    label: `Feedback (${generalFeedback.length})`,
                    shortLabel: `Feedback (${generalFeedback.length})`,
                    icon: FaComments,
                    defaultSub: feedbackEnabled ? 'feedback' : 'suggestions',
                }]
                : []),
            ...(recognitionEnabled
                ? [{
                    id: 'recognition',
                    label: `Recognition (${recognitions.length})`,
                    shortLabel: `Recognition (${recognitions.length})`,
                    icon: FaAward,
                    defaultSub: null,
                }]
                : []),
            ...(isManagerUser
                ? [
                    { id: 'actions', label: 'Action Plans', shortLabel: 'Actions', icon: FaTasks, defaultSub: null },
                    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: FaCog, defaultSub: null },
                ]
                : []),
        ];
    }, [
        canViewAnalytics,
        engSettings,
        isManagerUser,
        surveys.length,
        generalFeedback.length,
        suggestions.length,
        recognitions.length,
    ]);

    const dashboardSubTabs = useMemo(() => {
        const tabs = [{ id: 'overview', label: 'Overview', icon: FaChartBar }];
        if (isManagerUser) tabs.push({ id: 'insights', label: 'Insights', icon: FaStream });
        return tabs;
    }, [isManagerUser]);

    const surveysSubTabs = useMemo(() => {
        const tabs = [];
        if (engSettings?.features?.surveys !== false) {
            tabs.push({ id: 'surveys', label: `Surveys (${surveys.length})`, icon: FaClipboardList });
        }
        if (isManagerUser && engSettings?.features?.pulse !== false) {
            tabs.push({ id: 'pulse', label: 'Pulse Programs', icon: FaPoll });
        }
        return tabs;
    }, [engSettings, isManagerUser, surveys.length]);

    const feedbackSubTabs = useMemo(() => {
        const tabs = [];
        if (engSettings?.features?.feedback !== false) {
            tabs.push({ id: 'feedback', label: `Feedback (${generalFeedback.length})`, icon: FaComments });
        }
        if (engSettings?.features?.suggestions !== false) {
            tabs.push({ id: 'suggestions', label: `Suggestions (${suggestions.length})`, icon: FaLightbulb });
        }
        return tabs;
    }, [engSettings, generalFeedback.length, suggestions.length]);

    const showSearch =
        (activeSection === 'surveys' && activeSub === 'surveys') ||
        (activeSection === 'feedback' && (activeSub === 'feedback' || activeSub === 'suggestions'));

    const sectionTitle = (() => {
        if (activeSection === 'dashboard' && activeSub === 'insights') return 'Insights';
        if (activeSection === 'dashboard') return 'Overview';
        if (activeSection === 'surveys' && activeSub === 'pulse') return 'Pulse Programs';
        if (activeSection === 'surveys') return `Surveys (${filteredSurveys.length})`;
        if (activeSection === 'feedback' && activeSub === 'suggestions') {
            return `Suggestions (${filteredSuggestions.length})`;
        }
        if (activeSection === 'feedback') return `Feedback (${filteredFeedback.length})`;
        if (activeSection === 'recognition') return 'Recognition';
        if (activeSection === 'actions') return 'Action Plans';
        if (activeSection === 'settings') return 'Settings';
        if (activeSection === 'lifecycle') return 'Lifecycle';
        if (activeSection === 'team') return 'My Team';
        return 'Employee Engagement';
    })();

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-transparent">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]" />
                    <p className="text-sm font-medium text-slate-600">Loading engagement data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="engagement-page page-shell min-h-[calc(100vh-64px)] overflow-x-visible bg-transparent">
            <div className="page-shell-inner hrms-stack min-w-0">
                <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md sm:h-14 sm:w-14 sm:rounded-2xl"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaChartLine className="h-5 w-5 sm:h-7 sm:w-7" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
                                    HR Workspace
                                </p>
                                <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">
                                    Employee Engagement
                                </h1>
                                <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
                                    Surveys, feedback, recognition, and action plans
                                </p>
                            </div>
                        </div>
                        {isManagerUser && (
                            <button
                                type="button"
                                onClick={() => navigate('/engagement/create-survey')}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 sm:h-11 sm:w-auto sm:px-6 lg:w-auto"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                                Create Survey
                            </button>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
                    <KpiStat label="Total Surveys" value={stats.totalSurveys} icon={FaClipboardList} accent={MINT} />
                    <KpiStat label="Active" value={stats.active} icon={FaPoll} accent="#10b981" />
                    <KpiStat label="Survey Responses" value={stats.totalResponses} icon={FaInbox} accent={MINT_DARK} />
                    <KpiStat label="Open Feedback" value={stats.openFeedback} icon={FaComments} accent="#8b5cf6" />
                    <KpiStat label="Recognition" value={stats.recognitionCount} icon={FaAward} accent="#f59e0b" />
                    <KpiStat label="eNPS" value={stats.eNPS ?? '—'} icon={FaChartBar} accent="#0ea5e9" />
                </div>

                <nav
                    aria-label="Engagement sections"
                    className="min-w-0 overflow-visible rounded-2xl border border-slate-100 bg-white p-2 shadow-sm sm:p-2.5"
                >
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {mainNavItems.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => goToNav(tab.id, tab.defaultSub)}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                                    activeSection === tab.id
                                        ? 'bg-[#0E9370]/10 text-[#0d9488] ring-1 ring-[#0E9370]/30'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <tab.icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                                <span className="whitespace-nowrap sm:hidden">{tab.shortLabel || tab.label}</span>
                                <span className="hidden whitespace-nowrap sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm sm:rounded-[28px]">
                    <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4 md:px-6">
                        <h2 className="min-w-0 truncate text-base font-semibold text-slate-900 sm:text-lg">
                            {sectionTitle}
                        </h2>
                        {showSearch && (
                            <label className="relative block w-full sm:max-w-xs sm:flex-1">
                                <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={
                                        activeSection === 'surveys'
                                            ? 'Search surveys...'
                                            : activeSub === 'suggestions'
                                              ? 'Search suggestions...'
                                              : 'Search feedback...'
                                    }
                                    className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#0E9370] focus:bg-white focus:ring-2 focus:ring-[#0E9370]/20 sm:h-10"
                                />
                            </label>
                        )}
                    </div>

                    <div className="p-4 sm:p-5 md:p-6">
                        {activeSection === 'dashboard' && canViewAnalytics && (
                            <>
                                <SubTabBar
                                    tabs={dashboardSubTabs}
                                    active={activeSub || 'overview'}
                                    onChange={(id) => setActiveSub(id)}
                                    trailing={
                                        activeSub !== 'insights' && canViewAnalytics ? (
                                            <button
                                                type="button"
                                                disabled={exporting === 'summary'}
                                                onClick={() => handleExport('summary')}
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                                            >
                                                <FaDownload className="h-3 w-3" />
                                                {exporting === 'summary' ? 'Exporting...' : 'Export Summary CSV'}
                                            </button>
                                        ) : null
                                    }
                                />
                                {activeSub === 'insights' && isManagerUser ? (
                                    <ClosedLoopInsightsPanel onNavigateTab={onNavigateTab} />
                                ) : analyticsError ? (
                                            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                                                <p className="text-sm text-red-800">{analyticsError}</p>
                                                <button type="button" onClick={fetchAll} className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700">Retry</button>
                                            </div>
                                        ) : (
                                            <EngagementDashboard onNavigateTab={onNavigateTab} />
                                        )}
                            </>
                        )}

                        {activeSection === 'surveys' && (
                            <>
                                <SubTabBar
                                    tabs={surveysSubTabs}
                                    active={activeSub || 'surveys'}
                                    onChange={(id) => setActiveSub(id)}
                                />
                                {activeSub === 'pulse' ? (
                                    <PulsePrograms />
                                ) : (
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
                                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 transition hover:border-[#0E9370]/30 hover:shadow-md"
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
                            </>
                        )}

                        {activeSection === 'feedback' && (
                            <>
                                <SubTabBar
                                    tabs={feedbackSubTabs}
                                    active={activeSub || 'feedback'}
                                    onChange={(id) => setActiveSub(id)}
                                />
                                {activeSub === 'suggestions' ? (
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
                                ) : (
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
                            </>
                        )}

                        {activeSection === 'recognition' && (
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

                        {activeSection === 'actions' && isManagerUser && (
                            <ActionPlansPanel canCreate={isManagerUser} />
                        )}

                        {activeSection === 'settings' && isManagerUser && (
                            <EngagementSettingsPanel />
                        )}

                        {/* Deep-link only — removed from main nav */}
                        {activeSection === 'team' && canViewTeamAnalytics && (
                            <TeamEngagementPanel onNavigateTab={onNavigateTab} />
                        )}

                        {activeSection === 'lifecycle' && isManagerUser && (
                            <LifecycleEngagementPanel />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default EngagementPage;
