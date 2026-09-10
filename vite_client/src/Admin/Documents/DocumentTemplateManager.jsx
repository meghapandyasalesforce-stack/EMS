import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { BOTH_DOCUMENT_TEMPLATES_ENDPOINT } from '../../utils/constant';

const DOCUMENT_TYPES = [
  'Experience Letter', 'Employment Letter', 'Appreciation Letter',
  'Salary Certificate', 'Employment Verification Letter',
  'Joining/Appointment Letter', 'Promotion/Increment Letter',
  'Relieving Letter', 'Other',
];

// Known HRMS field mappings — used for auto-mapping detected fields
const HRMS_FIELD_MAP = {
  'employee name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'candidate name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'full name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'name of employee': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'emp name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'employee full name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'name': { key: 'employeeName', source: 'employee', label: 'Employee Name', fieldType: 'text' },
  'employee id': { key: 'employeeId', source: 'employee', label: 'Employee ID', fieldType: 'text' },
  'emp id': { key: 'employeeId', source: 'employee', label: 'Employee ID', fieldType: 'text' },
  'employee code': { key: 'employeeId', source: 'employee', label: 'Employee ID', fieldType: 'text' },
  'emp code': { key: 'employeeId', source: 'employee', label: 'Employee ID', fieldType: 'text' },
  'employee number': { key: 'employeeId', source: 'employee', label: 'Employee ID', fieldType: 'text' },
  'designation': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'position': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'job title': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'role': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'job role': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'title': { key: 'designation', source: 'employee', label: 'Designation', fieldType: 'text' },
  'department': { key: 'department', source: 'employee', label: 'Department', fieldType: 'text' },
  'dept': { key: 'department', source: 'employee', label: 'Department', fieldType: 'text' },
  'department name': { key: 'department', source: 'employee', label: 'Department', fieldType: 'text' },
  'joining date': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'date of joining': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'doj': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'join date': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'start date': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'employment start date': { key: 'joiningDate', source: 'employee', label: 'Joining Date', fieldType: 'date' },
  'last working date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'last date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'end date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'termination date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'relieving date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'separation date': { key: 'lastWorkingDate', source: 'employee', label: 'Last Working Date', fieldType: 'date' },
  'salary': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'basic salary': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'monthly salary': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'annual salary': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'ctc': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'salary in words': { key: 'salary', source: 'employee', label: 'Salary', fieldType: 'text' },
  'company name': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'organization': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'organisation': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'company': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'firm name': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'employer name': { key: 'companyName', source: 'organization', label: 'Company Name', fieldType: 'text' },
  'company address': { key: 'companyAddress', source: 'organization', label: 'Company Address', fieldType: 'text' },
  'office address': { key: 'companyAddress', source: 'organization', label: 'Company Address', fieldType: 'text' },
  'registered address': { key: 'companyAddress', source: 'organization', label: 'Company Address', fieldType: 'text' },
  'address': { key: 'companyAddress', source: 'organization', label: 'Company Address', fieldType: 'text' },
  'email': { key: 'email', source: 'employee', label: 'Email', fieldType: 'text' },
  'email address': { key: 'email', source: 'employee', label: 'Email', fieldType: 'text' },
  'phone': { key: 'phone', source: 'employee', label: 'Phone', fieldType: 'text' },
  'phone number': { key: 'phone', source: 'employee', label: 'Phone', fieldType: 'text' },
  'contact number': { key: 'phone', source: 'employee', label: 'Phone', fieldType: 'text' },
  'mobile': { key: 'phone', source: 'employee', label: 'Phone', fieldType: 'text' },
  'manager': { key: 'manager', source: 'employee', label: 'Manager', fieldType: 'text' },
  'reporting manager': { key: 'manager', source: 'employee', label: 'Manager', fieldType: 'text' },
  'supervisor': { key: 'manager', source: 'employee', label: 'Manager', fieldType: 'text' },
  'date': { key: 'currentDate', source: 'system', label: 'Date', fieldType: 'date' },
  'current date': { key: 'currentDate', source: 'system', label: 'Date', fieldType: 'date' },
  'issue date': { key: 'currentDate', source: 'system', label: 'Date', fieldType: 'date' },
  'letter date': { key: 'currentDate', source: 'system', label: 'Date', fieldType: 'date' },
};

