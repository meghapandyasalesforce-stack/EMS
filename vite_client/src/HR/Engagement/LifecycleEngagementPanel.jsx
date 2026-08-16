import React, { useCallback, useEffect, useState } from 'react';
import { FaUserClock, FaDoorOpen, FaPoll } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { surveyStatusStyle } from './engagementUtils';

const TRIGGER_LABELS = {
    day7: 'Day 7',
    day30: 'Day 30',
    day90: 'Day 90',
    exit: 'Exit / Resignation',
};

const LifecycleEngagementPanel = () => {
    const [settings, setSettings] = useState(null);
    const [surveys, setSurveys] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [triggerFilter, setTriggerFilter] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { lifecycleOnly: true, limit: 100 };
            if (triggerFilter) params.lifecycleTrigger = triggerFilter;
            const [settingsRes, surveysRes, analyticsRes] = await Promise.allSettled([
                axios.get('/v1/admin/engagement/settings', { withCredentials: true }),
                axios.get('/v1/both/engagement/surveys', { params, withCredentials: true }),
                axios.get('/v1/both/engagement/analytics', { params: { range: '3m' }, withCredentials: true }),
            ]);
            if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data?.data || null);
            if (surveysRes.status === 'fulfilled') setSurveys(surveysRes.value.data?.data || []);
            else {
                toast.error(surveysRes.reason?.response?.data?.message || 'Failed to load lifecycle surveys');
                setSurveys([]);
            }
            if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data?.data || null);
        } finally {
            setLoading(false);
        }
    }, [triggerFilter]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return <p className="py-12 text-center text-sm text-slate-500">Loading lifecycle engagement...</p>;
    }

    const lifecycle = settings?.lifecycle || {};
    const totals = analytics?.lifecycle?.totals;
    const byTrigger = analytics?.lifecycle?.byTrigger || [];

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Automated lifecycle surveys</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            Uses the existing Survey infrastructure. Enable triggers under Engagement Settings.
                            Anonymous responses never expose employee identity in analytics.
                        </p>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            lifecycle.enabled
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        Automation {lifecycle.enabled ? 'On' : 'Off'}
                    </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {['day7', 'day30', 'day90', 'exit'].map((key) => (
                        <span
                            key={key}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                                lifecycle[key] !== false && lifecycle.enabled
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-[#20C997]/30'
                                    : 'bg-white text-slate-500 ring-slate-200'
                            }`}
                        >
                            {TRIGGER_LABELS[key]}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20C997]/10 text-[#0d9488]">
                            <FaPoll className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">Lifecycle surveys</p>
                            <p className="text-2xl font-bold text-slate-900">{totals?.surveys ?? surveys.length}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                            <FaUserClock className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">Participation</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {totals?.participationRate != null ? `${totals.participationRate}%` : '—'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                            <FaDoorOpen className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">Active now</p>
                            <p className="text-2xl font-bold text-slate-900">{totals?.active ?? '—'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {byTrigger.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {byTrigger.map((row) => (
                        <div key={row.trigger} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                                {TRIGGER_LABELS[row.trigger] || row.trigger}
                            </p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{row.surveys} surveys</p>
                            <p className="text-xs text-slate-500">
                                {row.participationAvailable && row.participationRate != null
                                    ? `${row.participationRate}% participation`
                                    : 'Participation hidden until privacy threshold'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Generated lifecycle surveys</h3>
                <select
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={triggerFilter}
                    onChange={(e) => setTriggerFilter(e.target.value)}
                >
                    <option value="">All triggers</option>
                    {Object.entries(TRIGGER_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                    ))}
                </select>
            </div>

            {surveys.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                    {lifecycle.enabled
                        ? 'No lifecycle surveys have been generated yet. They appear automatically when employees hit Day 7 / 30 / 90 or exit.'
                        : 'Lifecycle automation is off. Enable it in Engagement Settings to auto-assign Day 7 / 30 / 90 and Exit surveys.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                                <th className="py-3 pr-4">Survey</th>
                                <th className="py-3 pr-4">Trigger</th>
                                <th className="py-3 pr-4">Employee</th>
                                <th className="py-3 pr-4">Window</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3">Responses</th>
                            </tr>
                        </thead>
                        <tbody>
                            {surveys.map((s) => {
                                const emp = s.lifecycleEmployeeId;
                                const empLabel =
                                    emp && typeof emp === 'object'
                                        ? `${emp.name || ''} ${emp.lastName || ''}`.trim() || '—'
                                        : '—';
                                return (
                                    <tr key={s._id} className="border-b border-slate-50">
                                        <td className="py-3 pr-4">
                                            <p className="font-semibold text-slate-900">{s.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {s.anonymous ? 'Anonymous' : 'Identified'} · {s.type}
                                            </p>
                                        </td>
                                        <td className="py-3 pr-4 text-slate-700">
                                            {TRIGGER_LABELS[s.lifecycleTrigger] || s.lifecycleTrigger || '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-slate-700">{empLabel}</td>
                                        <td className="py-3 pr-4 text-slate-600">
                                            {s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}
                                            {' – '}
                                            {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${surveyStatusStyle(s.status)}`}
                                            >
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-slate-700">{s.responseCount ?? 0}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LifecycleEngagementPanel;
