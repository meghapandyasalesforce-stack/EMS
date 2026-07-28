# Lifecycle Integration Guide

## Architecture

All integrations use the **adapter registry pattern**:

```
Controller → Service → Adapter → External API (or stub)
```

Existing adapters: `esignAdapter`, `accessRevocationAdapter`, `lmsAdapter`, `backgroundVerificationService`, `itTicketingAdapter`.

## Onboarding flow

1. Create workflow → pack artifacts (tasks, software requests, documents)
2. Software request → approve → IT ticket (ServiceNow/Jira/etc.)
3. LMS assign → sync completion → training progress in workflow
4. Mandatory forms → progress gate → completion blocker
5. Probation → reviews → confirmation letter trigger

## Offboarding flow

1. Initiate → notice period → clearance
2. Auto-revoke access (IdP adapters)
3. Software recovery tickets
4. F&F calculate → gratuity → payroll bridge
5. Auto letters → alumni record

## Webhooks

| Endpoint | Purpose |
|----------|---------|
| `POST /public/lifecycle/webhooks/esign/:provider` | DocuSign, Adobe Sign |
| Org `notificationWebhookUrl` | Custom lifecycle events |

## Multi-tenant rules

- Always pass `organizationId` from authenticated session
- Never query across organizations
- Feature-gate via `GET /admin/lifecycle/registry`

## Customer-specific integrations

Configure via environment variables and Lifecycle Settings — no code changes required for new tenants.
