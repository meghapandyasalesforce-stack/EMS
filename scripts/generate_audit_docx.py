"""Generate HRMS Functionality Reality-Check Audit DOCX report."""

from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


OUTPUT = Path(__file__).resolve().parent.parent / "HRMS_Functionality_Audit_Report.docx"

FEATURES = [
    ("Auth", "Unified login", "Fully Working", "Login.jsx -> POST /api/v1/both/auth/login -> unifiedAuthController.unifiedLogin -> User/Employee/Org + JWT cookies", "Real bcrypt + lockout; not stubbed"),
    ("Auth", "Logout", "Fully Working", "Header -> authSlice.logoutUser -> logout routes -> clearAuthCookies", "Clears jwt/refresh/csrf"),
    ("Auth", "Org signup", "Fully Working", "OrganizationRegister.jsx -> POST /v1/organization/auth/register", "Public by design"),
    ("Auth", "Admin signup", "Partially Working", "Register.jsx -> POST /v1/admin/auth/register", "Open when not production; gated in prod"),
    ("Auth", "Employee signup (HR-created)", "Fully Working", "AddEmployee -> POST /v1/employee/auth/register + requireEmployeeCreate", "Not a public self-serve path"),
    ("Auth", "Forgot password", "Partially Working", "ForgotPasswordEmail -> POST /password/forgot-password -> hashed token + Nodemailer", "Needs SMTP env; needs manual verification"),
    ("Auth", "Reset password", "Fully Working", "ResetPassword -> POST /password/reset-password/:token", "Logic complete; O(n) bcrypt over tokens (scale risk)"),
    ("Auth", "Session / refresh / expiry", "Partially Working", "Access ~1h + refresh cookies; axios 401->refresh", "Wired in code; needs manual testing for role-cookie / refresh edge cases"),
    ("Auth", "Frontend route guards", "Fully Working", "ProtectedRoute.jsx + routes/index.jsx allowedRoles / requiredPermissions", "Real checks after auth bootstrap"),
    ("Auth", "API auth middleware", "Partially Working", "isAuthenticated*, requirePermission, factory middleware", "Present broadly; gaps (e.g. legacy payroll list)"),
    ("Employee", "Add employee", "Fully Working", "AddEmployee.jsx -> register endpoint -> Employee.create", "Rigid hardcoded dept/title enums; custom titles can 400"),
    ("Employee", "Edit work info", "Partially Working", "Details -> PUT /admin/employee/:id/work-info", "Partial edit only; full-profile update path incomplete"),
    ("Employee", "Edit personal/self", "Partially Working", "PUT /both/profile-details/update-info", "Self-update with field denylist"),
    ("Employee", "Soft deactivate / terminate", "Fully Working", "PATCH .../update-status, .../terminate", "Soft status paths exist"),
    ("Employee", "Delete employee", "Not Working", "DELETE .../delete-employee/:id -> Employee.findOneAndDelete", "Hard delete; only Payroll cleaned; leave/attendance/docs orphaned"),
    ("Employee", "Profile view", "Fully Working", "/employees/:id -> GET .../get-info/:id", "Manager scoping exists"),
    ("Employee", "Search / filter", "Partially Working", "List ?search= server regex; status pills often client-side", "Not full server-side filter suite"),
    ("Employee", "Bulk import", "Not Working", "No CSV/XLSX import UI or API found", "Missing entirely"),
    ("Employee", "Bulk export", "Not Working", "No employee export API; exportUtils.exportToExcel is CSV", "Not real Excel/bulk export"),
    ("Employee", "Admin Documents tab", "Partially Working", "Profile DocumentsTab largely view-only", "Upload via My Documents / Documents&ID; admin tab weak"),
    ("Attendance", "Check-in", "Fully Working", "CheckInOut -> POST /both/attendance/clock-in -> Attendance.create (server time)", "Window violations = warnings, still creates Present"),
    ("Attendance", "Check-out / breaks", "Fully Working", "clock-out + break routes -> attendance updates", "Clock-out less validated than clock-in"),
    ("Attendance", "Geo fencing", "Partially Working", "Real navigator.geolocation + Haversine vs rules", "Client-spoofable; enableSimplePunches can skip radius"),
    ("Attendance", "Camera / selfie", "Partially Working", "Canvas -> base64 in JSON on attendance doc", "Not biometric; no multer; storage/DoS risk"),
    ("Attendance", "Biometric", "Not Working", "No fingerprint/face-match code", "Not implemented"),
    ("Attendance", "Regularization", "Fully Working", "Employee/Manager UIs -> /both/attendance-regularization -> mutates Attendance on approve", "Caps/current-month rules enforced"),
    ("Attendance", "Reports / PDF", "Partially Working", "Summary APIs + some PDF routes; real attendance data", "HR Attendance Report page largely fake"),
    ("Attendance", "Holiday/weekend punch block", "Partially Working", "Calendar used in absent/rate math", "Punch not blocked on weekends/holidays"),
    ("Leave", "Apply leave", "Fully Working", "LeaveApplication -> POST /employee/leave/create-leave -> Leave.save + notify", "Full chain"),
    ("Leave", "Approve / reject", "Fully Working", "LeaveManagement -> PUT /admin/leave/update-leave-status/:id -> email + balance recalc", "Manager/HR scoping"),
    ("Leave", "Cancel leave", "Fully Working", "PUT /employee/leave/cancel/:id", "Restores via balance engine"),
    ("Leave", "Balance calculation & persist", "Fully Working", "leaveBalanceEngine.calculateBalance -> LeaveBalance save; leaveBalanceResponseHelper", "Real engine, not mock arrays"),
    ("Leave", "Soft-fail balance on apply", "Partially Working", "leaveEmployeeController.createLeave catch logs & continues", "Can create leave if engine throws"),
    ("Leave", "Policy / types CRUD", "Fully Working", "/admin/leave-policy + leavePolicyController", "Gated HR/Admin/Exec"),
    ("Leave", "Admin balance adjust (LeaveTab)", "Fully Working", "LeaveTab -> PATCH balance + carry-forward", "Persists + access checks"),
    ("Leave", "Email on status change", "Partially Working", "leaveEmailHelper / emailSender + in-app notify", "Needs SMTP; in-app path coded"),
    ("Leave", "Leave calendar UI", "Partially Working", "Org calendar for working days exists", "Dedicated leave-request calendar UX thin"),
    ("Payroll", "Salary structure CRUD", "Partially Working", "SalaryStructureManager -> /admin/salary-structure", "API uses stricter isAdminAuthenticated; finance UI may 403"),
    ("Payroll", "Generate / process payroll", "Fully Working", "generate-bulk -> Payroll docs; tax helpers", "Real calc path"),
    ("Payroll", "Tax / PF / ESI / deductions", "Fully Working", "payrollGenerationHelper + incomeTaxCalculation.js", "Logic real; compliance needs live verification"),
    ("Payroll", "Employee payslip history", "Fully Working", "EmployeePayroll -> /employee/payroll/*", "404 if no published slip (no auto-create)"),
    ("Payroll", "Payslip PDF download", "Fully Working", "download -> generatePayrollPDF (real buffer)", "Gated until paid/finalized rules"),
    ("Payroll", "Bank disbursement / Paid", "Not Working", "paymentService.transferToBank always mock-bank + MOCK- refs", "Marks Paid with fake money movement"),
    ("Payroll", "Legacy list all payrolls", "Not Working", "GET /admin/payroll/get-all-payroll -> isAuthenticated only", "Non-manager employees can see all visible org payrolls"),
    ("Recruitment", "List jobs / candidates", "Partially Working", "RecruitmentPage -> admin/both recruitment APIs", "Errors often swallowed"),
    ("Recruitment", "Create job posting (UI)", "Not Working", "Button -> /recruitment/create-job — no React route", "API POST exists; UI dead-ends"),
    ("Recruitment", "Interviews / offer letters", "Partially Working", "Controller routes for schedule/offer", "No dedicated UI; needs manual API testing"),
    ("Performance", "Review / goals / cycles APIs", "Partially Working", "/both/performance-review, goal, review-cycle mounted", "Backend present"),
    ("Performance", "Goals / appraisal UI", "Not Working", "No routes in routes/index.jsx for goals/reviews", "APIs orphaned"),
    ("Performance", "Employee Performance tab", "Partially Working", "PerformanceTab.jsx editable score + stats", "Manual score != full appraisal cycle"),
    ("Dashboards", "Admin / HR / Employee KPIs", "Partially Working", "Respective dashboards -> real admin/employee APIs", "Failures often -> empty arrays (looks like zero)"),
    ("Dashboards", "Executive / Administration", "Partially Working", "DashboardAdministration.jsx -> /admin/executive/* aggregates", "Real aggregates; predictive = naive linear fit"),
    ("Reports", "Headcount", "Partially Working", "Analytics + employees", "FTE/Contract bars = count * 0.85 / 0.15 invented"),
    ("Reports", "Attrition", "Not Working", "AttritionReport.jsx", "Fake fallbacks [4,3,5,...]; Retirement/Termination fabricated"),
    ("Reports", "Attendance (HR report page)", "Not Working", "AttendanceReport.jsx", "Hardcoded weeks; present: 22/22; fake absenteeism %"),
    ("Reports", "Performance report", "Not Working", "PerformanceReport.jsx", "Default 4.2, fake matrix/distribution"),
    ("Reports", "Recruitment report", "Not Working", "RecruitmentReport.jsx", "Static funnel / fake REQ rows"),
    ("Reports", "Compliance report", "Not Working", "ComplianceReport.jsx COMPLIANCE_GAUGES constants", "No API"),
    ("Reports", "Payroll report", "Partially Working", "payroll-reports statistics API", "Some trends still hardcoded"),
    ("Reports", "Excel export", "Not Working", "exportUtils.exportToExcel -> CSV", "Not XLSX"),
    ("Notifications", "In-app", "Fully Working", "Notification model + UI + socket", "Real UI->API->DB"),
    ("Notifications", "Socket.IO realtime", "Fully Working", "websocket.js + socket.io-client", "Needs URL alignment; env verify"),
    ("Notifications", "Push (web)", "Partially Working", "push subscription routes + service", "Needs VAPID + permission"),
    ("Notifications", "Transactional email", "Partially Working", "emailSender.js (leave/welcome/auth)", "Not wired for all notification types; SMTP required"),
    ("Notifications", "SMS", "Not Working", "No Twilio/msg91/sender in server", "Settings/schema mentions only"),
    ("Roles", "Platform roles + API ACL", "Fully Working", "/admin/platform-roles + requireAnyPermission", "Real enforcement path"),
    ("Roles", "Admin Settings -> Permissions", "Not Working", "PermissionsSettings static card; Manage Roles no onClick", "Cosmetic"),
    ("Roles", "Legacy RoleHierarchy toggles", "Partially Working", "Saves Role docs via /admin/roles", "middlewares/rbac.js not imported by any route — cosmetic for API ACL"),
    ("Documents", "Employee upload / download / soft-delete", "Fully Working", "multer -> server/uploads/documents + Document (+ binary)", "Auth download; soft delete"),
    ("Documents", "HR approve/reject", "Fully Working", "/admin/documents", "Permission-gated"),
    ("Documents", "Storage paths", "Partially Working", "Canonical + legacy path resolvers", "Dual-path ops confusion"),
    ("Forms", "Add employee validation", "Partially Working", "express-validator create path", "Rigid enums hurt real orgs"),
    ("Forms", "Attendance clock-in validation", "Partially Working", "Weak schema (lat/lng/image optional/unchecked)", "Spoof / oversized base64 risk"),
    ("Org / Admin", "Calendar, ID cards, attendance rules, policies, approvals", "Partially Working", "Routes + UIs mounted under Admin", "Depth uneven; calendar OCR placeholder noted in code"),
    ("Other", "Projects / tasks", "Fully Working", "Admin project + both task routes + UIs", "Core product feature"),
    ("Other", "Announcements", "Fully Working", "Sent announcements + dashboard fetch", "Real"),
    ("Other", "Comp-off (employee)", "Not Working", "CompOffRoutes.js imported in routes.js but never app.use'd", "Only /admin/comp-off mounted"),
    ("Other", "Expenses", "Not Working", "Expense API exists", "No frontend route"),
    ("Other", "Assets / Shifts", "Not Working", "Not found", "Absent"),
    ("Other", "Onboarding / L&D / Engagement / Benefits / Helpdesk / Succession / Workforce", "Partially Working", "HR pages + matching APIs", "Uneven depth; some placeholders (e.g. 360 feedback)"),
]

