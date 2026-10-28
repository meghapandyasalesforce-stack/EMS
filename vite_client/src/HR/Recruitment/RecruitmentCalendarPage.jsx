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

    const renderDayCell = (day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay[key] || [];
        const inMonth = isSameMonth(day, month);
        const hasEvents = dayEvents.length > 0;
        const today = isToday(day);

        return (
            <div
                key={key}
                className={[
                    'ats-calendar-day',
                    today ? 'ats-calendar-day--today' : '',
                    !inMonth ? 'ats-calendar-day--muted' : '',
                    hasEvents ? 'ats-calendar-day--has-events' : '',
                ].filter(Boolean).join(' ')}
            >
                <div className="ats-calendar-day__date">
                    {format(day, 'd')}
                </div>
                <div className="ats-calendar-day__events">
                    {dayEvents.map((ev) => {
                        const chip = TYPE_CHIP[ev.type] || { bg: '#fff', text: 'var(--ats-secondary)', border: 'rgba(15,45,38,0.12)' };
                        const detail = [ev.jobTitle, ev.time].filter(Boolean).join(' · ');
                        return (
                            <button
                                key={ev.id}
                                type="button"
                                onClick={() => ev.candidateId && navigate(`/recruitment/candidates/${ev.candidateId}`)}
                                className="ats-calendar-event"
                                style={{ background: chip.bg, color: chip.text, border: `1px solid ${chip.border}` }}
                            >
                                <span className="ats-calendar-event__title">{ev.title}</span>
                                {detail ? (
                                    <span className="ats-calendar-event__detail">{detail}</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const calendarToolbar = (
        <div className="ats-calendar-toolbar">
            <CmButton variant="outline" size="sm" onClick={() => setMonth(addMonths(month, -1))}>
                Prev
            </CmButton>

            <label className="ats-calendar-toolbar__month">
                <select
                    aria-label="Select month"
                    className="ats-calendar-toolbar__select"
                    value={month.getMonth()}
                    onChange={(e) => goToMonthYear(Number(e.target.value), month.getFullYear())}
                >
                    {MONTH_OPTIONS.map((label, index) => (
                        <option key={label} value={index}>{label}</option>
                    ))}
                </select>
            </label>

            <label className="ats-calendar-toolbar__year">
                <select
                    aria-label="Select year"
                    className="ats-calendar-toolbar__select"
                    value={month.getFullYear()}
                    onChange={(e) => goToMonthYear(month.getMonth(), Number(e.target.value))}
                >
                    {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </label>

            <CmButton variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))}>
                Next
            </CmButton>
        </div>
    );

    if (loading) return <LoadingSpinner message="Loading calendar…" />;

    return (
        <AtsPage fullWidth className="rec-hub ats-calendar-page">
            <div className="rec-hub__crumb">
                <span>Recruitment</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Interview Calendar</span>
            </div>

            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <div className="ats-calendar-top">
                <AtsPageHeader
                    eyebrow="Talent acquisition"
                    title="Recruitment Calendar"
                    subtitle="Interviews, joining dates, and offer expiries"
                />
                <div className="ats-calendar-toolbar-row">
                    {calendarToolbar}
                </div>
            </div>

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

            <div className="cm-card ats-calendar-card">
                <div className="ats-calendar-scroll">
                    <div className="ats-calendar-grid">
                        {WEEKDAYS.map((d) => (
                            <div key={d} className="ats-calendar-weekday">
                                {d}
                            </div>
                        ))}
                        {calendarDays.map((day) => renderDayCell(day))}
                    </div>
                </div>

                {filtered.length === 0 && (
                    <p className="mt-4 text-center text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>No events in this month</p>
                )}
            </div>
        </AtsPage>
    );
};

export default RecruitmentCalendarPage;
