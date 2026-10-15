import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    FiPlus,
    FiCalendar,
    FiClock,
    FiMapPin,
    FiVideo,
    FiEdit2,
    FiXCircle,
    FiLoader,
    FiBell,
    FiCheck,
    FiX,
    FiRefreshCw,
    FiMessageSquare,
} from 'react-icons/fi';
import LoadingSpinner from '../LoadingSpinner';
import { isManager } from '../../utils/managerHelper';
import { getAuthActorIds, getAuthEmployeeId } from '../../utils/authUser';
import { sanitizeMeetingLink } from '../../utils/meetingLink';
const TEAL = '#0a8f6c';
const TEAL_LIGHT = '#14b887';
const PAGE_BG = '#f4f7f6';
const GREY_BORDER = '#e2e8f0';

const TABS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'pending', label: 'Pending Requests' },
    { key: 'reschedule', label: 'Reschedule Requests' },
    { key: 'history', label: 'Completed / History' },
];

const ACTIVE = new Set(['Pending', 'Accepted', 'Reschedule Requested', 'Rescheduled', 'Scheduled']);

function MeetingStatusPill({ status, onAccent = false }) {
    const map = {
        Pending: { label: 'Pending', style: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' } },
        Accepted: { label: 'Accepted', style: { background: `${TEAL}14`, color: TEAL, border: `1px solid ${TEAL}44` } },
        Scheduled: { label: 'Scheduled', style: { background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' } },
        Declined: { label: 'Declined', style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' } },
        'Reschedule Requested': { label: 'Reschedule requested', style: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' } },
        Rescheduled: { label: 'Rescheduled', style: { background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' } },
        Completed: { label: 'Completed', style: { background: `${TEAL}14`, color: TEAL, border: `1px solid ${TEAL}44` } },
        Cancelled: { label: 'Cancelled', style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' } },
        'No Show': { label: 'No show', style: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' } },
    };
    const m = map[status] || map.Pending;
    const style = onAccent
        ? { background: 'rgba(255,255,255,0.95)', color: TEAL, border: '1px solid rgba(255,255,255,0.6)' }
        : m.style;
    return (
        <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm" style={style}>
            {m.label}
        </span>
    );
}

const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25';

const personName = (p) => (p ? `${p.name || ''} ${p.lastName || ''}`.trim() : 'Unknown');

const OneOnOneMeetingHub = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [searchParams] = useSearchParams();

    const userRole = user?.role || employee?.role;
    const canSchedule = userRole === 'admin' || isManager(user || employee);

    /** All IDs that may represent the logged-in person (session only — not a browsed employee profile). */
    const actorIds = useMemo(() => getAuthActorIds(user, employee), [user, employee]);

    const currentUserId = useMemo(
        () => String(getAuthEmployeeId(user) || [...actorIds][0] || ''),
        [user, actorIds]
    );

    const matchesActor = useCallback(
        (ref) => {
            if (ref == null) return false;
            return actorIds.has(String(ref._id || ref.id || ref));
        },
        [actorIds]
    );

    const [meetings, setMeetings] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [peerManagers, setPeerManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [selectedId, setSelectedId] = useState(searchParams.get('meetingId') || '');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [noteDrafts, setNoteDrafts] = useState({});
    const [expandedNotes, setExpandedNotes] = useState({});
    const [showRescheduleModal, setShowRescheduleModal] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({ proposedDate: '', proposedTime: '', note: '' });
    const [participantMode, setParticipantMode] = useState('team'); // team | manager

    const [formData, setFormData] = useState({
        employeeId: '',
        scheduledDate: '',
        scheduledTime: '',
        duration: 30,
        location: '',
        meetingLink: '',
        agenda: [{ topic: '', notes: '', discussed: false }],
    });

    const fetchMeetings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', { withCredentials: true });
            setMeetings(response.data?.data || []);
        } catch {
            toast.error('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchParticipants = useCallback(async () => {
        if (!canSchedule) return;
        try {
            const response = await axios.get('/v1/both/one-on-one/eligible-participants', { withCredentials: true });
            const data = response.data?.data || {};
            setTeamMembers(data.teamMembers || []);
            setPeerManagers(data.peerManagers || []);
        } catch {
            // Fallback to all employees for admins
            try {
                const response = await axios.get('/v1/employee/auth/get-all-employees', {
                    params: { limit: 500 },
                    withCredentials: true,
                });
                const all = response.data?.data || response.data?.employees || [];
                setTeamMembers(all.filter((e) => String(e._id) !== String(currentUserId)));
                setPeerManagers([]);
            } catch {
                toast.error('Failed to load participants');
            }
        }
    }, [canSchedule, currentUserId]);

    useEffect(() => {
        fetchMeetings();
        fetchParticipants();
    }, [fetchMeetings, fetchParticipants]);

    useEffect(() => {
        const mid = searchParams.get('meetingId');
        if (mid) {
            setSelectedId(mid);
            const m = meetings.find((x) => String(x._id) === String(mid));
            if (m) {
                if (m.status === 'Pending') setActiveTab('pending');
                else if (m.status === 'Reschedule Requested') setActiveTab('reschedule');
                else if (['Completed', 'Cancelled', 'Declined', 'No Show'].includes(m.status)) setActiveTab('history');
                else setActiveTab('upcoming');
            }
        }
    }, [searchParams, meetings]);

    const filteredMeetings = useMemo(() => {
        return meetings.filter((m) => {
            if (activeTab === 'pending') return m.status === 'Pending';
            if (activeTab === 'reschedule') return m.status === 'Reschedule Requested';
            // History: only real terminal statuses (not "past date" loophole)
            if (activeTab === 'history') {
                return ['Completed', 'Cancelled', 'Declined', 'No Show'].includes(m.status);
            }
            // Upcoming: active meetings regardless of scheduled date
            return ACTIVE.has(m.status) && !['Declined', 'Cancelled'].includes(m.status);
        }).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    }, [meetings, activeTab]);

    const tabCounts = useMemo(() => ({
        upcoming: meetings.filter((m) => ACTIVE.has(m.status) && !['Declined', 'Cancelled'].includes(m.status)).length,
        pending: meetings.filter((m) => m.status === 'Pending').length,
        reschedule: meetings.filter((m) => m.status === 'Reschedule Requested').length,
        history: meetings.filter((m) => ['Completed', 'Cancelled', 'Declined', 'No Show'].includes(m.status)).length,
    }), [meetings]);

    const isInviteeOf = (m) => {
        if (!m) return false;
        if (m.myRole === 'invitee') return true;
        if (m.myRole === 'organizer' || m.myRole === 'neither') return false;
        return matchesActor(m.employeeId);
    };
    const isOrganizerOf = (m) => {
        if (!m) return false;
        if (m.myRole === 'organizer') return true;
        if (m.myRole === 'invitee' || m.myRole === 'neither') return false;
        return matchesActor(m.managerId);
    };
    const isParticipantOf = (m) => isInviteeOf(m) || isOrganizerOf(m);

    const counterpartName = (m) => {
        if (!m) return '';
        if (isOrganizerOf(m)) return personName(m.employeeId);
        return personName(m.managerId);
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            scheduledDate: '',
            scheduledTime: '',
            duration: 30,
            location: '',
            meetingLink: '',
            agenda: [{ topic: '', notes: '', discussed: false }],
        });
        setParticipantMode('team');
        setEditingMeeting(null);
    };

    const openCreate = () => {
        resetForm();
        setShowCreateModal(true);
    };

    const openEdit = (meeting) => {
        setEditingMeeting(meeting);
        const meetingDate = new Date(meeting.scheduledDate);
        setFormData({
            employeeId: meeting.employeeId?._id || meeting.employeeId,
            scheduledDate: format(meetingDate, 'yyyy-MM-dd'),
            scheduledTime: meeting.scheduledTime || '',
            duration: meeting.duration || 30,
            location: meeting.location || '',
            meetingLink: sanitizeMeetingLink(meeting.meetingLink),
            agenda: meeting.agenda?.length ? meeting.agenda : [{ topic: '', notes: '', discussed: false }],
        });
        setShowCreateModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.employeeId || !formData.scheduledDate || !formData.scheduledTime) {
            toast.warning('Please fill in all required fields');
            return;
        }
        if (String(formData.employeeId) === String(currentUserId)) {
            toast.warning('You cannot schedule a meeting with yourself');
            return;
        }
        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString(),
                agenda: formData.agenda.filter((item) => item.topic.trim() !== ''),
            };
            if (editingMeeting) {
                await axios.put(`/v1/both/one-on-one/one-on-ones/${editingMeeting._id}`, payload, { withCredentials: true });
                toast.success('Meeting updated');
            } else {
                await axios.post('/v1/both/one-on-one/one-on-ones', payload, { withCredentials: true });
                toast.success('Meeting scheduled — invitation sent');
            }
            setShowCreateModal(false);
            resetForm();
            fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const runAction = async (fn, successMsg) => {
        try {
            setSubmitting(true);
            await fn();
            if (successMsg) toast.success(successMsg);
            await fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAccept = (id) =>
        runAction(() => axios.patch(`/v1/both/one-on-one/one-on-ones/${id}/accept`, {}, { withCredentials: true }), 'Meeting accepted');

    const handleDecline = (id) => {
        if (!window.confirm('Decline this meeting invitation?')) return;
        return runAction(() => axios.patch(`/v1/both/one-on-one/one-on-ones/${id}/decline`, {}, { withCredentials: true }), 'Meeting declined');
    };

    const submitReschedule = async () => {
        if (!showRescheduleModal || !rescheduleForm.proposedDate || !rescheduleForm.proposedTime) {
            toast.warning('Please choose a new date and time');
            return;
        }
        await runAction(async () => {
            await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${showRescheduleModal}/request-reschedule`,
                {
                    proposedDate: new Date(`${rescheduleForm.proposedDate}T${rescheduleForm.proposedTime}`).toISOString(),
                    proposedTime: rescheduleForm.proposedTime,
                    note: rescheduleForm.note,
                },
                { withCredentials: true }
            );
            setShowRescheduleModal(null);
            setRescheduleForm({ proposedDate: '', proposedTime: '', note: '' });
        }, 'Reschedule requested');
    };

    const acceptReschedule = (id) =>
        runAction(
            () => axios.patch(`/v1/both/one-on-one/one-on-ones/${id}/accept-reschedule`, {}, { withCredentials: true }),
            'New time accepted'
        );

    const rejectReschedule = (id) =>
        runAction(
            () => axios.patch(`/v1/both/one-on-one/one-on-ones/${id}/reject-reschedule`, {}, { withCredentials: true }),
            'Reschedule declined'
        );

    const saveNote = async (meetingId) => {
        const draft = (noteDrafts[meetingId] || '').trim();
        if (!meetingId || !draft) {
            toast.info('Enter a note first');
            return;
        }
        try {
            setSubmitting(true);
            const res = await axios.post(
                `/v1/both/one-on-one/one-on-ones/${meetingId}/notes`,
                { content: draft },
                { withCredentials: true }
            );
            const updated = res.data?.data;
            if (updated) {
                setMeetings((prev) => prev.map((m) => (String(m._id) === String(updated._id) ? updated : m)));
            } else {
                await fetchMeetings();
            }
            setNoteDrafts((prev) => ({ ...prev, [meetingId]: '' }));
            setExpandedNotes((prev) => ({ ...prev, [meetingId]: true }));
            toast.success('Note saved — visible to both participants');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save note');
        } finally {
            setSubmitting(false);
        }
    };

    const participantOptions = participantMode === 'manager' ? peerManagers : teamMembers;

    const openReschedule = (meeting) => {
        setShowRescheduleModal(meeting._id);
        setRescheduleForm({
            proposedDate: format(new Date(meeting.scheduledDate), 'yyyy-MM-dd'),
            proposedTime: meeting.scheduledTime || '',
            note: '',
        });
    };

    useEffect(() => {
        if (!selectedId) return;
        const el = document.getElementById(`meeting-card-${selectedId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [selectedId, filteredMeetings]);

    if (loading) {
        return <LoadingSpinner message="Loading one-on-one meetings..." />;
    }

    return (
        <div className="page-shell min-h-screen transition-all duration-300" style={{ background: PAGE_BG }}>
            <div className="page-shell-inner hrms-stack">
                <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                            One-on-One Meetings
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Schedule, respond, reschedule, and keep shared notes — synchronized for both participants.
                        </p>
                    </div>
                    {canSchedule ? (
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                            style={{ background: TEAL }}
                        >
                            <FiPlus className="h-4 w-4" />
                            Schedule meeting
                        </button>
                    ) : null}
                </header>

                <section className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Meeting views">
                    {TABS.map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.key)}
                                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition ${
                                    active ? 'ring-2 ring-[#0a8f6c] ring-offset-2 ring-offset-[#f4f7f6]' : ''
                                }`}
                                style={{
                                    borderColor: active ? TEAL : GREY_BORDER,
                                    background: active ? `${TEAL}12` : '#fff',
                                    color: active ? TEAL : '#475569',
                                }}
                            >
                                {tab.label} ({tabCounts[tab.key] || 0})
                            </button>
                        );
                    })}
                </section>

                <section>
                    {filteredMeetings.length === 0 ? (
                        <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
                            <FiCalendar className="mb-3 h-10 w-10 text-slate-300" />
                            <p className="text-sm font-medium text-slate-700">No meetings in this view</p>
                            {canSchedule && activeTab === 'upcoming' ? (
                                <button
                                    type="button"
                                    onClick={openCreate}
                                    className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                                    style={{ background: TEAL }}
                                >
                                    Schedule your first meeting
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex w-full flex-wrap justify-start gap-5">
                            {filteredMeetings.map((meeting) => {
                                const highlighted = String(meeting._id) === String(selectedId);
                                const notesOpen = expandedNotes[meeting._id] || highlighted;
                                const notes = meeting.meetingNotes || [];
                                const initials = counterpartName(meeting)
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((p) => p[0]?.toUpperCase())
                                    .join('') || '?';

                                return (
                                    <article
                                        key={meeting._id}
                                        id={`meeting-card-${meeting._id}`}
                                        className={`flex w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                                            highlighted ? 'border-[#0a8f6c] ring-2 ring-[#0a8f6c]/30' : 'border-slate-100'
                                        }`}
                                    >
                                        <div
                                            className="relative flex flex-col items-center px-5 pb-5 pt-6 text-center text-white"
                                            style={{
                                                background: `linear-gradient(160deg, ${TEAL} 0%, ${TEAL_LIGHT} 100%)`,
                                            }}
                                        >
                                            <div className="absolute right-3 top-3">
                                                <MeetingStatusPill status={meeting.status} onAccent />
                                            </div>
                                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-lg font-bold ring-2 ring-white/40">
                                                {initials}
                                            </div>
                                            <h2 className="w-full truncate px-1 text-base font-bold leading-tight">
                                                {counterpartName(meeting)}
                                            </h2>
                                            <p className="mt-1 w-full truncate text-xs text-white/85">
                                                with {personName(meeting.managerId)}
                                            </p>
                                            {meeting.meetingKind === 'manager_manager' ? (
                                                <span className="mt-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                                    Mgr ↔ Mgr
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                                                    <FiCalendar className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {format(new Date(meeting.scheduledDate), 'EEE, MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                                                    <FiClock className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <p className="text-sm font-medium text-slate-800">
                                                        {meeting.scheduledTime || 'TBD'} · {meeting.duration || 30} min
                                                    </p>
                                                </div>
                                                {meeting.location ? (
                                                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                                                        <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <p className="truncate text-sm font-medium text-slate-800">
                                                            {meeting.location}
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {meeting.status === 'Reschedule Requested' &&
                                            meeting.rescheduleProposal?.proposedDate ? (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                                                    <p className="font-bold">Proposed new time</p>
                                                    <p className="mt-0.5">
                                                        {format(
                                                            new Date(meeting.rescheduleProposal.proposedDate),
                                                            'MMM d, yyyy'
                                                        )}
                                                        {meeting.rescheduleProposal.proposedTime
                                                            ? ` at ${meeting.rescheduleProposal.proposedTime}`
                                                            : ''}
                                                    </p>
                                                </div>
                                            ) : null}

                                            {meeting.agenda?.length > 0 ? (
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Agenda
                                                    </p>
                                                    <ul className="space-y-1 text-sm text-slate-700">
                                                        {meeting.agenda.map((item, idx) => (
                                                            <li key={idx}>
                                                                • {item.topic}
                                                                {item.notes ? ` — ${item.notes}` : ''}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : null}

                                            <div className="mt-auto flex flex-col gap-2">
                                                {ACTIVE.has(meeting.status) ||
                                                meeting.status === 'Pending Response' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const link = sanitizeMeetingLink(meeting.meetingLink);
                                                            if (!link) {
                                                                toast.info(
                                                                    'No meeting link yet. Add one when scheduling or editing the meeting.'
                                                                );
                                                                return;
                                                            }
                                                            window.open(link, '_blank', 'noopener,noreferrer');
                                                        }}
                                                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition hover:bg-teal-50"
                                                        style={{
                                                            borderColor: sanitizeMeetingLink(meeting.meetingLink)
                                                                ? `${TEAL}44`
                                                                : GREY_BORDER,
                                                            color: sanitizeMeetingLink(meeting.meetingLink)
                                                                ? TEAL
                                                                : '#64748b',
                                                        }}
                                                    >
                                                        <FiVideo className="h-4 w-4" />
                                                        Join meeting
                                                    </button>
                                                ) : null}

                                                {isInviteeOf(meeting) &&
                                                !isOrganizerOf(meeting) &&
                                                ['Pending', 'Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status) ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={submitting}
                                                            onClick={() => handleAccept(meeting._id)}
                                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white"
                                                            style={{ background: TEAL }}
                                                        >
                                                            <FiCheck /> Accept
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={submitting}
                                                            onClick={() => handleDecline(meeting._id)}
                                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700"
                                                        >
                                                            <FiX /> Decline
                                                        </button>
                                                    </>
                                                ) : null}

                                                {isParticipantOf(meeting) &&
                                                ACTIVE.has(meeting.status) &&
                                                meeting.status !== 'Reschedule Requested' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openReschedule(meeting)}
                                                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800"
                                                    >
                                                        <FiRefreshCw /> Reschedule
                                                    </button>
                                                ) : null}

                                                {meeting.status === 'Reschedule Requested' &&
                                                isParticipantOf(meeting) &&
                                                !matchesActor(meeting.rescheduleProposal?.proposedBy) ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={submitting}
                                                            onClick={() => acceptReschedule(meeting._id)}
                                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white"
                                                            style={{ background: TEAL }}
                                                        >
                                                            <FiCheck /> Accept new time
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={submitting}
                                                            onClick={() => rejectReschedule(meeting._id)}
                                                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold text-slate-700"
                                                        >
                                                            Keep original
                                                        </button>
                                                    </>
                                                ) : null}

                                                {isOrganizerOf(meeting) && ACTIVE.has(meeting.status) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(meeting)}
                                                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border bg-white px-4 py-2.5 text-xs font-semibold text-slate-700"
                                                        style={{ borderColor: GREY_BORDER }}
                                                    >
                                                        <FiEdit2 /> Edit
                                                    </button>
                                                ) : null}
                                            </div>

                                            <div className="border-t border-slate-100 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedNotes((prev) => ({
                                                            ...prev,
                                                            [meeting._id]: !notesOpen,
                                                        }))
                                                    }
                                                    className="mb-2 flex w-full items-center justify-between gap-2 text-left"
                                                >
                                                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                                                        <FiMessageSquare style={{ color: TEAL }} />
                                                        Shared notes
                                                        {notes.length > 0 ? (
                                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                                {notes.length}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        {notesOpen ? 'Hide' : 'Show'}
                                                    </span>
                                                </button>

                                                {notesOpen ? (
                                                    <div>
                                                        <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                                                            {notes.length === 0 ? (
                                                                <p className="text-sm text-slate-500">No notes yet.</p>
                                                            ) : (
                                                                [...notes]
                                                                    .sort(
                                                                        (a, b) =>
                                                                            new Date(b.createdAt) - new Date(a.createdAt)
                                                                    )
                                                                    .map((note) => {
                                                                        const mine = matchesActor(note.authorId);
                                                                        return (
                                                                            <div
                                                                                key={note._id}
                                                                                className={`rounded-xl border px-3 py-2 ${
                                                                                    mine
                                                                                        ? 'border-[#0a8f6c]/35 bg-[#0a8f6c]/08'
                                                                                        : 'border-slate-100 bg-slate-50'
                                                                                }`}
                                                                            >
                                                                                <p className="whitespace-pre-wrap text-sm text-slate-800">
                                                                                    {note.content}
                                                                                </p>
                                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                                    {mine
                                                                                        ? 'You'
                                                                                        : note.authorName ||
                                                                                          personName(note.authorId)}{' '}
                                                                                    ·{' '}
                                                                                    {note.createdAt
                                                                                        ? format(
                                                                                              new Date(note.createdAt),
                                                                                              'MMM d, yyyy h:mm a'
                                                                                          )
                                                                                        : ''}
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    })
                                                            )}
                                                        </div>
                                                        {isParticipantOf(meeting) &&
                                                        !['Cancelled', 'Declined'].includes(meeting.status) ? (
                                                            <div className="flex flex-col gap-2">
                                                                <textarea
                                                                    value={noteDrafts[meeting._id] || ''}
                                                                    onChange={(e) =>
                                                                        setNoteDrafts((prev) => ({
                                                                            ...prev,
                                                                            [meeting._id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    className={inputClass}
                                                                    rows={2}
                                                                    placeholder="Write a note — the other participant will see it…"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={submitting}
                                                                    onClick={() => saveNote(meeting._id)}
                                                                    className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white"
                                                                    style={{ background: TEAL }}
                                                                >
                                                                    Save note
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {showCreateModal && canSchedule ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingMeeting ? 'Edit meeting' : 'Schedule one-on-one'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Invite a team member or another manager.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                            >
                                <FiXCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!editingMeeting ? (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setParticipantMode('team');
                                            setFormData((f) => ({ ...f, employeeId: '' }));
                                        }}
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                            participantMode === 'team' ? 'text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                        style={participantMode === 'team' ? { background: TEAL } : undefined}
                                    >
                                        Team member
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setParticipantMode('manager');
                                            setFormData((f) => ({ ...f, employeeId: '' }));
                                        }}
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                            participantMode === 'manager' ? 'text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                        style={participantMode === 'manager' ? { background: TEAL } : undefined}
                                    >
                                        Another manager
                                    </button>
                                </div>
                            ) : null}

                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {participantMode === 'manager' ? 'Manager' : 'Employee'} <span className="text-red-600">*</span>
                                </label>
                                <select
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    className={inputClass}
                                    required
                                    disabled={!!editingMeeting}
                                >
                                    <option value="">
                                        {participantMode === 'manager' ? 'Select manager' : 'Select employee'}
                                    </option>
                                    {participantOptions.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName}
                                            {emp.position ? ` · ${emp.position}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {participantMode === 'manager' && peerManagers.length === 0 ? (
                                    <p className="mt-1 text-xs text-slate-500">No other managers found in your organization.</p>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Date <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.scheduledDate}
                                        onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                        className={inputClass}
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Time <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.scheduledTime}
                                        onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.duration}
                                        onChange={(e) =>
                                            setFormData({ ...formData, duration: parseInt(e.target.value, 10) || 30 })
                                        }
                                        className={inputClass}
                                        min={15}
                                        step={15}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. Conference room A"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Meeting link (optional)
                                </label>
                                <input
                                    type="url"
                                    value={formData.meetingLink}
                                    onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                    className={inputClass}
                                    placeholder="https://…"
                                />
                            </div>

                            <div className="border-t border-slate-100 pt-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-slate-900">Agenda</h4>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData({
                                                ...formData,
                                                agenda: [...formData.agenda, { topic: '', notes: '', discussed: false }],
                                            })
                                        }
                                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm"
                                        style={{ background: TEAL }}
                                    >
                                        <FiPlus className="h-3.5 w-3.5" />
                                        Add item
                                    </button>
                                </div>
                                {formData.agenda.map((item, index) => (
                                    <div key={index} className="mb-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">Item {index + 1}</span>
                                            {formData.agenda.length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setFormData({
                                                            ...formData,
                                                            agenda: formData.agenda.filter((_, i) => i !== index),
                                                        })
                                                    }
                                                    className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                                                >
                                                    <FiXCircle className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                        <input
                                            type="text"
                                            value={item.topic}
                                            onChange={(e) => {
                                                const agenda = [...formData.agenda];
                                                agenda[index] = { ...agenda[index], topic: e.target.value };
                                                setFormData({ ...formData, agenda });
                                            }}
                                            className={`${inputClass} mb-2`}
                                            placeholder="Topic"
                                        />
                                        <textarea
                                            value={item.notes}
                                            onChange={(e) => {
                                                const agenda = [...formData.agenda];
                                                agenda[index] = { ...agenda[index], notes: e.target.value };
                                                setFormData({ ...formData, agenda });
                                            }}
                                            className={inputClass}
                                            rows={2}
                                            placeholder="Details (optional)"
                                        />
                                    </div>
                                ))}
                            </div>

                            {!editingMeeting ? (
                                <div
                                    className="flex gap-3 rounded-xl border px-4 py-3 text-sm"
                                    style={{ background: `${TEAL}0d`, borderColor: `${TEAL}33`, color: TEAL }}
                                >
                                    <FiBell className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p>The invitee will receive a notification and can Accept, Decline, or Propose a reschedule.</p>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50"
                                    style={{ background: TEAL }}
                                >
                                    {submitting ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
                                    {editingMeeting ? 'Update meeting' : 'Schedule meeting'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showRescheduleModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">Reschedule meeting</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Either participant can propose a new time. The other person must accept it.
                        </p>
                        <div className="mt-4 space-y-3">
                            <input
                                type="date"
                                className={inputClass}
                                value={rescheduleForm.proposedDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, proposedDate: e.target.value })}
                            />
                            <input
                                type="time"
                                className={inputClass}
                                value={rescheduleForm.proposedTime}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, proposedTime: e.target.value })}
                            />
                            <textarea
                                className={inputClass}
                                rows={2}
                                placeholder="Optional note"
                                value={rescheduleForm.note}
                                onChange={(e) => setRescheduleForm({ ...rescheduleForm, note: e.target.value })}
                            />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                                onClick={() => setShowRescheduleModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={submitReschedule}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                                style={{ background: TEAL }}
                            >
                                Send request
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default OneOnOneMeetingHub;
