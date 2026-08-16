# Employee Engagement Module Expansion Plan
## Approval-Ready Product & Technical Plan

**Baseline:** Existing `/engagement` module  
**Approach:** Extend / enhance — not greenfield  
**Status:** Planning only — approved for Phase 1 development sequencing

---

## 1. Executive Summary

The Employee Engagement module **already exists** in this HRMS. It is not a new product surface. This initiative is an **expansion and hardening** of:

- Frontend: `vite_client/src/HR/Engagement/`
- APIs: `/api/v1/both/engagement/*`, `/api/v1/admin/engagement/*`
- Models: `Survey`, `SurveyResponse`, `Feedback`, `Recognition`

**Currently working:** Surveys (create, target, respond, status lifecycle) and Feedback (submit, anonymous flag, HR reply, status workflow).

**Incomplete:** Recognition (API only), analytics (API only, no Engagement dashboard), Pulse (type label only), 360 (placeholder), employee-facing home/inbox, notifications, granular permissions.

**Critical blocker:** Anonymous feedback still stores employee identity. This must be fixed before expanding anonymous or manager/team analytics.

**Phase 1 delivers:** Privacy fix → employee engagement experience → survey/pulse improvements + eNPS → peer recognition + wall → suggestions workflow → privacy-safe analytics dashboard → notifications → granular permissions. Advanced items (events, wellbeing, rewards, AI, etc.) stay deferred.

---

## 2. Current vs Proposed

| Area | Current State | Proposed Phase 1 | Future Phase |
| ---- | ------------- | ---------------- | ------------ |
| Surveys | Working MVP (types, targeting, respond, anonymous) | Improved builder, eNPS question type, clearer employee inbox | Lifecycle-linked auto surveys, multi-language |
| Pulse Surveys | Type label on Survey only | Reminders + expiry enforcement | Full recurrence scheduler, templates library |
| Feedback | Working MVP; identity leak on anonymous | Privacy-safe anonymous + clearer employee/HR flows | Sentiment tagging |
| Suggestions | Feedback type `Suggestion` only | Dedicated status workflow on Feedback (or subtype) | Owner assignment, implementation tracking UI |
| Recognition | Backend create/list; no UI; HR-only create | Peer give + recognition wall (+ basic reactions optional if low risk) | Comments depth, badges, points economy |
| Analytics | API + thin HR Analytics usage | Engagement analytics dashboard (org + privacy-safe team) | Heatmaps, attrition correlation, benchmarking |
| Notifications | None for engagement | Registry events for survey/feedback/recognition/suggestion | Digests, digests preferences |
| Employee Engagement Home | None (HR-centric `/engagement`) | Employee home: surveys, feedback, recognition, suggestions | Activity feed expansion |
| Permissions | Single `engagement.manage` | Granular participate / manage / team analytics / org analytics | Config & rewards permissions |
| Privacy | Partial survey anonymity; feedback leak | Fix anonymous feedback; k-anonymity thresholds | Sealed HR access + stronger audit |
| Events / RSVP | Not in engagement | Deferred | New event module |
| Wellbeing | Missing | Deferred | Aggregated check-ins |
| Manager Effectiveness | 360 stub only | Deferred | Dedicated surveys + thresholds |
| Action Plans | Missing | Deferred | HR action plans tied to metrics |
| Badges | Field on Recognition only | Deferred | Configurable badge catalog |
| Rewards | Points field only | Deferred | Catalog + redemption (non-payroll) |
| AI | Missing | Deferred | Sentiment, summaries, insights |

---

## 3. Phase 1 Scope

Phase 1 is limited to these items only:

1. **Anonymous feedback privacy fix** (blocker)
2. **Employee engagement home**
3. **Employee survey inbox**
4. **Improved survey builder** (usability + question type gaps needed for eNPS)
5. **eNPS support** (first-class question type + analytics)
6. **Pulse reminders / expiry** (cron + notify; not full recurrence engine)
7. **Peer-to-peer recognition**
8. **Recognition wall**
9. **Suggestions workflow** (extend Feedback; do not invent a second product)
10. **Engagement analytics dashboard** (consume existing analytics API + extend as needed)
11. **Engagement notifications** (via existing `notify()` / registry)
12. **Granular permissions** (extend `permissions.constants.js` + client mirror)
13. **Privacy-safe analytics** (minimum response thresholds)

**Out of Phase 1:** events, wellbeing, action plans, badges, rewards, manager effectiveness, heatmaps, attrition, AI, confidential concerns system, social feed, One-on-One rebuild.

---

## 4. Features Explicitly Deferred

