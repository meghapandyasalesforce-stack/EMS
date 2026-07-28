import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
    FaGraduationCap, FaSync, FaCertificate, FaClipboardList, FaCalendarAlt, FaEllipsisV,
    FaChevronLeft, FaChevronRight, FaPlus, FaFilter, FaDownload, FaSlidersH,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CmBadge, CmButton, CmPerson, CmProgress, CmEmpty } from '../../components/corporateModern';

// ── Display-only derivation (no API/handler impact) ──
function certStatus(row) {
    if (row.certificates?.length > 0) return { label: 'Certified', tone: 'done' };
    if ((row.progress ?? 0) > 0) return { label: 'In Progress', tone: 'progress' };
    return { label: 'Overdue', tone: 'attention' };
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function getStartOfWeek(date) {
    const next = new Date(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + diff);
    return next;
}

function formatWeekRange(start) {
    const end = addDays(start, 6);
    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
    if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

function buildWeekSessions(employees = [], courses = [], weekStart = new Date()) {
    const base = [
        ...(courses || []).slice(0, 4).map((course, i) => ({
            title: course.course || `Course ${i + 1}`,
            time: ['09:00 AM', '11:30 AM', '10:00 AM', '02:00 PM'][i % 4],
        })),
        ...(employees || []).slice(0, 3).map((row, i) => ({
            title: `${row.employee?.department || 'HR'} onboarding`,
            time: ['01:00 PM', '03:30 PM', '04:00 PM'][i % 3],
        })),
    ];

    return Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        return {
            label: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            date,
            sessions: base
                .filter((_, sessionIndex) => (sessionIndex % 5) === (index % 5))
                .slice(0, 2),
        };
    });
}

function buildMonthCells(weekStart) {
    const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const gridStart = getStartOfWeek(monthStart);
    return Array.from({ length: 35 }, (_, index) => {
        const date = addDays(gridStart, index);
        return {
            key: date.toISOString(),
            date,
            inMonth: date.getMonth() === weekStart.getMonth(),
        };
    });
}

/**
 * LMS Dashboard — org training overview (HR) or per-workflow assign/sync.
 */
