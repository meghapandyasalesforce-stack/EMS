# Employee Portal — Phase 2 Proposal

**Status:** Awaiting confirmation (Step 1 only — no UI rebuild until explicitly approved)  
**Date:** 2026-10-26  
**Based on:** `docs/employee-audit.md` (Phase 1 approved)  
**Design reuse:** Admin/shared `cm-hrms` system (`vite_client/src/styles/corporateModern.css`, `components/corporateModern`) — `docs/admin-audit.md` does not exist  
**Parallel:** Same structure as `docs/hr-phase2-proposal.md`

---

## Executive summary

Phase 2 redesigns the **Me (Employee) portal** as a **mobile-first** self-service experience: fewer primary destinations, a clear home dashboard, merged document surfaces, and security fixes from the audit — while **preserving all existing functionality**.

This document proposes:

1. **Navigation** — primary + More, optional mobile bottom bar  
2. **Dashboard** — punch, action queue, balances, pay, pulse  
3. **Screen list** — keep / merge / add / hide / defer  

**Please confirm or edit this proposal (D1–D8 + checklist) before any redesign code starts.**

---

## Product decisions (need your yes/no)

These drive nav, security commits, and scope. Recommended defaults from the audit:

| # | Decision | Recommended default | Your choice |
|---|----------|---------------------|-------------|
| **D1** | Fix IDOR **before or with** first UI modules? (encashment history, attendance PDF, 360 feedback) | **With first security commit**, before polish | ☐ With UI / ☐ Security-only first |
| **D2** | Remove `leave.view.team` from pure `EMPLOYEE_PERMS`? | **Yes** — leave-management stays Manager/HR only | ☐ Yes remove / ☐ Keep |
| **D3** | **Documents** — one hub vs three nav entries? | **One hub** (`/employee/documents`) with tabs: My docs \| ID card \| Requests \| Policies | ☐ One hub / ☐ Keep separate |
| **D4** | Put **Helpdesk** in primary Me nav? | **Yes** (audit: exists, undiscoverable) | ☐ Yes / ☐ More menu only |
| **D5** | Ship **Expenses** UI in Phase 2? | **Defer** (API exists; no ESS screen today) | ☐ Defer / ☐ Build MVP |
| **D6** | Ship **Form 16 / My Assets / Resignation / Org directory / Performance UI**? | **Defer all** except optional read-only directory later | ☐ Defer all / ☐ Pick subset: ___ |
| **D7** | Wire **Leave encashment** into Leave hub? | **Yes** (component exists, unwired) | ☐ Wire / ☐ Defer |
| **D8** | Mobile **bottom nav** (5–6 destinations) + desktop sidebar? | **Yes** — employees are phone-first | ☐ Bottom + sidebar / ☐ Sidebar only |

Reply with D1–D8 choices (or **“accept all recommended”**) when confirming.

---

## 1. Proposed navigation

### 1.1 Principles

- **Mobile-first:** ≤6 primary destinations; everything else under **More**
- Group by **job** (Time, Pay, Me, Work), not legacy Admin paths  
- Every non-ESS manage URL gets real `requiredPermissions` (close HR `/engagement` shell to pure employees)  
- Preserve all current functionality; aliases redirect to canonical paths  
- Do **not** put Manager/HR approve screens in Me nav  
- Do **not** touch other role portals unless a shared component fix is required (call out per commit)

### 1.2 Primary destinations (always visible)

| Label | Path | Notes |
|-------|------|--------|
| Home | `/dashboard-employee` | Punch + action queue |
| Time | `/employee/leave-attendance` | Leave + attendance + WFH + regularization (merge today’s split) |
| Pay | `/employee-payroll` | Payslips / breakup |
| Docs | `/employee/documents` | **Merged hub** (D3) |
| More | `/employee/more` **or** sheet | Secondary modules |

**If D4 = Yes:** insert **Help** → `/helpdesk` in primary (e.g. 5-item bar: Home · Time · Pay · Help · More, or Home · Time · Pay · Docs · More with Help under More).

### 1.3 “More” / secondary (permission-filtered)