/**
 * Detect fields from template body content.
 * Supports multiple formats — matches backend templateFieldDetector.js logic:
 *   1. {{placeholder}} — explicit syntax
 *   2. [Field Name] — bracket syntax
 *   3. **[Field Name]** — markdown bold brackets
 *   4. Label: _________ — colon + underscores/blank line
 *   5. Label: [value] — colon with bracketed sample
 */
function detectFieldsFromBody(bodyContent) {
  if (!bodyContent) return [];
  const detected = new Map();

  // Helper: find HRMS mapping for a label
  const findMapping = (label) => {
    const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    for (const [pattern, mapping] of Object.entries(HRMS_FIELD_MAP)) {
      if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
        return mapping;
      }
    }
    return null;
  };

  // Helper: generate camelCase key from label
  const labelToKey = (label) => label
    .replace(/[^a-zA-Z0-9\s]/g, '').trim()
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  // 1. {{placeholder}} syntax
  const placeholderRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = placeholderRegex.exec(bodyContent)) !== null) {
    const rawKey = match[1].trim();
    const mapping = findMapping(rawKey);
    const key = mapping?.key || rawKey;
    if (!detected.has(key)) {
      detected.set(key, {
        key,
        label: mapping?.label || rawKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
        fieldType: mapping?.fieldType || (rawKey.toLowerCase().includes('date') ? 'date' : 'text'),
        required: true,
        source: mapping?.source || 'manual',
        autoMapped: !!mapping,
        detectedAs: match[0],
        options: [],
        defaultValue: '',
        placeholder: '',
      });
    }
  }

  // 2. [Field Name] and **[Field Name]** bracket patterns
  const bracketRegex = /\*{0,2}\[([^\]]{2,40})\]\*{0,2}/g;
  while ((match = bracketRegex.exec(bodyContent)) !== null) {
    const label = match[1].trim();
    if (label.startsWith('http') || label.startsWith('/') || ['x', 'X', ' '].includes(label)) continue;
    const mapping = findMapping(label);
    const key = mapping?.key || labelToKey(label);
    if (!detected.has(key)) {
      detected.set(key, {
        key,
        label: mapping?.label || label,
        fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
        required: true,
        source: mapping?.source || 'manual',
        autoMapped: !!mapping,
        detectedAs: match[0],
        options: [],
        defaultValue: '',
        placeholder: '',
      });
    }
  }

  // 3. Label: _________ or Label: blank (line-by-line detection)
  const lines = bodyContent.split('\n');
  for (const line of lines) {
    // "Label: ____" or "Label:   " (colon + blanks/underscores)
    const colonMatch = line.match(/^[\s*]*([A-Za-z][A-Za-z\s/()]{1,35}):\s*[_.\-\s]*$/);
    if (colonMatch) {
      const label = colonMatch[1].trim();
      const mapping = findMapping(label);
      const key = mapping?.key || labelToKey(label);
      if (!detected.has(key)) {
        detected.set(key, {
          key,
          label: mapping?.label || label,
          fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
          required: true,
          source: mapping?.source || 'manual',
          autoMapped: !!mapping,
          detectedAs: colonMatch[0].trim(),
          options: [],
          defaultValue: '',
          placeholder: '',
        });
      }
    }

    // "Label: [Some Value]" — colon with bracketed sample
    const colonBracketMatch = line.match(/^[\s*]*([A-Za-z][A-Za-z\s/()]{1,35}):\s*\[([^\]]+)\]/);
    if (colonBracketMatch) {
      const label = colonBracketMatch[1].trim();
      const mapping = findMapping(label);
      const key = mapping?.key || labelToKey(label);
      if (!detected.has(key)) {
        detected.set(key, {
          key,
          label: mapping?.label || label,
          fieldType: mapping?.fieldType || (label.toLowerCase().includes('date') ? 'date' : 'text'),
          required: true,
          source: mapping?.source || 'manual',
          autoMapped: !!mapping,
          detectedAs: colonBracketMatch[0].trim(),
          options: [],
          defaultValue: '',
          placeholder: '',
        });
      }
    }
  }

  return Array.from(detected.values());
}

