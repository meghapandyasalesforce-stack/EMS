# HRMS - Complete System Documentation

**Product:** EMS-Paarsiv Human Resource Management System  
**Document type:** Client, operations, and developer reference  
**Status:** Living document  
**Last updated:** 2026-08-20

> This document describes the HRMS product, its operation, architecture, workflows, and implementation requirements. Features marked **configurable**, **integration-dependent**, or **roadmap** must be confirmed during client discovery and UAT.

## 1. Introduction

### 1.1 What is HRMS?

A Human Resource Management System is a centralized application for managing an organization's employee data and HR operations. EMS-Paarsiv connects employees, managers, HR teams, finance users, and administrators through role-based access, approval workflows, notifications, reports, and employee lifecycle processes.

### 1.2 Purpose of the HRMS

The system is designed to:

- Manage employee information and organization structures.
- Automate HR requests, approvals, reminders, and notifications.
- Manage attendance, work-from-home, regularization, leave, and compensatory off.
- Manage recruitment, candidates, onboarding, and employee lifecycle processes.
- Manage employee documents, policies, acknowledgements, and letters.
- Support payroll, salary structures, tax choices, expenses, and payroll reports.
- Manage goals, reviews, performance tracking, one-on-ones, learning, and team learning.
- Improve employee engagement through surveys, feedback, suggestions, and recognition.
- Provide helpdesk, SLA, workforce, succession, reporting, and analytics foundations.

### 1.3 Key Objectives

- Reduce manual HR administration and duplicate data entry.
- Centralize employee and organization records.
- Improve process transparency and request status visibility.
- Automate repeatable approval and notification workflows.
- Improve communication between employees, managers, HR, finance, and IT.
- Enforce role-based and organization-level access to sensitive information.
- Create auditable, reportable, and data-driven HR operations.

## 2. HRMS Users and Roles

### 2.1 Employee

Employees can access information and actions allowed by their permissions. Typical employee capabilities include:

- View their profile, employment information, calendar, documents, notifications, and policy acknowledgements.
- View attendance history, working-day information, leave balances, payroll information, goals, learning, and review history where enabled.
- Edit permitted personal and contact information.
- Apply for leave, work from home, attendance regularization, compensatory off, expenses, and other employee requests.
- Upload required documents and respond to document requests.
- Submit feedback, suggestions, surveys, and recognition.
- Create and track helpdesk requests.
- View the status, decision, comments, and notifications related to their own requests.
- Cancel or withdraw requests only where the configured business rule permits it.

Employees normally cannot approve their own requests, view other employees' private records, change organization configuration, view raw payroll data for others, or access HR-only analytics.

### 2.2 Reporting Manager / Line Manager

A reporting manager manages permitted team activities and acts as an approver. Typical capabilities include:

- View permitted team employee information and team calendars.
- Review and approve or reject team leave, attendance regularization, work-from-home, expense, and other requests.
- Review team goals, progress, performance inputs, one-on-ones, and learning progress where enabled.
- View thresholded team analytics where the permission and privacy rules allow it.
- Receive notifications for requests assigned to the manager.
- Add decision comments or return a request for correction.

Managers do not automatically receive HR administrator access. Their visibility is limited by reporting relationships, organization scope, permission keys, and privacy thresholds.

### 2.3 HR Executive

An HR executive performs day-to-day HR operations, such as:

- Create, update, deactivate, and maintain employee records.
- Manage employee documents, policies, leave operations, attendance exceptions, and requests.
- Manage recruitment records, candidates, onboarding tasks, and lifecycle activities.
- Review reports, notifications, audit records, and operational dashboards.
- Handle employee feedback, suggestions, helpdesk requests, and engagement operations according to permissions.
- Coordinate with managers, finance, IT, and employees.

### 2.4 HR Manager

An HR manager provides higher-level control over HR operations. Typical capabilities include:

- Configure HR policies, approval workflows, leave rules, attendance rules, templates, and notification settings.
- Review and approve escalated or final HR requests.
- Manage the employee lifecycle from recruitment through offboarding.
- View HR reports, analytics, payroll reports, workforce reports, and audit history.
- Manage HR processes, teams, documents, compliance activities, and operational exceptions.
- Approve configuration changes and coordinate UAT and releases.

### 2.5 Admin / Organization Admin

The organization administrator manages the tenant and system configuration. Capabilities may include:

- Complete organization-scoped access subject to platform safeguards.
- Manage users, roles, platform roles, permissions, departments, policies, and organization settings.
- Configure subscriptions, integrations, notification settings, time zones, and security options.
- Assign final approval authorities and manage escalation rules.
- View audit logs, diagnostics, system health, and organization reports.
- Control which modules and permissions are available to each role.

System-level access must still respect security controls, audit requirements, and any restricted or sealed privacy fields.

### 2.6 Other Roles

The permission framework can support additional roles, including:

- **Executive:** Organization-level dashboards and approved strategic reports.
- **Payroll Admin:** Salary structures, payroll preparation, payroll reports, and tax-related operations.
- **Finance:** Expenses, payroll inputs, financial approvals, and exports as assigned.
- **Department Head:** Department-level approvals and permitted workforce views.
- **Recruiter:** Job, candidate, screening, and hiring workflows.
- **IT / Service Owner:** Onboarding access tasks, equipment, software, helpdesk, and SLA workflows.
- **Custom roles:** Customer-defined combinations of module permissions.

## 3. Authentication and Authorization

### 3.1 Login

1. The user opens the web, PWA, or mobile-ready client.
2. The user submits credentials to the authentication endpoint.
3. The backend validates the account, organization, password, status, and login policy.
4. The backend issues JWT access and refresh credentials according to configured expiry values.
5. The frontend stores and refreshes session state through the authentication layer.
6. Protected routes load only after authentication and permission checks succeed.
7. Logout clears the client session and invalidates or expires the applicable session credentials according to the deployment policy.

