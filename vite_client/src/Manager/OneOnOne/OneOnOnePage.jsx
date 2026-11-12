import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import {
    FiArrowLeft,
    FiBell,
    FiCalendar,
    FiCheck,
    FiClock,
    FiEdit2,
    FiList,
    FiLoader,
    FiMapPin,
    FiPlus,
    FiSearch,
    FiVideo,
    FiX,
} from 'react-icons/fi';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';
import { useAuthPermissions } from '../../Hooks/useAuthPermissions';
import MeetingNotesPanel from '../../components/MeetingNotesPanel';
import { sanitizeMeetingLink } from '../../utils/meetingLink';
import './OneOnOneSchedule.css';

const NAVY = '#0E2B3D';
const MINT = '#1CCA9B';
const CARD = 'rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)]';
const FIELD =
    'w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0E2B3D] outline-none focus:ring-2 focus:ring-[#1CCA9B]';

const FILTERS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
];

const CADENCE_OPTIONS = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'];
const OPEN_STATUSES = ['Pending Response', 'Scheduled', 'Rescheduled'];
const COMPLETE_STATUSES = ['Scheduled', 'Rescheduled', 'No Show'];
const LOCKED_STATUSES = ['Completed', 'Cancelled', 'Declined'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_CLASS = {
    'Pending Response': 'bg-amber-100 text-amber-800',
    Scheduled: 'bg-[#D1F5EA] text-[#07523E]',
    Completed: 'bg-[#D1F5EA] text-[#07523E]',
    Cancelled: 'bg-red-100 text-red-700',
    Declined: 'bg-red-100 text-red-700',
    Rescheduled: 'bg-amber-100 text-amber-800',
    'No Show': 'bg-slate-100 text-slate-600',
};

function personName(person) {
    if (!person || typeof person === 'string') return '';
    return `${person.name || ''} ${person.lastName || ''}`.trim();
}

function initials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, 'yyyy-MM-dd');
}

function meetingDay(meeting) {
    const date = new Date(meeting?.scheduledDate);
    if (Number.isNaN(date.getTime())) return null;
    return startOfDay(date);
}

function matchesFilter(meeting, key, today) {
    const status = meeting?.status;
    const day = meetingDay(meeting);
    if (key === 'upcoming') {
        if (['Completed', 'Cancelled', 'Declined', 'No Show'].includes(status)) return false;
        if (!day) return true;
        return day >= today;
    }
    if (key === 'past') {
        if (['Completed', 'No Show'].includes(status)) return true;
        return Boolean(day && day < today);
    }
    if (key === 'pending') return status === 'Pending Response' || status === 'Rescheduled';
    if (key === 'completed') return status === 'Completed';
    if (key === 'cancelled') return status === 'Cancelled' || status === 'Declined';
    return true;
}

function matchesQuery(meeting, query) {
    if (!query) return true;
    const haystack = [
        personName(meeting.employeeId),
        meeting.location,
        meeting.status,
        ...(Array.isArray(meeting.agenda) ? meeting.agenda.flatMap((item) => [item.topic, item.notes]) : []),
    ]
        .join(' ')
        .toLowerCase();
    return haystack.includes(query);
}

function cadenceFromMeeting(meeting) {
    if (!meeting?.recurring?.enabled) return 'One-time';
    return CADENCE_OPTIONS.includes(meeting.recurring.frequency) ? meeting.recurring.frequency : 'One-time';
}

function ownerLabel(assignedTo, participant, selfName) {
    if (assignedTo === 'Manager') return selfName || 'You';
    if (assignedTo === 'Both') return 'Both';
    return participant || 'Employee';
}

