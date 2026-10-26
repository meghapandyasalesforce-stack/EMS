# Employee Role Audit — EMS HRMS

**Phase:** 1 (analysis only — no code changes)  
**Date:** 2026-10-26  
**Method:** Code inspection of `vite_client/` and `server/` (not live UAT)  
**Scope:** Pure Employee / Me portal (`SYSTEM_ROLE_IDS.EMPLOYEE` / bucket `employee`)  
**Out of scope:** Phase 2 redesign (see `docs/employee-phase2-proposal.md`)

> **Note:** `docs/admin-audit.md` does **not** exist in this repo. Closest prior audits: `docs/hr-audit.md`, `docs/HRMS_LAUNCH_AUDIT.md`. Phase 2 should reuse Admin/shared UI patterns from code (`cm-hrms` / shared shells), not a missing admin audit doc.

---

## Executive summary

Employee self-service is a **permission-bucket + session-scoped identity** model: JWT carries `userId` / `role` / `organizationId` (and optional `employeeProfileId`); permissions are recomputed per request, not stored in the token. Most ESS APIs correctly bind to `req.employee._id`. The Me portal home is `/dashboard-employee` with 13 primary nav items.

**Strengths:** Leave, attendance (punch + regularization + WFH), profile, payslips, documents/ID/letters, lifecycle tasks, learning/benefits, engagement, internal jobs, projects, calendar, and 1:1s are implemented with real APIs.

**Critical findings:**

1. **IDOR — High:** `GET /api/v1/employee/leave-encashment/history/:employeeId?` accepts any `employeeId` with no self/HR check (`leaveEncashmentController.js`).
2. **IDOR — High:** `GET /api/v1/both/attendance/:employeeId/export-pdf` is only `isAuthenticated`; loads any employee by ID with **no self, manager, or org check** (`pdfExportController.js`) — possible **cross-tenant** leak if IDs are guessable.
3. **IDOR — Medium:** `GET /api/v1/both/engagement/360-feedback/:employeeId` returns non-anonymous feedback for any org employee (`engagementController.js`).
4. **Privilege oddity:** `EMPLOYEE_PERMS` includes `leave.view.team`, so pure employees can open `/leave-management` via `ROUTE_PERMISSIONS.leaveManagement` even though approve APIs still reject them.
5. **Open manage shells:** `/engagement`, `/helpdesk`, `/onboarding`, `/learning`, `/benefits` use `allowedRoles: []` — URL-reachable; write APIs rely on backend permissions.
6. **Missing modern ESS modules:** No employee expense UI, no My Assets, no Form 16 self-serve, no resignation self-service, no org directory/chart for pure employees, performance APIs without employee UI, helpdesk not in Me nav.
7. **Duplicate / orphan UI:** Multiple leave/attendance/calendar/payroll/onboarding files unwired; document surfaces overlap (`documents-id`, `my-documents`, `document-requests`).
8. **Mobile-first gap:** Dashboard has some responsive/`aria-*` work; many hubs still use wide tables, `window.confirm`/`alert`, and inconsistent empty/error patterns.

**Phase 2 readiness:** Do not redesign until product decides (a) strip `LEAVE_VIEW_TEAM` from employees, (b) fix IDOR endpoints first vs redesign-in-parallel, (c) which missing modules to ship vs defer. See `docs/employee-phase2-proposal.md`.

---

## 1. Permissions — definition and enforcement

### 1.1 How Employee is defined

| Concept | File | Detail |
|---------|------|--------|
| System role | `server/config/systemRole.constants.js` | `EMPLOYEE: 'employee'` — “Self-service portal: punch in/out, apply for leave, view own payroll.” |
| Client mirror | `vite_client/src/utils/systemRoles.js` | Same id |
| Platform role | `server/config/identity.constants.js` | `PLATFORM_ROLES.EMPLOYEE = 'employee'` |
| Permission map | `server/config/permissions.constants.js` | `ROLE_BUCKETS.EMPLOYEE` → `EMPLOYEE_PERMS` |
| Bucket resolution | `server/helpers/permissionService.js` | Every principal gets the employee bucket; pure employees only that + mapped keys |
| Identity attach | `server/helpers/identityService.js` | Adds platform `employee` |

**`EMPLOYEE_PERMS` (12 keys):**

