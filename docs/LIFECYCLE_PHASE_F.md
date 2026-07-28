# Phase F — Enterprise Completion

Commercial SaaS readiness layer extending the existing lifecycle platform.

## Parts implemented

| Part | Capability | API prefix | UI |
|------|------------|------------|-----|
| 1 | India statutory (Form 16, 12BA, TDS, EPF, ESI, Gratuity, PT, LWF, S&E) | `/statutory/*` | Enterprise → Statutory |
| 2 | IT ticketing (ServiceNow, Jira, Freshservice, Zendesk) | `/it/*`, `/onboarding/:id/software-requests` | Onboarding Hub + Enterprise → IT |
| 3 | LMS dashboard, assign, sync, certificates | `/lms/*` | Onboarding Hub + Enterprise → LMS |
| 4 | Probation Center | `/probation/center` | Enterprise → Probation |
| 5 | Executive dashboards (8 types) | `/dashboards/:type` | Enterprise → Dashboards |
| 6 | Global search + saved searches | `/search/*` | Enterprise → Search |
| 7 | Notification center (multi-channel) | `/notifications/center` | Enterprise → Notifications |
| 8 | Bulk operations | `/bulk/*` | Enterprise → Notifications (bulk) |
| 9 | White-label branding | `/branding` | Lifecycle Configuration |

## Bootstrap

```http
POST /api/v1/admin/lifecycle/enterprise/bootstrap
```

Enables Phase F features: statutory compliance, LMS dashboard, probation center, enterprise dashboards, search, notifications, bulk ops, white-label.

## IT ticketing env vars

- `SERVICENOW_URL`, `SERVICENOW_USER`, `SERVICENOW_PASSWORD`
- `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_SERVICE_DESK_PROJECT`
- `FRESHSERVICE_URL`, `FRESHSERVICE_API_KEY`
- `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN`

When unconfigured, adapters return structured stub tickets (no silent failure).

## Notification webhooks

- `TEAMS_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`
- Per-org webhook: `PATCH /notifications/center` → `{ webhookUrl }`

## Navigation

Employee Lifecycle → **Enterprise** button (`?enterprise=1`)

## Tests

```bash
cd server && npm run test:unit -- lifecyclePhaseF
```

## Production hardening checklist

- Rate limiting on all `/admin/lifecycle/*` routes (existing)
- Organization isolation via `getOrganizationId(req)`
- Audit logs on statutory generation, bulk ops, IT tickets
- Feature flags in `lifecycleFeatureRegistry.js`
- Database indexes on `LifecycleSettings.organizationId`, workflow `softwareRequests`

See also: `docs/LIFECYCLE_API.md`, `docs/LIFECYCLE_INTEGRATION_GUIDE.md`
