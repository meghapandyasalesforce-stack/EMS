# HR Portal — Phase 2 Proposal

**Status:** Awaiting confirmation (Step 1 only — no UI rebuild yet)  
**Date:** 2026-10-16  
**Based on:** `docs/hr-audit.md`  
**Design reuse:** Admin/shared `cm-hrms` system (`vite_client/src/styles/corporateModern.css`, ATS/lifecycle shells) — `docs/admin-audit.md` does not exist

---

## Executive summary

Phase 2 redesigns the **HR portal information architecture and shell**, then rebuilds screens module-by-module while **preserving all existing functionality**.

This document proposes:

1. **Navigation** — grouped sidebar, Manager vs Executive variants, permission keys on every item  
2. **Dashboard** — single HR home with clear ops + insight zones  
3. **Screen list** — keep / merge / add / hide / defer  

**Please confirm or edit this proposal before any code rebuild starts.**

---

## Product decisions (need your yes/no)

These drive nav visibility and backend permission work. Recommended defaults from the audit:

| # | Decision | Recommended default | Your choice |
|---|----------|---------------------|-------------|
| D1 | Should **HR Manager** keep near–org-owner powers (org settings, payroll publish, hard delete)? | **No** — trim `org.settings.manage` and `payroll.publish` from Manager unless org owner; keep delete as Manager-only (not Executive) | ☐ Yes keep / ☐ Trim as recommended / ☐ Custom |
| D2 | Should **HR Executive** get `onboarding.manage` + document verify, or hide those nav items? | **Hide** advanced lifecycle/config from Executive nav; keep day-to-day ops (employees, leave approve, attendance, engagement, recruitment read/ops as today) | ☐ Grant keys / ☐ Hide nav / ☐ Custom |
| D3 | **Documents** — one hub vs two sidebar entries? | **One hub** (`/documents`) with tabs: Library \| Requests \| Templates | ☐ One hub / ☐ Keep both |
| D4 | Ship **Performance** UI in Phase 2? | **Defer** — remove/hide mock Performance report; keep employee score field; no new appraisal product | ☐ Defer / ☐ Build MVP |
| D5 | Ship **Grievances**? | **Defer** — no module exists; do not invent in Phase 2 | ☐ Defer / ☐ Scope MVP |
| D6 | **Projects** in HR nav? | **Stay hidden** (as today for both HR roles) | ☐ Hidden / ☐ Show for Manager |
| D7 | Shared Admin screens (Employees, Leave, Payroll) — HR skin or leave Admin chrome? | **Extend shared components / apply `cm-hrms` shell wrapper**; do not fork business logic | ☐ Wrapper / ☐ Full HR fork |

Reply with D1–D7 choices (or “accept all recommended”) when confirming.

---

## 1. Proposed navigation

### 1.1 Principles

- Group by **job**, not by historical Admin path names  
- Every item has **`permissions`** (and routes get matching `requiredPermissions`)  
- Executive nav = subset of Manager (ops-focused)  
- ESS items stay in **Me** portal, not HR sidebar (except “My payroll” if HR often needs it — see below)  
- Fix audit bug: remove trailing empty slot in `HR_NAV_ITEMS`

### 1.2 Proposed sidebar structure

#### Group A — Home & people

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Dashboard | `/dashboard-hr` | ✓ | ✓ | `EMPLOYEE_VIEW_ALL` or `LEAVE_VIEW_ALL` |
| Employees | `/employees` | ✓ | ✓ | `EMPLOYEE_VIEW_ALL` |
| Organization | `/organization/chart` | ✓ | ✓ | `EMPLOYEE_VIEW_ALL` |

#### Group B — Hire & lifecycle

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Recruitment | `/recruitment` | ✓ | ✓ | `EMPLOYEE_VIEW_ALL` (until dedicated recruitment perm exists) |
| Employee lifecycle | `/onboarding` | ✓ | ✓ (ops only; no Configure/Enterprise) | `ONBOARDING_MANAGE` **or** `EMPLOYEE_VIEW_ALL` for Executive list/detail |
| Learning & development | `/learning` | ✓ | ✓ | Engagement/learning manage heuristic → map to `ENGAGEMENT_MANAGE` or add `learning.manage` later |

#### Group C — Engage & support

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Engagement | `/engagement` | ✓ | ✓ | `ENGAGEMENT_MANAGE` / survey manage / analytics org |
| Helpdesk | `/helpdesk` | ✓ | ✓ | Authenticated + manage actions gated in UI/API (**new in nav**) |
| Announcements | `/sent-announcements` | ✓ | ✓ | HR flags (**new in nav**) |
| One-on-One | `/one-on-one` | ✓ | ✓ | Any auth (organize meetings) |