export default function DocumentTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ documentType: '', country: '' });

  const [form, setForm] = useState({
    name: '',
    documentType: 'Experience Letter',
    description: '',
    country: 'India',
    bodyContent: '',
    isSelfService: true,
    isActive: true,
    signature: { enabled: true, signatoryName: '', signatoryDesignation: '', companyName: '', stampEnabled: false },
    formatting: { paperSize: 'A4', orientation: 'portrait', includeLetterhead: true, includeDate: true, includeReferenceNumber: true },
  });

  // Auto-detected fields from body content
  const detectedFields = useMemo(() => detectFieldsFromBody(form.bodyContent), [form.bodyContent]);

  // Additional manually added fields
  const [manualFields, setManualFields] = useState([]);

  // Company stamp state
  const [stampPreview, setStampPreview] = useState(null); // base64 data URL
  const [stampFileName, setStampFileName] = useState('');

  const handleStampUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Stamp image must be under 2MB'); return; }
    if (!editingId) {
      // Preview locally before template is saved (will upload after save)
      const reader = new FileReader();
      reader.onload = (ev) => {
        setStampPreview(ev.target.result);
        setStampFileName(file.name);
        setForm(p => ({ ...p, signature: { ...p.signature, stampEnabled: true } }));
      };
      reader.readAsDataURL(file);
      toast.info('Stamp will be uploaded when you save the template');
      return;
    }
    // Upload directly if editing existing template
    const fd = new FormData();
    fd.append('stamp', file);
    try {
      await axios.post(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${editingId}/stamp`, fd, { withCredentials: true });
      toast.success('Stamp uploaded');
      // Reload preview
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${editingId}/stamp`, { withCredentials: true });
      setStampPreview(data?.data?.stampBase64 || null);
      setStampFileName(data?.data?.stampFileName || '');
      setForm(p => ({ ...p, signature: { ...p.signature, stampEnabled: true } }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload stamp');
    }
  };

  const handleRemoveStamp = async () => {
    if (editingId) {
      try {
        await axios.delete(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${editingId}/stamp`, { withCredentials: true });
        toast.success('Stamp removed');
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to remove stamp');
      }
    }
    setStampPreview(null);
    setStampFileName('');
    setForm(p => ({ ...p, signature: { ...p.signature, stampEnabled: false } }));
  };

  const loadStampPreview = async (templateId) => {
    try {
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${templateId}/stamp`, { withCredentials: true });
      setStampPreview(data?.data?.stampBase64 || null);
      setStampFileName(data?.data?.stampFileName || '');
    } catch {
      setStampPreview(null);
      setStampFileName('');
    }
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.documentType) params.documentType = filters.documentType;
      if (filters.country) params.country = filters.country;
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/list`, { params, withCredentials: true });
      setTemplates(data?.data || []);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const resetForm = () => {
    setForm({
      name: '', documentType: 'Experience Letter', description: '', country: 'India',
      bodyContent: '', isSelfService: true, isActive: true,
      signature: { enabled: true, signatoryName: '', signatoryDesignation: '', companyName: '', stampEnabled: false },
      formatting: { paperSize: 'A4', orientation: 'portrait', includeLetterhead: true, includeDate: true, includeReferenceNumber: true },
    });
    setManualFields([]);
    setStampPreview(null);
    setStampFileName('');
    setEditingId(null);
  };

  const handleEdit = async (id) => {
    try {
      const { data } = await axios.get(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${id}`, { withCredentials: true });
      const tpl = data?.data;
      if (!tpl) return;
      setForm({
        name: tpl.name || '',
        documentType: tpl.documentType || 'Experience Letter',
        description: tpl.description || '',
        country: tpl.country || 'India',
        bodyContent: tpl.bodyContent || '',
        isSelfService: tpl.isSelfService !== false,
        isActive: tpl.isActive !== false,
        signature: tpl.signature || { enabled: true, signatoryName: '', signatoryDesignation: '', companyName: '', stampEnabled: false },
        formatting: tpl.formatting || { paperSize: 'A4', orientation: 'portrait', includeLetterhead: true, includeDate: true, includeReferenceNumber: true },
      });
      // Separate detected vs manual fields from saved dynamicFields
      const bodyDetected = detectFieldsFromBody(tpl.bodyContent || '');
      const bodyKeys = new Set(bodyDetected.map(f => f.key));
      const savedManual = (tpl.dynamicFields || []).filter(f => !bodyKeys.has(f.key));
      setManualFields(savedManual);
      setEditingId(id);
      setShowForm(true);
      // Load stamp preview if exists
      if (tpl.signature?.stampEnabled) {
        loadStampPreview(id);
      } else {
        setStampPreview(null);
        setStampFileName('');
      }
    } catch {
      toast.error('Failed to load template details');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bodyContent.trim()) {
      toast.error('Template name and body content are required');
      return;
    }

    // Merge detected fields + manual fields → dynamicFields for storage
    const allFields = [
      ...detectedFields.map(f => ({
        key: f.key,
        label: f.label,
        fieldType: f.fieldType,
        required: f.required,
        options: f.options || [],
        defaultValue: f.defaultValue || '',
        placeholder: f.placeholder || '',
      })),
      ...manualFields.map(f => ({
        key: f.key || f.label.replace(/\s+/g, '').replace(/^./, s => s.toLowerCase()),
        label: f.label,
        fieldType: f.fieldType || 'text',
        required: f.required !== false,
        options: f.options || [],
        defaultValue: f.defaultValue || '',
        placeholder: f.placeholder || '',
      })),
    ];

    // Build systemPlaceholders from auto-mapped fields
    const systemPlaceholders = detectedFields
      .filter(f => f.autoMapped && f.source !== 'manual')
      .map(f => ({
        key: f.key,
        source: f.source,
        field: f.key, // maps to the convenience shortcut key in buildPlaceholderValues
        label: f.label,
        format: f.fieldType === 'date' ? 'date:DD MMM YYYY' : '',
      }));

    const payload = {
      ...form,
      dynamicFields: allFields,
      systemPlaceholders,
    };

    try {
      if (editingId) {
        await axios.put(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${editingId}`, payload, { withCredentials: true });
        toast.success('Template updated');
      } else {
        await axios.post(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/`, payload, { withCredentials: true });
        toast.success('Template created');
      }
      setShowForm(false);
      resetForm();
      loadTemplates();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Disable this template? Employees will no longer be able to use it.')) return;
    try {
      await axios.delete(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${id}`, { withCredentials: true });
      toast.success('Template disabled');
      loadTemplates();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to disable template');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!window.confirm('Permanently delete this template? This action cannot be undone.')) return;
    try {
      await axios.delete(`${BOTH_DOCUMENT_TEMPLATES_ENDPOINT}/admin/${id}?permanent=true`, { withCredentials: true });
      toast.success('Template deleted permanently');
      loadTemplates();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete template');
    }
  };

  const addManualField = () => {
    setManualFields(prev => [...prev, { key: '', label: '', fieldType: 'text', required: true, options: [], defaultValue: '', placeholder: '' }]);
  };

  const updateManualField = (index, field, value) => {
    setManualFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-generate key from label
      if (field === 'label') {
        updated[index].key = value.replace(/\s+/g, '').replace(/^(.)/, (m) => m.toLowerCase());
      }
      return updated;
    });
  };

  const removeManualField = (index) => {
    setManualFields(prev => prev.filter((_, i) => i !== index));
  };

  // Insert placeholder into body at cursor position
  const insertPlaceholder = (key) => {
    setForm(prev => ({
      ...prev,
      bodyContent: prev.bodyContent + `{{${key}}}`,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Templates</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage predefined templates for employee self-service document generation.</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="shrink-0 rounded-xl bg-[#20C997] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1bae83]"
          >
            + New Template
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
          <select
            value={filters.documentType}
            onChange={(e) => setFilters(prev => ({ ...prev, documentType: e.target.value }))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#20C997] focus:outline-none"
          >
            <option value="">All Document Types</option>
            {DOCUMENT_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
          </select>
          <input
            value={filters.country}
            onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
            placeholder="Filter by country..."
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#20C997] focus:outline-none"
          />
          <div className="ml-auto text-xs text-slate-400 self-center">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Template List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#20C997]" />
            <p className="mt-3 text-sm text-slate-400">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl bg-white px-8 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <h3 className="text-base font-semibold text-slate-700">No templates yet</h3>
            <p className="mt-1 text-sm text-slate-500">Create your first document template to enable employee self-service.</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4 rounded-lg bg-[#20C997] px-4 py-2 text-sm font-medium text-white hover:bg-[#1bae83]">
              Create Template
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(tpl => {
              const creatorName = tpl.createdBy ? `${tpl.createdBy.name || ''} ${tpl.createdBy.lastName || ''}`.trim() : '';
              const creatorRole = tpl.createdBy?.functionalRoles?.length
                ? tpl.createdBy.functionalRoles[0].charAt(0).toUpperCase() + tpl.createdBy.functionalRoles[0].slice(1)
                : (tpl.createdBy?.jobTitle || tpl.createdBy?.position || '');
              return (
                <div key={tpl._id} className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Template info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-semibold text-slate-900 truncate">{tpl.name}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tpl.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {tpl.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{tpl.documentType}</span>
                        <span className="text-slate-300">·</span>
                        <span>{tpl.country}</span>
                        <span className="text-slate-300">·</span>
                        <span>{(tpl.dynamicFields || []).length} fields</span>
                        {tpl.signature?.stampEnabled && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-blue-600">Stamp attached</span>
                          </>
                        )}
                      </div>
                      {/* Creator & Dates */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        {creatorName && (
                          <span>
                            Created by <span className="font-medium text-slate-600">{creatorName}</span>
                            {creatorRole && <span className="text-slate-400"> ({creatorRole})</span>}
                          </span>
                        )}
                        {tpl.createdAt && (
                          <span>on {new Date(tpl.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        )}
                        {tpl.updatedAt && tpl.updatedAt !== tpl.createdAt && (
                          <span className="text-slate-300">· Updated {new Date(tpl.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                    </div>
                    {/* Right: Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => handleEdit(tpl._id)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                        Edit
                      </button>
                      {tpl.isActive && (
                        <button onClick={() => handleDelete(tpl._id)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">
                          Disable
                        </button>
                      )}
                      <button onClick={() => handlePermanentDelete(tpl._id)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Create/Edit Form Modal ──────────────────────────────────────── */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 pt-4 sm:p-4 sm:pt-10">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Template' : 'Create Template'}</h2>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleSave} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">

                {/* ─── Basic Info ─────────────────────────────────── */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Template Name *</label>
                    <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required className="w-full rounded-xl border border-slate-200 p-2.5 text-sm" placeholder="e.g., Experience Letter - India" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Document Type *</label>
                    <select value={form.documentType} onChange={(e) => setForm(p => ({ ...p, documentType: e.target.value }))} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm">
                      {DOCUMENT_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Country *</label>
                    <input value={form.country} onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))} required className="w-full rounded-xl border border-slate-200 p-2.5 text-sm" placeholder="e.g., India" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                    <input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm" placeholder="Brief description for employees" />
                  </div>
                </div>

                {/* ─── Template Body ──────────────────────────────── */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">
                      Template Body * <span className="text-slate-400">— Write your document naturally. Fields like [Employee Name], Employee Name: ___ or {'{{employeeName}}'} will be detected automatically.</span>
                    </label>
                  </div>
                  {/* Quick insert buttons */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400 self-center mr-1">Quick insert:</span>
                    {['employeeName', 'employeeId', 'designation', 'department', 'joiningDate', 'lastWorkingDate', 'companyName'].map(key => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => insertPlaceholder(key)}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={form.bodyContent}
                    onChange={(e) => setForm(p => ({ ...p, bodyContent: e.target.value }))}
                    rows={10}
                    required
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed"
                    placeholder={`Example:\n\nTO WHOM IT MAY CONCERN\n\nThis is to certify that [Employee Name] was employed with [Company Name] as [Designation] in the [Department] department from [Joining Date] to [Last Working Date].\n\nEmployee ID: ___________\n\nWe wish them all the best for the future.\n\nAuthorized Signatory`}
                  />
                </div>

                {/* ─── Detected Template Fields ───────────────────── */}
                {detectedFields.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                      <h3 className="text-sm font-semibold text-slate-800">Detected Template Fields</h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{detectedFields.length} fields found</span>
                    </div>
                    <p className="mb-3 text-xs text-slate-500">These fields were automatically detected from your template body. Fields matching employee/company information will be auto-filled.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-emerald-200 text-left text-slate-600">
                            <th className="pb-2 pr-4 font-medium">Field</th>
                            <th className="pb-2 pr-4 font-medium">Type</th>
                            <th className="pb-2 pr-4 font-medium">Source</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detectedFields.map(f => (
                            <tr key={f.key} className="border-b border-emerald-100">
                              <td className="py-2 pr-4 font-medium text-slate-800">{f.label}</td>
                              <td className="py-2 pr-4 text-slate-600 capitalize">{f.fieldType}</td>
                              <td className="py-2 pr-4">
                                {f.autoMapped ? (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                    Auto: {f.source === 'employee' ? 'Employee Profile' : 'Company Info'}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Employee enters</span>
                                )}
                              </td>
                              <td className="py-2">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Detected</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── Additional Fields (Manual) ─────────────────── */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Additional Fields</h3>
                      <p className="text-xs text-slate-500">Add fields that employees need to fill but aren't in the template body. The system will add {'{{fieldName}}'} automatically.</p>
                    </div>
                    <button type="button" onClick={addManualField} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                      + Add Field
                    </button>
                  </div>
                  {manualFields.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No additional fields added.</p>
                  ) : (
                    <div className="space-y-2">
                      {manualFields.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                          <input
                            value={f.label}
                            onChange={(e) => updateManualField(i, 'label', e.target.value)}
                            placeholder="Field name (e.g., Notice Period)"
                            className="flex-1 rounded border border-slate-200 p-1.5 text-xs"
                          />
                          <select
                            value={f.fieldType}
                            onChange={(e) => updateManualField(i, 'fieldType', e.target.value)}
                            className="rounded border border-slate-200 p-1.5 text-xs"
                          >
                            <option value="text">Text</option>
                            <option value="date">Date</option>
                            <option value="number">Number</option>
                            <option value="textarea">Long text</option>
                          </select>
                          <label className="flex items-center gap-1 text-xs text-slate-600">
                            <input type="checkbox" checked={f.required} onChange={(e) => updateManualField(i, 'required', e.target.checked)} />
                            Required
                          </label>
                          <button type="button" onClick={() => removeManualField(i)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Signature ──────────────────────────────────── */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">Signature & Stamp</h3>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={form.signature.enabled} onChange={(e) => setForm(p => ({ ...p, signature: { ...p.signature, enabled: e.target.checked } }))} />
                      Include signature
                    </label>
                  </div>
                  {form.signature.enabled && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-slate-500">Signatory Name</label>
                          <input value={form.signature.signatoryName} onChange={(e) => setForm(p => ({ ...p, signature: { ...p.signature, signatoryName: e.target.value } }))} className="w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="e.g., HR Manager" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-slate-500">Signatory Designation</label>
                          <input value={form.signature.signatoryDesignation} onChange={(e) => setForm(p => ({ ...p, signature: { ...p.signature, signatoryDesignation: e.target.value } }))} className="w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="e.g., Head of HR" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-slate-500">Company Name</label>
                          <input value={form.signature.companyName} onChange={(e) => setForm(p => ({ ...p, signature: { ...p.signature, companyName: e.target.value } }))} className="w-full rounded-lg border border-slate-200 p-2 text-sm" placeholder="e.g., Paarsiv Technologies" />
                        </div>
                      </div>

                      {/* Company Stamp */}
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <input type="checkbox" checked={form.signature.stampEnabled || false} onChange={(e) => setForm(p => ({ ...p, signature: { ...p.signature, stampEnabled: e.target.checked } }))} />
                            Include Company Stamp
                          </label>
                        </div>
                        {form.signature.stampEnabled && (
                          <div className="flex items-center gap-4">
                            {stampPreview ? (
                              <div className="flex items-center gap-3">
                                <img src={stampPreview} alt="Company Stamp" className="h-16 w-16 rounded border border-slate-200 object-contain bg-white p-1" />
                                <div>
                                  <p className="text-xs text-slate-600">{stampFileName || 'Stamp uploaded'}</p>
                                  <button type="button" onClick={handleRemoveStamp} className="mt-1 text-[10px] text-red-600 hover:underline">Remove</button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="cursor-pointer rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                                  Upload Stamp
                                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleStampUpload} />
                                </label>
                                <p className="mt-1 text-[10px] text-slate-400">PNG, JPG or SVG (max 2MB)</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Options ────────────────────────────────────── */}
                <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 p-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.isSelfService} onChange={(e) => setForm(p => ({ ...p, isSelfService: e.target.checked }))} />
                    Available for Self-Service
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.formatting.includeLetterhead} onChange={(e) => setForm(p => ({ ...p, formatting: { ...p.formatting, includeLetterhead: e.target.checked } }))} />
                    Include Letterhead
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.formatting.includeDate} onChange={(e) => setForm(p => ({ ...p, formatting: { ...p.formatting, includeDate: e.target.checked } }))} />
                    Include Date
                  </label>
                </div>

                {/* ─── Save ───────────────────────────────────────── */}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="rounded-xl bg-[#20C997] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1bae83]">
                    {editingId ? 'Update Template' : 'Save Template'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
