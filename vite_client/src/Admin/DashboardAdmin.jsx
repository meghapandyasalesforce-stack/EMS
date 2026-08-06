import React, { useEffect, useMemo, useState } from "react";
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
  FiPlus,
  FiUserPlus,
  FiUsers
} from "react-icons/fi";
import LoadingSpinner from "../components/LoadingSpinner";
import { useEmployees, useLeaves, usePayrolls, useProjects } from "../Hooks/useDashboardData";
import axios from "../utils/axios";
import { handleApiError } from "../utils/errorHandler";
import NotificationSender from "./NotificationSender";
import useAuthPermissions from "../Hooks/useAuthPermissions";
import { PERMISSIONS, hasAnyPermission } from "../utils/permissions";
import PermissionGate from "../components/PermissionGate";

const selectAuth = (state) => state.auth || {};

function DashboardAdmin() {
  const navigate = useNavigate();
  const authState = useSelector(selectAuth);
  const user = authState?.user;
  const { permissions, permissionFlags } = useAuthPermissions();
  const [todayStatus, setTodayStatus] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [escalatedApprovalsCount, setEscalatedApprovalsCount] = useState(0);

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
        const [todayRes, announcementsRes, escalatedRes] = await Promise.all([
          axios.get("/v1/both/attendance/today-status", { withCredentials: true }),
          axios.get("/v1/both/notification/sent-announcements", {
            params: { scope: "organization", page: 1, limit: 3 },
            withCredentials: true
          }),
          axios.get("/v1/admin/approvals/escalated-count", { withCredentials: true }).catch(() => null)
        ]);

        const todayList = todayRes?.data?.data || [];
        const recentAnnouncements = announcementsRes?.data?.announcements || [];
        setTodayStatus(Array.isArray(todayList) ? todayList : []);
        setAnnouncements(Array.isArray(recentAnnouncements) ? recentAnnouncements : []);
        setEscalatedApprovalsCount(
          Number(escalatedRes?.data?.data?.count ?? 0)
        );
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
          label: "Mark Attendance",
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
      icon: <FiUsers className="h-5 w-5" />
    },
    {
      label: "Present Today",
      value: todayAttendanceStats.present.toLocaleString("en-IN"),
      sub: `${todayAttendanceStats.total || 0} tracked`,
      icon: <FiCheckCircle className="h-5 w-5" />
    },
    {
      label: "Pending Leaves",
      value: pendingLeaves.toLocaleString("en-IN"),
      sub: "Needs review",
      icon: <FiCalendar className="h-5 w-5" />
    },
    {
      label: "Overdue Approvals",
      value: escalatedApprovalsCount.toLocaleString("en-IN"),
      sub: escalatedApprovalsCount > 0 ? "Pending beyond review window" : "Clear",
      icon: <FiClock className="h-5 w-5" />,
      onClick: () => navigate("/admin/pending-approvals?escalated=1")
    },
    {
      label: "Payroll This Month",
      value: formatCurrency(monthlyPayrollTotal),
      sub: `${payrolls.length} payroll records`,
      icon: <FiDollarSign className="h-5 w-5" />
    }
  ];

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

  const renderBar = (pct) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <>
      {showAnnouncementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAnnouncementModal(false)}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <NotificationSender onSent={() => setShowAnnouncementModal(false)} />
          </div>
        </div>
      )}
    <div className="page-shell min-h-screen bg-[#F3F7F5]">
      <div className="page-shell-inner space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Good morning, {greetingName}</h1>
            <p className="mt-1 text-sm text-slate-500">{todayLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/today-attendance")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <FiCheckCircle className="h-4 w-4" />
              Mark Attendance
            </button>
            <PermissionGate permissions={[PERMISSIONS.PAYROLL_VIEW_ALL]}>
              <button
                onClick={() => navigate("/admin-payroll")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                <FiDollarSign className="h-4 w-4" />
                Run Payroll
              </button>
            </PermissionGate>
            {permissionFlags.isOrgOwner ? (
              <button
                onClick={() => navigate("/add-employee")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-theme-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
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
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${card.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm text-slate-500">{card.label}</p>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600">{card.icon}</span>
              </div>
              <p className="break-words text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Attendance overview</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
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

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2 xl:col-span-1">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Upcoming events & holidays</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {upcomingEvents.map((event) => (
                <div key={event.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{event.tag}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{event.date.getDate()}</p>
                  <p className="text-xs text-slate-600">{event.date.toLocaleDateString([], { month: "short", weekday: "short" })}</p>
                </div>
              ))}
            </div>
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
