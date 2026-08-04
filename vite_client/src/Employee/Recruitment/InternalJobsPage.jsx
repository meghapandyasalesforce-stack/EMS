import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    FaBriefcase, FaUserPlus, FaFileAlt, FaMapMarkerAlt, FaBuilding, FaChevronRight,
    FaHandshake, FaCalendarAlt, FaPlus, FaPaperPlane, FaVideo,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    SelectWithOther,
    loadJobFormOptions,
    resolveSelectValue,
    OTHER_OPTION,
} from '../../components/recruitment/SelectWithOther';

const REQ_EMPTY = {
    jobDescription: '',
    employmentType: 'Full-time',
    numberOfPositions: 1,
    priority: 'Medium',
    justification: '',
};
const EMPTY_SELECTS = { title: '', department: '', position: '', location: '' };
const EMPTY_CUSTOMS = { title: '', department: '', position: '', location: '' };

const fieldClass =
    'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';

const statusTone = (status = '') => {
    const s = String(status).toLowerCase();
    if (['hired', 'accepted', 'approved', 'paid', 'completed'].includes(s)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (['rejected', 'withdrawn', 'declined', 'cancelled'].includes(s)) return 'bg-red-50 text-red-700 ring-red-200';
    if (['interview', 'screening', 'shortlisted', 'pending', 'scheduled', 'pendingapproval'].includes(s)) {
        return 'bg-amber-50 text-amber-800 ring-amber-200';
    }
    return 'bg-slate-100 text-slate-700 ring-slate-200';
};

const StatusBadge = ({ children }) => (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(children)}`}>
        {children || '—'}
    </span>
);

const EmptyState = ({ icon: Icon, title, hint }) => (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-theme-primary/10 text-theme-secondary">
            <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-semibold text-gray-900">{title}</p>
        {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{hint}</p>}
    </div>
);

const canUseHireRequests = (user, employee) => {
    const role = String(user?.role || employee?.role || '').toLowerCase();
    const roles = (employee?.functionalRoles || []).map((r) => String(r).toLowerCase());
    const position = String(employee?.position || '').toLowerCase();
    return (
        ['admin', 'hr', 'manager', 'executive', 'project_manager'].includes(role)
        || roles.some((r) => ['manager', 'hr', 'admin', 'executive'].includes(r))
        || position.includes('manager')
        || position.includes('director')
        || position.includes('lead')
    );
};

const InternalJobsPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((state) => state.auth?.user);
    const employee = useSelector((state) => state.employeeDetails?.employee || state.auth?.employee);
    const showHireTab = canUseHireRequests(user, employee);

    const initialTab = searchParams.get('tab') || 'jobs';
    const [tab, setTab] = useState(initialTab);
    const [jobs, setJobs] = useState([]);
    const [referrals, setReferrals] = useState([]);
    const [applications, setApplications] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [requisitions, setRequisitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [showHireForm, setShowHireForm] = useState(false);
    const [hireForm, setHireForm] = useState(REQ_EMPTY);
    const [selects, setSelects] = useState(EMPTY_SELECTS);
    const [customs, setCustoms] = useState(EMPTY_CUSTOMS);
    const [options, setOptions] = useState({ titles: [], departments: [], positions: [], locations: [] });

    const tabs = useMemo(() => {
        const base = [
            { id: 'jobs', label: 'Open jobs', icon: FaBriefcase },
            { id: 'interviews', label: 'My interviews', icon: FaCalendarAlt },
            { id: 'applications', label: 'My applications', icon: FaFileAlt },
            { id: 'referrals', label: 'Referrals', icon: FaUserPlus },
        ];
        if (showHireTab) {
            base.splice(1, 0, { id: 'hire', label: 'Request a hire', icon: FaHandshake });
        }
        return base;
    }, [showHireTab]);

    const changeTab = (id) => {
        setTab(id);
        setSearchParams(id === 'jobs' ? {} : { tab: id });
    };

    useEffect(() => {
        const t = searchParams.get('tab') || 'jobs';
        if (t === 'hire' && !showHireTab) {
            setTab('jobs');
            return;
        }
        setTab(t);
    }, [searchParams, showHireTab]);

    useEffect(() => {
        let cancelled = false;
        loadJobFormOptions(axios).then((opts) => {
            if (!cancelled) setOptions(opts);
        });
        return () => { cancelled = true; };
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            if (tab === 'jobs') {
                const { data } = await axios.get('/v1/both/recruitment/internal-jobs', { withCredentials: true });
                setJobs(data.data || []);
            } else if (tab === 'referrals') {
                const { data } = await axios.get('/v1/both/recruitment/my-referrals', { withCredentials: true });
                setReferrals(data.data || []);
            } else if (tab === 'applications') {
                const { data } = await axios.get('/v1/both/recruitment/my-applications', { withCredentials: true });
                setApplications(data.data || []);
            } else if (tab === 'interviews') {
                const { data } = await axios.get('/v1/both/recruitment/my-interviews', { withCredentials: true });
                setInterviews(data.data || []);
            } else if (tab === 'hire') {
                const { data } = await axios.get('/v1/both/recruitment/requisitions', { withCredentials: true });
                setRequisitions(data.data || []);
            }
        } catch {
            toast.error('Failed to load');
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => { load(); }, [load]);

    const setSelect = (key, value) => {
        setSelects((prev) => ({ ...prev, [key]: value }));
        if (value !== OTHER_OPTION) setCustoms((prev) => ({ ...prev, [key]: '' }));
    };

    const createHireRequest = async (e) => {
        e.preventDefault();
        const title = resolveSelectValue(selects.title, customs.title);
        const department = resolveSelectValue(selects.department, customs.department);
        const position = resolveSelectValue(selects.position, customs.position);
        const location = resolveSelectValue(selects.location, customs.location);
        if (!title || !department || !position || !location || !hireForm.jobDescription.trim()) {
            toast.error('Please fill all required fields');
            return;
        }
        try {
            setBusy(true);
            await axios.post('/v1/both/recruitment/requisitions', {
                ...hireForm,
                title,
                department,
                position,
                location,
            }, { withCredentials: true });
            toast.success('Hiring request saved as draft');
            setShowHireForm(false);
            setHireForm(REQ_EMPTY);
            setSelects(EMPTY_SELECTS);
            setCustoms(EMPTY_CUSTOMS);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Create failed');
        } finally {
            setBusy(false);
        }
    };

    const submitHire = async (id) => {
        try {
            setBusy(true);
            await axios.post(`/v1/both/recruitment/requisitions/${id}/submit`, {}, { withCredentials: true });
            toast.success('Submitted to HR');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submit failed');
        } finally {
            setBusy(false);
        }
    };

    const pendingInterviews = interviews.filter((i) => i.status === 'Scheduled').length;

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="mx-auto max-w-4xl">
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-theme-secondary">Hiring</p>
                        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Hiring hub</h1>
                        <p className="mt-1 text-sm text-gray-600 sm:text-base">
                            Internal openings, hire requests, and interviews assigned to you — in one place.
                        </p>
                    </div>

                    <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
                        {tabs.map((t) => {
                            const Icon = t.icon;
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => changeTab(t.id)}
                                    className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                        active
                                            ? 'bg-white text-theme-primary shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    <span className="truncate">{t.label}</span>
                                    {t.id === 'interviews' && pendingInterviews > 0 && (
                                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                            {pendingInterviews}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner message="Loading…" />
                ) : tab === 'jobs' ? (
                    <div className="space-y-3">
                        {jobs.length === 0 && (
                            <EmptyState icon={FaBriefcase} title="No internal openings right now" hint="When HR posts an internal role, it will show up here." />
                        )}
                        {jobs.map((job) => (
                            <button
                                key={job._id}
                                type="button"
                                onClick={() => navigate(`/employee/internal-jobs/${job._id}`)}
                                className="group flex w-full items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-theme-secondary/40 hover:shadow-md sm:items-center sm:p-5"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-theme-secondary">
                                    <FaBriefcase className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-base font-semibold text-gray-900 group-hover:text-theme-primary">{job.jobTitle}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 sm:text-sm">
                                        <span className="inline-flex items-center gap-1"><FaBuilding className="h-3 w-3" />{job.department}</span>
                                        <span className="inline-flex items-center gap-1"><FaMapMarkerAlt className="h-3 w-3" />{job.location}</span>
                                        <span>{job.employmentType}</span>
                                    </div>
                                </div>
                                <span className="hidden items-center gap-1 text-sm font-medium text-theme-secondary sm:inline-flex">
                                    View <FaChevronRight className="h-3 w-3" />
                                </span>
                            </button>
                        ))}
                    </div>
                ) : tab === 'interviews' ? (
                    interviews.length === 0 ? (
                        <EmptyState
                            icon={FaCalendarAlt}
                            title="No interviews assigned to you"
                            hint="When HR schedules you as interviewer, it will appear here with full details."
                        />
                    ) : (
                        <div className="space-y-3">
                            {interviews.map((iv) => (
                                <div key={`${iv.candidate?.id}-${iv.interviewId}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold text-gray-900">{iv.candidate?.name}</p>
                                            <p className="text-sm text-gray-600">{iv.job?.jobTitle || 'Role'} · {iv.interviewType}</p>
                                            <p className="mt-1 text-sm text-gray-500">
                                                {iv.scheduledDate ? new Date(iv.scheduledDate).toLocaleDateString() : 'Date TBD'}
                                                {iv.scheduledTime ? ` · ${iv.scheduledTime}` : ''}
                                                {iv.location ? ` · ${iv.location}` : ''}
                                            </p>
                                            {iv.candidate?.email && (
                                                <p className="mt-1 text-xs text-gray-500">{iv.candidate.email}</p>
                                            )}
                                        </div>
                                        <StatusBadge>{iv.status}</StatusBadge>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {iv.meetingLink && (
                                            <a
                                                href={iv.meetingLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-theme-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-theme-primary"
                                            >
                                                <FaVideo /> Join meeting
                                            </a>
                                        )}
                                    </div>
                                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                        You are assigned to take this interview. Date, time, location and meeting link are above.
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                ) : tab === 'applications' ? (
                    applications.length === 0 ? (
                        <EmptyState icon={FaFileAlt} title="No applications yet" hint="Open a role and apply — your status will appear here." />
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="px-4 py-3">Job</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Applied</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {applications.map((a) => (
                                        <tr key={a._id}>
                                            <td className="px-4 py-3.5 font-medium text-gray-900">{a.jobPostingId?.jobTitle || '—'}</td>
                                            <td className="px-4 py-3.5"><StatusBadge>{a.status}</StatusBadge></td>
                                            <td className="px-4 py-3.5 text-gray-600">
                                                {a.applicationDate ? new Date(a.applicationDate).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : tab === 'referrals' ? (
                    referrals.length === 0 ? (
                        <EmptyState icon={FaUserPlus} title="No referrals yet" hint="Open a job and refer a colleague to track bonus status here." />
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <th className="px-4 py-3">Candidate</th>
                                        <th className="px-4 py-3">Job</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Bonus</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {referrals.map((r) => (
                                        <tr key={r._id}>
                                            <td className="px-4 py-3.5 font-medium text-gray-900">{r.firstName} {r.lastName}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{r.jobPostingId?.jobTitle || '—'}</td>
                                            <td className="px-4 py-3.5"><StatusBadge>{r.status}</StatusBadge></td>
                                            <td className="px-4 py-3.5"><StatusBadge>{r.referralBonusStatus || 'Pending'}</StatusBadge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : tab === 'hire' ? (
                    <div>
                        <div className="mb-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowHireForm(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-theme-secondary px-4 py-2.5 text-sm font-semibold text-white hover:bg-theme-primary"
                            >
                                <FaPlus className="h-3.5 w-3.5" /> New request
                            </button>
                        </div>
                        {showHireForm && (
                            <form onSubmit={createHireRequest} className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SelectWithOther label="Title" required options={options.titles} selectValue={selects.title} customValue={customs.title} onSelectChange={(v) => setSelect('title', v)} onCustomChange={(v) => setCustoms((p) => ({ ...p, title: v }))} />
                                    <SelectWithOther label="Department" required options={options.departments} selectValue={selects.department} customValue={customs.department} onSelectChange={(v) => setSelect('department', v)} onCustomChange={(v) => setCustoms((p) => ({ ...p, department: v }))} />
                                    <SelectWithOther label="Position" required options={options.positions} selectValue={selects.position} customValue={customs.position} onSelectChange={(v) => setSelect('position', v)} onCustomChange={(v) => setCustoms((p) => ({ ...p, position: v }))} />
                                    <SelectWithOther label="Location" required options={options.locations} selectValue={selects.location} customValue={customs.location} onSelectChange={(v) => setSelect('location', v)} onCustomChange={(v) => setCustoms((p) => ({ ...p, location: v }))} />
                                </div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Job description *
                                    <textarea required rows={4} className={fieldClass} value={hireForm.jobDescription} onChange={(e) => setHireForm((p) => ({ ...p, jobDescription: e.target.value }))} />
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    Business justification
                                    <textarea rows={2} className={fieldClass} value={hireForm.justification} onChange={(e) => setHireForm((p) => ({ ...p, justification: e.target.value }))} />
                                </label>
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setShowHireForm(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button>
                                    <button type="submit" disabled={busy} className="rounded-xl bg-theme-secondary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save draft</button>
                                </div>
                            </form>
                        )}
                        {requisitions.length === 0 && !showHireForm ? (
                            <EmptyState icon={FaHandshake} title="No hiring requests yet" hint="Raise a hiring need for your team — HR will approve and post the job." />
                        ) : requisitions.length > 0 && (
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <th className="px-4 py-3">Title</th>
                                            <th className="px-4 py-3">Dept</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {requisitions.map((r) => (
                                            <tr key={r._id}>
                                                <td className="px-4 py-3.5 font-medium">{r.title}</td>
                                                <td className="px-4 py-3.5 text-gray-600">{r.department}</td>
                                                <td className="px-4 py-3.5"><StatusBadge>{r.status === 'PendingApproval' ? 'Pending approval' : r.status}</StatusBadge></td>
                                                <td className="px-4 py-3.5">
                                                    {['Draft', 'Rejected'].includes(r.status) ? (
                                                        <button type="button" disabled={busy} onClick={() => submitHire(r._id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:underline">
                                                            <FaPaperPlane className="h-3 w-3" /> Submit to HR
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default InternalJobsPage;
