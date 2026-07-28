import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
    FaArrowDown, FaArrowUp, FaBell, FaCheckCircle, FaClipboardList, FaCog, FaExclamationTriangle,
    FaFileAlt, FaGraduationCap, FaLaptop, FaSync, FaTasks, FaUserCheck, FaUsers,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { getSocketIOUrl } from '../../utils/socketUrl';
import { getTokenFromCookie } from '../../utils/authHelper';
import LoadingSpinner from '../../components/LoadingSpinner';

const CHART_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#3b82f6'];
const REFRESH_OPTIONS = [
    { label: '30s', ms: 30000 },
    { label: '1m', ms: 60000 },
    { label: '2m', ms: 120000 },
    { label: 'Off', ms: 0 },
];

const BULK_OPS = [
    { value: 'progress_refresh', label: 'Refresh onboarding progress' },
    { value: 'export_workflows', label: 'Export workflows CSV' },
    { value: 'send_reminders', label: 'Send reminders' },
    { value: 'document_verify', label: 'Verify documents' },
    { value: 'document_remind', label: 'Remind document owners' },
    { value: 'letter_generate', label: 'Generate letters' },
    { value: 'send_notifications', label: 'Trigger notifications' },
    { value: 'workflow_assign', label: 'Assign workflow templates' },
    { value: 'onboarding_create', label: 'Bulk create onboarding' },
    { value: 'offboarding_create', label: 'Bulk create offboarding' },
];

