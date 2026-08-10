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
import { FaArrowLeft } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage, AtsPageHeader, CmButton } from '../../components/recruitment/atsUi';

const TYPE_CHIP = {
    interview: { bg: 'rgba(56,161,255,0.12)', text: '#1a5aa8', border: 'rgba(56,161,255,0.3)' },
    joining: { bg: 'rgba(28,202,155,0.15)', text: '#006c51', border: 'rgba(28,202,155,0.3)' },
    offer_expiry: { bg: 'rgba(255,127,80,0.15)', text: '#c45a2a', border: 'rgba(255,127,80,0.3)' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_OPTIONS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

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
        <AtsPage>
            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back
            </button>

            <AtsPageHeader
                eyebrow="Recruitment"
                title="Recruitment Calendar"
                subtitle="Interviews · Joining · Offer expiry"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <CmButton variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))}>
                            Prev
                        </CmButton>

                        <div className="cm-select relative inline-flex items-center" style={{ padding: 0 }}>
                            <select
                                aria-label="Select month"
                                className="cm-select"
                                style={{ paddingRight: '2rem' }}
                                value={month.getMonth()}
                                onChange={(e) => goToMonthYear(Number(e.target.value), month.getFullYear())}
                            >
                                {MONTH_OPTIONS.map((label, index) => (
                                    <option key={label} value={index}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="cm-select relative inline-flex items-center" style={{ padding: 0 }}>
                            <select
                                aria-label="Select year"
                                className="cm-select"
                                style={{ paddingRight: '2rem' }}
                                value={month.getFullYear()}
                                onChange={(e) => goToMonthYear(month.getMonth(), Number(e.target.value))}
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <CmButton variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
                            Next
                        </CmButton>
                    </div>
                }
            />

            <div className="ats-filter-pills">
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
                        className={`ats-filter-pill ${filter === f.id ? 'ats-filter-pill--active' : ''}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="cm-card text-sm" style={{ color: 'rgba(15,45,38,0.65)' }}>
                <p>
                    Google: {integrations.googleCalendar?.connected ? 'Connected' : 'Not connected'} ·
                    Outlook: {integrations.outlook?.connected ? 'Connected' : 'Not connected'} ·
                    Teams: {integrations.teams?.connected ? 'Connected' : 'Not connected'}
                </p>
            </div>

            <div className="cm-card" style={{ padding: '1rem' }}>
                <div className="mb-2 grid grid-cols-7 gap-2">
                    {WEEKDAYS.map((d) => (
                        <div key={d} className="px-1 py-1 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(15,45,38,0.5)' }}>
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
                                className="min-h-[7.5rem] rounded-xl p-2 transition sm:min-h-[9rem]"
                                style={{
                                    border: today ? '2px solid rgba(28,202,155,0.4)' : '1px solid rgba(15,45,38,0.06)',
                                    background: !inMonth ? 'rgba(15,45,38,0.03)' : hasEvents ? 'rgba(28,202,155,0.05)' : 'rgba(245,250,249,0.6)',
                                    color: !inMonth ? 'rgba(15,45,38,0.35)' : undefined,
                                }}
                            >
                                <div className="mb-1.5 text-sm font-semibold" style={{ color: inMonth ? 'var(--ats-secondary)' : 'rgba(15,45,38,0.35)' }}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((ev) => {
                                        const chip = TYPE_CHIP[ev.type] || { bg: '#fff', text: 'var(--ats-secondary)', border: 'rgba(15,45,38,0.12)' };
                                        return (
                                        <button
                                            key={ev.id}
                                            type="button"
                                            title={`${ev.title}${ev.jobTitle ? ` · ${ev.jobTitle}` : ''}${ev.time ? ` · ${ev.time}` : ''}`}
                                            onClick={() => ev.candidateId && navigate(`/recruitment/candidates/${ev.candidateId}`)}
                                            className="block w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-snug sm:text-[11px]"
                                            style={{ background: chip.bg, color: chip.text, border: `1px solid ${chip.border}` }}
                                        >
                                            <span className="line-clamp-2 font-semibold">{ev.title}</span>
                                            {(ev.jobTitle || ev.time) && (
                                                <span className="mt-0.5 block truncate opacity-80">
                                                    {[ev.jobTitle, ev.time].filter(Boolean).join(' · ')}
                                                </span>
                                            )}
                                        </button>
                                        );
                                    })}
                                    {dayEvents.length > 3 && (
                                        <p className="px-0.5 text-[10px] font-medium" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                            +{dayEvents.length - 3} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filtered.length === 0 && (
                    <p className="mt-4 text-center text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No events in this month</p>
                )}
            </div>
        </AtsPage>
    );
};

export default RecruitmentCalendarPage;
