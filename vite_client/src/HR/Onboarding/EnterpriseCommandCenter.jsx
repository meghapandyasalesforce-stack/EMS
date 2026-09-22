import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
    FaArrowDown, FaArrowUp, FaClipboardList, FaFileAlt, FaLaptop,
    FaSync, FaTasks, FaUserCheck,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { getSocketIOUrl } from '../../utils/socketUrl';
import { getTokenFromCookie } from '../../utils/authHelper';
import LoadingSpinner from '../../components/LoadingSpinner';

const REFRESH_OPTIONS = [
    { label: '30s', ms: 30000 },
    { label: '1m', ms: 60000 },
    { label: '2m', ms: 120000 },
    { label: 'Off', ms: 0 },
];

function trendFromSeries(series = [], valueKey = 'count') {
    if (!Array.isArray(series) || series.length < 2) return { dir: 'flat', delta: 0 };
    const a = Number(series[series.length - 2]?.[valueKey] || 0);
    const b = Number(series[series.length - 1]?.[valueKey] || 0);
    const delta = b - a;
    return { dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', delta: Math.abs(delta) };
}

function formatTime(d) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return '—';
    }
}

function KpiTile({ label, value, trend, updatedAt, onClick, icon: Icon, accent = 'primary' }) {
    const accentCls = {
        primary: 'border-theme-primary/30 hover:border-theme-primary',
        amber: 'border-amber-200 hover:border-amber-400',
        red: 'border-red-200 hover:border-red-400',
        blue: 'border-blue-200 hover:border-blue-400',
    }[accent] || 'border-gray-200';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border bg-white p-3 text-left shadow-sm transition ${accentCls} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 leading-tight">{label}</p>
                {Icon && <Icon className="shrink-0 text-theme-primary/70 text-sm" />}
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value ?? '—'}</p>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-0.5">
                    {trend?.dir === 'up' && <FaArrowUp className="text-emerald-500" />}
                    {trend?.dir === 'down' && <FaArrowDown className="text-red-500" />}
                    {trend?.dir === 'flat' && <span className="text-gray-400">—</span>}
                    {trend?.delta ? `${trend.delta}` : 'stable'}
                </span>
                <span>upd {formatTime(updatedAt)}</span>
            </div>
        </button>
    );
}

/**
 * Enterprise Lifecycle Command Center — lean operational overview.
 * Parent may still pass bulkEnabled / notifEnabled; those live on dedicated tabs.
 */
