import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FiSave, FiToggleLeft, FiToggleRight, FiPackage, FiShield,
    FiFileText, FiLayers, FiBell, FiSettings, FiSliders, FiClipboard, FiFolder, FiMessageSquare, FiMail,
} from 'react-icons/fi';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { clearLifecycleFeaturesCache } from '../../Hooks/useLifecycleFeatures';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferTemplateManager from '../../components/recruitment/OfferTemplateManager';
import WorkflowBuilder from './WorkflowBuilder';
import FormBuilderHub from './FormBuilderHub';
import DocumentHub from './DocumentHub';
import ExitInterviewHub from './ExitInterviewHub';
import LetterGeneratorHub from './LetterGeneratorHub';

const SECTIONS = [
    { id: 'modules', label: 'Features', icon: FiSettings },
    { id: 'policies', label: 'Policies', icon: FiSliders },
    { id: 'industry', label: 'Industry', icon: FiPackage },
    { id: 'compliance', label: 'Compliance', icon: FiShield },
    { id: 'templates', label: 'Templates', icon: FiLayers },
    { id: 'forms', label: 'Forms', icon: FiClipboard },
    { id: 'documents-hub', label: 'Document Hub', icon: FiFolder },
    { id: 'exit-interview', label: 'Exit Interview', icon: FiMessageSquare },
    { id: 'letters', label: 'Letter Generator', icon: FiMail },
    { id: 'documents', label: 'Documents', icon: FiFileText },
    { id: 'automation', label: 'Rules', icon: FiBell },
];

const APPROVAL_ENTITIES = ['Offer', 'Onboarding', 'Offboarding', 'Clearance', 'ExitInterview', 'FnF', 'AssetReturn'];
const ESCALATION_ROLES = ['hr', 'manager', 'it', 'payroll', 'admin'];
const CHANNELS = ['email', 'in_app', 'push'];
const BGV_VENDORS = import.meta.env.PROD ? ['manual'] : ['manual', 'stub_vendor'];
const ESIGN_PROVIDERS = ['internal', 'docusign', 'adobe_sign', 'aadhaar_esign'];

