import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    FiPlus,
    FiCalendar,
    FiClock,
    FiMapPin,
    FiVideo,
    FiSlash,
    FiEdit2,
    FiXCircle,
    FiLoader,
    FiBell,
    FiUser,
} from 'react-icons/fi';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';
import { useAuthPermissions } from '../../Hooks/useAuthPermissions';
import MeetingNotesPanel from '../../components/MeetingNotesPanel';

const TEAL = '#0a8f6c';
const TEAL_LIGHT = '#14b887';
const PAGE_BG = '#f4f7f6';
const GREY_BORDER = '#e2e8f0';

const FILTER_KEYS = ['all', 'Pending Response', 'Scheduled', 'Completed', 'Cancelled', 'Declined'];

function MeetingStatusPill({ status }) {
    const map = {
        'Pending Response': {
            label: 'Pending Response',
            style: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
        },
        Scheduled: {
            label: 'Scheduled',
            style: { background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' },
        },
        Completed: {
            label: 'Completed',
            style: { background: `${TEAL}14`, color: TEAL, border: `1px solid ${TEAL}44` },
        },
        Cancelled: {
            label: 'Cancelled',
            style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
        },
        Declined: {
            label: 'Declined',
            style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
        },
        Rescheduled: {
            label: 'Reschedule Pending',
            style: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
        },
        'No Show': {
            label: 'No show',
            style: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
        },
    };
    const m = map[status] || map.Scheduled;
    return (
        <span
            className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={m.style}
        >
            {m.label}
        </span>
    );
}

const inputClass =
    'w-full min-h-[48px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#0a8f6c] focus:outline-none focus:ring-1 focus:ring-[#0a8f6c]/30 sm:min-h-[44px] sm:py-2.5 sm:text-sm';

const OneOnOnePage = ({ onBackToReceive = null, focusMeetingId: focusMeetingIdProp = '' } = {}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusMeetingId = focusMeetingIdProp || searchParams.get('meetingId') || '';
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const { isHrManager, isHrExecutive, isOrgOwner } = useAuthPermissions();

    const goToMyOneOnOne = () => {
        if (typeof onBackToReceive === 'function') {
            onBackToReceive();
            return;
        }
        navigate('/1-on-1');
    };

    const isHrUser = useMemo(() => {
        if (isHrManager || isHrExecutive || isOrgOwner) return true;
        return isHR(user) || isHR(employee);
    }, [user, employee, isHrManager, isHrExecutive, isOrgOwner]);

    const canSchedule = true;

    /** HR/admin can invite many company employees in one schedule action */
    const canInviteMany = Boolean(isHrUser || isOrgOwner || (user?.role || employee?.role) === 'admin');

    const [meetings, setMeetings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [submitting, setSubmitting] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [notesMeeting, setNotesMeeting] = useState(null);

    const [formData, setFormData] = useState({
        employeeId: '',
        employeeIds: [],
        scheduledDate: '',
        scheduledTime: '',
        duration: 30,
        location: '',
        meetingLink: '',
        agenda: [{ topic: '', notes: '', discussed: false }],
    });

    const lastErrorToastAt = React.useRef(0);
    const showLoadError = (message) => {
        const now = Date.now();
        if (now - lastErrorToastAt.current < 4000) return;
        lastErrorToastAt.current = now;
        toast.error(message);
    };

    useEffect(() => {
        fetchMeetings();
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInviteMany]);

    const filteredMeetings = useMemo(() => {
        if (filterStatus === 'all') return meetings;
        if (filterStatus === 'Pending Response') {
            return meetings.filter((m) =>
                ['Pending Response', 'Rescheduled'].includes(m.status)
            );
        }
        return meetings.filter((m) => m.status === filterStatus);
    }, [meetings, filterStatus]);

    useEffect(() => {
        if (!focusMeetingId) return;
        const t = setTimeout(() => {
            document.getElementById(`meeting-${focusMeetingId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 200);
        return () => clearTimeout(t);
    }, [focusMeetingId, filteredMeetings]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            // Organizer page: only meetings this user created/sent.
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                withCredentials: true,
            });
            const currentUserId = String(
                employee?._id ||
                employee?.id ||
                user?.employeeProfileId ||
                user?._id ||
                user?.id ||
                ''
            );
            const all = response.data?.data || [];
            const organized = currentUserId
                ? all.filter((m) => String(m.managerId?._id || m.managerId) === currentUserId)
                : all;
            setMeetings(organized);
        } catch {
            showLoadError('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            // Dedicated OOO endpoint — does not require EMPLOYEE_VIEW_* permissions
            const response = await axios.get('/v1/both/one-on-one/eligible-invitees', {
                withCredentials: true,
            });

            const allEmployees = response.data?.data || [];
            setEmployees(allEmployees);
        } catch (error) {
            const status = error?.response?.status;
            // Fallback for older servers / HR with admin list access
            if (status === 404 || status === 403) {
                try {
                    const fallback = await axios.get('/v1/admin/employee', {
                        params: { limit: 100 },
                        withCredentials: true,
                    });
                    const list =
                        fallback.data?.data ||
                        fallback.data?.employees ||
                        [];
                    const selfId = String((user || employee)?._id || (user || employee)?.id || '');
                    setEmployees(
                        list.filter((emp) => String(emp._id || emp.id) !== selfId)
                    );
                    return;
                } catch {
                    /* fall through */
                }
            }
            setEmployees([]);
            showLoadError(
                error?.response?.data?.message || 'Failed to load employee list'
            );
        }
    };

    const filteredEmployees = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((emp) => {
            const name = `${emp.name || ''} ${emp.lastName || ''}`.toLowerCase();
            const email = String(emp.email || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [employees, employeeSearch]);

    const toggleEmployeeId = (id) => {
        const value = String(id);
        setFormData((prev) => {
            const exists = prev.employeeIds.includes(value);
            return {
                ...prev,
                employeeIds: exists
                    ? prev.employeeIds.filter((x) => x !== value)
                    : [...prev.employeeIds, value],
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const inviteIds =
            !selectedMeeting && canInviteMany
                ? formData.employeeIds
                : formData.employeeId
                    ? [formData.employeeId]
                    : [];

        if (inviteIds.length === 0 || !formData.scheduledDate || !formData.scheduledTime) {
            toast.warning(
                canInviteMany && !selectedMeeting
                    ? 'Select at least one employee and fill in date/time'
                    : 'Please fill in all required fields'
            );
            return;
        }

        try {
            setSubmitting(true);
            const basePayload = {
                scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString(),
                scheduledTime: formData.scheduledTime,
                duration: formData.duration,
                location: formData.location,
                meetingLink: formData.meetingLink,
                agenda: formData.agenda.filter((item) => item.topic.trim() !== ''),
            };

            if (selectedMeeting) {
                await axios.put(
                    `/v1/both/one-on-one/one-on-ones/${selectedMeeting._id}`,
                    { ...basePayload, employeeId: formData.employeeId },
                    { withCredentials: true }
                );
                toast.success('Meeting updated successfully');
            } else {
                const payload =
                    canInviteMany && inviteIds.length > 1
                        ? { ...basePayload, employeeIds: inviteIds }
                        : { ...basePayload, employeeId: inviteIds[0], employeeIds: inviteIds };

                const response = await axios.post('/v1/both/one-on-one/one-on-ones', payload, {
                    withCredentials: true,
                });
                const created = response.data?.data;
                const createdList = Array.isArray(created) ? created : created ? [created] : [];
                // Defer ICS downloads so browsers don't block them after the async create
                setTimeout(() => {
                    createdList.forEach((meeting) => downloadOrganizerCalendarInvite(meeting));
                }, 0);
                toast.success(
                    inviteIds.length > 1
                        ? `${inviteIds.length} meetings scheduled — calendar invites downloaded`
                        : 'Meeting scheduled — calendar invite downloaded'
                );
            }

            setShowCreateModal(false);
            setSelectedMeeting(null);
            resetForm();
            fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelMeeting = async (id) => {
        if (!window.confirm('Cancel this meeting? It will stay in your history as cancelled.')) {
            return;
        }

        try {
            await axios.patch(`/v1/both/one-on-one/one-on-ones/${id}/cancel`, {}, { withCredentials: true });
            toast.success('Meeting cancelled');
            fetchMeetings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel meeting');
        }
    };

    const addAgendaItem = () => {
        setFormData({
            ...formData,
            agenda: [...formData.agenda, { topic: '', notes: '', discussed: false }],
        });
    };

    const removeAgendaItem = (index) => {
        setFormData({
            ...formData,
            agenda: formData.agenda.filter((_, i) => i !== index),
        });
    };

    const updateAgendaItem = (index, field, value) => {
        const updatedAgenda = [...formData.agenda];
        updatedAgenda[index][field] = value;
        setFormData({ ...formData, agenda: updatedAgenda });
    };

    const resetForm = () => {
        setEmployeeSearch('');
        setFormData({
            employeeId: '',
            employeeIds: [],
            scheduledDate: '',
            scheduledTime: '',
            duration: 30,
            location: '',
            meetingLink: '',
            agenda: [{ topic: '', notes: '', discussed: false }],
        });
    };

    const countForFilter = (key) => {
        if (key === 'all') return meetings.length;
        if (key === 'Pending Response') {
            return meetings.filter((m) =>
                ['Pending Response', 'Rescheduled'].includes(m.status)
            ).length;
        }
        return meetings.filter((m) => m.status === key).length;
    };

    const resolveJoinLink = (meeting) => {
        const link = String(meeting?.meetingLink || '').trim();
        if (link) return link;
        if (meeting?._id) return `https://meet.jit.si/ems-1on1-${meeting._id}`;
        return '';
    };

    const downloadOrganizerCalendarInvite = (meeting) => {
        try {
            const start = new Date(meeting.scheduledDate);
            if (meeting.scheduledTime) {
                const [hours, minutes] = String(meeting.scheduledTime).split(':').map(Number);
                if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                    start.setHours(hours, minutes, 0, 0);
                }
            }
            if (Number.isNaN(start.getTime())) return;
            const end = new Date(start.getTime() + (Number(meeting.duration) || 30) * 60 * 1000);
            const invitee = `${meeting.employeeId?.name || ''} ${meeting.employeeId?.lastName || ''}`.trim() || 'Colleague';
            const joinLink = resolveJoinLink(meeting);
            const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            const ics = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Paarsiv//EMS//EN',
                'BEGIN:VEVENT',
                `UID:${meeting._id}@paarsiv-ems`,
                `DTSTAMP:${fmt(new Date())}`,
                `DTSTART:${fmt(start)}`,
                `DTEND:${fmt(end)}`,
                `SUMMARY:1:1 with ${invitee}`,
                `DESCRIPTION:One-on-one meeting${joinLink ? ` — Join: ${joinLink}` : ''}`,
                `LOCATION:${meeting.location || joinLink || 'Online'}`,
                joinLink ? `URL:${joinLink}` : '',
                'END:VEVENT',
                'END:VCALENDAR'
            ].filter(Boolean).join('\r\n');
            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `one-on-one-${meeting._id}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            /* silent */
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading one-on-one meetings..." />;
    }

    return (
        <div className="page-shell min-h-screen transition-all duration-300" style={{ background: PAGE_BG }}>
            <div className="page-shell-inner hrms-stack">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                            One-on-One Meetings
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Schedule and manage one-on-one conversations with colleagues.
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                        <button
                            type="button"
                            onClick={goToMyOneOnOne}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
                        >
                            My Meetings
                        </button>
                        {canSchedule ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMeeting(null);
                                    resetForm();
                                    setShowCreateModal(true);
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 sm:w-auto"
                                style={{ background: TEAL }}
                            >
                                <FiPlus className="h-4 w-4" />
                                Schedule Meeting
                            </button>
                        ) : null}
                    </div>
                </header>

                <section className="ooo-filter-strip mb-4 sm:mb-6" aria-label="Filter by status">
                    <div
                        className="ooo-filter-scroll flex w-full gap-2 overflow-x-auto overscroll-x-contain py-2 sm:flex-wrap sm:overflow-visible"
                        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
                    >
                        {FILTER_KEYS.map((status) => {
                            const active = filterStatus === status;
                            const labels = {
                                all: { short: 'All', full: 'All' },
                                'Pending Response': { short: 'Pending', full: 'Pending Response' },
                                Scheduled: { short: 'Scheduled', full: 'Scheduled' },
                                Completed: { short: 'Done', full: 'Completed' },
                                Cancelled: { short: 'Cancelled', full: 'Cancelled' },
                                Declined: { short: 'Declined', full: 'Declined' },
                            };
                            const { short, full } = labels[status] || { short: status, full: status };
                            return (
                                <button
                                    key={status}
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={`${full} (${countForFilter(status)})`}
                                    onClick={(e) => {
                                        setFilterStatus(status);
                                        e.currentTarget.blur();
                                    }}
                                    className={`ooo-filter-chip shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide outline-none transition sm:px-4 sm:text-xs ${
                                        active
                                            ? 'bg-[#0a8f6c] text-white'
                                            : 'border border-slate-200 bg-white text-slate-600'
                                    }`}
                                >
                                    <span className="inline sm:hidden">
                                        {short} ({countForFilter(status)})
                                    </span>
                                    <span className="hidden sm:inline">
                                        {full} ({countForFilter(status)})
                                    </span>
                                </button>
                            );
                        })}
                        <span className="w-5 shrink-0 sm:hidden" aria-hidden />
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5 md:p-6">
                    {filteredMeetings.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <div
                                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                style={{ background: `${TEAL}12` }}
                            >
                                <FiCalendar className="h-8 w-8" style={{ color: TEAL }} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {meetings.length === 0
                                    ? 'No one-on-one meetings yet'
                                    : 'No meetings match this filter'}
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                                {meetings.length === 0
                                    ? 'When you schedule a meeting, it will appear in this list.'
                                    : 'Try another status filter or schedule a new meeting.'}
                            </p>
                            {canSchedule && meetings.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedMeeting(null);
                                        resetForm();
                                        setShowCreateModal(true);
                                    }}
                                    className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow"
                                    style={{ background: TEAL }}
                                >
                                    Schedule your first meeting
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <ul className="space-y-3 sm:space-y-4">
                            {filteredMeetings.map((meeting) => (
                                <li
                                    key={meeting._id}
                                    id={`meeting-${meeting._id}`}
                                    className={`rounded-2xl border bg-white p-3.5 shadow-sm transition hover:border-slate-200 hover:shadow-md sm:p-5 ${
                                        focusMeetingId && String(focusMeetingId) === String(meeting._id)
                                            ? 'border-[#0a8f6c] ring-2 ring-[#0a8f6c]/25'
                                            : 'border-slate-100'
                                    }`}
                                >
                                    <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                                <div
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white sm:h-10 sm:w-10"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_LIGHT} 100%)`,
                                                    }}
                                                >
                                                    <FiUser className="h-4 w-4" />
                                                </div>
                                                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 sm:flex-none sm:text-base">
                                                    {meeting.employeeId?.name} {meeting.employeeId?.lastName}
                                                </h3>
                                                <MeetingStatusPill status={meeting.status} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                                                <div className="flex items-center gap-2">
                                                    <FiCalendar className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <span>{format(new Date(meeting.scheduledDate), 'MMM d, yyyy')}</span>
                                                </div>
                                                {meeting.scheduledTime ? (
                                                    <div className="flex items-center gap-2">
                                                        <FiClock className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <span>
                                                            {meeting.scheduledTime}
                                                            {meeting.duration ? ` · ${meeting.duration} min` : ''}
                                                        </span>
                                                    </div>
                                                ) : null}
                                                {meeting.location ? (
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <span className="truncate">{meeting.location}</span>
                                                    </div>
                                                ) : null}
                                                {resolveJoinLink(meeting) &&
                                                ['Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status) ? (
                                                    <div className="flex items-center gap-2">
                                                        <FiVideo className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <a
                                                            href={resolveJoinLink(meeting)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-medium hover:underline"
                                                            style={{ color: TEAL }}
                                                        >
                                                            Join meeting
                                                        </a>
                                                    </div>
                                                ) : null}
                                            </div>
                                            {meeting.agenda && meeting.agenda.length > 0 ? (
                                                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Agenda
                                                    </p>
                                                    <ul className="space-y-1 text-xs text-slate-600">
                                                        {meeting.agenda.slice(0, 3).map((item, idx) => (
                                                            <li key={idx}>• {item.topic}</li>
                                                        ))}
                                                        {meeting.agenda.length > 3 ? (
                                                            <li className="text-slate-400">
                                                                + {meeting.agenda.length - 3} more
                                                            </li>
                                                        ) : null}
                                                    </ul>
                                                </div>
                                            ) : null}
                                            {meeting.rescheduleProposal?.status === 'pending' ? (
                                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                    <p className="font-semibold">Reschedule proposed</p>
                                                    <p className="mt-0.5 text-xs">
                                                        {meeting.rescheduleProposal.proposedDate
                                                            ? format(new Date(meeting.rescheduleProposal.proposedDate), 'MMM d, yyyy')
                                                            : ''}
                                                        {meeting.rescheduleProposal.proposedTime
                                                            ? ` · ${meeting.rescheduleProposal.proposedTime}`
                                                            : ''}
                                                        {meeting.rescheduleProposal.reason
                                                            ? ` — ${meeting.rescheduleProposal.reason}`
                                                            : ''}
                                                    </p>
                                                    {String(meeting.rescheduleProposal.requestedBy?._id || meeting.rescheduleProposal.requestedBy) !==
                                                        String(user?._id || employee?._id) && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        await axios.patch(
                                                                            `/v1/both/one-on-one/one-on-ones/${meeting._id}/respond-reschedule`,
                                                                            { action: 'accept' },
                                                                            { withCredentials: true }
                                                                        );
                                                                        toast.success('New time confirmed');
                                                                        fetchMeetings();
                                                                    } catch (error) {
                                                                        toast.error(error.response?.data?.message || 'Failed');
                                                                    }
                                                                }}
                                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                                                style={{ background: TEAL }}
                                                            >
                                                                Accept time
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        await axios.patch(
                                                                            `/v1/both/one-on-one/one-on-ones/${meeting._id}/respond-reschedule`,
                                                                            { action: 'decline' },
                                                                            { withCredentials: true }
                                                                        );
                                                                        toast.success('Proposal declined');
                                                                        fetchMeetings();
                                                                    } catch (error) {
                                                                        toast.error(error.response?.data?.message || 'Failed');
                                                                    }
                                                                }}
                                                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                                                            >
                                                                Decline
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex w-full shrink-0 gap-2 self-stretch sm:w-auto sm:self-start">
                                            <button
                                                type="button"
                                                title="Meeting notes"
                                                onClick={() => setNotesMeeting(meeting)}
                                                className="flex-1 rounded-xl border bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:flex-none sm:py-2"
                                                style={{ borderColor: GREY_BORDER }}
                                            >
                                                Notes
                                            </button>
                                            {['Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status) &&
                                            canSchedule ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        title="Edit"
                                                        onClick={() => {
                                                            setSelectedMeeting(meeting);
                                                            const meetingDate = new Date(meeting.scheduledDate);
                                                            setFormData({
                                                                employeeId: meeting.employeeId?._id || meeting.employeeId,
                                                                employeeIds: [],
                                                                scheduledDate: format(meetingDate, 'yyyy-MM-dd'),
                                                                scheduledTime: meeting.scheduledTime || '',
                                                                duration: meeting.duration || 30,
                                                                location: meeting.location || '',
                                                                meetingLink: meeting.meetingLink || '',
                                                                agenda:
                                                                    meeting.agenda && meeting.agenda.length > 0
                                                                        ? meeting.agenda
                                                                        : [{ topic: '', notes: '', discussed: false }],
                                                            });
                                                            setShowCreateModal(true);
                                                        }}
                                                        className="rounded-xl border bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50"
                                                        style={{ borderColor: GREY_BORDER }}
                                                    >
                                                        <FiEdit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Cancel meeting"
                                                        onClick={() => handleCancelMeeting(meeting._id)}
                                                        className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-600 transition hover:bg-red-100"
                                                    >
                                                        <FiSlash className="h-4 w-4" />
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {notesMeeting ? (
                <div
                    className="fixed inset-0 z-[11000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    role="presentation"
                    onClick={() => setNotesMeeting(null)}
                >
                          <div
                              className="max-h-[min(92vh,100dvh)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl sm:rounded-2xl sm:p-5 sm:pt-5 md:p-6"
                              role="dialog"
                              aria-modal="true"
                              aria-label="Meeting notes"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <div className="mb-4 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                      <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                                          Meeting Notes
                                      </h3>
                                      <p className="mt-0.5 truncate text-sm text-slate-500">
                                          {(notesMeeting.employeeId?.name || '') +
                                              ' ' +
                                              (notesMeeting.employeeId?.lastName || '')}
                                      </p>
                                  </div>
                                  <button
                                      type="button"
                                      aria-label="Close notes"
                                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                                      onClick={() => setNotesMeeting(null)}
                                  >
                                      <FiXCircle className="h-5 w-5" />
                                  </button>
                              </div>
                              <MeetingNotesPanel
                                  meeting={notesMeeting}
                                  currentUserId={String(
                                      employee?._id ||
                                          employee?.id ||
                                          user?.employeeProfileId ||
                                          user?._id ||
                                          ''
                                  )}
                                  onMeetingUpdated={(updated) => {
                                      setNotesMeeting(updated);
                                      setMeetings((prev) =>
                                          prev.map((m) =>
                                              String(m._id) === String(updated._id)
                                                  ? { ...m, ...updated }
                                                  : m
                                          )
                                      );
                                  }}
                              />
                          </div>
                      </div>
            ) : null}

            {showCreateModal && canSchedule ? (
                <div
                    className="fixed inset-0 z-[11000] flex items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-4"
                    role="presentation"
                    onClick={() => {
                        setShowCreateModal(false);
                        setSelectedMeeting(null);
                        resetForm();
                    }}
                >
                          <div
                              className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="ooo-schedule-title"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:pb-4 sm:pt-6 md:px-8 md:pt-8">
                                  <div className="min-w-0 flex-1 pr-2">
                                      <h3
                                          id="ooo-schedule-title"
                                          className="pr-1 text-lg font-bold leading-tight text-slate-900 sm:leading-snug"
                                      >
                                          {selectedMeeting ? 'Edit meeting' : 'Schedule One-on-One'}
                                      </h3>
                                      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                                          {selectedMeeting
                                              ? 'Update time, link, or agenda.'
                                              : canInviteMany
                                                  ? 'Invite one or many employees across the company.'
                                                  : 'Set time and agenda for your team member.'}
                                      </p>
                                  </div>
                                  <button
                                      type="button"
                                      aria-label="Close"
                                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                      onClick={() => {
                                          setShowCreateModal(false);
                                          setSelectedMeeting(null);
                                          resetForm();
                                      }}
                                  >
                                      <FiXCircle className="h-6 w-6" />
                                  </button>
                              </div>

                              <form
                                  onSubmit={handleSubmit}
                                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:space-y-5 sm:px-6 sm:pb-6 md:px-8 md:pb-8"
                              >
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {canInviteMany && !selectedMeeting ? 'Employees' : 'Employee'}{' '}
                                    <span className="text-red-600">*</span>
                                    {canInviteMany && !selectedMeeting && formData.employeeIds.length > 0 ? (
                                        <span className="ml-2 font-medium normal-case text-slate-400">
                                            {formData.employeeIds.length} selected
                                        </span>
                                    ) : null}
                                </label>

                                {canInviteMany && !selectedMeeting ? (
                                    <div className="rounded-xl border border-slate-200 bg-white">
                                        <div className="border-b border-slate-100 p-2">
                                            <input
                                                type="search"
                                                value={employeeSearch}
                                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                                className={inputClass}
                                                placeholder="Search employees by name or email…"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-2">
                                            {filteredEmployees.length === 0 ? (
                                                <p className="px-2 py-3 text-sm text-slate-500">No employees found.</p>
                                            ) : (
                                                filteredEmployees.map((emp) => {
                                                    const id = String(emp._id || emp.id);
                                                    const checked = formData.employeeIds.includes(id);
                                                    return (
                                                        <label
                                                            key={id}
                                                            className={`mb-1 flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition hover:bg-slate-50 sm:items-center sm:py-2 ${
                                                                checked ? 'bg-[#0a8f6c]/8' : ''
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleEmployeeId(id)}
                                                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0a8f6c] focus:ring-[#0a8f6c] sm:mt-0"
                                                            />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block font-medium text-slate-800">
                                                                    {emp.name} {emp.lastName}
                                                                </span>
                                                                {emp.email ? (
                                                                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                                                                        {emp.email}
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <select
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        className={inputClass}
                                        required
                                        disabled={!!selectedMeeting}
                                    >
                                        <option value="">Select employee</option>
                                        {employees.map((emp) => (
                                            <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                                {emp.name} {emp.lastName}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Date <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.scheduledDate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, scheduledDate: e.target.value })
                                        }
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
                                        onChange={(e) =>
                                            setFormData({ ...formData, scheduledTime: e.target.value })
                                        }
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
                                            setFormData({
                                                ...formData,
                                                duration: parseInt(e.target.value, 10) || 30,
                                            })
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
                                        onChange={(e) =>
                                            setFormData({ ...formData, location: e.target.value })
                                        }
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
                                    onChange={(e) =>
                                        setFormData({ ...formData, meetingLink: e.target.value })
                                    }
                                    className={inputClass}
                                    placeholder="https://…"
                                />
                            </div>

                            <div className="border-t border-slate-100 pt-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-slate-900">Agenda</h4>
                                    <button
                                        type="button"
                                        onClick={addAgendaItem}
                                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm"
                                        style={{ background: TEAL }}
                                    >
                                        <FiPlus className="h-3.5 w-3.5" />
                                        Add item
                                    </button>
                                </div>
                                {formData.agenda.map((item, index) => (
                                    <div
                                        key={index}
                                        className="mb-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">
                                                Item {index + 1}
                                            </span>
                                            {formData.agenda.length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removeAgendaItem(index)}
                                                    className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                                                >
                                                    <FiXCircle className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                        <input
                                            type="text"
                                            value={item.topic}
                                            onChange={(e) =>
                                                updateAgendaItem(index, 'topic', e.target.value)
                                            }
                                            className={`${inputClass} mb-2`}
                                            placeholder="Topic"
                                        />
                                        <textarea
                                            value={item.notes}
                                            onChange={(e) =>
                                                updateAgendaItem(index, 'notes', e.target.value)
                                            }
                                            className={inputClass}
                                            rows={2}
                                            placeholder="Notes (optional)"
                                        />
                                    </div>
                                ))}
                            </div>

                            {!selectedMeeting ? (
                                <div
                                    className="flex gap-3 rounded-xl border px-4 py-3 text-sm"
                                    style={{
                                        background: `${TEAL}0d`,
                                        borderColor: `${TEAL}33`,
                                        color: TEAL,
                                    }}
                                >
                                    <FiBell className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p>
                                        {canInviteMany
                                            ? 'Each selected employee gets their own one-on-one and a notification.'
                                            : 'A notification is sent to the employee when you schedule this meeting.'}
                                    </p>
                                </div>
                            ) : null}

                            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedMeeting(null);
                                        resetForm();
                                    }}
                                    className="w-full rounded-xl px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto sm:py-2.5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
                                    style={{ background: TEAL }}
                                >
                                    {submitting ? (
                                        <>
                                            <FiLoader className="h-4 w-4 animate-spin" />
                                            {selectedMeeting ? 'Updating…' : 'Scheduling…'}
                                        </>
                                    ) : selectedMeeting ? (
                                        'Update meeting'
                                    ) : canInviteMany && formData.employeeIds.length > 1 ? (
                                        `Schedule ${formData.employeeIds.length} meetings`
                                    ) : (
                                        'Schedule meeting'
                                    )}
                                </button>
                            </div>
                              </form>
                          </div>
                      </div>
            ) : null}
        </div>
    );
};

export default OneOnOnePage;
