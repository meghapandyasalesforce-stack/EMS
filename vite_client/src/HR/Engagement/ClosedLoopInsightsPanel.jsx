import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';

const statusStyle = (s) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'In Progress') return 'bg-[#20C997]/10 text-[#0d9488]';
    if (s === 'Cancelled') return 'bg-slate-100 text-slate-500';
    return 'bg-amber-100 text-amber-700';
};

const personName = (p) => `${p?.name || ''} ${p?.lastName || ''}`.trim() || 'Unassigned';

/**
 * Closed-loop Insights — action-plan follow-up table (not a second analytics dashboard).
 */
const ClosedLoopInsightsPanel = ({ onNavigateTab }) => {
    const [plans, setPlans] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sourceFilter, setSourceFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { limit: 100 };
            if (sourceFilter) params.sourceType = sourceFilter;
            if (statusFilter) params.status = statusFilter;
            const [plansRes, analyticsRes] = await Promise.allSettled([
                axios.get('/v1/both/engagement/action-plans', { params, withCredentials: true }),
                axios.get('/v1/both/engagement/analytics', { params: { range: '30d' }, withCredentials: true }),
            ]);
            if (plansRes.status === 'fulfilled') {
                setPlans(plansRes.value.data?.data || []);
            } else {
                toast.error(plansRes.reason?.response?.data?.message || 'Failed to load insights');
                setPlans([]);
            }
            if (analyticsRes.status === 'fulfilled') {
                setSummary(analyticsRes.value.data?.data?.closedLoop?.actionPlans || null);
            } else {
                setSummary(null);
            }
        } finally {
            setLoading(false);
        }
    }, [sourceFilter, statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return <p className="py-12 text-center text-sm text-slate-500">Loading closed-loop insights...</p>;
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Closed-loop follow-up</p>
                <p className="mt-0.5 text-xs text-slate-600">
                    This view tracks insight → action plan → owner → due date → completion.
                    It is not the organization analytics dashboard.
                </p>
                {summary && (
                    <p className="mt-2 text-xs font-medium text-slate-600">
                        Closure rate:{' '}
                        <span className="text-slate-900">
                            {summary.closureRate != null ? `${summary.closureRate}%` : '—'}
                        </span>
                        {' · '}
                        Open: <span className="text-slate-900">{summary.openOrInProgress ?? 0}</span>
                        {' · '}
                        Completed: <span className="text-slate-900">{summary.completed ?? 0}</span>
                        {' · '}
                        Overdue: <span className="text-slate-900">{summary.overdue ?? 0}</span>
                        {summary.followUpCompletionRate != null && (
                            <>
                                {' · '}
                                Follow-up done:{' '}
                                <span className="text-slate-900">{summary.followUpCompletionRate}%</span>
                            </>
                        )}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                    >
                        <option value="">All insight sources</option>
                        {['Survey', 'Pulse', 'Feedback', 'Suggestion', 'Manual'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {['Open', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                {typeof onNavigateTab === 'function' && (
                    <button
                        type="button"
                        onClick={() => onNavigateTab('actions')}
                        className="rounded-full px-4 py-2 text-xs font-semibold text-white"
                        style={{ background: MINT_GRADIENT }}
                    >
                        Manage action plans
                    </button>
                )}
            </div>

            {plans.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                    No closed-loop action plans yet. Create an action plan from a survey, pulse, feedback, or suggestion insight.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                    <table className="w-full min-w-[860px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase text-slate-500">
                                <th className="px-4 py-3 pr-4">Insight identified</th>
                                <th className="py-3 pr-4">Action plan</th>
                                <th className="py-3 pr-4">Owner</th>
                                <th className="py-3 pr-4">Due</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Follow-up</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((p) => (
                                <tr key={p._id} className="border-b border-slate-50 align-top">
                                    <td className="px-4 py-3 pr-4">
                                        <p className="font-semibold text-slate-900">{p.insightLabel || p.title}</p>
                                        <p className="text-xs text-slate-500">{p.insightDetail || p.sourceType}</p>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <p className="font-medium text-slate-800">{p.title}</p>
                                        {p.department && (
                                            <p className="text-xs text-slate-500">{p.department}</p>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4 text-slate-700">{personName(p.owner)}</td>
                                    <td className="py-3 pr-4">
                                        <span className={p.isOverdue ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                                            {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                                        </span>
                                        {p.isOverdue && (
                                            <span className="mt-1 block text-xs font-semibold text-amber-600">Overdue</span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(p.status)}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 text-xs text-slate-600">
                                        {p.followUpCompleted
                                            ? 'Completed after insight'
                                            : p.status === 'Completed'
                                              ? 'Completed'
                                              : p.isOverdue
                                                ? 'Needs attention'
                                                : 'In progress'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ClosedLoopInsightsPanel;
