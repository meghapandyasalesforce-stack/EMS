import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaBriefcase, FaCalendarAlt, FaComments, FaFileContract, FaUser, FaFileAlt, FaExternalLinkAlt, FaDownload, FaTimes,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferLetterPanel from '../../components/recruitment/OfferLetterPanel';
import HireEmployeeModal from '../../components/recruitment/HireEmployeeModal';
import { normalizeResumeScreening } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';

const TABS = [
    { id: 'overview', label: 'Overview', icon: FaUser },
    { id: 'interview', label: 'Interviews', icon: FaCalendarAlt },
    { id: 'assessments', label: 'Assessments', icon: FaBriefcase },
    { id: 'comms', label: 'Communication', icon: FaComments },
    { id: 'offer', label: 'Offer Letter', icon: FaFileContract },
];

const STATUS_OPTIONS = [
    'Applied', 'Screening', 'Phone Interview', 'Technical Interview', 'Final Interview',
    'Offer Extended', 'Offer Accepted', 'Offer Declined', 'Rejected', 'Withdrawn', 'On Hold',
];

const EMAIL_ACTION_BUTTONS = [
    { type: 'interview_invite', label: 'Interview Invite', needs: 'Assign job + complete interview details' },
    { type: 'interview_reminder', label: 'Interview Reminder', needs: 'Assign job + upcoming interview' },
    { type: 'offer_reminder', label: 'Offer Reminder', needs: 'Assign job + sent offer portal link' },
    { type: 'joining_reminder', label: 'Joining Reminder', needs: 'Assign job + joining date' },
];

const INTERVIEW_EMAIL_TYPES = new Set(['interview_invite', 'interview_reminder']);

function isHoldingJob(jobOrCandidateJob) {
    if (!jobOrCandidateJob) return true;
    const tags = jobOrCandidateJob.tags || [];
    return tags.includes('__resume_inbox_holding__')
        || /unassigned/i.test(jobOrCandidateJob.jobTitle || '')
        || jobOrCandidateJob.department === 'Unassigned';
}

function pickLatestActiveInterview(schedule = []) {
    const list = Array.isArray(schedule) ? schedule : [];
    const active = [...list].reverse().find((i) => i.status === 'Scheduled' || i.status === 'Rescheduled');
    if (active) return active;
    return [...list].reverse().find((i) => i.status !== 'Cancelled') || null;
}

function toDateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const EMAIL_TYPE_LABELS = {
    interview_invite: 'Interview Invite',
    interview_reminder: 'Interview Reminder',
    offer_reminder: 'Offer Reminder',
    offer_link: 'Offer Letter',
    joining_reminder: 'Joining Reminder',
    resume_inbox_import: 'Resume Inbox',
};

/**
 * Classify timeline entries for HR display.
 * Candidate never sees this timeline — Internal = HR-only records that were not emailed.
 */
function classifyCommunication(c = {}) {
    if (c.direction === 'inbound') {
        return {
            kind: 'inbound',
            label: 'Inbound',
            badge: 'bg-sky-100 text-sky-800',
            hint: 'Received (e.g. resume via mailbox)',
        };
    }
    // Real outbound emails auto-logged after sendRecruitmentEmail
    if (c.autoLogged && c.channel === 'email' && c.direction === 'outbound') {
        return {
            kind: 'outbound',
            label: 'Outbound',
            badge: 'bg-emerald-100 text-emerald-800',
            hint: 'Sent to candidate email',
        };
    }
    // Manual Log form entries — never delivered to candidate via this form
    return {
        kind: 'internal',
        label: 'Internal',
        badge: 'bg-amber-100 text-amber-800',
        hint: 'HR-only log (not sent to candidate)',
    };
}

const CandidateDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [candidate, setCandidate] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [status, setStatus] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [interviewForm, setInterviewForm] = useState({
        interviewType: 'Video',
        scheduledDate: '',
        scheduledTime: '',
        location: '',
        meetingLink: '',
        interviewer: '',
    });
    const [interviewers, setInterviewers] = useState([]);
    const [commForm, setCommForm] = useState({ channel: 'note', subject: '', body: '' });
    const [scoreForm, setScoreForm] = useState({ resumeScore: '', technicalScore: '', culturalFitScore: '' });
    const [hireOpen, setHireOpen] = useState(false);
    const [jobOptions, setJobOptions] = useState([]);
    const [emailPrep, setEmailPrep] = useState(null);
    // emailPrep: { type, jobPostingId, interviewId, interviewType, scheduledDate, scheduledTime, location, meetingLink, interviewer }
    const [feedbackForm, setFeedbackForm] = useState({
        interviewId: '',
        rating: '',
        technical: '',
        communication: '',
        behaviour: '',
        recommendation: 'Hire',
        comments: '',
    });

    const fetchCandidate = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/v1/admin/recruitment/candidates/${id}`, { withCredentials: true });
            if (!data.success || !data.data) {
                toast.error('Candidate not found');
                navigate('/recruitment');
                return;
            }
            setCandidate(data.data);
            setStatus(data.data.status || 'Applied');
            setScoreForm({
                resumeScore: data.data.scores?.resumeScore ?? '',
                technicalScore: data.data.scores?.technicalScore ?? '',
                culturalFitScore: data.data.scores?.culturalFitScore ?? '',
            });
        } catch {
            toast.error('Failed to load candidate');
            navigate('/recruitment');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchCandidate(); }, [fetchCandidate]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get('/v1/admin/employee', {
                    withCredentials: true,
                    params: { page: 1, limit: 500 },
                });
                const list = Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.employees)
                      ? data.employees
                      : [];
                if (!cancelled) setInterviewers(list);
            } catch {
                if (!cancelled) setInterviewers([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await axios.get('/v1/admin/recruitment/inbox/jobs', { withCredentials: true });
                const list = Array.isArray(data?.data) ? data.data : [];
                if (!cancelled) setJobOptions(list.filter((j) => !isHoldingJob(j)));
            } catch {
                try {
                    const { data } = await axios.get('/v1/admin/recruitment/jobs', {
                        withCredentials: true,
                        params: { limit: 200 },
                    });
                    const raw = Array.isArray(data?.data) ? data.data : [];
                    if (!cancelled) setJobOptions(raw.filter((j) => !isHoldingJob(j) && j.status !== 'Closed'));
                } catch {
                    if (!cancelled) setJobOptions([]);
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const updateStatus = async () => {
        try {
            setBusy(true);
            await axios.put(`/v1/admin/recruitment/candidates/${id}`, {
                status,
                notes: note || undefined,
            }, { withCredentials: true });
            toast.success('Status updated');
            setNote('');
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        } finally {
            setBusy(false);
        }
    };

    const isWeekendDate = (value) => {
        if (!value) return false;
        const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
        if (!y || !m || !d) return false;
        const weekday = new Date(y, m - 1, d).getDay(); // 0 = Sun, 6 = Sat
        return weekday === 0 || weekday === 6;
    };

    const scheduleInterview = async (e) => {
        e.preventDefault();
        if (!interviewForm.interviewer) {
            toast.error('Select who will take the interview');
            return;
        }
        if (isWeekendDate(interviewForm.scheduledDate)) {
            toast.error('Saturday and Sunday are off — pick a weekday');
            return;
        }
        try {
            setBusy(true);
            await axios.post(`/v1/admin/recruitment/candidates/${id}/interview`, interviewForm, { withCredentials: true });
            toast.success('Interview scheduled — interviewer notified. Use Communication → Interview Invite to email the candidate.');
            setInterviewForm({ interviewType: 'Video', scheduledDate: '', scheduledTime: '', location: '', meetingLink: '', interviewer: '' });
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to schedule');
        } finally {
            setBusy(false);
        }
    };

    const saveScores = async () => {
        try {
            setBusy(true);
            await axios.post(`/v1/admin/recruitment/candidates/${id}/score`, {
               
                resumeScore: Number(scoreForm.resumeScore) || 0,
                technicalScore: Number(scoreForm.technicalScore) || 0,
                culturalFitScore: Number(scoreForm.culturalFitScore) || 0,
            }, { withCredentials: true });
            toast.success('Scores saved');
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save scores');
        } finally {
            setBusy(false);
        }
    };

    const logComm = async (e) => {
        e.preventDefault();
        try {
            setBusy(true);
            const { data } = await axios.post(`/v1/admin/recruitment/candidates/${id}/communication`, commForm, { withCredentials: true });
            toast.success(data.message || 'Logged (HR-only — nothing sent)');
            setCommForm({ channel: 'note', subject: '', body: '' });
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to log');
        } finally {
            setBusy(false);
        }
    };

    const openEmailPrep = (type) => {
        if (!candidate?.email) {
            toast.error('Candidate has no email address');
            return;
        }
        const interview = pickLatestActiveInterview(candidate.interviewSchedule);
        const jobId = !isHoldingJob(candidate.jobPostingId)
            ? (candidate.jobPostingId?._id || candidate.jobPostingId || '')
            : '';
        setEmailPrep({
            type,
            jobPostingId: jobId ? String(jobId) : '',
            interviewId: interview?._id ? String(interview._id) : '',
            interviewType: interview?.interviewType || 'Video',
            scheduledDate: toDateInputValue(interview?.scheduledDate),
            scheduledTime: interview?.scheduledTime || '',
            location: interview?.location || '',
            meetingLink: interview?.meetingLink || '',
            interviewer: interview?.interviewer?._id
                ? String(interview.interviewer._id)
                : (interview?.interviewer ? String(interview.interviewer) : ''),
        });
    };

    const sendEmailApi = async (type, confirmResend = false) => {
        const { data } = await axios.post(
            `/v1/admin/recruitment/candidates/${id}/send-email`,
            { type, confirmResend },
            { withCredentials: true }
        );
        return data;
    };

    const submitEmailPrep = async (e) => {
        e.preventDefault();
        if (!emailPrep?.type) return;

        const needsInterview = INTERVIEW_EMAIL_TYPES.has(emailPrep.type);
        if (!emailPrep.jobPostingId) {
            toast.error('Please assign a job / role before sending');
            return;
        }
        if (needsInterview) {
            if (!emailPrep.interviewType || !emailPrep.scheduledDate || !emailPrep.scheduledTime) {
                toast.error('Please complete interview type, date, and time');
                return;
            }
            const needsLink = emailPrep.interviewType === 'Video';
            const needsLocation = emailPrep.interviewType === 'On-site';
            if (needsLink && !emailPrep.meetingLink?.trim()) {
                toast.error('Please add a meeting link for video interviews');
                return;
            }
            if (needsLocation && !emailPrep.location?.trim()) {
                toast.error('Please add a location for on-site interviews');
                return;
            }
            if (!emailPrep.meetingLink?.trim() && !emailPrep.location?.trim()) {
                toast.error('Please add a meeting link or location');
                return;
            }
        }

        try {
            setBusy(true);

            // 1) Assign real job if needed / changed
            const currentJobId = !isHoldingJob(candidate.jobPostingId)
                ? String(candidate.jobPostingId?._id || candidate.jobPostingId || '')
                : '';
            if (String(emailPrep.jobPostingId) !== currentJobId) {
                await axios.put(
                    `/v1/admin/recruitment/candidates/${id}`,
                    { jobPostingId: emailPrep.jobPostingId },
                    { withCredentials: true }
                );
            }

            // 2) Create or update interview details for invite/reminder
            if (needsInterview) {
                const payload = {
                    interviewType: emailPrep.interviewType,
                    scheduledDate: emailPrep.scheduledDate,
                    scheduledTime: emailPrep.scheduledTime,
                    location: emailPrep.location || '',
                    meetingLink: emailPrep.meetingLink || '',
                    interviewer: emailPrep.interviewer || undefined,
                };
                if (emailPrep.interviewId) {
                    await axios.put(
                        `/v1/admin/recruitment/candidates/${id}/interview/${emailPrep.interviewId}`,
                        payload,
                        { withCredentials: true }
                    );
                } else {
                    if (!emailPrep.interviewer) {
                        toast.error('Select who will take the interview');
                        setBusy(false);
                        return;
                    }
                    await axios.post(
                        `/v1/admin/recruitment/candidates/${id}/interview`,
                        payload,
                        { withCredentials: true }
                    );
                }
            }

            // 3) Send email (explicit HR action)
            try {
                const data = await sendEmailApi(emailPrep.type, false);
                toast.success(data.message || `Email sent to ${candidate.email}`);
                setEmailPrep(null);
                fetchCandidate();
            } catch (err) {
                const payload = err.response?.data;
                if (err.response?.status === 409 && payload?.needsConfirmation) {
                    const ok = window.confirm(
                        payload.message || 'This email was already sent recently. Send again?'
                    );
                    if (ok) {
                        const data = await sendEmailApi(emailPrep.type, true);
                        toast.success(data.message || `Email sent to ${candidate.email}`);
                        setEmailPrep(null);
                        fetchCandidate();
                    }
                    return;
                }
                toast.error(payload?.message || 'Send failed');
                fetchCandidate();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not prepare email');
        } finally {
            setBusy(false);
        }
    };

    const sendQuickEmail = (type) => {
        openEmailPrep(type);
    };

    const submitFeedback = async (e, interviewId) => {
        e.preventDefault();
        const targetId = interviewId || feedbackForm.interviewId;
        if (!targetId) {
            toast.error('Select an interview');
            return;
        }
        try {
            setBusy(true);
            await axios.put(
                `/v1/admin/recruitment/candidates/${id}/interview/${targetId}`,
                {
                    status: 'Completed',
                    feedback: {
                        rating: Number(feedbackForm.rating) || 0,
                        technical: Number(feedbackForm.technical) || 0,
                        communication: Number(feedbackForm.communication) || 0,
                        behaviour: Number(feedbackForm.behaviour) || 0,
                        recommendation: feedbackForm.recommendation,
                        comments: feedbackForm.comments,
                    },
                },
                { withCredentials: true }
            );
            toast.success('Feedback saved');
            setFeedbackForm({
                interviewId: '',
                rating: '',
                technical: '',
                communication: '',
                behaviour: '',
                recommendation: 'Hire',
                comments: '',
            });
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save feedback');
        } finally {
            setBusy(false);
        }
    };

    const markInterviewCompleted = async (interviewId) => {
        try {
            setBusy(true);
            await axios.put(
                `/v1/admin/recruitment/candidates/${id}/interview/${interviewId}`,
                { status: 'Completed' },
                { withCredentials: true }
            );
            toast.success('Interview marked Completed — feedback can be submitted');
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        } finally {
            setBusy(false);
        }
    };

    const runAction = async (path, body = {}) => {
        try {
            setBusy(true);
            const { data } = await axios.post(`/v1/admin/recruitment/candidates/${id}/${path}`, body, { withCredentials: true });
            toast.success(data.message || 'Done');
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading candidate..." />;
    if (!candidate) return null;

    const screening = normalizeResumeScreening(candidate.resumeScreening || {});
    const screeningLocked = screening.isRejected;
    const screeningLabel = screening.label;
    const isUnassignedJob = isHoldingJob(candidate.jobPostingId)
        || (candidate.tags || []).includes('Unassigned');
    const displayDepartment = isUnassignedJob
        ? '—'
        : (candidate.jobPostingId?.department || '—');

    const hardDelete = async () => {
        if (!window.confirm('Permanently delete this candidate and their resume? This cannot be undone.')) return;
        try {
            setBusy(true);
            // force=true allows delete for Unassigned / Applied / etc., not only failed screening
            await axios.delete(`/v1/admin/recruitment/candidates/${id}/hard-delete?force=true`, { withCredentials: true });
            toast.success('Candidate deleted');
            navigate('/recruitment');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        } finally {
            setBusy(false);
        }
    };

    const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');

    return (
        <AtsPage>
            <button
                type="button"
                onClick={() => navigate('/recruitment')}
                className="ats-back"
            >
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <section className="cm-card">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <AtsAvatar name={fullName} />
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--ats-secondary)' }}>{fullName}</h1>
                            <p className="mt-1 text-sm" style={{ color: 'rgba(15,45,38,0.6)' }}>{candidate.email}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-sm" style={{ color: 'rgba(15,45,38,0.6)' }}>
                                <span className="inline-flex items-center gap-1.5"><FaBriefcase className="opacity-60" /> {candidate.jobPostingId?.jobTitle || 'No job linked'}</span>
                                <span className="inline-flex items-center gap-1.5"><FaCalendarAlt className="opacity-60" /> Applied {candidate.applicationDate ? format(new Date(candidate.applicationDate), 'dd MMM yyyy') : '—'}</span>
                            </div>
                            {candidate.blacklist?.isBlacklisted && (
                                <p className="mt-2 text-sm font-medium" style={{ color: 'var(--ats-error)' }}>Blacklisted: {candidate.blacklist.reason || '—'}</p>
                            )}
                            {screeningLocked && (
                                <p className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(229,62,62,0.08)', color: 'var(--ats-error)' }}>
                                    Failed Screening — read-only. Match {screening.matchScore != null ? `${screening.matchScore}%` : '—'}
                                    {screening.deleteAfterDate
                                        ? ` - Auto-delete after ${format(new Date(screening.deleteAfterDate), 'dd MMM yyyy')}`
                                        : ''}
                                </p>
                            )}
                        </div>
                    </div>
                    <AtsBadge
                        tone={
                            candidate.status === 'Offer Accepted' || candidate.stage === 'Hired' ? 'success'
                                : candidate.status === 'Withdrawn' ? 'error'
                                    : undefined
                        }
                        status={candidate.status === 'Offer Accepted' || candidate.stage === 'Hired' || candidate.status === 'Withdrawn' ? undefined : screeningLabel}
                        className="self-start !text-sm"
                    >
                        {screeningLabel}
                        {candidate.status
                            && !(screening.isRejected && candidate.status === 'Rejected')
                            && !(screening.isApproved && ['Applied', 'Screening'].includes(candidate.status))
                            ? ` - ${candidate.status}`
                            : ''}
                        {candidate.stage
                            && candidate.stage !== candidate.status
                            && !(screening.isRejected && candidate.stage === 'Rejected')
                            && !(screening.isApproved && ['Application', 'Screening'].includes(candidate.stage))
                            ? ` - ${candidate.stage}`
                            : ''}
                    </AtsBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(15,45,38,0.08)] pt-4">
                    {candidate.linkedEmployeeId ? (
                        <span className="cm-btn cm-btn--sm" style={{ background: 'rgba(28,202,155,0.12)', color: '#006c51', cursor: 'default' }}>
                            Employee: {candidate.linkedEmployeeId.employeeId || candidate.linkedEmployeeId._id}
                        </span>
                    ) : (
                        <CmButton size="sm" disabled={busy || screeningLocked} onClick={() => setHireOpen(true)}>
                            Hire → Create Employee
                        </CmButton>
                    )}
                    <CmButton size="sm" variant="outline" disabled={busy || screeningLocked} onClick={() => runAction('joining', { joiningStatus: 'Confirmed' })}>Confirm Joining</CmButton>
                    <CmButton size="sm" variant="outline" disabled={busy || screeningLocked} onClick={() => {
                        const reason = window.prompt('Withdraw reason');
                        if (reason) runAction('withdraw', { reason });
                    }}>Withdraw</CmButton>
                    <CmButton size="sm" variant="outline" disabled={busy} onClick={() => {
                        const reason = window.prompt('Blacklist reason');
                        if (reason) runAction('blacklist', { reason });
                    }} style={{ color: 'var(--ats-error)', borderColor: 'rgba(229,62,62,0.35)' }}>Blacklist</CmButton>
                    <CmButton size="sm" variant="outline" disabled={busy} onClick={() => runAction('archive', {})}>Archive</CmButton>
                    <CmButton
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={hardDelete}
                        style={{ color: 'var(--ats-error)', borderColor: 'rgba(229,62,62,0.35)' }}
                    >
                        Delete
                    </CmButton>
                </div>
                <nav className="ats-tabs !mb-0 mt-4">
                    {TABS.map(({ id: tabId, label, icon: Icon }) => (
                        <button
                            key={tabId}
                            type="button"
                            onClick={() => setActiveTab(tabId)}
                            className={`ats-tab ${activeTab === tabId ? 'ats-tab--active' : ''}`}
                        >
                            <Icon className="h-3.5 w-3.5 opacity-80" /> {label}
                        </button>
                    ))}
                </nav>
            </section>

                {activeTab === 'overview' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="cm-card lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Resume Screening</h2>
                            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                                <div>
                                    <dt style={{ color: 'rgba(15,45,38,0.5)' }}>Status</dt>
                                    <dd className="mt-0.5 font-semibold" style={{
                                        color: screening.isPassed ? '#006c51'
                                            : screening.isRejected ? 'var(--ats-error)'
                                                : '#c45a2a',
                                    }}>
                                        {screeningLabel}
                                    </dd>
                                </div>
                                <div>
                                    <dt style={{ color: 'rgba(15,45,38,0.5)' }}>Match Score</dt>
                                    <dd className="mt-0.5 font-semibold" style={{ color: 'var(--ats-secondary)' }}>{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</dd>
                                </div>
                                <div>
                                    <dt style={{ color: 'rgba(15,45,38,0.5)' }}>Minimum Required</dt>
                                    <dd className="mt-0.5 font-semibold" style={{ color: 'var(--ats-secondary)' }}>{screening.minimumRequired != null ? `${screening.minimumRequired}%` : '—'}</dd>
                                </div>
                                <div>
                                    <dt style={{ color: 'rgba(15,45,38,0.5)' }}>Screening Date</dt>
                                    <dd className="mt-0.5 font-semibold" style={{ color: 'var(--ats-secondary)' }}>{screening.screeningDate ? format(new Date(screening.screeningDate), 'dd MMM yyyy HH:mm') : '—'}</dd>
                                </div>
                            </dl>
                            {screening.reason && (
                                <p className="mt-3 text-sm" style={{ color: screening.isRejected ? 'var(--ats-error)' : '#c45a2a' }}>
                                    Reason: {screening.reason}
                                </p>
                            )}
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase" style={{ color: 'rgba(15,45,38,0.5)' }}>Matched Keywords</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(screening.matchedKeywords || []).length === 0
                                            ? <span className="text-sm" style={{ color: 'rgba(15,45,38,0.35)' }}>—</span>
                                            : screening.matchedKeywords.map((k) => (
                                                <span key={k} className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'rgba(28,202,155,0.12)', color: '#006c51' }}>{k}</span>
                                            ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase" style={{ color: 'rgba(15,45,38,0.5)' }}>Missing Keywords</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(screening.missingKeywords || []).length === 0
                                            ? <span className="text-sm" style={{ color: 'rgba(15,45,38,0.35)' }}>—</span>
                                            : screening.missingKeywords.map((k) => (
                                                <span key={k} className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'rgba(229,62,62,0.1)', color: 'var(--ats-error)' }}>{k}</span>
                                            ))}
                                    </div>
                                </div>
                            </div>
                            {screening.rejectedDate && (
                                <p className="mt-3 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                    Rejected {format(new Date(screening.rejectedDate), 'dd MMM yyyy')}
                                    {screening.deleteAfterDate ? ` - Delete after ${format(new Date(screening.deleteAfterDate), 'dd MMM yyyy')}` : ''}
                                </p>
                            )}
                        </section>
                        <section className="cm-card">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Candidate Profile</h2>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Phone</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.phone || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Stage</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.stage || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Department</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{displayDepartment}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Source</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.source || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Joining</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.joiningStatus || 'None'}</dd></div>
                                <div className="flex justify-between gap-4"><dt style={{ color: 'rgba(15,45,38,0.5)' }}>Overall score</dt><dd className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.scores?.overallScore != null ? Math.round(candidate.scores.overallScore) : '—'}</dd></div>
                            </dl>
                        </section>
                        <section className="cm-card">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Update Status</h2>
                            <div className="space-y-3">
                                <select className="cm-select w-full" value={status} onChange={(e) => setStatus(e.target.value)} disabled={screeningLocked}>
                                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <textarea className="cm-input w-full" rows={2} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} disabled={screeningLocked} />
                                <CmButton size="sm" disabled={busy || screeningLocked} onClick={updateStatus}>Save status</CmButton>
                            </div>
                            <h3 className="mb-2 mt-6 font-semibold" style={{ color: 'var(--ats-secondary)' }}>Scores</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {['resumeScore', 'technicalScore', 'culturalFitScore'].map((key) => (
                                    <input key={key} type="number" min="0" max="100" className="cm-input" placeholder={key.replace('Score', '')} value={scoreForm[key]} onChange={(e) => setScoreForm((p) => ({ ...p, [key]: e.target.value }))} disabled={screeningLocked} />
                                ))}
                            </div>
                            <CmButton size="sm" variant="outline" className="mt-2" disabled={busy || screeningLocked} onClick={saveScores}>Save scores</CmButton>
                        </section>
                        <section className="cm-card lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Documents</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl p-4" style={{ background: 'var(--ats-neutral)' }}>
                                    <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                        <FaFileAlt style={{ color: 'var(--ats-primary)' }} /> Resume
                                    </p>
                                    {candidate.resume?.url ? (
                                        <div className="mt-2 space-y-2">
                                            <p className="truncate text-sm" style={{ color: 'rgba(15,45,38,0.65)' }}>{candidate.resume.fileName || 'Resume file'}</p>
                                            {candidate.resume.uploadedAt && (
                                                <p className="text-xs" style={{ color: 'rgba(15,45,38,0.4)' }}>
                                                    Uploaded {format(new Date(candidate.resume.uploadedAt), 'dd MMM yyyy')}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={candidate.resume.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="cm-btn cm-btn--primary cm-btn--sm"
                                                >
                                                    <FaExternalLinkAlt className="h-2.5 w-2.5" /> View
                                                </a>
                                                <a
                                                    href={candidate.resume.url}
                                                    download={candidate.resume.fileName || 'resume'}
                                                    className="cm-btn cm-btn--outline cm-btn--sm"
                                                >
                                                    <FaDownload className="h-2.5 w-2.5" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No resume uploaded</p>
                                    )}
                                </div>
                                <div className="rounded-xl p-4" style={{ background: 'var(--ats-neutral)' }}>
                                    <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                        <FaFileAlt style={{ color: 'var(--ats-primary)' }} /> Cover letter
                                    </p>
                                    {candidate.coverLetterAttachment?.url ? (
                                        <div className="mt-2 space-y-2">
                                            <p className="truncate text-sm" style={{ color: 'rgba(15,45,38,0.65)' }}>
                                                {candidate.coverLetterAttachment.fileName || 'Cover letter file'}
                                            </p>
                                            {candidate.coverLetterAttachment.uploadedAt && (
                                                <p className="text-xs" style={{ color: 'rgba(15,45,38,0.4)' }}>
                                                    Uploaded {format(new Date(candidate.coverLetterAttachment.uploadedAt), 'dd MMM yyyy')}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={candidate.coverLetterAttachment.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="cm-btn cm-btn--primary cm-btn--sm"
                                                >
                                                    <FaExternalLinkAlt className="h-2.5 w-2.5" /> View
                                                </a>
                                                <a
                                                    href={candidate.coverLetterAttachment.url}
                                                    download={candidate.coverLetterAttachment.fileName || 'cover-letter'}
                                                    className="cm-btn cm-btn--outline cm-btn--sm"
                                                >
                                                    <FaDownload className="h-2.5 w-2.5" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    ) : candidate.coverLetter ? (
                                        <div className="mt-2">
                                            <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm" style={{ color: 'rgba(15,45,38,0.75)', border: '1px solid rgba(15,45,38,0.08)' }}>
                                                {candidate.coverLetter}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No cover letter uploaded</p>
                                    )}
                                </div>
                            </div>
                        </section>
                        <section className="cm-card lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Notes</h2>
                            {(candidate.notes || []).length ? (
                                <div className="space-y-2">
                                    {candidate.notes.map((n, index) => (
                                        <div key={index} className="rounded-lg p-3 text-sm" style={{ background: 'var(--ats-neutral)' }}>
                                            <p style={{ color: 'var(--ats-secondary)' }}>{n.note}</p>
                                            <p className="mt-1 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>{n.addedAt ? format(new Date(n.addedAt), 'dd MMM yyyy') : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No notes added.</p>}
                        </section>
                    </div>
                )}

                {activeTab === 'interview' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {screeningLocked && (
                            <p className="lg:col-span-2 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(229,62,62,0.08)', color: 'var(--ats-error)' }}>
                                Interview actions are disabled — this candidate failed resume screening.
                            </p>
                        )}
                        <section className={`cm-card ${screeningLocked ? 'pointer-events-none opacity-50' : ''}`}>
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Schedule Interview</h2>
                            <form onSubmit={scheduleInterview} className="space-y-3 text-sm">
                                <select className="cm-select w-full" value={interviewForm.interviewType} onChange={(e) => setInterviewForm((p) => ({ ...p, interviewType: e.target.value }))}>
                                    {['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final'].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <label className="block">
                                    <span className="ats-form-label">Interviewer *</span>
                                    <select
                                        required
                                        className="cm-select w-full"
                                        value={interviewForm.interviewer}
                                        onChange={(e) => setInterviewForm((p) => ({ ...p, interviewer: e.target.value }))}
                                    >
                                        <option value="">Select who will take the interview</option>
                                        {interviewers.map((emp) => (
                                            <option key={emp._id} value={emp._id}>
                                                {[emp.name, emp.lastName].filter(Boolean).join(' ')}
                                                {emp.department ? ` · ${emp.department}` : ''}
                                                {emp.email ? ` (${emp.email})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="ats-form-label">Date *</span>
                                    <input
                                        type="date"
                                        required
                                        className="cm-input w-full"
                                        value={interviewForm.scheduledDate}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (isWeekendDate(value)) {
                                                toast.error('Saturday and Sunday are off — pick a weekday');
                                                setInterviewForm((p) => ({ ...p, scheduledDate: '' }));
                                                return;
                                            }
                                            setInterviewForm((p) => ({ ...p, scheduledDate: value }));
                                        }}
                                    />
                                    <span className="ats-field-hint block">Weekdays only (Mon–Fri). Sat/Sun are off.</span>
                                </label>
                                <input type="time" className="cm-input w-full" value={interviewForm.scheduledTime} onChange={(e) => setInterviewForm((p) => ({ ...p, scheduledTime: e.target.value }))} />
                                <input className="cm-input w-full" placeholder="Location" value={interviewForm.location} onChange={(e) => setInterviewForm((p) => ({ ...p, location: e.target.value }))} />
                                <input className="cm-input w-full" placeholder="Meeting link" value={interviewForm.meetingLink} onChange={(e) => setInterviewForm((p) => ({ ...p, meetingLink: e.target.value }))} />
                                <CmButton type="submit" disabled={busy}>Schedule</CmButton>
                            </form>
                        </section>
                        <section className="cm-card lg:col-span-2">
                            <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Interviews</h2>
                            <p className="mb-4 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                Feedback belongs to each interview. Form appears only after status is <strong>Completed</strong>.
                                Assigned interviewers submit from Internal Jobs → My interviews; HR can review all feedback here.
                            </p>
                            {(candidate.interviewSchedule || []).length ? (
                                <div className="space-y-4">
                                    {candidate.interviewSchedule.map((item) => {
                                        const isCompleted = item.status === 'Completed';
                                        const hasFb = !!item.feedback?.submittedAt;
                                        const interviewerName = item.interviewer
                                            ? ([item.interviewer.name, item.interviewer.lastName].filter(Boolean).join(' ')
                                                || item.interviewer.email
                                                || 'Assigned')
                                            : 'Unassigned';
                                        const editingThis = feedbackForm.interviewId === item._id;
                                        return (
                                            <div key={item._id || `${item.scheduledDate}-${item.interviewType}`} className="rounded-xl p-4 text-sm" style={{ border: '1px solid rgba(15,45,38,0.08)' }}>
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                                            {item.interviewType || 'Interview'}
                                                            {candidate.jobPostingId?.jobTitle ? ` — ${candidate.jobPostingId.jobTitle}` : ''}
                                                        </p>
                                                        <p style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                            {item.scheduledDate ? format(new Date(item.scheduledDate), 'dd MMM yyyy') : 'No date'}
                                                            {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                                                            {item.location ? ` · ${item.location}` : ''}
                                                        </p>
                                                        <p className="mt-1" style={{ color: 'rgba(15,45,38,0.75)' }}>Interviewer: {interviewerName}</p>
                                                        {item.meetingLink && (
                                                            <a href={item.meetingLink} className="ats-link" target="_blank" rel="noreferrer">Join link</a>
                                                        )}
                                                    </div>
                                                    <AtsBadge status={item.status || 'Scheduled'}>{item.status || 'Scheduled'}</AtsBadge>
                                                </div>

                                                {!isCompleted && item.status !== 'Cancelled' && !screeningLocked && (
                                                    <div className="mt-3">
                                                        <p className="mb-2 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                            Feedback is hidden until this interview is Completed.
                                                        </p>
                                                        <CmButton
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={busy}
                                                            onClick={() => markInterviewCompleted(item._id)}
                                                            style={{ color: '#006c51', borderColor: 'rgba(28,202,155,0.4)' }}
                                                        >
                                                            Mark as Completed
                                                        </CmButton>
                                                    </div>
                                                )}

                                                {isCompleted && hasFb && (
                                                    <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(28,202,155,0.06)', border: '1px solid rgba(28,202,155,0.15)' }}>
                                                        <p className="font-semibold" style={{ color: '#006c51' }}>Interview Feedback</p>
                                                        <p className="mt-1" style={{ color: 'rgba(15,45,38,0.75)' }}>Interviewer: {interviewerName}</p>
                                                        <p style={{ color: 'rgba(15,45,38,0.75)' }}>
                                                            Recommendation: {item.feedback.recommendation || '—'}
                                                            {item.feedback.rating != null ? ` · Overall ${item.feedback.rating}/10` : ''}
                                                        </p>
                                                        <p style={{ color: 'rgba(15,45,38,0.6)' }}>
                                                            {item.feedback.technical != null ? `Tech ${item.feedback.technical}` : ''}
                                                            {item.feedback.communication != null ? ` · Comm ${item.feedback.communication}` : ''}
                                                            {item.feedback.behaviour != null ? ` · Behaviour ${item.feedback.behaviour}` : ''}
                                                        </p>
                                                        {item.feedback.comments && (
                                                            <p className="mt-2 whitespace-pre-wrap" style={{ color: 'rgba(15,45,38,0.75)' }}>{item.feedback.comments}</p>
                                                        )}
                                                        <p className="mt-2 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                            Submitted {item.feedback.submittedAt
                                                                ? format(new Date(item.feedback.submittedAt), 'dd MMM yyyy, h:mm a')
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                )}

                                                {isCompleted && !hasFb && !screeningLocked && (
                                                    <div className="mt-4 rounded-lg p-3" style={{ background: 'var(--ats-neutral)' }}>
                                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                            <h3 className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Submit Feedback</h3>
                                                            {!editingThis && (
                                                                <button
                                                                    type="button"
                                                                    className="ats-link !text-xs"
                                                                    onClick={() => setFeedbackForm((p) => ({
                                                                        ...p,
                                                                        interviewId: item._id,
                                                                        rating: '',
                                                                        technical: '',
                                                                        communication: '',
                                                                        behaviour: '',
                                                                        recommendation: 'Hire',
                                                                        comments: '',
                                                                    }))}
                                                                >
                                                                    Enter feedback
                                                                </button>
                                                            )}
                                                        </div>
                                                        {editingThis ? (
                                                            <form onSubmit={(e) => submitFeedback(e, item._id)} className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <input type="number" min="0" max="10" placeholder="Overall rating" className="cm-input" value={feedbackForm.rating} onChange={(e) => setFeedbackForm((p) => ({ ...p, rating: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Technical" className="cm-input" value={feedbackForm.technical} onChange={(e) => setFeedbackForm((p) => ({ ...p, technical: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Communication" className="cm-input" value={feedbackForm.communication} onChange={(e) => setFeedbackForm((p) => ({ ...p, communication: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Behaviour" className="cm-input" value={feedbackForm.behaviour} onChange={(e) => setFeedbackForm((p) => ({ ...p, behaviour: e.target.value }))} />
                                                                </div>
                                                                <select className="cm-select w-full" value={feedbackForm.recommendation} onChange={(e) => setFeedbackForm((p) => ({ ...p, recommendation: e.target.value }))}>
                                                                    {['Strong Hire', 'Hire', 'Maybe', 'No Hire'].map((r) => <option key={r} value={r}>{r}</option>)}
                                                                </select>
                                                                <textarea rows={3} className="cm-input w-full" placeholder="Comments" value={feedbackForm.comments} onChange={(e) => setFeedbackForm((p) => ({ ...p, comments: e.target.value }))} />
                                                                <div className="flex flex-wrap gap-2">
                                                                    <CmButton type="submit" size="sm" disabled={busy}>Save feedback</CmButton>
                                                                    <CmButton type="button" size="sm" variant="outline" onClick={() => setFeedbackForm((p) => ({ ...p, interviewId: '' }))}>Cancel</CmButton>
                                                                </div>
                                                            </form>
                                                        ) : (
                                                            <p className="text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                                                No feedback yet. Assigned interviewer can submit from My interviews, or HR can enter feedback here.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No interviews scheduled.</p>}
                        </section>
                    </div>
                )}

                {activeTab === 'assessments' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {screeningLocked && (
                            <p className="lg:col-span-2 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(229,62,62,0.08)', color: 'var(--ats-error)' }}>
                                Assessment actions are disabled — this candidate failed resume screening.
                            </p>
                        )}
                        <section className={`cm-card ${screeningLocked ? 'pointer-events-none opacity-50' : ''}`}>
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Assign Assessment</h2>
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    try {
                                        setBusy(true);
                                        await axios.post(`/v1/admin/recruitment/candidates/${id}/assessments`, {
                                            type: fd.get('type'),
                                            title: fd.get('title'),
                                            dueAt: fd.get('dueAt') || undefined,
                                            notes: fd.get('notes') || undefined,
                                        }, { withCredentials: true });
                                        toast.success('Assessment assigned');
                                        e.target.reset();
                                        fetchCandidate();
                                    } catch (err) {
                                        toast.error(err.response?.data?.message || 'Failed');
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                                className="space-y-3 text-sm"
                            >
                                <select name="type" className="cm-select w-full" defaultValue="MCQ">
                                    {['Coding', 'MCQ', 'Excel', 'Behaviour', 'Typing', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input name="title" required placeholder="Title" className="cm-input w-full" />
                                <input name="dueAt" type="date" className="cm-input w-full" />
                                <textarea name="notes" rows={2} placeholder="Notes / link instructions" className="cm-input w-full" />
                                <CmButton type="submit" disabled={busy}>Assign</CmButton>
                            </form>
                        </section>
                        <section className="cm-card">
                            <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Assigned</h2>
                            {(candidate.assessments || []).length === 0 ? (
                                <p className="text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No assessments yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {candidate.assessments.map((a) => (
                                        <div key={a._id} className="rounded-lg p-3 text-sm" style={{ border: '1px solid rgba(15,45,38,0.08)' }}>
                                            <p className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{a.type} — {a.title}</p>
                                            <p style={{ color: 'rgba(15,45,38,0.5)' }}>{a.status}{a.score != null ? ` · Score ${a.score}/${a.maxScore || 100}` : ''}</p>
                                            {a.status !== 'Completed' && (
                                                <button
                                                    type="button"
                                                    className="ats-link mt-2"
                                                    onClick={async () => {
                                                        const score = window.prompt('Score');
                                                        if (score == null) return;
                                                        try {
                                                            await axios.put(`/v1/admin/recruitment/candidates/${id}/assessments/${a._id}`, {
                                                                status: 'Completed',
                                                                score: Number(score),
                                                            }, { withCredentials: true });
                                                            toast.success('Updated');
                                                            fetchCandidate();
                                                        } catch (err) {
                                                            toast.error(err.response?.data?.message || 'Failed');
                                                        }
                                                    }}
                                                >
                                                    Mark completed + score
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'comms' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="cm-card">
                            <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Send email to candidate</h2>
                            {screeningLocked && (
                                <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(229,62,62,0.08)', color: 'var(--ats-error)' }}>
                                    Failed screening — outbound emails are blocked. You can still add internal logs below.
                                </p>
                            )}
                            {!candidate.email && (
                                <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}>
                                    No candidate email on file — cannot send.
                                </p>
                            )}
                            <div className="mb-6 flex flex-wrap gap-2">
                                {EMAIL_ACTION_BUTTONS.map((btn) => (
                                    <button
                                        key={btn.type}
                                        type="button"
                                        disabled={busy || screeningLocked || !candidate.email}
                                        title={btn.needs}
                                        className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                        style={{ background: 'rgba(28,202,155,0.1)', color: '#006c51', border: '1px solid rgba(28,202,155,0.25)' }}
                                        onClick={() => sendQuickEmail(btn.type)}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <p className="mb-1 text-xs" style={{ color: 'rgba(15,45,38,0.4)' }}>
                                Click a button to open a short form — assign a job/role and complete any missing interview details, then send.
                            </p>

                            <h3 className="mb-1 mt-6 text-base font-semibold" style={{ color: 'var(--ats-secondary)' }}>Log internal record</h3>
                            <form onSubmit={logComm} className="space-y-3 text-sm">
                                <select
                                    className="cm-select w-full"
                                    value={commForm.channel}
                                    onChange={(e) => setCommForm((p) => ({ ...p, channel: e.target.value }))}
                                >
                                    {[
                                        { value: 'note', label: 'note (internal)' },
                                        { value: 'call', label: 'call (log only)' },
                                        { value: 'meeting', label: 'meeting (log only)' },
                                        { value: 'email', label: 'email (log only — does not send)' },
                                        { value: 'sms', label: 'sms (log only — does not send)' },
                                        { value: 'whatsapp', label: 'whatsapp (log only — does not send)' },
                                    ].map((c) => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <input
                                    className="cm-input w-full"
                                    placeholder="Subject (optional)"
                                    value={commForm.subject}
                                    onChange={(e) => setCommForm((p) => ({ ...p, subject: e.target.value }))}
                                />
                                <textarea
                                    required
                                    rows={4}
                                    className="cm-input w-full"
                                    placeholder="Body / internal notes"
                                    value={commForm.body}
                                    onChange={(e) => setCommForm((p) => ({ ...p, body: e.target.value }))}
                                />
                                <CmButton type="submit" disabled={busy}>
                                    Log (HR only)
                                </CmButton>
                            </form>
                        </section>

                        <section className="cm-card">
                            <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Communication timeline</h2>
                            <div className="mb-4 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(56,161,255,0.12)', color: '#1a5aa8' }}>Inbound</span>
                                <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(28,202,155,0.15)', color: '#006c51' }}>Outbound (emailed)</span>
                                <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(255,127,80,0.15)', color: '#c45a2a' }}>Internal</span>
                            </div>
                            {(candidate.communications || []).length ? (
                                <div className="relative max-h-[32rem] space-y-0 overflow-y-auto border-l-2 pl-4" style={{ borderColor: 'rgba(15,45,38,0.1)' }}>
                                    {[...candidate.communications].reverse().map((c, i) => {
                                        const cls = classifyCommunication(c);
                                        const dotColor = cls.kind === 'inbound' ? '#38a1ff' : cls.kind === 'outbound' ? 'var(--ats-primary)' : 'var(--ats-tertiary)';
                                        const badgeStyle = cls.kind === 'inbound'
                                            ? { background: 'rgba(56,161,255,0.12)', color: '#1a5aa8' }
                                            : cls.kind === 'outbound'
                                                ? { background: 'rgba(28,202,155,0.15)', color: '#006c51' }
                                                : { background: 'rgba(255,127,80,0.15)', color: '#c45a2a' };
                                        const typeLabel = c.emailType
                                            ? (EMAIL_TYPE_LABELS[c.emailType] || c.emailType)
                                            : null;
                                        return (
                                            <div key={i} className="relative mb-4 pb-2">
                                                <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full" style={{ background: dotColor }} />
                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={badgeStyle}>
                                                        {cls.label}
                                                    </span>
                                                    {c.autoLogged && (
                                                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase" style={{ background: 'rgba(15,45,38,0.06)', color: 'rgba(15,45,38,0.55)' }}>
                                                            auto
                                                        </span>
                                                    )}
                                                    <span className="text-xs" style={{ color: 'rgba(15,45,38,0.4)' }}>
                                                        {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy HH:mm') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium capitalize" style={{ color: 'var(--ats-secondary)' }}>
                                                    {c.channel}
                                                    {typeLabel ? ` · ${typeLabel}` : ''}
                                                </p>
                                                <p className="text-[11px]" style={{ color: 'rgba(15,45,38,0.4)' }}>{cls.hint}</p>
                                                {c.subject && <p className="mt-1" style={{ color: 'rgba(15,45,38,0.75)' }}>{c.subject}</p>}
                                                <p className="text-sm whitespace-pre-wrap" style={{ color: 'rgba(15,45,38,0.65)' }}>{c.body}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                    No communications yet.
                                    {candidate.source === 'Email'
                                        ? ' After Resume Inbox import, inbound resume email should appear here; send an invite to add outbound history.'
                                        : ' Send an email or log a note to start the history.'}
                                </p>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'offer' && (
                    <section className="cm-card">
                        {screeningLocked ? (
                            <p className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(229,62,62,0.08)', color: 'var(--ats-error)' }}>
                                Offer letter actions are disabled — this candidate failed resume screening.
                            </p>
                        ) : (
                            <OfferLetterPanel candidateId={candidate._id} candidate={candidate} onRefresh={fetchCandidate} />
                        )}
                    </section>
                )}

            <HireEmployeeModal
                candidateId={id}
                open={hireOpen}
                onClose={() => setHireOpen(false)}
                onSuccess={() => { setHireOpen(false); fetchCandidate(); }}
            />

            {emailPrep && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>
                                    {EMAIL_TYPE_LABELS[emailPrep.type] || 'Send email'}
                                </h3>
                                <p className="mt-1 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                    Complete the fields below, then send. The email goes to{' '}
                                    <span className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{candidate.email}</span>.
                                </p>
                            </div>
                            <button type="button" onClick={() => setEmailPrep(null)} className="ats-back !mb-0">
                                <FaTimes className="h-3.5 w-3.5" /> Close
                            </button>
                        </div>

                        <form onSubmit={submitEmailPrep} className="mt-4 space-y-3 text-sm">
                            <div>
                                <label className="ats-form-label">Job / Role *</label>
                                <select
                                    required
                                    className="cm-select w-full"
                                    value={emailPrep.jobPostingId}
                                    onChange={(e) => setEmailPrep((p) => ({ ...p, jobPostingId: e.target.value }))}
                                >
                                    <option value="">Select a job posting…</option>
                                    {jobOptions.map((j) => (
                                        <option key={j._id} value={j._id}>
                                            {j.jobTitle}{j.department ? ` · ${j.department}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {!emailPrep.jobPostingId && (
                                    <p className="mt-1 text-xs" style={{ color: '#c45a2a' }}>
                                        Required — Resume Inbox “Unassigned” cannot be used in the email.
                                    </p>
                                )}
                            </div>

                            {INTERVIEW_EMAIL_TYPES.has(emailPrep.type) && (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="ats-form-label">Interview type *</label>
                                            <select
                                                className="cm-select w-full"
                                                value={emailPrep.interviewType}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, interviewType: e.target.value }))}
                                            >
                                                {['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final'].map((t) => (
                                                    <option key={t} value={t}>{t === 'On-site' ? 'In-Person (On-site)' : t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="ats-form-label">Interviewer {!emailPrep.interviewId ? '*' : ''}</label>
                                            <select
                                                className="cm-select w-full"
                                                value={emailPrep.interviewer}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, interviewer: e.target.value }))}
                                                required={!emailPrep.interviewId}
                                            >
                                                <option value="">Select interviewer…</option>
                                                {interviewers.map((emp) => (
                                                    <option key={emp._id} value={emp._id}>
                                                        {[emp.name, emp.lastName].filter(Boolean).join(' ') || emp.email}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="ats-form-label">Date *</label>
                                            <input
                                                type="date"
                                                required
                                                className="cm-input w-full"
                                                value={emailPrep.scheduledDate}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, scheduledDate: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="ats-form-label">Time *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. 10:00 – 11:00"
                                                className="cm-input w-full"
                                                value={emailPrep.scheduledTime}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, scheduledTime: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="ats-form-label">Meeting link</label>
                                        <input
                                            type="url"
                                            placeholder="https://…"
                                            className="cm-input w-full"
                                            value={emailPrep.meetingLink}
                                            onChange={(e) => setEmailPrep((p) => ({ ...p, meetingLink: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="ats-form-label">Location</label>
                                        <input
                                            type="text"
                                            placeholder="Office / dial-in details"
                                            className="cm-input w-full"
                                            value={emailPrep.location}
                                            onChange={(e) => setEmailPrep((p) => ({ ...p, location: e.target.value }))}
                                        />
                                    </div>
                                </>
                            )}

                            {emailPrep.type === 'joining_reminder' && (
                                <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}>
                                    Joining date and hiring state must already be set on the candidate. This form assigns the job title used in the email.
                                </p>
                            )}

                            {emailPrep.type === 'offer_reminder' && (
                                <p className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}>
                                    A sent offer with portal link is still required. This form assigns the job title used in the email.
                                </p>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <CmButton
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => setEmailPrep(null)}
                                >
                                    Cancel
                                </CmButton>
                                <CmButton
                                    type="submit"
                                    disabled={busy}
                                >
                                    {busy ? 'Sending…' : 'Save & send email'}
                                </CmButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AtsPage>
    );
};

export default CandidateDetailPage;
