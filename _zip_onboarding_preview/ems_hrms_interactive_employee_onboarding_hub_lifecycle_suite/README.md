# EMS HRMS React app

The original `code.html` has been converted into React components with Vite and Tailwind CSS. The source HTML is retained for reference.

## Run locally

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

`src/App.jsx` contains the page, `src/Layout.jsx` contains the sidebar and header, `src/CandidateRow.jsx` renders candidate rows, and `src/useOnboarding.js` manages filters, pagination, selection, dialogs, and candidate actions. Sample records live in `src/data.js`.

Candidate changes are held in memory and reset on refresh. Offboarding and reports retain the original preview content. Actions that displayed prototype toasts still display prototype feedback; no HR, email, provisioning, or export service is connected. Fonts and profile images require internet access.

## Create Course Studio

Open **Create Course** in the sidebar, or visit `/#/create-course`. The existing onboarding page is available at `/#/onboarding` and remains the default page.

`src/CreateCourse.jsx` converts the supplied course studio HTML to JSX and reuses the shared sidebar, header, and Tailwind theme. React state controls the four editor tabs, six dialogs, and toast notifications. Inputs remain editable, and dialogs support Escape, focus trapping, and focus restoration.

Course publishing, saving, and assignments retain the supplied prototype feedback; they are not connected to a backend or persisted after refresh.

## Headcount Requisitions

Open **Headcount Requisitions** in the sidebar or visit `/#/headcount-requisitions`. The page is implemented in `src/HeadcountRequisitions.jsx`, with table rows in `src/RequisitionRow.jsx` and the seven supplied sample records in `src/requisitionData.js`.

React state manages search, department and priority filters, status tabs and counts, pagination, editable request forms, drawers, confirmation dialogs, and notifications. Drafts and submitted requests appear in the roster; approval, rejection, and conversion update the record status. Dialogs support Escape and keyboard focus management.

Data changes last for the current mounted session and reset on navigation or refresh. Conversion updates the prototype requisition status without creating a backend job posting. Dashboard metrics, budget figures, and timeline history remain illustrative sample content. Export and column configuration retain the supplied prototype notifications.

## Helpdesk & Support Suite

Open **Helpdesk** in the sidebar or use `/#/helpdesk`. The header help shortcut opens the same page. `src/Helpdesk.jsx` manages ticket search, filters, pagination, creation, detail editing, replies, internal notes, and resolution. `src/TicketRow.jsx` renders rows; `src/helpdeskData.js` holds the four supplied sample tickets.

Run `npm run check:helpdesk` for JSX compilation, server-render regression checks across the existing pages, and handler checks for search, creation, replies, resolution, empty state, and reset. These checks do not replace browser testing or a production build.

Ticket changes last for the mounted session and reset on navigation or refresh. Attachments retain filenames locally; no files are uploaded. Internal notes are illustrative UI state without backend access control. Dashboard statistics remain sample figures. No email, payroll, or support backend is connected.

## Recruitment requisition detail

Open **Recruitment** in the sidebar or visit `/#/recruitment-detail` (`/#/recruitment` is also supported). The supplied requisition REQ-2025-089 is implemented in `src/RecruitmentDetail.jsx`, with applicant rows in `src/ApplicantRow.jsx` and the five sample applicants in `src/recruitmentData.js`.

React controls the Overview, Applicants, and Activity tabs; search, stage filters and sorting; bulk selection and stage moves; candidate dossiers, advancement and rejection; requisition editing and closure; sharing and clipboard feedback. Edits update the requisition heading and context. Dialogs support Escape, focus trapping and focus restoration.

Run `npm run check:recruitment` for JSX/server rendering and handler checks covering search, bulk actions, correct dossiers, advancement, editing, and closure. `npm run check:helpdesk` covers existing page renders and helpdesk interactions. These checks do not replace browser verification or a production build.

Changes remain in memory and reset on navigation or refresh. Overview analytics and dossier supporting details remain illustrative sample content. Share links open this local page; no public job is published. External broadcasts, downloads, scheduling and email are prototype actions without service connections.

## Enterprise Learning & Development Hub

Open **Learning** in the sidebar or visit `/#/learning`. The existing full editor remains linked at `/#/create-course`. `src/Learning.jsx` manages the page; `src/LearningComponents.jsx` contains reusable course cards and assignment rows; `src/learningData.js` contains the four supplied courses and three assignment records.

