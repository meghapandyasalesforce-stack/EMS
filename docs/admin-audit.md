# Admin role audit

Phase 1 analysis only. No application code was changed. Phase 2 (redesign) is not started.

**Scope:** “Admin” means the organization owner who logs in with JWT role `admin` and the `org_owner` permission bucket. That person gets the Admin sidebar plus an Admin / HR / Me portal switcher. SaaS control-panel operators (`platform_super_admin` and similar) are a separate product and are listed only so they are not mixed into this audit.

---

## Executive summary

The live access model is permission buckets, not a single Admin enum. An org owner receives every permission in `ROLE_PERMISSION_MAP` (`server/config/permissions.constants.js`). The Admin sidebar in `vite_client/src/utils/navigationConfig.jsx` shows 18 items. Many more screens are reachable by URL or by switching to the HR or Me portal (`vite_client/src/utils/portalConfig.js`).

The shell is `vite_client/src/Shared/Header.jsx` (sidebar, header, portal switcher). `vite_client/src/Layout/AdminLayout.jsx` is an unused stub that renders the text “AdminLayout”.

Highest-impact problems:

- Two permission systems exist side by side. Users & Roles drives real access. Role Hierarchy writes a separate `Role` collection that route guards do not consult.
- Settings has two buttons with no handler: **Manage Roles** and **Configure Reports** (`vite_client/src/Admin/Settings/AdminSettings.jsx`).
- Project bulk **Delete** and **Change status** do nothing (`vite_client/src/Admin/project/ProjectPage.jsx`, `handleBulkAction`).
- Org onboarding promises a later employee import from the Employees page. That page has no import.
- Built screens with no route: SLA manager, `AccessTab`, `CalendarManagement1.jsx`, `ProjectPageEnhanced.jsx`.
- Org audit-log and review-cycle APIs exist. There is no Admin UI for them.
- The dashboard “upcoming events” row is three hardcoded dates, and project progress is inferred from status.

---

## 1. Role and permission discovery

### How a person becomes “Admin”

| Layer | Where | What it stores |
|---|---|---|
| JWT role | `server/config/identity.constants.js` | `admin`, `employee`, or `platform`. This chooses which account collection to load. |
| Platform roles on the User | same file, `PLATFORM_ROLES` | `org_owner`, `hr_admin`, `hr_executive`, `payroll_admin`, `manager`, `employee` |
| SaaS operators | `SAAS_OPERATOR_ROLES` | `platform_super_admin`, `platform_saas_admin`, `platform_support`, `platform_readonly`, `platform_operator`. Control panel at `/platform`, not the HRMS Admin portal. |
| System roles (what Users & Roles assigns) | `server/config/systemRole.constants.js` | `employee`, `hr_executive`, `hr_manager`, `payroll_admin`, `line_manager`, `project_manager`, `executive` |
| Permission buckets | `ROLE_BUCKETS` in `server/config/permissions.constants.js` | `org_owner`, `hr_manager`, `hr_executive`, `payroll_admin`, `line_manager`, `project_manager`, `executive`, `employee` |
| Functional roles on the employee record | `server/helpers/permissionService.js`, `server/helpers/functionalRolesHelper.js` | `hr`, `manager`, `project_manager`, `finance`, `executive`, `ceo`, `cto`, `cfo`, `vp` |
| Legacy role documents | `server/models/role.model.js`, UI `RoleHierarchy.jsx` | Name, level 1–10, module actions. Not used by `requirePermission`. |

Org-owner resolution is in `server/helpers/permissionService.js`: a JWT `admin` with no platform roles is treated as `org_owner` plus `hr_admin` when `isOrgOwnerUser` is true. `hasPermission` then returns true for every permission when `isOrgOwner` is set.

### Every role in the system

| Role | Kind | Home the product intends |
|---|---|---|
| Organization owner | Platform `org_owner` + JWT `admin` | Admin portal, and can switch to HR and Me |
| HR Manager | System `hr_manager` / platform `hr_admin` | HR portal. Bucket gets every permission except `executive.dashboard` |
| HR Executive | System `hr_executive` | HR portal with a shorter nav (no org payroll, no projects) |
| Payroll Admin | System `payroll_admin` / functional `finance` | Finance portal |
| Line Manager | System `line_manager` / functional `manager` | Manager portal, team-scoped data |
| Project Manager | System `project_manager` | Projects plus personal self-service |
| Executive | System `executive` or CEO/CTO/CFO/VP title | Executive dashboard |
| Employee | Default bucket on every principal | Me portal |
| SaaS operators | Separate JWT `platform` | `/platform` control panel |

### Where role logic lives