CRITICAL_BUGS = [
    "Mock bank marks payroll Paid — server/helpers/paymentService.js always succeeds with provider: mock-bank. Operators can treat salaries as disbursed when no money moved.",
    "Payroll data leak — GET /api/v1/admin/payroll/get-all-payroll uses only isAuthenticated. Non-manager employees get all isVisible: true payrolls with amounts and employee salary fields.",
    "Hard employee delete — deleteEmployee uses findOneAndDelete; only payroll is cleaned. Attendance, leave, documents, and related records orphan/lose referential integrity; audit trail destroyed.",
    "Leave apply soft-fails balance check — if leaveBalanceEngine.calculateBalance throws, leave is still created (leaveEmployeeController.js ~192-199).",
    "HR Reports look real but fabricate numbers — Compliance/Attendance/Performance/Recruitment/Attrition pages use hardcoded charts/KPIs — high risk of bad HR decisions.",
    "Dual RBAC illusion — Platform permissions enforce APIs; Admin Settings Permissions + unused rbac.js pretend to. False sense of security.",
    "Plaintext password in sessionStorage — orgAdminCredentials.js stores org-admin password for Add Employee autofill (XSS/session exposure).",
]

DUMMY_MOCK = [
    ("server/helpers/paymentService.js", "Always-success mock bank + MOCK-* refs"),
    ("vite_client/.../ComplianceReport.jsx", "Entire report = static constants"),
    ("AttendanceReport.jsx", "Hardcoded weeks, fake present/leave/late cells, fake KPIs"),
    ("PerformanceReport.jsx", "Default rating 4.2, fake distributions"),
    ("AttritionReport.jsx", "Chart fallbacks + fabricated series"),
    ("RecruitmentReport.jsx", "Static funnel / fake job rows"),
    ("HeadcountReport.jsx", "Invented 85%/15% FTE/contract split"),
    ("AdminSettings.jsx", "Permissions / Reports settings placeholders"),
    ("exportUtils.exportToExcel", "CSV, not Excel"),
    ("Engagement 360 / calendar OCR", "Self-described placeholders in backends"),
    ("Payslip org fallback name", "Default brand string if org missing"),
]