React state controls catalog search, category and level filters, tabs, empty/loading previews, course creation/editing/archiving, assignment creation/reassignment/removal, certificate recipient search, dialogs, and notifications. Each card opens its own course details. The supplied security curriculum is labeled as sample content. Dialogs support Escape, focus trapping, and focus restoration.

Run `npm run check:learning` for JSX/server rendering and handler checks of course filters, creation, editing, assignment creation/removal, and archiving. Existing regression checks remain available as `check:helpdesk` and `check:recruitment`. These checks do not replace browser testing or a production build.

Changes are held in memory and reset on navigation or refresh. The course studio and this catalog do not share persistent data. Dashboard analytics, certificates, and curriculum modules retain sample content. Reminder preferences are stored locally; no WhatsApp/email messages are sent. Certificate downloads remain prototype notifications.

## Lifecycle Reports & SLA Analytics

Open **Reports** in the sidebar or visit `/#/reports`. `src/Reports.jsx` converts the supplied dashboard to React and reuses the shared layout and theme. `src/reportData.js` contains the four sample department records.

React state manages the six report categories, active navigation, export menu with outside-click/Escape dismissal, department search, ascending/descending sorting, drilldown dialog, legend preferences, and compliance interest feedback. Drilldown controls are keyboard accessible; the dialog supports Escape and focus management.

Run `npm run check:reports` for JSX/server rendering and handler checks covering report switching, search, sorting, export feedback, drilldown, and compliance preferences. Existing page verification commands remain available. These checks do not replace browser testing or a production build.

All figures, date/department summary controls, chart bars, and drilldown counts retain the supplied sample content. Legend preferences update locally; the chart remains the supplied aggregate sample without separate series data. Export options display prototype feedback and do not generate files. Compliance interest is session-only and does not register for external notifications.

## Employee onboarding dossier

Open **Onboarding Dossier** in the sidebar, use the Ananya dossier link on the onboarding roster, or visit `/#/onboarding-detail`. The supplied fixed employee sample (Ananya Deshmukh, EMP-2025-091) lives in `src/OnboardingDetail.jsx`; task and form defaults live in `src/onboardingDetailData.js`.

React state manages the seven dossier tabs, 17/20 initial task progress and radial indicator, new task completion, hardware prerequisites, pause/resume/cancellation, Form 11 review, BGV initiation preview, milestones, training assignments, notes and privacy labels, buddy reassignment, filename selection, menus, dialogs, and notifications. User notes render as text. Dialogs support Escape and keyboard focus management.

Run `npm run check:onboarding-detail` for JSX/server rendering and handler checks covering initial progress, tab changes, pause/resume, task creation and completion, notes, goals, training, document verification, and cancellation. Existing regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. The dossier uses its own sample state and does not update roster records or other pages. File selection stores only the filename: no upload, scanning, digital signature, EPFO verification, screening-provider request, email, WhatsApp, Slack, provisioning, calendar action, or PDF export is performed. Privacy labels are a UI preview without backend authorization. Existing documents and activity history remain illustrative.

## One-on-One Meetings Suite

Open **One-on-Ones** in the sidebar or visit `/#/one-on-one-meetings`. The page lives in `src/OneOnOnes.jsx`; reusable calendar, meeting cards, and list views live in `src/MeetingViews.jsx`; `src/meetingData.js` contains the three supplied sample meetings.

React state connects the calendar and list to shared meeting records, with month/day navigation, scheduling, selected-meeting detail, rescheduling, cancellation, completion, per-meeting notes, and editable action items. Forms validate required participant/date/time fields. Dialogs support Escape, focus trapping, and focus restoration.

Run `npm run check:meetings` for JSX/server rendering and handler checks covering creation, date selection, correct meeting selection, notes, action items, rescheduling, cancellation, and completion. Other page verification commands remain available. These checks do not replace browser testing or a production build.

Data is held in memory and resets on navigation or refresh. Recurrence cadence is stored as a preference; recurring events are not expanded. No invites, participant notifications, video calls, live collaboration, or calendar-service updates are sent. The original sample dates, participant roles, and historical meeting examples remain illustrative.

## Payroll Processing & Statutory Compliance Suite

Open **Payroll** in the sidebar or visit `/#/payroll`. `src/Payroll.jsx` implements the page; `src/PayrollRow.jsx` renders reusable rows; `src/payrollData.js` contains the four supplied employee records.