| Permission key | Constant |
|----------------|----------|
| `attendance.punch.self` | `ATTENDANCE_PUNCH_SELF` |
| `leave.apply.self` | `LEAVE_APPLY_SELF` |
| `payroll.view.self` | `PAYROLL_VIEW_SELF` |
| `leave.view.team` | `LEAVE_VIEW_TEAM` ⚠️ anomalous for pure ESS |
| `lifecycle.forms.submit` | `LIFECYCLE_FORMS_SUBMIT` |
| `lifecycle.exit.submit` | `LIFECYCLE_EXIT_SUBMIT` |
| `lifecycle.exit.conduct` | `LIFECYCLE_EXIT_CONDUCT` |
| `lifecycle.letters.view` | `LIFECYCLE_LETTERS_VIEW` |
| `engagement.survey.take` | `ENGAGEMENT_SURVEY_TAKE` |
| `engagement.feedback.submit` | `ENGAGEMENT_FEEDBACK_SUBMIT` |
| `engagement.feedback.anonymous` | `ENGAGEMENT_FEEDBACK_ANONYMOUS` |
| `engagement.recognition.give` | `ENGAGEMENT_RECOGNITION_GIVE` |

Client mirror: `vite_client/src/utils/permissions.js` (lifecycle keys may lag server).

### 1.2 JWT / session claims

| Piece | File |
|-------|------|
| Token mint | `server/helpers/utils.js` — `generateToken(userId, role, organizationId, …, extraClaims)` |
| Login | `server/helpers/unifiedLoginService.js` — `employeeProfileId`, `platformRoles` in extra claims |
| Verify / hydrate | `server/middlewares/authHelpers.js` — employee path: `req.employee._id = decoded.userId` |
| UI permissions | `GET /api/v1/both/auth/permissions` → `permissionsController.js` |

Claims: `userId`, `role` (`admin` \| `employee` \| `platform`), `organizationId`, `passwordChangedAt`, optional `employeeProfileId` / `platformRoles`. **Permissions are not in JWT.**

For workforce login with `role === 'employee'`, JWT `userId` is the **Employee `_id`**.

### 1.3 Backend enforcement (file paths)

| Mechanism | Path | Role |
|-----------|------|------|
| `isAuthenticated` | `server/middlewares/isAuthenticated.js` | Active employee context |
| `isAuthenticatedBoth` | `server/middlewares/isAuthenticatedBoth.js` | Admin or employee |
| `attachAuthContext` / `requireAnyPermission` | `server/middlewares/requirePermission.js` | Permission gates |
| `isEmployeeOnly` / `isAdminOrEmployee` | `server/middlewares/createAuthMiddleware.js` | JWT role allowlists |
| `requireManagerHrOrExecutive` | `requirePermission.js` | Blocks pure employees from team/admin leave/attendance |
| Legacy `requireRole` | `server/middlewares/rbac.js` | Rarely used for ESS |

**No shared `assertSelf` middleware.** Ownership is ad-hoc (`req.employee._id`, local `isSelf` helpers in document/photo/leave-balance/engagement controllers).

Mounts: `server/config/routes.js` — `/api/v1/employee/*`, `/api/v1/both/*`.

### 1.4 Frontend enforcement (file paths)

| Piece | Path |
|-------|------|
| Routes | `vite_client/src/routes/index.jsx` |
| Guard | `vite_client/src/components/ProtectedRoute.jsx` — prefers `requiredPermissions` via `canAccess`; always appends `'employee'` to effectiveRoles |
| PermissionGate | `vite_client/src/components/PermissionGate.jsx` — UI-only |
| Nav | `vite_client/src/utils/navigationConfig.jsx` — `getEmployeeNavigation()`, `resolveMePortalSystemRole` |
| Portal | `vite_client/src/utils/portalConfig.js` — Me portal home `/dashboard-employee` |

### 1.5 Ownership / IDOR

**Generally secure (session-scoped):** leave create/cancel/my-leaves; payroll history/details/download; profile update self routes; clock-in/out; expense self checks; document upload as auth user; most cancel-own flows.

