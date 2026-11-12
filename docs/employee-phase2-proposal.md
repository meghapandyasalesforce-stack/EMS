# Employee portal — Phase 2 proposal

**Status:** Awaiting confirmation. This is the information architecture and design direction only. No UI rebuild until you approve it.  
**Date:** 2026-11-10  
**Based on:** `docs/Employee-audit.md`  
**Design reuse:** Existing Me shell and the shared corporate styles (`vite_client/src/Shared/Header.jsx`, `vite_client/src/styles/corporateModern.css`, `vite_client/src/components/corporateModern`). No new UI framework.  
**Parallel:** Same step as `docs/hr-phase2-proposal.md` and `docs/admin-audit.md`.

---

## Executive summary

Phase 2 rebuilds the Me (Employee) portal as a phone-first self-service experience. The current sidebar lists 15 destinations. The proposal keeps every working feature, folds time and documents into two hubs, and fixes the security and dead-control findings from the 10 November audit.

This document proposes:

1. **Navigation** — five primary destinations, everything else under More.
2. **Dashboard** — punch, action queue, balances, pay, work, company pulse.
3. **Screen list** — keep, merge, add, hide, defer.
4. **Design direction** — one mint shell, shared components, loading / empty / error on every zone.
5. **Permission plan** — close the URL gaps before visual polish.

Confirm the decisions and the checklist at the end before any redesign code starts.

---

## Product decisions

Recommended defaults come from `docs/Employee-audit.md`. Reply with D1–D10, or with “accept all recommended”.

| # | Decision | Recommended default | Your choice |
|---|---|---|---|
| **D1** | When to fix the three IDOR routes (encashment history, attendance PDF, 360 feedback)? | **First commit**, before any visual polish | ☐ Security first / ☐ Together with the first UI module |
| **D2** | Remove `leave.view.team` from pure `EMPLOYEE_PERMS`? | **Yes.** Leave management and the manager dashboard stay Manager / HR only | ☐ Yes remove / ☐ Keep |
| **D3** | Documents: one hub or the current split? | **One hub** at `/employee/documents` with tabs: My docs, ID card, Requests, Policies | ☐ One hub / ☐ Keep separate |
| **D4** | Where does Helpdesk live? | **More menu**, plus the existing dashboard shortcut. Primary bar stays at five items | ☐ More + dashboard / ☐ Primary nav |
| **D5** | Ship an Expenses screen in Phase 2? | **Defer.** The API exists. There is no employee screen today | ☐ Defer / ☐ Build MVP |
| **D6** | Ship Form 16, My Assets, resignation, org directory, or performance UI? | **Defer all** | ☐ Defer all / ☐ Pick: ___ |
| **D7** | Wire leave encashment into the Time hub? | **Yes.** `LeaveEncashment.jsx` exists and has no route. History API is fixed in the security commit | ☐ Wire / ☐ Defer |
| **D8** | Mobile bottom bar plus desktop sidebar? | **Yes.** Five items: Home, Time, Pay, Docs, More | ☐ Bottom + sidebar / ☐ Sidebar only |
| **D9** | How can an employee pick a coworker for recognition? | **New name-only search** scoped to the same organization. Do not grant `employee.view.all` | ☐ Name-only search / ☐ Defer recognition of others |
| **D10** | Comp-off and regularization as their own sidebar items? | **No.** Both open from the Time hub. Old URLs redirect or stay as deep links | ☐ Inside Time / ☐ Keep separate nav items |

These are fixes, not product choices. They ship with the security and Time-hub steps if you approve this proposal:

- Employee attendance log reads the caller’s own logs. It stops calling `GET /v1/both/attendance/team-attendance-history`.
- Course details stop depending on `GET /v1/admin/learning/courses/:id` when a both-route already returns the course.
- Projects notification bell is removed or wired to `/notifications`.
- View Profile **Download** downloads the file or the button is removed.
- Regularization shows the limit message again (the copy is commented out today).
- WFH list gets a withdraw action for the employee’s own pending request, if the API already supports cancel.
- Pure employees use `/1-on-1`. `/one-on-one` (the organizer scheduler) requires an organizer permission.
- Helpdesk **resolve** and analytics stay on HR / Admin. Employees can create, view, and comment on their own tickets.
- `lifecycle.exit.conduct` is confirmed to apply only to the caller’s own interview. If the controller is wider, it is narrowed in the security commit.
- Forced password reset and the Security tab use the same minimum length (8).

---

## 1. Proposed navigation

### 1.1 Principles

