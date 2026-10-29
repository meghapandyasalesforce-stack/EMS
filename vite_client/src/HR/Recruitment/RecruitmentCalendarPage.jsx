import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    addWeeks,
    addDays,
    isSameMonth,
    isSameDay,
    isToday,
    parseISO,
} from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaBriefcase,
    FaCalendarAlt,
    FaChevronLeft,
    FaChevronRight,
    FaMapMarkerAlt,
    FaPlus,
    FaSync,
    FaUserFriends,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage, cmInitials } from '../../components/recruitment/atsUi';

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_LANES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

const STATUS_META = {
    Scheduled: { label: 'Confirmed', tone: 'confirmed' },
    Confirmed: { label: 'Confirmed', tone: 'confirmed' },
    'In Progress': { label: 'In Progress', tone: 'progress' },
    Rescheduled: { label: 'Rescheduled', tone: 'rescheduled' },
    Completed: { label: 'Completed', tone: 'completed' },
    Cancelled: { label: 'Cancelled', tone: 'cancelled' },
    joining: { label: 'Joining', tone: 'joining' },
    offer_expiry: { label: 'Offer Expiry', tone: 'offer' },
};

function parseEventDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const raw = String(value);
    try {
        return raw.includes('T') ? parseISO(raw) : new Date(`${raw.slice(0, 10)}T00:00:00`);
    } catch {
        return new Date(value);
    }
}

function formatTimeRange(time) {
    if (!time) return null;
    const t = String(time).trim();
    if (!t) return null;
    if (t.includes('-')) return `${t} IST`;
    return `${t} IST`;
}

function resolveStatusMeta(ev) {
    if (ev.type === 'joining') return STATUS_META.joining;
    if (ev.type === 'offer_expiry') return STATUS_META.offer_expiry;
    const key = String(ev.status || 'Scheduled');
    return STATUS_META[key] || { label: key, tone: 'confirmed' };
}

function candidateLabel(ev) {
    if (ev.candidateName) return ev.candidateName;
    const title = String(ev.title || '');
    const parts = title.split('—');
    return (parts[1] || title).trim() || 'Candidate';
}

function topicLabel(ev) {
    if (ev.type === 'joining') return ev.jobTitle || 'Expected joining';
    if (ev.type === 'offer_expiry') return 'Offer expiry';
    return ev.interviewType || ev.jobTitle || 'Interview';
}

