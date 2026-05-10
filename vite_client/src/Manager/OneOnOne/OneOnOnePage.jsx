import React, { useState, useEffect, useMemo } from 'react';
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
import { filterEmployeesByManager, isManager } from '../../utils/managerHelper';

const TEAL = '#0a8f6c';
const TEAL_LIGHT = '#14b887';
const PAGE_BG = '#f4f7f6';
const GREY_BORDER = '#e2e8f0';

const FILTER_KEYS = ['all', 'Scheduled', 'Completed', 'Cancelled'];

function MeetingStatusPill({ status }) {
    const map = {
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
        Rescheduled: {
            label: 'Rescheduled',
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
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#0a8f6c] focus:outline-none focus:ring-2 focus:ring-[#0a8f6c]/25';

const OneOnOnePage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isManagerUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isManager(userObj);
    }, [user, employee]);

    const [meetings, setMeetings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        employeeId: '',
        scheduledDate: '',
        scheduledTime: '',
        duration: 30,
        location: '',
        meetingLink: '',
        agenda: [{ topic: '', notes: '', discussed: false }],
    });

    useEffect(() => {
        fetchMeetings();
        fetchEmployees();
    }, [filterStatus, user, employee]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const params = filterStatus !== 'all' ? { status: filterStatus } : {};
            const response = await axios.get('/v1/both/one-on-one/one-on-ones', {
                params,
                withCredentials: true,
            });
            setMeetings(response.data?.data || []);
        } catch {
            toast.error('Failed to load one-on-one meetings');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/v1/employee/auth/get-all-employees', {
                params: { limit: 500 },
                withCredentials: true,
            });

            const allEmployees = response.data?.data || response.data?.employees || [];
            const currentUser = user || employee;
            const userRole = currentUser?.role;

            if (userRole === 'admin') {
                setEmployees(allEmployees);
                return;
            }

            const teamMembers = filterEmployeesByManager(allEmployees, currentUser);
            setEmployees(teamMembers.length > 0 ? teamMembers : allEmployees);
        } catch {
            setEmployees([]);
            toast.error('Failed to load employee list');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employeeId || !formData.scheduledDate || !formData.scheduledTime) {
            toast.warning('Please fill in all required fields');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                scheduledDate: new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString(),
                agenda: formData.agenda.filter((item) => item.topic.trim() !== ''),
            };

            if (selectedMeeting) {
                await axios.put(`/v1/both/one-on-one/one-on-ones/${selectedMeeting._id}`, payload, {
                    withCredentials: true,
                });
                toast.success('Meeting updated successfully');
            } else {
                await axios.post('/v1/both/one-on-one/one-on-ones', payload, {
                    withCredentials: true,
                });
                toast.success('One-on-one meeting scheduled and notification sent to employee');
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
        setFormData({
            employeeId: '',
            scheduledDate: '',
            scheduledTime: '',
            duration: 30,
            location: '',
            meetingLink: '',
            agenda: [{ topic: '', notes: '', discussed: false }],
        });
    };

    const countForFilter = (key) => meetings.filter((m) => key === 'all' || m.status === key).length;

    if (loading) {
        return <LoadingSpinner message="Loading one-on-one meetings..." />;
    }

    return (
        <div className="min-h-screen p-4 transition-all duration-300 sm:p-6 lg:p-8" style={{ background: PAGE_BG }}>
            <div className="mx-auto max-w-[1200px]">
                <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                            One-on-One Meetings
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Schedule and manage one-on-one conversations with your team.
                        </p>
                    </div>
                    {isManagerUser ? (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedMeeting(null);
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                            style={{ background: TEAL }}
                        >
                            <FiPlus className="h-4 w-4" />
                            Schedule meeting
                        </button>
                    ) : null}
                </header>

                <section className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
                    {FILTER_KEYS.map((status) => {
                        const active = filterStatus === status;
                        const label =
                            status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1);
                        return (
                            <button
                                key={status}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setFilterStatus(status)}
                                className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition hover:brightness-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0a8f6c]/35 ${
                                    active ? 'ring-2 ring-[#0a8f6c] ring-offset-2 ring-offset-[#f4f7f6]' : ''
                                }`}
                                style={{
                                    borderColor: active ? TEAL : GREY_BORDER,
                                    background: active ? `${TEAL}12` : '#fff',
                                    color: active ? TEAL : '#475569',
                                }}
                            >
                                {label} ({countForFilter(status)})
                            </button>
                        );
                    })}
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                    {meetings.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <div
                                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                style={{ background: `${TEAL}12` }}
                            >
                                <FiCalendar className="h-8 w-8" style={{ color: TEAL }} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">No one-on-one meetings yet</p>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                                When you schedule a meeting, it will appear in this list.
                            </p>
                            {isManagerUser ? (
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
                        <ul className="space-y-4">
                            {meetings.map((meeting) => (
                                <li
                                    key={meeting._id}
                                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200 hover:shadow-md sm:p-5"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                                                <div
                                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_LIGHT} 100%)`,
                                                    }}
                                                >
                                                    <FiUser className="h-4 w-4" />
                                                </div>
                                                <h3 className="text-base font-semibold text-slate-900">
                                                    {meeting.employeeId?.name} {meeting.employeeId?.lastName}
                                                </h3>
                                                <MeetingStatusPill status={meeting.status} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                                                <div className="flex items-center gap-2">
                                                    <FiCalendar className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <span>{format(new Date(meeting.scheduledDate), 'MMM d, yyyy')}</span>
                                                </div>
                                                {meeting.scheduledTime ? (
                                                    <div className="flex items-center gap-2">
                                                        <FiClock className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <span>{meeting.scheduledTime}</span>
                                                    </div>
                                                ) : null}
                                                {meeting.location ? (
                                                    <div className="flex items-center gap-2">
                                                        <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <span>{meeting.location}</span>
                                                    </div>
                                                ) : null}
                                                {meeting.meetingLink ? (
                                                    <div className="flex items-center gap-2">
                                                        <FiVideo className="h-4 w-4 shrink-0 text-slate-400" />
                                                        <a
                                                            href={meeting.meetingLink}
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
                                        </div>
                                        {meeting.status === 'Scheduled' && isManagerUser ? (
                                            <div className="flex shrink-0 gap-2 self-end sm:self-start">
                                                <button
                                                    type="button"
                                                    title="Edit"
                                                    onClick={() => {
                                                        setSelectedMeeting(meeting);
                                                        const meetingDate = new Date(meeting.scheduledDate);
                                                        setFormData({
                                                            employeeId: meeting.employeeId?._id || meeting.employeeId,
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
                                            </div>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {showCreateModal && isManagerUser ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {selectedMeeting ? 'Edit meeting' : 'Schedule one-on-one'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {selectedMeeting
                                        ? 'Update time, link, or agenda.'
                                        : 'Set time and agenda for your team member.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setSelectedMeeting(null);
                                    resetForm();
                                }}
                            >
                                <FiXCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Employee <span className="text-red-600">*</span>
                                </label>
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
                                        A notification is sent to the employee when you schedule this meeting.
                                    </p>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedMeeting(null);
                                        resetForm();
                                    }}
                                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ background: TEAL }}
                                >
                                    {submitting ? (
                                        <>
                                            <FiLoader className="h-4 w-4 animate-spin" />
                                            {selectedMeeting ? 'Updating…' : 'Scheduling…'}
                                        </>
                                    ) : selectedMeeting ? (
                                        'Update meeting'
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