- Five primary destinations. Everything else sits under More.
- Group by the employee’s job: time, pay, documents, work, account.
- Preserve current behavior. Old URLs redirect to the canonical screen.
- Manager and HR approval screens stay out of Me navigation.
- Other role portals stay as they are. A shared component change is called out in that commit.

### 1.2 Primary destinations

| Label | Path | What it opens |
|---|---|---|
| Home | `/dashboard-employee` | Punch, action queue, balances, pay snapshot |
| Time | `/employee/leave-attendance` | Attendance, leave, regularization, WFH, comp-off, encashment if D7 |
| Pay | `/employee-payroll` | Own payslips |
| Docs | `/employee/documents` | Merged hub if D3 |
| More | Sheet or `/employee/more` | Secondary modules |

If you choose D4 = primary nav, Help replaces Docs on the bottom bar and Docs moves under More. The recommended bar is Home, Time, Pay, Docs, More.

### 1.3 More menu

| Label | Path | Notes |
|---|---|---|
| Profile | `/profile-details` | Also in the header |
| Notifications | `/notifications` | Also the header bell |
| Helpdesk | `/helpdesk` | Primary only if D4 says so |
| Calendar | `/employee/calendar` | |
| Projects | `/employee/projects` | |
| Benefits & learning | `/employee/benefits-learning` | |
| Engagement | `/employee/engagement` | Employee page only. The HR `/engagement` shell is closed to this role |
| Internal jobs | `/employee/internal-jobs` | |
| My lifecycle | `/onboarding` | Own tasks. Configure / reports / enterprise stay blocked |
| One-on-one | `/1-on-1` | Invitee page. Organizer page is not linked for a pure employee |
| Daily report | `/daily-report` | |
| Celebrations | `/celebrations` | Reached from the dashboard. Not a nav row |

Policies move into the Docs hub when D3 is accepted.

### 1.4 Left out of Me navigation

| Item | Why |
|---|---|
| `/leave-management`, `/dashboard-manager` | Manager / HR. D2 removes the permission that currently opens them |
| `/engagement` HR manage shell, `/team-learning`, `/benefits/:id` admin actions | Gated with manage permissions |
| `/one-on-one` organizer scheduler | Organizers only |
| Expenses, assets, Form 16, performance, directory | Deferred unless you override D5 or D6 |

### 1.5 Sketch

```
Me (Employee)
├── Home          /dashboard-employee
├── Time          /employee/leave-attendance
│     attendance · leave · regularization · WFH · comp-off · encashment
├── Pay           /employee-payroll
├── Docs          /employee/documents
│     my docs · ID card · requests · policies
└── More
      Profile, Notifications, Helpdesk
      Calendar, Projects
      Benefits & learning, Engagement
      Internal jobs, Lifecycle, 1:1, Daily report
```

Desktop uses the same items in the existing sidebar, with section labels: Home, Time and pay, Documents, Work, Account. The current `Header` is a flat list. Phase 2 can ship section labels and the bottom bar without a new shell.

### 1.6 Redirects

| Current URL | Canonical |
|---|---|
| `/dashboard/employee` | `/dashboard-employee` |
| `/my-leave`, `/attendance-stats`, `/leave` | `/employee/leave-attendance` (apply stays a panel or a linked form) |
| `/my-attendance-regularization`, `/my-comp-off` | Time hub tabs. Deep links kept |
| `/employee/documents-id`, `/employee/id-card`, `/employee/my-documents`, `/employee/document-requests`, `/employee/policies` | Docs hub tabs |
| `/attendance` | Time hub |
| `/learning`, `/benefits` | `/employee/benefits-learning` |

---

## 2. Proposed dashboard

`/dashboard-employee`. One column on a phone. Two columns from the `lg` breakpoint.

| Zone | Content | Actions |
|---|---|---|
| Top | Greeting, photo | Notifications, Helpdesk, Profile. Logout stays in the profile menu |
| Punch | Status, Office / Home, in, out, break | Same rules as `AttendanceBox`. Punch-out asks for confirmation |
| Action queue | Pending leave, regularization, WFH, comp-off, lifecycle tasks, unread policies, surveys, open tickets | Counts and deep links. Empty state: “You’re up to date.” |
| Balances | Leave chips, this month’s attendance | Opens Time |
| Pay | Latest payslip status | Opens Pay. Hidden amount when nothing is published |
| Work | Up to three projects and today’s tasks | Opens Projects |
| Pulse | Announcements and celebrations | Mark read (toast on failure), wish, react |
| Shortcuts | Apply leave, Regularize, Docs, Learning, Jobs, 1:1 | Filtered by what the org has enabled |