function StatusPill({ status }) {
    const label = status === 'Rescheduled' ? 'Reschedule Pending' : status || 'Scheduled';
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[status] || STATUS_CLASS.Scheduled}`}>
            {label}
        </span>
    );
}

function ModalFrame({ title, titleClassName = '', onClose, children, wide = false }) {
    return (
        <div
            className="fixed inset-0 z-[11000] flex items-end justify-center bg-[#0E2B3D]/50 p-0 sm:items-center sm:p-4"
            role="presentation"
            onClick={onClose}
        >
            <div
                className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#E2E8F0] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#f8faf9] px-5 py-4">
                    <h3 className={`text-base font-semibold text-[#0E2B3D] ${titleClassName}`}>{title}</h3>
                    <button
                        type="button"
                        className="rounded-lg p-1 text-slate-500 hover:bg-white"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

const blankForm = () => ({
    employeeId: '',
    employeeIds: [],
    scheduledDate: '',
    scheduledTime: '',
    duration: 30,
    location: '',
    meetingLink: '',
    cadence: 'One-time',
    agenda: [{ topic: '', notes: '', discussed: false }],
});

const OneOnOnePage = ({ onBackToReceive = null, focusMeetingId: focusMeetingIdProp = '' } = {}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusMeetingId = focusMeetingIdProp || searchParams.get('meetingId') || '';
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const { isHrManager, isHrExecutive, isOrgOwner } = useAuthPermissions();

    const isHrUser = useMemo(() => {
        if (isHrManager || isHrExecutive || isOrgOwner) return true;
        return isHR(user) || isHR(employee);
    }, [user, employee, isHrManager, isHrExecutive, isOrgOwner]);

    const canInviteMany = Boolean(isHrUser || isOrgOwner || (user?.role || employee?.role) === 'admin');
    const currentUserId = String(
        employee?._id || employee?.id || user?.employeeProfileId || user?._id || user?.id || ''
    );
    const selfName = personName(employee) || personName(user) || 'You';

    const [meetings, setMeetings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState(null);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [formData, setFormData] = useState(blankForm);
    const [filterKey, setFilterKey] = useState('upcoming');
    const [query, setQuery] = useState('');
    const [surface, setSurface] = useState('calendar');
    const [detailId, setDetailId] = useState('');
    const [month, setMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [rescheduleFor, setRescheduleFor] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' });
    const [cancelFor, setCancelFor] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [actionText, setActionText] = useState('');
    const [actionOwner, setActionOwner] = useState('Employee');
    const [actionBusy, setActionBusy] = useState(false);

    const lastErrorToastAt = useRef(0);
    const focusedOnce = useRef(false);

    const showLoadError = (message) => {
        const now = Date.now();
        if (now - lastErrorToastAt.current < 4000) return;
        lastErrorToastAt.current = now;
        toast.error(message);
    };

    const goToMyOneOnOne = () => {
        if (typeof onBackToReceive === 'function') {
            onBackToReceive();
            return;
        }
        navigate('/1-on-1');
    };

    const replaceMeeting = (updated) => {
        if (!updated?._id) return;
        setMeetings((previous) =>
            previous.map((meeting) => (String(meeting._id) === String(updated._id) ? { ...meeting, ...updated } : meeting))
        );
    };

    const fetchMeetings = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', { withCredentials: true });
            const all = response.data?.data || [];
            const organized = currentUserId
                ? all.filter((meeting) => String(meeting.managerId?._id || meeting.managerId) === currentUserId)
                : all;
            setMeetings(organized);
        } catch {
            showLoadError('Failed to load one-on-one meetings');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/v1/both/one-on-one/eligible-invitees', { withCredentials: true });
            setEmployees(response.data?.data || []);
        } catch (error) {
            const status = error?.response?.status;
            if (status === 404 || status === 403) {
                try {
                    const fallback = await axios.get('/v1/admin/employee', {
                        params: { limit: 100 },
                        withCredentials: true,
                    });
                    const list = fallback.data?.data || fallback.data?.employees || [];
                    const selfId = String((user || employee)?._id || (user || employee)?.id || '');
                    setEmployees(list.filter((emp) => String(emp._id || emp.id) !== selfId));
                    return;
                } catch {
                    /* fall through */
                }
            }
            setEmployees([]);
            showLoadError(error?.response?.data?.message || 'Failed to load employee list');
        }
    };

    useEffect(() => {
        fetchMeetings();
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInviteMany]);

    useEffect(() => {
        if (!detailId || loading) return;
        const stillThere = meetings.some((meeting) => String(meeting._id) === String(detailId));
        if (!stillThere) setDetailId('');
    }, [detailId, loading, meetings]);

    useEffect(() => {
        if (focusedOnce.current || !focusMeetingId || loading) return;
        const found = meetings.find((meeting) => String(meeting._id) === String(focusMeetingId));
        if (!found) return;
        focusedOnce.current = true;
        setDetailId(String(found._id));
        const key = dateKey(found.scheduledDate);
        if (key) {
            setSelectedDate(key);
            setMonth(startOfMonth(new Date(found.scheduledDate)));
        }
    }, [focusMeetingId, loading, meetings]);

    useEffect(() => {
        if (!showCreateModal && !rescheduleFor && !cancelFor) return undefined;
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            setShowCreateModal(false);
            setEditingMeeting(null);
            setRescheduleFor(null);
            setCancelFor(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showCreateModal, rescheduleFor, cancelFor]);

    const normalizedQuery = query.trim().toLowerCase();
    const today = useMemo(() => startOfDay(new Date()), []);

    const counts = useMemo(() => {
        const next = {};
        FILTERS.forEach((filter) => {
            next[filter.key] = meetings.reduce(
                (total, meeting) => total + (matchesFilter(meeting, filter.key, today) ? 1 : 0),
                0
            );
        });
        return next;
    }, [meetings, today]);

    const filteredMeetings = useMemo(
        () =>
            meetings.filter(
                (meeting) => matchesFilter(meeting, filterKey, today) && matchesQuery(meeting, normalizedQuery)
            ),
        [meetings, filterKey, today, normalizedQuery]
    );

    const meetingsByDay = useMemo(() => {
        const map = new Map();
        filteredMeetings.forEach((meeting) => {
            const key = dateKey(meeting.scheduledDate);
            if (!key) return;
            const bucket = map.get(key);
            if (bucket) bucket.push(meeting);
            else map.set(key, [meeting]);
        });
        return map;
    }, [filteredMeetings]);

    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [month]);

    const selectedDayMeetings = meetingsByDay.get(selectedDate) || [];
    const active = useMemo(
        () => meetings.find((meeting) => String(meeting._id) === String(detailId)) || null,
        [meetings, detailId]
    );

    const pastWithPerson = useMemo(() => {
        if (!active) return [];
        const employeeId = String(active.employeeId?._id || active.employeeId || '');
        return meetings
            .filter(
                (meeting) =>
                    String(meeting._id) !== String(active._id) &&
                    String(meeting.employeeId?._id || meeting.employeeId) === employeeId
            )
            .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
            .slice(0, 4);
    }, [meetings, active]);

    const filteredEmployees = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((emp) => {
            const name = `${emp.name || ''} ${emp.lastName || ''}`.toLowerCase();
            const email = String(emp.email || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [employees, employeeSearch]);

    const visibleEmployees = filteredEmployees.slice(0, 40);

    const resetForm = () => {
        setEmployeeSearch('');
        setFormData(blankForm());
    };

    const closeCreate = () => {
        setShowCreateModal(false);
        setEditingMeeting(null);
        resetForm();
    };

    const openCreate = () => {
        setEditingMeeting(null);
        resetForm();
        setShowCreateModal(true);
    };

    const openEdit = (meeting) => {
        const meetingDate = new Date(meeting.scheduledDate);
        setEditingMeeting(meeting);
        setEmployeeSearch('');
        setFormData({
            employeeId: meeting.employeeId?._id || meeting.employeeId || '',
            employeeIds: [],
            scheduledDate: Number.isNaN(meetingDate.getTime()) ? '' : format(meetingDate, 'yyyy-MM-dd'),
            scheduledTime: meeting.scheduledTime || '',
            duration: meeting.duration || 30,
            location: meeting.location || '',
            meetingLink: sanitizeMeetingLink(meeting.meetingLink),
            cadence: cadenceFromMeeting(meeting),
            agenda:
                meeting.agenda && meeting.agenda.length > 0
                    ? meeting.agenda.map((item) => ({
                          topic: item.topic || '',
                          notes: item.notes || '',
                          discussed: Boolean(item.discussed),
                      }))
                    : [{ topic: '', notes: '', discussed: false }],
        });
        setShowCreateModal(true);
    };

    const openMeeting = (meeting) => {
        setDetailId(String(meeting._id));
        setActionText('');
        const key = dateKey(meeting.scheduledDate);
        if (key) setSelectedDate(key);
    };

    const showSurface = (next) => {
        setSurface(next);
        setDetailId('');
    };

    const openReschedule = (meeting) => {
        const meetingDate = new Date(meeting.scheduledDate);
        setRescheduleFor(meeting);
        setRescheduleForm({
            date: Number.isNaN(meetingDate.getTime()) ? '' : format(meetingDate, 'yyyy-MM-dd'),
            time: meeting.scheduledTime || '',
        });
    };

    const toggleEmployeeId = (id) => {
        const value = String(id);
        setFormData((previous) => {
            const exists = previous.employeeIds.includes(value);
            return {
                ...previous,
                employeeIds: exists
                    ? previous.employeeIds.filter((item) => item !== value)
                    : [...previous.employeeIds, value],
            };
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const inviteIds =
            !editingMeeting && canInviteMany
                ? formData.employeeIds
                : formData.employeeId
                  ? [formData.employeeId]
                  : [];

        if (inviteIds.length === 0 || !formData.scheduledDate || !formData.scheduledTime) {
            toast.warning(
                canInviteMany && !editingMeeting
                    ? 'Select at least one employee and fill in date and time'
                    : 'Please fill in all required fields'
            );
            return;
        }

        const recurring =
            formData.cadence && formData.cadence !== 'One-time'
                ? { enabled: true, frequency: formData.cadence }
                : { enabled: false };
        const basePayload = {
            scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString(),
            scheduledTime: formData.scheduledTime,
            duration: formData.duration,
            location: formData.location,
            meetingLink: formData.meetingLink,
            agenda: formData.agenda.filter((item) => item.topic.trim() !== ''),
            recurring,
        };

        try {
            setSubmitting(true);
            if (editingMeeting) {
                const response = await axios.put(
                    `/v1/both/one-on-one/one-on-ones/${editingMeeting._id}`,
                    { ...basePayload, employeeId: formData.employeeId },
                    { withCredentials: true }
                );
                replaceMeeting(response.data?.data);
                toast.success(response.data?.message || 'Meeting updated successfully');
            } else {
                const payload =
                    canInviteMany && inviteIds.length > 1
                        ? { ...basePayload, employeeIds: inviteIds }
                        : { ...basePayload, employeeId: inviteIds[0], employeeIds: inviteIds };
                await axios.post('/v1/both/one-on-one/one-on-ones', payload, { withCredentials: true });
                toast.success(inviteIds.length > 1 ? `${inviteIds.length} meetings scheduled` : 'Meeting scheduled successfully');
                fetchMeetings({ silent: true });
            }

            setShowCreateModal(false);
            setEditingMeeting(null);
            resetForm();
            setSurface('calendar');
            setDetailId('');
            setSelectedDate(formData.scheduledDate);
            const parsed = new Date(`${formData.scheduledDate}T12:00:00`);
            if (!Number.isNaN(parsed.getTime())) setMonth(startOfMonth(parsed));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmReschedule = async () => {
        if (!rescheduleFor || !rescheduleForm.date || !rescheduleForm.time) {
            toast.warning('Enter a valid date and time.');
            return;
        }
        try {
            setSubmitting(true);
            const response = await axios.put(
                `/v1/both/one-on-one/one-on-ones/${rescheduleFor._id}`,
                {
                    scheduledDate: new Date(`${rescheduleForm.date}T${rescheduleForm.time}`).toISOString(),
                    scheduledTime: rescheduleForm.time,
                },
                { withCredentials: true }
            );
            replaceMeeting(response.data?.data);
            setSelectedDate(rescheduleForm.date);
            const parsed = new Date(`${rescheduleForm.date}T12:00:00`);
            if (!Number.isNaN(parsed.getTime())) setMonth(startOfMonth(parsed));
            setRescheduleFor(null);
            toast.success(response.data?.message || 'Meeting rescheduled. The invitee needs to confirm.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reschedule meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmCancel = async () => {
        if (!cancelFor) return;
        try {
            setSubmitting(true);
            const response = await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${cancelFor._id}/cancel`,
                { reason: cancelReason },
                { withCredentials: true }
            );
            replaceMeeting(response.data?.data);
            setCancelFor(null);
            setCancelReason('');
            setDetailId('');
            toast.success(response.data?.message || 'Meeting cancelled');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const markAsDone = async (meeting) => {
        try {
            setSubmitting(true);
            const response = await axios.post(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/complete`,
                { actionItems: meeting.actionItems || [] },
                { withCredentials: true }
            );
            replaceMeeting(response.data?.data);
            setDetailId('');
            toast.success(response.data?.message || 'Meeting marked as completed');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to complete meeting');
        } finally {
            setSubmitting(false);
        }
    };

    const respondReschedule = async (meeting, action) => {
        try {
            const response = await axios.patch(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}/respond-reschedule`,
                { action },
                { withCredentials: true }
            );
            replaceMeeting(response.data?.data);
            toast.success(action === 'accept' ? 'New time confirmed' : 'Proposal declined');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update the proposal');
        }
    };

    const persistActionItems = async (meeting, nextItems) => {
        setActionBusy(true);
        try {
            const response = await axios.put(
                `/v1/both/one-on-one/one-on-ones/${meeting._id}`,
                {
                    actionItems: nextItems.map((item) => ({
                        item: item.item,
                        assignedTo: item.assignedTo || 'Employee',
                        status: item.status || 'Pending',
                        ...(item.dueDate ? { dueDate: item.dueDate } : {}),
                        ...(item.status === 'Completed' && item.completedAt ? { completedAt: item.completedAt } : {}),
                    })),
                },
                { withCredentials: true }
            );
            replaceMeeting(response.data?.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save action items');
        } finally {
            setActionBusy(false);
        }
    };

    const addActionItem = () => {
        if (!active || actionBusy) return;
        const text = actionText.trim();
        if (!text) {
            toast.warning('Enter an action item first.');
            return;
        }
        const next = [...(active.actionItems || []), { item: text, assignedTo: actionOwner, status: 'Pending' }];
        setActionText('');
        persistActionItems(active, next);
    };

    const toggleAction = (index) => {
        if (!active || actionBusy) return;
        const next = (active.actionItems || []).map((item, itemIndex) => {
            if (itemIndex !== index) return item;
            const done = item.status !== 'Completed';
            return {
                ...item,
                status: done ? 'Completed' : 'Pending',
                completedAt: done ? new Date().toISOString() : undefined,
            };
        });
        persistActionItems(active, next);
    };

    const resolveJoinLink = (meeting) => sanitizeMeetingLink(meeting?.meetingLink);
    const canJoinMeeting = (meeting) => {
        if (['Cancelled', 'Declined', 'Completed'].includes(String(meeting?.status || ''))) return false;
        return Boolean(resolveJoinLink(meeting));
    };
    const handleJoinMeeting = (meeting) => {
        const link = resolveJoinLink(meeting);
        if (!link) {
            toast.info('No meeting link yet. Add one when you edit the meeting.');
            return;
        }
        window.open(link, '_blank', 'noopener,noreferrer');
    };

    const addAgendaItem = () => {
        setFormData((previous) => ({
            ...previous,
            agenda: [...previous.agenda, { topic: '', notes: '', discussed: false }],
        }));
    };
    const removeAgendaItem = (index) => {
        setFormData((previous) => ({
            ...previous,
            agenda: previous.agenda.filter((_, itemIndex) => itemIndex !== index),
        }));
    };
    const updateAgendaItem = (index, field, value) => {
        setFormData((previous) => {
            const agenda = previous.agenda.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            );
            return { ...previous, agenda };
        });
    };

    if (loading) {
        return <LoadingSpinner message="Loading one-on-one meetings..." />;
    }

    const activeName = personName(active?.employeeId);
    const canEditActive = active && !LOCKED_STATUSES.includes(active.status);
    const canCompleteActive = active && COMPLETE_STATUSES.includes(active.status);
    const proposal = active?.rescheduleProposal?.status === 'pending' ? active.rescheduleProposal : null;
    const proposalFromOther =
        proposal &&
        String(proposal.requestedBy?._id || proposal.requestedBy) !== String(user?._id || employee?._id);

    return (
        <div className="page-shell min-h-screen bg-[#f4f7f6]">
            <div className="page-shell-inner hrms-stack pb-10">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0a8f6c]">
                                Engage & Support
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-sm text-slate-500">Synchronized leadership cadence</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-[#0E2B3D] sm:text-3xl">One-on-One Meetings</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={goToMyOneOnOne}
                            className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#0E2B3D] hover:bg-slate-50"
                        >
                            My Meetings
                        </button>
                        <div className="flex rounded-xl bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                aria-pressed={surface === 'calendar' && !detailId}
                                onClick={() => showSurface('calendar')}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${surface === 'calendar' && !detailId ? 'bg-[#f4f7f6] font-semibold text-[#0a8f6c] shadow-sm' : 'text-slate-600'}`}
                            >
                                <FiCalendar className="h-4 w-4" />
                                Calendar
                            </button>
                            <button
                                type="button"
                                aria-pressed={surface === 'list' && !detailId}
                                onClick={() => showSurface('list')}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${surface === 'list' && !detailId ? 'bg-[#f4f7f6] font-semibold text-[#0a8f6c] shadow-sm' : 'text-slate-600'}`}
                            >
                                <FiList className="h-4 w-4" />
                                List
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
                            style={{ background: MINT, color: NAVY }}
                        >
                            <FiPlus className="h-4 w-4" />
                            Schedule Meeting
                        </button>
                    </div>
                </div>

                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 p-2">
                    <div className="flex gap-1 overflow-x-auto">
                        {FILTERS.map((filter) => {
                            const selected = filterKey === filter.key;
                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setFilterKey(filter.key)}
                                    className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium ${selected ? 'bg-white font-semibold text-[#0a8f6c] shadow-sm' : 'text-slate-500 hover:text-[#0E2B3D]'}`}
                                >
                                    {filter.label} ({counts[filter.key] || 0})
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative w-full md:w-64">
                        <FiSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            className="w-full rounded-xl border border-[#E2E8F0] bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1CCA9B]"
                            placeholder="Filter by participant or agenda..."
                            aria-label="Filter meetings"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                </div>

                {detailId && active ? (
                    <div className="space-y-5">
                        <div className={`${CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    className="rounded-xl bg-[#f4f7f6] p-2 text-[#0E2B3D] hover:bg-slate-200"
                                    aria-label="Back"
                                    onClick={() => setDetailId('')}
                                >
                                    <FiArrowLeft className="h-5 w-5" />
                                </button>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="truncate text-lg font-semibold text-[#0E2B3D]">
                                            One-on-One with {activeName || 'participant'}
                                        </h2>
                                        <StatusPill status={active.status} />
                                    </div>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        {dateKey(active.scheduledDate) || 'Date pending'} · {active.scheduledTime || 'Time pending'} · {active.duration || 30} mins
                                        {active.location ? ` · ${active.location}` : ''}
                                        {active.recurring?.enabled ? ` · ${active.recurring.frequency}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {canJoinMeeting(active) ? (
                                    <button
                                        type="button"
                                        onClick={() => handleJoinMeeting(active)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm font-medium text-[#0E2B3D]"
                                    >
                                        <FiVideo className="h-4 w-4" />
                                        Join
                                    </button>
                                ) : null}
                                {canEditActive ? (
                                    <button
                                        type="button"
                                        onClick={() => openEdit(active)}
                                        className="rounded-xl bg-[#f4f7f6] px-3.5 py-2 text-sm font-medium text-[#0E2B3D]"
                                    >
                                        Edit
                                    </button>
                                ) : null}
                                {OPEN_STATUSES.includes(active.status) ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openReschedule(active)}
                                            className="rounded-xl bg-[#f4f7f6] px-3.5 py-2 text-sm font-medium text-[#0E2B3D]"
                                        >
                                            Reschedule
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCancelReason('');
                                                setCancelFor(active);
                                            }}
                                            className="rounded-xl bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : null}
                                {canCompleteActive ? (
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => markAsDone(active)}
                                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                        style={{ background: '#0a8f6c' }}
                                    >
                                        <FiCheck className="h-4 w-4" />
                                        Mark as Done
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {proposal ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                <p className="font-semibold">Reschedule proposed</p>
                                <p className="mt-0.5">
                                    {proposal.proposedDate ? format(new Date(proposal.proposedDate), 'MMM d, yyyy') : ''}
                                    {proposal.proposedTime ? ` · ${proposal.proposedTime}` : ''}
                                    {proposal.reason ? ` — ${proposal.reason}` : ''}
                                </p>
                                {proposalFromOther ? (
                                    <div className="mt-2 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => respondReschedule(active, 'accept')}
                                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0E2B3D]"
                                            style={{ background: MINT }}
                                        >
                                            Accept time
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => respondReschedule(active, 'decline')}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mt-1 text-xs">Waiting for the other person to confirm.</p>
                                )}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                            <div className="space-y-5">
                                <section className={`${CARD} p-5`}>
                                    <h3 className="mb-4 text-base font-semibold text-[#0E2B3D]">Participants</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between rounded-xl bg-[#f4f7f6] p-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0E2B3D] text-sm font-semibold text-white">
                                                    {initials(selfName)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-[#0E2B3D]">{selfName}</p>
                                                    <p className="text-xs text-slate-500">Organizer (You)</p>
                                                </div>
                                            </div>
                                            <FiCheck className="h-4 w-4 text-[#0a8f6c]" />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl bg-[#f4f7f6] p-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D1F5EA] text-sm font-semibold text-[#07523E]">
                                                    {initials(activeName)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-[#0E2B3D]">{activeName || 'Participant'}</p>
                                                    <p className="text-xs text-slate-500">Participant</p>
                                                </div>
                                            </div>
                                            <FiCheck className="h-4 w-4" style={{ color: MINT }} />
                                        </div>
                                    </div>
                                </section>

                                <section className={`${CARD} p-5`}>
                                    <h3 className="mb-3 text-base font-semibold text-[#0E2B3D]">Meeting Agenda</h3>
                                    {active.agenda?.length ? (
                                        <ul className="space-y-2 text-sm text-slate-600">
                                            {active.agenda.map((item, index) => (
                                                <li key={`${item.topic}-${index}`}>
                                                    <p className="font-medium text-[#0E2B3D]">{item.topic}</p>
                                                    {item.notes ? <p className="whitespace-pre-wrap text-slate-500">{item.notes}</p> : null}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-slate-500">No agenda yet.</p>
                                    )}
                                </section>

                                <section className={`${CARD} p-5`}>
                                    <h3 className="mb-3 text-base font-semibold text-[#0E2B3D]">Past meetings</h3>
                                    {pastWithPerson.length === 0 ? (
                                        <p className="text-sm text-slate-500">No earlier meetings with this person.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {pastWithPerson.map((meeting) => (
                                                <button
                                                    key={meeting._id}
                                                    type="button"
                                                    onClick={() => openMeeting(meeting)}
                                                    className="block w-full rounded-xl bg-[#f4f7f6] p-3 text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-[#0E2B3D]">
                                                        <span>{dateKey(meeting.scheduledDate) ? format(new Date(meeting.scheduledDate), 'MMM d, yyyy') : 'Undated'}</span>
                                                        <StatusPill status={meeting.status} />
                                                    </div>
                                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                                        {meeting.agenda?.[0]?.topic || 'No agenda recorded'}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>

                            <div className="space-y-5 lg:col-span-2">
                                <section className={`${CARD} p-5`}>
                                    <div className="mb-4 flex items-center justify-between gap-2">
                                        <h3 className="text-base font-semibold text-[#0E2B3D]">Shared notes</h3>
                                        <span className="rounded-full bg-[#D1F5EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#07523E]">
                                            Saved for both
                                        </span>
                                    </div>
                                    <MeetingNotesPanel
                                        meeting={active}
                                        currentUserId={currentUserId}
                                        compact
                                        onMeetingUpdated={replaceMeeting}
                                    />
                                </section>

                                <section className={`${CARD} p-5`}>
                                    <div className="mb-4 flex items-center justify-between gap-2">
                                        <h3 className="text-base font-semibold text-[#0E2B3D]">Action items</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {(active.actionItems || []).length === 0 ? (
                                            <p className="text-sm text-slate-500">No action items yet.</p>
                                        ) : (
                                            (active.actionItems || []).map((item, index) => (
                                                <label
                                                    key={item._id || `${item.item}-${index}`}
                                                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f4f7f6] p-3 text-sm"
                                                >
                                                    <span className="flex min-w-0 items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.status === 'Completed'}
                                                            disabled={!canEditActive || actionBusy}
                                                            onChange={() => toggleAction(index)}
                                                            aria-label={item.item}
                                                        />
                                                        <span className={item.status === 'Completed' ? 'text-slate-400 line-through' : 'text-[#0E2B3D]'}>
                                                            {item.item}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                        Owner: {ownerLabel(item.assignedTo, activeName, selfName)}
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                        {canEditActive ? (
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <input
                                                    className={FIELD}
                                                    aria-label="New action item"
                                                    placeholder="Enter a new action item..."
                                                    value={actionText}
                                                    onChange={(event) => setActionText(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            addActionItem();
                                                        }
                                                    }}
                                                />
                                                <select
                                                    className={`${FIELD} sm:w-36`}
                                                    aria-label="Action item owner"
                                                    value={actionOwner}
                                                    onChange={(event) => setActionOwner(event.target.value)}
                                                >
                                                    <option value="Employee">Employee</option>
                                                    <option value="Manager">You</option>
                                                    <option value="Both">Both</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    disabled={actionBusy}
                                                    onClick={addActionItem}
                                                    className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
                                                    style={{ background: `${MINT}22`, color: '#07523E' }}
                                                >
                                                    {actionBusy ? 'Saving…' : 'Add'}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                ) : null}

                {!detailId && filteredMeetings.length === 0 ? (
                    <div className="mx-auto max-w-md px-4 py-16 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#0a8f6c]">
                            <FiCalendar className="h-10 w-10" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold text-[#0E2B3D]">
                            {meetings.length === 0 ? 'No one-on-one meetings yet' : 'No meetings in this view'}
                        </h3>
                        <p className="mb-6 text-sm text-slate-500">
                            {meetings.length === 0
                                ? 'Schedule a session to start a cadence with your team. Each invitee gets their own meeting and a notification.'
                                : 'Try another filter or clear the search. Scheduling still uses your organization directory.'}
                        </p>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm"
                            style={{ background: MINT, color: NAVY }}
                        >
                            Schedule Meeting
                        </button>
                    </div>
                ) : null}

                {!detailId && filteredMeetings.length > 0 && surface === 'calendar' ? (
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <section className={`${CARD} p-4 sm:p-5`}>
                            <div className="mb-4 flex items-center justify-between">
                                <button
                                    type="button"
                                    className="rounded-lg px-2 py-1 text-sm font-semibold text-[#0E2B3D] hover:bg-[#f4f7f6]"
                                    onClick={() => setMonth((current) => addMonths(current, -1))}
                                >
                                    Prev
                                </button>
                                <div className="text-center">
                                    <p className="text-base font-semibold text-[#0E2B3D]">{format(month, 'MMMM yyyy')}</p>
                                    <button
                                        type="button"
                                        className="text-xs font-medium text-[#0a8f6c]"
                                        onClick={() => {
                                            const now = new Date();
                                            setMonth(startOfMonth(now));
                                            setSelectedDate(format(now, 'yyyy-MM-dd'));
                                        }}
                                    >
                                        Today
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-lg px-2 py-1 text-sm font-semibold text-[#0E2B3D] hover:bg-[#f4f7f6]"
                                    onClick={() => setMonth((current) => addMonths(current, 1))}
                                >
                                    Next
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                {WEEKDAYS.map((day) => (
                                    <div key={day} className="py-1">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const items = meetingsByDay.get(key) || [];
                                    const inMonth = isSameMonth(day, month);
                                    const selected = key === selectedDate;
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => setSelectedDate(key)}
                                            className={`min-h-[4.5rem] cursor-pointer rounded-xl border p-1.5 text-left ${selected ? 'border-[#1CCA9B] bg-[#1CCA9B]/10' : 'border-transparent hover:bg-[#f4f7f6]'} ${inMonth ? '' : 'opacity-40'}`}
                                        >
                                            <span className={`text-xs font-semibold ${key === format(today, 'yyyy-MM-dd') ? 'text-[#0a8f6c]' : 'text-[#0E2B3D]'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            <div className="mt-1 space-y-0.5">
                                                {items.slice(0, 2).map((meeting) => (
                                                    <button
                                                        key={meeting._id}
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openMeeting(meeting);
                                                        }}
                                                        className="block w-full truncate rounded bg-[#0E2B3D] px-1 text-left text-[10px] font-medium text-white"
                                                    >
                                                        {personName(meeting.employeeId) || 'Meeting'}
                                                    </button>
                                                ))}
                                                {items.length > 2 ? (
                                                    <span className="block text-[10px] text-slate-500">+{items.length - 2}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                        <aside className={`${CARD} p-4 sm:p-5`}>
                            <h3 className="text-sm font-semibold text-[#0E2B3D]">
                                {format(new Date(`${selectedDate}T12:00:00`), 'EEE, MMM d')}
                            </h3>
                            <p className="mb-3 text-xs text-slate-500">{selectedDayMeetings.length} meeting{selectedDayMeetings.length === 1 ? '' : 's'}</p>
                            {selectedDayMeetings.length === 0 ? (
                                <p className="text-sm text-slate-500">Nothing scheduled this day in the current filter.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {selectedDayMeetings.map((meeting) => (
                                        <li key={meeting._id}>
                                            <button
                                                type="button"
                                                onClick={() => openMeeting(meeting)}
                                                className="w-full rounded-xl bg-[#f4f7f6] p-3 text-left"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="truncate text-sm font-semibold text-[#0E2B3D]">{personName(meeting.employeeId)}</p>
                                                    <StatusPill status={meeting.status} />
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {meeting.scheduledTime || 'Time pending'} · {meeting.duration || 30} min
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </aside>
                    </div>
                ) : null}

                {!detailId && filteredMeetings.length > 0 && surface === 'list' ? (
                    <ul className="space-y-3">
                        {filteredMeetings.map((meeting) => {
                            const name = personName(meeting.employeeId);
                            return (
                                <li key={meeting._id} id={`meeting-${meeting._id}`} className={`${CARD} p-4 sm:p-5`}>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openMeeting(meeting)}>
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D1F5EA] text-xs font-semibold text-[#07523E]">
                                                    {initials(name)}
                                                </div>
                                                <h3 className="text-sm font-semibold text-[#0E2B3D] sm:text-base">{name || 'Participant'}</h3>
                                                <StatusPill status={meeting.status} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-1 text-sm text-slate-600 sm:grid-cols-2">
                                                <span className="inline-flex items-center gap-2">
                                                    <FiCalendar className="h-4 w-4 text-slate-400" />
                                                    {dateKey(meeting.scheduledDate) ? format(new Date(meeting.scheduledDate), 'MMM d, yyyy') : 'Date pending'}
                                                </span>
                                                <span className="inline-flex items-center gap-2">
                                                    <FiClock className="h-4 w-4 text-slate-400" />
                                                    {meeting.scheduledTime || 'Time pending'}
                                                    {meeting.duration ? ` · ${meeting.duration} min` : ''}
                                                </span>
                                                {meeting.location ? (
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <span className="truncate">{meeting.location}</span>
                                                    </span>
                                                ) : null}
                                            </div>
                                            {meeting.agenda?.length ? (
                                                <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                                                    {meeting.agenda.slice(0, 2).map((item) => item.topic).filter(Boolean).join(' · ')}
                                                </p>
                                            ) : null}
                                        </button>
                                        <div className="flex shrink-0 gap-2">
                                            {canJoinMeeting(meeting) ? (
                                                <button
                                                    type="button"
                                                    title="Join"
                                                    onClick={() => handleJoinMeeting(meeting)}
                                                    className="rounded-xl border border-[#E2E8F0] bg-white p-2.5 text-[#0E2B3D]"
                                                >
                                                    <FiVideo className="h-4 w-4" />
                                                </button>
                                            ) : null}
                                            {OPEN_STATUSES.includes(meeting.status) ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        title="Edit"
                                                        onClick={() => openEdit(meeting)}
                                                        className="rounded-xl border border-[#E2E8F0] bg-white p-2.5 text-slate-600"
                                                    >
                                                        <FiEdit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Reschedule"
                                                        onClick={() => openReschedule(meeting)}
                                                        className="rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#0E2B3D]"
                                                    >
                                                        Move
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Cancel meeting"
                                                        onClick={() => {
                                                            setCancelReason('');
                                                            setCancelFor(meeting);
                                                        }}
                                                        className="rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                    {meeting.rescheduleProposal?.status === 'pending' ? (
                                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                            New time proposed
                                            {meeting.rescheduleProposal.proposedDate
                                                ? ` · ${format(new Date(meeting.rescheduleProposal.proposedDate), 'MMM d, yyyy')}`
                                                : ''}
                                            {meeting.rescheduleProposal.proposedTime ? ` at ${meeting.rescheduleProposal.proposedTime}` : ''}
                                        </p>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </div>

            {showCreateModal ? (
                <ModalFrame title={editingMeeting ? 'Edit meeting' : 'Schedule One-on-One Meeting'} onClose={closeCreate} wide>
                    <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">
                                {canInviteMany && !editingMeeting ? 'Participants' : 'Participant'}
                                {canInviteMany && !editingMeeting && formData.employeeIds.length > 0
                                    ? ` · ${formData.employeeIds.length} selected`
                                    : ''}
                            </label>
                            {canInviteMany && !editingMeeting ? (
                                <div className="rounded-xl border border-[#E2E8F0]">
                                    <div className="relative border-b border-[#E2E8F0] p-2">
                                        <FiSearch className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
                                        <input
                                            className={`${FIELD} pl-9`}
                                            placeholder="Search employees by name or email"
                                            aria-label="participant"
                                            value={employeeSearch}
                                            onChange={(event) => setEmployeeSearch(event.target.value)}
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2">
                                        {visibleEmployees.length === 0 ? (
                                            <p className="px-2 py-3 text-sm text-slate-500">No employees found.</p>
                                        ) : (
                                            visibleEmployees.map((emp) => {
                                                const id = String(emp._id || emp.id);
                                                const checked = formData.employeeIds.includes(id);
                                                return (
                                                    <label key={id} className={`mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${checked ? 'bg-[#1CCA9B]/10' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleEmployeeId(id)}
                                                            className="h-4 w-4 rounded border-slate-300 text-[#0a8f6c]"
                                                        />
                                                        <span className="min-w-0">
                                                            <span className="block font-medium text-[#0E2B3D]">{emp.name} {emp.lastName}</span>
                                                            {emp.email ? <span className="block truncate text-xs text-slate-400">{emp.email}</span> : null}
                                                        </span>
                                                    </label>
                                                );
                                            })
                                        )}
                                        {filteredEmployees.length > visibleEmployees.length ? (
                                            <p className="px-2 py-2 text-xs text-slate-400">
                                                Showing {visibleEmployees.length} of {filteredEmployees.length}. Refine the search.
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <select
                                    className={FIELD}
                                    required
                                    disabled={Boolean(editingMeeting)}
                                    value={formData.employeeId}
                                    onChange={(event) => setFormData((previous) => ({ ...previous, employeeId: event.target.value }))}
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
                                <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Date</label>
                                <input
                                    className={FIELD}
                                    type="date"
                                    required
                                    aria-label="date"
                                    value={formData.scheduledDate}
                                    min={editingMeeting ? undefined : format(new Date(), 'yyyy-MM-dd')}
                                    onChange={(event) => setFormData((previous) => ({ ...previous, scheduledDate: event.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Time</label>
                                <input
                                    className={FIELD}
                                    type="time"
                                    required
                                    aria-label="time"
                                    value={formData.scheduledTime}
                                    onChange={(event) => setFormData((previous) => ({ ...previous, scheduledTime: event.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Duration (minutes)</label>
                                <input
                                    className={FIELD}
                                    type="number"
                                    min={15}
                                    step={15}
                                    value={formData.duration}
                                    onChange={(event) =>
                                        setFormData((previous) => ({
                                            ...previous,
                                            duration: parseInt(event.target.value, 10) || 30,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Location</label>
                                <input
                                    className={FIELD}
                                    value={formData.location}
                                    placeholder="Conference room or Google Meet"
                                    onChange={(event) => setFormData((previous) => ({ ...previous, location: event.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Meeting link</label>
                            <input
                                className={FIELD}
                                type="url"
                                value={formData.meetingLink}
                                placeholder="https://"
                                onChange={(event) => setFormData((previous) => ({ ...previous, meetingLink: event.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Cadence</label>
                            <select
                                className={FIELD}
                                aria-label="Recurrence cadence"
                                value={formData.cadence}
                                onChange={(event) => setFormData((previous) => ({ ...previous, cadence: event.target.value }))}
                            >
                                {CADENCE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option === 'One-time' ? 'One-time session' : option}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">Saved on this meeting. Each session is still scheduled on its own.</p>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-sm font-semibold text-[#0E2B3D]">Agenda</label>
                                <button type="button" onClick={addAgendaItem} className="text-xs font-semibold text-[#0a8f6c]">
                                    Add topic
                                </button>
                            </div>
                            {formData.agenda.map((item, index) => (
                                <div key={index} className="mb-2 rounded-xl bg-[#f4f7f6] p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500">Topic {index + 1}</span>
                                        {formData.agenda.length > 1 ? (
                                            <button type="button" className="text-xs text-red-600" onClick={() => removeAgendaItem(index)}>
                                                Remove
                                            </button>
                                        ) : null}
                                    </div>
                                    <input
                                        className={`${FIELD} mb-2`}
                                        placeholder="Topic"
                                        value={item.topic}
                                        onChange={(event) => updateAgendaItem(index, 'topic', event.target.value)}
                                    />
                                    <textarea
                                        className={FIELD}
                                        rows={2}
                                        aria-label="Meeting agenda"
                                        placeholder="Notes"
                                        value={item.notes}
                                        onChange={(event) => updateAgendaItem(index, 'notes', event.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        {!editingMeeting ? (
                            <div className="flex gap-3 rounded-xl border border-[#1CCA9B]/40 bg-[#1CCA9B]/10 px-4 py-3 text-sm text-[#07523E]">
                                <FiBell className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>
                                    {canInviteMany
                                        ? 'Each selected employee gets their own one-on-one and a notification.'
                                        : 'A notification is sent when you schedule this meeting.'}
                                </p>
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                            <button type="button" onClick={closeCreate} className="rounded-xl bg-[#f4f7f6] px-4 py-2 text-sm font-medium text-[#0E2B3D]">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60"
                                style={{ background: MINT, color: NAVY }}
                            >
                                {submitting ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
                                {editingMeeting
                                    ? 'Save changes'
                                    : canInviteMany && formData.employeeIds.length > 1
                                      ? `Schedule ${formData.employeeIds.length}`
                                      : 'Schedule Meeting'}
                            </button>
                        </div>
                    </form>
                </ModalFrame>
            ) : null}

            {rescheduleFor ? (
                <ModalFrame title="Reschedule Meeting" onClose={() => setRescheduleFor(null)}>
                    <div className="space-y-4 p-5">
                        <p className="text-sm text-slate-500">
                            Choose a new date and time for {personName(rescheduleFor.employeeId) || 'this meeting'}. They will be asked to confirm.
                        </p>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">New date</label>
                            <input
                                className={FIELD}
                                type="date"
                                aria-label="newDate"
                                value={rescheduleForm.date}
                                onChange={(event) => setRescheduleForm((previous) => ({ ...previous, date: event.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">New time</label>
                            <input
                                className={FIELD}
                                type="time"
                                aria-label="newTime"
                                value={rescheduleForm.time}
                                onChange={(event) => setRescheduleForm((previous) => ({ ...previous, time: event.target.value }))}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setRescheduleFor(null)} className="rounded-xl bg-[#f4f7f6] px-4 py-2 text-sm font-medium">
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={confirmReschedule}
                                className="rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60"
                                style={{ background: MINT, color: NAVY }}
                            >
                                Confirm Reschedule
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            ) : null}

            {cancelFor ? (
                <ModalFrame title="Cancel Meeting" titleClassName="!text-red-700" onClose={() => setCancelFor(null)}>
                    <div className="space-y-4 p-5">
                        <p className="text-sm text-[#0E2B3D]">
                            Cancel the one-on-one with {personName(cancelFor.employeeId) || 'this participant'}? They will be notified.
                        </p>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-[#0E2B3D]">Reason (optional)</label>
                            <textarea
                                className={FIELD}
                                rows={3}
                                aria-label="Cancellation reason"
                                placeholder="Why this meeting is being cancelled"
                                value={cancelReason}
                                onChange={(event) => setCancelReason(event.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setCancelFor(null)} className="rounded-xl bg-[#f4f7f6] px-4 py-2 text-sm font-medium">
                                Keep Meeting
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={confirmCancel}
                                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                Yes, Cancel Meeting
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            ) : null}
        </div>
    );
};

export default OneOnOnePage;
