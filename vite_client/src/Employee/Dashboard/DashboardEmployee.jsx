import "../../styles/roleDashboards.css";
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import ProfileDropdown from '../../components/ProfileDropdown';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { logoutUser } from '../../context/Auth/authSlice';
import { clearEmployeeDetails } from '../../context/employeeDetailsSlice';
import { clearTimezoneContext } from '../../context/timezoneSlice';
import { resetAttendance } from '../../context/attendanceSlice';
import { clearPortals } from '../../context/Auth/authSlice';
import { persistor } from '../../context/store';
import { mergeSessionProfile, getProfileDisplayName } from '../../utils/profileUtils';
import { clearOrgAdminCredentials } from '../../utils/orgAdminCredentials';
import useHrmsPopupDismiss from '../../Hooks/useHrmsPopupDismiss';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

import {
    BOTH_ATTENDANCE_ENDPOINT,
    BOTH_TASK_ENDPOINT,
    BOTH_CELEBRATION_ENDPOINT,
    EMPLOYEE_LEAVE_ENDPOINT,
} from '../../utils/constant';
import {
    getTakeableDaysThisMonth,
    hasNoCarryProbationLeave,
    LEAVE_UI,
} from '../../constants/leaveConstants';

/** Workspace-style mint / forest palette (scoped to this dashboard) */
const WS = {
    bg: '#e8faf4',
    mint: '#0e9370',
    mintHover: '#0b7458',
    forest: '#00694f',
    card: '#FFFFFF',
    border: 'rgba(14, 43, 61, 0.08)',
};