| Severity | Endpoint | Issue |
|----------|----------|--------|
| **High** | `GET /api/v1/employee/leave-encashment/history/:employeeId?` | `employeeId = params \|\| session` — **no self/HR check** (`LeaveEncashmentRoutes.js`, `leaveEncashmentController.js` ~L175) |
| **High** | `GET /api/v1/both/attendance/:employeeId/export-pdf` | Auth only; `Employee.findById` **without org/self check** (`AttendanceRoutes.js` L74–75, `pdfExportController.js`) |
| **Medium** | `GET /api/v1/both/engagement/360-feedback/:employeeId` | Auth both; any org `employeeId` (`EngagementRoutes.js` L108–109) |
| **Low** | Document requests `my` | Query `employeeId` fallback if `req.employee` missing |

**Frontend elevation (not classic IDOR):** Pure employee has `LEAVE_VIEW_TEAM` → `canAccess` grants `/leave-management` UI; approve APIs still need manager/HR perms.

---

## 2. Screen inventory

**Sources:** `vite_client/src/routes/index.jsx`, `getEmployeeNavigation()` in `navigationConfig.jsx`. No `/me/*` prefix — Me portal is role/portal-based.

### 2.1 Me portal primary nav

| Route | Component | Purpose | Layout |
|-------|-----------|---------|--------|
| `/dashboard-employee` (+ `/dashboard/employee`) | `Employee/Dashboard/DashboardEmployee.jsx` | Home: punch, shortcuts, todos, announcements, celebrations | Cards, mini calendar, lists, logout modal |
| `/employee/leave-attendance` (+ `/my-leave`, `/attendance-stats`) | `Employee/LeaveAttendance/LeaveAttendanceHub.jsx` | Leave + attendance + WFH hub | Tabs, heatmap/calendar, tables, modals |
| `/my-attendance-regularization` | `Employee/AttendanceRegularization/MyRegularizationRequests.jsx` | Create/track regularization | Filter tabs, cards, create modal/form |
| `/employee/projects` | `Employee/Project/EmployeeProjects.jsx` | Assigned projects | Cards/list |
| `/employee/projects/:projectId` | `Employee/Project/EmployeeTasks.jsx` | Tasks / daily log / work items | Tabs, forms, lists |
| `/employee/engagement` | `Employee/Engagement/EmployeeEngagementPage.jsx` | Surveys, feedback, recognition | Tabs, forms, tables, modals |
| `/one-on-one` | `OneOnOneRouteWrapper` → Manager page | Organizer 1:1s | Lists, create modal |
| `/1-on-1` | `Employee/OneOnOne/EmployeeOneOnOnePage.jsx` | Invitee 1:1s | Cards, reschedule modal |
| `/employee/benefits-learning` | `Employee/Learning/BenefitsLearningHub.jsx` | Benefits + learning | Toggle tabs, cards |
| `/employee/internal-jobs` | `Employee/Recruitment/InternalJobsPage.jsx` | Jobs / apps / interviews / referrals | Tabs, cards, forms |
| `/employee/internal-jobs/:id` | `InternalJobDetailPage.jsx` | Apply / refer | Detail + forms |
| `/onboarding` | `OnboardingRouteWrapper` → `HR/Onboarding/EmployeeLifecycle.jsx` | Joiner/leaver tasks | Lifecycle tabs, checklists |
| `/employee/documents-id` (+ `/employee/id-card`) | `DocumentsAndId/DocumentsAndIdPage.jsx` | Docs + digital ID | Cards, upload, ID preview, delete modal |
| `/employee/document-requests` | `Documents/DocumentRequestsLanding.jsx` | Letter requests + self-service | Tabs, forms, modals |
| `/employee/calendar` | `Calendar/EmployeeCalendar.jsx` | Holidays + 1:1 events | Full calendar |
| `/employee-payroll` | `Payroll/EmployeePayroll.jsx` | Payslips / breakup | Filters, table, detail modal |

### 2.2 Profile (Header → Profile)

All → `Employee/Profile details/ProfileDetails.jsx` (URL tabs):  
`/profile-details`, `/contact-details`, `/education-qualifications`, `/professional-experience`, `/family-details`, `/job-details`, `/financial-details`, `/profile-security`; `/view-profile` → `ViewProfile.jsx`.

Layouts: tabs, forms, photo modal, password form.

