import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaEdit, FaEye, FaFilePdf, FaHistory, FaPlus, FaStar, FaTrash,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../LoadingSpinner';
import RichTextEditor, { PlaceholderChips } from './RichTextEditor';
import { CmBadge, CmButton } from '../corporateModern';
import OfferLetterHtmlPreview from './OfferLetterHtmlPreview';
import OfferPdfTemplateUpload from './OfferPdfTemplateUpload';
import OfferPdfFieldMapping from './OfferPdfFieldMapping';

const EMPTY_TEMPLATE = {
    name: '',
    description: '',
    bodyHtml: '',
    isDefault: false,
};

const OfferTemplateManager = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [editorOpen, setEditorOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [uploadPdfOpen, setUploadPdfOpen] = useState(false);
    const [mappingOpen, setMappingOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_TEMPLATE);
    const [selected, setSelected] = useState(null);

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, { withCredentials: true });
            if (data.success) setTemplates(data.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load offer templates');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const openCreate = () => {
        setSelected(null);
        setForm({ ...EMPTY_TEMPLATE, bodyHtml: defaultBody() });
        setEditorOpen(true);
    };

    const openEdit = (template) => {
        setSelected(template);
        setForm({
            id: template._id,
            name: template.name,
            description: template.description || '',
            bodyHtml: template.bodyHtml,
            isDefault: template.isDefault,
        });
        setEditorOpen(true);
    };

    const saveTemplate = async (event) => {
        event.preventDefault();
        if (!form.name?.trim() || !form.bodyHtml?.trim()) {
            toast.error('Name and body are required');
            return;
        }
        try {
            setSaving(true);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, form, { withCredentials: true });
            if (!data.success) throw new Error(data.message);
            toast.success('Offer template saved');
            setEditorOpen(false);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const deactivateTemplate = async (template) => {
        if (!window.confirm(`Deactivate template "${template.name}"?`)) return;
        try {
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, {
                id: template._id,
                name: template.name,
                bodyHtml: template.bodyHtml,
                isActive: false,
            }, { withCredentials: true });
            toast.success('Template deactivated');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to deactivate template');
        }
    };

    const openTemplatePreview = async (template) => {
        setSelected(template);
        setPreviewOpen(true);
        setPreviewHtml('');
        if (template.templateType === 'pdf') return;
        try {
            setPreviewLoading(true);
            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates/preview`,
                { templateId: template._id, useSampleData: true },
                { withCredentials: true },
            );
            if (data.success) setPreviewHtml(data.data?.renderedHtml || template.bodyHtml);
        } catch {
            setPreviewHtml(template.bodyHtml);
        } finally {
            setPreviewLoading(false);
        }
    };
    const setAsDefault = async (template) => {
        try {
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, {
                id: template._id,
                name: template.name,
                bodyHtml: template.bodyHtml || '',
                templateType: template.templateType || 'html',
                isDefault: true,
            }, { withCredentials: true });
            toast.success('Default template updated');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to set default');
        }
    };

    if (loading) return <LoadingSpinner message="Loading offer templates..." />;

    return (
        <div className="cm-hrms">
            <div className="cm-page">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="cm-title-sm">Offer Letter Templates</p>
                        {/* <p className="cm-subtitle">Create HTML templates with placeholders, or upload a PDF — fields are detected automatically and verified once.</p> */}
                    </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={openCreate}
                        className="cm-card flex items-start gap-3 p-4 text-left transition hover:shadow-md"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme-primary/10 text-theme-primary">
                            <FaPlus />
                        </span>
                        <span>
                            <span className="block font-semibold" style={{ color: 'var(--cm-on-surface)' }}>New HTML Template</span>
                            <span className="mt-1 block text-sm" style={{ color: 'var(--cm-muted)' }}>
                                Build with the rich text editor and {'{{placeholders}}'}.
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setUploadPdfOpen(true)}
                        className="cm-card flex items-start gap-3 p-4 text-left transition hover:shadow-md"
                        style={{ border: '1px solid rgba(59,130,246,0.25)' }}
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FaFilePdf />
                        </span>
                        <span>
                            <span className="block font-semibold" style={{ color: 'var(--cm-on-surface)' }}>Upload PDF Template</span>
                            <span className="mt-1 block text-sm" style={{ color: 'var(--cm-muted)' }}>
                                Upload your company offer letter PDF — fields are detected automatically.
                            </span>
                        </span>
                    </button>
                </div>

                <div className="mt-6 grid gap-3">
                    {templates.filter((t) => t.isActive !== false).map((template) => (
                        <div key={template._id} className="cm-card">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold" style={{ color: 'var(--cm-on-surface)' }}>{template.name}</h3>
                                        {template.isDefault && <CmBadge tone="done">Default</CmBadge>}
                                        <CmBadge tone={template.templateType === 'pdf' && !template.pdfTemplate?.mappingsConfigured ? 'attention' : 'neutral'} dot={false}>
                                            {template.templateType === 'pdf'
                                                ? (template.pdfTemplate?.mappingsConfigured ? 'PDF · Verified' : 'PDF — needs verification')
                                                : 'HTML'}
                                        </CmBadge>
                                        <CmBadge tone="neutral" dot={false}>v{template.version || 1}</CmBadge>
                                    </div>
                                    {template.description && <p className="mt-1 text-sm" style={{ color: 'var(--cm-muted)' }}>{template.description}</p>}
                                    <p className="mt-1 text-xs" style={{ color: 'var(--cm-muted)' }}>
                                        Updated {template.updatedAt ? format(new Date(template.updatedAt), 'dd MMM yyyy') : '—'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <CmButton variant="outline" size="sm" onClick={() => openTemplatePreview(template)}><FaEye className="text-xs" />Preview</CmButton>
                                    {template.templateType === 'pdf' && (
                                        <CmButton variant="outline" size="sm" onClick={() => { setSelected(template); setMappingOpen(true); }}>
                                            {template.pdfTemplate?.mappingsConfigured ? 'View Fields' : 'Verify Fields'}
                                        </CmButton>
                                    )}
                                    {template.templateType !== 'pdf' && (
                                        <>
                                            <CmButton variant="outline" size="sm" onClick={() => { setSelected(template); setHistoryOpen(true); }}><FaHistory className="text-xs" />History</CmButton>
                                            <CmButton variant="outline" size="sm" onClick={() => openEdit(template)}><FaEdit className="text-xs" />Edit</CmButton>
                                        </>
                                    )}
                                    {!template.isDefault && (
                                        <CmButton variant="outline" size="sm" onClick={() => setAsDefault(template)}><FaStar className="text-xs" />Set default</CmButton>
                                    )}
                                    <CmButton variant="outline" size="sm" onClick={() => deactivateTemplate(template)} style={{ color: 'var(--cm-error)' }}><FaTrash className="text-xs" />Deactivate</CmButton>
                                </div>
                            </div>
                        </div>
                    ))}
                    {!templates.filter((t) => t.isActive !== false).length && (
                        <div className="cm-empty space-y-3">
                            <p>No offer templates yet.</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <CmButton onClick={openCreate}><FaPlus /> New HTML Template</CmButton>
                                <CmButton variant="outline" onClick={() => setUploadPdfOpen(true)}><FaFilePdf /> Upload PDF Template</CmButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {editorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="mb-1 text-lg font-semibold">{form.id ? 'Edit HTML Template' : 'Create HTML Template'}</h3>
                        <p className="mb-4 text-sm text-gray-500">
                            For an existing company PDF, close this and use <strong>Upload PDF Template</strong> instead.
                        </p>
                        <form onSubmit={saveTemplate} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-sm text-gray-700">
                                    Template name
                                    <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
                                </label>
                                <label className="text-sm text-gray-700">
                                    Description
                                    <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                                </label>
                            </div>
                            <div>
                                <p className="mb-2 text-sm font-medium text-gray-700">Insert placeholders</p>
                                <PlaceholderChips onInsert={(token) => setForm((p) => ({ ...p, bodyHtml: `${p.bodyHtml || ''}${token}` }))} />
                            </div>
                            <RichTextEditor value={form.bodyHtml} onChange={(bodyHtml) => setForm((p) => ({ ...p, bodyHtml }))} />
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
                                Set as default template
                            </label>
                            <div className="flex justify-end gap-2 border-t pt-4">
                                <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Template'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {previewOpen && selected && (
                <Modal title={`Preview — ${selected.name}`} onClose={() => setPreviewOpen(false)}>
                    {selected.templateType === 'pdf' ? (
                        <>
                            <p className="mb-3 text-xs text-gray-500">PDF template — sample preview uses mapped fields when generating offers.</p>
                            {(selected.pdfTemplate?.pdfUrl) && (
                                <iframe title="PDF template" src={selected.pdfTemplate.pdfUrl} className="h-[560px] w-full rounded-lg border bg-gray-50" />
                            )}
                        </>
                    ) : (
                        <>
                            <p className="mb-3 text-xs text-gray-500">Sample data preview — formatting matches generated offer letters.</p>
                            {previewLoading ? (
                                <LoadingSpinner message="Loading preview..." />
                            ) : (
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <OfferLetterHtmlPreview html={previewHtml || selected.bodyHtml} />
                                </div>
                            )}
                        </>
                    )}
                </Modal>
            )}

            {uploadPdfOpen && (
                <OfferPdfTemplateUpload
                    onClose={() => setUploadPdfOpen(false)}
                    onUploaded={(template) => {
                        loadTemplates();
                        if (template?.pdfTemplate?.hasSelectableText !== false) {
                            setSelected(template);
                            setMappingOpen(true);
                        }
                    }}
                />
            )}

            {mappingOpen && selected && selected.templateType === 'pdf' && (
                <OfferPdfFieldMapping
                    template={selected}
                    onClose={() => setMappingOpen(false)}
                    onSaved={() => loadTemplates()}
                />
            )}

            {historyOpen && selected && (
                <Modal title={`Version History — ${selected.name}`} onClose={() => setHistoryOpen(false)}>
                    <div className="space-y-3">
                        <div className="rounded-lg border p-3 text-sm">
                            <p className="font-medium">Current (v{selected.version || 1})</p>
                            <p className="text-xs text-gray-500">Active template body</p>
                        </div>
                        {(selected.versionHistory || []).slice().reverse().map((entry, index) => (
                            <div key={index} className="rounded-lg border p-3 text-sm">
                                <p className="font-medium">Version {entry.version}</p>
                                <p className="text-xs text-gray-500">{entry.changedAt ? format(new Date(entry.changedAt), 'dd MMM yyyy HH:mm') : ''}</p>
                                <div className="prose prose-sm mt-2 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} />
                            </div>
                        ))}
                        {!selected.versionHistory?.length && <p className="text-sm text-gray-500">No prior versions recorded.</p>}
                    </div>
                </Modal>
            )}
        </div>
    );
};

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function defaultBody() {
    return `<p>Dear {{candidateName}},</p>
<p>We are pleased to offer you the position of <strong>{{position}}</strong> at {{companyName}}.</p>
<p><strong>Department:</strong> {{department}}<br/>
<strong>Annual CTC:</strong> {{salary}}<br/>
<strong>Date of Joining:</strong> {{startDate}}<br/>
<strong>Offer Valid Until:</strong> {{offerExpiryDate}}</p>
<p>Please accept this offer through the candidate portal.</p>`;
}

export default OfferTemplateManager;
