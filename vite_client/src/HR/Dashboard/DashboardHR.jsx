import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    FiActivity,
    FiArrowUpRight,
    FiBook,
    FiBriefcase,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiGift,
    FiGrid,
    FiPlus,
    FiSettings,
    FiMoreHorizontal,
    FiSearch,
    FiTrendingDown,
    FiTrendingUp,
    FiUserPlus,
    FiUsers,
} from 'react-icons/fi';
import { HiOutlineBell, HiOutlineQuestionMarkCircle } from 'react-icons/hi2';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS, hasAnyPermission } from '../../utils/permissions';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { addDays, format, startOfMonth, subMonths } from 'date-fns';
import PasswordResetPopup from '../../Employee/PasswordResetPopup';
import ProfilePicture from '../../Shared/ProfilePicture';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { fetchOrganizationTimezone } from '../../context/timezoneSlice';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { useEmployees, useLeaves } from '../../Hooks/useDashboardData';
import { handleApiError } from '../../utils/errorHandler';
import { BOTH_ATTENDANCE_ENDPOINT, BOTH_CELEBRATION_ENDPOINT } from '../../utils/constant';
import AttendanceBox from '../../Employee/Attendance/AttendanceBox';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import PersonalDashboardKpiRow from '../../components/PersonalDashboardKpiRow';
import LeaveBalanceCard from '../../components/LeaveBalanceCard';
import NotificationSender from '../../Admin/NotificationSender';


const CELEBRATION_REACTIONS = ['❤️', '🎉', '👏', '🥳'];

const sortCelebrations = (items = []) => {
    const order = { birthday: 1, marriage_anniversary: 2, anniversary: 3 };
    return [...items].sort((a, b) => {
        const aDays = Number.isFinite(Number(a?.daysUntil)) ? Number(a.daysUntil) : 9999;
        const bDays = Number.isFinite(Number(b?.daysUntil)) ? Number(b.daysUntil) : 9999;
        if (aDays !== bDays) return aDays - bDays;
        return (order[a?.type] || 99) - (order[b?.type] || 99);
    });
};

