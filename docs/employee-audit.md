# Employee role audit

Phase 1 analysis only. No application code was changed. Phase 2 (redesign) is not started.

**Date:** 2026-11-10  
**Method:** Code inspection of `vite_client/` and `server/` (not a live click-through).  
**Scope:** The pure Employee system role (`SYSTEM_ROLE_IDS.EMPLOYEE`, permission bucket `employee`) and every screen that role can open.  
**Out of scope:** Redesign, and changes to Admin, HR, Manager, or other roles.

---

## Executive summary

A pure Employee logs in with JWT role `employee` and the `employee` permission bucket. The product description of that role is self-service: punch in and out, apply for leave, and view own payroll (`server/config/systemRole.constants.js`). The live Me sidebar is `getEmployeeNavigation()` in `vite_client/src/utils/navigationConfig.jsx`. The shell is `vite_client/src/Shared/Header.jsx` with `MePortalShell` and `SidebarNavList`.

What works: leave, attendance (punch, regularization, WFH, comp-off), profile, payslips, documents and ID, lifecycle tasks, learning and benefits, engagement, internal jobs, own projects, calendar, celebrations, and 1:1s. Those screens call real APIs. Most self-service writes are bound to the signed-in employee.

Highest-impact problems:

- `GET /api/v1/employee/leave-encashment/history/:employeeId?` accepts any employee id. The controller uses the param when it is present and does not check that it is the caller (`server/routes/Employee/LeaveEncashmentRoutes.js`, `server/controllers/leave/leaveEncashmentController.js`).
- `GET /api/v1/both/attendance/:employeeId/export-pdf` is only `isAuthenticated`. It loads the employee by id with no self, manager, or organization check (`server/routes/Both/AttendanceRoutes.js`, `server/controllers/admin/pdfExportController.js`).
- `GET /api/v1/both/engagement/360-feedback/:employeeId` returns non-anonymous feedback for any employee in the organization (`server/routes/Both/EngagementRoutes.js`, `get360Feedback` in `server/controllers/engagement/engagementController.js`).
- `EMPLOYEE_PERMS` includes `leave.view.team`. `canAccess` grants a route when any required permission matches, so a pure Employee can open `/leave-management` and `/dashboard-manager` by URL (`vite_client/src/utils/permissions.js`).
- Several manage screens use `allowedRoles: []`: `/engagement`, `/helpdesk` (including resolve), `/one-on-one` (the manager scheduler), `/benefits/:id`, `/team-learning`, `/learning`, `/attendance`.
- The employee attendance hub calls `GET /v1/both/attendance/team-attendance-history`, which the server limits to admin, manager, or HR. A pure Employee can see an error instead of their own log.
- Recognition’s coworker picker calls `GET /v1/employee/auth/get-all-employees` (`employee.view.all` or `employee.view.team`), then falls back to `GET /v1/employee`, which returns only self for a non-manager.
- Dead or unused UI: the Projects notification bell has no handler; View Profile **Download** has no `onClick`; `ProfileSidebar.jsx` is never imported; several attendance, calendar, payroll, and leave files are not mounted by the router.

---

## 1. Role and permission discovery

Four role systems overlap. A person can match more than one.

| Layer | Values | Where |
|---|---|---|
| JWT / login role | `admin`, `employee`, `platform` | `server/config/identity.constants.js`, `server/middlewares/authHelpers.js` |
| System roles (Add Employee / Users & Roles) | `employee`, `hr_executive`, `hr_manager`, `payroll_admin`, `line_manager`, `project_manager`, `executive` | `server/config/systemRole.constants.js`, assigned in `server/helpers/systemRoleService.js` |
| Permission buckets | `org_owner`, `hr_manager`, `hr_executive`, `payroll_admin`, `line_manager`, `project_manager`, `executive`, `employee` | `ROLE_BUCKETS` and `ROLE_PERMISSION_MAP` in `server/config/permissions.constants.js`; resolved in `server/helpers/permissionService.js` |
| Platform roles on the User | `org_owner`, `hr_admin`, `hr_executive`, `payroll_admin`, `manager`, `employee` | `PLATFORM_ROLES` in `server/config/identity.constants.js` |
| SaaS operators (not org employees) | `platform_super_admin`, `platform_saas_admin`, `platform_support`, `platform_readonly`, `platform_operator` | Same identity file. UI under `vite_client/src/Platform/` |
| Functional roles on the employee | `hr`, `manager`, `project_manager`, `finance`, `executive`, and leadership titles | `server/helpers/functionalRolesHelper.js`, `server/helpers/permissionService.js` |
| Legacy Role documents | Modules `dashboard`, `employees`, `attendance`, `payroll`, `leave`, `projects`, `notifications`, `reports`, `settings`, `calendar` with actions `read`, `write`, `delete`, `approve`, `export`, `import` | `server/models/role.model.js`, older middleware `server/middlewares/rbac.js` |

Every principal also receives the `employee` bucket. `resolveRoleBuckets` starts with that set (`server/helpers/permissionService.js`). A pure Employee’s keys are `EMPLOYEE_PERMS` in `server/config/permissions.constants.js`:

| Permission | Constant |
|---|---|
| `attendance.punch.self` | `ATTENDANCE_PUNCH_SELF` |
| `leave.apply.self` | `LEAVE_APPLY_SELF` |
| `payroll.view.self` | `PAYROLL_VIEW_SELF` |
| `leave.view.team` | `LEAVE_VIEW_TEAM` |
| `lifecycle.forms.submit` | `LIFECYCLE_FORMS_SUBMIT` |
| `lifecycle.exit.submit` | `LIFECYCLE_EXIT_SUBMIT` |
| `lifecycle.exit.conduct` | `LIFECYCLE_EXIT_CONDUCT` |
| `lifecycle.letters.view` | `LIFECYCLE_LETTERS_VIEW` |
| `engagement.survey.take` | `ENGAGEMENT_SURVEY_TAKE` |
| `engagement.feedback.submit` | `ENGAGEMENT_FEEDBACK_SUBMIT` |
| `engagement.feedback.anonymous` | `ENGAGEMENT_FEEDBACK_ANONYMOUS` |
| `engagement.recognition.give` | `ENGAGEMENT_RECOGNITION_GIVE` |

`leave.view.team` and `lifecycle.exit.conduct` are wider than the role description. The client mirror is `vite_client/src/utils/permissions.js`. Lifecycle keys on the client lag the server list.

The Employee system-role definition sets `functionalRoles: []` and `platformRoles: ['employee']` (`server/config/systemRole.constants.js`). Job title and department still change navigation when no portal is selected (`isHR`, `isManager`, `isFinance`, `isTech` in `navigationConfig.jsx`). The Me portal forces employee navigation for every system role (`getNavigationForMePortal`).

### Where role checks live

| Piece | Path |
|---|---|
| Route table | `vite_client/src/routes/index.jsx` |
| Route guard | `vite_client/src/components/ProtectedRoute.jsx` |
| Access helper | `canAccess` in `vite_client/src/utils/permissions.js` |
| Sidebar | `getEmployeeNavigation()` in `vite_client/src/utils/navigationConfig.jsx` |
| Nav groups | `vite_client/src/utils/navGrouping.js` |
| Portal home | `vite_client/src/utils/portalConfig.js` — Employee home `/dashboard-employee` |
| Permission API | `server/controllers/auth/permissionsController.js` |
| Backend permission middleware | `server/middlewares/requirePermission.js` |
| Session attach | `server/middlewares/isAuthenticated.js`, `isAuthenticatedBoth.js`, `server/middlewares/authHelpers.js` |
| Feature flags | `requireFeature` and `server/constants/saasFeatures.js` |
| Older module RBAC | `server/middlewares/rbac.js` (assigned `Role`, not the bucket map) |
| Route mounts | `server/config/routes.js` |

`canAccess` ignores `allowedRoles` once the permission list is loaded and any required permission matches. That is why `leave.view.team` opens `/leave-management` (`ROUTE_PERMISSIONS.leaveManagement`) and `/dashboard-manager` (`ROUTE_PERMISSIONS.managerDashboard`).

There is no shared “this id must be me” middleware. Ownership is checked inside individual controllers.

---

## 2. Employee screen inventory

Global chrome: left sidebar from `getEmployeeNavigation()`, header with profile menu and a logout confirmation (`Header.jsx`, `ProfileDropdown.jsx`). Leave & attendance, Regularization, and Comp-Off collapse into a **Leave & WFH** group when two or more of those paths are present (`navGrouping.js`).

### 2.1 Sidebar

| Route | Component | Purpose | Layout |
|---|---|---|---|
| `/dashboard-employee`, `/dashboard/employee` | `vite_client/src/Employee/Dashboard/DashboardEmployee.jsx` | Home: punch, celebrations, todos, notifications, shortcuts | Header, attendance card, celebration rail, stat cards, project list, quick links, quick actions. Also mounts `Todo`, `AttendanceBox`, `NotificationFeed`, `PasswordResetPopup` |
| `/employee/leave-attendance`, `/my-leave`, `/attendance-stats` | `vite_client/src/Employee/LeaveAttendance/LeaveAttendanceHub.jsx` | Own leave and attendance | Tabs: Attendance log, Leave summary, Regularization history, Work From Home. Calendar, tables, apply-leave entry |
| `/my-attendance-regularization` | `vite_client/src/Employee/AttendanceRegularization/MyRegularizationRequests.jsx` | Own regularization | Status filters, request list, create modal. Embeds `WfhRequestPanel` |
| `/my-comp-off` | `vite_client/src/Employee/Attendance/MyCompOffRequests.jsx` | Request and cancel comp-off | Form and request list |
| `/employee/projects` | `vite_client/src/Employee/Project/EmployeeProjects.jsx` | Projects the employee is on | Local header, filter chips, project cards |
| `/employee/projects/:projectId` | `vite_client/src/Employee/Project/EmployeeTasks.jsx` | Tasks and work items | Task list, status updates, comments. Uses `EmployeeWorkPlanSection.jsx` |
| `/employee/engagement` | `vite_client/src/Employee/Engagement/EmployeeEngagementPage.jsx` | Surveys, feedback, recognition | Tabs, tables, activity and celebration panels, modals |
| `/one-on-one` | `vite_client/src/components/OneOnOneRouteWrapper.jsx` → `Manager/OneOnOne/OneOnOnePage` | Schedule 1:1s | Wrapper comment says any signed-in user can schedule |
| `/1-on-1` | `vite_client/src/Employee/OneOnOne/EmployeeOneOnOnePage.jsx` | Invitations and notes | List, accept/decline, `MeetingNotesPanel` |
| `/employee/benefits-learning`, `/benefits`, `/learning` | `vite_client/src/Employee/Learning/BenefitsLearningHub.jsx` via route wrappers | Benefits enrollment and courses | Benefits / Learning tabs, course filters |
| `/learning/courses/:courseId` | `vite_client/src/Employee/Learning/CourseDetailsPage.jsx` | Course player | Progress, complete, `YouTubeProgressPlayer`, `CertificateModal` |
| `/employee/internal-jobs` | `vite_client/src/Employee/Recruitment/InternalJobsPage.jsx` | Jobs, applications, referrals, interviews | Tabs: Open Jobs, My Interviews, My Applications, My Referrals. **Request a Hire** is inserted only when the user can hire |
| `/employee/internal-jobs/:id` | `vite_client/src/Employee/Recruitment/InternalJobDetailPage.jsx` | Apply or refer | Detail and forms |
| `/onboarding` | `vite_client/src/components/OnboardingRouteWrapper.jsx` → `HR/Onboarding/EmployeeLifecycle` | Own join and leave workflow | Tasks, checklists, policies, buddy, background verification, exit tasks. `?configure=1`, `?reports=1`, and `?enterprise=1` redirect back when the user is not HR or admin |
| `/employee/documents-id`, `/employee/id-card` | `vite_client/src/Employee/DocumentsAndId/DocumentsAndIdPage.jsx` | Personal docs, company docs, digital ID | Cards, tables, preview, upload, delete confirm |
| `/employee/calendar` | `vite_client/src/Employee/Calendar/EmployeeCalendar.jsx` | Leave, holidays, 1:1s | Calendar |
| `/employee-payroll` | `vite_client/src/Employee/Payroll/EmployeePayroll.jsx` | Own payslips | Featured payslip, month picker, history table |
| `/profile-details` and sibling paths | `vite_client/src/Employee/Profile details/ProfileDetails.jsx` | Profile editor | Tabs listed below. Photo upload and completion meter |

