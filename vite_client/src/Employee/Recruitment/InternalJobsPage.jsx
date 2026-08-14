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
    FaStar, FaTimes, FaMinus, FaSortAmountDown,
    FaBookmark, FaRegBookmark, FaClock, FaCode, FaBullhorn, FaDatabase, FaPaintBrush, FaLaptopCode,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    SelectWithOther,
    loadJobFormOptions,
    resolveSelectValue,
    OTHER_OPTION,
} from '../../components/recruitment/SelectWithOther';
import { formatJobPostedLabel, getJobPostedDate } from '../../utils/jobPostedDate';
import { AtsPage, AtsPageHeader, AtsEmpty, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';
import InterviewFeedbackForm, {
    EMPTY_INTERVIEW_FEEDBACK,
    InterviewFeedbackReadonly,
} from '../../components/recruitment/InterviewFeedbackForm';
import useHrmsPopupDismiss from '../../Hooks/useHrmsPopupDismiss';

const REQ_EMPTY = {
    jobDescription: '',
    employmentType: 'Full-time',
    numberOfPositions: 1,
    priority: 'Medium',
    justification: '',
};
const JOB_EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];
const JOB_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
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

const formatInterviewDateTime = (iv) => {
    if (!iv?.scheduledDate) {
        return iv?.scheduledTime ? `Date TBD · ${iv.scheduledTime}` : 'Date TBD';
    }
    const d = new Date(iv.scheduledDate);
    if (Number.isNaN(d.getTime())) return 'Date TBD';
    const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = iv.scheduledTime || d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${datePart} • ${timePart}`;
};

const formatInterviewLocation = (iv) => {
    if (iv?.location) return iv.location;
    if (iv?.meetingLink) return 'Virtual';
    if (iv?.job?.location) return iv.job.location;
    return 'Location TBD';
};

const interviewDisplayStatus = (iv) => {
    const isCompleted = iv?.status === 'Completed';
    const hasFb = !!iv?.feedback?.submittedAt;
    if (isCompleted && !hasFb) {
        return { label: 'Needs Feedback', tone: 'attention' };
    }
    if (isCompleted && hasFb) {
        return { label: 'Completed', tone: 'success' };
    }
    if (iv?.status === 'Cancelled') {
        return { label: 'Cancelled', tone: 'error' };
    }
    return { label: 'Scheduled', tone: 'success' };
};

const interviewTypeMeta = (type = '') => {
    const t = String(type).toLowerCase();
    if (t.includes('phone') || t.includes('screen')) return { Icon: FaPhone, label: type || 'Phone Screen' };
    if (t.includes('panel') || t.includes('final')) return { Icon: FaUsers, label: type || 'Final Panel' };
    if (t.includes('technical') || t.includes('tech')) return { Icon: FaIdBadge, label: type || 'Technical Assessment' };
    return { Icon: FaClipboardList, label: type || 'Interview' };
};

const applicationStatusLabel = (status = '') => {
    const s = String(status || '').trim();
    if (!s) return '—';
    if (/offer\s*extended/i.test(s)) return 'Offer Extended';
    if (/offer\s*accepted|accepted|hired/i.test(s)) return 'Accepted';
    if (/interview/i.test(s)) return 'Interview';
    if (/reject/i.test(s)) return 'Rejected';
    if (/under\s*review|review/i.test(s)) return 'Under Review';
    if (/screen/i.test(s)) return 'Screening';
    if (/applied|application|pending/i.test(s)) return 'Under Review';
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
};

const applicationStatusMeta = (status = '') => {
    const s = String(status || '').trim();
    if (/offer\s*extended|offer/i.test(s) && !/accept|declin|reject/i.test(s)) {
        return { label: applicationStatusLabel(s), tone: 'offer', Icon: FaStar };
    }
    if (/offer\s*accepted|accepted|hired/i.test(s)) {
        return { label: applicationStatusLabel(s), tone: 'success', Icon: FaCheck };
    }
    if (/interview/i.test(s)) {
        return { label: 'Interview', tone: 'interview', Icon: FaCalendarAlt };
    }
    if (/reject|declin|withdrawn/i.test(s)) {
        return { label: applicationStatusLabel(s), tone: 'rejected', Icon: FaTimes };
    }
    return { label: applicationStatusLabel(s), tone: 'review', Icon: FaMinus };
};

const isOfferStatus = (status = '') => /offer/i.test(String(status)) && !/accept|declin|reject/i.test(String(status));

const APP_PAGE_SIZE = 8;

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

const savedJobsStorageKey = (userId) => `ems-saved-internal-jobs:${userId || 'guest'}`;

const loadSavedJobIds = (userId) => {
    try {
        const raw = localStorage.getItem(savedJobsStorageKey(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
};

const persistSavedJobIds = (userId, ids) => {
    try {
        localStorage.setItem(savedJobsStorageKey(userId), JSON.stringify(ids.map(String)));
    } catch {
        /* ignore quota / private mode */
    }
};

const formatPostedAgo = (job) => {
    const posted = getJobPostedDate(job);
    if (!posted) return null;
    const d = new Date(posted);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted 1 day ago';
    if (days < 30) return `Posted ${days} days ago`;
    return formatJobPostedLabel(job);
};

const formatClosesMeta = (job) => {
    if (!job?.closingDate) return null;
    const d = new Date(job.closingDate);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDay = new Date(d);
    closeDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((closeDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return { label: 'Closed', urgent: true };
    if (diffDays === 0) return { label: 'Closes Today', urgent: true };
    if (diffDays === 1) return { label: 'Closes Tomorrow', urgent: true };
    return { label: `Closes ${format(d, 'MMM d')}`, urgent: diffDays <= 3 };
};

const departmentVisual = (department = '') => {
    const t = String(department).toLowerCase();
    if (t.includes('design') || t.includes('ux') || t.includes('creative')) {
        return { Icon: FaPaintBrush, tone: 'design' };
    }
    if (t.includes('market') || t.includes('growth') || t.includes('sales')) {
        return { Icon: FaBullhorn, tone: 'market' };
    }
    if (t.includes('data') || t.includes('analytic') || t.includes('science')) {
        return { Icon: FaDatabase, tone: 'data' };
    }
    if (t.includes('product') || t.includes('eng') || t.includes('tech') || t.includes('software') || t.includes('it')) {
        return { Icon: FaCode, tone: 'eng' };
    }
    if (t.includes('hr') || t.includes('people') || t.includes('talent')) {
        return { Icon: FaUsers, tone: 'hr' };
    }
    return { Icon: FaLaptopCode, tone: 'default' };
};

const OpenJobCard = ({ job, excerptFn, saved, onToggleSave, onOpen }) => {
    const visual = departmentVisual(job.department);
    const DeptIcon = visual.Icon;
    const closes = formatClosesMeta(job);
    const posted = formatPostedAgo(job);

    return (
        <article className="ats-open-card">
            <div className="ats-open-card__top">
                <span className={`ats-open-card__icon ats-open-card__icon--${visual.tone}`} aria-hidden>
                    <DeptIcon />
                </span>
                <button
                    type="button"
                    className={`ats-open-card__save ${saved ? 'ats-open-card__save--on' : ''}`}
                    aria-label={saved ? 'Remove from saved jobs' : 'Save job'}
                    aria-pressed={saved}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSave(job._id);
                    }}
                >
                    {saved ? <FaBookmark /> : <FaRegBookmark />}
                </button>
            </div>

            {job.department ? (
                <p className={`ats-open-card__dept ats-open-card__dept--${visual.tone}`}>{job.department}</p>
            ) : null}
            <h4 className="ats-open-card__title">{job.jobTitle}</h4>
            <p className="ats-open-card__desc">{excerptFn(job.jobDescription, 110)}</p>

            <div className="ats-open-card__tags">
                {job.location ? (
                    <span className="ats-open-card__tag">
                        <FaMapMarkerAlt aria-hidden /> {job.location}
                    </span>
                ) : null}
                {job.employmentType ? (
                    <span className="ats-open-card__tag">
                        <FaClock aria-hidden /> {job.employmentType}
                    </span>
                ) : null}
            </div>

            <div className="ats-open-card__meta">
                <span>{posted || 'Posted date TBD'}</span>
                {closes ? (
                    <span className={closes.urgent ? 'ats-open-card__closes--urgent' : ''}>
                        {closes.urgent ? <FaClock aria-hidden /> : null}
                        {closes.label}
                    </span>
                ) : null}
            </div>

            <button
                type="button"
                className="ats-open-card__cta"
                onClick={() => onOpen(job._id)}
            >
                View Job
            </button>
        </article>
    );
};

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

const canViewAllHireRequests = (user, employee) => {
    const role = String(user?.role || employee?.role || '').toLowerCase();
    const roles = (employee?.functionalRoles || []).map((r) => String(r).toLowerCase());
    return role === 'admin' || role === 'hr' || roles.includes('hr');
};

const requesterName = (requestedBy) => {
    if (!requestedBy) return '—';
    if (typeof requestedBy === 'object') {
        return [requestedBy.name, requestedBy.lastName].filter(Boolean).join(' ').trim() || requestedBy.email || '—';
    }
    return '—';
};

const isOwnHireRequest = (requisition, employee) => {
    const employeeId = employee?._id || employee?.id;
    const requesterId = requisition?.requestedBy?._id || requisition?.requestedBy;
    return employeeId && requesterId && String(employeeId) === String(requesterId);
};

const TAB_COPY = {
    jobs: {
        title: 'Open Roles',
        subtitle: 'Discover your next opportunity within the organization.',
    },
    interviews: {
        title: 'My Interviews',
        subtitle: 'Manage your upcoming and completed candidate interviews.',
    },
    applications: {
        title: 'My Applications',
        subtitle: 'Track and manage your submitted job applications.',
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
    const viewAllHireRequests = canViewAllHireRequests(user, employee);

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
    const [interviewQuery, setInterviewQuery] = useState('');
    const [showInterviewFilter, setShowInterviewFilter] = useState(false);
    const [jobQuery, setJobQuery] = useState('');
    const [hireMenuId, setHireMenuId] = useState(null);
    const [expandedHireId, setExpandedHireId] = useState(null);
    const [expandedInterviewId, setExpandedInterviewId] = useState(null);
    const [interviewMenuId, setInterviewMenuId] = useState(null);
    const [appStatusFilter, setAppStatusFilter] = useState('');
    const [showAppFilter, setShowAppFilter] = useState(false);
    const [showAppSort, setShowAppSort] = useState(false);
    const [appSort, setAppSort] = useState('newest');
    const [appPage, setAppPage] = useState(1);
    const [jobDept, setJobDept] = useState('');
    const [jobLoc, setJobLoc] = useState('');
    const [jobEmpType, setJobEmpType] = useState('');
    const [jobPriority, setJobPriority] = useState('');
    const [showMoreJobFilters, setShowMoreJobFilters] = useState(false);
    const [openJobFilter, setOpenJobFilter] = useState(null);
    const [showSavedOnly, setShowSavedOnly] = useState(false);
    const [savedJobIds, setSavedJobIds] = useState([]);
    const [refQuery, setRefQuery] = useState('');
    const [showBonusInfo, setShowBonusInfo] = useState(false);
    const [showAllReferrals, setShowAllReferrals] = useState(false);

    const emptyFeedbackDraft = () => ({ ...EMPTY_INTERVIEW_FEEDBACK });

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
                        strengths: Array.isArray(draft.strengths) ? draft.strengths : [],
                        weaknesses: Array.isArray(draft.weaknesses) ? draft.weaknesses : [],
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
        setShowAppFilter(false);
        setShowAppSort(false);
        setShowInterviewFilter(false);
        setOpenJobFilter(null);
        setShowMoreJobFilters(false);
        setSearchParams(id === 'jobs' ? {} : { tab: id });
    };

    const savedOwnerId = employee?._id || employee?.id || user?._id || user?.id || 'guest';

    useEffect(() => {
        setSavedJobIds(loadSavedJobIds(savedOwnerId));
    }, [savedOwnerId]);

    const toggleSavedJob = useCallback((jobId) => {
        const id = String(jobId);
        setSavedJobIds((prev) => {
            const exists = prev.includes(id);
            const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
            persistSavedJobIds(savedOwnerId, next);
            toast.success(exists ? 'Removed from saved jobs' : 'Job saved');
            return next;
        });
    }, [savedOwnerId]);

    const isJobSaved = useCallback((jobId) => savedJobIds.includes(String(jobId)), [savedJobIds]);

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
    const pageSubtitle = tab === 'hire' && viewAllHireRequests
        ? 'Review and track all headcount requisitions across the organization.'
        : copy.subtitle;

    const jobFilterOptions = useMemo(() => {
        const fromJobs = (key) => jobs.map((j) => j[key]).filter(Boolean);
        const mergeSorted = (base, extra) => Array.from(new Set([...(base || []), ...extra])).sort();
        return {
            departments: mergeSorted(options.departments, fromJobs('department')),
            locations: mergeSorted(options.locations, fromJobs('location')),
            employmentTypes: JOB_EMPLOYMENT_TYPES,
            priorities: JOB_PRIORITIES,
        };
    }, [jobs, options.departments, options.locations]);

    const filteredJobs = useMemo(() => {
        const q = jobQuery.trim().toLowerCase();
        return jobs.filter((j) => {
            if (showSavedOnly && !savedJobIds.includes(String(j._id))) return false;
            if (jobDept && j.department !== jobDept) return false;
            if (jobLoc && j.location !== jobLoc) return false;
            if (jobEmpType && j.employmentType !== jobEmpType) return false;
            if (jobPriority && j.priority !== jobPriority) return false;
            if (!q) return true;
            const hay = `${j.jobTitle || ''} ${j.department || ''} ${j.location || ''} ${j.employmentType || ''} ${j.position || ''} ${j.jobDescription || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [jobs, jobQuery, jobDept, jobLoc, jobEmpType, jobPriority, showSavedOnly, savedJobIds]);

    const hasActiveJobFilters = !!(jobDept || jobLoc || jobEmpType || jobPriority || showSavedOnly);

    const featuredJob = filteredJobs[0] || null;
    const gridJobs = filteredJobs.slice(1);

    const excerpt = (text = '', max = 140) => {
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (!t) return 'Explore this internal opportunity and apply to grow your career.';
        return t.length > max ? `${t.slice(0, max).trim()}…` : t;
    };

    const filteredInterviews = useMemo(() => {
        const now = Date.now();
        const q = interviewQuery.trim().toLowerCase();
        return interviews.filter((iv) => {
            const when = iv.scheduledDate ? new Date(iv.scheduledDate).getTime() : null;
            const isPast = iv.status === 'Completed' || iv.status === 'Cancelled'
                || (when != null && when < now - 24 * 60 * 60 * 1000);
            if (interviewView === 'past' ? !isPast : isPast) return false;
            if (!q) return true;
            const hay = [
                iv.candidate?.name,
                iv.job?.jobTitle,
                iv.job?.department,
                iv.interviewType,
                iv.location,
                iv.status,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [interviews, interviewView, interviewQuery]);

    const applicationStatuses = useMemo(() => {
        const set = new Set(applications.map((a) => a.status).filter(Boolean));
        return Array.from(set).sort();
    }, [applications]);

    const filteredApplications = useMemo(() => {
        const list = applications.filter((a) => {
            if (appStatusFilter && a.status !== appStatusFilter) return false;
            return true;
        });
        const sorted = [...list].sort((a, b) => {
            if (appSort === 'title') {
                return String(a.jobPostingId?.jobTitle || '').localeCompare(String(b.jobPostingId?.jobTitle || ''));
            }
            const da = a.applicationDate ? new Date(a.applicationDate).getTime() : 0;
            const db = b.applicationDate ? new Date(b.applicationDate).getTime() : 0;
            return appSort === 'oldest' ? da - db : db - da;
        });
        return sorted;
    }, [applications, appStatusFilter, appSort]);

    const appTotalPages = Math.max(1, Math.ceil(filteredApplications.length / APP_PAGE_SIZE));
    const appPageSafe = Math.min(appPage, appTotalPages);
    const pagedApplications = useMemo(() => {
        const start = (appPageSafe - 1) * APP_PAGE_SIZE;
        return filteredApplications.slice(start, start + APP_PAGE_SIZE);
    }, [filteredApplications, appPageSafe]);

    useEffect(() => {
        setAppPage(1);
    }, [appStatusFilter, appSort]);

    const highlightAppId = searchParams.get('highlight') || '';

    useEffect(() => {
        if (tab !== 'applications' || !highlightAppId || loading) return;
        const idx = filteredApplications.findIndex((a) => String(a._id) === String(highlightAppId));
        if (idx >= 0) {
            setAppPage(Math.floor(idx / APP_PAGE_SIZE) + 1);
        }
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

    const closeAllPopups = useCallback(() => {
        setShowInterviewFilter(false);
        setHireMenuId(null);
        setInterviewMenuId(null);
        setShowAppFilter(false);
        setShowAppSort(false);
        setShowMoreJobFilters(false);
        setOpenJobFilter(null);
        setShowBonusInfo(false);
    }, []);

    const hasOpenPopup = Boolean(
        showInterviewFilter
        || hireMenuId
        || interviewMenuId
        || showAppFilter
        || showAppSort
        || showMoreJobFilters
        || openJobFilter
        || showBonusInfo
    );

    useHrmsPopupDismiss(closeAllPopups, hasOpenPopup);

    return (
        <AtsPage className={tab === 'hire' ? 'ats-hire-page' : ''}>
            <AtsPageHeader
                eyebrow="Recruitment"
                title={copy.title}
                subtitle={pageSubtitle}
                actions={
                    tab === 'jobs' ? (
                        <div className="ats-open-filters">
                            {[
                                { key: 'dept', label: 'Department', value: jobDept, set: setJobDept, options: jobFilterOptions.departments },
                                { key: 'emp', label: 'Employment Type', value: jobEmpType, set: setJobEmpType, options: jobFilterOptions.employmentTypes },
                                { key: 'loc', label: 'Location', value: jobLoc, set: setJobLoc, options: jobFilterOptions.locations },
                            ].map((f) => (
                                <div key={f.key} className="relative">
                                    <button
                                        type="button"
                                        className={`ats-open-filter-pill ${f.value ? 'ats-open-filter-pill--active' : ''}`}
                                        aria-expanded={openJobFilter === f.key}
                                        data-hrms-popup-trigger
                                        onClick={() => {
                                            setShowMoreJobFilters(false);
                                            setOpenJobFilter(openJobFilter === f.key ? null : f.key);
                                        }}
                                    >
                                        <span>{f.value || f.label}</span>
                                        <FaChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                    </button>
                                    {openJobFilter === f.key && (
                                        <div className="ats-open-filter-menu" role="menu">
                                            <button
                                                type="button"
                                                className="ats-open-filter-menu__item"
                                                onClick={() => { f.set(''); setOpenJobFilter(null); }}
                                            >
                                                All {f.label.toLowerCase()}s
                                            </button>
                                            {f.options.map((opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    className={`ats-open-filter-menu__item ${f.value === opt ? 'ats-open-filter-menu__item--active' : ''}`}
                                                    onClick={() => { f.set(opt); setOpenJobFilter(null); }}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                className={`ats-open-filter-pill ${showSavedOnly ? 'ats-open-filter-pill--active' : ''}`}
                                aria-pressed={showSavedOnly}
                                onClick={() => {
                                    setOpenJobFilter(null);
                                    setShowMoreJobFilters(false);
                                    setShowSavedOnly((v) => !v);
                                }}
                            >
                                {showSavedOnly ? <FaBookmark className="h-3 w-3" /> : <FaRegBookmark className="h-3 w-3" />}
                                <span>Saved{savedJobIds.length > 0 ? ` (${savedJobIds.length})` : ''}</span>
                            </button>
                            <div className="relative">
                                <button
                                    type="button"
                                    className={`ats-open-filter-pill ${showMoreJobFilters || jobPriority ? 'ats-open-filter-pill--active' : ''}`}
                                    aria-expanded={showMoreJobFilters}
                                    data-hrms-popup-trigger
                                    onClick={() => {
                                        setOpenJobFilter(null);
                                        setShowMoreJobFilters((v) => !v);
                                    }}
                                >
                                    <FaSlidersH className="h-3 w-3" />
                                    <span>More Filters</span>
                                </button>
                                {showMoreJobFilters && (
                                    <div className="ats-open-filter-menu ats-open-filter-menu--end" role="menu">
                                        <p className="ats-open-filter-menu__label">Priority</p>
                                        <button
                                            type="button"
                                            className={`ats-open-filter-menu__item ${!jobPriority ? 'ats-open-filter-menu__item--active' : ''}`}
                                            onClick={() => { setJobPriority(''); setShowMoreJobFilters(false); }}
                                        >
                                            All priorities
                                        </button>
                                        {(jobFilterOptions.priorities.length ? jobFilterOptions.priorities : ['High', 'Medium', 'Low']).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`ats-open-filter-menu__item ${jobPriority === p ? 'ats-open-filter-menu__item--active' : ''}`}
                                                onClick={() => { setJobPriority(p); setShowMoreJobFilters(false); }}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                        {hasActiveJobFilters && (
                                            <button
                                                type="button"
                                                className="ats-open-filter-menu__item"
                                                onClick={() => {
                                                    setJobDept('');
                                                    setJobLoc('');
                                                    setJobEmpType('');
                                                    setJobPriority('');
                                                    setShowSavedOnly(false);
                                                    setJobQuery('');
                                                    setShowMoreJobFilters(false);
                                                    setOpenJobFilter(null);
                                                }}
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : tab === 'interviews' ? (
                        <div className="ats-list-toolbar">
                            <div className="cm-search ats-list-toolbar__search w-full sm:w-64">
                                <svg className="cm-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <input
                                    className="cm-input"
                                    value={interviewQuery}
                                    onChange={(e) => setInterviewQuery(e.target.value)}
                                    placeholder="Search interviews..."
                                />
                            </div>
                            <CmButton
                                variant="outline"
                                onClick={() => setShowInterviewFilter((v) => !v)}
                                className={`ats-list-toolbar__filter ats-interview-filter-btn shrink-0 ${interviewView === 'past' ? '!border-[var(--ats-primary)] !text-[var(--ats-primary)]' : ''}`}
                                aria-label="Filter interviews"
                                aria-expanded={showInterviewFilter}
                                data-hrms-popup-trigger
                            >
                                <FaSlidersH className="h-3.5 w-3.5" />
                            </CmButton>
                            {showInterviewFilter && (
                                <div className="ats-list-toolbar__panel" data-hrms-popup role="menu">
                                    <button
                                        type="button"
                                        className={`ats-list-toolbar__panel-item ${interviewView === 'upcoming' ? 'ats-list-toolbar__panel-item--active' : ''}`}
                                        onClick={() => {
                                            setInterviewView('upcoming');
                                            setShowInterviewFilter(false);
                                        }}
                                    >
                                        Upcoming
                                    </button>
                                    <button
                                        type="button"
                                        className={`ats-list-toolbar__panel-item ${interviewView === 'past' ? 'ats-list-toolbar__panel-item--active' : ''}`}
                                        onClick={() => {
                                            setInterviewView('past');
                                            setShowInterviewFilter(false);
                                        }}
                                    >
                                        Past
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : tab === 'applications' ? (
                        <div className="ats-apps-toolbar">
                            <div className="relative">
                                <CmButton
                                    variant="outline"
                                    onClick={() => {
                                        setShowAppSort(false);
                                        setShowAppFilter((v) => !v);
                                    }}
                                    className={`ats-apps-toolbar__btn ${appStatusFilter ? 'ats-apps-toolbar__btn--active' : ''}`}
                                    aria-expanded={showAppFilter}
                                    data-hrms-popup-trigger
                                >
                                    <FaFilter className="h-3 w-3" />
                                    Filter
                                </CmButton>
                                {showAppFilter && (
                                    <div className="ats-apps-toolbar__menu" role="menu">
                                        <button
                                            type="button"
                                            className={`ats-apps-toolbar__item ${!appStatusFilter ? 'ats-apps-toolbar__item--active' : ''}`}
                                            role="menuitem"
                                            onClick={() => { setAppStatusFilter(''); setShowAppFilter(false); }}
                                        >
                                            All statuses
                                        </button>
                                        {applicationStatuses.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                className={`ats-apps-toolbar__item ${appStatusFilter === s ? 'ats-apps-toolbar__item--active' : ''}`}
                                                role="menuitem"
                                                onClick={() => { setAppStatusFilter(s); setShowAppFilter(false); }}
                                            >
                                                {applicationStatusLabel(s)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <CmButton
                                    variant="outline"
                                    onClick={() => {
                                        setShowAppFilter(false);
                                        setShowAppSort((v) => !v);
                                    }}
                                    className="ats-apps-toolbar__btn"
                                    aria-expanded={showAppSort}
                                    data-hrms-popup-trigger
                                >
                                    <FaSortAmountDown className="h-3 w-3" />
                                    Sort
                                </CmButton>
                                {showAppSort && (
                                    <div className="ats-apps-toolbar__menu" role="menu">
                                        {[
                                            { id: 'newest', label: 'Newest first' },
                                            { id: 'oldest', label: 'Oldest first' },
                                            { id: 'title', label: 'Job title A–Z' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                className={`ats-apps-toolbar__item ${appSort === opt.id ? 'ats-apps-toolbar__item--active' : ''}`}
                                                role="menuitem"
                                                onClick={() => { setAppSort(opt.id); setShowAppSort(false); }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : tab === 'referrals' ? (
                        <div className="ats-ref-header-actions">
                            <div className="cm-search ats-ref-header-actions__search">
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
                                size="sm"
                                variant="inverted"
                                className="ats-ref-header-actions__btn"
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
                <div className="ats-open-roles">
                    {filteredJobs.length === 0 ? (
                        <AtsEmpty
                            icon={showSavedOnly ? FaBookmark : FaBriefcase}
                            title={
                                showSavedOnly
                                    ? 'No saved roles yet'
                                    : jobs.length === 0
                                        ? 'No open roles right now'
                                        : 'No jobs match your filters'
                            }
                            hint={
                                showSavedOnly
                                    ? 'Tap the bookmark on a role card to save it here.'
                                    : jobs.length === 0
                                        ? 'When HR posts an internal role, it will show up here.'
                                        : 'Try clearing filters or choosing a different option.'
                            }
                        />
                    ) : (
                        <>
                            {featuredJob && (() => {
                                const featuredCloses = formatClosesMeta(featuredJob);
                                const featuredSaved = isJobSaved(featuredJob._id);
                                return (
                                <article className="ats-featured-role">
                                    <div className="ats-featured-role__media" aria-hidden>
                                        <img
                                            className="ats-featured-role__image"
                                            src="/images/recruitment/featured-role.jpg"
                                            alt=""
                                        />
                                      
                                    </div>
                                    <div className="ats-featured-role__body">
                                        <div className="ats-featured-role__tags">
                                            {featuredJob.department && (
                                                <span className="ats-featured-role__tag">{featuredJob.department}</span>
                                            )}
                                            {featuredJob.location && (
                                                <span className="ats-featured-role__tag">{featuredJob.location}</span>
                                            )}
                                            {featuredJob.employmentType && (
                                                <span className="ats-featured-role__tag">{featuredJob.employmentType}</span>
                                            )}
                                        </div>
                                        <div className="ats-featured-role__title-row">
                                            <h2 className="ats-featured-role__title">{featuredJob.jobTitle}</h2>
                                            <button
                                                type="button"
                                                className={`ats-open-card__save ${featuredSaved ? 'ats-open-card__save--on' : ''}`}
                                                aria-label={featuredSaved ? 'Remove from saved jobs' : 'Save job'}
                                                aria-pressed={featuredSaved}
                                                onClick={() => toggleSavedJob(featuredJob._id)}
                                            >
                                                {featuredSaved ? <FaBookmark /> : <FaRegBookmark />}
                                            </button>
                                        </div>
                                        <p className="ats-featured-role__desc">
                                            {excerpt(featuredJob.jobDescription, 180)}
                                        </p>
                                        <div className="ats-featured-role__footer">
                                            <div className="ats-featured-role__dates">
                                                <span>{formatPostedAgo(featuredJob) || 'Posted date TBD'}</span>
                                                {featuredCloses && (
                                                    <span className={featuredCloses.urgent ? 'ats-open-card__closes--urgent' : ''}>
                                                        {featuredCloses.urgent ? <FaClock aria-hidden /> : null}
                                                        {featuredCloses.label}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="ats-featured-role__cta"
                                                onClick={() => navigate(`/employee/internal-jobs/${featuredJob._id}`)}
                                            >
                                                Apply Now
                                            </button>
                                        </div>
                                    </div>
                                </article>
                                );
                            })()}

                            {gridJobs.length > 0 && (
                                <div className="ats-open-grid">
                                    {gridJobs.map((job) => (
                                        <OpenJobCard
                                            key={job._id}
                                            job={job}
                                            excerptFn={excerpt}
                                            saved={isJobSaved(job._id)}
                                            onToggleSave={toggleSavedJob}
                                            onOpen={(id) => navigate(`/employee/internal-jobs/${id}`)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : tab === 'interviews' ? (
                filteredInterviews.length === 0 ? (
                    <AtsEmpty
                        icon={FaCalendarAlt}
                        title={
                            interviews.length === 0
                                ? 'No interviews assigned to you'
                                : interviewQuery.trim()
                                    ? 'No interviews match your search'
                                    : `No ${interviewView} interviews`
                        }
                        hint="When HR schedules you as interviewer, it will appear here with full details."
                    />
                ) : (
                    <div className="ats-interview-grid">
                        {filteredInterviews.map((iv) => {
                            const isCompleted = iv.status === 'Completed';
                            const hasFb = !!iv.feedback?.submittedAt;
                            const needsFeedback = isCompleted && !hasFb;
                            const draft = feedbackDrafts[iv.interviewId] || emptyFeedbackDraft();
                            const name = iv.candidate?.name || 'Candidate';
                            const key = `${iv.candidate?.id}-${iv.interviewId}`;
                            const expanded = expandedInterviewId === key;
                            const typeMeta = interviewTypeMeta(iv.interviewType);
                            const TypeIcon = typeMeta.Icon;
                            const displayStatus = interviewDisplayStatus(iv);
                            const canMarkComplete = !isCompleted && iv.status !== 'Cancelled';

                            const openDetails = () => {
                                setInterviewMenuId(null);
                                setExpandedInterviewId(expanded ? null : key);
                            };
                            const openScorecard = () => {
                                setInterviewMenuId(null);
                                if (!expanded) setExpandedInterviewId(key);
                                else setExpandedInterviewId(null);
                            };

                            return (
                                <div key={key} className={`ats-interview-card${expanded ? ' ats-interview-card--expanded' : ''}`}>
                                    <button
                                        type="button"
                                        className="ats-interview-card__head"
                                        onClick={openDetails}
                                        aria-expanded={expanded}
                                    >
                                        <AtsAvatar name={name} />
                                        <div className="ats-interview-card__identity">
                                            <p className="ats-interview-card__name">{name}</p>
                                            <p className="ats-interview-card__role">{iv.job?.jobTitle || 'Role'}</p>
                                        </div>
                                        <AtsBadge tone={displayStatus.tone} className="ats-interview-card__badge">
                                            {displayStatus.label}
                                        </AtsBadge>
                                    </button>

                                    <div className="ats-interview-card__meta">
                                        <div className="ats-interview-card__meta-row">
                                            <TypeIcon className="ats-interview-card__meta-icon" aria-hidden />
                                            <div className="ats-interview-card__meta-text">
                                                <span className="ats-interview-card__meta-label">Interview Type</span>
                                                <span className="ats-interview-card__meta-value">{typeMeta.label}</span>
                                            </div>
                                        </div>
                                        <div className="ats-interview-card__meta-row">
                                            <FaCalendarAlt className="ats-interview-card__meta-icon" aria-hidden />
                                            <div className="ats-interview-card__meta-text">
                                                <span className="ats-interview-card__meta-label">Date &amp; Time</span>
                                                <span className="ats-interview-card__meta-value">{formatInterviewDateTime(iv)}</span>
                                            </div>
                                        </div>
                                        <div className="ats-interview-card__meta-row">
                                            <FaMapMarkerAlt className="ats-interview-card__meta-icon" aria-hidden />
                                            <div className="ats-interview-card__meta-text">
                                                <span className="ats-interview-card__meta-label">Location</span>
                                                <span className="ats-interview-card__meta-value">{formatInterviewLocation(iv)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ats-interview-card__footer">
                                        {needsFeedback ? (
                                            <button
                                                type="button"
                                                className="ats-interview-card__cta ats-interview-card__cta--scorecard"
                                                onClick={openScorecard}
                                            >
                                                <FaFileAlt /> Submit Scorecard
                                            </button>
                                        ) : (
                                            <>
                                                {iv.meetingLink ? (
                                                    <a
                                                        href={iv.meetingLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="ats-interview-card__cta ats-interview-card__cta--join"
                                                    >
                                                        <FaVideo /> Join Meeting
                                                    </a>
                                                ) : null}
                                                {canMarkComplete ? (
                                                    <button
                                                        type="button"
                                                        className="ats-interview-card__cta ats-interview-card__cta--outline"
                                                        disabled={busy}
                                                        onClick={() => markInterviewCompleted(iv)}
                                                    >
                                                        <FaCheck /> Mark as Completed
                                                    </button>
                                                ) : null}
                                                {!canMarkComplete && !iv.meetingLink && (
                                                    <button
                                                        type="button"
                                                        className="ats-interview-card__cta ats-interview-card__cta--join"
                                                        onClick={openDetails}
                                                    >
                                                        <FaEye /> {expanded ? 'Hide Details' : 'View Details'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {(needsFeedback || iv.meetingLink) && (
                                            <div className="relative shrink-0">
                                                <button
                                                    type="button"
                                                    className="ats-interview-card__more"
                                                    aria-label="More options"
                                                    aria-expanded={interviewMenuId === key}
                                                    aria-haspopup="menu"
                                                    data-hrms-popup-trigger
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInterviewMenuId((id) => (id === key ? null : key));
                                                    }}
                                                >
                                                    <FaEllipsisV />
                                                </button>
                                                {interviewMenuId === key && (
                                                    <div className="ats-action-menu ats-interview-card__menu" role="menu">
                                                        <button
                                                            type="button"
                                                            className="ats-action-menu__item"
                                                            role="menuitem"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setInterviewMenuId(null);
                                                                setExpandedInterviewId(expanded ? null : key);
                                                            }}
                                                        >
                                                            <FaEye className="h-3.5 w-3.5" />
                                                            {expanded ? 'Hide details' : 'View details'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {expanded && (
                                        <div className="ats-interview-card__details">
                                            {iv.candidate?.email ? (
                                                <p className="m-0 inline-flex items-center gap-2 text-xs" style={{ color: 'rgba(15,45,38,0.6)' }}>
                                                    <FaUser className="opacity-50" />
                                                    {iv.candidate.email}
                                                </p>
                                            ) : null}
                                            {iv.job?.department ? (
                                                <p className="m-0 text-xs" style={{ color: 'rgba(15,45,38,0.55)' }}>
                                                    {iv.job.department}
                                                    {iv.job?.jobTitle ? ` · ${iv.job.jobTitle}` : ''}
                                                </p>
                                            ) : null}

                                            <div className="ats-interview-detail-badges">
                                                <span className="ats-pill">{typeMeta.label}</span>
                                                <span className={`ats-pill ${needsFeedback ? 'ats-pill--pending' : ''}`}>
                                                    {hasFb ? 'Feedback Submitted' : needsFeedback ? 'Pending Feedback' : displayStatus.label}
                                                </span>
                                            </div>

                                            {canMarkComplete && (
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
                                                <InterviewFeedbackReadonly feedback={iv.feedback} />
                                            )}

                                            {needsFeedback && (
                                                <div className="ats-feedback-panel">
                                                    <InterviewFeedbackForm
                                                        value={draft}
                                                        onChange={(next) => setDraft(iv.interviewId, next)}
                                                        onSaveDraft={() => toast.success('Draft saved on this device')}
                                                        onSubmit={() => submitInterviewFeedback(iv)}
                                                        busy={busy}
                                                        submitLabel="Submit Feedback"
                                                    />
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
                    <AtsEmpty icon={FaFilter} title="No applications match your filters" hint="Clear the status filter to see all applications." />
                ) : (
                    <div className="ats-table-wrap ats-apps-table-wrap">
                        <div className="overflow-x-auto">
                            <table className="ats-table ats-apps-table">
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
                                    {pagedApplications.map((a) => {
                                        const statusMeta = applicationStatusMeta(a.status);
                                        const StatusIcon = statusMeta.Icon;
                                        const offerRow = isOfferStatus(a.status);
                                        const jobId = a.jobPostingId?._id;
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
                                                    <span className="ats-apps-table__title">
                                                        {a.jobPostingId?.jobTitle || '—'}
                                                    </span>
                                                </td>
                                                <td className="ats-apps-table__muted">
                                                    {a.jobPostingId?.department || '—'}
                                                </td>
                                                <td className="ats-apps-table__muted">
                                                    {a.applicationDate
                                                        ? new Date(a.applicationDate).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })
                                                        : '—'}
                                                </td>
                                                <td>
                                                    <span className={`ats-apps-status ats-apps-status--${statusMeta.tone}`}>
                                                        <StatusIcon aria-hidden />
                                                        {statusMeta.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {offerRow ? (
                                                        <button
                                                            type="button"
                                                            className="ats-apps-action ats-apps-action--primary"
                                                            disabled={!jobId && !a.selfServiceToken}
                                                            onClick={openSelfService}
                                                        >
                                                            Review Offer
                                                        </button>
                                                    ) : jobId ? (
                                                        <button
                                                            type="button"
                                                            className="ats-apps-action ats-apps-action--outline"
                                                            onClick={openJob}
                                                        >
                                                            View Details
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="ats-table-footer ats-apps-table-footer">
                            <span>
                                {filteredApplications.length === 0
                                    ? 'Showing 0 results'
                                    : `Showing ${(appPageSafe - 1) * APP_PAGE_SIZE + 1} to ${Math.min(appPageSafe * APP_PAGE_SIZE, filteredApplications.length)} of ${filteredApplications.length} results`}
                            </span>
                            <div className="ats-apps-pagination">
                                <button
                                    type="button"
                                    className="ats-apps-pagination__btn"
                                    disabled={appPageSafe <= 1}
                                    aria-label="Previous page"
                                    onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                                >
                                    <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="ats-apps-pagination__label">
                                    Page {appPageSafe} of {appTotalPages}
                                </span>
                                <button
                                    type="button"
                                    className="ats-apps-pagination__btn"
                                    disabled={appPageSafe >= appTotalPages}
                                    aria-label="Next page"
                                    onClick={() => setAppPage((p) => Math.min(appTotalPages, p + 1))}
                                >
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
                                    aria-expanded={showBonusInfo}
                                    data-hrms-popup-trigger
                                    onClick={() => setShowBonusInfo((v) => !v)}
                                >
                                    <FaInfoCircle className="h-3.5 w-3.5" /> Bonus Stages
                                </button>
                                {showBonusInfo && (
                                    <div
                                        className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white p-3 text-xs leading-relaxed"
                                        data-hrms-popup
                                        role="menu"
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
                    <div className="ats-hire-panel">
                    <div className="ats-hire-panel__table ats-table-wrap min-w-0">
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
                                                {viewAllHireRequests && <th>Requested By</th>}
                                                <th>Status</th>
                                                <th>Date Submitted</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {requisitions.map((r) => {
                                                const label = hireStatusLabel(r.status);
                                                const canSubmit = ['Draft', 'Rejected'].includes(r.status)
                                                    && isOwnHireRequest(r, employee);
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
                                                        {viewAllHireRequests && (
                                                            <td>{requesterName(r.requestedBy)}</td>
                                                        )}
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
                                                                    aria-expanded={hireMenuId === r._id}
                                                                    aria-haspopup="menu"
                                                                    data-hrms-popup-trigger
                                                                    onClick={() => setHireMenuId((id) => (id === r._id ? null : r._id))}
                                                                >
                                                                    <FaEllipsisV className="h-3.5 w-3.5" />
                                                                </button>
                                                                {hireMenuId === r._id && (
                                                                    <div className="ats-action-menu ats-action-menu--aside" role="menu">
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
                                                            <td colSpan={viewAllHireRequests ? 6 : 5} className="!bg-[rgba(28,202,155,0.04)]">
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

                    <div className="ats-hire-panel__form">
                        <div className="ats-hire-create-head">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}>
                                <FaUserPlus className="h-4 w-4" />
                            </div>
                            <h2 className="cm-title-sm m-0">Create Request</h2>
                        </div>

                        <form
                            className="ats-hire-form"
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
                                <div className="ats-segment ats-segment--urgency w-full">
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
                                    rows={2}
                                    className={`${fieldClass} !rounded-lg`}
                                    placeholder="Summarize the role responsibilities…"
                                    value={hireForm.jobDescription}
                                    onChange={(e) => setHireForm((p) => ({ ...p, jobDescription: e.target.value }))}
                                />
                            </label>

                            <label className="block">
                                <span className="ats-form-label">Business Justification *</span>
                                <textarea
                                    rows={3}
                                    className={`${fieldClass} !rounded-lg`}
                                    placeholder="Briefly explain the business need for this headcount…"
                                    value={hireForm.justification}
                                    onChange={(e) => setHireForm((p) => ({ ...p, justification: e.target.value }))}
                                />
                            </label>

                            <div className="flex flex-col gap-2 pt-0.5">
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
                </div>
            ) : null}
        </AtsPage>
    );
};

export default InternalJobsPage;
