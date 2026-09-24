import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FiSave, FiToggleLeft, FiToggleRight, FiPackage, FiFileText,
    FiSettings, FiSliders, FiTool,
} from 'react-icons/fi';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { clearLifecycleFeaturesCache } from '../../Hooks/useLifecycleFeatures';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormBuilderHub from './FormBuilderHub';
import DocumentHub from './DocumentHub';
import ExitInterviewHub from './ExitInterviewHub';
import LetterGeneratorHub from './LetterGeneratorHub';

/** Top-level Configure sections — lean nav; hubs kept (only entry points). */
const SECTIONS = [
    { id: 'modules', label: 'Features', icon: FiSettings },
    { id: 'policies', label: 'Policies', icon: FiSliders },
    { id: 'packs', label: 'Packs', icon: FiPackage },
    { id: 'builders', label: 'Builders', icon: FiTool },
    { id: 'documents', label: 'Document Catalog', icon: FiFileText },
];

const BUILDER_TABS = [
    { id: 'forms', label: 'Forms', featureKeys: ['digitalForms', 'emergencyContact', 'familyNominee', 'bankDetails'] },
    { id: 'documents-hub', label: 'Document Hub', featureKeys: ['documentCollection', 'documentApproval'] },
    { id: 'exit-interview', label: 'Exit Interview', featureKeys: ['exitInterview'] },
    { id: 'letters', label: 'Letter Generator', featureKeys: ['experienceLetter', 'relievingLetter', 'serviceCertificate', 'offerLetter'] },
];

const BGV_VENDORS = import.meta.env.PROD ? ['manual'] : ['manual', 'stub_vendor'];
const ESIGN_PROVIDERS = [
    { value: 'internal', label: 'Internal (built-in)' },
    { value: 'docusign', label: 'DocuSign (requires server credentials)' },
    { value: 'adobe_sign', label: 'Adobe Sign (requires server credentials)' },
    { value: 'aadhaar_esign', label: 'Aadhaar eSign (requires server credentials)' },
];

/**
 * Hide from Configure UI — already in other modules, dead toggles (no runtime gate),
 * or duplicated under Policies. Keys still persist; other modules untouched.
 */
const HIDDEN_FROM_CONFIGURE = new Set([
    // Already in employee / org / leave / attendance / payroll / branding / email
    'departmentAssignment',
    'designationAssignment',
    'reportingManagerAssignment',
    'workLocationAssignment',
    'shiftAssignment',
    'attendancePolicyAssignment',
    'leavePolicyAssignment',
    'employeeIdGeneration',
    'payrollSetup',
    'welcomeEmail',
    'whiteLabelBranding',
    'notificationCenter',
    'leaveEncashment',
    'bonusRecovery',
    // Dead / unused toggles (capability exists elsewhere or not gated by this key)
    'candidatePortal',
    'employeeFeedback',
    'hrInitiatedExit',
    'termination',
    'retirement',
    'contractCompletion',
    'noticeAlerts',
    'lastWorkingDay',
    'assetDamageReporting',
    'itTicketingIntegration',
    // Unused / redundant toggles (no unique runtime gate or no UI)
    'joiningChecklist',
    'probationCenter',
    'lmsDashboard',
    'bulkOperations',
    // Shared / Automation — managed via Rules / Enterprise hub, not Features list
    'reminders',
    'escalations',
    'enterpriseDashboards',
    'globalLifecycleSearch',
]);

/** Build explicit true/false for every registry feature (avoids undefined === Enabled). */
function normalizeFeatureMap(stored = {}, registryFeatures = []) {
    const map = {};
    for (const feature of registryFeatures) {
        if (Object.prototype.hasOwnProperty.call(stored, feature.key)) {
            map[feature.key] = stored[feature.key] === true;
        } else if (feature.category === 'compliance' || feature.category === 'industry') {
            map[feature.key] = false;
        } else {
            map[feature.key] = feature.defaultEnabled !== false;
        }
    }
    return map;
}

function applyPackFeatureState(prev, pack, enable) {
    const next = { ...prev };
    for (const key of pack.features || []) {
        next[key] = enable === true;
    }
    return next;
}