Password reset, employee authentication, admin authentication, unified authentication, and organization authentication are supported through separate route areas. Production deployments must use HTTPS and strong secrets.

### 3.2 Role-Based Access Control

- **System role:** A broad identity category such as employee, manager, HR, executive, or administrator.
- **Functional role:** A business responsibility such as recruiter, payroll admin, finance user, or department head.
- **Platform role:** A platform-managed role used for organization or administrative control.
- **Permission:** A specific action or access grant, such as viewing employees, managing leave, approving expenses, or viewing organization analytics.

A user may have a role plus additional permissions. The API is the final authorization boundary; hiding a frontend button is not a security control.

### 3.3 Permission Management

Permission controls may cover:

- View and list access.
- Create or submit access.
- Edit or update access.
- Delete, cancel, or deactivate access.
- Approve, reject, return, or finalize access.
- Export and report access.
- Module-level access for attendance, leave, payroll, recruitment, lifecycle, documents, engagement, analytics, and other areas.
- Organization, department, team, or individual scope.

The permission matrix must be approved by the client, implemented in the backend, reflected in the frontend, and tested for allow and deny cases.

## 4. HRMS Overall Architecture

### 4.1 High-Level Architecture

```text
User: browser / PWA / Capacitor mobile app
        |
        v
React and Vite frontend
        |
REST API and Socket.IO communication
        |
Express middleware
(authentication, authorization, validation, security, logging)
        |
Routes -> Controllers -> Services -> Models
        |
MongoDB data store
        |
Redis and BullMQ background processing
        |
Email, push, maps, e-signature, LMS, access, and IT integrations
```

A normal request follows this path:

1. The frontend sends a request.
2. Middleware identifies the request, authenticates the user, applies security checks, and establishes organization context.
3. The route selects the controller.
4. The controller validates input and calls business services.
5. Services apply business rules and access restrictions.
6. Mongoose models read or update MongoDB records.
7. The API returns a response to the frontend.
8. Notifications, audit entries, or background jobs are created when required.

### 4.2 Technology Stack

#### Frontend

- React 18.
- Vite development and production build tooling.
- React Router for protected and public routes.
- Redux Toolkit, Redux Persist, and React Query for state and server data.
- Tailwind CSS, Material UI, Headless UI, Bootstrap Icons, and React Icons for interface components.
- Chart.js and Recharts for visual reporting.
- i18next and react-i18next for internationalization.
- Socket.IO client for real-time updates.
- Vite PWA support and Capacitor for mobile packaging.

#### Backend

- Node.js with ECMAScript modules.
- Express.js web framework.
- Controllers, services, route modules, middleware, helpers, jobs, and configuration modules.
- JWT and bcryptjs for authentication and password security.
- Express Validator for request validation.
- Swagger/OpenAPI for API documentation.
- Socket.IO for real-time communication.
- Nodemailer, web-push, and notification registry infrastructure.

#### Database

- MongoDB as the primary database.
- Mongoose as the object-document mapper.
- Main model areas include users, organizations, employees, attendance, leave, payroll, recruitment, onboarding, lifecycle, documents, notifications, performance, learning, engagement, benefits, helpdesk, workforce, succession, roles, audit logs, and workflows.
- Relationships are represented through organization IDs, employee IDs, manager references, workflow references, and other controlled document references.

#### Other Technologies

- Redis for caching and queue infrastructure.
- BullMQ for background jobs.
- Cron scheduling for recurring tasks.
- Email through SMTP.
- Browser/device push through VAPID subscriptions.
- Google Maps services for optional location features.
- Local uploads by default, with production durable storage to be selected.
- Service worker and PWA support for installable web use.
- Prometheus metrics and optional Sentry monitoring.

## 5. HRMS Modules

| Module | Purpose | Main users |
| --- | --- | --- |
| Dashboard | HR, employee, manager, and executive summaries | All permitted users |
| Organization Administration | Organization settings, policies, subscriptions, roles, and configuration | Organization Admin, HR Manager |
| Employee Management | Employee records, profiles, status, relationships, and self-service data | HR, Admin, Employee |
| Attendance | Punches, working time, rules, history, regularization, and exceptions | Employee, Manager, HR |
| Leave | Leave types, balances, applications, approvals, encashment, and reports | Employee, Manager, HR |
| Payroll | Salary structures, payroll processing, tax choices, and payroll reports | Payroll Admin, HR, Finance |
| Expenses | Expense submission, review, approval, and reporting | Employee, Manager, Finance |
| Recruitment / ATS | Jobs, applications, screening, candidates, and hiring pipeline | Recruiter, HR, Admin |
| Onboarding | New-hire tasks, documents, forms, training, and activation | HR, Admin, Manager, Employee |
| Lifecycle / Offboarding | Probation, employee actions, exit, clearance, letters, and alumni | HR, Manager, Admin |
| Performance | Goals, review cycles, reviews, tracking, and one-on-ones | Employee, Manager, HR |
| Learning and Development | Courses, assignments, progress, completion, and team learning | Employee, Manager, HR |
| Engagement | Surveys, feedback, suggestions, recognition, and analytics | Employee, HR, Manager |
| Documents | Uploads, requests, verification, letters, and acknowledgements | Employee, HR, Admin |
| Benefits | Benefit records and related administration | Employee, HR, Admin |
| Helpdesk / Tickets | Employee support requests, assignment, status, and SLAs | Employee, HR, Admin, Service teams |
| Projects and Tasks | Work assignment, project updates, and work items | Managers, Teams, HR |
| Notifications | In-app, email, push, reminders, and event communication | All permitted users |
| Reports and Analytics | Operational reports, dashboards, executive views, and trends | HR, Admin, Executives |
| Succession and Workforce | Workforce planning and succession foundations | HR, Executives, Admin |
| Approvals and SLA | Reusable approvals, escalation, and service-level tracking | Managers, HR, Admin |

