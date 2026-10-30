import '../../styles/surveyUI.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FaPoll,
    FaChartBar,
    FaComments,
    FaLightbulb,
    FaAward,
    FaClipboardList,
    FaShieldAlt,
    FaChevronRight,
    FaExclamationCircle,
    FaTasks,
    FaUserClock,
    FaCheckCircle,
} from 'react-icons/fa';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import axios from '../../utils/axios';

const MINT = '#0E9370';
const PRIVACY_MSG = 'Not enough responses to display analytics.';

const RANGE_OPTIONS = [
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '3m', label: '3 Months' },
    { id: '6m', label: '6 Months' },
    { id: 'custom', label: 'Custom' },
];

const FEEDBACK_STATUS_LABELS = ['Open', 'In Review', 'Resolved', 'Closed'];
const SUGGESTION_STATUS_LABELS = [
    'Submitted',
    'Under Review',
    'Accepted',
    'Rejected',
    'In Progress',
    'Implemented',
];

const ClickableKpi = ({ label, value, subtext, icon: Icon, accent, onClick, muted = false }) => (
    <button
        type="button"
        onClick={onClick}
        className="engagement-kpi group w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-[#0E9370]/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0E9370]/30"
    >
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p
                    className={`mt-1 truncate font-bold ${
                        muted ? 'text-xl text-slate-400' : 'text-2xl text-slate-900'
                    }`}
                >
                    {value}
                </p>
                {subtext && <p className="mt-1 text-xs leading-snug text-slate-500">{subtext}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <FaChevronRight className="h-3 w-3 text-slate-300 transition group-hover:text-[#0E9370]" />
            </div>
        </div>
    </button>
);

const PrivacyBanner = ({ message = PRIVACY_MSG }) => (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
        <FaShieldAlt className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
    </div>
);

const SECTION_ICONS = {
    'Survey insights': FaPoll,
    'eNPS insights': FaChartBar,
    'Feedback & suggestions': FaComments,
    'Recognition insights': FaAward,
    'Department breakdown': FaClipboardList,
};

const SectionHeading = ({ title }) => {
    const Icon = SECTION_ICONS[title];
    return (
        <h3 className="engagement-panel-heading text-sm font-semibold text-slate-800">
            {Icon && <span className="engagement-panel-icon" aria-hidden="true"><Icon /></span>}
            {title}
        </h3>
    );
};

const SectionShell = ({ title, description, children, error, loading, emptyMessage, className = '' }) => {
    if (loading) {
        return (
            <div className={`engagement-panel rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${className}`}>
                <SectionHeading title={title} />
                {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
                <div className="mt-6 flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]" />
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className={`engagement-panel rounded-2xl border border-red-100 bg-red-50/50 p-6 shadow-sm ${className}`}>
                <div className="flex items-start gap-2 text-sm text-red-800">
                    <FaExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="mt-1">{error}</p>
                    </div>
                </div>
            </div>
        );
    }
    if (emptyMessage) {
        return (
            <div className={`engagement-panel rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${className}`}>
                <SectionHeading title={title} />
                {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
                <p className="mt-6 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
            </div>
        );
    }
    return (
        <div className={`engagement-panel rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${className}`}>
            <SectionHeading title={title} />
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            <div className="mt-4">{children}</div>
        </div>
    );
};

const StatusBreakdown = ({ title, statuses, items, accent }) => {
    const countMap = (items || []).reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
    }, {});
    const rows = statuses.map((s) => ({ status: s, count: countMap[s] || 0 }));
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return null;
    const max = Math.max(...rows.map((r) => r.count), 1);

    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
            <ul className="mt-3 space-y-2">
                {rows.map((row) => (
                    <li key={row.status}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{row.status}</span>
                            <span className="font-semibold text-slate-900">{row.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${(row.count / max) * 100}%`,
                                    backgroundColor: accent,
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const SimpleTrendChart = ({ data, dataKey = 'count', color = MINT }) => {
    if (!data?.length) return null;
    return (
        <div className="engagement-trend-chart w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => (v?.length > 7 ? v.slice(5) : v)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: color }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const EnpsTrendChart = ({ data }) => {
    const chartData = (data || []).filter((d) => d.available && d.score != null);
    if (!chartData.length) return null;
    return (
        <div className="engagement-trend-chart w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => (v?.length > 7 ? v.slice(5) : v)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[-100, 100]} />
                    <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                        formatter={(value) => [value, 'eNPS']}
                    />
                    <Bar dataKey="score" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const EnpsBreakdown = ({ detail }) => {
    if (!detail?.available) {
        return <PrivacyBanner message={detail?.message || PRIVACY_MSG} />;
    }
    const total = detail.responseCount || 1;
    const segments = [
        { label: 'Promoters', count: detail.promoters, color: 'bg-emerald-500' },
        { label: 'Passives', count: detail.passives, color: 'bg-amber-400' },
        { label: 'Detractors', count: detail.detractors, color: 'bg-rose-400' },
    ];
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        eNPS score
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                        {detail.score ?? '—'}
                    </p>
                </div>
                <p className="text-xs text-slate-500">Based on {detail.responseCount} responses</p>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-200">
                {segments.map((s) =>
                    s.count > 0 ? (
                        <div
                            key={s.label}
                            className={s.color}
                            style={{ width: `${(s.count / total) * 100}%` }}
                            title={`${s.label}: ${s.count}`}
                        />
                    ) : null
                )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                {segments.map((s) => (
                    <span key={s.label}>
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${s.color}`} />
                        {s.label}: <strong className="text-slate-800">{s.count}</strong>
                    </span>
                ))}
            </div>
        </div>
    );
};

