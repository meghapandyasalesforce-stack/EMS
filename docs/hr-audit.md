# HR Role Audit — EMS HRMS

**Phase:** 1 (analysis only — no code changes)  
**Date:** 2026-10-16  
**Method:** Code inspection of `vite_client/` and `server/` (not live UAT)  
**Scope:** HR Manager (`hr_manager` / platform `hr_admin`) and HR Executive (`hr_executive`)  
**Out of scope:** Phase 2 redesign (pending approval)

> **Note:** `docs/admin-audit.md` does **not** exist in this repo. Closest prior audit: `docs/HRMS_LAUNCH_AUDIT.md`. Phase 2 should reuse Admin/shared UI patterns from code (`cm-hrms` / Admin shells), not a missing audit doc.

---

## Executive summary

HR in this product is a **layered identity model**, not a single role string:

| Layer | Values | Effect |
|-------|--------|--------|
| SaaS system role | `hr_manager`, `hr_executive` | Applied on hire / Users & Roles |
| User platform roles | `hr_admin` (manager), `hr_executive` | Stored on `User.roles` |
| Employee functional role | `hr` (both) | Dashboard `/dashboard-hr`, legacy UI `isHR()` |
| Permission buckets | `hr_manager`, `hr_executive` | API authorization via `permissionService` |

**Strengths:** Broad HR surface (ATS, lifecycle, leave, attendance, engagement, documents, workforce, succession, learning, benefits). Backend permission middleware (`requirePermission.js`) is the real gate for most Admin APIs. Portal home is consistent (`/dashboard-hr`).

**Critical findings:**

1. **HR Manager ≈ org admin for permissions** — `HR_MANAGER_PERMS` is nearly all permissions except executive dashboard (`server/config/permissions.constants.js`), including `org.settings.manage`, `payroll.publish`, and `employee.delete`. Manager can open Admin settings / platform roles by URL even though those items are absent from the HR sidebar.
2. **HR Executive is under-powered vs nav** — Nav shows documents, lifecycle, reports, learning, etc., but Executive lacks keys like `onboarding.manage`, `leave.policy.manage`, `payroll.view.all`. Expect 403s / empty experiences.
3. **Open routes** — Several manage screens use `allowedRoles: []` (`/engagement`, `/learning`, `/benefits`, `/onboarding`, `/helpdesk`), so any authenticated user can hit the URL; protection relies on page heuristics + API 403.
4. **Duplicate document surfaces** — `/documents`, `/admin/document-management`, `/hr/document-requests`, and Admin templates overlap in HR nav.
5. **Reports inject fake KPI/chart data** when empty (Performance, Compliance, Attendance, Attrition, Payroll, Headcount) — demo/risk issue also flagged in `docs/HRMS_LAUNCH_AUDIT.md`.
6. **Missing expected HRMS modules** — No grievances module; no dedicated performance-review UI (APIs exist); helpdesk and announcements are weakly discoverable; lifecycle Configure/Enterprise UI is hidden in the shell.
7. **Broken UI** — Onboarding/Offboarding pagination Prev/Next always `disabled`; `HR_NAV_ITEMS` has a trailing empty array slot (bare `,`); Employees page imports unused edit/delete icons.

**Phase 2 readiness:** Do not redesign until product decides (a) whether HR Manager should remain near–org-owner, (b) Executive vs Manager feature matrix, and (c) whether Admin-shared screens stay shared or get HR-skinned shells. Approve this audit to proceed to Phase 2 proposal (nav + dashboard + screen list only).

---

## 1. Permissions — definition and enforcement

### 1.1 How HR is defined

| Concept | File | Detail |
|---------|------|--------|
| Permission keys + role maps | `server/config/permissions.constants.js` | `ROLE_BUCKETS.HR_MANAGER` / `HR_EXECUTIVE`; `ROLE_PERMISSION_MAP`; `LEGACY_ACCESS.HR_OR_EXECUTIVE`, `HR_ONLY` |
| Platform role strings | `server/config/identity.constants.js` | `PLATFORM_ROLES.HR_ADMIN` = `hr_admin`, `HR_EXECUTIVE` = `hr_executive` |
| SaaS system roles | `server/config/systemRole.constants.js` | `hr_manager` → platform `hr_admin` + functional `hr`; `hr_executive` → platform `hr_executive` + functional `hr` |
| Client mirror | `vite_client/src/utils/systemRoles.js`, `vite_client/src/utils/permissions.js` | Same permission keys + `ROUTE_PERMISSIONS` |
| Bucket resolution | `server/helpers/permissionService.js` | `resolveRoleBuckets`, `resolveAuthContext`; `hr_admin`/`hr_manager` → manager bucket; bare functional `hr` → executive bucket |
| Functional flag | `server/helpers/functionalRolesHelper.js` | `isHR` from `functionalRoles.includes('hr')` |
| System role sync | `server/helpers/systemRoleService.js` | `applySystemRoleToEmployee`, `syncLinkedUserForSystemRole` |