#### Group D — Time & attendance

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Leave management | `/leave-management` | ✓ | ✓ | `LEAVE_VIEW_ALL` |
| Pending approvals | `/admin/pending-approvals` | ✓ | ✓ | `LEAVE_APPROVE_ALL` or `LEAVE_APPROVE_TEAM` |
| Attendance | `/all-attendance-history` | ✓ | ✓ | `ATTENDANCE_VIEW_ALL` |
| Regularization / WFH | `/attendance-regularization` | ✓ | ✓ | Regularization approve perm |
| Calendar | `/calendar-management` | ✓ | ✗ | `LEAVE_POLICY_MANAGE` |
| Leave policy | `/admin/leave-policy` | ✓ | ✗ | `LEAVE_POLICY_MANAGE` (**promote from buried**) |
| Attendance rules | `/attendance-rules` | ✓ | ✗ | `ATTENDANCE_RULE_MANAGE` (**promote from buried**) |

#### Group E — Pay & docs

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Payroll | `/admin-payroll` | ✓ | ✗ | `PAYROLL_VIEW_ALL` |
| Documents | `/documents` (hub) | ✓ | ✓ (library + requests; templates Manager-prefer) | `EMPLOYEE_VIEW_ALL` / document access helpers |
| ID cards | `/id-card-generator` | ✓ | ✓ | `ID_CARD_MANAGE` |
| Benefits | `/benefits` | ✓ | ✓ | Gate with manage + route perms (fix open route) |

#### Group F — Plan & analyze

| Label | Path | Manager | Executive | Permissions |
|-------|------|---------|-----------|-------------|
| Workforce planning | `/workforce` | ✓ | ✗ or read-only if API allows | HR Manager–level |
| Succession | `/succession` | ✓ | ✗ or read-only | HR Manager–level |
| HR reports | `/admin/reports` | ✓ | ✓ (honest empty states) | `EMPLOYEE_VIEW_ALL` |
| Analytics | `/hr/analytics` | ✓ | ✓ | Same (**add to nav**; was dashboard-only) |

#### Group G — Personal (optional strip)

| Label | Path | Manager | Executive | Notes |
|-------|------|---------|-----------|-------|
| My payroll | `/employee-payroll` | ✓ | ✓ | Keep for convenience **or** move fully to Me portal — confirm |
| Leave & attendance (self) | `/employee/leave-attendance` | — | — | **Remove from HR nav**; use Me portal |

#### Explicitly out of HR nav (Admin / URL only)

| Item | Why |
|------|-----|
| Settings, Subscription, Role hierarchy, Users & roles | Org-owner / Admin portal (unless D1 keeps Manager powers — then optional “HR settings” subset) |
| Approval workflow **definitions** | Admin config; HR uses **Pending approvals** |
| Projects | Hidden (D6) |
| Salary structure | Finance / Admin unless D1 retains payroll edit |
| Company policies CRUD | Link from Documents/Policies secondary nav or Admin; optional later |

### 1.3 Visual / IA sketch (sidebar)

```
HR
├── Dashboard
├── People
│   ├── Employees
│   └── Organization
├── Hire & lifecycle
│   ├── Recruitment
│   ├── Employee lifecycle
│   └── Learning
├── Engage & support
│   ├── Engagement
│   ├── Helpdesk          ← NEW
│   ├── Announcements     ← NEW
│   └── One-on-One
├── Time
│   ├── Leave management
│   ├── Pending approvals
│   ├── Attendance
│   ├── Regularization/WFH
│   ├── Calendar          (Manager)
│   ├── Leave policy      (Manager) ← PROMOTED
│   └── Attendance rules  (Manager) ← PROMOTED
├── Pay & docs
│   ├── Payroll           (Manager)
│   ├── Documents         ← MERGED HUB
│   ├── ID cards
│   └── Benefits
└── Plan & analyze
    ├── Workforce         (Manager)
    ├── Succession        (Manager)
    ├── HR reports
    └── Analytics         ← NEW IN NAV
```

Implementation note: current `Header` uses a flat list. Phase 2 can ship **flat list with section labels** first (minimal change), then optional collapsible groups.

---

## 2. Proposed dashboard (`/dashboard-hr`)

### 2.1 Goals

One composition for HR daily work: **what needs action**, **org pulse**, **shortcuts that match nav**.

### 2.2 Layout (desktop → stack on mobile)

