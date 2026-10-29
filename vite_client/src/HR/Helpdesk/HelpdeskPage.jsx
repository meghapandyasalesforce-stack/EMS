import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import {
    FaCheckCircle,
    FaCommentDots,
    FaExclamationTriangle,
    FaHourglassHalf,
    FaPaperPlane,
    FaPlus,
    FaSearch,
    FaSpinner,
    FaSyncAlt,
    FaTicketAlt,
    FaTimes
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { formatStatusLabel } from '../../utils/textFormat.js';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR, isManager } from '../../utils/managerHelper';
import { isExecutive } from '../../utils/navigationConfig';
import './helpdesk.css';

const FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Open', value: 'Open' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Resolved', value: 'Resolved' },
    { label: 'Closed', value: 'Closed' }
];

const CATEGORIES = [
    'HR',
    'IT',
    'Payroll',
    'Benefits',
    'Leave',
    'Attendance',
    'Training',
    'Document',
    'General',
    'Other'
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const WORKFLOW_STATUSES = ['Open', 'Assigned', 'In Progress', 'Closed', 'Cancelled'];

const STATUS_META = {
    Open: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    Assigned: { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
    'In Progress': { pill: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
    Resolved: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    Closed: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
    Cancelled: { pill: 'bg-rose-50 text-rose-600 ring-rose-200', dot: 'bg-rose-400' }
};

const PRIORITY_META = {
    Urgent: 'bg-red-50 text-red-700 ring-red-200',
    High: 'bg-orange-50 text-orange-700 ring-orange-200',
    Medium: 'bg-amber-50 text-amber-700 ring-amber-200',
    Low: 'bg-slate-100 text-slate-600 ring-slate-200'
};

const emptyTicketForm = {
    subject: '',
    description: '',
    category: 'General',
    priority: 'Medium',
    department: ''
};

const fullName = (person) =>
    [person?.name, person?.lastName].filter(Boolean).join(' ').trim() || person?.email || 'N/A';

const initials = (person) => {
    const name = fullName(person);
    if (name === 'N/A') return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
};

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : '—';

const formatRelative = (value) => {
    if (!value) return '—';
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const StatusPill = ({ status }) => {
    const meta = STATUS_META[status] || STATUS_META.Closed;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {formatStatusLabel(status)}
        </span>
    );
};

const PriorityPill = ({ priority }) => (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${PRIORITY_META[priority] || PRIORITY_META.Low}`}>
        {formatStatusLabel(priority)}
    </span>
);

const StatCard = ({ label, value, icon, accent }) => (
    <div className="helpdesk-stat" style={{ backgroundColor: '#ffffff' }}>
        <div className="helpdesk-stat__top">
            <p>{label}</p>
            <span style={{ backgroundColor: `${accent}18`, color: accent }}>{icon}</span>
        </div>
        <strong>{value}</strong>
    </div>
);

const ModalShell = ({ title, subtitle, onClose, children, drawer = false }) => {
    const dialogRef = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);
    useEffect(() => {
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const controls = () => [...dialogRef.current.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter((item) => !item.disabled);
        controls()[0]?.focus();
        const handleKey = (event) => {
            if (event.key === 'Escape') closeRef.current();
            if (event.key !== 'Tab') return;
            const items = controls();
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
    }, []);
    return createPortal(
    <div className={`helpdesk-overlay ${drawer ? 'helpdesk-overlay--drawer' : ''}`}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} className={`helpdesk-dialog ${drawer ? 'helpdesk-dialog--drawer' : ''}`}>
            <div className="helpdesk-dialog__header"><div className="min-w-0"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Close" className="helpdesk-close"><FaTimes /></button></div>
            {children}
        </section>
    </div>,
    document.body
    );
};

const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-theme-secondary focus:ring-2 focus:ring-theme-secondary/20';

const HelpdeskPage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const profile = useMemo(() => ({ ...(employee || {}), ...(user || {}) }), [employee, user]);
    const currentEmployeeId = employee?._id || (user?.role !== 'admin' ? user?._id : null);
    const profilePosition = String(profile.position || profile.jobTitle || '').toLowerCase().trim();
    const canManageTickets = Boolean(
        profile.role === 'admin' ||
        permissionFlags.isOrgOwner ||
        permissionFlags.isHrManager ||
        permissionFlags.isHrExecutive ||
        permissionFlags.isExecutive ||
        isHR(profile) ||
        isExecutive(profilePosition)
    );
    const managerView = !canManageTickets && isManager(profile);

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [ticketForm, setTicketForm] = useState(emptyTicketForm);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [internalComment, setInternalComment] = useState(false);
    const [workflow, setWorkflow] = useState({ status: 'Open', priority: 'Medium', assignedTo: '' });
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [employees, setEmployees] = useState([]);

    const fetchTickets = useCallback(async ({ silent = false } = {}) => {
        try {
            if (silent) setRefreshing(true);
            else setLoading(true);
            const response = await axios.get('/v1/both/helpdesk/tickets', {
                params: { limit: 100 },
                withCredentials: true
            });
            setTickets(response.data?.data || []);
        } catch (error) {
            setTickets([]);
            toast.error(error.response?.data?.message || 'Failed to load helpdesk tickets');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    useEffect(() => {
        if (!canManageTickets) return;
        axios
            .get('/v1/admin/employee?limit=100', { withCredentials: true })
            .then((response) => {
                setEmployees(response.data?.data || response.data?.employees || []);
            })
            .catch(() => setEmployees([]));
    }, [canManageTickets]);

    const counts = useMemo(() => {
        const byStatus = tickets.reduce((acc, ticket) => {
            acc[ticket.status] = (acc[ticket.status] || 0) + 1;
            return acc;
        }, {});
        return {
            all: tickets.length,
            ...byStatus,
            inFlight: (byStatus.Assigned || 0) + (byStatus['In Progress'] || 0)
        };
    }, [tickets]);

    const visibleTickets = useMemo(() => {
        const term = search.trim().toLowerCase();
        return tickets.filter((ticket) => {
            if (filter !== 'all' && ticket.status !== filter) return false;
            if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
            if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;
            if (!term) return true;
            return [
                ticket.ticketNumber,
                ticket.subject,
                ticket.category,
                ticket.priority,
                fullName(ticket.requestedBy)
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term));
        });
    }, [tickets, filter, search, priorityFilter, categoryFilter]);
    const totalPages = Math.max(1, Math.ceil(visibleTickets.length / 10));
    const currentPage = Math.min(page, totalPages);
    const pageTickets = visibleTickets.slice((currentPage - 1) * 10, currentPage * 10);
    useEffect(() => { setPage(1); }, [search, filter, priorityFilter, categoryFilter]);

    const submitTicket = async (event) => {
        event.preventDefault();
        if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
            toast.error('Subject and description are required');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post(
                '/v1/both/helpdesk/tickets',
                {
                    ...ticketForm,
                    subject: ticketForm.subject.trim(),
                    description: ticketForm.description.trim(),
                    department: ticketForm.department.trim() || undefined
                },
                { withCredentials: true }
            );
            toast.success('Ticket created successfully');
            setTicketForm(emptyTicketForm);
            setCreateOpen(false);
            setFilter('all');
            await fetchTickets({ silent: true });
        } catch (error) {
            const data = error.response?.data;
            const detail = Array.isArray(data?.errors) && data.errors.length
                ? data.errors.map((e) => (typeof e === 'string' ? e : e?.message)).filter(Boolean).join(', ')
                : null;
            toast.error(detail || data?.message || 'Failed to create ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const openTicket = async (ticketId) => {
        try {
            setDetailLoading(true);
            const response = await axios.get(`/v1/both/helpdesk/tickets/${ticketId}`, {
                withCredentials: true
            });
            const ticket = response.data?.data;
            setSelectedTicket(ticket);
            setWorkflow({
                status: ticket?.status || 'Open',
                priority: ticket?.priority || 'Medium',
                assignedTo: ticket?.assignedTo?._id || ''
            });
            setResolutionNotes(ticket?.resolution?.resolutionNotes || '');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load ticket');
        } finally {
            setDetailLoading(false);
        }
    };

    const refreshSelectedTicket = async () => {
        if (!selectedTicket?._id) return;
        const response = await axios.get(`/v1/both/helpdesk/tickets/${selectedTicket._id}`, {
            withCredentials: true
        });
        setSelectedTicket(response.data?.data || null);
    };

    const submitComment = async (event) => {
        event.preventDefault();
        if (!comment.trim() || !selectedTicket?._id) return;
        try {
            setSubmitting(true);
            await axios.post(
                `/v1/both/helpdesk/tickets/${selectedTicket._id}/comment`,
                { comment: comment.trim(), isInternal: canManageTickets && internalComment },
                { withCredentials: true }
            );
            setComment('');
            setInternalComment(false);
            await Promise.all([refreshSelectedTicket(), fetchTickets({ silent: true })]);
            toast.success('Comment added');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    const saveWorkflow = async () => {
        if (!selectedTicket?._id) return;
        try {
            setSubmitting(true);
            await axios.put(
                `/v1/both/helpdesk/tickets/${selectedTicket._id}`,
                {
                    status: workflow.status,
                    priority: workflow.priority,
                    assignedTo: workflow.assignedTo || null
                },
                { withCredentials: true }
            );
            await Promise.all([refreshSelectedTicket(), fetchTickets({ silent: true })]);
            toast.success('Ticket updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const resolveTicket = async () => {
        if (!selectedTicket?._id || !resolutionNotes.trim()) {
            toast.error('Add resolution notes before resolving the ticket');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post(
                `/v1/both/helpdesk/tickets/${selectedTicket._id}/resolve`,
                { resolutionNotes: resolutionNotes.trim() },
                { withCredentials: true }
            );
            setWorkflow((current) => ({ ...current, status: 'Resolved' }));
            await Promise.all([refreshSelectedTicket(), fetchTickets({ silent: true })]);
            toast.success('Ticket resolved');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resolve ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelOwnTicket = async () => {
        if (!selectedTicket?._id) return;
        try {
            setSubmitting(true);
            await axios.put(
                `/v1/both/helpdesk/tickets/${selectedTicket._id}`,
                { status: 'Cancelled' },
                { withCredentials: true }
            );
            await Promise.all([refreshSelectedTicket(), fetchTickets({ silent: true })]);
            toast.success('Ticket cancelled');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel ticket');
        } finally {
            setSubmitting(false);
        }
    };

    const closeDetail = () => {
        setSelectedTicket(null);
        setComment('');
        setInternalComment(false);
        setResolutionNotes('');
    };

    const showRequester = canManageTickets || managerView;

    return (
        <div className="helpdesk-page min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px] space-y-6">
                {/* Header */}
                <div className="helpdesk-heading">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-[#0E2B3D] sm:text-3xl">
                                {canManageTickets ? 'Helpdesk & Support Suite' : 'Help & Support'}
                            </h1>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                                {canManageTickets
                                    ? 'Manage internal employee grievances, IT requests, and payroll inquiries with full lifecycle tracking.'
                                    : managerView
                                      ? 'Your tickets and requests raised by your team'
                                      : 'Raise a request and follow its progress'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fetchTickets({ silent: true })}
                                disabled={refreshing}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60"
                                title="Refresh"
                            >
                                <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreateOpen(true)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 sm:flex-none"
                                style={{ backgroundColor: '#0a8f6c' }}
                            >
                                <FaPlus className="h-3.5 w-3.5" />
                                Create Ticket
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <StatCard
                        label="Open tickets"
                        value={counts.Open || 0}
                        accent="#d97706"
                        icon={<FaExclamationTriangle />}
                    />
                    <StatCard
                        label="In progress"
                        value={counts.inFlight}
                        accent="#0a8f6c"
                        icon={<FaHourglassHalf />}
                    />
                    <StatCard
                        label="Resolved"
                        value={counts.Resolved || 0}
                        accent="#0a8f6c"
                        icon={<FaCheckCircle />}
                    />
                    <StatCard
                        label="All tickets"
                        value={counts.all}
                        accent="#64748b"
                        icon={<FaTicketAlt />}
                    />
                </div>

                {/* Toolbar */}
                <div className="helpdesk-toolbar">
                    <div className="relative w-full lg:max-w-sm">
                        <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input aria-label="Search tickets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets by ID, subject, or employee..." className="helpdesk-search" />
                    </div>
                    <div className="helpdesk-filters">
                        <select aria-label="Filter status" value={filter} onChange={(event) => setFilter(event.target.value)}>{FILTERS.map((status) => <option key={status.value} value={status.value}>{status.value === 'all' ? 'Status: All Statuses' : status.label}</option>)}</select>
                        <select aria-label="Filter priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">Priority: All Priorities</option>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
                        <select aria-label="Filter category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Category: All Categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[0, 1, 2, 3].map((row) => (
                            <div key={row} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                        ))}
                    </div>
                ) : visibleTickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                            <FaTicketAlt />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-800">
                            {search.trim() || filter !== 'all' ? 'No matching tickets' : 'No tickets yet'}
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            {search.trim() || filter !== 'all'
                                ? 'Try a different search term or filter.'
                                : 'Raise your first ticket and the HR team will get back to you.'}
                        </p>
                        {!search.trim() && filter === 'all' && (
                            <button
                                type="button"
                                onClick={() => setCreateOpen(true)}
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-theme-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-theme-primary"
                            >
                                <FaPlus className="h-3.5 w-3.5" />
                                Create Ticket
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="helpdesk-table hidden overflow-x-auto rounded-2xl bg-white lg:block">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Ticket ID</th>
                                        {showRequester && (
                                            <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Employee</th>
                                        )}
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Subject</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Category</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Priority</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned To</th>
                                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pageTickets.map((ticket) => (
                                        <tr
                                            key={ticket._id}
                                            onClick={() => openTicket(ticket._id)}
                                            className="cursor-pointer transition hover:bg-slate-50"
                                        >
                                            <td className="px-5 py-4">
                                                <button type="button" className="helpdesk-ticket-id" onClick={(event) => { event.stopPropagation(); openTicket(ticket._id); }}>{ticket.ticketNumber}</button>
                                            </td>
                                            {showRequester && (
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-theme-secondary/10 text-[11px] font-bold text-theme-secondary">
                                                            {initials(ticket.requestedBy)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium text-slate-800">
                                                                {fullName(ticket.requestedBy)}
                                                            </p>
                                                            {ticket.requestedBy?.department && (
                                                                <p className="truncate text-xs text-slate-400">
                                                                    {ticket.requestedBy.department}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-800">{ticket.subject}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                    {ticket.category}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4"><PriorityPill priority={ticket.priority} /></td>
                                            <td className="px-5 py-4"><StatusPill status={ticket.status} /></td>
                                            <td className="px-5 py-4 text-sm text-slate-600">{ticket.assignedTo ? fullName(ticket.assignedTo) : 'Unassigned'}</td>
                                            <td className="px-5 py-4 text-sm text-slate-500">{formatRelative(ticket.updatedAt || ticket.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="space-y-3 lg:hidden">
                            {pageTickets.map((ticket) => (
                                <button
                                    key={ticket._id}
                                    type="button"
                                    onClick={() => openTicket(ticket._id)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900">{ticket.subject}</p>
                                            <p className="mt-0.5 font-mono text-xs text-slate-400">{ticket.ticketNumber}</p>
                                        </div>
                                        <StatusPill status={ticket.status} />
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                            {ticket.category}
                                        </span>
                                        <PriorityPill priority={ticket.priority} />
                                        <span className="text-xs text-slate-400">{formatRelative(ticket.updatedAt || ticket.createdAt)}</span>
                                    </div>
                                    {showRequester && (
                                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-theme-secondary/10 text-[10px] font-bold text-theme-secondary">
                                                {initials(ticket.requestedBy)}
                                            </span>
                                            <span className="truncate text-sm text-slate-600">
                                                {fullName(ticket.requestedBy)}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {!loading && visibleTickets.length > 0 && <div className="helpdesk-pagination"><p>Showing {(currentPage - 1) * 10 + 1} - {Math.min(currentPage * 10, visibleTickets.length)} of {visibleTickets.length} tickets</p><div className="flex items-center gap-2"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage} of {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>}

                {/* Create modal */}
                {createOpen && (
                    <ModalShell
                        title="Create Support Ticket"
                        subtitle="Submit a query or grievance directly to the HR & IT operations team."
                        onClose={() => setCreateOpen(false)}
                    >
                        <form onSubmit={submitTicket} className="space-y-5 p-5 sm:p-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Subject</label>
                                <input
                                    value={ticketForm.subject}
                                    onChange={(event) =>
                                        setTicketForm((current) => ({ ...current, subject: event.target.value }))
                                    }
                                    maxLength={160}
                                    required
                                    className={fieldClass}
                                    placeholder="Briefly describe your request"
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Category</label>
                                    <select
                                        value={ticketForm.category}
                                        onChange={(event) =>
                                            setTicketForm((current) => ({ ...current, category: event.target.value }))
                                        }
                                        className={fieldClass}
                                    >
                                        {CATEGORIES.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Priority</label>
                                    <select
                                        value={ticketForm.priority}
                                        onChange={(event) =>
                                            setTicketForm((current) => ({ ...current, priority: event.target.value }))
                                        }
                                        className={fieldClass}
                                    >
                                        {PRIORITIES.map((priority) => (
                                            <option key={priority} value={priority}>{priority}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Department <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <input
                                    value={ticketForm.department}
                                    onChange={(event) =>
                                        setTicketForm((current) => ({ ...current, department: event.target.value }))
                                    }
                                    className={fieldClass}
                                    placeholder="e.g. Human Resources"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
                                <textarea
                                    value={ticketForm.description}
                                    onChange={(event) =>
                                        setTicketForm((current) => ({ ...current, description: event.target.value }))
                                    }
                                    rows={6}
                                    required
                                    className={`${fieldClass} resize-y leading-6`}
                                    placeholder="Include the details needed to understand and resolve your request"
                                />
                            </div>
                            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setCreateOpen(false)}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-theme-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-theme-primary disabled:opacity-60"
                                >
                                    {submitting && <FaSpinner className="animate-spin" />}
                                    {submitting ? 'Creating...' : 'Create Ticket'}
                                </button>
                            </div>
                        </form>
                    </ModalShell>
                )}

                {detailLoading && <LoadingSpinner message="Loading ticket..." />}

                {/* Detail modal */}
                {selectedTicket && (
                    <ModalShell
                        title={selectedTicket.ticketNumber}
                        subtitle={`${selectedTicket.ticketNumber} • ${formatDate(selectedTicket.createdAt)}`}
                        onClose={closeDetail}
                        drawer
                    >
                        <div className="space-y-6 p-5 sm:p-6">
                            <h2 className="text-2xl font-bold text-slate-900">{selectedTicket.subject}</h2>
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={selectedTicket.status} />
                                <PriorityPill priority={selectedTicket.priority} />
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    {selectedTicket.category}
                                </span>
                                {selectedTicket.assignedTo && (
                                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                                        Assigned to {fullName(selectedTicket.assignedTo)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-theme-secondary/10 text-xs font-bold text-theme-secondary">
                                    {initials(selectedTicket.requestedBy)}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Requested by</p>
                                    <p className="font-semibold text-slate-900">{fullName(selectedTicket.requestedBy)}</p>
                                    {selectedTicket.requestedBy?.department && (
                                        <p className="text-xs text-slate-500">{selectedTicket.requestedBy.department}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</h3>
                                <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                                    {selectedTicket.description}
                                </p>
                            </div>

                            {canManageTickets && selectedTicket.status !== 'Resolved' && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                                    <h3 className="text-sm font-bold text-slate-900">Ticket workflow</h3>
                                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</label>
                                            <select
                                                value={workflow.status}
                                                onChange={(event) =>
                                                    setWorkflow((current) => ({ ...current, status: event.target.value }))
                                                }
                                                className={fieldClass}
                                            >
                                                {WORKFLOW_STATUSES.map((status) => (
                                                    <option key={status} value={status}>{formatStatusLabel(status)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Priority</label>
                                            <select
                                                value={workflow.priority}
                                                onChange={(event) =>
                                                    setWorkflow((current) => ({ ...current, priority: event.target.value }))
                                                }
                                                className={fieldClass}
                                            >
                                                {PRIORITIES.map((priority) => (
                                                    <option key={priority} value={priority}>{priority}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Assign to</label>
                                            <select
                                                value={workflow.assignedTo}
                                                onChange={(event) =>
                                                    setWorkflow((current) => ({ ...current, assignedTo: event.target.value }))
                                                }
                                                className={fieldClass}
                                            >
                                                <option value="">Unassigned</option>
                                                {employees.map((person) => (
                                                    <option key={person._id} value={person._id}>{fullName(person)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={saveWorkflow}
                                        disabled={submitting}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {submitting && <FaSpinner className="animate-spin" />}
                                        Update Ticket
                                    </button>
                                </div>
                            )}

                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <FaCommentDots className="text-theme-secondary" />
                                    Activity & Timeline
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                        {(selectedTicket.comments || []).length}
                                    </span>
                                </h3>
                                <div className="mt-4 space-y-3">
                                    {(selectedTicket.comments || []).length === 0 ? (
                                        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                                            No comments yet. Start the conversation below.
                                        </p>
                                    ) : (
                                        selectedTicket.comments.map((item) => (
                                            <div
                                                key={item._id}
                                                className={`rounded-2xl border p-4 ${
                                                    item.isInternal
                                                        ? 'border-amber-200 bg-amber-50/60'
                                                        : 'border-slate-200 bg-white'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                                            {initials(item.commentedBy)}
                                                        </span>
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {fullName(item.commentedBy)}
                                                        </p>
                                                        {item.isInternal && (
                                                            <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                                                Internal
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400">{formatDate(item.commentedAt)}</p>
                                                </div>
                                                <p className="mt-2 whitespace-pre-wrap pl-9 text-sm leading-6 text-slate-700">
                                                    {item.comment}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <form onSubmit={submitComment} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                    <textarea
                                        value={comment}
                                        onChange={(event) => setComment(event.target.value)}
                                        rows={3}
                                        className={`${fieldClass} resize-y`}
                                        placeholder="Write a reply..."
                                    />
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                        {canManageTickets ? (
                                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={internalComment}
                                                    onChange={(event) => setInternalComment(event.target.checked)}
                                                    className="h-4 w-4 rounded border-slate-300 text-theme-secondary focus:ring-theme-secondary"
                                                />
                                                Internal note (hidden from employee and manager)
                                            </label>
                                        ) : (
                                            <span />
                                        )}
                                        <button
                                            type="submit"
                                            disabled={submitting || !comment.trim()}
                                            className="inline-flex items-center gap-2 rounded-xl bg-theme-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-theme-primary disabled:opacity-60"
                                        >
                                            <FaPaperPlane className="h-3.5 w-3.5" />
                                            Send
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {canManageTickets && selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                                    <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                                        <FaCheckCircle /> Resolve ticket
                                    </h3>
                                    <textarea
                                        value={resolutionNotes}
                                        onChange={(event) => setResolutionNotes(event.target.value)}
                                        rows={3}
                                        className="mt-3 w-full resize-y rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                                        placeholder="Describe how the request was resolved"
                                    />
                                    <button
                                        type="button"
                                        onClick={resolveTicket}
                                        disabled={submitting}
                                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {submitting && <FaSpinner className="animate-spin" />}
                                        Mark as Resolved
                                    </button>
                                </div>
                            )}

                            {selectedTicket.resolution?.resolutionNotes && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                                    <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                                        <FaCheckCircle /> Resolution
                                    </h3>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-800">
                                        {selectedTicket.resolution.resolutionNotes}
                                    </p>
                                    <p className="mt-2 text-xs font-medium text-emerald-700">
                                        Resolved {formatDate(selectedTicket.resolution.resolvedAt)}
                                    </p>
                                </div>
                            )}

                            {!canManageTickets &&
                                String(selectedTicket.requestedBy?._id || selectedTicket.requestedBy) ===
                                    String(currentEmployeeId) &&
                                !['Resolved', 'Closed', 'Cancelled'].includes(selectedTicket.status) && (
                                    <div className="flex justify-end border-t border-slate-100 pt-5">
                                        <button
                                            type="button"
                                            onClick={cancelOwnTicket}
                                            disabled={submitting}
                                            className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                                        >
                                            Cancel Ticket
                                        </button>
                                    </div>
                                )}
                        </div>
                    </ModalShell>
                )}
            </div>
        </div>
    );
};

export default HelpdeskPage;