## 6. Dashboard

### 6.1 Employee Dashboard

The employee dashboard can present:

- Current attendance and working-day summary.
- Leave balance and recent leave requests.
- Upcoming holidays and calendar events.
- Birthday and work-anniversary information where enabled.
- Unread notifications and reminders.
- Pending requests and recent decisions.
- Documents requiring upload, verification, or acknowledgement.
- Assigned goals, learning, surveys, feedback, or onboarding tasks.
- Quick actions for check-in, leave, regularization, work from home, expense, ticket, or document submission.

The exact widgets depend on role, organization configuration, feature availability, and current data.

### 6.2 HR/Admin Dashboard

The HR and admin dashboard can present:

- Total active, inactive, new, and exiting employees.
- Department, location, manager, and employment statistics.
- Attendance exceptions and absence overview.
- Leave balances, pending applications, and utilization.
- Recruitment pipeline and candidate statistics.
- Onboarding and offboarding progress.
- Pending approvals and overdue tasks.
- Payroll and expense processing indicators.
- Engagement, performance, learning, workforce, and helpdesk summaries.
- Notifications, alerts, audit events, and operational reports.

Executive dashboards should expose only approved aggregate information and must follow client privacy rules.

## 7. Employee Management

### 7.1 Employee Creation

1. An authorized HR or admin user starts employee creation or converts a selected candidate.
2. Required fields are entered, including identity, contact, employment, organization, department, manager, joining date, and status.
3. Backend validation checks required fields, formats, uniqueness, organization scope, and business rules.
4. The employee record and related user account are created or linked.
5. The employee is assigned roles, permissions, policy groups, leave rules, salary references, and onboarding configuration as required.
6. Required documents and onboarding tasks are generated.
7. A secure activation or welcome notification is sent if email is configured.
8. The employee becomes active only when the configured activation conditions are satisfied.
9. The creation and important updates are available to authorized audit/reporting processes.

### 7.2 Employee Profile

#### Personal Information

- Name and preferred name.
- Date of birth.
- Gender and other configured demographic fields.
- Marital or personal details where legally permitted and required.

#### Contact Details

- Work and personal email.
- Phone numbers.
- Current and permanent address.
- Emergency contact.
- Location or work-site details where enabled.

#### Professional Information

- Employee ID.
- Department and designation.
- Joining date and employment type.
- Reporting manager.
- Location, shift, or policy group.
- Employment status and lifecycle state.
- Salary and payroll references subject to permission.

#### Experience

- Previous companies.
- Previous job titles.
- Experience duration.
- Skills, qualifications, and professional history where configured.

#### Documents

- Identity documents.
- Educational documents.
- Employment and joining documents.
- Tax or payroll documents.
- Policy acknowledgements.
- Other customer-required records.

## 8. Attendance Management

### 8.1 Attendance Flow

```text
Employee -> Punch In -> Working -> Optional break/request actions
         -> Punch Out -> Attendance calculation -> Attendance record
```

The current route structure supports attendance, attendance rules, attendance regularization, organization time zones, work-from-home requests, and compensatory off. Break behavior, shift rules, location restrictions, and late/early calculations must be confirmed against the customer policy.

### 8.2 Attendance Features

- Punch in and punch out.
- Attendance history and daily status.
- Working-hour calculation where configured.
- Attendance rules and policy groups.
- Late arrival and early departure indicators where configured.
- Missed punch and exception handling.
- Regularization requests.
- Work-from-home requests.
- Compensatory-off workflows.
- Employee, manager, and HR reporting.

### 8.3 Attendance Regularization

Regularization is used when an attendance record is missing, incorrect, or requires an authorized correction.

1. The employee selects the date and explains the correction.
2. The backend validates date, duplicate requests, policy eligibility, and required evidence.
3. The request is sent to the configured manager or HR approver.
4. The approver reviews the original record, requested change, reason, and supporting data.
5. The request is approved, rejected, or returned for correction.
6. The attendance record is updated only after approval where required.
7. The employee and relevant stakeholders receive the status notification.
8. The action is recorded for audit and reporting.

## 9. Leave Management

### 9.1 Leave Types

Leave types are configurable and may include annual or earned leave, sick leave, casual leave, unpaid leave, maternity or paternity leave, compensatory leave, special leave, and customer-defined categories. The actual legal names, eligibility, limits, and evidence requirements must be supplied by the client.

### 9.2 Leave Balance

Leave balance calculations may include:

- Opening balance.
- Monthly or periodic accrual.
- Allocated leave.
- Used or approved leave.
- Pending leave treatment.
- Available balance.
- Carry-forward balance.
- Encashment balance.
- Year-end expiry or reset.
- Employee, department, location, grade, or policy-specific rules.

Leave balance calculations require UAT with sample employees and a full policy workbook before production use.

### 9.3 Leave Application Flow

```text
Employee -> Apply Leave -> Validation -> Manager Approval
          -> Optional HR/Admin Approval -> Approved or Rejected
          -> Balance/report update -> Notification
```

The system validates dates, overlap, balance, holidays, weekends, required documents, notice periods, and approval authority according to configuration.

### 9.4 Leave Approval Rules

- Employees may submit or cancel their own eligible requests.
- Reporting managers may approve team requests within their scope.
- HR or HR managers may approve escalated, exceptional, or policy-controlled requests.
- Administrators may configure final authority and delegated approval rules.
- No approver should approve a request outside their organization or permission scope.
- A requester should not approve their own request.
- Final approval changes the request status and triggers configured downstream updates.