BROKEN_API = [
    ("Navigate to /recruitment/create-job", "No React route registered"),
    ("Employee compOffRouter", "Imported in config/routes.js, never mounted -> employee endpoints 404"),
    ("Goals / performance-review / review-cycle", "APIs live; no primary SPA routes"),
    ("Expense API", "Backend only; no /expense page"),
    ("Admin Settings Manage Roles", "Button does nothing"),
    ("SMS", "No sender implementation"),
    ("Notification manager -> email for all events", "Partial; most events in-app only"),
    ("middlewares/rbac.js", "Dead code relative to route mounts"),
    ("Salary structure for finance-only users", "UI may allow; API often isAdminAuthenticated only"),
]

MISSING_ERROR_HANDLING = [
    "Dashboard hooks: errors collapse to []/{} -> silent zeros.",
    "RecruitmentPage fetch: quiet empty UI on failure.",
    "HR report pages: empty analytics -> show fake charts instead of no data.",
    "Leave create: balance-engine errors logged, flow continues.",
    "Workflow init failure on leave create: leave can exist without workflow (logged).",
    "Attendance window violations: soft warnings, not hard blocks.",
    "Payroll controllers: some raw error.message returned to clients.",
    "Many placeholder Settings buttons: no loading, toast, or navigation.",
]

