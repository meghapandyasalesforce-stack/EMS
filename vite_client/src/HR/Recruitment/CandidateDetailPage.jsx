import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaBriefcase, FaCalendarAlt, FaComments, FaFileContract, FaUser, FaFileAlt, FaExternalLinkAlt, FaDownload,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import OfferLetterPanel from '../../components/recruitment/OfferLetterPanel';
import HireEmployeeModal from '../../components/recruitment/HireEmployeeModal';
import { normalizeResumeScreening, getScreeningBadgeClasses } from '../../utils/resumeScreeningDisplay';

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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="w-full">
                <button
                    type="button"
                    onClick={() => navigate('/recruitment')}
                    className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    <FaArrowLeft /> Back to Recruitment
                </button>

                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                            <p className="mt-1 text-sm text-gray-600">{candidate.email}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
                                <span className="inline-flex items-center gap-1"><FaBriefcase /> {candidate.jobPostingId?.jobTitle || 'No job linked'}</span>
                                <span className="inline-flex items-center gap-1"><FaCalendarAlt /> Applied {candidate.applicationDate ? format(new Date(candidate.applicationDate), 'dd MMM yyyy') : '—'}</span>
                            </div>
                            {candidate.blacklist?.isBlacklisted && (
                                <p className="mt-2 text-sm font-medium text-red-600">Blacklisted: {candidate.blacklist.reason || '—'}</p>
                            )}
                            {screeningLocked && (
                                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                                    Failed Screening — read-only. Match {screening.matchScore != null ? `${screening.matchScore}%` : '—'}
                                    {screening.deleteAfterDate
                                        ? ` - Auto-delete after ${format(new Date(screening.deleteAfterDate), 'dd MMM yyyy')}`
                                        : ''}
                                </p>
                            )}
                        </div>
                        <span className={`self-start rounded-full px-3 py-1 text-sm font-semibold ${
                            candidate.status === 'Offer Accepted' || candidate.stage === 'Hired' ? 'bg-emerald-100 text-emerald-800'
                                : candidate.status === 'Withdrawn' ? 'bg-red-100 text-red-800'
                                    : getScreeningBadgeClasses(screening)
                        }`}>
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
                        </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                        {candidate.linkedEmployeeId ? (
                            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
                                Employee: {candidate.linkedEmployeeId.employeeId || candidate.linkedEmployeeId._id}
                            </span>
                        ) : (
                            <button
                                type="button"
                                disabled={busy || screeningLocked}
                                onClick={() => setHireOpen(true)}
                                className="rounded-lg bg-theme-secondary px-3 py-1.5 text-sm text-white hover:bg-theme-primary disabled:opacity-50"
                            >
                                Hire → Create Employee
                            </button>
                        )}
                        <button type="button" disabled={busy || screeningLocked} onClick={() => runAction('joining', { joiningStatus: 'Confirmed' })} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Confirm Joining</button>
                        <button type="button" disabled={busy || screeningLocked} onClick={() => {
                            const reason = window.prompt('Withdraw reason');
                            if (reason) runAction('withdraw', { reason });
                        }} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Withdraw</button>
                        <button type="button" disabled={busy} onClick={() => {
                            const reason = window.prompt('Blacklist reason');
                            if (reason) runAction('blacklist', { reason });
                        }} className="rounded-lg border px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Blacklist</button>
                        <button type="button" disabled={busy} onClick={() => runAction('archive', {})} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">Archive</button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={hardDelete}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            Delete
                        </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1 border-t border-gray-100 pt-4">
                        {TABS.map(({ id: tabId, label, icon: Icon }) => (
                            <button
                                key={tabId}
                                type="button"
                                onClick={() => setActiveTab(tabId)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                                    activeTab === tabId ? 'bg-theme-primary/10 text-theme-primary' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <Icon className="text-xs" /> {label}
                            </button>
                        ))}
                    </div>
                </section>

                {activeTab === 'overview' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Resume Screening</h2>
                            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                                <div>
                                    <dt className="text-gray-500">Status</dt>
                                    <dd className={`mt-0.5 font-semibold ${
                                        screening.isPassed ? 'text-emerald-700'
                                            : screening.isRejected ? 'text-red-700'
                                                : 'text-amber-800'
                                    }`}>
                                        {screeningLabel}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Match Score</dt>
                                    <dd className="mt-0.5 font-semibold text-gray-800">{screening.matchScore != null ? `${screening.matchScore}%` : '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Minimum Required</dt>
                                    <dd className="mt-0.5 font-semibold text-gray-800">{screening.minimumRequired != null ? `${screening.minimumRequired}%` : '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500">Screening Date</dt>
                                    <dd className="mt-0.5 font-semibold text-gray-800">{screening.screeningDate ? format(new Date(screening.screeningDate), 'dd MMM yyyy HH:mm') : '—'}</dd>
                                </div>
                            </dl>
                            {screening.reason && (
                                <p className={`mt-3 text-sm ${screening.isRejected ? 'text-red-700' : 'text-amber-800'}`}>
                                    Reason: {screening.reason}
                                </p>
                            )}
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-gray-500">Matched Keywords</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(screening.matchedKeywords || []).length === 0
                                            ? <span className="text-sm text-gray-400">—</span>
                                            : screening.matchedKeywords.map((k) => (
                                                <span key={k} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{k}</span>
                                            ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase text-gray-500">Missing Keywords</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(screening.missingKeywords || []).length === 0
                                            ? <span className="text-sm text-gray-400">—</span>
                                            : screening.missingKeywords.map((k) => (
                                                <span key={k} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800">{k}</span>
                                            ))}
                                    </div>
                                </div>
                            </div>
                            {screening.rejectedDate && (
                                <p className="mt-3 text-xs text-gray-500">
                                    Rejected {format(new Date(screening.rejectedDate), 'dd MMM yyyy')}
                                    {screening.deleteAfterDate ? ` - Delete after ${format(new Date(screening.deleteAfterDate), 'dd MMM yyyy')}` : ''}
                                </p>
                            )}
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Candidate Profile</h2>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Phone</dt><dd className="font-medium text-gray-800">{candidate.phone || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Stage</dt><dd className="font-medium text-gray-800">{candidate.stage || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Department</dt><dd className="font-medium text-gray-800">{displayDepartment}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Source</dt><dd className="font-medium text-gray-800">{candidate.source || '—'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Joining</dt><dd className="font-medium text-gray-800">{candidate.joiningStatus || 'None'}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Overall score</dt><dd className="font-medium text-gray-800">{candidate.scores?.overallScore != null ? Math.round(candidate.scores.overallScore) : '—'}</dd></div>
                            </dl>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Update Status</h2>
                            <div className="space-y-3">
                                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} disabled={screeningLocked}>
                                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} disabled={screeningLocked} />
                                <button type="button" disabled={busy || screeningLocked} onClick={updateStatus} className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white disabled:opacity-60">Save status</button>
                            </div>
                            <h3 className="mb-2 mt-6 font-semibold text-gray-800">Scores</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {['resumeScore', 'technicalScore', 'culturalFitScore'].map((key) => (
                                    <input key={key} type="number" min="0" max="100" className="rounded-lg border px-2 py-1.5 text-sm" placeholder={key.replace('Score', '')} value={scoreForm[key]} onChange={(e) => setScoreForm((p) => ({ ...p, [key]: e.target.value }))} disabled={screeningLocked} />
                                ))}
                            </div>
                            <button type="button" disabled={busy || screeningLocked} onClick={saveScores} className="mt-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60">Save scores</button>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Documents</h2>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <FaFileAlt className="text-theme-secondary" /> Resume
                                    </p>
                                    {candidate.resume?.url ? (
                                        <div className="mt-2 space-y-2">
                                            <p className="truncate text-sm text-gray-600">{candidate.resume.fileName || 'Resume file'}</p>
                                            {candidate.resume.uploadedAt && (
                                                <p className="text-xs text-gray-400">
                                                    Uploaded {format(new Date(candidate.resume.uploadedAt), 'dd MMM yyyy')}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={candidate.resume.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-theme-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-theme-primary"
                                                >
                                                    <FaExternalLinkAlt className="h-2.5 w-2.5" /> View
                                                </a>
                                                <a
                                                    href={candidate.resume.url}
                                                    download={candidate.resume.fileName || 'resume'}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                >
                                                    <FaDownload className="h-2.5 w-2.5" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-500">No resume uploaded</p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <FaFileAlt className="text-theme-secondary" /> Cover letter
                                    </p>
                                    {candidate.coverLetterAttachment?.url ? (
                                        <div className="mt-2 space-y-2">
                                            <p className="truncate text-sm text-gray-600">
                                                {candidate.coverLetterAttachment.fileName || 'Cover letter file'}
                                            </p>
                                            {candidate.coverLetterAttachment.uploadedAt && (
                                                <p className="text-xs text-gray-400">
                                                    Uploaded {format(new Date(candidate.coverLetterAttachment.uploadedAt), 'dd MMM yyyy')}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={candidate.coverLetterAttachment.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-theme-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-theme-primary"
                                                >
                                                    <FaExternalLinkAlt className="h-2.5 w-2.5" /> View
                                                </a>
                                                <a
                                                    href={candidate.coverLetterAttachment.url}
                                                    download={candidate.coverLetterAttachment.fileName || 'cover-letter'}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                >
                                                    <FaDownload className="h-2.5 w-2.5" /> Download
                                                </a>
                                            </div>
                                        </div>
                                    ) : candidate.coverLetter ? (
                                        <div className="mt-2">
                                            <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                                                {candidate.coverLetter}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-500">No cover letter uploaded</p>
                                    )}
                                </div>
                            </div>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold text-gray-800">Notes</h2>
                            {(candidate.notes || []).length ? (
                                <div className="space-y-2">
                                    {candidate.notes.map((n, index) => (
                                        <div key={index} className="rounded-lg bg-gray-50 p-3 text-sm">
                                            <p>{n.note}</p>
                                            <p className="mt-1 text-xs text-gray-500">{n.addedAt ? format(new Date(n.addedAt), 'dd MMM yyyy') : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-gray-500">No notes added.</p>}
                        </section>
                    </div>
                )}

                {activeTab === 'interview' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {screeningLocked && (
                            <p className="lg:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
                                Interview actions are disabled — this candidate failed resume screening.
                            </p>
                        )}
                        <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${screeningLocked ? 'pointer-events-none opacity-50' : ''}`}>
                            <h2 className="mb-4 text-lg font-semibold">Schedule Interview</h2>
                            <form onSubmit={scheduleInterview} className="space-y-3 text-sm">
                                <select className="w-full rounded-lg border px-3 py-2" value={interviewForm.interviewType} onChange={(e) => setInterviewForm((p) => ({ ...p, interviewType: e.target.value }))}>
                                    {['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final'].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <label className="block">
                                    <span className="mb-1 block font-medium text-gray-700">Interviewer *</span>
                                    <select
                                        required
                                        className="w-full rounded-lg border px-3 py-2"
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
                                    <span className="mb-1 block font-medium text-gray-700">Date *</span>
                                    <input
                                        type="date"
                                        required
                                        className="w-full rounded-lg border px-3 py-2"
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
                                    <span className="mt-1 block text-xs text-gray-500">Weekdays only (Mon–Fri). Sat/Sun are off.</span>
                                </label>
                                <input type="time" className="w-full rounded-lg border px-3 py-2" value={interviewForm.scheduledTime} onChange={(e) => setInterviewForm((p) => ({ ...p, scheduledTime: e.target.value }))} />
                                <input className="w-full rounded-lg border px-3 py-2" placeholder="Location" value={interviewForm.location} onChange={(e) => setInterviewForm((p) => ({ ...p, location: e.target.value }))} />
                                <input className="w-full rounded-lg border px-3 py-2" placeholder="Meeting link" value={interviewForm.meetingLink} onChange={(e) => setInterviewForm((p) => ({ ...p, meetingLink: e.target.value }))} />
                                <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Schedule</button>
                            </form>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-1 text-lg font-semibold">Interviews</h2>
                            <p className="mb-4 text-xs text-gray-500">
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
                                            <div key={item._id || `${item.scheduledDate}-${item.interviewType}`} className="rounded-xl border border-gray-200 p-4 text-sm">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold text-gray-900">
                                                            {item.interviewType || 'Interview'}
                                                            {candidate.jobPostingId?.jobTitle ? ` — ${candidate.jobPostingId.jobTitle}` : ''}
                                                        </p>
                                                        <p className="text-gray-500">
                                                            {item.scheduledDate ? format(new Date(item.scheduledDate), 'dd MMM yyyy') : 'No date'}
                                                            {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                                                            {item.location ? ` · ${item.location}` : ''}
                                                        </p>
                                                        <p className="mt-1 text-gray-700">Interviewer: {interviewerName}</p>
                                                        {item.meetingLink && (
                                                            <a href={item.meetingLink} className="text-theme-secondary hover:underline" target="_blank" rel="noreferrer">Join link</a>
                                                        )}
                                                    </div>
                                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        isCompleted ? 'bg-emerald-100 text-emerald-800'
                                                            : item.status === 'Cancelled' ? 'bg-red-100 text-red-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {item.status || 'Scheduled'}
                                                    </span>
                                                </div>

                                                {!isCompleted && item.status !== 'Cancelled' && !screeningLocked && (
                                                    <div className="mt-3">
                                                        <p className="mb-2 text-xs text-gray-500">
                                                            Feedback is hidden until this interview is Completed.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            disabled={busy}
                                                            onClick={() => markInterviewCompleted(item._id)}
                                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                                                        >
                                                            Mark as Completed
                                                        </button>
                                                    </div>
                                                )}

                                                {isCompleted && hasFb && (
                                                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                                                        <p className="font-semibold text-emerald-900">Interview Feedback</p>
                                                        <p className="mt-1 text-gray-700">Interviewer: {interviewerName}</p>
                                                        <p className="text-gray-700">
                                                            Recommendation: {item.feedback.recommendation || '—'}
                                                            {item.feedback.rating != null ? ` · Overall ${item.feedback.rating}/10` : ''}
                                                        </p>
                                                        <p className="text-gray-600">
                                                            {item.feedback.technical != null ? `Tech ${item.feedback.technical}` : ''}
                                                            {item.feedback.communication != null ? ` · Comm ${item.feedback.communication}` : ''}
                                                            {item.feedback.behaviour != null ? ` · Behaviour ${item.feedback.behaviour}` : ''}
                                                        </p>
                                                        {item.feedback.comments && (
                                                            <p className="mt-2 whitespace-pre-wrap text-gray-700">{item.feedback.comments}</p>
                                                        )}
                                                        <p className="mt-2 text-xs text-gray-500">
                                                            Submitted {item.feedback.submittedAt
                                                                ? format(new Date(item.feedback.submittedAt), 'dd MMM yyyy, h:mm a')
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                )}

                                                {isCompleted && !hasFb && !screeningLocked && (
                                                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                            <h3 className="font-semibold text-gray-800">Submit Feedback</h3>
                                                            {!editingThis && (
                                                                <button
                                                                    type="button"
                                                                    className="text-xs font-medium text-theme-secondary hover:underline"
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
                                                                    <input type="number" min="0" max="10" placeholder="Overall rating" className="rounded-lg border px-3 py-2" value={feedbackForm.rating} onChange={(e) => setFeedbackForm((p) => ({ ...p, rating: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Technical" className="rounded-lg border px-3 py-2" value={feedbackForm.technical} onChange={(e) => setFeedbackForm((p) => ({ ...p, technical: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Communication" className="rounded-lg border px-3 py-2" value={feedbackForm.communication} onChange={(e) => setFeedbackForm((p) => ({ ...p, communication: e.target.value }))} />
                                                                    <input type="number" min="0" max="10" placeholder="Behaviour" className="rounded-lg border px-3 py-2" value={feedbackForm.behaviour} onChange={(e) => setFeedbackForm((p) => ({ ...p, behaviour: e.target.value }))} />
                                                                </div>
                                                                <select className="w-full rounded-lg border px-3 py-2" value={feedbackForm.recommendation} onChange={(e) => setFeedbackForm((p) => ({ ...p, recommendation: e.target.value }))}>
                                                                    {['Strong Hire', 'Hire', 'Maybe', 'No Hire'].map((r) => <option key={r} value={r}>{r}</option>)}
                                                                </select>
                                                                <textarea rows={3} className="w-full rounded-lg border px-3 py-2" placeholder="Comments" value={feedbackForm.comments} onChange={(e) => setFeedbackForm((p) => ({ ...p, comments: e.target.value }))} />
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Save feedback</button>
                                                                    <button type="button" className="rounded-lg border px-3 py-2 text-gray-600" onClick={() => setFeedbackForm((p) => ({ ...p, interviewId: '' }))}>Cancel</button>
                                                                </div>
                                                            </form>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">
                                                                No feedback yet. Assigned interviewer can submit from My interviews, or HR can enter feedback here.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-sm text-gray-500">No interviews scheduled.</p>}
                        </section>
                    </div>
                )}

                {activeTab === 'assessments' && (
                    <div className="grid gap-6 lg:grid-cols-2">
                        {screeningLocked && (
                            <p className="lg:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
                                Assessment actions are disabled — this candidate failed resume screening.
                            </p>
                        )}
                        <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${screeningLocked ? 'pointer-events-none opacity-50' : ''}`}>
                            <h2 className="mb-4 text-lg font-semibold">Assign Assessment</h2>
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
                                <select name="type" className="w-full rounded-lg border px-3 py-2" defaultValue="MCQ">
                                    {['Coding', 'MCQ', 'Excel', 'Behaviour', 'Typing', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input name="title" required placeholder="Title" className="w-full rounded-lg border px-3 py-2" />
                                <input name="dueAt" type="date" className="w-full rounded-lg border px-3 py-2" />
                                <textarea name="notes" rows={2} placeholder="Notes / link instructions" className="w-full rounded-lg border px-3 py-2" />
                                <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Assign</button>
                            </form>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold">Assigned</h2>
                            {(candidate.assessments || []).length === 0 ? (
                                <p className="text-sm text-gray-500">No assessments yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {candidate.assessments.map((a) => (
                                        <div key={a._id} className="rounded-lg border p-3 text-sm">
                                            <p className="font-medium">{a.type} — {a.title}</p>
                                            <p className="text-gray-500">{a.status}{a.score != null ? ` · Score ${a.score}/${a.maxScore || 100}` : ''}</p>
                                            {a.status !== 'Completed' && (
                                                <button
                                                    type="button"
                                                    className="mt-2 text-theme-secondary hover:underline"
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
                    <div className="space-y-6">
                        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                            {/* <p className="font-medium">HR communication hub (not visible to candidates)</p>
                            <p className="mt-1 text-sky-800/90">
                                Quick actions send a <strong>real email</strong> to{' '}
                                <span className="font-semibold">{candidate.email || '— no email on file —'}</span>
                                {' '}(Gmail / Outlook / etc.). The candidate does not see this EMS timeline.
                                {candidate.source === 'Email' ? (
                                    <span className="mt-1 block">
                                        Applied via <strong>Email / Resume Inbox</strong> — same send &amp; log tools as Career Portal applicants.
                                    </span>
                                ) : (
                                    <span className="mt-1 block">
                                        Source: <strong>{candidate.source || '—'}</strong>
                                    </span>
                                )}
                            </p> */}
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                                <h2 className="mb-1 text-lg font-semibold text-gray-800">Send email to candidate</h2>
                                {/* <p className="mb-4 text-xs text-gray-500">
                                    Sends one real email and adds one auto-logged outbound entry to the timeline.
                                </p> */}
                                {screeningLocked && (
                                    <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                                        Failed screening — outbound emails are blocked. You can still add internal logs below.
                                    </p>
                                )}
                                {!candidate.email && (
                                    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                                            onClick={() => sendQuickEmail(btn.type)}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mb-1 text-xs text-gray-400">
                                    Click a button to open a short form — assign a job/role and complete any missing interview details, then send.
                                </p>

                                <h3 className="mb-1 mt-6 text-base font-semibold text-gray-800">Log internal record</h3>
                                {/* <p className="mb-3 text-xs text-gray-500">
                                    Saves an HR-only history entry. Does <strong>not</strong> send email, SMS, or WhatsApp.
                                </p> */}
                                <form onSubmit={logComm} className="space-y-3 text-sm">
                                    <select
                                        className="w-full rounded-lg border px-3 py-2"
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
                                        className="w-full rounded-lg border px-3 py-2"
                                        placeholder="Subject (optional)"
                                        value={commForm.subject}
                                        onChange={(e) => setCommForm((p) => ({ ...p, subject: e.target.value }))}
                                    />
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full rounded-lg border px-3 py-2"
                                        placeholder="Body / internal notes"
                                        value={commForm.body}
                                        onChange={(e) => setCommForm((p) => ({ ...p, body: e.target.value }))}
                                    />
                                    <button
                                        type="submit"
                                        disabled={busy}
                                        className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60"
                                    >
                                        Log (HR only)
                                    </button>
                                </form>
                            </section>

                            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                                <h2 className="mb-1 text-lg font-semibold text-gray-800">Communication timeline</h2>
                                {/* <p className="mb-4 text-xs text-gray-500">
                                    HR history only — inbound mailbox, outbound emails, and internal logs.
                                </p> */}
                                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">Inbound</span>
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Outbound (emailed)</span>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Internal</span>
                                </div>
                                {(candidate.communications || []).length ? (
                                    <div className="relative max-h-[32rem] space-y-0 overflow-y-auto border-l-2 border-gray-200 pl-4">
                                        {[...candidate.communications].reverse().map((c, i) => {
                                            const cls = classifyCommunication(c);
                                            const typeLabel = c.emailType
                                                ? (EMAIL_TYPE_LABELS[c.emailType] || c.emailType)
                                                : null;
                                            return (
                                                <div key={i} className="relative mb-4 pb-2">
                                                    <span className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full ${
                                                        cls.kind === 'inbound' ? 'bg-sky-500'
                                                            : cls.kind === 'outbound' ? 'bg-emerald-500'
                                                                : 'bg-amber-500'
                                                    }`}
                                                    />
                                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls.badge}`}>
                                                            {cls.label}
                                                        </span>
                                                        {c.autoLogged && (
                                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600">
                                                                auto
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-400">
                                                            {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy HH:mm') : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium capitalize text-gray-800">
                                                        {c.channel}
                                                        {typeLabel ? ` · ${typeLabel}` : ''}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400">{cls.hint}</p>
                                                    {c.subject && <p className="mt-1 text-gray-700">{c.subject}</p>}
                                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        No communications yet.
                                        {candidate.source === 'Email'
                                            ? ' After Resume Inbox import, inbound resume email should appear here; send an invite to add outbound history.'
                                            : ' Send an email or log a note to start the history.'}
                                    </p>
                                )}
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'offer' && (
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        {screeningLocked ? (
                            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
                                Offer letter actions are disabled — this candidate failed resume screening.
                            </p>
                        ) : (
                            <OfferLetterPanel candidateId={candidate._id} candidate={candidate} onRefresh={fetchCandidate} />
                        )}
                    </section>
                )}
            </div>

            <HireEmployeeModal
                candidateId={id}
                open={hireOpen}
                onClose={() => setHireOpen(false)}
                onSuccess={() => { setHireOpen(false); fetchCandidate(); }}
            />

            {emailPrep && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {EMAIL_TYPE_LABELS[emailPrep.type] || 'Send email'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Complete the fields below, then send. The email goes to{' '}
                            <span className="font-medium text-gray-800">{candidate.email}</span>.
                        </p>

                        <form onSubmit={submitEmailPrep} className="mt-4 space-y-3 text-sm">
                            <div>
                                <label className="mb-1 block font-medium text-gray-700">Job / Role *</label>
                                <select
                                    required
                                    className="w-full rounded-lg border px-3 py-2"
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
                                    <p className="mt-1 text-xs text-amber-700">
                                        Required — Resume Inbox “Unassigned” cannot be used in the email.
                                    </p>
                                )}
                            </div>

                            {INTERVIEW_EMAIL_TYPES.has(emailPrep.type) && (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block font-medium text-gray-700">Interview type *</label>
                                            <select
                                                className="w-full rounded-lg border px-3 py-2"
                                                value={emailPrep.interviewType}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, interviewType: e.target.value }))}
                                            >
                                                {['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final'].map((t) => (
                                                    <option key={t} value={t}>{t === 'On-site' ? 'In-Person (On-site)' : t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block font-medium text-gray-700">Interviewer {!emailPrep.interviewId ? '*' : ''}</label>
                                            <select
                                                className="w-full rounded-lg border px-3 py-2"
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
                                            <label className="mb-1 block font-medium text-gray-700">Date *</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full rounded-lg border px-3 py-2"
                                                value={emailPrep.scheduledDate}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, scheduledDate: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block font-medium text-gray-700">Time *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. 10:00 – 11:00"
                                                className="w-full rounded-lg border px-3 py-2"
                                                value={emailPrep.scheduledTime}
                                                onChange={(e) => setEmailPrep((p) => ({ ...p, scheduledTime: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block font-medium text-gray-700">Meeting link</label>
                                        <input
                                            type="url"
                                            placeholder="https://…"
                                            className="w-full rounded-lg border px-3 py-2"
                                            value={emailPrep.meetingLink}
                                            onChange={(e) => setEmailPrep((p) => ({ ...p, meetingLink: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block font-medium text-gray-700">Location</label>
                                        <input
                                            type="text"
                                            placeholder="Office / dial-in details"
                                            className="w-full rounded-lg border px-3 py-2"
                                            value={emailPrep.location}
                                            onChange={(e) => setEmailPrep((p) => ({ ...p, location: e.target.value }))}
                                        />
                                    </div>
                                </>
                            )}

                            {emailPrep.type === 'joining_reminder' && (
                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    Joining date and hiring state must already be set on the candidate. This form assigns the job title used in the email.
                                </p>
                            )}

                            {emailPrep.type === 'offer_reminder' && (
                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    A sent offer with portal link is still required. This form assigns the job title used in the email.
                                </p>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    onClick={() => setEmailPrep(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-50"
                                >
                                    {busy ? 'Sending…' : 'Save & send email'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CandidateDetailPage;
