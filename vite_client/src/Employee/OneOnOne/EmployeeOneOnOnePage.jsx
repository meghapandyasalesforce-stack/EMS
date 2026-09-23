import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    FaCalendarAlt,
    FaArrowRight,
    FaEllipsisV,
    FaCircle,
    FaVideo
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import useHrmsPopupDismiss from '../../Hooks/useHrmsPopupDismiss';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import MeetingNotesPanel from '../../components/MeetingNotesPanel';

const EmployeeOneOnOnePage = ({
    focusMeetingId: focusMeetingIdProp = ''
} = {}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusMeetingId = focusMeetingIdProp || searchParams.get('meetingId') || '';
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeetingId, setSelectedMeetingId] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const [notesPulse, setNotesPulse] = useState(false);
    const [actionBusyId, setActionBusyId] = useState('');
    const [rescheduleMeeting, setRescheduleMeeting] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({
        proposedDate: '',
        proposedTime: '',
        reason: ''
    });

    const closeActionMenu = useCallback(() => setOpenActionMenuId(null), []);
    useHrmsPopupDismiss(closeActionMenu, Boolean(openActionMenuId));

    const lastErrorToastAt = useRef(0);

    const currentUserId = useMemo(
        () =>
            String(
                employee?._id ||
                employee?.id ||
                user?.employeeProfileId ||
                user?._id ||
                user?.id ||
                ''
            ),
        [employee, user]
    );

    const isOrganizerOf = useCallback(
        (meeting) =>
            Boolean(currentUserId) &&
            String(meeting?.managerId?._id || meeting?.managerId || '') === currentUserId,
        [currentUserId]
    );

    const isInviteeOf = useCallback(
        (meeting) =>
            Boolean(currentUserId) &&
            String(meeting?.employeeId?._id || meeting?.employeeId || '') === currentUserId,
        [currentUserId]
    );

    const personName = (person, fallback = 'Colleague') => {
        const first = person?.name || '';
        const last = person?.lastName || '';
        return `${first} ${last}`.trim() || fallback;
    };

    const getOtherPerson = useCallback(
        (meeting) => {
            if (isOrganizerOf(meeting)) return meeting?.employeeId;
            return meeting?.managerId;
        },
        [isOrganizerOf]
    );

    const getOtherPersonName = useCallback(
        (meeting) => personName(getOtherPerson(meeting), 'Colleague'),
        [getOtherPerson]
    );

    const getOtherPersonRole = useCallback(
        (meeting) => {
            const other = getOtherPerson(meeting);
            return other?.jobTitle || other?.position || (isOrganizerOf(meeting) ? 'Colleague' : 'Organizer');
        },
        [getOtherPerson, isOrganizerOf]
    );

    const statusLabel = (status) => {
        const s = String(status || '');
        if (s === 'Pending Response') return 'Pending Response';
        if (s === 'Scheduled') return 'Confirmed';
        if (s === 'Rescheduled') return 'Reschedule Pending';
        if (s === 'Declined') return 'Declined';
        if (s === 'Cancelled') return 'Cancelled';
        if (s === 'Completed') return 'Completed';
        return s || 'Unknown';
    };

    const statusTone = (status) => {
        const s = String(status || '');
        if (s === 'Pending Response' || s === 'Rescheduled') return 'text-amber-600';
        if (s === 'Scheduled') return 'text-[#56B586]';
        if (s === 'Declined' || s === 'Cancelled') return 'text-red-600';
        if (s === 'Completed') return 'text-slate-500';
        return 'text-slate-500';
    };

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                withCredentials: true
            });

            const allMeetings = response.data?.data || [];

            // Personal view: meetings where user is organizer OR invitee
            const myMeetings = currentUserId
                ? allMeetings.filter(
                      (meeting) => isOrganizerOf(meeting) || isInviteeOf(meeting)
                  )
                : allMeetings;

            setMeetings(myMeetings);
        } catch {
            const nowTs = Date.now();
            if (nowTs - lastErrorToastAt.current > 4000) {
                lastErrorToastAt.current = nowTs;
                toast.error('Failed to load one-on-one meetings');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (focusMeetingId) {
            setSelectedMeetingId(focusMeetingId);
        }
    }, [focusMeetingId]);

    const getMeetingStartAt = (meeting) => {
        const base = new Date(meeting.scheduledDate);
        if (Number.isNaN(base.getTime())) return null;
        const time = String(meeting.scheduledTime || '').trim();
        if (time) {
            const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (match) {
                let hours = Number(match[1]);
                const minutes = Number(match[2]);
                const meridiem = (match[3] || '').toUpperCase();
                if (meridiem === 'PM' && hours < 12) hours += 12;
                if (meridiem === 'AM' && hours === 12) hours = 0;
                if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                    base.setHours(hours, minutes, 0, 0);
                }
            }
        }
        return base;
    };

    const resolveJoinLink = (meeting) => {
        const link = String(meeting?.meetingLink || '').trim();
        if (link) return link;
        if (meeting?._id) return `https://meet.jit.si/ems-1on1-${meeting._id}`;
        return '';
    };

    const canJoinMeeting = (meeting) => {
        const status = String(meeting?.status || '').trim().toLowerCase();
        if (!['scheduled', 'rescheduled', 'pending response'].includes(status)) return false;
        return Boolean(resolveJoinLink(meeting));
    };

    const sortedMeetings = useMemo(() => {
        return [...meetings]
            .map((meeting) => {
                const start = getMeetingStartAt(meeting);
                const durationMs = (Number(meeting.duration) || 30) * 60 * 1000;
                return {
                    ...meeting,
                    _scheduledAt: start || new Date(meeting.scheduledDate),
                    _endsAt: start
                        ? new Date(start.getTime() + durationMs)
                        : new Date(meeting.scheduledDate)
                };
            })
            .filter((meeting) => !Number.isNaN(meeting._scheduledAt.getTime()))
            .sort((a, b) => a._scheduledAt.getTime() - b._scheduledAt.getTime());
    }, [meetings]);

    const now = useMemo(() => new Date(), [meetings]);

    const upcomingMeetings = useMemo(() => {
        return sortedMeetings.filter((meeting) => {
            const status = (meeting.status || '').toLowerCase();
            if (['cancelled', 'declined', 'completed'].includes(status)) return false;
            // Keep active until meeting end time (not midnight of scheduledDate)
            if (meeting._endsAt >= now) return true;
            return status === 'pending response' || status === 'rescheduled';
        });
    }, [sortedMeetings, now]);

    const pastMeetings = useMemo(() => {
        const upcomingIds = new Set(upcomingMeetings.map((m) => String(m._id)));
        return sortedMeetings
            .filter((meeting) => {
                if (upcomingIds.has(String(meeting._id))) return false;
                const status = (meeting.status || '').toLowerCase();
                return (
                    meeting._endsAt < now ||
                    ['completed', 'cancelled', 'declined'].includes(status)
                );
            })
            .sort((a, b) => b._scheduledAt.getTime() - a._scheduledAt.getTime());
    }, [sortedMeetings, now, upcomingMeetings]);

    const nextMeeting = upcomingMeetings[0] || null;

    useEffect(() => {
        if (focusMeetingId) return;
        if (!selectedMeetingId && nextMeeting?._id) {
            setSelectedMeetingId(nextMeeting._id);
        }
    }, [nextMeeting, selectedMeetingId, focusMeetingId]);

    const selectedMeeting =
        sortedMeetings.find((meeting) => String(meeting._id) === String(selectedMeetingId)) ||
        nextMeeting ||
        pastMeetings[0] ||
        null;

    const mergeMeetingUpdate = (updated) => {
        if (!updated?._id) return;
        setMeetings((prev) =>
            prev.map((m) =>
                String(m._id) === String(updated._id)
                    ? {
                          ...m,
                          ...updated,
                          _scheduledAt:
                              m._scheduledAt ||
                              (updated.scheduledDate ? new Date(updated.scheduledDate) : undefined)
                      }
                    : m
            )
        );
    };

    const getInitials = (name = 'Manager') =>
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('');

    const runMeetingAction = async (meetingId, requestFn, successMessage) => {
        try {
            setActionBusyId(meetingId);
            await requestFn();
            toast.success(successMessage);
            await fetchMeetings();
            setSelectedMeetingId(meetingId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setActionBusyId('');
            setOpenActionMenuId(null);
        }
    };

    const handleAccept = async (meeting) => {
        try {
            setActionBusyId(meeting._id);
            const response = await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/accept`,
                {},
                { withCredentials: true }
            );
            const updated = response.data?.data || {
                ...meeting,
                status: 'Scheduled',
                meetingLink: meeting.meetingLink || resolveJoinLink(meeting)
            };
            // Defer so the ICS download still fires after the async accept
            setTimeout(() => downloadCalendarInvite(updated, { silent: true }), 0);
            toast.success('Meeting accepted — calendar invite downloaded');
            await fetchMeetings();
            setSelectedMeetingId(meeting._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setActionBusyId('');
            setOpenActionMenuId(null);
        }
    };

    const handleDecline = (meeting) => {
        const reason = window.prompt('Optional reason for declining:') || '';
        return runMeetingAction(
            meeting._id,
            () =>
                axios.patch(
                    `/v1/both/one-on-one/one-on-ones/${meeting._id}/decline`,
                    { reason },
                    { withCredentials: true }
                ),
            'Meeting declined'
        );
    };

    const openReschedule = (meeting) => {
        const d = meeting._scheduledAt || new Date(meeting.scheduledDate);
        setRescheduleForm({
            proposedDate: format(d, 'yyyy-MM-dd'),
            proposedTime: meeting.scheduledTime || '10:00',
            reason: ''
        });
        setRescheduleMeeting(meeting);
        setOpenActionMenuId(null);
    };

    const submitReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleMeeting) return;
        if (!rescheduleForm.proposedDate || !rescheduleForm.proposedTime) {
            toast.warning('Pick a proposed date and time');
            return;
        }
        await runMeetingAction(
            rescheduleMeeting._id,
            () =>
                axios.patch(
                    `/v1/both/one-on-one/one-on-ones/${rescheduleMeeting._id}/request-reschedule`,
                    {
                        proposedDate: new Date(
                            `${rescheduleForm.proposedDate}T${rescheduleForm.proposedTime}`
                        ).toISOString(),
                        proposedTime: rescheduleForm.proposedTime,
                        reason: rescheduleForm.reason
                    },
                    { withCredentials: true }
                ),
            'Reschedule proposal sent to organizer'
        );
        setRescheduleMeeting(null);
    };

    const respondToOrganizerProposal = async (meeting, action) => {
        if (action === 'counter') {
            openReschedule(meeting);
            return;
        }
        try {
            setActionBusyId(meeting._id);
            const response = await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/respond-reschedule`,
                { action },
                { withCredentials: true }
            );
            const updated = response.data?.data || meeting;
            if (action === 'accept') {
                setTimeout(() => downloadCalendarInvite(updated, { silent: true }), 0);
                toast.success('New time confirmed — calendar invite downloaded');
            } else {
                toast.success('Proposal declined');
            }
            await fetchMeetings();
            setSelectedMeetingId(meeting._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setActionBusyId('');
            setOpenActionMenuId(null);
        }
    };

    const handleViewSummary = (meetingId) => {
        setSelectedMeetingId(meetingId);
        setShowHistoryModal(true);
    };

    const handleOpenNotes = (meetingId, event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const id = String(meetingId || '');
        if (!id) return;
        setSelectedMeetingId(id);
        setShowHistoryModal(false);
        setOpenActionMenuId(null);
        setNotesPulse(true);
        window.setTimeout(() => {
            const panel = document.getElementById('ooo-notes-panel');
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            panel?.querySelector('textarea')?.focus?.();
        }, 120);
        window.setTimeout(() => setNotesPulse(false), 1200);
    };

    const handleViewSummaryFromMenu = (meetingId) => {
        setSelectedMeetingId(meetingId);
        setShowHistoryModal(true);
        setOpenActionMenuId(null);
    };

    const formatICSDate = (date) =>
        date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const downloadCalendarInvite = (meeting, { silent = false } = {}) => {
        try {
            const start = getMeetingStartAt(meeting) || new Date(meeting.scheduledDate);
            if (Number.isNaN(start.getTime())) {
                if (!silent) toast.error('Invalid meeting date');
                return;
            }

            const durationMinutes = Number(meeting.duration) || 30;
            const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
            const title = `1:1 with ${getOtherPersonName(meeting)}`;
            const joinLink = resolveJoinLink(meeting);
            const description = [
                meeting.agenda?.map((item) => item.topic).filter(Boolean).join(', ') || 'One-on-one meeting',
                joinLink ? `Join: ${joinLink}` : ''
            ]
                .filter(Boolean)
                .join(' — ');
            const location = meeting.location || joinLink || 'Online';

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Paarsiv//EMS//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH',
                'BEGIN:VEVENT',
                `UID:${meeting._id}@paarsiv-ems`,
                `DTSTAMP:${formatICSDate(new Date())}`,
                `DTSTART:${formatICSDate(start)}`,
                `DTEND:${formatICSDate(end)}`,
                `SUMMARY:${title}`,
                `DESCRIPTION:${description.replace(/\n/g, ' ')}`,
                `LOCATION:${String(location).replace(/\n/g, ' ')}`,
                joinLink ? `URL:${joinLink}` : '',
                'END:VEVENT',
                'END:VCALENDAR'
            ]
                .filter(Boolean)
                .join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `one-on-one-${meeting._id}.ics`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            if (!silent) toast.success('Calendar invite downloaded');
        } catch {
            if (!silent) toast.error('Unable to create calendar invite');
        } finally {
            setOpenActionMenuId(null);
        }
    };

    const formatMeetingDate = (dateObj) => format(dateObj, 'MMM dd, yyyy');
    const formatMeetingMonth = (dateObj) => format(dateObj, 'MMM').toUpperCase();
    const formatMeetingDateOnly = (dateObj) => format(dateObj, 'dd');

    if (loading) {
        return <LoadingSpinner message="Loading your one-on-one meetings..." />;
    }

    return (
        <div className="min-h-screen bg-[#F8F9FA] transition-all duration-300">
            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                            My 1:1 Meetings
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 sm:mt-1.5 sm:text-base">
                            Manage your ongoing growth conversations and feedback loops.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/one-on-one')}
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                    >
                        Meeting Management
                    </button>
                </header>

                {meetings.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
                        <FaCalendarAlt className="mx-auto mb-4 text-4xl text-slate-300" />
                        <p className="text-base font-medium text-slate-700">No one-on-one meetings scheduled</p>
                        <p className="mt-1 text-sm text-slate-500">
                            Meetings you schedule or receive will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6">
                            {nextMeeting ? (
                                <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
                                        <span className="inline-flex w-fit rounded-full bg-[#56B586]/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2f7a55]">
                                            {nextMeeting.status === 'Pending Response'
                                                ? 'Pending Response'
                                                : 'Next Meeting'}
                                        </span>
                                        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4 md:flex-row md:items-start">
                                            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#56B586] text-sm font-semibold text-white sm:h-14 sm:w-14 sm:text-base">
                                                    {getInitials(getOtherPersonName(nextMeeting))}
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl lg:text-2xl">
                                                        {getOtherPersonName(nextMeeting)}
                                                    </h2>
                                                    <p className="mt-0.5 truncate text-sm text-slate-500">
                                                        {getOtherPersonRole(nextMeeting)}
                                                    </p>
                                                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 sm:mt-3">
                                                        <FaCalendarAlt className="shrink-0 text-[#56B586]" />
                                                        <span>
                                                            {format(nextMeeting._scheduledAt, 'MMM dd, yyyy')}
                                                            {nextMeeting.scheduledTime ? ` • ${nextMeeting.scheduledTime}` : ''}
                                                            {nextMeeting.duration ? ` • ${nextMeeting.duration} min` : ''}
                                                        </span>
                                                    </p>
                                                    <p className={`mt-2 text-xs font-semibold ${statusTone(nextMeeting.status)}`}>
                                                        Status: {statusLabel(nextMeeting.status)}
                                                    </p>
                                                    {nextMeeting.status === 'Pending Response' &&
                                                        isOrganizerOf(nextMeeting) && (
                                                        <p className="mt-1 text-xs text-amber-700">
                                                            Waiting for {personName(nextMeeting.employeeId, 'invitee')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full min-w-0 rounded-lg bg-slate-100 p-3.5 text-sm text-slate-600 md:max-w-[220px]">
                                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                                    Agenda Preview
                                                </p>
                                                <p className="line-clamp-4 text-[13px] leading-relaxed">
                                                    {nextMeeting.agenda
                                                        ?.map((item) => item.topic)
                                                        .filter(Boolean)
                                                        .slice(0, 3)
                                                        .join(', ') || 'No agenda items shared yet.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-start sm:gap-3 lg:w-auto lg:shrink-0 lg:self-center">
                                        {nextMeeting.status === 'Pending Response' &&
                                            isInviteeOf(nextMeeting) && (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={actionBusyId === nextMeeting._id}
                                                    onClick={() => handleAccept(nextMeeting)}
                                                    className="inline-flex w-full items-center justify-center rounded-lg bg-[#56B586] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4aa578] disabled:opacity-60 sm:w-auto sm:min-w-[110px]"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actionBusyId === nextMeeting._id}
                                                    onClick={() => handleDecline(nextMeeting)}
                                                    className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60 sm:w-auto sm:min-w-[110px]"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actionBusyId === nextMeeting._id}
                                                    onClick={() => openReschedule(nextMeeting)}
                                                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto sm:min-w-[110px]"
                                                >
                                                    Propose New Time
                                                </button>
                                            </>
                                        )}
                                        {nextMeeting.status === 'Rescheduled' &&
                                            nextMeeting.rescheduleProposal?.status === 'pending' &&
                                            String(
                                                nextMeeting.rescheduleProposal?.requestedBy?._id ||
                                                    nextMeeting.rescheduleProposal?.requestedBy ||
                                                    ''
                                            ) !== currentUserId && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => respondToOrganizerProposal(nextMeeting, 'accept')}
                                                    className="inline-flex w-full items-center justify-center rounded-lg bg-[#56B586] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                                                >
                                                    Accept new time
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => respondToOrganizerProposal(nextMeeting, 'decline')}
                                                    className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                                                >
                                                    Decline time
                                                </button>
                                            </>
                                        )}
                                        {canJoinMeeting(nextMeeting) && (
                                            <a
                                                href={resolveJoinLink(nextMeeting)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#56B586] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#56B586]/30 transition hover:bg-[#4aa578] hover:shadow-md sm:w-auto sm:min-w-[140px]"
                                            >
                                                <FaVideo className="h-3.5 w-3.5" aria-hidden />
                                                Join Meeting
                                            </a>
                                        )}
                                        {/* <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedMeetingId(nextMeeting._id);
                                                document.getElementById('ooo-notes-panel')?.scrollIntoView({
                                                    behavior: 'smooth',
                                                    block: 'start'
                                                });
                                            }}
                                            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto sm:min-w-[130px]"
                                        >
                                            View Notes
                                        </button> */}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600">No upcoming 1:1 meetings at the moment.</p>
                            )}
                        </section>

                        <div className="hrms-main-rail">
                            <div className="min-w-0 space-y-4 sm:space-y-5">
                                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <div className="mb-3 flex items-center gap-2 sm:mb-4">
                                        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Upcoming</h3>
                                        <span className="text-xs text-slate-400">
                                            {upcomingMeetings.length} total
                                        </span>
                                    </div>

                                    {upcomingMeetings.length === 0 ? (
                                        <p className="text-sm text-slate-500">No upcoming meetings scheduled.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {upcomingMeetings.map((meeting) => (
                                                <div
                                                    key={meeting._id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        setSelectedMeetingId(meeting._id);
                                                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                                            document.getElementById('ooo-notes-panel')?.scrollIntoView({
                                                                behavior: 'smooth',
                                                                block: 'start'
                                                            });
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedMeetingId(meeting._id);
                                                        }
                                                    }}
                                                    className={`w-full cursor-pointer rounded-lg border p-3 text-left transition sm:p-3.5 ${
                                                        selectedMeeting?._id === meeting._id
                                                            ? 'border-[#56B586]/45 bg-[#56B586]/08'
                                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="min-w-[44px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center sm:min-w-[48px] sm:px-2.5">
                                                                <p className="text-[10px] font-semibold tracking-wide text-slate-400">
                                                                    {formatMeetingMonth(meeting._scheduledAt)}
                                                                </p>
                                                                <p className="text-base font-bold leading-none text-[#56B586] sm:text-lg">
                                                                    {formatMeetingDateOnly(meeting._scheduledAt)}
                                                                </p>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate font-semibold text-slate-800">
                                                                    {getOtherPersonName(meeting)}
                                                                </p>
                                                                <p className="truncate text-xs text-slate-500">
                                                                    {getOtherPersonRole(meeting)}
                                                                </p>
                                                                {meeting.status === 'Pending Response' &&
                                                                    isOrganizerOf(meeting) && (
                                                                    <p className="mt-0.5 truncate text-[11px] text-amber-700">
                                                                        Waiting for {personName(meeting.employeeId, 'invitee')}
                                                                    </p>
                                                                )}
                                                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:hidden">
                                                                    <span className="text-xs text-slate-500">
                                                                        {meeting.duration || 30}m
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusTone(meeting.status)}`}>
                                                                        <FaCircle className="text-[7px]" />
                                                                        {statusLabel(meeting.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 sm:justify-end sm:gap-3 sm:border-0 sm:pt-0">
                                                            <div className="hidden text-right sm:block">
                                                                <p className="text-sm text-slate-600">{meeting.duration || 30}m</p>
                                                                <p className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTone(meeting.status)}`}>
                                                                    <FaCircle className="text-[7px]" />
                                                                    {statusLabel(meeting.status)}
                                                                </p>
                                                            </div>
                                                            <div className="relative flex flex-1 items-center justify-end gap-1.5 sm:flex-none">
                                                                {canJoinMeeting(meeting) && (
                                                                    <a
                                                                        href={resolveJoinLink(meeting)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="inline-flex items-center gap-1.5 rounded-full bg-[#56B586] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#56B586]/25 transition hover:bg-[#4aa578] hover:shadow active:scale-[0.98]"
                                                                    >
                                                                        <FaVideo className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
                                                                        Join
                                                                    </a>
                                                                )}
                                                                {meeting.status === 'Pending Response' &&
                                                                    isInviteeOf(meeting) && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleAccept(meeting);
                                                                            }}
                                                                            className="rounded-md bg-[#56B586] px-2.5 py-1.5 text-[11px] font-semibold text-white sm:px-2 sm:py-1"
                                                                        >
                                                                            Accept
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDecline(meeting);
                                                                            }}
                                                                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 sm:px-2 sm:py-1"
                                                                        >
                                                                            Decline
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenActionMenuId((prev) => (prev === meeting._id ? null : meeting._id));
                                                                    }}
                                                                    className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 sm:p-1"
                                                                    aria-label="Meeting quick actions"
                                                                    aria-expanded={openActionMenuId === meeting._id}
                                                                    aria-haspopup="menu"
                                                                    data-hrms-popup-trigger
                                                                >
                                                                    <FaEllipsisV className="text-slate-400" />
                                                                </button>

                                                                {openActionMenuId === meeting._id && (
                                                                    <div
                                                                        className="absolute right-0 bottom-full z-30 mb-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onMouseDown={(e) => e.stopPropagation()}
                                                                        role="menu"
                                                                        data-hrms-popup
                                                                    >
                                                                        {canJoinMeeting(meeting) && (
                                                                            <a
                                                                                href={resolveJoinLink(meeting)}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#2f7a55] transition hover:bg-[#56B586]/08"
                                                                                role="menuitem"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setOpenActionMenuId(null);
                                                                                }}
                                                                            >
                                                                                <FaVideo className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                                                Join meeting
                                                                            </a>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onMouseDown={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                handleOpenNotes(meeting._id, e);
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                handleOpenNotes(meeting._id, e);
                                                                            }}
                                                                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                            role="menuitem"
                                                                        >
                                                                            Open notes
                                                                        </button>
                                                                        {['Pending Response', 'Scheduled', 'Rescheduled'].includes(meeting.status) && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openReschedule(meeting);
                                                                                }}
                                                                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                                role="menuitem"
                                                                            >
                                                                                Propose new time
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleViewSummaryFromMenu(meeting._id);
                                                                            }}
                                                                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                            role="menuitem"
                                                                        >
                                                                            View summary
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h3 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">
                                        Past Meetings
                                    </h3>
                                    {pastMeetings.length === 0 ? (
                                        <p className="text-sm text-slate-500">No past meetings yet.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {pastMeetings.slice(0, 6).map((meeting) => (
                                                <button
                                                    type="button"
                                                    key={meeting._id}
                                                    onClick={() => {
                                                        setSelectedMeetingId(meeting._id);
                                                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                                            document.getElementById('ooo-notes-panel')?.scrollIntoView({
                                                                behavior: 'smooth',
                                                                block: 'start'
                                                            });
                                                        }
                                                    }}
                                                    className={`w-full rounded-lg border p-3 text-left transition sm:p-3.5 ${
                                                        selectedMeeting?._id === meeting._id
                                                            ? 'border-[#56B586]/45 bg-[#56B586]/08'
                                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="min-w-[44px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-center sm:min-w-[48px] sm:px-2.5">
                                                                <p className="text-[10px] font-semibold tracking-wide text-slate-400">
                                                                    {formatMeetingMonth(meeting._scheduledAt)}
                                                                </p>
                                                                <p className="text-base font-bold leading-none text-slate-500 sm:text-lg">
                                                                    {formatMeetingDateOnly(meeting._scheduledAt)}
                                                                </p>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-semibold text-slate-800">
                                                                    {getOtherPersonName(meeting)}
                                                                </p>
                                                                <p className="truncate text-xs text-slate-500">
                                                                    {getOtherPersonRole(meeting)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 sm:block sm:border-0 sm:pt-0 sm:text-right">
                                                            <p className="text-sm text-slate-600">{meeting.duration || 30}m</p>
                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewSummary(meeting._id);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.stopPropagation();
                                                                        handleViewSummary(meeting._id);
                                                                    }
                                                                }}
                                                                className="inline-flex items-center gap-1 text-sm font-semibold text-[#56B586] transition hover:text-[#2f7a55]"
                                                            >
                                                                View Summary <FaArrowRight className="text-xs" />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <aside
                                id="ooo-notes-panel"
                                className={`scroll-mt-20 space-y-3 rounded-xl border bg-white p-4 transition sm:space-y-4 sm:p-5 ${
                                    notesPulse
                                        ? 'border-[#56B586] ring-2 ring-[#56B586]/30'
                                        : 'border-slate-200'
                                }`}
                            >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 sm:text-lg">
                                        <HiOutlineDocumentText className="shrink-0 text-[#56B586]" />
                                        Meeting Notes
                                    </h3>
                                    {selectedMeeting && (
                                        <button
                                            type="button"
                                            onClick={() => setShowHistoryModal(true)}
                                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                        >
                                            History
                                        </button>
                                    )}
                                </div>

                                {selectedMeeting ? (
                                    <>
                                        <p className="mb-2 text-sm text-slate-500">
                                            Notes with {getOtherPersonName(selectedMeeting)} ·{' '}
                                            {formatMeetingDate(selectedMeeting._scheduledAt)}
                                        </p>
                                        <MeetingNotesPanel
                                            meeting={selectedMeeting}
                                            currentUserId={currentUserId}
                                            onMeetingUpdated={mergeMeetingUpdate}
                                        />
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Select a meeting from upcoming or past to view and add notes.
                                    </p>
                                )}
                            </aside>
                        </div>
                    </>
                )}
            </div>
            </div>
            </div>
            {showHistoryModal && selectedMeeting && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
                    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <h4 className="text-base font-semibold text-slate-900 sm:text-lg">
                                Meeting Summary & History
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowHistoryModal(false)}
                                className="shrink-0 rounded px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-medium text-slate-800">{getOtherPersonName(selectedMeeting)}</p>
                            <p className="text-xs text-slate-500">
                                {formatMeetingDate(selectedMeeting._scheduledAt)} {selectedMeeting.scheduledTime ? `• ${selectedMeeting.scheduledTime}` : ''}
                                {' · '}
                                <span className={statusTone(selectedMeeting.status)}>{statusLabel(selectedMeeting.status)}</span>
                            </p>
                        </div>

                        <div className="mb-4">
                            <MeetingNotesPanel
                                meeting={selectedMeeting}
                                currentUserId={currentUserId}
                                onMeetingUpdated={(updated) => {
                                    mergeMeetingUpdate(updated);
                                }}
                                compact
                            />
                        </div>

                        {Array.isArray(selectedMeeting.statusHistory) && selectedMeeting.statusHistory.length > 0 && (
                            <div className="mb-2 max-h-40 overflow-y-auto">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Meeting history
                                </p>
                                <ul className="space-y-1.5">
                                    {selectedMeeting.statusHistory.slice(0, 8).map((entry, index) => (
                                        <li key={`${entry.at}-${index}`} className="text-xs text-slate-600">
                                            <span className="font-medium">{entry.action || entry.status}</span>
                                            {entry.note ? ` — ${entry.note}` : ''}
                                            {entry.at ? ` · ${format(new Date(entry.at), 'MMM dd, hh:mm a')}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {rescheduleMeeting && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
                    <form
                        onSubmit={submitReschedule}
                        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5"
                    >
                        <h4 className="text-base font-semibold text-slate-900 sm:text-lg">Propose new time</h4>
                        <p className="mt-1 text-sm text-slate-500">
                            Suggest a new date/time for {getOtherPersonName(rescheduleMeeting)}.
                        </p>
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Date</label>
                                <input
                                    type="date"
                                    required
                                    value={rescheduleForm.proposedDate}
                                    onChange={(e) =>
                                        setRescheduleForm((prev) => ({ ...prev, proposedDate: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:py-2"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Time</label>
                                <input
                                    type="time"
                                    required
                                    value={rescheduleForm.proposedTime}
                                    onChange={(e) =>
                                        setRescheduleForm((prev) => ({ ...prev, proposedTime: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:py-2"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reason (optional)</label>
                                <textarea
                                    value={rescheduleForm.reason}
                                    onChange={(e) =>
                                        setRescheduleForm((prev) => ({ ...prev, reason: e.target.value }))
                                    }
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:py-2"
                                    placeholder="Why do you need a new time?"
                                />
                            </div>
                        </div>
                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setRescheduleMeeting(null)}
                                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:py-2"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={Boolean(actionBusyId)}
                                className="rounded-lg bg-[#56B586] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4aa578] disabled:opacity-60 sm:py-2"
                            >
                                Send proposal
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
export default EmployeeOneOnOnePage;

