import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaClone, FaDownload, FaEye, FaFilePdf, FaPlus, FaPaperPlane } from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import RichTextEditor from '../../components/recruitment/RichTextEditor';

const TABS = [
    { id: 'templates', label: 'Templates' },
    { id: 'generated', label: 'Generated Letters' },
    { id: 'reports', label: 'Reports' },
];

const TRIGGER_EVENTS = [
    { value: 'offer_approved', label: 'Offer Approved' },
    { value: 'employee_joined', label: 'Employee Joined' },
    { value: 'probation_confirmed', label: 'Probation Confirmed' },
    { value: 'offboarding_completed', label: 'Offboarding Completed' },
    { value: 'fnf_approved', label: 'F&F Approved' },
];

const LetterGeneratorHub = () => {
    const base = `${ADMIN_LIFECYCLE_ENDPOINT}/letters`;
    const [tab, setTab] = useState('templates');
    const [loading, setLoading] = useState(true);
    const [letterTypes, setLetterTypes] = useState({});
    const [placeholders, setPlaceholders] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [letters, setLetters] = useState([]);
    const [report, setReport] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [form, setForm] = useState({
        name: '', letterType: 'experience_letter', bodyHtml: '', headerHtml: '', footerHtml: '',
        approvalRequired: false, watermarkText: '', workflowTriggers: [],
    });
    const [selected, setSelected] = useState(null);

    const allLetterTypes = useMemo(() => {
        const flat = [];
        Object.entries(letterTypes).forEach(([cat, types]) => {
            types.forEach((t) => flat.push({ value: t, label: t.replace(/_/g, ' '), category: cat }));
        });
        return flat;
    }, [letterTypes]);

    const loadMeta = useCallback(async () => {
        const { data } = await axios.get(`${base}/types`, { withCredentials: true });
        setLetterTypes(data.data?.types || {});
        setPlaceholders(data.data?.placeholders || []);
    }, [base]);

    const loadTemplates = useCallback(async () => {
        const { data } = await axios.get(`${base}/templates`, { withCredentials: true });
        setTemplates(data.data || []);
    }, [base]);

    const loadLetters = useCallback(async () => {
        const { data } = await axios.get(`${base}/generated`, { withCredentials: true });
        setLetters(data.data || []);
        setReport(data.report);
    }, [base]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            await loadMeta();
            if (tab === 'templates') await loadTemplates();
            if (tab === 'generated' || tab === 'reports') await loadLetters();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load letter generator');
        } finally {
            setLoading(false);
        }
    }, [tab, loadMeta, loadTemplates, loadLetters]);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setSelected(null);
        setForm({
            name: '', letterType: 'experience_letter',
            bodyHtml: '<p>Dear {{employeeName}},</p><p>This is to certify that...</p><p>{{currentDate}}</p>',
            headerHtml: '{{companyName}}', footerHtml: '{{signatureBlock}}',
            approvalRequired: false, watermarkText: '', workflowTriggers: [],
        });
        setEditorOpen(true);
    };

    const saveTemplate = async () => {
        try {
            if (selected) {
                await axios.put(`${base}/templates/${selected._id}`, form, { withCredentials: true });
            } else {
                await axios.post(`${base}/templates`, form, { withCredentials: true });
            }
            toast.success('Template saved');
            setEditorOpen(false);
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const publishTemplate = async (id) => {
        try {
            await axios.post(`${base}/templates/${id}/publish`, {}, { withCredentials: true });
            toast.success('Published');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Publish failed');
        }
    };

    const cloneTemplate = async (id) => {
        try {
            await axios.post(`${base}/templates/${id}/clone`, {}, { withCredentials: true });
            toast.success('Cloned');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Clone failed');
        }
    };

    const previewTemplate = async (id) => {
        try {
            const { data } = await axios.post(`${base}/templates/${id}/preview`, {}, { withCredentials: true });
            setPreviewHtml(data.data?.renderedHtml || '');
        } catch (error) {
            toast.error('Preview failed');
        }
    };

    const sendLetter = async (id) => {
        try {
            await axios.post(`${base}/generated/${id}/send`, {}, { withCredentials: true });
            toast.success('Letter sent');
            await loadLetters();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Send failed');
        }
    };

    const exportCsv = async () => {
        try {
            const { data } = await axios.get(`${base}/generated/export`, { withCredentials: true, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'lifecycle-letters.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error('Export failed');
        }
    };

    const insertPlaceholder = (token) => {
        setForm((f) => ({ ...f, bodyHtml: `${f.bodyHtml || ''}${token}` }));
    };

    if (loading && !templates.length) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Letter Generator</h2>
                    <p className="text-sm text-gray-500">Configurable HR letters with PDF generation, approval, and Document Hub storage.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t.id ? 'bg-theme-primary text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                            {t.label}
                        </button>
                    ))}
                    {tab === 'templates' && (
                        <button type="button" onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">
                            <FaPlus /> New Template
                        </button>
                    )}
                </div>
            </div>

            {tab === 'templates' && !editorOpen && (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actions</th>
                        </tr></thead>
                        <tbody>
                            {templates.map((t) => (
                                <tr key={t._id} className="border-t">
                                    <td className="px-3 py-2 font-medium">{t.name}</td>
                                    <td className="px-3 py-2">{t.letterType}</td>
                                    <td className="px-3 py-2">{t.status}</td>
                                    <td className="px-3 py-2 flex flex-wrap gap-2">
                                        <button type="button" onClick={() => { setSelected(t); setForm({ ...t, workflowTriggers: t.workflowTriggers || [] }); setEditorOpen(true); }} className="text-xs text-blue-600">Edit</button>
                                        <button type="button" onClick={() => previewTemplate(t._id)} className="text-xs text-gray-600 flex items-center gap-0.5"><FaEye /> Preview</button>
                                        <button type="button" onClick={() => cloneTemplate(t._id)} className="text-xs text-gray-600 flex items-center gap-0.5"><FaClone /> Clone</button>
                                        {t.status !== 'Published' && <button type="button" onClick={() => publishTemplate(t._id)} className="text-xs text-emerald-600">Publish</button>}
                                    </td>
                                </tr>
                            ))}
                            {!templates.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No letter templates yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {editorOpen && (
                <div className="border rounded-lg p-5 bg-white space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Template name" className="rounded border px-3 py-2 text-sm" />
                        <select value={form.letterType} onChange={(e) => setForm((f) => ({ ...f, letterType: e.target.value }))} className="rounded border px-3 py-2 text-sm">
                            {allLetterTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 mb-2">Placeholders — click to insert</p>
                        <div className="flex flex-wrap gap-1">
                            {placeholders.slice(0, 12).map((p) => (
                                <button key={p} type="button" onClick={() => insertPlaceholder(p)} className="text-[11px] px-2 py-0.5 border rounded bg-gray-50">{p}</button>
                            ))}
                        </div>
                    </div>
                    <label className="block text-sm">Header<input value={form.headerHtml || ''} onChange={(e) => setForm((f) => ({ ...f, headerHtml: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
                    <RichTextEditor value={form.bodyHtml} onChange={(html) => setForm((f) => ({ ...f, bodyHtml: html }))} />
                    <label className="block text-sm">Footer<input value={form.footerHtml || ''} onChange={(e) => setForm((f) => ({ ...f, footerHtml: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">Watermark<input value={form.watermarkText || ''} onChange={(e) => setForm((f) => ({ ...f, watermarkText: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="CONFIDENTIAL" /></label>
                        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={form.approvalRequired} onChange={(e) => setForm((f) => ({ ...f, approvalRequired: e.target.checked }))} /> Approval required</label>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-2">Workflow triggers</p>
                        {TRIGGER_EVENTS.map((ev) => {
                            const existing = (form.workflowTriggers || []).find((t) => t.event === ev.value);
                            return (
                                <label key={ev.value} className="flex items-center gap-2 text-sm mb-1">
                                    <input type="checkbox" checked={existing?.enabled !== false && !!existing}
                                        onChange={(e) => {
                                            const triggers = [...(form.workflowTriggers || [])].filter((t) => t.event !== ev.value);
                                            if (e.target.checked) triggers.push({ event: ev.value, enabled: true });
                                            setForm((f) => ({ ...f, workflowTriggers: triggers }));
                                        }} />
                                    {ev.label}
                                </label>
                            );
                        })}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={saveTemplate} className="px-4 py-2 bg-theme-primary text-white rounded-lg text-sm">Save</button>
                        <button type="button" onClick={() => setEditorOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {previewHtml && (
                <div className="border rounded-lg p-4 bg-white">
                    <div className="flex justify-between mb-2">
                        <h4 className="font-medium text-sm">Preview</h4>
                        <button type="button" onClick={() => setPreviewHtml('')} className="text-xs text-gray-500">Close</button>
                    </div>
                    <div className="prose prose-sm max-w-none border p-4 rounded" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
            )}

            {(tab === 'generated' || tab === 'reports') && (
                <div className="space-y-3">
                    {report && tab === 'reports' && (
                        <div className="grid sm:grid-cols-4 gap-3">
                            <Stat label="Total" value={report.total} />
                            <Stat label="Pending Approval" value={report.pendingApproval} />
                            <Stat label="Sent" value={report.sent} />
                            <Stat label="Acknowledged" value={report.acknowledged} />
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button type="button" onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm"><FaDownload /> CSV</button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Actions</th>
                            </tr></thead>
                            <tbody>
                                {letters.map((l) => (
                                    <tr key={l._id} className="border-t">
                                        <td className="px-3 py-2">{l.title}</td>
                                        <td className="px-3 py-2">{l.letterType}</td>
                                        <td className="px-3 py-2">{l.employeeId?.firstName || '—'}</td>
                                        <td className="px-3 py-2">{l.status}</td>
                                        <td className="px-3 py-2 flex gap-2">
                                            {l.pdfUrl && <a href={l.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-0.5"><FaFilePdf /> PDF</a>}
                                            {l.status === 'Approved' && <button type="button" onClick={() => sendLetter(l._id)} className="text-xs text-emerald-600 flex items-center gap-0.5"><FaPaperPlane /> Send</button>}
                                        </td>
                                    </tr>
                                ))}
                                {!letters.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No generated letters</td></tr>}
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
        <div className="p-4 border rounded-lg bg-white">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-semibold">{value ?? 0}</p>
        </div>
    );
}

export default LetterGeneratorHub;