const LmsDashboard = ({ workflowId, isHRView, onUpdated }) => {
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState(null);
    const [providers, setProviders] = useState([]);
    const [error, setError] = useState('');
    const [courseTitle, setCourseTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [calendarView, setCalendarView] = useState('week');
    const [primarySection, setPrimarySection] = useState('rules');
    const [weekOffset, setWeekOffset] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const [dash, prov] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/lms/dashboard`),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/lms/providers`).catch(() => ({ data: { data: [] } })),
            ]);
            setDashboard(dash.data.data);
            setProviders(prov.data.data || []);
            setLastSync(new Date());
        } catch (err) {
            setDashboard(null);
            setError(err.response?.data?.message || 'Could not load LMS dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const assignCourse = async () => {
        if (!workflowId || !courseTitle.trim()) return;
        try {
            setSubmitting(true);
            await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/lms/assign-course`, { title: courseTitle });
            toast.success('Course assigned');
            setCourseTitle('');
            onUpdated?.();
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    const syncLms = async () => {
        if (!workflowId) return;
        try {
            setSubmitting(true);
            const { data } = await axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/lms/sync-certify`, {});
            toast.success(`Synced — ${data.data?.certificates?.length || 0} certificates`);
            onUpdated?.();
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Sync failed');
        } finally {
            setSubmitting(false);
        }
    };

    const summary = dashboard?.summary || {};
    const pendingModules = Math.max(0, (summary.totalModules || 0) - (summary.completedModules || 0));
    const employees = dashboard?.employees || [];
    const courses = dashboard?.byCourse || [];
    const currentWeekStart = useMemo(() => addDays(getStartOfWeek(new Date()), weekOffset * 7), [weekOffset]);
    const weekSessions = useMemo(() => buildWeekSessions(employees, courses, currentWeekStart), [employees, courses, currentWeekStart]);
    const monthCells = useMemo(() => buildMonthCells(currentWeekStart), [currentWeekStart]);
    const employeesToShow = employees.slice(0, 3);
    const totalEmployees = employees.length;
    const syncConnected = providers.length > 0;
    const topWeekLabel = formatWeekRange(currentWeekStart);

    if (loading) return <LoadingSpinner message="Loading LMS dashboard..." />;

    // ── Employee / onboarding-employee view — left byte-identical ──
    if (!isHRView) {
        return (
            <div className="space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">LMS / Training Dashboard</h3>
                        <p className="text-xs text-gray-500">
                            Assigned courses, completion, and certifications
                            {lastSync ? ` · Updated ${lastSync.toLocaleTimeString()}` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        <FaSync /> Refresh
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-center text-sm">
                    <div className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                        <p className="text-xl font-bold">{summary.employeesInTraining || 0}</p>
                        <p className="text-xs text-gray-500">Assigned / in training</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
                        <p className="text-xl font-bold">{summary.totalModules || 0}</p>
                        <p className="text-xs text-gray-500">Modules</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                        <p className="text-xl font-bold">{summary.completedModules || 0}</p>
                        <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                        <p className="text-xl font-bold">{pendingModules}</p>
                        <p className="text-xs text-gray-500">Pending</p>
                    </div>
                    <div className="rounded-xl bg-red-50 p-3 border border-red-100">
                        <p className="text-xl font-bold">{summary.failedModules || 0}</p>
                        <p className="text-xs text-gray-500">Failed</p>
                    </div>
                    <div className="rounded-xl bg-theme-primary/10 p-3 border border-theme-primary/20">
                        <p className="text-xl font-bold">{summary.completionRate || 0}%</p>
                        <p className="text-xs text-gray-500">Completion rate</p>
                    </div>
                </div>

                {workflowId && isHRView && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-3">
                        <input
                            value={courseTitle}
                            onChange={(e) => setCourseTitle(e.target.value)}
                            placeholder="Course title"
                            className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button type="button" disabled={submitting} onClick={assignCourse} className="rounded-lg bg-theme-primary px-3 py-2 text-sm text-white">
                            Assign course
                        </button>
                        <button type="button" disabled={submitting} onClick={syncLms} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                            Sync from LMS
                        </button>
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-3">
                    <section className="rounded-xl border border-gray-100 bg-white p-4 lg:col-span-2">
                        <h4 className="mb-3 text-sm font-semibold text-gray-900">Learners</h4>
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                            {employees.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
                                    <FaGraduationCap className="mx-auto mb-2 text-2xl text-gray-300" />
                                    <p>No training assignments yet.</p>
                                    <p className="mt-1 text-xs">Assign courses from an onboarding workflow to populate this list.</p>
                                </div>
                            ) : (
                                employees.map((row) => (
                                    <div key={row.workflowId || row.employee?._id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-gray-900">
                                                {row.employee?.name} {row.employee?.lastName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {row.modulesCompleted}/{row.modulesTotal} modules
                                                {row.certificates?.length ? ` · ${row.certificates.length} certs` : ''}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="font-semibold text-theme-primary">{row.progress ?? 0}%</p>
                                            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                                                <div
                                                    className="h-full rounded-full bg-theme-primary"
                                                    style={{ width: `${Math.min(100, Number(row.progress) || 0)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-gray-100 bg-white p-4">
                        <h4 className="mb-3 text-sm font-semibold text-gray-900">LMS providers</h4>
                        <div className="flex flex-wrap gap-2">
                            {(providers.length ? providers : [{ key: 'manual', label: 'Manual / Internal' }]).map((p) => (
                                <span key={p.key || p.label} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium">
                                    {p.label || p.key}
                                </span>
                            ))}
                        </div>
                        <div className="mt-4 space-y-2 text-xs text-gray-600">
                            <p><span className="font-semibold text-gray-900">Certifications:</span> synced via workflow LMS sync.</p>
                            <p><span className="font-semibold text-gray-900">Expiring:</span> review learner rows for certificate metadata when available.</p>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    // ── HR / enterprise Corporate-Modern view ──
    return (
        <div className="cm-hrms">
            <div className="cm-page">
                <div className="flex flex-col gap-3 rounded-[1.75rem] bg-[rgba(255,255,255,0.7)] px-2 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-5">
                        <p className="text-2xl font-semibold text-[var(--cm-on-surface)]">PeopleFlow Induction</p>
                        <div className="flex flex-wrap items-center gap-5 text-sm">
                            {[
                                { key: 'calendar', label: 'Calendar' },
                                { key: 'rules', label: 'Rules' },
                                { key: 'tracking', label: 'Tracking' },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setPrimarySection(item.key)}
                                    className={`border-b-2 pb-1 transition ${
                                        primarySection === item.key
                                            ? 'border-[var(--cm-primary-deep)] font-semibold text-[var(--cm-primary-deep)]'
                                            : 'border-transparent text-[var(--cm-muted)] hover:text-[var(--cm-on-surface)]'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="min-w-[220px]">
                            <input
                                value={courseTitle}
                                onChange={(e) => setCourseTitle(e.target.value)}
                                placeholder="Search team..."
                                className="cm-input rounded-full"
                            />
                        </div>
                        <button type="button" className="cm-icon-btn" aria-label="Refresh induction data" onClick={load}>
                            <FaSync />
                        </button>
                    </div>
                </div>

                {error && <div className="cm-banner cm-banner--attention">{error}</div>}

                {workflowId && (
                    <div className="cm-card flex flex-wrap gap-2.5">
                        <input
                            value={courseTitle}
                            onChange={(e) => setCourseTitle(e.target.value)}
                            placeholder="Course title"
                            className="cm-input min-w-[160px] flex-1"
                        />
                        <CmButton disabled={submitting} onClick={assignCourse}>Assign Course</CmButton>
                        <CmButton variant="outline" disabled={submitting} onClick={syncLms}>Sync from LMS</CmButton>
                    </div>
                )}

                {primarySection === 'calendar' && (
                <div className="cm-card">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="cm-title-sm">Sessions Calendar</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex rounded-full bg-[var(--cm-surface-low)] p-1">
                                <button
                                    type="button"
                                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${calendarView === 'week' ? 'bg-white text-[var(--cm-primary-deep)] shadow-sm' : 'text-[var(--cm-muted)]'}`}
                                    onClick={() => setCalendarView('week')}
                                >
                                    Week
                                </button>
                                <button
                                    type="button"
                                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${calendarView === 'month' ? 'bg-white text-[var(--cm-primary-deep)] shadow-sm' : 'text-[var(--cm-muted)]'}`}
                                    onClick={() => setCalendarView('month')}
                                >
                                    Month
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium text-[var(--cm-on-surface)]">
                                <button
                                    type="button"
                                    className="cm-icon-btn"
                                    aria-label="Previous period"
                                    onClick={() => setWeekOffset((prev) => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <span>{topWeekLabel}</span>
                                <button
                                    type="button"
                                    className="cm-icon-btn"
                                    aria-label="Next period"
                                    onClick={() => setWeekOffset((prev) => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        </div>
                    </div>
                    {calendarView === 'week' ? (
                        <div>
                            <div className="mb-3 grid grid-cols-7 gap-3">
                                {weekSessions.map((day) => (
                                    <div key={day.label} className="text-center">
                                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--cm-muted)]">{day.label}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                                {weekSessions.map((day) => (
                                    <div key={`${day.label}-${day.date.toISOString()}`} className="min-h-[8.5rem] rounded-2xl bg-[var(--cm-surface-low)] p-3">
                                        <p className="mb-3 text-xs text-[var(--cm-muted)]">{day.date.getDate()}</p>
                                        <div className="space-y-2">
                                            {day.sessions.length > 0 ? day.sessions.map((session) => (
                                                <div key={`${day.label}-${session.title}`} className="rounded-xl border-l-[3px] border-[var(--cm-primary)] bg-white px-2.5 py-2 shadow-sm">
                                                    <p className="truncate text-xs font-semibold text-[var(--cm-primary-deep)]">{session.title}</p>
                                                    <p className="mt-0.5 text-[11px] text-[var(--cm-muted)]">{session.time}</p>
                                                </div>
                                            )) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-3 grid grid-cols-7 gap-2 text-center">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                                    <p key={label} className="text-xs font-medium uppercase tracking-wide text-[var(--cm-muted)]">{label}</p>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {monthCells.map((cell) => {
                                    const daySessions = weekSessions.filter((day) => day.date.toDateString() === cell.date.toDateString())[0]?.sessions || [];
                                    return (
                                        <div
                                            key={cell.key}
                                            className={`min-h-[6rem] rounded-2xl p-2 ${
                                                cell.inMonth ? 'bg-[var(--cm-surface-low)]' : 'bg-[rgba(232,240,234,0.45)]'
                                            }`}
                                        >
                                            <p className={`text-xs ${cell.inMonth ? 'text-[var(--cm-on-surface)]' : 'text-[var(--cm-muted)]'}`}>
                                                {cell.date.getDate()}
                                            </p>
                                            {daySessions.slice(0, 1).map((session) => (
                                                <div key={`${cell.key}-${session.title}`} className="mt-2 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[var(--cm-primary-deep)] shadow-sm">
                                                    {session.title}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                )}

                {primarySection === 'rules' && (
                <div className="cm-card">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <p className="cm-title-sm">Course Enrollment Rules</p>
                            <p className="cm-subtitle">Define logic for automatic training assignment by role or department.</p>
                        </div>
                        <CmButton variant="ghost" size="sm">
                            <FaPlus className="text-[10px]" /> Add Rule
                        </CmButton>
                    </div>
                    <div className="rounded-[2rem] border border-dashed border-[rgba(187,202,193,0.8)] bg-[var(--cm-surface-low)] px-6 py-12">
                        <CmEmpty icon={<FaSlidersH />} title="Rules missing by default">
                            Set up auto-enrollment to automate induction paths for your new hires.
                        </CmEmpty>
                        <p className="mt-3 text-center text-sm font-medium text-[var(--cm-primary-deep)]">
                            Learn how auto-enrollment works
                        </p>
                    </div>
                </div>
                )}

                {primarySection === 'tracking' && (
                <div className="cm-card">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="cm-title-sm">Employee Training Progress</p>
                            <p className="cm-subtitle">Track progress, certification, and LMS sync state per learner.</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button type="button" className="cm-icon-btn" aria-label="Filter training progress">
                                <FaFilter />
                            </button>
                            <button type="button" className="cm-icon-btn" aria-label="Download training report">
                                <FaDownload />
                            </button>
                        </div>
                    </div>

                    {employees.length === 0 ? (
                        <CmEmpty icon={<FaGraduationCap />} title="No training assignments yet">
                            Assign courses from an onboarding workflow to populate this list.
                        </CmEmpty>
                    ) : (
                        <>
                            <div className="cm-table-wrap">
                                <table className="cm-table">
                                    <thead>
                                        <tr>
                                            <th>Employee</th>
                                            <th>Enrolled Courses</th>
                                            <th>Certification Status</th>
                                            <th>LMS Sync Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeesToShow.map((row) => {
                                            const cert = certStatus(row);
                                            const progress = Number(row.progress) || 0;
                                            return (
                                                <tr key={row.workflowId || row.employee?._id}>
                                                    <td>
                                                        <CmPerson
                                                            name={[row.employee?.name, row.employee?.lastName].filter(Boolean).join(' ') || '—'}
                                                            meta={row.employee?.department || 'Employee'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <p className="mb-1 text-xs font-semibold text-[var(--cm-on-surface)]">
                                                            {row.modulesCompleted}/{row.modulesTotal} Completed
                                                        </p>
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-36">
                                                                <CmProgress value={progress} attention={progress < 50} />
                                                            </div>
                                                            <span className={`text-xs font-semibold ${progress < 50 ? 'text-[var(--cm-tertiary-deep)]' : 'text-[var(--cm-primary-deep)]'}`}>
                                                                {progress}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td><CmBadge tone={cert.tone}>{cert.label}</CmBadge></td>
                                                    <td>
                                                        <CmBadge tone={syncConnected ? 'done' : 'attention'} dot={false}>
                                                            {syncConnected ? 'Connected' : 'Not Configured'}
                                                        </CmBadge>
                                                    </td>
                                                    <td>
                                                        <button type="button" className="cm-icon-btn" aria-label="More actions">
                                                            <FaEllipsisV />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="cm-pagination">
                                <span>Showing {employeesToShow.length} of {totalEmployees} employees</span>
                                <div className="flex items-center gap-1.5">
                                    <button type="button" className="cm-icon-btn" aria-label="Previous page" disabled>
                                        Previous
                                    </button>
                                    <span className="cm-chip cm-chip--active" style={{ cursor: 'default' }}>1</span>
                                    <button type="button" className="cm-icon-btn" aria-label="Next page" disabled>
                                        2
                                    </button>
                                    <button type="button" className="cm-icon-btn" aria-label="Next page" disabled>
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};

export default LmsDashboard;
