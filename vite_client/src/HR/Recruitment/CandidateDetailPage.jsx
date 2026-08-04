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
            toast.success('Interview scheduled — interviewer notified');
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
            await axios.post(`/v1/admin/recruitment/candidates/${id}/communication`, commForm, { withCredentials: true });
            toast.success('Logged');
            setCommForm({ channel: 'note', subject: '', body: '' });
            fetchCandidate();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to log');
        } finally {
            setBusy(false);
        }
    };

    const submitFeedback = async (e) => {
        e.preventDefault();
        if (!feedbackForm.interviewId) {
            toast.error('Select an interview');
            return;
        }
        try {
            setBusy(true);
            await axios.put(
                `/v1/admin/recruitment/candidates/${id}/interview/${feedbackForm.interviewId}`,
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
                                <div className="flex justify-between gap-4"><dt className="text-gray-500">Department</dt><dd className="font-medium text-gray-800">{candidate.jobPostingId?.department || '—'}</dd></div>
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
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold">Submit Feedback</h2>
                            <form onSubmit={submitFeedback} className="space-y-3 text-sm">
                                <select required className="w-full rounded-lg border px-3 py-2" value={feedbackForm.interviewId} onChange={(e) => setFeedbackForm((p) => ({ ...p, interviewId: e.target.value }))}>
                                    <option value="">Select interview</option>
                                    {(candidate.interviewSchedule || []).map((item) => (
                                        <option key={item._id} value={item._id}>
                                            {item.interviewType} — {item.scheduledDate ? format(new Date(item.scheduledDate), 'dd MMM yyyy') : 'No date'} ({item.status})
                                        </option>
                                    ))}
                                </select>
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
                                <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Save feedback</button>
                            </form>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
                            <h2 className="mb-4 text-lg font-semibold">Scheduled / Feedback history</h2>
                            {(candidate.interviewSchedule || []).length ? (
                                <div className="space-y-3">
                                    {candidate.interviewSchedule.map((item) => (
                                        <div key={item._id || `${item.scheduledDate}-${item.interviewType}`} className="rounded-lg border p-3 text-sm">
                                            <p className="font-medium">{item.interviewType || 'Interview'} — {item.status || 'Scheduled'}</p>
                                            <p className="text-gray-500">
                                                {item.scheduledDate ? format(new Date(item.scheduledDate), 'dd MMM yyyy') : ''}
                                                {item.scheduledTime ? ` ${item.scheduledTime}` : ''}
                                            </p>
                                            {item.interviewer && (
                                                <p className="mt-1 text-gray-700">
                                                    Interviewer:{' '}
                                                    {[item.interviewer.name, item.interviewer.lastName].filter(Boolean).join(' ')
                                                        || item.interviewer.email
                                                        || 'Assigned'}
                                                </p>
                                            )}
                                            {item.meetingLink && <a href={item.meetingLink} className="text-theme-secondary hover:underline" target="_blank" rel="noreferrer">Join link</a>}
                                            {item.feedback?.submittedAt && (
                                                <p className="mt-2 text-gray-700">
                                                    Feedback: {item.feedback.recommendation || '—'}
                                                    {item.feedback.rating != null ? ` · Rating ${item.feedback.rating}` : ''}
                                                    {item.feedback.technical != null ? ` · Tech ${item.feedback.technical}` : ''}
                                                    {item.feedback.communication != null ? ` · Comm ${item.feedback.communication}` : ''}
                                                    {item.feedback.behaviour != null ? ` · Behaviour ${item.feedback.behaviour}` : ''}
                                                    {item.feedback.comments ? ` — ${item.feedback.comments}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    ))}
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
                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold">Send / Log communication</h2>
                            <div className="mb-4 flex flex-wrap gap-2">
                                {[
                                    { type: 'interview_invite', label: 'Interview Invite' },
                                    { type: 'interview_reminder', label: 'Interview Reminder' },
                                    { type: 'offer_reminder', label: 'Offer Reminder' },
                                    { type: 'joining_reminder', label: 'Joining Reminder' },
                                ].map((btn) => (
                                    <button
                                        key={btn.type}
                                        type="button"
                                        disabled={busy}
                                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                                        onClick={async () => {
                                            try {
                                                setBusy(true);
                                                await axios.post(`/v1/admin/recruitment/candidates/${id}/send-email`, { type: btn.type }, { withCredentials: true });
                                                toast.success('Email sent & logged');
                                                fetchCandidate();
                                            } catch (err) {
                                                toast.error(err.response?.data?.message || 'Send failed');
                                            } finally {
                                                setBusy(false);
                                            }
                                        }}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                            <form onSubmit={logComm} className="space-y-3 text-sm">
                                <select className="w-full rounded-lg border px-3 py-2" value={commForm.channel} onChange={(e) => setCommForm((p) => ({ ...p, channel: e.target.value }))}>
                                    {['email', 'sms', 'whatsapp', 'call', 'meeting', 'note'].map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input className="w-full rounded-lg border px-3 py-2" placeholder="Subject" value={commForm.subject} onChange={(e) => setCommForm((p) => ({ ...p, subject: e.target.value }))} />
                                <textarea required rows={4} className="w-full rounded-lg border px-3 py-2" placeholder="Body / notes" value={commForm.body} onChange={(e) => setCommForm((p) => ({ ...p, body: e.target.value }))} />
                                <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Log</button>
                            </form>
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold">Timeline</h2>
                            {(candidate.communications || []).length ? (
                                <div className="relative space-y-0 border-l-2 border-gray-200 pl-4">
                                    {[...candidate.communications].reverse().map((c, i) => (
                                        <div key={i} className="relative mb-4 pb-2">
                                            <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-theme-secondary" />
                                            <p className="text-xs uppercase tracking-wide text-gray-400">
                                                {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy HH:mm') : ''}
                                                {c.autoLogged ? ' · auto' : ''}
                                            </p>
                                            <p className="font-medium capitalize">{c.channel} · {c.direction}{c.emailType ? ` · ${c.emailType}` : ''}</p>
                                            {c.subject && <p className="text-gray-700">{c.subject}</p>}
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-gray-500">No communications logged.</p>}
                        </section>
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
        </div>
    );
};

export default CandidateDetailPage;
