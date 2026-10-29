import "../styles/roleDashboards.css";
import "../styles/adminDashboard.css";
import AdminDashboardOverlays from "./Dashboard/AdminDashboardOverlays";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FiArrowUpRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiGift,
  FiArrowRight,
  FiHeadphones,
  FiPlus,
  FiUserPlus,
  FiUsers
} from "react-icons/fi";
import { useEmployees, useLeaves, usePayrolls, useProjects } from "../Hooks/useDashboardData";
import axios from "../utils/axios";
import { handleApiError } from "../utils/errorHandler";
import AnnouncementModal from "./AnnouncementModal";
import useAuthPermissions from "../Hooks/useAuthPermissions";
import { PERMISSIONS, hasAnyPermission } from "../utils/permissions";
import PermissionGate from "../components/PermissionGate";
import { BOTH_CELEBRATION_ENDPOINT } from "../utils/constant";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  ProgressBar,
  Skeleton,
} from "../components/ui";


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

function AttendanceDonut({ present, late, absent }) {
  const onTime = Math.max(present - late, 0);
  const slices = [
    { key: 'present', value: onTime, color: 'var(--color-primary)' },
    { key: 'late', value: late, color: 'var(--ui-warning)' },
    { key: 'absent', value: absent, color: 'var(--ui-danger)' },
  ];
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total <= 0) {
    return (
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--ui-outline)" strokeWidth="14" />
      </svg>
    );
  }

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Attendance: ${present} present, ${late} late, ${absent} absent`}>
      <g transform="rotate(-90 60 60)">
        {slices.map((slice) => {
          if (slice.value <= 0) return null;
          const length = (slice.value / total) * circumference;
          const dashOffset = offset;
          offset += length;
          return (
            <circle
              key={slice.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </g>
      <text x="60" y="56" textAnchor="middle" className="fill-[var(--ui-on-surface)]" style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--ui-font)' }}>
        {present}
      </text>
      <text x="60" y="72" textAnchor="middle" className="fill-[var(--ui-muted)]" style={{ fontSize: '0.65rem', fontFamily: 'var(--ui-font)' }}>
        Present
      </text>
    </svg>
  );
}

function PayrollDonut({ rows, total, formatCurrency }) {
  const colors = ['#238aff', '#0e9370', '#a855f7', '#ff9d19', '#fb7185', '#5caea0'];
  let offset = 0;
  return <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label={`Total payroll ${formatCurrency(total)}`}>
    <circle cx="80" cy="80" r="61" fill="none" stroke="#e2e8f0" strokeWidth="20" />
    <g transform="rotate(-90 80 80)">{total > 0 && rows.map((row, index) => {
      const length = Math.max(0, row.amount) / total * 100;
      const start = offset; offset += length;
      return <circle key={row.department} cx="80" cy="80" r="61" fill="none" stroke={colors[index % colors.length]} strokeWidth="20" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} />;
    })}</g>
    <text x="80" y="77" textAnchor="middle" fill="#111c2d" fontSize="17" fontWeight="700">{formatCurrency(total)}</text>
    <text x="80" y="96" textAnchor="middle" fill="#62748d" fontSize="11">Total payroll</text>
  </svg>;
}

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
        <li
          className={`ui-card min-w-0 overflow-hidden !p-3 sm:!p-3.5 ${isToday ? '' : '!bg-[var(--ui-neutral)]'}`}
          style={isToday ? { borderColor: 'color-mix(in srgb, var(--ui-tertiary) 35%, transparent)', background: 'color-mix(in srgb, var(--ui-tertiary-soft) 70%, var(--ui-neutral))' } : undefined}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-tertiary)]">{header}</p>
                    <p className="truncate font-semibold text-[var(--ui-on-surface)]">{icon} {isSelf ? 'You' : item?.name || 'Team member'}</p>
                    <p className="break-words text-xs text-[var(--ui-muted)]">
                        {(isMarriage || isWorkAnniversary) && item?.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {dateLabel ? `${dateLabel} · ` : ''}{typeLabel} · {whenLabel}
                    </p>
                </div>
                {onWishes ? (
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => onWishes(item)}
                        className="!rounded-full !min-w-[4.75rem] shrink-0"
                    >
                        {isToday ? 'Wishes' : 'Upcoming'}
                    </Button>
                ) : null}
            </div>
            {isToday && onReact ? (
                <div className="mt-3 flex flex-wrap gap-2.5">
                    {CELEBRATION_REACTIONS.map((emoji) => {
                        const count = counts[emoji] || 0;
                        return (
                            <button
                                key={emoji}
                                type="button"
                                disabled={reacting}
                                onClick={() => onReact(item, emoji)}
                                aria-label={`React ${emoji}`}
                                aria-pressed={count > 0}
                                className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-[var(--color-primary)] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50 ${count > 0 ? 'border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)]' : 'border-[var(--ui-outline)]'}`}
                            >
                                <span>{emoji}</span>
                                {count > 0 ? <span className="text-xs font-semibold text-[var(--ui-muted)]">{count}</span> : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </li>
    );
}