SECURITY = [
    ("High", "Under-authed get-all-payroll payroll exposure"),
    ("High", "Mock disbursement treated as Paid in product status machine"),
    ("High", "Hard delete without cascade / soft-delete"),
    ("Medium", "Password in sessionStorage"),
    ("Medium", "Open admin registration outside production"),
    ("Medium", "Client-spoofable geo + optional selfie as evidence"),
    ("Medium", "Legacy RoleHierarchy / Settings Permissions look like ACL but don't bind APIs"),
    ("Low-Med", "Reset-password O(n) bcrypt scan"),
    ("Note", "httpOnly JWT + CSRF design is relatively sound vs localStorage-only tokens"),
]

COMPLETION = [
    ("Authentication & Authorization", "75%", "Solid login/guards; refresh/email/password storage edges"),
    ("Employee Management", "65%", "CRUD mostly real; delete dangerous; no bulk I/O"),
    ("Attendance", "70%", "Punch/regularization real; no biometric; holiday not enforced on punch"),
    ("Leave Management", "80%", "Strongest domain module; soft-fail balance + SMTP caveats"),
    ("Payroll", "55%", "Calc/PDF real; bank payout fake; auth hole on list"),
    ("Recruitment", "40%", "APIs partial; create-job UI broken"),
    ("Performance / Appraisal", "20%", "Backend skeleton; almost no product UI"),
    ("Reports & Dashboard", "45%", "Dashboards mostly real APIs; HR Reports largely fake"),
    ("Notifications", "55%", "In-app/socket/push real-ish; SMS none; email partial"),
    ("Roles & Permissions / Admin Settings", "50%", "Platform roles real; Settings permissions UI theatre"),
    ("File Uploads & Documents", "70%", "Wired multer+DB; admin profile UX gaps"),
    ("Forms & Validations", "60%", "Present on core paths; attendance/geo weak"),
    ("Adjacent (Onboarding/L&D/etc.)", "45%", "Pages+APIs exist; uneven; some stubs"),
    ("Comp-off / Expenses / Assets", "15-30%", "Broken mount / API-only / absent"),
]