- Server map: `server/config/permissions.constants.js`, `server/config/systemRole.constants.js`, `server/config/identity.constants.js`
- Resolution: `server/helpers/permissionService.js`, `server/helpers/systemRoleService.js`, `server/helpers/functionalRolesHelper.js`, `server/helpers/inferSystemRoleFromWorkInfo.js`
- Route gates: `server/middlewares/requirePermission.js`, `server/middlewares/createAuthMiddleware.js`, `server/middlewares/isAdminAuthenticated.js`, `isAdminOrHRAuthenticated.js`, `isAdminOrHROrExecutiveAuthenticated.js`, `isAdminOrExecutiveAuthenticated.js`, `isCEOAuthenticated.js`
- API mount list: `server/config/routes.js`
- Client mirror: `vite_client/src/utils/permissions.js` (shorter than the server list; lifecycle keys are missing on the client)
- Route guards: `vite_client/src/components/ProtectedRoute.jsx`, `vite_client/src/routes/index.jsx`
- Nav and portals: `vite_client/src/utils/navigationConfig.jsx`, `vite_client/src/utils/portalConfig.js`, `vite_client/src/Hooks/useAuthPermissions.js`, `vite_client/src/components/PermissionGate.jsx`
- Shell: `vite_client/src/Shared/Header.jsx`, `vite_client/src/components/PortalSwitcher.jsx`

Org owner UI tabs are fixed to Admin, HR, and Me (`ORG_OWNER_PORTAL_TABS` in `portalConfig.js`). The Admin tab’s configured home is `/organization/dashboard`, while the sidebar’s first item is `/dashboard-admin`.

---

## 2. Admin screen inventory

Shared chrome on every authenticated Admin page: left sidebar from `getAdminNavigation()`, top header (notifications, profile, portal switcher) in `Shared/Header.jsx`.

### Sidebar screens

| Route | Component | Purpose | Layout |
|---|---|---|---|
| `/dashboard-admin` | `vite_client/src/Admin/DashboardAdmin.jsx` | Org snapshot: headcount, attendance, pending leave, payroll, announcements, celebrations | Header actions, stat cards, announcement list, celebration cards, shortcut buttons, new-hire list. Payroll-by-department is a bar built from divs. |
| `/organization/chart` | `vite_client/src/Admin/Organization/OrganizationChartPage.jsx` | Org hierarchy | Search, desktop canvas (nodes, connectors, minimap), mobile list, records view, export |
| `/employees` | `vite_client/src/Admin/Employee/EmployeesPage.jsx` | Directory | Search, status filter pills, table, pagination, floating Add |
| `/employees/:employeeId` | `vite_client/src/Admin/Employee/EmployeeDetailsPage.jsx` | One employee | Header actions, tabs from `employeeDetails/constants.js`: Personal, Job Details, Documents, Leave, Payroll, Performance, Timeline. Dialogs for name, work info, performance, payroll settings, terminate, delete |
| `/add-employee` and `/add` | `vite_client/src/Admin/Employee/AddEmployee.jsx` | Create employee | Long form (identity, org masters, manager, salary, system role) |
| `/onboarding` | `vite_client/src/components/OnboardingRouteWrapper.jsx` → `HR/Onboarding/EmployeeLifecycle.jsx` | Joiner and leaver workflows | Tabs: Onboarding / Offboarding. Query flags `?configure=1`, `?reports=1`, `?enterprise=1` open config, reports, and an enterprise hub |
| `/leave-management` | `vite_client/src/Admin/LeaveManagement.jsx` | Org leave queue | Status tabs, search, type and month filters, table, detail drawer with approve/reject |
| `/projects` | `vite_client/src/Admin/project/ProjectPage.jsx` | Project list | Stat cards, search, filters, bulk menu, cards/table, export dialog |
| `/projects/:id` | `vite_client/src/Admin/project/ProjectDetailPage.jsx` | One project | Work plan, status and update dialogs, assignees |
| `/add-project` | `vite_client/src/Admin/project/AddProject.jsx` | Create project | Form with employee search |
| `/all-attendance-history` | `vite_client/src/Admin/Attendance/AllAttendanceStatsComponent.jsx` | Attendance history | Filters, search, table, export |
| `/today-attendance` | `vite_client/src/Admin/Attendance/TodayStatusComponent.jsx` | Live attendance | Reached from the dashboard, not the sidebar |
| `/admin-payroll` | `vite_client/src/Admin/Payroll/AdminPayroll.jsx` | Payroll run | Month controls, preview/final generate, CSV/PDF, per-row actions, adjustments |
| `/add-payroll`, `/add-payroll/:employeeId/:month/:year` | `AddPayroll.jsx`, `UpdatePayroll.jsx` | Create or correct a payslip | Form |
| `/admin-employee-payroll/:employeeId` | `AdminEmployeePayroll.jsx` | One employee’s payroll history | Table |
| `/role-hierarchy` | `vite_client/src/Admin/RoleManagement/RoleHierarchy.jsx` | Legacy role tree | List, create/edit form, assign-to-employee |
| `/admin/platform-roles` | `vite_client/src/Admin/RoleManagement/UsersRolesPage.jsx` | Live access | Search, roster table, edit drawer, elevated-role confirm modal |
| `/admin/approval-workflows` | `vite_client/src/Admin/ApprovalWorkflows/WorkflowManager.jsx` | Workflow definitions | List, create/edit modal, detail |
| `/admin/pending-approvals` | `vite_client/src/Admin/ApprovalWorkflows/PendingApprovals.jsx` | Inbox | Filters including `?escalated=1`, approve/reject, detail modal |
| `/calendar-management` | `vite_client/src/Admin/Calendar/CalendarManagement.jsx` | Holidays and events | Calendar, create/edit/import modals |
| `/one-on-one` | `vite_client/src/components/OneOnOneRouteWrapper.jsx` | Meetings the user organizes | Shared meeting UI |
| `/salary-structure` | `vite_client/src/Admin/SalaryStructure/SalaryStructureManager.jsx` | Pay structures | List and form (earnings, deductions, overtime) |
| `/admin/document-management` | `vite_client/src/Admin/Documents/DocumentManagement.jsx` | Requests and templates | Two tabs. Org owner sees the admin request queue |
| `/organization/subscription` | `vite_client/src/Admin/Organization/SubscriptionManagement.jsx` | Plan and billing | Plan cards, checkout link |
| `/organization/checkout` | `CheckoutPaymentPage.jsx` | Payment | Card form |
| `/admin-settings` | `vite_client/src/Admin/Settings/AdminSettings.jsx` | Configuration | 12-tab settings shell |

