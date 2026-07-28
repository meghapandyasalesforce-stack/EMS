import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
    FaBalanceScale, FaBell, FaChartPie, FaGraduationCap, FaLaptop, FaSearch, FaUserCheck,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import useLifecycleFeatures from '../../Hooks/useLifecycleFeatures';
import StatutoryCompliancePanel from './StatutoryCompliancePanel';
import ItProvisioningPanel from './ItProvisioningPanel';
import LmsDashboard from './LmsDashboard';
import ProbationCenter from './ProbationCenter';
import EnterpriseCommandCenter from './EnterpriseCommandCenter';

const ALL_TABS = [
    { key: 'dashboards', label: 'Command Center', icon: FaChartPie, features: ['enterpriseDashboards'] },
    { key: 'statutory', label: 'Statutory', icon: FaBalanceScale, features: ['indiaStatutoryCompliance'] },
    {
        key: 'it',
        label: 'IT Provisioning',
        icon: FaLaptop,
        features: ['softwareAccessRequest', 'itAssetProvisioning', 'itTicketingIntegration'],
    },
    { key: 'lms', label: 'LMS', icon: FaGraduationCap, features: ['lmsDashboard', 'trainingLms', 'mandatoryTraining'] },
    { key: 'probation', label: 'Probation', icon: FaUserCheck, features: ['probationCenter', 'probation'] },
    { key: 'notifications', label: 'Notifications', icon: FaBell, features: ['notificationCenter', 'bulkOperations'] },
];

const CATEGORY_ORDER = [
    'employees', 'offers', 'documents', 'forms', 'letters',
    'workflows', 'tasks', 'exit_interviews', 'candidates', 'reports',
];

