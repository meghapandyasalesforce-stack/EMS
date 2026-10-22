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
  FiHeadphones,
  FiPlus,
  FiUserPlus,
  FiUsers
} from "react-icons/fi";
import { useEmployees, useLeaves, usePayrolls, useProjects } from "../Hooks/useDashboardData";
import axios from "../utils/axios";
import { toast } from "react-toastify";
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
  StatCard,
  StatusPill,
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

  const employees = employeeData?.employees ?? [];
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
      try {
        const [todayRes, announcementsRes, escalatedRes, celebrationsRes] = await Promise.all([
          axios.get("/v1/both/attendance/today-status", { withCredentials: true }),
          axios.get("/v1/both/notification/sent-announcements", {
            params: { scope: "organization", page: 1, limit: 3 },
            withCredentials: true
          }),
          axios.get("/v1/admin/approvals/escalated-count", { withCredentials: true }).catch(() => null),
          axios.get("/v1/both/profile-details/upcoming-birthdays", { withCredentials: true }).catch(() => null)
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
        setCelebrations(sortCelebrations(Array.isArray(celebrationItems) ? celebrationItems : []));
      } catch {
        // Keep dashboard functional when optional sections fail.
      }
    };

    loadDashboardExtras();
  }, []);

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

  const monthlyPayrollTotal = useMemo(() => {
    const now = new Date();
    return payrolls.reduce((sum, payroll) => {
      const dateCandidate = payroll?.createdAt || payroll?.updatedAt || payroll?.date;
      const d = dateCandidate ? new Date(dateCandidate) : null;
      const isCurrentMonth =
        d &&
        !isNaN(d.getTime()) &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      if (!isCurrentMonth) return sum;
      const value = Number(payroll?.amount || payroll?.totalAmount || payroll?.netSalary || 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [payrolls]);

  const newHires = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      const aDate = new Date(a?.createdAt || a?.joiningDate || 0).getTime();
      const bDate = new Date(b?.createdAt || b?.joiningDate || 0).getTime();
      return bDate - aDate;
    });
    return sorted.slice(0, 4);
  }, [employees]);

  const payrollByDepartment = useMemo(() => {
    const deptMap = new Map();
    payrolls.forEach((payroll) => {
      const department = payroll?.department || payroll?.employeeId?.department || "General";
      const amount = Number(payroll?.amount || payroll?.totalAmount || payroll?.netSalary || 0);
      deptMap.set(department, (deptMap.get(department) || 0) + (Number.isFinite(amount) ? amount : 0));
    });
    const rows = [...deptMap.entries()].map(([department, amount]) => ({ department, amount }));
    const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
    return rows.slice(0, 4).map((r) => ({
      ...r,
      progress: max > 0 ? Math.round((r.amount / max) * 100) : 0
    }));
  }, [payrolls]);

  const upcomingEvents = useMemo(() => {
    const base = new Date();
    return [
      { label: "Today", date: base, tag: "Today" },
      { label: "Tomorrow", date: new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1), tag: "Event" },
      { label: "Review", date: new Date(base.getFullYear(), base.getMonth(), base.getDate() + 3), tag: "Reminder" }
    ];
  }, []);

  const rbacOpts = { isOrgOwner: !!permissionFlags.isOrgOwner };
  const quickShortcuts = useMemo(
    () =>
      [
        hasAnyPermission(permissions, [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM], rbacOpts) && {
          label: "Today's Live Attendance",
          icon: <FiCheckCircle />,
          variant: "dark",
          action: () => navigate("/today-attendance"),
        },
        hasAnyPermission(permissions, [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM], rbacOpts) && {
          label: "Today's Log",
          icon: <FiClock />,
          variant: "secondary",
          action: () => navigate("/all-attendance-history"),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM], rbacOpts) && {
          label: "Leave Report",
          icon: <FiFileText />,
          variant: "dark",
          action: () => navigate("/leave-management"),
        },
        permissionFlags.isOrgOwner && {
          label: "Add Employee",
          icon: <FiUserPlus />,
          variant: "primary",
          action: () => navigate("/add-employee"),
        },
      ].filter(Boolean),
    [permissions, permissionFlags, navigate]
  );

  const approvalsPreview = leaves
    .filter((leave) => String(leave?.status || "").toLowerCase() === "pending")
    .slice(0, 4);

  const greetingName = user?.name || user?.email?.split("@")?.[0] || "Admin";
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const getInitials = (name = "") => {
    const parts = name.trim().split(" ").filter(Boolean);
    if (!parts.length) return "EM";
    return parts
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  };

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
      navigate(eventId ? `/celebrations/${eventId}` : "/celebrations");
    } catch {
      navigate("/celebrations");
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
      <Button type="button" variant="outlined" onClick={() => navigate("/helpdesk")}>
        <FiHeadphones className="h-4 w-4" aria-hidden />
        Helpdesk
      </Button>
      <Button type="button" variant="outlined" onClick={() => navigate("/today-attendance")}>
        <FiCheckCircle className="h-4 w-4" aria-hidden />
        Today&apos;s Live Attendance
      </Button>
      <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
        <Button type="button" variant="outlined" onClick={() => navigate("/admin-payroll")}>
          <FiDollarSign className="h-4 w-4" aria-hidden />
          Run Payroll
        </Button>
      </PermissionGate>
      {permissionFlags.isOrgOwner ? (
        <Button type="button" variant="primary" onClick={() => navigate("/add-employee")}>
          <FiPlus className="h-4 w-4" aria-hidden />
          Add Employee
        </Button>
      ) : null}
    </>
  );

  if (isLoading) {
    return (
      <div className="page-shell min-h-screen bg-[var(--ui-neutral)]" style={{ fontFamily: 'var(--ui-font)' }}>
        <div className="page-shell-inner space-y-4 sm:space-y-5">
          <Skeleton variant="title" className="!w-64" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton variant="card" className="lg:col-span-2 !h-48" />
            <Skeleton variant="card" className="!h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showAnnouncementModal && (
        <AnnouncementModal onClose={closeAnnouncementModal} onSent={handleAnnouncementSent} />
      )}
    <div className="page-shell min-h-screen bg-[var(--ui-neutral)]" style={{ fontFamily: 'var(--ui-font)' }}>
      <div className="page-shell-inner space-y-3 sm:space-y-5">
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              Admin Dashboard
              <StatusPill tone={escalatedApprovalsCount > 0 ? 'urgent' : 'success'}>
                {escalatedApprovalsCount > 0 ? 'Needs attention' : 'All clear'}
              </StatusPill>
            </span>
          }
          subtitle={`Good morning, ${greetingName} · ${todayLabel}`}
          actions={<div className="hidden flex-wrap justify-end gap-2 sm:flex">{headerActions}</div>}
        />

        {/* Mobile header actions — same handlers as desktop */}
        <div className="flex flex-col gap-2 sm:hidden">
          {permissionFlags.isOrgOwner ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate("/add-employee")}
              className="!h-11 w-full !rounded-2xl"
            >
              <FiPlus className="h-4 w-4" aria-hidden />
              Add employee
            </Button>
          ) : null}
          <div className="flex overflow-hidden rounded-2xl border border-[var(--ui-outline-subtle)] bg-white">
            <button
              type="button"
              onClick={() => navigate("/helpdesk")}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-medium text-[var(--ui-on-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--ui-neutral)]"
            >
              <FiHeadphones className="h-4 w-4 shrink-0 text-[var(--ui-muted)]" aria-hidden />
              Helpdesk
            </button>
            <button
              type="button"
              onClick={() => navigate("/today-attendance")}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-l border-[var(--ui-outline-subtle)] px-2 text-[13px] font-medium text-[var(--ui-on-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--ui-neutral)]"
            >
              <FiCheckCircle className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
              Attendance
            </button>
            <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
              <button
                type="button"
                onClick={() => navigate("/admin-payroll")}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-l border-[var(--ui-outline-subtle)] px-2 text-[13px] font-medium text-[var(--ui-on-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] active:bg-[var(--ui-neutral)]"
              >
                <FiDollarSign className="h-4 w-4 shrink-0 text-[var(--ui-muted)]" aria-hidden />
                Payroll
              </button>
            </PermissionGate>
          </div>
        </div>

        {employeesError && employeesError.response?.status !== 401 && (
          <ErrorBanner message={employeesError.response?.data?.message || "Failed to load employees"} />
        )}

        {escalatedApprovalsCount > 0 ? (
          <button
            type="button"
            onClick={() => navigate("/admin/pending-approvals?escalated=1")}
            className="flex w-full items-center justify-between gap-3 rounded-[var(--ui-radius-md)] border bg-[var(--ui-tertiary-soft)] px-4 py-2.5 text-left transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ui-tertiary)]"
            style={{ borderColor: 'color-mix(in srgb, var(--ui-tertiary) 35%, transparent)' }}
          >
            <span className="text-sm font-semibold text-[#c2410c]">
              Needs attention · {escalatedApprovalsCount.toLocaleString("en-IN")} overdue approval{escalatedApprovalsCount === 1 ? "" : "s"}
            </span>
            <FiArrowUpRight className="h-4 w-4 shrink-0 text-[#c2410c]" aria-hidden />
          </button>
        ) : null}

        {/* Stat row — only Overdue Approvals is clickable */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Employees"
            value={employeeCount.toLocaleString("en-IN")}
            meta={`${projects.length} active projects`}
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-sm)] bg-[color-mix(in_srgb,var(--ui-secondary)_10%,transparent)] text-[var(--ui-secondary)]">
                <FiUsers className="h-4 w-4" aria-hidden />
              </span>
            }
          />
          <StatCard
            label="Present Today"
            value={todayAttendanceStats.present.toLocaleString("en-IN")}
            meta={`${todayAttendanceStats.total || 0} tracked`}
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-sm)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--ui-primary-deep)]">
                <FiCheckCircle className="h-4 w-4" aria-hidden />
              </span>
            }
          />
          <StatCard
            label="Pending Leave"
            value={pendingLeaves.toLocaleString("en-IN")}
            meta="Needs review"
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-sm)] bg-[var(--ui-warning-soft)] text-[#b45309]">
                <FiCalendar className="h-4 w-4" aria-hidden />
              </span>
            }
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate("/admin/pending-approvals?escalated=1")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/admin/pending-approvals?escalated=1");
              }
            }}
            className="cursor-pointer rounded-[var(--ui-radius-md)] transition-shadow hover:shadow-[var(--ui-shadow-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            aria-label="View overdue approvals"
          >
            <StatCard
              label="Overdue Approvals"
              value={escalatedApprovalsCount.toLocaleString("en-IN")}
              meta={escalatedApprovalsCount > 0 ? "Pending beyond review window" : "Clear"}
              metaUrgent={escalatedApprovalsCount > 0}
              icon={
                <span className="relative flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-sm)] bg-[var(--ui-tertiary-soft)] text-[#c2410c]">
                  <FiClock className="h-4 w-4" aria-hidden />
                  {escalatedApprovalsCount > 0 ? (
                    <StatusPill tone="urgent" className="absolute -right-2 -top-2 !px-1.5 !py-0 !text-[10px]">
                      {escalatedApprovalsCount}
                    </StatusPill>
                  ) : null}
                </span>
              }
            />
          </div>
        </div>

        {/* Shortcuts row */}
        <div className="flex flex-wrap gap-2">
          {permissionFlags.isOrgOwner ? (
            <Button type="button" variant="primary" onClick={() => navigate("/add-employee")}>
              <FiUserPlus className="h-4 w-4" aria-hidden />
              Add Employee
            </Button>
          ) : null}
          {hasAnyPermission(permissions, [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM], rbacOpts) ? (
            <Button type="button" variant="dark" onClick={() => navigate("/today-attendance")}>
              <FiCheckCircle className="h-4 w-4" aria-hidden />
              Today&apos;s Attendance
            </Button>
          ) : null}
          <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
            <Button type="button" variant="dark" onClick={() => navigate("/admin-payroll")}>
              <FiDollarSign className="h-4 w-4" aria-hidden />
              Payroll
            </Button>
          </PermissionGate>
          {hasAnyPermission(permissions, [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM], rbacOpts) ? (
            <Button type="button" variant="secondary" onClick={() => navigate("/leave-management")}>
              <FiFileText className="h-4 w-4" aria-hidden />
              Leave Report
            </Button>
          ) : null}
          {quickShortcuts
            .filter((s) => s.label === "Today's Log")
            .map((shortcut) => (
              <Button key={shortcut.label} type="button" variant="secondary" onClick={shortcut.action}>
                {shortcut.icon}
                {shortcut.label}
              </Button>
            ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
          {/* Attendance Today + Payroll */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <Card className="flex min-w-0 flex-col">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Attendance Today</h2>
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => navigate("/today-attendance")}
                >
                  View today
                  <FiArrowUpRight className="h-3 w-3" aria-hidden />
                </Button>
              </div>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
                <AttendanceDonut
                  present={todayAttendanceStats.present}
                  late={todayAttendanceStats.late}
                  absent={todayAttendanceStats.absent}
                />
                <ul className="grid w-full grid-cols-1 gap-2 sm:flex-1">
                  <li className="flex items-center justify-between rounded-[var(--ui-radius-sm)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-[var(--ui-primary-deep)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" aria-hidden />
                      Present
                    </span>
                    <span className="font-bold text-[var(--ui-on-surface)]">{todayAttendanceStats.present}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-[var(--ui-radius-sm)] bg-[var(--ui-danger-soft)] px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-[var(--ui-danger)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--ui-danger)]" aria-hidden />
                      Absent
                    </span>
                    <span className="font-bold text-[var(--ui-on-surface)]">{todayAttendanceStats.absent}</span>
                  </li>
                  <li className="flex items-center justify-between rounded-[var(--ui-radius-sm)] bg-[var(--ui-warning-soft)] px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-[#b45309]">
                      <span className="h-2 w-2 rounded-full bg-[var(--ui-warning)]" aria-hidden />
                      Late
                    </span>
                    <span className="font-bold text-[var(--ui-on-surface)]">{todayAttendanceStats.late}</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--ui-muted)]">
                  <span>Attendance rate</span>
                  <span className="font-semibold text-[var(--ui-on-surface)]">
                    {(todayAttendanceStats.total || employeeCount) > 0
                      ? Math.round(
                          (todayAttendanceStats.present /
                            (todayAttendanceStats.total || employeeCount)) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <ProgressBar
                  value={
                    (todayAttendanceStats.total || employeeCount) > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (todayAttendanceStats.present /
                              (todayAttendanceStats.total || employeeCount)) *
                              100
                          )
                        )
                      : 0
                  }
                />
                <p className="text-xs text-[var(--ui-muted)]">
                  {todayAttendanceStats.present} of {todayAttendanceStats.total || employeeCount} present today
                </p>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Payroll by Department</h2>
                  <p className="text-xs text-[var(--ui-muted)]">
                    This month · {formatCurrency(monthlyPayrollTotal)} · {payrolls.length} records
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {payrollByDepartment.length === 0 ? (
                  <EmptyState title="No payroll data yet" />
                ) : (
                  payrollByDepartment.map((row) => (
                    <div key={row.department}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-[var(--ui-on-surface)]">{row.department}</span>
                        <span className="text-[var(--ui-muted)]">{formatCurrency(row.amount)}</span>
                      </div>
                      <ProgressBar value={row.progress} />
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Pending Leave row → leave-management */}
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Pending Leave</h2>
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => navigate("/leave-management")}
                >
                  Review all
                  <FiArrowUpRight className="h-3 w-3" aria-hidden />
                </Button>
              </div>
              <div className="space-y-2.5">
                {approvalsPreview.length === 0 ? (
                  <EmptyState title="No pending requests" />
                ) : (
                  approvalsPreview.map((leave) => (
                    <button
                      key={leave._id}
                      type="button"
                      onClick={() => navigate("/leave-management")}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--ui-radius-sm)] border border-[var(--ui-outline-subtle)] p-3 text-left transition hover:bg-[var(--ui-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ui-on-surface)]">
                          {leave.employeeName || leave.employee?.name || "Employee"}
                        </p>
                        <p className="text-xs text-[var(--ui-muted)]">
                          {leave.leaveType || "Leave"} - {leave.totalDays || 1} day(s)
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
                        Review
                        <FiArrowUpRight className="h-3 w-3" aria-hidden />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Celebrations */}
            <Card>
              <h2 className="mb-3 text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Upcoming celebrations</h2>
              {celebrations.length > 0 ? (
                <ul className="space-y-3">
                  {celebrations.slice(0, 3).map((item, idx) => {
                    const itemKey = `${item.type || "birthday"}_${item.employeeId}`;
                    return (
                      <CelebrationDashboardCard
                        key={`${item.type || "birthday"}_${item.employeeId || idx}`}
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
              ) : (
                <EmptyState title="No upcoming celebrations" />
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <h2 className="mb-3 text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Upcoming events</h2>
              <div className="grid grid-cols-3 gap-2.5">
                {upcomingEvents.map((event) => (
                  <div key={event.label} className="rounded-[var(--ui-radius-sm)] border border-[var(--ui-outline-subtle)] bg-[var(--ui-neutral)] p-3">
                    <p className="text-xs text-[var(--ui-muted)]">{event.tag}</p>
                    <p className="mt-1 text-lg font-bold text-[var(--ui-on-surface)]">{event.date.getDate()}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{event.date.toLocaleDateString([], { month: "short", weekday: "short" })}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="flex min-w-0 flex-col">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">Announcements</h2>
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => setShowAnnouncementModal(true)}
                >
                  <FiPlus className="h-4 w-4" aria-hidden />
                  New announcement
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5">
                {announcements.length === 0 ? (
                  <EmptyState title="No announcements yet" />
                ) : (
                  announcements.map((item) => {
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
                      <div key={item._id} className="rounded-[var(--ui-radius-sm)] border border-[var(--ui-outline-subtle)] bg-[var(--ui-neutral)] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-[var(--ui-muted)]">{formatDate(item.createdAt)}</p>
                          {important ? (
                            <StatusPill tone="urgent">Important</StatusPill>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-[var(--ui-on-surface)]">{title}</p>
                      </div>
                    );
                  })
                )}
              </div>
              <Button
                type="button"
                variant="outlined"
                onClick={() => navigate("/sent-announcements")}
                className="mt-3 w-full"
              >
                Sent announcements
              </Button>
            </Card>

            <Card>
              <h2 className="mb-3 text-base font-semibold text-[var(--ui-on-surface)] sm:text-lg">New hires</h2>
              <div className="space-y-2.5">
                {newHires.length === 0 ? (
                  <EmptyState title="No recent hires found" />
                ) : (
                  newHires.map((employee) => {
                    const empId = employee._id || employee.id;
                    return (
                      <div
                        key={empId}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/employees/${empId}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/employees/${empId}`);
                          }
                        }}
                        className="flex flex-col gap-2 rounded-[var(--ui-radius-sm)] border border-[var(--ui-outline-subtle)] p-3 transition hover:bg-[var(--ui-neutral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] sm:flex-row sm:items-center sm:justify-between sm:gap-3 cursor-pointer"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-xs font-semibold text-[var(--ui-primary-deep)]">
                            {getInitials(`${employee.name || ""} ${employee.lastName || ""}`)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--ui-on-surface)]">
                              {employee.name || ""} {employee.lastName || ""}
                            </p>
                            <p className="truncate text-xs text-[var(--ui-muted)]">
                              {employee.position || "Team Member"} · Joined {formatDate(employee.createdAt || employee.joiningDate)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outlined"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/employees/${empId}`);
                          }}
                          className="!rounded-full w-full sm:w-auto"
                          aria-label={`View ${employee.name || "employee"}`}
                        >
                          <FiEye className="h-3 w-3" aria-hidden />
                          View
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default DashboardAdmin;