Rules:

- The local-only todo list is labeled “On this device” or removed. The action queue is the company task list.
- Each zone has loading, empty, and error-with-retry.
- No other employee’s pay, and no team-admin widgets.
- Icon buttons have accessible names. Punch actions meet WCAG AA contrast.

---

## 3. Screen list

### 3.1 Keep and polish

| Screen | Path | Phase 2 work |
|---|---|---|
| Dashboard | `/dashboard-employee` | Zones in section 2 |
| Time hub | `/employee/leave-attendance` | Own attendance API. Show regularization limits. WFH withdraw. Encashment if D7. Comp-off tab if D10 |
| Leave apply | Inside Time, keep `/leave` as a redirect | Same validation. Optional confirm |
| Payroll | `/employee-payroll` | Keep the empty state and the disabled-download reason |
| Profile | `/profile-details` and tab URLs | One password minimum. Job-document upload uses toast. Guarantor and next-of-kin: wire into Family or leave unwired and say so |
| View profile | `/view-profile` | Fix or remove Download |
| Engagement | `/employee/engagement` | Coworker search if D9. Drop the 500-survey fallback once my-surveys is reliable |
| Benefits and learning | `/employee/benefits-learning`, `/learning/courses/:courseId` | Course load uses the employee endpoint |
| Internal jobs | `/employee/internal-jobs` and `/:id` | Keep apply, refer, interview feedback |
| Projects | `/employee/projects` and `/:projectId` | Remove the dead bell or link it to notifications. Drop the extra page header |
| Calendar | `/employee/calendar` | Keep. Delete or stop shipping `EmployeeCalendar1.jsx` after parity |
| Lifecycle | `/onboarding` | Own tasks only |
| 1:1 | `/1-on-1` | Accept, decline, notes. Decline uses a dialog, not `prompt` |
| Helpdesk | `/helpdesk` | Discoverable. Own tickets. Cancel asks for confirmation. Resolve hidden |
| Notifications, celebrations, daily report | Existing paths | More menu or dashboard |

### 3.2 Merge

| From | Into |
|---|---|
| Documents & ID, My documents, Document requests, Policies | `/employee/documents` tabs, if D3 |
| Regularization, WFH, Comp-off sidebar items | Time hub, if D10 |
| `/my-leave`, `/attendance-stats`, `/attendance`, `/leave` | Time hub |
| Unrouted payroll, attendance, and calendar copies | Removed after the live screen covers them |

### 3.3 Add

| Item | Work |
|---|---|
| More sheet | Secondary navigation |
| Bottom bar | If D8 |
| `assertSelfOrElevated` (or the same checks inline) | IDOR routes in section 5 |
| Name-only coworker search | If D9. Fields: id, name. Same organization. Active employees |
| Own attendance read | Employee-scoped logs for the Time hub |
| Route gates | `requiredPermissions` on manage URLs a pure employee can open today |

### 3.4 Hide from this role

| Item | Action |
|---|---|
| Leave management and manager dashboard | D2, and `canAccess` must not ignore `allowedRoles` when the permission match is only `leave.view.team` |
| HR engagement shell, team learning, benefit-admin actions | Permission gate |
| Organizer 1:1 | Not linked. URL gated |
| Separate regularization and comp-off nav rows | Demoted into Time if D10 |

### 3.5 Defer

| Item | Reason |
|---|---|
| Expenses UI | API only |
| Form 16 and tax document center | Not on the employee payroll page today |
| My Assets | Lifecycle has return flags only |
| Resignation | HR starts offboarding |
| Org directory and chart | Needs view-all or view-team |
| Goals and performance UI | APIs exist, no employee screen |
| Payslip dispute | No workflow |
| A new visual framework | Stay on the current stack |

---

## 4. Design direction

Use the current stack: React, the existing layout, Tailwind, and the corporate components. Do not add a component library.

| Use | Where |
|---|---|
| Page shell | `Shared/Header.jsx`, `MePortalShell`, `SidebarNavList` |
| Tokens already in the app | Theme primary, and the employee mint (`#0e9370` / `#20C997`) |
| Shared pieces | `components/corporateModern` where a screen already uses them (`CmButton`, `CmEmpty`, `CmBadge`, `CmStat`) |
| Patterns to make consistent | Page title, tabs, filter chips, tables that scroll on small screens, empty / error / loading, confirm dialog |

Visual rules for the rebuilt screens:

