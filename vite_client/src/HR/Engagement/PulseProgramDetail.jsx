import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    FaArrowLeft, FaPlay, FaPause, FaRedo, FaArchive, FaEdit, FaChartBar, FaHistory, FaExternalLinkAlt
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EngagementFormShell from './EngagementFormShell';

const MINT = '#0E9370';

const statusStyle = (s) => {
    if (s === 'Active') return 'bg-emerald-100 text-emerald-700';
    if (s === 'Draft') return 'bg-amber-100 text-amber-700';
    if (s === 'Paused') return 'bg-orange-100 text-orange-700';
    if (s === 'Completed') return 'bg-blue-100 text-blue-700';
    if (s === 'Archived') return 'bg-slate-100 text-slate-500';
    return 'bg-slate-100 text-slate-600';
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const PulseProgramDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [program, setProgram] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'overview');

    const [history, setHistory] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const fetchProgram = useCallback(async () => {
        try {
            const { data } = await axios.get(`/v1/admin/engagement/pulse-programs/${id}`);
            setProgram(data.data);
        } catch {
            toast.error('Failed to load pulse program');
            navigate('/engagement');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    const fetchHistory = useCallback(async () => {
        if (history) return;
        setHistoryLoading(true);
        try {
            const { data } = await axios.get(`/v1/admin/engagement/pulse-programs/${id}/history`);
            setHistory(data.data);
        } catch {
            toast.error('Failed to load history');
        } finally {
            setHistoryLoading(false);
        }
    }, [id, history]);

    const fetchAnalytics = useCallback(async () => {
        if (analytics) return;
        setAnalyticsLoading(true);
        try {
            const { data } = await axios.get(`/v1/admin/engagement/pulse-programs/${id}/analytics`);
            setAnalytics(data.data);
        } catch {
            toast.error('Failed to load analytics');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [id, analytics]);

    useEffect(() => { fetchProgram(); }, [fetchProgram]);

    useEffect(() => {
        if (activeTab === 'history') fetchHistory();
        if (activeTab === 'analytics') fetchAnalytics();
    }, [activeTab, fetchHistory, fetchAnalytics]);

    const handleAction = async (action, verb) => {
        try {
            await axios.post(`/v1/admin/engagement/pulse-programs/${id}/${action}`);
            toast.success(`Program ${verb}`);
            fetchProgram();
        } catch (err) {
            toast.error(err?.response?.data?.message || `Failed to ${verb}`);
        }
    };

    if (loading) return <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-transparent"><LoadingSpinner /></div>;
    if (!program) return null;

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'questions', label: `Questions (${program.questions?.length || 0})` },
        { id: 'history', label: 'History' },
        { id: 'analytics', label: 'Analytics' },
    ];

    return (
        <EngagementFormShell
            title={program.name}
            subtitle={`${program.frequency} Pulse Program`}
            onBack={() => navigate('/engagement', { state: { tab: 'pulse' } })}
        >
            {/* Status + Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${statusStyle(program.status)}`}>
                    {program.status}
                </span>
                {program.status === 'Draft' && (
                    <>
                        <button onClick={() => navigate(`/engagement/pulse/${id}/edit`)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FaEdit className="h-3 w-3" />Edit</button>
                        <button onClick={() => handleAction('activate', 'activated')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ background: MINT }}><FaPlay className="h-3 w-3" />Activate</button>
                    </>
                )}
                {program.status === 'Active' && (
                    <button onClick={() => handleAction('pause', 'paused')} className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 px-4 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"><FaPause className="h-3 w-3" />Pause</button>
                )}
                {program.status === 'Paused' && (
                    <>
                        <button onClick={() => handleAction('resume', 'resumed')} className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ background: MINT }}><FaRedo className="h-3 w-3" />Resume</button>
                        <button onClick={() => navigate(`/engagement/pulse/${id}/edit`)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FaEdit className="h-3 w-3" />Edit</button>
                    </>
                )}
                {['Paused', 'Completed', 'Draft'].includes(program.status) && (
                    <button onClick={() => handleAction('archive', 'archived')} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"><FaArchive className="h-3 w-3" />Archive</button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 rounded-xl bg-slate-50 p-1.5">
                {tabs.map((t) => (
                    <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === t.id ? 'bg-white shadow-sm text-[#0d9488]' : 'text-slate-600 hover:bg-white/60'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        {[
                            ['Frequency', program.frequency],
                            ['Target Audience', program.targetAudience],
                            ['Anonymous', program.anonymous ? 'Yes' : 'No'],
                            ['Start Date', fmtDate(program.startDate)],
                            ['End Date', fmtDate(program.endDate)],
                            ['Max Occurrences', program.maxOccurrences ?? '—'],
                            ['Occurrences Created', program.occurrenceCount],
                            ['Next Pulse', fmtDate(program.nextRunAt)],
                            ['Last Pulse', fmtDate(program.lastRunAt)],
                            ['Reminders', program.reminderEnabled ? `Enabled (${program.reminderDaysBefore}d before)` : 'Disabled'],
                            ['Survey Duration', `${program.openDurationDays} days`],
                        ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-slate-50 pb-2 text-sm">
                                <span className="font-medium text-slate-600">{k}</span>
                                <span className="text-slate-900">{v}</span>
                            </div>
                        ))}
                        {program.description && (
                            <div className="pt-2">
                                <p className="text-xs font-semibold uppercase text-slate-500">Description</p>
                                <p className="text-sm text-slate-700 mt-1">{program.description}</p>
                            </div>
                        )}
                        {program.lastGenerationError && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                <strong>Last error:</strong> {program.lastGenerationError}
                            </div>
                        )}
                    </div>
                    {program.targetAudience !== 'All Employees' && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase text-slate-500">Target Details</p>
                            {program.targetAudience === 'Department' && program.targetDepartments?.length > 0 && (
                                <div className="flex flex-wrap gap-2">{program.targetDepartments.map((d) => <span key={d} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{d}</span>)}</div>
                            )}
                            {program.targetAudience === 'Role' && program.targetRoles?.length > 0 && (
                                <p className="text-sm text-slate-600">{program.targetRoles.length} role(s) selected</p>
                            )}
                            {program.targetAudience === 'Specific Employees' && program.targetEmployees?.length > 0 && (
                                <p className="text-sm text-slate-600">{program.targetEmployees.length} employee(s) selected</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Questions */}
            {activeTab === 'questions' && (
                <div className="space-y-3">
                    {(program.questions || []).map((q, i) => (
                        <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-slate-500">Q{i + 1}</span>
                                {q.required && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Required</span>}
                                <span className="text-xs bg-[#0E9370]/10 text-[#0d9488] px-2 py-0.5 rounded">{q.type}</span>
                            </div>
                            <p className="font-medium text-slate-800">{q.question}</p>
                            {q.options?.filter(Boolean).length > 0 && !['Text', 'Yes/No', 'eNPS', 'Rating'].includes(q.type) && (
                                <ul className="mt-1 list-disc list-inside text-sm text-slate-600 ml-2">
                                    {q.options.map((o, oi) => <li key={oi}>{o}</li>)}
                                </ul>
                            )}
                        </div>
                    ))}
                    {!program.questions?.length && <p className="py-8 text-center text-sm text-slate-500">No questions configured.</p>}
                </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
                historyLoading ? <LoadingSpinner /> : history ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">{history.occurrences.length} occurrence(s) generated</p>
                        {history.occurrences.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">No occurrences generated yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                                            <th className="py-3 pr-4">Period</th>
                                            <th className="py-3 pr-4">Status</th>
                                            <th className="py-3 pr-4">Responses</th>
                                            <th className="py-3 pr-4">Invited</th>
                                            <th className="py-3 pr-4">Participation</th>
                                            <th className="py-3 pr-4">Start</th>
                                            <th className="py-3 pr-4">End</th>
                                            <th className="py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.occurrences.map((o) => (
                                            <tr key={o.surveyId} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                <td className="py-3 pr-4 font-medium text-slate-900">{o.period}</td>
                                                <td className="py-3 pr-4">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle(o.status)}`}>{o.status}</span>
                                                </td>
                                                <td className="py-3 pr-4 text-slate-600">{o.responseCount}</td>
                                                <td className="py-3 pr-4 text-slate-600">{o.totalInvites}</td>
                                                <td className="py-3 pr-4 text-slate-600">{o.participationRate}%</td>
                                                <td className="py-3 pr-4 text-slate-600">{fmtDate(o.startDate)}</td>
                                                <td className="py-3 pr-4 text-slate-600">{fmtDate(o.endDate)}</td>
                                                <td className="py-3">
                                                    <button onClick={() => navigate(`/engagement/surveys/${o.surveyId}`)}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0d9488] hover:underline">
                                                        <FaExternalLinkAlt className="h-3 w-3" /> View Survey
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null
            )}

            {/* Analytics */}
            {activeTab === 'analytics' && (
                analyticsLoading ? <LoadingSpinner /> : analytics ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">Aggregate metrics across {analytics.occurrences.length} occurrence(s). Minimum {analytics.minResponses} responses required.</p>
                        {analytics.occurrences.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">No occurrences to analyze.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                                            <th className="py-3 pr-4">Period</th>
                                            <th className="py-3 pr-4">Responses</th>
                                            <th className="py-3 pr-4">Participation</th>
                                            <th className="py-3 pr-4">eNPS</th>
                                            <th className="py-3 pr-4">Avg Rating</th>
                                            <th className="py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.occurrences.map((o) => (
                                            <tr key={o.surveyId} className="border-b border-slate-50 hover:bg-slate-50/50">
                                                <td className="py-3 pr-4 font-medium text-slate-900">{o.period}</td>
                                                <td className="py-3 pr-4 text-slate-600">
                                                    {o.available ? o.responseCount : <span className="italic text-slate-400">Below threshold</span>}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-600">
                                                    {o.available && o.participation != null ? `${o.participation}%` : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-600">
                                                    {o.available && o.eNPS != null ? o.eNPS : '—'}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-600">
                                                    {o.available && o.avgRating != null ? o.avgRating : '—'}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle(o.status)}`}>{o.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null
            )}
        </EngagementFormShell>
    );
};

export default PulseProgramDetail;