function CelebrationDashboardCard({ item, isSelf = false, event, reacting = false, onReact, onWishes }) {
    const isToday = item?.daysUntil === 0;
    const isMarriage = item?.type === 'marriage_anniversary';
    const isWorkAnniversary = item?.type === 'anniversary';
    const icon = isMarriage ? '💍' : isWorkAnniversary ? '🎉' : '🎂';
    const typeLabel = isMarriage ? 'Marriage Anniversary' : isWorkAnniversary ? 'Work Anniversary' : 'Birthday';
    const dateLabel = item?.birthday || item?.anniversaryDate || item?.date || '';
    const whenLabel = item?.daysUntil === 0 ? 'Today' : item?.daysUntil === 1 ? 'Tomorrow' : `in ${item?.daysUntil} days`;
    const counts = event?.reactionCounts || {};
    const header = isSelf
        ? isMarriage ? 'YOUR MARRIAGE ANNIVERSARY' : isWorkAnniversary ? 'YOUR WORK ANNIVERSARY' : "IT'S YOUR BIRTHDAY"
        : isMarriage ? 'MARRIAGE ANNIVERSARY' : isWorkAnniversary ? 'WORK ANNIVERSARY' : 'BIRTHDAY';

    return (
        <li className={`relative min-w-0 overflow-hidden rounded-xl border p-2.5 ${isToday ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm' : 'border-slate-100 bg-[#F8F9FB]'}`}>
            <div className="flex items-start gap-2">
                <div className="min-w-0 pr-20">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">{header}</p>
                    <p className="truncate text-sm font-semibold text-slate-800">{icon} {isSelf ? 'You' : item?.name || 'Team member'}</p>
                    <p className="text-[11px] leading-snug text-slate-500">
                        {(isMarriage || isWorkAnniversary) && item?.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {dateLabel ? `${dateLabel} · ` : ''}{typeLabel} · {whenLabel}
                    </p>
                </div>
                {onWishes ? (
                    <button type="button" onClick={() => onWishes(item)} className="absolute right-2 top-2 shrink-0 whitespace-nowrap rounded-full bg-[#20C997] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#1ab589]">
                        {isToday ? 'Wishes' : 'Upcoming'}
                    </button>
                ) : null}
            </div>
            {isToday && onReact ? (
                <div className="mt-2 flex flex-wrap gap-1">
                    {CELEBRATION_REACTIONS.map((emoji) => {
                        const count = counts[emoji] || 0;
                        return (
                            <button key={emoji} type="button" disabled={reacting} onClick={() => onReact(item, emoji)} className={`inline-flex items-center gap-0.5 rounded-full border bg-white px-1.5 py-0.5 text-xs shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${count > 0 ? 'border-emerald-200' : 'border-slate-200'}`} aria-label={`React ${emoji}`}>
                                <span>{emoji}</span>
                                {count > 0 ? <span className="text-[10px] font-semibold text-slate-600">{count}</span> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </li>
    );
}

const WS = {
    bg: '#F5F7FB',
    card: '#FFFFFF',
    border: 'rgba(148, 163, 184, 0.24)',
    mint: '#20C997',
    mintDark: '#0F9F7A',
    forest: '#0B6B53',
    peach: '#FF9B71',
    teal: '#5BC0BE',
    amber: '#F6C453',
    text: '#0F172A',
    muted: '#64748B',
};

const DEPARTMENT_COLOR_MAP = {
    Engineering: '#26C991',
    Sales: '#149E77',
    Design: '#FF9F71',
    Others: '#66C2C2',
};

const DEPARTMENT_COLOR_FALLBACKS = ['#26C991', '#149E77', '#FF9F71', '#66C2C2'];

const DEPARTMENT_LEGEND_ORDER = ['Engineering', 'Sales', 'Design', 'Others'];

const HEADCOUNT_CHART = {
    title: '#111827',
    total: '#111827',
    totalLabel: '#94A3B8',
    legendLabel: '#334155',
    legendValue: '#111827',
};

const sortDepartmentsForLegend = (rows) =>
    [...rows].sort((a, b) => {
        const aIndex = DEPARTMENT_LEGEND_ORDER.indexOf(a.name);
        const bIndex = DEPARTMENT_LEGEND_ORDER.indexOf(b.name);
        const aOrder = aIndex === -1 ? DEPARTMENT_LEGEND_ORDER.length : aIndex;
        const bOrder = bIndex === -1 ? DEPARTMENT_LEGEND_ORDER.length : bIndex;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return b.count - a.count;
    });

const getDepartmentColor = (name, index) =>
    DEPARTMENT_COLOR_MAP[name] || DEPARTMENT_COLOR_FALLBACKS[index % DEPARTMENT_COLOR_FALLBACKS.length];

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');

const normalizeText = (value = '') => String(value).trim().toLowerCase();

const getEmployeeName = (employee) =>
    [employee?.name, employee?.lastName].filter(Boolean).join(' ') || employee?.email || 'Employee';

const formatShortDate = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMonthRange = (date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
    return { monthStart, monthEnd };
};

const extractEmployeePage = (body) => {
    const list = body?.data || body?.employees || [];
    const pagination = body?.pagination || {};
    const total = Number(pagination.total ?? body?.total ?? list.length ?? 0);
    const pages = Number(pagination.pages ?? (total > 0 ? Math.ceil(total / 100) : 1));

    return {
        list: Array.isArray(list) ? list : [],
        total: Number.isFinite(total) ? total : 0,
        pages: Number.isFinite(pages) && pages > 0 ? pages : 1,
    };
};

const buildMonthlyHiringAttrition = (employees) => {
    const normalized = Array.isArray(employees) ? employees : [];

    return Array.from({ length: 5 }, (_, index) => {
        const baseDate = subMonths(startOfMonth(new Date()), 4 - index);
        const { monthStart, monthEnd } = getMonthRange(baseDate);

        const hiring = normalized.filter((employee) => {
            const joiningDate = employee?.joiningDate ? new Date(employee.joiningDate) : null;
            return joiningDate && !Number.isNaN(joiningDate.getTime()) && joiningDate >= monthStart && joiningDate <= monthEnd;
        }).length;

        const attrition = normalized.filter((employee) => {
            const terminationDate = employee?.terminationDate ? new Date(employee.terminationDate) : null;
            return (
                terminationDate &&
                !Number.isNaN(terminationDate.getTime()) &&
                terminationDate >= monthStart &&
                terminationDate <= monthEnd
            );
        }).length;

        return {
            month: format(baseDate, 'MMM').toUpperCase(),
            hiring,
            attrition,
        };
    });
};

const buildAttendanceTrend = (dailyTrend) => {
    const weekdayMap = [
        { key: 'MON', dayIndex: 1 },
        { key: 'TUE', dayIndex: 2 },
        { key: 'WED', dayIndex: 3 },
        { key: 'THU', dayIndex: 4 },
        { key: 'FRI', dayIndex: 5 },
    ];

    const accumulator = weekdayMap.reduce((map, item) => {
        map[item.dayIndex] = { totalPct: 0, count: 0 };
        return map;
    }, {});

    (dailyTrend || []).forEach((dayData) => {
        const dateKey = dayData?.dateKey;
        if (!dateKey) return;

        const date = new Date(`${dateKey}T12:00:00`);
        if (Number.isNaN(date.getTime())) return;

        const dayIndex = date.getDay();
        if (!accumulator[dayIndex]) return;

        accumulator[dayIndex].totalPct += Number(dayData?.pct || 0);
        accumulator[dayIndex].count += 1;
    });

    return weekdayMap.map((item) => {
        const bucket = accumulator[item.dayIndex];
        const pct = bucket.count > 0 ? bucket.totalPct / bucket.count : 0;
        return {
            day: item.key,
            pct: Number(pct.toFixed(1)),
        };
    });
};

const buildDepartmentData = (employees) => {
    const departmentMap = new Map();

    (employees || []).forEach((employee) => {
        if (normalizeText(employee?.status) === 'terminated') return;

        const department = employee?.department || 'Others';
        departmentMap.set(department, (departmentMap.get(department) || 0) + 1);
    });

    const rows = [...departmentMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    if (rows.length <= 4) {
        return rows.map((row, index) => ({
            ...row,
            color: getDepartmentColor(row.name, index),
        }));
    }

    const topRows = rows.slice(0, 3);
    const remainingCount = rows.slice(3).reduce((sum, row) => sum + row.count, 0);

    return [...topRows, { name: 'Others', count: remainingCount }].map((row, index) => ({
        ...row,
        color: getDepartmentColor(row.name, index),
    }));
};

const buildApprovalSummary = (approvals) => {
    const counts = {
        leave: 0,
        regularization: 0,
        expense: 0,
        onboarding: 0,
    };

    (approvals || []).forEach((approval) => {
        const entityType = normalizeText(approval?.entityType);

        if (entityType.includes('leave')) {
            counts.leave += 1;
        } else if (entityType.includes('regular')) {
            counts.regularization += 1;
        } else if (entityType.includes('expense')) {
            counts.expense += 1;
        } else if (entityType.includes('onboard')) {
            counts.onboarding += 1;
        }
    });

    return [
        { label: 'Leaves', value: counts.leave, accent: 'text-emerald-700' },
        { label: 'Regular.', value: counts.regularization, accent: 'text-cyan-700' },
        { label: 'Expenses', value: counts.expense, accent: 'text-orange-700' },
        { label: 'Onboarding', value: counts.onboarding, accent: 'text-violet-700' },
    ];
};

const buildUpcomingEvents = (birthdays, approvals) => {
    const birthdayEvents = [...(birthdays || [])]
        .sort((a, b) => {
            const aDays = Number.isFinite(Number(a?.daysUntil)) ? Number(a.daysUntil) : 9999;
            const bDays = Number.isFinite(Number(b?.daysUntil)) ? Number(b.daysUntil) : 9999;
            if (aDays !== bDays) return aDays - bDays;
            const order = { birthday: 1, marriage_anniversary: 2, anniversary: 3 };
            return (order[a?.type] || 99) - (order[b?.type] || 99);
        })
        .slice(0, 2)
        .map((item, index) => {
        const isMarriage = item?.type === 'marriage_anniversary';
        return {
            id: `celebration-${item?.employeeId || index}-${item?.type || 'bday'}`,
            title: isMarriage ? `💍 ${item?.name || 'Team member'}` : `🎂 ${item?.name || 'Team member'}`,
            subtitle: isMarriage ? 'Marriage Anniversary' : 'Birthday',
            dateLabel: item?.anniversaryDate || item?.birthday || item?.date || 'Upcoming',
            tone: 'birthday',
        };
    });

    const approvalEvents = (approvals || [])
        .filter((approval) => approval?.currentPendingStep?.dueDate)
        .sort((a, b) => new Date(a.currentPendingStep.dueDate) - new Date(b.currentPendingStep.dueDate))
        .slice(0, 1)
        .map((approval) => ({
            id: approval?._id || `approval-${approval?.entityType}`,
            title: `${approval?.entityType || 'Approval'} Request`,
            subtitle: approval?.requestedBy?.name ? `Requested by ${approval.requestedBy.name}` : 'Pending approval',
            dateLabel: formatShortDate(approval?.currentPendingStep?.dueDate),
            tone: 'approval',
        }));

    const fallbackEvents = [
        {
            id: 'review-cycle',
            title: 'Monthly review sync',
            subtitle: 'Leadership calendar',
            dateLabel: format(addDays(new Date(), 4), 'dd MMM'),
            tone: 'calendar',
        },
    ];

    return [...birthdayEvents, ...approvalEvents, ...fallbackEvents].slice(0, 3);
};

const getEventToneClasses = (tone) => {
    if (tone === 'birthday') {
        return 'bg-orange-100 text-orange-600';
    }
    if (tone === 'approval') {
        return 'bg-cyan-100 text-cyan-700';
    }
    return 'bg-emerald-100 text-emerald-700';
};

const StatCard = ({ label, value, subtext, badge, badgeClassName, icon, iconClassName, onClick }) => (
    <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
            onClick
                ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onClick(e);
                      }
                  }
                : undefined
        }
        className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
        style={{ borderColor: WS.border }}
    >
        <div className="mb-3 flex items-start justify-between gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}>{icon}</div>
            {badge ? (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeClassName}`}>{badge}</span>
            ) : null}
        </div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{subtext}</p>
    </div>
);

const Panel = ({ title, actionLabel, onAction, children, className = '' }) => (
    <section
        className={`rounded-2xl border bg-white p-4 shadow-sm ${className}`}
        style={{ borderColor: WS.border }}
    >
        <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {actionLabel ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="text-xs font-medium text-emerald-600 transition hover:text-emerald-700"
                >
                    {actionLabel}
                </button>
            ) : null}
        </div>
        {children}
    </section>
);

const DashboardHR = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const { permissions, permissionFlags } = useAuthPermissions();
    const rbacOpts = { isOrgOwner: !!permissionFlags.isOrgOwner };

    useEffect(() => {
        dispatch(fetchOrganizationTimezone());
    }, [dispatch]);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResetPopup, setShowResetPopup] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allEmployees, setAllEmployees] = useState([]);
    const [allEmployeesLoaded, setAllEmployeesLoaded] = useState(false);
    const [allEmployeesLoading, setAllEmployeesLoading] = useState(true);
    const [extrasLoading, setExtrasLoading] = useState(true);
    const [dashboardExtras, setDashboardExtras] = useState({
        birthdays: [],
        openJobs: [],
        pendingApprovals: [],
        escalatedApprovalsCount: 0,
        attendanceDailyTrend: [],
        todayStatus: [],
    });
    const [celebrationEvents, setCelebrationEvents] = useState({});
    const [celebrationReacting, setCelebrationReacting] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

    const canManageAnnouncements = permissionFlags.isHrManager || permissionFlags.isHrExecutive;

    const {
        data: employeeData = { employees: [], total: 0 },
        isLoading: employeesLoading,
        error: employeesError,
    } = useEmployees();

    const {
        data: leaves = [],
        isLoading: leavesLoading,
        error: leavesError,
    } = useLeaves();

    const employees = employeeData?.employees ?? [];
    const employeeTotal = employeeData?.total ?? employees.length;
    const orgEmployees = allEmployeesLoaded ? allEmployees : employees;
    const orgEmployeeTotal = allEmployeesLoaded ? allEmployees.length : employeeTotal;

    const departmentLabel = user?.department || employee?.department || 'People Operations';

    useEffect(() => {
        const fetchData = async () => {
            if (hasFetched) return;

            try {
                setLoading(true);
                setHasFetched(true);
                const result = await dispatch(fetchEmployeeOwnInfo());

                if (fetchEmployeeOwnInfo.rejected.match(result)) {
                    const needsPersonalProfile =
                        !permissionFlags.isOrgOwner &&
                        !permissionFlags.isHrManager &&
                        !permissionFlags.isHrExecutive;
                    if (needsPersonalProfile) {
                        setError(result.payload || 'Failed to load employee information');
                    }
                }
            } catch (err) {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                } else if (
                    !permissionFlags.isOrgOwner &&
                    !permissionFlags.isHrManager &&
                    !permissionFlags.isHrExecutive
                ) {
                    setError('An unexpected error occurred');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dispatch, hasFetched, permissionFlags.isOrgOwner, permissionFlags.isHrManager, permissionFlags.isHrExecutive]);

    useEffect(() => {
        const fetchAllEmployees = async () => {
            try {
                setAllEmployeesLoading(true);

                let page = 1;
                let totalPages = 1;
                const collectedEmployees = [];

                while (page <= totalPages) {
                    const response = await axios.get('/v1/admin/employee', {
                        params: { page, limit: 100 },
                        withCredentials: true,
                    });

                    const { list, pages } = extractEmployeePage(response.data);
                    collectedEmployees.push(...list);
                    totalPages = pages;
                    page += 1;
                }

                const uniqueEmployees = [...new Map(collectedEmployees.map((item) => [String(item._id), item])).values()];
                setAllEmployees(uniqueEmployees);
                setAllEmployeesLoaded(true);
            } catch {
                setAllEmployees([]);
                setAllEmployeesLoaded(false);
            } finally {
                setAllEmployeesLoading(false);
            }
        };

        fetchAllEmployees();
    }, []);

    useEffect(() => {
        const fetchDashboardExtras = async () => {
            try {
                setExtrasLoading(true);

                const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
                const today = format(new Date(), 'yyyy-MM-dd');

                const [attendanceTrendRes, birthdaysRes, jobsRes, approvalsRes, taxRegimeRes, todayStatusRes, escalatedRes] = await Promise.allSettled([
                    axios.get(`${BOTH_ATTENDANCE_ENDPOINT}/team-attendance-history`, {
                        params: { startDate: monthStart, endDate: today },
                        withCredentials: true,
                    }),
                    axios.get('/v1/both/profile-details/upcoming-birthdays', {
                        withCredentials: true,
                    }),
                    axios.get('/v1/admin/recruitment/jobs', {
                        withCredentials: true,
                    }),
                    axios.get('/v1/admin/approvals/my-pending', {
                        withCredentials: true,
                    }),
                    axios.get('/v1/both/tax-regime-change/admin/pending', {
                        withCredentials: true,
                    }),
                    axios.get('/v1/both/attendance/today-status', {
                        withCredentials: true,
                    }),
                    axios.get('/v1/admin/approvals/escalated-count', {
                        withCredentials: true,
                    }),
                ]);

                const workflowApprovals =
                    approvalsRes.status === 'fulfilled' ? approvalsRes.value?.data?.data || [] : [];
                const taxRegimeApprovals =
                    taxRegimeRes.status === 'fulfilled' ? taxRegimeRes.value?.data?.data || [] : [];
                const workflowTaxIds = new Set(
                    workflowApprovals
                        .filter((a) => a.entityType === 'TaxRegimeChange')
                        .map((a) => String(a.entityId))
                );
                const mergedApprovals = [
                    ...taxRegimeApprovals.filter(
                        (item) => !workflowTaxIds.has(String(item.taxRegimeRequestId))
                    ),
                    ...workflowApprovals,
                ];

                const escalatedFromApi =
                    escalatedRes.status === 'fulfilled'
                        ? Number(escalatedRes.value?.data?.data?.count ?? 0)
                        : 0;
                const escalatedFromList = workflowApprovals.filter((a) => a.slaEscalated).length;

                setDashboardExtras({
                    birthdays:
                        birthdaysRes.status === 'fulfilled' ? (birthdaysRes.value?.data?.celebrations || [ ...(birthdaysRes.value?.data?.birthdays || []), ...(birthdaysRes.value?.data?.marriageAnniversaries || []) ]) : [],
                    openJobs:
                        jobsRes.status === 'fulfilled' ? jobsRes.value?.data?.data || [] : [],
                    pendingApprovals: mergedApprovals,
                    escalatedApprovalsCount: Math.max(escalatedFromApi, escalatedFromList),
                    attendanceDailyTrend:
                        attendanceTrendRes.status === 'fulfilled' ? attendanceTrendRes.value?.data?.dailyTrend || [] : [],
                    todayStatus:
                        todayStatusRes.status === 'fulfilled' ? todayStatusRes.value?.data?.data || [] : [],
                });
            } catch {
                setDashboardExtras({
                    birthdays: [],
                    openJobs: [],
                    pendingApprovals: [],
                    escalatedApprovalsCount: 0,
                    attendanceDailyTrend: [],
                    todayStatus: [],
                });
            } finally {
                setExtrasLoading(false);
            }
        };

        fetchDashboardExtras();
    }, []);

    const loadAnnouncements = useCallback(async () => {
        if (!canManageAnnouncements) {
            setAnnouncements([]);
            return;
        }

        try {
            const announcementsRes = await axios.get('/v1/both/notification/sent-announcements', {
                params: { scope: 'organization', page: 1, limit: 3 },
                withCredentials: true,
            });
            const recentAnnouncements = announcementsRes?.data?.announcements || [];
            setAnnouncements(Array.isArray(recentAnnouncements) ? recentAnnouncements : []);
        } catch {
            setAnnouncements([]);
        }
    }, [canManageAnnouncements]);

    useEffect(() => {
        loadAnnouncements();
    }, [loadAnnouncements]);

    useEffect(() => {
        if (user?.mustResetPassword) {
            setShowResetPopup(true);
        }
    }, [user]);

    useEffect(() => {
        if (employeesError) {
            handleApiError(employeesError, {
                context: 'HR Dashboard',
                showToast: employeesError.response?.status !== 401,
            });
        }

        if (leavesError) {
            handleApiError(leavesError, {
                context: 'HR Dashboard - Leaves',
                showToast: leavesError.response?.status !== 401,
            });
        }
    }, [employeesError, leavesError]);

    const activeEmployees = useMemo(
        () => orgEmployees.filter((employeeItem) => normalizeText(employeeItem?.status) === 'active').length,
        [orgEmployees]
    );

    const pendingLeaves = useMemo(
        () => leaves.filter((leave) => normalizeText(leave?.status) === 'pending').length,
        [leaves]
    );

    const newHires = useMemo(() => {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 30);

        return orgEmployees.filter((employeeItem) => {
            if (!employeeItem?.joiningDate) return false;
            const joiningDate = new Date(employeeItem.joiningDate);
            return !Number.isNaN(joiningDate.getTime()) && joiningDate >= threshold;
        }).length;
    }, [orgEmployees]);

    const terminatedEmployees = useMemo(
        () =>
            orgEmployees.filter(
                (employeeItem) =>
                    normalizeText(employeeItem?.status) === 'terminated' || Boolean(employeeItem?.terminationDate)
            ).length,
        [orgEmployees]
    );

    const openPositions = useMemo(
        () =>
            (dashboardExtras.openJobs || []).filter((job) => {
                const status = normalizeText(job?.status);
                return status === 'open' || status === 'active';
            }).length,
        [dashboardExtras.openJobs]
    );

    const attritionRate = useMemo(() => {
        const base = orgEmployeeTotal > 0 ? (orgEmployeeTotal + activeEmployees) / 2 : 0;
        if (base <= 0) return '0.0';
        return ((terminatedEmployees / base) * 100).toFixed(1);
    }, [activeEmployees, orgEmployeeTotal, terminatedEmployees]);

    const todayAttendanceStats = useMemo(() => {
        const todayStatus = dashboardExtras.todayStatus || [];
        const total = todayStatus.length || activeEmployees || orgEmployeeTotal;
        const present = todayStatus.filter((item) => normalizeText(item?.status) !== 'absent').length;
        const rate = total > 0 ? (present / total) * 100 : 0;

        return {
            total,
            present,
            rate: Number(rate.toFixed(1)),
        };
    }, [activeEmployees, dashboardExtras.todayStatus, orgEmployeeTotal]);

    const monthlyHiringAttritionData = useMemo(
        () => buildMonthlyHiringAttrition(orgEmployees),
        [orgEmployees]
    );

    const attendanceTrendData = useMemo(
        () => buildAttendanceTrend(dashboardExtras.attendanceDailyTrend),
        [dashboardExtras.attendanceDailyTrend]
    );

    const departmentData = useMemo(
        () => buildDepartmentData(orgEmployees),
        [orgEmployees]
    );
    const departmentHeadcountTotal = useMemo(
        () => departmentData.reduce((sum, item) => sum + Number(item.count || 0), 0),
        [departmentData]
    );

    const approvalSummary = useMemo(
        () => buildApprovalSummary(dashboardExtras.pendingApprovals),
        [dashboardExtras.pendingApprovals]
    );

    const pendingApprovalsPreview = useMemo(
        () => (dashboardExtras.pendingApprovals || []).slice(0, 3),
        [dashboardExtras.pendingApprovals]
    );

    const upcomingEvents = useMemo(
        () => buildUpcomingEvents(dashboardExtras.birthdays, dashboardExtras.pendingApprovals),
        [dashboardExtras.birthdays, dashboardExtras.pendingApprovals]
    );

    const getCelebrationItemKey = (item) => `${item?.type || 'birthday'}_${item?.employeeId}`;

    const openTodayCelebrationEvent = async (item) => {
        const { data } = await axios.post(
            `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
            { employeeId: item.employeeId, type: item.type || 'birthday' },
            { withCredentials: true }
        );
        const event = data?.data;
        if (event?._id) {
            const itemKey = getCelebrationItemKey(item);
            setCelebrationEvents((prev) => ({ ...prev, [itemKey]: event }));
        }
        return event;
    };

    const handleOpenCelebrationWishes = async (item) => {
        if (!item?.employeeId) return;
        try {
            if (item.daysUntil !== 0) {
                const label = item?.type === 'marriage_anniversary'
                    ? 'marriage anniversary'
                    : item?.type === 'anniversary'
                        ? 'work anniversary'
                        : 'birthday';
                toast.info(`Wishes and reactions open on their ${label}.`);
                return;
            }
            const itemKey = getCelebrationItemKey(item);
            const event = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            const eventId = event?._id;
            navigate(eventId ? `/celebrations/${eventId}` : '/celebrations');
        } catch {
            navigate('/celebrations');
        }
    };

    const handleCelebrationReact = async (item, emoji) => {
        if (item?.daysUntil !== 0) return;
        setCelebrationReacting(true);
        try {
            const itemKey = getCelebrationItemKey(item);
            const opened = celebrationEvents[itemKey] || await openTodayCelebrationEvent(item);
            if (!opened?._id) return;
            const { data } = await axios.post(
                `${BOTH_CELEBRATION_ENDPOINT}/events/${opened._id}/react`,
                { emoji },
                { withCredentials: true }
            );
            const eventStateKey = data?.data?.type && data?.data?.employeeId ? `${data.data.type}_${data.data.employeeId}` : itemKey;
            setCelebrationEvents((prev) => ({
                ...prev,
                [eventStateKey]: {
                    ...opened,
                    ...(prev[eventStateKey] || {}),
                    reactions: data?.data?.reactions || [],
                    reactionCounts: data?.data?.reactionCounts || {},
                },
            }));
        } finally {
            setCelebrationReacting(false);
        }
    };

    const recentHires = useMemo(() => {
        const query = normalizeText(searchQuery);

        return [...orgEmployees]
            .filter((employeeItem) => {
                const searchable = [
                    getEmployeeName(employeeItem),
                    employeeItem?.jobTitle,
                    employeeItem?.department,
                    employeeItem?.position,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return !query || searchable.includes(query);
            })
            .sort((first, second) => {
                const firstDate = new Date(first?.joiningDate || first?.createdAt || 0).getTime();
                const secondDate = new Date(second?.joiningDate || second?.createdAt || 0).getTime();
                return secondDate - firstDate;
            })
            .slice(0, 5);
    }, [orgEmployees, searchQuery]);

    const quickActions = [
        (permissionFlags.isOrgOwner ||
            permissionFlags.isHrManager ||
            permissionFlags.isHrExecutive ||
            hasAnyPermission(permissions, [PERMISSIONS.EMPLOYEE_CREATE], rbacOpts)) && {
            label: 'Add Employee',
            subtitle: 'Create a profile',
            icon: <FiUserPlus className="h-5 w-5" />,
            onClick: () => navigate('/add-employee'),
        },
        hasAnyPermission(permissions, [PERMISSIONS.PAYROLL_VIEW_ALL], rbacOpts) && {
            label: 'Run Payroll',
            subtitle: 'Process salaries',
            icon: <FiFileText className="h-5 w-5" />,
            onClick: () => navigate('/admin-payroll'),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM], rbacOpts) && {
            label: 'Leave Review',
            subtitle: `${pendingLeaves} pending`,
            icon: <FiCalendar className="h-5 w-5" />,
            onClick: () => navigate('/leave-management'),
        },
        (permissionFlags.isHrManager || permissionFlags.isHrExecutive) && {
            label: 'Attendance Rules',
            subtitle: 'Punch & office rules',
            icon: <FiSettings className="h-5 w-5" />,
            onClick: () => navigate('/attendance-rules'),
        },
        (permissionFlags.isHrManager || permissionFlags.isHrExecutive) && {
            label: 'Leave Policy',
            subtitle: 'Configure leave types',
            icon: <FiBook className="h-5 w-5" />,
            onClick: () => navigate('/admin/leave-policy'),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM], rbacOpts) && {
            label: 'Approvals',
            subtitle: `${dashboardExtras.pendingApprovals.length} queued`,
            icon: <FiClock className="h-5 w-5" />,
            onClick: () => navigate('/admin/pending-approvals'),
        },
        hasAnyPermission(permissions, [PERMISSIONS.EMPLOYEE_VIEW_ALL], rbacOpts) && {
            label: 'Recruitment',
            subtitle: `${openPositions} open roles`,
            icon: <FiBriefcase className="h-5 w-5" />,
            onClick: () => navigate('/recruitment'),
        },
        hasAnyPermission(permissions, [PERMISSIONS.EMPLOYEE_VIEW_ALL], rbacOpts) && {
            label: 'Reports',
            subtitle: 'HR analytics',
            icon: <FiTrendingUp className="h-5 w-5" />,
            onClick: () => navigate('/admin/reports'),
        },
    ].filter(Boolean);

    const pageLoading = loading || employeesLoading || leavesLoading || allEmployeesLoading;
    const todayLabel = format(new Date(), 'EEEE, do MMMM yyyy');

    if (user?.mustResetPassword) {
        return (
            <div className="min-h-screen bg-[#F5F7FB] p-3 sm:p-4">
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (pageLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#20C997] border-r-[#20C997]" />
                    <p className="text-sm text-slate-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
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
            <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
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

    return (
        <div className="min-h-screen bg-[#F5F7FB]">
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}

            {showAnnouncementModal && canManageAnnouncements ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => setShowAnnouncementModal(false)}
                >
                    <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
                        <NotificationSender
                            onSent={() => {
                                setShowAnnouncementModal(false);
                                loadAnnouncements();
                            }}
                        />
                    </div>
                </div>
            ) : null}

            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack gap-4">
                <AnnouncementBanner />
                <div className="hrms-main-rail !items-stretch gap-4">
                    <div className="min-w-0 space-y-4">
                <header
                    className="rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur"
                    style={{ borderColor: WS.border }}
                >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 sm:flex">
                                <FiGrid className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                    HR Workspace
                                </p>
                                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                                    People dashboard
                                </h1>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {departmentLabel} · {todayLabel}
                                </p>
                            </div>
                        </div>

                        <div className="w-full xl:max-w-md">
                            <label className="relative block">
                                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search employee or role..."
                                    className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                                />
                            </label>
                        </div>

                        <div className="flex items-center gap-3 self-end xl:self-auto">
                            <button
                                type="button"
                                onClick={() => navigate('/notifications')}
                                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600"
                                aria-label="Notifications"
                            >
                                <HiOutlineBell className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/helpdesk')}
                                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600"
                                aria-label="Help"
                            >
                                <HiOutlineQuestionMarkCircle className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/profile-details')}
                                className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-200"
                            >
                                <ProfilePicture user={user} size="sm" />
                                <div className="hidden min-w-0 sm:block">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {user?.name || 'HR Manager'}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {user?.jobTitle || user?.position || 'HR Manager'}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Punch in / punch out
                    </h3>
                    <AttendanceBox variant="dashboard" />
                </section>
                    </div>

                    <aside className="flex w-full min-w-0 self-stretch">
                        <div
                            className="flex h-full min-h-[280px] w-full flex-col rounded-xl border bg-white shadow-sm"
                            style={{ borderColor: WS.border }}
                        >
                            <div
                                className="shrink-0 rounded-t-xl px-3 py-2"
                                style={{ background: `linear-gradient(90deg, ${WS.mint} 0%, #17a67d 100%)` }}
                            >
                                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-white">
                                    <FiGift className="h-3 w-3" />
                                    Upcoming celebrations
                                </h3>
                            </div>
                            <div className="flex flex-1 flex-col p-3">
                                <ul className="space-y-2">
                                    {sortCelebrations(dashboardExtras.birthdays || []).slice(0, 3).map((item, idx) => {
                                        const itemKey = `${item.type || 'birthday'}_${item.employeeId}`;
                                        return (
                                            <CelebrationDashboardCard
                                                key={`${item.type || 'birthday'}_${item.employeeId || idx}`}
                                                item={item}
                                                isSelf={false}
                                                event={celebrationEvents[itemKey]}
                                                reacting={celebrationReacting}
                                                onReact={handleCelebrationReact}
                                                onWishes={handleOpenCelebrationWishes}
                                            />
                                        );
                                    })}
                                </ul>
                                {(!dashboardExtras.birthdays || dashboardExtras.birthdays.length === 0) ? (
                                    <p className="py-2 text-center text-xs text-slate-500">No upcoming celebrations.</p>
                                ) : null}
                                <div className="mt-4 flex flex-1 flex-col justify-evenly gap-3">
                                    {upcomingEvents.filter((eventItem) => eventItem.tone !== 'birthday').slice(0, 2).map((eventItem) => (
                                        <div key={eventItem.id} className="flex items-start gap-2">
                                            <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${getEventToneClasses(eventItem.tone)}`}>
                                                <FiCalendar className="h-3 w-3" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-900">{eventItem.title}</p>
                                                <p className="truncate text-[11px] text-slate-500">{eventItem.subtitle}</p>
                                            </div>
                                            <p className="shrink-0 text-[10px] font-medium text-slate-400">{eventItem.dateLabel}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div
                    className={`grid grid-cols-1 gap-4 ${
                        canManageAnnouncements ? 'lg:grid-cols-2 lg:items-stretch' : 'max-w-md'
                    }`}
                >
                    <PersonalDashboardKpiRow compact layout="stack" />
                    {canManageAnnouncements ? (
                        <section
                            className="flex min-w-0 flex-col rounded-2xl border bg-white p-4 shadow-sm"
                            style={{ borderColor: WS.border }}
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowAnnouncementModal(true)}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                    <FiPlus className="h-4 w-4" />
                                    New
                                </button>
                            </div>
                            <div className="min-h-0 flex-1 space-y-2.5">
                                {announcements.length === 0 ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                        No announcements yet.
                                    </div>
                                ) : (
                                    announcements.map((item) => (
                                        <div
                                            key={item._id}
                                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                        >
                                            <p className="text-xs text-slate-500">
                                                {formatShortDate(item.createdAt)}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                                                {item.message}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/sent-announcements')}
                                className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                View All Announcements
                            </button>
                        </section>
                    ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <StatCard
                        label="Total Employees"
                        value={formatNumber(orgEmployeeTotal)}
                        subtext={`${activeEmployees} active across departments`}
                        badge={`+${newHires} new`}
                        badgeClassName="bg-emerald-50 text-emerald-700"
                        icon={<FiUsers className="h-5 w-5" />}
                        iconClassName="bg-emerald-100 text-emerald-600"
                    />
                    <StatCard
                        label="Open Positions"
                        value={formatNumber(openPositions)}
                        subtext={`${dashboardExtras.openJobs.length} job posts in pipeline`}
                        badge={openPositions > 0 ? 'Hiring' : 'Stable'}
                        badgeClassName="bg-slate-100 text-slate-600"
                        icon={<FiBriefcase className="h-5 w-5" />}
                        iconClassName="bg-emerald-900/10 text-emerald-900"
                    />
                    <StatCard
                        label="Attrition Rate"
                        value={`${attritionRate}%`}
                        subtext={`${terminatedEmployees} recorded exits`}
                        badge={Number(attritionRate) <= 10 ? 'Healthy' : 'Watch'}
                        badgeClassName={
                            Number(attritionRate) <= 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }
                        icon={<FiTrendingDown className="h-5 w-5" />}
                        iconClassName="bg-orange-100 text-orange-500"
                    />
                    <StatCard
                        label="Today's Attendance"
                        value={`${todayAttendanceStats.rate.toFixed(1)}%`}
                        subtext={`${todayAttendanceStats.present} of ${todayAttendanceStats.total} marked present`}
                        badge={todayAttendanceStats.rate >= 90 ? 'Optimal' : 'In focus'}
                        badgeClassName={
                            todayAttendanceStats.rate >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-cyan-100 text-cyan-700'
                        }
                        icon={<FiCheckCircle className="h-5 w-5" />}
                        iconClassName="bg-teal-100 text-teal-700"
                    />
                    <StatCard
                        label="Overdue Approvals"
                        value={formatNumber(dashboardExtras.escalatedApprovalsCount || 0)}
                        subtext="Pending beyond review window"
                        badge={
                            (dashboardExtras.escalatedApprovalsCount || 0) > 0 ? 'Needs follow-up' : 'Clear'
                        }
                        badgeClassName={
                            (dashboardExtras.escalatedApprovalsCount || 0) > 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-emerald-50 text-emerald-700'
                        }
                        icon={<FiClock className="h-5 w-5" />}
                        iconClassName="bg-orange-100 text-orange-600"
                        onClick={() => navigate('/admin/pending-approvals?escalated=1')}
                    />
                </div>

                <div className="hrms-main-rail gap-4">
                    <Panel title="Monthly Hiring vs Attrition">
                        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                Hiring
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                                Attrition
                            </span>
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyHiringAttritionData} barGap={12}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                                        }}
                                    />
                                    <Bar dataKey="hiring" name="Hiring" fill={WS.mint} radius={[10, 10, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="attrition" name="Attrition" fill={WS.peach} radius={[10, 10, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Panel>

                    <Panel title="Attendance Trend">
                        <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                            <span>Average team attendance this month</span>
                            <span className="font-medium text-emerald-600">Live view</span>
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={attendanceTrendData}>
                                    <defs>
                                        <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={WS.mint} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={WS.mint} stopOpacity={0.04} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                                    <YAxis hide domain={[0, 100]} />
                                    <Tooltip
                                        formatter={(value) => [`${value}%`, 'Attendance']}
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="pct"
                                        stroke={WS.mint}
                                        fill="url(#attendanceFill)"
                                        strokeWidth={3}
                                        dot={{ r: 0 }}
                                        activeDot={{ r: 5, fill: WS.mint }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Panel>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <section
                        className="rounded-2xl border bg-white p-4 shadow-sm"
                        style={{ borderColor: WS.border }}
                    >
                        <h2 className="mb-4 text-base font-bold leading-tight" style={{ color: HEADCOUNT_CHART.title }}>
                            Headcount by Department
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="relative h-[148px] w-[148px] shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={departmentData.length > 0 ? departmentData : [{ name: 'Empty', count: 1, color: '#E2E8F0' }]}
                                            dataKey="count"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            startAngle={90}
                                            endAngle={-270}
                                            innerRadius="52%"
                                            outerRadius="78%"
                                            paddingAngle={departmentData.length > 1 ? 4 : 0}
                                            cornerRadius={departmentData.length > 1 ? 8 : 0}
                                            stroke="#FFFFFF"
                                            strokeWidth={3}
                                            isAnimationActive={false}
                                        >
                                            {(departmentData.length > 0 ? departmentData : [{ name: 'Empty', count: 1, color: '#E2E8F0' }]).map((entry) => (
                                                <Cell key={entry.name} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => [`${value} employees`, 'Headcount']}
                                            contentStyle={{
                                                borderRadius: '16px',
                                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span
                                        className="text-[2rem] font-bold leading-none tabular-nums"
                                        style={{ color: HEADCOUNT_CHART.total }}
                                    >
                                        {departmentHeadcountTotal > 999
                                            ? `${(departmentHeadcountTotal / 1000).toFixed(1)}k`
                                            : departmentHeadcountTotal.toLocaleString('en-US')}
                                    </span>
                                    <span
                                        className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em]"
                                        style={{ color: HEADCOUNT_CHART.totalLabel }}
                                    >
                                        Total
                                    </span>
                                </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-3 py-0.5">
                                {sortDepartmentsForLegend(departmentData).map((item) => {
                                    const percentage =
                                        departmentHeadcountTotal > 0 ? Math.round((item.count / departmentHeadcountTotal) * 100) : 0;

                                    return (
                                        <div key={item.name} className="flex items-center gap-2.5">
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span
                                                className="min-w-0 flex-1 truncate text-[13px] font-normal leading-none"
                                                style={{ color: HEADCOUNT_CHART.legendLabel }}
                                            >
                                                {item.name}
                                            </span>
                                            <span
                                                className="shrink-0 text-[13px] font-bold leading-none tabular-nums"
                                                style={{ color: HEADCOUNT_CHART.legendValue }}
                                            >
                                                {percentage}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <Panel title="Pending Approvals" actionLabel="View All" onAction={() => navigate('/admin/pending-approvals')}>
                        <div className="grid grid-cols-2 gap-2.5">
                            {approvalSummary.map((item) => (
                                <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                                    <p className={`text-2xl font-semibold ${item.accent}`}>{String(item.value).padStart(2, '0')}</p>
                                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 space-y-2">
                            {pendingApprovalsPreview.length > 0 ? (
                                pendingApprovalsPreview.map((approval) => (
                                    <button
                                        key={approval._id}
                                        type="button"
                                        onClick={() => navigate('/admin/pending-approvals')}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-emerald-200 hover:bg-slate-50"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                {approval.entityType || 'Approval'} request
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                {approval.requestedBy?.name || 'Pending review'}
                                            </p>
                                        </div>
                                        <FiArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                    No pending approvals right now.
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>

                <div className="hrms-main-rail gap-4">
                    <Panel title="Recent Hires">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <p className="text-sm text-slate-500">
                                {searchQuery ? `Filtered by "${searchQuery}"` : 'Newest additions to your workforce'}
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/employees')}
                                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="More options"
                            >
                                <FiMoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="overflow-x-auto overscroll-x-contain rounded-3xl border border-slate-100">
                            <div className="min-w-[640px]">
                            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-3 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                <span>Employee</span>
                                <span>Role</span>
                                <span>Date Joined</span>
                                <span>Status</span>
                            </div>

                            {recentHires.length > 0 ? (
                                recentHires.map((employeeItem) => (
                                    <button
                                        key={employeeItem._id}
                                        type="button"
                                        onClick={() => navigate(`/employees/${employeeItem._id}`)}
                                        className="grid w-full grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-3 border-t border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50"
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                                                {getEmployeeName(employeeItem).slice(0, 2).toUpperCase()}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-slate-900">
                                                    {getEmployeeName(employeeItem)}
                                                </span>
                                                <span className="block truncate text-xs text-slate-500">
                                                    {employeeItem?.department || 'Department pending'}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="truncate text-sm text-slate-600">
                                            {employeeItem?.jobTitle || employeeItem?.position || '--'}
                                        </span>
                                        <span className="text-sm text-slate-600">
                                            {formatShortDate(employeeItem?.joiningDate || employeeItem?.createdAt)}
                                        </span>
                                        <span>
                                            <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                    normalizeText(employeeItem?.status) === 'active'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}
                                            >
                                                {employeeItem?.status || 'Onboarding'}
                                            </span>
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-5 py-10 text-center text-sm text-slate-500">
                                    No hires matched your current search.
                                </div>
                            )}
                            </div>
                        </div>
                    </Panel>

                    <div className="grid gap-4 content-start">
                        <LeaveBalanceCard />
                    </div>
                </div>

                <Panel title="Quick Actions">
                    <div
                        className="w-full overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        onWheel={(event) => {
                            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                                event.currentTarget.scrollLeft += event.deltaY;
                            }
                        }}
                    >
                        <div className="flex flex-nowrap gap-3">
                            {quickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    onClick={action.onClick}
                                    className="min-w-[180px] max-w-[180px] flex-[0_0_180px] rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-white hover:shadow-sm"
                                >
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                                        {action.icon}
                                    </div>
                                    <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                                    <p className="mt-1 text-xs text-slate-500">{action.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 flex min-h-[80px] max-h-[90px] items-center justify-between gap-4 rounded-[18px] border border-emerald-600/20 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 shadow-sm">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-tight text-white">
                                Need a deeper review?
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-emerald-50/95">
                                Open analytics to drill into workforce, leave, and hiring patterns.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/hr/analytics')}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                            aria-label="Open analytics"
                        >
                            <FiArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                </Panel>

                {extrasLoading ? (
                    <div className="flex items-center justify-center py-2 text-sm text-slate-400">
                        <FiActivity className="mr-2 h-4 w-4 animate-pulse" />
                        Refreshing dashboard widgets...
                    </div>
                ) : null}
            </div>
            </div>
            </div>
        </div>
    );
};

export default DashboardHR;
