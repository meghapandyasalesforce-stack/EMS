#!/usr/bin/env python3
"""Generate COMPLETE HRMS FUNCTIONALITY ANALYSIS.docx from codebase scan findings."""

from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor


OUT_PATH = Path(__file__).resolve().parent / "COMPLETE_HRMS_FUNCTIONALITY_ANALYSIS.docx"


def set_cell_shading(cell, hex_color):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tePr = cell._tc.get_or_add_tcPr()
    cell._tc.get_or_add_tcPr().append(shading)


def add_heading_styled(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_para(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(11)
    return p


def add_kv(doc, label, value):
    p = doc.add_paragraph()
    r1 = p.add_run(f"{label}: ")
    r1.bold = True
    r1.font.size = Pt(11)
    r2 = p.add_run(str(value))
    r2.font.size = Pt(11)
    return p


def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
        set_cell_shading(hdr[i], "1F4E79")
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.font.color.rgb = RGBColor(255, 255, 255)
    for ri, row in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = str(val)
            for p in cells[ci].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    doc.add_paragraph()
    return table


def status_icon(status):
    if status == "Implemented":
        return "✅ Implemented"
    if status == "Partial":
        return "⚠️ Partially Implemented"
    return "❌ Not Implemented"


# ---------------------------------------------------------------------------
# DATA: derived from full codebase scan (server + vite_client)
# ---------------------------------------------------------------------------

AUTH = "JWT (httpOnly cookie + Bearer), refresh tokens, CSRF cookie, RBAC permissions"

MODULES = [
    {
        "name": "Authentication & Identity",
        "purpose": "Secure multi-actor login for organizations, admin/HR users, and employees with JWT session management, password recovery, and email verification.",
        "status": "Implemented",
        "pages": [
            "/, /login — Login",
            "/register — Register (conditional)",
            "/organization/register — Organization registration",
            "/organization/login — Organization login",
            "/forgot-password — Forgot password",
            "/reset-password/:token — Reset password",
        ],
        "apis": [
            "POST /api/v1/organization/auth/register|login",
            "GET /api/v1/organization/auth/check-email|verify-email",
            "POST /api/v1/organization/auth/resend-verification",
            "POST /api/v1/admin/auth/register|login|logout|refresh-token",
            "POST /api/v1/employee/auth/register|login|logout|refresh-token",
            "PATCH /api/v1/employee/auth/reset-password",
            "POST /api/v1/both/auth/login",
            "GET /api/v1/both/auth/permissions",
            "POST /api/v1/both/password/forgot-password",
            "POST /api/v1/both/password/reset-password/:token",
        ],
        "collections": ["users", "employees", "organizations"],
        "roles": ["Public", "Admin", "HR", "Manager", "Employee", "Finance", "Executive"],
        "features": [
            {
                "name": "Organization registration & login",
                "desc": "Organization signup, email verification, and org-owner authentication.",
                "pages": "/organization/register, /organization/login",
                "apis": "POST/GET /api/v1/organization/auth/*",
                "collections": "organizations, users",
                "roles": "Public / Org Owner",
                "status": "Implemented",
            },
            {
                "name": "Admin / employee login",
                "desc": "Separate and unified login flows with JWT access + refresh tokens.",
                "pages": "/, /login",
                "apis": "POST /api/v1/admin/auth/*, /api/v1/employee/auth/*, /api/v1/both/auth/login",
                "collections": "users, employees",
                "roles": "All authenticated roles",
                "status": "Implemented",
            },
            {
                "name": "Password forgot / reset",
                "desc": "Token-based password recovery via email.",
                "pages": "/forgot-password, /reset-password/:token",
                "apis": "POST /api/v1/both/password/*",
                "collections": "users, employees",
                "roles": "Public",
                "status": "Implemented",
            },
            {
                "name": "Permission resolution",
                "desc": "Runtime permission catalog for RBAC-gated UI and APIs.",
                "pages": "Used across ProtectedRoute / nav",
                "apis": "GET /api/v1/both/auth/permissions",
                "collections": "roles, users, employees",
                "roles": "All authenticated",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Dashboard",
        "purpose": "Role-specific landing dashboards aggregating KPIs, tasks, attendance, leave, and payroll summaries for each portal.",
        "status": "Implemented",
        "pages": [
            "/dashboard — Role-based router",
            "/dashboard-admin — Admin dashboard",
            "/dashboard-hr — HR dashboard",
            "/dashboard-finance — Finance dashboard",
            "/dashboard-manager — Manager dashboard",
            "/dashboard-employee — Employee dashboard",
            "/dashboard-administration — Executive/Admin dashboard",
            "/dashboard/tech — Tech dashboard",
            "/dashboard/ceo|cto|cfo|vp — Executive role dashboards",
        ],
        "apis": [
            "GET /api/v1/organization/dashboard/*",
            "GET /api/v1/admin/analytics/*",
            "GET /api/v1/admin/executive/*",
            "Various leave/attendance/payroll summary endpoints used by dashboards",
        ],
        "collections": ["organizations", "employees", "attendances", "leaves", "payrolls", "notifications", "projects"],
        "roles": ["Admin", "HR", "Manager", "Employee", "Finance", "Executive", "Tech"],
        "features": [
            {
                "name": "Role-based dashboards",
                "desc": "Dedicated dashboards per portal with KPI rows and quick links.",
                "pages": "All /dashboard-* routes",
                "apis": "Org dashboard, analytics, domain summary APIs",
                "collections": "Multiple operational collections",
                "roles": "All portals",
                "status": "Implemented",
            },
            {
                "name": "Executive dashboard metrics",
                "desc": "Executive KPI/alerts/portfolio views; at least one engagement metric is a placeholder (0).",
                "pages": "/dashboard-administration, /dashboard/ceo|cto|cfo|vp",
                "apis": "GET /api/v1/admin/executive/*",
                "collections": "employees, payrolls, projects, etc.",
                "roles": "Admin, Executive",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Employee Management",
        "purpose": "Create, list, view, and manage employee master records including work info, lifecycle status, and detailed profile sections.",
        "status": "Implemented",
        "pages": [
            "/employees — Employee list",
            "/employees/:employeeId — Employee details (tabs)",
            "/add, /add-employee — Add employee",
            "/view-profile — View profile",
            "/profile-details and related profile paths — Self-service profile hub",
        ],
        "apis": [
            "GET /api/v1/admin/employee/",
            "GET /api/v1/admin/employee/managers|job-titles",
            "PUT|GET /api/v1/admin/employee/:id/work-info",
            "GET /api/v1/admin/employee/:id/stats",
            "POST /api/v1/admin/employee/:id/promote-hr-manager",
            "GET /api/v1/employee/ | /me",
            "PATCH /api/v1/both/profile-details/admin/update-status|terminate/:employeeId",
            "Profile section CRUD under /api/v1/both/profile-details/*",
            "Profile photo under /api/v1/both/profile-photo/*",
        ],
        "collections": ["employees"],
        "roles": ["Admin", "HR", "Manager", "Executive", "Employee (self)"],
        "features": [
            {
                "name": "Employee list & details",
                "desc": "Searchable employee directory with detail tabs (Personal, Job, Documents, Leave, Payroll, Performance, Timeline).",
                "pages": "/employees, /employees/:employeeId",
                "apis": "GET /api/v1/admin/employee/*, profile-details",
                "collections": "employees",
                "roles": "Admin, HR, Manager, Executive",
                "status": "Implemented",
            },
            {
                "name": "Add / onboard employee record",
                "desc": "Create employee with auth registration linkage.",
                "pages": "/add-employee",
                "apis": "POST /api/v1/employee/auth/register; admin employee endpoints",
                "collections": "employees, users",
                "roles": "Admin, HR",
                "status": "Implemented",
            },
            {
                "name": "Profile sections (ESS)",
                "desc": "Academic, professional, family, financial, tax, location, NOK, guarantor, photo.",
                "pages": "/profile-details and related paths",
                "apis": "/api/v1/both/profile-details/*, profile-photo",
                "collections": "employees",
                "roles": "Employee + Admin/HR",
                "status": "Implemented",
            },
            {
                "name": "Lifecycle status / terminate",
                "desc": "Update employee status and terminate employment.",
                "pages": "Employee details / admin profile actions",
                "apis": "PATCH .../update-status|terminate/:employeeId",
                "collections": "employees",
                "roles": "Admin, HR",
                "status": "Implemented",
            },
            {
                "name": "Performance score on employee card",
                "desc": "Simple performanceScore field edit on employee details — not full appraisal workflow UI.",
                "pages": "PerformanceTab in employee details",
                "apis": "Employee update fields",
                "collections": "employees",
                "roles": "Admin, HR, Manager",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "User Management & Roles / Permissions",
        "purpose": "Manage custom roles, platform/system roles, hierarchy, and permission assignments for RBAC.",
        "status": "Implemented",
        "pages": [
            "/role-hierarchy — Role hierarchy",
            "/admin/platform-roles — Users & platform roles",
            "/admin-settings — Settings hub (Permissions tab is placeholder)",
        ],
        "apis": [
            "CRUD /api/v1/admin/roles/*",
            "/api/v1/admin/platform-roles/* (catalog, roster, system-role, functional-roles)",
        ],
        "collections": ["roles", "users", "employees"],
        "roles": ["Admin", "HR"],
        "features": [
            {
                "name": "Custom role CRUD & hierarchy",
                "desc": "Create/assign custom roles and view hierarchy.",
                "pages": "/role-hierarchy",
                "apis": "/api/v1/admin/roles/*",
                "collections": "roles",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Platform / system roles",
                "desc": "Catalog and assign platform roles (HR Manager, Finance, Executive, etc.).",
                "pages": "/admin/platform-roles",
                "apis": "/api/v1/admin/platform-roles/*",
                "collections": "roles, employees, users",
                "roles": "Admin, HR",
                "status": "Implemented",
            },
            {
                "name": "Settings Permissions tab",
                "desc": "UI tab present but explicitly a placeholder (no actions).",
                "pages": "/admin-settings",
                "apis": "N/A",
                "collections": "N/A",
                "roles": "Admin, HR, Executive",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Organization Management",
        "purpose": "Multi-tenant organization profile, branding, locale, business info, settings, subscription plan, and org setup wizard.",
        "status": "Implemented",
        "pages": [
            "/organization/dashboard",
            "/organization/profile",
            "/organization/settings",
            "/organization/onboarding — Setup wizard",
            "/organization/subscription",
            "/organization/verification",
            "/organization/analytics",
            "/organization/referrals",
            "/organization/domain",
        ],
        "apis": [
            "GET/PUT /api/v1/admin/organization/profile|details|business-info|locale|settings|branding|subscription",
            "Onboarding: status|step|complete|review",
            "POST/DELETE /logo",
            "GET statistics|analytics|users|activity",
            "GET /api/v1/organization/subscription/plans",
        ],
        "collections": ["organizations", "subscriptions"],
        "roles": ["Admin", "Executive"],
        "features": [
            {
                "name": "Org profile, branding, settings",
                "desc": "Maintain org identity, logo, locale, and settings.",
                "pages": "/organization/profile, /settings",
                "apis": "/api/v1/admin/organization/*",
                "collections": "organizations",
                "roles": "Admin, Executive",
                "status": "Implemented",
            },
            {
                "name": "Organization setup wizard",
                "desc": "Step-based onboarding including departments, designations, locations, shift types as embedded org master data.",
                "pages": "/organization/onboarding",
                "apis": "/api/v1/admin/organization onboarding endpoints",
                "collections": "organizations",
                "roles": "Admin, Executive",
                "status": "Implemented",
            },
            {
                "name": "Subscription plan catalog",
                "desc": "View plans and update org subscription field; no payment-gateway checkout found.",
                "pages": "/organization/subscription",
                "apis": "/api/v1/organization/subscription/plans; PUT .../subscription",
                "collections": "organizations, subscriptions",
                "roles": "Admin, Executive",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Department Management",
        "purpose": "Maintain organization departments as master data for employee assignment.",
        "status": "Partial",
        "pages": ["/organization/onboarding (wizard step)"],
        "apis": ["Updated via organization onboarding step APIs (embedded on Organization)"],
        "collections": ["organizations (orgDepartments field)"],
        "roles": ["Admin", "Executive"],
        "features": [
            {
                "name": "Department master (embedded)",
                "desc": "Departments stored as arrays on Organization via setup wizard — no standalone department CRUD module/API.",
                "pages": "/organization/onboarding",
                "apis": "Org onboarding step APIs",
                "collections": "organizations",
                "roles": "Admin",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Designation Management",
        "purpose": "Maintain job designations/titles as organization master data.",
        "status": "Partial",
        "pages": ["/organization/onboarding (wizard step)"],
        "apis": ["Updated via organization onboarding step APIs (orgDesignations)"],
        "collections": ["organizations (orgDesignations field)"],
        "roles": ["Admin", "Executive"],
        "features": [
            {
                "name": "Designation master (embedded)",
                "desc": "Designations embedded on Organization; employee.position is a string field. No standalone designation module.",
                "pages": "/organization/onboarding",
                "apis": "Org onboarding step APIs; GET /admin/employee/job-titles",
                "collections": "organizations, employees",
                "roles": "Admin",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Branch / Office Location Management",
        "purpose": "Maintain office locations / branches for geo-attendance and org structure.",
        "status": "Partial",
        "pages": ["/organization/onboarding", "/attendance-rules"],
        "apis": ["Org onboarding (officeLocations); attendance rules geo config"],
        "collections": ["organizations (officeLocations)", "attendanceRules"],
        "roles": ["Admin", "HR", "Executive"],
        "features": [
            {
                "name": "Office locations (embedded)",
                "desc": "Branches/locations as Organization.officeLocations; used with attendance geo rules. No standalone branch CRUD module.",
                "pages": "/organization/onboarding, /attendance-rules",
                "apis": "Org onboarding; attendance-rules",
                "collections": "organizations, attendanceRules",
                "roles": "Admin, HR",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Attendance",
        "purpose": "Employee clock-in/out, break tracking, team attendance views, PDF export, and geo-fence enforcement via attendance rules.",
        "status": "Implemented",
        "pages": [
            "/attendance — Attendance dashboard",
            "/today-attendance — Today status",
            "/all-attendance-history — Team/history",
            "/attendance-rules — Attendance rules",
            "/employee/leave-attendance — ESS hub (attendance log tab)",
            "/daily-report — Daily report",
        ],
        "apis": [
            "POST/GET /api/v1/both/attendance/clock-in|clock-out|break-in|break-out|force-end-break",
            "get-logs, summary, employee list/details, team history, today status, on-break, my-today, rule, export-pdf",
            "/api/v1/admin/attendance-rules/*",
        ],
        "collections": ["attendances", "attendanceRules", "attendanceRuleAudits"],
        "roles": ["Employee", "Manager", "HR", "Admin", "Executive"],
        "features": [
            {
                "name": "Clock in / clock out",
                "desc": "Geo-aware clocking with organization rules.",
                "pages": "AttendanceBox / LeaveAttendanceHub / AttendanceDashboard",
                "apis": "POST .../attendance/clock-in|clock-out",
                "collections": "attendances",
                "roles": "Employee",
                "status": "Implemented",
            },
            {
                "name": "Break management",
                "desc": "Start/end breaks and force-end; on-break team visibility.",
                "pages": "Attendance UI components",
                "apis": "break-in|break-out|force-end-break|on-break",
                "collections": "attendances",
                "roles": "Employee, Manager, HR, Admin",
                "status": "Implemented",
            },
            {
                "name": "Team attendance & history",
                "desc": "Managers/HR view team status and historical logs; PDF export.",
                "pages": "/today-attendance, /all-attendance-history",
                "apis": "team history, today status, export-pdf",
                "collections": "attendances",
                "roles": "Manager, HR, Admin, Executive",
                "status": "Implemented",
            },
            {
                "name": "Attendance rules (geo / shifts fields)",
                "desc": "Create/update/deactivate rules including radius and shifts[] configuration.",
                "pages": "/attendance-rules, Admin Settings tab",
                "apis": "/api/v1/admin/attendance-rules/*",
                "collections": "attendanceRules, attendanceRuleAudits",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Auto check-out job",
                "desc": "Scheduled auto clock-out with pre-notification.",
                "pages": "N/A (background job)",
                "apis": "Job: autoCheckOutJob",
                "collections": "attendances, notifications",
                "roles": "System",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Shift Management",
        "purpose": "Define shift types for the organization and associate shifts with attendance rules.",
        "status": "Partial",
        "pages": ["/organization/onboarding", "/attendance-rules"],
        "apis": ["Org onboarding (shiftTypes); attendance rules shifts[]"],
        "collections": ["organizations (shiftTypes)", "attendanceRules"],
        "roles": ["Admin", "HR"],
        "features": [
            {
                "name": "Shift types (embedded master)",
                "desc": "shiftTypes on Organization and shifts on attendance rules. No full shift roster scheduling module.",
                "pages": "Org onboarding, attendance rules",
                "apis": "Org onboarding; attendance-rules",
                "collections": "organizations, attendanceRules",
                "roles": "Admin, HR",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Roster / Shift Scheduling",
        "purpose": "Employee shift roster planning and assignment.",
        "status": "Not Implemented",
        "pages": ["None — /platform-roles/roster is a user-roles roster, not shift roster"],
        "apis": ["None for shift scheduling"],
        "collections": ["N/A"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Shift roster scheduling",
                "desc": "No employee shift roster / schedule planning module found in routes, models, or UI.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Attendance Regularization",
        "purpose": "Employees request corrections to attendance; managers approve/reject with workflow support.",
        "status": "Implemented",
        "pages": [
            "/my-attendance-regularization",
            "/attendance-regularization, /manager/attendance-regularization",
            "LeaveAttendanceHub regularization tab",
        ],
        "apis": [
            "/api/v1/both/attendance-regularization/* (limits, request, cancel, manager approve/reject)",
        ],
        "collections": ["attendanceregularizations", "approvalinstances"],
        "roles": ["Employee", "Manager", "HR", "Admin", "Executive"],
        "features": [
            {
                "name": "Request & approve regularization",
                "desc": "Employee requests; manager/HR approve or reject; limits enforced.",
                "pages": "My + Manager regularization pages",
                "apis": "/api/v1/both/attendance-regularization/*",
                "collections": "attendanceregularizations",
                "roles": "Employee, Manager, HR, Admin",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Work From Home (WFH)",
        "purpose": "Employees submit WFH requests; managers/HR review.",
        "status": "Implemented",
        "pages": [
            "LeaveAttendanceHub WFH tab",
            "Manager TeamWfhRequestsPanel",
            "Regularization/WFH hub areas",
        ],
        "apis": ["/api/v1/both/wfh-requests (create, my, all, review)"],
        "collections": ["wfhrequests"],
        "roles": ["Employee", "Manager", "HR", "Admin"],
        "features": [
            {
                "name": "WFH request lifecycle",
                "desc": "Create, list own/all, and review WFH requests.",
                "pages": "ESS hub + Manager panels",
                "apis": "/api/v1/both/wfh-requests/*",
                "collections": "wfhrequests",
                "roles": "Employee, Manager, HR",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Leave Management",
        "purpose": "End-to-end leave including apply/approve, policies, balances, accrual automation, encashment, reports, and compensatory off.",
        "status": "Implemented",
        "pages": [
            "/leave — Apply leave",
            "/my-leave, /employee/leave-attendance — Leave summary",
            "/leave-management — Admin/HR/Manager queue",
            "/admin/leave-policy — Policy management",
            "/admin/leave-balance — Balance viewer",
            "/admin/leave-reports — Leave reports",
        ],
        "apis": [
            "/api/v1/employee/leave/*",
            "/api/v1/admin/leave/*",
            "/api/v1/admin/leave-policy/*",
            "/api/v1/admin/leave-reports/*",
            "/api/v1/admin|employee/leave-encashment/*",
            "/api/v1/admin/comp-off/*",
            "Employee CompOffRoutes exist but are NOT mounted",
        ],
        "collections": [
            "leaves",
            "leavebalances",
            "leavebalanceaudits",
            "leavepolicies",
            "compoffs",
        ],
        "roles": ["Employee", "Manager", "HR", "Admin", "Executive"],
        "features": [
            {
                "name": "Leave application & cancellation",
                "desc": "Employees apply leave with optional document upload; cancel pending requests.",
                "pages": "/leave, LeaveAttendanceHub",
                "apis": "/api/v1/employee/leave/*",
                "collections": "leaves, leavebalances",
                "roles": "Employee",
                "status": "Implemented",
            },
            {
                "name": "Leave approval queue",
                "desc": "Managers/HR/Admin update leave status and view statistics.",
                "pages": "/leave-management",
                "apis": "/api/v1/admin/leave/*",
                "collections": "leaves",
                "roles": "Manager, HR, Admin, Executive",
                "status": "Implemented",
            },
            {
                "name": "Leave policy & balance engine",
                "desc": "Policy CRUD, accrual, carry-forward, adjust, recalculate, audit history; automation job.",
                "pages": "/admin/leave-policy, /admin/leave-balance",
                "apis": "/api/v1/admin/leave-policy/*",
                "collections": "leavepolicies, leavebalances, leavebalanceaudits",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Leave encashment",
                "desc": "Request, history, and approve encashment (admin + employee mounts).",
                "pages": "Employee leave components (encashment)",
                "apis": "/api/v1/*/leave-encashment/*",
                "collections": "leaves / leavebalances (encashment flows)",
                "roles": "Employee, Admin, HR",
                "status": "Implemented",
            },
            {
                "name": "Leave reports",
                "desc": "Usage trends, balance report, approval analytics.",
                "pages": "/admin/leave-reports",
                "apis": "/api/v1/admin/leave-reports/*",
                "collections": "leaves, leavebalances",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Compensatory off (Comp-Off)",
                "desc": "Admin approve/reject + expiry job implemented; employee create/use/cancel routes exist but are not mounted in registerRoutes.",
                "pages": "Admin leave/comp-off areas (admin API)",
                "apis": "/api/v1/admin/comp-off/*; Both/CompOffRoutes unmounted",
                "collections": "compoffs",
                "roles": "Admin, HR, Employee (API gap)",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Holiday & Calendar Management",
        "purpose": "Organization calendar with holidays, working days/hours, imports (including Indian holidays), and employee calendar views.",
        "status": "Implemented",
        "pages": [
            "/calendar-management",
            "Employee calendar (within ESS / calendar pages)",
        ],
        "apis": [
            "/api/v1/admin/calendar/* (year, holidays CRUD, working days, upload, import-indian-holidays)",
            "/api/v1/employee/calendar/*",
        ],
        "collections": ["calendars"],
        "roles": ["Admin", "HR", "Executive", "Employee"],
        "features": [
            {
                "name": "Holiday CRUD & calendar config",
                "desc": "Manage holidays, working days/hours, uploads, and Indian holiday import.",
                "pages": "/calendar-management",
                "apis": "/api/v1/admin/calendar/*",
                "collections": "calendars",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Employee calendar view",
                "desc": "Employees view year/month holidays and working-day checks.",
                "pages": "Employee calendar UI",
                "apis": "/api/v1/employee/calendar/*",
                "collections": "calendars",
                "roles": "Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Payroll",
        "purpose": "Create, process, disburse, void/supersede payroll; employee payslips; payroll reports. Bank disbursement uses mock provider.",
        "status": "Implemented",
        "pages": [
            "/admin-payroll",
            "/add-payroll",
            "/add-payroll/:employeeId/:month/:year",
            "/admin-employee-payroll/:employeeId",
            "/employee-payroll — My payroll / payslip",
            "/dashboard-finance",
        ],
        "apis": [
            "/api/v1/admin/payroll/* (create/update/bulk/process/void/supersede/disburse/export-pdf)",
            "/api/v1/employee/payroll/* (history, current, by-month, details, download)",
            "/api/v1/admin/payroll-reports/*",
        ],
        "collections": ["payrolls"],
        "roles": ["Admin", "HR", "Finance", "Executive", "Employee (self)"],
        "features": [
            {
                "name": "Payroll run lifecycle",
                "desc": "Generate/create/update, process, visibility, void/supersede, disburse (mock bank).",
                "pages": "/admin-payroll, /add-payroll",
                "apis": "/api/v1/admin/payroll/*",
                "collections": "payrolls",
                "roles": "Admin, HR, Finance, Executive",
                "status": "Implemented",
            },
            {
                "name": "Employee payslip / history",
                "desc": "Self-service payroll history and download.",
                "pages": "/employee-payroll",
                "apis": "/api/v1/employee/payroll/*",
                "collections": "payrolls",
                "roles": "Employee",
                "status": "Implemented",
            },
            {
                "name": "Payroll reports",
                "desc": "Statistics, monthly, department, tax, deductions, earnings, comparison.",
                "pages": "Finance/HR report areas",
                "apis": "/api/v1/admin/payroll-reports/*",
                "collections": "payrolls",
                "roles": "Admin, HR, Finance, Executive",
                "status": "Implemented",
            },
            {
                "name": "Bank disbursement",
                "desc": "Disburse endpoint present; paymentService is mock bank transfer only.",
                "pages": "Admin payroll",
                "apis": "disburse (+ preview)",
                "collections": "payrolls",
                "roles": "Admin, Finance",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Salary Structure",
        "purpose": "Define salary structures, apply to employees, calculate components, and generate payroll from structure.",
        "status": "Implemented",
        "pages": ["/salary-structure"],
        "apis": ["/api/v1/admin/salary-structure/* (CRUD, apply, generate-payroll, applicable, calculate)"],
        "collections": ["salarystructures", "payrolls"],
        "roles": ["Admin", "HR", "Finance", "Executive"],
        "features": [
            {
                "name": "Salary structure management",
                "desc": "CRUD structures, apply to employees, calculate, generate payroll.",
                "pages": "/salary-structure",
                "apis": "/api/v1/admin/salary-structure/*",
                "collections": "salarystructures",
                "roles": "Admin, HR, Finance, Executive",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Loan Management",
        "purpose": "Employee loan requests, EMI, and recovery through payroll.",
        "status": "Not Implemented",
        "pages": ["None"],
        "apis": ["None — only payroll.loanDeduction field and tax-declaration loan amounts"],
        "collections": ["N/A (fields on employees/payrolls only)"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Loan module",
                "desc": "No loan routes, controllers, models, or UI. Only deduction/tax fields.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Advance Salary",
        "purpose": "Advance salary request and recovery.",
        "status": "Not Implemented",
        "pages": ["None"],
        "apis": ["None found"],
        "collections": ["N/A"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Advance salary",
                "desc": "No advance salary module found in codebase.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Expense Management / Reimbursement",
        "purpose": "Employee expense claims with approve/reject/mark-paid workflow.",
        "status": "Partial",
        "pages": [
            "Finance dashboard links to /admin/expenses — route does NOT exist",
            "No dedicated Expense page components found under vite_client/src",
        ],
        "apis": [
            "/api/v1/both/expense/* (CRUD, statistics, approve, reject, mark-paid) — backend fully present",
            "Dashboard hook useDashboardData calls GET /v1/both/expense",
        ],
        "collections": ["expenses"],
        "roles": ["Employee", "Manager", "HR", "Admin", "Finance (intended)"],
        "features": [
            {
                "name": "Expense API lifecycle",
                "desc": "Backend CRUD + approve/reject/paid fully implemented.",
                "pages": "No dedicated page (dead Finance link)",
                "apis": "/api/v1/both/expense/*",
                "collections": "expenses",
                "roles": "Backend roles per route middleware",
                "status": "Partial",
            },
            {
                "name": "Expense UI / reimbursement portal",
                "desc": "No routed Expense UI; Finance dashboard navigates to missing /admin/expenses.",
                "pages": "Missing",
                "apis": "N/A",
                "collections": "expenses",
                "roles": "Finance",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Performance Management (Reviews / KPI / OKR / Appraisal)",
        "purpose": "Performance reviews, tracking, goals, review cycles, and one-on-ones.",
        "status": "Partial",
        "pages": [
            "PerformanceTab on employee details (score fields only)",
            "/admin/reports/performance — Performance report page",
            "/one-on-one — One-on-one meetings",
            "No dedicated routes for performance-review, goals, review-cycle, OKR UI",
        ],
        "apis": [
            "/api/v1/both/performance-review/*",
            "/api/v1/both/performance-tracking/*",
            "/api/v1/both/goal/*",
            "/api/v1/admin/review-cycle/*",
            "/api/v1/both/one-on-one/*",
        ],
        "collections": ["performancereviews", "reviewCycles", "goals", "oneonones"],
        "roles": ["Admin", "HR", "Manager", "Employee"],
        "features": [
            {
                "name": "Performance review & tracking APIs",
                "desc": "Backend APIs for reviews and tracking are mounted and implemented.",
                "pages": "No full appraisal UI routes found",
                "apis": "/api/v1/both/performance-review|performance-tracking/*",
                "collections": "performancereviews",
                "roles": "Admin, HR, Manager, Employee",
                "status": "Partial",
            },
            {
                "name": "Goals / OKR",
                "desc": "Goal APIs exist; no dedicated Goals/OKR frontend pages in router.",
                "pages": "None dedicated",
                "apis": "/api/v1/both/goal/*",
                "collections": "goals",
                "roles": "Admin, HR, Manager, Employee",
                "status": "Partial",
            },
            {
                "name": "Review cycles",
                "desc": "Admin review-cycle APIs exist; no dedicated UI route found.",
                "pages": "None dedicated",
                "apis": "/api/v1/admin/review-cycle/*",
                "collections": "reviewCycles",
                "roles": "Admin, HR",
                "status": "Partial",
            },
            {
                "name": "One-on-one meetings",
                "desc": "Manager and employee one-on-one pages with role wrapper.",
                "pages": "/one-on-one",
                "apis": "/api/v1/both/one-on-one/*",
                "collections": "oneonones",
                "roles": "Manager, Employee, Admin, HR",
                "status": "Implemented",
            },
            {
                "name": "Employee performance score field",
                "desc": "Simple editable performanceScore on employee details — not full appraisal.",
                "pages": "PerformanceTab",
                "apis": "Employee update",
                "collections": "employees",
                "roles": "Admin, HR, Manager",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Recruitment & Candidate / Interview Management",
        "purpose": "Job postings, candidate pipeline, interviews, scoring, offers, and analytics (ATS).",
        "status": "Partial",
        "pages": [
            "/recruitment — Recruitment ATS page",
            "Post New Job navigates to /recruitment/create-job — route does NOT exist",
        ],
        "apis": [
            "/api/v1/admin/recruitment/* (jobs, candidates, interview, score, offer, pipeline, analytics)",
            "POST /api/v1/both/recruitment/jobs/:jobPostingId/apply",
        ],
        "collections": ["recruitments", "candidates"],
        "roles": ["Admin", "HR", "Executive", "Public apply (both)"],
        "features": [
            {
                "name": "Recruitment ATS APIs",
                "desc": "Full backend for jobs, candidates, interview, offer, pipeline, analytics.",
                "pages": "/recruitment",
                "apis": "/api/v1/admin/recruitment/*",
                "collections": "recruitments, candidates",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Recruitment UI completeness",
                "desc": "List UI present; create-job route missing; errors often silenced.",
                "pages": "/recruitment (create-job dead link)",
                "apis": "Admin recruitment APIs",
                "collections": "recruitments, candidates",
                "roles": "Admin, HR",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Onboarding",
        "purpose": "Onboarding templates and workflows with tasks, documents, checklists, buddy, training, signatures, and employee self-service progress.",
        "status": "Implemented",
        "pages": [
            "/onboarding — OnboardingHub (HR + employee via wrapper)",
        ],
        "apis": [
            "/api/v1/admin/onboarding/* (templates, workflows, tasks, docs, checklist, assets, training, signatures, buddy, offboarding)",
            "/api/v1/both/onboarding/* (my workflow/tasks, dashboard)",
        ],
        "collections": ["onboardingworkflows", "onboardingtemplates", "offboardingworkflows"],
        "roles": ["Admin", "HR", "Manager", "Employee"],
        "features": [
            {
                "name": "Onboarding workflows & templates",
                "desc": "HR manages templates/workflows; employees complete tasks.",
                "pages": "/onboarding",
                "apis": "/api/v1/admin/onboarding/*, /api/v1/both/onboarding/*",
                "collections": "onboardingworkflows, onboardingtemplates",
                "roles": "Admin, HR, Manager, Employee",
                "status": "Implemented",
            },
            {
                "name": "Onboarding scheduled job",
                "desc": "Background triggers for onboarding schedule.",
                "pages": "N/A",
                "apis": "Job: onboardingScheduledJob",
                "collections": "onboardingworkflows",
                "roles": "System",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Offboarding",
        "purpose": "Employee exit workflows nested under onboarding/offboarding controllers.",
        "status": "Implemented",
        "pages": ["/onboarding (offboarding actions within hub/API)"],
        "apis": ["/api/v1/admin/onboarding/* offboarding endpoints"],
        "collections": ["offboardingworkflows"],
        "roles": ["Admin", "HR"],
        "features": [
            {
                "name": "Offboarding workflows",
                "desc": "OffboardingWorkflow model and admin onboarding router offboarding actions.",
                "pages": "Onboarding hub / admin APIs",
                "apis": "Admin onboarding offboarding endpoints",
                "collections": "offboardingworkflows",
                "roles": "Admin, HR",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Assets Management",
        "purpose": "Track company assets assigned to employees.",
        "status": "Partial",
        "pages": ["Onboarding hub asset steps only"],
        "apis": ["Nested assets update endpoints under /api/v1/admin/onboarding"],
        "collections": ["onboardingworkflows (assets[] nested) — no global asset collection"],
        "roles": ["Admin", "HR"],
        "features": [
            {
                "name": "Onboarding-scoped assets",
                "desc": "Assets tracked only as nested fields in onboarding workflows — no enterprise asset register/inventory module.",
                "pages": "/onboarding",
                "apis": "Admin onboarding assets endpoints",
                "collections": "onboardingworkflows",
                "roles": "Admin, HR",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Inventory",
        "purpose": "Stock / inventory management.",
        "status": "Not Implemented",
        "pages": ["None"],
        "apis": ["None"],
        "collections": ["N/A"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Inventory module",
                "desc": "No inventory module found.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Visitor Management",
        "purpose": "Visitor check-in/out and visitor passes.",
        "status": "Not Implemented",
        "pages": ["None"],
        "apis": ["None — only idCard.cardType enum value 'visitor'"],
        "collections": ["idcards (enum only)"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Visitor management",
                "desc": "No visitor module; visitor is only an ID card type enum.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Help Desk / Ticket Management",
        "purpose": "Internal helpdesk tickets with comments, resolve, and analytics.",
        "status": "Partial",
        "pages": ["/helpdesk — HelpdeskPage"],
        "apis": ["/api/v1/both/helpdesk/* (CRUD, comment, resolve, analytics)"],
        "collections": ["helpdesktickets"],
        "roles": ["Admin", "HR", "Executive", "Employee (API)"],
        "features": [
            {
                "name": "Helpdesk APIs",
                "desc": "Full ticket lifecycle APIs implemented.",
                "pages": "/helpdesk",
                "apis": "/api/v1/both/helpdesk/*",
                "collections": "helpdesktickets",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
            {
                "name": "Helpdesk UI actions",
                "desc": "List fetches API; New Ticket / View buttons have no handlers.",
                "pages": "/helpdesk",
                "apis": "Helpdesk APIs",
                "collections": "helpdesktickets",
                "roles": "Admin, HR, Executive",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Announcements / Notices",
        "purpose": "Broadcast announcements via the notifications subsystem.",
        "status": "Implemented",
        "pages": ["/sent-announcements", "Notification sender embedded in Admin"],
        "apis": ["/api/v1/both/notification/* (create-notification, sent-announcements)"],
        "collections": ["notifications"],
        "roles": ["Admin", "HR", "Executive"],
        "features": [
            {
                "name": "Announcements via notifications",
                "desc": "Create and list sent announcements; no separate Announcement collection.",
                "pages": "/sent-announcements",
                "apis": "/api/v1/both/notification/*",
                "collections": "notifications",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Events",
        "purpose": "Corporate events calendar distinct from holidays.",
        "status": "Not Implemented",
        "pages": ["None (special event notification job for birthdays etc. exists)"],
        "apis": ["specialEventNotificationJob — not a full events module"],
        "collections": ["N/A"],
        "roles": ["N/A"],
        "features": [
            {
                "name": "Corporate events module",
                "desc": "No dedicated events CRUD module; birthday/special notifications exist as a job.",
                "pages": "None",
                "apis": "Job only",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Documents",
        "purpose": "HR document library, versioning, sharing, employee my-documents, and legacy upload endpoints.",
        "status": "Implemented",
        "pages": [
            "/documents — HR library",
            "/documents/:id/versions",
            "/employee/my-documents",
            "/employee/documents-id — Documents & ID hub",
        ],
        "apis": [
            "/api/v1/admin/documents/*",
            "/api/v1/both/documents/*",
            "/api/v1/both/document + /api/v1/upload (legacy upload)",
        ],
        "collections": ["documents", "documentrequests"],
        "roles": ["Admin", "HR", "Executive", "Employee", "Manager"],
        "features": [
            {
                "name": "Document library & versions",
                "desc": "HR approve/version/share; employee personal documents.",
                "pages": "/documents, /employee/my-documents",
                "apis": "admin/both documents APIs",
                "collections": "documents, documentrequests",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "ID Cards",
        "purpose": "Generate and manage employee ID cards (cardType includes visitor enum).",
        "status": "Implemented",
        "pages": ["/id-card-generator", "/employee/id-card, /employee/documents-id"],
        "apis": ["/api/v1/admin/id-cards/*"],
        "collections": ["idcards"],
        "roles": ["Admin", "HR", "Executive", "Employee (view)"],
        "features": [
            {
                "name": "ID card generation",
                "desc": "Admin/HR generate ID cards; employees view via Documents & ID.",
                "pages": "/id-card-generator, DocumentsAndIdPage",
                "apis": "/api/v1/admin/id-cards/*",
                "collections": "idcards",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Company Policies",
        "purpose": "Publish company policies and track employee acknowledgments/compliance.",
        "status": "Implemented",
        "pages": [
            "/admin/policies, /admin/policies/create, /:id, /:id/edit",
            "/employee/policies",
        ],
        "apis": ["/api/v1/organization/policies/*"],
        "collections": ["companypolicies", "policyacknowledgments"],
        "roles": ["Admin", "HR", "Executive", "Employee"],
        "features": [
            {
                "name": "Policy CRUD & acknowledgment",
                "desc": "HR manages policies; employees acknowledge; compliance views.",
                "pages": "PolicyManager + ViewPolicies",
                "apis": "/api/v1/organization/policies/*",
                "collections": "companypolicies, policyacknowledgments",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Learning & Development (Custom)",
        "purpose": "Courses, enrollments, learning paths, skills, certificates, analytics, and team learning.",
        "status": "Implemented",
        "pages": [
            "/learning — Learning hub (role wrapper)",
            "/learning/courses/:courseId",
            "/learning/create-course, /learning/edit-course/:courseId",
            "/employee/benefits-learning",
            "/team-learning",
        ],
        "apis": [
            "/api/v1/admin/learning/*",
            "/api/v1/both/learning/*",
            "/api/v1/both/team-learning/*",
        ],
        "collections": ["courses", "enrollments", "learningpaths", "skills", "teamlearnings", "learningprogresses"],
        "roles": ["Admin", "HR", "Executive", "Manager", "Employee"],
        "features": [
            {
                "name": "Course catalog & enrollments",
                "desc": "Admin CRUD courses/paths; employees enroll and track progress.",
                "pages": "/learning, course detail/create/edit",
                "apis": "admin/both learning APIs",
                "collections": "courses, enrollments, learningpaths, skills",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
            {
                "name": "Team learning",
                "desc": "Manager-facing team learning page and APIs.",
                "pages": "/team-learning",
                "apis": "/api/v1/both/team-learning/*",
                "collections": "teamlearnings, learningprogresses",
                "roles": "Manager, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Engagement (Surveys / Feedback / Recognition) (Custom)",
        "purpose": "Employee engagement via surveys, feedback, and recognition.",
        "status": "Implemented",
        "pages": [
            "/engagement",
            "/engagement/surveys/:surveyId",
            "/engagement/create-survey",
        ],
        "apis": ["/api/v1/admin/engagement/*, /api/v1/both/engagement/*"],
        "collections": ["surveys", "surveyresponses", "feedbacks", "recognitions"],
        "roles": ["Admin", "HR", "Executive", "Employee"],
        "features": [
            {
                "name": "Surveys, feedback, recognition",
                "desc": "Create/respond to surveys; feedback and recognition records.",
                "pages": "/engagement*",
                "apis": "engagement APIs",
                "collections": "surveys, surveyresponses, feedbacks, recognitions",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Benefits (Custom)",
        "purpose": "Benefit plans and employee enrollments.",
        "status": "Implemented",
        "pages": ["/benefits", "/benefits/:id", "/employee/benefits-learning"],
        "apis": ["/api/v1/admin/benefits/*, /api/v1/both/benefits/*"],
        "collections": ["benefitplans", "employeebenefits"],
        "roles": ["Admin", "HR", "Executive", "Employee"],
        "features": [
            {
                "name": "Benefit plans & enrollment",
                "desc": "HR manages plans; employees enroll and view benefits.",
                "pages": "/benefits, BenefitsLearningHub",
                "apis": "benefits APIs",
                "collections": "benefitplans, employeebenefits",
                "roles": "Admin, HR, Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Succession Planning (Custom)",
        "purpose": "Succession plans and talent pools for critical roles.",
        "status": "Implemented",
        "pages": ["/succession", "/succession/:id"],
        "apis": ["/api/v1/admin/succession/*"],
        "collections": ["successionplans", "talentpools"],
        "roles": ["Admin", "HR", "Executive"],
        "features": [
            {
                "name": "Succession plans & talent pools",
                "desc": "List/detail succession planning UI backed by admin APIs.",
                "pages": "/succession*",
                "apis": "/api/v1/admin/succession/*",
                "collections": "successionplans, talentpools",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Workforce Planning (Custom)",
        "purpose": "Workforce plans and headcount forecasts.",
        "status": "Implemented",
        "pages": ["/workforce", "/workforce/:id"],
        "apis": ["/api/v1/admin/workforce/*"],
        "collections": ["workforceplans", "headcountforecasts"],
        "roles": ["Admin", "HR", "Executive"],
        "features": [
            {
                "name": "Workforce plans & forecasts",
                "desc": "List/detail workforce planning with headcount forecasts.",
                "pages": "/workforce*",
                "apis": "/api/v1/admin/workforce/*",
                "collections": "workforceplans, headcountforecasts",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Projects & Tasks (Custom)",
        "purpose": "Project management with tasks and work items for employees and managers.",
        "status": "Implemented",
        "pages": [
            "/projects",
            "/projects/:id",
            "/add-project",
            "/employee/projects",
            "/employee/projects/:projectId",
        ],
        "apis": [
            "/api/v1/admin/project/*",
            "/api/v1/both/project-task/*",
        ],
        "collections": ["projects", "projectUpdates", "project_work_items", "tasks"],
        "roles": ["Admin", "Manager", "Project Manager", "HR", "Executive", "Employee"],
        "features": [
            {
                "name": "Project CRUD & detail",
                "desc": "Create/list/detail projects; employee my-projects and tasks.",
                "pages": "/projects*, /employee/projects*",
                "apis": "admin project + both project-task",
                "collections": "projects, tasks, project_work_items",
                "roles": "Admin, Manager, Employee",
                "status": "Implemented",
            },
            {
                "name": "Project delete confirmation",
                "desc": "TODO in ProjectPage: delete confirmation modal + delete API not fully wired.",
                "pages": "/projects",
                "apis": "Project delete (incomplete UI wiring)",
                "collections": "projects",
                "roles": "Admin, Manager",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Approval Workflows & SLA (Custom)",
        "purpose": "Configurable multi-step approval workflows with timeout job; SLA definitions and violations.",
        "status": "Partial",
        "pages": [
            "/admin/approval-workflows",
            "/admin/pending-approvals",
            "Admin/SLA components exist but are NOT routed/nav-linked",
        ],
        "apis": [
            "/api/v1/admin/approvals/*",
            "/api/v1/admin/sla/*",
            "Jobs: approvalTimeoutJob",
        ],
        "collections": ["approvalworkflows", "approvalinstances", "slas", "slaviolations"],
        "roles": ["Admin", "HR", "Manager", "Executive"],
        "features": [
            {
                "name": "Approval workflows & pending queue",
                "desc": "Configure workflows and process pending approvals (used by leave/regularization etc.).",
                "pages": "/admin/approval-workflows, /admin/pending-approvals",
                "apis": "/api/v1/admin/approvals/*",
                "collections": "approvalworkflows, approvalinstances",
                "roles": "Admin, HR, Manager, Executive",
                "status": "Implemented",
            },
            {
                "name": "SLA management UI",
                "desc": "SLA Manager UI + APIs exist; not registered in routes or navigation.",
                "pages": "Orphan Admin/SLA/*",
                "apis": "/api/v1/admin/sla/*",
                "collections": "slas, slaviolations",
                "roles": "Admin, HR",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Reports & Analytics",
        "purpose": "HR reports suite, analytics endpoints, generic reports with PDF export, payroll/leave reports.",
        "status": "Implemented",
        "pages": [
            "/admin/reports/headcount|attrition|payroll|attendance|performance|recruitment|compliance",
            "/hr/analytics",
            "/organization/analytics",
        ],
        "apis": [
            "/api/v1/admin/reports/*",
            "/api/v1/admin/analytics/*",
            "/api/v1/admin/leave-reports/*",
            "/api/v1/admin/payroll-reports/*",
            "/api/v1/admin/executive/*",
        ],
        "collections": ["reports", "employees", "attendances", "leaves", "payrolls", "recruitments"],
        "roles": ["Admin", "HR", "Executive", "Finance"],
        "features": [
            {
                "name": "HR nested reports",
                "desc": "Headcount, attrition, payroll, attendance, performance, recruitment, compliance report pages.",
                "pages": "/admin/reports/*",
                "apis": "reports + domain report APIs",
                "collections": "reports + domain collections",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "HR analytics page",
                "desc": "Dedicated HR analytics UI.",
                "pages": "/hr/analytics",
                "apis": "/api/v1/admin/analytics/hr",
                "collections": "Multiple",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Admin Settings Reports tab",
                "desc": "Placeholder tab with no actions.",
                "pages": "/admin-settings",
                "apis": "N/A",
                "collections": "N/A",
                "roles": "Admin",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Notifications (In-App / Push / Email)",
        "purpose": "In-app notifications, web push subscriptions, notification settings, email queue/templates, special event notifications.",
        "status": "Implemented",
        "pages": [
            "/notifications",
            "/admin-settings (Notifications / Email tabs)",
            "/sent-announcements",
        ],
        "apis": [
            "/api/v1/both/notification/*",
            "/api/v1/admin/notification-settings/*",
            "/api/v1/both/push-subscription/*",
            "/api/push",
            "/api/v1/both/email/* (test/status)",
        ],
        "collections": [
            "notifications",
            "notificationsettings",
            "pushsubscriptions",
            "subscriptions",
            "emailtemplates",
        ],
        "roles": ["All authenticated; Admin for settings"],
        "features": [
            {
                "name": "In-app notifications",
                "desc": "Create/list/read notifications inbox.",
                "pages": "/notifications",
                "apis": "/api/v1/both/notification/*",
                "collections": "notifications",
                "roles": "All authenticated",
                "status": "Implemented",
            },
            {
                "name": "Web push",
                "desc": "VAPID web-push subscriptions.",
                "pages": "Browser push registration",
                "apis": "push-subscription + /api/push",
                "collections": "pushsubscriptions, subscriptions",
                "roles": "All authenticated",
                "status": "Implemented",
            },
            {
                "name": "Email notifications",
                "desc": "SMTP/nodemailer + queued email job + templates.",
                "pages": "Admin settings Email tab",
                "apis": "email helpers/jobs; /api/v1/both/email/*",
                "collections": "emailtemplates",
                "roles": "System / Admin",
                "status": "Implemented",
            },
            {
                "name": "SMS notifications",
                "desc": "No SMS integration found in codebase.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
            {
                "name": "WhatsApp notifications",
                "desc": "No WhatsApp integration found in codebase.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
    {
        "name": "Audit Logs",
        "purpose": "Administrative audit trail of system actions.",
        "status": "Implemented",
        "pages": ["Consumed via admin APIs / settings areas (AuditLogRoutes mounted)"],
        "apis": ["/api/v1/admin/audit-logs/*"],
        "collections": ["auditlogs"],
        "roles": ["Admin"],
        "features": [
            {
                "name": "Audit log API",
                "desc": "Admin audit log endpoints backed by AuditLog model. Dedicated UI page not prominently routed as a primary nav item.",
                "pages": "API-backed (limited dedicated UI exposure)",
                "apis": "/api/v1/admin/audit-logs/*",
                "collections": "auditlogs",
                "roles": "Admin",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Settings",
        "purpose": "Admin settings hub for attendance rules, leave policy, notifications, email, theme, and general settings.",
        "status": "Partial",
        "pages": ["/admin-settings", "/organization/settings", "/attendance-rules"],
        "apis": [
            "Organization settings APIs",
            "Notification settings",
            "Attendance rules",
            "Leave policy",
            "Email test endpoints",
        ],
        "collections": ["organizations", "notificationsettings", "attendanceRules", "leavepolicies"],
        "roles": ["Admin", "HR", "Executive"],
        "features": [
            {
                "name": "Admin settings hub (working tabs)",
                "desc": "Attendance Rules, Leave Policy, Notifications, Email, Theme, General tabs functional.",
                "pages": "/admin-settings",
                "apis": "Various settings APIs",
                "collections": "Multiple",
                "roles": "Admin, HR, Executive",
                "status": "Implemented",
            },
            {
                "name": "Security / Permissions / Reports settings tabs",
                "desc": "Explicit placeholder components; buttons do nothing.",
                "pages": "/admin-settings",
                "apis": "N/A",
                "collections": "N/A",
                "roles": "Admin",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Employee Self Service (ESS) Portal",
        "purpose": "Employee portal for profile, leave/attendance, payroll, documents, learning, benefits, onboarding, policies, and notifications.",
        "status": "Implemented",
        "pages": [
            "/dashboard-employee",
            "/employee/leave-attendance",
            "/employee-payroll",
            "/profile-details*",
            "/employee/my-documents",
            "/employee/policies",
            "/employee/benefits-learning",
            "/onboarding",
            "/notifications",
        ],
        "apis": ["Employee and Both route groups"],
        "collections": ["Multiple ESS collections"],
        "roles": ["Employee (+ Me portal for all users)"],
        "features": [
            {
                "name": "ESS portal navigation",
                "desc": "Full Me-portal nav covering leave, attendance, projects, docs, payroll, profile, etc.",
                "pages": "Employee portal routes",
                "apis": "Employee/Both APIs",
                "collections": "Multiple",
                "roles": "Employee",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Manager Portal",
        "purpose": "Manager workspace for team, leave/attendance approvals, regularization, team learning, one-on-ones, and projects.",
        "status": "Implemented",
        "pages": [
            "/dashboard-manager",
            "/employees (team)",
            "/leave-management",
            "/attendance-regularization",
            "/team-learning",
            "/one-on-one",
            "/projects",
        ],
        "apis": ["Manager-scoped leave/attendance/regularization/team-learning/one-on-one APIs"],
        "collections": ["Multiple"],
        "roles": ["Manager", "Project Manager"],
        "features": [
            {
                "name": "Manager workspace",
                "desc": "Portal locked to manager nav with team oversight features.",
                "pages": "Manager portal routes",
                "apis": "Both + Admin leave/attendance APIs",
                "collections": "Multiple",
                "roles": "Manager",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "HR Portal",
        "purpose": "HR workspace covering recruitment, onboarding, learning, engagement, documents, benefits, succession, workforce, leave, payroll, reports.",
        "status": "Implemented",
        "pages": [
            "/dashboard-hr",
            "Full HR_NAV_ITEMS routes (recruitment through reports)",
        ],
        "apis": ["Admin HR suite APIs"],
        "collections": ["Multiple HR collections"],
        "roles": ["HR Manager", "HR Executive"],
        "features": [
            {
                "name": "HR workspace",
                "desc": "Locked HR portal with full HR suite navigation.",
                "pages": "HR portal routes",
                "apis": "Admin + Both HR APIs",
                "collections": "Multiple",
                "roles": "HR",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Admin Portal",
        "purpose": "Organization owner admin workspace for org SaaS, employees, leave, projects, attendance, payroll, RBAC, workflows, calendar, salary structure, settings.",
        "status": "Implemented",
        "pages": [
            "/dashboard-admin",
            "/organization/dashboard",
            "Admin navigation routes",
        ],
        "apis": ["Admin + Organization APIs"],
        "collections": ["Multiple"],
        "roles": ["Admin (Org Owner)"],
        "features": [
            {
                "name": "Admin workspace + portal switcher",
                "desc": "Org owner can switch Admin / HR / Me portals.",
                "pages": "Admin portal routes",
                "apis": "Admin APIs",
                "collections": "Multiple",
                "roles": "Admin",
                "status": "Implemented",
            },
        ],
    },
    {
        "name": "Finance Portal",
        "purpose": "Finance/payroll-admin workspace for payroll, salary structure, and financial reports.",
        "status": "Partial",
        "pages": [
            "/dashboard-finance",
            "/admin-payroll",
            "/salary-structure",
            "Expense Management link goes to missing /admin/expenses",
        ],
        "apis": ["Payroll, salary-structure, payroll-reports; expense APIs exist without UI"],
        "collections": ["payrolls", "salarystructures", "expenses"],
        "roles": ["Finance / Payroll Admin", "Admin", "Executive (CFO)"],
        "features": [
            {
                "name": "Finance dashboard & payroll access",
                "desc": "Finance portal with payroll and salary structure access.",
                "pages": "/dashboard-finance, payroll routes",
                "apis": "Payroll APIs",
                "collections": "payrolls, salarystructures",
                "roles": "Finance",
                "status": "Implemented",
            },
            {
                "name": "Expense management entry",
                "desc": "Dashboard button navigates to non-existent /admin/expenses route.",
                "pages": "Dead link from Finance dashboard",
                "apis": "Expense APIs unused by dedicated UI",
                "collections": "expenses",
                "roles": "Finance",
                "status": "Partial",
            },
        ],
    },
    {
        "name": "Integrations",
        "purpose": "External system integrations supporting HRMS operations.",
        "status": "Partial",
        "pages": ["Admin email/settings; push registration"],
        "apis": ["Email, Web Push, Geocoding, Redis/Bull, WebSocket, Sentry, Prometheus"],
        "collections": ["emailtemplates", "pushsubscriptions"],
        "roles": ["System / Admin"],
        "features": [
            {
                "name": "Email (SMTP)",
                "desc": "Nodemailer transporter + queue.",
                "pages": "Settings Email",
                "apis": "email helpers/jobs",
                "collections": "emailtemplates",
                "roles": "System",
                "status": "Implemented",
            },
            {
                "name": "Web Push (VAPID)",
                "desc": "Browser push notifications.",
                "pages": "Client SW / push",
                "apis": "/api/push, push-subscription",
                "collections": "pushsubscriptions",
                "roles": "All",
                "status": "Implemented",
            },
            {
                "name": "Google Maps Geocoding",
                "desc": "Geocoding helper for attendance location (requires API key).",
                "pages": "Attendance",
                "apis": "geocodingService",
                "collections": "attendances",
                "roles": "System",
                "status": "Implemented",
            },
            {
                "name": "Payment gateway / bank payout",
                "desc": "Mock bank transfer only; no Stripe/Razorpay checkout found.",
                "pages": "Payroll disburse",
                "apis": "paymentService (mock)",
                "collections": "payrolls",
                "roles": "Finance",
                "status": "Partial",
            },
            {
                "name": "SMS / WhatsApp providers",
                "desc": "Not found.",
                "pages": "None",
                "apis": "None",
                "collections": "N/A",
                "roles": "N/A",
                "status": "Not Implemented",
            },
        ],
    },
]


def count_features(modules):
    impl = partial = missing = 0
    total = 0
    for m in modules:
        for f in m["features"]:
            total += 1
            s = f["status"]
            if s == "Implemented":
                impl += 1
            elif s == "Partial":
                partial += 1
            else:
                missing += 1
    return total, impl, partial, missing


def module_feature_counts(m):
    impl = sum(1 for f in m["features"] if f["status"] == "Implemented")
    partial = sum(1 for f in m["features"] if f["status"] == "Partial")
    missing = sum(1 for f in m["features"] if f["status"] == "Not Implemented")
    # For summary "Implemented Features" count features that are Implemented;
    # Total = all features documented under module
    return impl, len(m["features"]), partial, missing


def build_doc():
    doc = Document()

    # Narrow margins slightly for denser report
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    # Title
    title = doc.add_heading("COMPLETE HRMS FUNCTIONALITY ANALYSIS", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_para(doc, "Enterprise MERN Stack HRMS — Functional Analysis Report", italic=True).alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_para(
        doc,
        f"Generated: {datetime.now().strftime('%d %B %Y')}  |  Scope: Full codebase scan (server + vite_client)",
    ).alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_para(
        doc,
        "Audience: CTO, Product Manager, Business Analyst, Project Documentation",
    ).alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()
    add_heading_styled(doc, "1. Executive Brief", 1)
    add_para(
        doc,
        "This report documents business functionalities actually implemented in the EMS HRMS codebase. "
        "Findings are cross-checked across React frontend routes/pages, Express REST APIs, and MongoDB models. "
        "Code quality, security, and performance are out of scope. Status markers: "
        "✅ Implemented (end-to-end wired), ⚠️ Partially Implemented (backend and/or UI incomplete or orphaned), "
        "❌ Not Implemented (not present as a product feature).",
    )
    add_kv(doc, "Stack", "React.js (Vite) + Node.js/Express.js + MongoDB + REST APIs")
    add_kv(doc, "Authentication", AUTH)
    add_kv(doc, "Backend models scanned", "48 model files / 50+ collections")
    add_kv(doc, "Backend route files scanned", "71 route files")
    add_kv(doc, "Frontend routes scanned", "~112 path definitions")

    add_heading_styled(doc, "2. Module-by-Module Analysis", 1)

    for idx, m in enumerate(MODULES, 1):
        add_heading_styled(doc, f"2.{idx} {m['name']}", 2)
        add_kv(doc, "Purpose", m["purpose"])
        add_kv(doc, "Status", status_icon(m["status"]))

        add_para(doc, "Related Pages / Routes", bold=True)
        for p in m["pages"]:
            doc.add_paragraph(p, style="List Bullet")

        add_para(doc, "Related APIs", bold=True)
        for a in m["apis"]:
            doc.add_paragraph(a, style="List Bullet")

        add_para(doc, "Related Database Collections", bold=True)
        for c in m["collections"]:
            doc.add_paragraph(c, style="List Bullet")

        add_para(doc, "User Roles", bold=True)
        for r in m["roles"]:
            doc.add_paragraph(r, style="List Bullet")

        add_para(doc, "Functionalities", bold=True)
        rows = []
        for f in m["features"]:
            rows.append(
                [
                    f["name"],
                    f["desc"],
                    f["pages"],
                    f["apis"],
                    f["collections"],
                    f["roles"],
                    status_icon(f["status"]).replace("✅ Implemented", "✅").replace("⚠️ Partially Implemented", "⚠️ Partial").replace("❌ Not Implemented", "❌"),
                ]
            )
        add_table(
            doc,
            [
                "Feature Name",
                "Description",
                "Frontend Pages",
                "API Endpoints",
                "MongoDB Collections",
                "User Roles",
                "Status",
            ],
            rows,
        )

    # Module summary
    add_heading_styled(doc, "3. Module Summary", 1)
    summary_rows = []
    for m in MODULES:
        impl, total, partial, missing = module_feature_counts(m)
        # Implemented Features column = Implemented only; note partials in total
        summary_rows.append(
            [
                m["name"],
                str(impl),
                str(total),
                status_icon(m["status"]).replace("✅ Implemented", "✅").replace("⚠️ Partially Implemented", "⚠️").replace("❌ Not Implemented", "❌"),
            ]
        )
    add_table(
        doc,
        ["Module", "Implemented Features", "Total Features", "Module Status"],
        summary_rows,
    )

    # Missing from enterprise HRMS
    add_heading_styled(doc, "4. Functionalities Missing From Standard Enterprise HRMS", 1)
    add_para(
        doc,
        "Compared only against typical enterprise HRMS capability sets. Items below are absent or not present as standalone product modules in this codebase.",
    )
    missing_items = [
        ["Loan Management", "No loan request/EMI/recovery module (only payroll.loanDeduction / tax fields)."],
        ["Advance Salary", "No advance salary request/recovery module."],
        ["Shift Roster / Scheduling", "No roster planner; only shiftTypes on org and shifts on attendance rules."],
        ["Standalone Department CRUD", "Departments only as Organization.orgDepartments via wizard."],
        ["Standalone Designation CRUD", "Designations only as Organization.orgDesignations."],
        ["Standalone Branch Management", "Office locations embedded on Organization only."],
        ["Visitor Management", "Only idCard.cardType enum 'visitor'; no visitor check-in module."],
        ["Enterprise Asset Register", "Assets only nested in onboarding workflows."],
        ["Inventory / Stock", "Not present."],
        ["Corporate Events Management", "No events CRUD; birthday/special notification job only."],
        ["SMS Notifications", "No SMS provider integration."],
        ["WhatsApp Notifications", "No WhatsApp provider integration."],
        ["Payment Gateway Billing", "Subscription catalog without Stripe/Razorpay checkout; payroll bank payout is mock."],
        ["Full OKR Product UI", "Goal APIs exist without dedicated OKR frontend module."],
        ["Full Appraisal UI", "Performance review APIs exist; UI limited to score fields + report page."],
        ["Expense / Reimbursement UI", "Expense APIs exist; no routed expense pages."],
        ["Travel / Trip Management", "Not present."],
        ["Timesheet / Billable Hours", "Attendance clocks exist; no billable timesheet module."],
        ["Grievance Management", "Not present as a dedicated module (helpdesk partial)."],
        ["Disciplinary / Warning Letters", "Not present."],
        ["Training Compliance / LMS certifications beyond current learning module depth", "Basic learning exists; advanced compliance LMS not verified as separate standard module."],
        ["Multi-country Statutory Payroll Packs", "Tax/TDS helpers exist; no full multi-country statutory pack module documented."],
        ["Biometric Device Integration", "Geo clocking exists; no biometric device connector found."],
        ["Chat / Collaboration Suite", "Not present (WebSocket optional infra only)."],
    ]
    add_table(doc, ["Missing / Absent Capability", "Evidence from Codebase"], missing_items)

    # Overall summary
    total_f, impl_f, partial_f, missing_f = count_features(MODULES)
    modules_found = len(MODULES)
    modules_impl = sum(1 for m in MODULES if m["status"] == "Implemented")
    modules_partial = sum(1 for m in MODULES if m["status"] == "Partial")
    modules_missing = sum(1 for m in MODULES if m["status"] == "Not Implemented")
    custom = [
        "Learning & Development",
        "Engagement (Surveys / Feedback / Recognition)",
        "Benefits",
        "Succession Planning",
        "Workforce Planning",
        "Projects & Tasks",
        "Approval Workflows & SLA",
        "Team Learning",
        "One-on-One Meetings",
        "ID Cards",
        "Compensatory Off",
        "WFH Requests",
        "Organization SaaS (subscription, branding, setup wizard)",
        "Executive / Multi-portal dashboards",
    ]
    # Coverage: count Implemented + 0.5*Partial over features that are "in product intent"
    # Use (impl + 0.5*partial) / (impl+partial+missing) * 100 among all documented features
    coverage = round((impl_f + 0.5 * partial_f) / total_f * 100, 1) if total_f else 0
    # Alternative business coverage excluding pure Not Implemented modules' missing-only features:
    # Report both feature-level coverage

    add_heading_styled(doc, "5. Overall Summary", 1)
    overall_rows = [
        ["Total Modules Analyzed", str(modules_found)],
        ["Modules Fully Implemented", str(modules_impl)],
        ["Modules Partially Implemented", str(modules_partial)],
        ["Modules Not Implemented", str(modules_missing)],
        ["Total Functionalities Documented", str(total_f)],
        ["Fully Implemented Features", str(impl_f)],
        ["Partially Implemented Features", str(partial_f)],
        ["Not Implemented Features", str(missing_f)],
        ["Custom Modules (beyond core HRMS)", str(len(custom))],
        ["Overall Functional Coverage (%)", f"{coverage}%"],
    ]
    add_table(doc, ["Metric", "Value"], overall_rows)

    add_para(doc, "Custom Modules Identified", bold=True)
    for c in custom:
        doc.add_paragraph(c, style="List Bullet")

    add_para(
        doc,
        "Coverage method: (Fully Implemented + 0.5 × Partially Implemented) ÷ Total Documented Functionalities × 100. "
        "Not Implemented standard capabilities are included in the denominator where documented as features under analyzed modules.",
        italic=True,
    )

    add_heading_styled(doc, "6. Scan Methodology Notes", 1)
    notes = [
        "Backend entry: server/server.js, server/config/routes.js — all mounted routers inventoried.",
        "Frontend entry: vite_client/src/routes/index.jsx, navigationConfig.jsx, portalConfig.js.",
        "Every file under server/models, server/routes, server/controllers, server/services, server/jobs reviewed via exhaustive inventory.",
        "Portal folders Admin, HR, Manager, Employee, Finance, Administration, Tech, Organization, Both, Auth scanned.",
        "Status Partial used when APIs exist without UI, UI is stubbed/orphaned, routes are unmounted, or disbursement/payment is mock.",
        "Ignored: code quality, security vulnerabilities, performance optimization, and defect severity (per engagement rules).",
    ]
    for n in notes:
        doc.add_paragraph(n, style="List Bullet")

    add_heading_styled(doc, "7. Key Partial-Implementation Gaps (Actionable)", 1)
    gaps = [
        "Mount employee CompOffRoutes (imported but not app.use'd) to complete Comp-Off ESS.",
        "Add routed Expense Management UI at /admin/expenses (APIs already exist).",
        "Add /recruitment/create-job route or remove dead Post New Job navigation.",
        "Wire Helpdesk New Ticket / View handlers.",
        "Expose SLA Manager pages in router + navigation (UI already present).",
        "Build Performance Review / Goals UI on top of existing performance-review, goal, review-cycle APIs.",
        "Replace mock payroll disbursement with real bank/payment provider when required.",
        "Complete Admin Settings Security / Permissions / Reports placeholder tabs.",
    ]
    for g in gaps:
        doc.add_paragraph(g, style="List Number")

    doc.save(OUT_PATH)
    return OUT_PATH, {
        "modules": modules_found,
        "total_f": total_f,
        "impl_f": impl_f,
        "partial_f": partial_f,
        "missing_f": missing_f,
        "coverage": coverage,
        "custom": len(custom),
    }


if __name__ == "__main__":
    path, stats = build_doc()
    print(f"Wrote: {path}")
    print(stats)