### 9.5 Special Leave Rules

The business rule workbook must document:

- Monthly or annual accrual.
- Carry-forward maximums and expiry dates.
- Required supporting documents.
- Notice-period requirements.
- Half-day or hourly leave rules.
- Holiday and weekend treatment.
- Role, grade, location, or employment-type differences.
- Year-end reset and reconciliation.
- Cancellation and amendment rules.
- Payroll impact.

## 10. Recruitment / ATS

### 10.1 Job Management

Authorized recruiters can create, edit, publish, pause, close, and archive job records. A job may include title, department, location, employment type, description, requirements, hiring owner, vacancies, status, and application instructions.

### 10.2 Career Portal

The public recruitment capability can provide:

- Public job listing.
- Job detail and application form.
- Candidate contact and profile information.
- Resume and supporting file upload.
- Consent and privacy acknowledgement.
- Application confirmation.

Public forms must validate uploads, sanitize input, limit abuse, and avoid exposing private candidate records.

### 10.3 Candidate Management

Recruiters can maintain candidate profiles, resumes, screening templates, screening audit data, status, notes, interview information, and hiring decisions. Candidate information must be restricted to recruitment users and other approved participants.

### 10.4 Recruitment Flow

```text
Job Created -> Published -> Candidate Applies -> Resume Screening
-> Shortlisting -> Interview -> Selection -> Offer -> Onboarding
```

External job boards, interview tools, background verification, e-signature, and offer integrations are integration-dependent.

## 11. Onboarding

### 11.1 Onboarding Process

Onboarding can use templates or workflow packs containing tasks, documents, software requests, forms, training, owners, due dates, reminders, and completion gates. HR, the manager, the employee, IT, finance, and other owners complete their assigned actions.

### 11.2 Onboarding Workflow

```text
Candidate Selected -> Offer -> Documents -> Onboarding Tasks
-> Verification -> Employee Created -> Employee Activated
```

Mandatory forms and documents may block completion. The workflow should show owners, due dates, status, evidence, comments, and overdue actions.

## 12. Performance Management

The performance module provides a foundation for:

- Review cycle creation and scheduling.
- Goal and KPI assignment.
- Employee self-review.
- Manager review.
- Progress updates and performance tracking.
- Feedback and development conversations.
- Ratings and review history.
- One-on-one meetings.
- Appraisal inputs and reports.

Rating scales, competency models, calibration, appraisal calculations, and salary linkage are customer-specific business rules.

## 13. Learning & Development

Learning and development can include:

- Training programs and courses.
- Learning materials and resources.
- Employee or team enrollment.
- Mandatory onboarding or compliance learning.
- Progress tracking.
- Completion status and evidence.
- Manager visibility into team progress.
- HR administration and reports.
- Optional external LMS synchronization.

## 14. Employee Engagement

### 14.1 Surveys

The engagement foundation supports survey creation, targeting, questions, participation, responses, status lifecycle, and analytics foundations. Survey anonymity and response visibility must be configured with privacy controls.

### 14.2 eNPS

Employee Net Promoter Score measures how likely employees are to recommend the organization as a workplace. A common calculation is:

```text
eNPS = percentage of Promoters - percentage of Detractors
```

Responses are generally grouped as promoters, passives, and detractors according to the selected 0-10 question scale. The system should display aggregate results only where the response count meets the approved privacy threshold. eNPS is a roadmap/expansion item unless explicitly enabled and tested for the client.

### 14.3 Recognition

The planned recognition capability includes peer, individual, team, or department recognition; categories; moderation or approval; reactions; and a recognition wall. Recognition visibility, moderation, public display, and reward/points behavior require customer policy decisions. Rewards and redemption are not assumed to be included.

### 14.4 Feedback and Suggestions

Employees can submit identified or anonymous feedback and suggestions, subject to configured permissions. The workflow may include submission, HR review, reply, status, assignment, closure, and aggregate analytics.

Anonymous feedback requires special privacy design. Identity must not be exposed in standard manager or HR list responses. Retention, break-glass access, abuse prevention, and response thresholds must be approved before production use.

## 15. Employee Documents

### 15.1 Document Management

Document workflows can include:

- Upload and metadata capture.
- View and protected download.
- Required-document tracking.
- Verification and rejection with reason.
- Document status and expiry.
- Association with employee, organization, onboarding, lifecycle, payroll, benefits, or policy records.
- Policy acknowledgement.

Production storage, encryption, malware scanning, retention, backup, and access auditing must be defined with the client.

### 15.2 Employee Document Requests

1. HR or an authorized owner creates a document request.
2. The employee receives a notification and due date.
3. The employee uploads the document through the protected form.
4. The backend validates type, size, and ownership.
5. HR verifies, rejects, or requests a replacement.
6. The employee receives the result.
7. The document status and audit history are retained according to policy.

## 16. Ticket / Support Management

### 16.1 Ticket Creation

```text
Employee -> Create Ticket -> Ticket Saved -> Relevant Users Notified
-> Ticket Assigned -> In Progress -> Resolution -> Closed
```

A ticket may include category, subject, description, priority, attachments, requester, organization, owner, SLA, comments, status, and resolution information.

### 16.2 Notification Recipients

Recipients are determined by category, organization, department, assignment, escalation, and permission. Possible recipients include:

- Requesting employee.
- Reporting manager.
- HR executive.
- HR manager.
- Organization admin.
- Finance, IT, or other assigned service owner.
- Escalation recipients for overdue SLAs.

### 16.3 Ticket Status

- Open.
- Assigned.
- In Progress.
- Pending requester.
- Resolved.
- Closed.
- Reopened where configured.

## 17. Notifications

### 17.1 Notification Types