Profile tabs and URLs (`ProfileDetails.jsx`):

| Tab | Route |
|---|---|
| Personal Details | `/profile-details` |
| Contact Details | `/contact-details` |
| Education Qualifications | `/education-qualifications` |
| Professional Experience | `/professional-experience` |
| Family Details | `/family-details` |
| Documents | `/job-details` |
| Financial Details | `/financial-details` |
| Security | `/profile-security` |

`/view-profile` renders `vite_client/src/Employee/Profile details/ViewProfile.jsx` (read-only, separate from the tabbed editor).

### 2.2 Reachable by URL, not on the Employee sidebar

These routes set `allowedRoles: []` in `vite_client/src/routes/index.jsx`, so any signed-in user can open them when the SaaS feature is on.

| Route | Component | Purpose |
|---|---|---|
| `/leave` | `Employee/Leave/LeaveApplication.jsx` | Standalone leave form. The sidebar target is the hub |
| `/attendance` | `Both/AttendanceDashboard.jsx` | Older attendance view |
| `/employee/my-documents` | `Employee/Documents/MyDocumentsPage.jsx` | Own uploads: upload, replace, patch, delete |
| `/employee/document-requests` | `Employee/Documents/DocumentRequestsLanding.jsx` | Letter requests. Loads mode settings, then `EmployeeDocumentRequests.jsx` and/or `SelfServiceDocuments.jsx` |
| `/employee/policies` | `Employee/Policies/ViewPolicies.jsx` | Read and acknowledge policies. Linked from the dashboard |
| `/benefits/:id` | `HR/Benefits/BenefitDetailPage.jsx` | Benefit plan detail |
| `/engagement`, `/engagement/surveys/:surveyId` | `HR/Engagement/EngagementPage.jsx`, `SurveyDetailPage.jsx` | HR engagement UI |
| `/team-learning` | `Manager/TeamLearning/TeamLearningPage` | Team learning |
| `/helpdesk` | `HR/Helpdesk/HelpdeskPage` | Tickets. Create, comment, update, and resolve are on `server/routes/Both/HelpdeskRoutes.js` for any authenticated user. Analytics is admin, HR, or executive |
| `/notifications` | `Both/Notifications` | Inbox. Linked from the dashboard |
| `/celebrations`, `/celebrations/:eventId` | `Both/CelebrationEventPage` | Birthday and anniversary wishes |
| `/daily-report` | `Others/DailyReport.jsx` | Daily report. Linked from the dashboard |

### 2.3 Files that exist and are not mounted

| File | Note |
|---|---|
| `Employee/ProfileSidebar.jsx` | Never imported. Profile uses in-page tabs |
| `Employee/IdCardView.jsx` | Superseded by `DocumentsAndIdPage` |
| `Employee/BuddyDashboard.jsx` | No route |
| `Employee/Onboarding/MyOnboardingPage.jsx` | `/onboarding` uses `EmployeeLifecycle` |
| `Employee/EmployeePayroll.jsx` | Duplicate. Live route uses `Employee/Payroll/EmployeePayroll.jsx` |
| `Employee/Leave/MyLeave.jsx`, `LeaveBalance.jsx`, `LeaveEncashment.jsx` | Not routed. Encashment API still exists |
| `Employee/Attendance/CheckInOut.jsx`, `EnhancedAttendanceBox.jsx`, `AttendanceStats.jsx`, `TodaySummary.jsx` | Not routed. Dashboard uses `AttendanceBox.jsx` |
| `Employee/Calendar/EmployeeCalendar1.jsx` | Unused alternate |
| `Employee/Learning/MyTeamLearningPage.jsx` | No route. `/team-learning` uses the manager page |
| `Employee/Additional details/GuarantorDetails.jsx`, `NextOfKinDetails.jsx` | Not imported by `ProfileDetails` |