| Label | Path | Keep? |
|-------|------|--------|
| Profile | `/profile-details` | Yes (also Header) |
| Notifications | `/notifications` | Yes |
| Helpdesk | `/helpdesk` | Yes (primary if D4) |
| Calendar | `/employee/calendar` | Yes |
| Projects | `/employee/projects` | Yes |
| Benefits & learning | `/employee/benefits-learning` | Yes |
| Engagement | `/employee/engagement` | Yes (ESS page only — not HR `/engagement`) |
| Internal jobs | `/employee/internal-jobs` | Yes |
| My lifecycle | `/onboarding` | Yes |
| One-on-One | `/1-on-1` (invitee) | Prefer `/1-on-1` for pure employees; keep `/one-on-one` for organizers |
| Policies | → Docs hub tab | If D3 merge |
| Celebrations | `/celebrations` | Deep-link / dashboard, not nav |
| Daily report | `/daily-report` | More only |

### 1.4 Explicitly out of Me nav

| Item | Why |
|------|-----|
| `/leave-management`, team attendance admin, employees list, org chart | Manager/HR |
| HR `/engagement` manage shell | Gate with manage perms |
| Expenses / Assets / Form 16 / Performance / Directory | Defer (D5–D6) unless overridden |

### 1.5 IA sketch

```
Me (Employee) — mobile bottom bar
├── Home          /dashboard-employee
├── Time          /employee/leave-attendance   ← includes WFH & regularization
├── Pay           /employee-payroll
├── Docs          /employee/documents          ← merged hub
└── More
    ├── Profile, Notifications, Helpdesk*
    ├── Calendar, Projects
    ├── Benefits & learning, Engagement
    ├── Internal jobs, Lifecycle, 1:1
    └── Daily report

* Helpdesk in primary if D4 = Yes
```

Desktop: same items in sidebar with **section labels** (Home · Time & pay · Documents · Work · Account), reusing `Header` + `cm-hrms` — no new design language.

Implementation note: current `Header` uses a flat list. Phase 2 can ship **flat list with section labels** + optional **bottom nav** first, then refine.

### 1.6 Route cleanup (redirects, keep bookmarks)

| Legacy | Canonical |
|--------|-----------|
| `/my-leave`, `/attendance-stats` | `/employee/leave-attendance` |
| `/my-attendance-regularization` | Hub tab **or** keep URL but remove from primary nav (open from Time) |
| `/employee/documents-id`, `/employee/id-card`, `/employee/my-documents`, `/employee/document-requests`, `/employee/policies` | Docs hub tabs + redirects |
| `/dashboard/employee` | `/dashboard-employee` |

---

## 2. Proposed dashboard (`/dashboard-employee`)

### 2.1 Goals

One phone-first composition: **Am I punched in?** → **What needs me?** → **Balances & pay** → **Company pulse**.

### 2.2 Layout (stack on mobile; 2-col on desktop)

| Zone | Content | Actions |
|------|---------|---------|
| **Top bar** | Greeting, photo | Notifications, Helpdesk, Profile |
| **Punch card** | Status, Office/Home, In/Out, break | Same as `AttendanceBox` (add punch-out confirm) |
| **Action queue** | Pending leave, open regularization/WFH, lifecycle tasks due, unread policies, open helpdesk tickets | Deep links + counts |
| **Balances** | Leave balance chips, month attendance snapshot | → Time hub |
| **Pay snapshot** | Latest payslip status / “View payslip” | → Pay |
| **Work** | My projects (top 3), today’s tasks | → Projects |
| **Pulse** | Announcements feed, celebrations today | Mark read, wish/react |
| **Shortcuts** | Apply leave, Regularize, Docs, Learning, Jobs, 1:1 | Permission-filtered |

### 2.3 Dashboard rules (from audit)

- Replace **localStorage-only Todo** with action queue from real APIs (or label clearly as “device-only” / remove)  
- Loading / error / empty on every zone (no silent fail on mark-read)  
- WCAG AA: labeled icon buttons, focus order, contrast on punch CTAs  
- Do **not** show other employees’ salary or team admin widgets  

### 2.4 What we stop doing on the dashboard

- Silent notification mark-read failures  
- Unlabeled “todo” that looks like company tasks but is browser-local only (unless explicitly labeled)  
- Deep links to Manager/HR-only screens for pure employees  