### Settings tabs (`AdminSettings.jsx`)

Attendance Rules, Shift Settings, Leave Policy, Payroll Settings, Notification Settings, Email Configuration, Security (change password), Permissions (placeholder), Reports & Analytics (placeholder), Document Management Settings, Theme & Branding, General Settings.

### Organization screens an Admin can open that are not in the sidebar

All gated `allowedRoles: ['admin', 'executive']` in `vite_client/src/routes/index.jsx`:

| Route | File | Purpose |
|---|---|---|
| `/organization/dashboard` | `OrganizationDashboard.jsx` | Portal home for the Admin tab |
| `/organization/profile` | `OrganizationProfile.jsx` | Company profile and address |
| `/organization/settings` | `OrganizationSettings.jsx` | Overlaps General Settings |
| `/organization/structure` | `OrgStructurePage.jsx` | Departments, designations, and other masters. Nav item is commented out |
| `/organization/onboarding` | `OrganizationOnboarding.jsx` | First-run wizard |
| `/organization/verification` | `OrganizationVerification.jsx` | Business verification |
| `/organization/analytics` | `OrganizationAnalytics.jsx` | Org analytics |
| `/organization/referrals` | `ReferralProgram.jsx` | Referrals |
| `/organization/domain` | `DomainVerification.jsx` | Email domain verification |

Related admin routes also outside the sidebar: `/admin/policies`, `/admin/leave-policy`, `/admin/leave-balance`, `/admin/leave-reports`, `/id-card-generator`, `/attendance-rules`, `/sent-announcements`, `/admin/document-templates`, `/admin/document-requests`, `/hr/document-requests`.

### What the org owner also sees by switching portals

HR portal (`getHRManagerNavigation` in `navigationConfig.jsx`) adds recruitment, learning, engagement, documents, benefits, succession, workforce, ID cards, HR reports, regularization, and personal payroll. Me portal is the employee self-service set (own leave, attendance, projects, benefits, documents, calendar, payslips). Button-level detail for those belongs in the HR and Employee audits.

---

## 3. Button and action inventory

Shell actions in `Header.jsx` apply on every Admin screen: portal switch (Admin / HR / Me), notification bell to `/notifications`, profile menu, logout. Logout ends the auth session.

