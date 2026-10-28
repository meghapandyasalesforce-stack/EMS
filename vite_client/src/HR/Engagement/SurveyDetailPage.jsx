import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft,
    FaChartLine,
    FaClipboardList,
    FaSave,
    FaPaperPlane,
    FaEdit,
    FaDownload,
    FaCopy,
    FaTrash,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MINT_GRADIENT } from '../Reports/constants';
import { canManageEngagement, surveyStatusStyle } from './engagementUtils';
import { getStatusHint, toastForSave } from '../../utils/publishStatusUi';
import { PERMISSIONS } from '../../utils/permissions';
import { useAuthPermissions } from '../../Hooks/useAuthPermissions';
import { downloadEngagementExport, exportFilename } from './engagementExportUtils';

const TREND_RANGES = [
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: '3m', label: 'Last 3 months' },
    { id: '6m', label: 'Last 6 months' },
];

const PrivacyBanner = ({ message }) => (
    <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-6 text-center text-sm text-amber-900">
        {message || 'Not enough responses to display analytics.'}
    </p>
);

const StatCard = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
);

const DistributionBars = ({ rows }) => (
    <ul className="mt-3 space-y-2">
        {(rows || []).map((row) => (
            <li key={`${row.option ?? row.value}-${row.count}`}>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{row.option ?? row.value}</span>
                    <span>
                        {row.count} · {row.percentage}%
                    </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-[#0E9370]"
                        style={{ width: `${Math.min(100, Number(row.percentage) || 0)}%` }}
                    />
                </div>
            </li>
        ))}
    </ul>
);

const QuestionAnalyticsBlock = ({ q }) => {
    if (!q) return null;
    if (q.questionType === 'Text') {
        return (
            <article className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">{q.questionText}</p>
                <p className="mt-1 text-xs text-slate-500">{q.questionType}</p>
                <p className="mt-3 text-sm text-slate-600">{q.message}</p>
            </article>
        );
    }
    if (!q.available) {
        return (
            <article className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">{q.questionText}</p>
                <p className="mt-1 text-xs text-slate-500">{q.questionType}</p>
                <p className="mt-3 text-sm text-amber-800">
                    {q.message || 'Not enough responses to display analytics.'}
                </p>
            </article>
        );
    }

    return (
        <article className="rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">{q.questionText}</p>
            <p className="mt-1 text-xs text-slate-500">
                {q.questionType}
                {q.legacy ? ' · Legacy' : ''} · n={q.responseCount}
            </p>

            {q.questionType === 'Multiple Choice' && <DistributionBars rows={q.distribution} />}

            {(q.questionType === 'Rating' || q.questionType === 'Scale') && (
                <>
                    <p className="mt-3 text-sm text-slate-700">
                        Average: <span className="font-semibold">{q.average}</span> / {q.max}
                    </p>
                    <DistributionBars rows={q.distribution} />
                </>
            )}

            {q.questionType === 'Yes/No' && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <StatCard label="Yes" value={`${q.yes} (${q.yesPct}%)`} />
                    <StatCard label="No" value={`${q.no} (${q.noPct}%)`} />
                </div>
            )}

            {q.questionType === 'eNPS' && (
                <div className="mt-3 space-y-2">
                    <p className="text-2xl font-bold text-slate-900">eNPS {q.eNPS ?? q.score}</p>
                    <p className="text-sm text-slate-600">
                        Promoters {q.promoters} ({q.promoterPct}%) · Passives {q.passives} (
                        {q.passivePct}%) · Detractors {q.detractors} ({q.detractorPct}%)
                    </p>
                </div>
            )}
        </article>
    );
};