---

## 3. Proposed screen list

### 3.1 Keep (rebuild/polish in place — preserve all features)

| Screen | Path | Phase 2 work |
|--------|------|--------------|
| Employee dashboard | `/dashboard-employee` | Zones above; mobile; a11y |
| Leave & attendance hub | `/employee/leave-attendance` | Absorb WFH + regularization UX; wire encashment if D7 |
| Leave apply | `/leave` | Keep; polish; optional confirm |
| Payroll | `/employee-payroll` | Shell; empty/error already decent |
| Profile tabs + security + photo | `/profile-details` (+ aliases) | Shell; fix password min consistency; wire NoK/Guarantor **or** drop |
| View profile | `/view-profile` | **Fix broken Download** |
| Engagement ESS | `/employee/engagement` | Polish; survey take |
| Benefits & learning + course | hub + `/learning/courses/:id` | Shell |
| Internal jobs + detail | `/employee/internal-jobs*` | Keep |
| Projects + tasks | `/employee/projects*` | Keep |
| Calendar | `/employee/calendar` | Keep |
| Lifecycle | `/onboarding` | Employee ops only; clear tasks |
| 1:1 invitee | `/1-on-1` | Prefer for pure employee |
| Helpdesk | `/helpdesk` | Nav discoverability; cancel confirm |
| Notifications / celebrations / policies | existing | Policies → hub if D3 |
| Daily report | `/daily-report` | More menu |

### 3.2 Merge

| From | Into | Result |
|------|------|--------|
| `/employee/documents-id` + `/employee/my-documents` + `/employee/document-requests` + `/employee/policies` | **Documents hub** at `/employee/documents` | Tabs: My docs \| ID card \| Requests \| Policies; redirect old paths |
| WFH & Regularization primary nav + hub tabs | **Time hub** | Keep deep URL `/my-attendance-regularization`; remove from primary nav |
| Duplicate payroll / leave / calendar orphans | Delete or redirect after feature parity | Clean tree |
| `/dashboard/employee` alias | Prefer `/dashboard-employee` | Keep alias for bookmarks |

### 3.3 Add (IA / security — mostly existing code)

| Screen / item | Path / work | Notes |
|---------------|-------------|-------|
| More menu / sheet | `/employee/more` or sheet | Secondary nav |
| Mobile bottom nav | Shell | If D8 |
| Backend ownership helper | Middleware | `assertSelfOrElevated` on IDOR routes (D1) |
| Leave encashment in Time hub | Hub tab / section | If D7 |
| Route gates | `routes/index.jsx` | Close HR manage shells to pure employees |

### 3.4 Hide / remove from Me IA

| Item | Action |
|------|--------|
| Separate “WFH & Regularization” top-level | Demote into Time |
| Triple document nav entries | Merge (D3) |
| Orphan unwired screens left dangling | Wire (encashment) or remove from tree |
| Pure employee access to `/leave-management` | Remove via D2 |

### 3.5 Defer (not in Phase 2 rebuild unless you override D5–D6)

| Item | Reason |
|------|--------|
| Expenses UI | API only; product scope |
| Form 16 / tax doc center | Admin statutory only today |
| My Assets inventory | No ESS registry |
| Resignation self-service | HR-initiated offboarding only |
| Org directory / chart for employees | Manager+ gated |
| Full Performance / OKR / 360 product UI | APIs without ESS routes |
| Confidential grievances module | Helpdesk only |
| Shift preference / swap | Admin assigns |
| New visual brand unrelated to `cm-hrms` | Must extend Admin/shared system |

---

## 4. Design system reuse (no Admin audit doc)

Reuse and extend (do **not** duplicate):

| Asset | Path / pattern |
|-------|----------------|
| Corporate Modern tokens | `vite_client/src/styles/corporateModern.css` (`.cm-hrms`, `.cm-card`, banners, labels) |
| Shared components | `vite_client/src/components/corporateModern` (`CmButton`, `CmEmpty`, `CmBadge`, `CmStat`, …) |
| Shared chrome | `Shared/Header.jsx`, portal switcher (`portalConfig.js`), `safe-area-*` in `index.css` |
| Existing ESS patterns | LeaveAttendanceHub, EmployeePayroll, DocumentsAndIdPage, BenefitsLearningHub |
| Patterns to standardize | Page header, action queue, filter chips, card lists (mobile), empty/error/loading, accessible confirm modal, permission-gated buttons |

