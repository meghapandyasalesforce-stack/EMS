import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft } from 'react-icons/fa';
import axios from '../../utils/axios';
import { parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';

const OTHER = '__other__';

const FALLBACK_DEPARTMENTS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration',
];
const FALLBACK_JOB_TITLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
    'HR Manager', 'HR Executive', 'Financial Analyst', 'Marketing Executive',
    'Sales Representative', 'Product Manager', 'QA Tester', 'Customer Support Specialist',
    'UX/UI Designer', 'Project Manager', 'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer',
];
const FALLBACK_POSITIONS = [
    'Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager',
    'Director', 'Executive', 'VP', 'CTO', 'CFO', 'CEO', 'Developer',
];
const FALLBACK_LOCATIONS = ['Remote', 'Hybrid', 'On-site', 'Work From Home'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];

const EMPTY = {
    jobTitle: '',
    department: '',
    position: '',
    jobDescription: '',
    location: '',
    employmentType: 'Full-time',
    status: 'Draft',
    priority: 'Medium',
    numberOfPositions: 1,
    salaryMin: '',
    salaryMax: '',
    currency: 'INR',
    closingDate: '',
    requirements: '',
    responsibilities: '',
    internalVisible: false,
    externalVisible: true,
    notifyEmployeesOnOpen: false,
    screeningEnabled: true,
    requiredKeywords: '',
    optionalKeywords: '',
    minimumMatchPercent: 70,
    experienceRequired: '',
    education: '',
    certifications: '',
    screeningTemplateId: '',
};

const selectClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';