### Dashboard — `DashboardAdmin.jsx`

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation / validation | Success / error |
|---|---|---|---|---|---|---|---|
| Dashboard | Wishes / Upcoming | button | Opens celebration page | `navigate` to `/celebrations/:eventId` | any authenticated | none | route change |
| Dashboard | Reaction emoji | button | Adds a reaction | celebration reaction handler | any authenticated | disabled while `reacting` | silent failure on optional load |
| Dashboard | Add Employee | button | Create employee | `/add-employee` | shown only if `isOrgOwner` | none | route change |
| Dashboard | Helpdesk | button | Open helpdesk | `/helpdesk` | route allows any authenticated user | none | route change |
| Dashboard | Today’s attendance | button | Live attendance | `/today-attendance` | `attendance.view.all` or `.team` | none | route change |
| Dashboard | Payroll | button | Payroll home | `/admin-payroll` | `payroll.view.all` | none | route change |
| Dashboard | Stat cards | card button | Only “Overdue Approvals” navigates | `/admin/pending-approvals?escalated=1` | leave approve all/team | none | other cards are not clickable |
| Dashboard | New announcement | button | Opens `AnnouncementModal` | POST via notification sender | org announcements | message required in modal | toast; list refresh `GET /v1/both/notification/sent-announcements` |
| Dashboard | Sent announcements | button | History | `/sent-announcements` | admin, hr, manager, executive | none | route change |
| Dashboard | Pending leave row | button | Leave queue | `/leave-management` | leave view | none | route change |
| Dashboard | Shortcuts | button | Today’s live attendance, today’s log, leave report, add employee | navigations above | per shortcut | none | route change |
| Dashboard | New hire row | button | Employee profile | `/employees/:id` | employee view | none | route change |

Dashboard data loads: employees, projects, payrolls, leaves hooks; `GET /v1/both/attendance/today-status`; `GET /v1/admin/approvals/escalated-count`; `GET /v1/both/profile-details/upcoming-birthdays`. Optional failures are swallowed.

### Employees

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation / validation | Success / error |
|---|---|---|---|---|---|---|---|
| Employees | Search clear | button | Clears search | local state | employee view | none | list resets |
| Employees | Status pills | button | Filters table | local | employee view | none | filtered rows |
| Employees | Row | button | Opens profile | `/employees/:id` | employee view | none | route change |
| Employees | Pagination | button | Page change | local | employee view | disabled at ends | page change |
| Employees | Add employee | button | Create form | `/add-employee` | route requires `employee.create` | none | route change |
| Add employee | Submit | form submit | Creates the person and assigns system role | employee registration API used by `AddEmployee.jsx` | `employee.create` (HR manager has this too) | required name, email, department, job, manager when list is non-empty | toast / inline errors |
| Employee profile | Back | button | Directory | `/employees` | employee view | none | route change |
| Employee profile | Edit name / work / performance / payroll settings | button + dialog | Updates those fields | work-info and payroll-settings endpoints | work info: admin/HR/executive middleware; payroll settings: `payroll.edit` | dialog Cancel / Save; save disabled while pending | toast |
| Employee profile | Terminate | button + dialog | Ends employment | terminate handler in `EmployeeDetailsPage.jsx` | lifecycle manage helper (org admin or HR) | confirm dialog | toast, dialog closes |
| Employee profile | Delete | button + dialog | Deletes the record | delete handler | `employee.delete` | confirm dialog | toast |
| Employee profile | Tabs | tab | Switches Personal, Job, Documents, Leave, Payroll, Performance, Timeline | local | Documents is `hrOnly`; Payroll hidden for HR Executive | per-tab forms | per-tab toasts |
| Leave tab | Approve / reject | button | Acts on that employee’s leave | same leave status API as leave management | leave approve | reject needs a reason | toast |

`vite_client/src/Admin/Employee/employeeDetails/tabs/AccessTab.jsx` exists and is never mounted. Access is edited inside Job Details and on Users & Roles.

### Organization chart

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation | Success / error |
|---|---|---|---|---|---|---|---|
| Org chart | Search, show more | button | Filters people | chart data from `GET /v1/admin/org-structure/chart` | employee view or org settings | none | result list |
| Org chart | Select / expand / show more reports | button | Tree interaction | local | same | none | node state |
| Org chart | Minimap toggle, overview all | button | Canvas navigation | local | same | none | view change |
| Org chart | Fullscreen | button | Fullscreen API | local | same | none | view change |
| Org chart | PNG / PDF (mobile) | button | Exports the visible tree | client export | same | disabled while exporting | file download |
| Records view | View in chart | button | Focuses a person | local | same | none | chart focus |
| Org structure (not in nav) | Create / update / delete masters | form | Departments, designations, and other masters | `/v1/admin/org-structure/:resource` | org settings middleware | delete confirmation in page | toast |