- In-app notifications.
- Email notifications through SMTP.
- Browser and device push notifications through VAPID subscriptions.
- Real-time updates through Socket.IO where enabled.
- Scheduled reminders and digest notifications where configured.

### 17.2 Notification Events

The notification registry can support events such as:

- Leave applied, approved, rejected, cancelled, or returned.
- New employee created or employee activated.
- Attendance regularization submitted or decided.
- Work-from-home or compensatory-off request updated.
- Ticket created, assigned, updated, resolved, or escalated.
- Document requested, uploaded, verified, rejected, or expiring.
- Onboarding task assigned or overdue.
- Lifecycle action started or completed.
- Birthday and work-anniversary reminders.
- Survey assigned or expiring.
- Feedback reply or recognition received.
- Payroll or expense status changes.

The final event catalog must be confirmed against the enabled modules and customer notification policy.

### 17.3 Notification Flow

```text
Business Event -> Event Handler -> Identify Recipients
-> Create Notification -> Queue Email/Push if required
-> Display In-App -> Read/Unread Update
```

Notification failures must be logged and retried where the queue policy supports retries. Core transactions should not silently report success when a required notification or downstream action has failed.

## 18. Birthday & Work Anniversary

Where enabled, a scheduled process checks employee dates against the organization time zone and employee status. A customer may configure:

- Seven-day reminder.
- Event-day notification.
- Employee or manager visibility.
- Email, in-app, or push channels.
- Public or private wishes.
- Reactions and recognition behavior.
- Exclusion of inactive, confidential, or opted-out employees.

The exact schedule and privacy rules require customer confirmation.

## 19. Approval Workflows

### 19.1 Leave Approval

```text
Employee -> Submit Leave -> Validation -> Reporting Manager
-> Optional HR/Admin Review -> Final Status -> Balance/Notification Update
```

### 19.2 Attendance Regularization

```text
Employee -> Submit Correction -> Validation -> Manager or HR
-> Approve/Reject/Return -> Attendance Update -> Notification
```

### 19.3 Ticket Workflow

```text
Employee -> Submit Ticket -> Routing -> Relevant Team or Approver
-> Assignment -> Resolution -> Requester Confirmation -> Closure
```

For every workflow, the implementation must define:

- Initiator.
- Required fields and evidence.
- Approver and delegation.
- Conditions and validation.
- Escalation and SLA rules.
- Final authority.
- Allowed status changes.
- Notification recipients and channels.
- Audit requirements.
- Cancellation, return, and correction behavior.

## 20. Offboarding

### 20.1 Exit Process

The lifecycle exit process can cover resignation, notice period, approval, clearance, asset return, knowledge transfer, access revocation, software recovery, exit interview, letters, final settlement references, document handling, and employee deactivation.

### 20.2 Offboarding Flow

```text
Resignation -> Approval -> Notice Period -> Clearance
-> Asset Return -> Knowledge Transfer -> Exit Interview
-> Final Settlement -> Access Revocation -> Employee Deactivation
```

Payroll final settlement and statutory calculations are customer and jurisdiction dependent. External identity, software, e-signature, and IT integrations require provider configuration and testing.

## 21. Database Design

MongoDB stores organization-scoped documents. Important model areas include:

| Entity / collection | Purpose | Main relationships |
| --- | --- | --- |
| Organization | Tenant configuration, policies, and settings | Users, employees, roles, modules |
| User | Login identity and account status | Organization, employee, roles |
| Employee | Employee master record | Organization, manager, documents, payroll, leave |
| Role / Permission | Access control | Users, organization, modules |
| Attendance | Punches and daily attendance | Employee, organization, rules |
| Attendance Rule | Time and attendance policy | Organization, employee groups |
| Attendance Regularization | Attendance correction request | Employee, approver, attendance |
| Leave / Leave Balance | Applications, balances, and audits | Employee, policy, approver |
| Payroll / Salary Structure | Compensation and payroll data | Employee, organization, tax choices |
| Expense | Expense claim and approval | Employee, approver, attachments |
| Recruitment | Jobs, candidates, screening, and pipeline | Organization, candidate, employee |
| Onboarding | Workflow, tasks, forms, and progress | Employee, owners, documents |
| Lifecycle | Onboarding, probation, exit, and lifecycle actions | Employee, tasks, integrations |
| Document | File metadata, status, and verification | Employee, organization, workflow |
| Notification | In-app communication and read status | User, event, organization |
| Push Subscription | Device/browser push endpoint | User, device |
| Goal / Performance Review | Goals, cycles, reviews, and tracking | Employee, manager, cycle |
| Learning / Team Learning | Training, assignments, and completion | Employee, team, course |
| Engagement | Surveys, responses, feedback, and recognition | Employee, organization, privacy rules |
| Helpdesk / SLA | Support requests and service targets | Employee, owner, organization |
| Benefits | Benefit enrollment and records | Employee, organization, provider |
| Succession / Workforce | Planning and workforce data | Organization, roles, employees |
| Audit Log | Traceability for important actions | User, organization, resource |

Every model used in production must have an organization boundary, appropriate indexes, validation, access controls, and retention rules. Sensitive fields must not be returned to unauthorized users.

## 22. API Architecture

The API is versioned under `/api/v1` and grouped by access scope:

- `/api/v1/organization` for organization registration, subscription, policies, and dashboards.
- `/api/v1/admin` for HR and administrator operations.
- `/api/v1/employee` for employee authentication and self-service.
- `/api/v1/both` for shared employee and administrator capabilities.
- `/api/v1/public` for public recruitment and lifecycle forms.
- `/api/health` for health checks.
- `/api/push` for push subscriptions.

### Leave API example

The leave route family supports operations such as:

- Apply for leave.
- Get leave balance.
- Get leave history.
- View pending requests.
- Approve leave.
- Reject leave.
- Return leave for correction.
- Cancel leave where allowed.
- Manage leave policy and reports for authorized administrators.