function MiniCalendar({ viewDate, onPrevMonth, onNextMonth }) {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const pad = (getDay(monthStart) + 6) % 7;

    return (
        <div className="role-dashboard__card rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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
                                    ? 'bg-[#0E9370] font-semibold text-white'
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

const CELEBRATION_REACTIONS = ['❤️', '🎉', '👏', '🥳'];

function CelebrationRailCard({ item, isSelf, event, reacting, onReact, onWishes }) {
    const isToday = item.daysUntil === 0;
    const isMarriage = item.type === 'marriage_anniversary';
    const isWorkAnniversary = item.type === 'anniversary';

    const icon = isMarriage ? '💍' : isWorkAnniversary ? '🎉' : '🎂';
    const typeLabel = isMarriage ? 'Marriage Anniversary' : isWorkAnniversary ? 'Work Anniversary' : 'Birthday';
    const counts = event?.reactionCounts || {};
    const whenLabel = item.daysUntil === 0
        ? 'Today'
        : item.daysUntil === 1
            ? 'Tomorrow'
            : `in ${item.daysUntil} days`;

    const dateLabel = item.birthday || item.anniversaryDate || item.date || '';

    const selfHeader = isToday && isSelf ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
            {isMarriage ? 'Your marriage anniversary' : isWorkAnniversary ? 'Your work anniversary' : "It's your birthday"}
        </p>
    ) : null;

    return (
        <li
            className={`min-w-0 overflow-hidden rounded-xl border p-2.5 ${
                isToday
                    ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm'
                    : 'border-slate-100 bg-[#F8F9FB]'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    {selfHeader}
                    <p className="truncate text-sm font-semibold text-slate-800">
                        {icon} {isSelf ? 'You' : item.name}
                    </p>
                    <p className="break-words text-[11px] leading-snug text-slate-500">
                        {isMarriage && item.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {isWorkAnniversary && item.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {dateLabel ? `${dateLabel} · ` : ''}{typeLabel} · {whenLabel}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onWishes(item)}
                    className="inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#0E9370] px-3 text-xs font-semibold text-white hover:bg-[#0b7458]"
                >
                    {isToday ? (isSelf ? 'View' : 'Wishes') : 'Upcoming'}
                </button>
            </div>

            {isToday ? (
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {CELEBRATION_REACTIONS.map((emoji) => {
                        const count = counts[emoji] || 0;
                        return (
                            <button
                                key={emoji}
                                type="button"
                                disabled={reacting}
                                onClick={() => onReact(item, emoji)}
                                className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${
                                    count > 0 ? 'border-emerald-200' : 'border-slate-200'
                                }`}
                                aria-label={`React ${emoji}`}
                            >
                                <span>{emoji}</span>
                                {count > 0 ? (
                                    <span className="text-[10px] font-semibold text-slate-600">{count}</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </li>
    );
}

function AnniversaryRailCard({ item, isSelf, event, reacting, onReact, onWishes }) {
    const isTodayAnniversary = item.daysUntil === 0;
    const counts = event?.reactionCounts || {};
    const whenLabel = item.daysUntil === 0
        ? 'Today'
        : item.daysUntil === 1
            ? 'Tomorrow'
            : `in ${item.daysUntil} days`;

    return (
        <li
            className={`min-w-0 overflow-hidden rounded-2xl border p-3 sm:p-3.5 ${
                isTodayAnniversary
                    ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm'
                    : 'border-slate-100 bg-[#F8F9FB]'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    {isTodayAnniversary && isSelf ? (
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                            Your work anniversary
                        </p>
                    ) : null}
                    <p className="truncate font-semibold text-slate-800">
                        {isTodayAnniversary ? '🎉 ' : ''}
                        {isSelf ? 'You' : item.name}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                        {item.completedYears} {item.completedYears === 1 ? 'year' : 'years'} · {item.anniversaryDate} · {whenLabel}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onWishes(item)}
                    className="inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#0E9370] px-3 text-xs font-semibold text-white hover:bg-[#0b7458]"
                >
                    {isTodayAnniversary ? (isSelf ? 'View' : 'Wishes') : 'Upcoming'}
                </button>
            </div>

            {isTodayAnniversary ? (
                <div className="mt-3 flex flex-wrap gap-2.5">
                    {BIRTHDAY_REACTIONS.map((emoji) => {
                        const count = counts[emoji] || 0;
                        return (
                            <button
                                key={emoji}
                                type="button"
                                disabled={reacting}
                                onClick={() => onReact(item, emoji)}
                                className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${
                                    count > 0 ? 'border-emerald-200' : 'border-slate-200'
                                }`}
                                aria-label={`React ${emoji}`}
                            >
                                <span>{emoji}</span>
                                {count > 0 ? (
                                    <span className="text-xs font-semibold text-slate-600">{count}</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </li>
    );
}

function DashboardEmployee() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResetPopup, setShowResetPopup] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const profileDropdownRef = useRef(null);
    const [dashboardStats, setDashboardStats] = useState({
        todayHours: '0h',
        leaveBalance: '0 days',
        tasksCount: '0',
        currentMonthSalary: '₹0',
        leaveDaysRemaining: '0',
        monthlyCapSummary: null,
        birthdays: null,
        marriageAnniversaries: null,
        celebrations: null,
        anniversaries: null,
        projects: [],
        monthHours: 0,
        attendanceRate: 0,
        daysPresent: 0,
        avgDayHours: 0,
        overtimeHours: 0,
    });
    const [statsLoading, setStatsLoading] = useState(true);
    const [birthdayEvents, setBirthdayEvents] = useState({});
    const [birthdayReacting, setBirthdayReacting] = useState(false);
    const [anniversaryEvents, setAnniversaryEvents] = useState({});
    const [anniversaryReacting, setAnniversaryReacting] = useState(false);

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

    const closeProfileDropdown = useCallback(() => setProfileDropdownOpen(false), []);
    useHrmsPopupDismiss(closeProfileDropdown, profileDropdownOpen);

    const handleLogout = async () => {
        try {
            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            dispatch(clearTimezoneContext());
            dispatch(clearPortals());

            const email = user?.email || employee?.email;
            await dispatch(logoutUser(email)).unwrap();

            await persistor.purge();

            localStorage.removeItem('csrfToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('organizationId');
            localStorage.removeItem('userId');
            localStorage.removeItem('isOrganizationLogin');
            localStorage.removeItem('activePortal');
            localStorage.removeItem('availablePortals');
            localStorage.removeItem('employeeDashboardRoute');
            clearOrgAdminCredentials();
            setProfileDropdownOpen(false);
            setLogoutModalOpen(false);
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Logout failed. Please try again.');

            dispatch(resetAttendance());
            dispatch(clearEmployeeDetails());
            dispatch(clearTimezoneContext());
            dispatch(clearPortals());
            await persistor.purge();

            localStorage.removeItem('csrfToken');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('organizationId');
            localStorage.removeItem('userId');
            localStorage.removeItem('isOrganizationLogin');
            localStorage.removeItem('activePortal');
            localStorage.removeItem('availablePortals');
            localStorage.removeItem('employeeDashboardRoute');
            clearOrgAdminCredentials();
            setProfileDropdownOpen(false);
            setLogoutModalOpen(false);
            navigate('/login');
        }
    };

    const handleEditProfile = () => navigate('/profile-details');
    const selfEmployeeId = String(employee?._id || profile?._id || '');

    const getCelebrationItemKey = (item) => `${item.type || 'birthday'}_${item.employeeId}`;

    const loadTodayBirthdayEvent = async (item) => {
        const { data } = await axios.post(
            `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
            { employeeId: item.employeeId, type: item.type || 'birthday' },
            { withCredentials: true }
        );
        const event = data?.data;
        if (event?._id) {
            const itemKey = getCelebrationItemKey(item);
            setBirthdayEvents((prev) => ({
                ...prev,
                [itemKey]: event,
            }));
        }
        return event;
    };

    const handleOpenBirthdayWishes = async (item) => {
        if (!item?.employeeId) return;
        if (item.daysUntil !== 0) {
            const label = item.type === 'marriage_anniversary' ? 'marriage anniversary' : 'birthday';
            toast.info(`Wishes and reactions open on their ${label}.`);
            return;
        }
        try {
            const itemKey = getCelebrationItemKey(item);
            const event = birthdayEvents[itemKey] || await loadTodayBirthdayEvent(item);
            const eventId = event?._id;
            navigate(eventId ? `/celebrations/${eventId}` : '/celebrations');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not open wishes');
        }
    };

    const handleBirthdayReact = async (item, emoji) => {
        if (item.daysUntil !== 0) return;
        setBirthdayReacting(true);
        try {
            const itemKey = getCelebrationItemKey(item);
            const opened = birthdayEvents[itemKey] || await loadTodayBirthdayEvent(item);
            if (!opened?._id) return;
            const { data } = await axios.post(
                `${BOTH_CELEBRATION_ENDPOINT}/events/${opened._id}/react`,
                { emoji },
                { withCredentials: true }
            );
            const eventStateKey = (data?.data?.type && data?.data?.employeeId)
                ? `${data.data.type}_${data.data.employeeId}`
                : itemKey;

            setBirthdayEvents((prev) => ({
                ...prev,
                [eventStateKey]: {
                    ...opened,
                    ...(prev[eventStateKey] || {}),
                    reactions: data?.data?.reactions || [],
                    reactionCounts: data?.data?.reactionCounts || {},
                },
            }));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not add reaction');
        } finally {
            setBirthdayReacting(false);
        }
    };

    const loadTodayAnniversaryEvent = async (item) => {
        const { data } = await axios.post(
            `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
            { employeeId: item.employeeId, type: 'anniversary' },
            { withCredentials: true }
        );
        const event = data?.data;
        if (event?._id) {
            setAnniversaryEvents((prev) => ({ ...prev, [String(item.employeeId)]: event }));
        }
        return event;
    };

    const handleOpenAnniversaryWishes = async (item) => {
        if (!item?.employeeId) return;
        if (item.daysUntil !== 0) {
            toast.info('Wishes and reactions open on their work anniversary.');
            return;
        }
        try {
            const event = anniversaryEvents[String(item.employeeId)] || await loadTodayAnniversaryEvent(item);
            const eventId = event?._id;
            navigate(eventId ? `/celebrations/${eventId}` : '/celebrations');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not open anniversary wishes');
        }
    };

    const handleAnniversaryReact = async (item, emoji) => {
        if (item.daysUntil !== 0) return;
        setAnniversaryReacting(true);
        try {
            const opened = anniversaryEvents[String(item.employeeId)] || await loadTodayAnniversaryEvent(item);
            if (!opened?._id) return;
            const { data } = await axios.post(
                `${BOTH_CELEBRATION_ENDPOINT}/events/${opened._id}/react`,
                { emoji },
                { withCredentials: true }
            );
            setAnniversaryEvents((prev) => ({
                ...prev,
                [String(item.employeeId)]: {
                    ...opened,
                    ...(prev[String(item.employeeId)] || {}),
                    reactionCounts: data?.data?.reactionCounts || {},
                    reactions: data?.data?.reactions || [],
                },
            }));
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not add reaction');
        } finally {
            setAnniversaryReacting(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (hasFetched) {
                return;
            }

            try {
                setLoading(true);
                setError('');
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

                let celebrations = null;
                let birthdays = [];
                let marriageAnniversaries = [];
                try {
                    const birthdaysRes = await axios.get('/v1/both/profile-details/upcoming-birthdays', {
                        withCredentials: true,
                    });
                    birthdays = birthdaysRes.data?.birthdays || [];
                    marriageAnniversaries = birthdaysRes.data?.marriageAnniversaries || [];
                    celebrations = birthdaysRes.data?.celebrations || [
                        ...birthdays.map((item) => ({ ...item, type: item.type || 'birthday' })),
                        ...marriageAnniversaries.map((item) => ({ ...item, type: 'marriage_anniversary' })),
                    ];
                    celebrations.sort((a, b) => {
                        const aDays = Number.isFinite(Number(a.daysUntil)) ? Number(a.daysUntil) : 9999;
                        const bDays = Number.isFinite(Number(b.daysUntil)) ? Number(b.daysUntil) : 9999;
                        if (aDays !== bDays) return aDays - bDays;
                        const order = { birthday: 1, marriage_anniversary: 2, anniversary: 3 };
                        return (order[a.type] || 99) - (order[b.type] || 99);
                    });
                } catch {
                    /* optional */
                    celebrations = [];
                }

                let anniversaries = [];
                try {
                    const anniversariesRes = await axios.get('/v1/both/profile-details/upcoming-anniversaries', {
                        withCredentials: true,
                    });
                    if (anniversariesRes.data?.anniversaries) {
                        anniversaries = anniversariesRes.data.anniversaries;
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
                    marriageAnniversaries,
                    celebrations,
                    anniversaries,
                    projects,
                    monthHours,
                    attendanceRate,
                    daysPresent,
                    avgDayHours,
                    overtimeHours,
                });

                const todayCelebrations = (celebrations || []).filter((item) => item.daysUntil === 0 && item.employeeId);
                if (todayCelebrations.length > 0) {
                    const opened = await Promise.all(todayCelebrations.map(async (item) => {
                        try {
                            const { data } = await axios.post(
                                `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
                                { employeeId: item.employeeId, type: item.type || 'birthday' },
                                { withCredentials: true }
                            );
                            const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                            return data?.data?._id ? [itemKey, data.data] : null;
                        } catch {
                            return null;
                        }
                    }));
                    const nextEvents = {};
                    opened.filter(Boolean).forEach(([key, event]) => {
                        nextEvents[key] = event;
                    });
                    setBirthdayEvents(nextEvents);
                }

                const todayAnniversaries = (anniversaries || []).filter((item) => item.daysUntil === 0 && item.employeeId);
                if (todayAnniversaries.length > 0) {
                    const openedAnniv = await Promise.all(todayAnniversaries.map(async (item) => {
                        try {
                            const { data } = await axios.post(
                                `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
                                { employeeId: item.employeeId, type: 'anniversary' },
                                { withCredentials: true }
                            );
                            return data?.data?._id ? [String(item.employeeId), data.data] : null;
                        } catch {
                            return null;
                        }
                    }));
                    const nextAnnivEvents = {};
                    openedAnniv.filter(Boolean).forEach(([id, event]) => {
                        nextAnnivEvents[id] = event;
                    });
                    setAnniversaryEvents(nextAnnivEvents);
                }
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

    const shellClass = 'role-dashboard role-dashboard--employee min-h-full transition-all duration-300';
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
                        className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]"
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
                        onClick={() => {
                            setError('');
                            setHasFetched(false);
                            setLoading(true);
                        }}
                        className="rounded-full bg-[#0E9370] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b7458]"
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
                        className="rounded-full bg-[#0E9370] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b7458]"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    const kpiCard = (label, value, sub, icon) => (
        <div
            className="role-dashboard__card rounded-2xl border bg-white p-3 shadow-sm transition hover:shadow-md sm:p-5"
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
                    style={{ backgroundColor: 'rgba(14, 147, 112, 0.10)', color: WS.mint }}
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
            className="role-dashboard__quick-action flex flex-col items-center justify-center gap-2 border bg-white text-center transition hover:border-[#0E9370]/35"
            style={{ borderColor: WS.border }}
        >
            <span className="text-[#0E9370]" style={{ color: WS.mint }}>
                {icon}
            </span>
            <span className="text-xs font-semibold text-slate-700">{title}</span>
        </button>
    );

    return (
        <div className={`page-shell ${shellClass}`} style={shellStyle}>
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}

            <div className="page-shell-inner role-dashboard__stack">
                <div className="hrms-main-rail role-dashboard__layout">
                    {/* Main column */}
                    <div className="min-w-0 role-dashboard__stack">
                        {/* Top bar */}
                        <header
                            className="role-dashboard__header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                            style={{ borderColor: WS.border }}
                        >
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="relative shrink-0" ref={profileDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                        className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[#0E9370] focus:ring-offset-2"
                                        aria-label="Profile menu"
                                        aria-expanded={profileDropdownOpen}
                                        data-hrms-popup-trigger
                                    >
                                        <ProfilePicture user={user} size="lg" />
                                    </button>
                                    <ProfileDropdown
                                        isOpen={profileDropdownOpen}
                                        onClose={() => setProfileDropdownOpen(false)}
                                        username={displayName}
                                        onLogout={() => setLogoutModalOpen(true)}
                                        onViewProfile={() => navigate('/profile-details')}
                                        position="right"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl md:text-2xl">
                                        Welcome back{displayName ? `, ${displayName}` : ''}!
                                    </h1>
                                    <p className="mt-0.5 text-sm text-slate-600 hidden sm:block">
                                        {[profile?.jobTitle || 'Employee', departmentLabel].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                                <Link
                                    to="/notifications"
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#0E9370]/40 hover:text-[#0E9370]"
                                    aria-label="Notifications"
                                >
                                    <HiOutlineBell className="h-5 w-5" />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => navigate('/helpdesk')}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#0E9370]/40 hover:text-[#0E9370]"
                                    aria-label="Help"
                                >
                                    <HiOutlineQuestionMarkCircle className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEditProfile}
                                    className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0E9370]/40 sm:flex"
                                >
                                    <FaEdit className="h-3.5 w-3.5" />
                                    Profile
                                </button>
                            </div>
                        </header>

                        <AttendanceBox variant="dashboard" />

                        {/* Mobile only: celebrations directly under punch-in */}
                        <div className="rounded-xl border bg-white shadow-sm lg:hidden" style={{ borderColor: WS.border }}>
                            <div
                                className="rounded-t-xl px-3 py-2"
                                style={{ background: `linear-gradient(90deg, ${WS.mint} 0%, #17a67d 100%)` }}
                            >
                                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <FaBirthdayCake className="h-3 w-3" />
                                    Upcoming celebrations
                                </h3>
                            </div>
                            <div className="p-3">
                                {dashboardStats.celebrations == null ? (
                                    <div className="flex justify-center py-4">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370]" />
                                    </div>
                                ) : dashboardStats.celebrations.length === 0 ? (
                                    <p className="py-2 text-center text-xs text-slate-500">No upcoming celebrations</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {dashboardStats.celebrations.slice(0, 3).map((item, idx) => {
                                            const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                                            return (
                                                <CelebrationRailCard
                                                    key={`mobile-${item.type || 'birthday'}-${item.employeeId || idx}`}
                                                    item={item}
                                                    isSelf={Boolean(selfEmployeeId) && String(item.employeeId) === selfEmployeeId}
                                                    event={birthdayEvents[itemKey]}
                                                    reacting={birthdayReacting}
                                                    onReact={handleBirthdayReact}
                                                    onWishes={handleOpenBirthdayWishes}
                                                />
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* KPI row */}
                        <div className="role-dashboard__kpis grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                            className="role-dashboard__card rounded-2xl border bg-white p-3 shadow-sm sm:p-5 md:p-6"
                            style={{ borderColor: WS.border }}
                        >
                            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 sm:mb-4">
                                <FaChartLine className="text-[#0E9370]" />
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
                                        <p className="mt-2 text-2xl font-bold text-[#00694F]">{cell.val}</p>
                                        <p className="mt-1 text-xs text-slate-500">{cell.hint}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 border-t border-slate-100 pt-4">
                                <Link
                                    to="/employee/leave-attendance"
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E9370] transition hover:text-[#00694F]"
                                >
                                    View detailed stats <FaArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </section>

                        {/* Projects + Tasks */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <section
                                className="role-dashboard__card role-dashboard__card--flush rounded-2xl border bg-white shadow-sm"
                                style={{ borderColor: WS.border }}
                            >
                                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                        <FaProjectDiagram className="text-[#0E9370]" />
                                        Projects
                                    </h3>
                                    <Link
                                        to="/employee/projects"
                                        className="text-xs font-semibold text-[#0E9370] hover:text-[#00694F]"
                                    >
                                        View all
                                    </Link>
                                </div>
                                <div className="p-3 sm:p-5">
                                    {statsLoading ? (
                                        <div className="flex justify-center py-10">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370]" />
                                        </div>
                                    ) : dashboardStats.projects?.length > 0 ? (
                                        <ul className="space-y-3">
                                            {dashboardStats.projects.map((project) => (
                                                <li key={project._id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/employee/projects/${project._id}`)}
                                                        className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-[#0E9370]/30 hover:bg-[#F8F9FB]"
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
                                                <span className="mt-3 inline-block rounded-full bg-[#0E9370] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0b7458]">
                                                    View all projects
                                                </span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section
                                className="role-dashboard__card role-dashboard__card--flush rounded-2xl border bg-white shadow-sm"
                                style={{ borderColor: WS.border }}
                            >
                                <div className="border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
                                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                        <FaTasks className="text-[#0E9370]" />
                                        My tasks
                                    </h3>
                                </div>
                                <div className="p-3 sm:p-5">
                                    <Todo variant="workspace" />
                                </div>
                            </section>
                        </div>

                        {/* Announcements */}
                        <section
                            className="role-dashboard__card role-dashboard__card--flush rounded-2xl border bg-white shadow-sm"
                            style={{ borderColor: WS.border }}
                        >
                            <div
                                className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4"
                                style={{ background: `linear-gradient(90deg, ${WS.forest} 0%, #0a5c45 100%)` }}
                            >
                                <FaBell className="text-white" />
                                <h3 className="text-base font-semibold text-white">Announcements</h3>
                            </div>
                            <div className="min-h-[140px] p-3 sm:min-h-[160px] sm:p-4">
                                <NotificationFeed />
                            </div>
                        </section>
                    </div>

                    {/* Right rail — celebrations first so they stay above the fold */}
                    <aside className="w-full min-w-0 role-dashboard__stack lg:self-start">
                        <div className="hidden rounded-xl border bg-white shadow-sm lg:block" style={{ borderColor: WS.border }}>
                            <div
                                className="rounded-t-xl px-3 py-2"
                                style={{ background: `linear-gradient(90deg, ${WS.mint} 0%, #17a67d 100%)` }}
                            >
                                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <FaBirthdayCake className="h-3 w-3" />
                                    Upcoming celebrations
                                </h3>
                            </div>
                            <div className="p-3">
                                {dashboardStats.celebrations == null ? (
                                    <div className="flex justify-center py-4">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370]" />
                                    </div>
                                ) : dashboardStats.celebrations.length === 0 ? (
                                    <p className="py-2 text-center text-xs text-slate-500">No upcoming celebrations</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {dashboardStats.celebrations.slice(0, 3).map((item, idx) => {
                                            const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                                            return (
                                                <CelebrationRailCard
                                                    key={`${item.type || 'birthday'}-${item.employeeId || idx}`}
                                                    item={item}
                                                    isSelf={Boolean(selfEmployeeId) && String(item.employeeId) === selfEmployeeId}
                                                    event={birthdayEvents[itemKey]}
                                                    reacting={birthdayReacting}
                                                    onReact={handleBirthdayReact}
                                                    onWishes={handleOpenBirthdayWishes}
                                                />
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {dashboardStats.anniversaries && dashboardStats.anniversaries.length > 0 ? (
                            <div className="role-dashboard__card role-dashboard__card--flush rounded-2xl border bg-white shadow-sm" style={{ borderColor: WS.border }}>
                                <div
                                    className="rounded-t-2xl px-3 py-2 sm:px-5 sm:py-3"
                                    style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' }}
                                >
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                                        <FaGift />
                                        Work anniversaries
                                    </h3>
                                </div>
                                <div className="p-3 sm:p-5">
                                    <ul className="space-y-2 sm:space-y-3">
                                        {dashboardStats.anniversaries.map((item, idx) => (
                                            <AnniversaryRailCard
                                                key={item.employeeId || idx}
                                                item={item}
                                                isSelf={Boolean(selfEmployeeId) && String(item.employeeId) === selfEmployeeId}
                                                event={anniversaryEvents[String(item.employeeId)]}
                                                reacting={anniversaryReacting}
                                                onReact={handleAnniversaryReact}
                                                onWishes={handleOpenAnniversaryWishes}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : null}

                        <MiniCalendar
                            viewDate={calendarViewDate}
                            onPrevMonth={() => setCalendarViewDate((d) => subMonths(d, 1))}
                            onNextMonth={() => setCalendarViewDate((d) => addMonths(d, 1))}
                        />

                        <div className="role-dashboard__card rounded-2xl border bg-white p-3 shadow-sm sm:p-5" style={{ borderColor: WS.border }}>
                            <h3 className="text-sm font-semibold text-slate-900">Leave balance</h3>
                            {statsLoading ? (
                                <p className="mt-3 text-3xl font-bold text-[#00694F]">…</p>
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
                                                        <span className="font-semibold text-[#00694F]">
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
                                    <p className="mt-3 text-3xl font-bold text-[#00694F]">
                                        {dashboardStats.leaveDaysRemaining}
                                    </p>
                                    <p className="text-xs text-slate-500">{LEAVE_UI.daysRemaining.toLowerCase()}</p>
                                </>
                            )}
                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/leave-attendance')}
                                    className="w-full rounded-full bg-[#0E9370] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b7458]"
                                >
                                    <FaPlus className="mr-2 inline h-3 w-3" />
                                    Apply for leave
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/my-leave')}
                                    className="w-full rounded-full border-2 border-[#0E9370] py-2.5 text-sm font-semibold text-[#0E9370] transition hover:bg-[#0E9370]/10"
                                >
                                    <FaEye className="mr-2 inline h-3 w-3" />
                                    View my leaves
                                </button>
                            </div>
                        </div>

                        <div className="role-dashboard__card rounded-2xl border bg-white p-3 shadow-sm sm:p-5" style={{ borderColor: WS.border }}>
                            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
                            <div className="mt-3 flex flex-col gap-2 text-sm">
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/policies')}
                                    className="text-left font-medium text-[#0E9370] hover:text-[#00694F]"
                                >
                                    Company policies
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/helpdesk')}
                                    className="text-left font-medium text-[#0E9370] hover:text-[#00694F]"
                                >
                                    Support desk
                                </button>
                            </div>
                        </div>

                        {/* Compact links: manager + HR */}
                        <div className="role-dashboard__card rounded-2xl border bg-white p-3 shadow-sm sm:p-5" style={{ borderColor: WS.border }}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shortcuts</p>
                            <div className="mt-3 grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/1-on-1')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#0E9370]/30"
                                >
                                    <FaUserTie className="text-[#0E9370]" /> 1:1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/benefits')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#0E9370]/30"
                                >
                                    <FaGift className="text-[#0E9370]" /> Benefits
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/employee/documents-id')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#0E9370]/30"
                                >
                                    <FaFolderOpen className="text-[#0E9370]" /> Documents &amp; ID
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/learning')}
                                    className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-[#0E9370]/30"
                                >
                                    <FaGraduationCap className="text-[#0E9370]" /> Learning
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            <Transition appear show={logoutModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[11000]" onClose={() => setLogoutModalOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-25" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-medium leading-6 text-gray-900"
                                    >
                                        Confirm Logout
                                    </Dialog.Title>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            Are you sure you want to logout?
                                        </p>
                                    </div>
                                    <div className="mt-4 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E9370] focus:ring-offset-2"
                                            onClick={() => {
                                                setLogoutModalOpen(false);
                                                setProfileDropdownOpen(false);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-md border border-transparent bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                            onClick={handleLogout}
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
}

export default DashboardEmployee;