### Leave, attendance, calendar

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation / validation | Success / error |
|---|---|---|---|---|---|---|---|
| Leave management | Status tabs, search, filters | tab / input | Filters the queue | `GET /v1/admin/leave/get-all-leaves` | `leave.view.all` or `.team` | none | empty table when no rows |
| Leave management | Approve | button | Sets status approved | `PUT /v1/admin/leave/update-leave-status/:id` via `leaveSlice.updateLeave` | leave approve | none beyond click | toast; workflow may stay pending for a later HR step |
| Leave management | Reject | button | Sets status rejected | same PUT with reason | leave approve | reason required, warning toast if empty | toast |
| Leave balance | Search | input | Finds balances | `/admin/leave-balance` page | admin, hr, executive on the route; no `requiredPermissions` | none | filtered list |
| Leave reports | Report controls | page | Leave analytics | `/v1/admin/leave-reports` | `leave.policy.manage` | per control | toast / empty |
| Attendance history | Search, filters, export | input / button | History and download | attendance both routes | attendance view | none | table / file |
| Today attendance | Refresh / rows | page | Live punches | `GET /v1/both/attendance/today-status` | attendance view | none | list |
| Attendance rules (also a settings tab) | Save rule, deactivate | form / button | Office hours, radius, address | `POST /v1/admin/attendance-rules/create-or-update`, `PATCH .../deactivate/:ruleId` | `attendance.rule.manage` | address and radius fields | toast |
| Shift settings | Save, bulk assign | form | Shift definitions and assignment | `PUT /v1/admin/attendance-rules/shifts`, `POST /v1/admin/employee/bulk-assign-shift` | admin/HR/executive middleware | search validation | toast |
| Calendar | Create / edit holiday or event, import | modal submit | Holiday calendar | `/v1/admin/calendar` | `leave.policy.manage` | name required; upload disabled while uploading | toast |
| Regularization | Approve / reject | page at `/attendance-regularization` | WFH and correction requests | `/v1/both/attendance-regularization` | manager/HR/exec middleware | reason on reject | toast |

### Payroll and salary

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation / validation | Success / error |
|---|---|---|---|---|---|---|---|
| Payroll | Preview generate | button | Dry run | `GET /v1/admin/payroll/disburse-preview` | `payroll.view.all` to open; process needs `payroll.process` | month selected | status chips |
| Payroll | Final generate | button | Disburse | `POST /v1/admin/payroll/disburse` | `payroll.process` / publish gates on the API | mode `final` | toast |
| Payroll | Export CSV | button | Client CSV | `handleExportCSV` | payroll view | none | download |
| Payroll | Export PDF | button | Server PDF | `GET /v1/admin/payroll/:id/export-pdf` | payroll view | none | download or toast |
| Payroll | Mark processed / void / supersede | button | Adjustment workflow | `POST .../process/:id`, `.../void/:id`, `.../supersede-base` | payroll process | in-row “Working…” | toast |
| Payroll | Row link | link | Employee payroll | `/admin-employee-payroll/:employeeId` | payroll view | none | route change |
| Add / update payroll | Submit | form | Create or correct | payroll create/edit routes | `payroll.create` / `payroll.edit` | amounts; correction reason recommended | toast |
| Salary structure | Save structure | form | CRUD structures | `/v1/admin/salary-structure` | `payroll.edit` or `payroll.create` | name required | toast |

