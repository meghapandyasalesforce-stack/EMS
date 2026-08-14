import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    FaCalendarAlt,
    FaBirthdayCake,
    FaTasks,
    FaBell,
    FaClock,
    FaEdit,
    FaEye,
    FaPlus,
    FaUserTie,
    FaGraduationCap,
    FaFolderOpen,
    FaGift,
    FaHandshake,
    FaHeadset,
    FaChartBar,
    FaProjectDiagram,
    FaChartLine,
    FaCheckCircle,
    FaArrowRight,
    FaFileAlt,
    FaChevronLeft,
    FaChevronRight,
} from 'react-icons/fa';
import { HiOutlineBell, HiOutlineQuestionMarkCircle } from 'react-icons/hi2';
import Todo from './Todo';
import AttendanceBox from '../Attendance/AttendanceBox';
import NotificationFeed from './NotificationFeed';
import PasswordResetPopup from '../PasswordResetPopup';
import ProfilePicture from '../../Shared/ProfilePicture';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { mergeSessionProfile, getProfileDisplayName } from '../../utils/profileUtils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns';
import axios from '../../utils/axios';

import {
    BOTH_ATTENDANCE_ENDPOINT,
    BOTH_TASK_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT,
} from '../../utils/constant';
import {
    getTakeableDaysThisMonth,
    hasNoCarryProbationLeave,
    LEAVE_UI,
} from '../../constants/leaveConstants';

/** Workspace-style mint / forest palette (scoped to this dashboard) */
const WS = {
    bg: '#F8F9FB',
    mint: '#20C997',
    mintHover: '#1ab589',
    forest: '#006D4E',
    card: '#FFFFFF',
    border: 'rgba(15, 23, 42, 0.08)',
};

