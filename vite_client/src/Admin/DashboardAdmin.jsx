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
import LoadingSpinner from "../components/LoadingSpinner";
import { useEmployees, useLeaves, usePayrolls, useProjects } from "../Hooks/useDashboardData";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { handleApiError } from "../utils/errorHandler";
import AnnouncementModal from "./AnnouncementModal";
import useAuthPermissions from "../Hooks/useAuthPermissions";
import { PERMISSIONS, hasAnyPermission } from "../utils/permissions";
import PermissionGate from "../components/PermissionGate";
import { BOTH_CELEBRATION_ENDPOINT } from "../utils/constant";


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
        <li className={`min-w-0 overflow-hidden rounded-2xl border p-3 sm:p-3.5 ${isToday ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-rose-50 to-emerald-50 shadow-sm' : 'border-slate-100 bg-[#F8F9FB]'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">{header}</p>
                    <p className="truncate font-semibold text-slate-800">{icon} {isSelf ? 'You' : item?.name || 'Team member'}</p>
                    <p className="break-words text-xs text-slate-500">
                        {(isMarriage || isWorkAnniversary) && item?.completedYears ? `${item.completedYears} ${item.completedYears === 1 ? 'year' : 'years'} · ` : ''}
                        {dateLabel ? `${dateLabel} · ` : ''}{typeLabel} · {whenLabel}
                    </p>
                </div>
                {onWishes ? (
                    <button
                        type="button"
                        onClick={() => onWishes(item)}
                        className="inline-flex h-8 min-w-[4.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#20C997] px-3 text-xs font-semibold text-white hover:bg-[#1ab589]"
                    >
                        {isToday ? 'Wishes' : 'Upcoming'}
                    </button>
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
                                className={`inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full border bg-white px-2.5 py-1.5 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-50 ${count > 0 ? 'border-emerald-200' : 'border-slate-200'}`}
                                aria-label={`React ${emoji}`}
                            >
                                <span>{emoji}</span>
                                {count > 0 ? <span className="text-xs font-semibold text-slate-600">{count}</span> : null}
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
    return { total, present, late };
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
          action: () => navigate("/today-attendance"),
        },
        hasAnyPermission(permissions, [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM], rbacOpts) && {
          label: "Today's Log",
          icon: <FiClock />,
          action: () => navigate("/all-attendance-history"),
        },
        hasAnyPermission(permissions, [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM], rbacOpts) && {
          label: "Leave Report",
          icon: <FiFileText />,
          action: () => navigate("/leave-management"),
        },
        permissionFlags.isOrgOwner && {
          label: "Add Employee",
          icon: <FiUserPlus />,
          action: () => navigate("/add-employee"),
        },
      ].filter(Boolean),
    [permissions, permissionFlags, navigate]
  );

  const approvalsPreview = leaves
    .filter((leave) => String(leave?.status || "").toLowerCase() === "pending")
    .slice(0, 4);

  const statCards = [
    {
      label: "Total Employees",
      value: employeeCount.toLocaleString("en-IN"),
      sub: `${projects.length} active projects`,
      icon: <FiUsers className="h-4 w-4" />,
      iconWrap: "bg-slate-100 text-slate-600"
    },
    {
      label: "Present Today",
      value: todayAttendanceStats.present.toLocaleString("en-IN"),
      sub: `${todayAttendanceStats.total || 0} tracked`,
      icon: <FiCheckCircle className="h-4 w-4" />,
      iconWrap: "bg-emerald-50 text-emerald-600"
    },
    {
      label: "Pending Leaves",
      value: pendingLeaves.toLocaleString("en-IN"),
      sub: "Needs review",
      icon: <FiCalendar className="h-4 w-4" />,
      iconWrap: "bg-amber-50 text-amber-600"
    },
    {
      label: "Overdue Approvals",
      value: escalatedApprovalsCount.toLocaleString("en-IN"),
      sub: escalatedApprovalsCount > 0 ? "Pending beyond review window" : "Clear",
      icon: <FiClock className="h-4 w-4" />,
      iconWrap: "bg-rose-50 text-rose-600",
      onClick: () => navigate("/admin/pending-approvals?escalated=1")
    },
    {
      label: "Payroll This Month",
      value: formatCurrency(monthlyPayrollTotal),
      sub: `${payrolls.length} payroll records`,
      icon: <FiDollarSign className="h-4 w-4" />,
      iconWrap: "bg-emerald-50 text-emerald-600",
      wide: true
    }
  ];

  const greetingName = user?.name || user?.email?.split("@")?.[0] || "Admin";
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const todayShort = new Date().toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  const pillClass =
    "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
  const pillPrimaryClass =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-90";
  const mobileLinkClass =
    "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-medium text-slate-700 active:bg-slate-50";

  const getInitials = (name = "") => {
    const parts = name.trim().split(" ").filter(Boolean);
    if (!parts.length) return "EM";
    return parts
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  };

  const renderBar = (pct) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );

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

  if (isLoading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <>
      {showAnnouncementModal && (
        <AnnouncementModal onClose={closeAnnouncementModal} onSent={handleAnnouncementSent} />
      )}
    <div className="page-shell bg-[#F3F7F5]">
      <div className="page-shell-inner space-y-3 sm:space-y-5">
        <div className="flex flex-col gap-2 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-2xl md:text-3xl">Good morning, {greetingName}</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">
              <span className="sm:hidden">{todayShort}</span>
              <span className="hidden sm:inline">{todayLabel}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            {permissionFlags.isOrgOwner ? (
              <button
                onClick={() => navigate("/add-employee")}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <FiPlus className="h-4 w-4" />
                Add employee
              </button>
            ) : null}
            <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => navigate("/helpdesk")} className={mobileLinkClass}>
                <FiHeadphones className="h-4 w-4 shrink-0 text-slate-500" />
                Helpdesk
              </button>
              <button type="button" onClick={() => navigate("/today-attendance")} className={`${mobileLinkClass} border-l border-slate-200`}>
                <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                Attendance
              </button>
              <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
                <button type="button" onClick={() => navigate("/admin-payroll")} className={`${mobileLinkClass} border-l border-slate-200`}>
                  <FiDollarSign className="h-4 w-4 shrink-0 text-slate-500" />
                  Payroll
                </button>
              </PermissionGate>
            </div>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            <button type="button" onClick={() => navigate("/helpdesk")} className={pillClass}>
              <FiHeadphones className="h-4 w-4" />
              Helpdesk
            </button>
            <button type="button" onClick={() => navigate("/today-attendance")} className={pillClass}>
              <FiCheckCircle className="h-4 w-4" />
              Today's Live Attendance
            </button>
            <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
              <button type="button" onClick={() => navigate("/admin-payroll")} className={pillClass}>
                <FiDollarSign className="h-4 w-4" />
                Run Payroll
              </button>
            </PermissionGate>
            {permissionFlags.isOrgOwner ? (
              <button
                type="button"
                onClick={() => navigate("/add-employee")}
                className={pillPrimaryClass}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                <FiPlus className="h-4 w-4" />
                Add Employee
              </button>
            ) : null}
          </div>
        </div>

        {employeesError && employeesError.response?.status !== 401 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {employeesError.response?.data?.message || "Failed to load employees"}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-5">
          {statCards.map((card) => (
            <div
              key={card.label}
              role={card.onClick ? "button" : undefined}
              tabIndex={card.onClick ? 0 : undefined}
              onClick={card.onClick}
              onKeyDown={
                card.onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        card.onClick(e);
                      }
                    }
                  : undefined
              }
              className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${
                card.wide
                  ? "col-span-2 flex items-center justify-between gap-3 px-3.5 py-3 xl:col-span-1 xl:block xl:p-4"
                  : "p-3 sm:p-4"
              } ${card.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            >
              <div className={card.wide ? "flex min-w-0 flex-1 items-center gap-2.5 xl:mb-2 xl:w-full xl:flex-none xl:justify-between" : "flex items-center justify-between gap-2"}>
                {card.wide ? (
                  <span className={`shrink-0 rounded-lg p-1.5 xl:order-2 xl:p-2 ${card.iconWrap}`}>{card.icon}</span>
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-xs leading-tight text-slate-500 sm:text-sm">{card.label}</p>
                  {card.wide ? (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400 xl:hidden">{card.sub}</p>
                  ) : null}
                </div>
                {card.wide ? null : (
                  <span className={`shrink-0 rounded-lg p-1.5 sm:p-2 ${card.iconWrap}`}>{card.icon}</span>
                )}
              </div>
              <p className={`break-words font-bold leading-none text-slate-900 ${card.wide ? "shrink-0 text-xl xl:mt-3 xl:text-2xl" : "mt-2 text-xl sm:mt-3 sm:text-2xl"}`}>{card.value}</p>
              <p className={`truncate text-[11px] text-slate-400 sm:text-xs ${card.wide ? "hidden xl:mt-1 xl:block" : "mt-1.5"}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Attendance overview</h2>
              <div className="hidden flex-wrap items-center gap-3 text-xs text-slate-500 sm:flex">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Present
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Late
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Absent
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-emerald-50 px-3 py-3 sm:p-4">
                <p className="text-xs text-emerald-700">Present</p>
                <p className="mt-1 text-xl font-bold text-emerald-800 sm:text-2xl">{todayAttendanceStats.present}</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-3 sm:p-4">
                <p className="text-xs text-amber-700">Late</p>
                <p className="mt-1 text-xl font-bold text-amber-800 sm:text-2xl">{todayAttendanceStats.late}</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-3 py-3 sm:p-4">
                <p className="text-xs text-rose-700">Absent</p>
                <p className="mt-1 text-xl font-bold text-rose-800 sm:text-2xl">
                  {Math.max((todayAttendanceStats.total || employeeCount) - todayAttendanceStats.present, 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Attendance rate</span>
                <span className="font-semibold text-slate-800">
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
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
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
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {todayAttendanceStats.present} of {todayAttendanceStats.total || employeeCount} present today
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/today-attendance")}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:opacity-80"
                >
                  View today
                  <FiArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:opacity-80"
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
                  <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{item.message}</p>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => navigate("/sent-announcements")}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View All Announcements
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Pending approvals</h2>
            <div className="space-y-2.5">
              {approvalsPreview.length === 0 ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : (
                approvalsPreview.map((leave) => (
                  <div key={leave._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {leave.employeeName || leave.employee?.name || "Employee"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {leave.leaveType || "Leave"} - {leave.totalDays || 1} day(s)
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/leave-management")}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-primary)]"
                    >
                      Review
                      <FiArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Payroll snapshot</h2>
            <div className="space-y-3">
              {payrollByDepartment.length === 0 ? (
                <p className="text-sm text-slate-500">No payroll data yet.</p>
              ) : (
                payrollByDepartment.map((row) => (
                  <div key={row.department}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{row.department}</span>
                      <span className="text-slate-500">{formatCurrency(row.amount)}</span>
                    </div>
                    {renderBar(row.progress)}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="hidden min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2 md:block xl:col-span-1">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Quick shortcuts</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {quickShortcuts.map((shortcut) => (
                <button
                  key={shortcut.label}
                  onClick={shortcut.action}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <span className="text-lg text-slate-600">{shortcut.icon}</span>
                  <span>{shortcut.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Upcoming celebrations</h2>
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
              <div className="grid grid-cols-3 gap-2.5">
                {upcomingEvents.map((event) => (
                  <div key={event.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{event.tag}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{event.date.getDate()}</p>
                    <p className="text-xs text-slate-600">{event.date.toLocaleDateString([], { month: "short", weekday: "short" })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">New hires this month</h2>
            <div className="space-y-2.5">
              {newHires.length === 0 ? (
                <p className="text-sm text-slate-500">No recent hires found.</p>
              ) : (
                newHires.map((employee) => (
                  <div key={employee._id || employee.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {getInitials(`${employee.name || ""} ${employee.lastName || ""}`)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {employee.name || ""} {employee.lastName || ""}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {employee.position || "Team Member"} - Joined {formatDate(employee.createdAt || employee.joiningDate)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/employees/${employee._id || employee.id}`)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                      <FiEye className="h-3 w-3" />
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default DashboardAdmin;