React state controls month, department and text filters, row selection, processing/void status, preview/finalized cycle states, CEO simulation controls, empty/error/retry states, payslip drawer, and toast feedback. Payslip previews show the selected employee?s supplied gross, deductions, and net amounts. Dialog focus and Escape handling are included. The source?s implementation mapping table was omitted from the product page, and decorative pagination was replaced with the actual sample count.

Run `npm run check:payroll` for JSX/server rendering and handler checks covering search, filters, selection, employee-specific payslips, process/void, preview/finalization gating, mock disbursement, and error recovery. Other page regression scripts remain available. These checks do not replace browser testing or a production build.

All data is illustrative and changes remain in memory until navigation or refresh. October 2023 contains the supplied sample records; other periods show no sample data. KPI totals remain illustrative source values. CEO enablement is a UI simulator, not authentication or authorization. No bank transfers, statutory filings, PDF generation, payroll adjustment wizard, or external API connections are implemented. Disbursement/export buttons clearly report prototype feedback.

## Pending Approvals & Governance Suite

Open **Approvals** in the sidebar or visit `/#/approvals`. `src/Approvals.jsx` manages the page, `src/ApprovalQueue.jsx` renders the queue, and `src/approvalData.js` holds the four supplied requests.

React state controls requester search, category/department/urgency/escalation filters, row selection and bulk actions, requester-specific details, audit comments, approval, rejection, delegation, information requests, empty states, dialogs, and feedback. Rejection reasons and inquiry messages are required. Processed requests leave the pending queue; their local records retain status and decision metadata. Tab and bulk counts reflect the sample records.

Run `npm run check:approvals` for JSX/server rendering and handler checks covering filters, correct details, comments, rejection validation, delegation, inquiry, and bulk approval. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

All changes remain in memory and reset on navigation or refresh. No approvals are submitted to external systems, notifications or inquiries are sent, or immutable audit logs created. Static summary statistics and escalation copy retain source sample content. The selected-request detail panel uses the actual sample request rather than reusing Jane Doe?s leave details for other request types.

## Recruitment Interview Calendar & Panel Schedule

Open **Interviews** in the sidebar or visit `/#/interview-calendar`. `src/InterviewCalendar.jsx` manages the page; `src/InterviewSchedule.jsx` renders calendar views; `src/interviewData.js` holds the eleven supplied sample interview slots.

React controls week/month/day views, real date navigation, Today in Asia/Calcutta, selected-candidate details, local scheduling/rescheduling/cancellation, and panel conflict checks. Scheduling validates the time range and requires panelists. Conflicts use overlapping intervals and known panelist assignments in the local dataset. Suggested alternatives update the form; Tomorrow also changes the date. Dialogs support Escape and focus management.

Run `npm run check:interviews` for JSX/server rendering and handler checks covering views/navigation, correct candidate details, conflict prevention, suggested alternatives, scheduling, rescheduling, and cancellation. Other page regression scripts remain available. These checks do not replace browser testing or a production build.

All data is illustrative, and changes reset on navigation or refresh. Initial source dates remain February 2025; Today navigates to the actual current date. Only supplied panelist assignments are known, so conflict checks cannot assess external availability. No calendar invites, Google Meet links, room locks, emails, or external calendar updates are created. Notification controls retain preferences only.

## Candidate Pipeline & Hiring Stages

Open **Candidate Pipeline** in the sidebar or visit `/#/candidate-pipeline`. The existing Recruitment detail page remains available. `src/CandidatePipeline.jsx` manages the page; `src/PipelineViews.jsx` contains reusable board/list views; `src/pipelineData.js` and `src/pipelineFields.js` contain the ten supplied candidates and form defaults.

React state connects board/list stages, drag-and-drop movement, accessible stage selectors, shared row selection, bulk moves and rejection, job filtering, search, candidate-specific drawers, candidate creation, resume filename selection, interview previews, and empty/loading simulators. Bulk counts reflect unique selected candidates across views. Dialogs support Escape and focus management.

Run `npm run check:pipeline` for JSX/server rendering and handler checks covering search, correct drawers, stage changes, drag/drop, bulk moves, candidate creation, rejection, interview previews, and job filtering. Other page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. All supplied candidates belong to REQ-2025-089; other jobs begin empty. ATS scores and drawer supporting history remain illustrative. Resume selection stores filenames only, without upload or parsing. Interviews save local metadata without syncing the separate interview calendar. No emails or invites are sent.

## Attendance Regularization & WFH Suite

Open **Regularization & WFH** in the sidebar or visit `/#/attendance-regularization`. `src/AttendanceRegularization.jsx` manages the page, `src/RegularizationRow.jsx` renders request rows, and `src/regularizationData.js` contains the four supplied sample requests.