const EngagementDashboard = ({ onNavigateTab, forceTeamScope = false }) => {
    const [range, setRange] = useState('30d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [department, setDepartment] = useState('');
    const [surveyType, setSurveyType] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [recognitionAnalytics, setRecognitionAnalytics] = useState(null);
    const [analyticsState, setAnalyticsState] = useState({ loading: true, error: null });
    const [recognitionState, setRecognitionState] = useState({ loading: true, error: null });

    const buildParams = useCallback(() => {
        const params = { range };
        if (range === 'custom') {
            if (customStart) params.startDate = customStart;
            if (customEnd) params.endDate = customEnd;
        }
        if (department) params.department = department;
        if (surveyType) params.surveyType = surveyType;
        if (forceTeamScope) params.scope = 'team';
        return params;
    }, [range, customStart, customEnd, department, surveyType, forceTeamScope]);

    const fetchDashboard = useCallback(async () => {
        setAnalyticsState({ loading: true, error: null });
        setRecognitionState({ loading: true, error: null });

        const params = buildParams();

        const [analyticsResult, recognitionResult] = await Promise.allSettled([
            axios.get('/v1/both/engagement/analytics', { params, withCredentials: true }),
            axios.get('/v1/both/engagement/recognition/analytics', { withCredentials: true }),
        ]);

        if (analyticsResult.status === 'fulfilled') {
            setAnalytics(analyticsResult.value.data?.data || null);
            setAnalyticsState({ loading: false, error: null });
        } else {
            setAnalytics(null);
            setAnalyticsState({
                loading: false,
                error:
                    analyticsResult.reason?.response?.data?.message ||
                    'Failed to load engagement analytics',
            });
        }

        if (recognitionResult.status === 'fulfilled') {
            setRecognitionAnalytics(recognitionResult.value.data?.data || null);
            setRecognitionState({ loading: false, error: null });
        } else {
            setRecognitionAnalytics(null);
            setRecognitionState({
                loading: false,
                error:
                    recognitionResult.reason?.response?.data?.message ||
                    'Failed to load recognition analytics',
            });
        }
    }, [buildParams]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const enpsAvailable = analytics?.eNPSDetail?.available;
    const participationDisplay = useMemo(() => {
        if (analytics?.surveys?.participationRate == null) return '—';
        return `${Number(analytics.surveys.participationRate).toFixed(0)}%`;
    }, [analytics]);

    const responseTrend = analytics?.trends?.responses || [];
    const hasResponseTrend = responseTrend.some((r) => r.count > 0);

    const enpsTrendHasData = (analytics?.trends?.enps || []).some((d) => d.available);

    const recognitionTrend = analytics?.trends?.recognition || [];
    const hasRecognitionTrend = recognitionTrend.some((r) => r.count > 0);

    const feedbackTrend = analytics?.trends?.feedback || [];
    const hasFeedbackTrend = feedbackTrend.some((r) => r.count > 0);

    const suggestionTrend = analytics?.trends?.suggestions || [];
    const hasSuggestionTrend = suggestionTrend.some((r) => r.count > 0);

    const dateRangeLabel = useMemo(() => {
        if (!analytics?.dateRange) return '';
        const { start, end, range: r } = analytics.dateRange;
        const fmt = (d) =>
            d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        if (r === 'custom') return `${fmt(start)} – ${fmt(end)}`;
        return RANGE_OPTIONS.find((o) => o.id === r)?.label || r;
    }, [analytics]);

    return (
        <div className="engagement-dashboard space-y-4">
            {!forceTeamScope && (
                <div className="rounded-xl border border-[#0E9370]/20 bg-[#0E9370]/5 px-3 py-2 text-xs text-slate-600 sm:px-4 sm:py-2.5 sm:text-sm">
                    <span className="font-semibold text-slate-900">Organization dashboard</span>
                    <span className="hidden sm:inline"> — company-wide engagement health and trends.</span>
                </div>
            )}
            <div className="engagement-filters flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {analytics?.scope && (
                        <span className="rounded-full bg-[#0E9370]/10 px-3 py-1 text-xs font-semibold text-[#0d9488] ring-1 ring-[#0E9370]/20">
                            Scope:{' '}
                            {analytics.scope === 'team' ? 'Team (direct reports)' : 'Organization'}
                        </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Min. {analytics?.minResponses ?? 5} responses for detailed metrics
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {RANGE_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRange(opt.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                range === opt.id
                                    ? 'bg-[#0E9370] text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {!forceTeamScope && (
                        <select
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                        >
                            <option value="">All departments</option>
                            {(analytics?.departmentBreakdown || []).map((row) => (
                                <option key={row.department} value={row.department}>
                                    {row.department}
                                </option>
                            ))}
                        </select>
                    )}
                    <select
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                        value={surveyType}
                        onChange={(e) => setSurveyType(e.target.value)}
                    >
                        <option value="">All survey types</option>
                        {['Pulse', 'Annual', 'Exit', 'Onboarding', 'Custom', 'Wellbeing'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {range === 'custom' && (
                <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <label className="text-sm">
                        <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={fetchDashboard}
                        className="rounded-full bg-[#0E9370] px-4 py-2 text-sm font-semibold text-white"
                    >
                        Apply
                    </button>
                </div>
            )}

            {dateRangeLabel && (
                <p className="text-xs text-slate-500">
                    Trend charts reflect: <strong className="text-slate-700">{dateRangeLabel}</strong>.
                    KPI totals above reflect current organization status (not date-filtered).
                </p>
            )}

            {analyticsState.error && (
                <div className="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm text-red-800">
                    Overview metrics unavailable: {analyticsState.error}
                </div>
            )}

            {!analyticsState.loading && analytics && (
                <>
                    <div className="engagement-metrics grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <ClickableKpi
                            label="Survey Participation"
                            value={participationDisplay}
                            subtext="Overall response rate"
                            icon={FaPoll}
                            accent={MINT}
                            onClick={() => onNavigateTab('surveys')}
                        />
                        <ClickableKpi
                            label="eNPS"
                            value={enpsAvailable ? analytics.eNPS : '—'}
                            subtext={enpsAvailable ? undefined : 'Available after privacy threshold'}
                            icon={FaChartBar}
                            accent="#0ea5e9"
                            muted={!enpsAvailable}
                            onClick={() => onNavigateTab('surveys')}
                        />
                        <ClickableKpi
                            label="Open Feedback"
                            value={analytics.openFeedback ?? '—'}
                            icon={FaComments}
                            accent="#8b5cf6"
                            onClick={() => onNavigateTab('feedback')}
                        />
                        <ClickableKpi
                            label="Suggestions"
                            value={analytics.suggestions?.total ?? '—'}
                            subtext={
                                analytics.suggestions?.implementedCount != null
                                    ? `${analytics.suggestions.implementedCount} implemented`
                                    : analytics.suggestions?.openCount != null
                                      ? `${analytics.suggestions.openCount} in progress`
                                      : undefined
                            }
                            icon={FaLightbulb}
                            accent="#6366f1"
                            onClick={() => onNavigateTab('suggestions')}
                        />
                        <ClickableKpi
                            label="Recognition"
                            value={analytics.recognitionCount ?? '—'}
                            icon={FaAward}
                            accent="#f59e0b"
                            onClick={() => onNavigateTab('recognition')}
                        />
                    </div>

                    {analytics.closedLoop?.actionPlans && (
                        <div className="engagement-actions grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <ClickableKpi
                                label="Action Closure Rate"
                                value={
                                    analytics.closedLoop.actionPlans.closureRate != null
                                        ? `${analytics.closedLoop.actionPlans.closureRate}%`
                                        : '—'
                                }
                                subtext="Completed ÷ (total − cancelled)"
                                icon={FaCheckCircle}
                                accent="#10b981"
                                onClick={() => onNavigateTab('insights')}
                            />
                            <ClickableKpi
                                label="Open vs Completed Plans"
                                value={`${analytics.closedLoop.actionPlans.openOrInProgress ?? 0} / ${analytics.closedLoop.actionPlans.completed ?? 0}`}
                                subtext={
                                    analytics.closedLoop.actionPlans.overdue
                                        ? `${analytics.closedLoop.actionPlans.overdue} overdue`
                                        : 'Action plans'
                                }
                                icon={FaTasks}
                                accent={MINT}
                                onClick={() => onNavigateTab('actions')}
                            />
                            <ClickableKpi
                                label="Follow-up Completion"
                                value={
                                    analytics.closedLoop.actionPlans.followUpCompletionRate != null
                                        ? `${analytics.closedLoop.actionPlans.followUpCompletionRate}%`
                                        : '—'
                                }
                                subtext="Insight-linked plans completed"
                                icon={FaClipboardList}
                                accent="#0ea5e9"
                                onClick={() => onNavigateTab('insights')}
                            />
                            <ClickableKpi
                                label="Lifecycle Participation"
                                value={
                                    analytics.lifecycle?.totals?.participationRate != null
                                        ? `${analytics.lifecycle.totals.participationRate}%`
                                        : '—'
                                }
                                subtext={
                                    analytics.lifecycle?.enabled
                                        ? `${analytics.lifecycle.totals?.surveys || 0} lifecycle surveys`
                                        : 'Automation off'
                                }
                                icon={FaUserClock}
                                accent="#8b5cf6"
                                onClick={() => onNavigateTab('lifecycle')}
                            />
                        </div>
                    )}

                    {analytics.comparison && (
                        <div className="engagement-comparisons grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                { label: 'Responses vs prior period', row: analytics.comparison.responses },
                                { label: 'Feedback vs prior period', row: analytics.comparison.feedback },
                                { label: 'Suggestions vs prior period', row: analytics.comparison.suggestions },
                                { label: 'Recognition vs prior period', row: analytics.comparison.recognition },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                                    <p className="mt-1 text-lg font-bold text-slate-900">{item.row?.current ?? 0}</p>
                                    <p className={`text-xs font-semibold ${(item.row?.delta || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {(item.row?.delta || 0) >= 0 ? '+' : ''}
                                        {item.row?.delta ?? 0} ({item.row?.deltaPct ?? 0}%)
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {analytics.tenureInsights?.length > 0 && (
                        <div className="engagement-tenure rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-800">Tenure-based engagement (identified responses)</h3>
                            <p className="mt-1 text-xs text-slate-500">Anonymous responses are excluded. Sub-threshold cohorts are hidden.</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {analytics.tenureInsights.map((row) => (
                                    <div key={row.cohort} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                                        <p className="text-xs font-medium text-slate-500">{row.label}</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {row.available ? row.responseCount : '—'}
                                        </p>
                                        {!row.available && (
                                            <p className="text-xs text-slate-400">{row.message}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="engagement-insights grid gap-6 lg:grid-cols-2">
                        <SectionShell
                            className="survey-ui survey-ui--analytics"
                            title="Survey insights"
                            description="Current survey status and response activity"
                            loading={analyticsState.loading}
                            error={analyticsState.error}
                            emptyMessage={
                                !analytics.surveys?.total && analytics.scope === 'org'
                                    ? 'No survey data available for this period.'
                                    : null
                            }
                        >
                            {analytics.scope === 'org' && (
                                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {[
                                        { label: 'Active', value: analytics.surveys?.active ?? 0 },
                                        { label: 'Completed', value: analytics.surveys?.closed ?? 0 },
                                        { label: 'Pending', value: analytics.surveys?.draft ?? 0 },
                                        {
                                            label: 'Participation',
                                            value: participationDisplay,
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center"
                                        >
                                            <p className="text-xs font-medium text-slate-500">{item.label}</p>
                                            <p className="mt-1 text-lg font-bold text-slate-900">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                Response trend ({dateRangeLabel})
                            </p>
                            {hasResponseTrend ? (
                                <SimpleTrendChart data={responseTrend} color={MINT} />
                            ) : (
                                <p className="py-6 text-center text-sm text-slate-500">
                                    No survey data available for this period.
                                </p>
                            )}
                        </SectionShell>

                        <SectionShell
                            className="survey-ui survey-ui--analytics"
                            title="eNPS insights"
                            description="Employee Net Promoter Score"
                            loading={analyticsState.loading}
                            error={analyticsState.error}
                        >
                            <EnpsBreakdown detail={analytics.eNPSDetail} />
                            <p className="mb-2 mt-6 text-xs font-semibold uppercase text-slate-500">
                                eNPS trend ({dateRangeLabel})
                            </p>
                            {enpsTrendHasData ? (
                                <EnpsTrendChart data={analytics.trends?.enps} />
                            ) : (analytics.trends?.enps || []).length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-500">
                                    No survey data available for this period.
                                </p>
                            ) : (
                                <p className="py-6 text-center text-sm text-slate-500">{PRIVACY_MSG}</p>
                            )}
                        </SectionShell>
                    </div>

                    <div className="engagement-insights grid gap-6 lg:grid-cols-2">
                        <SectionShell
                            title="Feedback & suggestions"
                            description="Operational status (lifetime totals)"
                            loading={analyticsState.loading}
                            error={analyticsState.error}
                        >
                            <div className="grid gap-6 md:grid-cols-2">
                                {(analytics.feedback?.length > 0 ||
                                    analytics.openFeedback > 0) && (
                                    <StatusBreakdown
                                        title="Feedback"
                                        statuses={FEEDBACK_STATUS_LABELS}
                                        items={analytics.feedback}
                                        accent="#8b5cf6"
                                    />
                                )}
                                {(!analytics.feedback?.length && !analytics.openFeedback) && (
                                    <p className="text-sm text-slate-500">No feedback available.</p>
                                )}
                                {analytics.suggestions?.byStatus?.length > 0 ? (
                                    <StatusBreakdown
                                        title="Suggestions"
                                        statuses={SUGGESTION_STATUS_LABELS}
                                        items={analytics.suggestions.byStatus}
                                        accent="#6366f1"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-500">No suggestions available.</p>
                                )}
                            </div>
                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                        Feedback trend ({dateRangeLabel})
                                    </p>
                                    {hasFeedbackTrend ? (
                                        <SimpleTrendChart data={feedbackTrend} color="#8b5cf6" />
                                    ) : (
                                        <p className="py-4 text-center text-xs text-slate-500">
                                            No feedback for this period.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                        Suggestions trend ({dateRangeLabel})
                                    </p>
                                    {hasSuggestionTrend ? (
                                        <SimpleTrendChart data={suggestionTrend} color="#6366f1" />
                                    ) : (
                                        <p className="py-4 text-center text-xs text-slate-500">
                                            No suggestions for this period.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </SectionShell>

                        <SectionShell
                            title="Recognition insights"
                            description="Approved recognition activity"
                            loading={recognitionState.loading}
                            error={recognitionState.error}
                        >
                            <div className="mb-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                                    <p className="text-xs font-medium text-slate-500">Total (approved)</p>
                                    <p className="mt-1 text-xl font-bold text-slate-900">
                                        {analytics.recognitionCount ?? recognitionAnalytics?.approved ?? '—'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                                    <p className="text-xs font-medium text-slate-500">Distinct givers</p>
                                    <p className="mt-1 text-xl font-bold text-slate-900">
                                        {recognitionAnalytics?.distinctGivers ?? '—'}
                                    </p>
                                </div>
                            </div>
                            {recognitionAnalytics?.byCategory?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-800">
                                        By category
                                    </h4>
                                    <ul className="mt-2 space-y-1.5">
                                        {recognitionAnalytics.byCategory.map((row) => (
                                            <li
                                                key={row.category}
                                                className="flex justify-between text-sm"
                                            >
                                                <span className="text-slate-600">{row.category}</span>
                                                <span className="font-semibold text-slate-900">
                                                    {row.count}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                Recognition trend ({dateRangeLabel})
                            </p>
                            {hasRecognitionTrend ? (
                                <SimpleTrendChart data={recognitionTrend} color="#f59e0b" />
                            ) : (
                                <p className="py-4 text-center text-sm text-slate-500">
                                    No recognition activity for this period.
                                </p>
                            )}
                        </SectionShell>
                    </div>

                    {analytics.scope === 'org' && (
                        <SectionShell
                            title="Department breakdown"
                            description="Identified survey responses only. Groups below the privacy threshold are suppressed."
                            loading={analyticsState.loading}
                            error={analyticsState.error}
                        >
                            <div className="engagement-table overflow-x-auto rounded-xl border border-slate-100">
                                <table className="w-full min-w-[400px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80">
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Department
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Survey Responses
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Participation %
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                eNPS
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Feedback
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Suggestions
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Recognition
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(analytics.departmentBreakdown || []).length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="px-4 py-8 text-center text-slate-500"
                                                >
                                                    No identified survey responses yet. Anonymous responses
                                                    are excluded.
                                                </td>
                                            </tr>
                                        ) : (
                                            analytics.departmentBreakdown.map((row) => (
                                                <tr
                                                    key={row.department}
                                                    className="border-b border-slate-50"
                                                >
                                                    <td className="px-4 py-3 font-medium text-slate-900">
                                                        {row.department || 'Unknown'}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                        {row.available ? row.responseCount ?? '—' : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {row.available && row.surveyParticipationRate != null
                                                            ? `${row.surveyParticipationRate}%`
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {row.available && row.eNPS != null ? row.eNPS : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {row.available ? row.feedbackCount ?? '—' : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {row.available ? row.suggestionCount ?? '—' : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        {row.available ? row.recognitionCount ?? '—' : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {row.available ? (
                                                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                                Available
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                                                                title={row.message}
                                                            >
                                                                {PRIVACY_MSG}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionShell>
                    )}

                    {analytics.privacyNote && (
                        <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                            {analytics.privacyNote}
                        </p>
                    )}
                </>
            )}

            {analyticsState.loading && (
                <div className="flex justify-center py-16">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]" />
                </div>
            )}
        </div>
    );
};

export default EngagementDashboard;
