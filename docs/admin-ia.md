# Admin information architecture (proposal)

Phase 2, step 1. No UI code has been changed. Implementation waits for confirmation of this document.

Decisions taken from the audit approval:

- This redesign is the org-owner Admin portal only. The SaaS `/platform` control panel stays as it is.
- Recruitment, learning, engagement, benefits, succession, workforce, and HR reports stay on the HR portal. They are not added to the Admin sidebar.
- Role Hierarchy leaves the Admin sidebar. Users & Roles is the only access screen. The legacy `/role-hierarchy` route and API stay in place for now so nothing is deleted before a later pass.

Existing routes keep working. Grouping changes what the sidebar shows, not which URLs exist.

---

## Navigation

The sidebar in `vite_client/src/Shared/Header.jsx` is a flat list from `getAdminNavigation()` in `vite_client/src/utils/navigationConfig.jsx`. The new Admin nav adds section labels. Items still filter by the same permissions.

Admin portal home becomes `/dashboard-admin`. Today the Admin tab home is `/organization/dashboard` (`vite_client/src/utils/portalConfig.js`) while the first sidebar item is `/dashboard-admin`.

### Home

| Label | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard-admin` | Only top-level home item |

### People

| Label | Route | Notes |
|---|---|---|
| Employees | `/employees` | Add employee stays a button on this page and the dashboard, not a sidebar item |
| Organization | `/organization/chart` | Chart remains the landing view. Profile, structure, and analytics open from this page |
| Lifecycle | `/onboarding` | Same joiner/leaver screen |

Org structure (`/organization/structure`) is linked from Organization. It is built and its sidebar entry is currently commented out. It does not need its own top-level item.

### Time

| Label | Route | Notes |
|---|---|---|
| Leave | `/leave-management` | |
| Attendance | `/all-attendance-history` | Today’s live attendance stays a link from the dashboard and a control on this page |
| Calendar | `/calendar-management` | |
| Approvals | `/admin/pending-approvals` | The inbox. Workflow setup moves under Control |

### Pay

| Label | Route | Notes |
|---|---|---|
| Payroll | `/admin-payroll` | |
| Salary structure | `/salary-structure` | |

### Work

| Label | Route | Notes |
|---|---|---|
| Projects | `/projects` | |
| One-on-one | `/one-on-one` | |
| Documents | `/admin/document-management` | |

### Control

| Label | Route | Notes |
|---|---|---|
| Users & roles | `/admin/platform-roles` | Replaces Role Hierarchy in the sidebar |
| Workflows | `/admin/approval-workflows` | |
| Policies | `/admin/policies` | Already built, missing from the sidebar |
| Audit log | `/admin/audit-log` | New screen on the existing `/api/v1/admin/audit-logs` API |
| Subscription | `/organization/subscription` | |
| Settings | `/admin-settings` | |

Removed from the sidebar only:

- Role hierarchy (`/role-hierarchy`)
- Duplicate organization dashboard as the portal home

---

## Dashboard layout

File: `vite_client/src/Admin/DashboardAdmin.jsx`. Same data sources. The fake “Today / Tomorrow / Review” events go away. Project progress guesses are not shown on this page.

**Header.** Greeting, then three actions: Add employee (org owner), New announcement, Pending approvals.

**Stat row.** Every card navigates:

| Card | Destination |
|---|---|
| Total employees | `/employees` |
| Present today | `/today-attendance` |
| Pending leave | `/leave-management` |
| Overdue approvals | `/admin/pending-approvals?escalated=1` |
| Payroll this month | `/admin-payroll` |

**Main column.** Approvals that need a decision (pending leave plus escalated workflow items), then recent announcements with a link to `/sent-announcements`.

**Side column.** Celebrations from the existing birthday and anniversary API, then the latest hires linking to `/employees/:id`.

Helpdesk, today’s attendance, and payroll stay as secondary actions under the stat row. They are already on the dashboard.

---

## Settings

`AdminSettings.jsx` keeps one settings page. Tabs that are real stay. The two dead buttons are replaced with links.

| Tab | Change |
|---|---|
| General | Keep toggles, timezone, employee ID |
| Attendance rules | Keep |
| Shift settings | Keep |
| Leave policy | Keep |
| Payroll settings | Keep |
| Notifications | Keep |
| Email | Keep |
| Documents | Keep |
| Theme | Keep |
| Security | Keep change-password. Password-policy text stays descriptive |
| Permissions | Remove the dead **Manage Roles** button. This tab links to `/admin/platform-roles` |
| Reports | Remove the dead **Configure Reports** button. This tab links to `/admin/reports` |

Organization profile, domain, verification, referrals, and checkout stay reachable from Organization and Subscription. They are not extra sidebar items.

---

## Screen list for the first build

These are the screens to restyle and fix, in order. Each one is a reviewable slice. Routes and API handlers stay.

1. Sidebar sections and Admin portal home (`navigationConfig.jsx`, `portalConfig.js`, `Header.jsx`)
2. Dashboard (`DashboardAdmin.jsx`)
3. Employees list and add employee
4. Employee profile
5. Organization chart, with links to structure and profile
6. Leave management
7. Attendance history and today
8. Payroll and salary structure
9. Projects list (wire bulk delete and bulk status, or remove those menu items until the API exists) and project detail
10. Pending approvals and workflow setup
11. Calendar
12. Documents
13. Users & roles
14. Audit log (new, read-only)
15. Policies
16. Subscription
17. Settings, including the dead-button fix
18. One-on-one and lifecycle shells, spacing and states only

Out of this pass, unless you add them:

- Employee CSV import
- Review-cycle admin UI
- SLA screen wiring
- Deleting the legacy Role Hierarchy API
- Any HR, Manager, Employee, or `/platform` screen

---

## What you are confirming

Reply yes to build this, or mark the lines to change. In particular:

- Sidebar groups: Home, People, Time, Pay, Work, Control
- Role Hierarchy off the sidebar, Users & Roles stays
- New read-only audit log under Control
- Policies added to Control
- Dashboard drops the placeholder events and makes every stat card open its module