---

## 3. Button and action inventory

Client calls use `/v1/...` because the axios base URL already includes `/api`. “Signed-in” means the route has `allowedRoles: []` and no `requiredPermissions`. Backend ownership is the session employee unless the row says otherwise.

### 3.1 Dashboard

File: `vite_client/src/Employee/Dashboard/DashboardEmployee.jsx`, plus `AttendanceBox.jsx`, `Todo.jsx`, `NotificationFeed.jsx`, `PasswordResetPopup.jsx`.

| UI element | Type | What it does | API / handler | Permission | Confirmation or validation | Success / error |
|---|---|---|---|---|---|---|
| Punch in / out, break, Office/Home | Button, toggle | Records attendance. Home punch needs approved WFH. Location is required when the org rule says so | `POST /v1/both/attendance/clock-in`, `break-in`, `break-out`, `clock-out` | `isAuthenticated` and the attendance feature | Shift window, holiday, WFH approval in `AttendanceBox.jsx`. No punch-out confirm | Toast, or rule text that blocks the punch |
| Celebration react / wishes / View all | Button, link | Reacts or opens the event | `POST /v1/both/celebration-events/events/:id/react` and `.../wish` | Signed-in | Same-day gate on some wish actions | Navigates to `/celebrations/:eventId`. Toast on error |
| Notifications bell | Link | Opens the inbox | Notification feed `GET` | Signed-in | None | `/notifications` |
| Helpdesk icon and quick link | Button | Opens helpdesk | None on click | Signed-in | None | `/helpdesk` |
| Edit profile / profile name | Button | Opens the profile editor | None | Signed-in | None | `/profile-details` |
| Apply leave | Button | Opens the hub, not the form | None | Signed-in | None | `/employee/leave-attendance` |
| Regularization, Daily report, 1:1, Benefits, Learning, Payroll, Documents, Policies | Button | Navigation only | None | Signed-in | None | Matching routes |
| Project card | Button | Opens that project | List from `GET /v1/both/tasks/get-my-projects` | Signed-in | None | `/employee/projects/:id` |
| Add / edit / delete todo | Button | Local todos | `localStorage` in `Todo.jsx` | Browser only | Delete has no confirm | No server toast |
| Mark announcement read | Button | Marks one notification read | `PATCH /v1/both/notification/:id/read` | Signed-in | None | Failures can be silent |
| Logout | Button | Ends the session | `POST /v1/employee/auth/logout` | Signed-in | “Are you sure you want to logout?” | Redirect to login |
| Forced password reset | Submit | Sets a new password and logs out | `PATCH /v1/employee/auth/reset-password` | Signed-in, login rate limit | Match check. Minimum length here is 6; the Security tab uses 8 | Inline error, then `/login` |

Load calls that are not buttons: `GET /v1/both/attendance/get-logs`, `GET /v1/employee/payroll/current`, `GET /v1/employee/leave/get-my-leaves`, tasks, birthdays, anniversaries, projects.

### 3.2 Leave, attendance, regularization, WFH, comp-off

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation or validation | Success / error |
|---|---|---|---|---|---|---|---|
| Leave hub | Attendance log / Leave summary / Regularization history / WFH | Tabs | Switches panels | Attendance log calls `GET /v1/both/attendance/team-attendance-history` | That route is `isAdminOrManagerOrHRAuthenticated` | None | A pure Employee can get 403 on their own log |
| Leave hub | Apply for Leave | Button | Opens the leave form | In-page copy: manager, then HR | `leave.apply.self` on create | None on the button | Balance text says it updates only after HR approval |
| Leave form | Submit | Submit | Creates leave | `POST /v1/employee/leave/create-leave` | `isAuthenticated` | Name, email, dates. Sick leave over 1 day in a month needs a certificate | `toast.success` / `toast.error` |
| Leave form | Upload document | File | Attaches proof | `POST /v1/employee/leave/upload-document` | Signed-in | Required only when the sick-leave rule trips | 400 message from the API |
| My leave | Cancel | Button | Cancels own request | `PUT /v1/employee/leave/cancel/:id` | Signed-in | Pending-only should be enforced on the server | API message |
| Regularization | New Request | Button | Opens the create modal | `POST /v1/both/attendance-regularization/request` | Signed-in. UI checks `limits.canSubmit` | Disabled, with a warning toast, when the monthly limit is hit | Toast |
| Regularization | Cancel | Button | Withdraws a pending request | `PATCH .../request/:id/cancel` | Signed-in, own request | `window.confirm` | Toast, list refresh |
| Regularization | Status filters | Toggle | Filters the list | `GET .../attendance-regularization/request` | Signed-in | None | Empty list, or a load error toast |
| Regularization | Team Requests | Button | Shown only if `canAccessTeamRegularization` | Navigates to the manager page | Manager or HR style check | Hidden for a pure Employee | `/attendance-regularization` |
| WFH panel | Submit | Submit | Creates a WFH request | `POST` under `/v1/both/wfh-requests` | Signed-in | Dates checked against the calendar | Toast. No withdraw control in the employee list |
| Comp-off | Submit | Submit | Requests comp-off | `POST /v1/both/comp-off/request` | Signed-in | Date must be a worked non-working day (UI loads logs, calendar, and the rule) | Toast |
| Comp-off | Cancel | Button | Cancels own request | `DELETE /v1/both/comp-off/cancel/:id` | Signed-in | None beyond the click | List refresh |

