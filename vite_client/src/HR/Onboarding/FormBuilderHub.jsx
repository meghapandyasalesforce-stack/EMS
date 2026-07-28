import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FaClone, FaEye, FaGripVertical, FaHistory, FaPlus, FaSave, FaTrash, FaUpload, FaDownload,
} from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

const STATUS_BADGE = {
    Draft: 'bg-amber-100 text-amber-800',
    Published: 'bg-emerald-100 text-emerald-800',
    Archived: 'bg-gray-200 text-gray-600',
};

const FORM_CATEGORIES = [
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'offboarding', label: 'Offboarding' },
    { value: 'exit_interview', label: 'Exit Interview' },
    { value: 'bgv', label: 'Background Verification' },
    { value: 'notice_period', label: 'Notice Period' },
    { value: 'fnf', label: 'Full & Final' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'employee_profile', label: 'Employee Profile' },
    { value: 'custom', label: 'Custom HR Form' },
];

const FIELD_TOOLBOX = [
    {
        group: 'Basic',
        types: [
            { type: 'text', label: 'Single Line Text' },
            { type: 'textarea', label: 'Multi Line Text' },
            { type: 'number', label: 'Number' },
            { type: 'email', label: 'Email' },
            { type: 'phone', label: 'Phone' },
            { type: 'date', label: 'Date' },
            { type: 'time', label: 'Time' },
            { type: 'datetime', label: 'Date Time' },
        ],
    },
    {
        group: 'Selection',
        types: [
            { type: 'dropdown', label: 'Dropdown' },
            { type: 'multiselect', label: 'Multi Select' },
            { type: 'checkbox', label: 'Checkbox' },
            { type: 'radio', label: 'Radio Button' },
            { type: 'toggle', label: 'Toggle Switch' },
        ],
    },
    {
        group: 'Advanced',
        types: [
            { type: 'address', label: 'Address' },
            { type: 'country', label: 'Country' },
            { type: 'state', label: 'State' },
            { type: 'city', label: 'City' },
            { type: 'pincode', label: 'Pincode' },
            { type: 'employee_lookup', label: 'Employee Lookup' },
            { type: 'manager_lookup', label: 'Manager Lookup' },
            { type: 'department', label: 'Department' },
            { type: 'designation', label: 'Designation' },
        ],
    },
    {
        group: 'Uploads',
        types: [
            { type: 'file', label: 'File Upload' },
            { type: 'image', label: 'Image Upload' },
            { type: 'signature', label: 'Signature' },
        ],
    },
    {
        group: 'Content',
        types: [
            { type: 'richtext', label: 'Rich Text' },
            { type: 'heading', label: 'Section Heading' },
            { type: 'divider', label: 'Divider' },
            { type: 'paragraph', label: 'Paragraph' },
            { type: 'instructions', label: 'Instructions' },
        ],
    },
];

const LAYOUT_TYPES = new Set(['heading', 'divider', 'paragraph', 'instructions']);
const SELECT_TYPES = new Set(['dropdown', 'multiselect', 'checkbox', 'radio']);

const slugify = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);

const emptyField = (type, order = 0) => {
    const label = FIELD_TOOLBOX.flatMap((g) => g.types).find((t) => t.type === type)?.label || type;
    return {
        key: `${type}_${Date.now()}`,
        label,
        type,
        required: false,
        readOnly: false,
        hidden: false,
        placeholder: '',
        helpText: '',
        defaultValue: '',
        options: SELECT_TYPES.has(type) ? [{ label: 'Option 1', value: 'option_1' }] : [],
        validation: {},
        conditionalRules: [],
        order,
    };
};