### 2.3 Other Employee-reachable routes (`allowedRoles: []`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/leave` | `Leave/LeaveApplication.jsx` | Apply leave form |
| `/attendance` | `Both/AttendanceDashboard.jsx` | Attendance log/stats |
| `/learning`, `/benefits` | wrappers → BenefitsLearningHub | ESS entry |
| `/learning/courses/:courseId` | `CourseDetailsPage.jsx` | Course player / cert |
| `/benefits/:id` | `HR/Benefits/BenefitDetailPage.jsx` | Plan detail |
| `/engagement`, `/engagement/surveys/:id` | HR Engagement pages | Shared shells |
| `/employee/policies` | `Policies/ViewPolicies.jsx` | Policy ack |
| `/employee/my-documents` | `Documents/MyDocumentsPage.jsx` | Own uploads |
| `/helpdesk` | `HR/Helpdesk/HelpdeskPage.jsx` | Tickets (**not in Me nav**) |
| `/notifications` | `Both/Notifications.jsx` | Inbox |
| `/celebrations`, `/:eventId` | `Both/CelebrationEventPage.jsx` | Wishes / reacts |
| `/daily-report` | `Others/DailyReport.jsx` | Daily report table |
| `/team-learning` | Manager TeamLearning | Open to auth users |

### 2.4 Orphan / unwired Employee files

| File | Notes |
|------|-------|
| `Employee/Onboarding/MyOnboardingPage.jsx` | Not imported by router; `/onboarding` uses `EmployeeLifecycle` |
| `Employee/BuddyDashboard.jsx` | No route |
| `Employee/IdCardView.jsx` | Superseded by `DocumentsAndIdPage` |
| `Employee/EmployeePayroll.jsx` | Duplicate; live route uses `Payroll/EmployeePayroll.jsx` |
| `Employee/Leave/MyLeave.jsx` | Superseded by LeaveAttendanceHub |
| `Employee/Leave/LeaveBalance.jsx` | No route (balance inlined in hub) |
| `Employee/Leave/LeaveEncashment.jsx` | No route |
| `Employee/Attendance/CheckInOut.jsx` | No route (AttendanceBox used instead) |
| `Employee/Attendance/EnhancedAttendanceBox.jsx` | No route |
| `Employee/Attendance/TodaySummary.jsx` | No route |
| `Employee/Attendance/AttendanceStats.jsx` | No route (`/attendance-stats` → hub) |
| `Employee/Calendar/EmployeeCalendar1.jsx` | Unused alternate |
| `Employee/Learning/MyTeamLearningPage.jsx` | No route |
| `Employee/Additional details/GuarantorDetails.jsx` | Not imported by ProfileDetails |
| `Employee/Additional details/NextOfKinDetails.jsx` | Not imported by ProfileDetails |

### 2.5 Module coverage matrix

| Module | Status | Routes / notes |
|--------|--------|----------------|
| Dashboard | Covered | `/dashboard-employee` |
| Profile | Covered | Profile tab routes + `/view-profile` |
| Attendance | Covered | Hub, punch, regularization, WFH |
| Leave | Covered | Hub + `/leave`; encashment unwired |
| Payroll | Covered | `/employee-payroll`; no Form 16 |
| Documents | Covered | Multiple overlapping surfaces |
| Performance | Partial | 1:1s only; goals/review APIs without ESS UI |
| Training | Covered as Learning | Benefits & learning hub + courses |
| Expenses | **Missing** | API only (`/both/expense`) |
| Helpdesk | Route exists, **not in Me nav** | `/helpdesk` |
| Announcements / Directory | Partial | Feed + notifications; no directory/chart for pure employee |
| Onboarding / Offboarding | Covered | `/onboarding`; no self-service resignation |
| Assets | **Missing** | Lifecycle return flags only |

---

## 3. Button and action inventory

**Conventions:** Client paths use `/v1/...` (axios `baseURL` includes `/api`). Ownership is **session/cookie on the backend** unless noted as frontend-only.

### 3.1 Cross-cutting flags

| Issue | Where |
|-------|--------|
| Frontend-only storage | Dashboard Todo (`localStorage`); saved internal jobs |
| Missing confirm | Punch-out; leave/WFH submit; policy ack; helpdesk cancel |
| Silent fail | Notification mark-read; offer-letter ack effect |
| Broken control | `ViewProfile` Download — **no `onClick` / API** |
| Validation inconsistency | Forced reset min **6** chars vs Security change-password min **8**; JobDetails uses `alert` |
| FE-only manage gates | Helpdesk workflow (`canManageTickets`); regularization “team” button |