### Roles, workflows, documents, settings

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation / validation | Success / error |
|---|---|---|---|---|---|---|---|
| Users & roles | Edit row | button | Opens access drawer | `GET /v1/admin/platform-roles/roster` | `org.settings.manage` or `employee.edit.sensitive`; org owner always | none | toast on load failure |
| Users & roles | Save access | button | Writes system role and data scope | `PATCH /v1/admin/platform-roles/employees/:id/system-role` | same | elevated roles open `ElevatedRoleConfirmModal` | toast tells the person to re-login |
| Role hierarchy | Create | button | New legacy role | `POST /v1/admin/roles` | `org.settings.manage` | name, level 1–10 | toast |
| Role hierarchy | Edit | button | Update | `PUT /v1/admin/roles/:id` | same | same | toast |
| Role hierarchy | Delete | button | Delete | `DELETE /v1/admin/roles/:id` | same | confirm in page | toast |
| Role hierarchy | Assign | button | Attaches role to an employee | `POST /v1/admin/roles/assign` | same | employee picked | does not change the live permission buckets |
| Workflows | Create / edit / activate | modal | Workflow definitions | `/v1/admin/approvals` | leave policy or org settings | form fields | toast |
| Pending approvals | Approve / reject | button | Decides the current step | approvals API | `leave.approve.all` or `.team` | reject needs a reason | toast |
| Document management | Requests / Templates tabs | tab | Switches panels | settings flags `enableDocumentRequests`, `enableSelfServiceDocuments` | route is admin/hr/executive with no extra permission key | none | empty copy when both modes are off |
| Document requests | Approve / reject | buttons inside `AdminEmployeeDocumentRequests.jsx` | Queue actions | `/v1/both/employee-document-requests` | org owner uses the admin queue | reason on reject | toast |
| Templates | New, edit, delete, permanent delete, add field, remove stamp, save | buttons | Template CRUD | `/v1/both/document-templates` | admin/hr/executive | name, country required | toast |
| Settings tabs | Tab buttons | tab | Switches the 12 panels | local | `org.settings.manage` | none | panel swap |
| Permissions tab | Manage Roles | button | No `onClick` | none | n/a | none | nothing happens |
| Reports tab | Configure Reports | button | No `onClick` | none | n/a | none | nothing happens |
| Security | Change password | form | Own password | password API | authenticated | policy: upper, number, special, min 8 | toast |
| General | Five toggles | toggle | Registration, email verification, self-service, WFH, probation-after-joining | saved with settings | org settings | none until Save | visual only until save |
| General | Save settings | button | Persists settings, timezone, and employee-ID format | `updateOrganizationSettings` → `PUT /v1/admin/organization/settings` | admin/HR/executive on that route | confirm dialog when employee-ID format changes, because IDs are migrated | toast; migration refreshes the employee list |
| Email | Send test | button | Test message | email settings API | org settings | address required | toast |
| Theme | Save theme | form | Branding colors | organization branding API | org settings | name optional | toast |
| Subscription | Change plan | button | Starts checkout | `/v1/organization/subscription` | `org.settings.manage` | plan selected | `/organization/checkout` |
| Policies | Create, edit, view, publish | pages under `/admin/policies` | Policy documents | `/v1/organization/policies` | admin, hr, executive, no `requiredPermissions` on the route | content required | toast |
| ID cards | Search, generate | page `/id-card-generator` | Cards | `/v1/admin/id-cards` | route has no `requiredPermissions`; API uses HR document access | none | download / toast |
| Announcements page | List actions | page `/sent-announcements` | Sent history | notification routes | admin, hr, manager, executive | none | list |

### Projects

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation | Success / error |
|---|---|---|---|---|---|---|---|
| Projects | Add project | button | Create form | `/add-project` | `project.admin.view` or `employee.view.all` | form validation | toast |
| Projects | Bulk export | menu | CSV of selected or page | client `handleExport` | same | none | download |
| Projects | Bulk delete | menu | Intended delete | `handleBulkAction('delete')` returns immediately | same | none | selection clears, no API call |
| Projects | Bulk status | menu | Intended status change | `handleBulkAction('status')` returns immediately | same | none | selection clears, no dialog |
| Projects | Card / row | link | Detail | `/projects/:id` | same | none | route change |
| Project detail | Refresh plan, status dialog, update dialog, edit work item | buttons | Work management | `/v1/admin/project` and task routes | project workspace middleware | Cancel on dialogs | toast |
| One-on-one | Create / edit meeting | shared page | Meetings | `/v1/both/one-on-one` | any authenticated route | form | toast |

### Organization onboarding wizard

Steps in `OrganizationOnboarding.jsx`: company profile, locations, working days, departments, designations, holidays (links that open leave policy and attendance rules in a new tab), invites, import. **Add First Employee** goes to `/add-employee`. The import step has a skip checkbox and no CSV upload. APIs are `/v1/admin/organization/onboarding/*` and profile update.

---

## 4. Functional modules

