import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { parseMinimumMatchPercent, normalizeKeywordList } from '../../utils/resumeScreeningDisplay';
import { getStatusHint, toastForSave } from '../../utils/publishStatusUi';
import { AtsPage, AtsPageHeader, CmButton } from '../../components/recruitment/atsUi';

const OTHER = '__other__';

const FALLBACK_DEPARTMENTS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration',
    'Salesforce',
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
    workforcePlanId: '',
    workforceHiringIndex: '',
};

const selectClass = 'cm-select w-full';
const inputClass = 'cm-input w-full';

/** Dropdown + optional "Other" free-text field */
const SelectWithOther = ({ label, required, options, selectValue, customValue, onSelectChange, onCustomChange, placeholder }) => {
    const isOther = selectValue === OTHER;
    return (
        <label className="block text-sm">
            <span className="ats-form-label">
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

const pickSelect = (value, optionList) => {
    const v = String(value || '').trim();
    if (!v) return { select: '', custom: '' };
    if (optionList.includes(v)) return { select: v, custom: '' };
    return { select: OTHER, custom: v };
};

const toDateInput = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

const CreateJobPage = () => {
    const navigate = useNavigate();
    const { id: editId } = useParams();
    const isEdit = Boolean(editId);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [loadingJob, setLoadingJob] = useState(isEdit);
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
    const [workforceRequirements, setWorkforceRequirements] = useState([]);
    const [selectedWorkforceKey, setSelectedWorkforceKey] = useState('');

    useEffect(() => {
        if (isEdit) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get('/v1/admin/workforce/open-hiring-requirements', {
                    withCredentials: true,
                });
                if (!cancelled) {
                    setWorkforceRequirements(data?.data || []);
                }
            } catch {
                /* optional integration */
            }
        })();
        return () => { cancelled = true; };
    }, [isEdit]);

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

    useEffect(() => {
        if (!isEdit) {
            setLoadingJob(false);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                setLoadingJob(true);
                const { data } = await axios.get(`/v1/admin/recruitment/jobs/${editId}`, { withCredentials: true });
                if (cancelled) return;
                if (!data?.success || !data?.data) {
                    toast.error('Job not found');
                    navigate('/recruitment');
                    return;
                }
                const job = data.data;
                const sc = job.screeningCriteria || {};
                const nextOptions = {
                    departments: [...new Set([...FALLBACK_DEPARTMENTS, job.department].filter(Boolean))].sort(),
                    jobTitles: [...new Set([...FALLBACK_JOB_TITLES, job.jobTitle].filter(Boolean))],
                    positions: [...new Set([...FALLBACK_POSITIONS, job.position].filter(Boolean))],
                    locations: [...new Set([...FALLBACK_LOCATIONS, job.location].filter(Boolean))].sort(),
                };
                setOptions((prev) => ({
                    departments: [...new Set([...prev.departments, ...nextOptions.departments])].sort(),
                    jobTitles: [...new Set([...prev.jobTitles, ...nextOptions.jobTitles])],
                    positions: [...new Set([...prev.positions, ...nextOptions.positions])],
                    locations: [...new Set([...prev.locations, ...nextOptions.locations])].sort(),
                }));

                const titlePick = pickSelect(job.jobTitle, nextOptions.jobTitles);
                const deptPick = pickSelect(job.department, nextOptions.departments);
                const posPick = pickSelect(job.position, nextOptions.positions);
                const locPick = pickSelect(job.location, nextOptions.locations);
                setSelects({
                    jobTitle: titlePick.select,
                    department: deptPick.select,
                    position: posPick.select,
                    location: locPick.select,
                });
                setCustoms({
                    jobTitle: titlePick.custom,
                    department: deptPick.custom,
                    position: posPick.custom,
                    location: locPick.custom,
                });
                setForm({
                    jobTitle: job.jobTitle || '',
                    department: job.department || '',
                    position: job.position || '',
                    jobDescription: job.jobDescription || '',
                    location: job.location || '',
                    employmentType: job.employmentType || 'Full-time',
                    status: job.status || 'Draft',
                    priority: job.priority || 'Medium',
                    numberOfPositions: job.numberOfPositions || 1,
                    salaryMin: job.salaryRange?.min ?? '',
                    salaryMax: job.salaryRange?.max ?? '',
                    currency: job.salaryRange?.currency || 'INR',
                    closingDate: toDateInput(job.closingDate),
                    requirements: (job.requirements || []).join('\n'),
                    responsibilities: (job.responsibilities || []).join('\n'),
                    internalVisible: !!job.internalVisible,
                    externalVisible: job.externalVisible !== false,
                    notifyEmployeesOnOpen: job.notifyEmployeesOnOpen !== false,
                    screeningEnabled: sc.enabled !== false,
                    requiredKeywords: normalizeKeywordList(sc.requiredKeywords).join('\n'),
                    optionalKeywords: normalizeKeywordList(sc.optionalKeywords).join('\n'),
                    minimumMatchPercent: sc.minimumMatchPercent ?? 70,
                    experienceRequired: sc.experienceRequired || '',
                    education: sc.education || '',
                    certifications: (sc.certifications || []).join('\n'),
                    screeningTemplateId: sc.templateId || '',
                });
            } catch {
                if (!cancelled) {
                    toast.error('Failed to load job for editing');
                    navigate('/recruitment');
                }
            } finally {
                if (!cancelled) setLoadingJob(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isEdit, editId, navigate]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const applyWorkforceRequirement = (key) => {
        setSelectedWorkforceKey(key);
        if (!key) {
            setForm((prev) => ({
                ...prev,
                workforcePlanId: '',
                workforceHiringIndex: '',
            }));
            return;
        }
        const req = workforceRequirements.find(
            (r) => `${r.planId}:${r.hiringIndex}` === key
        );
        if (!req) return;

        const titlePick = pickSelect(req.jobTitle, options.jobTitles);
        const deptPick = pickSelect(req.department, options.departments);
        setSelects((prev) => ({
            ...prev,
            jobTitle: titlePick.select,
            department: deptPick.select,
        }));
        setCustoms((prev) => ({
            ...prev,
            jobTitle: titlePick.custom,
            department: deptPick.custom,
        }));
        setOptions((prev) => ({
            ...prev,
            departments: [...new Set([...prev.departments, req.department].filter(Boolean))].sort(),
            jobTitles: [...new Set([...prev.jobTitles, req.jobTitle].filter(Boolean))],
        }));
        setForm((prev) => ({
            ...prev,
            numberOfPositions: Math.max(req.remainingHiringNeed || req.hiringRequired || 1, 1),
            priority: req.priority || prev.priority,
            jobDescription:
                prev.jobDescription ||
                `Workforce planning requirement from plan "${req.planName}".` +
                    (req.reason ? ` Reason: ${req.reason}.` : '') +
                    ` Required headcount: ${req.requiredHeadcount}. Current: ${req.currentHeadcount}. Remaining to hire: ${req.remainingHiringNeed}.`,
            workforcePlanId: req.planId,
            workforceHiringIndex: req.hiringIndex,
        }));
    };

    const resolved = (key) => (
        selects[key] === OTHER ? String(customs[key] || '').trim() : selects[key]
    );

    const setSelect = (key, value) => {
        setSelects((prev) => ({ ...prev, [key]: value }));
        if (value !== OTHER) {
            setCustoms((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const handleSubmit = async (e, targetStatus) => {
        e.preventDefault();
        const jobTitle = resolved('jobTitle');
        const department = resolved('department');
        const position = resolved('position');
        const location = resolved('location');

        if (!jobTitle || !department || !position || !form.jobDescription || !location) {
            toast.error('Please fill all required fields');
            return;
        }
        const saveStatus = targetStatus ?? form.status;
        try {
            setSaving(true);
            const payload = {
                jobTitle,
                department,
                position,
                jobDescription: form.jobDescription.trim(),
                location,
                employmentType: form.employmentType,
                status: saveStatus,
                priority: form.priority,
                numberOfPositions: Number(form.numberOfPositions) || 1,
                internalVisible: !!form.internalVisible,
                externalVisible: form.externalVisible !== false,
                notifyEmployeesOnOpen: form.notifyEmployeesOnOpen !== false,
                requirements: form.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
                responsibilities: form.responsibilities.split('\n').map((s) => s.trim()).filter(Boolean),
                salaryRange: {
                    min: form.salaryMin !== '' && form.salaryMin != null ? Number(form.salaryMin) : undefined,
                    max: form.salaryMax !== '' && form.salaryMax != null ? Number(form.salaryMax) : undefined,
                    currency: form.currency || 'INR',
                },
                closingDate: form.closingDate || undefined,
                ...(form.workforcePlanId
                    ? {
                        workforcePlanId: form.workforcePlanId,
                        workforceHiringIndex: form.workforceHiringIndex,
                    }
                    : {}),
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
            const { data } = isEdit
                ? await axios.put(`/v1/admin/recruitment/jobs/${editId}`, payload, { withCredentials: true })
                : await axios.post('/v1/admin/recruitment/jobs', payload, { withCredentials: true });
            if (!data.success) {
                toast.error(data.message || (isEdit ? 'Failed to update job' : 'Failed to create job'));
                return;
            }
            toast.success(
                isEdit
                    ? toastForSave('Job posting', saveStatus, 'job')
                    : toastForSave('Job posting', saveStatus, 'job')
            );
            navigate(`/recruitment/jobs/${data.data._id || editId}`);
        } catch (err) {
            toast.error(err.response?.data?.message || (isEdit ? 'Failed to update job' : 'Failed to create job'));
        } finally {
            setSaving(false);
        }
    };

    if (loadingJob) {
        return <LoadingSpinner message="Loading job…" />;
    }

    return (
        <AtsPage narrow>
            <button
                type="button"
                onClick={() => navigate(isEdit ? `/recruitment/jobs/${editId}` : '/recruitment')}
                className="ats-back"
            >
                <FaArrowLeft className="h-3 w-3" /> {isEdit ? 'Back to Job' : 'Back to Recruitment'}
            </button>

            <AtsPageHeader
                eyebrow="Recruitment"
                title={isEdit ? 'Edit Job Posting' : 'Post New Job'}
                subtitle={isEdit
                    ? 'Update job details, visibility, and screening criteria'
                    : 'Create a job posting for the ATS and career portal'}
            />

            <form onSubmit={(e) => e.preventDefault()} className="cm-card space-y-5">
                {!isEdit && workforceRequirements.length > 0 && (
                    <label className="block text-sm">
                        <span className="ats-form-label">From Workforce Planning (optional)</span>
                        <select
                            className={selectClass}
                            value={selectedWorkforceKey}
                            onChange={(e) => applyWorkforceRequirement(e.target.value)}
                        >
                            <option value="">Create job without linking a plan</option>
                            {workforceRequirements.map((r) => (
                                <option key={`${r.planId}:${r.hiringIndex}`} value={`${r.planId}:${r.hiringIndex}`}>
                                    {r.department} · {r.jobTitle} — need {r.remainingHiringNeed} (current {r.currentHeadcount}/{r.requiredHeadcount}) · {r.planName}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500">
                            Prefills department, role, and remaining hiring need from Workforce Planning. Does not duplicate headcount.
                        </p>
                    </label>
                )}
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
                        <span className="ats-form-label">Employment Type</span>
                        <select className={selectClass} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                            {['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Status</span>
                        <select className={selectClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                            {['Draft', 'Open', 'On Hold', 'Closed', 'Cancelled'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        {getStatusHint(form.status, 'job') && (
                            <p className="mt-1.5 text-xs text-amber-700">{getStatusHint(form.status, 'job')}</p>
                        )}
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Priority</span>
                        <select className={selectClass} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                            {['Low', 'Medium', 'High', 'Critical'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Number of Positions</span>
                        <input type="number" min="1" className={inputClass} value={form.numberOfPositions} onChange={(e) => set('numberOfPositions', e.target.value)} />
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Salary Min</span>
                        <input type="number" className={inputClass} value={form.salaryMin} onChange={(e) => set('salaryMin', e.target.value)} />
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Salary Max</span>
                        <input type="number" className={inputClass} value={form.salaryMax} onChange={(e) => set('salaryMax', e.target.value)} />
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Currency</span>
                        <select className={selectClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Closing Date</span>
                        <input type="date" className={inputClass} value={form.closingDate} onChange={(e) => set('closingDate', e.target.value)} />
                    </label>
                </div>

                <label className="block text-sm">
                    <span className="ats-form-label">Job Description *</span>
                    <textarea rows={5} className={inputClass} value={form.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} required />
                </label>
                <label className="block text-sm">
                    <span className="ats-form-label">Requirements (one per line)</span>
                    <textarea rows={3} className={inputClass} value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
                </label>
                <label className="block text-sm">
                    <span className="ats-form-label">Responsibilities (one per line)</span>
                    <textarea rows={3} className={inputClass} value={form.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} />
                </label>

                <div className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(28,202,155,0.06)' }}>
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>Screening Criteria</h2>
                        <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--ats-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={form.screeningEnabled}
                                onChange={(e) => set('screeningEnabled', e.target.checked)}
                            />
                            Enable auto-screening
                        </label>
                    </div>
                
                    <label className="block text-sm">
                        <span className="ats-form-label">Resume Screening Template</span>
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
                            <span className="ats-form-label">Required Skills / Keywords (one per line)</span>
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
                            <span className="ats-form-label">Optional Skills / Keywords (one per line)</span>
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
                            <span className="ats-form-label">Minimum Match %</span>
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
                            <span className="ats-form-label">Experience Required</span>
                            <input
                                className={inputClass}
                                value={form.experienceRequired}
                                onChange={(e) => set('experienceRequired', e.target.value)}
                                placeholder="e.g. 3 years"
                                disabled={!form.screeningEnabled}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="ats-form-label">Education (optional)</span>
                            <input
                                className={inputClass}
                                value={form.education}
                                onChange={(e) => set('education', e.target.value)}
                                placeholder="e.g. B.Tech / Bachelor"
                                disabled={!form.screeningEnabled}
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="ats-form-label">Certifications (one per line)</span>
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

                <div className="flex flex-wrap justify-end gap-3 border-t border-[rgba(15,45,38,0.08)] pt-4">
                    <CmButton
                        type="button"
                        variant="outline"
                        onClick={() => navigate(isEdit ? `/recruitment/jobs/${editId}` : '/recruitment')}
                    >
                        Cancel
                    </CmButton>
                    {isEdit ? (
                        <CmButton type="button" disabled={saving} onClick={(e) => handleSubmit(e)}>
                            {saving ? 'Saving…' : 'Save Changes'}
                        </CmButton>
                    ) : (
                        <>
                            <CmButton type="button" variant="outline" disabled={saving} onClick={(e) => handleSubmit(e, 'Draft')}>
                                {saving ? 'Saving…' : 'Save as Draft'}
                            </CmButton>
                            <CmButton type="button" disabled={saving} onClick={(e) => handleSubmit(e, 'Open')}>
                                {saving ? 'Saving…' : 'Publish Job'}
                            </CmButton>
                        </>
                    )}
                </div>
            </form>
        </AtsPage>
    );
};

export default CreateJobPage;