**HR Manager permissions (summary):** All keys except `executive.dashboard` — employees (incl. delete/sensitive), leave policy, attendance rules, payroll process/publish, lifecycle, engagement, org settings.

**HR Executive permissions (summary):** `employee.view/create/edit/delete`, leave view + approve all/team, attendance view, engagement suite, ID cards, self punch/leave/payroll. **No** leave policy, attendance rules, payroll admin, org settings, or most lifecycle configure keys.

### 1.2 Backend enforcement (file paths)

| Middleware / helper | Path | Used for |
|---------------------|------|----------|
| Core RBAC | `server/middlewares/requirePermission.js` | `attachAuthContext`, `requireAnyPermission`, `requireHrOrExecutive`, `requireHrStaff`, `requireManagerHrOrExecutive`, `requireOrgOwnerOrHrManager`, document/ID/lifecycle helpers |
| Legacy alias | `server/middlewares/isAdminOrHROrExecutiveAuthenticated.js` | → `requireHrOrExecutive` |
| Legacy alias | `server/middlewares/isAdminOrManagerOrHRAuthenticated.js` | → `requireManagerHrOrExecutive` |
| Legacy alias | `server/middlewares/isAdminOrHRAuthenticated.js` | → `requireHrStaff` (**defined; not wired to route files**) |
| Misleading name | `server/middlewares/isAdminAuthenticated.js` | → `requireOrgOwnerOrHrManager` (HR **Managers** pass) |
| Older RBAC | `server/middlewares/rbac.js` | Module/action checks — **not imported by route files** |
| Auth context API | `server/controllers/auth/permissionsController.js` | Hydrates UI permissions/flags |
| Dashboard routing | `server/helpers/dashboardRouteHelper.js`, `dashboardAccessHelper.js` | Functional `hr` → `/dashboard-hr` |
| Lifecycle gates | `server/helpers/employeeLifecycleHelper.js` | `canManageEmployeeLifecycle` includes HR buckets |
| Notification recipients | `server/helpers/lifecycleNotificationRecipients.js` | Prefer platform HR roles |

**Representative route files allowing HR (via `isAdminOrHROrExecutiveAuthenticated` or permission helpers):**  
`server/routes/Admin/RecruitmentRoutes.js`, `OnboardingRoutes.js`, `LifecycleRoutes.js`, `WorkforceRoutes.js`, `SuccessionRoutes.js`, `LeavePolicyRoutes.js`, `LeaveReportsRoutes.js`, `AttendanceRuleRoutes.js`, `LearningRoutes.js`, `BenefitsRoutes.js`, `AnalyticsRoutes.js`, `DocumentRoutes.js` (`requireHrDocumentAccess`), `IdCardRoutes.js`, `EngagementRoutes.js`, `EmployeeRoutes.js` (selected), `OrgStructureRoutes.js`, `CalendarRoutes.js`, `ApprovalWorkflowRoutes.js` (read), `CompOffAdminRoutes.js`, `TaxRegimeChangeRoutes.js` (Both), plus Manager/HR shared routes in `LeaveAdminRoutes.js`, `AttendanceRoutes.js`, `AttendanceRegularizationRoutes.js`, `WfhRequestRoutes.js`, `PayrollRoutes.js` (permission-keyed — Manager-level).

### 1.3 Frontend enforcement (file paths)

| Piece | Path | Behavior |
|-------|------|----------|
| Route table | `vite_client/src/routes/index.jsx` | `allowedRoles` + optional `requiredPermissions` |
| Guard | `vite_client/src/components/ProtectedRoute.jsx` | Prefers permissions; falls back to role strings; builds `'hr'` via `isHR()` |
| Permission helpers | `vite_client/src/utils/permissions.js` | `canAccess`, `ROUTE_PERMISSIONS`, `filterNavByPermissions` |
| Hook | `vite_client/src/Hooks/useAuthPermissions.js` | Redux permissions + `isHrManager` / `isHrExecutive` |
| Heuristic HR | `vite_client/src/utils/managerHelper.js` | `isHR`, `canAccessHrDocuments`, lifecycle helpers |
| Portal | `vite_client/src/utils/portalConfig.js` | Both HR buckets → portal id `hr_manager`, home `/dashboard-hr` |
| Sidebar | `vite_client/src/utils/navigationConfig.jsx` | `HR_NAV_ITEMS`, `getHrPortalNavigation` |
| Shell | `vite_client/src/Shared/Header.jsx` | Portal-aware nav |
| Role wrappers | `OnboardingRouteWrapper.jsx`, `LearningRouteWrapper.jsx`, `BenefitsRouteWrapper.jsx` | Swap HR vs ESS UI |

**Login → dashboard:** Server returns `dashboardRoute` `/dashboard-hr` for functional `hr`; client `Login.jsx` + `portalConfig` / `systemRoleHome.js` align.

---

## 2. Screen inventory