/** Dropdown + optional "Other" free-text field */
const SelectWithOther = ({ label, required, options, selectValue, customValue, onSelectChange, onCustomChange, placeholder }) => {
    const isOther = selectValue === OTHER;
    return (
        <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
                {label}{required ? ' *' : ''}
            </span>
            <select
                className={selectClass}
                value={selectValue}
                required={required && !isOther}
                onChange={(e) => onSelectChange(e.target.value)}
            >
                <option value="">{placeholder || `Select ${label.toLowerCase()}`}</option>
                {options.map((t) => (
                    <option key={t} value={t}>{t}</option>
                ))}
                <option value={OTHER}>Other</option>
            </select>
            {isOther && (
                <input
                    className={`${inputClass} mt-2`}
                    value={customValue}
                    onChange={(e) => onCustomChange(e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()} manually`}
                    required={required}
                    autoFocus
                />
            )}
        </label>
    );
};

const CreateJobPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [screeningTemplates, setScreeningTemplates] = useState([]);
    const [selects, setSelects] = useState({
        jobTitle: '',
        department: '',
        position: '',
        location: '',
    });
    const [customs, setCustoms] = useState({
        jobTitle: '',
        department: '',
        position: '',
        location: '',
    });
    const [options, setOptions] = useState({
        departments: FALLBACK_DEPARTMENTS,
        jobTitles: FALLBACK_JOB_TITLES,
        positions: FALLBACK_POSITIONS,
        locations: FALLBACK_LOCATIONS,
    });

    useEffect(() => {
        axios.get('/v1/admin/recruitment/screening/templates', {
            withCredentials: true,
            params: { activeOnly: 'true' },
        }).then((res) => {
            setScreeningTemplates(res.data?.data || []);
        }).catch(() => { /* optional */ });
    }, []);

    const applyTemplate = (templateId) => {
        if (!templateId) {
            setForm((p) => ({ ...p, screeningTemplateId: '' }));
            return;
        }
        const t = screeningTemplates.find((x) => x._id === templateId);
        if (!t) return;
        setForm((p) => ({
            ...p,
            screeningTemplateId: templateId,
            screeningEnabled: true,
            requiredKeywords: normalizeKeywordList(t.requiredKeywords).join('\n'),
            optionalKeywords: normalizeKeywordList(t.optionalKeywords).join('\n'),
            minimumMatchPercent: t.minimumMatchPercent ?? 70,
        }));
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get('/v1/admin/organization/profile', { withCredentials: true });
                const org = data?.organization || data?.data?.organization || data?.data || {};
                const deptSet = new Set(FALLBACK_DEPARTMENTS);
                (org.orgDepartments || []).forEach((d) => {
                    const name = typeof d === 'object' ? d.name : d;
                    if (name && String(name).trim()) deptSet.add(String(name).trim());
                });
                const locSet = new Set(FALLBACK_LOCATIONS);
                (org.officeLocations || []).forEach((loc) => {
                    if (loc?.name) locSet.add(loc.name);
                    const city = loc?.address?.city;
                    if (city) locSet.add(city);
                });
                if (!cancelled) {
                    setOptions({
                        departments: [...deptSet].sort(),
                        jobTitles: FALLBACK_JOB_TITLES,
                        positions: FALLBACK_POSITIONS,
                        locations: [...locSet].sort(),
                    });
                    if (org.currency) {
                        setForm((prev) => ({ ...prev, currency: org.currency || prev.currency }));
                    }
                }
            } catch {
                /* keep fallbacks */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const resolved = (key) => (
        selects[key] === OTHER ? String(customs[key] || '').trim() : selects[key]
    );

    const setSelect = (key, value) => {
        setSelects((prev) => ({ ...prev, [key]: value }));
        if (value !== OTHER) {
            setCustoms((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const jobTitle = resolved('jobTitle');
        const department = resolved('department');
        const position = resolved('position');
        const location = resolved('location');

        if (!jobTitle || !department || !position || !form.jobDescription || !location) {
            toast.error('Please fill all required fields');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                jobTitle,
                department,
                position,
                jobDescription: form.jobDescription.trim(),
                location,
                employmentType: form.employmentType,
                status: form.status,
                priority: form.priority,
                numberOfPositions: Number(form.numberOfPositions) || 1,
                internalVisible: !!form.internalVisible,
                externalVisible: form.externalVisible !== false,
                notifyEmployeesOnOpen: form.notifyEmployeesOnOpen !== false,
                requirements: form.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
                responsibilities: form.responsibilities.split('\n').map((s) => s.trim()).filter(Boolean),
                salaryRange: {
                    min: form.salaryMin ? Number(form.salaryMin) : undefined,
                    max: form.salaryMax ? Number(form.salaryMax) : undefined,
                    currency: form.currency || 'INR',
                },
                closingDate: form.closingDate || undefined,
                screeningCriteria: {
                    enabled: form.screeningEnabled !== false,
                    requiredKeywords: normalizeKeywordList(form.requiredKeywords),
                    optionalKeywords: normalizeKeywordList(form.optionalKeywords),
                    minimumMatchPercent: parseMinimumMatchPercent(form.minimumMatchPercent, 70),
                    experienceRequired: form.experienceRequired.trim() || '',
                    education: form.education.trim() || '',
                    certifications: form.certifications.split('\n').map((s) => s.trim()).filter(Boolean),
                    templateId: form.screeningTemplateId || null,
                    templateName: screeningTemplates.find((t) => t._id === form.screeningTemplateId)?.name || '',
                },
            };
            const { data } = await axios.post('/v1/admin/recruitment/jobs', payload, { withCredentials: true });
            if (!data.success) {
                toast.error(data.message || 'Failed to create job');
                return;
            }
            toast.success('Job posting created');
            navigate(`/recruitment/jobs/${data.data._id}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create job');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="mx-auto max-w-3xl">
                <button
                    type="button"
                    onClick={() => navigate('/recruitment')}
                    className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    <FaArrowLeft /> Back to Recruitment
                </button>
                <h1 className="mb-1 text-2xl font-bold text-gray-800">Post New Job</h1>
                <p className="mb-6 text-gray-600">Create a job posting for the ATS and career portal</p>

                <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SelectWithOther
                            label="Job Title"
                            required
                            options={options.jobTitles}
                            selectValue={selects.jobTitle}
                            customValue={customs.jobTitle}
                            onSelectChange={(v) => setSelect('jobTitle', v)}
                            onCustomChange={(v) => setCustoms((p) => ({ ...p, jobTitle: v }))}
                        />
                        <SelectWithOther
                            label="Position"
                            required
                            options={options.positions}
                            selectValue={selects.position}
                            customValue={customs.position}
                            onSelectChange={(v) => setSelect('position', v)}
                            onCustomChange={(v) => setCustoms((p) => ({ ...p, position: v }))}
                        />
                        <SelectWithOther
                            label="Department"
                            required
                            options={options.departments}
                            selectValue={selects.department}
                            customValue={customs.department}
                            onSelectChange={(v) => setSelect('department', v)}
                            onCustomChange={(v) => setCustoms((p) => ({ ...p, department: v }))}
                        />
                        <SelectWithOther
                            label="Location"
                            required
                            options={options.locations}
                            selectValue={selects.location}
                            customValue={customs.location}
                            onSelectChange={(v) => setSelect('location', v)}
                            onCustomChange={(v) => setCustoms((p) => ({ ...p, location: v }))}
                        />
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Employment Type</span>
                            <select className={selectClass} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                                {['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Status</span>
                            <select className={selectClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                                {['Draft', 'Open', 'On Hold', 'Closed', 'Cancelled'].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Priority</span>
                            <select className={selectClass} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                                {['Low', 'Medium', 'High', 'Critical'].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Number of Positions</span>
                            <input type="number" min="1" className={inputClass} value={form.numberOfPositions} onChange={(e) => set('numberOfPositions', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Salary Min</span>
                            <input type="number" className={inputClass} value={form.salaryMin} onChange={(e) => set('salaryMin', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Salary Max</span>
                            <input type="number" className={inputClass} value={form.salaryMax} onChange={(e) => set('salaryMax', e.target.value)} />
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Currency</span>
                            <select className={selectClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Closing Date</span>
                            <input type="date" className={inputClass} value={form.closingDate} onChange={(e) => set('closingDate', e.target.value)} />
                        </label>
                    </div>

                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Job Description *</span>
                        <textarea rows={5} className={inputClass} value={form.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} required />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Requirements (one per line)</span>
                        <textarea rows={3} className={inputClass} value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Responsibilities (one per line)</span>
                        <textarea rows={3} className={inputClass} value={form.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} />
                    </label>

                    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-gray-800">Screening Criteria</h2>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={form.screeningEnabled}
                                    onChange={(e) => set('screeningEnabled', e.target.checked)}
                                />
                                Enable auto-screening
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">
                            New applicants are scored against these keywords automatically. Leave required keywords empty to skip screening for this job.
                            Select a template to pre-fill keywords — you can still edit them for this job only.
                        </p>
                        <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">Resume Screening Template</span>
                            <select
                                className={selectClass}
                                value={form.screeningTemplateId}
                                onChange={(e) => applyTemplate(e.target.value)}
                                disabled={!form.screeningEnabled}
                            >
                                <option value="">None — enter keywords manually</option>
                                {screeningTemplates.map((t) => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                ))}
                            </select>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm sm:col-span-1">
                                <span className="mb-1 block font-medium text-gray-700">Required Skills / Keywords (one per line)</span>
                                <textarea
                                    rows={4}
                                    className={inputClass}
                                    value={form.requiredKeywords}
                                    onChange={(e) => set('requiredKeywords', e.target.value)}
                                    placeholder={'React\nNode.js\nMongoDB'}
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-gray-700">Optional Skills / Keywords (one per line)</span>
                                <textarea
                                    rows={4}
                                    className={inputClass}
                                    value={form.optionalKeywords}
                                    onChange={(e) => set('optionalKeywords', e.target.value)}
                                    placeholder={'Docker\nAWS\nTypeScript'}
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-gray-700">Minimum Match %</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className={inputClass}
                                    value={form.minimumMatchPercent}
                                    onChange={(e) => set('minimumMatchPercent', e.target.value)}
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-gray-700">Experience Required</span>
                                <input
                                    className={inputClass}
                                    value={form.experienceRequired}
                                    onChange={(e) => set('experienceRequired', e.target.value)}
                                    placeholder="e.g. 3 years"
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-gray-700">Education (optional)</span>
                                <input
                                    className={inputClass}
                                    value={form.education}
                                    onChange={(e) => set('education', e.target.value)}
                                    placeholder="e.g. B.Tech / Bachelor"
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium text-gray-700">Certifications (one per line)</span>
                                <textarea
                                    rows={2}
                                    className={inputClass}
                                    value={form.certifications}
                                    onChange={(e) => set('certifications', e.target.value)}
                                    disabled={!form.screeningEnabled}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={form.externalVisible} onChange={(e) => set('externalVisible', e.target.checked)} />
                            Visible on career portal
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={form.internalVisible} onChange={(e) => set('internalVisible', e.target.checked)} />
                            Internal posting
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.notifyEmployeesOnOpen}
                                disabled={!form.internalVisible}
                                onChange={(e) => set('notifyEmployeesOnOpen', e.target.checked)}
                            />
                            Notify employees in-app when Open + internal
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button type="button" onClick={() => navigate('/recruitment')} className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="rounded-lg bg-theme-secondary px-4 py-2 text-white hover:bg-theme-primary disabled:opacity-60">
                            {saving ? 'Saving…' : 'Create Job'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateJobPage;
