# Lifecycle Enterprise API

Base paths (relative to API root `/api/v1`):

| Scope | Prefix |
|-------|--------|
| Admin | `/admin/lifecycle` |
| Both (authenticated) | `/both/lifecycle` |
| Public | `/public/lifecycle` |

All admin endpoints require HR/Admin/Executive authentication unless noted.

---

## Enterprise bootstrap

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/lifecycle/enterprise/bootstrap` | Enable enterprise features, seed forms, install default packs |
| POST | `/admin/lifecycle/settings/seed` | Seed lifecycle defaults (includes bootstrap) |
| POST | `/admin/lifecycle/packs/auto-configure` | Auto-detect country/industry and install compliance packs |
| GET | `/admin/lifecycle/adapters` | List e-sign, BGV, LMS, access-revocation adapters |

---

## Onboarding — forms & goals (Phase A)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/lifecycle/onboarding/:workflowId/forms/status` | Mandatory form gate status |
| GET | `/admin/lifecycle/onboarding/:workflowId/goals` | Assigned probation goals |
| POST | `/admin/lifecycle/onboarding/:workflowId/goals` | Assign goals `{ goals: [{ title, goalType, category }] }` |
| POST | `/admin/lifecycle/onboarding/:workflowId/progress/refresh` | Recalculate forms/goals progress |
| GET | `/both/lifecycle/forms/:id` | Get published form definition |
| POST | `/both/lifecycle/forms/:id/submit` | Submit form `{ responses, employeeId, workflowId, workflowType }` |

Form gates block workflow completion at 100% until all mandatory forms are submitted.

---

## Onboarding — milestones, BGV, LMS

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/lifecycle/onboarding/:workflowId/milestones/review` | Submit 30/60/90 review |
| GET | `/admin/lifecycle/milestones/dashboard` | Org milestone dashboard |
| POST | `/admin/lifecycle/onboarding/:workflowId/lms/sync` | Sync LMS training completion |

---

## Offboarding — access, letters, alumni (Phase B)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/lifecycle/offboarding/:workflowId/access/auto-revoke` | Revoke all mandatory access via adapters |
| GET | `/admin/lifecycle/offboarding/:workflowId/letters/generated` | Auto-generated relieving/experience letters |
| GET | `/admin/lifecycle/alumni` | List alumni records + dashboard stats |
| POST | `/admin/lifecycle/alumni/:id/blacklist` | Blacklist `{ reason }` |
| POST | `/admin/lifecycle/alumni/:id/rehire` | Initiate rehire workflow |

Letters are auto-generated when offboarding completes (if templates are published).

---

## F&F & payroll bridge (Phase C)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/lifecycle/offboarding/:workflowId/fnf/calculate` | Calculate settlement (includes gratuity estimate) |
| POST | `/admin/lifecycle/offboarding/:workflowId/fnf/submit-approval` | Submit for approval |
| POST | `/admin/lifecycle/offboarding/:workflowId/fnf/pdf` | Generate F&F PDF |
| POST | `/admin/lifecycle/offboarding/:workflowId/fnf/payroll-bridge` | Create off-cycle payroll run linked to workflow |

---

## Exit interview & calendar (Phase D)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/lifecycle/exit-interviews/provision/:workflowId` | Provision sessions |
| GET | `/admin/lifecycle/exit-interviews/sessions?offboardingWorkflowId=` | List sessions |
| POST | `/admin/lifecycle/exit-interviews/sessions/:id/schedule` | Schedule with calendar invite |

Scheduled sessions may include `meetingUrl` and `icsUrl` for Teams/Google Meet.

---

## E-sign webhooks (Phase D)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/public/lifecycle/webhooks/esign/:provider` | DocuSign / Adobe Sign callback |

Configure webhook URL in your e-sign provider console. Provider slug: `docusign`, `adobesign`.

---

## Environment variables (adapters)

| Variable | Adapter |
|----------|---------|
| `DOCUSIGN_*`, `ADOBESIGN_*` | E-sign |
| `SPRINGVERIFY_*`, `AUTHBRIDGE_*`, `IDFY_*` | BGV |
| `AZURE_AD_*`, `GOOGLE_WORKSPACE_*`, `OKTA_*` | Access revocation |
| `MOODLE_*`, `TALENTLMS_*`, `DOCEBO_*` | LMS |

Adapters return structured stubs when credentials are not configured.

---

## Phase F — Enterprise completion

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/lifecycle/statutory/types` | List statutory document types |
| POST | `/admin/lifecycle/statutory/generate` | Generate Form 16, TDS, EPF, etc. |
| GET | `/admin/lifecycle/statutory/employee/:employeeId` | Employee statutory downloads |
| GET | `/admin/lifecycle/it/inventory` | Software inventory dashboard |
| POST | `/admin/lifecycle/onboarding/:id/software-requests` | Create software access request |
| POST | `/admin/lifecycle/onboarding/:id/software-requests/:requestId/approve` | Approve + create IT ticket |
| GET | `/admin/lifecycle/lms/dashboard` | LMS training dashboard |
| POST | `/admin/lifecycle/onboarding/:id/lms/assign-course` | Assign course |
| POST | `/admin/lifecycle/onboarding/:id/lms/sync-certify` | Sync LMS + certificates |
| GET | `/admin/lifecycle/probation/center` | Probation center |
| GET | `/admin/lifecycle/dashboards/:type` | Executive/HR/recruitment dashboards |
| GET | `/admin/lifecycle/search?q=` | Global lifecycle search |
| GET/PATCH | `/admin/lifecycle/notifications/center` | Notification channel config |
| POST | `/admin/lifecycle/bulk/execute` | Bulk operations |
| GET/PATCH | `/admin/lifecycle/branding` | White-label branding |

See `docs/LIFECYCLE_PHASE_F.md` for full Phase F guide.
