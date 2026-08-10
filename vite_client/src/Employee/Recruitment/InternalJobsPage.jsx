import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    FaBriefcase, FaUserPlus, FaFileAlt, FaMapMarkerAlt, FaHandshake,
    FaCalendarAlt, FaPaperPlane, FaVideo, FaClipboardList, FaUser,
    FaEllipsisV, FaChevronLeft, FaChevronRight,
    FaPhone, FaUsers, FaEye, FaIdBadge, FaFilter, FaCheck, FaChevronDown, FaSlidersH, FaInfoCircle, FaPlus, FaArrowRight,
    FaRocket, FaAward, FaCompass, FaArrowUp, FaRegBookmark,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    SelectWithOther,
    loadJobFormOptions,
    resolveSelectValue,
    OTHER_OPTION,
} from '../../components/recruitment/SelectWithOther';
import { AtsPage, AtsPageHeader, AtsEmpty, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';

const REQ_EMPTY = {
    jobDescription: '',
    employmentType: 'Full-time',
    numberOfPositions: 1,
    priority: 'Medium',
    justification: '',
};
const EMPTY_SELECTS = { title: '', department: '', position: '', location: '' };
const EMPTY_CUSTOMS = { title: '', department: '', position: '', location: '' };

const fieldClass = 'cm-input w-full';

/** Map existing priority field to reference urgency labels (UI only). */
const PRIORITY_TO_URGENCY = { High: 'ASAP', Medium: '30 Days', Low: '90 Days' };
const URGENCY_TO_PRIORITY = { ASAP: 'High', '30 Days': 'Medium', '90 Days': 'Low' };

const hireStatusLabel = (status = '') => {
    if (status === 'PendingApproval') return 'PENDING';
    if (status === 'Approved') return 'APPROVED';
    if (status === 'Rejected') return 'REJECTED';
    if (status === 'Draft') return 'DRAFT';
    if (status === 'Converted') return 'CONVERTED';
    return String(status || '—').toUpperCase();
};

const formatInterviewWhen = (iv) => {
    if (!iv?.scheduledDate) {
        return iv?.scheduledTime ? `Time TBD · ${iv.scheduledTime}` : 'Date TBD';
    }
    const d = new Date(iv.scheduledDate);
    if (Number.isNaN(d.getTime())) return 'Date TBD';
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const dayLabel = isToday
        ? 'Today'
        : isTomorrow
            ? 'Tomorrow'
            : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timePart = iv.scheduledTime || d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const loc = iv.location ? ` · ${iv.location}` : '';
    return `${dayLabel}, ${timePart}${loc}`;
};

const interviewTypeMeta = (type = '') => {
    const t = String(type).toLowerCase();
    if (t.includes('phone') || t.includes('screen')) return { Icon: FaPhone, label: type || 'Phone Screen' };
    if (t.includes('panel') || t.includes('final')) return { Icon: FaUsers, label: type || 'Final Panel' };
    if (t.includes('technical') || t.includes('tech')) return { Icon: FaIdBadge, label: type || 'Technical Interview' };
    return { Icon: FaClipboardList, label: type || 'Interview' };
};

const applicationStatusLabel = (status = '') => {
    const s = String(status || '').trim();
    if (!s) return '—';
    if (/offer\s*extended/i.test(s)) return 'OFFER EXTENDED';
    if (/offer\s*accepted|accepted|hired/i.test(s)) return 'ACCEPTED';
    if (/interview/i.test(s)) return 'INTERVIEW';
    if (/applied|application/i.test(s)) return 'APPLIED';
    return s.toUpperCase();
};

const isOfferStatus = (status = '') => /offer/i.test(String(status));
const isAcceptedStatus = (status = '') => /accepted|hired/i.test(String(status)) && !/declined/i.test(String(status));

const referralBonusLabel = (status = '') => {
    const s = String(status || 'None');
    if (s === 'None' || s === 'NotEligible') return 'N/A';
    if (s === 'Pending') return 'PENDING';
    if (s === 'Payable') return 'PAYABLE';
    if (s === 'Paid') return 'PAID';
    return s.toUpperCase();
};

const referralAppStatusLabel = (status = '') => {
    const s = String(status || '').trim();
    if (!s) return '—';
    if (/screen/i.test(s)) return 'SCREENING';
    if (/hired/i.test(s)) return 'HIRED';
    if (/reject/i.test(s)) return 'REJECTED';
    if (/interview/i.test(s)) return 'INTERVIEW';
    if (/offer/i.test(s)) return applicationStatusLabel(s);
    return s.toUpperCase();
};

const employmentChip = (type = '') => {
    const t = String(type).toLowerCase();
    if (t.includes('contract')) return 'ats-chip ats-chip--tertiary';
    if (t.includes('part')) return 'ats-chip ats-chip--part';
    return 'ats-chip ats-chip--primary';
};

const postedAgoLabel = (dateVal) => {
    if (!dateVal) return 'Posted recently';
    const t = new Date(dateVal).getTime();
    if (Number.isNaN(t)) return 'Posted recently';
    const days = Math.floor((Date.now() - t) / 86400000);
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted 1d ago';
    if (days < 7) return `Posted ${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `Posted ${weeks}w ago`;
    const months = Math.floor(days / 30);
    return months <= 1 ? 'Posted 1mo ago' : `Posted ${months}mo ago`;
};

const JobRoleCard = ({ job, onOpen, excerptFn }) => (
    <button
        type="button"
        className="ats-role-card"
        onClick={() => onOpen(job._id)}
    >
        <div className="ats-role-card__head">
            <h4 className="ats-role-card__title">{job.jobTitle}</h4>
            <FaRegBookmark className="ats-role-card__bookmark h-4 w-4" aria-hidden />
        </div>
        <div className="ats-role-card__tags">
            {job.department && <span className="ats-role-card__tag">{job.department}</span>}
            {job.location && <span className="ats-role-card__tag">{job.location}</span>}
        </div>
        <p className="ats-role-card__desc">{excerptFn(job.jobDescription, 120)}</p>
        <div className="ats-role-card__footer">
            <AtsAvatar name={job.department || job.jobTitle || 'Job'} />
            <span className="ats-role-card__posted">
                {postedAgoLabel(job.postedDate || job.createdAt || job.postedAt)}
            </span>
        </div>
    </button>
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

const TAB_COPY = {
    jobs: {
        title: 'Internal Jobs',
        subtitle: 'Explore internal growth opportunities and manage your applications.',
    },
    interviews: {
        title: 'Interviews',
        subtitle: 'Manage and join your scheduled candidate interviews.',
    },
    applications: {
        title: 'My Applications',
        subtitle: 'Track the status of roles you have applied for internally.',
    },
    referrals: {
        title: 'My Referrals',
        subtitle: 'Track the progress of candidates you\'ve referred.',
    },
    hire: {
        title: 'Hire Requests',
        subtitle: 'Manage and track your active headcount requisitions.',
    },
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
    const [hireForm, setHireForm] = useState(REQ_EMPTY);
    const [selects, setSelects] = useState(EMPTY_SELECTS);
    const [customs, setCustoms] = useState(EMPTY_CUSTOMS);
    const [options, setOptions] = useState({ titles: [], departments: [], positions: [], locations: [] });
    const [feedbackDrafts, setFeedbackDrafts] = useState({});
    const [interviewView, setInterviewView] = useState('upcoming');
    const [jobQuery, setJobQuery] = useState('');
    const [hireMenuId, setHireMenuId] = useState(null);
    const [expandedHireId, setExpandedHireId] = useState(null);
    const [expandedInterviewId, setExpandedInterviewId] = useState(null);
    const [appStatusFilter, setAppStatusFilter] = useState('');
    const [showAppFilter, setShowAppFilter] = useState(false);
    const [appQuery, setAppQuery] = useState('');
    const [jobDept, setJobDept] = useState('');
    const [jobLoc, setJobLoc] = useState('');
    const [jobEmpType, setJobEmpType] = useState('');
    const [jobPriority, setJobPriority] = useState('');
    const [showMoreJobFilters, setShowMoreJobFilters] = useState(false);
    const [openJobFilter, setOpenJobFilter] = useState(null);
    const [refQuery, setRefQuery] = useState('');
    const [showBonusInfo, setShowBonusInfo] = useState(false);
    const [showAllReferrals, setShowAllReferrals] = useState(false);

    const emptyFeedbackDraft = () => ({
        rating: '',
        technical: '',
        communication: '',
        behaviour: '',
        recommendation: 'Hire',
        comments: '',
    });

    const setDraft = (interviewId, patch) => {
        setFeedbackDrafts((prev) => ({
            ...prev,
            [interviewId]: { ...(prev[interviewId] || emptyFeedbackDraft()), ...patch },
        }));
    };

    const markInterviewCompleted = async (iv) => {
        try {
            setBusy(true);
            await axios.put(
                `/v1/both/recruitment/candidates/${iv.candidate.id}/interview/${iv.interviewId}/complete`,
                {},
                { withCredentials: true }
            );
            toast.success('Interview marked Completed — you can submit feedback now');
            const { data } = await axios.get('/v1/both/recruitment/my-interviews', { withCredentials: true });
            setInterviews(data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark completed');
        } finally {
            setBusy(false);
        }
    };

    const submitInterviewFeedback = async (iv) => {
        const draft = feedbackDrafts[iv.interviewId] || emptyFeedbackDraft();
        try {
            setBusy(true);
            await axios.put(
                `/v1/both/recruitment/candidates/${iv.candidate.id}/interview/${iv.interviewId}/feedback`,
                {
                    feedback: {
                        rating: Number(draft.rating) || 0,
                        technical: Number(draft.technical) || 0,
                        communication: Number(draft.communication) || 0,
                        behaviour: Number(draft.behaviour) || 0,
                        recommendation: draft.recommendation,
                        comments: draft.comments,
                    },
                },
                { withCredentials: true }
            );
            toast.success('Feedback submitted');
            setFeedbackDrafts((prev) => {
                const next = { ...prev };
                delete next[iv.interviewId];
                return next;
            });
            const { data } = await axios.get('/v1/both/recruitment/my-interviews', { withCredentials: true });
            setInterviews(data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setBusy(false);
        }
    };

    const tabs = useMemo(() => {
        const base = [
            { id: 'jobs', label: 'Open Jobs', icon: FaBriefcase },
            { id: 'interviews', label: 'My Interviews', icon: FaCalendarAlt },
            { id: 'applications', label: 'My Applications', icon: FaFileAlt },
            { id: 'referrals', label: 'My Referrals', icon: FaUserPlus },
        ];
        if (showHireTab) {
            base.splice(1, 0, { id: 'hire', label: 'Request a Hire', icon: FaHandshake });
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
                const { data } = await axios.get('/v1/both/recruitment/my-applications', {
                    withCredentials: true,
                    params: { _t: Date.now() },
                    headers: { 'Cache-Control': 'no-cache' },
                });
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

    const resetHireForm = () => {
        setHireForm(REQ_EMPTY);
        setSelects(EMPTY_SELECTS);
        setCustoms(EMPTY_CUSTOMS);
    };

    const createHireRequest = async (mode = 'draft') => {
        const title = resolveSelectValue(selects.title, customs.title);
        const department = resolveSelectValue(selects.department, customs.department);
        const position = resolveSelectValue(selects.position, customs.position);
        const location = resolveSelectValue(selects.location, customs.location);
        if (!title || !department || !position || !location || !hireForm.jobDescription.trim()) {
            toast.error('Please fill all required fields');
            return;
        }
        if (mode === 'submit' && !String(hireForm.justification || '').trim()) {
            toast.error('Business justification is required to submit for approval');
            return;
        }
        try {
            setBusy(true);
            const { data } = await axios.post('/v1/both/recruitment/requisitions', {
                ...hireForm,
                title,
                department,
                position,
                location,
            }, { withCredentials: true });
            const created = data?.data;
            const id = created?._id || created?.id;
            if (mode === 'submit' && id) {
                await axios.post(`/v1/both/recruitment/requisitions/${id}/submit`, {}, { withCredentials: true });
                toast.success('Submitted for approval');
            } else {
                toast.success('Hiring request saved as draft');
            }
            resetHireForm();
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
            setHireMenuId(null);
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
    const copy = TAB_COPY[tab] || TAB_COPY.jobs;

    const jobFilterOptions = useMemo(() => ({
        departments: Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))).sort(),
        locations: Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort(),
        employmentTypes: Array.from(new Set(jobs.map((j) => j.employmentType).filter(Boolean))).sort(),
        priorities: Array.from(new Set(jobs.map((j) => j.priority).filter(Boolean))).sort(),
    }), [jobs]);

    const filteredJobs = useMemo(() => {
        const q = jobQuery.trim().toLowerCase();
        return jobs.filter((j) => {
            if (jobDept && j.department !== jobDept) return false;
            if (jobLoc && j.location !== jobLoc) return false;
            if (jobEmpType && j.employmentType !== jobEmpType) return false;
            if (jobPriority && j.priority !== jobPriority) return false;
            if (!q) return true;
            const hay = `${j.jobTitle || ''} ${j.department || ''} ${j.location || ''} ${j.employmentType || ''} ${j.position || ''} ${j.jobDescription || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [jobs, jobQuery, jobDept, jobLoc, jobEmpType, jobPriority]);

    const hasActiveJobFilters = !!(jobDept || jobLoc || jobEmpType || jobPriority);

    const featuredJob = filteredJobs[0] || null;
    const recommendedJobs = filteredJobs.slice(1, 4);
    const recentJobs = filteredJobs.slice(0, 6);
    const openPositions = useMemo(
        () => jobs.reduce((sum, j) => sum + (Number(j.numberOfPositions) || 1), 0),
        [jobs]
    );
    const deptCount = useMemo(
        () => new Set(jobs.map((j) => j.department).filter(Boolean)).size,
        [jobs]
    );

    const excerpt = (text = '', max = 140) => {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (!t) return 'Explore this internal opportunity and apply to grow your career.';
        return t.length > max ? `${t.slice(0, max).trim()}…` : t;
    };

    const filteredInterviews = useMemo(() => {
        const now = Date.now();
        return interviews.filter((iv) => {
            const when = iv.scheduledDate ? new Date(iv.scheduledDate).getTime() : null;
            const isPast = iv.status === 'Completed' || iv.status === 'Cancelled'
                || (when != null && when < now - 24 * 60 * 60 * 1000);
            return interviewView === 'past' ? isPast : !isPast;
        });
    }, [interviews, interviewView]);

    const applicationStatuses = useMemo(() => {
        const set = new Set(applications.map((a) => a.status).filter(Boolean));
        return Array.from(set).sort();
    }, [applications]);

    const filteredApplications = useMemo(() => {
        const q = appQuery.trim().toLowerCase();
        return applications.filter((a) => {
            if (appStatusFilter && a.status !== appStatusFilter) return false;
            if (!q) return true;
            const hay = `${a.jobPostingId?.jobTitle || ''} ${a.jobPostingId?.department || ''} ${a.status || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [applications, appStatusFilter, appQuery]);

    const highlightAppId = searchParams.get('highlight') || '';

    useEffect(() => {
        if (tab !== 'applications' || !highlightAppId || loading) return;
        const el = document.getElementById(`app-row-${highlightAppId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [tab, highlightAppId, loading, filteredApplications]);

    const filteredReferrals = useMemo(() => {
        const q = refQuery.trim().toLowerCase();
        if (!q) return referrals;
        return referrals.filter((r) => {
            const hay = `${r.firstName || ''} ${r.lastName || ''} ${r.jobPostingId?.jobTitle || ''} ${r.status || ''} ${r.referralBonusStatus || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [referrals, refQuery]);

    const visibleReferrals = showAllReferrals ? filteredReferrals : filteredReferrals.slice(0, 10);

    return (
        <AtsPage>
            <AtsPageHeader
                eyebrow="Recruitment"
                title={copy.title}
                subtitle={copy.subtitle}
                actions={
                    tab === 'jobs' ? (
                        <div className="cm-search w-full sm:w-72">
                            <svg className="cm-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <input
                                className="cm-input"
                                value={jobQuery}
                                onChange={(e) => setJobQuery(e.target.value)}
                                placeholder="Search jobs, keywords, or skills..."
                            />
                        </div>
                    ) : tab === 'interviews' ? (
                        <div className="ats-segment">
                            <button
                                type="button"
                                className={`ats-segment__btn ${interviewView === 'upcoming' ? 'ats-segment__btn--active' : ''}`}
                                onClick={() => setInterviewView('upcoming')}
                            >
                                Upcoming
                            </button>
                            <button
                                type="button"
                                className={`ats-segment__btn ${interviewView === 'past' ? 'ats-segment__btn--active' : ''}`}
                                onClick={() => setInterviewView('past')}
                            >
                                Past
                            </button>
                        </div>
                    ) : tab === 'applications' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="cm-search w-full sm:w-56">
                                <svg className="cm-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    className="cm-input"
                                    value={appQuery}
                                    onChange={(e) => setAppQuery(e.target.value)}
                                    placeholder="Search..."
                                />
                            </div>
                            <div className="relative">
                                <CmButton
                                    variant="outline"
                                    onClick={() => setShowAppFilter((v) => !v)}
                                    className={appStatusFilter ? '!border-[var(--ats-primary)] !text-[var(--ats-primary)]' : ''}
                                >
                                    <FaFilter className="h-3 w-3" /> Filter
                                </CmButton>
                                {showAppFilter && (
                                    <div
                                        className="absolute right-0 z-20 mt-2 min-w-[180px] rounded-xl bg-white py-2"
                                        style={{ boxShadow: 'var(--ats-shadow-md)' }}
                                    >
                                        <button
                                            type="button"
                                            className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                            onClick={() => { setAppStatusFilter(''); setShowAppFilter(false); }}
                                        >
                                            All statuses
                                        </button>
                                        {applicationStatuses.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                                style={{ color: appStatusFilter === s ? 'var(--ats-primary)' : undefined, fontWeight: appStatusFilter === s ? 600 : 400 }}
                                                onClick={() => { setAppStatusFilter(s); setShowAppFilter(false); }}
                                            >
                                                {applicationStatusLabel(s)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : tab === 'referrals' ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="cm-search w-full sm:w-56">
                                <svg className="cm-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    className="cm-input"
                                    value={refQuery}
                                    onChange={(e) => setRefQuery(e.target.value)}
                                    placeholder="Search referrals..."
                                />
                            </div>
                            <CmButton
                                variant="inverted"
                                onClick={() => {
                                    changeTab('jobs');
                                    toast.info('Open a role, then choose Refer Someone to submit a referral.');
                                }}
                            >
                                <FaPlus className="h-3 w-3" /> Submit New Referral
                            </CmButton>
                        </div>
                    ) : null
                }
            />

            <nav className="ats-tabs" aria-label="Hiring sections">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            className={`ats-tab ${active ? 'ats-tab--active' : ''}`}
                            onClick={() => changeTab(t.id)}
                        >
                            <Icon className="h-3.5 w-3.5 opacity-80" />
                            {t.label}
                            {t.id === 'interviews' && pendingInterviews > 0 && (
                                <span className="ats-tab-count ats-tab-count--alert">{pendingInterviews}</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {loading ? (
                <LoadingSpinner message="Loading…" />
            ) : tab === 'jobs' ? (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="ats-filter-pills">
                            {[
                                { key: 'dept', label: 'Department', value: jobDept, set: setJobDept, options: jobFilterOptions.departments },
                                { key: 'loc', label: 'Location', value: jobLoc, set: setJobLoc, options: jobFilterOptions.locations },
                                { key: 'emp', label: 'Employment Type', value: jobEmpType, set: setJobEmpType, options: jobFilterOptions.employmentTypes },
                            ].map((f) => (
                                <div key={f.key} className="relative">
                                    <button
                                        type="button"
                                        className={`ats-filter-pill ${f.value ? 'ats-filter-pill--active' : ''}`}
                                        onClick={() => setOpenJobFilter(openJobFilter === f.key ? null : f.key)}
                                    >
                                        {f.value || f.label}
                                        <FaChevronDown className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                    {openJobFilter === f.key && (
                                        <div
                                            className="absolute left-0 z-20 mt-2 max-h-56 min-w-[180px] overflow-y-auto rounded-xl bg-white py-2"
                                            style={{ boxShadow: 'var(--ats-shadow-md)' }}
                                        >
                                            <button
                                                type="button"
                                                className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                                onClick={() => { f.set(''); setOpenJobFilter(null); }}
                                            >
                                                All {f.label.toLowerCase()}s
                                            </button>
                                            {f.options.map((opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                                    style={{ fontWeight: f.value === opt ? 600 : 400, color: f.value === opt ? 'var(--ats-primary)' : undefined }}
                                                    onClick={() => { f.set(opt); setOpenJobFilter(null); }}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {hasActiveJobFilters && (
                                <button
                                    type="button"
                                    className="ats-link text-sm"
                                    onClick={() => {
                                        setJobDept('');
                                        setJobLoc('');
                                        setJobEmpType('');
                                        setJobPriority('');
                                        setShowMoreJobFilters(false);
                                        setOpenJobFilter(null);
                                    }}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                type="button"
                                className={`ats-link inline-flex items-center gap-1.5 text-sm ${showMoreJobFilters || jobPriority ? 'font-semibold' : ''}`}
                                onClick={() => setShowMoreJobFilters((v) => !v)}
                            >
                                <FaSlidersH className="h-3 w-3" /> More Filters
                            </button>
                            {showMoreJobFilters && (
                                <div
                                    className="absolute right-0 z-20 mt-2 min-w-[180px] rounded-xl bg-white py-2"
                                    style={{ boxShadow: 'var(--ats-shadow-md)' }}
                                >
                                    <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.45)' }}>
                                        Priority
                                    </p>
                                    <button
                                        type="button"
                                        className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                        onClick={() => { setJobPriority(''); setShowMoreJobFilters(false); }}
                                    >
                                        All priorities
                                    </button>
                                    {(jobFilterOptions.priorities.length ? jobFilterOptions.priorities : ['High', 'Medium', 'Low']).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            className="block w-full px-4 py-2 text-left text-sm hover:bg-[rgba(28,202,155,0.08)]"
                                            style={{ fontWeight: jobPriority === p ? 600 : 400, color: jobPriority === p ? 'var(--ats-primary)' : undefined }}
                                            onClick={() => { setJobPriority(p); setShowMoreJobFilters(false); }}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {filteredJobs.length === 0 ? (
                        <AtsEmpty
                            icon={FaBriefcase}
                            title={jobs.length === 0 ? 'No open roles right now' : 'No jobs match your filters'}
                            hint={jobs.length === 0 ? 'When HR posts an internal role, it will show up here.' : 'Try clearing filters or using a different keyword.'}
                        />
                    ) : (
                        <>
                            <div className="ats-jobs-dash">
                                <div className="ats-hero">
                                    <div className="ats-hero__visual" aria-hidden>
                                        <span className="ats-hero__arrow"><FaArrowUp /></span>
                                    </div>
                                    <div className="ats-hero__body">
                                        <span className="ats-chip ats-chip--primary inline-flex items-center gap-1.5 w-fit">
                                            <FaRocket className="h-3 w-3" /> Growth Initiative
                                        </span>
                                        <h2 className="m-0 text-xl font-bold sm:text-2xl" style={{ color: 'var(--ats-secondary)' }}>
                                            {featuredJob.jobTitle}
                                        </h2>
                                        <p className="m-0 text-sm leading-relaxed" style={{ color: 'rgba(15,45,38,0.65)' }}>
                                            {excerpt(featuredJob.jobDescription)}
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                            {featuredJob.department && <span>{featuredJob.department}</span>}
                                            {featuredJob.location && (
                                                <span className="inline-flex items-center gap-1">
                                                    <FaMapMarkerAlt className="h-3 w-3" /> {featuredJob.location}
                                                </span>
                                            )}
                                        </div>
                                        <CmButton
                                            className="mt-1 w-fit"
                                            onClick={() => navigate(`/employee/internal-jobs/${featuredJob._id}`)}
                                        >
                                            Apply Now <FaArrowRight className="h-3 w-3" />
                                        </CmButton>
                                    </div>
                                </div>

                                <aside className="ats-jobs-aside">
                                    <div className="ats-jobs-stats">
                                        <div className="ats-jobs-stat">
                                            <div className="ats-jobs-stat__icon" style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}>
                                                <FaBriefcase className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="ats-jobs-stat__value m-0">{jobs.length}</p>
                                                <p className="ats-jobs-stat__label m-0">Active Openings</p>
                                            </div>
                                        </div>
                                        <div className="ats-jobs-stat">
                                            <div className="ats-jobs-stat__icon" style={{ background: 'rgba(255,127,80,0.15)', color: '#c45a2a' }}>
                                                <FaAward className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="ats-jobs-stat__value m-0">{openPositions || deptCount}</p>
                                                <p className="ats-jobs-stat__label m-0">
                                                    {openPositions ? 'Open Positions' : 'Departments'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ats-reco-card">
                                        <div className="mb-2 flex items-center gap-2">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}>
                                                <FaCompass className="h-3.5 w-3.5" />
                                            </div>
                                            <h3 className="m-0 text-sm font-bold" style={{ color: 'var(--ats-secondary)' }}>
                                                Recommended for You
                                            </h3>
                                        </div>
                                        {recommendedJobs.length === 0 ? (
                                            <p className="m-0 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                More openings will appear here as they are posted.
                                            </p>
                                        ) : (
                                            recommendedJobs.map((job) => (
                                                <button
                                                    key={job._id}
                                                    type="button"
                                                    className="ats-reco-item"
                                                    onClick={() => navigate(`/employee/internal-jobs/${job._id}`)}
                                                >
                                                    <p className="ats-reco-item__title">{job.jobTitle}</p>
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                                            <FaMapMarkerAlt className="h-3 w-3" />
                                                            {job.location || '—'}
                                                        </span>
                                                        {job.priority && (
                                                            <span className="ats-chip ats-chip--primary" style={{ fontSize: '0.625rem' }}>
                                                                {String(job.priority).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </aside>
                            </div>

                            <div>
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 className="m-0 text-base font-bold" style={{ color: 'var(--ats-secondary)' }}>
                                        Recently Added Roles
                                    </h3>
                                    {filteredJobs.length > recentJobs.length && (
                                        <button
                                            type="button"
                                            className="ats-link text-sm"
                                            onClick={() => {
                                                document.getElementById('all-internal-roles')?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                        >
                                            View All
                                        </button>
                                    )}
                                </div>
                                <div className="ats-job-grid" id="all-internal-roles">
                                    {recentJobs.map((job) => (
                                        <JobRoleCard
                                            key={job._id}
                                            job={job}
                                            excerptFn={excerpt}
                                            onOpen={(id) => navigate(`/employee/internal-jobs/${id}`)}
                                        />
                                    ))}
                                </div>
                                {filteredJobs.length > recentJobs.length && (
                                    <div className="ats-job-grid mt-4">
                                        {filteredJobs.slice(6).map((job) => (
                                            <JobRoleCard
                                                key={job._id}
                                                job={job}
                                                excerptFn={excerpt}
                                                onOpen={(id) => navigate(`/employee/internal-jobs/${id}`)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : tab === 'interviews' ? (
                filteredInterviews.length === 0 ? (
                    <AtsEmpty
                        icon={FaCalendarAlt}
                        title={interviews.length === 0 ? 'No interviews assigned to you' : `No ${interviewView} interviews`}
                        hint="When HR schedules you as interviewer, it will appear here with full details."
                    />
                ) : (
                    <div className="ats-interview-grid">
                        {filteredInterviews.map((iv) => {
                            const isCompleted = iv.status === 'Completed';
                            const hasFb = !!iv.feedback?.submittedAt;
                            const draft = feedbackDrafts[iv.interviewId] || emptyFeedbackDraft();
                            const name = iv.candidate?.name || 'Candidate';
                            const key = `${iv.candidate?.id}-${iv.interviewId}`;
                            const expanded = expandedInterviewId === key;
                            const typeMeta = interviewTypeMeta(iv.interviewType);
                            const TypeIcon = typeMeta.Icon;
                            const statusLabel = String(iv.status || 'Scheduled').toUpperCase();
                            return (
                                <div key={key} className="ats-interview-card">
                                    <div className="ats-interview-card__head">
                                        <AtsAvatar name={name} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="m-0 truncate text-base font-bold" style={{ color: 'var(--ats-secondary)' }}>
                                                        {name}
                                                    </p>
                                                    <p className="m-0 mt-0.5 truncate text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                                        {iv.job?.jobTitle || 'Role'}
                                                    </p>
                                                </div>
                                                <AtsBadge status={iv.status}>{statusLabel}</AtsBadge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ats-interview-card__meta">
                                        <div className="ats-interview-card__meta-row">
                                            <FaCalendarAlt />
                                            <span>{formatInterviewWhen(iv)}</span>
                                        </div>
                                        <div className="ats-interview-card__meta-row">
                                            <TypeIcon />
                                            <span>{typeMeta.label}</span>
                                        </div>
                                    </div>

                                    <div className="ats-interview-card__footer">
                                        {iv.meetingLink ? (
                                            <a
                                                href={iv.meetingLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="cm-btn cm-btn--primary"
                                            >
                                                <FaVideo /> Join Meeting
                                            </a>
                                        ) : null}
                                        <CmButton
                                            variant={iv.meetingLink ? 'outline' : 'primary'}
                                            onClick={() => setExpandedInterviewId(expanded ? null : key)}
                                        >
                                            <FaEye /> {expanded ? 'Hide Details' : 'View Details'}
                                        </CmButton>
                                    </div>

                                    {expanded && (
                                        <div className="space-y-3 border-t border-[rgba(15,45,38,0.08)] pt-3">
                                            {iv.candidate?.email && (
                                                <p className="m-0 inline-flex items-center gap-2 text-xs" style={{ color: 'rgba(15,45,38,0.6)' }}>
                                                    <FaUser className="opacity-50" />
                                                    {iv.candidate.email}
                                                </p>
                                            )}
                                            {iv.job?.department && (
                                                <p className="m-0 text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                                    Department: {iv.job.department}
                                                </p>
                                            )}

                                            {!isCompleted && iv.status !== 'Cancelled' && (
                                                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}>
                                                    <p className="mb-2">
                                                        Feedback opens only after status is <strong>Completed</strong>.
                                                    </p>
                                                    <CmButton size="sm" variant="outline" disabled={busy} onClick={() => markInterviewCompleted(iv)}>
                                                        Mark as Completed
                                                    </CmButton>
                                                </div>
                                            )}

                                            {isCompleted && hasFb && (
                                                <div className="rounded-lg border border-[rgba(28,202,155,0.25)] bg-[rgba(28,202,155,0.08)] p-3 text-sm">
                                                    <p className="font-semibold" style={{ color: '#006c51' }}>Feedback Submitted</p>
                                                    <p className="mt-1" style={{ color: 'rgba(15,45,38,0.75)' }}>
                                                        {iv.feedback.recommendation || '—'}
                                                        {iv.feedback.rating != null ? ` · Overall ${iv.feedback.rating}/10` : ''}
                                                    </p>
                                                    <p style={{ color: 'rgba(15,45,38,0.6)' }}>
                                                        {iv.feedback.technical != null ? `Tech ${iv.feedback.technical}` : ''}
                                                        {iv.feedback.communication != null ? ` · Comm ${iv.feedback.communication}` : ''}
                                                        {iv.feedback.behaviour != null ? ` · Behaviour ${iv.feedback.behaviour}` : ''}
                                                    </p>
                                                    {iv.feedback.comments && (
                                                        <p className="mt-2 whitespace-pre-wrap" style={{ color: 'rgba(15,45,38,0.75)' }}>{iv.feedback.comments}</p>
                                                    )}
                                                    <p className="mt-2 text-xs" style={{ color: 'rgba(15,45,38,0.45)' }}>
                                                        Submitted {iv.feedback.submittedAt
                                                            ? format(new Date(iv.feedback.submittedAt), 'dd MMM yyyy, h:mm a')
                                                            : '—'}
                                                    </p>
                                                </div>
                                            )}

                                            {isCompleted && !hasFb && (
                                                <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--ats-neutral)' }}>
                                                    <h3 className="mb-2 font-semibold" style={{ color: 'var(--ats-secondary)' }}>Submit Feedback</h3>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input type="number" min="0" max="10" placeholder="Overall rating" className={fieldClass} value={draft.rating} onChange={(e) => setDraft(iv.interviewId, { rating: e.target.value })} />
                                                        <input type="number" min="0" max="10" placeholder="Technical" className={fieldClass} value={draft.technical} onChange={(e) => setDraft(iv.interviewId, { technical: e.target.value })} />
                                                        <input type="number" min="0" max="10" placeholder="Communication" className={fieldClass} value={draft.communication} onChange={(e) => setDraft(iv.interviewId, { communication: e.target.value })} />
                                                        <input type="number" min="0" max="10" placeholder="Behaviour" className={fieldClass} value={draft.behaviour} onChange={(e) => setDraft(iv.interviewId, { behaviour: e.target.value })} />
                                                    </div>
                                                    <select className="cm-select mt-2 w-full" value={draft.recommendation} onChange={(e) => setDraft(iv.interviewId, { recommendation: e.target.value })}>
                                                        {['Strong Hire', 'Hire', 'Maybe', 'No Hire'].map((r) => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                    <textarea rows={3} className={`${fieldClass} mt-2`} placeholder="Comments" value={draft.comments} onChange={(e) => setDraft(iv.interviewId, { comments: e.target.value })} />
                                                    <CmButton className="mt-2" disabled={busy} onClick={() => submitInterviewFeedback(iv)}>
                                                        Save feedback
                                                    </CmButton>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : tab === 'applications' ? (
                applications.length === 0 ? (
                    <AtsEmpty icon={FaFileAlt} title="No applications yet" hint="Open a role and apply — your status will appear here." />
                ) : filteredApplications.length === 0 ? (
                    <AtsEmpty icon={FaFilter} title="No applications match your filters" hint="Clear search or status filter to see all applications." />
                ) : (
                    <div className="ats-table-wrap">
                        <div className="overflow-x-auto">
                            <table className="ats-table">
                                <thead>
                                    <tr>
                                        <th>Job Title</th>
                                        <th>Department</th>
                                        <th>Applied Date</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApplications.map((a) => {
                                        const statusLabel = applicationStatusLabel(a.status);
                                        const offerRow = isOfferStatus(a.status);
                                        const accepted = isAcceptedStatus(a.status);
                                        const jobId = a.jobPostingId?._id;
                                        const metaId = a._id
                                            ? `APP-${String(a._id).slice(-6).toUpperCase()}`
                                            : null;
                                        const openJob = () => {
                                            if (jobId) navigate(`/employee/internal-jobs/${jobId}`);
                                        };
                                        const openSelfService = () => {
                                            if (a.selfServiceToken) {
                                                window.open(`/application/${a.selfServiceToken}`, '_blank', 'noopener,noreferrer');
                                            } else {
                                                openJob();
                                            }
                                        };
                                        return (
                                            <tr
                                                key={a._id}
                                                id={`app-row-${a._id}`}
                                                className={
                                                    offerRow || String(a._id) === String(highlightAppId)
                                                        ? 'ats-row-highlight'
                                                        : undefined
                                                }
                                            >
                                                <td>
                                                    <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                                        {a.jobPostingId?.jobTitle || '—'}
                                                    </span>
                                                    {metaId && <span className="ats-table__meta">{metaId}</span>}
                                                </td>
                                                <td>{a.jobPostingId?.department || '—'}</td>
                                                <td>
                                                    {a.applicationDate
                                                        ? new Date(a.applicationDate).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })
                                                        : '—'}
                                                </td>
                                                <td>
                                                    <AtsBadge status={a.status} className={accepted ? 'inline-flex items-center gap-1.5' : ''}>
                                                        {accepted && <FaCheck className="h-2.5 w-2.5" />}
                                                        {statusLabel}
                                                    </AtsBadge>
                                                </td>
                                                <td>
                                                    {offerRow ? (
                                                        <CmButton
                                                            size="sm"
                                                            variant="inverted"
                                                            disabled={!jobId && !a.selfServiceToken}
                                                            onClick={openSelfService}
                                                        >
                                                            Review Offer
                                                        </CmButton>
                                                    ) : jobId ? (
                                                        <button type="button" className="ats-link" onClick={openJob}>
                                                            View Details →
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="ats-table-footer">
                            <span>
                                Showing {filteredApplications.length} of {applications.length} entries
                            </span>
                            <div className="flex items-center gap-1">
                                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(15,45,38,0.12)] opacity-40" disabled aria-label="Previous page">
                                    <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(15,45,38,0.12)] opacity-40" disabled aria-label="Next page">
                                    <FaChevronRight className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            ) : tab === 'referrals' ? (
                referrals.length === 0 ? (
                    <AtsEmpty
                        icon={FaUserPlus}
                        title="No referrals yet"
                        hint="Open a job and refer a colleague to track bonus status here."
                    />
                ) : filteredReferrals.length === 0 ? (
                    <AtsEmpty icon={FaFilter} title="No referrals match your search" hint="Try a different name or job title." />
                ) : (
                    <div className="ats-table-wrap">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-2">
                            <h2 className="cm-title-sm m-0">Referral History</h2>
                            <div className="relative">
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 text-sm"
                                    style={{ color: 'rgba(15,45,38,0.45)' }}
                                    onClick={() => setShowBonusInfo((v) => !v)}
                                >
                                    <FaInfoCircle className="h-3.5 w-3.5" /> Bonus Stages
                                </button>
                                {showBonusInfo && (
                                    <div
                                        className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white p-3 text-xs leading-relaxed"
                                        style={{ boxShadow: 'var(--ats-shadow-md)', color: 'rgba(15,45,38,0.7)' }}
                                    >
                                        <p className="m-0 mb-2 font-semibold" style={{ color: 'var(--ats-secondary)' }}>Referral bonus stages</p>
                                        <ul className="m-0 list-disc space-y-1 pl-4">
                                            <li><strong>PENDING</strong> — awaiting hire / probation rules</li>
                                            <li><strong>PAYABLE</strong> — eligible to be paid</li>
                                            <li><strong>PAID</strong> — bonus has been paid</li>
                                            <li><strong>N/A</strong> — not eligible or not applicable</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="ats-table">
                                <thead>
                                    <tr>
                                        <th>Candidate Name</th>
                                        <th>Job Referred For</th>
                                        <th>Application Status</th>
                                        <th>Referral Bonus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleReferrals.map((r) => {
                                        const bonusRaw = r.referralBonusStatus || 'None';
                                        const bonusLabel = referralBonusLabel(bonusRaw);
                                        return (
                                            <tr key={r._id}>
                                                <td className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                                    {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                                                </td>
                                                <td>{r.jobPostingId?.jobTitle || '—'}</td>
                                                <td>
                                                    <AtsBadge status={r.status}>{referralAppStatusLabel(r.status)}</AtsBadge>
                                                </td>
                                                <td>
                                                    <AtsBadge status={bonusRaw === 'None' || bonusRaw === 'NotEligible' ? 'N/A' : bonusRaw}>
                                                        {bonusLabel}
                                                    </AtsBadge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="ats-table-footer">
                            <span>
                                Showing {visibleReferrals.length} of {filteredReferrals.length} referrals
                            </span>
                            {filteredReferrals.length > 10 && (
                                <button
                                    type="button"
                                    className="ats-link inline-flex items-center gap-1"
                                    onClick={() => setShowAllReferrals((v) => !v)}
                                >
                                    {showAllReferrals ? 'Show less' : 'View All History'} <FaArrowRight className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                )
            ) : tab === 'hire' ? (
                <div className="ats-hire-layout">
                    <div className="ats-table-wrap min-w-0">
                        {requisitions.length === 0 ? (
                            <div className="p-8">
                                <AtsEmpty
                                    icon={FaHandshake}
                                    title="No hiring requests yet"
                                    hint="Use Create Request on the right to raise a hiring need for your team."
                                />
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="ats-table">
                                        <thead>
                                            <tr>
                                                <th>Role Title</th>
                                                <th>Department</th>
                                                <th>Status</th>
                                                <th>Date Submitted</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {requisitions.map((r) => {
                                                const label = hireStatusLabel(r.status);
                                                const canSubmit = ['Draft', 'Rejected'].includes(r.status);
                                                const jobId = r.jobPostingId?._id || r.jobPostingId || null;
                                                const expanded = expandedHireId === r._id;
                                                return (
                                                    <React.Fragment key={r._id}>
                                                    <tr>
                                                        <td className="font-semibold">
                                                            <button
                                                                type="button"
                                                                className="ats-link text-left font-semibold"
                                                                style={{ color: 'var(--ats-secondary)' }}
                                                                onClick={() => setExpandedHireId((id) => (id === r._id ? null : r._id))}
                                                            >
                                                                {r.title}
                                                            </button>
                                                        </td>
                                                        <td>{r.department}</td>
                                                        <td>
                                                            <AtsBadge status={r.status}>{label}</AtsBadge>
                                                        </td>
                                                        <td>
                                                            {r.submittedAt || r.createdAt
                                                                ? new Date(r.submittedAt || r.createdAt).toLocaleDateString(undefined, {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                })
                                                                : '—'}
                                                        </td>
                                                        <td>
                                                            <div className="relative inline-block">
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[rgba(15,45,38,0.06)]"
                                                                    style={{ color: 'rgba(15,45,38,0.55)' }}
                                                                    aria-label="Request actions"
                                                                    onClick={() => setHireMenuId((id) => (id === r._id ? null : r._id))}
                                                                >
                                                                    <FaEllipsisV className="h-3.5 w-3.5" />
                                                                </button>
                                                                {hireMenuId === r._id && (
                                                                    <div className="ats-action-menu" role="menu">
                                                                        <button
                                                                            type="button"
                                                                            className="ats-action-menu__item"
                                                                            role="menuitem"
                                                                            onClick={() => {
                                                                                setHireMenuId(null);
                                                                                setExpandedHireId(r._id);
                                                                            }}
                                                                        >
                                                                            <FaEye className="h-3.5 w-3.5" />
                                                                            View details
                                                                        </button>
                                                                        {canSubmit && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={busy}
                                                                                className="ats-action-menu__item"
                                                                                role="menuitem"
                                                                                onClick={() => submitHire(r._id)}
                                                                            >
                                                                                <FaPaperPlane className="h-3.5 w-3.5" />
                                                                                Submit for Approval
                                                                            </button>
                                                                        )}
                                                                        {jobId && (
                                                                            <button
                                                                                type="button"
                                                                                className="ats-action-menu__item"
                                                                                role="menuitem"
                                                                                onClick={() => {
                                                                                    setHireMenuId(null);
                                                                                    navigate(`/employee/internal-jobs/${jobId}`);
                                                                                }}
                                                                            >
                                                                                <FaBriefcase className="h-3.5 w-3.5" />
                                                                                Open job posting
                                                                            </button>
                                                                        )}
                                                                        {r.status === 'Approved' && !jobId && (
                                                                            <p className="ats-action-menu__note">
                                                                                Approved — waiting for HR to convert to a job
                                                                            </p>
                                                                        )}
                                                                        {r.status === 'PendingApproval' && (
                                                                            <p className="ats-action-menu__note">
                                                                                Waiting for HR approval
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {expanded && (
                                                        <tr>
                                                            <td colSpan={5} className="!bg-[rgba(28,202,155,0.04)]">
                                                                <div className="space-y-2 px-1 py-2 text-sm" style={{ color: 'rgba(15,45,38,0.75)' }}>
                                                                    <p className="m-0">
                                                                        <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Position:</span>{' '}
                                                                        {r.position || '—'} · {r.employmentType || 'Full-time'} · {r.numberOfPositions || 1} opening(s)
                                                                    </p>
                                                                    {r.location && (
                                                                        <p className="m-0">
                                                                            <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Location:</span>{' '}
                                                                            {r.location}
                                                                        </p>
                                                                    )}
                                                                    {r.priority && (
                                                                        <p className="m-0">
                                                                            <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Urgency:</span>{' '}
                                                                            {PRIORITY_TO_URGENCY[r.priority] || r.priority}
                                                                        </p>
                                                                    )}
                                                                    {r.jobDescription && (
                                                                        <p className="m-0 whitespace-pre-wrap">
                                                                            <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Description:</span>{' '}
                                                                            {r.jobDescription}
                                                                        </p>
                                                                    )}
                                                                    {r.justification && (
                                                                        <p className="m-0 whitespace-pre-wrap">
                                                                            <span className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Justification:</span>{' '}
                                                                            {r.justification}
                                                                        </p>
                                                                    )}
                                                                    {r.rejectionReason && (
                                                                        <p className="m-0" style={{ color: 'var(--ats-error)' }}>
                                                                            <span className="font-semibold">Rejection reason:</span> {r.rejectionReason}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex flex-wrap gap-3 pt-1">
                                                                        {canSubmit && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={busy}
                                                                                className="ats-link"
                                                                                onClick={() => submitHire(r._id)}
                                                                            >
                                                                                Submit for Approval
                                                                            </button>
                                                                        )}
                                                                        {jobId && (
                                                                            <button
                                                                                type="button"
                                                                                className="ats-link"
                                                                                onClick={() => navigate(`/employee/internal-jobs/${jobId}`)}
                                                                            >
                                                                                Open job posting
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            className="ats-link"
                                                                            style={{ color: 'rgba(15,45,38,0.5)' }}
                                                                            onClick={() => setExpandedHireId(null)}
                                                                        >
                                                                            Hide
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="ats-table-footer">
                                    <span>Showing {requisitions.length} of {requisitions.length} requests</span>
                                    <div className="flex items-center gap-1">
                                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(15,45,38,0.12)] opacity-40" disabled aria-label="Previous page">
                                            <FaChevronLeft className="h-3 w-3" />
                                        </button>
                                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(15,45,38,0.12)] opacity-40" disabled aria-label="Next page">
                                            <FaChevronRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="cm-card">
                        <div className="mb-5 flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}>
                                <FaUserPlus className="h-4 w-4" />
                            </div>
                            <h2 className="cm-title-sm m-0">Create Request</h2>
                        </div>

                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                createHireRequest('draft');
                            }}
                        >
                            <SelectWithOther
                                label="Role Title"
                                required
                                options={options.titles}
                                selectValue={selects.title}
                                customValue={customs.title}
                                onSelectChange={(v) => setSelect('title', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, title: v }))}
                                placeholder="e.g. Senior UX Designer"
                            />

                            <div className="grid grid-cols-[1fr_88px] gap-3">
                                <SelectWithOther
                                    label="Department"
                                    required
                                    options={options.departments}
                                    selectValue={selects.department}
                                    customValue={customs.department}
                                    onSelectChange={(v) => setSelect('department', v)}
                                    onCustomChange={(v) => setCustoms((p) => ({ ...p, department: v }))}
                                    placeholder="Select dept"
                                />
                                <label className="block">
                                    <span className="ats-form-label">Positions *</span>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        className={fieldClass}
                                        value={hireForm.numberOfPositions}
                                        onChange={(e) => setHireForm((p) => ({ ...p, numberOfPositions: Number(e.target.value) || 1 }))}
                                    />
                                </label>
                            </div>

                            <div>
                                <span className="ats-form-label">Target Start Date (Urgency)</span>
                                <div className="ats-segment ats-segment--urgency mt-1 w-full">
                                    {['ASAP', '30 Days', '90 Days'].map((label) => {
                                        const active = (PRIORITY_TO_URGENCY[hireForm.priority] || '30 Days') === label;
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                className={`ats-segment__btn flex-1 ${active ? 'ats-segment__btn--active' : ''}`}
                                                onClick={() => setHireForm((p) => ({ ...p, priority: URGENCY_TO_PRIORITY[label] }))}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

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
                                label="Location"
                                required
                                options={options.locations}
                                selectValue={selects.location}
                                customValue={customs.location}
                                onSelectChange={(v) => setSelect('location', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, location: v }))}
                            />

                            <label className="block">
                                <span className="ats-form-label">Job description *</span>
                                <textarea
                                    required
                                    rows={3}
                                    className={`${fieldClass} !rounded-lg`}
                                    placeholder="Summarize the role responsibilities…"
                                    value={hireForm.jobDescription}
                                    onChange={(e) => setHireForm((p) => ({ ...p, jobDescription: e.target.value }))}
                                />
                            </label>

                            <label className="block">
                                <span className="ats-form-label">Business Justification *</span>
                                <textarea
                                    rows={4}
                                    className={`${fieldClass} !rounded-lg`}
                                    placeholder="Briefly explain the business need for this headcount…"
                                    value={hireForm.justification}
                                    onChange={(e) => setHireForm((p) => ({ ...p, justification: e.target.value }))}
                                />
                            </label>

                            <div className="flex flex-col gap-2.5 pt-1">
                                <CmButton
                                    type="button"
                                    disabled={busy}
                                    className="w-full"
                                    onClick={() => createHireRequest('submit')}
                                >
                                    <FaPaperPlane /> Submit for Approval
                                </CmButton>
                                <CmButton type="submit" variant="outline" disabled={busy} className="w-full">
                                    Save as Draft
                                </CmButton>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </AtsPage>
    );
};

export default InternalJobsPage;
