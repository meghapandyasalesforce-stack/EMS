import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FaClone, FaEye, FaGripVertical, FaHistory, FaPlus, FaSave, FaTrash, FaUpload,
} from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_BADGE = {
    Draft: 'bg-amber-100 text-amber-800',
    Published: 'bg-emerald-100 text-emerald-800',
    Archived: 'bg-gray-200 text-gray-600',
};

const slugify = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);

const emptyStage = (order = 0, module = 'onboarding') => ({
    key: `stage_${Date.now()}`,
    name: 'New Stage',
    description: '',
    order,
    mandatory: true,
    featureKey: '',
    groupKey: '',
    dependsOn: [],
    approvalRequired: false,
    slaDays: undefined,
    escalationRuleKey: '',
    reminderRuleKey: '',
    visibility: { condition: 'feature_enabled', requiredFeatures: [] },
    ...(module === 'offboarding'
        ? { dueDaysBeforeLastWorkingDate: 7 }
        : { dueDaysFromStart: 7 }),
});

const WorkflowBuilder = () => {
    const [module, setModule] = useState('onboarding');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [stages, setStages] = useState([]);
    const [stageGroups, setStageGroups] = useState([]);
    const [meta, setMeta] = useState({ name: '', description: '', expectedDays: 30, status: 'Draft', version: 1 });
    const [selectedStageKey, setSelectedStageKey] = useState(null);
    const [dragIndex, setDragIndex] = useState(null);
    const [preview, setPreview] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [versionHistory, setVersionHistory] = useState([]);
    const [registryFeatures, setRegistryFeatures] = useState([]);
    const [enabledFeatures, setEnabledFeatures] = useState({});
    const [settingsRules, setSettingsRules] = useState({ reminders: [], escalations: [], approvals: [] });

    const templatePath = module === 'onboarding' ? 'onboarding' : 'offboarding';
    const workflowPutPath = module === 'onboarding'
        ? `${ADMIN_LIFECYCLE_ENDPOINT}/templates/onboarding`
        : `${ADMIN_LIFECYCLE_ENDPOINT}/templates/offboarding`;

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const [tplRes, registryRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/templates/${templatePath}`, {
                    params: { builder: 1 },
                    withCredentials: true,
                }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true }),
            ]);
            const list = tplRes.data?.data || [];
            setTemplates(list);
            setRegistryFeatures(registryRes.data?.data?.registry?.features || []);
            setEnabledFeatures(registryRes.data?.data?.settings?.enabledFeatures || {});
            setSettingsRules({
                reminders: registryRes.data?.data?.settings?.reminders || [],
                escalations: registryRes.data?.data?.settings?.escalations || [],
                approvals: registryRes.data?.data?.settings?.approvals || [],
            });
            if (!selectedId && list.length) setSelectedId(list[0]._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load workflows');
        } finally {
            setLoading(false);
        }
    }, [templatePath]);

    const loadTemplate = useCallback(async (id) => {
        if (!id) return;
        try {
            const { data } = await axios.get(`${workflowPutPath}/${id}`, { withCredentials: true });
            const tpl = data.data;
            setStages((tpl.stages || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            setStageGroups(tpl.stageGroups || []);
            setVersionHistory(tpl.versionHistory || []);
            setMeta({
                name: tpl.name,
                description: tpl.description || '',
                expectedDays: tpl.expectedDays || (module === 'onboarding' ? 30 : 14),
                status: tpl.status || 'Draft',
                version: tpl.version || 1,
            });
            setSelectedStageKey(tpl.stages?.[0]?.key || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load workflow');
        }
    }, [workflowPutPath, module]);

    useEffect(() => { loadTemplates(); }, [module]);
    useEffect(() => { if (selectedId) loadTemplate(selectedId); }, [selectedId, loadTemplate]);

    const selectedStage = useMemo(
        () => stages.find((s) => s.key === selectedStageKey) || null,
        [stages, selectedStageKey],
    );

    const updateStage = (key, patch) => {
        setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    };

    const addStage = () => {
        const stage = emptyStage(stages.length, module);
        setStages((prev) => [...prev, stage]);
        setSelectedStageKey(stage.key);
    };

    const deleteStage = (key) => {
        setStages((prev) => prev.filter((s) => s.key !== key).map((s, i) => ({ ...s, order: i })));
        setSelectedStageKey((prev) => (prev === key ? null : prev));
    };

    const reorderStages = (from, to) => {
        if (from === to || from == null || to == null) return;
        setStages((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next.map((s, i) => ({ ...s, order: i }));
        });
    };

    const saveWorkflow = async () => {
        if (!selectedId) return;
        try {
            setSaving(true);
            const path = module === 'onboarding'
                ? `${workflowPutPath}/${selectedId}`
                : `${workflowPutPath}/${selectedId}/workflow`;
            const { data } = await axios.put(path, {
                name: meta.name,
                description: meta.description,
                expectedDays: meta.expectedDays,
                stages,
                stageGroups,
            }, { withCredentials: true });
            if (!data.success) throw new Error(data.message);
            toast.success('Workflow saved');
            await loadTemplate(selectedId);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const createWorkflow = async () => {
        const name = window.prompt('Workflow name');
        if (!name?.trim()) return;
        try {
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/templates/${templatePath}`, {
                name: name.trim(),
                description: '',
                expectedDays: module === 'onboarding' ? 30 : 14,
                stages: [emptyStage(0, module)],
                stageGroups: [],
            }, { withCredentials: true });
            toast.success('Workflow created');
            setSelectedId(data.data._id);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Create failed');
        }
    };

    const cloneWorkflow = async () => {
        if (!selectedId) return;
        try {
            const { data } = await axios.post(`${workflowPutPath}/${selectedId}/clone`, {}, { withCredentials: true });
            toast.success('Workflow cloned');
            setSelectedId(data.data._id);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Clone failed');
        }
    };

    const publishWorkflow = async () => {
        if (!selectedId) return;
        try {
            await saveWorkflow();
            const { data } = await axios.post(`${workflowPutPath}/${selectedId}/publish`, {}, { withCredentials: true });
            toast.success('Workflow published');
            setMeta((m) => ({ ...m, status: 'Published', version: data.data.version }));
            await loadTemplate(selectedId);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Publish failed');
        }
    };

    const openPreview = async () => {
        if (!selectedId) return;
        try {
            const { data } = await axios.get(`${workflowPutPath}/${selectedId}/preview`, { withCredentials: true });
            setPreview(data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Preview failed');
        }
    };

    const addGroup = () => {
        const key = `group_${Date.now()}`;
        setStageGroups((prev) => [...prev, { key, name: 'New Group', order: prev.length }]);
    };

    if (loading && !templates.length) return <LoadingSpinner message="Loading workflow builder..." />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Workflow Builder</h2>
                    <p className="text-sm text-gray-500">Design onboarding and offboarding stages with drag-and-drop ordering.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="inline-flex rounded-lg border bg-gray-50 p-0.5">
                        {['onboarding', 'offboarding'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setModule(m); setSelectedId(''); }}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${module === m ? 'bg-white shadow text-theme-primary' : 'text-gray-600'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={createWorkflow} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"><FaPlus className="inline mr-1" />New</button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <aside className="rounded-xl border bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Workflows</p>
                    <div className="space-y-1 max-h-[420px] overflow-y-auto">
                        {templates.map((tpl) => (
                            <button
                                key={tpl._id}
                                type="button"
                                onClick={() => setSelectedId(tpl._id)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === tpl._id ? 'bg-theme-primary/10 text-theme-primary' : 'hover:bg-gray-50'}`}
                            >
                                <p className="font-medium truncate">{tpl.name}</p>
                                <p className="text-[11px] text-gray-500">{(tpl.stages || []).length} stages · v{tpl.version || 1}</p>
                            </button>
                        ))}
                    </div>
                </aside>

                {selectedId ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-4 shadow-sm">
                            <input
                                value={meta.name}
                                onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
                                className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm font-semibold"
                            />
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[meta.status] || STATUS_BADGE.Draft}`}>
                                {meta.status} · v{meta.version}
                            </span>
                            <button type="button" disabled={saving} onClick={saveWorkflow} className="rounded-lg bg-theme-primary px-3 py-1.5 text-sm text-white disabled:opacity-60"><FaSave className="inline mr-1" />Save</button>
                            <button type="button" onClick={openPreview} className="rounded-lg border px-3 py-1.5 text-sm"><FaEye className="inline mr-1" />Preview</button>
                            <button type="button" onClick={() => setShowHistory(true)} className="rounded-lg border px-3 py-1.5 text-sm"><FaHistory className="inline mr-1" />History</button>
                            <button type="button" onClick={cloneWorkflow} className="rounded-lg border px-3 py-1.5 text-sm"><FaClone className="inline mr-1" />Clone</button>
                            <button type="button" onClick={publishWorkflow} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"><FaUpload className="inline mr-1" />Publish</button>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
                            <section className="rounded-xl border bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="font-semibold text-sm">Stages</h3>
                                    <button type="button" onClick={addStage} className="text-xs text-theme-primary hover:underline">+ Add stage</button>
                                </div>
                                <div className="space-y-2">
                                    {stages.map((stage, index) => {
                                        const runtimeOff = Boolean(stage.featureKey) && enabledFeatures[stage.featureKey] !== true;
                                        return (
                                        <div
                                            key={stage.key}
                                            draggable
                                            onDragStart={() => setDragIndex(index)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => { reorderStages(dragIndex, index); setDragIndex(null); }}
                                            onClick={() => setSelectedStageKey(stage.key)}
                                            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${selectedStageKey === stage.key ? 'border-theme-primary bg-theme-primary/5' : 'border-gray-200 hover:bg-gray-50'} ${runtimeOff ? 'opacity-60' : ''}`}
                                        >
                                            <FaGripVertical className="shrink-0 text-gray-400" />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-sm truncate">{stage.name}</p>
                                                <p className="text-[11px] text-gray-500">
                                                    {stage.mandatory !== false ? 'Mandatory' : 'Optional'}
                                                    {stage.groupKey ? ` · ${stageGroups.find((g) => g.key === stage.groupKey)?.name || stage.groupKey}` : ''}
                                                    {(stage.dependsOn || []).length ? ` · depends on ${stage.dependsOn.join(', ')}` : ''}
                                                    {runtimeOff ? ' · Skipped at runtime (feature disabled in Configure)' : ''}
                                                </p>
                                            </div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); deleteStage(stage.key); }} className="text-red-500 hover:text-red-700"><FaTrash /></button>
                                        </div>
                                        );
                                    })}
                                    {!stages.length && <p className="text-sm text-gray-500">No stages. Add your first stage.</p>}
                                </div>
                            </section>

                            <section className="rounded-xl border bg-white p-4 shadow-sm">
                                <h3 className="mb-3 font-semibold text-sm">Stage configuration</h3>
                                {selectedStage ? (
                                    <StageEditor
                                        stage={selectedStage}
                                        module={module}
                                        stageGroups={stageGroups}
                                        allStages={stages}
                                        features={registryFeatures.filter((f) => f.module === module || f.module === 'shared')}
                                        reminders={settingsRules.reminders}
                                        escalations={settingsRules.escalations}
                                        onChange={(patch) => updateStage(selectedStage.key, patch)}
                                    />
                                ) : (
                                    <p className="text-sm text-gray-500">Select a stage to configure due dates, SLAs, dependencies, and approvals.</p>
                                )}
                            </section>
                        </div>

                        <section className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="font-semibold text-sm">Stage Groups</h3>
                                <button type="button" onClick={addGroup} className="text-xs text-theme-primary hover:underline">+ Add group</button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {stageGroups.map((group, index) => (
                                    <div key={group.key} className="rounded-lg border p-3">
                                        <input
                                            value={group.name}
                                            onChange={(e) => {
                                                const name = e.target.value;
                                                setStageGroups((prev) => prev.map((g, i) => (i === index ? { ...g, name, key: g.key || slugify(name) } : g)));
                                            }}
                                            className="mb-1 w-full rounded border px-2 py-1 text-sm font-medium"
                                        />
                                        <p className="text-[11px] text-gray-400">{group.key}</p>
                                    </div>
                                ))}
                                {!stageGroups.length && <p className="text-sm text-gray-500 sm:col-span-2 lg:col-span-3">Optional groups to organize stages in the builder and preview.</p>}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">Select or create a workflow to begin.</div>
                )}
            </div>

            {preview && (
                <Modal title={`Preview — ${preview.name}`} onClose={() => setPreview(null)}>
                    <p className="mb-3 text-sm text-gray-600">{preview.stageCount} stages ({preview.mandatoryStageCount} mandatory, {preview.optionalStageCount} optional)</p>
                    <ol className="space-y-2">
                        {preview.timeline?.map((item) => (
                            <li key={item.key} className="rounded-lg border p-3 text-sm">
                                <p className="font-medium">{item.order + 1}. {item.name} {item.mandatory ? '' : '(Optional)'}</p>
                                <p className="text-xs text-gray-500">
                                    {[item.groupName, item.dueLabel, item.slaDays ? `SLA ${item.slaDays}d` : null, item.approvalRequired ? 'Approval required' : null].filter(Boolean).join(' · ')}
                                </p>
                                {(item.dependsOn || []).length > 0 && (
                                    <p className="text-xs text-amber-700">Depends on: {item.dependsOn.join(', ')}</p>
                                )}
                            </li>
                        ))}
                    </ol>
                    {preview.warnings?.length > 0 && (
                        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                            {preview.warnings.map((w) => <p key={w}>{w}</p>)}
                        </div>
                    )}
                </Modal>
            )}

            {showHistory && (
                <Modal title="Version History" onClose={() => setShowHistory(false)}>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        <div className="rounded-lg border p-3 text-sm"><strong>Current</strong> — v{meta.version} ({meta.status})</div>
                        {[...versionHistory].reverse().map((entry, i) => (
                            <div key={i} className="rounded-lg border p-3 text-sm">
                                <p className="font-medium">v{entry.version}</p>
                                <p className="text-xs text-gray-500">{entry.changeNotes}</p>
                            </div>
                        ))}
                        {!versionHistory.length && <p className="text-sm text-gray-500">No prior versions yet.</p>}
                    </div>
                </Modal>
            )}
        </div>
    );
};

function StageEditor({ stage, module, stageGroups, allStages, features, reminders, escalations, onChange }) {
    const otherStages = allStages.filter((s) => s.key !== stage.key);

    return (
        <div className="space-y-3 text-sm">
            <label className="block text-gray-700">
                Name
                <input
                    value={stage.name}
                    onChange={(e) => onChange({ name: e.target.value, key: stage.key || slugify(e.target.value) })}
                    className="mt-1 w-full rounded-lg border px-2 py-1.5"
                />
            </label>
            <label className="block text-gray-700">
                Key
                <input value={stage.key} onChange={(e) => onChange({ key: slugify(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs" />
            </label>
            <label className="block text-gray-700">
                Description
                <textarea value={stage.description || ''} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
            </label>
            <ToggleRow label="Mandatory stage" checked={stage.mandatory !== false} onChange={(v) => onChange({ mandatory: v })} />
            <label className="block text-gray-700">
                Stage group
                <select value={stage.groupKey || ''} onChange={(e) => onChange({ groupKey: e.target.value || undefined })} className="mt-1 w-full rounded-lg border px-2 py-1.5">
                    <option value="">None</option>
                    {stageGroups.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
                </select>
            </label>
            {module === 'onboarding' ? (
                <label className="block text-gray-700">
                    Due days from start
                    <input type="number" min="0" value={stage.dueDaysFromStart ?? ''} onChange={(e) => onChange({ dueDaysFromStart: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
                </label>
            ) : (
                <>
                    <label className="block text-gray-700">
                        Due days before LWD
                        <input type="number" min="0" value={stage.dueDaysBeforeLastWorkingDate ?? ''} onChange={(e) => onChange({ dueDaysBeforeLastWorkingDate: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
                    </label>
                    <label className="block text-gray-700">
                        Due days after LWD
                        <input type="number" min="0" value={stage.dueDaysAfterLastWorkingDate ?? ''} onChange={(e) => onChange({ dueDaysAfterLastWorkingDate: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
                    </label>
                </>
            )}
            <label className="block text-gray-700">
                SLA (days)
                <input type="number" min="0" value={stage.slaDays ?? ''} onChange={(e) => onChange({ slaDays: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-1.5" />
            </label>
            <label className="block text-gray-700">
                Feature gate
                <select value={stage.featureKey || ''} onChange={(e) => onChange({ featureKey: e.target.value || undefined })} className="mt-1 w-full rounded-lg border px-2 py-1.5">
                    <option value="">Always visible</option>
                    {features.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
            </label>
            <label className="block text-gray-700">
                Visibility
                <select
                    value={stage.visibility?.condition || 'feature_enabled'}
                    onChange={(e) => onChange({ visibility: { ...stage.visibility, condition: e.target.value } })}
                    className="mt-1 w-full rounded-lg border px-2 py-1.5"
                >
                    <option value="always">Always</option>
                    <option value="feature_enabled">When feature enabled</option>
                    <option value="all_features_enabled">When all features enabled</option>
                </select>
            </label>
            <label className="block text-gray-700">
                Depends on stages
                <select
                    multiple
                    value={stage.dependsOn || []}
                    onChange={(e) => onChange({ dependsOn: Array.from(e.target.selectedOptions, (o) => o.value) })}
                    className="mt-1 w-full rounded-lg border px-2 py-1.5 min-h-[80px]"
                >
                    {otherStages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
            </label>
            <label className="block text-gray-700">
                Reminder rule
                <select value={stage.reminderRuleKey || ''} onChange={(e) => onChange({ reminderRuleKey: e.target.value || undefined })} className="mt-1 w-full rounded-lg border px-2 py-1.5">
                    <option value="">None</option>
                    {reminders.map((r) => <option key={r.key} value={r.key}>{r.label || r.key}</option>)}
                </select>
            </label>
            <label className="block text-gray-700">
                Escalation rule
                <select value={stage.escalationRuleKey || ''} onChange={(e) => onChange({ escalationRuleKey: e.target.value || undefined })} className="mt-1 w-full rounded-lg border px-2 py-1.5">
                    <option value="">None</option>
                    {escalations.map((r) => <option key={r.key} value={r.key}>{r.label || r.key}</option>)}
                </select>
            </label>
            <ToggleRow label="Approval required" checked={!!stage.approvalRequired} onChange={(v) => onChange({ approvalRequired: v })} />
        </div>
    );
}

function ToggleRow({ label, checked, onChange }) {
    return (
        <label className="flex items-center justify-between gap-2">
            <span className="text-gray-700">{label}</span>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500">Close</button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default WorkflowBuilder;