`LeaveEncashment.jsx` can request encashment (`POST /v1/employee/leave-encashment/request`) and read history, but the component has no route.

### 3.3 Projects and daily report

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation or validation | Success / error |
|---|---|---|---|---|---|---|---|
| Projects | Status chips | Toggle | Filters cards | `GET /v1/both/tasks/get-my-projects` | Signed-in | None | Client-side filter |
| Projects | Notifications bell | Button | Nothing. No `onClick` (`EmployeeProjects.jsx`) | None | n/a | n/a | Dead control |
| Tasks | Status change | Button or dropdown | Updates a task | `PUT /v1/both/tasks/task-status/:taskId` and `PUT /v1/both/tasks/work-items/:id` | Signed-in. Edit rights come back from the API | Status values from the UI | Toast or inline error |
| Tasks | Comment | Submit | Adds a comment | `POST /v1/both/tasks/work-items/:id/comments` | Signed-in | Empty comment should be blocked in the form | Toast |
| Daily report | Submit / rows | Form | Daily report | `Others/DailyReport.jsx` | Signed-in | Field checks in that page | Toast |

`POST /v1/both/tasks/create-task` exists for a “today” task. It is not a project-admin action. `project.admin.view` is not on the employee bucket.

### 3.4 Engagement, 1:1, learning, jobs

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation or validation | Success / error |
|---|---|---|---|---|---|---|---|
| Engagement | Surveys / Feedback / Recognition | Tabs | Switches panels | `GET /v1/both/engagement/my-surveys`, `feedback`, `recognition`, `activity`, `celebrations`, `settings` | Write routes use survey-take, feedback-submit, or recognition-give. Several GETs are only `isAuthenticatedBoth` | None | Falls back to `GET /surveys?limit=500` if my-surveys fails |
| Engagement | Submit survey | Submit | Sends answers | Survey response `POST` | `engagement.survey.take` | Required questions | Toast |
| Engagement | Submit feedback | Submit | Creates feedback, including anonymous when allowed | `POST /v1/both/engagement/feedback` | `engagement.feedback.submit` | Form fields | Toast |
| Engagement | Give recognition | Submit | Recognizes a colleague | `POST /v1/both/engagement/recognition` | `engagement.recognition.give` | Needs a recipient. Picker calls `get-all-employees`, then `GET /v1/employee` (self only) | Toast. Picker can be empty or self-only |
| Engagement | React | Button | Adds a reaction | Recognition react `POST` | Recognition give | None | Often no success toast |
| My 1:1 | Accept / Decline | Button | Responds to an invite | `PATCH /v1/both/one-on-one/one-on-ones/...` | Signed-in | Decline uses a prompt | Status text updates |
| My 1:1 | Notes | Button | Opens `MeetingNotesPanel` | Patch on the meeting | Signed-in | None | Inline save |
| My 1:1 | Meeting Management | Button | Leaves the employee page | None | Signed-in | None | `/one-on-one`, which loads the manager scheduler |
| Benefits | Benefits / Learning | Tabs | Switches modules | `GET /v1/both/benefits/benefit-plans`, `/benefits`, `/v1/both/learning/courses`, `/enrollments` | Signed-in | None | Empty states inside the hub |
| Benefits | Enroll / Cancel | Button | Joins or withdraws | `PUT /v1/both/benefits/benefits/:id/...` and enroll `POST` | Signed-in | Withdraw uses `confirm` | Toast “Enrollment request withdrawn” |
| Learning | Status filters | Toggle | All, Not Started, In Progress, Completed, Overdue | Client filter | Signed-in | None | Counts on the chips |
| Course | Enroll / progress / complete | Button | Updates enrollment | `POST`/`PATCH` `/v1/both/learning/...`. Also `GET /v1/admin/learning/courses/:id` | Signed-in on both-routes. The admin course GET can 403 | Progress bounds | Toast |
| Course | Certificate | Modal | Shows or downloads the certificate | Certificate `GET` in `CertificateModal.jsx` | Signed-in | Only after completion | Modal |
| Internal jobs | Open Jobs / Interviews / Applications / Referrals | Tabs | Switches lists | `GET /v1/both/recruitment/internal-jobs`, `my-applications`, `my-referrals`, `my-interviews` | Signed-in | None | Empty lists. Saved jobs can stay in `localStorage` |
| Job detail | Apply / Refer | Submit | Applies or refers | `POST` on the internal job and referral routes | Signed-in | Required application fields. No extra confirm | Toast |
| Interviews | Submit feedback | Button | Submits feedback when the user is an interviewer | `PUT` interview feedback | Server `interviewFeedbackAccess` | Required ratings | “Needs Feedback” vs “Completed” |
| Hire tab | Save / Submit | Button | Creates and submits a requisition | `POST /v1/both/recruitment/requisitions`, `POST .../submit` | Tab is inserted only for hiring-capable users. The API must not trust the client | None beyond the form | “Submitted to HR”, or `toast.error` |

### 3.5 Lifecycle, documents, policies, calendar, payroll, profile, helpdesk

