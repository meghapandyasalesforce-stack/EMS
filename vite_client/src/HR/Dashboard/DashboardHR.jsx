import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    FiActivity,
    FiArrowUpRight,
    FiBriefcase,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiGift,
    FiPlus,
    FiEye,
    FiSearch,
    FiSpeaker,
    FiTrendingDown,
    FiUserPlus,
    FiUsers,
} from 'react-icons/fi';
import { HiOutlineBell } from 'react-icons/hi2';
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
import { format, startOfMonth, subMonths } from 'date-fns';
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
import NotificationSender from '../../Admin/NotificationSender';
import {
    AddEmployeeModal,
    AnnouncementsListModal,
    ApprovalsDrawer,
    CelebrationsDrawer,
    EmployeeQuickViewModal,
    JobsDrawer,
    LeaveDrawer,
    ModalShell,
    ProfilePeekModal,
    WishModal,
} from './DashboardOverlays';
import '../../styles/dashboardHR.css';
import { useQueryClient } from '@tanstack/react-query';


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
        <li className={`hr-dash__celeb-card min-w-0 overflow-hidden ${isToday ? 'hr-dash__celeb-card--today' : ''}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">{header}</p>
                    <p className="truncate text-sm font-semibold text-[#111C2D]">{icon} {isSelf ? 'You' : item?.name || 'Team member'}</p>
                    <p className="break-words text-[11px] leading-snug text-[#666666]">
                        {(isMarriage || isWorkAnniversary) && item?.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {dateLabel ? `${dateLabel} · ` : ''}{typeLabel} · {whenLabel}
                    </p>
                </div>
                {onWishes ? (
                    <button type="button" onClick={() => onWishes(item)} className="hr-dash__btn-primary inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center whitespace-nowrap px-3 text-xs">
                        {isToday ? 'Wishes' : 'Upcoming'}
                    </button>
                ) : null}
            </div>
            {isToday && onReact ? (
                <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {CELEBRATION_REACTIONS.map((emoji) => {
                        const count = counts[emoji] || 0;
                        return (
                            <button key={emoji} type="button" disabled={reacting} onClick={() => onReact(item, emoji)} className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-[#0E9370]/40 hover:bg-white disabled:opacity-50 ${count > 0 ? 'border-[#0E9370]/35' : 'border-slate-200'}`} aria-label={`React ${emoji}`}>
                                <span>{emoji}</span>
                                {count > 0 ? <span className="text-[10px] font-semibold text-[#666666]">{count}</span> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </li>
    );
}

const WS = {
    bg: '#E8FAF4',
    card: '#FFFFFF',
    border: 'rgba(14, 43, 61, 0.08)',
    mint: '#0E9370',
    mintDark: '#0B7458',
    forest: '#00694F',
    peach: '#FF9B71',
    teal: '#5BC0BE',
    amber: '#F59E0B',
    text: '#111C2D',
    muted: '#666666',
};

const DEPARTMENT_COLOR_MAP = {
    Engineering: '#0E9370',
    Sales: '#00694F',
    Design: '#FF9F71',
    Others: '#476175',
};

const DEPARTMENT_COLOR_FALLBACKS = ['#0E9370', '#00694F', '#FF9F71', '#476175'];

const DEPARTMENT_LEGEND_ORDER = ['Engineering', 'Sales', 'Design', 'Others'];

const HEADCOUNT_CHART = {
    title: '#111C2D',
    total: '#111C2D',
    totalLabel: '#94A3B8',
    legendLabel: '#666666',
    legendValue: '#111C2D',
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
        className={`hr-dash__stat ${onClick ? 'hr-dash__stat--clickable cursor-pointer' : ''}`}
    >
        <div className="mb-3 flex items-start justify-between gap-3">
            <div className={`hr-dash__icon-well ${iconClassName || ''}`}>{icon}</div>
            {badge ? (
                <span className={`hr-dash__badge ${badgeClassName}`}>{badge}</span>
            ) : null}
        </div>
        <p className="hr-dash__stat-label">{label}</p>
        <p className="hr-dash__stat-value">{value}</p>
        <p className="hr-dash__stat-sub">{subtext}</p>
    </div>
);