const FormBuilderHub = () => {
    const [view, setView] = useState('list');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [forms, setForms] = useState([]);
    const [fieldTypes, setFieldTypes] = useState([]);
    const [registryFeatures, setRegistryFeatures] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [meta, setMeta] = useState({
        name: '', description: '', category: 'onboarding', featureKey: '', stageKey: '',
        approvalRequired: false, status: 'Draft', version: 1,
    });
    const [fields, setFields] = useState([]);
    const [selectedFieldKey, setSelectedFieldKey] = useState(null);
    const [dragIndex, setDragIndex] = useState(null);
    const [previewData, setPreviewData] = useState({});
    const [previewMeta, setPreviewMeta] = useState(null);
    const [versionHistory, setVersionHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [responses, setResponses] = useState([]);
    const [report, setReport] = useState(null);

    const selectedField = useMemo(
        () => fields.find((f) => f.key === selectedFieldKey) || null,
        [fields, selectedFieldKey],
    );

    const loadForms = useCallback(async () => {
        try {
            setLoading(true);
            const [formsRes, typesRes, registryRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms`, {
                    params: { category: categoryFilter || undefined, activeOnly: categoryFilter ? '0' : '1' },
                    withCredentials: true,
                }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/field-types`, { withCredentials: true }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true }),
            ]);
            const list = formsRes.data?.data || [];
            setForms(list);
            setFieldTypes(typesRes.data?.data || []);
            setRegistryFeatures(registryRes.data?.data?.registry?.features || []);
            if (!selectedId && list.length) setSelectedId(list[0]._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load forms');
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, selectedId]);

    const loadForm = useCallback(async (id) => {
        if (!id) return;
        try {
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${id}`, { withCredentials: true });
            const form = data.data;
            setFields((form.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            setVersionHistory(form.versionHistory || []);
            setMeta({
                name: form.name,
                description: form.description || '',
                category: form.category || form.module || 'onboarding',
                featureKey: form.featureKey || '',
                stageKey: form.stageKey || '',
                approvalRequired: form.approvalRequired || false,
                status: form.status || 'Draft',
                version: form.version || 1,
            });
            setSelectedFieldKey(form.fields?.[0]?.key || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load form');
        }
    }, []);

    const loadResponses = useCallback(async (id) => {
        if (!id) return;
        try {
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${id}/responses`, { withCredentials: true });
            setResponses(data.data?.responses || data.data || []);
            setReport(data.data?.report || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load responses');
        }
    }, []);

    useEffect(() => { loadForms(); }, [categoryFilter]);
    useEffect(() => { if (selectedId && view === 'builder') loadForm(selectedId); }, [selectedId, view, loadForm]);
    useEffect(() => { if (selectedId && view === 'responses') loadResponses(selectedId); }, [selectedId, view, loadResponses]);

    const addField = (type) => {
        const field = emptyField(type, fields.length);
        setFields((prev) => [...prev, field]);
        setSelectedFieldKey(field.key);
    };

    const updateField = (key, patch) => {
        setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    };

    const removeField = (key) => {
        setFields((prev) => prev.filter((f) => f.key !== key));
        if (selectedFieldKey === key) setSelectedFieldKey(null);
    };

    const onDragStart = (index) => setDragIndex(index);
    const onDragOver = (e, index) => {
        e.preventDefault();
        if (dragIndex == null || dragIndex === index) return;
        setFields((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(index, 0, moved);
            return next.map((f, i) => ({ ...f, order: i }));
        });
        setDragIndex(index);
    };

    const saveForm = async () => {
        if (!meta.name?.trim()) {
            toast.error('Form name is required');
            return;
        }
        try {
            setSaving(true);
            const payload = { ...meta, fields };
            if (selectedId) {
                await axios.put(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${selectedId}`, payload, { withCredentials: true });
                toast.success('Form saved');
            } else {
                const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/forms`, payload, { withCredentials: true });
                setSelectedId(data.data._id);
                toast.success('Form created');
            }
            await loadForms();
            if (selectedId) await loadForm(selectedId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save form');
        } finally {
            setSaving(false);
        }
    };

    const createNewForm = () => {
        setSelectedId('');
        setMeta({
            name: 'New Form', description: '', category: 'onboarding', featureKey: '', stageKey: '',
            approvalRequired: false, status: 'Draft', version: 1,
        });
        setFields([]);
        setSelectedFieldKey(null);
        setView('builder');
    };

    const cloneForm = async (id) => {
        try {
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${id}/clone`, {}, { withCredentials: true });
            toast.success('Form cloned');
            await loadForms();
            setSelectedId(data.data._id);
            setView('builder');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Clone failed');
        }
    };

    const publishForm = async () => {
        try {
            await saveForm();
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${selectedId}/publish`, {}, { withCredentials: true });
            toast.success('Form published');
            await loadForms();
            await loadForm(selectedId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Publish failed');
        }
    };

    const archiveForm = async (id) => {
        if (!window.confirm('Archive this form?')) return;
        try {
            await axios.delete(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${id}`, { withCredentials: true });
            toast.success('Form archived');
            if (selectedId === id) {
                setSelectedId('');
                setView('list');
            }
            await loadForms();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Archive failed');
        }
    };

    const rollbackVersion = async (version) => {
        try {
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${selectedId}/rollback`, { version }, { withCredentials: true });
            toast.success(`Rolled back to v${version}`);
            await loadForm(selectedId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Rollback failed');
        }
    };

    const openPreview = async () => {
        try {
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${selectedId}/preview`, { withCredentials: true });
            setPreviewMeta(data.data);
            setPreviewData({});
            setView('preview');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Preview failed');
        }
    };

    const exportCsv = async () => {
        try {
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms/${selectedId}/responses/export`, {
                withCredentials: true,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `form-responses-${selectedId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Export failed');
        }
    };

    const isFieldVisible = (field) => {
        if (field.hidden) return false;
        const rules = (field.conditionalRules || []).filter((r) => ['show', 'hide'].includes(r.action));
        if (!rules.length) return true;
        let visible = true;
        for (const rule of rules) {
            const match = (rule.conditions || []).every((c) => String(previewData[c.fieldKey] ?? '') === String(c.value ?? ''));
            if (rule.action === 'show' && match) visible = true;
            if (rule.action === 'hide' && match) visible = false;
        }
        return visible;
    };

    const renderPreviewField = (field) => {
        if (!isFieldVisible(field)) return null;
        if (field.type === 'heading') return <h3 key={field.key} className="font-semibold text-gray-800 mt-4">{field.label}</h3>;
        if (field.type === 'divider') return <hr key={field.key} className="my-3 border-gray-200" />;
        if (field.type === 'paragraph' || field.type === 'instructions') {
            return <p key={field.key} className={`text-sm ${field.type === 'instructions' ? 'text-blue-700 bg-blue-50 p-2 rounded' : 'text-gray-600'}`}>{field.helpText || field.label}</p>;
        }
        const common = {
            disabled: field.readOnly,
            placeholder: field.placeholder,
            className: 'w-full rounded border border-gray-300 px-3 py-2 text-sm',
            value: previewData[field.key] ?? field.defaultValue ?? '',
            onChange: (e) => setPreviewData((prev) => ({ ...prev, [field.key]: e.target.value })),
        };
        return (
            <label key={field.key} className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
                </span>
                {field.helpText && <span className="block text-xs text-gray-500">{field.helpText}</span>}
                {field.type === 'textarea' ? <textarea rows={3} {...common} /> : null}
                {['text', 'email', 'phone', 'number', 'date', 'time', 'datetime'].includes(field.type) ? <input type={field.type === 'datetime' ? 'datetime-local' : field.type} {...common} /> : null}
                {field.type === 'dropdown' ? (
                    <select {...common}>
                        <option value="">Select...</option>
                        {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ) : null}
                {field.type === 'toggle' ? (
                    <input type="checkbox" checked={!!previewData[field.key]} onChange={(e) => setPreviewData((p) => ({ ...p, [field.key]: e.target.checked }))} />
                ) : null}
                {['file', 'image', 'signature'].includes(field.type) ? <input type="file" className="text-sm" /> : null}
            </label>
        );
    };

    if (loading && view === 'list' && !forms.length) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Form Builder</h2>
                    <p className="text-sm text-gray-500">Create reusable forms for onboarding, offboarding, compliance, and more.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['list', 'builder', 'preview', 'responses'].map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => {
                                if (tab === 'preview' && selectedId) openPreview();
                                else setView(tab);
                            }}
                            disabled={(tab !== 'list' && !selectedId) || (tab === 'preview' && !selectedId)}
                            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${view === tab ? 'bg-theme-primary text-white' : 'border border-gray-200 hover:bg-gray-50 disabled:opacity-40'}`}
                        >
                            {tab}
                        </button>
                    ))}
                    <button type="button" onClick={createNewForm} className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white flex items-center gap-1">
                        <FaPlus /> New Form
                    </button>
                </div>
            </div>

            {view === 'list' && (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
                            <option value="">All categories</option>
                            {FORM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-3 py-2">Name</th>
                                    <th className="px-3 py-2">Category</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Version</th>
                                    <th className="px-3 py-2">Fields</th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {forms.map((form) => (
                                    <tr key={form._id} className="border-t hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium">{form.name}</td>
                                        <td className="px-3 py-2">{form.category || form.module}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[form.status] || 'bg-gray-100'}`}>{form.status}</span>
                                        </td>
                                        <td className="px-3 py-2">v{form.version || 1}</td>
                                        <td className="px-3 py-2">{form.fields?.length || 0}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => { setSelectedId(form._id); setView('builder'); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                                                <button type="button" onClick={() => cloneForm(form._id)} className="text-xs text-gray-600 hover:underline">Clone</button>
                                                <button type="button" onClick={() => archiveForm(form._id)} className="text-xs text-red-600 hover:underline">Archive</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!forms.length && (
                                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">No forms yet. Create your first form.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'builder' && (
                <div className="grid lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-2 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Field Toolbox</p>
                        {FIELD_TOOLBOX.map((group) => (
                            <div key={group.group}>
                                <p className="text-xs text-gray-600 mb-1">{group.group}</p>
                                <div className="space-y-1">
                                    {group.types.map((t) => (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => addField(t.type)}
                                            className="w-full text-left text-xs px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-50"
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-5 space-y-3">
                        <div className="grid sm:grid-cols-2 gap-2">
                            <input value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} placeholder="Form name" className="rounded border px-3 py-2 text-sm" />
                            <select value={meta.category} onChange={(e) => setMeta((m) => ({ ...m, category: e.target.value }))} className="rounded border px-3 py-2 text-sm">
                                {FORM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <select value={meta.featureKey} onChange={(e) => setMeta((m) => ({ ...m, featureKey: e.target.value }))} className="rounded border px-3 py-2 text-sm sm:col-span-2">
                                <option value="">Feature key (optional)</option>
                                {registryFeatures.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                            </select>
                            <input value={meta.stageKey} onChange={(e) => setMeta((m) => ({ ...m, stageKey: e.target.value }))} placeholder="Workflow stage key" className="rounded border px-3 py-2 text-sm" />
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={meta.approvalRequired} onChange={(e) => setMeta((m) => ({ ...m, approvalRequired: e.target.checked }))} />
                                Approval required
                            </label>
                        </div>
                        <textarea value={meta.description} onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} placeholder="Description" rows={2} className="w-full rounded border px-3 py-2 text-sm" />

                        <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[meta.status]}`}>{meta.status} · v{meta.version}</span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs flex items-center gap-1 px-2 py-1 border rounded"><FaHistory /> History</button>
                                <button type="button" onClick={saveForm} disabled={saving} className="text-xs flex items-center gap-1 px-2 py-1 bg-theme-primary text-white rounded"><FaSave /> Save</button>
                                {selectedId && meta.status !== 'Published' && (
                                    <button type="button" onClick={publishForm} className="text-xs flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded"><FaUpload /> Publish</button>
                                )}
                            </div>
                        </div>

                        {showHistory && versionHistory.length > 0 && (
                            <div className="border rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                                {versionHistory.map((v) => (
                                    <div key={v.version} className="flex justify-between text-xs">
                                        <span>v{v.version} — {v.changeNotes}</span>
                                        <button type="button" onClick={() => rollbackVersion(v.version)} className="text-blue-600 hover:underline">Rollback</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border rounded-lg p-3 min-h-[320px] space-y-2 bg-white">
                            <p className="text-xs text-gray-500 mb-2">Canvas — drag to reorder</p>
                            {fields.map((field, index) => (
                                <div
                                    key={field.key}
                                    draggable
                                    onDragStart={() => onDragStart(index)}
                                    onDragOver={(e) => onDragOver(e, index)}
                                    onClick={() => setSelectedFieldKey(field.key)}
                                    className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${selectedFieldKey === field.key ? 'border-theme-primary bg-blue-50' : 'border-gray-200'}`}
                                >
                                    <FaGripVertical className="text-gray-400 mt-1 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{field.label}</p>
                                        <p className="text-xs text-gray-500">{field.type}{field.required ? ' · required' : ''}</p>
                                    </div>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeField(field.key); }} className="text-red-500"><FaTrash size={12} /></button>
                                </div>
                            ))}
                            {!fields.length && <p className="text-sm text-gray-400 text-center py-8">Add fields from the toolbox</p>}
                        </div>
                    </div>

                    <div className="lg:col-span-5 border rounded-lg p-3 bg-gray-50 space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Properties</p>
                        {!selectedField ? (
                            <p className="text-sm text-gray-500">Select a field to edit properties</p>
                        ) : (
                            <>
                                <label className="block text-xs text-gray-600">
                                    Label
                                    <input value={selectedField.label} onChange={(e) => updateField(selectedField.key, { label: e.target.value, key: slugify(e.target.value) || selectedField.key })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
                                </label>
                                <label className="block text-xs text-gray-600">
                                    Field Key
                                    <input value={selectedField.key} onChange={(e) => updateField(selectedField.key, { key: slugify(e.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm font-mono" />
                                </label>
                                <label className="block text-xs text-gray-600">
                                    Placeholder
                                    <input value={selectedField.placeholder || ''} onChange={(e) => updateField(selectedField.key, { placeholder: e.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
                                </label>
                                <label className="block text-xs text-gray-600">
                                    Help Text
                                    <input value={selectedField.helpText || ''} onChange={(e) => updateField(selectedField.key, { helpText: e.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
                                </label>
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={selectedField.required} onChange={(e) => updateField(selectedField.key, { required: e.target.checked })} /> Required</label>
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={selectedField.readOnly} onChange={(e) => updateField(selectedField.key, { readOnly: e.target.checked })} /> Read Only</label>
                                    <label className="flex items-center gap-1"><input type="checkbox" checked={selectedField.hidden} onChange={(e) => updateField(selectedField.key, { hidden: e.target.checked })} /> Hidden</label>
                                </div>

                                {!LAYOUT_TYPES.has(selectedField.type) && (
                                    <div className="border-t pt-3 space-y-2">
                                        <p className="text-xs font-semibold text-gray-500">Validation</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="number" placeholder="Min" value={selectedField.validation?.min ?? ''} onChange={(e) => updateField(selectedField.key, { validation: { ...selectedField.validation, min: e.target.value ? Number(e.target.value) : undefined } })} className="rounded border px-2 py-1 text-sm" />
                                            <input type="number" placeholder="Max" value={selectedField.validation?.max ?? ''} onChange={(e) => updateField(selectedField.key, { validation: { ...selectedField.validation, max: e.target.value ? Number(e.target.value) : undefined } })} className="rounded border px-2 py-1 text-sm" />
                                            <input placeholder="Regex pattern" value={selectedField.validation?.pattern ?? ''} onChange={(e) => updateField(selectedField.key, { validation: { ...selectedField.validation, pattern: e.target.value } })} className="rounded border px-2 py-1 text-sm col-span-2" />
                                        </div>
                                    </div>
                                )}

                                {SELECT_TYPES.has(selectedField.type) && (
                                    <div className="border-t pt-3 space-y-2">
                                        <p className="text-xs font-semibold text-gray-500">Options</p>
                                        {(selectedField.options || []).map((opt, i) => (
                                            <div key={i} className="flex gap-1">
                                                <input value={opt.label} onChange={(e) => {
                                                    const options = [...(selectedField.options || [])];
                                                    options[i] = { ...options[i], label: e.target.value, value: slugify(e.target.value) || options[i].value };
                                                    updateField(selectedField.key, { options });
                                                }} className="flex-1 rounded border px-2 py-1 text-sm" />
                                                <button type="button" onClick={() => updateField(selectedField.key, { options: selectedField.options.filter((_, j) => j !== i) })} className="text-red-500 text-xs">×</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => updateField(selectedField.key, { options: [...(selectedField.options || []), { label: 'New option', value: `option_${Date.now()}` }] })} className="text-xs text-blue-600">+ Add option</button>
                                    </div>
                                )}

                                <div className="border-t pt-3 space-y-2">
                                    <p className="text-xs font-semibold text-gray-500">Conditional Logic</p>
                                    {(selectedField.conditionalRules || []).map((rule, ri) => (
                                        <div key={ri} className="p-2 border rounded bg-white space-y-1">
                                            <select value={rule.action} onChange={(e) => {
                                                const rules = [...selectedField.conditionalRules];
                                                rules[ri] = { ...rules[ri], action: e.target.value };
                                                updateField(selectedField.key, { conditionalRules: rules });
                                            }} className="w-full rounded border px-2 py-1 text-xs">
                                                {['show', 'hide', 'require', 'optional', 'enable', 'disable', 'set_default'].map((a) => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                            <select value={rule.combinator || 'and'} onChange={(e) => {
                                                const rules = [...selectedField.conditionalRules];
                                                rules[ri] = { ...rules[ri], combinator: e.target.value };
                                                updateField(selectedField.key, { conditionalRules: rules });
                                            }} className="w-full rounded border px-2 py-1 text-xs">
                                                <option value="and">AND</option>
                                                <option value="or">OR</option>
                                            </select>
                                            {(rule.conditions || [{ fieldKey: '', operator: 'equals', value: '' }]).map((cond, ci) => (
                                                <div key={ci} className="grid grid-cols-3 gap-1">
                                                    <select value={cond.fieldKey} onChange={(e) => {
                                                        const rules = [...selectedField.conditionalRules];
                                                        const conditions = [...(rules[ri].conditions || [])];
                                                        conditions[ci] = { ...conditions[ci], fieldKey: e.target.value };
                                                        rules[ri] = { ...rules[ri], conditions };
                                                        updateField(selectedField.key, { conditionalRules: rules });
                                                    }} className="rounded border px-1 py-1 text-xs">
                                                        <option value="">Field</option>
                                                        {fields.filter((f) => f.key !== selectedField.key && !LAYOUT_TYPES.has(f.type)).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                                                    </select>
                                                    <select value={cond.operator} onChange={(e) => {
                                                        const rules = [...selectedField.conditionalRules];
                                                        const conditions = [...(rules[ri].conditions || [])];
                                                        conditions[ci] = { ...conditions[ci], operator: e.target.value };
                                                        rules[ri] = { ...rules[ri], conditions };
                                                        updateField(selectedField.key, { conditionalRules: rules });
                                                    }} className="rounded border px-1 py-1 text-xs">
                                                        {['equals', 'not_equals', 'contains', 'empty', 'not_empty'].map((op) => <option key={op} value={op}>{op}</option>)}
                                                    </select>
                                                    <input value={cond.value ?? ''} onChange={(e) => {
                                                        const rules = [...selectedField.conditionalRules];
                                                        const conditions = [...(rules[ri].conditions || [])];
                                                        conditions[ci] = { ...conditions[ci], value: e.target.value };
                                                        rules[ri] = { ...rules[ri], conditions };
                                                        updateField(selectedField.key, { conditionalRules: rules });
                                                    }} className="rounded border px-1 py-1 text-xs" placeholder="Value" />
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => updateField(selectedField.key, { conditionalRules: [...(selectedField.conditionalRules || []), { action: 'show', combinator: 'and', conditions: [{ fieldKey: '', operator: 'equals', value: '' }] }] })} className="text-xs text-blue-600">+ Add rule</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {view === 'preview' && (
                <div className="max-w-xl mx-auto border rounded-lg p-6 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">{previewMeta?.name || meta.name}</h3>
                            <p className="text-xs text-gray-500">Preview mode · v{previewMeta?.version || meta.version}</p>
                        </div>
                        <button type="button" onClick={() => setView('builder')} className="text-sm text-blue-600">Back to builder</button>
                    </div>
                    {fields.map(renderPreviewField)}
                </div>
            )}

            {view === 'responses' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        {report && (
                            <>
                                <Stat label="Total" value={report.total} />
                                <Stat label="Completed" value={report.completed} />
                                <Stat label="Pending" value={report.pending} />
                                <Stat label="Rejected" value={report.rejected} />
                                <Stat label="Avg hours" value={report.avgCompletionHours ?? '—'} />
                            </>
                        )}
                        <button type="button" onClick={exportCsv} className="ml-auto flex items-center gap-1 px-3 py-1.5 border rounded text-sm"><FaDownload /> Export CSV</button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Employee</th>
                                    <th className="px-3 py-2 text-left">Submitted</th>
                                    <th className="px-3 py-2 text-left">Version</th>
                                </tr>
                            </thead>
                            <tbody>
                                {responses.map((r) => (
                                    <tr key={r._id} className="border-t">
                                        <td className="px-3 py-2">{r.status}</td>
                                        <td className="px-3 py-2">{r.employeeId || '—'}</td>
                                        <td className="px-3 py-2">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                                        <td className="px-3 py-2">v{r.formVersion}</td>
                                    </tr>
                                ))}
                                {!responses.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No responses yet</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

function Stat({ label, value }) {
    return (
        <div className="px-3 py-2 border rounded-lg bg-white">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );
}

export default FormBuilderHub;