| Screen | UI element | Type | What it does | API / handler | Permission | Confirmation or validation | Success / error |
|---|---|---|---|---|---|---|---|
| Lifecycle | Complete task, checklist, policy sign, buddy check-in, notes | Button | Updates own onboarding | `PUT`/`POST` `/v1/both/lifecycle/employee/...` | `isAuthenticated` plus the lifecycle module flag | Per-task completion | Inline status |
| Lifecycle | Offboarding task, knowledge transfer, exit interview | Button | Updates own exit work | Same employee lifecycle routes | Module flag. The bucket also has `lifecycle.exit.conduct` | Form fields | API message |
| Lifecycle | BGV upload / draft / submit | Button, file | Background-check self-service | BGV routes in `server/routes/Both/LifecycleEmployeeRoutes.js` | Feature `backgroundVerification` | Document type checks | API message |
| Documents & ID | Preview / Download / Delete | Icon button | Own and shared docs | `GET /v1/both/documents`, `/shared`; `DELETE /v1/both/documents/:id` | Signed-in | “Delete document?” modal | Toast |
| Documents & ID | Download ID | Button | Downloads the card | `GET /v1/admin/id-cards/employee/my-card`, `GET /v1/admin/id-cards/card/:id/download` | Signed-in on the employee card routes | Warning if there is no card | Empty ID state |
| Documents & ID | Upload | Submit | Uploads a personal file | `POST /v1/both/documents/upload` | Signed-in | File required | Toast |
| My documents | Replace / patch / delete | Button | Maintains own files | `PUT .../replace`, `PATCH`, `DELETE` | Signed-in | Delete confirm | Toast |
| Document requests | Generate / preview / delete letter | Button | Self-service letters | `POST /v1/both/self-service-documents/preview`, `/generate`, `DELETE .../delete/:id` | Signed-in. Template mode from `mode-settings` | Template fields | Toast |
| Document requests | Submit / cancel request | Button | Asks HR for a document | Employee document-request routes | Signed-in, own request | Purpose required | Status chips |
| Policies | Acknowledge | Button | Records acknowledgement | `GET`/`POST` organization policy employee routes | Signed-in | Policy id required. No confirm | List updates |
| View profile | Download | Button | Intended to download a document | None. No `onClick` in `ViewProfile.jsx` | n/a | n/a | Dead control |
| Calendar | Month change | Button | Loads the year and 1:1s | `GET /v1/employee/calendar/:year`, `GET /v1/both/one-on-one/one-on-ones` | Signed-in | None | Empty month, or a toast on failure |
| Payroll | Download Payslip | Button | Downloads the PDF | `GET /v1/employee/payroll/download/:payrollId` | `isAuthenticated` and the payroll feature. UI also requires a paid or finalized month | Button disabled, with a title that explains why | “Payslip downloaded successfully!” |
| Payroll | View any month / history | Control | Loads that month | `GET /v1/employee/payroll/by-month`, `/history`, `/current`, `/details/:payrollId` | Same | Month and year | “No payroll published yet” |
| Profile | Tab | Tab | Switches section and URL | Profile `PUT`/`POST` under `/v1/both/profile-details` | Signed-in, own record | Per-field in each section | Toast “Failed to update…” |
| Profile | Edit / Save / Cancel | Button | Edits personal details | Save handler in `ProfileDetails.jsx` | Signed-in | Disabled while saving | “Saving...” then toast |
| Profile | Photo upload | File | Updates the avatar | `POST` profile photo | Own id | Image type and size, about 5MB, in `ProfilePhotoUpload.jsx` | Toast |
| Profile | Financial / tax | Submit | Saves bank details or requests a regime change | `PUT` financial details; `GET`/`POST /v1/both/tax-regime-change/request` | Signed-in | Confirm when marking tax not applicable | Toast |
| Profile | Family / education / experience | Form | Add and edit records | Profile-detail routes | Own record | Delete uses `window.confirm`. Family has a max and no delete control in one path | Toast |
| Profile | Job document upload | Button | Uploads KYC | `POST /v1/both/documents/upload` | Own, then HR review | Uses `alert` rather than toast | Alert |
| Profile | Change password | Submit | Changes password and stays logged in | `POST /v1/both/auth/change-password` | Signed-in | Minimum 8 characters | Toast |
| Helpdesk | Create / comment / resolve | Submit, button | Own tickets. Resolve is on the same open route | `POST`/`GET`/`PUT /v1/both/helpdesk` | `isAuthenticatedBoth` | Ticket fields. Cancel has no confirm | API message |
| Celebrations | React / wish | Button | Same as the dashboard rail | Celebration routes | Signed-in | None | Event page |

---

## 4. Functional modules

Shared approvals go through `approvalWorkflowService`. Entity types include Leave, Expense, Document, AttendanceRegularization, TaxRegimeChange, and lifecycle types. Workflow configuration is an admin API, not an employee screen.