function endOfDaySafe(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

const RecruitmentCalendarPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [openJobs, setOpenJobs] = useState([]);
    const [view, setView] = useState('week');
    const [anchor, setAnchor] = useState(() => new Date());
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [selectedInterviewers, setSelectedInterviewers] = useState([]);
    const [typeFilter, setTypeFilter] = useState('interview');
    const jobsInitRef = useRef(false);
    const interviewersInitRef = useRef(false);

    const range = useMemo(() => {
        if (view === 'day') {
            return { from: anchor, to: endOfDaySafe(anchor) };
        }
        if (view === 'week') {
            const from = startOfWeek(anchor, { weekStartsOn: 1 });
            const to = endOfWeek(anchor, { weekStartsOn: 1 });
            return { from, to };
        }
        return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }, [anchor, view]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const padFrom = startOfMonth(addMonths(range.from, -1));
            const padTo = endOfMonth(addMonths(range.to, 1));
            const [calendarRes, jobsRes] = await Promise.all([
                axios.get(
                    `/v1/admin/recruitment/calendar?from=${padFrom.toISOString()}&to=${padTo.toISOString()}`,
                    { withCredentials: true },
                ),
                axios.get('/v1/admin/recruitment/jobs', {
                    withCredentials: true,
                    params: { status: 'Open', limit: 40 },
                }).catch(() => ({ data: { data: [] } })),
            ]);
            setEvents(calendarRes.data.data?.events || []);
            const jobs = jobsRes.data?.data || jobsRes.data?.jobs || [];
            setOpenJobs(Array.isArray(jobs) ? jobs : []);
        } catch {
            toast.error('Failed to load calendar');
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [range.from, range.to]);

    useEffect(() => { load(); }, [load]);

    const interviewEvents = useMemo(
        () => events.filter((e) => e.type === 'interview'),
        [events],
    );

    const jobOptions = useMemo(() => {
        const map = new Map();
        openJobs.forEach((job) => {
            const title = job.jobTitle || job.title;
            if (!title) return;
            const entry = map.get(title) || { title, count: 0, fromJobs: true };
            map.set(title, entry);
        });
        interviewEvents.forEach((ev) => {
            const title = ev.jobTitle || 'Unassigned role';
            const entry = map.get(title) || { title, count: 0 };
            entry.count += 1;
            map.set(title, entry);
        });
        return Array.from(map.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.title.localeCompare(b.title);
        });
    }, [interviewEvents, openJobs]);

    const interviewerOptions = useMemo(() => {
        const map = new Map();
        interviewEvents.forEach((ev) => {
            const id = String(ev.interviewerId || ev.interviewerName || '');
            if (!id && !ev.interviewerName) return;
            const key = id || ev.interviewerName;
            const entry = map.get(key) || {
                id: key,
                name: ev.interviewerName || 'Interviewer',
                role: ev.interviewerRole || 'Panel',
                count: 0,
                busyToday: false,
            };
            entry.count += 1;
            const d = parseEventDate(ev.date);
            if (d && isToday(d) && String(ev.status) !== 'Cancelled') entry.busyToday = true;
            map.set(key, entry);
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [interviewEvents]);

    useEffect(() => {
        if (!jobsInitRef.current && jobOptions.length) {
            jobsInitRef.current = true;
            setSelectedJobs(jobOptions.map((j) => j.title));
        }
    }, [jobOptions]);

    useEffect(() => {
        if (!interviewersInitRef.current && interviewerOptions.length) {
            interviewersInitRef.current = true;
            setSelectedInterviewers(interviewerOptions.map((i) => i.id));
        }
    }, [interviewerOptions]);

    const filtered = useMemo(() => {
        return events.filter((ev) => {
            if (typeFilter !== 'all' && ev.type !== typeFilter) return false;
            if (ev.type === 'interview') {
                const job = ev.jobTitle || 'Unassigned role';
                if (selectedJobs.length && !selectedJobs.includes(job)) return false;
                const iid = String(ev.interviewerId || ev.interviewerName || '');
                if (interviewerOptions.length && selectedInterviewers.length) {
                    if (iid && !selectedInterviewers.includes(iid)) return false;
                }
            }
            return true;
        });
    }, [events, typeFilter, selectedJobs, selectedInterviewers, interviewerOptions.length]);

    const eventsByDay = useMemo(() => {
        const map = {};
        filtered.forEach((ev) => {
            const d = parseEventDate(ev.date);
            if (!d || Number.isNaN(d.getTime())) return;
            const key = format(d, 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });
        Object.values(map).forEach((list) => {
            list.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
        });
        return map;
    }, [filtered]);

    const weekDays = useMemo(() => {
        const start = startOfWeek(anchor, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end: addDays(start, 5) });
    }, [anchor]);

    const monthDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [anchor]);

    const miniMonthDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [anchor]);

    const visibleInterviewCount = useMemo(
        () => filtered.filter((e) => e.type === 'interview').length,
        [filtered],
    );

    const stats = useMemo(() => {
        const interviews = filtered.filter((e) => e.type === 'interview');
        const completed = interviews.filter((e) => e.status === 'Completed').length;
        const confirmed = interviews.filter((e) => e.status === 'Scheduled' || e.status === 'Confirmed').length;
        const rate = interviews.length
            ? Math.round((completed / interviews.length) * 1000) / 10
            : null;
        return {
            total: interviews.length,
            confirmed,
            completed,
            roomsActive: Math.min(10, confirmed),
            attendanceRate: rate,
        };
    }, [filtered]);

    const shift = (dir) => {
        if (view === 'day') setAnchor((d) => addDays(d, dir));
        else if (view === 'week') setAnchor((d) => addWeeks(d, dir));
        else setAnchor((d) => addMonths(d, dir));
    };

    const toggleJob = (title) => {
        setSelectedJobs((prev) => (
            prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
        ));
    };

    const toggleInterviewer = (id) => {
        setSelectedInterviewers((prev) => (
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        ));
    };

    const openEvent = (ev) => {
        if (!ev.candidateId) return;
        navigate(`/recruitment/candidates/${ev.candidateId}`);
    };

    const rangeLabel = useMemo(() => {
        if (view === 'day') return format(anchor, 'EEEE, d MMM yyyy');
        if (view === 'week') {
            const start = startOfWeek(anchor, { weekStartsOn: 1 });
            return `Week of ${format(start, 'yyyy-MM-dd')}`;
        }
        return format(anchor, 'MMMM yyyy');
    }, [anchor, view]);

    const renderInterviewCard = (ev) => {
        const meta = resolveStatusMeta(ev);
        const timeLabel = formatTimeRange(ev.time) || (ev.type === 'interview' ? 'Time TBD' : format(parseEventDate(ev.date) || new Date(), 'd MMM'));
        return (
            <button
                key={ev.id}
                type="button"
                className={`ric-card ric-card--${meta.tone}`}
                onClick={() => openEvent(ev)}
            >
                <span className="ric-card__time">{timeLabel}</span>
                <span className="ric-card__name">{candidateLabel(ev)}</span>
                <span className="ric-card__topic">{topicLabel(ev)}</span>
                {ev.jobTitle && ev.type === 'interview' ? (
                    <span className="ric-card__job">{ev.jobTitle}</span>
                ) : null}
                <span className={`ric-card__status ric-card__status--${meta.tone}`}>{meta.label}</span>
            </button>
        );
    };

    const renderDayColumn = (day, wide = false) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay[key] || [];
        return (
            <div key={key} className={`ric-week__col ${wide ? 'is-wide' : ''} ${isToday(day) ? 'is-today' : ''}`}>
                <div className="ric-week__head">
                    <span className="ric-week__dow">{format(day, wide ? 'EEEE' : 'EEE')}</span>
                    <span className="ric-week__date">{format(day, wide ? 'd MMMM yyyy' : 'd MMM')}</span>
                </div>
                <div className={`ric-week__body ${wide ? 'ric-week__body--day' : ''}`}>
                    {dayEvents.length > 0 ? (
                        dayEvents.map(renderInterviewCard)
                    ) : (
                        <div className="ric-slots" aria-hidden={false}>
                            {TIME_LANES.slice(0, wide ? 8 : 5).map((slot) => (
                                <div key={`${key}-${slot}`} className="ric-slot">
                                    <span className="ric-slot__time">{slot}</span>
                                    <span className="ric-slot__line" />
                                </div>
                            ))}
                            <p className="ric-week__empty">Open slot</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <LoadingSpinner message="Loading interview calendar…" />;

    return (
        <AtsPage fullWidth className="rec-hub ric-page">
            <div className="rec-hub__crumb">
                <Link to="/dashboard">Dashboard</Link>
                <span className="rec-hub__crumb-sep">/</span>
                <span>Hire &amp; Lifecycle</span>
                <span className="rec-hub__crumb-sep">/</span>
                <Link to="/recruitment">Recruitment Hub</Link>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Interview Calendar</span>
            </div>

            <header className="ric-header">
                <div className="ric-header__copy">
                    <div className="rec-hub__title-row">
                        <h1 className="rec-hub__title">Recruitment Interview Calendar &amp; Panel Schedule</h1>
                    </div>
                    <div className="rec-hub__badges ric-header__badges">
                        <span className="rec-hub__badge rec-hub__badge--soft">Timezone: IST</span>
                        <span className="rec-hub__badge rec-hub__badge--soft">
                            <FaMapMarkerAlt aria-hidden /> Location
                        </span>
                        <span className="rec-hub__badge rec-hub__badge--mint ric-live">
                            <span className="ric-live__dot" aria-hidden />
                            <FaSync aria-hidden className="ric-live__icon" />
                            Live Sync Enabled
                        </span>
                    </div>
                </div>
                <div className="rec-hub__header-actions">
                    <button
                        type="button"
                        className="rec-hub__btn rec-hub__btn--primary"
                        onClick={() => navigate('/recruitment')}
                    >
                        <FaPlus aria-hidden /> Schedule Interview
            </button>
                </div>
            </header>

            <div className="ric-type-filters">
                {[
                    { id: 'interview', label: 'Interviews' },
                    { id: 'joining', label: 'Joining' },
                    { id: 'offer_expiry', label: 'Offer Expiry' },
                    { id: 'all', label: 'All' },
                ].map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        className={`ric-type-pill ${typeFilter === f.id ? 'is-active' : ''}`}
                        onClick={() => setTypeFilter(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="ric-layout">
                <aside className="ric-sidebar">
                    <section className="ric-panel">
                        <div className="ric-mini-cal__nav">
                            <button type="button" className="ric-icon-btn" aria-label="Previous month" onClick={() => setAnchor(addMonths(anchor, -1))}>
                                <FaChevronLeft />
                            </button>
                            <h2 className="ric-panel__title">{format(anchor, 'MMMM yyyy')}</h2>
                            <button type="button" className="ric-icon-btn" aria-label="Next month" onClick={() => setAnchor(addMonths(anchor, 1))}>
                                <FaChevronRight />
                            </button>
                        </div>
                        <div className="ric-mini-cal__weekdays">
                            {WEEKDAYS_SHORT.map((d) => (
                                <span key={d}>{d.slice(0, 1)}</span>
                            ))}
                        </div>
                        <div className="ric-mini-cal__grid">
                            {miniMonthDays.map((day) => {
                                const key = format(day, 'yyyy-MM-dd');
                                const selected = isSameDay(day, anchor);
                                const today = isToday(day);
                                const muted = !isSameMonth(day, anchor);
                                const has = (eventsByDay[key] || []).length > 0;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={[
                                            'ric-mini-cal__day',
                                            selected ? 'is-selected' : '',
                                            today ? 'is-today' : '',
                                            muted ? 'is-muted' : '',
                                            has ? 'has-events' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => setAnchor(day)}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="ric-panel">
                        <h2 className="ric-panel__title">Job Requisitions</h2>
                        {jobOptions.length === 0 ? (
                            <div className="ric-empty-block">
                                <span className="ric-empty-block__icon"><FaBriefcase /></span>
                                <p className="ric-empty-block__title">No open requisitions</p>
                                <p className="ric-empty-block__hint">Open roles will appear here for filtering.</p>
                            </div>
                        ) : (
                            <ul className="ric-check-list">
                                {jobOptions.map((job) => (
                                    <li key={job.title}>
                                        <label className="ric-check">
                                            <input
                                                type="checkbox"
                                                checked={selectedJobs.includes(job.title)}
                                                onChange={() => toggleJob(job.title)}
                                            />
                                            <span className="ric-check__label">{job.title}</span>
                                            <span className="ric-check__meta">
                                                {job.count > 0 ? `${job.count} slots` : 'Open'}
                                            </span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="ric-panel">
                        <h2 className="ric-panel__title">Panel Interviewers</h2>
                        {interviewerOptions.length === 0 ? (
                            <div className="ric-empty-block">
                                <span className="ric-empty-block__icon"><FaUserFriends /></span>
                                <p className="ric-empty-block__title">Panel idle</p>
                                <p className="ric-empty-block__hint">Interviewers show up once sessions are booked.</p>
                            </div>
                        ) : (
                            <ul className="ric-people">
                                {interviewerOptions.map((person) => (
                                    <li key={person.id}>
                                        <label className="ric-person">
                                            <input
                                                type="checkbox"
                                                className="ric-person__check"
                                                checked={selectedInterviewers.includes(person.id)}
                                                onChange={() => toggleInterviewer(person.id)}
                                            />
                                            <span className="ric-person__avatar" aria-hidden>
                                                {cmInitials(person.name)}
                                            </span>
                                            <span className="ric-person__meta">
                                                <span className="ric-person__name">{person.name}</span>
                                                <span className="ric-person__role">{person.role}</span>
                                            </span>
                                            <span
                                                className={`ric-person__dot ${person.busyToday ? 'is-busy' : 'is-free'}`}
                                                title={person.busyToday ? 'Interviewing today' : 'Available'}
                                            />
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="ric-panel ric-ops">
                        <h2 className="ric-panel__title">Operations &amp; Telemetry</h2>
                        <div className="ric-ops__grid">
                            <div className="ric-ops__card">
                                <p className="ric-ops__label">Meet Rooms Active</p>
                                <p className="ric-ops__value">{stats.roomsActive}/10</p>
                            </div>
                            <div className="ric-ops__card">
                                <p className="ric-ops__label">Attendance Rate</p>
                                <p className="ric-ops__value">
                                    {stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
                                </p>
                            </div>
                        </div>
                        <div className="ric-ops__trend">
                            <p className="ric-ops__label">Interview Completion Trend</p>
                            <svg className="ric-spark" viewBox="0 0 120 36" aria-hidden>
                                <polyline
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={stats.total
                                        ? '2,28 18,22 34,24 50,16 66,18 82,10 98,14 118,6'
                                        : '2,30 30,28 58,29 86,27 118,28'}
                                />
                            </svg>
                            <p className="ric-ops__hint">{stats.completed} completed · {stats.confirmed} confirmed</p>
                        </div>
                    </section>
                </aside>

                <section className="ric-main">
                    <div className="ric-toolbar">
                        <div className="ric-toolbar__left">
                            <button type="button" className="ric-icon-btn" aria-label="Previous" onClick={() => shift(-1)}>
                                <FaChevronLeft />
                            </button>
                            <button type="button" className="ric-today-btn" onClick={() => setAnchor(new Date())}>
                                Today
                            </button>
                            <button type="button" className="ric-icon-btn" aria-label="Next" onClick={() => shift(1)}>
                                <FaChevronRight />
                            </button>
                            <div className="ric-toolbar__range">
                                <span>{rangeLabel}</span>
                                {view === 'week' ? <span className="ric-sprint">Sprint</span> : null}
                            </div>
                        </div>
                        <div className="ric-view-toggle" role="tablist" aria-label="Calendar view">
                            {['month', 'week', 'day'].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === mode}
                                    className={`ric-view-toggle__btn ${view === mode ? 'is-active' : ''}`}
                                    onClick={() => setView(mode)}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {visibleInterviewCount === 0 && (view === 'week' || view === 'day') ? (
                        <div className="ric-board-empty">
                            <span className="ric-board-empty__icon"><FaCalendarAlt /></span>
                            <div className="ric-board-empty__copy">
                                <p className="ric-board-empty__title">No interviews in this {view}</p>
                                <p className="ric-board-empty__hint">
                                    Schedule from a candidate profile — slots stay visible below for planning.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rec-hub__btn rec-hub__btn--mint"
                                onClick={() => navigate('/recruitment')}
                            >
                                <FaPlus aria-hidden /> Schedule Interview
                            </button>
                        </div>
                    ) : null}

                    {view === 'week' && (
                        <div className="ric-week">
                            {weekDays.map((day) => renderDayColumn(day))}
                        </div>
                    )}

                    {view === 'day' && (
                        <div className="ric-day">
                            {renderDayColumn(anchor, true)}
                </div>
                    )}

                    {view === 'month' && (
                        <div className="ric-month">
                            <div className="ric-month__weekdays">
                                {WEEKDAYS_SHORT.map((d) => (
                                    <div key={d} className="ric-month__weekday">{d}</div>
                                ))}
                            </div>
                            <div className="ric-month__grid">
                                {monthDays.map((day) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const dayEvents = eventsByDay[key] || [];
                                    return (
                                        <div
                                            key={key}
                                            className={[
                                                'ric-month__cell',
                                                isToday(day) ? 'is-today' : '',
                                                !isSameMonth(day, anchor) ? 'is-muted' : '',
                                            ].filter(Boolean).join(' ')}
                                        >
                                            <button
                                                type="button"
                                                className="ric-month__date"
                                                onClick={() => { setAnchor(day); setView('day'); }}
                                            >
                                                {format(day, 'd')}
                                            </button>
                                            <div className="ric-month__events">
                                                {dayEvents.length === 0 ? (
                                                    <div className="ric-month__slot" aria-hidden />
                                                ) : (
                                                    <>
                                                        {dayEvents.slice(0, 3).map(renderInterviewCard)}
                                                        {dayEvents.length > 3 ? (
                                                            <button
                                                                type="button"
                                                                className="ric-month__more"
                                                                onClick={() => { setAnchor(day); setView('day'); }}
                                                            >
                                                                +{dayEvents.length - 3} more
                                                            </button>
                                                        ) : null}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </AtsPage>
    );
};

export default RecruitmentCalendarPage;