For each production endpoint, the API reference must document:

- HTTP method and endpoint.
- Authentication requirement.
- Required permission.
- Organization and data scope.
- Request parameters and body.
- Success response.
- Validation rules.
- Error response and status codes.
- Audit and notification behavior.
- Idempotency or duplicate-submission handling.

Swagger/OpenAPI is available at `/api-docs` when enabled. Endpoint details should be kept synchronized with implementation and client integrations.

## 23. Frontend Architecture

The frontend is a React 18 Vite application organized by business area. Major areas include Admin, Employee, HR, Manager, Finance, Auth, Dashboard, Recruitment, Onboarding, Offboarding, Learning, Engagement, Documents, Helpdesk, Reports, Succession, Workforce, shared components, layouts, context, routes, utilities, and tests.

Frontend responsibilities include:

- Page and route rendering.
- Protected routes and role-aware navigation.
- Form input, client validation, and error display.
- API service calls and response handling.
- Redux and React Query state management.
- Role-based rendering for usability, while relying on backend authorization for security.
- Responsive desktop, tablet, mobile, PWA, and Capacitor-ready layouts.
- Charts, tables, dashboards, notifications, modals, uploads, and workflow status views.
- Internationalization and reusable UI components.

## 24. Backend Architecture

The backend is organized into:

- **Routes:** Grouped by Admin, Employee, Both, Organization, Public, Executive, and Health scope.
- **Controllers:** Receive requests, validate inputs, call services, and format responses.
- **Services:** Implement reusable business rules and external integration boundaries.
- **Models:** Define MongoDB document schemas and relationships.
- **Middleware:** Authentication, authorization, organization isolation, CORS, CSRF, validation, rate limiting, timeout, logging, security headers, uploads, and errors.
- **Validators:** Validate request bodies, query parameters, files, IDs, and business constraints.
- **Helpers:** Logging, environment validation, notification registry, email, date/time, and shared utilities.
- **Jobs:** Email, notifications, reminders, recurring lifecycle work, and other asynchronous tasks.
- **Event handlers:** Connect business events to notifications and integrations.
- **Configuration:** Routes, constants, permissions, roles, queues, Redis, Swagger, i18n, and external services.

## 25. Background Jobs & Automation

Background processing is used for work that should not block a user request.

| Job or automation | Trigger / frequency | Action |
| --- | --- | --- |
| Email processing | Business event or queued request | Sends email and records delivery result. |
| Notification processing | Registered business event | Creates and delivers in-app, email, or push notification. |
| Birthday reminder | Scheduled date check | Sends configured reminder or event-day notification. |
| Work anniversary reminder | Scheduled date check | Sends configured anniversary notification. |
| Survey reminder or expiry | Survey schedule and due date | Notifies participants or closes/marks expiry where enabled. |
| Lifecycle reminders | Due dates and workflow status | Notifies owners of onboarding, probation, or exit tasks. |
| SLA escalation | SLA deadline | Escalates overdue tickets or requests. |
| Leave accrual | Customer-defined schedule | Updates balances according to approved rules. |
| Carry forward | Year-end or policy schedule | Applies carry-forward and expiry rules. |
| Integration synchronization | Webhook or scheduled sync | Updates HRMS records from external providers. |

For every job, implementation should document trigger, frequency, conditions, retries, failure handling, database changes, notifications, monitoring, and safe re-run behavior. Redis is required for BullMQ queue operation; the application may continue without it, but queued work will not operate normally.

## 26. Real-World End-to-End Scenarios

### Scenario 1 - New Employee Joins

1. Recruiter publishes a job and receives a candidate application.
2. Candidate information and resume are screened.
3. The candidate is shortlisted, interviewed, selected, and offered a role.
4. The candidate provides required documents and completes any configured forms.
5. HR creates the employee and user account.
6. Onboarding tasks, training, access requests, and policy acknowledgements are created.
7. Manager, HR, IT, and the employee complete their assigned actions.
8. The employee activates the account and becomes available in employee, attendance, leave, payroll, and reporting modules.

### Scenario 2 - Employee Applies for Leave

1. Employee checks the available leave balance and selects dates.
2. The system validates balance, overlap, holidays, documents, and policy.
3. The request is routed to the configured manager.
4. The manager approves, rejects, or returns the request.
5. HR approval is added when policy requires it.
6. The final status updates the request and applicable balance/reporting data.
7. Notifications are delivered to the employee and stakeholders.

### Scenario 3 - Employee Requests Attendance Regularization

1. Employee identifies a missing or incorrect attendance record.
2. Employee submits the date, correction, reason, and evidence.
3. The system validates the request and prevents duplicates.
4. Manager or HR reviews the request.
5. Approved data updates the attendance record; rejected data leaves the original record unchanged.
6. The employee receives the decision and the action is auditable.

### Scenario 4 - Employee Creates a Ticket

1. Employee selects a category and submits a description or attachment.
2. The system creates the ticket and determines the owner or queue.
3. The employee, manager, HR, or service team receives the configured notification.
4. The owner assigns and works the ticket.
5. The ticket moves through open, assigned, in-progress, resolved, and closed states.
6. SLA escalation occurs when configured deadlines are missed.

### Scenario 5 - Employee Birthday

1. A scheduled job checks active employee dates using the organization time zone.
2. The job applies opt-out, privacy, visibility, and reminder settings.
3. A seven-day reminder and/or event-day notification is generated.
4. Recipients receive in-app, email, or push communication according to preferences.
5. Wishes or reactions are available only if the relevant feature is enabled.

### Scenario 6 - Employee Resigns