const SurveyDetailPage = () => {
    const { surveyId } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const { permissions, isOrgOwner } = useAuthPermissions();

    const canManage = useMemo(() => canManageEngagement(user, employee), [user, employee]);
    const canViewAnalytics = useMemo(() => {
        if (canManage || isOrgOwner) return true;
        const keys = [
            PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG,
            PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM,
            PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
            PERMISSIONS.ENGAGEMENT_MANAGE,
        ];
        if (!Array.isArray(permissions) || !permissions.length) return false;
        if (permissions.includes('*')) return true;
        return keys.some((k) => permissions.includes(k));
    }, [canManage, isOrgOwner, permissions]);

    const isEmployeeActor = Boolean(employee?._id || employee?.id);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [survey, setSurvey] = useState(null);
    const [responses, setResponses] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [trendRange, setTrendRange] = useState('30d');
    const [statusDraft, setStatusDraft] = useState('Draft');
    const [answers, setAnswers] = useState({});
    const [expandedResponseId, setExpandedResponseId] = useState(null);
    const [responsePage, setResponsePage] = useState(1);
    const [responsePagination, setResponsePagination] = useState(null);
    const [responsesLoading, setResponsesLoading] = useState(false);
    const [exportingResponses, setExportingResponses] = useState(false);
    const [metadataEditOpen, setMetadataEditOpen] = useState(false);
    const [metadataForm, setMetadataForm] = useState(null);
    const [cloning, setCloning] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const loadResponses = useCallback(
        async (page = 1) => {
            if (!canManage || !surveyId) return;
            try {
                setResponsesLoading(true);
                const res = await axios.get(
                    `/v1/admin/engagement/surveys/${surveyId}/responses`,
                    {
                        params: { page, limit: 25 },
                        withCredentials: true,
                    }
                );
                setResponses(res.data?.data || []);
                setResponsePagination(res.data?.pagination || null);
                setResponsePage(page);
            } catch {
                setResponses([]);
                setResponsePagination(null);
            } finally {
                setResponsesLoading(false);
            }
        },
        [canManage, surveyId]
    );

    const loadAnalytics = useCallback(
        async (range = trendRange) => {
            if (!canViewAnalytics || !surveyId) return;
            try {
                setAnalyticsLoading(true);
                const res = await axios.get(`/v1/both/engagement/surveys/${surveyId}/analytics`, {
                    params: { range },
                    withCredentials: true,
                });
                setAnalytics(res.data?.data || null);
            } catch {
                setAnalytics(null);
            } finally {
                setAnalyticsLoading(false);
            }
        },
        [canViewAnalytics, surveyId, trendRange]
    );

    const loadSurvey = useCallback(async () => {
        const surveyRes = await axios.get(`/v1/both/engagement/surveys/${surveyId}`, {
            withCredentials: true,
        });
        const data = surveyRes.data?.data;
        if (!data) {
            setSurvey(null);
            return;
        }
        setSurvey(data);
        setStatusDraft(data.status || 'Draft');
        setMetadataForm({
            title: data.title || '',
            description: data.description || '',
            startDate: data.startDate ? new Date(data.startDate).toISOString().slice(0, 16) : '',
            endDate: data.endDate ? new Date(data.endDate).toISOString().slice(0, 16) : '',
            reminderEnabled: data.reminderEnabled !== false,
            reminderDaysBefore: data.reminderDaysBefore ?? 2,
        });

        if (canManage) {
            await loadResponses(1);
        }
    }, [surveyId, canManage, loadResponses]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                await loadSurvey();
            } catch (error) {
                setSurvey(null);
                toast.error(error.response?.data?.message || 'Failed to load survey');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [loadSurvey]);

    useEffect(() => {
        if (canViewAnalytics && survey) {
            loadAnalytics(trendRange);
        }
    }, [canViewAnalytics, survey, trendRange, loadAnalytics]);

    const surveyIsOpen = useMemo(() => {
        if (!survey || survey.status !== 'Active') return false;
        const now = Date.now();
        if (survey.startDate && new Date(survey.startDate).getTime() > now) return false;
        if (survey.endDate && new Date(survey.endDate).getTime() < now) return false;
        return true;
    }, [survey]);

    const canRespond = isEmployeeActor && surveyIsOpen;

    const handleMetadataSave = async () => {
        if (!metadataForm) return;
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/surveys/${surveyId}`,
                {
                    title: metadataForm.title,
                    description: metadataForm.description,
                    startDate: new Date(metadataForm.startDate),
                    endDate: new Date(metadataForm.endDate),
                    reminderEnabled: metadataForm.reminderEnabled,
                    reminderDaysBefore: metadataForm.reminderDaysBefore,
                },
                { withCredentials: true }
            );
            toast.success('Survey updated');
            setMetadataEditOpen(false);
            await loadSurvey();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update survey');
        } finally {
            setSaving(false);
        }
    };

    const handleCloneSurvey = async () => {
        try {
            setCloning(true);
            const { data } = await axios.post(
                `/v1/admin/engagement/surveys/${surveyId}/clone`,
                {},
                { withCredentials: true }
            );
            toast.success('Survey cloned as draft');
            if (data?.data?._id) {
                navigate(`/engagement/surveys/${data.data._id}/edit`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to clone survey');
        } finally {
            setCloning(false);
        }
    };

    const handleDeleteSurvey = async () => {
        const hasResponses = (survey?.responseCount || 0) > 0;
        const confirmed = window.confirm(
            hasResponses
                ? 'This survey has responses. Deleting it will permanently remove the survey and all responses. Continue?'
                : 'Delete this survey? This cannot be undone.'
        );
        if (!confirmed) return;
        try {
            setDeleting(true);
            await axios.delete(`/v1/admin/engagement/surveys/${surveyId}`, {
                withCredentials: true,
            });
            toast.success('Survey deleted');
            navigate('/engagement');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete survey');
        } finally {
            setDeleting(false);
        }
    };

    const handleExportResponses = async () => {
        try {
            setExportingResponses(true);
            await downloadEngagementExport(
                `/v1/admin/engagement/surveys/${surveyId}/export/responses`,
                exportFilename('survey-responses', { part: survey?.title || surveyId })
            );
            toast.success('Export downloaded');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Export failed');
        } finally {
            setExportingResponses(false);
        }
    };

    const handleStatusSave = async () => {
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/surveys/${surveyId}`,
                { status: statusDraft },
                { withCredentials: true }
            );
            toast.success(toastForSave('Survey', statusDraft, 'survey'));
            await loadSurvey();
            await loadAnalytics(trendRange);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update survey');
        } finally {
            setSaving(false);
        }
    };

    const setAnswer = (questionId, value) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleSubmitResponse = async (e) => {
        e.preventDefault();
        if (!survey?.questions?.length) {
            toast.error('This survey has no questions');
            return;
        }

        const requiredMissing = survey.questions.some((q, idx) => {
            if (!q.required) return false;
            const qid = String(q._id || idx);
            const val = answers[qid];
            return val === undefined || val === null || val === '';
        });
        if (requiredMissing) {
            toast.error('Please answer all required questions');
            return;
        }

        const payloadResponses = survey.questions.map((q, idx) => {
            const qid = String(q._id || idx);
            return {
                questionId: q._id || qid,
                questionText: q.question,
                questionType: q.type,
                answer: answers[qid] ?? '',
            };
        });

        try {
            setSubmitting(true);
            await axios.post(
                `/v1/both/engagement/surveys/${surveyId}/respond`,
                { responses: payloadResponses },
                { withCredentials: true }
            );
            toast.success('Thank you for your response!');
            navigate(canManage ? '/engagement' : '/employee/engagement');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit response');
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestionInput = (question, idx) => {
        const qid = String(question._id || idx);
        const value = answers[qid] ?? '';

        if (question.type === 'Multiple Choice' && Array.isArray(question.options)) {
            return (
                <div className="space-y-2">
                    {question.options.filter(Boolean).map((opt, i) => (
                        <label
                            key={`${qid}-opt-${i}`}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                        >
                            <input
                                type="radio"
                                name={qid}
                                checked={value === opt}
                                onChange={() => setAnswer(qid, opt)}
                                className="text-[#0E9370]"
                            />
                            <span className="text-sm text-slate-700">{opt}</span>
                        </label>
                    ))}
                </div>
            );
        }

        if (question.type === 'Yes/No') {
            return (
                <div className="flex gap-2">
                    {['Yes', 'No'].map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(qid, opt)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                                value === opt
                                    ? 'border-[#0E9370] bg-[#0E9370]/10 text-[#0d9488]'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            );
        }

        if (question.type === 'Rating' || question.type === 'Scale' || question.type === 'eNPS') {
            const max = question.type === 'Rating' ? 5 : 10;
            const min = question.type === 'eNPS' ? 0 : 1;
            return (
                <div>
                    {question.type === 'eNPS' && (
                        <p className="mb-2 text-xs text-slate-500">
                            How likely are you to recommend this workplace? (0 = not at all, 10 =
                            extremely likely)
                        </p>
                    )}
                    <input
                        type="number"
                        min={min}
                        max={max}
                        value={value}
                        onChange={(e) => setAnswer(qid, Number(e.target.value))}
                        className="w-full max-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                </div>
            );
        }

        return (
            <textarea
                value={value}
                onChange={(e) => setAnswer(qid, e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0E9370] focus:ring-2 focus:ring-[#0E9370]/20"
                placeholder="Your answer..."
            />
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-transparent">
                <LoadingSpinner message="Loading survey..." />
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="page-shell min-h-[calc(100vh-64px)] bg-transparent">
                <div className="page-shell-inner">
                    <div className="rounded-[28px] border border-slate-100 bg-white p-8 text-center shadow-sm">
                        <p className="text-lg font-semibold text-slate-900">Survey not found</p>
                        <button
                            type="button"
                            onClick={() => navigate('/engagement')}
                            className="mt-4 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                        >
                            Back to Engagement
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const overview = analytics?.overview;
    const showAnalyticsDetail = overview?.available === true;

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-transparent">
            <div className="page-shell-inner hrms-stack max-w-6xl">
                <button
                    type="button"
                    onClick={() => navigate('/engagement')}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                    <FaArrowLeft className="text-xs" /> Back
                </button>

                <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5 md:p-6">
                    <div className="flex flex-col gap-5">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white sm:h-12 sm:w-12"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaChartLine className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
                                    {survey.title}
                                </h1>
                                {survey.description ? (
                                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                        {survey.description}
                                    </p>
                                ) : null}
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${surveyStatusStyle(survey.status)}`}
                                    >
                                        {survey.status}
                                    </span>
                                    {survey.type && (
                                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                            {survey.type}
                                        </span>
                                    )}
                                    {survey.anonymous && (
                                        <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                                            Anonymous
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {canManage && (
                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                                    {(survey.responseCount || 0) === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/engagement/surveys/${surveyId}/edit`)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:rounded-full sm:px-4 sm:py-2"
                                        >
                                            <FaEdit className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">Edit Survey</span>
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setMetadataEditOpen((v) => !v)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:rounded-full sm:px-4 sm:py-2"
                                            >
                                                <FaEdit className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">Edit Details</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCloneSurvey}
                                                disabled={cloning}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:rounded-full sm:px-4 sm:py-2"
                                            >
                                                <FaCopy className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{cloning ? 'Cloning...' : 'Clone Survey'}</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleExportResponses}
                                        disabled={exportingResponses}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:rounded-full sm:px-4 sm:py-2"
                                    >
                                        <FaDownload className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{exportingResponses ? 'Exporting...' : 'Export CSV'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteSurvey}
                                        disabled={deleting}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 sm:rounded-full sm:px-4 sm:py-2"
                                    >
                                        <FaTrash className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{deleting ? 'Deleting...' : 'Delete'}</span>
                                    </button>
                                </div>

                                <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:p-3.5">
                                    <div className="min-w-0 flex-1">
                                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            Status
                                        </label>
                                        <select
                                            value={statusDraft}
                                            onChange={(e) => setStatusDraft(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 sm:max-w-xs"
                                        >
                                            <option value="Draft">Draft</option>
                                            <option value="Active">Active</option>
                                            <option value="Closed">Closed</option>
                                            <option value="Archived">Archived</option>
                                        </select>
                                        {getStatusHint(statusDraft, 'survey') && (
                                            <p className="mt-1.5 text-xs leading-snug text-amber-700">
                                                {getStatusHint(statusDraft, 'survey')}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleStatusSave}
                                        disabled={saving}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 sm:w-auto sm:rounded-full sm:py-2"
                                        style={{ background: MINT_GRADIENT }}
                                    >
                                        <FaSave className="h-4 w-4" />
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {survey.startDate && (
                        <p className="mt-4 text-xs text-slate-500">
                            {new Date(survey.startDate).toLocaleDateString()} —{' '}
                            {survey.endDate
                                ? new Date(survey.endDate).toLocaleDateString()
                                : 'No end date'}
                            {' · '}
                            Audience: {survey.targetAudience}
                            {survey.targetAudience === 'Department' &&
                                survey.targetDepartments?.length > 0 &&
                                ` (${survey.targetDepartments.join(', ')})`}
                        </p>
                    )}

                    {canManage && metadataEditOpen && metadataForm && (
                        <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <p className="text-sm font-semibold text-slate-800">
                                Edit survey details
                                {(survey.responseCount || 0) > 0 && (
                                    <span className="ml-2 text-xs font-normal text-amber-700">
                                        Question structure is locked because responses exist.
                                    </span>
                                )}
                            </p>
                            <input
                                type="text"
                                value={metadataForm.title}
                                onChange={(e) =>
                                    setMetadataForm((p) => ({ ...p, title: e.target.value }))
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Title"
                            />
                            <textarea
                                value={metadataForm.description}
                                onChange={(e) =>
                                    setMetadataForm((p) => ({ ...p, description: e.target.value }))
                                }
                                rows={2}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Description"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    type="datetime-local"
                                    value={metadataForm.startDate}
                                    onChange={(e) =>
                                        setMetadataForm((p) => ({ ...p, startDate: e.target.value }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                />
                                <input
                                    type="datetime-local"
                                    value={metadataForm.endDate}
                                    onChange={(e) =>
                                        setMetadataForm((p) => ({ ...p, endDate: e.target.value }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleMetadataSave}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaSave className="h-4 w-4" />
                                {saving ? 'Saving...' : 'Save Details'}
                            </button>
                        </div>
                    )}
                </section>

                {canViewAnalytics && (
                    <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                <FaChartLine className="text-[#0d9488]" />
                                Survey Analytics
                            </h2>
                            {analytics?.scope && (
                                <span className="rounded-full bg-[#0E9370]/10 px-3 py-1 text-xs font-semibold text-[#0d9488] ring-1 ring-[#0E9370]/20">
                                    Scope:{' '}
                                    {analytics.scope === 'team'
                                        ? 'Team (direct reports)'
                                        : 'Organization'}
                                </span>
                            )}
                        </div>

                        {analyticsLoading && !analytics ? (
                            <p className="py-8 text-center text-sm text-slate-500">
                                Loading analytics...
                            </p>
                        ) : !analytics ? (
                            <p className="py-8 text-center text-sm text-slate-500">
                                Analytics unavailable.
                            </p>
                        ) : !showAnalyticsDetail ? (
                            <PrivacyBanner message={overview?.message} />
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                                        Overview / Participation
                                    </h3>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                        <StatCard label="Eligible" value={overview.eligible} />
                                        <StatCard label="Responses" value={overview.responses} />
                                        <StatCard
                                            label="Pending"
                                            value={
                                                overview.pending != null ? overview.pending : '—'
                                            }
                                        />
                                        <StatCard
                                            label="Participation"
                                            value={`${overview.participationRate}%`}
                                        />
                                        <StatCard
                                            label="Completion"
                                            value={`${overview.completionRate}%`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                                        Question Analytics
                                    </h3>
                                    <div className="space-y-3">
                                        {(analytics.questions || []).length === 0 ? (
                                            <p className="text-sm text-slate-500">
                                                No question analytics available.
                                            </p>
                                        ) : (
                                            analytics.questions.map((q, i) => (
                                                <QuestionAnalyticsBlock
                                                    key={String(q.questionId || i)}
                                                    q={q}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {analytics.eNPS?.available && (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                            eNPS
                                        </h3>
                                        <p className="mt-2 text-3xl font-bold text-slate-900">
                                            {analytics.eNPS.eNPS ?? analytics.eNPS.score}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Promoters {analytics.eNPS.promoters} (
                                            {analytics.eNPS.promoterPct}%) · Passives{' '}
                                            {analytics.eNPS.passives} ({analytics.eNPS.passivePct}
                                            %) · Detractors {analytics.eNPS.detractors} (
                                            {analytics.eNPS.detractorPct}%) · n=
                                            {analytics.eNPS.responseCount}
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                            Response Trends
                                        </h3>
                                        <div className="flex flex-wrap gap-1">
                                            {TREND_RANGES.map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => setTrendRange(r.id)}
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                        trendRange === r.id
                                                            ? 'bg-[#0E9370]/15 text-[#0d9488] ring-1 ring-[#0E9370]/30'
                                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {!analytics.trends?.available ? (
                                        <p className="text-sm text-slate-500">
                                            {analytics.trends?.message ||
                                                'No trend data in the selected range.'}
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                                            <table className="min-w-full text-left text-sm">
                                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-2">Date</th>
                                                        <th className="px-4 py-2">Responses</th>
                                                        <th className="px-4 py-2">Avg rating</th>
                                                        <th className="px-4 py-2">eNPS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(analytics.trends.points || []).map((p) => (
                                                        <tr
                                                            key={p.date}
                                                            className="border-t border-slate-100"
                                                        >
                                                            <td className="px-4 py-2 text-slate-800">
                                                                {p.date}
                                                            </td>
                                                            <td className="px-4 py-2">{p.responses}</td>
                                                            <td className="px-4 py-2">
                                                                {p.averageRating != null
                                                                    ? p.averageRating
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                {p.eNPS != null ? p.eNPS : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {analytics.privacyNote && (
                                    <p className="text-xs text-slate-500">{analytics.privacyNote}</p>
                                )}
                            </div>
                        )}
                    </section>
                )}

                <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <FaClipboardList className="text-[#0d9488]" />
                        Questions ({survey.questions?.length || 0})
                    </h2>

                    {canRespond ? (
                        <form onSubmit={handleSubmitResponse} className="space-y-6">
                            {(survey.questions || []).map((question, idx) => (
                                <div
                                    key={String(question._id || idx)}
                                    className="rounded-xl border border-slate-100 p-4"
                                >
                                    <p className="text-sm font-semibold text-slate-900">
                                        {idx + 1}. {question.question}
                                        {question.required && (
                                            <span className="ml-1 text-red-500">*</span>
                                        )}
                                    </p>
                                    <p className="mb-3 text-xs text-slate-500">{question.type}</p>
                                    {renderQuestionInput(question, idx)}
                                </div>
                            ))}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaPaperPlane />
                                {submitting ? 'Submitting...' : 'Submit Response'}
                            </button>
                        </form>
                    ) : (
                        <ul className="space-y-3">
                            {(survey.questions || []).length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    No questions in this survey yet.
                                </p>
                            ) : (
                                survey.questions.map((q, idx) => (
                                    <li
                                        key={String(q._id || idx)}
                                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                                    >
                                        <p className="font-medium text-slate-900">
                                            {idx + 1}. {q.question}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {q.type}
                                            {q.required ? ' • Required' : ''}
                                        </p>
                                    </li>
                                ))
                            )}
                        </ul>
                    )}

                    {!canRespond && (
                        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {!isEmployeeActor
                                ? 'An employee profile is required to submit a survey response.'
                                : survey.status !== 'Active'
                                  ? `This survey is not open for responses (${survey.status}).`
                                  : 'This survey is outside its active date range.'}
                        </p>
                    )}
                </section>

                {canManage && (
                    <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900">
                            Responses ({responsePagination?.total ?? responses.length})
                        </h2>
                        {responsesLoading ? (
                            <p className="text-sm text-slate-500">Loading responses...</p>
                        ) : responses.length === 0 ? (
                            <p className="text-sm text-slate-500">No responses submitted yet.</p>
                        ) : (
                            <>
                            <ul className="space-y-3">
                                {responses.map((row) => {
                                    const emp = row.employeeId || {};
                                    const label = row.isAnonymous
                                        ? 'Anonymous'
                                        : `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—';
                                    const isExpanded = expandedResponseId === row._id;
                                    const answerList = Array.isArray(row.responses)
                                        ? row.responses
                                        : [];
                                    return (
                                        <li
                                            key={row._id}
                                            className="overflow-hidden rounded-xl border border-slate-100"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedResponseId(
                                                        isExpanded ? null : row._id
                                                    )
                                                }
                                                className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left text-sm hover:bg-slate-50"
                                            >
                                                <span className="font-semibold text-slate-900">
                                                    {label}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {row.submittedAt
                                                        ? new Date(row.submittedAt).toLocaleString()
                                                        : '—'}{' '}
                                                    · {answerList.length} answers
                                                </span>
                                            </button>
                                            {isExpanded && (
                                                <div className="space-y-2 border-t border-slate-100 bg-white p-4">
                                                    {answerList.length === 0 ? (
                                                        <p className="text-xs text-slate-500">
                                                            No answer data.
                                                        </p>
                                                    ) : (
                                                        answerList.map((a, i) => (
                                                            <div
                                                                key={`${row._id}-a-${i}`}
                                                                className="rounded-lg bg-slate-50 p-3 text-sm"
                                                            >
                                                                <p className="font-medium text-slate-800">
                                                                    {a.questionText ||
                                                                        `Question ${i + 1}`}
                                                                </p>
                                                                <p className="mt-1 text-slate-600">
                                                                    {typeof a.answer === 'object'
                                                                        ? JSON.stringify(a.answer)
                                                                        : String(a.answer ?? '—')}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            {responsePagination && responsePagination.totalPages > 1 && (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-slate-500">
                                        Page {responsePagination.page} of {responsePagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={!responsePagination.hasPrev || responsesLoading}
                                            onClick={() => loadResponses(responsePage - 1)}
                                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!responsePagination.hasNext || responsesLoading}
                                            onClick={() => loadResponses(responsePage + 1)}
                                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                            </>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default SurveyDetailPage;