React state connects regularization/WFH tabs, employee search, status/type filters, eligible-only selection, bulk decisions, selected-request details, approval, mandatory rejection reasons, and simulator states. Requests awaiting L1 manager sign-off cannot be selected or approved; completed requests have no decision controls. The default regularization tab shows three requests, and WFH shows the supplied approved request. Static pagination was replaced with actual sample counts. Dialogs support Escape and focus management.

Run `npm run check:regularization` for JSX/server rendering and handler checks covering tabs, search, eligible selection, the manager gate, correct details, rejection validation, rejection, and approval. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. No payroll synchronization, employee email, or external approval update is performed. Dashboard statistics and the read-only period control retain source sample values.

## Automated Resume Inbox & AI Parsing Queue

Open **Resume Inbox** in the sidebar or visit `/#/resume-inbox`. `src/ResumeInbox.jsx` manages the page, `src/ResumeInboxRow.jsx` renders reusable rows, and `src/resumeInboxData.js` plus `src/mailboxConfigData.js` hold the six supplied sample records and configuration defaults.

React state controls name/skill/role search, source/status filters, selection, individual and bulk requisition assignment, direct import, sample reparse, confirmed discard, queue counts, mailbox settings, connection previews, polling/empty simulators, and notifications. Assignment stores the chosen stage and note, and assigned/imported items leave the unassigned queue. Static pagination was replaced with matching sample counts. Dialogs support Escape and focus management.

Run `npm run check:resume-inbox` for JSX/server rendering and handler checks covering filters, sample reparse, assignment, import, discard, bulk assignment, and mailbox previews. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

All changes remain in memory and reset on navigation or refresh. Mailbox polling only refreshes the local preview; connection testing performs no network handshake. Reparse applies the source?s illustrative 82% score without OCR. Assignment/import do not update other pages or external ATS records. No CSV files, emails, mailbox synchronization, or credential storage are implemented. Other dashboard statistics remain sample values.

## Succession Planning & Leadership Pipeline

Open **Succession** in the sidebar or visit `/#/succession`. `src/Succession.jsx` manages the page; `src/SuccessionCard.jsx` renders reusable role cards; `src/successionData.js` and `src/successionFields.js` contain the four sample plans and form defaults.

React state connects role search and department/risk/readiness filters, role and 9-box views, correct plan drawers, plan creation/editing/deletion, successor nomination/removal, activity creation/completion/deletion, candidate popovers, export menu, confirmations, and notifications. Duplicate nominations and invalid bench capacities are rejected. Dialogs support Escape and focus management.

Run `npm run check:succession` for JSX/server rendering and handler checks of filters, plan-specific drawers, nomination, activities, profiles, and plan editing/creation/deletion. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. The source 9-box placements, compensation examples, and dashboard analytics remain illustrative sample content; role pools and candidate readiness use the local state. No Executive Board synchronization, external notifications, budget transactions, or exported files are generated.

## Survey Builder

Open **Survey Builder** in the sidebar or visit `/#/survey-builder`. `src/SurveyBuilder.jsx` manages settings, views and dialogs; `src/SurveyComponents.jsx` contains reusable question editors, skip-rule configuration and respondent preview; `src/surveyData.js` and `src/surveySettings.js` contain the supplied defaults.

React supports editable survey details, anonymous-response preference, audience selection, start/end scheduling, reminder preferences, Rating/Multiple Choice/eNPS/Text/Matrix question creation, duplication, confirmation-based deletion, reordering, required flags, and option editing. Preview uses the current questionnaire, validates required answers, and supports forward skip rules on numeric ratings. Reordering clears skip rules to avoid invalid jumps. Draft and publish actions store session snapshots; local publishing validates the title, questions, options, and schedule range. Dialogs support Escape and keyboard focus management.

Run `npm run check:survey` for JSX/server rendering and handler checks covering question operations, rule saving, current preview, publishing, required answers, forward skips, and preview completion. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Data remains in memory and resets on navigation or refresh. Audience counts and department chips are illustrative; CSV recipient import and the AI co-pilot are not connected. No real employee responses, anonymity guarantees, campaign invitations, notification jobs, public survey hosting, or analytics service are implemented. The copied link opens the local builder.

## Survey Results & Analytics