1. Employee or HR initiates the exit workflow according to policy.
2. HR records notice period, reason, last working date, and owners.
3. Clearance tasks are assigned to HR, manager, finance, IT, and other departments.
4. Assets, access, software, knowledge transfer, documents, and exit interview are handled.
5. Letters and final settlement inputs are prepared.
6. External access revocation or IT tickets run through configured adapters.
7. HR completes the workflow and deactivates the employee account.

## 27. Security

The application includes or supports:

- JWT authentication and controlled token expiry.
- bcrypt password hashing.
- Role and permission authorization.
- Organization isolation for tenant data.
- Helmet security headers and content security policy.
- CORS allow-list configuration.
- CSRF protection.
- MongoDB query sanitization.
- XSS protection and HTML handling controls.
- Express Validator request validation.
- Rate limiting and production protection against disabling rate limits.
- Request IDs, logging, timeouts, and compression.
- Protected uploads and file-size limits.
- Audit logging for important administrative actions.
- Optional Prometheus metrics and Sentry error monitoring.

Production privacy requirements include HTTPS, strong secrets, restricted database and Redis access, protected file storage, limited Swagger/metrics access, data retention, backups, restore tests, access reviews, and anonymous-feedback privacy controls.

## 28. Error Handling

### Frontend validation

Forms should identify missing, invalid, duplicate, or inconsistent input before submission and display actionable messages without exposing implementation details.

### Backend validation

The backend validates every request independently of the frontend, including IDs, dates, permissions, organization scope, duplicate actions, file type, file size, and business rules.

### API errors

The API should return an appropriate status code, a stable error shape, a human-readable message, a request ID where available, and field-level validation details where useful.

### Authentication errors

Expired, missing, malformed, or invalid credentials return an authentication error and must not reveal whether sensitive accounts or records exist.

### Permission errors

A valid user without the required permission receives a forbidden response. The frontend should hide unavailable actions for usability, but backend checks remain mandatory.

### Database errors

Database failures are logged with request context and returned as a safe generic error. Internal stack traces, credentials, and sensitive records must not be returned to clients.

### Notification failures

Notification delivery failures are logged and retried where supported. The user-facing transaction status must clearly distinguish a saved business record from a failed optional notification.

### File upload failures

Invalid type, size, storage, scanning, authorization, and retrieval failures must return safe errors and leave no orphaned or publicly exposed file.

## 29. Testing & QA

### 29.1 Functional Testing

Test employee management, authentication, attendance, regularization, leave, payroll, expenses, recruitment, onboarding, lifecycle, performance, learning, engagement, documents, benefits, helpdesk, notifications, reports, and offboarding.

### 29.2 Role-Based Testing

Test each feature as:

- Employee.
- Reporting manager.
- HR executive.
- HR manager.
- Organization admin.
- Executive.
- Payroll or finance user.
- Recruiter.
- Custom role.

Every test should include allowed action, denied action, organization scope, team scope, and sensitive data exposure.

### 29.3 API Testing

Test successful requests, missing fields, invalid formats, duplicate submissions, expired authentication, unauthorized access, forbidden access, cross-organization IDs, malformed files, database failures, queue failures, and edge-case dates.

### 29.4 UI Testing

Test desktop, tablet, mobile, PWA, responsive layouts, navigation, forms, tables, modals, uploads, date pickers, charts, loading states, empty states, errors, accessibility, and browser/device notification behavior.

## 30. Deployment & Environment

### Development

- MongoDB local or development instance.
- Redis optional for ordinary development and required for queue testing.
- Backend default port `10000`.
- Frontend Vite default port `5173`.
- Swagger typically enabled for local development.

### Testing / staging

Use a separate database, Redis instance, storage area, SMTP or email sandbox, push credentials, domains, users, and integration credentials. Never use production employee data without an approved data-protection process.

### Production

Use HTTPS, managed MongoDB, protected Redis, durable file storage, configured SMTP, stable VAPID keys, monitored backend hosting, frontend hosting, backups, alerting, and restricted diagnostics.

### Important environment variables