### 3.2 Dashboard (+ AttendanceBox, Todo, NotificationFeed, PasswordResetPopup)

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| Profile avatar / dropdown | Button / menu | Profile or logout modal | Navigate / local | Logged-in | Logout confirm modal | Logout → `/login` |
| Notifications bell | Link | Inbox | `/notifications` | Frontend | None | N/A |
| Help icon | Button | Helpdesk | `/helpdesk` | Frontend | None | N/A |
| Quick: Apply leave / Regularization / Payslip / Daily report | Buttons | Navigate | Routes | Frontend | None | N/A |
| Celebration wish / react | Buttons | Open event / react | `POST /v1/both/celebrations/events/open`, `.../react` | Self; same-day FE gate | Toast if not today | Toast on error |
| Punch in / out / break | Buttons | Clock | `POST /v1/both/attendance/clock-in\|out`, `break-in\|out` | Session self | Location/WFH rules; **no punch-out confirm** | Toasts |
| Office / Home toggle | Toggle | Punch location | Local + WFH rule | Locked when approved WFH | Blocks office during WFH | Toast |
| Add / edit / delete Todo | Buttons | Local todos | **localStorage only** | Frontend-only | Delete **no confirm** | No toast |
| Mark announcement read | Button | Mark read | `PATCH /v1/both/notification/:id/read` | Session | None | **Silent fail** |
| Reset password (forced) | Submit | New password + logout | `PATCH /v1/employee/auth/reset-password` | Session | Match; min **6** | Inline error; redirect login |

**Load APIs (not buttons):** `GET /v1/both/attendance/get-logs`, `GET /v1/employee/payroll/current`, `GET /v1/employee/leave/get-my-leaves`, project/task + birthday/anniversary endpoints.

### 3.3 Leave & attendance hub + LeaveApplication + WFH

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| Panel tabs | Tabs | Attendance / Leave / Regularization / WFH | Local | Frontend | None | N/A |
| Request regularization | Button | Prefill + navigate | `/my-attendance-regularization` + limits API | Own; FE blocks if `canSubmit` false | Toast if blocked | N/A |
| Export attendance (modals) | Buttons | Client Excel from team history | `GET /v1/both/attendance/team-attendance-history` | Scope all/particular — verify BE | Required scope | Toasts |
| Apply for Leave | Button | Leave form | `/leave` | Frontend | None | N/A |
| Leave type / dates / half-day / reason / file | Form | Apply | `POST .../leave/upload-document`, `create-leave` | Session own | Full validate; **no confirm** | Toast + reset |
| WFH submit | Submit | Create WFH | `POST /v1/both/wfh-requests` | Session | Dates/reason; **no withdraw UI** | Toast |

### 3.4 Regularization

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| New request | Button | Create modal | Limits + form | Own | Toast if blocked | N/A |
| Status filters | Buttons | Filter list | `GET .../attendance-regularization/request` | Own | None | Load error toast |
| Cancel | Button | Cancel pending | `PATCH .../request/:id/cancel` | Own (BE) | `window.confirm` | Toast |
| Submit | Submit | Create | `POST .../request` | Limits + session | Client validate | Toast |
| Team regularization | Button | Manager page | Navigate | **FE role gate** | None | N/A |

### 3.5 Profile suite

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| Tab navigation | Tabs | Section + URL | `navigate(tabPathMap)` | Linked profile | None | N/A |
| Save personal / contact | Submit | Update | `PUT .../profile-details/update-info` | Own | Required fields | Toast |
| Save financial / tax N/A | Submit | Update / request | `PUT .../update-financial-details`; tax regime | Own; N/A → HR | Confirm modal for N/A | Toast |
| Tax declaration | Form | Save | `GET/PUT .../tax-declaration` | Own | Limited checks | Toast |
| Family add/edit | Form | CRUD | `POST/PUT .../family-detail` | Own; max 4 | **No delete UI** | Toast |
| Job doc upload | Button | KYC upload | `POST /v1/both/documents/upload` | Own → HR | `alert` not toast | Alert |
| Education / experience CRUD | Buttons | Records | profile-details academic/experience APIs | Own | Delete `window.confirm` | Toast |
| Photo upload | Button | Photo | `POST /v1/both/profile-photo/:userType/:userId/upload` | Own id | ≤5MB image | Toast |
| Change password | Submit | Stay logged in | `POST /v1/both/auth/change-password` | Session | Min **8** | Toast |
| ViewProfile Download | Button | **Broken** | **None** | — | — | Dead |

