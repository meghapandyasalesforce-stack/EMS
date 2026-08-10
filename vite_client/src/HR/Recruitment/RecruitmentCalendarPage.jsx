import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    isSameMonth,
    isToday,
} from 'date-fns';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaChevronDown } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const TYPE_CHIP = {
    interview: 'bg-sky-100 text-sky-900 border-sky-200',
    joining: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    offer_expiry: 'bg-amber-100 text-amber-900 border-amber-200',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_OPTIONS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const selectShellClass =
    'relative inline-flex min-w-[7.5rem] items-center rounded-full border border-blue-500 bg-white text-sm text-gray-800 shadow-sm';

const RecruitmentCalendarPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [integrations, setIntegrations] = useState({});
    const [filter, setFilter] = useState('all');
    const [month, setMonth] = useState(() => startOfMonth(new Date()));

    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        const selected = month.getFullYear();
        const start = Math.min(current - 3, selected - 1);
        const end = Math.max(current + 3, selected + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [month]);

    const goToMonthYear = (nextMonthIndex, nextYear) => {
        setMonth(startOfMonth(new Date(nextYear, nextMonthIndex, 1)));
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const from = startOfMonth(month).toISOString();
            const to = endOfMonth(addMonths(month, 1)).toISOString();
            const { data } = await axios.get(`/v1/admin/recruitment/calendar?from=${from}&to=${to}`, { withCredentials: true });
            setEvents(data.data?.events || []);
            setIntegrations(data.data?.integrations || {});
        } catch {
            toast.error('Failed to load calendar');
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (filter === 'all') return events;
        return events.filter((e) => e.type === filter);
    }, [events, filter]);

    const eventsByDay = useMemo(() => {
        const map = {};
        filtered.forEach((ev) => {
            if (!ev.date) return;
            const key = format(new Date(ev.date), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });
        return map;
    }, [filtered]);

    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [month]);

    if (loading) return <LoadingSpinner message="Loading calendar…" />;

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <button type="button" onClick={() => navigate('/recruitment')} className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600">
                <FaArrowLeft /> Back
            </button>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Recruitment Calendar</h1>
                    <p className="text-gray-600">Interviews · Joining · Offer expiry</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                        onClick={() => setMonth(addMonths(month, -1))}
                    >
                        Prev
                    </button>

                    <label className={selectShellClass}>
                        <select
                            aria-label="Select month"
                            className="w-full appearance-none bg-transparent py-2 pl-4 pr-9 font-medium outline-none"
                            value={month.getMonth()}
                            onChange={(e) => goToMonthYear(Number(e.target.value), month.getFullYear())}
                        >
                            {MONTH_OPTIONS.map((label, index) => (
                                <option key={label} value={index}>{label}</option>
                            ))}
                        </select>
                        <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-800" />
                    </label>

                    <label className={selectShellClass}>
                        <select
                            aria-label="Select year"
                            className="w-full appearance-none bg-transparent py-2 pl-4 pr-9 font-medium outline-none"
                            value={month.getFullYear()}
                            onChange={(e) => goToMonthYear(month.getMonth(), Number(e.target.value))}
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-800" />
                    </label>

                    <button
                        type="button"
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                        onClick={() => setMonth(addMonths(month, 1))}
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'interview', label: 'Interviews' },
                    { id: 'joining', label: 'Joining' },
                    { id: 'offer_expiry', label: 'Offer Expiry' },
                ].map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`rounded-lg px-3 py-1.5 text-sm ${filter === f.id ? 'bg-theme-primary/10 text-theme-primary' : 'border text-gray-600'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="mb-4 rounded-xl border bg-white p-4 text-sm text-gray-600 shadow-sm">
                {/* <p className="font-medium text-gray-800">Calendar integrations</p> */}
                <p className="mt-1">
                    Google: {integrations.googleCalendar?.connected ? 'Connected' : 'Not connected'} ·
                    Outlook: {integrations.outlook?.connected ? 'Connected' : 'Not connected'} ·
                    Teams: {integrations.teams?.connected ? 'Connected' : 'Not connected'}
                </p>
                <p className="mt-1 text-xs text-gray-500"></p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="mb-2 grid grid-cols-7 gap-2">
                    {WEEKDAYS.map((d) => (
                        <div key={d} className="px-1 py-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDay[key] || [];
                        const inMonth = isSameMonth(day, month);
                        const hasEvents = dayEvents.length > 0;
                        const today = isToday(day);

                        return (
                            <div
                                key={key}
                                className={`min-h-[7.5rem] rounded-xl border p-2 transition sm:min-h-[9rem] ${
                                    !inMonth
                                        ? 'border-transparent bg-gray-100/70 text-gray-400'
                                        : hasEvents
                                            ? 'border-emerald-100 bg-emerald-50/80'
                                            : 'border-gray-100 bg-gray-50'
                                } ${today ? 'ring-2 ring-theme-secondary/40' : ''}`}
                            >
                                <div className={`mb-1.5 text-sm font-semibold ${inMonth ? 'text-slate-700' : 'text-gray-400'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((ev) => (
                                        <button
                                            key={ev.id}
                                            type="button"
                                            title={`${ev.title}${ev.jobTitle ? ` · ${ev.jobTitle}` : ''}${ev.time ? ` · ${ev.time}` : ''}`}
                                            onClick={() => ev.candidateId && navigate(`/recruitment/candidates/${ev.candidateId}`)}
                                            className={`block w-full rounded-md border px-1.5 py-1 text-left text-[10px] leading-snug sm:text-[11px] ${TYPE_CHIP[ev.type] || 'bg-white text-gray-800 border-gray-200'}`}
                                        >
                                            <span className="line-clamp-2 font-semibold">{ev.title}</span>
                                            {(ev.jobTitle || ev.time) && (
                                                <span className="mt-0.5 block truncate opacity-80">
                                                    {[ev.jobTitle, ev.time].filter(Boolean).join(' · ')}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <p className="px-0.5 text-[10px] font-medium text-gray-500">
                                            +{dayEvents.length - 3} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filtered.length === 0 && (
                    <p className="mt-4 text-center text-sm text-gray-500">No events in this month</p>
                )}
            </div>
        </div>
    );
};

export default RecruitmentCalendarPage;
