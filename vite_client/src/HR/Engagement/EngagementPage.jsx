import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaChartLine,
    FaComments,
    FaClipboardList,
    FaPlus,
    FaSearch,
    FaPoll,
    FaInbox,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import { canManageEngagement, surveyStatusStyle } from './engagementUtils';
import FeedbackPanel from './FeedbackPanel';

const MINT = '#20C997';
const MINT_DARK = '#0d9488';

const KpiStat = ({ label, value, icon: Icon, accent = MINT }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
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
    const canSubmitFeedback = Boolean(employee?._id || employee?.id);

    const [surveys, setSurveys] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('surveys');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [surveysRes, feedbackRes] = await Promise.all([
                axios.get('/v1/both/engagement/surveys?limit=500', { withCredentials: true }),
                axios.get('/v1/both/engagement/feedback?limit=500', { withCredentials: true }),
            ]);
            setSurveys(surveysRes.data?.data || []);
            setFeedback(feedbackRes.data?.data || []);
        } catch (error) {
            setSurveys([]);
            setFeedback([]);
            toast.error(error.response?.data?.message || 'Failed to load engagement data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const stats = useMemo(() => {
        const active = surveys.filter((s) => s.status === 'Active').length;
        const totalResponses = surveys.reduce((sum, s) => sum + (Number(s.responseCount) || 0), 0);
        const openFeedback = feedback.filter((f) => f.status === 'Open' || f.status === 'In Review').length;
        return {
            totalSurveys: surveys.length,
            active,
            totalResponses,
            openFeedback,
        };
    }, [surveys, feedback]);

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
        if (!q || activeTab !== 'feedback') return feedback;
        return feedback.filter((f) =>
            [f.subject, f.type, f.status, f.category, f.employeeId?.name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [feedback, searchQuery, activeTab]);

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
        <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB] p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1400px] space-y-6">
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
                                    Surveys, feedback, and recognition
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

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <KpiStat label="Total Surveys" value={stats.totalSurveys} icon={FaClipboardList} accent={MINT} />
                    <KpiStat label="Active" value={stats.active} icon={FaPoll} accent="#10b981" />
                    <KpiStat
                        label="Survey Responses"
                        value={stats.totalResponses}
                        icon={FaInbox}
                        accent={MINT_DARK}
                    />
                    <KpiStat
                        label="Open Feedback"
                        value={stats.openFeedback}
                        icon={FaComments}
                        accent="#8b5cf6"
                    />
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('surveys')}
                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                                activeTab === 'surveys'
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaClipboardList className="h-4 w-4" />
                            Surveys ({surveys.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('feedback')}
                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                                activeTab === 'feedback'
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <FaComments className="h-4 w-4" />
                            Feedback ({feedback.length})
                        </button>
                    </div>
                </div>

                <section className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4 md:px-6">
                        <h2 className="text-lg font-semibold text-slate-900">
                            {activeTab === 'surveys'
                                ? `Surveys (${filteredSurveys.length})`
                                : `Feedback (${filteredFeedback.length})`}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'surveys'
                                ? 'Pulse checks, annual surveys, and custom forms'
                                : 'Employee suggestions and support requests'}
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        {activeTab === 'surveys' ? (
                            filteredSurveys.length === 0 ? (
                                <div className="py-16 text-center">
                                    <div
                                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                        style={{ background: `${MINT}20` }}
                                    >
                                        <FaClipboardList className="h-8 w-8" style={{ color: MINT }} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">No surveys found</h3>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                        {searchQuery
                                            ? 'Try a different search term.'
                                            : 'Create your first survey to gather employee feedback.'}
                                    </p>
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
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#20C997]/10">
                                                        <FaPoll className="h-5 w-5 text-[#0d9488]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-lg font-semibold text-slate-900">
                                                            {survey.title}
                                                        </h3>
                                                        {survey.type && (
                                                            <p className="text-xs text-slate-500">{survey.type}</p>
                                                        )}
                                                    </div>
                                                </div>
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
                                            <div className="p-4">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate(`/engagement/surveys/${survey._id}`)
                                                    }
                                                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                                                    style={{ background: MINT_GRADIENT }}
                                                >
                                                    View Survey
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )
                        ) : (
                            <FeedbackPanel
                                feedback={feedback}
                                filteredFeedback={filteredFeedback}
                                isManagerUser={isManagerUser}
                                canSubmitFeedback={canSubmitFeedback}
                                searchQuery={searchQuery}
                                onRefresh={fetchAll}
                            />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default EngagementPage;
