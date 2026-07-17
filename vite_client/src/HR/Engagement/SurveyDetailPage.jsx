import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft,
    FaChartLine,
    FaClipboardList,
    FaSave,
    FaPaperPlane,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MINT_GRADIENT } from '../Reports/constants';
import { canManageEngagement, surveyStatusStyle } from './engagementUtils';

const SurveyDetailPage = () => {
    const { surveyId } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isManagerUser = useMemo(() => canManageEngagement(user, employee), [user, employee]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [survey, setSurvey] = useState(null);
    const [responses, setResponses] = useState([]);
    const [statusDraft, setStatusDraft] = useState('Draft');
    const [answers, setAnswers] = useState({});
    const [expandedResponseId, setExpandedResponseId] = useState(null);

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

        if (isManagerUser) {
            try {
                const res = await axios.get(`/v1/admin/engagement/surveys/${surveyId}/responses`, {
                    withCredentials: true,
                });
                setResponses(res.data?.data || []);
            } catch {
                setResponses([]);
            }
        }
    }, [surveyId, isManagerUser]);

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

    const surveyIsOpen = useMemo(() => {
        if (!survey || survey.status !== 'Active') return false;
        const now = Date.now();
        if (survey.startDate && new Date(survey.startDate).getTime() > now) return false;
        if (survey.endDate && new Date(survey.endDate).getTime() < now) return false;
        return true;
    }, [survey]);

    const canRespond = !isManagerUser && surveyIsOpen;

    const handleStatusSave = async () => {
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/surveys/${surveyId}`,
                { status: statusDraft },
                { withCredentials: true }
            );
            toast.success('Survey status updated');
            await loadSurvey();
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
            navigate('/engagement');
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
                                className="text-[#20C997]"
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
                                    ? 'border-[#20C997] bg-[#20C997]/10 text-[#0d9488]'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            );
        }

        if (question.type === 'Rating' || question.type === 'Scale') {
            return (
                <input
                    type="number"
                    min={1}
                    max={10}
                    value={value}
                    onChange={(e) => setAnswer(qid, Number(e.target.value))}
                    className="w-full max-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
            );
        }

        return (
            <textarea
                value={value}
                onChange={(e) => setAnswer(qid, e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20"
                placeholder="Your answer..."
            />
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F5F7FB]">
                <LoadingSpinner message="Loading survey..." />
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
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

    return (
        <div className="page-shell min-h-[calc(100vh-64px)] bg-[#F5F7FB]">
            <div className="page-shell-inner hrms-stack">
                <button
                    type="button"
                    onClick={() => navigate('/engagement')}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    <FaArrowLeft className="text-xs" /> Back
                </button>

                <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                                style={{ background: MINT_GRADIENT }}
                            >
                                <FaChartLine className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{survey.title}</h1>
                                <p className="mt-1 text-sm text-slate-600">{survey.description}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
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
                                    <span className="text-xs text-slate-500">
                                        {survey.responseCount || 0} responses
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isManagerUser && (
                            <div className="flex flex-wrap items-end gap-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                                        Status
                                    </label>
                                    <select
                                        value={statusDraft}
                                        onChange={(e) => setStatusDraft(e.target.value)}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Active">Active</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Archived">Archived</option>
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleStatusSave}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    <FaSave className="h-4 w-4" />
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>

                    {survey.startDate && (
                        <p className="mt-4 text-xs text-slate-500">
                            {new Date(survey.startDate).toLocaleDateString()} —{' '}
                            {survey.endDate ? new Date(survey.endDate).toLocaleDateString() : 'No end date'}
                        </p>
                    )}
                </section>

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
                                <p className="text-sm text-slate-500">No questions in this survey yet.</p>
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

                    {!isManagerUser && !canRespond && (
                        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {survey.status !== 'Active'
                                ? `This survey is not open for responses (${survey.status}).`
                                : 'This survey is outside its active date range.'}
                        </p>
                    )}
                </section>

                {isManagerUser && (
                    <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                        <h2 className="mb-4 text-lg font-semibold text-slate-900">
                            Responses ({responses.length})
                        </h2>
                        {responses.length === 0 ? (
                            <p className="text-sm text-slate-500">No responses submitted yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {responses.map((row) => {
                                    const emp = row.employeeId || {};
                                    const label = row.isAnonymous
                                        ? 'Anonymous'
                                        : `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—';
                                    const isExpanded = expandedResponseId === row._id;
                                    const answerList = Array.isArray(row.responses) ? row.responses : [];
                                    return (
                                        <li
                                            key={row._id}
                                            className="overflow-hidden rounded-xl border border-slate-100"
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedResponseId(isExpanded ? null : row._id)
                                                }
                                                className="flex w-full items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left text-sm hover:bg-slate-50"
                                            >
                                                <span className="font-semibold text-slate-900">{label}</span>
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
                                                        <p className="text-xs text-slate-500">No answer data.</p>
                                                    ) : (
                                                        answerList.map((a, i) => (
                                                            <div
                                                                key={`${row._id}-a-${i}`}
                                                                className="rounded-lg bg-slate-50 p-3 text-sm"
                                                            >
                                                                <p className="font-medium text-slate-800">
                                                                    {a.questionText || `Question ${i + 1}`}
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
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default SurveyDetailPage;