| Module | Create | Read | Update | Delete | Special workflows |
|---|---|---|---|---|---|
| Users and access | Add employee assigns a system role | Roster, employee profile | System role, data scope, job title, name | Delete employee | Elevated-role confirm; promote to HR manager `POST /v1/admin/employee/:id/promote-hr-manager`; link Me profile `POST .../link-as-me-profile` (org owner only) |
| Legacy roles | Role hierarchy create | List and assign | Edit | Delete | Does not drive API authorization |
| Org masters | Org structure and onboarding wizard | Chart, catalog | Edit masters | Delete masters | Seed `POST /v1/admin/org-structure/seed`; chart PNG/PDF |
| Organization settings | Onboarding wizard | Profile, settings, branding | Save settings, logo, locale, domain, verification | Delete logo | Employee-ID migration on format change |
| Subscription | Checkout | Plan and usage | Change plan | — | Razorpay webhook is server-side |
| Leave | Employee self-serve apply; admin can act | Org queue, balances, reports | Approve, reject, policy | Policy delete inside leave policy UI | Multi-step workflow can stay pending after first approve; comp-off admin API `/v1/admin/comp-off` |
| Attendance | Punch is self-serve | Today and history | Rules, shifts, regularization decisions | Deactivate a rule | Radius check; WFH toggle in general settings; bulk shift assign |
| Payroll | Generate run, add payslip | Org and per employee | Corrections, adjustments, salary structures, PF/ESI flags | Void | Preview vs final disburse; CSV and PDF export |
| Projects | Add project and work items | List and detail | Status, updates, assignees | Bulk delete is unwired | Export; financial fields only when `canViewFinancials` |
| Approvals | Workflow definitions | Pending and escalated | Approve / reject step | Workflow delete in manager | SLA screens exist and are not routed |
| Documents | Templates, policies | Request queues, versions | Approve requests, edit templates and policies | Soft delete and permanent delete on templates | Modes toggled in document settings |
| Lifecycle | Start joiner/leaver workflows from `/onboarding` | Hubs, reports | Configure templates, offers, clearance, FnF | — | Enterprise hub is admin-gated in `OnboardingRouteWrapper` |
| Calendar and celebrations | Holidays, announcements | Sent announcements, celebration cards | Edit holiday | Delete holiday | Reactions and wishes |
| Engagement, recruitment, learning, benefits, succession, workforce, helpdesk, HR reports | Available because org owner has every permission and the HR portal | HR screens | HR screens | HR screens | Not in the Admin sidebar |
| Audit and review cycles | APIs: `/v1/admin/audit-logs`, `/v1/admin/review-cycle` | Offer letter panel reads one entity’s audit log | Review cycle activate/assign/complete | Delete cycle via API | No Admin screen |

---

## 5. Gaps and problems

### Broken, dead, or duplicate

- **Manage Roles** and **Configure Reports** in `AdminSettings.jsx` have no handler.
- Project bulk delete and bulk status in `ProjectPage.jsx` (`handleBulkAction`) clear the selection and call no API. A comment says the confirm modal and delete call are still to be wired.
- `AdminLayout.jsx` is unused.
- `AccessTab.jsx` is unused. `CalendarManagement1.jsx` and `ProjectPageEnhanced.jsx` are unused copies.
- `SLA/SLAManager.jsx` and `SLAViolations.jsx` are not registered in `routes/index.jsx`.
- Org structure is implemented and its sidebar entry is commented out in `getAdminNavigation`.
- `/add` and `/add-employee` render the same form. `/dashboard-hr` and `/dashboard/hr` (and the same pattern for manager, finance, admin) are duplicates.
- Organization Settings and Admin → General Settings edit the same organization settings.
- Onboarding copy says employees can be imported later from the Employees page. Employees has only Add.
- Dashboard upcoming events are three fixed labels (Today, Tomorrow, Review), not calendar data. Project progress is 0 / 25 / 50 / 100 from status.
- HR dashboard injects a fake “Monthly review sync” when real events are short (`DashboardHR.jsx`). The org owner sees that on the HR portal.

### Loading, empty, and error states

- Dashboard optional widgets fail quietly, so announcements and celebrations can look empty with no error.
- Users & Roles shows a spinner and a toast on load failure.
- General settings shows a spinner only on first load.
- Document management has an explicit empty state when both document modes are off.
- Many older admin tables (payroll, role hierarchy, calendar) use ad hoc empty text. There is no shared empty-state or skeleton component.
- Toggle buttons in General Settings are `<button>` elements without `aria-pressed`.

### Inconsistent UI

- Three visual languages at once: mint `#20C997` on documents and the dashboard, `theme-primary` CSS variables on settings, and blue/indigo gradients on calendar modals.
- Page shells differ: `page-shell` on settings and lifecycle, full-bleed slate on documents, older gray cards on payroll and role hierarchy.
- Naming mixes “Admin”, “HR”, and “Organization” for the same owner (leave policy lives under both `/admin/leave-policy` and a settings tab).
- Tables are a mix of custom HTML and MUI (`EmployeeDetailsPage`, `ProjectPage`).

### Accessibility, responsiveness, performance

- Dashboard, settings tabs, and the org chart have mobile layouts. Calendar gradient buttons and payroll toolbars are dense on small screens.
- Icon-only chart controls mostly have `aria-label`. Many table row actions use `title` only.
- Dashboard loads employees, projects, payrolls, leaves, today’s attendance, announcements, escalations, and celebrations on every visit.
- Client `permissions.js` omits most `lifecycle.*` keys that the server defines, so non-owner nav filtering can disagree with the API. Org owner bypasses this because `isOrgOwner` grants everything.

### Security