Open **Survey Results** in the sidebar or visit `/#/survey-results`. The page links back to the existing Survey Builder. `src/SurveyResults.jsx` manages the dashboard, `src/SurveyCommentStream.jsx` renders reusable comment cards, and `src/surveyResultsData.js` contains the three supplied comments.

React controls overview/empty presets, question/department section navigation, metric and participation drilldowns, sentiment filters, reversible HR flags, dynamic sample comment counts, local action-plan creation, export feedback, reminder preview, and clipboard sharing of the local report URL. Dialogs support Escape and focus management.

Run `npm run check:survey-results` for JSX/server rendering and handler checks covering comment filters/flags, metric drilldown, action plans, empty/reset states, and export feedback. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. Analytics, question distributions, department scorecards, tenure charts, and recommendations retain supplied sample values; selecting another question does not synthesize new data. No external report files, secure share tokens, reminder messages, HR escalation messages, or action-plan synchronization are generated. The copied link opens this local page.

## Workforce Planning & Requisition Suite

Open **Workforce Planning** in the sidebar or visit `/#/workforce-planning`. `src/WorkforcePlanning.jsx` replaces the supplied Alpine.js state/directives with React, `src/WorkforceViews.jsx` contains reusable plan/forecast views, and `src/workforceData.js` plus `src/workforceFields.js` hold sample records and form defaults. No Alpine runtime is required.

React controls simulator presets, search and department filters, plan selection, workflow confirmations, new plan/forecast forms, rejection feedback, drilldown drawer, and recruitment previews. Plans transition Draft ? Submitted ? Approved ? Completed; only submitted plans can be rejected back to Draft, and only approved plans can create local recruitment previews. All destructive decisions use confirmation dialogs. The source implementation-reference table was omitted from the product UI. Dialogs support Escape and focus management.

Run `npm run check:workforce` for JSX/server rendering and handler checks covering Alpine removal, filters, plan creation, workflow transitions, required rejection reason, recruitment preview, completion/deletion, and forecast creation. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

All data is illustrative and changes reset on navigation or refresh. Forecast creation stores a local demand model without predictive computation. No budgets are allocated, recruitment jobs published, executive approvals dispatched, or external notifications sent. KPI and drilldown analytics retain the supplied sample values.

## Candidate Dossier

Open **Candidate Dossier** in the sidebar or visit `/#/candidate-dossier`. This is the supplied fixed Karthik Ramanathan sample. `src/CandidateDossier.jsx` manages the page; `src/CandidateDossierComponents.jsx` contains reusable tag/note components; `src/candidateDossierData.js` and `src/candidateDossierFields.js` hold sample notes and form defaults.

React controls the six tabs, lifecycle lock, stage selection, skill tags, safe note creation/editing/confirmed deletion, offer CTC calculation, lifecycle confirmations, communication previews, interview/feedback/assessment records, and typed candidate-removal confirmation. Actions append local activity records. Dialogs support Escape and focus management.

Run `npm run check:candidate-dossier` for JSX/server rendering and handler checks covering tabs, tags, notes, CTC totals, offer preview, locking, communication/interview logs, and deletion safeguards. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. No email, offer letter, calendar invite, assessment, resume download, employee provisioning, equipment shipment, external restriction flag, or ATS purge is performed. Lifecycle changes and deletion affect only this local sample; other project pages retain their independent sample data. Privacy labels and historical scorecards remain UI previews without backend access control.

## Attendance & Time Tracking Suite

Open **Attendance** in the sidebar or visit `/#/attendance`. The page links to the existing Regularization & WFH suite. `src/Attendance.jsx` manages the page; `src/AttendanceComponents.jsx` contains reusable history rows and employee rosters; `src/attendanceData.js` holds the three supplied sample records.

React controls overview/history/empty/loading states, employee and department/status search filters, date-range filtering, status-specific KPI rosters, selected-employee punch details, manual-entry validation and local request creation, export menu, and notifications. Manual requests require a date, a punch-out later than punch-in, and a reason; they are recorded for local review without changing attendance totals. Dialogs support Escape and keyboard focus management.

Run `npm run check:attendance` for JSX/server rendering and handler checks covering tabs, search/status/date filters, correct employee drilldown, required reason, and local manual requests. Existing page regression scripts remain available. These checks do not replace browser testing or a production build.

Changes remain in memory and reset on navigation or refresh. Original analytics, dates, map/location imagery, and historical device information remain illustrative sample content. No GPS lookup, biometric verification, reminders, exports, payroll sync, or external regularization submission is performed. The separate regularization page retains its independent sample records.