- One page title size. One primary button style. One destructive style.
- Cards, tables, and forms share the same border, radius, and spacing.
- Projects, engagement, and profile stop inventing a second header.
- “Payroll” in the nav and “My Payroll” on the page use one name: **Pay**.
- The profile tab that edits job documents is labeled **Job documents**, and the route can stay `/job-details`.

Accessibility (WCAG AA) on rebuilt screens:

- Visible focus, keyboard use for dialogs and menus, text alternatives on icon buttons.
- Contrast on the punch button and on white-on-mint controls.
- Tables scroll inside a labeled region or stack into cards under `sm`.
- Confirmations are dialogs, not `window.confirm`, `prompt`, or `alert`.

Every list and detail zone shows loading, an empty explanation, and an error with retry.

---

## 5. Permissions

| Layer | Change |
|---|---|
| Encashment history | `GET /history/:employeeId` returns the caller’s rows unless the caller is HR, Admin, or Executive in the same organization |
| Attendance PDF | `GET /api/v1/both/attendance/:employeeId/export-pdf` requires self, or manager/HR, and the same `organizationId` |
| 360 feedback | `GET /360-feedback/:employeeId` requires self, the employee’s manager, or HR in the same organization |
| Employee permissions | Remove `LEAVE_VIEW_TEAM` from `EMPLOYEE_PERMS` if D2 is accepted. Review `LIFECYCLE_EXIT_CONDUCT` so it cannot conduct someone else’s interview |
| Route guard | `canAccess` does not treat `leave.view.team` as a pass into `/leave-management` or `/dashboard-manager` for a pure employee |
| Open shells | `/engagement` (HR page), `/team-learning`, `/one-on-one`, `/benefits/:id`, and helpdesk resolve get real permission checks on the route and the API |
| Payroll handlers | Keep session scoping. Add `payroll.view.self` on the employee payroll router so the route matches the bucket |
| Attendance hub | Own logs endpoint. Team history stays on the manager API |
| Recognition | Name-only search if D9. `get-all-employees` stays view-all / view-team |
| Frontend | `PermissionGate` hides buttons. The API still rejects the call |

Other roles are not rebuilt. A shared middleware change is listed in that commit’s summary.

---

## 6. Order of work after you confirm

| Step | Module | Outcome |
|---|---|---|
| 0 | This proposal | Locked navigation, screens, and D1–D10 |
| 1 | Security | IDOR fixes, D2, route gates, own attendance read, exit-conduct check |
| 2 | Shell | Sidebar sections, More, bottom bar if D8 |
| 3 | Dashboard | Zones, states, punch-out confirm, mark-read toasts |
| 4 | Time | Regularization, WFH withdraw, comp-off, encashment if D7 |
| 5 | Documents | One hub and redirects, if D3 |
| 6 | Pay and profile | Download fix, password length, upload toasts |
| 7 | Work | Projects, learning, engagement and D9, jobs, 1:1, lifecycle |
| 8 | Helpdesk and notifications | Discoverability, cancel confirm, accessible pass |

Each step is a small commit and a short summary. Existing employee behavior stays. Unrouted duplicate files are removed only after the live screen covers them.

---

## 7. Success criteria

- A pure employee finishes punch, leave, pay, and documents on a phone without opening a manager or HR screen.
- Encashment history, attendance PDF, and 360 feedback reject another employee’s id.
- `/leave-management` and `/dashboard-manager` do not open for this role.
- Attendance history loads the caller’s days.
- Recognition can address a coworker if D9 is accepted, without exposing the full employee record.
- Documents live in one hub if D3 is accepted.
- Rebuilt screens show loading, empty, and error states and meet WCAG AA for the controls they change.
- Every employee feature that works today still works.
- Admin, HR, and Manager portals are unchanged except for a shared fix named in the commit.

---

## 8. Confirmation

Reply with:

1. **Accept recommended D1–D10**, or list overrides.
2. **Approve the primary nav and More**, or name items to add, remove, or keep separate.
3. **Approve the dashboard zones**, or name changes.
4. **Approve keep / merge / defer**, or name changes.
5. **“Proceed, starting with Step 1 (Security)”** — or name a different first step.

Until item 5, no application code changes for this redesign.

---

## Related docs

| Doc | Role |
|---|---|
| `docs/Employee-audit.md` | Phase 1 audit this proposal follows |
| `docs/admin-audit.md` | Admin portal audit. Out of scope here |
| `docs/hr-audit.md`, `docs/hr-phase2-proposal.md` | HR portal. Employee self-service stays in Me |