- Frontend `canAccess` falls back to legacy role strings when the permission array is empty (`permissions.js`). A stale session can pass a route the API will reject, or the reverse.
- Several Admin routes have `allowedRoles` and no `requiredPermissions`: organization settings, subscription, checkout, policies, approval workflows, document management, ID cards, leave balance, onboarding. Org owner still passes. A JWT `admin` who is not an org owner can be evaluated on the role string alone if permissions have not loaded.
- `requireOrgOwnerOnly` is used for linking the Me profile, not for creating employees. HR Manager has `employee.create`, and the route allows `admin` and `hr`. The dashboard hides Add Employee unless `isOrgOwner`, so the button and the route disagree.
- Role Hierarchy can assign permissions that the API ignores. Users & Roles is the system that matters.
- ID card and “all employee documents” APIs use `canAccessHrDocumentManagement`. An org owner is included there.
- Policies, subscription, and ID cards are weak on the client permission list compared with payroll and employees.
- Org audit log API has no Admin viewer, so sensitive actions are harder to review in the product.
- Password policy text says it is enforced on change. It is not a configurable org policy screen.

### Missing for a modern HRMS admin

- Employee CSV import (promised, not built)
- Org audit-log browser (API exists)
- Review-cycle admin UI (API exists under `/v1/admin/review-cycle`)
- A permission editor that edits the live buckets, with the legacy Role screen retired or clearly labeled
- SLA policies wired to pending approvals
- Scheduled report delivery from Admin (HR has `/admin/reports/*`; settings “Configure Reports” is dead)
- SSO, SCIM, session/device management
- Impersonation with an audit trail
- Bulk employee update beyond shift assignment
- Data export / retention for the whole tenant
- Admin nav entries for recruitment, learning, engagement, and reports, or a clear split so the Admin portal is only governance and the HR portal is operations

---

## 6. Cross-role comparison

Org owner can open every row. “In Admin sidebar” means it is on the Admin portal nav. HR Manager’s bucket is every permission except `executive.dashboard`, so API access is close to the owner’s. The difference is mostly navigation and a few owner-only endpoints.

| Capability | Admin sidebar | HR Manager | HR Executive | Line Manager | Employee |
|---|---|---|---|---|---|
| Admin dashboard | Yes | HR dashboard instead | HR dashboard | Manager dashboard | Own dashboard |
| Org chart | Yes | Yes | Yes | Yes, team scope | No |
| All employees | Yes | Yes | Yes | Direct reports only | Self |
| Add employee | Shortcut is owner-only; route allows HR | Yes | UI is limited; permission set includes `employee.create` | No | No |
| Terminate / delete employee | Yes | Yes (lifecycle helper) | Delete permission is on the executive set | No | No |
| Users & roles (live RBAC) | Yes | Route allows hr with sensitive-edit or org settings | No org settings | No | No |
| Role hierarchy | Yes | Route allows hr | No | No | No |
| Leave queue, all org | Yes | Yes | Yes | Team only | Own requests |
| Approve leave | Yes | Yes, all | Yes, all and team | Team | No |
| Leave policy, calendar, attendance rules | Yes | Yes | No `leave.policy.manage` / `attendance.rule.manage` | No | No |
| Attendance, all org | Yes | Yes | Yes | Team | Self |
| Payroll, all org | Yes | Yes | Sidebar hides it; no payroll process permissions | No | Own payslip |
| Publish payroll | Yes | Yes (`payroll.publish`) | No | No | No |
| Salary structure | Yes | Yes | No | No | No |
| Projects, org-wide | Yes | HR Manager nav hides Projects; route still allows hr | No | Team / member | Own tasks |
| Approval workflow setup | Yes | Yes | No policy permission | Pending inbox only if they can approve | No |
| Document templates and admin queue | Yes | HR queue, not the owner queue | HR queue | Own requests | Own requests |
| Subscription and org profile | Yes | `org.settings.manage` is on the HR manager set | No | No | No |
| Link Me profile | API owner-only | No | No | No | No |
| Recruitment, L&D, engagement admin, benefits, succession, workforce, HR reports | HR portal, not Admin sidebar | Yes | Partial (engagement manage is on the executive set; payroll and projects are not) | Team engagement analytics, team learning | Take surveys, own benefits and learning |
| Executive dashboard | Not in Admin sidebar; owner has the permission | No | No | No | No |

---

## Open questions before Phase 2

1. Confirm Admin means the org-owner portal only, and that SaaS `/platform` operators stay out of this redesign.
2. For Phase 2, should the Admin sidebar stay governance-only (users, org, settings, subscription, approvals), with recruitment, learning, and reports remaining on the HR portal?
3. Should Role Hierarchy be removed from the Admin experience, or rebuilt so it edits the live system roles?

Phase 2 does not start until these are answered and this audit is approved.
