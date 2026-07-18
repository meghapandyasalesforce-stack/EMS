import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    FaCalendarAlt,
    FaClock,
    FaVideo,
    FaStickyNote,
    FaArrowRight,
    FaPaperclip,
    FaHistory,
    FaEllipsisV,
    FaCircle
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { HiOutlineDocumentText } from 'react-icons/hi2';

const EmployeeOneOnOnePage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeetingId, setSelectedMeetingId] = useState('');
    const [noteDrafts, setNoteDrafts] = useState({});
    const [savingNotes, setSavingNotes] = useState(false);
    const [noteHistory, setNoteHistory] = useState({});
    const [attachmentsByMeeting, setAttachmentsByMeeting] = useState({});
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const fileInputRef = useRef(null);
    const actionMenuRef = useRef(null);

    useEffect(() => {
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                withCredentials: true
            });

            const allMeetings = response.data?.data || [];
            const currentUser = user || employee;
            const currentUserId = currentUser?._id || currentUser?.id;

            // Backend already scopes meetings by employee; keep a defensive
            // filter only when current identity is available.
            const employeeMeetings = currentUserId
                ? allMeetings.filter((meeting) => {
                    const meetingEmployeeId = meeting.employeeId?._id || meeting.employeeId;
                    return String(meetingEmployeeId) === String(currentUserId);
                })
                : allMeetings;

            setMeetings(employeeMeetings);
        } catch (error) {
            toast.error('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    };

    const sortedMeetings = useMemo(() => {
        return [...meetings]
            .map((meeting) => ({
                ...meeting,
                _scheduledAt: new Date(meeting.scheduledDate)
            }))
            .filter((meeting) => !Number.isNaN(meeting._scheduledAt.getTime()))
            .sort((a, b) => a._scheduledAt.getTime() - b._scheduledAt.getTime());
    }, [meetings]);

    const now = useMemo(() => new Date(), [meetings]);

    const upcomingMeetings = useMemo(() => {
        return sortedMeetings.filter((meeting) => {
            const status = (meeting.status || '').toLowerCase();
            return meeting._scheduledAt >= now && status !== 'cancelled';
        });
    }, [sortedMeetings, now]);

    const pastMeetings = useMemo(() => {
        return sortedMeetings
            .filter((meeting) => {
                const status = (meeting.status || '').toLowerCase();
                return meeting._scheduledAt < now || status === 'completed' || status === 'cancelled';
            })
            .sort((a, b) => b._scheduledAt.getTime() - a._scheduledAt.getTime());
    }, [sortedMeetings, now]);

    const nextMeeting = upcomingMeetings[0] || null;

    useEffect(() => {
        if (!selectedMeetingId && nextMeeting?._id) {
            setSelectedMeetingId(nextMeeting._id);
        }
    }, [nextMeeting, selectedMeetingId]);

    useEffect(() => {
        if (!openActionMenuId) return undefined;

        const handleOutsideClick = (event) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
                setOpenActionMenuId(null);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setOpenActionMenuId(null);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openActionMenuId]);

    useEffect(() => {
        const currentUser = user || employee;
        if (!currentUser || meetings.length === 0) return;

        const currentUserId = currentUser?._id || currentUser?.id || 'employee';
        const storedDrafts = {};
        const storedHistory = {};
        const storedAttachments = {};

        meetings.forEach((meeting) => {
            const notesKey = `oneOnOneNotes:${currentUserId}:${meeting._id}`;
            const historyKey = `oneOnOneNotesHistory:${currentUserId}:${meeting._id}`;
            const attachmentsKey = `oneOnOneAttachments:${currentUserId}:${meeting._id}`;

            const notesValue = localStorage.getItem(notesKey);
            if (notesValue) {
                storedDrafts[meeting._id] = notesValue;
            }

            const historyValue = localStorage.getItem(historyKey);
            if (historyValue) {
                try {
                    storedHistory[meeting._id] = JSON.parse(historyValue);
                } catch (e) {
                    storedHistory[meeting._id] = [];
                }
            }

            const attachmentsValue = localStorage.getItem(attachmentsKey);
            if (attachmentsValue) {
                try {
                    storedAttachments[meeting._id] = JSON.parse(attachmentsValue);
                } catch (e) {
                    storedAttachments[meeting._id] = [];
                }
            }
        });

        if (Object.keys(storedDrafts).length > 0) {
            setNoteDrafts((prev) => ({ ...storedDrafts, ...prev }));
        }
        if (Object.keys(storedHistory).length > 0) {
            setNoteHistory((prev) => ({ ...storedHistory, ...prev }));
        }
        if (Object.keys(storedAttachments).length > 0) {
            setAttachmentsByMeeting((prev) => ({ ...storedAttachments, ...prev }));
        }
    }, [meetings, user, employee]);

    const selectedMeeting =
        sortedMeetings.find((meeting) => meeting._id === selectedMeetingId) ||
        nextMeeting ||
        pastMeetings[0] ||
        null;

    const selectedNotes = selectedMeeting
        ? (noteDrafts[selectedMeeting._id] ?? selectedMeeting.notes ?? '')
        : '';

    const getInitials = (name = 'Manager') =>
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('');

    const handleSaveNotes = () => {
        if (!selectedMeeting?._id) {
            toast.info('Select a meeting to save notes.');
            return;
        }

        const currentUser = user || employee;
        const currentUserId = currentUser?._id || currentUser?.id || 'employee';
        const storageKey = `oneOnOneNotes:${currentUserId}:${selectedMeeting._id}`;
        const historyKey = `oneOnOneNotesHistory:${currentUserId}:${selectedMeeting._id}`;
        const historyEntry = {
            content: selectedNotes || '',
            savedAt: new Date().toISOString()
        };
        const existingHistory = noteHistory[selectedMeeting._id] || [];
        const updatedHistory = [historyEntry, ...existingHistory].slice(0, 10);

        setSavingNotes(true);
        localStorage.setItem(storageKey, selectedNotes || '');
        localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
        setNoteHistory((prev) => ({
            ...prev,
            [selectedMeeting._id]: updatedHistory
        }));
        setTimeout(() => {
            setSavingNotes(false);
            toast.success('Notes saved on this device');
        }, 250);
    };

    const handleViewSummary = (meetingId) => {
        setSelectedMeetingId(meetingId);
        setShowHistoryModal(true);
    };

    const handleAttachClick = () => {
        if (!selectedMeeting?._id) {
            toast.info('Select a meeting before attaching files.');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event) => {
        const files = Array.from(event.target.files || []);
        if (!selectedMeeting?._id || files.length === 0) return;

        const currentUser = user || employee;
        const currentUserId = currentUser?._id || currentUser?.id || 'employee';
        const attachmentsKey = `oneOnOneAttachments:${currentUserId}:${selectedMeeting._id}`;
        const existing = attachmentsByMeeting[selectedMeeting._id] || [];
        const newEntries = files.map((file) => ({
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString()
        }));
        const updated = [...newEntries, ...existing].slice(0, 20);

        setAttachmentsByMeeting((prev) => ({
            ...prev,
            [selectedMeeting._id]: updated
        }));
        localStorage.setItem(attachmentsKey, JSON.stringify(updated));
        toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`);
        event.target.value = '';
    };

    const handleCopyMeetingLink = async (meeting) => {
        if (!meeting?.meetingLink) {
            toast.info('No meeting link available');
            return;
        }

        try {
            await navigator.clipboard.writeText(meeting.meetingLink);
            toast.success('Meeting link copied');
        } catch (error) {
            toast.error('Unable to copy link');
        } finally {
            setOpenActionMenuId(null);
        }
    };

    const handleOpenNotes = (meetingId) => {
        setSelectedMeetingId(meetingId);
        setShowHistoryModal(false);
        setOpenActionMenuId(null);
    };

    const handleViewSummaryFromMenu = (meetingId) => {
        setSelectedMeetingId(meetingId);
        setShowHistoryModal(true);
        setOpenActionMenuId(null);
    };

    const formatICSDate = (date) =>
        date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const handleAddToCalendar = (meeting) => {
        try {
            const start = new Date(meeting.scheduledDate);
            if (meeting.scheduledTime) {
                const [hours, minutes] = String(meeting.scheduledTime).split(':').map(Number);
                if (Number.isFinite(hours) && Number.isFinite(minutes)) {
                    start.setHours(hours, minutes, 0, 0);
                }
            }

            if (Number.isNaN(start.getTime())) {
                toast.error('Invalid meeting date');
                return;
            }

            const durationMinutes = Number(meeting.duration) || 30;
            const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
            const title = `1:1 with ${getManagerName(meeting)}`;
            const description = meeting.agenda
                ?.map((item) => item.topic)
                .filter(Boolean)
                .join(', ') || 'One-on-one meeting';
            const location = meeting.location || meeting.meetingLink || 'Online';

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Paarsiv//EMS//EN',
                'BEGIN:VEVENT',
                `UID:${meeting._id}@paarsiv-ems`,
                `DTSTAMP:${formatICSDate(new Date())}`,
                `DTSTART:${formatICSDate(start)}`,
                `DTEND:${formatICSDate(end)}`,
                `SUMMARY:${title}`,
                `DESCRIPTION:${description.replace(/\n/g, ' ')}`,
                `LOCATION:${location.replace(/\n/g, ' ')}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `one-on-one-${meeting._id}.ics`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);

            toast.success('Calendar invite downloaded');
        } catch (error) {
            toast.error('Unable to create calendar invite');
        } finally {
            setOpenActionMenuId(null);
        }
    };

    const formatMeetingDate = (dateObj) => format(dateObj, 'MMM dd, yyyy');
    const formatMeetingDay = (dateObj) => format(dateObj, 'EEE');
    const formatMeetingMonth = (dateObj) => format(dateObj, 'MMM').toUpperCase();
    const formatMeetingDateOnly = (dateObj) => format(dateObj, 'dd');
    const getManagerName = (meeting) => {
        const first = meeting?.managerId?.name || '';
        const last = meeting?.managerId?.lastName || '';
        return `${first} ${last}`.trim() || 'Your Manager';
    };
    const selectedMeetingHistory = selectedMeeting ? (noteHistory[selectedMeeting._id] || []) : [];
    const selectedMeetingAttachments = selectedMeeting ? (attachmentsByMeeting[selectedMeeting._id] || []) : [];

    if (loading) {
        return <LoadingSpinner message="Loading your one-on-one meetings..." />;
    }

    return (
        <div className="min-h-screen bg-[#F4F6FB] transition-all duration-300">
            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack">
                <header>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900">My 1:1 Meetings</h1>
                    <p className="mt-1 text-slate-600">
                        Manage your ongoing growth conversations and feedback loops.
                    </p>
                </header>

                {meetings.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
                        <FaCalendarAlt className="mx-auto mb-4 text-4xl text-slate-300" />
                        <p className="text-base font-medium text-slate-700">No one-on-one meetings scheduled</p>
                        <p className="mt-1 text-sm text-slate-500">
                            Your manager will schedule meetings with you here.
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                            {nextMeeting ? (
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex min-w-0 flex-1 items-start gap-5 border-l-[3px] border-[#20C997] pl-4">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#20C997]/15 text-lg font-semibold text-[#006D4E]">
                                            {getInitials(getManagerName(nextMeeting))}
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start">
                                            <div className="min-w-0 flex-1">
                                                <span className="mb-2 inline-flex rounded-md bg-[#20C997]/15 px-2 py-1 text-[11px] font-semibold tracking-wide text-[#006D4E]">
                                                    NEXT MEETING
                                                </span>
                                                <h2 className="leading-tight text-4xl font-semibold text-slate-900">
                                                    {getManagerName(nextMeeting)}
                                                </h2>
                                                <p className="text-slate-600">
                                                    {nextMeeting.managerId?.jobTitle || 'Manager'}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                                    <span className="inline-flex items-center gap-2">
                                                        <FaCalendarAlt className="text-slate-500" />
                                                        {format(nextMeeting._scheduledAt, 'MMM dd, yyyy')}
                                                    </span>
                                                    {nextMeeting.scheduledTime && (
                                                        <span className="inline-flex items-center gap-2">
                                                            <FaClock className="text-slate-500" />
                                                            {nextMeeting.scheduledTime}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full min-w-0 md:max-w-xs rounded-xl bg-slate-100/80 p-3 text-sm text-slate-600">
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#006D4E]">
                                                    Agenda Preview
                                                </p>
                                                <p className="line-clamp-6 text-[13px]">
                                                    {nextMeeting.agenda
                                                        ?.map((item) => item.topic)
                                                        .filter(Boolean)
                                                        .slice(0, 3)
                                                        .join(', ') || 'No agenda items shared yet.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3 lg:shrink-0">
                                        {nextMeeting.meetingLink && (
                                            <a
                                                href={nextMeeting.meetingLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-gradient-to-r from-[#20C997] to-[#0a8f6c] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:from-[#1ab589] hover:to-[#0a7a5e]"
                                            >
                                                Join Meeting
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMeetingId(nextMeeting._id)}
                                            className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-[#20C997]/60 px-6 py-3 text-base font-semibold text-[#0a8f6c] transition hover:bg-[#20C997]/10"
                                        >
                                            View Notes
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600">No upcoming 1:1 meetings at the moment.</p>
                            )}
                        </section>

                        <div className="hrms-main-rail">
                            <div className="min-w-0 space-y-6">
                                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-xl font-semibold text-slate-900">Upcoming</h3>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                            {upcomingMeetings.length} total
                                        </span>
                                    </div>

                                    {upcomingMeetings.length === 0 ? (
                                        <p className="text-sm text-slate-500">No upcoming meetings scheduled.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {upcomingMeetings.map((meeting) => (
                                                <button
                                                    type="button"
                                                    key={meeting._id}
                                                    onClick={() => setSelectedMeetingId(meeting._id)}
                                                    className={`w-full rounded-xl border p-4 text-left transition ${
                                                        selectedMeeting?._id === meeting._id
                                                            ? 'border-[#20C997]/50 bg-[#20C997]/5'
                                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="rounded-lg bg-[#20C997]/10 px-3 py-1.5 text-center">
                                                                <p className="text-[10px] font-bold tracking-wide text-[#20C997]">
                                                                    {formatMeetingMonth(meeting._scheduledAt)}
                                                                </p>
                                                                <p className="text-lg font-bold text-[#006D4E]">
                                                                    {formatMeetingDateOnly(meeting._scheduledAt)}
                                                                </p>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-semibold text-slate-800">
                                                                    {getManagerName(meeting)}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {meeting.managerId?.jobTitle || 'Manager'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-right">
                                                            <div>
                                                                <p className="text-sm text-slate-700">{meeting.duration || 30}m</p>
                                                                <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                                    <FaCircle className="text-[8px] text-[#20C997]" />
                                                                    Confirmed
                                                                </p>
                                                            </div>
                                                            <div className="relative" ref={openActionMenuId === meeting._id ? actionMenuRef : null}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenActionMenuId((prev) => (prev === meeting._id ? null : meeting._id));
                                                                    }}
                                                                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100"
                                                                    aria-label="Meeting quick actions"
                                                                    aria-expanded={openActionMenuId === meeting._id}
                                                                >
                                                                    <FaEllipsisV className="text-slate-400" />
                                                                </button>

                                                                {openActionMenuId === meeting._id && (
                                                                    <div
                                                                        className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        role="menu"
                                                                    >
                                                                        {meeting.meetingLink && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCopyMeetingLink(meeting)}
                                                                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                                role="menuitem"
                                                                            >
                                                                                Copy meeting link
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenNotes(meeting._id)}
                                                                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                            role="menuitem"
                                                                        >
                                                                            Open notes
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleViewSummaryFromMenu(meeting._id)}
                                                                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                            role="menuitem"
                                                                        >
                                                                            View summary
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAddToCalendar(meeting)}
                                                                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                                                            role="menuitem"
                                                                        >
                                                                            Add to calendar
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                    <h3 className="mb-4 text-xl font-semibold text-slate-900">Past Meetings</h3>
                                    {pastMeetings.length === 0 ? (
                                        <p className="text-sm text-slate-500">No past meetings yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {pastMeetings.slice(0, 6).map((meeting) => (
                                                <button
                                                    type="button"
                                                    key={meeting._id}
                                                    onClick={() => setSelectedMeetingId(meeting._id)}
                                                    className={`w-full rounded-xl border p-4 text-left transition ${
                                                        selectedMeeting?._id === meeting._id
                                                            ? 'border-[#20C997]/50 bg-[#20C997]/5'
                                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-center">
                                                                <p className="text-[10px] font-bold tracking-wide text-slate-500">
                                                                    {formatMeetingMonth(meeting._scheduledAt)}
                                                                </p>
                                                                <p className="text-lg font-bold text-slate-700">
                                                                    {formatMeetingDateOnly(meeting._scheduledAt)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-slate-800">
                                                                    {getManagerName(meeting)}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {meeting.managerId?.jobTitle || 'Manager'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm text-slate-700">{meeting.duration || 30}m</p>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewSummary(meeting._id);
                                                                }}
                                                                className="inline-flex items-center gap-1 text-sm font-semibold text-[#20C997] transition hover:text-[#0a8f6c]"
                                                            >
                                                                View Summary <FaArrowRight className="text-xs" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <aside className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                                        <HiOutlineDocumentText className="text-[#20C997]" />
                                        Meeting Notes
                                    </h3>
                                    <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        Drafting
                                    </span>
                                </div>

                                {selectedMeeting ? (
                                    <>
                                        <p className="mb-3 text-sm text-slate-500">
                                            Drafting notes for {formatMeetingDate(selectedMeeting._scheduledAt)} with{' '}
                                            {getManagerName(selectedMeeting)}:
                                        </p>
                                        <textarea
                                            value={selectedNotes}
                                            onChange={(e) =>
                                                setNoteDrafts((prev) => ({
                                                    ...prev,
                                                    [selectedMeeting._id]: e.target.value
                                                }))
                                            }
                                            className="h-64 w-full resize-none rounded-xl border border-slate-100 bg-slate-100/60 p-3 text-sm text-slate-700 outline-none transition focus:border-[#20C997]/40 focus:ring-2 focus:ring-[#20C997]/20"
                                            placeholder="Capture key discussion points, action items, and follow-ups..."
                                        />

                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAttachClick}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                            >
                                                <FaPaperclip />
                                                Attach
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!selectedMeeting) {
                                                        toast.info('Select a meeting first.');
                                                        return;
                                                    }
                                                    setShowHistoryModal(true);
                                                }}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                            >
                                                <FaHistory />
                                                History
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveNotes}
                                            disabled={savingNotes}
                                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#20C997] to-[#0a8f6c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-[#1ab589] hover:to-[#0a7a5e] disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            <FaStickyNote />
                                            {savingNotes ? 'Saving...' : 'Save Notes'}
                                        </button>
                                        <p className="text-center text-[11px] text-slate-400">
                                            {selectedMeetingHistory[0]?.savedAt
                                                ? `Last saved at ${format(new Date(selectedMeetingHistory[0].savedAt), 'hh:mm a')}`
                                                : 'No saved note versions yet'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Select a meeting from upcoming or past to view and draft notes.
                                    </p>
                                )}

                                {selectedMeeting && selectedMeetingAttachments.length > 0 && (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                        <p className="mb-2 text-xs font-semibold text-slate-600">Attached files</p>
                                        <ul className="space-y-1 text-xs text-slate-500">
                                            {selectedMeetingAttachments.slice(0, 3).map((file, index) => (
                                                <li key={`${file.name}-${index}`} className="truncate">
                                                    {file.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-100 bg-[#fff8ef] p-3 text-xs text-slate-600">
                                    <p className="font-semibold text-slate-700">Pro-tip</p>
                                    <p className="mt-1">Notes are private until you choose to share them with your manager.</p>
                                </div>
                            </aside>
                        </div>
                    </>
                )}
            </div>
            </div>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileSelected}
            />
            {showHistoryModal && selectedMeeting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-slate-900">
                                Meeting Summary & History
                            </h4>
                            <button
                                type="button"
                                onClick={() => setShowHistoryModal(false)}
                                className="rounded px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-medium text-slate-800">{getManagerName(selectedMeeting)}</p>
                            <p className="text-xs text-slate-500">
                                {formatMeetingDate(selectedMeeting._scheduledAt)} {selectedMeeting.scheduledTime ? `• ${selectedMeeting.scheduledTime}` : ''}
                            </p>
                            <p className="mt-2">
                                {selectedMeeting.notes || noteDrafts[selectedMeeting._id] || 'No summary notes available yet.'}
                            </p>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Saved Versions
                            </p>
                            {selectedMeetingHistory.length === 0 ? (
                                <p className="text-sm text-slate-500">No saved versions yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {selectedMeetingHistory.map((entry, index) => (
                                        <li key={`${entry.savedAt}-${index}`} className="rounded-lg border border-slate-100 p-3">
                                            <p className="mb-1 text-xs text-slate-400">
                                                {format(new Date(entry.savedAt), 'MMM dd, yyyy hh:mm a')}
                                            </p>
                                            <p className="line-clamp-3 text-sm text-slate-700">
                                                {entry.content || '(empty note)'}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeOneOnOnePage;