| Feature | Why deferred |
|---------|----------------|
| Events & RSVP | No existing event/RSVP stack; large new surface; not required to complete survey/feedback/recognition loop |
| Wellbeing | Sensitive health-adjacent data; needs separate privacy design |
| Action Plans | Depends on stable metrics + thresholds first |
| Badges | Recognition wall value first; catalog is config-heavy |
| Rewards / redemption | Gamification + finance expectations; must stay payroll-isolated |
| Manager Effectiveness | Needs strong anonymity + thresholds; 360 is only a stub |
| Advanced heatmaps | Re-identification risk until thresholds proven |
| Engagement vs attrition | Needs retention analytics integration; Phase 3 analytics |
| AI sentiment / recommendations | Depends on quality labeled data + privacy review |
| Advanced benchmarking | SaaS/cross-tenant; not needed for org MVP |
| Full social engagement feed | Reuse Announcements for now |
| Separate confidential concerns | Overlaps Helpdesk; avoid duplicate case systems |
| Rebuild One-on-One | Already complete as its own module |

---

## 5. Existing Functionality That Must Be Reused

| System | Integration rule |
|--------|------------------|
| **One-on-One** | Remain separate. Engagement may link (“Schedule 1:1”) later; never fork models/UI. |
| **Helpdesk** | Service tickets stay in Helpdesk. Engagement Feedback = voice/suggestions/complaints; do not rebuild SLA ticketing. |
| **Announcements** | Company broadcasts stay in notification/announcement flows. No parallel “engagement feed” in Phase 1. |
| **Birthday / anniversary jobs** | Keep `specialEventNotificationJob` + registry events. Celebrations wall is future. |
| **Notification infrastructure** | All new alerts via `notify()` + `notificationEventRegistry` + email/push. |
| **Employee / Organization models** | Targeting, tenure, dept, `managerId`, org scoping — reuse only. |
| **Analytics infrastructure** | Extend engagement analytics + optional HR Analytics widgets; don’t invent a second analytics platform. |
| **Permission framework** | Add keys beside `ENGAGEMENT_MANAGE`; enforce with `requirePermission` / existing maps. |

---

## 6. Employee Experience

**Proposed employee navigation (conceptual):**

```text
Employee Engagement
├── Home (summary: pending surveys, recent recognition, open feedback)
├── My Surveys (inbox + take survey)
├── Give Feedback / My Feedback
├── Suggestions (submit + track status)
├── Give Recognition
└── Recognition Wall
```

**Employees can:**

- See assigned / targeted Active surveys and submit responses
- Submit identified or anonymous feedback (true anonymity after privacy fix)
- Submit/track suggestions
- Give recognition to colleagues; view public recognition wall
- View own recognition received/given
- Receive engagement notifications

**Employees cannot:**

- Create/edit org surveys or org config
- View others’ anonymous identities
- View raw team/manager response lists below threshold
- Access org-wide engagement analytics (unless also HR/admin)
- Manage rewards/badges/events (deferred)

**Note:** Today `/engagement` is HR-oriented. Phase 1 adds a clear employee experience (dedicated routes/nav) while keeping HR management under the existing engagement area.

---

## 7. HR Experience

```text
HR / Admin Engagement
├── Engagement Dashboard (KPIs: participation, eNPS, open feedback, recognition volume)
├── Survey Management (existing create/list/detail + improvements)
├── Survey Results (aggregates; raw responses only with proper permission)
├── Feedback Management (existing + privacy-safe anonymous display)
├── Suggestions Queue (filtered Feedback workflow)
├── Recognition Management (moderate/approve if policy requires; monitor wall)
├── Analytics (privacy-safe org + optional dept slices)
└── Configuration (thresholds, recognition categories, notification toggles — minimal)
```

Managers (line) get **team-level aggregate analytics only** when permitted — not anonymous raw feedback identity, not org config.

---

## 8. Permission Matrix

Map proposed access to the **existing permission framework** (extend beyond single `engagement.manage`).

### Proposed permission keys (Phase 1)

| Key | Intent |
|-----|--------|
| `engagement.survey.take` | Respond to assigned surveys |
| `engagement.survey.manage` | Create/update/close surveys, view results |
| `engagement.feedback.submit` | Submit feedback/suggestions |
| `engagement.feedback.manage` | HR review/reply/status |
| `engagement.recognition.give` | Peer recognition |
| `engagement.recognition.manage` | Moderate recognition / approve if required |
| `engagement.analytics.team` | Aggregated team metrics (thresholded) |
| `engagement.analytics.org` | Org engagement dashboard |
| `engagement.manage` | Keep as umbrella / backward compatible for HR nav |

### Access matrix