const INDIA_COMPLIANCE = [
    { key: 'compliance.india.aadhaar', label: 'Aadhaar' },
    { key: 'compliance.india.pan', label: 'PAN' },
    { key: 'compliance.india.epf', label: 'EPF' },
    { key: 'compliance.india.esi', label: 'ESI' },
    { key: 'compliance.india.gratuity', label: 'Gratuity' },
    { key: 'compliance.india.professionalTax', label: 'PT' },
    { key: 'compliance.india.lwf', label: 'LWF' },
    { key: 'compliance.india.form16', label: 'Form 16' },
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

function HealthRing({ score, label }) {
    const color = score >= 80 ? '#0d9488' : score >= 55 ? '#f59e0b' : '#ef4444';
    const r = 36;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
    return (
        <div className="flex flex-col items-center gap-2">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
                <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                    cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                />
                <text x="48" y="52" textAnchor="middle" className="fill-gray-900" fontSize="18" fontWeight="700">
                    {score}%
                </text>
            </svg>
            <p className="text-xs font-medium text-gray-600">{label}</p>
        </div>
    );
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
 * Enterprise Lifecycle Command Center — UI-only composition over existing APIs.
 */
const EnterpriseCommandCenter = ({
    isEnabled,
    onNavigateTab,
    bulkEnabled,
    notifEnabled,
}) => {
    const [, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [refreshMs, setRefreshMs] = useState(60000);
    const [lastSync, setLastSync] = useState(null);
    const [reports, setReports] = useState(null);
    const [executive, setExecutive] = useState(null);
    const [hrDash, setHrDash] = useState(null);
    const [recruitment, setRecruitment] = useState(null);
    const [lms, setLms] = useState(null);
    const [itInventory, setItInventory] = useState(null);
    const [probation, setProbation] = useState(null);
    const [notifConfig, setNotifConfig] = useState(null);
    const [scheduledReports, setScheduledReports] = useState([]);
    const [bulkOp, setBulkOp] = useState('progress_refresh');
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [apiHealth, setApiHealth] = useState({});
    const [activity, setActivity] = useState([]);
    const prevKpis = useRef(null);

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
        const health = {};
        const settled = async (key, promise) => {
            try {
                const data = await promise;
                health[key] = 'ok';
                return data;
            } catch {
                health[key] = 'err';
                return null;
            }
        };

        const [
            reportsRes,
            execRes,
            hrRes,
            recRes,
            lmsRes,
            itRes,
            probationRes,
            notifRes,
            scheduledRes,
        ] = await Promise.all([
            settled('reports', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/reports/dashboard`).then((r) => r.data.data)),
            isEnabled('enterpriseDashboards')
                ? settled('executive', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/executive`).then((r) => r.data.data))
                : null,
            isEnabled('enterpriseDashboards')
                ? settled('hr', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/hr`).then((r) => r.data.data))
                : null,
            isEnabled('enterpriseDashboards')
                ? settled('recruitment', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/recruitment`).then((r) => r.data.data))
                : null,
            (isEnabled('lmsDashboard') || isEnabled('trainingLms'))
                ? settled('lms', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/lms/dashboard`).then((r) => r.data.data))
                : null,
            (isEnabled('softwareAccessRequest') || isEnabled('itAssetProvisioning'))
                ? settled('it', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/it/inventory`).then((r) => r.data.data))
                : null,
            (isEnabled('probationCenter') || isEnabled('probation'))
                ? settled('probation', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/probation/center`).then((r) => r.data.data))
                : null,
            isEnabled('notificationCenter')
                ? settled('notifications', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/notifications/center`).then((r) => r.data.data))
                : null,
            settled('scheduled', axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/reports/scheduled`).then((r) => r.data.data || [])),
        ]);

        if (reportsRes) setReports(reportsRes);
        if (execRes) setExecutive(execRes);
        if (hrRes) setHrDash(hrRes);
        if (recRes) setRecruitment(recRes);
        if (lmsRes) setLms(lmsRes);
        if (itRes) setItInventory(itRes);
        if (probationRes) setProbation(probationRes);
        if (notifRes) setNotifConfig(notifRes);
        if (scheduledRes) setScheduledReports(Array.isArray(scheduledRes) ? scheduledRes : []);
        setApiHealth(health);
        const now = new Date();
        setLastSync(now);

        // Live activity: offers + KPI change events
        const events = [];
        (recRes?.recentOffers || []).slice(0, 8).forEach((o) => {
            events.push({
                id: `offer-${o._id}`,
                at: o.updatedAt || o.createdAt || now,
                title: `Offer ${o.status || 'updated'}: ${o.candidateName || 'Candidate'}`,
                detail: o.position || 'Offer letter',
                tone: o.status === 'Accepted' ? 'ok' : 'info',
            });
        });

        const kpisSnap = {
            onboarding: reportsRes?.onboarding?.summary?.inProgress
                ?? execRes?.kpis?.activeOnboarding
                ?? 0,
            offboarding: reportsRes?.offboarding?.summary?.active
                ?? execRes?.kpis?.activeOffboarding
                ?? 0,
            bgv: reportsRes?.bgvAnalytics?.byStatus?.Pending
                || Object.entries(reportsRes?.bgvAnalytics?.byStatus || {}).find(([k]) => /pend/i.test(k))?.[1]
                || 0,
            docs: reportsRes?.onboarding?.documentCompletion?.pending || 0,
            fnf: reportsRes?.offboarding?.fnf?.pending || 0,
            it: itRes?.totals?.pending || hrRes?.kpis?.softwarePending || 0,
        };

        if (prevKpis.current) {
            Object.entries(kpisSnap).forEach(([key, val]) => {
                const prev = prevKpis.current[key];
                if (prev !== val) {
                    events.unshift({
                        id: `delta-${key}-${now.getTime()}`,
                        at: now,
                        title: `${key} count changed`,
                        detail: `${prev} → ${val}`,
                        tone: 'info',
                    });
                }
            });
        }
        prevKpis.current = kpisSnap;

        if (!events.length) {
            events.push({
                id: `sync-${now.getTime()}`,
                at: now,
                title: 'Command center refreshed',
                detail: 'Lifecycle metrics synchronized',
                tone: 'ok',
            });
        }

        setActivity((prev) => {
            const merged = [...events, ...prev].slice(0, 40);
            const seen = new Set();
            return merged.filter((e) => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                return true;
            });
        });

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
    const hr = reports?.hrAnalytics;
    const offers = reports?.offerAnalytics;
    const bgv = reports?.bgvAnalytics;

    const kpis = useMemo(() => {
        const joinTrend = trendFromSeries(onboarding?.joiningTrend || executive?.charts?.monthlyJoiners || []);
        const exitTrend = trendFromSeries(offboarding?.monthlyTrend || executive?.charts?.monthlyLeavers || []);
        const headcount = executive?.kpis?.headcount
            ?? hr?.activeHeadcount
            ?? (hr?.department || []).reduce((s, d) => s + (d.count || 0), 0)
            ?? '—';

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

        return [
            { key: 'employees', label: 'Total Employees', value: headcount, trend: joinTrend, icon: FaUsers, action: () => openQuery({ enterprise: '1' }) },
            { key: 'onb', label: 'Active Onboarding', value: onboarding?.summary?.inProgress ?? executive?.kpis?.activeOnboarding ?? 0, trend: joinTrend, icon: FaClipboardList, action: () => openQuery({ enterprise: null, lifecycle: null }) },
            { key: 'off', label: 'Active Offboarding', value: offboarding?.summary?.active ?? executive?.kpis?.activeOffboarding ?? 0, trend: exitTrend, icon: FaTasks, action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { key: 'offers', label: 'Pending Approvals / Offers', value: offerPending, trend: { dir: 'flat', delta: 0 }, icon: FaFileAlt, action: () => onNavigateTab?.('dashboards') },
            { key: 'docs', label: 'Pending Documents', value: onboarding?.documentCompletion?.pending ?? 0, trend: { dir: 'flat', delta: 0 }, accent: 'amber', action: () => openQuery({ reports: '1', enterprise: null }) },
            { key: 'bgv', label: 'Pending BGV', value: bgvPending, trend: { dir: 'flat', delta: 0 }, accent: 'amber', action: () => openQuery({ reports: '1', enterprise: null }) },
            { key: 'exit', label: 'Pending Exit Interviews', value: exitPending, trend: { dir: 'flat', delta: 0 }, action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { key: 'fnf', label: 'Pending F&F', value: offboarding?.fnf?.pending ?? 0, trend: { dir: 'flat', delta: 0 }, accent: 'red', action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { key: 'it', label: 'Pending IT Provisioning', value: itInventory?.totals?.pending ?? hrDash?.kpis?.softwarePending ?? 0, trend: { dir: 'flat', delta: 0 }, action: () => onNavigateTab?.('it') },
            { key: 'prob', label: 'Active Probations', value: probation?.dashboard?.active ?? executive?.kpis?.probationActive ?? hrDash?.kpis?.probationActive ?? 0, trend: { dir: 'flat', delta: 0 }, action: () => onNavigateTab?.('probation') },
            { key: 'notice', label: 'Active Notice Periods', value: offboarding?.noticePeriod?.active ?? 0, trend: { dir: 'flat', delta: 0 }, action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { key: 'letters', label: 'Offers (period)', value: offers?.total ?? recruitment?.kpis?.totalOffers ?? 0, trend: { dir: 'flat', delta: 0 }, action: () => openQuery({ reports: '1', enterprise: null }) },
            { key: 'soft', label: 'Open Software Requests', value: itInventory?.totals?.pending ?? 0, trend: { dir: 'flat', delta: 0 }, action: () => onNavigateTab?.('it') },
            { key: 'comp', label: 'Compliance Alerts', value: (onboarding?.documentCompletion?.rejected || 0) + (onboarding?.documentCompletion?.pending || 0), trend: { dir: 'flat', delta: 0 }, accent: 'amber', action: () => onNavigateTab?.('statutory') },
        ];
    }, [
        onboarding, offboarding, hr, offers, bgv, executive, recruitment, itInventory, hrDash, probation,
        openQuery, onNavigateTab,
    ]);

    const healthBreakdown = useMemo(() => {
        const items = [
            { label: 'Onboarding Completion', value: onboarding?.summary?.completionRate ?? 0 },
            { label: 'Offboarding Completion', value: offboarding?.summary?.completionRate ?? 0 },
            { label: 'Document Verification', value: onboarding?.documentCompletion?.completionRate ?? 0 },
            { label: 'Training Completion', value: lms?.summary?.completionRate ?? hrDash?.kpis?.trainingCompletionRate ?? 0 },
            { label: 'Clearance Progress', value: offboarding?.clearance?.completionRate ?? 0 },
            { label: 'Asset Return', value: offboarding?.assetReturn?.returnRate ?? 0 },
            { label: 'Offer Acceptance', value: offers?.acceptanceRate ?? recruitment?.kpis?.conversionRate ?? 0 },
        ].filter((i) => i.value != null);
        const score = items.length
            ? Math.round(items.reduce((s, i) => s + Number(i.value || 0), 0) / items.length)
            : 0;
        return { score, items };
    }, [onboarding, offboarding, lms, hrDash, offers, recruitment]);

    const insights = useMemo(() => {
        const list = [];
        const onbActive = onboarding?.summary?.inProgress ?? 0;
        const onbIncomplete = Math.max(0, (onboarding?.summary?.total || 0) - (onboarding?.summary?.completed || 0));
        if (onbIncomplete) list.push(`${onbIncomplete} employees have incomplete onboarding.`);
        const docs = onboarding?.documentCompletion?.pending || 0;
        if (docs) list.push(`${docs} documents are pending verification.`);
        const bgvPend = kpis.find((k) => k.key === 'bgv')?.value || 0;
        if (bgvPend) list.push(`${bgvPend} background verification cases need attention.`);
        const exitP = kpis.find((k) => k.key === 'exit')?.value || 0;
        if (exitP) list.push(`${exitP} exit interviews are pending.`);
        const ending = probation?.dashboard?.endingSoon ?? executive?.kpis?.probationEndingSoon ?? 0;
        if (ending) list.push(`${ending} employees are nearing probation completion.`);
        const fnf = offboarding?.fnf?.pending || 0;
        if (fnf) list.push(`${fnf} F&F settlements require approval.`);
        const itPend = itInventory?.totals?.pending || 0;
        if (itPend) list.push(`${itPend} software / IT requests are open.`);
        if (!list.length) list.push('Lifecycle health looks stable — no critical queues detected.');
        if (onbActive) list.unshift(`${onbActive} active onboarding workflows in progress.`);
        return list.slice(0, 8);
    }, [onboarding, offboarding, kpis, probation, executive, itInventory]);

    const pendingActions = useMemo(() => {
        const rows = [
            { title: 'Pending offer / approvals', count: kpis.find((k) => k.key === 'offers')?.value || 0, priority: 'High', due: 'Today', assignee: 'HR', action: () => openQuery({ reports: '1', enterprise: null }) },
            { title: 'Pending BGV', count: kpis.find((k) => k.key === 'bgv')?.value || 0, priority: 'High', due: 'This week', assignee: 'HR', action: () => openQuery({ reports: '1', enterprise: null }) },
            { title: 'Pending documents', count: kpis.find((k) => k.key === 'docs')?.value || 0, priority: 'Medium', due: 'This week', assignee: 'HR', action: () => openQuery({ reports: '1', enterprise: null }) },
            { title: 'Pending exit interviews', count: kpis.find((k) => k.key === 'exit')?.value || 0, priority: 'Medium', due: 'Before LWD', assignee: 'HR', action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { title: 'Pending clearance', count: Math.max(0, (offboarding?.clearance?.total || 0) - (offboarding?.clearance?.completed || 0)), priority: 'High', due: 'Before LWD', assignee: 'Managers', action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { title: 'Pending assets', count: offboarding?.assetReturn?.pending || 0, priority: 'High', due: 'Before LWD', assignee: 'IT', action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { title: 'Pending F&F', count: offboarding?.fnf?.pending || 0, priority: 'Critical', due: 'Payroll cycle', assignee: 'Finance', action: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
            { title: 'Pending software requests', count: itInventory?.totals?.pending || 0, priority: 'Medium', due: 'Joining week', assignee: 'IT', action: () => onNavigateTab?.('it') },
            { title: 'Notification channels', count: Object.values(notifConfig?.global || {}).filter(Boolean).length, priority: 'Low', due: 'Ongoing', assignee: 'Admin', action: () => onNavigateTab?.('notifications') },
        ];
        return rows.filter((r) => Number(r.count) > 0 || r.title.includes('Notification')).slice(0, 10);
    }, [kpis, offboarding, itInventory, notifConfig, openQuery, onNavigateTab]);

    const joinChart = (onboarding?.joiningTrend || executive?.charts?.monthlyJoiners || []).map((r) => ({
        name: r.label || r.name || `${r.month || ''}`,
        value: r.count ?? r.value ?? 0,
    }));
    const exitReasonChart = (offboarding?.exitReasons || executive?.charts?.offboardingByReason || []).map((r) => ({
        name: r.reason || r.name,
        value: r.count ?? r.value ?? 0,
    }));
    const deptChart = (hr?.department || hr?.headcountByDepartment || []).map((r) => ({
        name: r.name || r.department,
        value: r.count ?? 0,
    })).slice(0, 8);
    const onbStatusChart = (onboarding?.byStatus || executive?.charts?.onboardingByStatus || []).map((r) => ({
        name: r.status || r.name,
        value: r.count ?? r.value ?? 0,
    }));

    const runBulk = async () => {
        if (!bulkEnabled) return;
        try {
            setBulkRunning(true);
            setBulkResult(null);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/bulk/execute`, {
                operation: bulkOp,
                payload: {},
            });
            setBulkResult(data.data);
            toast.success(`Bulk: ${data.data?.succeeded ?? 0}/${data.data?.total ?? 0} succeeded`);
            await loadAll({ soft: true });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk operation failed');
        } finally {
            setBulkRunning(false);
        }
    };

    const saveNotif = async () => {
        try {
            await axios.patch(`${ADMIN_LIFECYCLE_ENDPOINT}/notifications/center`, { global: notifConfig?.global });
            toast.success('Notification channels saved');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        }
    };

    if (loading && !reports && !executive) {
        return <LoadingSpinner message="Loading enterprise command center..." />;
    }

    const enabledChannels = Object.entries(notifConfig?.global || {}).filter(([, v]) => v);
    const systemRows = [
        { label: 'Reports API', status: apiHealth.reports },
        { label: 'Dashboards', status: apiHealth.executive || apiHealth.hr },
        { label: 'Notifications', status: apiHealth.notifications },
        { label: 'LMS', status: apiHealth.lms },
        { label: 'IT Provisioning', status: apiHealth.it },
        { label: 'Probation', status: apiHealth.probation },
        { label: 'Scheduler / Jobs', status: apiHealth.scheduled === 'ok' || apiHealth.reports === 'ok' ? 'ok' : apiHealth.scheduled },
    ];

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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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

            {/* Health + Insights + Pending */}
            <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Organization Health Score</h3>
                    <div className="flex justify-center">
                        <HealthRing score={healthBreakdown.score} label="Lifecycle health" />
                    </div>
                    <ul className="mt-4 space-y-2">
                        {healthBreakdown.items.map((item) => (
                            <li key={item.label} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{item.label}</span>
                                <span className={`font-semibold ${item.value >= 80 ? 'text-emerald-600' : item.value >= 55 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {item.value}%
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FaExclamationTriangle className="text-amber-500" /> Enterprise Insights
                    </h3>
                    <ul className="space-y-2">
                        {insights.map((t) => (
                            <li key={t} className="rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-900 border border-amber-100">
                                {t}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Pending Actions</h3>
                    <div className="max-h-72 space-y-2 overflow-y-auto">
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
                            <p className="text-xs text-gray-500">No pending queues right now.</p>
                        )}
                    </div>
                </section>
            </div>

            {/* Charts + Activity */}
            <div className="grid gap-4 xl:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-2">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Real-Time Charts</h3>
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
                        <div className="h-52">
                            <p className="mb-1 text-xs text-gray-500">Exit reasons</p>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie data={exitReasonChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                                        {exitReasonChart.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="h-52">
                            <p className="mb-1 text-xs text-gray-500">Department distribution</p>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={deptChart} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-center text-xs">
                        <div className="rounded-lg bg-gray-50 p-2">
                            <p className="font-bold text-gray-900">{onboarding?.summary?.avgOnboardingDays ?? onboarding?.avgOnboardingTime?.avgDays ?? '—'}d</p>
                            <p className="text-gray-500">Avg onboarding time</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2">
                            <p className="font-bold text-gray-900">{offers?.acceptanceRate ?? recruitment?.kpis?.conversionRate ?? 0}%</p>
                            <p className="text-gray-500">Offer acceptance</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2">
                            <p className="font-bold text-gray-900">{offboarding?.summary?.completionRate ?? 0}%</p>
                            <p className="text-gray-500">Offboarding completion</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2">
                            <p className="font-bold text-gray-900">{offboarding?.clearance?.completionRate ?? 0}%</p>
                            <p className="text-gray-500">Clearance progress</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Live Activity Feed</h3>
                    <div className="max-h-[420px] space-y-2 overflow-y-auto">
                        {activity.map((ev) => (
                            <div key={ev.id} className="border-l-2 border-theme-primary/40 pl-3 py-1.5">
                                <p className="text-xs font-medium text-gray-900">{ev.title}</p>
                                <p className="text-[11px] text-gray-500">{ev.detail}</p>
                                <p className="text-[10px] text-gray-400">{formatTime(ev.at)}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Notifications + Bulk + Compliance */}
            <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FaBell /> Notification Center
                    </h3>
                    {!notifEnabled ? (
                        <p className="text-xs text-gray-500">Enable Notification Center in Configure.</p>
                    ) : (
                        <>
                            <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
                                <div className="rounded-lg bg-emerald-50 p-2">
                                    <p className="font-bold">{enabledChannels.length}</p>
                                    <p className="text-gray-500">Active channels</p>
                                </div>
                                <div className="rounded-lg bg-gray-50 p-2">
                                    <p className="font-bold">{notifConfig?.events?.length || 0}</p>
                                    <p className="text-gray-500">Event policies</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(notifConfig?.global || {}).map(([ch, enabled]) => (
                                    <label key={ch} className="flex items-center gap-2 text-xs capitalize">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(enabled)}
                                            onChange={(e) => setNotifConfig((p) => ({
                                                ...p,
                                                global: { ...p.global, [ch]: e.target.checked },
                                            }))}
                                        />
                                        {ch}
                                    </label>
                                ))}
                            </div>
                            <button type="button" onClick={saveNotif} className="mt-3 rounded-lg bg-theme-primary px-3 py-1.5 text-xs font-medium text-white">
                                Save channels
                            </button>
                            <button type="button" onClick={() => onNavigateTab?.('notifications')} className="mt-2 ml-2 text-xs text-theme-primary underline">
                                Open full panel
                            </button>
                        </>
                    )}
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Bulk Operations</h3>
                    {!bulkEnabled ? (
                        <p className="text-xs text-gray-500">Enable Bulk Operations in Configure.</p>
                    ) : (
                        <>
                            <select
                                value={bulkOp}
                                onChange={(e) => setBulkOp(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                                {BULK_OPS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={bulkRunning}
                                onClick={runBulk}
                                className="mt-2 w-full rounded-lg bg-theme-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                            >
                                {bulkRunning ? 'Running…' : 'Run operation'}
                            </button>
                            {bulkResult && (
                                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs">
                                    <p>Total: {bulkResult.total ?? 0}</p>
                                    <p className="text-emerald-700">Succeeded: {bulkResult.succeeded ?? 0}</p>
                                    <p className="text-red-600">Failed: {bulkResult.failed ?? 0}</p>
                                    {bulkResult.format === 'csv' && bulkResult.content && (
                                        <button
                                            type="button"
                                            className="mt-2 text-theme-primary underline"
                                            onClick={() => {
                                                const blob = new Blob([bulkResult.content], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'lifecycle-workflows.csv';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                        >
                                            Download CSV export
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">India Compliance Status</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {INDIA_COMPLIANCE.map((item) => {
                            const on = isEnabled(item.key) || isEnabled('indiaStatutoryCompliance');
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => onNavigateTab?.('statutory')}
                                    className={`rounded-lg border px-2 py-2 text-left text-xs ${on ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50 opacity-70'}`}
                                >
                                    <p className="font-semibold text-gray-800">{item.label}</p>
                                    <p className={on ? 'text-emerald-700' : 'text-gray-500'}>{on ? 'Enabled' : 'Disabled'}</p>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="rounded bg-amber-50 p-2">
                            <p className="font-bold">{onboarding?.documentCompletion?.pending ?? 0}</p>
                            <p>Pending</p>
                        </div>
                        <div className="rounded bg-emerald-50 p-2">
                            <p className="font-bold">{onboarding?.documentCompletion?.verified ?? 0}</p>
                            <p>Completed</p>
                        </div>
                        <div className="rounded bg-red-50 p-2">
                            <p className="font-bold">{onboarding?.documentCompletion?.rejected ?? 0}</p>
                            <p>Failed</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* IT + LMS + Quick actions */}
            <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FaLaptop /> IT Provisioning Status
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-amber-50 p-2"><p className="font-bold">{itInventory?.totals?.pending ?? 0}</p><p>Pending</p></div>
                        <div className="rounded-lg bg-emerald-50 p-2"><p className="font-bold">{itInventory?.totals?.provisioned ?? 0}</p><p>Provisioned</p></div>
                        <div className="rounded-lg bg-red-50 p-2"><p className="font-bold">{itInventory?.totals?.revoked ?? 0}</p><p>Revoked</p></div>
                        <div className="rounded-lg bg-blue-50 p-2"><p className="font-bold">{itInventory?.totals?.systems ?? 0}</p><p>Systems</p></div>
                    </div>
                    <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
                        {(itInventory?.bySystem || []).slice(0, 8).map((s) => (
                            <li key={s.system} className="flex justify-between rounded border border-gray-50 px-2 py-1">
                                <span className="font-medium">{s.system}</span>
                                <span className="text-gray-500">{s.pending} pending / {s.provisioned} ok</span>
                            </li>
                        ))}
                        {!itInventory?.bySystem?.length && <li className="text-gray-500">No software requests yet.</li>}
                    </ul>
                    <button type="button" onClick={() => onNavigateTab?.('it')} className="mt-2 text-xs text-theme-primary underline">Open IT panel</button>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FaGraduationCap /> LMS Dashboard
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-gray-50 p-2"><p className="font-bold">{lms?.summary?.employeesInTraining ?? 0}</p><p>Assigned / in training</p></div>
                        <div className="rounded-lg bg-emerald-50 p-2"><p className="font-bold">{lms?.summary?.completedModules ?? 0}</p><p>Completed</p></div>
                        <div className="rounded-lg bg-amber-50 p-2"><p className="font-bold">{Math.max(0, (lms?.summary?.totalModules || 0) - (lms?.summary?.completedModules || 0))}</p><p>Pending</p></div>
                        <div className="rounded-lg bg-blue-50 p-2"><p className="font-bold">{lms?.summary?.completionRate ?? 0}%</p><p>Completion</p></div>
                    </div>
                    <button type="button" onClick={() => onNavigateTab?.('lms')} className="mt-3 text-xs text-theme-primary underline">Open LMS panel</button>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Onboarding workflows', onClick: () => openQuery({ enterprise: null, lifecycle: null }) },
                            { label: 'Offboarding workflows', onClick: () => openQuery({ lifecycle: 'offboarding', enterprise: null }) },
                            { label: 'Open Reports', onClick: () => openQuery({ reports: '1', enterprise: null }) },
                            { label: 'Configure Lifecycle', onClick: () => openQuery({ configure: '1', enterprise: null }) },
                            { label: 'Statutory docs', onClick: () => onNavigateTab?.('statutory') },
                            { label: 'Probation center', onClick: () => onNavigateTab?.('probation') },
                            { label: 'IT provisioning', onClick: () => onNavigateTab?.('it') },
                            { label: 'LMS', onClick: () => onNavigateTab?.('lms') },
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

            {/* Reports + System status + Sync */}
            <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent / Scheduled Reports</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(scheduledReports || []).slice(0, 8).map((r) => (
                            <div key={r._id || r.name} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs">
                                <div>
                                    <p className="font-medium text-gray-900">{r.name || 'Scheduled report'}</p>
                                    <p className="text-gray-500">{(r.format || 'csv').toUpperCase()} · {r.frequency || '—'}</p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 ${r.enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {r.enabled !== false ? 'Active' : 'Paused'}
                                </span>
                            </div>
                        ))}
                        {!scheduledReports?.length && (
                            <p className="text-xs text-gray-500">No scheduled reports yet. Create them in Reports.</p>
                        )}
                    </div>
                    <button type="button" onClick={() => openQuery({ reports: '1', enterprise: null })} className="mt-2 text-xs text-theme-primary underline">
                        Open reports hub
                    </button>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">System Status</h3>
                    <ul className="space-y-2">
                        {systemRows.map((row) => (
                            <li key={row.label} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{row.label}</span>
                                <span className={`inline-flex items-center gap-1 font-medium ${
                                    row.status === 'ok' ? 'text-emerald-600' : row.status === 'err' ? 'text-red-600' : 'text-gray-400'
                                }`}>
                                    {row.status === 'ok' ? <FaCheckCircle /> : row.status === 'err' ? <FaExclamationTriangle /> : '—'}
                                    {row.status === 'ok' ? 'Healthy' : row.status === 'err' ? 'Issue' : 'N/A'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <FaCog /> Last Sync Information
                    </h3>
                    <ul className="space-y-2 text-xs text-gray-600">
                        <li className="flex justify-between"><span>Last data refresh</span><span className="font-medium text-gray-900">{formatTime(lastSync)}</span></li>
                        <li className="flex justify-between"><span>Reports generated</span><span className="font-medium text-gray-900">{formatTime(reports?.generatedAt)}</span></li>
                        <li className="flex justify-between"><span>Workflow sync</span><span className="font-medium text-gray-900">{formatTime(lastSync)}</span></li>
                        <li className="flex justify-between"><span>Notification sync</span><span className="font-medium text-gray-900">{apiHealth.notifications === 'ok' ? formatTime(lastSync) : '—'}</span></li>
                        <li className="flex justify-between"><span>Compliance sync</span><span className="font-medium text-gray-900">{formatTime(lastSync)}</span></li>
                        <li className="flex justify-between"><span>Auto-refresh</span><span className="font-medium text-gray-900">{refreshMs ? `${refreshMs / 1000}s` : 'Off'}</span></li>
                    </ul>
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <FaUserCheck className="text-theme-primary" />
                        Probation ending soon: {probation?.dashboard?.endingSoon ?? executive?.kpis?.probationEndingSoon ?? 0}
                    </div>
                </section>
            </div>

            {/* Classic dashboard type switcher (preserved) */}
            {isEnabled('enterpriseDashboards') && executive?.kpis && (
                <section className="rounded-xl border border-dashed border-gray-200 bg-white/80 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">Executive KPI snapshot</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {Object.entries(executive.kpis).map(([k, v]) => (
                            <div key={k} className="rounded-lg border border-gray-100 p-3">
                                <p className="text-[11px] text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
                                <p className="text-lg font-bold text-gray-900">{v}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default EnterpriseCommandCenter;