/** Build explicit true/false for every registry feature (avoids undefined === Enabled). */
function normalizeFeatureMap(stored = {}, registryFeatures = []) {
    const map = {};
    for (const feature of registryFeatures) {
        if (Object.prototype.hasOwnProperty.call(stored, feature.key)) {
            map[feature.key] = stored[feature.key] === true;
        } else if (feature.category === 'compliance' || feature.category === 'industry') {
            // Pack features stay off until explicitly enabled (never inherit core defaults)
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [enabledFeatures, setEnabledFeatures] = useState({});
    const [modules, setModules] = useState({ onboarding: { enabled: true }, offboarding: { enabled: true } });
    const [notifications, setNotifications] = useState({ email: true, inApp: true, push: true });
    const [noticePeriodPolicy, setNoticePeriodPolicy] = useState({});
    const [fnfPolicy, setFnfPolicy] = useState({});
    const [bgvPolicy, setBgvPolicy] = useState({});
    const [offerPolicy, setOfferPolicy] = useState({ defaultExpiryDays: 7 });
    const [esignProvider, setEsignProvider] = useState('internal');
    const [reminders, setReminders] = useState([]);
    const [escalations, setEscalations] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [defaults, setDefaults] = useState({});
    const [approvalWorkflows, setApprovalWorkflows] = useState([]);
    const [onboardingTemplates, setOnboardingTemplates] = useState([]);
    const [offboardingTemplates, setOffboardingTemplates] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [registryRes, workflowsRes, onbTplRes, offTplRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true }),
                axios.get('/v1/admin/approvals/workflows', { withCredentials: true }).catch(() => ({ data: { data: [] } })),
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
            setNotifications(settings.notifications || { email: true, inApp: true, push: true });
            setNoticePeriodPolicy(settings.noticePeriodPolicy || {});
            setFnfPolicy(settings.fnfPolicy || {});
            setBgvPolicy(settings.bgvPolicy || { vendor: 'manual' });
            setOfferPolicy(settings.offerPolicy || { defaultExpiryDays: 7 });
            setEsignProvider(settings.esignProvider || 'internal');
            setReminders(settings.reminders || []);
            setEscalations(settings.escalations || []);
            setApprovals(settings.approvals || []);
            setDefaults(settings.defaults || {});
            setApprovalWorkflows(workflowsRes.data?.data || workflowsRes.data?.workflows || []);
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
        return {
            onboarding: features.filter((f) => f.module === 'onboarding' && !isPackFeature(f)),
            offboarding: features.filter((f) => f.module === 'offboarding' && !isPackFeature(f)),
            shared: features.filter((f) => f.module === 'shared' && !isPackFeature(f)),
        };
    }, [snapshot]);

    const industryPacks = snapshot?.registry?.industryPacks || [];
    const compliancePacks = snapshot?.registry?.compliancePacks || [];

    const visibleSections = useMemo(() => {
        const featOn = (key) => enabledFeatures[key] === true;
        return SECTIONS.filter((s) => {
            if (s.id === 'forms') return featOn('digitalForms') || featOn('emergencyContact') || featOn('familyNominee') || featOn('bankDetails');
            if (s.id === 'documents-hub') return featOn('documentCollection') || featOn('documentApproval');
            if (s.id === 'exit-interview') return featOn('exitInterview');
            if (s.id === 'letters') {
                return featOn('experienceLetter') || featOn('relievingLetter') || featOn('serviceCertificate') || featOn('offerLetter');
            }
            return true;
        });
    }, [enabledFeatures]);

    useEffect(() => {
        if (!visibleSections.some((s) => s.id === activeSection)) {
            setActiveSection(visibleSections[0]?.id || 'modules');
        }
    }, [visibleSections, activeSection]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const { data } = await axios.patch(`${ADMIN_LIFECYCLE_ENDPOINT}/settings`, {
                modules,
                enabledFeatures,
                notifications,
                noticePeriodPolicy,
                fnfPolicy,
                bgvPolicy,
                offerPolicy,
                esignProvider,
                reminders,
                escalations,
                approvals,
                defaults,
            }, { withCredentials: true });
            if (!data.success) throw new Error(data.message);
            clearLifecycleFeaturesCache();
            const saved = data.data || {};
            const registryFeatures = snapshot?.registry?.features || [];
            setEnabledFeatures(normalizeFeatureMap(saved.enabledFeatures || enabledFeatures, registryFeatures));
            if (saved.modules) setModules(saved.modules);
            toast.success('Configuration saved — feature status updated for your organization');
            // Soft refresh registry snapshot without blanking the toggles
            const registryRes = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true });
            if (registryRes.data?.success) {
                setSnapshot(registryRes.data.data);
                const settings = registryRes.data.data?.settings || {};
                setEnabledFeatures(normalizeFeatureMap(
                    settings.enabledFeatures || {},
                    registryRes.data.data?.registry?.features || registryFeatures,
                ));
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
        // Optimistic UI so Status/toggle flip immediately (and Save won't re-send stale trues)
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
            // Soft-refresh settings (no full-page spinner — avoids wipe/race with Save)
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
            // Roll back optimistic flip
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
                                <p className="text-xs text-gray-500 truncate">{feature.key}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <p className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                                    Status: {enabled ? 'Enabled' : 'Disabled'}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Toggle
                                        checked={enabled}
                                        onChange={(v) => setEnabledFeatures((prev) => ({ ...prev, [feature.key]: v }))}
                                    />
                                    <span className="text-xs text-gray-600 whitespace-nowrap">
                                        {enabled ? 'Disable Feature' : 'Enable Feature'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="page-shell bg-gray-50 pb-8">
            <div className="page-shell-inner space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600">
                            Enable features, configure policies, and manage templates. Changes apply to your organization only.
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
                            {renderFeatureGroup('Onboarding Features', featuresByModule.onboarding)}
                            {renderFeatureGroup('Offboarding Features', featuresByModule.offboarding)}
                            {renderFeatureGroup('Automation', featuresByModule.shared)}
                        </div>
                    )}

                    {activeSection === 'policies' && (
                        <div className="space-y-6">
                            <PolicyCard title="Notice Period Policy">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <NumberField label="Default notice days" value={noticePeriodPolicy.defaultNoticeDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, defaultNoticeDays: v }))} />
                                    <NumberField label="Probation notice days" value={noticePeriodPolicy.probationNoticeDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, probationNoticeDays: v }))} />
                                    <NumberField label="Max buyout days" value={noticePeriodPolicy.maxBuyoutDays} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, maxBuyoutDays: v }))} />
                                    <NumberField label="Escalation days after overdue" value={noticePeriodPolicy.escalationDaysAfterOverdue} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, escalationDaysAfterOverdue: v }))} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-4">
                                    <ToggleRow label="Allow notice buyout" checked={noticePeriodPolicy.allowBuyout} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, allowBuyout: v }))} />
                                    <ToggleRow label="Allow leave adjustment" checked={noticePeriodPolicy.allowLeaveAdjustment !== false} onChange={(v) => setNoticePeriodPolicy((p) => ({ ...p, allowLeaveAdjustment: v }))} />
                                </div>
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
                                        Core checks (Address, Criminal, Identity) always run when Background Verification is on.
                                        Turn on extra check types below — they appear on open BGV cases after save.
                                    </p>
                                    <ToggleRow
                                        label="Employment Verification"
                                        checked={enabledFeatures.employmentVerification === true}
                                        onChange={(v) => setEnabledFeatures((prev) => ({ ...prev, employmentVerification: v }))}
                                    />
                                    <ToggleRow
                                        label="Education Verification"
                                        checked={enabledFeatures.educationVerification === true}
                                        onChange={(v) => setEnabledFeatures((prev) => ({ ...prev, educationVerification: v }))}
                                    />
                                    <ToggleRow
                                        label="Reference Verification"
                                        checked={enabledFeatures.referenceVerification === true}
                                        onChange={(v) => setEnabledFeatures((prev) => ({ ...prev, referenceVerification: v }))}
                                    />
                                </div>
                            </PolicyCard>

                            <PolicyCard title="Offer & E-Sign">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <NumberField label="Default offer expiry (days)" value={offerPolicy.defaultExpiryDays} onChange={(v) => setOfferPolicy((p) => ({ ...p, defaultExpiryDays: v }))} />
                                    <label className="text-sm text-gray-700">
                                        E-sign provider
                                        <select value={esignProvider} onChange={(e) => setEsignProvider(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                                            {ESIGN_PROVIDERS.map((v) => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </label>
                                </div>
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

                    {activeSection === 'industry' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Enable an industry pack to turn on sector-specific workflows. Features like <code className="text-xs bg-gray-100 px-1 rounded">industry.it.nda</code> stay off until you enable the matching pack.
                            </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {industryPacks.length === 0 ? (
                                <p className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                                    No industry packs loaded. Refresh the page or check that the backend is running.
                                </p>
                            ) : industryPacks.map((pack) => {
                                const enabled = isPackEnabled(pack);
                                return (
                                    <div key={pack.key} className="p-4 border border-gray-200 rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-sm">{pack.label}</p>
                                                <p className="text-xs text-gray-600 mt-1">{pack.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <p className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                                                    Status: {enabled ? 'Enabled' : 'Disabled'}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Toggle checked={enabled} onChange={(v) => togglePack('industry', pack, v)} />
                                                    <span className="text-xs text-gray-600 whitespace-nowrap">
                                                        {enabled ? 'Disable Feature' : 'Enable Feature'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    )}

                    {activeSection === 'compliance' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Enable India compliance packs to turn on statutory workflows (Aadhaar, PAN, EPF, ESI, etc.). These are managed here—not in the Features tab.
                            </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {compliancePacks.length === 0 ? (
                                <p className="col-span-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                                    No compliance packs loaded. Refresh the page or check that the backend is running.
                                </p>
                            ) : compliancePacks.map((pack) => {
                                const enabled = isPackEnabled(pack);
                                return (
                                    <div key={pack.key} className="p-4 border border-gray-200 rounded-lg">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-sm">{pack.label}</p>
                                                <p className="text-xs text-gray-600 mt-1">{pack.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <p className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                                                    Status: {enabled ? 'Enabled' : 'Disabled'}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Toggle checked={enabled} onChange={(v) => togglePack('compliance', pack, v)} />
                                                    <span className="text-xs text-gray-600 whitespace-nowrap">
                                                        {enabled ? 'Disable Feature' : 'Enable Feature'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    )}

                    {activeSection === 'templates' && (
                        <div className="space-y-8">
                            <WorkflowBuilder />
                            <div className="border-t pt-6">
                                <OfferTemplateManager />
                            </div>
                        </div>
                    )}

                    {activeSection === 'forms' && (
                        <FormBuilderHub />
                    )}

                    {activeSection === 'documents-hub' && (
                        <DocumentHub />
                    )}

                    {activeSection === 'exit-interview' && (
                        <ExitInterviewHub />
                    )}

                    {activeSection === 'letters' && (
                        <LetterGeneratorHub />
                    )}

                    {activeSection === 'documents' && (
                        <div className="grid sm:grid-cols-2 gap-6">
                            <DocumentList title="Onboarding Documents" docs={snapshot?.documentCatalog?.onboarding || []} />
                            <DocumentList title="Offboarding Documents" docs={snapshot?.documentCatalog?.offboarding || []} />
                        </div>
                    )}

                    {activeSection === 'automation' && (
                        <div className="space-y-6">
                            <PolicyCard title="Notification Channels">
                                <div className="grid gap-2">
                                    {['email', 'inApp', 'push'].map((ch) => (
                                        <ToggleRow
                                            key={ch}
                                            label={ch === 'inApp' ? 'In-App' : ch}
                                            checked={notifications[ch] !== false}
                                            onChange={(v) => setNotifications((prev) => ({ ...prev, [ch]: v }))}
                                        />
                                    ))}
                                </div>
                            </PolicyCard>

                            <EditableRuleList
                                title="Reminder Rules"
                                rules={reminders}
                                onChange={setReminders}
                                fields={[
                                    { key: 'key', label: 'Key', type: 'text' },
                                    { key: 'label', label: 'Label', type: 'text' },
                                    { key: 'featureKey', label: 'Feature key', type: 'text' },
                                    { key: 'daysBeforeDue', label: 'Days before due', type: 'number' },
                                ]}
                                emptyRule={{ key: '', label: '', featureKey: 'reminders', enabled: true, daysBeforeDue: 1, channels: ['email', 'in_app'] }}
                            />

                            <EditableRuleList
                                title="Escalation Rules"
                                rules={escalations}
                                onChange={setEscalations}
                                fields={[
                                    { key: 'key', label: 'Key', type: 'text' },
                                    { key: 'label', label: 'Label', type: 'text' },
                                    { key: 'featureKey', label: 'Feature key', type: 'text' },
                                    { key: 'daysAfterDue', label: 'Days after due', type: 'number' },
                                    { key: 'escalateToRole', label: 'Escalate to role', type: 'select', options: ESCALATION_ROLES },
                                ]}
                                emptyRule={{ key: '', label: '', featureKey: 'escalations', enabled: true, daysAfterDue: 2, escalateToRole: 'hr', channels: ['email', 'in_app'] }}
                            />

                            <ApprovalBindingsEditor approvals={approvals} workflows={approvalWorkflows} onChange={setApprovals} />
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


function DocumentList({ title, docs }) {
    return (
        <div>
            <h3 className="font-semibold text-sm mb-3">{title}</h3>
            <div className="space-y-2">
                {docs.map((doc) => (
                    <div key={doc.key || doc.catalogKey} className="p-3 border border-gray-200 rounded-lg flex justify-between gap-2">
                        <div className="min-w-0">
                            <p className="font-medium text-sm">{doc.label}</p>
                            <p className="text-xs text-gray-500 truncate">{doc.key || doc.catalogKey}</p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{doc.mandatory ? 'Required' : 'Optional'}</span>
                    </div>
                ))}
                {!docs.length && <p className="text-sm text-gray-500">No documents for enabled features.</p>}
            </div>
        </div>
    );
}

function EditableRuleList({ title, rules, onChange, fields, emptyRule }) {
    const updateRule = (index, key, value) => {
        const next = [...rules];
        next[index] = { ...next[index], [key]: value };
        onChange(next);
    };

    const removeRule = (index) => onChange(rules.filter((_, i) => i !== index));
    const addRule = () => onChange([...rules, { ...emptyRule, key: `rule_${Date.now()}` }]);

    return (
        <PolicyCard title={title}>
            {!rules.length ? <p className="text-sm text-gray-500 mb-3">None configured.</p> : (
                <div className="space-y-3 mb-3">
                    {rules.map((rule, index) => (
                        <div key={rule.key || index} className="rounded-lg border border-gray-100 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <ToggleRow label="Enabled" checked={rule.enabled !== false} onChange={(v) => updateRule(index, 'enabled', v)} />
                                <button type="button" onClick={() => removeRule(index)} className="text-xs text-red-600 hover:underline">Remove</button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {fields.map((field) => (
                                    <label key={field.key} className="text-xs text-gray-600">
                                        {field.label}
                                        {field.type === 'select' ? (
                                            <select value={rule[field.key] || ''} onChange={(e) => updateRule(index, field.key, e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
                                                {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type={field.type}
                                                value={rule[field.key] ?? ''}
                                                onChange={(e) => updateRule(index, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                            />
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <button type="button" onClick={addRule} className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50">Add rule</button>
        </PolicyCard>
    );
}

function ApprovalBindingsEditor({ approvals, workflows, onChange }) {
    const bindings = APPROVAL_ENTITIES.map((entityType) => {
        const existing = approvals.find((a) => a.entityType === entityType);
        return existing || { entityType, enabled: false, approvalWorkflowId: null };
    });

    const updateBinding = (entityType, patch) => {
        const next = [...bindings];
        const idx = next.findIndex((b) => b.entityType === entityType);
        next[idx] = { ...next[idx], ...patch };
        onChange(next);
    };

    return (
        <PolicyCard title="Approval Rules">
            <div className="space-y-3">
                {bindings.map((binding) => (
                    <div key={binding.entityType} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 p-3">
                        <span className="w-28 text-sm font-medium text-gray-800">{binding.entityType}</span>
                        <Toggle checked={binding.enabled} onChange={(v) => updateBinding(binding.entityType, { enabled: v })} />
                        <select
                            value={binding.approvalWorkflowId || ''}
                            onChange={(e) => updateBinding(binding.entityType, { approvalWorkflowId: e.target.value || null })}
                            className="flex-1 min-w-[180px] rounded-lg border px-2 py-1.5 text-sm"
                            disabled={!binding.enabled}
                        >
                            <option value="">Select workflow</option>
                            {workflows.map((wf) => (
                                <option key={wf._id} value={wf._id}>{wf.name || wf.workflowName || wf._id}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </PolicyCard>
    );
}

export default LifecycleConfigurationPanel;