const EnterpriseCommandCenter = ({
    isEnabled,
    onNavigateTab,
}) => {
    const [, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [refreshMs, setRefreshMs] = useState(60000);
    const [lastSync, setLastSync] = useState(null);
    const [reports, setReports] = useState(null);
    const [executive, setExecutive] = useState(null);
    const [hrDash, setHrDash] = useState(null);
    const [recruitment, setRecruitment] = useState(null);
    const [itInventory, setItInventory] = useState(null);
    const [probation, setProbation] = useState(null);

    const openQuery = useCallback((updates) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([k, v]) => {
                if (v == null || v === false) next.delete(k);
                else next.set(k, String(v));
            });
            return next;
        }, { replace: false });
    }, [setSearchParams]);

    const loadAll = useCallback(async ({ soft = false } = {}) => {
        if (!soft) setLoading(true);
        const settled = async (promise) => {
            try {
                return await promise;
            } catch {
                return null;
            }
        };

        const [
            reportsRes,
            execRes,
            hrRes,
            recRes,
            itRes,
            probationRes,
        ] = await Promise.all([
            settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/reports/dashboard`).then((r) => r.data.data)),
            isEnabled('enterpriseDashboards')
                ? settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/executive`).then((r) => r.data.data))
                : null,
            isEnabled('enterpriseDashboards')
                ? settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/hr`).then((r) => r.data.data))
                : null,
            isEnabled('enterpriseDashboards')
                ? settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/recruitment`).then((r) => r.data.data))
                : null,
            (isEnabled('softwareAccessRequest') || isEnabled('itAssetProvisioning'))
                ? settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/it/inventory`).then((r) => r.data.data))
                : null,
            (isEnabled('probationCenter') || isEnabled('probation'))
                ? settled(axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/probation/center`).then((r) => r.data.data))
                : null,
        ]);

        if (reportsRes) setReports(reportsRes);
        if (execRes) setExecutive(execRes);
        if (hrRes) setHrDash(hrRes);
        if (recRes) setRecruitment(recRes);
        if (itRes) setItInventory(itRes);
        if (probationRes) setProbation(probationRes);
        setLastSync(new Date());
        setLoading(false);
    }, [isEnabled]);

    useEffect(() => { loadAll(); }, [loadAll]);

    useEffect(() => {
        if (!refreshMs) return undefined;
        const id = setInterval(() => loadAll({ soft: true }), refreshMs);
        return () => clearInterval(id);
    }, [refreshMs, loadAll]);

    useEffect(() => {
        const socketUrl = getSocketIOUrl();
        if (!socketUrl) return undefined;
        const token = getTokenFromCookie();
        const socket = io(socketUrl, {
            path: '/socket.io',
            withCredentials: true,
            auth: token ? { token } : {},
            transports: ['websocket', 'polling'],
        });
        let t;
        const refresh = () => {
            clearTimeout(t);
            t = setTimeout(() => loadAll({ soft: true }), 500);
        };
        socket.on('onboarding:changed', refresh);
        socket.on('offboarding:changed', refresh);
        socket.on('notification', refresh);
        return () => {
            clearTimeout(t);
            socket.off('onboarding:changed', refresh);
            socket.off('offboarding:changed', refresh);
            socket.off('notification', refresh);
            socket.disconnect();
        };
    }, [loadAll]);

    const onboarding = reports?.onboarding;
    const offboarding = reports?.offboarding;
    const offers = reports?.offerAnalytics;
    const bgv = reports?.bgvAnalytics;

    const kpis = useMemo(() => {
        const joinTrend = trendFromSeries(onboarding?.joiningTrend || executive?.charts?.monthlyJoiners || []);
        const exitTrend = trendFromSeries(offboarding?.monthlyTrend || executive?.charts?.monthlyLeavers || []);

        const bgvPending = (() => {
            const rows = Array.isArray(bgv?.byStatus) ? bgv.byStatus : [];
            return rows
                .filter((r) => /pend|in.?progress|initiated|open/i.test(String(r.status || '')))
                .reduce((s, r) => s + (r.count || 0), 0);
        })();

        const offerPending = (() => {
            const rows = Array.isArray(offers?.byStatus) ? offers.byStatus : [];
            const fromOffers = rows
                .filter((r) => /pend|sent|view|draft/i.test(String(r.status || '')))
                .reduce((s, r) => s + (r.count || 0), 0);
            return fromOffers || executive?.kpis?.offersPending || recruitment?.kpis?.totalOffers || 0;
        })();

        const exitPending = offboarding?.exitInterview?.pending
            ?? offboarding?.exitInterview?.summary?.pending
            ?? offboarding?.exitInterview?.byStatus?.find?.((s) => /pend|sched/i.test(s.status))?.count
            ?? 0;

        const showIt = isEnabled('softwareAccessRequest') || isEnabled('itAssetProvisioning');
        const showProbation = isEnabled('probationCenter') || isEnabled('probation');

        const tiles = [
            {
                key: 'onb',
                label: 'Active Onboarding',
                value: onboarding?.summary?.inProgress ?? executive?.kpis?.activeOnboarding ?? 0,
                trend: joinTrend,
                icon: FaClipboardList,
                action: () => openQuery({ enterprise: null, lifecycle: null }),
            },
            {
                key: 'off',
                label: 'Active Offboarding',
                value: offboarding?.summary?.active ?? executive?.kpis?.activeOffboarding ?? 0,
                trend: exitTrend,
                icon: FaTasks,
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                key: 'offers',
                label: 'Pending Offers',
                value: offerPending,
                trend: { dir: 'flat', delta: 0 },
                icon: FaFileAlt,
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                key: 'docs',
                label: 'Pending Documents',
                value: onboarding?.documentCompletion?.pending ?? 0,
                trend: { dir: 'flat', delta: 0 },
                accent: 'amber',
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                key: 'bgv',
                label: 'Pending BGV',
                value: bgvPending,
                trend: { dir: 'flat', delta: 0 },
                accent: 'amber',
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                key: 'exit',
                label: 'Pending Exit Interviews',
                value: exitPending,
                trend: { dir: 'flat', delta: 0 },
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                key: 'fnf',
                label: 'Pending F&F',
                value: offboarding?.fnf?.pending ?? 0,
                trend: { dir: 'flat', delta: 0 },
                accent: 'red',
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
        ];

        if (showIt) {
            tiles.push({
                key: 'it',
                label: 'Pending IT Provisioning',
                value: itInventory?.totals?.pending ?? hrDash?.kpis?.softwarePending ?? 0,
                trend: { dir: 'flat', delta: 0 },
                icon: FaLaptop,
                action: () => onNavigateTab?.('it'),
            });
        }

        if (showProbation) {
            tiles.push({
                key: 'prob',
                label: 'Active Probations',
                value: probation?.dashboard?.active ?? executive?.kpis?.probationActive ?? hrDash?.kpis?.probationActive ?? 0,
                trend: { dir: 'flat', delta: 0 },
                icon: FaUserCheck,
                action: () => onNavigateTab?.('probation'),
            });
        }

        return tiles;
    }, [
        onboarding, offboarding, offers, bgv, executive, recruitment, itInventory, hrDash, probation,
        openQuery, onNavigateTab, isEnabled,
    ]);

    const pendingActions = useMemo(() => {
        const rows = [
            {
                title: 'Pending offers',
                count: kpis.find((k) => k.key === 'offers')?.value || 0,
                priority: 'High',
                due: 'Today',
                assignee: 'HR',
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                title: 'Pending BGV',
                count: kpis.find((k) => k.key === 'bgv')?.value || 0,
                priority: 'High',
                due: 'This week',
                assignee: 'HR',
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                title: 'Pending documents',
                count: kpis.find((k) => k.key === 'docs')?.value || 0,
                priority: 'Medium',
                due: 'This week',
                assignee: 'HR',
                action: () => openQuery({ reports: '1', enterprise: null }),
            },
            {
                title: 'Pending exit interviews',
                count: kpis.find((k) => k.key === 'exit')?.value || 0,
                priority: 'Medium',
                due: 'Before LWD',
                assignee: 'HR',
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                title: 'Pending clearance',
                count: Math.max(0, (offboarding?.clearance?.total || 0) - (offboarding?.clearance?.completed || 0)),
                priority: 'High',
                due: 'Before LWD',
                assignee: 'Managers',
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                title: 'Pending assets',
                count: offboarding?.assetReturn?.pending || 0,
                priority: 'High',
                due: 'Before LWD',
                assignee: 'IT',
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                title: 'Pending F&F',
                count: offboarding?.fnf?.pending || 0,
                priority: 'Critical',
                due: 'Payroll cycle',
                assignee: 'Finance',
                action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }),
            },
            {
                title: 'Pending software requests',
                count: itInventory?.totals?.pending || 0,
                priority: 'Medium',
                due: 'Joining week',
                assignee: 'IT',
                action: () => onNavigateTab?.('it'),
            },
        ];
        return rows.filter((r) => Number(r.count) > 0).slice(0, 8);
    }, [kpis, offboarding, itInventory, openQuery, onNavigateTab]);

    const joinChart = (onboarding?.joiningTrend || executive?.charts?.monthlyJoiners || []).map((r) => ({
        name: r.label || r.name || `${r.month || ''}`,
        value: r.count ?? r.value ?? 0,
    }));
    const onbStatusChart = (onboarding?.byStatus || executive?.charts?.onboardingByStatus || []).map((r) => ({
        name: r.status || r.name,
        value: r.count ?? r.value ?? 0,
    }));

    if (loading && !reports && !executive) {
        return <LoadingSpinner message="Loading enterprise command center..." />;
    }

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-900">Lifecycle Command Center</h2>
                    <p className="text-xs text-gray-500">
                        Live operational overview · Last sync {formatTime(lastSync)}
                        {reports?.generatedAt ? ` · Data ${formatTime(reports.generatedAt)}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-gray-500">
                        Auto-refresh
                        <select
                            value={refreshMs}
                            onChange={(e) => setRefreshMs(Number(e.target.value))}
                            className="ml-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        >
                            {REFRESH_OPTIONS.map((o) => (
                                <option key={o.label} value={o.ms}>{o.label}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={() => loadAll()}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <FaSync className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                {kpis.map((k) => (
                    <KpiTile
                        key={k.key}
                        label={k.label}
                        value={k.value}
                        trend={k.trend}
                        updatedAt={lastSync}
                        onClick={k.action}
                        icon={k.icon}
                        accent={k.accent}
                    />
                ))}
            </div>

            {/* Pending Actions */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Pending Actions</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {pendingActions.map((row) => (
                        <div key={row.title} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-gray-900">{row.title}</p>
                                <p className="text-[11px] text-gray-500">
                                    {row.count} · {row.priority} · Due {row.due} · {row.assignee}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={row.action}
                                className="shrink-0 rounded-md bg-theme-primary px-2.5 py-1 text-[11px] font-medium text-white"
                            >
                                Open
                            </button>
                        </div>
                    ))}
                    {!pendingActions.length && (
                        <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-3">No pending queues right now.</p>
                    )}
                </div>
            </section>

            {/* Charts */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Trends</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-52">
                        <p className="mb-1 text-xs text-gray-500">Joining trend</p>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={joinChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#0d9488" fill="#0d948833" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="h-52">
                        <p className="mb-1 text-xs text-gray-500">Onboarding by status</p>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={onbStatusChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>

            {/* Quick Actions */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {[
                        { label: 'Onboarding workflows', onClick: () => openQuery({ enterprise: null, lifecycle: null }) },
                        { label: 'Offboarding workflows', onClick: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
                        { label: 'Open Reports', onClick: () => openQuery({ reports: '1', enterprise: null }) },
                        { label: 'Configure Lifecycle', onClick: () => openQuery({ configure: '1', enterprise: null }) },
                    ].map((a) => (
                        <button
                            key={a.label}
                            type="button"
                            onClick={a.onClick}
                            className="rounded-lg border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 hover:border-theme-primary hover:bg-theme-primary/5"
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default EnterpriseCommandCenter;