### 3.6 Payroll

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| Download payslip | Button | PDF | `GET /v1/employee/payroll/download/:payrollId` | Own (BE) | Toast if missing id | Toast |
| View details | Button | Modal | `GET .../details/:payrollId` | Own | — | Toast |
| View by month / history year / pagination | Controls | Load history | `by-month`, `history`, `current` | Own | — | Toast / loading |

### 3.7 Documents suite

| UI Element | Type | What it does | API / handler | Permission / ownership | Validation / confirmation | Success / error |
|------------|------|--------------|---------------|------------------------|---------------------------|-----------------|
| Preview / Download / Delete / Upload | Buttons | Own + shared docs | `/v1/both/documents/*` | Own uploads | Delete confirm modal | Toast |
| Download ID card PDF / Share | Buttons | Card / share | `GET .../id-cards/.../download`; Web Share | Own card | Warning if no card | Toast |
| Letter request submit / download / delete | Form/buttons | Requests | `/v1/both/employee-document-requests/*` | Own (`requestAsEmployee`) | Purpose required | Toast |
| Self-service preview / generate / download | Buttons | Letter PDF | `/v1/both/self-service-documents/*` | Own | Field validate | Toast |
| Acknowledge policy | Button | Ack | `POST .../policies/employee/acknowledge` | Own | **No confirm** | Toast |

### 3.8 Engagement, learning, jobs, projects, calendar, 1:1, helpdesk

| Screen | Key actions | APIs (summary) | Notes |
|--------|-------------|----------------|-------|
| Engagement ESS | Take survey, feedback, suggestion, recognition, react | `/v1/both/engagement/*` | Weak FE validate; react no success toast |
| Benefits & learning | Enroll, withdraw, dependents, course open | `/v1/both/benefits/*`, `/v1/both/learning/*` | Withdraw `confirm` |
| Course details | Enroll, progress, complete, certificate | learning enrollments | No enroll confirm |
| Internal jobs | Apply, refer, interview feedback, save job | `/v1/both/recruitment/*`; saves in **localStorage** | No apply confirm |
| Projects / tasks | Status, due date, comments, daily log | `/v1/both/project-task/*` | `canEdit` / `canComment` from API |
| Calendar | Month nav, refresh, join meeting | `/v1/employee/calendar/:year`, 1:1 | Toast on fail |
| 1:1 invitee | Accept, decline, reschedule, join | `/v1/both/one-on-one/*` | Decline uses `prompt` |
| Helpdesk | Create, comment, cancel; manage if elevated | `/v1/both/helpdesk/tickets` | Cancel **no confirm**; manage FE-gated |

---

## 4. Employee modules — CRUD, approvals, download

**Shared approval engine:** `approvalWorkflowService` + entity types Leave, Expense, Document, AttendanceRegularization, TaxRegimeChange, lifecycle types. Configurable under `/api/v1/admin/approvals`.

