import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiLayers,
  FiBell,
  FiSearch,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap
} from "react-icons/fi";
import { format } from "date-fns";
import { toast } from "react-toastify";
import {
  useAttendanceSummary,
  useCriticalAlerts,
  useDepartmentPerformance,
  useEmployeeTrends,
  useEmployees,
  useExecutiveKPIs,
  useExpenses,
  useFinancialSummary,
  useLeaves,
  usePredictiveAnalytics,
  useProjectPortfolio,
  useProjects,
  useStrategicInsights
} from "../../Hooks/useDashboardData";
import LoadingSpinner from "../../components/LoadingSpinner";
import AttendanceBox from "../../Employee/Attendance/AttendanceBox";
import { handleApiError } from "../../utils/errorHandler";
import AnnouncementBanner from '../../components/AnnouncementBanner';
import { mergeSessionProfile } from "../../utils/profileUtils";

const DashboardAdministration = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");

  const profile = useMemo(() => mergeSessionProfile(user, employee), [user, employee]);
  const position = (profile?.position || "").toLowerCase().trim();
  const isCEO = position === "ceo";
  const isCTO = position === "cto";
  const isCFO = position === "cfo";
  const isVP = position === "vp";
  const executiveTitle = profile?.position || "Executive";

  const {
    data: employeeData = { employees: [], total: 0 },
    isLoading: employeesLoading,
    error: employeesError
  } = useEmployees();
  const employees = employeeData?.employees ?? [];
  const employeeTotal = employeeData?.total ?? employees.length;

  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const { data: attendanceData = {}, isLoading: attendanceLoading } = useAttendanceSummary({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0]
  });
  const { data: leavesList = [] } = useLeaves();
  const { data: expensesList = [] } = useExpenses();

  const { data: financialData = {}, isLoading: financialLoading } = useFinancialSummary({ period: selectedPeriod });
  const { data: kpiData = {}, isLoading: kpiLoading } = useExecutiveKPIs({ period: selectedPeriod });
  const { data: alertsData = { alerts: [], total: 0, critical: 0 } } = useCriticalAlerts();
  const { data: portfolioData = {}, isLoading: portfolioLoading } = useProjectPortfolio();
  const { data: departmentData = {}, isLoading: departmentLoading } = useDepartmentPerformance({ period: selectedPeriod });
  const { data: trendsData = {}, isLoading: trendsLoading } = useEmployeeTrends({ months: 12 });
  const { data: insightsData = { insights: [], summary: {} }, isLoading: insightsLoading } = useStrategicInsights();
  const { data: predictiveData = {}, isLoading: predictiveLoading } = usePredictiveAnalytics({ forecastMonths: 6 });

  React.useEffect(() => {
    if (employeesError) {
      handleApiError(employeesError, {
        context: "Administration Dashboard",
        showToast: employeesError.response?.status !== 401
      });
    }
  }, [employeesError]);

  const isLoading =
    employeesLoading || projectsLoading || attendanceLoading || financialLoading || kpiLoading;

  const totalEmployees = employeeTotal;
  const activeEmployees = employees.filter((emp) => emp.status === "active" || emp.active).length;
  const totalProjects = projects.length;
  const activeProjects = projects.filter((proj) => proj.status === "active" || proj.status === "in-progress").length;
  const attendanceRate = Math.round(attendanceData?.attendanceRate || 0);
  const financialSummary = financialData?.summary || {};
  const kpis = kpiData || {};
  const alerts = alertsData?.alerts || [];
  const portfolio = portfolioData || {};

  const departmentHeadcount = useMemo(() => {
    const map = new Map();
    for (const emp of employees) {
      const raw = emp.department ?? emp.departmentName ?? "";
      const label = String(raw).trim() || "Unassigned";
      map.set(label, (map.get(label) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [employees]);

  const maxDeptCount = departmentHeadcount[0]?.[1] || 1;

  const projectStatusBreakdown = useMemo(() => {
    const map = new Map();
    for (const p of projects) {
      const raw = p.status != null ? String(p.status) : "unspecified";
      const key = raw.trim() || "unspecified";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const leavesArray = Array.isArray(leavesList) ? leavesList : [];
  const pendingLeaveCount = leavesArray.filter(
    (lv) => String(lv?.status || "").toLowerCase() === "pending"
  ).length;

  const expensesArray = Array.isArray(expensesList) ? expensesList : [];
  const pendingExpenseCount = expensesArray.filter(
    (ex) => String(ex?.status || "").toLowerCase() === "pending"
  ).length;

  const formatProjectStatusLabel = (status) => {
    const s = String(status || "").replace(/[-_]/g, " ");
    if (!s.trim()) return "Unspecified";
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatCurrency = (amount) => {
    if (!amount || Number.isNaN(amount)) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const displayName = profile?.name || user?.name || user?.username || executiveTitle;
  const greeting = `Good morning, ${displayName}`;

  if (isLoading) return <LoadingSpinner message="Loading administration dashboard..." />;

  const inactiveCount = Math.max(0, totalEmployees - activeEmployees);

  const kpiCards = [
    {
      label: "Total Headcount",
      value: totalEmployees.toLocaleString("en-IN"),
      sub:
        inactiveCount > 0
          ? `${activeEmployees.toLocaleString("en-IN")} active · ${inactiveCount} inactive / other`
          : `${activeEmployees.toLocaleString("en-IN")} active`,
      icon: <FiUsers className="h-4 w-4" />
    },
    {
      label: "Avg. in-hand / paid employee",
      value: formatCurrency(kpis.payroll?.avgPerEmployee || 0),
      sub:
        kpis.payroll?.employeesPaid > 0
          ? `${kpis.payroll.employeesPaid} paid in ${selectedPeriod} · ${activeEmployees} active roster`
          : `No payroll in ${selectedPeriod} window · ${activeEmployees} active`,
      icon: <FiDollarSign className="h-4 w-4" />
    },
    {
      label: "Project Completion",
      value: `${kpis.projects?.completionRate || 0}%`,
      sub: `${activeProjects} active / in progress`,
      icon: <FiTarget className="h-4 w-4" />
    },
    isCEO
      ? {
          label: "Attendance (30d)",
          value: `${attendanceRate}%`,
          sub: "Org-wide punctuality signal",
          icon: <FiCalendar className="h-4 w-4" />
        }
      : {
          label: "Workforce utilization",
          value: `${kpis.employees?.utilizationRate ?? "—"}${kpis.employees?.utilizationRate != null ? "%" : ""}`,
          sub: "From executive KPIs",
          icon: <FiActivity className="h-4 w-4" />
        },
    {
      label: "Payroll Cost",
      value: formatCurrency(financialSummary.totalPayroll ?? 0),
      sub: `${selectedPeriod} window`,
      icon: <FiBarChart2 className="h-4 w-4" />
    }
  ];

  const executiveInsights = (insightsData?.insights || []).slice(0, 4);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredInsights = executiveInsights.filter((insight) => {
    if (!normalizedSearch) return true;
    const title = String(insight?.title || "").toLowerCase();
    const message = String(insight?.message || "").toLowerCase();
    return title.includes(normalizedSearch) || message.includes(normalizedSearch);
  });
  const filteredProjects = (portfolio?.recentProjects || []).filter((project) => {
    if (!normalizedSearch) return true;
    const name = String(project?.name || "").toLowerCase();
    const manager = String(project?.managerName || "").toLowerCase();
    return name.includes(normalizedSearch) || manager.includes(normalizedSearch);
  });
  const filteredDepartments = (departmentData?.departments || []).filter((dept) => {
    if (!normalizedSearch) return true;
    return String(dept?.name || "").toLowerCase().includes(normalizedSearch);
  });

  const handleScheduleBoardMeeting = () => {
    navigate("/calendar-management");
    toast.info("Opening calendar management to schedule the meeting.");
  };

  const handleDownloadExecutiveReport = () => {
    const reportRows = [
      ["Executive Dashboard Report"],
      [`Generated`, new Date().toLocaleString()],
      ["Period", selectedPeriod],
      [],
      ["Metric", "Value"],
      ["Total Headcount", totalEmployees],
      ["Active Employees", activeEmployees],
      ["Total Projects", totalProjects],
      ["Active Projects", activeProjects],
      ["Payroll total (selected period)", financialSummary.totalPayroll ?? 0],
      ["Avg. in-hand / paid employee", kpis.payroll?.avgPerEmployee ?? 0],
      ["Employees paid (period)", kpis.payroll?.employeesPaid ?? 0],
      ["Attendance Rate", `${attendanceRate}%`],
      ["Payroll Trend", predictiveData?.trends?.payroll?.direction || "stable"],
      ["Headcount Trend", predictiveData?.trends?.employees?.direction || "stable"]
    ];
    const csv = reportRows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `executive-report-${selectedPeriod}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Executive report downloaded.");
  };

  const handleInsightDetails = (insight) => {
    const combinedText = `${insight?.title || ""} ${insight?.message || ""}`.toLowerCase();
    if (combinedText.includes("attendance")) return navigate("/all-attendance-history");
    if (combinedText.includes("project")) return navigate("/projects");
    if (combinedText.includes("payroll")) return navigate("/admin-payroll");
    if (combinedText.includes("hire") || combinedText.includes("employee")) return navigate("/employees");
    toast.info("No dedicated detail route for this insight yet.");
  };

  const handleAllDepartments = () => {
    navigate("/organization/analytics");
  };

  return (
    <div className="min-h-screen bg-[#F3F7F5]">
      <AnnouncementBanner />
      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {greeting} 👋
              </h1>
              <p className="text-sm text-slate-500">{format(new Date(), "dd MMM yyyy")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden min-w-[260px] items-center gap-2 rounded-full border border-slate-200 px-3 py-2 lg:flex">
                <FiSearch className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                className="relative rounded-full border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                onClick={() => navigate("/notifications")}
              >
                <FiBell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500"></span>
              </button>
              <button
                type="button"
                className="h-10 w-10 rounded-full bg-slate-200 text-sm font-semibold text-slate-700"
                onClick={() => navigate("/profile-details")}
              >
                {(displayName || "M").charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {["week", "month", "quarter", "year"].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    selectedPeriod === period
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={handleScheduleBoardMeeting}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Schedule board meeting
            </button>
            <button
              onClick={handleDownloadExecutiveReport}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <FiDownload className="h-4 w-4" />
              Download executive report
            </button>
            {isCEO && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/admin/pending-approvals")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <FiClipboard className="h-4 w-4" />
                  Approvals queue
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/organization/analytics")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FiBarChart2 className="h-4 w-4" />
                  Organization analytics
                </button>
              </>
            )}
          </div>
        </div>

        {isCEO && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Punch in / punch out
            </h3>
            <AttendanceBox variant="dashboard" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">{card.icon}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="hrms-main-rail">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Business performance trends</h3>
              <span className="text-xs text-slate-500">Headcount vs Payroll</span>
            </div>
            {trendsLoading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-3">
                {(trendsData?.trends?.employeeGrowth || []).slice(-6).map((point, idx) => (
                  <div key={`${point.month}-${idx}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-600">{point.month}</span>
                    <span className="text-sm font-semibold text-slate-900">{point.count || 0} employees</span>
                  </div>
                ))}
                {(trendsData?.trends?.employeeGrowth || []).length === 0 && (
                  <p className="text-sm text-slate-500">No trend data available.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">Key insights</h3>
            {insightsLoading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-3">
                {filteredInsights.map((insight, idx) => (
                  <div
                    key={`${insight.title}-${idx}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-medium text-slate-800">{insight.message || insight.title}</p>
                    <button
                      onClick={() => handleInsightDetails(insight)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:opacity-80"
                    >
                      View details <FiArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {filteredInsights.length === 0 && (
                  <p className="text-sm text-slate-500">No strategic insights yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Department health index</h3>
              <button
                onClick={handleAllDepartments}
                className="text-xs font-medium text-emerald-700 hover:opacity-80"
              >
                All departments
              </button>
            </div>
            {departmentLoading ? (
              <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-4">
                {filteredDepartments.slice(0, 4).map((dept, idx) => {
                  const score = Math.max(0, Math.min(100, dept.metrics?.performanceScore || 0));
                  return (
                    <div key={`${dept.name}-${idx}`}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{dept.name || "Unknown"}</span>
                        <span className="font-semibold text-slate-900">{score}% Health</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
                {filteredDepartments.length === 0 && (
                  <p className="text-sm text-slate-500">No department performance data.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Top performing projects</h3>
              <button onClick={() => navigate("/projects")} className="text-xs font-medium text-emerald-700 hover:opacity-80">
                View all
              </button>
            </div>
            {portfolioLoading ? (
              <div className="h-44 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <div className="space-y-3">
                {filteredProjects.slice(0, 3).map((project, idx) => (
                  <div key={`${project.name}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{project.name || "Untitled Project"}</p>
                        <p className="text-xs text-slate-500">Lead: {project.managerName || "NA"}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        project.status === "completed" || project.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {project.status || "at risk"}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredProjects.length === 0 && (
                  <p className="text-sm text-slate-500">No project records available.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-emerald-600" />
                Headcount by department
              </h3>
              <button
                type="button"
                onClick={() => navigate("/employees")}
                className="shrink-0 text-xs font-medium text-emerald-700 hover:opacity-80"
              >
                Roster
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {isCEO
                ? "Where people sit today—span, site, and cost conversations."
                : "Active roster distribution across departments."}
            </p>
            {departmentHeadcount.length === 0 ? (
              <p className="text-sm text-slate-500">No employee department data yet.</p>
            ) : (
              <ul className="space-y-3">
                {departmentHeadcount.map(([name, count]) => (
                  <li key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{name}</span>
                      <span className="text-slate-600">
                        {count}{" "}
                        <span className="text-slate-400">
                          ({totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-[width]"
                        style={{ width: `${Math.min(100, Math.round((count / maxDeptCount) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
                <FiBriefcase className="h-4 w-4 text-emerald-600" />
                Project portfolio mix
              </h3>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="shrink-0 text-xs font-medium text-emerald-700 hover:opacity-80"
              >
                Projects
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {isCEO
                ? "Delivery load from your project statuses—not a fictional hiring funnel."
                : "Counts by project status across the portfolio."}
            </p>
            {projectStatusBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No projects on record.</p>
            ) : (
              <ul className="space-y-2">
                {projectStatusBreakdown.map(([status, count]) => (
                  <li
                    key={status}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">{formatProjectStatusLabel(status)}</span>
                    <span className="font-semibold text-emerald-700">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-1 text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
              <FiZap className="h-4 w-4 text-amber-500" />
              Decisions &amp; approvals
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              Pending items from leaves and expenses in this org (where your token can read them).
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate("/leave-management")}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <FiCalendar className="h-4 w-4 text-emerald-600" />
                  Pending leave approvals
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {pendingLeaveCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard/finance")}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <FiDollarSign className="h-4 w-4 text-emerald-600" />
                  Expenses (finance)
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {pendingExpenseCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/pending-approvals")}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <FiClipboard className="h-4 w-4 text-emerald-600" />
                  Full approvals queue
                </span>
                <FiArrowUpRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            {pendingLeaveCount === 0 && pendingExpenseCount === 0 && (
              <p className="mt-3 text-xs text-slate-500">
                No pending leaves or expenses in the loaded lists. Use the queue for workflow approvals.
              </p>
            )}
          </div>
        </div>

        {(alerts.length > 0 || !financialLoading || !predictiveLoading) && (
          <div className="hrms-main-rail">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Critical alerts</h3>
              <div className="space-y-2">
                {alerts.slice(0, 4).map((alert, idx) => (
                  <button
                    key={`${alert.title}-${idx}`}
                    onClick={() => alert.action && navigate(alert.action)}
                    className="flex w-full items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
                  >
                    <FiAlertCircle className="mt-0.5 h-4 w-4 text-rose-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{alert.title || "Alert"}</p>
                      <p className="text-xs text-slate-600">{alert.message || "Action required."}</p>
                    </div>
                  </button>
                ))}
                {alerts.length === 0 && (
                  <p className="text-sm text-slate-500">No critical alerts at the moment.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Forecast snapshot</h3>
              {predictiveLoading ? (
                <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">Payroll trend</span>
                    <span className="font-semibold text-slate-900">
                      {predictiveData.trends?.payroll?.direction || "stable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">Headcount trend</span>
                    <span className="font-semibold text-slate-900">
                      {predictiveData.trends?.employees?.direction || "stable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">Attendance (30d)</span>
                    <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                      <FiCalendar className="h-3 w-3" />
                      {attendanceRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">Avg payroll</span>
                    <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                      <FiClock className="h-3 w-3" />
                      {formatCurrency(financialSummary.averagePayroll || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                    <span className="text-emerald-700">Operational health</span>
                    <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <FiTrendingUp className="h-3 w-3" />
                      Stable
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
};

export default DashboardAdministration;