| Module | Create | Read | Update | Delete | Special workflow |
|---|---|---|---|---|---|
| Own profile | Photo, qualifications, family, tax-regime request | Own record | Personal, contact, job docs, financial, password | Not the employee record | Completion meter. Forced password popup. Tax “not applicable” goes to HR. Bank edits save directly |
| Attendance | Punch, break, regularization, WFH, comp-off | Own logs and rule | Cancel pending regularization | Cancel comp-off | Home punch needs an approved WFH. Regularization has a monthly cap and goes to manager or HR. No timesheet or shift swap |
| Leave | Apply, upload proof, encashment request (API and unwired UI) | Own balance and history | Cancel own pending request | No | Manager, then HR. Employee does not approve. Encashment approval is admin, HR, or executive |
| Payroll | No | Own history, details, and payslip PDF | No | No | Download only after the month is paid or finalized. No Form 16 on this page |
| Projects | Comment; create-today-task exists | Own projects and work items | Own task status | No | No project admin |
| Engagement | Survey response, feedback, recognition | Own surveys, feedback, recognition feed | Reactions | No | Anonymous feedback only when the org setting and permission allow it |
| 1:1 | Schedule, because `/one-on-one` is open | Own meetings | Accept, decline, notes, reschedule | No | Employee page links into the manager scheduler |
| Learning and benefits | Enroll | Plans, courses, progress | Progress, cancel enrollment | No | Certificate after completion. Catalog is admin-managed |
| Recruitment | Apply, refer, interview feedback if assigned | Internal jobs and own applications | Submit feedback | No | Hire tab is conditional |
| Lifecycle | Complete own tasks, sign policies, BGV docs, exit responses | Own onboarding and offboarding | Checklists and assets assigned to self | Own BGV draft docs | Configure, reports, and enterprise query params are blocked. Offboarding is started by HR. No resignation button |
| Documents | Upload, request a letter, generate from a template | Own, shared, policies, ID card | Replace, acknowledge policy | Own upload or generated letter | HR still issues managed letters |
| Helpdesk | Ticket, comment | Own tickets (list scoping is in the controller) | Update, resolve | No | Analytics is denied. Not in the Me sidebar |
| Calendar and celebrations | Wishes and reactions | Org calendar, birthdays, anniversaries | No | No | Dashboard rail |
| Expenses | API only: create, read, update, delete own (`server/routes/Both/ExpenseRoutes.js`) | API | API | API | No employee screen. Approval is admin, plus workflow |
| Goals and reviews | API only (`GoalRoutes.js`, `PerformanceReviewRoutes.js`) | API | Self-assessment API | API | No employee screen |
| Users, departments, payroll runs, policy admin, reports, audit, org settings | No | No | No | No | Not in this role |

There is no employee bulk import. Payslip download is the only self-service export that is clearly scoped to the caller. The attendance PDF export is not safe to treat as self-service (see section 5).

### Who approves an employee request

| Request | Typical approver |
|---|---|
| Leave | Manager, then HR. An HR applicant goes to Admin |
| Attendance regularization | Manager or a designated approver; HR and Admin can act |
| WFH | Manager, HR, or Admin |
| Comp-off | Admin, HR, or Executive |
| Leave encashment | Admin, HR, or Executive |
| Expense | Admin, plus workflow |
| Document upload and letter request | HR and/or Admin |
| Tax regime “not applicable” | HR, Admin, or Executive |
| Benefit enrollment | HR (Pending to Active) |
| Helpdesk resolve | HR, Admin, or Executive |
| Offboarding start | HR or Admin |

---

## 5. Gaps and problems

### Broken, dead, or duplicate controls

- Projects notification bell does nothing (`EmployeeProjects.jsx`).
- View Profile **Download** has no handler (`ViewProfile.jsx`).
- `ProfileSidebar.jsx` is never imported.
- Unrouted duplicates are listed in section 2.3. Leave encashment, guarantor, and next of kin are the ones employees would notice.
- `/employee/leave-attendance`, `/my-leave`, and `/attendance-stats` render the same hub. `/leave` is a second apply form.
- Dashboard **Apply leave** opens the hub, not the form.
- **Meeting Management** on the employee 1:1 page opens the manager scheduler.
- Documents are split across Documents & ID, My documents, and Document requests, with overlapping upload and delete.

### Validation, loading, empty, and error states

- Leave apply checks name, email, dates, and sick-leave documents, then uses toasts.
- Regularization disables **New Request** when the limit API says no. The explanatory limit copy in the page is commented out, so a failure looks like a disabled button.
- Payroll has an explicit empty state and a disabled download with a reason.
- 1:1 has an empty state.
- Password rules disagree: forced reset minimum 6, Security tab minimum 8.
- Feedback uses a mix of toast, `window.confirm`, `window.prompt`, and `alert` (job document upload).
- The attendance log calls a manager/HR endpoint, so the employee empty state can be an error instead of “no punches”.
- Recognition cannot reliably pick a coworker (section 3.4).
- Course details also request an admin course URL.

### Inconsistent UI

- The dashboard uses a mint palette (`#0e9370` in `DashboardEmployee.jsx`). Projects use `#20C997`. Profile uses `bg-theme-primary`. Engagement and 1:1 use Tailwind slate.
- Page titles jump between `text-2xl` and `text-4xl`.
- Projects draws its own header on top of the app header.
- Names drift: sidebar “Payroll” vs page “My Payroll”; the profile tab “Documents” routes to `/job-details`; tech nav says “WFH & Regularization” where the employee nav says “Regularization”.

### Accessibility, responsiveness, and performance

- Profile tabs expose `role="tab"` and `aria-selected`. Many icon buttons elsewhere are `title` only (document preview and delete).
- The projects bell has `aria-label="Notifications"` and no action.
- Engagement and payroll tables set `min-w-[520px]` or `min-w-[640px]`. Narrow screens depend on a parent that actually scrolls.
- `window.confirm` and `prompt` are not accessible dialogs.
- The dashboard fires many requests on load (logs, payroll, leave, tasks, birthdays, anniversaries, projects). Engagement loads surveys, feedback, recognition, activity, and celebrations together, with a 500-survey fallback.

