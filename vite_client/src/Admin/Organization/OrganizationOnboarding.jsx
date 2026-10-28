import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import {
    ORGANIZATION_ENDPOINT, ORGANIZATION_AUTH_ENDPOINT,
} from '../../utils/constant';
import logger from '../../utils/logger';
import {
    ORG_ONBOARDING_STEPS, INDUSTRIES, COMPANY_SIZES,
} from '../../constants/onboardingConstants';
import {
    FiCheckCircle, FiUpload, FiMail, FiSettings, FiUsers,
    FiArrowRight, FiX, FiImage, FiGlobe, FiClock, FiDollarSign,
    FiMapPin, FiCalendar, FiShield, FiFileText, FiPlus, FiTrash2,
} from 'react-icons/fi';
import { FaBuilding, FaCheck } from 'react-icons/fa';

const WEEKDAYS = [
    { v: 0, l: 'Sun' }, { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' },
    { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' },
];

const OrganizationOnboarding = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [organization, setOrganization] = useState(null);
    const [onboarding, setOnboarding] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [review, setReview] = useState(null);

    const [form, setForm] = useState({
        name: '', legalName: '', industry: 'IT', companySize: 'small',
        website: '', phone: '', gstNumber: '', panNumber: '',
        businessRegistrationNumber: '', taxId: '',
        address: { street: '', city: '', state: '', country: '', zipCode: '' },
        logo: null,
        branding: { primaryColor: '#0e9370', secondaryColor: '#476175', accentColor: '#f59e0b' },
        emailBranding: { headerColor: '#16a34a', footerText: '' },
        officeLocations: [{ name: 'Head Office', type: 'head', isPrimary: true, address: {}, phone: '' }],
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: '09:00', end: '17:00' },
        breakPolicy: { durationMinutes: 60, paidBreak: true },
        timezone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h', language: 'en', financialYearStart: 4,
        orgDepartments: [], orgDesignations: [], employmentTypes: [],
        holidays: [{ name: '', date: '' }],
        invitedUsers: [{ email: '', role: 'hr' }],
        importSkipped: false,
    });

    const step = ORG_ONBOARDING_STEPS[currentStep];

    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`${ORGANIZATION_ENDPOINT}/onboarding/status`);
            if (res.data?.success) {
                const org = res.data.organization || {};
                setOrganization(org);
                setOnboarding(res.data.onboarding);
                setForm((prev) => ({
                    ...prev,
                    name: org.name || prev.name,
                    legalName: org.legalName || prev.legalName,
                    industry: org.industry || prev.industry,
                    companySize: org.companySize || prev.companySize,
                    website: org.website || prev.website,
                    phone: org.phone || prev.phone,
                    gstNumber: org.gstNumber || prev.gstNumber,
                    panNumber: org.panNumber || prev.panNumber,
                    businessRegistrationNumber: org.businessRegistrationNumber || prev.businessRegistrationNumber,
                    taxId: org.taxId || prev.taxId,
                    address: org.address || prev.address,
                    logo: org.logo?.url || prev.logo,
                    branding: org.branding || prev.branding,
                    emailBranding: org.emailBranding || prev.emailBranding,
                    officeLocations: org.officeLocations?.length ? org.officeLocations : prev.officeLocations,
                    workingDays: org.workingDays || prev.workingDays,
                    workingHours: org.workingHours || prev.workingHours,
                    breakPolicy: org.breakPolicy || prev.breakPolicy,
                    timezone: org.timezone || prev.timezone,
                    currency: org.currency || prev.currency,
                    dateFormat: org.dateFormat || prev.dateFormat,
                    timeFormat: org.timeFormat || prev.timeFormat,
                    language: org.language || prev.language,
                    financialYearStart: org.financialYearStart || prev.financialYearStart,
                    orgDepartments: org.orgDepartments || prev.orgDepartments,
                    orgDesignations: org.orgDesignations || prev.orgDesignations,
                    employmentTypes: org.employmentTypes || prev.employmentTypes,
                }));
                if (res.data.onboarding?.status === 'completed') {
                    setCurrentStep(ORG_ONBOARDING_STEPS.length - 1);
                } else if (res.data.onboarding?.currentStep) {
                    const idx = ORG_ONBOARDING_STEPS.findIndex((s) => s.id === res.data.onboarding.currentStep);
                    if (idx >= 0) setCurrentStep(idx);
                }
            }
        } catch (err) {
            logger.error('Failed to fetch org onboarding', { error: err.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveStep = async (stepId, data = {}, skip = false) => {
        try {
            setSaving(true);
            await axios.put(`${ORGANIZATION_ENDPOINT}/onboarding/step`, {
                step: stepId, data, skip, markComplete: !skip,
            });
            await fetchData();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save step');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        const stepId = step.id;
        let ok = true;

        if (stepId === 'company-info') {
            ok = await saveStep(stepId, {
                name: form.name, legalName: form.legalName, industry: form.industry,
                companySize: form.companySize, website: form.website, phone: form.phone,
                gstNumber: form.gstNumber, panNumber: form.panNumber,
                businessRegistrationNumber: form.businessRegistrationNumber, taxId: form.taxId,
                address: form.address,
            });
        } else if (stepId === 'branding') {
            ok = await saveStep(stepId, { branding: form.branding, emailBranding: form.emailBranding });
        } else if (stepId === 'office-locations') {
            ok = await saveStep(stepId, { officeLocations: form.officeLocations });
        } else if (stepId === 'working-hours') {
            ok = await saveStep(stepId, {
                workingDays: form.workingDays, workingHours: form.workingHours, breakPolicy: form.breakPolicy,
            });
        } else if (stepId === 'timezone-currency') {
            ok = await saveStep(stepId, {
                timezone: form.timezone, currency: form.currency, dateFormat: form.dateFormat,
                timeFormat: form.timeFormat, language: form.language, financialYearStart: form.financialYearStart,
            });
        } else if (stepId === 'departments') {
            ok = await saveStep(stepId, {
                orgDepartments: form.orgDepartments, orgDesignations: form.orgDesignations,
                employmentTypes: form.employmentTypes, useDefaults: !form.orgDepartments.length,
            });
        } else if (stepId === 'holidays') {
            const year = new Date().getFullYear();
            for (const h of form.holidays.filter((x) => x.name && x.date)) {
                try {
                    await axios.post(`/v1/admin/calendar/${year}/holidays`, h);
                } catch { /* may already exist */ }
            }
            ok = await saveStep(stepId, {});
        } else if (stepId === 'leave-policy') {
            ok = await saveStep(stepId, {});
        } else if (stepId === 'attendance-policy') {
            ok = await saveStep(stepId, {});
        } else if (stepId === 'invite-users') {
            ok = await saveStep(stepId, { invitedUsers: form.invitedUsers.filter((u) => u.email) });
        } else if (stepId === 'import-employees') {
            ok = await saveStep(stepId, { importSkipped: form.importSkipped });
        } else if (stepId === 'review') {
            try {
                const res = await axios.get(`${ORGANIZATION_ENDPOINT}/onboarding/review`);
                setReview(res.data?.data || res.data);
            } catch { /* ignore */ }
        } else if (['welcome', 'email', 'logo'].includes(stepId)) {
            ok = await saveStep(stepId, {});
        }

        if (ok && currentStep < ORG_ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
            if (ORG_ONBOARDING_STEPS[currentStep + 1]?.id === 'review') {
                try {
                    const res = await axios.get(`${ORGANIZATION_ENDPOINT}/onboarding/review`);
                    setReview(res.data?.data || res.data);
                } catch { /* ignore */ }
            }
        }
    };

    const handleSkip = async () => {
        await saveStep(step.id, {}, true);
        if (currentStep < ORG_ONBOARDING_STEPS.length - 1) setCurrentStep(currentStep + 1);
        else navigate('/onboarding?enterprise=1');
    };

    const handleComplete = async () => {
        try {
            setSaving(true);
            await axios.post(`${ORGANIZATION_ENDPOINT}/onboarding/complete`);
            toast.success('Organization setup complete! Opening Lifecycle Enterprise.');
            navigate('/onboarding?enterprise=1');
        } catch {
            toast.error('Failed to complete onboarding');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error('Please upload an image');
        if (file.size > 5 * 1024 * 1024) return toast.error('Max 5MB');
        try {
            setUploading(true);
            const fd = new FormData();
            fd.append('logo', file);
            const res = await axios.post(`${ORGANIZATION_ENDPOINT}/logo`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.success || res.data?.logo) {
                setForm((p) => ({ ...p, logo: res.data.logo?.url || res.data.logo }));
                toast.success('Logo uploaded');
            }
        } catch {
            toast.error('Logo upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleResendVerification = async () => {
        try {
            await axios.post(`${ORGANIZATION_AUTH_ENDPOINT}/resend-verification`);
            toast.success('Verification email sent');
        } catch {
            toast.error('Failed to send verification email');
        }
    };

    const toggleWorkingDay = (day) => {
        setForm((p) => ({
            ...p,
            workingDays: p.workingDays.includes(day)
                ? p.workingDays.filter((d) => d !== day)
                : [...p.workingDays, day].sort(),
        }));
    };

    const addDepartment = () => setForm((p) => ({
        ...p, orgDepartments: [...p.orgDepartments, { name: '', code: '', description: '' }],
    }));
    const addDesignation = () => setForm((p) => ({
        ...p, orgDesignations: [...p.orgDesignations, { title: '', department: '', level: '' }],
    }));
    const addLocation = () => setForm((p) => ({
        ...p, officeLocations: [...p.officeLocations, { name: '', type: 'branch', isPrimary: false, address: {}, phone: '' }],
    }));
    const addHoliday = () => setForm((p) => ({ ...p, holidays: [...p.holidays, { name: '', date: '' }] }));
    const addInvite = () => setForm((p) => ({ ...p, invitedUsers: [...p.invitedUsers, { email: '', role: 'hr' }] }));

    if (loading && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary" />
            </div>
        );
    }

    const renderContent = () => {
        switch (step.id) {
            case 'welcome':
                return (
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-24 h-24 bg-theme-primary/10 rounded-full flex items-center justify-center">
                            <FaBuilding className="w-12 h-12 text-theme-primary" />
                        </div>
                        <h3 className="text-2xl font-bold">Welcome to {organization?.name || 'Your Organization'}!</h3>
                        <p className="text-gray-600 max-w-lg mx-auto">
                            This guided setup will configure your HRMS — company profile, policies, locations,
                            departments, and user access — so your team can start using the platform.
                        </p>
                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-sm text-gray-600">
                            {['Company profile & branding', 'Office locations', 'Leave & attendance policies', 'Departments & designations', 'User invitations', 'Employee import'].map((t) => (
                                <div key={t} className="flex items-center gap-2">
                                    <FiCheckCircle className="text-theme-primary shrink-0" /> {t}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'email':
                return (
                    <div className="text-center space-y-6 max-w-lg mx-auto">
                        <FiMail className="w-16 h-16 text-yellow-600 mx-auto" />
                        <h3 className="text-2xl font-bold">Verify Your Email</h3>
                        <p className="text-gray-600">We sent a verification link to <strong>{organization?.email}</strong></p>
                        {organization?.emailVerified ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-700 flex items-center justify-center gap-2">
                                <FiCheckCircle /> Email verified successfully
                            </div>
                        ) : (
                            <button onClick={handleResendVerification} className="px-6 py-2 bg-theme-primary text-white rounded-lg">
                                Resend Verification Email
                            </button>
                        )}
                    </div>
                );

            case 'company-info':
                return (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold text-center mb-4">Company Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Company Name *</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Legal Name</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.legalName}
                                    onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Industry</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Company Size</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={form.companySize}
                                    onChange={(e) => setForm({ ...form, companySize: e.target.value })}>
                                    {COMPANY_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Website</label>
                                <input type="url" className="w-full p-2 border rounded-lg mt-1" value={form.website}
                                    onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Phone</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Registration Number</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.businessRegistrationNumber}
                                    onChange={(e) => setForm({ ...form, businessRegistrationNumber: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">GST Number</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.gstNumber}
                                    onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">PAN</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.panNumber}
                                    onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Tax ID</label>
                                <input className="w-full p-2 border rounded-lg mt-1" value={form.taxId}
                                    onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                            </div>
                        </div>
                    </div>
                );

            case 'logo':
                return (
                    <div className="text-center space-y-6">
                        <h3 className="text-xl font-bold">Company Logo</h3>
                        {form.logo ? (
                            <img src={form.logo} alt="Logo" className="w-40 h-40 object-contain mx-auto border rounded-lg" />
                        ) : (
                            <div className="w-40 h-40 border-2 border-dashed rounded-lg mx-auto flex items-center justify-center">
                                <FiUpload className="w-10 h-10 text-gray-400" />
                            </div>
                        )}
                        <label className="cursor-pointer inline-block px-6 py-2 bg-theme-primary text-white rounded-lg">
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                            {uploading ? 'Uploading...' : form.logo ? 'Change Logo' : 'Upload Logo'}
                        </label>
                    </div>
                );

            case 'branding':
                return (
                    <div className="space-y-4 max-w-xl mx-auto">
                        <h3 className="text-xl font-bold text-center">Branding & Theme</h3>
                        {['primaryColor', 'secondaryColor', 'accentColor'].map((key) => (
                            <div key={key} className="flex items-center gap-4">
                                <label className="text-sm font-medium w-32 capitalize">{key.replace('Color', ' Color')}</label>
                                <input type="color" value={form.branding[key]}
                                    onChange={(e) => setForm({ ...form, branding: { ...form.branding, [key]: e.target.value } })}
                                    className="w-12 h-10 rounded cursor-pointer" />
                                <span className="text-sm text-gray-500">{form.branding[key]}</span>
                            </div>
                        ))}
                        <div>
                            <label className="text-sm font-medium">Email Footer Text</label>
                            <textarea className="w-full p-2 border rounded-lg mt-1" rows={2}
                                value={form.emailBranding.footerText || ''}
                                onChange={(e) => setForm({ ...form, emailBranding: { ...form.emailBranding, footerText: e.target.value } })}
                                placeholder="© Your Company. All rights reserved." />
                        </div>
                    </div>
                );

            case 'office-locations':
                return (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Office Locations</h3>
                            <button onClick={addLocation} className="flex items-center gap-1 text-sm text-theme-primary"><FiPlus /> Add</button>
                        </div>
                        {form.officeLocations.map((loc, i) => (
                            <div key={i} className="border rounded-lg p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <input placeholder="Location name" className="p-2 border rounded-lg"
                                        value={loc.name} onChange={(e) => {
                                            const u = [...form.officeLocations]; u[i] = { ...u[i], name: e.target.value }; setForm({ ...form, officeLocations: u });
                                        }} />
                                    <select className="p-2 border rounded-lg" value={loc.type}
                                        onChange={(e) => { const u = [...form.officeLocations]; u[i] = { ...u[i], type: e.target.value }; setForm({ ...form, officeLocations: u }); }}>
                                        <option value="head">Head Office</option>
                                        <option value="branch">Branch</option>
                                    </select>
                                </div>
                                <input placeholder="City" className="w-full p-2 border rounded-lg"
                                    value={loc.address?.city || ''} onChange={(e) => {
                                        const u = [...form.officeLocations]; u[i] = { ...u[i], address: { ...u[i].address, city: e.target.value } }; setForm({ ...form, officeLocations: u });
                                    }} />
                            </div>
                        ))}
                    </div>
                );

            case 'working-hours':
                return (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <h3 className="text-xl font-bold text-center">Working Hours & Days</h3>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Working Days</label>
                            <div className="flex gap-2 flex-wrap">
                                {WEEKDAYS.map((d) => (
                                    <button key={d.v} type="button" onClick={() => toggleWorkingDay(d.v)}
                                        className={`px-3 py-1 rounded-full text-sm ${form.workingDays.includes(d.v) ? 'bg-theme-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                                        {d.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Start Time</label>
                                <input type="time" className="w-full p-2 border rounded-lg mt-1" value={form.workingHours.start}
                                    onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, start: e.target.value } })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">End Time</label>
                                <input type="time" className="w-full p-2 border rounded-lg mt-1" value={form.workingHours.end}
                                    onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, end: e.target.value } })} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Break Duration (minutes)</label>
                            <input type="number" className="w-full p-2 border rounded-lg mt-1" value={form.breakPolicy.durationMinutes}
                                onChange={(e) => setForm({ ...form, breakPolicy: { ...form.breakPolicy, durationMinutes: parseInt(e.target.value) || 60 } })} />
                        </div>
                    </div>
                );

            case 'timezone-currency':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold col-span-full text-center">Regional Settings</h3>
                        {[
                            { label: 'Timezone', key: 'timezone', type: 'select', options: ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Dubai', 'Asia/Tokyo'] },
                            { label: 'Currency', key: 'currency', type: 'select', options: ['INR', 'USD', 'EUR', 'GBP', 'AED'] },
                            { label: 'Date Format', key: 'dateFormat', type: 'select', options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
                            { label: 'Time Format', key: 'timeFormat', type: 'select', options: ['12h', '24h'] },
                            { label: 'Language', key: 'language', type: 'select', options: ['en', 'hi'] },
                            { label: 'Financial Year Start (Month)', key: 'financialYearStart', type: 'number' },
                        ].map(({ label, key, type, options }) => (
                            <div key={key}>
                                <label className="text-sm font-medium">{label}</label>
                                {type === 'select' ? (
                                    <select className="w-full p-2 border rounded-lg mt-1" value={form[key]}
                                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input type="number" min={1} max={12} className="w-full p-2 border rounded-lg mt-1" value={form[key]}
                                        onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) })} />
                                )}
                            </div>
                        ))}
                    </div>
                );

            case 'departments':
                return (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Departments</h4>
                                <button onClick={addDepartment} className="text-sm text-theme-primary flex items-center gap-1"><FiPlus /> Add</button>
                            </div>
                            {form.orgDepartments.length === 0 && (
                                <p className="text-sm text-gray-500 mb-2">No departments yet — defaults will be applied on save.</p>
                            )}
                            {form.orgDepartments.map((d, i) => (
                                <div key={i} className="flex gap-2 mb-2">
                                    <input placeholder="Department name" className="flex-1 p-2 border rounded-lg" value={d.name}
                                        onChange={(e) => { const u = [...form.orgDepartments]; u[i] = { ...u[i], name: e.target.value }; setForm({ ...form, orgDepartments: u }); }} />
                                    <button onClick={() => setForm({ ...form, orgDepartments: form.orgDepartments.filter((_, j) => j !== i) })}><FiTrash2 className="text-red-500" /></button>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Designations</h4>
                                <button onClick={addDesignation} className="text-sm text-theme-primary flex items-center gap-1"><FiPlus /> Add</button>
                            </div>
                            {form.orgDesignations.map((d, i) => (
                                <div key={i} className="flex gap-2 mb-2">
                                    <input placeholder="Designation title" className="flex-1 p-2 border rounded-lg" value={d.title}
                                        onChange={(e) => { const u = [...form.orgDesignations]; u[i] = { ...u[i], title: e.target.value }; setForm({ ...form, orgDesignations: u }); }} />
                                    <button onClick={() => setForm({ ...form, orgDesignations: form.orgDesignations.filter((_, j) => j !== i) })}><FiTrash2 className="text-red-500" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'holidays':
                return (
                    <div className="space-y-4 max-w-xl mx-auto">
                        <h3 className="text-xl font-bold text-center">Holiday Calendar</h3>
                        <p className="text-sm text-gray-500 text-center">Add key holidays for {new Date().getFullYear()}. You can manage the full calendar later.</p>
                        {form.holidays.map((h, i) => (
                            <div key={i} className="flex gap-2">
                                <input placeholder="Holiday name" className="flex-1 p-2 border rounded-lg" value={h.name}
                                    onChange={(e) => { const u = [...form.holidays]; u[i] = { ...u[i], name: e.target.value }; setForm({ ...form, holidays: u }); }} />
                                <input type="date" className="p-2 border rounded-lg" value={h.date}
                                    onChange={(e) => { const u = [...form.holidays]; u[i] = { ...u[i], date: e.target.value }; setForm({ ...form, holidays: u }); }} />
                            </div>
                        ))}
                        <button onClick={addHoliday} className="text-sm text-theme-primary flex items-center gap-1"><FiPlus /> Add Holiday</button>
                    </div>
                );

            case 'leave-policy':
                return (
                    <div className="text-center space-y-4 max-w-lg mx-auto">
                        <FiCalendar className="w-12 h-12 text-theme-primary mx-auto" />
                        <h3 className="text-xl font-bold">Leave Policies</h3>
                        <p className="text-gray-600 text-sm">Configure leave policies from HR Settings after setup, or skip and use defaults.</p>
                        <button onClick={() => window.open('/admin/leave-policy', '_blank')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                            Open Leave Policy Manager
                        </button>
                    </div>
                );

            case 'attendance-policy':
                return (
                    <div className="text-center space-y-4 max-w-lg mx-auto">
                        <FiShield className="w-12 h-12 text-theme-primary mx-auto" />
                        <h3 className="text-xl font-bold">Attendance Rules</h3>
                        <p className="text-gray-600 text-sm">Set up geofencing, shifts, and attendance rules after setup.</p>
                        <button onClick={() => window.open('/attendance-rules', '_blank')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                            Open Attendance Rules
                        </button>
                    </div>
                );

            case 'invite-users':
                return (
                    <div className="space-y-4 max-w-xl mx-auto">
                        <h3 className="text-xl font-bold text-center">Invite Team Members</h3>
                        {form.invitedUsers.map((u, i) => (
                            <div key={i} className="flex gap-2">
                                <input type="email" placeholder="Email address" className="flex-1 p-2 border rounded-lg" value={u.email}
                                    onChange={(e) => { const inv = [...form.invitedUsers]; inv[i] = { ...inv[i], email: e.target.value }; setForm({ ...form, invitedUsers: inv }); }} />
                                <select className="p-2 border rounded-lg" value={u.role}
                                    onChange={(e) => { const inv = [...form.invitedUsers]; inv[i] = { ...inv[i], role: e.target.value }; setForm({ ...form, invitedUsers: inv }); }}>
                                    <option value="hr">HR</option>
                                    <option value="manager">Manager</option>
                                    <option value="payroll">Payroll Admin</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        ))}
                        <button onClick={addInvite} className="text-sm text-theme-primary flex items-center gap-1"><FiPlus /> Add Another</button>
                    </div>
                );

            case 'import-employees':
                return (
                    <div className="text-center space-y-4 max-w-lg mx-auto">
                        <FiUsers className="w-12 h-12 text-theme-primary mx-auto" />
                        <h3 className="text-xl font-bold">Import Employees</h3>
                        <p className="text-gray-600 text-sm">Add employees individually or skip and import later from the Employees page.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => navigate('/add-employee')} className="px-6 py-2 bg-theme-primary text-white rounded-lg">
                                Add First Employee
                            </button>
                            <label className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                <input type="checkbox" checked={form.importSkipped}
                                    onChange={(e) => setForm({ ...form, importSkipped: e.target.checked })} />
                                Skip employee import for now
                            </label>
                        </div>
                    </div>
                );

            case 'review':
                return (
                    <div className="space-y-4 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold text-center">Review Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { title: 'Organization', items: [[ 'Name', review?.profile?.name || form.name ], [ 'Industry', review?.profile?.industry || form.industry ], [ 'Email', review?.profile?.email || organization?.email ]] },
                                { title: 'Settings', items: [[ 'Timezone', form.timezone ], [ 'Currency', form.currency ], [ 'Working Days', form.workingDays.length + ' days' ]] },
                                { title: 'Structure', items: [[ 'Departments', (review?.departments?.length || form.orgDepartments.length) + ' configured' ], [ 'Locations', (review?.locations?.length || form.officeLocations.length) + ' offices' ]] },
                                { title: 'Users', items: [[ 'Employees', review?.employeeCount ?? 0 ], [ 'Invited', (review?.invitedUsers?.length || form.invitedUsers.filter(u => u.email).length) ]] },
                            ].map((section) => (
                                <div key={section.title} className="border rounded-lg p-4">
                                    <h4 className="font-semibold mb-2">{section.title}</h4>
                                    {section.items.map(([k, v]) => (
                                        <div key={k} className="flex justify-between text-sm py-1">
                                            <span className="text-gray-500">{k}</span>
                                            <span className="font-medium">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'complete':
                return (
                    <div className="text-center space-y-6">
                        <FiCheckCircle className="w-20 h-20 text-theme-primary mx-auto" />
                        <h3 className="text-2xl font-bold">Organization Ready!</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            Your HRMS is configured. Start adding employees — each new hire will automatically receive an onboarding workflow.
                        </p>
                        <button onClick={handleComplete} disabled={saving}
                            className="px-8 py-3 bg-theme-primary text-white rounded-lg font-medium disabled:opacity-50">
                            {saving ? 'Finishing...' : 'Go to Dashboard'}
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    const progress = Math.round(((currentStep + 1) / ORG_ONBOARDING_STEPS.length) * 100);

    return (
        <div className="page-shell min-h-screen bg-gray-50">
            <div className="page-shell-inner hrms-stack py-6">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-theme-primary to-theme-secondary p-6 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <FaBuilding className="w-6 h-6" />
                            <h1 className="text-xl font-bold">Organization Setup</h1>
                        </div>
                        <p className="text-white/80 text-sm">Step {currentStep + 1} of {ORG_ONBOARDING_STEPS.length} — {step.title}</p>
                        <div className="mt-3 bg-white/20 rounded-full h-2">
                            <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    {/* Step pills — scrollable, not tabs */}
                    <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b bg-gray-50 text-xs">
                        {ORG_ONBOARDING_STEPS.map((s, i) => (
                            <button key={s.id} onClick={() => i <= currentStep && setCurrentStep(i)}
                                className={`shrink-0 px-2 py-1 rounded-full transition ${i === currentStep ? 'bg-theme-primary text-white' : i < currentStep ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                {i < currentStep ? '✓' : i + 1}. {s.title}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6 min-h-[420px]">{renderContent()}</div>

                    {/* Navigation */}
                    {step.id !== 'complete' && (
                        <div className="flex justify-between px-6 py-4 border-t bg-gray-50">
                            <button onClick={handleSkip} className="text-gray-500 hover:text-gray-700 text-sm">Skip for now</button>
                            <div className="flex gap-3">
                                {currentStep > 0 && (
                                    <button onClick={() => setCurrentStep(currentStep - 1)}
                                        className="px-4 py-2 border rounded-lg text-sm hover:bg-white">Previous</button>
                                )}
                                <button onClick={handleNext} disabled={saving}
                                    className="px-5 py-2 bg-theme-primary text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Next'} <FiArrowRight />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizationOnboarding;