| Zone | Content | Actions |
|------|---------|---------|
| **Header** | Greeting, org name, date | Notifications, Helpdesk, Profile (keep) |
| **Action queue** | Pending approvals (incl. escalated), leave awaiting decision, regularization count, open helpdesk tickets, document requests pending | Deep links with counts |
| **People pulse** | Headcount, present/leave/remote today, open positions, recent hires | → Employees, Attendance, Recruitment |
| **Hiring & lifecycle** | Open jobs, pipeline summary, onboarding in progress, offboarding in progress | → Recruitment, Lifecycle |
| **Engage** | Latest announcement, celebration today | Send announcement, Wish |
| **Insights** | Mini charts from **real** analytics only; empty state if no data | → Reports / Analytics |
| **Quick actions** | Permission-filtered chips | Add employee, Leave review, Approvals, Recruitment, Documents, Payroll (Manager), Leave policy / Rules (Manager) |

### 2.3 Dashboard rules (from audit)

- Remove or relabel misleading controls  
- No fake chart fillers  
- Quick actions must match D1/D2 permission reality  
- Announcements: keep modal + link to full Announcements page  

### 2.4 What we stop doing on the dashboard

- Duplicating full Admin KPI walls without actionability  
- Linking to `/hr/analytics` with a download icon elsewhere (fix in reports shell)  

---

## 3. Proposed screen list

### 3.1 Keep (rebuild/polish in place — preserve all features)

| Screen | Path | Phase 2 work |
|--------|------|--------------|
| HR Dashboard | `/dashboard-hr` | Restructure zones; honest empty; a11y |
| Employees + detail + add | `/employees`, `/:id`, `/add-employee` | Shared Admin logic; `cm-hrms` wrapper; fix unused icons |
| Org chart | `/organization/chart` | Shell consistency |
| Recruitment suite | `/recruitment/*` | Already strong; a11y, loading/empty polish |
| Lifecycle hubs | `/onboarding` (+ embedded) | Fix disabled pagination; clarify Executive vs Manager; restore Configure only for entitled users |
| Learning | `/learning`, create/edit | Gate routes; HR shell |
| Engagement suite | `/engagement/*` | Gate routes; empty/error |
| Leave management | `/leave-management` | Shell; clarify admin-only decisions |
| Leave policy / balance / reports | `/admin/leave-*` | Promote policy in nav; polish |
| Attendance history / today / rules / regularization | existing paths | Shell; export keep |
| Payroll (Manager) | `/admin-payroll` (+ add/update) | Keep CEO disburse rule; shell |
| Documents library + versions | `/documents`, versions | Become hub home |
| Document requests | `/hr/document-requests` | Tab inside Documents hub |
| Templates / Doc management | `/admin/document-*` | Merge into Documents hub tabs |
| ID cards | `/id-card-generator` | Shell |
| Benefits | `/benefits`, `/:id` | Gate open route |
| Succession / Workforce | `/succession*`, `/workforce*` | Manager-focused; honest empty |
| Helpdesk | `/helpdesk` | Add to nav; loading/empty |
| Pending approvals | `/admin/pending-approvals` | Shell |
| Announcements | `/sent-announcements` | Add to nav |
| HR reports + analytics | `/admin/reports/*`, `/hr/analytics` | **Kill mock data**; real empty; optional export later |
| One-on-One | `/one-on-one` | Keep |

### 3.2 Merge

| From | Into | Result |
|------|------|--------|
| `/documents` + `/admin/document-management` + `/hr/document-requests` + templates | **Documents hub** at `/documents` | Tabs: Library \| Requests \| Templates; redirect old paths |
| Leave Mgmt regularization tab + standalone route | Keep both URLs | Same component; one UX pattern |
| `/dashboard/hr` alias | Prefer `/dashboard-hr` | Keep alias for bookmarks |

### 3.3 Add (IA only — reuse existing pages)

| Screen | Path | Notes |
|--------|------|-------|
| Helpdesk in sidebar | `/helpdesk` | Exists |
| Announcements in sidebar | `/sent-announcements` | Exists |
| Analytics in sidebar | `/hr/analytics` | Exists |
| Leave policy in sidebar | `/admin/leave-policy` | Exists |
| Attendance rules in sidebar | `/attendance-rules` | Exists |

### 3.4 Hide / remove from HR IA

| Item | Action |
|------|--------|
| Self “Leave & attendance” in HR nav | Remove (Me portal) |
| Projects | Stay filtered out |
| Mock Performance / Compliance fillers | Empty states only; Compliance either wire API or mark “Coming soon” |
| Lifecycle Configure/Enterprise | Show only when `canAccessLifecycleEnterprise` / configure perms — not permanently stripped for Managers who should have them |