const Toggle = ({ checked, onChange, disabled = false }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        className={`text-2xl ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-pressed={checked}
    >
        {checked ? <FiToggleRight className="text-emerald-600" /> : <FiToggleLeft className="text-gray-400" />}
    </button>
);

const LifecycleConfigurationPanel = () => {
    const [activeSection, setActiveSection] = useState('modules');
    const [builderTab, setBuilderTab] = useState('forms');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [enabledFeatures, setEnabledFeatures] = useState({});
    const [modules, setModules] = useState({ onboarding: { enabled: true }, offboarding: { enabled: true } });
    const [noticePeriodPolicy, setNoticePeriodPolicy] = useState({});
    const [fnfPolicy, setFnfPolicy] = useState({});
    const [bgvPolicy, setBgvPolicy] = useState({});
    const [offerPolicy, setOfferPolicy] = useState({ defaultExpiryDays: 7 });
    const [esignProvider, setEsignProvider] = useState('internal');
    const [defaults, setDefaults] = useState({});
    const [documentOverrides, setDocumentOverrides] = useState([]);
    const [onboardingTemplates, setOnboardingTemplates] = useState([]);
    const [offboardingTemplates, setOffboardingTemplates] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [registryRes, onbTplRes, offTplRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/templates/onboarding`, { withCredentials: true }).catch(() => ({ data: { data: [] } })),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/templates/offboarding`, { withCredentials: true }).catch(() => ({ data: { data: [] } })),
            ]);
            const { data } = registryRes;
            if (!data.success) throw new Error(data.message);
            setSnapshot(data.data);
            const settings = data.data.settings || {};
            const registryFeatures = data.data.registry?.features || [];
            setModules(settings.modules || { onboarding: { enabled: true }, offboarding: { enabled: true } });
            setEnabledFeatures(normalizeFeatureMap(settings.enabledFeatures || {}, registryFeatures));
            setNoticePeriodPolicy(settings.noticePeriodPolicy || {});
            setFnfPolicy(settings.fnfPolicy || {});
            setBgvPolicy(settings.bgvPolicy || { vendor: 'manual' });
            setOfferPolicy(settings.offerPolicy || { defaultExpiryDays: 7 });
            setEsignProvider(settings.esignProvider || 'internal');
            setDefaults(settings.defaults || {});
            setDocumentOverrides(settings.documentOverrides || []);
            setOnboardingTemplates(onbTplRes.data?.data || []);
            setOffboardingTemplates(offTplRes.data?.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to load configuration');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const featuresByModule = useMemo(() => {
        const features = snapshot?.registry?.features || [];
        const isPackFeature = (f) => f.category === 'industry' || f.category === 'compliance';
        const visible = (f) => !isPackFeature(f) && !HIDDEN_FROM_CONFIGURE.has(f.key);
        return {
            onboarding: features.filter((f) => f.module === 'onboarding' && visible(f)),
            offboarding: features.filter((f) => f.module === 'offboarding' && visible(f)),
            shared: features.filter((f) => f.module === 'shared' && visible(f)),
        };
    }, [snapshot]);

    const industryPacks = snapshot?.registry?.industryPacks || [];
    const compliancePacks = snapshot?.registry?.compliancePacks || [];

    const featOn = useCallback((key) => enabledFeatures[key] === true, [enabledFeatures]);

    const visibleBuilderTabs = useMemo(
        () => BUILDER_TABS.filter((t) => (t.featureKeys || []).some((k) => featOn(k))),
        [featOn]
    );

    const visibleSections = useMemo(() => SECTIONS.filter((s) => {
        if (s.id === 'builders') return visibleBuilderTabs.length > 0;
        return true;
    }), [visibleBuilderTabs]);

    useEffect(() => {
        if (!visibleSections.some((s) => s.id === activeSection)) {
            setActiveSection(visibleSections[0]?.id || 'modules');
        }
    }, [visibleSections, activeSection]);

    useEffect(() => {
        if (!visibleBuilderTabs.some((t) => t.id === builderTab)) {
            setBuilderTab(visibleBuilderTabs[0]?.id || 'forms');
        }
    }, [visibleBuilderTabs, builderTab]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const { data } = await axios.patch(`${ADMIN_LIFECYCLE_ENDPOINT}/settings`, {
                modules,
                enabledFeatures,
                noticePeriodPolicy,
                fnfPolicy,
                bgvPolicy,
                offerPolicy,
                esignProvider,
                defaults,
                documentOverrides,
            }, { withCredentials: true });
            if (!data.success) throw new Error(data.message);
            clearLifecycleFeaturesCache();
            const saved = data.data || {};
            const registryFeatures = snapshot?.registry?.features || [];
            setEnabledFeatures(normalizeFeatureMap(saved.enabledFeatures || enabledFeatures, registryFeatures));
            if (saved.modules) setModules(saved.modules);
            if (saved.documentOverrides) setDocumentOverrides(saved.documentOverrides);
            toast.success('Configuration saved — feature status updated for your organization');
            const registryRes = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true });
            if (registryRes.data?.success) {
                setSnapshot(registryRes.data.data);
                const settings = registryRes.data.data?.settings || {};
                setEnabledFeatures(normalizeFeatureMap(
                    settings.enabledFeatures || {},
                    registryRes.data.data?.registry?.features || registryFeatures,
                ));
                setDocumentOverrides(settings.documentOverrides || []);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const isPackEnabled = (pack) => {
        const keys = pack.features || [];
        if (!keys.length) return false;
        const packList = pack.key?.startsWith('compliance.')
            ? (snapshot?.settings?.compliancePacks || [])
            : (snapshot?.settings?.industryPacks || []);
        const meta = packList.find((p) => p.packKey === pack.key);
        if (meta && meta.enabled === false) return false;
        return keys.every((key) => enabledFeatures[key] === true);
    };

    const togglePack = async (type, pack, enable) => {
        setEnabledFeatures((prev) => applyPackFeatureState(prev, pack, enable));
        setSnapshot((prev) => {
            if (!prev?.settings) return prev;
            const listKey = type === 'industry' ? 'industryPacks' : 'compliancePacks';
            const list = [...(prev.settings[listKey] || [])];
            const idx = list.findIndex((p) => p.packKey === pack.key);
            const entry = { packKey: pack.key, enabled: enable === true, installedAt: new Date().toISOString() };
            if (idx >= 0) list[idx] = { ...list[idx], ...entry };
            else list.push(entry);
            return {
                ...prev,
                settings: { ...prev.settings, [listKey]: list },
            };
        });

        try {
            const endpoint = enable
                ? `${ADMIN_LIFECYCLE_ENDPOINT}/packs/${type}/install`
                : `${ADMIN_LIFECYCLE_ENDPOINT}/packs/${type}/uninstall`;
            const { data } = await axios.post(endpoint, { packKey: pack.key }, { withCredentials: true });
            if (!data.success) throw new Error(data.message);

            clearLifecycleFeaturesCache();
            const savedFeatures = data.data?.enabledFeatures;
            const registryFeatures = snapshot?.registry?.features || [];
            if (savedFeatures) {
                setEnabledFeatures(normalizeFeatureMap(savedFeatures, registryFeatures));
            }
            const registryRes = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true });
            if (registryRes.data?.success) {
                setSnapshot(registryRes.data.data);
                const settings = registryRes.data.data?.settings || {};
                setEnabledFeatures(normalizeFeatureMap(
                    settings.enabledFeatures || {},
                    registryRes.data.data?.registry?.features || registryFeatures,
                ));
            }

            toast.success(`${type === 'industry' ? 'Industry' : 'Compliance'} pack ${enable ? 'enabled' : 'disabled'}`);
        } catch (error) {
            setEnabledFeatures((prev) => applyPackFeatureState(prev, pack, !enable));
            toast.error(error.response?.data?.message || error.message || (enable ? 'Enable failed' : 'Disable failed'));
            try { await load(); } catch { /* ignore */ }
        }
    };

    if (loading) {
        return (
            <div className="page-shell bg-gray-50">
                <LoadingSpinner message="Loading configuration..." />
            </div>
        );
    }

    const renderFeatureGroup = (title, features) => (
        <div className="mb-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
            <div className="grid gap-2">
                {features.map((feature) => {
                    const enabled = enabledFeatures[feature.key] === true;
                    return (
                        <div key={feature.key} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="min-w-0 pr-3">
                                <p className="font-medium text-gray-900 text-sm">{feature.label}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {enabled ? 'On' : 'Off'}
                                </span>
                                <Toggle
                                    checked={enabled}
                                    onChange={(v) => setEnabledFeatures((prev) => ({ ...prev, [feature.key]: v }))}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderPackGrid = (packs, type, emptyLabel) => (
        <div className="grid sm:grid-cols-2 gap-3">
            {packs.length === 0 ? (
                <p className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                    {emptyLabel}
                </p>
            ) : packs.map((pack) => {
                const enabled = isPackEnabled(pack);
                return (
                    <div key={pack.key} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="font-semibold text-sm">{pack.label}</p>
                                <p className="text-xs text-gray-600 mt-1">{pack.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                                    {enabled ? 'On' : 'Off'}
                                </span>
                                <Toggle checked={enabled} onChange={(v) => togglePack(type, pack, v)} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="page-shell bg-gray-50 pb-8">
            <div className="page-shell-inner space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600">
                            Organization lifecycle settings. Changes apply to your organization only.
                        </p>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-semibold shrink-0"
                        >
                            <FiSave /> {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-100">
                        {visibleSections.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveSection(id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                    activeSection === id ? 'bg-theme-primary/10 text-theme-primary' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Icon className="shrink-0" /> {label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                    {activeSection === 'modules' && (
                        <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-3">
                                {['onboarding', 'offboarding'].map((mod) => (
                                    <div key={mod} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-sm capitalize">{mod}</p>
                                            <p className="text-xs text-gray-500">Enable or disable module</p>
                                        </div>
                                        <Toggle
                                            checked={modules[mod]?.enabled !== false}
                                            onChange={(v) => setModules((prev) => ({ ...prev, [mod]: { enabled: v } }))}
                                        />
                                    </div>
                                ))}
                            </div>
                            {featuresByModule.onboarding.length > 0 && renderFeatureGroup('Onboarding Features', featuresByModule.onboarding)}
                            {featuresByModule.offboarding.length > 0 && renderFeatureGroup('Offboarding Features', featuresByModule.offboarding)}
                            {featuresByModule.shared.length > 0 && renderFeatureGroup('Shared / Automation', featuresByModule.shared)}
                        </div>
                    )}

                    {activeSection === 'policies' && (
                        <div className="space-y-6">
                            <PolicyCard title="Notice Period Policy">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <NumberField label="Default notice days" value={noticePeriodPolicy.defaultNoticeDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, defaultNoticeDays: v }))} />
                                    <NumberField label="Probation notice days" value={noticePeriodPolicy.probationNoticeDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, probationNoticeDays: v }))} />
                                    <NumberField label="Max buyout days" value={noticePeriodPolicy.maxBuyoutDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, maxBuyoutDays: v }))} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-4">
                                    <ToggleRow label="Allow notice buyout" checked={noticePeriodPolicy.allowBuyout} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, allowBuyout: v }))} />
                                    <ToggleRow label="Allow leave adjustment" checked={noticePeriodPolicy.allowLeaveAdjustment !== false} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, allowLeaveAdjustment: v }))} />
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Leave adjustment also requires Features → Leave Adjustment During Notice.
                                </p>
                            </PolicyCard>

                            <PolicyCard title="Full & Final Settlement Policy">
                                <div className="flex flex-wrap gap-4">
                                    <ToggleRow label="Include leave encashment" checked={fnfPolicy.includeLeaveEncashment !== false} onChange={(v) => setFnfPolicy((p) => ({ ...p, includeLeaveEncashment: v }))} />
                                    <ToggleRow label="Include bonus" checked={fnfPolicy.includeBonus !== false} onChange={(v) => setFnfPolicy((p) => ({ ...p, includeBonus: v }))} />
                                    <ToggleRow label="Include gratuity estimate" checked={fnfPolicy.includeGratuityEstimate} onChange={(v) => setFnfPolicy((p) => ({ ...p, includeGratuityEstimate: v }))} />
                                    <ToggleRow label="Recovery from final pay" checked={fnfPolicy.recoveryFromFinalPay !== false} onChange={(v) => setFnfPolicy((p) => ({ ...p, recoveryFromFinalPay: v }))} />
                                    <ToggleRow label="Approval required" checked={fnfPolicy.approvalRequired !== false} onChange={(v) => setFnfPolicy((p) => ({ ...p, approvalRequired: v }))} />
                                </div>
                            </PolicyCard>

                            <PolicyCard title="Background Verification Policy">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="text-sm text-gray-700">
                                        Vendor
                                        <select value={bgvPolicy.vendor || 'manual'} onChange={(e) => setBgvPolicy((p) => ({ ...p, vendor: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                                            {BGV_VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </label>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <ToggleRow label="Block joining until BGV clear" checked={bgvPolicy.blockJoiningUntilClear} onChange={(v) => setBgvPolicy((p) => ({ ...p, blockJoiningUntilClear: v }))} />
                                    <p className="text-xs text-gray-500 pt-1">
                                        Extra BGV check types (employment, education, reference) are toggled under Features.
                                    </p>
                                </div>
                            </PolicyCard>

                            <PolicyCard title="Offer & E-Sign">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <NumberField label="Default offer expiry (days)" value={offerPolicy.defaultExpiryDays} onChange={(v) => setOfferPolicy((p) => ({ ...p, defaultExpiryDays: v }))} />
                                    <label className="text-sm text-gray-700">
                                        E-sign provider
                                        <select value={esignProvider} onChange={(e) => setEsignProvider(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                                            {ESIGN_PROVIDERS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                                        </select>
                                    </label>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Use Internal unless DocuSign / Adobe / Aadhaar credentials are configured on the server.
                                </p>
                            </PolicyCard>

                            <PolicyCard title="Default Templates">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="text-sm text-gray-700">
                                        Onboarding template
                                        <select value={defaults.onboardingTemplateId || ''} onChange={(e) => setDefaults((p) => ({ ...p, onboardingTemplateId: e.target.value || null }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                                            <option value="">System default</option>
                                            {onboardingTemplates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="text-sm text-gray-700">
                                        Offboarding template
                                        <select value={defaults.offboardingTemplateId || ''} onChange={(e) => setDefaults((p) => ({ ...p, offboardingTemplateId: e.target.value || null }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                                            <option value="">System default</option>
                                            {offboardingTemplates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                        </select>
                                    </label>
                                </div>
                            </PolicyCard>
                        </div>
                    )}

                    {activeSection === 'packs' && (
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">Industry packs</h3>
                                <p className="text-sm text-gray-600">Sector-specific workflows. Pack features stay off until enabled here.</p>
                                {renderPackGrid(industryPacks, 'industry', 'No industry packs loaded.')}
                            </div>
                            <div className="space-y-3 border-t border-gray-100 pt-6">
                                <h3 className="text-sm font-semibold text-gray-900">Compliance packs</h3>
                                <p className="text-sm text-gray-600">Statutory packs (e.g. India Aadhaar, PAN, EPF, ESI). Managed here — not under Features.</p>
                                {renderPackGrid(compliancePacks, 'compliance', 'No compliance packs loaded.')}
                            </div>
                        </div>
                    )}

                    {activeSection === 'builders' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-1.5 border-b border-gray-100 pb-3">
                                {visibleBuilderTabs.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setBuilderTab(t.id)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                            builderTab === t.id
                                                ? 'bg-theme-primary text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            {builderTab === 'forms' && <FormBuilderHub />}
                            {builderTab === 'documents-hub' && <DocumentHub />}
                            {builderTab === 'exit-interview' && <ExitInterviewHub />}
                            {builderTab === 'letters' && <LetterGeneratorHub />}
                        </div>
                    )}

                    {activeSection === 'documents' && (
                        <div className="space-y-6">
                            <p className="text-sm text-gray-500">
                                Enable or require catalog documents for onboarding and offboarding.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-6">
                                <ConfigurableDocumentList
                                    title="Onboarding Documents"
                                    docs={snapshot?.documentCatalog?.onboarding || []}
                                    preferredKeys={['PASSPORT', 'NDA', 'OFFER_ACK', 'OTHER']}
                                    overrides={documentOverrides}
                                    onChange={setDocumentOverrides}
                                />
                                <ConfigurableDocumentList
                                    title="Offboarding Documents"
                                    docs={snapshot?.documentCatalog?.offboarding || []}
                                    preferredKeys={[]}
                                    overrides={documentOverrides}
                                    onChange={setDocumentOverrides}
                                />
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

function PolicyCard({ title, children }) {
    return (
        <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-sm mb-3 text-gray-800">{title}</h3>
            {children}
        </div>
    );
}

function NumberField({ label, value, onChange }) {
    return (
        <label className="text-sm text-gray-700">
            {label}
            <input
                type="number"
                min="0"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
        </label>
    );
}

function ToggleRow({ label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between gap-3 min-w-[200px]">
            <span className="text-sm text-gray-700">{label}</span>
            <Toggle checked={!!checked} onChange={onChange} />
        </div>
    );
}

function ConfigurableDocumentList({ title, docs, preferredKeys = [], overrides, onChange }) {
    const preferredSet = new Set(preferredKeys);
    const overrideMap = useMemo(() => {
        const map = new Map();
        for (const row of overrides || []) {
            if (row?.catalogKey) map.set(row.catalogKey, row);
        }
        return map;
    }, [overrides]);

    const sortedDocs = useMemo(() => {
        const list = [...(docs || [])];
        list.sort((a, b) => {
            const aKey = a.key || a.catalogKey;
            const bKey = b.key || b.catalogKey;
            const aPref = preferredSet.has(aKey) ? 0 : 1;
            const bPref = preferredSet.has(bKey) ? 0 : 1;
            if (aPref !== bPref) return aPref - bPref;
            return String(a.label || aKey).localeCompare(String(b.label || bKey));
        });
        return list;
    }, [docs, preferredKeys]);

    const upsertOverride = (catalogKey, patch) => {
        const existing = overrideMap.get(catalogKey) || { catalogKey };
        const nextRow = { ...existing, catalogKey, ...patch };
        const without = (overrides || []).filter((row) => row.catalogKey !== catalogKey);
        onChange([...without, nextRow]);
    };

    return (
        <div>
            <h3 className="font-semibold text-sm mb-3">{title}</h3>
            <div className="space-y-2">
                {sortedDocs.map((doc) => {
                    const key = doc.key || doc.catalogKey;
                    const override = overrideMap.get(key);
                    const enabled = override?.enabled ?? doc.enabled ?? true;
                    const mandatory = override?.mandatory ?? doc.mandatory ?? false;
                    const isPreferred = preferredSet.has(key);
                    return (
                        <div
                            key={key}
                            className={`p-3 border rounded-lg space-y-2 ${isPreferred ? 'border-theme-secondary/40 bg-theme-secondary/5' : 'border-gray-200'}`}
                        >
                            <div className="flex justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-sm">{doc.label}</p>
                                </div>
                                {isPreferred && (
                                    <span className="text-[10px] uppercase tracking-wide text-theme-secondary shrink-0 font-semibold">
                                        Core
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <ToggleRow
                                    label="Enabled"
                                    checked={enabled !== false}
                                    onChange={(v) => upsertOverride(key, { enabled: v })}
                                />
                                <ToggleRow
                                    label="Required"
                                    checked={!!mandatory}
                                    onChange={(v) => upsertOverride(key, { mandatory: v, enabled: enabled !== false })}
                                />
                            </div>
                        </div>
                    );
                })}
                {!sortedDocs.length && <p className="text-sm text-gray-500">No documents for enabled features.</p>}
            </div>
        </div>
    );
}

export default LifecycleConfigurationPanel;
