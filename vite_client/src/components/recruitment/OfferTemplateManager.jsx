import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaEdit, FaEye, FaFilePdf, FaHistory, FaPlus, FaSearch, FaStar, FaTrash,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../LoadingSpinner';
import RichTextEditor, { PlaceholderChips } from './RichTextEditor';
import { CmButton } from '../corporateModern';
import OfferLetterHtmlPreview from './OfferLetterHtmlPreview';
import OfferPdfTemplateUpload from './OfferPdfTemplateUpload';
import OfferPdfFieldMapping from './OfferPdfFieldMapping';

const EMPTY_TEMPLATE = {
    name: '',
    description: '',
    bodyHtml: '',
    isDefault: false,
};

const templateTypeLabel = (template) => {
    if (template.templateType === 'pdf') return 'PDF';
    return 'HTML';
};

const templateEyebrow = (template) => {
    const kind = template.isDefault ? 'Default template' : 'Standard template';
    const type = templateTypeLabel(template);
    const band = template.band || template.levelBand || template.gradeBand;
    if (band) return `${kind} • Band ${band}`;
    if (template.templateType === 'pdf') return `${kind} • PDF upload`;
    return `${kind} • HTML letter`;
};

const formatTagLabel = (template) => (
    template.templateType === 'pdf'
        ? 'Format: PDF / DocuSign E-sign'
        : 'Format: HTML / Rich text'
);

const OfferTemplateManager = ({ onCountChange } = {}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [search, setSearch] = useState('');
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
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
            if (data.success) {
                const list = data.data || [];
                setTemplates(list);
                onCountChange?.(list.length);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load offer templates');
        } finally {
            setLoading(false);
        }
    }, [onCountChange]);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const filteredTemplates = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return templates;
        return templates.filter((t) => {
            const hay = `${t.name || ''} ${t.description || ''} ${templateTypeLabel(t)}`.toLowerCase();
            return hay.includes(q);
        });
    }, [templates, search]);

    const openCreate = () => {
        setCreateMenuOpen(false);
        setSelected(null);
        setForm({ ...EMPTY_TEMPLATE, bodyHtml: defaultBody() });
        setEditorOpen(true);
    };

    const openEdit = (template) => {
        if (template.templateType === 'pdf') {
            setSelected(template);
            setMappingOpen(true);
            return;
        }
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

    const setTemplateActive = async (template, isActive) => {
        try {
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, {
                id: template._id,
                name: template.name,
                bodyHtml: template.bodyHtml || '',
                templateType: template.templateType || 'html',
                description: template.description || '',
                isActive,
            }, { withCredentials: true });
            toast.success(isActive ? 'Template activated' : 'Template deactivated');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update template status');
        }
    };

    const deactivateTemplate = async (template) => {
        if (!window.confirm(`Deactivate template "${template.name}"?`)) return;
        await setTemplateActive(template, false);
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
        <div className="otmpl">
            <div className="otmpl__toolbar">
                <div className="otmpl__search">
                    <FaSearch className="otmpl__search-icon" aria-hidden="true" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search templates, designations, band..."
                        aria-label="Search offer templates"
                    />
                </div>
                <div className="otmpl__create-wrap">
                    <button
                        type="button"
                        className="otmpl__new-btn"
                        onClick={() => setCreateMenuOpen((v) => !v)}
                        aria-expanded={createMenuOpen}
                    >
                        <FaPlus className="h-3.5 w-3.5" /> New Template
                    </button>
                    {createMenuOpen ? (
                        <div className="otmpl__create-menu" role="menu">
                            <button type="button" role="menuitem" onClick={openCreate}>
                                <FaPlus /> New HTML Template
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setCreateMenuOpen(false);
                                    setUploadPdfOpen(true);
                                }}
                            >
                                <FaFilePdf /> Upload PDF Template
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {filteredTemplates.length === 0 ? (
                <div className="otmpl__empty">
                    <p>{search.trim() ? 'No templates match your search.' : 'No offer templates yet.'}</p>
                    {!search.trim() ? (
                        <div className="otmpl__empty-actions">
                            <CmButton onClick={openCreate}><FaPlus /> New HTML Template</CmButton>
                            <CmButton variant="outline" onClick={() => setUploadPdfOpen(true)}>
                                <FaFilePdf /> Upload PDF Template
                            </CmButton>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="otmpl__grid">
                    {filteredTemplates.map((template) => {
                        const active = template.isActive !== false;
                        const modifiedBy = template.updatedByName
                            || template.updatedBy?.name
                            || template.createdByName
                            || null;
                        const deptLabel = template.department || template.dept || null;
                        return (
                            <article
                                key={template._id}
                                className={`otmpl__card${active ? '' : ' is-inactive'}`}
                            >
                                <div className="otmpl__card-top">
                                    <p className="otmpl__eyebrow">{templateEyebrow(template)}</p>
                                    <label className="otmpl__toggle" title={active ? 'Active' : 'Inactive'}>
                                        <input
                                            type="checkbox"
                                            checked={active}
                                            onChange={(e) => setTemplateActive(template, e.target.checked)}
                                            aria-label={`${active ? 'Deactivate' : 'Activate'} ${template.name}`}
                                        />
                                        <span className="otmpl__toggle-ui" />
                                    </label>
                                </div>

                                <h3 className="otmpl__card-title">{template.name}</h3>
                                <p className="otmpl__card-desc">
                                    {template.description?.trim()
                                        || (template.templateType === 'pdf'
                                            ? 'Company PDF offer letter template with mapped fillable fields.'
                                            : 'HTML offer letter with placeholders for candidate and compensation details.')}
                                </p>

                                <div className="otmpl__tags">
                                    {deptLabel ? <span>Dept: {deptLabel}</span> : null}
                                    <span>{formatTagLabel(template)}</span>
                                    {template.isDefault ? <span>Default</span> : null}
                                    {template.templateType === 'pdf' && !template.pdfTemplate?.mappingsConfigured ? (
                                        <span className="is-warn">Needs verification</span>
                                    ) : null}
                                    <span className={active ? 'is-active' : 'is-inactive-tag'}>
                                        Status: {active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="otmpl__card-footer">
                                    <p className="otmpl__modified">
                                        Last modified:{' '}
                                        {template.updatedAt
                                            ? format(new Date(template.updatedAt), 'dd MMM yyyy')
                                            : '—'}
                                        {modifiedBy ? ` by ${modifiedBy}` : ''}
                                    </p>
                                    <div className="otmpl__actions">
                                        <button
                                            type="button"
                                            className="otmpl__action"
                                            onClick={() => openTemplatePreview(template)}
                                        >
                                            <FaEye /> Preview
                                        </button>
                                        <button
                                            type="button"
                                            className="otmpl__action"
                                            onClick={() => openEdit(template)}
                                        >
                                            <FaEdit /> Edit
                                        </button>
                                        {template.templateType !== 'pdf' ? (
                                            <button
                                                type="button"
                                                className="otmpl__action otmpl__action--ghost"
                                                title="Version history"
                                                onClick={() => {
                                                    setSelected(template);
                                                    setHistoryOpen(true);
                                                }}
                                            >
                                                <FaHistory />
                                            </button>
                                        ) : null}
                                        {!template.isDefault ? (
                                            <button
                                                type="button"
                                                className="otmpl__action otmpl__action--ghost"
                                                title="Set as default"
                                                onClick={() => setAsDefault(template)}
                                            >
                                                <FaStar />
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="otmpl__action otmpl__action--danger"
                                            title="Deactivate"
                                            onClick={() => deactivateTemplate(template)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

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