**Visual direction:** Keep existing mint/teal ESS language (`#20C997` family from employee dashboard). Align via wrapper classes, not a new purple/cream theme.

**Accessibility (WCAG AA):** Visible focus, `aria-label` on icon buttons, keyboard for modals/drawers, sufficient contrast, responsive tables (card/stack or scroll with caption). Mobile matters most for this role.

**States:** Every list/detail screen gets loading, empty, and error+retry — no silent `[]`, no fake KPIs.

---

## 5. Permissions & ownership enforcement plan (paired with UI)

| Layer | Change |
|-------|--------|
| Backend IDOR | Attendance PDF: self **or** manager/HR **+ org**; encashment history: self **or** elevated; 360 feedback: self / manager / HR |
| Backend helper | Shared `assertSelfOrElevated` (or equivalent) — stop ad-hoc-only ownership |
| Permission map | Strip `LEAVE_VIEW_TEAM` from `EMPLOYEE_PERMS` if D2 approved |
| Routes | Add `requiredPermissions` to currently open manage routes employees can hit by URL (`/engagement` HR shell, etc.) |
| Nav | Me primary/More declare intent; filter by permissions where needed (engagement) |
| Frontend | Never sole gate for ownership; `PermissionGate` for chrome only |
| Docs hub | Single access pattern for tabs |

No other roles rebuilt unless a shared component change is required — call those out per commit.

---

## 6. Rebuild order (small commits after confirmation)

| Step | Module | Outcome |
|------|--------|---------|
| 0 | Proposal confirmed (this doc) | Locked IA + D1–D8 |
| 1 | **Security** | IDOR fixes + D2 perm strip + route gates |
| 2 | **Shell** | Me nav + optional bottom bar + More |
| 3 | **Dashboard** | Zones; loading/empty; punch-out confirm; mark-read toasts |
| 4 | **Time hub** | Merge regularization/WFH UX; encashment if D7 |
| 5 | **Documents hub** | Merge four surfaces + redirects |
| 6 | **Pay + Profile** | Shell; ViewProfile download; password min consistency |
| 7 | **Work & engage** | Projects, Learning/Benefits, Engagement ESS, Jobs, 1:1, Lifecycle |
| 8 | **Helpdesk + Notifications** | Nav discoverability; cancel confirm; a11y pass |

Each step: one or few commits + short summary (per Phase 2 rules). Preserve **all** existing ESS functionality; add audit fixes only.

---

## 7. Success criteria

- Pure Employee can complete daily self-service on a phone without Manager/HR screens  
- No IDOR on attendance PDF, encashment history, or 360 feedback  
- Pure employees cannot open Leave Management via `leave.view.team` (if D2)  
- Documents: one place (if D3)  
- Helpdesk discoverable (if D4)  
- WCAG AA on rebuilt shells; loading / empty / error on core screens  
- All pre-Phase-2 Employee features still work  
- Other roles untouched except documented shared fixes  

---

## 8. Confirmation checklist

Please reply with:

1. **Accept recommended D1–D8** — or list overrides  
2. **Approve primary nav + More** — or mark items to add/remove / keep separate  
3. **Approve dashboard zones** — or mark changes  
4. **Approve screen keep/merge/add/defer** — or mark changes  
5. Explicit: **“Proceed to rebuild starting with Step 1 (Security)”** (or Step 2 Shell if you prefer UI-first after a security-only PR)

Until (5), no application code will be changed for the Employee redesign.

---

## Related docs

| Doc | Role |
|-----|------|
| `docs/employee-audit.md` | Phase 1 audit (source of truth for gaps) |
| `docs/hr-audit.md` / `docs/hr-phase2-proposal.md` | Parallel HR work; ESS items stay in Me portal |
| `docs/HRMS_LAUNCH_AUDIT.md` | Broader launch findings |

---

*End of Phase 2 Step 1 proposal.*