| Module | CRUD (employee) | Submits → Approver | Download / export | Status |
|--------|-----------------|--------------------|-------------------|--------|
| **Dashboard / notifications** | Read feeds; mark read; celebration react | N/A | None | Covered; Todo local-only |
| **Profile** | R/U personal, contact, education, experience, family, bank, tax, photo | Most **direct save**. Tax regime N/A → **HR/Admin**. Job docs → **HR** | Photo, PQ docs | Guarantor/NoK orphaned |
| **Attendance** | Punch, breaks; regularization C/R/cancel; WFH C/R | Regularization → Manager/HR; WFH → Manager/HR/Admin | Attendance PDF (**IDOR**) | No timesheets / shift swap |
| **Leave** | Apply, cancel pending, balance, history; encashment request | Leave → Manager→HR; Encashment → Admin/HR | Leave attachment | Encashment UI **unrouted**; history **IDOR** |
| **Payroll** | Read history/current/details | Tax declaration self; regime N/A → HR | Payslip PDF | **No Form 16** self-serve |
| **Documents** | Upload, view, replace, delete pending; letter request; self-service generate; policy ack; ID card | Uploads/letters → HR/Admin | Downloads, ID PDF, generated letters | Overlapping UIs |
| **Performance** | APIs: goals CRUD, self-assessment (`/both/goal`, `/both/performance-review`) | Manager eval on admin paths | None ESS | **No employee Performance UI** |
| **Training / learning** | Enroll, progress, certificate | Catalog admin-managed | Certificate download | Covered in hub |
| **Expenses** | API: C/R/U/D own (`/both/expense`) | Admin (+ workflow) | None ESS | **No employee expense route/nav** |
| **Helpdesk / grievances** | Create, comment, cancel own | Resolve → HR/Admin/Exec | Attachments | Not in Me nav; no separate grievance channel |
| **Announcements / directory / chart** | Read announcements via notifications | Create = admin/HR | — | **No directory/chart for pure employee** |
| **Onboarding / offboarding** | Complete assigned tasks, forms, acks | Offboarding **started by HR** | Lifecycle letters | **No self-service resignation** |
| **Assets** | Update return flags on lifecycle only | — | — | **No My Assets inventory** |

### Approval cheat sheet

| Request | Typical approver |
|---------|------------------|
| Leave | Manager → HR (workflow); HR applicant → Admin |
| Attendance regularization | Manager / designated; HR/Admin |
| WFH | Manager / HR / Admin |
| Comp-off | Admin / HR / Executive |
| Leave encashment | Admin / HR / Executive |
| Expense | Admin (+ workflow) |
| Document upload | HR |
| Letter / doc request | HR and/or Admin |
| Tax regime N/A | HR / Admin / Executive |
| Benefit enrollment | HR (Pending → Active) |
| Helpdesk resolve | HR / Admin / Executive |
| Offboarding start | HR / Admin (not employee) |

### Primary route file index

| Path under `server/routes/` | Mount |
|----------------------------|-------|
| `Employee/*.js` | `/api/v1/employee/*` |
| `Both/Attendance*.js`, `Wfh*`, `CompOff*` | `/api/v1/both/...` |
| `Both/DocumentRoutes.js` + `employeeDocumentRequestRoutes.js` + `selfServiceDocumentRoutes.js` | documents |
| `Both/ExpenseRoutes.js`, `HelpdeskRoutes.js`, `GoalRoutes.js`, `Performance*.js`, `Learning*.js`, `EngagementRoutes.js`, `BenefitsRoutes.js`, `OneOnOneRoutes.js`, `RecruitmentRoutes.js`, `TaskRoutes.js` | shared modules |
| `Both/Lifecycle*.js`, `OnboardingRoutes.js` | lifecycle |
| `Organization/PolicyRoutes.js` | policy ack |

---

## 5. Gaps and problems

### 5.1 Security / permissions

- Three IDOR endpoints (encashment history, attendance PDF, 360 feedback).
- `LEAVE_VIEW_TEAM` on employees opens Leave Management shell.
- Many manage screens `allowedRoles: []` (frontend-only gate + API 403).
- No shared backend `assertSelf` helper — easy to regress ownership.
- Attendance PDF lacks org scoping (cross-tenant risk).

### 5.2 Broken / duplicate / orphan

- `ViewProfile` Download dead.
- Orphan leave/attendance/onboarding/payroll/calendar components.
- Document triad: `documents-id` / `my-documents` / `document-requests`.
- Alias routes (`/my-leave`, `/attendance-stats`) add IA noise.

### 5.3 Validation / UX states

- Password min length 6 vs 8.
- Mix of toast / `alert` / `window.confirm` / silent fail.
- Payroll has solid loading/error; NotificationFeed and several lists fail soft or silent.
- WFH list has no withdraw action.

### 5.4 Accessibility & mobile

- Dashboard: some `aria-label`s and `sm:`/`md:` grids — better than average.
- Leave/attendance hubs and shared Helpdesk/Engagement: wide tables, icon actions without consistent labels, confirm dialogs not accessible modals.
- Mobile is primary for ESS but several flows still desktop-table-first.

### 5.5 Sensitive data exposure