| Feature | Employee | Manager | HR Executive | HR Manager | Admin |
| ------- | -------- | ------- | ------------ | ---------- | ----- |
| Survey participation | Yes (`survey.take`) | Yes | Yes | Yes | Yes |
| Survey management | No | No* | Yes | Yes | Yes |
| Feedback submit | Yes | Yes | Yes | Yes | Yes |
| Anonymous feedback submit | Yes | Yes | Yes | Yes | Yes |
| Feedback manage / reply | No | No | Yes | Yes | Yes |
| See anonymous identity | **Never** | **Never** | Policy: sealed/no by default in P1 | Same | Same |
| Give recognition | Yes | Yes | Yes | Yes | Yes |
| Recognition wall (public) | Yes | Yes | Yes | Yes | Yes |
| Recognition moderate | No | No | Yes | Yes | Yes |
| Suggestions submit/track own | Yes | Yes | Yes | Yes | Yes |
| Suggestions manage | No | No | Yes | Yes | Yes |
| Team analytics (thresholded) | No | Yes | Yes | Yes | Yes |
| Org analytics | No | No | Yes | Yes | Yes |
| Configuration (thresholds, categories) | No | No | Limited | Yes | Yes |

\*Managers do not manage org surveys in Phase 1 unless they also hold HR permissions.

Role mapping should use existing role buckets (`line_manager`, `hr_executive`, `hr_manager`, `org_owner`/admin) in `permissions.constants.js`, not hard-coded UI role strings alone.

---

## 9. Privacy Requirements

### Blocker: Anonymous feedback identity leak

**Current:** `employeeId` is stored even when `anonymous: true`; managers/HR can still resolve identity from data.

**Phase 1 requirement (must ship before anonymous expansion/analytics):**

- For anonymous submissions, **do not expose** `employeeId` (or name/email/dept that identifies) in any API response to managers or standard HR list views.
- Preferred design options (choose one in implementation; plan allows either):
  - **A (stronger):** Do not store `employeeId` on anonymous feedback; store an irreversible participation hash for abuse-rate limiting only.
  - **B (audit-oriented):** Store identity in a sealed field readable only by a break-glass permission + audit log (not Phase 1 default for managers).
- UI “Anonymous” label alone is **not** sufficient.

### Anonymous surveys

- Keep / harden: `SurveyResponse.employeeId = null` when survey is anonymous.
- Duplicate prevention must not re-identify (use opaque token/hash if needed).
- HR results for anonymous surveys: answers only; no employee populate.

### Manager / team / department analytics

- Aggregates only.
- **Minimum response threshold** (configurable, default **5**): if `n < threshold`, hide or show “Insufficient responses”.
- No drill-down to individuals from anonymous/manager-feedback datasets.
- Manager cannot see anonymous feedback identities for their team.

### HR visibility

- Identified feedback: HR can manage.
- Anonymous: content + category + status only (unless sealed break-glass — deferred).
- Org analytics: aggregates + eNPS + participation.

### Audit logging

- Log access to sealed identity (if ever enabled), recognition moderation, survey result exports.
- Prefer existing `auditLog` patterns where available.

### Data access restrictions

- All queries remain `organizationId`-scoped.
- Employee endpoints return only own feedback/suggestions and assigned surveys.
- Recognition wall: public approved only (existing `status: Approved`, `isPublic: true` pattern).

---

## 10. Notification Plan

**Reuse:** `notify()`, `notificationEventRegistry`, email queue, push, notification settings UI patterns.

### New registry events (Phase 1)

| Event | Audience | Purpose |
|-------|----------|---------|
| `engagement.survey.assigned` | Targeted employees | Survey available |
| `engagement.survey.reminder` | Non-respondents (identified surveys) / audience for anonymous | Reminder before end |
| `engagement.survey.closing` | Same | Closing soon |
| `engagement.feedback.received` | HR (manage permission) | New feedback/suggestion |
| `engagement.feedback.status_updated` | Submitter (if identified) | Status/reply change |
| `engagement.recognition.received` | Recipient | Peer recognition |
| `engagement.suggestion.status_updated` | Submitter | Suggestion workflow |

**Reuse as-is (do not rebuild):** announcements, birthday, work anniversary.

**Anonymous note:** Do not notify in ways that reveal identity; reminders for anonymous surveys must not require storing identity in response rows.

---

## 11. Technical Impact

### Models to extend

- `engagement.model.js` → `Survey` (eNPS question type; reminder metadata), `SurveyResponse` (anonymity hardening), `Feedback` (anonymous storage + suggestion statuses), `Recognition` (peer flow fields; optional reactions)

### APIs to extend

- Existing both/admin engagement routes for surveys, feedback, recognition, analytics
- Recognition **create** should move to employee-capable path (not HR-only)

### New APIs (minimal)

- Employee survey inbox (or clarified `GET surveys` contract)
- Peer recognition create + wall list filters
- Suggestion status transitions (or Feedback update with suggestion statuses)
- Analytics threshold query params / server-side enforcement
- Optional: recognition react endpoint (only if included as thin Phase 1)