function MiniCalendar({ viewDate, onPrevMonth, onNextMonth }) {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const pad = (getDay(monthStart) + 6) % 7;

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                <button
                    type="button"
                    onClick={onPrevMonth}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                    aria-label="Previous month"
                >
                    <FaChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-semibold text-slate-800">{format(viewDate, 'MMMM yyyy')}</span>
                <button
                    type="button"
                    onClick={onNextMonth}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                    aria-label="Next month"
                >
                    <FaChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                    <div key={d} className="py-1">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {Array.from({ length: pad }).map((_, i) => (
                    <div key={`pad-${i}`} />
                ))}
                {days.map((day) => {
                    const today = isToday(day);
                    return (
                        <div
                            key={day.toISOString()}
                            className={`flex h-8 items-center justify-center rounded-lg ${
                                today
                                    ? 'bg-[#20C997] font-semibold text-white'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {format(day, 'd')}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DashboardEmployee() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResetPopup, setShowResetPopup] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
    const [dashboardStats, setDashboardStats] = useState({
        todayHours: '0h',
        leaveBalance: '0 days',
        tasksCount: '0',
        currentMonthSalary: '₹0',
        leaveDaysRemaining: '0',
        monthlyCapSummary: null,
        birthdays: null,
        projects: [],
        monthHours: 0,
        attendanceRate: 0,
        daysPresent: 0,
        avgDayHours: 0,
        overtimeHours: 0,
    });
    const [statsLoading, setStatsLoading] = useState(true);

    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const dispatch = useDispatch();

    const profile = useMemo(
        () => mergeSessionProfile(user, employee),
        [user, employee]
    );

    const displayName = useMemo(
        () => getProfileDisplayName(profile, user, employee),
        [profile, user, employee]
    );

    const departmentLabel = useMemo(() => {
        const d = profile?.department;
        if (!d) return '';
        return typeof d === 'string' ? d : '';
    }, [profile?.department]);

    const handleEditProfile = () => navigate('/profile-details');

    useEffect(() => {
        const fetchData = async () => {
            if (hasFetched) {
                return;
            }

            try {
                setLoading(true);
                setHasFetched(true);
                const result = await dispatch(fetchEmployeeOwnInfo());
                if (fetchEmployeeOwnInfo.rejected.match(result)) {
                    setError(result.payload || 'Failed to load employee information');
                }
            } catch (err) {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    setError('An unexpected error occurred');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dispatch, hasFetched]);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                setStatsLoading(true);
                const today = format(new Date(), 'yyyy-MM-dd');
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                const todayLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: today, endDate: today },
                    withCredentials: true,
                });

                const firstDayOfMonth = format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd');
                const lastDayOfMonth = format(new Date(currentYear, currentMonth, 0), 'yyyy-MM-dd');

                const monthLogs = await axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/get-logs`, {
                    params: { startDate: firstDayOfMonth, endDate: lastDayOfMonth },
                    withCredentials: true,
                });

                let payrollAmount = 0;
                try {
                    const payrollRes = await axios.get('/v1/employee/payroll/current', {
                        withCredentials: true,
                    });
                    if (payrollRes.data?.inHandSalary) {
                        payrollAmount = payrollRes.data.inHandSalary;
                    }
                } catch {
                    /* optional */
                }

                let leaveBalance = 0;
                let monthlyCapSummary = null;
                try {
                    const leaveRes = await axios.get(`${EMPLOYEE_LEAVE_ENDPOINT}/get-my-leaves`, {
                        withCredentials: true,
                    });
                    if (leaveRes.data?.statistics?.remainingLeaves !== undefined) {
                        leaveBalance = leaveRes.data.statistics.remainingLeaves;
                    }
                    const capsRaw = leaveRes.data?.statistics?.monthlyLeaveCaps;
                    if (capsRaw?.types?.length) {
                        const totalAppliable = capsRaw.types.reduce(
                            (sum, t) => sum + (Number(t.appliableThisMonth) || 0),
                            0
                        );
                        monthlyCapSummary = {
                            ...capsRaw,
                            totalRemainingThisMonth: Math.round(totalAppliable * 1000) / 1000,
                        };
                    }
                } catch {
                    /* optional */
                }

                let tasksCount = 0;
                try {
                    const tasksRes = await axios.get(`${BOTH_TASK_ENDPOINT}/all-tasks`, {
                        withCredentials: true,
                    });
                    tasksCount = tasksRes.data?.tasks?.length || 0;
                } catch {
                    /* optional */
                }

                let birthdays = [];
                try {
                    const birthdaysRes = await axios.get('/v1/both/profile-details/upcoming-birthdays', {
                        withCredentials: true,
                    });
                    if (birthdaysRes.data?.birthdays) {
                        birthdays = birthdaysRes.data.birthdays;
                    }
                } catch {
                    /* optional */
                }

                const getGrossHours = (session) => {
                    if (!session) return 0;
                    if (typeof session.grossHours === 'number' && Number.isFinite(session.grossHours) && session.grossHours > 0) {
                        return session.grossHours;
                    }
                    if (session.clockIn && session.clockOut) {
                        const start = new Date(session.clockIn).getTime();
                        const end = new Date(session.clockOut).getTime();
                        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                            return (end - start) / (1000 * 60 * 60);
                        }
                    }
                    return 0;
                };

                const todaySession = todayLogs.data?.sessions?.[0];
                let todayHours = '0h';
                if (todaySession && todaySession.clockOut) {
                    const hoursWorked = getGrossHours(todaySession);
                    todayHours = `${hoursWorked.toFixed(1)}h`;
                } else if (todaySession && todaySession.clockIn && !todaySession.clockOut) {
                    todayHours = 'In progress';
                } else {
                    todayHours = '0h';
                }

                const monthSessions = monthLogs.data?.sessions || [];
                const monthHours = monthLogs.data?.summary?.totalEffectiveHours
                    || monthSessions.reduce((sum, session) => sum + getGrossHours(session), 0);

                const daysPresent = monthLogs.data?.summary?.presentDays ?? monthSessions.filter(s => s.clockIn && s.clockOut).length;
                const avgDayHours = daysPresent > 0 ? monthHours / daysPresent : 0;
                const overtimeHours = Math.max(0, monthHours - daysPresent * 8);

                const workingDays = monthLogs.data?.summary?.workingDays || 22;
                const attendanceRate = workingDays > 0 ? Math.round((daysPresent / workingDays) * 100) : 0;

                let projects = [];
                try {
                    const projectsRes = await axios.get(`${BOTH_TASK_ENDPOINT}/get-my-projects`, {
                        withCredentials: true,
                    });
                    if (projectsRes.data?.projects) {
                        projects = projectsRes.data.projects.slice(0, 5);
                    } else if (Array.isArray(projectsRes.data)) {
                        projects = projectsRes.data.slice(0, 5);
                    }
                } catch {
                    /* optional */
                }

                setDashboardStats({
                    todayHours,
                    leaveBalance: `${leaveBalance} days`,
                    tasksCount: tasksCount.toString(),
                    currentMonthSalary: `₹${payrollAmount.toLocaleString('en-IN')}`,
                    leaveDaysRemaining: leaveBalance.toString(),
                    monthlyCapSummary,
                    birthdays,
                    projects,
                    monthHours,
                    attendanceRate,
                    daysPresent,
                    avgDayHours,
                    overtimeHours,
                });
            } catch {
                /* keep defaults */
            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardStats();
    }, [employee?.joiningDate, profile?.joiningDate, user?.joiningDate]);

    useEffect(() => {
        if (user?.mustResetPassword) {
            setShowResetPopup(true);
        }
    }, [user]);

    const shellClass = 'min-h-screen transition-all duration-300';
    const shellStyle = { backgroundColor: WS.bg };

    if (user?.mustResetPassword) {
        return (
            <div className={`${shellClass} p-4 sm:p-5`} style={shellStyle}>
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`${shellClass} flex items-center justify-center p-6`} style={shellStyle}>
                <div className="text-center">
                    <div
                        className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]"
                    />
                    <p className="text-sm text-slate-600">Loading dashboard…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${shellClass} flex items-center justify-center p-6`} style={shellStyle}>
                <div className="text-center">
                    <p className="mb-4 font-medium text-red-600">Error: {error}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-full bg-[#20C997] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ab589]"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className={`${shellClass} flex items-center justify-center p-6`} style={shellStyle}>
                <div className="text-center">
                    <p className="mb-4 font-medium text-slate-600">Please log in to access the dashboard</p>
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="rounded-full bg-[#20C997] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ab589]"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const kpiCard = (label, value, sub, icon) => (
        <div
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            style={{ borderColor: WS.border }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{statsLoading ? '…' : value}</p>
                    {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
                </div>
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'rgba(32, 201, 151, 0.12)', color: WS.mint }}
                >
                    {icon}
                </div>
            </div>
        </div>
    );

    const quickAction = (title, icon, onClick) => (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-4 text-center shadow-sm transition hover:border-[#20C997]/35 hover:shadow-md"
            style={{ borderColor: WS.border }}
        >
            <span className="text-[#20C997]" style={{ color: WS.mint }}>
                {icon}
            </span>
            <span className="text-xs font-semibold text-slate-700">{title}</span>
        </button>
    );

    return (
        <div className={`page-shell ${shellClass}`} style={shellStyle}>
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}

            <div className="page-shell-inner hrms-stack">
                <div className="hrms-main-rail">
                    {/* Main column */}
                    <div className="min-w-0 space-y-4 sm:space-y-6">
                        {/* Top bar */}
                        <header
                            className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-6"
                            style={{ borderColor: WS.border }}
                        >
                            <div className="flex min-w-0 items-center gap-4">
                                <ProfilePicture user={profile || user} size="lg" />
                                <div className="min-w-0">
                                    <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                                        Welcome back{displayName ? `, ${displayName}` : ''}!
                                    </h1>
                                    <p className="mt-0.5 text-sm text-slate-600">
                                        {[profile?.jobTitle || 'Employee', departmentLabel].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                                <Link
                                    to="/notifications"
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#20C997]/40 hover:text-[#20C997]"
                                    aria-label="Notifications"
                                >
                                    <HiOutlineBell className="h-5 w-5" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => navigate('/helpdesk')}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#20C997]/40 hover:text-[#20C997]"
                                    aria-label="Help"
                                >
                                    <HiOutlineQuestionMarkCircle className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEditProfile}
                                    className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#20C997]/40 sm:flex"
                                >
                                    <FaEdit className="h-3.5 w-3.5" />
                                    Profile
                                </button>
                            </div>
                        </header>

                        <AttendanceBox variant="dashboard" />

                        {/* KPI row */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {kpiCard(
                                'Days present',
                                statsLoading ? '…' : String(dashboardStats.daysPresent),
                                'This month',
                                <FaCheckCircle className="h-5 w-5" />
                            )}
                            {kpiCard(
                                dashboardStats.monthlyCapSummary ? LEAVE_UI.leaveThisMonth : LEAVE_UI.daysRemaining,
                                statsLoading
                                    ? '…'
                                    : dashboardStats.monthlyCapSummary
                                      ? `${dashboardStats.monthlyCapSummary.totalRemainingThisMonth} days`
                                      : `${dashboardStats.leaveDaysRemaining} days`,
                                dashboardStats.monthlyCapSummary
                                    ? `${dashboardStats.monthlyCapSummary.monthLabel || 'This month'} · ${LEAVE_UI.youCanTakeThisMonth.toLowerCase()}`
                                    : LEAVE_UI.totalBalance,
                                <FaCalendarAlt className="h-5 w-5" />
                            )}
                            {kpiCard(
                                'Pending tasks',
                                statsLoading ? '…' : dashboardStats.tasksCount,
                                'Assigned to you',
                                <FaTasks className="h-5 w-5" />
                            )}
                        </div>

                        {/* Quick actions */}
                        <div>
                            <h2 className="mb-3 text-sm font-semibold text-slate-800">Quick actions</h2>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {quickAction('Apply leave', <FaCalendarAlt className="h-6 w-6" />, () =>
                                    navigate('/employee/leave-attendance')
                                )}
                                {quickAction('Regularization', <FaClock className="h-6 w-6" />, () =>
                                    navigate('/my-attendance-regularization')
                                )}
                                {quickAction('View payslip', <FaFileAlt className="h-6 w-6" />, () => navigate('/employee-payroll'))}
                                {quickAction('Daily report', <FaChartBar className="h-6 w-6" />, () => navigate('/daily-report'))}
                            </div>
                        </div>

                        {/* Attendance summary */}
                        <section
                            className="rounded-2xl border bg-white p-5 shadow-sm md:p-6"
                            style={{ borderColor: WS.border }}
                        >
                            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                                <FaChartLine className="text-[#20C997]" />
                                Attendance summary
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {[
                                    {
                                        title: 'On-time score',
                                        val: statsLoading ? '…' : `${Math.min(100, dashboardStats.attendanceRate)}%`,
                                        hint: 'Vs expected hours',
                                    },
                                    {
                                        title: 'Avg. hours / day',
                                        val: statsLoading
                                            ? '…'
                                            : dashboardStats.daysPresent > 0
                                              ? `${dashboardStats.avgDayHours.toFixed(1)}h`
                                              : '—',
                                        hint: 'Days with completed punch',
                                    },
                                    {
                                        title: 'Overtime (est.)',
                                        val: statsLoading
                                            ? '…'
                                            : `${dashboardStats.overtimeHours.toFixed(1)}h`,
                                        hint: 'Beyond 8h × present days',
                                    },
                                ].map((cell) => (
                                    <div
                                        key={cell.title}
                                        className="rounded-xl border border-slate-100 bg-[#F8F9FB] p-4 text-center"
                                    >
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{cell.title}</p>
                                        <p className="mt-2 text-2xl font-bold text-[#006D4E]">{cell.val}</p>
                                        <p className="mt-1 text-xs text-slate-500">{cell.hint}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 border-t border-slate-100 pt-4">
                                <Link
                                    to="/employee/leave-attendance"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#20C997] transition hover:text-[#006D4E]"
                                >
                                    View detailed stats <FaArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </section>

                        {/* Projects + Tasks */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <section
                                className="rounded-2xl border bg-white shadow-sm"
                                style={{ borderColor: WS.border }}
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                        <FaProjectDiagram className="text-[#20C997]" />
                                        Projects
                                    </h3>
                                    <Link
                                        to="/employee/projects"
                                        className="text-xs font-semibold text-[#20C997] hover:text-[#006D4E]"
                                    >
                                        View all
                                    </Link>
                                </div>
                                <div className="p-5">
                                    {statsLoading ? (
                                        <div className="flex justify-center py-10">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
                                        </div>
                                    ) : dashboardStats.projects?.length > 0 ? (
                                        <ul className="space-y-3">
                                            {dashboardStats.projects.map((project) => (
                                                <li key={project._id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/employee/projects/${project._id}`)}
                                                        className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-[#20C997]/30 hover:bg-[#F8F9FB]"
                                                    >
                                                        <span className="font-medium text-slate-800">{project.name}</span>
                                                        <FaArrowRight className="float-right mt-1 h-3 w-3 text-slate-400" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8F9FB] py-10 text-center">
                                            <FaProjectDiagram className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                                            <p className="text-sm text-slate-500">No projects assigned yet</p>
                                            <Link to="/employee/projects">
                                                <span className="mt-3 inline-block rounded-full bg-[#20C997] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1ab589]">
                                                    View all projects
                                                </span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section
                                className="rounded-2xl border bg-white shadow-sm"
                                style={{ borderColor: WS.border }}
                            >
                                <div className="border-b border-slate-100 px-5 py-4">
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                        <FaTasks className="text-[#20C997]" />
                                        My tasks
                                    </h3>
                                </div>
                                <div className="p-5">
                                    <Todo variant="workspace" />
                                </div>
                            </section>
                        </div>

                        {/* Announcements */}
                        <section
                            className="rounded-2xl border bg-white shadow-sm"
                            style={{ borderColor: WS.border }}
                        >
                            <div
                                className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"
                                style={{ background: `linear-gradient(90deg, ${WS.forest} 0%, #0a5c45 100%)` }}
                            >
                                <FaBell className="text-white" />
                                <h3 className="text-base font-semibold text-white">Announcements</h3>
                            </div>
                            <div className="min-h-[160px] p-4">
                                <NotificationFeed />
                            </div>
                        </section>
                    </div>

                    {/* Right rail */}
                    <aside className="w-full min-w-0 space-y-5">
                        <div className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: WS.border }}>
                            <div
                                className="rounded-t-2xl px-5 py-3"
                                style={{ background: `linear-gradient(90deg, ${WS.mint} 0%, #17a67d 100%)` }}
                            >
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <FaBirthdayCake />
                                    Upcoming birthdays
                                </h3>
                            </div>
                            <div className="p-5">
                                {dashboardStats.birthdays == null ? (
                                    <div className="flex justify-center py-6">
                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
                                    </div>
                                ) : dashboardStats.birthdays.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-slate-500">No upcoming birthdays</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {dashboardStats.birthdays.map((item, idx) => (
                                            <li
                                                key={idx}
                                                className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-[#F8F9FB] p-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-800">{item.name}</p>
                                                    <p className="text-xs text-slate-500">{item.birthday}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="shrink-0 rounded-full bg-[#20C997] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1ab589] sm:px-3 sm:text-xs"
                                                >
                                                    Wishes
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <MiniCalendar
                            viewDate={calendarViewDate}
                            onPrevMonth={() => setCalendarViewDate((d) => subMonths(d, 1))}
                            onNextMonth={() => setCalendarViewDate((d) => addMonths(d, 1))}
                        />

                        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: WS.border }}>
                            <h3 className="text-sm font-semibold text-slate-900">Leave balance</h3>
                            {statsLoading ? (
                                <p className="mt-3 text-3xl font-bold text-[#006D4E]">…</p>
                            ) : dashboardStats.monthlyCapSummary ? (
                                <>
                                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                                        {dashboardStats.monthlyCapSummary.monthLabel || 'This month'}
                                    </p>
                                    {(dashboardStats.monthlyCapSummary.inProbation ||
                                        dashboardStats.monthlyCapSummary.types?.some((t) => t.probationAccrualActive)) && (
                                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                                            {dashboardStats.monthlyCapSummary.probationNote ||
                                                LEAVE_UI.probationBanner}
                                        </p>
                                    )}
                                    <ul className="mt-3 space-y-2.5">
                                        {dashboardStats.monthlyCapSummary.types.map((t) => {
                                            const takeable = getTakeableDaysThisMonth(t);
                                            const frozen =
                                                t.probationFrozenBalance != null
                                                    ? Number(t.probationFrozenBalance)
                                                    : null;
                                            return (
                                            <li
                                                key={t.leaveType}
                                                className="rounded-lg border border-slate-100 bg-[#F8F9FB] px-3 py-2 text-sm"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="font-medium text-slate-800">
                                                        {t.displayName}
                                                        {t.probationAccrualActive ? (
                                                            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                                                Probation
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span className="shrink-0 text-right text-slate-700">
                                                        <span className="font-semibold text-[#006D4E]">
                                                            {takeable}
                                                        </span>
                                                        <span className="text-slate-500"> {LEAVE_UI.youCanTakeThisMonth.toLowerCase()}</span>
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Earns {t.monthlyEntitlement ?? 0} day(s) per month
                                                    {t.probationAccrualActive ? (
                                                        <span className="text-amber-700"> (on probation)</span>
                                                    ) : null}
                                                    {frozen != null && frozen > 0 ? (
                                                        <> · {frozen} locked until confirmation</>
                                                    ) : null}
                                                </p>
                                                {t.probationNote ? (
                                                    <p className="mt-1 text-[11px] text-amber-800">{t.probationNote}</p>
                                                ) : null}
                                            </li>
                                            );
                                        })}
                                    </ul>
                                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                                        {hasNoCarryProbationLeave(dashboardStats.monthlyCapSummary.types)
                                            ? LEAVE_UI.noCarryFooter
                                            : LEAVE_UI.takeableFooter}
                                    </p>
                                    {hasNoCarryProbationLeave(dashboardStats.monthlyCapSummary.types) ? (
                                        <p className="mt-2 text-xs text-slate-500">
                                            {LEAVE_UI.lockedUntilConfirmation}:{' '}
                                            <span className="font-semibold text-slate-800">
                                                {dashboardStats.monthlyCapSummary.types.reduce(
                                                    (sum, t) => sum + (Number(t.probationFrozenBalance) || 0),
                                                    0
                                                )}
                                            </span>
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-xs text-slate-500">
                                            {LEAVE_UI.totalBalance}:{' '}
                                            <span className="font-semibold text-slate-800">
                                                {dashboardStats.leaveDaysRemaining}
                                            </span>
                                        </p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="mt-3 text-3xl font-bold text-[#006D4E]">
                                        {dashboardStats.leaveDaysRemaining}
                                    </p>
                                    <p className="text-xs text-slate-500">{LEAVE_UI.daysRemaining.toLowerCase()}</p>
                                </>
                            )}
                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/leave-attendance')}
                                    className="w-full rounded-full bg-[#20C997] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ab589]"
                                >
                                    <FaPlus className="mr-2 inline h-3 w-3" />
                                    Apply for leave
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/my-leave')}
                                    className="w-full rounded-full border-2 border-[#20C997] py-2.5 text-sm font-semibold text-[#20C997] transition hover:bg-[#20C997]/10"
                                >
                                    <FaEye className="mr-2 inline h-3 w-3" />
                                    View my leaves
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: WS.border }}>
                            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
                            <div className="mt-3 flex flex-col gap-2 text-sm">
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/policies')}
                                    className="text-left font-medium text-[#20C997] hover:text-[#006D4E]"
                                >
                                    Company policies
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/helpdesk')}
                                    className="text-left font-medium text-[#20C997] hover:text-[#006D4E]"
                                >
                                    Support desk
                                </button>
                            </div>
                        </div>

                        {/* Compact links: manager + HR */}
                        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: WS.border }}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shortcuts</p>
                            <div className="mt-3 grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/one-on-one')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#20C997]/30"
                                >
                                    <FaUserTie className="text-[#20C997]" /> One-on-one
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/benefits')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#20C997]/30"
                                >
                                    <FaGift className="text-[#20C997]" /> Benefits
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/documents-id')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#20C997]/30"
                                >
                                    <FaFolderOpen className="text-[#20C997]" /> Documents &amp; ID
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/learning')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#20C997]/30"
                                >
                                    <FaGraduationCap className="text-[#20C997]" /> Learning
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default DashboardEmployee;