Canonical sidebar for HR portal (`getHrPortalNavigation`): Dashboard, Employees, Organization, Recruitment, Employee lifecycle, Learning, Engagement, One-on-One, Documents, Document management, Benefits, Succession, Workforce, Leave management, Leave & attendance (ESS), Calendar (perm-gated), Attendance, Regularization/WFH, Pending approvals, Payroll (Manager only), My payroll, ID cards, HR reports. **Projects** are in `HR_NAV_ITEMS` but filtered out for both HR Manager and Executive.

### 2.1 Duplicate / alias routes

| Preferred | Alias | Component |
|-----------|-------|-----------|
| `/dashboard-hr` | `/dashboard/hr` | `HR/Dashboard/DashboardHR.jsx` |
| `/add-employee` | `/add` | `Admin/Employee/AddEmployee.jsx` |
| `/attendance-regularization` | `/manager/attendance-regularization` | `Manager/.../RegularizationRequests.jsx` |
| `/my-leave` | `/employee/leave-attendance`, `/attendance-stats` | LeaveAttendanceHub |

### 2.2 Screens (route → component → purpose → layout)

#### Dashboards & people

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/dashboard-hr` | `HR/Dashboard/DashboardHR.jsx` | HR home KPIs, hiring, attendance, approvals, celebrations, announcements | KPI cards, Recharts, lists, announcement modal |
| `/employees` | `Admin/Employee/EmployeesPage.jsx` | Org directory | Search, filter pills, table, FAB |
| `/employees/:employeeId` | `Admin/Employee/EmployeeDetailsPage.jsx` | Employee 360 | Tabs, modals |
| `/add-employee` | `Admin/Employee/AddEmployee.jsx` | Create employee | Multi-step form |
| `/organization/chart` | `Admin/Organization/OrganizationChartPage.jsx` | Org hierarchy | Chart |
| `/role-hierarchy` | `Admin/RoleManagement/RoleHierarchy.jsx` | Role tree (URL; not in HR nav) | Tree, modals |
| `/admin/platform-roles` | `Admin/RoleManagement/UsersRolesPage.jsx` | Users & roles (URL) | Table, confirm |

#### Recruitment (ATS)

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/recruitment` | `HR/Recruitment/RecruitmentPage.jsx` | Jobs / candidates / offer templates | Tabs, cards, table, settings modal |
| `/recruitment/create-job`, `.../jobs/:id/edit` | `CreateJobPage.jsx` | Job form | Multi-section form |
| `/recruitment/jobs/:id` | `JobDetailPage.jsx` | Job + applicants | Tabs, tables |
| `/recruitment/pipeline` | `PipelinePage.jsx` | Stage board | Kanban, bulk actions |
| `/recruitment/workspace` | `WorkspacePage.jsx` | Recruiter today | KPI widgets |
| `/recruitment/requisitions` | `RequisitionsPage.jsx` | Headcount requests | List + form |
| `/recruitment/calendar` | `RecruitmentCalendarPage.jsx` | Interviews | Month grid |
| `/recruitment/inbox` | `ResumeInboxPage.jsx` | Resume IMAP | Table, config panel |
| `/recruitment/candidates/:id` | `CandidateDetailPage.jsx` | Candidate ATS | Tabs, hire/offer modals |
| `/manager/hiring-requests` | `Manager/Recruitment/ManagerHiringRequestsPage.jsx` | Manager requests | Forms/lists |

#### Lifecycle, learning, engagement

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/onboarding` | `OnboardingRouteWrapper` → `HR/Onboarding/EmployeeLifecycle.jsx` | Join/leave shell | Segmented: Onboarding \| Offboarding \| Reports |
| (embedded) | `OnboardingHub.jsx`, `OnboardingHrDetailView.jsx` | Onboarding workflows | Table, create modal; detail tabs (Overview, Tasks, Docs, BGV, Goals, Training, Activity) |
| (embedded) | `HR/Offboarding/OffboardingHub.jsx` + panels | Exit / F&F / clearance | Tables, workflow actions, modals |
| (embedded) | `LifecycleReportsHub.jsx` | Lifecycle analytics/export | Tabs, export |
| `/learning` | `LearningRouteWrapper` → `HR/Learning/LearningPage.jsx` | Course catalog | Tabs, cards, assignment modal |
| `/learning/create-course`, `edit-course/:id` | `CreateCourse.jsx` / `EditCourse.jsx` | Course CRUD | Form shell |
| `/engagement` | `HR/Engagement/EngagementPage.jsx` | Surveys, feedback, recognition, plans | Section hub, KPIs, charts |
| `/engagement/create-survey`, `.../edit`, pulse routes | Create/Edit Survey & Pulse | Builders | Form shells |
| `/engagement/surveys/:id` | `SurveyDetailPage.jsx` | Results | Stats, table |

#### Documents, benefits, planning, helpdesk

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/documents` | `HR/Documents/DocumentsPage.jsx` | Org document library | Category sidebar, table, modals |
| `/documents/:id/versions` | `DocumentVersions.jsx` | Versions | Timeline |
| `/hr/document-requests` | `HREmployeeDocumentRequests.jsx` | Letter request queue | Table (not in sidebar) |
| `/admin/document-management` | `Admin/Documents/DocumentManagement.jsx` | Requests + templates shell | Tabs |
| `/admin/document-templates` | `DocumentTemplateManager.jsx` | Templates | List/editor |
| `/id-card-generator` | `Admin/IdCards/IdCardGenerator.jsx` | Badges | Preview, generate |
| `/benefits`, `/benefits/:id` | `BenefitsRouteWrapper` → `BenefitsPage` / `BenefitDetailPage` | Plans & enrollments | Tabs, drawer, forms |
| `/succession`, `/:id` | `SuccessionPage` / `SuccessionDetailPage` | Succession plans / talent | Tabs, cards, modals |
| `/workforce`, `/:id` | `WorkforcePage` / `WorkforceDetailPage` | Headcount planning | Tabs, KPIs, workflow buttons |
| `/helpdesk` | `HelpdeskPage.jsx` | Tickets | KPI, filters, table, modals (**not in nav**) |