### Frontend to modify

- `EngagementPage.jsx`, `CreateSurvey.jsx`, `SurveyDetailPage.jsx`, `FeedbackPanel.jsx`, `engagementUtils.js`
- `routes/index.jsx`, `navigationConfig.jsx`
- `permissions.js` (client) + `permissions.constants.js` (server)

### New frontend pages (conceptual)

- Employee Engagement Home
- Employee My Surveys / inbox (may be section of home)
- Recognition Wall + Give Recognition
- HR Analytics panel within Engagement (or tab)

### Jobs

- Pulse/survey reminder job
- Expiry job (Active → Closed when `endDate` passed)

### Notifications

- Register events in `notificationEventRegistry.js`; extend notification `type` enum only if required

### Analytics

- Extend `getEngagementAnalytics` + Engagement dashboard UI; optional light hooks in HR Analytics

---

## 12. Development Sequence

1. **Privacy & permission foundation** — Fix anonymous feedback; add permission keys; enforce on routes.  
   *Blocks all anonymous and analytics work.*

2. **Survey improvements** — eNPS question type; builder polish; expiry job.

3. **Employee survey experience** — Home + inbox + respond UX; targeting already exists.  
   *Depends on (2) for eNPS; permissions from (1).*

4. **Feedback / suggestions** — Privacy-safe APIs/UI; suggestion statuses; HR queue.  
   *Depends on (1).*

5. **Recognition** — Peer create + wall (+ moderate).  
   *Can parallelize after (1); independent of surveys.*

6. **Notifications** — Wire events for surveys/feedback/recognition/suggestions.  
   *Depends on flows in 3–5 existing.*

7. **Analytics dashboard** — Consume/extend analytics API with thresholds.  
   *Depends on (1) thresholds + enough survey/recognition data paths.*

8. **QA / security testing** — Anonymity, permission matrix, threshold edge cases, regression on Leave/Helpdesk/1:1/Announcements.

9. **Production rollout** — Feature-flag or permission-gated nav; monitor notification volume.

---

## 13. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Privacy leakage (anonymous identity) | **Critical** | Treat fix as Phase 1 gate; security test before release |
| Permission leakage (coarse HR middleware) | High | Granular keys + response shaping; deny-by-default for analytics |
| Re-identification via small cohorts | High | Default threshold ≥ 5; suppress small slices |
| Notification overload | Medium | Reminder cadence limits; respect notification settings |
| Analytics performance | Medium | Pre-aggregate where needed; date filters; indexes |
| Duplicate Helpdesk / 1:1 / Announcements | Medium | Explicit reuse boundaries in Phase 1 |
| DB growth (responses, wall) | Medium | Caps on list endpoints; archive Closed surveys later |
| Scope creep into events/rewards/AI | High | This approval locks Phase 1 list; deferrals mandatory |

---

## 14. Acceptance Criteria (Phase 1)

- Employee can open Engagement home and see pending assigned surveys.
- Employee can submit survey responses for Active, in-window, targeted surveys.
- eNPS questions can be added and contribute to Engagement analytics eNPS.
- Pulse/active surveys send reminder and honor end-date expiry (status Closed).
- Anonymous feedback **cannot** expose identity to managers (or in standard HR list payloads).
- Anonymous survey responses do not populate employee identity.
- Employee can give recognition to another employee in the same organization.
- Approved/public recognition appears on the Recognition Wall per visibility rules.
- Suggestions follow an explicit status workflow visible to submitter and HR.
- HR can view Engagement analytics dashboard (participation, eNPS, feedback, recognition).
- Team/department analytics hide results when below configured minimum response threshold.
- Engagement notifications deliver via existing notification infrastructure.
- Permissions distinguish participate vs manage vs team vs org analytics.
- One-on-One, Helpdesk, Announcements, birthday/anniversary behavior remain unaffected.
- No Events, Wellbeing, Rewards, AI, or confidential-concerns system shipped in Phase 1.

---

## 15. Final Approval Recommendation

**APPROVED FOR PHASE 1 DEVELOPMENT**

**Why this is safe and feasible:**

- Builds on a working Surveys + Feedback MVP and existing Recognition/Analytics APIs.
- Scope is capped to privacy, employee experience, recognition, analytics, notifications, and permissions.
- Reuses One-on-One, Helpdesk, Announcements, celebrations, notifications, employee/org data, and RBAC instead of duplicating them.
- Defers high-risk/high-effort surfaces (events, wellbeing, rewards, AI, manager effectiveness) until the core loop and anonymity model are proven.

**Guiding principle for delivery:**

**Extend existing module → Fix privacy → Add missing employee experience → Add recognition → Add analytics → Add notifications → Keep advanced features for later phases.**
