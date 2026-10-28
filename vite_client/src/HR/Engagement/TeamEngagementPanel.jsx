import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaUsers, FaPoll, FaChartBar, FaComments, FaAward, FaShieldAlt } from 'react-icons/fa';
import axios from '../../utils/axios';

const MINT = '#0E9370';

/**
 * Manager-only team summary — intentionally simpler than the org Dashboard.
 * Direct reports only; anonymous identities are never shown.
 */
const TeamEngagementPanel = ({ onNavigateTab }) => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await axios.get('/v1/both/engagement/analytics', {
                params: { range: '30d', scope: 'team' },
                withCredentials: true,
            });
            setAnalytics(data?.data || null);
        } catch (err) {
            setAnalytics(null);
            setError(err.response?.data?.message || 'Failed to load team engagement');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const participation = useMemo(() => {
        if (analytics?.surveys?.participationRate == null) return '—';
        return `${Number(analytics.surveys.participationRate).toFixed(0)}%`;
    }, [analytics]);

    if (loading) {
        return <p className="py-12 text-center text-sm text-slate-500">Loading team engagement...</p>;
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-800">{error}</p>
                <button
                    type="button"
                    onClick={load}
                    className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-xs font-semibold text-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    const enpsOk = analytics?.eNPSDetail?.available;
    const teamSize = analytics?.surveys?.teamSize;

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                        <FaUsers className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">My Team summary</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                            Metrics for your direct reports only — not the full organization dashboard.
                            Anonymous responses are excluded so individuals cannot be identified.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    {
                        label: 'Team size',
                        value: teamSize ?? '—',
                        icon: FaUsers,
                        accent: '#0ea5e9',
                        tab: null,
                    },
                    {
                        label: 'Participation',
                        value: participation,
                        icon: FaPoll,
                        accent: MINT,
                        tab: 'surveys',
                    },
                    {
                        label: 'Team eNPS',
                        value: enpsOk ? analytics.eNPS : '—',
                        icon: FaChartBar,
                        accent: '#0ea5e9',
                        tab: 'surveys',
                        muted: !enpsOk,
                    },
                    {
                        label: 'Open feedback',
                        value: analytics?.openFeedback ?? '—',
                        icon: FaComments,
                        accent: '#8b5cf6',
                        tab: 'feedback',
                    },
                    {
                        label: 'Recognition',
                        value: analytics?.recognitionCount ?? '—',
                        icon: FaAward,
                        accent: '#f59e0b',
                        tab: 'recognition',
                    },
                ].map((card) => (
                    <button
                        key={card.label}
                        type="button"
                        disabled={!card.tab || typeof onNavigateTab !== 'function'}
                        onClick={() => card.tab && onNavigateTab(card.tab)}
                        className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-sky-200 disabled:cursor-default"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {card.label}
                                </p>
                                <p
                                    className={`mt-1 text-2xl font-bold ${
                                        card.muted ? 'text-slate-400' : 'text-slate-900'
                                    }`}
                                >
                                    {card.value}
                                </p>
                            </div>
                            <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${card.accent}18`, color: card.accent }}
                            >
                                <card.icon className="h-4 w-4" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {enpsOk && analytics?.eNPSDetail && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-800">Team eNPS breakdown</h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Based on {analytics.eNPSDetail.responseCount} identified team responses
                        (min. {analytics.minResponses ?? 5} required).
                    </p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>
                            Promoters:{' '}
                            <strong className="text-slate-900">{analytics.eNPSDetail.promoters ?? 0}</strong>
                        </span>
                        <span>
                            Passives:{' '}
                            <strong className="text-slate-900">{analytics.eNPSDetail.passives ?? 0}</strong>
                        </span>
                        <span>
                            Detractors:{' '}
                            <strong className="text-slate-900">{analytics.eNPSDetail.detractors ?? 0}</strong>
                        </span>
                    </div>
                </div>
            )}

            {!enpsOk && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                    <FaShieldAlt className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        {analytics?.eNPSDetail?.message ||
                            'Not enough team responses yet to show detailed eNPS. Keep the privacy threshold in mind.'}
                    </p>
                </div>
            )}

            {analytics?.privacyNote && (
                <p className="text-xs text-slate-500">{analytics.privacyNote}</p>
            )}
        </div>
    );
};

export default TeamEngagementPanel;