- `MONGO_URI`.
- `PORT`, `NODE_ENV`.
- `FRONTEND_URL`, `BACKEND_URL`, and `ALLOWED_ORIGINS`.
- `JWT_SECRET`, `JWT_ACCESS_EXPIRE`, and `JWT_REFRESH_EXPIRE`.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, and `EMAIL_PASS`.
- `REDIS_URL` and queue settings.
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`.
- `MAX_FILE_SIZE` and `UPLOAD_PATH`.
- `VITE_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY` where maps are enabled.
- `ENABLE_SWAGGER`, `ENABLE_METRICS`, and query logging settings.

Frontend deployment should run the Vite production build. Backend deployment should install server dependencies and run `npm start`. Render and Vercel-style deployments are supported by repository configuration, but final hosting architecture must be agreed with the client.

## 31. Troubleshooting Guide

### Notifications not appearing

1. Check that the business event was triggered.
2. Check that a notification record was created.
3. Confirm the recipient and organization scope.
4. Confirm the user has permission and notification preferences allow delivery.
5. For push, check browser/device permission, subscription, VAPID keys, and service worker.
6. For email, check SMTP settings and delivery logs.
7. For queued work, check Redis, BullMQ workers, retries, and failed jobs.
8. Check the frontend notification listener and unread-state refresh.

### Leave approval not working

1. Check the applicant account and employee status.
2. Check manager assignment and approver configuration.
3. Check leave permission and organization scope.
4. Check balance, overlap, date, document, and policy validation.
5. Check the API response and backend logs using the request ID.
6. Check the database request status and approval history.
7. Check whether a required HR/admin approval is pending.

### Login not working

1. Confirm backend availability and health endpoint.
2. Confirm frontend API/proxy URL and CORS settings.
3. Confirm account status and organization.
4. Check credentials and password-reset configuration.
5. Check JWT secret and token expiry settings.
6. Review safe authentication logs without exposing passwords or tokens.

### Documents not uploading

1. Check file size, file type, and required metadata.
2. Check user permission and employee ownership.
3. Check upload path or production storage credentials.
4. Check disk/object-storage capacity.
5. Check file scanning and access middleware.
6. Check the returned request ID and backend logs.

## 32. HRMS Business Rules

This section is the source of truth for customer-approved business logic. The implementation workbook should record the rule, owner, effective date, affected module, examples, and UAT evidence.

Required rule categories include:

- Leave accrual, balance, carry-forward, expiry, encashment, and cancellation.
- Attendance shifts, grace periods, breaks, late arrival, early departure, overtime, and regularization.
- Approval levels, delegation, escalation, final authority, and separation of duties.
- Document requirements, verification, expiry, retention, and access.
- Payroll periods, salary components, tax choices, cut-offs, and export requirements.
- Recruitment status, candidate privacy, screening, offer, and conversion rules.
- Onboarding mandatory tasks, forms, documents, access, and activation gates.
- Lifecycle status, probation, confirmation, resignation, clearance, and deactivation.
- Role restrictions, organization scope, department scope, and manager visibility.
- Notification event, recipient, channel, reminder, opt-out, and retry rules.
- Employee active, inactive, suspended, resigned, and alumni status behavior.
- Privacy thresholds for survey, feedback, eNPS, and manager analytics.

## 33. Glossary

| Term | Meaning |
| --- | --- |
| HRMS | Human Resource Management System. |
| ATS | Applicant Tracking System. |
| RBAC | Role-Based Access Control. |
| KPI | Key Performance Indicator. |
| eNPS | Employee Net Promoter Score. |
| F&F | Full and Final settlement. |
| L&D | Learning and Development. |
| SLA | Service Level Agreement. |
| Accrual | Leave earned over time according to policy. |
| Regularization | An authorized correction or request for an attendance record. |
| Onboarding | Process of joining and preparing a new employee. |
| Offboarding | Process of managing an employee exit. |
| Tenant | An organization and its isolated data within a multi-tenant system. |
| Workflow | A sequence of actions, owners, approvals, conditions, and statuses. |
| UAT | User Acceptance Testing. |
| PWA | Progressive Web App. |
| VAPID | Credentials used for web push notifications. |
| API | Application Programming Interface. |
| JWT | JSON Web Token used for authenticated API access. |

## 34. Quick HRMS Explanation

### 30-Second Explanation

EMS-Paarsiv is a centralized HRMS that manages the complete employee lifecycle, from recruitment and onboarding through employee administration, attendance, leave, payroll, performance, learning, engagement, documents, support, and offboarding. Employees use self-service, managers approve team requests, HR manages operations, and administrators control organization configuration and permissions.

### 2-Minute Explanation

The system stores employee and organization data in one controlled platform. Users log in through role-based access and see the modules and actions permitted for them. Employees submit requests such as leave, attendance correction, expenses, documents, and helpdesk tickets. Managers and HR review those requests through configurable approval workflows. Recruitment and onboarding connect candidate selection to employee activation. Performance, learning, engagement, and documents support the employee journey after joining. Notifications keep users informed through the application, email, push, and scheduled reminders. Reports and dashboards give HR and executives operational and strategic visibility. Security controls, audit records, organization isolation, validation, and protected APIs control access to sensitive HR data.

### Developer Explanation

The frontend is a React/Vite application with routed business modules, protected pages, Redux and React Query state, reusable components, responsive layouts, PWA support, and optional Capacitor packaging. It communicates with a versioned Express API and Socket.IO. The backend uses route modules, controllers, services, Mongoose models, middleware, jobs, helpers, and configuration. Authentication uses JWT and bcrypt. Authorization uses roles, permissions, and organization isolation. MongoDB stores HR records. Redis and BullMQ process asynchronous email, notification, reminder, and integration work. Swagger documents APIs. Security middleware handles headers, CORS, CSRF, sanitization, XSS, validation, rate limiting, logging, request IDs, and timeouts. External services connect through configuration or adapter boundaries.

## 35. Complete Employee Lifecycle

```text
Recruitment
    |
Candidate
    |
Selection
    |
Offer
    |
Onboarding
    |
Employee Creation and Activation
    |
Employee Management
    |
Attendance and Time
    |
Leave and Absence
    |
Performance and Goals
    |
Learning and Development
    |
Employee Engagement
    |
Documents and HR Operations
    |
Resignation
    |
Offboarding and Clearance
    |
Final Settlement Inputs
    |
Access Revocation and Deactivation
    |
Employee Exit / Alumni
```

Each transition should have a defined owner, status, required evidence, approval authority, notification behavior, audit record, and business rule.

## 36. Conclusion

EMS-Paarsiv acts as a centralized platform for managing the complete employee lifecycle and automating HR operations. It connects employees, managers, HR teams, finance, IT, executives, and administrators through role-based access, configurable workflows, approvals, notifications, centralized records, reports, and integrations.

The system is intended to make major HR processes:

**Centralized -> Automated -> Permission Controlled -> Trackable -> Transparent -> Data Driven**

Successful implementation depends on approved HR policies, clean migration data, correct roles and permissions, tested integrations, employee adoption, security controls, and formal UAT sign-off.

## Related Project References

- [Project overview and client implementation guide](PROJECT_DOCUMENTATION.md)
- [Repository quick start](../README.md)
- [Lifecycle API](LIFECYCLE_API.md)
- [Lifecycle integration guide](LIFECYCLE_INTEGRATION_GUIDE.md)
- [Engagement Phase 1 expansion plan](ENGAGEMENT_PHASE1_EXPANSION_PLAN.md)