#### Leave, attendance, payroll, reports

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/leave-management` | `Admin/LeaveManagement.jsx` | Approve leave (+ embedded regularization) | Status tabs, table, detail panel |
| `/admin/leave-policy` | `HR/Leave/LeavePolicyManagement.jsx` | Policy CRUD | Form + table |
| `/admin/leave-balance` | `EmployeeLeaveBalanceViewer.jsx` | Balances | Search, cards |
| `/admin/leave-reports` | `LeaveReportsPage.jsx` | Leave analytics | Tabs |
| `/calendar-management` | `Admin/Calendar/CalendarManagement.jsx` | Holidays | Year calendar, modals |
| `/today-attendance` | `TodayStatusComponent.jsx` | Today status | Cards/lists |
| `/all-attendance-history` | `AllAttendanceStatsComponent.jsx` | Org attendance | Filters, chart, table, export |
| `/attendance-rules` | `AttendanceRules.jsx` | Geo/office rules | Large form, map |
| `/attendance-regularization` | `RegularizationRequests.jsx` | Approve regularization/WFH | Table, drawer, bulk |
| `/admin-payroll`, add/update routes | `Admin/Payroll/*` | Payroll runs | Filters, tables, confirm |
| `/salary-structure` | `SalaryStructureManager.jsx` | Structures (URL) | Cards, modals |
| `/admin/reports/*` | `HR/Reports/HRReportsLayout.jsx` + pages | Headcount, attrition, payroll, attendance, performance, recruitment, compliance | Sidebar + KPI/chart/table |
| `/hr/analytics` | `HRAnalyticsPage.jsx` | Cross-module analytics | Date filters, Chart.js (**not in nav**) |

#### Policies, approvals, misc HR-reachable

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/admin/policies*` | PolicyManager / Create / Edit / View | Company policies | Table/forms |
| `/admin/approval-workflows` | `WorkflowManager.jsx` | Workflow defs | Cards, modal |
| `/admin/pending-approvals` | `PendingApprovals.jsx` | Approval inbox | Segment tabs, detail |
| `/admin-settings` | `AdminSettings.jsx` | Settings hub (URL for Manager) | Left nav shell |
| `/sent-announcements` | `SentAnnouncementsPage.jsx` | Sent announcements | List, sender |
| `/one-on-one`, `/1-on-1` | One-on-one wrappers | Meetings | Calendar/list |
| ESS paths (`allowedRoles: []`) | Profile, my leave, my payroll, internal jobs, etc. | Personal while on HR portal | Various |

---

## 3. Button and action inventory

API paths below use `/v1/...` (client axios base includes `/api`). Permission notes are **frontend-visible** unless stated; backend may still 403.

### 3.1 HR Dashboard — `HR/Dashboard/DashboardHR.jsx`

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| HR Dashboard | Search | Text | Filters recent hires | Local | None | None | Live filter |
| HR Dashboard | Notifications / Helpdesk / Profile | Buttons | Navigate | `navigate` | None | None | Route |
| HR Dashboard | New Announcement | Button | Opens modal | → `POST /v1/both/notification/create-notification` | `isHrManager \|\| isHrExecutive` | Message required | toast |
| HR Dashboard | View All announcements | Button | `/sent-announcements` | `navigate` | None | None | Route |
| HR Dashboard | Escalated / Pending approvals | Buttons | `/admin/pending-approvals` | `navigate` | Banner when escalated > 0 | None | Route |
| HR Dashboard | View All Employees / hire rows | Buttons | `/employees` / `:id` | `navigate` | None | None | Route |
| HR Dashboard | Quick: Add Employee | Button | `/add-employee` | `navigate` | `EMPLOYEE_CREATE` / HR flags | None | Hidden if no perm |
| HR Dashboard | Quick: Run Payroll | Button | `/admin-payroll` | `navigate` | `PAYROLL_VIEW_ALL` | None | Hidden if no perm |
| HR Dashboard | Quick: Leave / Approvals / Recruitment / Reports / Rules / Policy | Buttons | Navigate | `navigate` | Leave/HR flag gates | None | Hidden if no perm |
| HR Dashboard | Open Analytics | Button | `/hr/analytics` | `navigate` | None visible | None | Route |
| HR Dashboard | Celebration Wish / React | Buttons | Open event / react | `POST .../celebrations/events/open`, `.../react` | None | Today only | toast / silent fail |
| HR Dashboard | Reload / Go to login | Buttons | Recover from error | `location.reload` / `/login` | Error states | None | Reload / route |
| HR Dashboard | (load) | Data | Dashboard aggregates | Multiple GETs (employees, attendance, jobs, approvals, tax pending, announcements, …) | Route-level | None | Loading / error UI |

### 3.2 Employees

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Employees | Search / clear / filter pills | Text/Buttons | Filter directory | `GET /v1/admin/employee` (+ attendance/leave signals) | None visible | None | Refetch / client filter |
| Employees | Row / View | Button | Open detail | `navigate(/employees/:id)` | None | None | Route |
| Employees | Pagination | Buttons | Page list | Same GET | Bounds | None | Page change |
| Employees | FAB Add | Button | `/add-employee` | `navigate` | `canAddEmployee` | None | Hidden if no perm |
| Add Employee | Wizard Back / Continue / Create | Buttons/Submit | Multi-step create | `POST /v1/employee/auth/register` | Route + `EMPLOYEE_CREATE` | Required fields; password ≥8 | toast; navigate `/dashboard-hr` |
| Add Employee | Dept / Role / Manager / Shift / Platform role | Selects | Options | Managers, shifts, platform-roles GETs | Some disabled until deps | Client validation | Options / toasts |

### 3.3 Recruitment (key actions)

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Recruitment | Post New Job / module links | Links | Sub-routes | Links | Route `EMPLOYEE_VIEW_ALL` | None | Route |
| Recruitment | Screening settings save | Submit | Persist settings | `PUT /v1/admin/recruitment/screening/settings` | None visible | Form | toast |
| Recruitment | Template CRUD / activate / delete | Buttons | Manage templates | POST/PUT/DELETE screening templates | None visible | Delete confirm | toast |
| Pipeline | Job filter / bulk status Apply | Select/Button | Bulk update | `POST .../candidates/bulk` | None visible | ≥1 selected | toast |
| Candidate | Hire / Confirm joining / Withdraw / Blacklist / Archive / Delete | Buttons | Lifecycle | Various candidate POSTs + hard DELETE | Screening lock disables many | Prompt/confirm on withdraw/blacklist/delete | toast |
| Candidate | Save status / scores / interview / assessment / email | Forms/Buttons | ATS ops | PUT/POST candidate, interview, assessments, communication | Screening lock | Form fields | toast |
| Requisitions | Save Draft / Submit / Approve / Reject / Convert | Buttons | Req lifecycle | `POST .../requisitions/:id/{action}` | Status-gated | Required fields | toast; convert → job |
| Resume Inbox | Poll / Test / Save IMAP / Assign / Retry / Delete | Buttons | Inbox ops | inbox poll/config/import APIs | None visible | Delete confirm; job for assign | toast |

### 3.4 Lifecycle

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Lifecycle shell | Onboarding / Offboarding / Reports | Tabs/Buttons | Switch hubs | Query params | Reports: `canAccessLifecycleEnterprise` | Configure/Enterprise stripped | Hub swap |
| Onboarding | Create / Delete / filters / open | Buttons | Workflow CRUD | `POST/DELETE /v1/admin/onboarding/onboarding` | `isHRView` | Confirm delete | toast |
| Onboarding | Pause / Resume / Cancel / tasks / checklist / notes | Buttons | Detail ops | Various onboarding PUTs/POSTs | HR / assignee | Cancel confirm; blockers toast | toast |
| Onboarding | Prev / Next page | Buttons | Pagination | **None** | **Always `disabled`** | — | **Broken** |
| Offboarding | Create / Delete / Publish / Pause / Resume / Cancel | Buttons | Workflow | `/v1/admin/onboarding/offboarding` | `isHRView` | Confirm delete | toast |
| Offboarding | Tasks / access revoke / F&F calc / PDF / payroll run / letters | Buttons | Exit ops | F&F and clearance endpoints | HR | Forms / disabled while busy | toast |
| Offboarding | Prev / Next page | Buttons | Pagination | **None** | **Always `disabled`** | — | **Broken** |
| Lifecycle Reports | Export / Schedule | Buttons/Submit | Export & schedule | lifecycle export / scheduled POSTs | Enterprise | Format select | Download / toast |

### 3.5 Leave & attendance

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Leave Mgmt | Filters / Approve / Reject / View doc | Inputs/Buttons | Decide leave | `PUT /v1/admin/leave/update-leave-status/:id`; doc download | `canDecide` (org owner or `!requiresAdminApproval`) | Reject reason required | toast; may note workflow in progress |
| Leave Policy | Create/Edit/Save / Activate toggle | Forms/Buttons | Policy CRUD | `POST/PUT /v1/admin/leave-policy`; balance recalculate | Route `LEAVE_POLICY_MANAGE` | Confirm toggle; validators | toast |
| All Attendance | Filters / Export CSV-Excel / drills | Buttons | View & export | `GET .../team-attendance-history` + client export | Route attendance perms | Export scope | Download / toast |
| Regularization | Approve / Reject (row, bulk, drawer) | Buttons | Decide requests | `PATCH .../attendance-regularization/manager/{approve\|reject}/:id` | `isMyTurn`; org-owner bypass only | Reject reason | toast |

### 3.6 Payroll — `AdminPayroll.jsx`

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Admin Payroll | Month/Year / Search | Selects/Text | Load period | `GET /v1/admin/payroll/get-all-employee-payroll` | `PAYROLL_VIEW_ALL` | Future month constrained | Reloads |
| Admin Payroll | Generate Preview / Final | Buttons | Run payroll | `POST .../generate-bulk` | None on button | Final: confirm | Refresh / error |
| Admin Payroll | Disburse Preview / Disburse | Buttons | Bank disbursement | disburse-preview / disburse | **`isCEO` only** | None | Preview / result; disabled for typical HR |
| Admin Payroll | Process / Void / PDF / Export | Buttons | Adjustments & export | process/void/export-pdf | None visible | None | toast / download |

### 3.7 Documents, engagement, learning

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Documents | Upload / Approve / Reject / Version / Delete / Share | Buttons | Library ops | `/v1/admin/documents/*`, `/v1/both/documents` | `canAccessHrDocuments` / `isHRUser` | Reject reason; delete confirm | toast |
| HR Doc Requests | Approve / Reject / Complete / Delete / Download | Buttons | Letter queue | `/v1/both/employee-document-requests/*` | `mode=hr` | Reject notes | toast |
| Engagement | Create/Delete survey / Export / sections | Buttons | Manage engagement | `/v1/admin/engagement/*`, `/v1/both/engagement/*` | `canManageEngagement` | Delete confirm | toast / download |
| Learning | Create course / Assign / Certificate | Buttons | L&D admin | `/v1/admin/learning/*` | `canManageLearning` | Assignment selection | toast / download |

### 3.8 Benefits, succession, workforce, helpdesk

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| Benefits | Plan CRUD / enroll / cancel / export | Buttons | Benefits admin | `/v1/admin/benefits/*` | `isHR()` for HR sections | Delete confirm | toast |
| Succession | Create plan / talent / activities / delete | Buttons | Succession CRUD | `/v1/admin/succession/*` | Route-level | Delete confirm | toast |
| Workforce | Plans/forecasts CRUD / Submit–Complete / Create recruitment | Buttons | Workforce workflow | `/v1/admin/workforce/*` | Route-level | Reject reason; delete confirm | toast |
| Helpdesk | Create / Update / Comment / Resolve | Buttons | Tickets | `/v1/both/helpdesk/tickets*` | `canManageTickets` for manage | Required fields | toast |

### 3.9 Reports, analytics, approvals, announcements

| Screen | UI Element | Type | What it does | API/handler | Permission check | Validation/confirmation | Success/error behavior |
|--------|------------|------|--------------|-------------|------------------|-------------------------|------------------------|
| HR Reports | Sidebar links | Links | Nested reports | Routes | Route-level | None | Route |
| HR Reports | Advanced Analytics control | Button | Goes to `/hr/analytics` | `navigate` | None | None | **Icon suggests download; does not export** |
| Report pages | Search / charts | Display | Visualize | `GET /v1/admin/analytics/hr` (+ module APIs) | None | None | **Fake data when empty** (see §5) |
| HR Analytics | Date range | Inputs | Refetch | `GET /v1/admin/analytics/hr` | Route-level | None | Error banner; **no export** |
| Pending Approvals | Approve / Reject | Buttons | Process step / tax | `/v1/admin/approvals/process/:id`; tax PATCH | `canDecideApproval` | Reject reason | toast; 409 warning |
| Announcements | Send / Refresh / Receipts | Buttons | Broadcast & audit | `POST .../create-notification`; sent-announcements GETs | HR flags on dashboard | Empty message blocked | toast |

---

## 4. HR modules — CRUD, workflows, bulk, import/export

| Module | Create | Read | Update | Delete | Approvals / workflows | Bulk | Import / export |
|--------|--------|------|--------|--------|----------------------|------|-----------------|
| **Recruitment** | Jobs, requisitions, candidates, interviews, assessments | Pipeline, calendar, inbox | Status, scores, screening | Candidate hard-delete, template delete | Requisition submit/approve/reject/convert; hire → employee | Bulk candidate status | Resume IMAP import; career portal |
| **Onboarding** | Workflows, tasks, notes, BGV initiate | Hubs, detail tabs | Pause/resume, tasks, checklist, verify docs | Delete workflow | Task assignee roles; document verify | Lifecycle docs bulk (API perms) | Lifecycle report export |
| **Exit / offboarding** | Offboarding workflow | Hub + alumni | Clearance, access revoke, F&F, letters | Delete workflow | Publish/pause; F&F approval; exit interview | Letters bulk (API) | F&F PDF; exit export |
| **Employee records** | Add employee | Directory, 360 | Profile/job fields (shared Admin UI) | Terminate/delete (perms) | — | Bulk shift (Admin employee routes) | — |
| **Attendance** | Rules (Admin UI) | Today, history | — | — | Regularization/WFH approve | Bulk approve regularization | CSV/Excel export history |
| **Leave policies & approvals** | Policies, leave decisions | Leave list, balances, reports | Policy activate; leave status | — | Multi-step approvals; `requiresAdminApproval` | — | Leave reports |
| **Payroll support** | Generate preview/final, structures (URL) | Admin payroll | Process/void adjustments | — | Publish (Manager perms); **disburse CEO-only** | Generate-bulk | CSV/PDF results |
| **Performance reviews** | API only (`/admin/review-cycle`, `/both/performance-review`) | Score field on employee; **mock report** | — | — | **No product UI** | — | — |
| **Training / learning** | Courses, assignments | Catalog, enrollments | Edit course | — | — | Assign to team/employees | Certificate download |
| **Documents** | Upload, versions, templates, letter requests | Library, queues | Approve/reject | Delete docs/requests | Letter request approve/complete | Lifecycle document bulk | Download / share link |
| **Engagement** | Surveys, pulse, recognition | Dashboard, results | Edit survey/pulse | Delete survey | Action plans | — | CSV exports |
| **Benefits** | Plans, enrollments | Plans, employees, reports | Activate/cancel | Delete plan | — | Assign plan | Report export |
| **Succession** | Plans, talent, activities | Lists, detail | Activity status | Delete plan/talent | — | — | — |
| **Workforce** | Plans, forecasts, hiring needs | Dashboard, gap, reports | Workflow transitions | Delete | Submit→approve→start→complete | Create recruitment from hiring | Reports endpoints |
| **Reports / analytics** | Scheduled lifecycle reports | HR reports + analytics | — | — | — | — | Lifecycle export; **main HR reports lack real export** |
| **Announcements** | Create from dashboard / sent page | Sent list + receipts | — | — | — | Broadcast | — |
| **Helpdesk / grievances** | Helpdesk tickets | Ticket list | Status, assignee, resolve | Cancel own | Resolve workflow | — | — |
| **Grievances** | — | — | — | — | **Module absent** | — | — |

---

## 5. Gaps and problems

### 5.1 Security / permissions

- Empty `allowedRoles: []` + empty `requiredPermissions` → `canAccess` returns **true** for any auth user (`permissions.js`). Affects `/engagement`, `/learning`, `/benefits`, `/onboarding`, `/helpdesk`, and many ESS paths used as manage entrypoints.
- Route string `'hr_executive'` in `allowedRoles` (e.g. leave-management) is never added to `effectiveRoles` in `ProtectedRoute` (only `'hr'` via heuristic).
- Many HR nav items lack `permissions` keys → Executive sees modules they cannot fully operate.
- HR Manager backend map is near–org-owner (`ORG_SETTINGS_MANAGE`, `PAYROLL_PUBLISH`, `EMPLOYEE_DELETE`).
- HR Executive still has `employee.delete` and lifecycle manage helpers treat executive like manager for terminate in places.
- `requireHrStaff` unused on routes; older `rbac.js` unused.

### 5.2 Broken / duplicate / misleading UI

| Issue | Location |
|-------|----------|
| Pagination always disabled | `OnboardingHub.jsx`, `OffboardingHub.jsx` |
| Trailing empty nav slot (`HR_NAV_ITEMS` ends with bare `,`) | `navigationConfig.jsx` ~434–436 |
| Unused edit/delete icon imports; no row actions | `EmployeesPage.jsx` |
| Dual document UIs in HR nav | `/documents` vs `/admin/document-management` |
| Duplicate regularization entry | Leave Mgmt tab + `/attendance-regularization` |
| “Download” icon navigates to analytics | `HRReportsLayout` |
| Career portal stub when orgId missing | `RecruitmentPage.jsx` |
| Lifecycle Configure / Enterprise hidden | `EmployeeLifecycle.jsx` strips query params |
| Helpdesk / analytics / announcements not in sidebar | Discoverability |

### 5.3 Loading / empty / error

- DashboardHR: solid loading/error for core loads; announcements fail soft to `[]`.
- Reports: **fabricate KPIs/charts when empty** — `PerformanceReport.jsx`, `ComplianceReport.jsx` (fully static), `AttritionReport.jsx`, `AttendanceReport.jsx`, `PayrollReport.jsx`, `HeadcountReport.jsx`.
- Several HR modules rely on toasts without full-page retry (Documents, Succession, Helpdesk list).

### 5.4 Accessibility & responsiveness

- Documents icon-only actions often use `title=` without `aria-label` (`DocumentsPage.jsx`).
- Wide tables (`min-w-[720px]`) force horizontal scroll on mobile (Documents, Succession).
- Dashboard search label may lack visible text; some controls do have good `aria-label`s (DashboardHR help/notifications, Workforce deletes).

### 5.5 Inconsistent UI

- Shared Admin pages (Employees, Leave, Attendance, Payroll) vs HR-native modules (Recruitment, Workforce, Documents) use different visual systems.
- Admin nav exposes Settings / Roles / Workflows / Salary; HR Manager has rights but no nav entries → power without IA.

### 5.6 Missing modern HRMS expectations

- Grievances / ER case management — **no code**
- Performance / OKR / 360 UI — APIs without product routes
- Honest empty analytics (no mock filler)
- Helpdesk + SLA as first-class (SLA Admin UI not routed)
- Interactive org chart, asset registry, biometric sync, multi-entity — still gaps vs `HRMS_LAUNCH_AUDIT.md`
- Leave encashment / Buddy dashboard files exist but are not routed

---

## 6. Overlap with other roles

### 6.1 Shared with Admin

Employees, leave, attendance, pending approvals, payroll (Manager), documents/templates, org chart, lifecycle, recruitment, learning, engagement, benefits, succession, workforce, ID cards, calendar, policies, approval workflows, settings (by URL for Manager). Admin has clearer nav for configuration.

### 6.2 Shared with Manager

Team-scoped employees/leave/attendance/regularization; engagement ESS + team analytics; onboarding; one-on-one; hiring requests (vs full ATS); document ESS. HR is **org-scoped**; Manager is **team-scoped**.

### 6.3 Shared with Employee (ESS)

While on HR portal, HR also has Leave & attendance, My payroll, and can open ESS wrappers for documents, engagement, calendar, internal jobs, benefits/learning. Wrappers switch UI by `isHR()`.

### 6.4 HR can do things it arguably shouldn’t

| Risk | Who | Detail |
|------|-----|--------|
| Org settings / platform roles / role hierarchy | HR Manager | Via URL + `ORG_SETTINGS_MANAGE` |
| Payroll publish | HR Manager | Permission map |
| Hard delete / terminate | Manager **and** Executive | `employee.delete` + lifecycle helpers |
| Open manage URLs | Any auth user | `allowedRoles: []` screens |

### 6.5 HR cannot do / cannot find things it should

| Gap | Detail |
|-----|--------|
| Helpdesk | Exists; dashboard shortcut only |
| Announcements | Creatable; no sidebar page |
| Grievances | Missing |
| Performance reviews | No UI |
| Leave policy / attendance rules / company policies | Useful config buried |
| Reports export | View-only with fake fillers |
| Executive onboarding/policy APIs | Nav oversells capability |
| Salary structure / approval workflow config | Manager perms; Admin nav only |

---

## 7. Source index

| Area | Path |
|------|------|
| Server permission map | `server/config/permissions.constants.js` |
| Platform / system roles | `server/config/identity.constants.js`, `systemRole.constants.js` |
| Auth context | `server/helpers/permissionService.js` |
| Middleware | `server/middlewares/requirePermission.js` (+ legacy `isAdminOrHR*` wrappers) |
| Client routes | `vite_client/src/routes/index.jsx` |
| Route guard | `vite_client/src/components/ProtectedRoute.jsx` |
| Client perms | `vite_client/src/utils/permissions.js` |
| HR nav | `vite_client/src/utils/navigationConfig.jsx` |
| Portal | `vite_client/src/utils/portalConfig.js` |
| HR feature root | `vite_client/src/HR/**` |
| Prior launch audit | `docs/HRMS_LAUNCH_AUDIT.md` |
| Missing admin audit | `docs/admin-audit.md` (**does not exist**) |

---

## 8. Recommended Phase 2 inputs (for discussion after approval)

1. **Permission product decision:** Trim HR Manager from org-owner parity? Give Executive explicit ops keys or hide nav items?
2. **IA:** Single Documents hub; add Helpdesk + Announcements; demote or ship Performance; surface leave policy / attendance rules.
3. **Data honesty:** Remove mock report fallbacks before redesign polish.
4. **Reuse Admin design system** from shared components (not `admin-audit.md`); do not fork Admin screens unless required.
5. **Enforce** `requiredPermissions` on every HR manage route; keep backend as source of truth.

---

**Phase 1 complete.** Phase 2 Step 1 proposal: `docs/hr-phase2-proposal.md` / `docs/hr-phase2-proposal.docx`. No UI rebuild until that proposal is confirmed.
