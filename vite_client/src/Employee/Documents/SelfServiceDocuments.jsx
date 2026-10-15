import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import '../../styles/document-preview.css';
import {
  BOTH_DOCUMENT_TEMPLATES_ENDPOINT,
  BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT,
} from '../../utils/constant';

// ─── Status badge ────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = ['select', 'details', 'preview', 'done'];

/** Signature/stamp fields come from template settings — not employee form input. */
const isSignatureOrStampField = (field) => {
  const key = String(field?.key || '').trim();
  const label = String(field?.label || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  if ([
    'authorizedPersonName',
    'authorizedPersonDesignation',
    'authorizedPersonDepartment',
    'companyStamp',
    'signatoryName',
    'signatoryDesignation',
    'signatoryDepartment',
  ].includes(key)) return true;
  return (
    /^company\s*stamp$/.test(label) ||
    /^authorized\s+person(\s+(name|designation|department))?$/.test(label) ||
    /^signatory(\s+(name|designation|department))?$/.test(label)
  );
};

export default function SelfServiceDocuments() {
  // Step management
  const [step, setStep] = useState('select'); // select | details | preview | done

  // Data
  const [countries, setCountries] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [myDocuments, setMyDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selections
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Dynamic fields
  const [fieldValues, setFieldValues] = useState({});

  // Preview & Generation
  const [previewHtml, setPreviewHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState(null);

  // ─── Load countries + my generated documents on mount ────────────────
  useEffect(() => {
    loadCountries();
    loadMyDocuments();
  }, []);

  const loadCountries = async () => {
    try {
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/countries`, { withCredentials: true });
      setCountries(data?.data || []);
    } catch {
      // Countries may be empty if no templates configured yet
    }
  };

  const loadMyDocuments = async () => {
    try {
      const { data } = await axios.get(`${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/my-documents`, { withCredentials: true });
      setMyDocuments(data?.data || []);
    } catch {
      // Silent — list is supplementary
    }
  };

  // ─── Load templates when country or doc type changes ─────────────────
  const loadTemplates = useCallback(async () => {
    if (!selectedCountry) { setTemplates([]); return; }
    setLoading(true);
    try {
      const params = { country: selectedCountry };
      if (selectedDocType) params.documentType = selectedDocType;
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/available`, { params, withCredentials: true });
      setTemplates(data?.data || []);
    } catch {
      toast.error('Failed to load available templates');
    } finally {
      setLoading(false);
    }
  }, [selectedCountry, selectedDocType]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─── Select a template → go to details step ─────────────────────────
  const handleSelectTemplate = async (tpl) => {
    try {
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/employee/${tpl._id}`, { withCredentials: true });
      const fullTemplate = data?.data;
      if (!fullTemplate) { toast.error('Template not available'); return; }
      setSelectedTemplate(fullTemplate);
      // Initialize field values with pre-populated employee data from server
      const defaults = {};
      const prePop = fullTemplate.prePopulatedValues || {};
      for (const f of (fullTemplate.dynamicFields || [])) {
        if (isSignatureOrStampField(f)) continue;
        defaults[f.key] = prePop[f.key] || f.defaultValue || '';
      }
      setFieldValues(defaults);
      setStep('details');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load template');
    }
  };

  // ─── Preview ─────────────────────────────────────────────────────────
  const handlePreview = async () => {
    // Validate required fields (skip signature/stamp — filled from template settings)
    for (const f of (selectedTemplate?.dynamicFields || [])) {
      if (isSignatureOrStampField(f)) continue;
      if (f.required && !fieldValues[f.key]?.trim()) {
        toast.error(`${f.label || f.key} is required`);
        return;
      }
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/preview`, {
        templateId: selectedTemplate._id,
        dynamicFieldValues: fieldValues,
      }, { withCredentials: true });
      setPreviewHtml(data?.data?.html || '<p>Preview not available</p>');
      setStep('preview');
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors?.length) {
        errors.forEach(e => toast.error(e));
      } else {
        toast.error(err?.response?.data?.message || 'Failed to generate preview');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Generate PDF ────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await axios.post(`${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/generate`, {
        templateId: selectedTemplate._id,
        dynamicFieldValues: fieldValues,
      }, { withCredentials: true });
      setGeneratedDocId(data?.data?.documentId);
      setStep('done');
      toast.success('Document generated successfully!');
      loadMyDocuments(); // Refresh list
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  // ─── Download ────────────────────────────────────────────────────────
  const handleDownload = (docId) => {
    window.open(`/api${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/download/${docId}`, '_blank');
  };

  // ─── Preview existing document (opens in browser PDF viewer) ──────────
  const handlePreviewExisting = (docId) => {
    window.open(`/api${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/download/${docId}?inline=1`, '_blank');
  };

  // ─── Delete generated document ───────────────────────────────────────
  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await axios.delete(`${BOTH_SELF_SERVICE_DOCUMENTS_ENDPOINT}/delete/${docId}`, { withCredentials: true });
      toast.success('Document deleted');
      loadMyDocuments();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete document');
    }
  };

  // ─── Reset ───────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep('select');
    setSelectedTemplate(null);
    setFieldValues({});
    setPreviewHtml('');
    setGeneratedDocId(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const stepLabels = {
    select: 'Select',
    details: 'Details',
    preview: 'Preview',
    done: 'Ready',
  };

  return (
    <div className="space-y-5">

        {/* Step Indicator */}
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm sm:px-5">
          <div className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((s, i) => {
              const isActive = step === s;
              const isPast = STEPS.indexOf(step) > i;
              return (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-[#20C997]' : isPast ? 'text-emerald-500' : 'text-slate-400'}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${isActive ? 'bg-[#20C997] text-white shadow-sm ring-4 ring-[#20C997]/15' : isPast ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {isPast ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{stepLabels[s] || s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${isPast ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ─── Step 1: Select Template ─────────────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Choose a Document</h3>
              <p className="mb-4 text-xs text-slate-500">Pick a country and optional type to see templates you can generate.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Country / Region</label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => { setSelectedCountry(e.target.value); setSelectedDocType(''); }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15"
                  >
                    <option value="">Select country...</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Document Type</label>
                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#20C997]/15"
                  >
                    <option value="">All types</option>
                    {[...new Set(templates.map(t => t.documentType))].map(dt => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Template cards */}
            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-10 shadow-sm sm:py-12">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#20C997]" />
                <p className="mt-3 text-xs text-slate-400">Loading templates...</p>
              </div>
            ) : !selectedCountry ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm sm:px-6 sm:py-12">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#20C997]/10 text-[#20C997]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" /></svg>
                </div>
                <p className="text-sm font-medium text-slate-700">Select a country to view available documents</p>
                <p className="mt-1 text-xs text-slate-400">Templates are organized by country/region.</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm sm:px-6 sm:py-12">
                <p className="text-sm text-slate-500">No templates available for the selected filters.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map(tpl => (
                  <button
                    key={tpl._id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#20C997]/35 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20C997]/10 text-[#20C997] transition group-hover:bg-[#20C997] group-hover:text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {(tpl.dynamicFields || []).length} field{(tpl.dynamicFields || []).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-900">{tpl.name}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">{tpl.documentType}</p>
                    {tpl.description && <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2">{tpl.description}</p>}
                    <span className="mt-3 inline-flex text-[11px] font-semibold text-[#20C997] opacity-0 transition group-hover:opacity-100">
                      Continue →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Enter Details ───────────────────────────────────────── */}
        {step === 'details' && selectedTemplate && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#20C997]">Template details</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedTemplate.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{selectedTemplate.documentType} · {selectedTemplate.country}</p>
              </div>
              <button type="button" onClick={handleReset} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                ← Back
              </button>
            </div>

            {(!selectedTemplate.dynamicFields || selectedTemplate.dynamicFields.filter((f) => !isSignatureOrStampField(f)).length === 0) ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm text-slate-600">No additional information needed.</p>
                <p className="mt-1 text-xs text-slate-400">Your profile data will be used automatically. Click Preview to continue.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="mb-3 text-xs text-slate-500">Fill in or verify the details below. Fields marked with <span className="text-red-500">*</span> are required.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedTemplate.dynamicFields.filter((f) => !isSignatureOrStampField(f)).map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                      </label>
                      {field.fieldType === 'select' ? (
                        <select
                          value={fieldValues[field.key] || ''}
                          onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none"
                        >
                          <option value="">{field.placeholder || 'Select...'}</option>
                          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.fieldType === 'textarea' ? (
                        <textarea
                          value={fieldValues[field.key] || ''}
                          onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                          rows={3}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <input
                          type={field.fieldType === 'date' ? 'date' : field.fieldType === 'number' ? 'number' : 'text'}
                          value={fieldValues[field.key] || ''}
                          onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-[#20C997] focus:bg-white focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3 border-t border-slate-100 pt-5">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="rounded-lg bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1bae83] disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Preview Document'}
              </button>
              <button onClick={handleReset} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Preview ─────────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-[#20C997]/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#20C997]">Live preview</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Document Preview</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Review formatting, signature, and stamp before preparing the PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ← Edit details
                </button>
              </div>
              <div className="p-3 sm:p-5">
                <div className="document-preview-wrapper document-preview-wrapper--framed">
                  <div
                    className="document-page"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1bae83] disabled:opacity-50"
              >
                {generating ? 'Generating PDF...' : 'Prepare PDF'}
              </button>
              <button
                type="button"
                onClick={() => setStep('details')}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Back to Details
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Done ────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Document Ready</h2>
            <p className="mt-1 text-sm text-slate-500">Your personalized document has been generated successfully.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {generatedDocId && (
                <button
                  type="button"
                  onClick={() => handleDownload(generatedDocId)}
                  className="rounded-xl bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1bae83]"
                >
                  Download PDF
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Generate Another
              </button>
            </div>
          </div>
        )}

        {/* ─── My Generated Documents ──────────────────────────────────────── */}
        {myDocuments.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Previously Generated</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {myDocuments.length}
              </span>
            </div>
            <div className="space-y-2">
              {myDocuments.map(doc => (
                <div key={doc._id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{doc.documentType}</p>
                    <p className="text-[11px] text-slate-400">
                      {doc.employeeName && <span className="font-medium text-slate-600">{doc.employeeName}</span>}
                      {doc.employeeName && ' · '}
                      {doc.country} · {formatBytes(doc.size)} · {formatDate(doc.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewExisting(doc._id)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc._id)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc._id)}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