const selectAuth = (state) => state.auth || {};

function DashboardAdmin() {
  const navigate = useNavigate();
  const authState = useSelector(selectAuth);
  const user = authState?.user;
  const { permissions, permissionFlags } = useAuthPermissions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [extrasError, setExtrasError] = useState('');
  const [overlay, setOverlay] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarError, setCalendarError] = useState('');
  const [payrollMonth, setPayrollMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const can = (keys) => hasAnyPermission(permissions, keys, { isOrgOwner: !!permissionFlags.isOrgOwner });
  const canApproveLeave = can([PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM]);
  const openOverlay = (kind, details = {}) => {
    const allowed = {
      employees: can([PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM]),
      employee: can([PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM]),
      attendance: can([PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM]),
      payroll: can([PERMISSIONS.PAYROLL_VIEW_ALL]),
      addEmployee: !!permissionFlags.isOrgOwner,
      leave: can([PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM]),
      approvals: canApproveLeave,
      calendar: can([PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE]),
    };
    if (allowed[kind] === false) return;
    setShowAnnouncementModal(false);
    setOverlay({ kind, ...details });
  };
  const canViewCalendar = can([PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE]);
  useEffect(() => {
    if (!canViewCalendar) return;
    let cancelled = false;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    axios.get(`/v1/admin/calendar/${now.getFullYear()}`, { withCredentials: true })
      .then(result => {
        if (cancelled) return;
        const events = (result.data?.data || result.data)?.holidays || [];
        setCalendarEvents(events.filter(event => event.isActive !== false && new Date(event.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3));
      }).catch(() => { if (!cancelled) setCalendarError('Unable to load calendar events.'); });
    return () => { cancelled = true; };
  }, [canViewCalendar]);
  const [todayStatus, setTodayStatus] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const closeAnnouncementModal = useCallback(() => setShowAnnouncementModal(false), []);
  const handleAnnouncementSent = async () => {
    closeAnnouncementModal();
    try {
      const { data } = await axios.get('/v1/both/notification/sent-announcements', {
        params: { scope: 'organization', page: 1, limit: 3 },
        withCredentials: true
      });
      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
    } catch {
      // Keep the current list visible if the optional refresh fails.
    }
  };
  const [escalatedApprovalsCount, setEscalatedApprovalsCount] = useState(0);
  const [celebrations, setCelebrations] = useState([]);
  const [celebrationEvents, setCelebrationEvents] = useState({});
  const [celebrationReacting, setCelebrationReacting] = useState(false);

  const {
    data: employeeData = { employees: [], total: 0 },
    isLoading: employeesLoading,
    error: employeesError
  } = useEmployees();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: payrolls = [], isLoading: payrollsLoading } = usePayrolls();
  const { data: leaves = [], isLoading: leavesLoading } = useLeaves();

  const employees = useMemo(() => employeeData?.employees ?? [], [employeeData]);
  const employeeCount = employeeData?.total ?? employees.length;
  const isLoading = employeesLoading || projectsLoading || payrollsLoading || leavesLoading;

  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (!user && userRole !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (employeesError) {
      handleApiError(employeesError, {
        context: "Admin Dashboard",
        showToast: employeesError.response?.status !== 401
      });
    }
  }, [employeesError]);

  useEffect(() => {
    const loadDashboardExtras = async () => {
      setExtrasLoading(true); setExtrasError('');
      try {
        const [todayRes, announcementsRes, escalatedRes, celebrationsRes, anniversariesRes] = await Promise.all([
          axios.get("/v1/both/attendance/today-status", { withCredentials: true }),
          axios.get("/v1/both/notification/sent-announcements", {
            params: { scope: "organization", page: 1, limit: 3 },
            withCredentials: true
          }),
          axios.get("/v1/admin/approvals/escalated-count", { withCredentials: true }).catch(() => null),
          axios.get("/v1/both/profile-details/upcoming-birthdays", { withCredentials: true }),
          axios.get("/v1/both/profile-details/upcoming-anniversaries", { withCredentials: true })
        ]);

        const todayList = todayRes?.data?.data || [];
        const recentAnnouncements = announcementsRes?.data?.announcements || [];
        setTodayStatus(Array.isArray(todayList) ? todayList : []);
        setAnnouncements(Array.isArray(recentAnnouncements) ? recentAnnouncements : []);
        setEscalatedApprovalsCount(
          Number(escalatedRes?.data?.data?.count ?? 0)
        );
        const celebrationItems = celebrationsRes?.data?.celebrations || [
          ...(celebrationsRes?.data?.birthdays || []),
          ...(celebrationsRes?.data?.marriageAnniversaries || [])
        ];
        setCelebrations(sortCelebrations([...(Array.isArray(celebrationItems) ? celebrationItems : []), ...(anniversariesRes?.data?.anniversaries || [])]));
      } catch {
        setExtrasError('Some dashboard details could not be loaded. Retry to refresh attendance, celebrations and announcements.');
      } finally { setExtrasLoading(false); }
    };

    loadDashboardExtras();
  }, [refreshKey]);

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return "0";
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "--";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "--";
      return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "--";
    }
  };

  const todayAttendanceStats = useMemo(() => {
    const total = todayStatus.length || employeeCount;
    const present = todayStatus.filter((x) => x.status !== "absent").length;
    const late = todayStatus.filter((x) => x.isLateArrival).length;
    const absent = Math.max((total || 0) - present, 0);
    return { total, present, late, absent };
  }, [todayStatus, employeeCount]);

  const pendingLeaves = useMemo(
    () => leaves.filter((leave) => String(leave?.status || "").toLowerCase() === "pending").length,
    [leaves]
  );

  const payrollMonths = useMemo(() => {
    const keyFor = payroll => {
      if (payroll.month != null && payroll.year) {
        const parsed = new Date(`${payroll.month} 1, ${payroll.year}`);
        if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      }
      const date = new Date(payroll.createdAt || payroll.updatedAt || payroll.date);
      return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };
    return { keyFor, options: [...new Set([payrollMonth, ...payrolls.map(keyFor).filter(Boolean)])].sort().reverse() };
  }, [payrolls, payrollMonth]);
  const periodPayrolls = payrolls.filter(payroll => payrollMonths.keyFor(payroll) === payrollMonth);
  const monthlyPayrollTotal = periodPayrolls.reduce((sum, payroll) => sum + (Number(payroll.amount || payroll.totalAmount || payroll.netSalary || 0) || 0), 0);

  const newHires = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      const aDate = new Date(a?.createdAt || a?.joiningDate || 0).getTime();
      const bDate = new Date(b?.createdAt || b?.joiningDate || 0).getTime();
      return bDate - aDate;
    });
    return sorted.slice(0, 4);
  }, [employees]);

  const payrollByDepartment = useMemo(() => {
    const departments = new Map();
    payrolls.filter(payroll => payrollMonths.keyFor(payroll) === payrollMonth).forEach(payroll => {
      const department = payroll.department || payroll.employeeId?.department || 'General';
      const row = departments.get(department) || { department, amount: 0, employees: new Set() };
      row.amount += Number(payroll.amount || payroll.totalAmount || payroll.netSalary || 0) || 0;
      const employeeId = payroll.employeeId?._id || payroll.employeeId || payroll.employee?._id;
      if (employeeId) row.employees.add(String(employeeId));
      departments.set(department, row);
    });
    return [...departments.values()].map(row => ({ ...row, count: row.employees.size }));
  }, [payrolls, payrollMonth, payrollMonths]);

  const approvalsPreview = leaves
    .filter((leave) => String(leave?.status || "").toLowerCase() === "pending")
    .slice(0, 4);

  const greetingName = user?.name || user?.email?.split("@")?.[0] || "Admin";
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const getInitials = (name = '') => String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'EM';
  const getCelebrationItemKey = (item) => `${item?.type || "birthday"}_${item?.employeeId}`;

  const openTodayCelebrationEvent = async (item) => {
    const { data } = await axios.post(
      `${BOTH_CELEBRATION_ENDPOINT}/events/open`,
      { employeeId: item.employeeId, type: item.type || "birthday" },
      { withCredentials: true }
    );
    const event = data?.data;
    if (event?._id) {
      const itemKey = getCelebrationItemKey(item);
      setCelebrationEvents((prev) => ({ ...prev, [itemKey]: event }));
    }
    return event;
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
      const eventStateKey = data?.data?.type && data?.data?.employeeId
        ? `${data.data.type}_${data.data.employeeId}`
        : itemKey;
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

  const headerActions = (
    <>
      <Button type="button" variant="outlined" onClick={() => openOverlay("helpdesk")}>
        <FiHeadphones className="h-4 w-4" aria-hidden />
        Helpdesk
      </Button>
      <PermissionGate permissions={[PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM]}>
      <Button type="button" variant="outlined" onClick={() => openOverlay("attendance")}>
        <FiCheckCircle className="h-4 w-4" aria-hidden />
        Today&apos;s Attendance
      </Button>
      </PermissionGate>
      <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
        <Button type="button" variant="outlined" onClick={() => openOverlay("payroll")}>
          <FiDollarSign className="h-4 w-4" aria-hidden />
          Run Payroll
        </Button>
      </PermissionGate>
      {permissionFlags.isOrgOwner ? (
        <Button type="button" variant="primary" onClick={() => openOverlay("addEmployee")}>
          <FiPlus className="h-4 w-4" aria-hidden />
          Add Employee
        </Button>
      ) : null}
    </>
  );

  if (isLoading) {
    return <div className="admin-dash role-dashboard role-dashboard--admin page-shell"><div className="page-shell-inner space-y-4"><Skeleton variant="title" /><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[1, 2, 3, 4].map(item => <Skeleton key={item} variant="card" />)}</div><Skeleton variant="card" className="!h-64" /></div></div>;
  }

  const attendanceRate = todayAttendanceStats.total > 0 ? Math.round(todayAttendanceStats.present / todayAttendanceStats.total * 100) : 0;
  const metric = (label, value, meta, Icon, kind, tone) => (
    <button type="button" className={`admin-dash__metric admin-dash__metric--${tone}`} onClick={() => openOverlay(kind)} disabled={
      kind === 'employees' ? !can([PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM]) :
      kind === 'attendance' ? !can([PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM]) :
      kind === 'leave' ? !can([PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM]) : !canApproveLeave
    }>
      <span className="admin-dash__metric-icon"><Icon aria-hidden /></span>
      <span><span className="admin-dash__metric-label">{label}</span><strong className="admin-dash__metric-value">{value}</strong><small>{meta}</small></span>
    </button>
  );
  const panelHead = (title, Icon, action, onAction) => <div className="admin-dash__panel-head"><h2><Icon aria-hidden />{title}</h2>{action && <Button type="button" variant="outlined" size="sm" onClick={onAction}>{action}<FiArrowRight aria-hidden /></Button>}</div>;

  return (
    <>
      {showAnnouncementModal && <AnnouncementModal onClose={closeAnnouncementModal} onSent={handleAnnouncementSent} />}
      <div className="admin-dash role-dashboard role-dashboard--admin page-shell">
        <div className="page-shell-inner role-dashboard__stack">
          <PageHeader className="role-dashboard__header" title={`${greeting}, ${greetingName}!`} subtitle="Here's what's happening in your organization today." actions={<div className="flex flex-wrap justify-end gap-2">{headerActions}</div>} />
          {extrasError && <div role="alert" className="admin-dash__list-row"><span>{extrasError}</span><Button type="button" variant="outlined" onClick={() => setRefreshKey(value => value + 1)}>Refresh dashboard</Button></div>}
          {employeesError && <ErrorBanner message={employeesError.response?.data?.message || 'Failed to load employees'} />}
          <div className="admin-dash__metrics">
            {metric('Total Employees', employeeCount, `${projects.length} active project${projects.length === 1 ? '' : 's'}`, FiUsers, 'employees', 'blue')}
            {metric('Present Today', extrasLoading ? '…' : todayAttendanceStats.present, `of ${todayAttendanceStats.total || employeeCount} employees`, FiCalendar, 'attendance', 'green')}
            {metric('Pending Leave', pendingLeaves, 'needs review', FiClock, 'leave', 'amber')}
            {metric('Overdue Approvals', extrasLoading ? '…' : escalatedApprovalsCount, escalatedApprovalsCount ? 'needs attention' : 'clear', FiFileText, 'approvals', 'red')}
          </div>

          <div className="admin-dash__grid">
            <Card className="admin-dash__celebrations">
              <div className="admin-dash__celebration-head"><h2><FiGift aria-hidden />Upcoming celebrations</h2><button type="button" onClick={() => openOverlay('celebrations')}>View all</button></div>
              <div className="admin-dash__celebration-body">
                {celebrations.length ? <ul className="space-y-3">{celebrations.slice(0, 3).map((item, index) => <CelebrationDashboardCard key={getCelebrationItemKey(item) || index} item={item} event={celebrationEvents[getCelebrationItemKey(item)]} reacting={celebrationReacting} onReact={handleCelebrationReact} onWishes={item => openOverlay('celebrations', { item })} />)}</ul> : <div className="admin-dash__celebration-empty"><span><FiGift aria-hidden /></span><strong>No upcoming celebrations.</strong><p>We'll show birthdays, work anniversaries and other special occasions here.</p></div>}
              </div>
            </Card>

            <Card className="admin-dash__announcements">
              <div className="admin-dash__announcement-head"><h2>Announcements</h2><Button type="button" variant="outlined" aria-label="New announcement" onClick={() => { setOverlay(null); setShowAnnouncementModal(true); }}><FiPlus aria-hidden />New</Button></div>
              <div className="admin-dash__announcement-body">
              {announcements.length ? <div className="admin-dash__announcement-grid">{announcements.map(item => <button key={item._id} type="button" className="admin-dash__list-row" onClick={() => openOverlay('announcements')}><time className="admin-dash__announcement-date">{formatDate(item.createdAt)}</time><strong className="admin-dash__grow">{String(item.metadata?.title || item.message || '').replace(/<[^>]+>/g, ' ').trim()}</strong></button>)}</div> : <EmptyState title="No announcements yet" />}

              <div className="admin-dash__footer-actions"><Button type="button" variant="outlined" className="admin-dash__view-announcements" aria-label="Sent announcements" onClick={() => openOverlay('announcements')}>View All Announcements</Button></div>
              </div>
            </Card>

            <Card className="admin-dash__attendance">
              {panelHead('Attendance Today', FiCalendar, can([PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM]) ? 'View today' : null, () => openOverlay('attendance'))}
              <div className="admin-dash__attendance-content">
                <div className="admin-dash__attendance-chart"><AttendanceDonut {...todayAttendanceStats} /><span>Attendance rate</span><strong>{attendanceRate}%</strong><small>{todayAttendanceStats.present} of {todayAttendanceStats.total || employeeCount} present today</small></div>
                <ul className="admin-dash__attendance-rows">
                  {[['Present', todayAttendanceStats.present, 'green'], ['Absent', todayAttendanceStats.absent, 'red'], ['Late', todayAttendanceStats.late, 'amber']].map(([label, count, tone]) => {
                    const percentage = todayAttendanceStats.total > 0 ? Math.round(count / todayAttendanceStats.total * 100) : 0;
                    return <li key={label} className={`admin-dash__attendance-row admin-dash__metric--${tone}`}>{label === 'Late' ? <FiClock aria-hidden /> : <FiUsers aria-hidden />}<span>{label}</span><strong>{count}</strong><div><small>{percentage}%</small><ProgressBar value={percentage} /></div></li>;
                  })}
                </ul>
              </div>
            </Card>



            <Card className="admin-dash__events">
              {panelHead('Upcoming Events', FiCalendar, can([PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE]) ? 'View calendar' : null, () => openOverlay('calendar'))}
              {calendarError ? <p role="alert" className="text-sm text-red-700">{calendarError}</p> : calendarEvents.length ? <div className="space-y-2">{calendarEvents.map((event, index) => <button type="button" className="admin-dash__list-row admin-dash__event" key={event._id || index} onClick={() => openOverlay('calendar')}><span className="admin-dash__event-date"><strong>{new Date(event.date).getDate()}</strong><small>{new Date(event.date).toLocaleDateString([], { month: 'short' })}</small></span><span><strong>{event.name}</strong><small>{event.description || event.type || 'Calendar event'}</small></span></button>)}</div> : <EmptyState title="No upcoming calendar events" />}
            </Card>



            <Card className="admin-dash__leaves">
              {panelHead('Pending Leave', FiClock, can([PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM]) ? 'Review all' : null, () => openOverlay('leave'))}
              {approvalsPreview.length ? <div className="space-y-2">{approvalsPreview.map(leave => <button type="button" key={leave._id} className="admin-dash__list-row" onClick={() => openOverlay('leave', { leave })} disabled={!can([PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM])}><span className="admin-dash__avatar">{getInitials(leave.employeeName || leave.employee?.name || 'Employee')}</span><span className="admin-dash__grow"><strong>{leave.employeeName || leave.employee?.name || 'Employee'}</strong><small>{leave.leaveType || 'Leave'} · {leave.totalDays || leave.numberOfDays || 1} day(s)</small></span><span className="admin-dash__date">{formatDate(leave.startDate || leave.fromDate || leave.createdAt)}</span><span className="admin-dash__review">Review</span><FiArrowRight aria-hidden /></button>)}</div> : <EmptyState title="No pending requests" />}
            </Card>

            <Card className="admin-dash__hires">
              {panelHead('New Hires', FiUserPlus, can([PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM]) ? 'View all' : null, () => openOverlay('employees'))}
              {newHires.length ? <div className="space-y-2">{newHires.map(employee => <button type="button" key={employee._id || employee.id} className="admin-dash__list-row" onClick={() => openOverlay('employee', { employee })} disabled={!can([PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM])}><span className="admin-dash__avatar">{getInitials(`${employee.name || ''} ${employee.lastName || ''}`)}</span><span className="admin-dash__grow"><strong>{employee.name} {employee.lastName}</strong><small>{employee.position || employee.jobTitle || 'Team member'} · Joined {formatDate(employee.joiningDate || employee.createdAt)}</small></span><span className="admin-dash__view"><FiEye aria-hidden /> View</span></button>)}</div> : <EmptyState title="No recent hires found" />}
            </Card>

            {can([PERMISSIONS.PAYROLL_VIEW_ALL]) && <Card className="admin-dash__payroll">
              <div className="admin-dash__panel-head"><h2><FiDollarSign aria-hidden /><span>Payroll by Department<small>This period's payroll distribution</small></span></h2><select aria-label="Payroll month" className="admin-dash__month" value={payrollMonth} onChange={event => setPayrollMonth(event.target.value)}>{payrollMonths.options.map(month => <option key={month} value={month}>{new Date(`${month}-01T12:00:00`).toLocaleDateString([], { month: 'short', year: 'numeric' })}</option>)}</select></div>
              {payrollByDepartment.length ? <div className="admin-dash__payroll-content"><button type="button" className="admin-dash__payroll-total" onClick={() => openOverlay('payroll')}><PayrollDonut rows={payrollByDepartment} total={monthlyPayrollTotal} formatCurrency={formatCurrency} /><small>View payroll details →</small></button><ul className="admin-dash__payroll-legend" aria-label="Payroll distribution">{payrollByDepartment.map((row, index) => <li key={row.department}><span aria-hidden style={{ backgroundColor: ['#238aff', '#0e9370', '#a855f7', '#ff9d19', '#fb7185', '#5caea0'][index % 6] }} /><span className="admin-dash__grow">{row.department}</span><strong>{formatCurrency(row.amount)}</strong><small>({monthlyPayrollTotal > 0 ? Math.round(row.amount / monthlyPayrollTotal * 100) : 0}%)</small></li>)}</ul><div className="admin-dash__table"><table><thead><tr><th>Department</th><th>Employees</th><th>Total payroll</th><th>Avg. salary</th></tr></thead><tbody>{payrollByDepartment.map(row => <tr key={row.department}><th scope="row">{row.department}</th><td>{row.count || '—'}</td><td>{formatCurrency(row.amount)}</td><td>{row.count ? formatCurrency(row.amount / row.count) : '—'}</td></tr>)}</tbody></table></div></div> : <EmptyState title="No payroll data for this period" />}
            </Card>}
          </div>
          <div className="admin-dash__footer-actions">{can([PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM]) && <Button type="button" variant="outlined" onClick={() => navigate('/all-attendance-history')}>Today's log</Button>}{can([PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM]) && <Button type="button" variant="outlined" onClick={() => openOverlay('leave')}>Leave report</Button>}</div>
        </div>
      </div>
      <AdminDashboardOverlays overlay={overlay} onClose={() => setOverlay(null)} onChanged={() => setRefreshKey(value => value + 1)} employees={employees} leaves={leaves} canApproveLeave={canApproveLeave} celebrations={celebrations} celebrationEvents={celebrationEvents} reacting={celebrationReacting} onReact={handleCelebrationReact} onEnsureEvent={openTodayCelebrationEvent} announcements={announcements} onNewAnnouncement={() => { setOverlay(null); setShowAnnouncementModal(true); }} onEmployee={employee => setOverlay({ kind: 'employee', employee })} onFullEmployee={employee => { setOverlay(null); navigate(`/employees/${employee._id || employee.id}`); }} />
    </>
  );
}

export default DashboardAdmin;