const Panel = ({ title, actionLabel, onAction, children, className = '' }) => (
    <section className={`hr-dash__panel ${className}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="hr-dash__panel-title">{title}</h2>
            {actionLabel ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="hr-dash__panel-action"
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
    const queryClient = useQueryClient();
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
    const [approvalsDrawer, setApprovalsDrawer] = useState({ open: false, escalatedOnly: false });
    const [leaveDrawerOpen, setLeaveDrawerOpen] = useState(false);
    const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
    const [wishModal, setWishModal] = useState({ open: false, item: null, eventId: null });
    const [celebrationsDrawer, setCelebrationsDrawer] = useState({ open: false, focusItem: null });
    const [employeeQuickView, setEmployeeQuickView] = useState({ open: false, employee: null });
    const [escalatedBannerDismissed, setEscalatedBannerDismissed] = useState(false);
    const [announcementsListOpen, setAnnouncementsListOpen] = useState(false);
    const [jobsDrawerOpen, setJobsDrawerOpen] = useState(false);
    const [profilePeekOpen, setProfilePeekOpen] = useState(false);

    const canManageAnnouncements = permissionFlags.isHrManager || permissionFlags.isHrExecutive;
    const canAddEmployee =
        permissionFlags.isOrgOwner ||
        permissionFlags.isHrManager ||
        permissionFlags.isHrExecutive ||
        hasAnyPermission(permissions, [PERMISSIONS.EMPLOYEE_CREATE], rbacOpts);

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

    const fetchDashboardExtras = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        fetchDashboardExtras();
    }, [fetchDashboardExtras]);

    const loadAnnouncements = useCallback(async (limit = 3) => {
        if (!canManageAnnouncements) {
            setAnnouncements([]);
            return;
        }

        try {
            const announcementsRes = await axios.get('/v1/both/notification/sent-announcements', {
                params: { scope: 'organization', page: 1, limit },
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

    const celebrationOpenInFlightRef = useRef(new Map());

    const getCelebrationItemKey = useCallback(
        (item) => `${item?.type || 'birthday'}_${item?.employeeId}`,
        []
    );

    const openTodayCelebrationEvent = useCallback(async (item) => {
        if (!item?.employeeId) return null;
        const itemKey = getCelebrationItemKey(item);
        // Reuse cached event — avoid repeat POST /events/open (rate-limit spam)
        const cached = celebrationEvents[itemKey];
        if (cached?._id) return cached;

        const inflight = celebrationOpenInFlightRef.current.get(itemKey);
        if (inflight) return inflight;

        const promise = (async () => {
            try {
                const { data } = await axios.post(
                    `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
                    { employeeId: item.employeeId, type: item.type || 'birthday' },
                    { withCredentials: true }
                );
                const event = data?.data;
                if (event?._id) {
                    setCelebrationEvents((prev) => {
                        if (prev[itemKey]?._id) return prev;
                        return { ...prev, [itemKey]: event };
                    });
                }
                return event;
            } finally {
                celebrationOpenInFlightRef.current.delete(itemKey);
            }
        })();

        celebrationOpenInFlightRef.current.set(itemKey, promise);
        return promise;
    }, [celebrationEvents, getCelebrationItemKey]);

    const handleOpenCelebrationWishes = useCallback(async (item) => {
        if (!item?.employeeId) return;
        setCelebrationsDrawer({ open: true, focusItem: item });
        if (item.daysUntil !== 0) return;
        try {
            await openTodayCelebrationEvent(item);
        } catch {
            /* drawer still opens; ensure runs again inside drawer if needed */
        }
    }, [openTodayCelebrationEvent]);

    const openCelebrationsDrawer = useCallback((focusItem = null) => {
        setCelebrationsDrawer({ open: true, focusItem });
    }, []);

    const handleCelebrationReact = useCallback(async (item, emoji) => {
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
    }, [celebrationEvents, getCelebrationItemKey, openTodayCelebrationEvent]);

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

    const queueCards = useMemo(() => {
        const byLabel = Object.fromEntries(approvalSummary.map((item) => [item.label, item.value]));
        return [
            {
                label: 'Leave Approvals',
                value: pendingLeaves,
                badge: pendingLeaves > 0 ? `${pendingLeaves} Queued` : 'Clear',
                badgeClassName: 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'Leave Review',
                icon: <FiCalendar className="h-4 w-4" />,
                onClick: () => setLeaveDrawerOpen(true),
            },
            {
                label: 'Regularization',
                value: byLabel['Regular.'] || 0,
                badge: (byLabel['Regular.'] || 0) > 0 ? `${byLabel['Regular.']} Queued` : 'Clear',
                badgeClassName: 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'Pending Approvals',
                icon: <FiClock className="h-4 w-4" />,
                onClick: () => setApprovalsDrawer({ open: true, escalatedOnly: false }),
            },
            {
                label: 'Expenses',
                value: byLabel.Expenses || 0,
                badge: (byLabel.Expenses || 0) > 0 ? `${byLabel.Expenses} Queued` : 'Clear',
                badgeClassName: 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'Pending Approvals',
                icon: <FiFileText className="h-4 w-4" />,
                onClick: () => setApprovalsDrawer({ open: true, escalatedOnly: false }),
            },
            {
                label: 'Onboarding',
                value: byLabel.Onboarding || 0,
                badge: (byLabel.Onboarding || 0) > 0 ? `${byLabel.Onboarding} Queued` : 'Clear',
                badgeClassName: 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'Pending Approvals',
                icon: <FiUserPlus className="h-4 w-4" />,
                onClick: () => setApprovalsDrawer({ open: true, escalatedOnly: false }),
            },
        ];
    }, [approvalSummary, pendingLeaves]);

    const pulseCards = useMemo(() => {
        const escalated = Number(dashboardExtras.escalatedApprovalsCount || 0);
        return [
            {
                label: 'Total Employees',
                value: formatNumber(orgEmployeeTotal),
                badge: `+${newHires} new`,
                badgeClassName: 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'View Directory',
                icon: <FiUsers className="h-4 w-4" />,
                onClick: () => navigate('/employees'),
            },
            {
                label: "Today's Attendance",
                value: `${todayAttendanceStats.rate.toFixed(1)}%`,
                badge: todayAttendanceStats.rate >= 90 ? 'Optimal' : 'In focus',
                badgeClassName:
                    todayAttendanceStats.rate >= 90
                        ? 'bg-[#D1F5EA] text-[#07523E]'
                        : 'bg-cyan-100 text-cyan-700',
                hint: 'View Attendance',
                icon: <FiCheckCircle className="h-4 w-4" />,
                onClick: () => navigate('/all-attendance-history'),
            },
            {
                label: 'Open Positions',
                value: formatNumber(openPositions),
                badge: openPositions > 0 ? 'Hiring' : 'Stable',
                badgeClassName: 'bg-slate-100 text-slate-600',
                hint: 'View Positions',
                icon: <FiBriefcase className="h-4 w-4" />,
                onClick: () => setJobsDrawerOpen(true),
            },
            {
                label: 'Overdue Approvals',
                value: formatNumber(escalated),
                badge: escalated > 0 ? 'Needs follow-up' : 'Clear',
                badgeClassName:
                    escalated > 0 ? 'bg-orange-100 text-orange-800' : 'bg-[#D1F5EA] text-[#07523E]',
                hint: 'View Details',
                icon: <FiClock className="h-4 w-4" />,
                onClick: () => setApprovalsDrawer({ open: true, escalatedOnly: true }),
            },
        ];
    }, [
        dashboardExtras.escalatedApprovalsCount,
        navigate,
        newHires,
        openPositions,
        orgEmployeeTotal,
        todayAttendanceStats.rate,
    ]);

    const metricsCards = useMemo(
        () => [...queueCards, ...pulseCards],
        [queueCards, pulseCards]
    );

    const quickActions = [
        canAddEmployee && {
            label: 'Add Employee',
            primary: true,
            icon: <FiUserPlus className="h-4 w-4" />,
            onClick: () => setAddEmployeeOpen(true),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM], rbacOpts) && {
            label: `Leave Review${pendingLeaves ? ` (${pendingLeaves})` : ''}`,
            icon: <FiCalendar className="h-4 w-4" />,
            onClick: () => setLeaveDrawerOpen(true),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM], rbacOpts) && {
            label: `Approvals${dashboardExtras.pendingApprovals.length ? ` (${dashboardExtras.pendingApprovals.length})` : ''}`,
            icon: <FiClock className="h-4 w-4" />,
            onClick: () => setApprovalsDrawer({ open: true, escalatedOnly: false }),
        },
        hasAnyPermission(permissions, [PERMISSIONS.EMPLOYEE_VIEW_ALL], rbacOpts) && {
            label: 'Recruitment',
            icon: <FiBriefcase className="h-4 w-4" />,
            onClick: () => setJobsDrawerOpen(true),
        },
        canManageAnnouncements && {
            label: 'Announcements',
            icon: <FiPlus className="h-4 w-4" />,
            onClick: () => {
                loadAnnouncements(20);
                setAnnouncementsListOpen(true);
            },
        },
    ].filter(Boolean);

    const firstName = (user?.name || 'HR').split(/\s+/)[0];
    const showEscalatedBanner =
        !escalatedBannerDismissed && Number(dashboardExtras.escalatedApprovalsCount || 0) > 0;

    const pageLoading = loading || employeesLoading || leavesLoading || allEmployeesLoading;
    const todayLabel = format(new Date(), 'EEEE, do MMMM yyyy');

    if (user?.mustResetPassword) {
        return (
            <div className="hr-dash min-h-screen p-3 sm:p-4">
                <PasswordResetPopup onClose={() => navigate('/login')} />
            </div>
        );
    }

    if (pageLoading) {
        return (
            <div className="hr-dash flex min-h-screen items-center justify-center p-6">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370] border-r-[#0E9370]" />
                    <p className="text-sm text-[#666666]">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="hr-dash flex min-h-screen items-center justify-center p-6">
                <div className="text-center">
                    <p className="mb-4 font-medium text-red-600">Error: {error}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="hr-dash__btn-primary px-6 py-2.5"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="hr-dash flex min-h-screen items-center justify-center p-6">
                <div className="text-center">
                    <p className="mb-4 font-medium text-[#666666]">Please log in to access the dashboard</p>
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="hr-dash__btn-primary px-6 py-2.5"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="hr-dash min-h-screen">
            {showResetPopup && <PasswordResetPopup onClose={() => setShowResetPopup(false)} />}

            {showAnnouncementModal && canManageAnnouncements ? (
                <ModalShell
                    eyebrow="Communications"
                    title="New Announcement"
                    wide
                    onClose={() => setShowAnnouncementModal(false)}
                    footer={
                        <button
                            type="button"
                            className="hr-ov-btn hr-ov-btn--ghost"
                            onClick={() => setShowAnnouncementModal(false)}
                        >
                            Cancel
                        </button>
                    }
                >
                    <NotificationSender
                        open
                        asDrawer={false}
                        onClose={() => setShowAnnouncementModal(false)}
                        onSent={() => {
                            setShowAnnouncementModal(false);
                            loadAnnouncements();
                        }}
                        onDraftSaved={() => {
                            setShowAnnouncementModal(false);
                            loadAnnouncements();
                        }}
                    />
                </ModalShell>
            ) : null}

            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack gap-4">
                <AnnouncementBanner />

                <header className="hr-dash__header">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <p className="hr-dash__eyebrow">HR Workspace</p>
                            <h1 className="hr-dash__title">People dashboard</h1>
                            <p className="hr-dash__subtitle">
                                {firstName} · {departmentLabel} · {todayLabel}
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto xl:max-w-2xl">
                            <label className="relative block min-w-0 flex-1">
                                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search employee or role..."
                                    className="hr-dash__search"
                                />
                            </label>
                            <div className="flex shrink-0 items-center gap-2">
                                {canAddEmployee ? (
                                    <button
                                        type="button"
                                        onClick={() => setAddEmployeeOpen(true)}
                                        className="hr-dash__btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-sm"
                                    >
                                        <FiPlus className="h-4 w-4" />
                                        Add Employee
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => {
                                        loadAnnouncements(20);
                                        setAnnouncementsListOpen(true);
                                    }}
                                    className="hr-dash__icon-btn"
                                    aria-label="Announcements"
                                >
                                    <HiOutlineBell className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProfilePeekOpen(true)}
                                    className="hr-dash__profile-btn"
                                >
                                    <ProfilePicture user={user} size="sm" />
                                    <div className="hidden min-w-0 sm:block">
                                        <p className="truncate text-sm font-semibold text-[#111C2D]">
                                            {user?.name || 'HR'}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <section className="hr-dash__punch">
                    <h3>Punch in / punch out</h3>
                    <AttendanceBox variant="dashboard" />
                </section>

                {showEscalatedBanner ? (
                    <div className="hr-dash__banner">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="hr-dash__banner-icon">
                                <FiClock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-bold text-[#111C2D]">
                                        Overdue Approvals ({dashboardExtras.escalatedApprovalsCount})
                                    </p>
                                    <span className="rounded-full bg-[#E11D48] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                        Urgent
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-[#666666]">
                                    Pending beyond review window
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                className="hr-dash__banner-btn"
                                onClick={() => setApprovalsDrawer({ open: true, escalatedOnly: true })}
                            >
                                Review Escalated ({dashboardExtras.escalatedApprovalsCount})
                            </button>
                            <button
                                type="button"
                                className="hr-dash__icon-btn !h-9 !w-9"
                                aria-label="Dismiss"
                                onClick={() => setEscalatedBannerDismissed(true)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="hr-dash__metrics-band">
                    <div className="hr-dash__metrics-grid">
                        {metricsCards.map((card) => (
                            <button
                                key={card.label}
                                type="button"
                                className="hr-dash__queue-card"
                                onClick={card.onClick}
                            >
                                <div className="hr-dash__queue-top">
                                    <span className="hr-dash__icon-well !h-9 !w-9 text-[#0E9370]">
                                        {card.icon}
                                    </span>
                                    <span className={`hr-dash__badge ${card.badgeClassName || 'bg-[#D1F5EA] text-[#07523E]'}`}>
                                        {card.badge}
                                    </span>
                                </div>
                                <p className="hr-dash__queue-value">
                                    {typeof card.value === 'number' ? formatNumber(card.value) : card.value}
                                </p>
                                <p className="hr-dash__queue-label">{card.label}</p>
                                <p className="hr-dash__queue-hint">
                                    {card.hint} <FiArrowUpRight className="h-3 w-3" />
                                </p>
                            </button>
                        ))}
                    </div>

                    <aside className="hr-dash__celeb hr-dash__celeb--band">
                        <div className="hr-dash__celeb-head">
                            <h3>
                                <FiGift className="h-3.5 w-3.5" />
                                Upcoming celebrations
                            </h3>
                            <button
                                type="button"
                                className="hr-dash__celeb-view-all"
                                onClick={() => openCelebrationsDrawer(null)}
                            >
                                View all
                            </button>
                        </div>
                        <div className="flex flex-1 flex-col p-3">
                            <ul className="space-y-2">
                                {sortCelebrations(dashboardExtras.birthdays || []).slice(0, 4).map((item, idx) => {
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
                                <div className="hr-dash__celeb-empty">
                                    <span className="hr-dash__celeb-empty-icon" aria-hidden="true">
                                        <FiGift />
                                    </span>
                                    <p className="hr-dash__celeb-empty-title">No upcoming celebrations.</p>
                                    <p className="hr-dash__celeb-empty-desc">
                                        We&apos;ll show birthdays, work anniversaries and other special
                                        occasions here.
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </aside>
                </div>

                {canManageAnnouncements ? (
                    <section className={`hr-dash__panel${announcements.length === 0 ? ' hr-dash__panel--announce-empty' : ''}`}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="hr-dash__panel-title text-lg">Announcements</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAnnouncementModal(true)}
                                    className="hr-dash__btn-primary inline-flex h-9 items-center gap-1 px-3 text-xs"
                                >
                                    <FiPlus className="h-3.5 w-3.5" />
                                    New
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/sent-announcements')}
                                    className="hr-dash__btn-ghost !w-auto px-3"
                                >
                                    View All
                                </button>
                            </div>
                        </div>
                        {announcements.length === 0 ? (
                            <div className="hr-dash__announce-empty" role="status">
                                <div className="hr-dash__announce-empty-icon" aria-hidden="true">
                                    <FiSpeaker />
                                </div>
                                <h3 className="hr-dash__announce-empty-title">No Announcements Found</h3>
                                <p className="hr-dash__announce-empty-desc">
                                    You haven&apos;t published any broadcasts yet. Get started by creating
                                    your first corporate announcement.
                                </p>
                                <button
                                    type="button"
                                    className="hr-dash__btn-primary inline-flex h-9 items-center gap-1 px-4 text-xs"
                                    onClick={() => setShowAnnouncementModal(true)}
                                >
                                    <FiPlus className="h-3.5 w-3.5" />
                                    Create Announcement
                                </button>
                            </div>
                        ) : (
                        <div className="space-y-2.5">
                                {announcements.slice(0, 3).map((item) => {
                                    const important =
                                        item.priority === 'high' ||
                                        item.metadata?.important === true ||
                                        item.metadata?.priority === 'high';
                                    const title =
                                        String(item.metadata?.title || '').trim() ||
                                        String(item.message || '')
                                            .replace(/<[^>]+>/g, ' ')
                                            .replace(/\s+/g, ' ')
                                            .trim();
                                    return (
                                        <div key={item._id} className="hr-dash__announce-item">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-xs text-[#666666]">{formatShortDate(item.createdAt)}</p>
                                                {important ? (
                                                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 border border-red-200">
                                                        Important
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-sm font-medium text-[#111C2D]">
                                                {title}
                                            </p>
                                        </div>
                                    );
                                })}
                        </div>
                        )}
                    </section>
                ) : null}

                <div className="hrms-main-rail gap-4">
                    <Panel title="Monthly Hiring vs Attrition">
                        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[#666666]">
                            <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WS.mint }} />
                                Hiring
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WS.peach }} />
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
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-[#666666]">
                            <span>Average team attendance this month</span>
                            <span className="font-medium text-[#0E9370]">Live view</span>
                        </div>
                        <div className="hr-dash__attendance-chart h-[220px] min-w-0 overflow-visible sm:h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={attendanceTrendData}
                                    margin={{ top: 10, right: 8, left: 8, bottom: 8 }}
                                >
                                    <defs>
                                        <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={WS.mint} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={WS.mint} stopOpacity={0.04} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                                    <XAxis
                                        dataKey="day"
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                        padding={{ left: 12, right: 12 }}
                                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                                        dy={6}
                                    />
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
                    <section className="hr-dash__panel">
                        <h2 className="hr-dash__panel-title mb-4 font-bold" style={{ color: HEADCOUNT_CHART.title }}>
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

                    <Panel title="Pending Approvals" actionLabel="View All" onAction={() => setApprovalsDrawer({ open: true, escalatedOnly: false })}>
                        <div className="grid grid-cols-2 gap-2.5">
                            {approvalSummary.map((item) => (
                                <button
                                    key={item.label}
                                    type="button"
                                    className="hr-dash__metric-tile text-left transition hover:bg-[#E8FAF4]"
                                    onClick={() => setApprovalsDrawer({ open: true, escalatedOnly: false })}
                                >
                                    <p className={`text-2xl font-semibold tabular-nums ${item.accent}`}>{String(item.value).padStart(2, '0')}</p>
                                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#666666]">{item.label}</p>
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 space-y-2">
                            {pendingApprovalsPreview.length > 0 ? (
                                pendingApprovalsPreview.map((approval) => (
                                    <button
                                        key={approval._id || approval.taxRegimeRequestId}
                                        type="button"
                                        onClick={() => setApprovalsDrawer({ open: true, escalatedOnly: false })}
                                        className="hr-dash__row-btn"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[#111C2D]">
                                                {approval.entityType || 'Approval'} request
                                            </p>
                                            <p className="truncate text-xs text-[#666666]">
                                                {approval.requestedBy?.name || 'Pending review'}
                                            </p>
                                        </div>
                                        <FiArrowUpRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-center text-xs text-[#666666]">
                                    No pending approvals right now.
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>

                <Panel title="Recent Hires">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-[#666666]">
                            {searchQuery ? `Filtered by "${searchQuery}"` : 'Newest additions to your workforce'}
                        </p>
                    </div>

                    <div className="hr-dash__table overscroll-x-contain">
                        <div className="min-w-[640px]">
                            <div className="hr-dash__table-head grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]">
                                <span>Employee</span>
                                <span>Role</span>
                                <span>Date Joined</span>
                                <span>Status</span>
                                <span className="sr-only">Action</span>
                            </div>

                            {recentHires.length > 0 ? (
                                recentHires.map((employeeItem) => (
                                    <button
                                        key={employeeItem._id}
                                        type="button"
                                        onClick={() => setEmployeeQuickView({ open: true, employee: employeeItem })}
                                        className="hr-dash__table-row grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]"
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            <span className="hr-dash__avatar">
                                                {getEmployeeName(employeeItem).slice(0, 2).toUpperCase()}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold text-[#111C2D]">
                                                    {getEmployeeName(employeeItem)}
                                                </span>
                                                <span className="block truncate text-xs text-[#666666]">
                                                    {employeeItem?.employeeId || employeeItem?.department || 'Department pending'}
                                                </span>
                                            </span>
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm text-[#111C2D]">
                                                {employeeItem?.jobTitle || employeeItem?.position || '--'}
                                            </span>
                                            <span className="block truncate text-xs text-[#666666]">
                                                {employeeItem?.department || ''}
                                            </span>
                                        </span>
                                        <span className="text-sm text-[#475569]">
                                            {formatShortDate(employeeItem?.joiningDate || employeeItem?.createdAt)}
                                        </span>
                                        <span>
                                            <span
                                                className={`hr-dash__status ${
                                                    normalizeText(employeeItem?.status) === 'active'
                                                        ? 'hr-dash__status--active'
                                                        : 'hr-dash__status--other'
                                                }`}
                                            >
                                                {employeeItem?.status || 'Onboarding'}
                                            </span>
                                        </span>
                                        <span className="flex items-center text-[#94A3B8]" aria-hidden="true">
                                            <FiEye className="h-4 w-4" />
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-5 py-10 text-center text-sm text-[#666666]">
                                    No hires matched your current search.
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>

                <div className="hr-dash__life-grid">
                    <div className="hr-dash__life-card">
                        <div className="hr-dash__icon-well mb-3 text-[#0E9370]">
                            <FiUserPlus className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-bold text-[#111C2D]">{formatNumber(openPositions)} Open</p>
                        <p className="text-xs text-[#666666]">Open Positions</p>
                        <button
                            type="button"
                            className="hr-dash__queue-hint mt-3"
                            onClick={() => setJobsDrawerOpen(true)}
                        >
                            Recruitment <FiArrowUpRight className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="hr-dash__life-card">
                        <div className="hr-dash__icon-well mb-3 text-[#476175]">
                            <FiUsers className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-bold text-[#111C2D]">{formatNumber(newHires)} New</p>
                        <p className="text-xs text-[#666666]">Recent Hires</p>
                    </div>
                    <div className="hr-dash__life-card">
                        <div className="hr-dash__icon-well mb-3 text-[#F59E0B]">
                            <FiTrendingDown className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-bold text-[#111C2D]">{attritionRate}%</p>
                        <p className="text-xs text-[#666666]">Attrition Rate</p>
                        <p className="mt-1 text-[11px] text-[#94A3B8]">{terminatedEmployees} recorded exits</p>
                    </div>
                </div>

                <Panel title="Quick Actions">
                    <div className="hr-dash__launcher">
                        {quickActions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                className={`hr-dash__launcher-btn ${action.primary ? 'hr-dash__launcher-btn--primary' : ''}`}
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        ))}
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

            <ApprovalsDrawer
                open={approvalsDrawer.open}
                escalatedOnly={approvalsDrawer.escalatedOnly}
                approvals={dashboardExtras.pendingApprovals}
                onClose={() => setApprovalsDrawer({ open: false, escalatedOnly: false })}
                onChanged={fetchDashboardExtras}
            />
            <LeaveDrawer
                open={leaveDrawerOpen}
                leaves={leaves}
                onClose={() => setLeaveDrawerOpen(false)}
                onChanged={() => queryClient.invalidateQueries({ queryKey: ['leaves'] })}
            />
            <WishModal
                open={wishModal.open}
                item={wishModal.item}
                eventId={wishModal.eventId}
                onClose={() => setWishModal({ open: false, item: null, eventId: null })}
            />
            <CelebrationsDrawer
                open={celebrationsDrawer.open}
                items={dashboardExtras.birthdays || []}
                focusItem={celebrationsDrawer.focusItem}
                eventsByKey={celebrationEvents}
                reacting={celebrationReacting}
                onClose={() => setCelebrationsDrawer({ open: false, focusItem: null })}
                onReact={handleCelebrationReact}
                onEnsureEvent={openTodayCelebrationEvent}
            />
            <EmployeeQuickViewModal
                open={employeeQuickView.open}
                employee={employeeQuickView.employee}
                onClose={() => setEmployeeQuickView({ open: false, employee: null })}
                onEditFull={(emp) => {
                    setEmployeeQuickView({ open: false, employee: null });
                    if (emp?._id) navigate(`/employees/${emp._id}`);
                }}
            />
            <AddEmployeeModal
                open={addEmployeeOpen}
                onClose={() => setAddEmployeeOpen(false)}
                onContinueFull={(prefill) => {
                    setAddEmployeeOpen(false);
                    navigate('/add-employee', { state: { quickPrefill: prefill } });
                }}
            />
            <JobsDrawer
                open={jobsDrawerOpen}
                jobs={dashboardExtras.openJobs}
                onClose={() => setJobsDrawerOpen(false)}
            />
            <AnnouncementsListModal
                open={announcementsListOpen}
                items={announcements}
                onClose={() => setAnnouncementsListOpen(false)}
                onNew={
                    canManageAnnouncements
                        ? () => {
                              setAnnouncementsListOpen(false);
                              setShowAnnouncementModal(true);
                          }
                        : undefined
                }
            />
            <ProfilePeekModal
                open={profilePeekOpen}
                user={user}
                onClose={() => setProfilePeekOpen(false)}
            />
        </div>
    );
};

export default DashboardHR;