STATUS_SYMBOL = {
    "Fully Working": "\u2705",
    "Partially Working": "\u26a0\ufe0f",
    "Not Working": "\u274c",
}


def set_cell_shading(cell, fill_hex: str):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill_hex)
    cell._tc.get_or_add_tcPr().append(shading)


def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    return h


def add_bullet_list(doc, items):
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header
        for p in hdr_cells[i].paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(9)
    for row_data in rows:
        row_cells = table.add_row().cells
        for i, val in enumerate(row_data):
            row_cells[i].text = str(val)
            for p in row_cells[i].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(8)
    if col_widths:
        for row in table.rows:
            for i, width in enumerate(col_widths):
                row.cells[i].width = width
    return table


def build_document():
    doc = Document()

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("HRMS Functionality Reality-Check Audit Report")
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = RGBColor(0x1A, 0x36, 0x5D)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub.add_run(f"Generated: {datetime.now().strftime('%B %d, %Y')}\nCodebase: EMS (server + vite_client)")
    sub_run.font.size = Pt(11)
    sub_run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()

    # Executive summary
    add_heading(doc, "Executive Summary", 1)
    doc.add_paragraph(
        "Method: Code-path tracing only (UI -> route -> controller -> model/DB write). "
        "No live HTTP/DB/SMTP runs were performed. Where runtime proof is required, "
        "features are marked as needing manual testing."
    )
    doc.add_paragraph(
        "Verdict: Core operations (auth, employees, leave, attendance punches, payroll generation) "
        "are real end-to-end systems. A large outer layer (HR Reports, Settings->Permissions, "
        "recruitment create UX, appraisal UI, SMS, bank payout) is incomplete, cosmetic, or fabricated."
    )
    doc.add_paragraph(
        "Whole-product rough estimate: 55-60% production-ready for an HRMS that claims full suite coverage. "
        "Treat Leave / Attendance punch / Employee core / Auth as the trustworthy spine; treat Reports, "
        "mock payroll payout, Settings permissions, Recruitment create, Appraisal, and SMS as not decision-safe."
    )

    # Feature audit table
    add_heading(doc, "Feature Audit Table", 1)
    feature_rows = []
    for mod, feat, status, evidence, issue in FEATURES:
        sym = STATUS_SYMBOL.get(status, "")
        feature_rows.append((mod, feat, f"{sym} {status}", evidence, issue or "—"))
    add_table(
        doc,
        ["Module", "Feature", "Status", "Evidence (file/route/function)", "Issue / What's Missing"],
        feature_rows,
    )

    doc.add_page_break()

    # Critical bugs
    add_heading(doc, "Critical Bugs", 1)
    add_bullet_list(doc, CRITICAL_BUGS)

    # Dummy/mock data
    add_heading(doc, "Dummy / Mock Data Still in Use", 1)
    add_table(doc, ["Location", "What"], DUMMY_MOCK)

    # Broken API connections
    add_heading(doc, "Broken API / Wiring Connections", 1)
    add_table(doc, ["Connection / Feature", "Problem"], BROKEN_API)

    # Missing error handling
    add_heading(doc, "Missing Error Handling", 1)
    add_bullet_list(doc, MISSING_ERROR_HANDLING)

    # Security issues
    add_heading(doc, "Security Issues", 1)
    add_table(doc, ["Severity", "Finding"], SECURITY)

    # Completion percentages
    add_heading(doc, "Overall Completion % per Module", 1)
    add_table(doc, ["Module", "Est. %", "Notes"], COMPLETION)

    # What was not proven
    add_heading(doc, "What This Audit Did Not Prove", 1)
    doc.add_paragraph(
        "Live Mongo persistence under concurrent users, SMTP delivery, Capacitor mobile punch flows, "
        "geofence in real offices, tax filing compliance, and multi-tenant isolation under adversarial "
        "org IDs all need manual/staging tests before a go-live sign-off."
    )

    # Status legend
    add_heading(doc, "Status Legend", 1)
    doc.add_paragraph("\u2705 Fully Working — full chain (UI -> API -> DB) verified, handles errors/edge cases.")
    doc.add_paragraph("\u26a0\ufe0f Partially Working — happy path only, UI without backend, or missing validation/error handling.")
    doc.add_paragraph("\u274c Not Working — broken, dummy/hardcoded data, missing handler, or UI-only with no backend.")

    doc.save(OUTPUT)
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build_document()