- Attendance PDF and encashment history can expose **other employees’** attendance / encashment amounts.
- 360 endpoint exposes others’ non-anonymous feedback.
- Profile/bank edits are direct — no approval for sensitive PII (product risk, not IDOR).

### 5.6 Missing modern ESS expectations

Form 16 / tax doc center; timesheets; My Assets; resignation + FnF status; org directory; performance/OKR UI; expense reimbursements UI; confidential grievances; shift preference/swap; payslip bulk export; profile change-request workflow for bank/address.

---

## 6. Overlap with other roles

### 6.1 Shared screens / components

| Surface | Shared with |
|---------|-------------|
| Leave & attendance hub, My payroll, documents ESS, engagement ESS, calendar, internal jobs, benefits/learning, onboarding lifecycle shell | Manager / HR (also have ESS entries in their nav) |
| `/helpdesk`, `/engagement`, `/onboarding` | Any auth user (open routes) |
| One-on-one | Manager organizer page vs Employee invitee page |
| Benefits detail, Survey detail | HR components with ESS wrappers |

### 6.2 Employee can do things they shouldn’t (or shouldn’t see)

| Risk | Detail |
|------|--------|
| Leave Management UI | Via `LEAVE_VIEW_TEAM` |
| HR Engagement hub URL | `/engagement` open |
| Attendance PDF / encashment / 360 of others | IDOR |
| Team attendance history / export controls in hub | Calls team APIs — verify backend scoping for pure employees |
| Helpdesk manage controls | Shown if FE thinks user is HR (usually not for pure employee) |
| Direct bank/PII edit | No HR gate (policy choice) |

### 6.3 Employee cannot do things they should

| Gap | Detail |
|-----|--------|
| Helpdesk discoverability | Exists; not in Me sidebar |
| Expenses | API only |
| Form 16 | Admin statutory only |
| My Assets | Missing |
| Resign | HR-initiated only |
| Directory / org chart | Manager+ only |
| Performance self-review UI | APIs without routes |
| Leave encashment UI | Component unwired |
| Cancel WFH | No UI |
| Guarantor / Next of kin | Components unwired |

Managers/HR/Admin keep approve-all / view-all / process payroll / org settings — correctly **not** in `EMPLOYEE_PERMS` (except the `leave.view.team` mistake).

---

## 7. Source index

| Area | Path |
|------|------|
| Employee perms | `server/config/permissions.constants.js` (`EMPLOYEE_PERMS`) |
| System role | `server/config/systemRole.constants.js` |
| JWT / login | `server/helpers/utils.js`, `unifiedLoginService.js` |
| Middleware | `requirePermission.js`, `isAuthenticated.js`, `createAuthMiddleware.js`, `authHelpers.js` |
| Employee APIs | `server/routes/Employee/*`, `server/routes/Both/*` |
| Client routes / guard | `vite_client/src/routes/index.jsx`, `ProtectedRoute.jsx` |
| Me nav | `navigationConfig.jsx` → `getEmployeeNavigation()` |
| Employee UI root | `vite_client/src/Employee/**` |
| Prior audits | `docs/hr-audit.md`, `docs/HRMS_LAUNCH_AUDIT.md` |
| Phase 2 proposal | `docs/employee-phase2-proposal.md` |
| Missing | `docs/admin-audit.md` |

---

## 8. Recommended Phase 2 inputs

1. **Security first:** Fix attendance PDF, encashment history, and 360 feedback ownership; add shared `assertSelfOrElevated` middleware; remove `LEAVE_VIEW_TEAM` from `EMPLOYEE_PERMS` (or gate leave-management on approve/view-all only).
2. **IA:** Mobile-first Me nav — promote Helpdesk + Notifications; collapse document surfaces; wire or delete orphans (encashment, NoK, Guarantor).
3. **Module backlog:** Expenses UI, Form 16 download, My Assets, resignation request, directory (read-only), performance self-serve — prioritize in proposal decisions.
4. **Reuse:** Extend Admin/shared design system and ESS patterns; do not fork Admin screens.
5. **Enforce:** `requiredPermissions` on every non-ESS route; backend remains source of truth for ownership.

---

*End of Phase 1 audit. Phase 2 proposal: `docs/employee-phase2-proposal.md`.*