### 3.5 Defer (not in Phase 2 rebuild)

| Item | Reason |
|------|--------|
| Grievances module | No backend/UI |
| Full Performance / OKR product | APIs only |
| SLA Manager UI routing | Orphan Admin files |
| Buddy dashboard / leave encashment routes | Unrouted |
| New visual brand unrelated to `cm-hrms` | Must extend Admin/shared system |

---

## 4. Design system reuse (no Admin audit doc)

Reuse and extend (do **not** duplicate):

| Asset | Path / pattern |
|-------|----------------|
| Corporate Modern tokens | `vite_client/src/styles/corporateModern.css` (`.cm-hrms`, `.cm-card`, banners, labels) |
| ATS / recruitment UI | `styles/recruitmentUI.css`, Recruitment pages |
| Lifecycle UI | `styles/lifecycleUI.css`, Onboarding/Offboarding hubs |
| Shared chrome | `Shared/Header.jsx`, portal switcher (`portalConfig.js`) |
| Shared Admin business pages | Employees, Leave, Attendance, Payroll, Approvals — wrap, don’t fork |
| Patterns to standardize | Page header, KPI row, filter bar, data table, empty/error/loading, confirm modal, permission-gated buttons |

**Visual direction:** Keep existing mint/teal HR language (`#20C997` family from DashboardHR/reports). Align Admin-shared screens via wrapper classes, not a new purple/cream theme.

**Accessibility (WCAG AA):** Visible focus, `aria-label` on icon buttons, keyboard for modals/drawers, sufficient contrast, responsive tables (card/stack or scroll with caption).

**States:** Every list/detail screen gets loading, empty, and error+retry — no silent `[]`, no fake KPIs.

---

## 5. Permissions enforcement plan (paired with UI)

| Layer | Change |
|-------|--------|
| Routes | Add `requiredPermissions` to currently open manage routes (`engagement`, learning create, benefits, succession, workforce, helpdesk manage entry) |
| Nav | Every `HR_NAV_ITEMS` entry declares `permissions`; Executive filter uses flags + perms |
| Backend | Align D1/D2: adjust `HR_MANAGER_PERMS` / `HR_EXECUTIVE_PERMS` if you approve trim/grant |
| Frontend | Prefer permission flags over dept-title `isHR()` for gating actions |
| Documents | Single access helper for hub tabs |

No other roles rebuilt unless a shared component change is required for HR — call those out per commit.

---

## 6. Rebuild order (small commits after confirmation)

| Step | Module | Outcome |
|------|--------|---------|
| 0 | Proposal confirmed (this doc) | Locked IA + D1–D7 |
| 1 | Nav + portal + route gates | New sidebar; open-route fixes; nav hole fix |
| 2 | Dashboard | New zones; honest data |
| 3 | Documents hub | Merge three surfaces |
| 4 | Leave & attendance & approvals | Nav promotions; shell; a11y |
| 5 | Recruitment polish | States/a11y only unless bugs |
| 6 | Lifecycle | Pagination fix; role-appropriate configure |
| 7 | Engagement + Learning + Helpdesk + Announcements | Gates + polish |
| 8 | Benefits + Workforce + Succession | Manager gates; empty states |
| 9 | Payroll (Manager) + ID cards | Shell; keep CEO disburse |
| 10 | Reports & analytics | Remove mocks; empty states; fix download affordance |
| 11 | Permission map alignment | Backend D1/D2 if approved |

Each step: one or few commits + short summary (per your Phase 2 rules).

---

## 7. Success criteria

- HR Manager and HR Executive can complete daily ops without Admin portal (within D1/D2)  
- No manage screen reachable with empty role+permission gates  
- No fake report numbers  
- Documents: one place  
- Helpdesk + Announcements discoverable  
- WCAG AA on rebuilt shells; mobile-usable tables/filters  
- All pre-Phase-2 HR features still work  

---

## 8. Confirmation checklist

Please reply with:

1. **Accept recommended D1–D7** — or list overrides  
2. **Approve sidebar groups** — or mark items to add/remove  
3. **Approve dashboard zones** — or mark changes  
4. **Approve screen keep/merge/add/defer** — or mark changes  
5. Explicit: **“Proceed to rebuild starting with Step 1 (Nav)”**

Until (5), no application code will be changed for the redesign.

---

*End of Phase 2 Step 1 proposal.*