### Security

| Issue | Where | What happens |
|---|---|---|
| Encashment history IDOR | `LeaveEncashmentRoutes.js` `GET /history/:employeeId?`; `getEncashmentHistory` sets `employeeId` from the param first | Any signed-in user who can call the route can read another employee’s encashment rows and amounts in the same organization filter |
| Attendance PDF IDOR | `AttendanceRoutes.js` `GET /:employeeId/export-pdf`; `exportAttendancePDF` uses `Employee.findById` with no org or self check | Any signed-in user can export another employee’s attendance. Missing org filter is a cross-tenant risk if ids are known |
| 360 feedback IDOR | `EngagementRoutes.js` `GET /360-feedback/:employeeId`; `get360Feedback` | Any signed-in user can read another employee’s non-anonymous suggestions and appreciation in the same organization |
| Frontend elevation | `EMPLOYEE_PERMS` includes `leave.view.team`; `canAccess` | `/leave-management` and `/dashboard-manager` open for a pure Employee. Approve APIs still require manager or HR permissions |
| Open manage shells | `allowedRoles: []` on `/engagement`, `/helpdesk` (resolve included), `/one-on-one`, `/benefits/:id`, `/team-learning`, `/learning`, `/attendance` | The URL is enough. Writes depend on each API |
| Payroll routes | `server/routes/Employee/EmployeePayrollRoutes.js` uses `isAuthenticated` only, not `payroll.view.self` | Safe only while every handler scopes to `req.employee` |
| Engagement lists | `GET` surveys, feedback, and recognition are `isAuthenticatedBoth` | List endpoints are wider than the write permissions |
| Exit conduct | `lifecycle.exit.conduct` is on the employee bucket | Confirm the exit-interview controller limits this to the employee’s own interview |
| Two RBAC systems | `requirePermission.js` buckets vs `rbac.js` Role documents | A route that uses only one of them will not match the UI |
| Direct bank and PII edits | Profile financial save | No approval step. That is a product risk, not an IDOR |

### Missing for a modern employee portal

- No in-app payslip dispute, Form 16, or year-end tax pack on the payroll page.
- No employee directory or org chart. The chart route requires `employee.view.all` or `employee.view.team`.
- Goals and performance review APIs exist. There is no employee screen.
- Expense APIs exist. There is no employee screen.
- No My Assets inventory. Lifecycle only has return flags.
- No self-service resignation. Offboarding is started by HR.
- No single queue for leave, regularization, document requests, surveys, and lifecycle tasks.
- Helpdesk exists and is linked from the dashboard, and it is absent from the sidebar.
- Leave encashment, guarantor, and next of kin components are unwired.
- WFH requests cannot be withdrawn from the employee list.

---

## 6. Cross-role comparison

“Nav” means the item is on that role’s sidebar. “URL” means the route allows that role, or is open to any signed-in user. This is a planning matrix, not a second full audit. Admin detail is in `docs/admin-audit.md`. HR detail is in `docs/hr-audit.md`.

| Capability | Employee | Line manager | HR executive / HR manager | Admin (org owner) |
|---|---|---|---|---|
| Own dashboard, punch, own leave, own payslip, profile | Nav | Also has the employee bucket | Yes | Yes, via the Me portal |
| Team leave and attendance approval | URL risk via `leave.view.team` | Nav and permissions | Nav, org-wide | Yes |
| Employee directory | No | Team only | All | All |
| Add, edit, delete employees | No | No | HR manager yes. Executive is view and edit, not full owner | Yes |
| Payroll process and publish | View self only | View self | HR manager and payroll admin | Yes |
| Leave policy, attendance rules, org settings | No | No | HR manager / executive | Yes |
| Recruitment admin | Internal jobs only | Hiring requests | Full recruitment nav | Yes |
| Engagement admin vs participate | Participate. HR page is reachable by URL | Team analytics | Manage | Yes |
| Onboarding configure / enterprise | Own lifecycle only | Own, plus team where permitted | Configure | Enterprise hub |
| Projects admin | Own projects | Line: team. Project manager: org projects | If they also have project permissions | Yes |
| Documents admin, ID generator, reports, audit | Own docs and ID | No admin docs | HR docs and reports | Yes. Platform audit is for operators |
| Helpdesk | URL open, not in Me nav | URL open | URL open. Analytics for HR | Analytics |

Managers, HR, and Admin keep approve-all, view-all, payroll processing, and org settings. Those keys are not in `EMPLOYEE_PERMS`, except the `leave.view.team` entry called out above.

---

## Source index

| Area | Path |
|---|---|
| Employee permissions | `server/config/permissions.constants.js` (`EMPLOYEE_PERMS`) |
| System role | `server/config/systemRole.constants.js` |
| Bucket resolution | `server/helpers/permissionService.js` |
| Client routes and guard | `vite_client/src/routes/index.jsx`, `vite_client/src/components/ProtectedRoute.jsx` |
| Me navigation | `vite_client/src/utils/navigationConfig.jsx` |
| Employee UI | `vite_client/src/Employee/**` |
| Employee APIs | `server/routes/Employee/*`, `server/routes/Both/*` |
| Related audits | `docs/admin-audit.md`, `docs/hr-audit.md` |

Phase 2 has not started. The next step, after approval, is a proposed navigation and screen list only.
