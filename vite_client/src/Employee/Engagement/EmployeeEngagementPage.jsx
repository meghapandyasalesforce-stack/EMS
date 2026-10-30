import '../../styles/surveyUI.css';
import '../../styles/employeeEngagement.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    FaBell,
    FaClipboardList,
    FaComments,
    FaAward,
    FaPlus,
    FaTimes,
    FaHeart,
    FaChevronRight,
    FaSearch,
    FaEye,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../../HR/Reports/constants';
import { feedbackStatusStyle, surveyStatusStyle, RECOGNITION_CATEGORIES, recognitionStatusStyle, formatRecognitionRecipientLabel } from '../../HR/Engagement/engagementUtils';

const MINT = '#20C997';
const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20';

const ActionCard = ({ label, count, icon: Icon, accent, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group w-full rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-left transition hover:border-[#20C997]/30 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#20C997]/25 sm:rounded-2xl sm:p-4"
    >
        <div className="flex items-start justify-between gap-2">
            <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl"
                style={{ backgroundColor: `${accent}18`, color: accent }}
            >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <FaChevronRight className="mt-1 hidden h-3 w-3 shrink-0 text-slate-300 transition group-hover:text-[#20C997] sm:block" />
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 sm:mt-3 sm:text-2xl">{count}</p>
        <p className="mt-0.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            {label}
        </p>
    </button>
);

const RECOGNITION_TYPES = RECOGNITION_CATEGORIES;

const EmployeeEngagementPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('surveys');
    const [feedbackSub, setFeedbackSub] = useState('feedback');
    const [loading, setLoading] = useState(true);
    const [surveys, setSurveys] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [wall, setWall] = useState([]);
    const [received, setReceived] = useState([]);
    const [given, setGiven] = useState([]);
    const [recognitionSubTab, setRecognitionSubTab] = useState('wall');
    const [recognitionDetail, setRecognitionDetail] = useState(null);
    const [loadingRecognitionDetail, setLoadingRecognitionDetail] = useState(false);
    const [employees, setEmployees] = useState([]);

    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [suggestionOpen, setSuggestionOpen] = useState(false);
    const [suggestionDetail, setSuggestionDetail] = useState(null);
    const [loadingSuggestionDetail, setLoadingSuggestionDetail] = useState(false);
    const [feedbackDetail, setFeedbackDetail] = useState(null);
    const [loadingFeedbackDetail, setLoadingFeedbackDetail] = useState(false);
    const [recognitionOpen, setRecognitionOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [feedbackForm, setFeedbackForm] = useState({
        subject: '',
        message: '',
        type: 'Question',
        category: 'Other',
        anonymous: false,
    });
    const [suggestionForm, setSuggestionForm] = useState({
        subject: '',
        message: '',
        category: 'Other',
        anonymous: false,
    });
    const [recognitionForm, setRecognitionForm] = useState({
        recipientId: '',
        type: 'Teamwork',
        title: '',
        description: '',
        isPublic: true,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [surveyDeepLinkHandled, setSurveyDeepLinkHandled] = useState('');
    const [activity, setActivity] = useState([]);
    const [celebrations, setCelebrations] = useState([]);
    const [engSettings, setEngSettings] = useState(null);

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            const results = await Promise.allSettled([
                axios.get('/v1/both/engagement/my-surveys', { withCredentials: true }),
                axios.get('/v1/both/engagement/feedback?limit=100', { withCredentials: true }),
                axios.get('/v1/both/engagement/feedback?type=Suggestion&limit=100', { withCredentials: true }),
                axios.get('/v1/both/engagement/recognition?limit=50', { withCredentials: true }),
                axios.get('/v1/both/engagement/recognition?mine=received&limit=50', { withCredentials: true }),
                axios.get('/v1/both/engagement/recognition?mine=given&limit=50', { withCredentials: true }),
                axios.get('/v1/both/engagement/activity', { withCredentials: true }),
                axios.get('/v1/both/engagement/celebrations', { withCredentials: true }),
                axios.get('/v1/both/engagement/settings', { withCredentials: true }),
            ]);

            const valueOf = (i) =>
                results[i].status === 'fulfilled' ? results[i].value.data?.data || [] : [];

            let surveysData = valueOf(0);
            if (results[0].status === 'rejected') {
                try {
                    const fallback = await axios.get('/v1/both/engagement/surveys?limit=500', {
                        withCredentials: true,
                    });
                    surveysData = fallback.data?.data || [];
                } catch {
                    surveysData = [];
                    toast.error(
                        results[0].reason?.response?.data?.message || 'Failed to load surveys'
                    );
                }
            }

            setSurveys(surveysData);
            const allFb = valueOf(1);
            setFeedback(allFb.filter((f) => f.type !== 'Suggestion'));
            setSuggestions(valueOf(2));
            setWall(valueOf(3));
            setReceived(valueOf(4));
            setGiven(valueOf(5));
            setActivity(valueOf(6));
            setCelebrations(valueOf(7));
            if (results[8]?.status === 'fulfilled') {
                setEngSettings(results[8].value.data?.data || null);
            }

            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0 && results[0].status === 'fulfilled') {
                toast.error('Some engagement data failed to load');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load engagement data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const openSuggestionDetail = useCallback(async (id) => {
        if (!id) return;
        setActiveTab('feedback');
        setFeedbackSub('suggestions');
        setLoadingSuggestionDetail(true);
        try {
            const { data } = await axios.get(`/v1/both/engagement/feedback/${id}`, {
                withCredentials: true,
            });
            setSuggestionDetail(data?.data || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load suggestion');
            setSuggestionDetail(null);
        } finally {
            setLoadingSuggestionDetail(false);
        }
    }, []);

    const openFeedbackDetail = useCallback(async (id) => {
        if (!id) return;
        setActiveTab('feedback');
        setFeedbackSub('feedback');
        setLoadingFeedbackDetail(true);
        try {
            const { data } = await axios.get(`/v1/both/engagement/feedback/${id}`, {
                withCredentials: true,
            });
            setFeedbackDetail(data?.data || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load feedback');
            setFeedbackDetail(null);
        } finally {
            setLoadingFeedbackDetail(false);
        }
    }, []);

    const closeFeedbackDetail = () => setFeedbackDetail(null);

    useEffect(() => {
        const suggestionId = searchParams.get('suggestion');
        if (suggestionId) {
            openSuggestionDetail(suggestionId);
        }
        const tab = searchParams.get('tab');
        if (tab === 'suggestions') {
            setActiveTab('feedback');
            setFeedbackSub('suggestions');
        } else if (tab === 'feedback' || tab === 'surveys' || tab === 'recognition') {
            setActiveTab(tab);
        }
    }, [searchParams, openSuggestionDetail]);

    const closeSuggestionDetail = () => {
        setSuggestionDetail(null);
        if (searchParams.get('suggestion')) {
            const next = new URLSearchParams(searchParams);
            next.delete('suggestion');
            setSearchParams(next, { replace: true });
        }
    };

    const openRecognitionDetail = useCallback(async (id) => {
        if (!id) return;
        setActiveTab('recognition');
        setLoadingRecognitionDetail(true);
        try {
            const { data } = await axios.get(`/v1/both/engagement/recognition/${id}`, {
                withCredentials: true,
            });
            setRecognitionDetail(data?.data || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load recognition');
            setRecognitionDetail(null);
        } finally {
            setLoadingRecognitionDetail(false);
        }
    }, []);

    useEffect(() => {
        const recognitionId = searchParams.get('recognition');
        if (recognitionId) {
            openRecognitionDetail(recognitionId);
        }
    }, [searchParams, openRecognitionDetail]);

    const handleSurveyDeepLink = useCallback(async () => {
        const surveyId = searchParams.get('survey');
        if (!surveyId || loading || surveyDeepLinkHandled === surveyId) return;

        setActiveTab('surveys');
        const found = surveys.find((s) => String(s._id) === surveyId);

        const clearSurveyParam = () => {
            const next = new URLSearchParams(searchParams);
            next.delete('survey');
            setSearchParams(next, { replace: true });
            setSurveyDeepLinkHandled(surveyId);
        };

        if (found) {
            if (found.canRespond) {
                navigate(`/employee/engagement/surveys/${surveyId}`);
            } else if (found.completionState === 'completed') {
                toast.info('You have already completed this survey.');
            } else if (found.status === 'Closed') {
                toast.info('This survey has closed.');
            } else {
                toast.info('This survey is not currently available.');
            }
            clearSurveyParam();
            return;
        }

        try {
            const { data } = await axios.get(`/v1/both/engagement/surveys/${surveyId}`, {
                withCredentials: true,
            });
            const survey = data?.data;
            if (!survey) {
                toast.error('Survey not found');
                clearSurveyParam();
                return;
            }
            const now = Date.now();
            const startOk = !survey.startDate || new Date(survey.startDate).getTime() <= now;
            const endOk = !survey.endDate || new Date(survey.endDate).getTime() >= now;
            if (survey.status === 'Active' && startOk && endOk) {
                navigate(`/employee/engagement/surveys/${surveyId}`);
            } else if (survey.status === 'Closed' || !endOk) {
                toast.info('This survey has expired or closed.');
            } else {
                toast.info('This survey is not available yet.');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Survey not available');
        } finally {
            clearSurveyParam();
        }
    }, [searchParams, loading, surveys, surveyDeepLinkHandled, navigate, setSearchParams]);

    useEffect(() => {
        handleSurveyDeepLink();
    }, [handleSurveyDeepLink]);

    const filteredSurveys = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return surveys;
        return surveys.filter((s) =>
            [s.title, s.description, s.type, s.status]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [surveys, searchQuery]);

    const filteredFeedback = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return feedback;
        return feedback.filter((f) =>
            [f.subject, f.type, f.status, f.category]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [feedback, searchQuery]);

    const filteredSuggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return suggestions;
        return suggestions.filter((s) =>
            [s.subject, s.status, s.category]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [suggestions, searchQuery]);

    const filteredWall = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return wall;
        return wall.filter((r) =>
            [r.title, r.type, r.description, r.recipientId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [wall, searchQuery]);

    const filteredReceived = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return received;
        return received.filter((r) =>
            [r.title, r.type, r.description, r.givenBy?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [received, searchQuery]);

    const filteredGiven = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return given;
        return given.filter((r) =>
            [r.title, r.type, r.description, r.recipientId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [given, searchQuery]);

    const closeRecognitionDetail = () => {
        setRecognitionDetail(null);
        if (searchParams.get('recognition')) {
            const next = new URLSearchParams(searchParams);
            next.delete('recognition');
            setSearchParams(next, { replace: true });
        }
    };

    useEffect(() => {
        const loadEmployees = async () => {
            try {
                const res = await axios.get('/v1/employee/auth/get-all-employees', {
                    params: { limit: 500 },
                    withCredentials: true,
                });
                const list = res.data?.data || res.data?.employees || [];
                setEmployees(Array.isArray(list) ? list : []);
            } catch {
                try {
                    const res = await axios.get('/v1/employee', {
                        params: { limit: 500 },
                        withCredentials: true,
                    });
                    setEmployees(res.data?.data || []);
                } catch {
                    setEmployees([]);
                }
            }
        };
        loadEmployees();
    }, []);

    const pendingSurveys = useMemo(
        () => surveys.filter((s) => s.completionState === 'pending' || s.canRespond),
        [surveys]
    );

    const submitFeedback = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await axios.post('/v1/both/engagement/feedback', feedbackForm, { withCredentials: true });
            toast.success('Feedback submitted');
            setFeedbackOpen(false);
            setFeedbackForm({ subject: '', message: '', type: 'Question', category: 'Other', anonymous: false });
            await loadAll();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const submitSuggestion = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await axios.post(
                '/v1/both/engagement/feedback',
                { ...suggestionForm, type: 'Suggestion' },
                { withCredentials: true }
            );
            toast.success('Suggestion submitted');
            setSuggestionOpen(false);
            setSuggestionForm({ subject: '', message: '', category: 'Other', anonymous: false });
            await loadAll();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit suggestion');
        } finally {
            setSubmitting(false);
        }
    };

    const submitRecognition = async (e) => {
        e.preventDefault();
        if (!recognitionForm.recipientId || !recognitionForm.title.trim()) {
            toast.error('Select a colleague and enter a title');
            return;
        }
        try {
            setSubmitting(true);
            const { data } = await axios.post('/v1/both/engagement/recognition', recognitionForm, {
                withCredentials: true,
            });
            toast.success(data?.message || 'Recognition submitted');
            setRecognitionOpen(false);
            setRecognitionForm({
                recipientId: '',
                type: 'Teamwork',
                title: '',
                description: '',
                isPublic: true,
            });
            await loadAll();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send recognition');
        } finally {
            setSubmitting(false);
        }
    };

    const react = async (id, emoji) => {
        try {
            await axios.post(
                `/v1/both/engagement/recognition/${id}/react`,
                { emoji },
                { withCredentials: true }
            );
            await loadAll();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to react');
        }
    };

    const personName = (p) => {
        if (!p) return 'Someone';
        return `${p.name || ''} ${p.lastName || ''}`.trim() || 'Someone';
    };

    const reactionCounts = (reactions = []) =>
        reactions.reduce((acc, r) => {
            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
            return acc;
        }, {});

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
                    <p className="text-sm font-medium text-slate-600">Loading engagement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="employee-engagement engagement-page page-shell min-h-[calc(100vh-64px)] overflow-x-visible bg-[#F5F7FB]">
            <div className="page-shell-inner hrms-stack min-w-0">
                <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5 md:p-6">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md sm:h-14 sm:w-14 sm:rounded-2xl"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaBell className="h-5 w-5 sm:h-7 sm:w-7" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-xs">
                                My Workspace
                            </p>
                            <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl md:text-3xl">
                                My Engagement
                            </h1>
                        </div>
                    </div>
                </header>
                    <div className="employee-engagement-summary grid grid-cols-3 gap-2 sm:gap-3">
                        <ActionCard
                            label="Surveys"
                            count={pendingSurveys.length}
                            icon={FaClipboardList}
                            accent={MINT}
                            onClick={() => setActiveTab('surveys')}
                        />
                        <ActionCard
                            label="Feedback"
                            count={feedback.length + suggestions.length}
                            icon={FaComments}
                            accent="#8b5cf6"
                            onClick={() => {
                                setActiveTab('feedback');
                                setFeedbackSub('feedback');
                            }}
                        />
                        <ActionCard
                            label="Recognition"
                            count={received.length}
                            icon={FaAward}
                            accent="#f59e0b"
                            onClick={() => {
                                setActiveTab('recognition');
                                setRecognitionSubTab('received');
                            }}
                        />
                    </div>

                <nav
                    aria-label="Engagement sections"
                    className="min-w-0 overflow-visible rounded-2xl border border-slate-100 bg-white p-2 shadow-sm sm:p-2.5"
                >
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {[
                            {
                                id: 'surveys',
                                label: 'Surveys',
                                icon: FaClipboardList,
                                show:
                                    engSettings?.features?.surveys !== false ||
                                    engSettings?.features?.pulse !== false,
                            },
                            {
                                id: 'feedback',
                                label: 'Feedback',
                                icon: FaComments,
                                show:
                                    engSettings?.features?.feedback !== false ||
                                    engSettings?.features?.suggestions !== false,
                            },
                            {
                                id: 'recognition',
                                label: 'Recognition',
                                icon: FaAward,
                                show: engSettings?.features?.recognition !== false,
                            },
                        ]
                            .filter((tab) => tab.show !== false)
                            .map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    aria-pressed={activeTab === tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        if (tab.id === 'feedback') setFeedbackSub('feedback');
                                    }}
                                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                                        activeTab === tab.id
                                            ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <tab.icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                                    <span className="whitespace-nowrap">{tab.label}</span>
                                </button>
                            ))}
                    </div>
                </nav>

                <section className={`employee-engagement-content min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5 md:p-6 ${activeTab === 'surveys' ? 'survey-ui survey-ui--list' : ''}`}>
                    <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                            {activeTab === 'surveys' && <span className="employee-surveys-section-icon" aria-hidden="true"><FaClipboardList /></span>}
                            {activeTab === 'surveys' && 'Surveys'}
                            {activeTab === 'feedback' &&
                                (feedbackSub === 'suggestions' ? 'Suggestions' : 'Feedback')}
                            {activeTab === 'recognition' && 'Recognition'}
                        </h2>
                        <label className="relative block w-full sm:max-w-xs sm:flex-1">
                            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={
                                    activeTab === 'surveys'
                                        ? 'Search surveys...'
                                        : activeTab === 'feedback'
                                          ? feedbackSub === 'suggestions'
                                              ? 'Search suggestions...'
                                              : 'Search feedback...'
                                          : 'Search recognition...'
                                }
                                className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#20C997] focus:bg-white focus:ring-2 focus:ring-[#20C997]/20 sm:h-10"
                            />
                        </label>
                    </div>
                    {activeTab === 'surveys' && (
                        <div className="space-y-4">
                            {filteredSurveys.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-500">
                                    {searchQuery ? 'No surveys match your search.' : 'No surveys assigned.'}
                                </p>
                            ) : (
                                <div className="employee-survey-grid grid gap-4 md:grid-cols-2">
                                    {filteredSurveys.map((s) => (
                                        <article
                                            key={s._id}
                                            data-respond={s.canRespond ? 'true' : 'false'}
                                            className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="employee-survey-heading">
                                                    <span className="employee-survey-icon" aria-hidden="true"><FaClipboardList /></span>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900">{s.title}</h3>
                                                        <p className="text-xs text-slate-500">{s.type}</p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${surveyStatusStyle(s.status)}`}
                                                >
                                                    {s.status}
                                                </span>
                                            </div>
                                            {s.description && <p className="employee-survey-description">{s.description}</p>}
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100">
                                                    {s.anonymous ? 'Anonymous' : 'Identified'}
                                                </span>
                                                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100">
                                                    Due{' '}
                                                    {s.endDate
                                                        ? new Date(s.endDate).toLocaleDateString()
                                                        : '—'}
                                                </span>
                                                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-100 capitalize">
                                                    {s.completionState}
                                                </span>
                                            </div>
                                            {s.canRespond && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/employee/engagement/surveys/${s._id}`)}
                                                    className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                                                    style={{ background: MINT_GRADIENT }}
                                                >
                                                    <FaEye aria-hidden="true" />
                                                    Start Survey
                                                </button>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'feedback' && (
                        <div>
                            <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        ...(engSettings?.features?.feedback !== false
                                            ? [{ id: 'feedback', label: `Feedback (${feedback.length})` }]
                                            : []),
                                        ...(engSettings?.features?.suggestions !== false
                                            ? [{ id: 'suggestions', label: `Suggestions (${suggestions.length})` }]
                                            : []),
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setFeedbackSub(tab.id)}
                                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                                                feedbackSub === tab.id
                                                    ? 'bg-[#20C997] text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {feedbackSub === 'suggestions' ? (
                                    <button
                                        type="button"
                                        onClick={() => setSuggestionOpen(true)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white sm:w-auto"
                                        style={{ background: MINT_GRADIENT }}
                                    >
                                        <FaPlus className="h-3.5 w-3.5" /> Submit Suggestion
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setFeedbackOpen(true)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white sm:w-auto"
                                        style={{ background: MINT_GRADIENT }}
                                    >
                                        <FaPlus className="h-3.5 w-3.5" /> Give Feedback
                                    </button>
                                )}
                            </div>

                            {feedbackSub === 'suggestions' ? (
                                <>
                                    {suggestions.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-slate-500">No suggestions yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredSuggestions.map((s) => (
                                                <article
                                                    key={s._id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => openSuggestionDetail(s._id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openSuggestionDetail(s._id);
                                                        }
                                                    }}
                                                    className="cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition hover:border-[#20C997]/30 hover:shadow-sm sm:p-5"
                                                >
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <h3 className="font-semibold text-slate-900">{s.subject}</h3>
                                                        <span
                                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(s.status)}`}
                                                        >
                                                            {s.status}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{s.message}</p>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {feedback.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-slate-500">No feedback yet.</p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                                            <table className="w-full min-w-[520px] text-left text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                                        <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                            Subject
                                                        </th>
                                                        <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                            Type
                                                        </th>
                                                        <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                            Status
                                                        </th>
                                                        <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                            Date
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredFeedback.map((f) => (
                                                        <tr
                                                            key={f._id}
                                                            className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/80"
                                                            onClick={() => openFeedbackDetail(f._id)}
                                                        >
                                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                                {f.subject}
                                                                {f.anonymous ? (
                                                                    <span className="ml-2 text-xs text-slate-400">
                                                                        (Anonymous)
                                                                    </span>
                                                                ) : null}
                                                            </td>
                                                            <td className="px-4 py-3">{f.type}</td>
                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(f.status)}`}
                                                                >
                                                                    {f.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600">
                                                                {f.createdAt
                                                                    ? new Date(f.createdAt).toLocaleDateString()
                                                                    : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'recognition' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'wall', label: 'Wall' },
                                        { id: 'received', label: `Received (${received.length})` },
                                        { id: 'given', label: `Given (${given.length})` },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setRecognitionSubTab(tab.id)}
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                                recognitionSubTab === tab.id
                                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRecognitionOpen(true)}
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    <FaPlus className="h-3.5 w-3.5" /> Give Recognition
                                </button>
                            </div>

                            {recognitionSubTab === 'wall' && (
                                <div className="space-y-3">
                                    {filteredWall.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-slate-500">
                                            {searchQuery
                                                ? 'No recognition matches your search.'
                                                : 'No public recognition yet.'}
                                        </p>
                                    ) : (
                                        filteredWall.map((r) => {
                                            const counts = reactionCounts(r.reactions);
                                            return (
                                                <article
                                                    key={r._id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => openRecognitionDetail(r._id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openRecognitionDetail(r._id);
                                                        }
                                                    }}
                                                    className="cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/40 p-5 transition hover:border-[#20C997]/30"
                                                >
                                                    <p className="text-sm text-slate-600">
                                                        <span className="font-semibold text-slate-900">
                                                            {personName(r.givenBy)}
                                                        </span>{' '}
                                                        recognized{' '}
                                                        <span className="font-semibold text-slate-900">
                                                            {formatRecognitionRecipientLabel(r, personName)}
                                                        </span>
                                                    </p>
                                                    <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
                                                    {r.description && (
                                                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                                                            &ldquo;{r.description}&rdquo;
                                                        </p>
                                                    )}
                                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0d9488] ring-1 ring-[#20C997]/20">
                                                            {r.type}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                react(r._id, '❤️');
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-rose-50"
                                                        >
                                                            <FaHeart className="text-rose-500" /> {counts['❤️'] || 0}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                react(r._id, '👏');
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-amber-50"
                                                        >
                                                            👏 {counts['👏'] || 0}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {recognitionSubTab === 'received' && (
                                <div className="space-y-3">
                                    {filteredReceived.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-slate-500">
                                            {searchQuery
                                                ? 'No recognition matches your search.'
                                                : 'No recognition received yet.'}
                                        </p>
                                    ) : (
                                        filteredReceived.map((r) => (
                                            <article
                                                key={r._id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => openRecognitionDetail(r._id)}
                                                className="cursor-pointer rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5"
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <h3 className="font-semibold text-slate-900">{r.title}</h3>
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recognitionStatusStyle(r.status)}`}
                                                    >
                                                        {r.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {r.type} · From {personName(r.givenBy)} ·{' '}
                                                    {r.createdAt
                                                        ? new Date(r.createdAt).toLocaleDateString()
                                                        : '—'}
                                                </p>
                                                {r.description && (
                                                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                                                        {r.description}
                                                    </p>
                                                )}
                                            </article>
                                        ))
                                    )}
                                </div>
                            )}

                            {recognitionSubTab === 'given' && (
                                <div className="space-y-3">
                                    {filteredGiven.length === 0 ? (
                                        <p className="py-10 text-center text-sm text-slate-500">
                                            {searchQuery
                                                ? 'No recognition matches your search.'
                                                : 'You have not given recognition yet.'}
                                        </p>
                                    ) : (
                                        filteredGiven.map((r) => (
                                            <article
                                                key={r._id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => openRecognitionDetail(r._id)}
                                                className="cursor-pointer rounded-2xl border border-slate-100 bg-slate-50/40 p-5"
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <h3 className="font-semibold text-slate-900">{r.title}</h3>
                                                    <span
                                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recognitionStatusStyle(r.status)}`}
                                                    >
                                                        {r.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    {r.type} · To {formatRecognitionRecipientLabel(r, personName)} ·{' '}
                                                    {r.createdAt
                                                        ? new Date(r.createdAt).toLocaleDateString()
                                                        : '—'}
                                                </p>
                                            </article>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Activity</h2>
                            {activity.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-500">No recent activity.</p>
                            ) : (
                                activity.map((item, idx) => (
                                    <article
                                        key={`${item.kind}-${idx}`}
                                        className={`rounded-2xl border p-4 ${
                                            item.kind === 'suggestion_implemented'
                                                ? 'border-emerald-100 bg-emerald-50/50'
                                                : 'border-slate-100 bg-slate-50/40'
                                        }`}
                                    >
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            {String(item.kind).replace(/_/g, ' ')}
                                        </p>
                                        <h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3>
                                        {item.meta?.resolutionNote && (
                                            <p className="mt-2 text-sm text-slate-700">
                                                <span className="font-semibold text-emerald-700">Outcome: </span>
                                                {item.meta.resolutionNote}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-500">
                                            {item.at ? new Date(item.at).toLocaleString() : ''}
                                            {item.meta?.status ? ` · ${item.meta.status}` : ''}
                                            {item.meta?.lifecycleTrigger
                                                ? ` · ${item.meta.lifecycleTrigger}`
                                                : ''}
                                        </p>
                                    </article>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'celebrations' && (
                        <div className="space-y-3">
                            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Celebrations</h2>
                            {celebrations.length === 0 ? (
                                <p className="py-10 text-center text-sm text-slate-500">No upcoming celebrations this period.</p>
                            ) : (
                                celebrations.map((c, idx) => (
                                    <article
                                        key={`${c.kind || 'c'}-${c.employeeName || c.subject || idx}`}
                                        className={`rounded-2xl border p-5 ${
                                            c.kind === 'suggestion_implemented'
                                                ? 'border-emerald-100 bg-emerald-50/40'
                                                : 'border-amber-100 bg-amber-50/40'
                                        }`}
                                    >
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            {c.kind === 'suggestion_implemented'
                                                ? 'Suggestion implemented'
                                                : 'Work anniversary'}
                                        </p>
                                        <p className="mt-1 font-semibold text-slate-900">{c.message}</p>
                                        {c.department && (
                                            <p className="mt-1 text-xs text-slate-500">{c.department}</p>
                                        )}
                                    </article>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'privacy' && (
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Privacy</h2>
                            <ul className="space-y-3">
                                {(engSettings?.privacy?.points || [
                                    'Anonymous feedback and anonymous surveys do not expose your identity to managers or colleagues.',
                                    `Engagement analytics are only shown when there are at least ${engSettings?.analyticsMinResponses || 5} responses in a group, so individuals cannot be singled out.`,
                                    'Managers only see authorized team-level engagement information for their direct reports.',
                                    'HR and Admin manage Engagement according to their assigned permissions.',
                                    'You can always see your own identified submissions and any outcomes shared with you (such as implemented suggestions).',
                                ]).map((point) => (
                                    <li
                                        key={point}
                                        className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700 shadow-sm"
                                    >
                                        {point}
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-slate-400">
                                Privacy threshold currently configured at{' '}
                                {engSettings?.privacy?.analyticsMinResponses ||
                                    engSettings?.analyticsMinResponses ||
                                    5}{' '}
                                responses. Employees cannot change Engagement settings.
                            </p>
                        </div>
                    )}
                </section>
            </div>

            {feedbackOpen && (
                <Modal title="Give Feedback" onClose={() => setFeedbackOpen(false)}>
                    <form onSubmit={submitFeedback} className="space-y-3">
                        <input
                            className={inputClass}
                            placeholder="Subject"
                            value={feedbackForm.subject}
                            onChange={(e) => setFeedbackForm((p) => ({ ...p, subject: e.target.value }))}
                            required
                        />
                        <textarea
                            className={inputClass}
                            rows={4}
                            placeholder="Message"
                            value={feedbackForm.message}
                            onChange={(e) => setFeedbackForm((p) => ({ ...p, message: e.target.value }))}
                            required
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                className={inputClass}
                                value={feedbackForm.type}
                                onChange={(e) => setFeedbackForm((p) => ({ ...p, type: e.target.value }))}
                            >
                                <option value="Complaint">Complaint</option>
                                <option value="Appreciation">Appreciation</option>
                                <option value="Question">Question</option>
                                <option value="Other">Other</option>
                            </select>
                            <select
                                className={inputClass}
                                value={feedbackForm.category}
                                onChange={(e) => setFeedbackForm((p) => ({ ...p, category: e.target.value }))}
                            >
                                <option>Work Environment</option>
                                <option>Management</option>
                                <option>Benefits</option>
                                <option>Process</option>
                                <option>Technology</option>
                                <option>Training</option>
                                <option>Culture</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={feedbackForm.anonymous}
                                onChange={(e) =>
                                    setFeedbackForm((p) => ({ ...p, anonymous: e.target.checked }))
                                }
                            />
                            Submit anonymously
                        </label>
                        <SubmitRow onCancel={() => setFeedbackOpen(false)} submitting={submitting} />
                    </form>
                </Modal>
            )}

            {suggestionOpen && (
                <Modal title="Submit Suggestion" onClose={() => setSuggestionOpen(false)}>
                    <form onSubmit={submitSuggestion} className="space-y-3">
                        <input
                            className={inputClass}
                            placeholder="Subject"
                            value={suggestionForm.subject}
                            onChange={(e) => setSuggestionForm((p) => ({ ...p, subject: e.target.value }))}
                            required
                        />
                        <textarea
                            className={inputClass}
                            rows={4}
                            placeholder="Your suggestion"
                            value={suggestionForm.message}
                            onChange={(e) => setSuggestionForm((p) => ({ ...p, message: e.target.value }))}
                            required
                        />
                        <select
                            className={inputClass}
                            value={suggestionForm.category}
                            onChange={(e) => setSuggestionForm((p) => ({ ...p, category: e.target.value }))}
                        >
                            <option>Work Environment</option>
                            <option>Management</option>
                            <option>Benefits</option>
                            <option>Process</option>
                            <option>Technology</option>
                            <option>Training</option>
                            <option>Culture</option>
                            <option>Other</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={suggestionForm.anonymous}
                                onChange={(e) =>
                                    setSuggestionForm((p) => ({ ...p, anonymous: e.target.checked }))
                                }
                            />
                            Submit anonymously
                        </label>
                        <SubmitRow onCancel={() => setSuggestionOpen(false)} submitting={submitting} />
                    </form>
                </Modal>
            )}

            {(feedbackDetail || loadingFeedbackDetail) && (
                <Modal title="Feedback Details" onClose={closeFeedbackDetail}>
                    {loadingFeedbackDetail ? (
                        <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
                    ) : feedbackDetail ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">{feedbackDetail.subject}</h3>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(feedbackDetail.status)}`}
                                >
                                    {feedbackDetail.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                {feedbackDetail.type} • {feedbackDetail.category || 'Other'}
                                {feedbackDetail.anonymous ? ' • Anonymous' : ''}
                            </p>
                            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                {feedbackDetail.message}
                            </p>
                            {Array.isArray(feedbackDetail.responses) &&
                                feedbackDetail.responses.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            HR replies
                                        </p>
                                        {feedbackDetail.responses.map((r, i) => (
                                            <div
                                                key={i}
                                                className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-slate-700"
                                            >
                                                {r.response}
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>
                    ) : (
                        <p className="py-8 text-center text-sm text-slate-500">Feedback not found.</p>
                    )}
                </Modal>
            )}

            {(suggestionDetail || loadingSuggestionDetail) && (
                <Modal title="Suggestion Details" onClose={closeSuggestionDetail}>
                    {loadingSuggestionDetail ? (
                        <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
                    ) : suggestionDetail ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">{suggestionDetail.subject}</h3>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feedbackStatusStyle(suggestionDetail.status)}`}
                                >
                                    {suggestionDetail.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">
                                {suggestionDetail.category || 'Other'} • Submitted{' '}
                                {suggestionDetail.createdAt
                                    ? new Date(suggestionDetail.createdAt).toLocaleDateString()
                                    : '—'}
                            </p>
                            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                {suggestionDetail.message}
                            </p>
                            {Array.isArray(suggestionDetail.responses) &&
                                suggestionDetail.responses.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            HR replies
                                        </p>
                                        {suggestionDetail.responses.map((r, i) => (
                                            <div
                                                key={i}
                                                className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-slate-700"
                                            >
                                                {r.response}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            {suggestionDetail.resolutionNote && (
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-slate-700">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Resolution</p>
                                    <p className="mt-1">{suggestionDetail.resolutionNote}</p>
                                    {suggestionDetail.implementationDate && (
                                        <p className="mt-2 text-xs text-slate-500">
                                            Implemented:{' '}
                                            {new Date(suggestionDetail.implementationDate).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="py-8 text-center text-sm text-slate-500">Suggestion not found.</p>
                    )}
                </Modal>
            )}

            {(recognitionDetail || loadingRecognitionDetail) && (
                <Modal title="Recognition Details" onClose={closeRecognitionDetail}>
                    {loadingRecognitionDetail ? (
                        <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
                    ) : recognitionDetail ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {recognitionDetail.title}
                                </h3>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recognitionStatusStyle(recognitionDetail.status)}`}
                                >
                                    {recognitionDetail.status}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600">
                                <span className="font-semibold text-slate-900">
                                    {personName(recognitionDetail.givenBy)}
                                </span>{' '}
                                →{' '}
                                <span className="font-semibold text-slate-900">
                                    {formatRecognitionRecipientLabel(recognitionDetail, personName)}
                                </span>
                            </p>
                            <p className="text-xs text-slate-500">
                                {recognitionDetail.type} ·{' '}
                                {recognitionDetail.createdAt
                                    ? new Date(recognitionDetail.createdAt).toLocaleDateString()
                                    : '—'}
                                {!recognitionDetail.isPublic && ' · Private'}
                            </p>
                            {recognitionDetail.description && (
                                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                    {recognitionDetail.description}
                                </p>
                            )}
                            {recognitionDetail.points > 0 && (
                                <p className="text-xs text-slate-500">{recognitionDetail.points} points</p>
                            )}
                            {recognitionDetail.badge && (
                                <p className="text-xs text-slate-500">Badge: {recognitionDetail.badge}</p>
                            )}
                        </div>
                    ) : (
                        <p className="py-8 text-center text-sm text-slate-500">Recognition not found.</p>
                    )}
                </Modal>
            )}

            {recognitionOpen && (
                <Modal title="Give Recognition" onClose={() => setRecognitionOpen(false)}>
                    <form onSubmit={submitRecognition} className="space-y-3">
                        <select
                            className={inputClass}
                            value={recognitionForm.recipientId}
                            onChange={(e) =>
                                setRecognitionForm((p) => ({ ...p, recipientId: e.target.value }))
                            }
                            required
                        >
                            <option value="">Select colleague</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {`${emp.name || ''} ${emp.lastName || ''}`.trim()}
                                    {emp.department ? ` · ${emp.department}` : ''}
                                </option>
                            ))}
                        </select>
                        <select
                            className={inputClass}
                            value={recognitionForm.type}
                            onChange={(e) => setRecognitionForm((p) => ({ ...p, type: e.target.value }))}
                        >
                            {RECOGNITION_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <input
                            className={inputClass}
                            placeholder="Title"
                            value={recognitionForm.title}
                            onChange={(e) => setRecognitionForm((p) => ({ ...p, title: e.target.value }))}
                            required
                        />
                        <textarea
                            className={inputClass}
                            rows={3}
                            placeholder="Message"
                            value={recognitionForm.description}
                            onChange={(e) =>
                                setRecognitionForm((p) => ({ ...p, description: e.target.value }))
                            }
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={recognitionForm.isPublic}
                                onChange={(e) =>
                                    setRecognitionForm((p) => ({ ...p, isPublic: e.target.checked }))
                                }
                            />
                            Show on recognition wall when approved
                        </label>
                        <SubmitRow onCancel={() => setRecognitionOpen(false)} submitting={submitting} />
                    </form>
                </Modal>
            )}
        </div>
    );
};

const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                    <FaTimes />
                </button>
            </div>
            {children}
        </div>
    </div>
);

const SubmitRow = ({ onCancel, submitting }) => (
    <div className="flex justify-end gap-2 pt-2">
        <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
            Cancel
        </button>
        <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: MINT_GRADIENT }}
        >
            {submitting ? 'Sending...' : 'Submit'}
        </button>
    </div>
);

export default EmployeeEngagementPage;