const LifecycleEnterpriseHub = () => {
    const { isEnabled, loaded } = useLifecycleFeatures({ admin: true });
    const [tab, setTab] = useState('dashboards');
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [notifConfig, setNotifConfig] = useState(null);
    const [bulkOp, setBulkOp] = useState('progress_refresh');
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);
    const [legacyDashboardType, setLegacyDashboardType] = useState('executive');
    const [legacyDashboard, setLegacyDashboard] = useState(null);
    const [legacyLoading, setLegacyLoading] = useState(false);

    const visibleTabs = useMemo(() => {
        if (!loaded) return [];
        return ALL_TABS.filter((t) => (t.features || []).some((f) => isEnabled(f)));
    }, [loaded, isEnabled]);

    const searchEnabled = loaded && isEnabled('globalLifecycleSearch');
    const bulkEnabled = loaded && isEnabled('bulkOperations');
    const notifEnabled = loaded && isEnabled('notificationCenter');

    useEffect(() => {
        if (!loaded || !visibleTabs.length) return;
        if (!visibleTabs.some((t) => t.key === tab)) {
            setTab(visibleTabs[0].key);
        }
    }, [loaded, visibleTabs, tab]);

    useEffect(() => {
        if (tab === 'notifications' && notifEnabled) {
            axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/notifications/center`)
                .then(({ data }) => setNotifConfig(data.data))
                .catch((err) => {
                    if (err.response?.status === 403) {
                        toast.error(err.response?.data?.message || 'Notification center is disabled in Configure');
                    }
                });
        }
    }, [tab, notifEnabled]);

    const loadLegacyDashboard = useCallback(async () => {
        if (!isEnabled('enterpriseDashboards')) return;
        try {
            setLegacyLoading(true);
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/dashboards/${legacyDashboardType}`);
            setLegacyDashboard(data.data);
        } catch (err) {
            setLegacyDashboard(null);
            if (err.response?.status === 403) {
                toast.error(err.response?.data?.message || 'Dashboards are disabled in Configure');
            }
        } finally {
            setLegacyLoading(false);
        }
    }, [legacyDashboardType, isEnabled]);

    const runSearch = async () => {
        if (!searchEnabled) {
            toast.error('Global search is disabled in Employee Lifecycle → Configure');
            return;
        }
        if (searchQ.trim().length < 2) {
            toast.info('Enter at least 2 characters to search');
            return;
        }
        try {
            setSearching(true);
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/search`, {
                params: { q: searchQ.trim(), limit: 40 },
            });
            setSearchResults(data.data?.results || []);
        } catch (err) {
            setSearchResults([]);
            toast.error(err.response?.data?.message || 'Search failed');
        } finally {
            setSearching(false);
        }
    };

    const groupedSearch = useMemo(() => {
        const groups = {};
        for (const r of searchResults) {
            const cat = r.category || 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(r);
        }
        return CATEGORY_ORDER
            .filter((c) => groups[c]?.length)
            .concat(Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)))
            .map((c) => ({ category: c, items: groups[c] || [] }));
    }, [searchResults]);

    const saveNotif = async () => {
        try {
            await axios.patch(`${ADMIN_LIFECYCLE_ENDPOINT}/notifications/center`, { global: notifConfig?.global });
            toast.success('Notification settings saved');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        }
    };

    const runBulk = async () => {
        try {
            setBulkRunning(true);
            setBulkResult(null);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/bulk/execute`, {
                operation: bulkOp,
                payload: {},
            });
            setBulkResult(data.data);
            toast.success(`Bulk: ${data.data?.succeeded ?? 0}/${data.data?.total ?? 0} succeeded`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk failed');
        } finally {
            setBulkRunning(false);
        }
    };

    if (!loaded) {
        return (
            <div className="page-shell bg-gray-50 pb-8">
                <div className="page-shell-inner">
                    <LoadingSpinner message="Loading enterprise command center..." />
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell bg-gray-50 pb-8">
            <div className="page-shell-inner space-y-4">
                {searchEnabled && (
                    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                                <input
                                    value={searchQ}
                                    onChange={(e) => {
                                        setSearchQ(e.target.value);
                                        if (!e.target.value.trim()) setSearchResults([]);
                                    }}
                                    placeholder="Search employees, offers, documents, forms, letters, workflows, tasks, exit interviews, reports…"
                                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:border-theme-primary focus:outline-none focus:ring-1 focus:ring-theme-primary"
                                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={runSearch}
                                disabled={searching}
                                className="shrink-0 rounded-lg bg-theme-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                            >
                                {searching ? 'Searching…' : 'Search'}
                            </button>
                        </div>
                        {groupedSearch.length > 0 && (
                            <div className="mt-3 max-h-72 space-y-3 overflow-y-auto border-t border-gray-100 pt-3">
                                {groupedSearch.map((group) => (
                                    <div key={group.category}>
                                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                            {group.category.replace(/_/g, ' ')} ({group.items.length})
                                        </p>
                                        <div className="space-y-1.5">
                                            {group.items.map((r, i) => (
                                                <div key={`${r.category}-${r.id}-${i}`} className="rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50">
                                                    <p className="font-medium text-gray-900">{r.title}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {[r.subtitle, r.meta].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {visibleTabs.length > 0 ? (
                    <div className="hrms-chip-scroll">
                        <div className="hrms-chip-scroll-track">
                            {visibleTabs.map(({ key, label, icon: Icon }) => (
                                <div key={key} className="hrms-chip-scroll-item">
                                    <button
                                        type="button"
                                        onClick={() => setTab(key)}
                                        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${tab === key ? 'border-theme-primary bg-theme-primary text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                                    >
                                        <Icon /> {label}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
                        No enterprise modules are enabled. Turn features on in Employee Lifecycle → Configure.
                    </div>
                )}

                {visibleTabs.some((t) => t.key === tab) && (
                    <section className={`rounded-xl bg-white shadow-sm border border-gray-100 ${tab === 'dashboards' ? 'p-4 sm:p-5' : 'p-6'} min-h-[400px]`}>
                        {tab === 'dashboards' && (
                            <EnterpriseCommandCenter
                                isEnabled={isEnabled}
                                onNavigateTab={setTab}
                                bulkEnabled={bulkEnabled}
                                notifEnabled={notifEnabled}
                            />
                        )}

                        {tab === 'statutory' && isEnabled('indiaStatutoryCompliance') && <StatutoryCompliancePanel />}
                        {tab === 'it' && (isEnabled('softwareAccessRequest') || isEnabled('itAssetProvisioning') || isEnabled('itTicketingIntegration')) && (
                            <ItProvisioningPanel isHRView />
                        )}
                        {tab === 'lms' && (isEnabled('lmsDashboard') || isEnabled('trainingLms') || isEnabled('mandatoryTraining')) && (
                            <LmsDashboard isHRView />
                        )}
                        {tab === 'probation' && (isEnabled('probationCenter') || isEnabled('probation')) && <ProbationCenter />}
                        {tab === 'notifications' && (notifEnabled || bulkEnabled) && (
                            <div className="space-y-6">
                                {notifEnabled && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900">Notification channels</h3>
                                        <p className="mt-1 text-sm text-gray-500">Configure global channels for lifecycle events.</p>
                                        {notifConfig ? (
                                            <>
                                                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                    {Object.entries(notifConfig.global || {}).map(([ch, enabled]) => (
                                                        <label key={ch} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm capitalize">
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
                                                <button type="button" onClick={saveNotif} className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-sm text-white">
                                                    Save channels
                                                </button>
                                            </>
                                        ) : (
                                            <LoadingSpinner message="Loading notification settings..." />
                                        )}
                                    </div>
                                )}
                                {bulkEnabled && (
                                    <div className={notifEnabled ? 'border-t border-gray-100 pt-6' : ''}>
                                        <h3 className="text-sm font-semibold text-gray-900">Bulk operations</h3>
                                        <p className="mt-1 text-sm text-gray-500">Run lifecycle maintenance and exports.</p>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <select
                                                value={bulkOp}
                                                onChange={(e) => setBulkOp(e.target.value)}
                                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                            >
                                                <option value="progress_refresh">Refresh onboarding progress</option>
                                                <option value="export_workflows">Export workflows CSV</option>
                                                <option value="send_reminders">Send reminders</option>
                                                <option value="document_verify">Verify documents</option>
                                                <option value="document_remind">Remind document owners</option>
                                                <option value="letter_generate">Generate letters</option>
                                                <option value="send_notifications">Trigger notifications</option>
                                                <option value="workflow_assign">Assign workflow templates</option>
                                                <option value="onboarding_create">Bulk create onboarding</option>
                                                <option value="offboarding_create">Bulk create offboarding</option>
                                            </select>
                                            <button
                                                type="button"
                                                disabled={bulkRunning}
                                                onClick={runBulk}
                                                className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                                            >
                                                {bulkRunning ? 'Running…' : 'Run'}
                                            </button>
                                        </div>
                                        {bulkResult && (
                                            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                                                Succeeded {bulkResult.succeeded ?? 0} / {bulkResult.total ?? 0}
                                                {bulkResult.failed ? ` · Failed ${bulkResult.failed}` : ''}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Preserved alternate dashboard type viewer */}
                                {isEnabled('enterpriseDashboards') && (
                                    <div className="border-t border-gray-100 pt-6">
                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-sm font-semibold text-gray-900">Classic dashboard views</h3>
                                            <button type="button" onClick={loadLegacyDashboard} className="text-xs text-theme-primary underline">
                                                Load view
                                            </button>
                                        </div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {['executive', 'hr', 'recruitment', 'lifecycle', 'country'].map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setLegacyDashboardType(t)}
                                                    className={`rounded-full px-3 py-1 text-xs capitalize ${legacyDashboardType === t ? 'bg-theme-primary text-white' : 'border border-gray-200'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                        {legacyLoading ? <LoadingSpinner /> : legacyDashboard?.kpis ? (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                                {Object.entries(legacyDashboard.kpis).map(([k, v]) => (
                                                    <div key={k} className="rounded-lg border p-4">
                                                        <p className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
                                                        <p className="text-xl font-bold">{v}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">Select a type and load to view raw KPI packs.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default LifecycleEnterpriseHub;
