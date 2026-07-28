#!/usr/bin/env python3
"""Generate Onboarding & Offboarding Functionality Audit as .docx"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor


OUT_PATH = Path(__file__).resolve().parents[1] / "EMS_Onboarding_Offboarding_Functionality_Audit.docx"

# Status labels matching the prompt
FULL = "Fully Functional"
PARTIAL = "Partially Functional / Needs Improvement"
MISSING = "Not Available / Missing"
MANUAL = "Manual Workaround Only (not automated)"
NA = "N/A (not applicable to our setup)"


def set_cell_shading(cell, hex_color: str):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tePr = cell._tc.get_or_add_tcPr()
    cell._tc.get_or_add_tcPr().append(shading)


def style_header_row(row):
    for cell in row.cells:
        set_cell_shading(cell, "1F4E79")
        for p in cell.paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(9)


def status_color(status: str) -> str:
    if status.startswith("Fully"):
        return "C6EFCE"
    if status.startswith("Partially"):
        return "FFEB9C"
    if status.startswith("Not Available"):
        return "FFC7CE"
    if status.startswith("Manual"):
        return "FCE4D6"
    return "D9D9D9"


def add_heading(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_para(doc, text, bold=False, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    return p


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        hdr.cells[i].text = h
    style_header_row(hdr)

    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = str(val) if val is not None else ""
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(8)
            if c_idx == 1:  # Status column
                set_cell_shading(cell, status_color(str(val)))
    return table


HEADERS = [
    "Functionality",
    "Status",
    "Level",
    "Business Impact",
    "Recommendation",
    "Priority",
]


def row(func, status, level, impact, rec, priority):
    # For Fully Functional, keep impact/rec/priority light unless useful
    if status == FULL and not impact:
        impact = "Capability available in current EMS lifecycle stack."
    if status == FULL and not rec:
        rec = "Maintain; validate in production with org feature flags enabled."
    if status == FULL and not priority:
        priority = "Low"
    return [func, status, level, impact, rec, priority]


# ─────────────────────────────────────────────────────────────
# ONBOARDING — ENTERPRISE
# ─────────────────────────────────────────────────────────────
ONB_ENT = [
    # Pre-boarding
    row(
        "Offer letter generation and e-signature",
        PARTIAL,
        "Enterprise",
        "Offers can be generated and tracked, but vendor e-sign (DocuSign/Adobe/Aadhaar) requires credentials; default is internal typed acknowledgment. Policy signing does not use the e-sign adapter.",
        "Configure vendor e-sign credentials for production; route policy/contract signing through esignAdapter; add audit trail for vendor envelopes.",
        "High",
    ),
    row(
        "Offer acceptance tracking/status",
        FULL,
        "Enterprise",
        "HR can track Draft→Sent→Viewed→Accepted/Declined with offer analytics.",
        "Keep; optionally add one-click convert Accepted offer → Employee + Onboarding workflow.",
        "Medium",
    ),
    row(
        "Pre-joining document upload portal (ID proof, certificates, bank details)",
        PARTIAL,
        "Enterprise",
        "Document collection and Document Hub work post-hire; true pre-joining (before employee account) is limited. candidatePortal feature defaults off and has no full document portal.",
        "Build candidate pre-boarding portal (tokenized) for docs/bank/forms before Day 1; enable candidatePortal with end-to-end routes.",
        "High",
    ),
    row(
        "Background verification (BGV) initiation and status tracking",
        PARTIAL,
        "Enterprise",
        "BGV cases, progress, join-blocking, and HR UI exist; default vendor is manual. Live vendors (SpringVerify/AuthBridge/IDfy) need API keys.",
        "Connect production BGV vendor; expose SLA dashboards and auto-block Day-1 when bgvBlocksJoining is on.",
        "High",
    ),
    row(
        "Pre-boarding portal/link sent to candidate before Day 1",
        PARTIAL,
        "Enterprise",
        "Offer portal link (/offer/:token) is emailed; no multi-step pre-boarding portal for docs/forms/BGV consent.",
        "Extend public portal beyond offer accept to include document pack, forms, and status checklist.",
        "High",
    ),
    row(
        "Automated reminders for pending documents",
        FULL,
        "Enterprise",
        "Scheduled onboarding sync sends due/overdue document and task reminders (email/in-app).",
        "Add SMS channel implementation; allow configurable reminder cadence beyond 3/1/0/overdue defaults.",
        "Medium",
    ),
    row(
        "Reference check workflow",
        PARTIAL,
        "Enterprise",
        "Reference is a BGV check type with feature flag (default off). No referee invite or questionnaire workflow.",
        "Add referee portal + questionnaire; auto-create reference checks when referenceVerification is enabled.",
        "Medium",
    ),
    row(
        "Medical/insurance enrollment form collection",
        MISSING,
        "Enterprise",
        "No dedicated medical/insurance enrollment pack; only generic forms/catalog categories. Delays benefits enrollment and compliance for insurers.",
        "Ship medical/insurance enrollment form pack with carrier fields, dependents, and status tracking.",
        "Medium",
    ),
    # Day-1
    row(
        "Employee ID / user account auto-creation",
        FULL,
        "Enterprise",
        "Employee registration generates Employee ID and User account; optional auto-create onboarding workflow.",
        "Document that ID creation is at hire registration (not a separate Day-1 API).",
        "Low",
    ),
    row(
        "Email account provisioning",
        MANUAL,
        "Enterprise",
        "Checklist/IT request tracks 'Email Activated'; no Google Workspace/M365 mailbox create API. Manual IT work causes Day-1 delays.",
        "Integrate mailbox provisioning via IdP/ITSM with status sync back to workflow.",
        "High",
    ),
    row(
        "IT asset allocation & tracking (laptop, SIM, access card)",
        PARTIAL,
        "Enterprise",
        "Workflow assets[] with statuses exists; not a full asset inventory (procurement, barcode, depreciation).",
        "Link to asset inventory module or expand serial/custody fields and reports.",
        "Medium",
    ),
    row(
        "System/tool access provisioning (ERP, CRM, Slack, etc.) with role-based access",
        PARTIAL,
        "Enterprise",
        "IT provisioning + ticketing adapters exist; unconfigured vendors return stubs. No direct IdP/group sync for Slack/ERP/CRM.",
        "Enable itTicketingIntegration with ServiceNow/Jira; map roles to IdP groups for auto-provision.",
        "High",
    ),
    row(
        "Seating/workstation assignment",
        MISSING,
        "Enterprise",
        "No seating/desk/floor fields or UI. Facilities cannot plan desks for new joiners in-system.",
        "Add seating assignment fields + Admin UI and optional floor-plan integration.",
        "Low",
    ),
    row(
        "Welcome kit / welcome email automation",
        PARTIAL,
        "Enterprise",
        "Account welcome email on register; workflow welcomeMessage exists. Feature key welcomeEmail is registered but not enforced in service logic. No welcome-kit logistics.",
        "Wire welcomeEmail feature gate; add optional welcome-kit checklist and shipping status.",
        "Medium",
    ),
    row(
        "Org chart / team introduction auto-notification",
        MANUAL,
        "Enterprise",
        "Manager induction tasks and new-hire notify to HR exist; no automatic team peer introduction fan-out.",
        "Add 'notify team' automation on join date using org chart/manager direct reports.",
        "Low",
    ),
    row(
        "Digital ID card / badge generation",
        FULL,
        "Enterprise",
        "Separate ID Card module with PDF generation; auto-generate attempted on employee register.",
        "Optionally gate ID card issuance on onboarding checklist completion.",
        "Low",
    ),
    # Documentation & Compliance
    row(
        "Statutory form collection (tax, PF, insurance, etc.)",
        PARTIAL,
        "Enterprise",
        "India-oriented default forms and document catalog (PF/ESI/UAN/tax) via Form Builder; insurance enrollment weak; assignment depends on org publishing forms.",
        "Auto-assign country compliance pack forms on hire; add insurance enrollment pack.",
        "High",
    ),
    row(
        "Policy acknowledgment & e-sign tracking",
        PARTIAL,
        "Enterprise",
        "policySignatures on workflow with reminders; signatures skipped if no documentUrl; internal ack not vendor e-sign.",
        "Require policy document URLs; use esignAdapter for mandatory policies; report unsigned % by cohort.",
        "High",
    ),
    row(
        "Employment contract generation and signature",
        PARTIAL,
        "Enterprise",
        "Offer letter is first-class; generic letter engine can produce contracts but no dedicated employment-contract portal like offers.",
        "Add employment_contract letter type with public token portal and e-sign parity with offers.",
        "Medium",
    ),
    row(
        "Document repository per employee (auto-filed, searchable)",
        FULL,
        "Enterprise",
        "Document Hub with library, versioning, assign/verify, export; letters can file into hub.",
        "Continue investing in global lifecycle search UX across all content types.",
        "Low",
    ),
    row(
        "Compliance dashboard (who has/hasn't completed mandatory docs)",
        PARTIAL,
        "Enterprise",
        "Pending docs/expiry/reports and enterprise cues exist; not a single dedicated compliance % scorecard page.",
        "Ship a Compliance Dashboard: mandatory doc completion %, overdue, by dept/location.",
        "Medium",
    ),
    # Training & Induction
    row(
        "LMS auto-enrollment based on role/department",
        PARTIAL,
        "Enterprise",
        "LMS adapters + assign/sync/dashboard exist; trainingLms defaults off; no role/department auto-enrollment rules; external LMS needs credentials.",
        "Add enrollment rules by role/dept; enable trainingLms by default when LMS configured.",
        "Medium",
    ),
    row(
        "Induction schedule/calendar auto-generation",
        MISSING,
        "Enterprise",
        "Calendar integration is built for exit interviews, not onboarding induction calendars. Induction scheduling stays manual.",
        "Generate Week-1 induction calendar (ICS/Teams/Meet) from template sessions.",
        "Medium",
    ),
    row(
        "Buddy/mentor auto-assignment",
        PARTIAL,
        "Enterprise",
        "Buddy can be assigned at workflow create with check-ins; no auto-matching algorithm (load/dept).",
        "Add buddy matching rules (same dept, capacity) with optional auto-assign.",
        "Low",
    ),
    row(
        "Role-specific onboarding checklist/task list",
        FULL,
        "Enterprise",
        "Templates with assigneeRole (employee/hr/it/manager/buddy/payroll), workflow builder, feature-gated tasks.",
        "Optionally auto-select template by designation/dept.",
        "Low",
    ),
    row(
        "Progress tracking of induction completion",
        FULL,
        "Enterprise",
        "Progress breakdown, stages, dashboards, and org-wide views for HR/managers.",
        "Maintain; add bottleneck stage analytics.",
        "Low",
    ),
    row(
        "Certification/quiz tracking post-training",
        PARTIAL,
        "Enterprise",
        "Quiz schema + LMS certify/sync; certificates often URL placeholders unless LMS provides them.",
        "Harden internal quiz UX and certificate issuance for non-LMS orgs.",
        "Medium",
    ),
    # Workflow & Collaboration
    row(
        "Multi-department task assignment (HR, IT, Admin, Manager) with owner and due date",
        FULL,
        "Enterprise",
        "Tasks with assigneeRole, assignedTo, dueDate; role resolution on create.",
        "Maintain; improve Admin role coverage in default templates.",
        "Low",
    ),
    row(
        "Automated escalation for overdue onboarding tasks",
        FULL,
        "Enterprise",
        "Escalation rules + history + notifications when configured; recipient discovery uses heuristic role matching.",
        "Replace heuristic recipient matching with explicit role→user mapping.",
        "Medium",
    ),
    row(
        "Manager/HR dashboard showing onboarding status of each new hire",
        FULL,
        "Enterprise",
        "Onboarding Hub, Enterprise Command Center, Probation/LMS centers, enhanced dashboard stats.",
        "Maintain.",
        "Low",
    ),
    row(
        "Notification/alerts (email, SMS, in-app) at each stage",
        PARTIAL,
        "Enterprise",
        "Rich event registry with email/in-app/push; SMS/WhatsApp/Teams/Slack are largely settings placeholders unless webhooks configured.",
        "Implement SMS provider; document Teams/Slack webhook setup; default critical events to multi-channel.",
        "Medium",
    ),
    # Feedback & Tracking
    row(
        "30/60/90-day check-in scheduling",
        FULL,
        "Enterprise",
        "Milestone service seeds 30/60/90 reviews; overdue sync; panel UI. No calendar invites.",
        "Optionally schedule calendar invites for milestone reviews.",
        "Low",
    ),
    row(
        "New hire feedback/survey forms",
        PARTIAL,
        "Enterprise",
        "Milestone feedback + Engagement Surveys module; employeeFeedback feature flag not fully wired into onboarding triggers.",
        "Auto-trigger new-hire surveys at Day 7/30; wire employeeFeedback into onboarding actions.",
        "Medium",
    ),
    row(
        "Manager sign-off / probation review workflow",
        FULL,
        "Enterprise",
        "Probation Center: init/extend/mid/final review/confirm/reject with notifications.",
        "Maintain.",
        "Low",
    ),
    row(
        "Onboarding completion analytics/reporting (time-to-productivity, drop-off points)",
        PARTIAL,
        "Enterprise",
        "Completion rate, avg onboarding days, joining trend, doc/BGV/offer analytics exist. No drop-off funnel or true time-to-productivity KPI.",
        "Add stage funnel/drop-off and time-to-productivity metrics tied to milestones.",
        "Medium",
    ),
    row(
        "Employee self-service status tracker (\"where am I in onboarding\")",
        FULL,
        "Enterprise",
        "HR can view employee progress; employees have self-service tracker (see Employee section). Admin configures templates/features.",
        "Maintain.",
        "Low",
    ),
]

# ─────────────────────────────────────────────────────────────
# ONBOARDING — EMPLOYEE
# ─────────────────────────────────────────────────────────────
ONB_EMP = [
    row(
        "Offer letter generation and e-signature",
        PARTIAL,
        "Employee",
        "Candidate (pre-hire) can view/accept/sign via public offer portal; logged-in employee is not the primary offer actor. Internal e-sign only unless vendor configured.",
        "Clarify candidate vs employee UX; ensure signed PDF downloadable from employee document hub after hire.",
        "Medium",
    ),
    row(
        "Offer acceptance tracking/status",
        FULL,
        "Employee",
        "Candidate sees accept/decline status on portal; post-hire offer ack can appear in docs/checklist.",
        "Show historical offer status on employee onboarding tracker.",
        "Low",
    ),
    row(
        "Pre-joining document upload portal (ID proof, certificates, bank details)",
        PARTIAL,
        "Employee",
        "Employee uploads docs after EMS account exists (profile/onboarding). Cannot upload as candidate before Day 1 without account.",
        "Provide tokenized candidate upload before account creation.",
        "High",
    ),
    row(
        "Background verification (BGV) initiation and status tracking",
        PARTIAL,
        "Employee",
        "Employee may see BGV status on workflow if exposed; cannot initiate or update vendor checks.",
        "Surface clear BGV status + blockers on My Onboarding page.",
        "Medium",
    ),
    row(
        "Pre-boarding portal/link sent to candidate before Day 1",
        PARTIAL,
        "Employee",
        "Candidate receives offer link only; not a full pre-boarding experience.",
        "Expand portal to docs/forms checklist for candidates.",
        "High",
    ),
    row(
        "Automated reminders for pending documents",
        FULL,
        "Employee",
        "Employee receives reminders for pending docs/tasks via email/in-app.",
        "Add in-app banner on My Onboarding for overdue items.",
        "Low",
    ),
    row(
        "Reference check workflow",
        MISSING,
        "Employee",
        "No employee/referee self-service for references; HR-only checklist status.",
        "Allow employee to submit referee contacts; referee portal for responses.",
        "Medium",
    ),
    row(
        "Medical/insurance enrollment form collection",
        MISSING,
        "Employee",
        "No out-of-box medical/insurance enrollment self-service.",
        "Add employee benefits enrollment forms in onboarding forms pack.",
        "Medium",
    ),
    row(
        "Employee ID / user account auto-creation",
        FULL,
        "Employee",
        "Employee receives credentials after HR creates account; does not self-create.",
        "N/A beyond credential delivery UX.",
        "Low",
    ),
    row(
        "Email account provisioning",
        MANUAL,
        "Employee",
        "Employee waits for IT; can only see checklist status (Email Activated).",
        "Show provisioning ETA/ticket status on employee tracker.",
        "Medium",
    ),
    row(
        "IT asset allocation & tracking (laptop, SIM, access card)",
        PARTIAL,
        "Employee",
        "Employee can see asset checklist items; does not manage allocation.",
        "Allow employee to confirm receipt/condition of assets.",
        "Low",
    ),
    row(
        "System/tool access provisioning (ERP, CRM, Slack, etc.) with role-based access",
        PARTIAL,
        "Employee",
        "Employee is subject of provisioning; limited visibility into request status.",
        "Expose software request statuses on My Onboarding.",
        "Medium",
    ),
    row(
        "Seating/workstation assignment",
        MISSING,
        "Employee",
        "No self-service seating view/assignment.",
        "Show assigned seat/floor on Day-1 checklist when feature is built.",
        "Low",
    ),
    row(
        "Welcome kit / welcome email automation",
        PARTIAL,
        "Employee",
        "Receives account welcome email; no welcome-kit tracking.",
        "Notify when welcome kit is shipped/ready for pickup.",
        "Low",
    ),
    row(
        "Org chart / team introduction auto-notification",
        MANUAL,
        "Employee",
        "No automatic introduction email to team; relies on manager/buddy tasks.",
        "Send new hire a team intro pack (manager + peers) on Day 1.",
        "Low",
    ),
    row(
        "Digital ID card / badge generation",
        FULL,
        "Employee",
        "Employee can view/download own ID card from ID Card module.",
        "Link ID card download from onboarding checklist item.",
        "Low",
    ),
    row(
        "Statutory form collection (tax, PF, insurance, etc.)",
        PARTIAL,
        "Employee",
        "Employee can fill assigned digital forms (tax/bank/nominee/etc.) when published/assigned.",
        "Ensure all mandatory statutory forms are auto-assigned on workflow create.",
        "High",
    ),
    row(
        "Policy acknowledgment & e-sign tracking",
        PARTIAL,
        "Employee",
        "Employee can acknowledge/sign onboarding policies when documentUrl present.",
        "Block progress until mandatory policies signed; support mobile-friendly e-sign.",
        "High",
    ),
    row(
        "Employment contract generation and signature",
        PARTIAL,
        "Employee",
        "Employee can acknowledge generated letters; no dedicated contract portal parity with offer portal.",
        "Provide employee letter inbox with pending signature actions.",
        "Medium",
    ),
    row(
        "Document repository per employee (auto-filed, searchable)",
        FULL,
        "Employee",
        "Employee can upload/view own documents via profile/onboarding paths.",
        "Maintain searchable personal document list.",
        "Low",
    ),
    row(
        "Compliance dashboard (who has/hasn't completed mandatory docs)",
        MISSING,
        "Employee",
        "Compliance dashboards are Admin/HR only; employee sees own pending items, not org compliance.",
        "Keep org compliance Admin-only; improve personal 'mandatory docs remaining' widget.",
        "Low",
    ),
    row(
        "LMS auto-enrollment based on role/department",
        PARTIAL,
        "Employee",
        "Employee completes assigned training; does not get auto-enrolled by role unless HR assigns / LMS rules exist (rules missing).",
        "Auto-enroll mandatory courses on hire; show course list on My Onboarding.",
        "Medium",
    ),
    row(
        "Induction schedule/calendar auto-generation",
        MISSING,
        "Employee",
        "No induction calendar for employee to accept/join.",
        "Publish personal induction calendar with session links.",
        "Medium",
    ),
    row(
        "Buddy/mentor auto-assignment",
        PARTIAL,
        "Employee",
        "Employee sees assigned buddy and check-ins; cannot self-select buddy.",
        "Show buddy contact card and meeting prompts on Day 1.",
        "Low",
    ),
    row(
        "Role-specific onboarding checklist/task list",
        FULL,
        "Employee",
        "Employee sees and completes own tasks in Onboarding Hub / My Onboarding.",
        "Maintain.",
        "Low",
    ),
    row(
        "Progress tracking of induction completion",
        FULL,
        "Employee",
        "Employee progress rings/stages available on self-service tracker.",
        "Maintain.",
        "Low",
    ),
    row(
        "Certification/quiz tracking post-training",
        PARTIAL,
        "Employee",
        "Employee can complete modules/quizzes when attached; certificate UX depends on LMS/content.",
        "Always show pass/fail and certificate download when available.",
        "Medium",
    ),
    row(
        "Multi-department task assignment (HR, IT, Admin, Manager) with owner and due date",
        FULL,
        "Employee",
        "Employee completes employee-role tasks; can see overall workflow progress depending on visibility.",
        "Clarify which cross-department tasks are visible vs hidden for privacy.",
        "Low",
    ),
    row(
        "Automated escalation for overdue onboarding tasks",
        FULL,
        "Employee",
        "Employee may receive escalations/reminders when their tasks are overdue (as assignee).",
        "Show escalation banner when item is escalated.",
        "Low",
    ),
    row(
        "Manager/HR dashboard showing onboarding status of each new hire",
        MISSING,
        "Employee",
        "Org dashboards are not for employees; managers with access use manager views.",
        "N/A for pure employee role; ensure managers have filtered team view.",
        "Low",
    ),
    row(
        "Notification/alerts (email, SMS, in-app) at each stage",
        PARTIAL,
        "Employee",
        "Employee gets email/in-app/push for many lifecycle events; SMS unlikely without provider.",
        "Let employee choose notification preferences per channel.",
        "Medium",
    ),
    row(
        "30/60/90-day check-in scheduling",
        FULL,
        "Employee",
        "Employee can submit milestone self-reviews.",
        "Add calendar reminder for upcoming check-ins.",
        "Low",
    ),
    row(
        "New hire feedback/survey forms",
        PARTIAL,
        "Employee",
        "Milestone feedback available; automated new-hire surveys not consistently triggered.",
        "Auto-assign Day 7/30 pulse surveys to new hires.",
        "Medium",
    ),
    row(
        "Manager sign-off / probation review workflow",
        PARTIAL,
        "Employee",
        "Employee is subject of probation; limited self-service beyond being reviewed / seeing outcomes depending on UI exposure.",
        "Show probation status, next review date, and outcome on employee tracker.",
        "Medium",
    ),
    row(
        "Onboarding completion analytics/reporting (time-to-productivity, drop-off points)",
        MISSING,
        "Employee",
        "Analytics are Admin/HR only.",
        "Keep Admin-only; optional personal completion summary for employee.",
        "Low",
    ),
    row(
        "Employee self-service status tracker (\"where am I in onboarding\")",
        FULL,
        "Employee",
        "My Onboarding / Employee Lifecycle hub shows tasks, docs, progress (/my-workflow, /my-tasks).",
        "Maintain; extend to pre-hire candidates.",
        "Low",
    ),
]

# ─────────────────────────────────────────────────────────────
# OFFBOARDING — ENTERPRISE
# ─────────────────────────────────────────────────────────────
OFF_ENT = [
    row(
        "Resignation submission (employee self-service)",
        MISSING,
        "Enterprise",
        "Feature flag 'resignation' and task exist, but create offboarding is Admin/HR-only. No employee resignation API. Causes process bottleneck and shadow exit tracking.",
        "Add employee self-service resignation form → manager/HR approval → auto-create OffboardingWorkflow.",
        "High",
    ),
    row(
        "Termination initiation (HR/manager-side)",
        PARTIAL,
        "Enterprise",
        "HR/Admin can create Termination/Retirement/Contract End workflows; managers cannot initiate via dedicated API without Admin/HR privileges.",
        "Add manager-initiate termination/resignation request with HR confirmation.",
        "High",
    ),
    row(
        "Approval workflow (manager → HR → department chain)",
        PARTIAL,
        "Enterprise",
        "Lifecycle approval engine exists (Offboarding/Clearance/FnF/ExitInterview) but initiation does not call it; clearance is checklist ticks, not chained approvals.",
        "Wire createOffboardingWorkflow to initiateLifecycleApproval for resignation/termination chains.",
        "High",
    ),
    row(
        "Notice period calculation and tracking",
        FULL,
        "Enterprise",
        "Notice period service: policy by grade/dept/type, served/remaining, buyout, leave adjustment, dashboard.",
        "Sync remaining notice with leave balances automatically.",
        "Medium",
    ),
    row(
        "Last working day auto-calculation and confirmation",
        MANUAL,
        "Enterprise",
        "lastWorkingDate is required manual input on create; notice tracks against it but does not compute LWD. No confirm step.",
        "Auto-calc LWD from resignation date + notice policy (holiday calendar); add confirm by employee/manager.",
        "High",
    ),
    row(
        "Exit interview scheduling (auto-invite)",
        PARTIAL,
        "Enterprise",
        "Sessions provisioned on create; calendar ICS/Meet optional; real calendar depends on env. Not guaranteed org-wide auto-invite.",
        "Default calendar invites to conductor + employee; integrate Google/Outlook fully.",
        "Medium",
    ),
    row(
        "Exit interview feedback form and capture",
        FULL,
        "Enterprise",
        "Templates, draft/submit/close, action items, analytics; Admin Exit Interview Hub.",
        "Deprecate legacy inline exitInterview field to avoid dual models.",
        "Low",
    ),
    row(
        "Resignation letter/acceptance letter generation",
        PARTIAL,
        "Enterprise",
        "Catalog includes resignation_acceptance/termination_letter but automation only fires experience/relieving/service_certificate.",
        "Auto-generate acceptance/termination letters on approval; publish default templates.",
        "Medium",
    ),
    row(
        "Exit checklist auto-generation per department (IT, Admin, Finance, HR)",
        PARTIAL,
        "Enterprise",
        "Default stages/tasks/clearance rules instantiate per workflow; Admin dept items thin unless template/pack expands.",
        "Enrich default clearance packs per department; allow org chart–driven owners.",
        "Medium",
    ),
    row(
        "IT asset recovery tracking (laptop, mobile, accessories)",
        FULL,
        "Enterprise",
        "Assets synced from onboarding; Pending/Returned/Damaged/Lost/Waived; HR/IT update APIs and progress weight.",
        "Add barcode/custody chain if enterprise asset audit required.",
        "Low",
    ),
    row(
        "System access revocation (auto-trigger on last working day)",
        PARTIAL,
        "Enterprise",
        "Adapters for Azure AD/Google/Okta/GitHub/HRMS; unregistered systems stub success. autoRevokeOnLwd runs on workflow completion, not LWD job.",
        "Schedule LWD-day revocation job; implement VPN/badge/Slack/Jira adapters; rename policy to match behavior.",
        "High",
    ),
    row(
        "Email/account deactivation or forwarding setup",
        PARTIAL,
        "Enterprise",
        "Can suspend Google Workspace/Azure/Okta when configured; no mailbox forwarding/delegate/archive workflow.",
        "Add forwarding/delegate options and post-exit mailbox retention policy.",
        "High",
    ),
    row(
        "Badge/access card deactivation",
        MANUAL,
        "Enterprise",
        "Physical access maps to unregistered adapter → manual checklist success. Security risk if badge not actually deactivated.",
        "Integrate physical access control vendor or require IT attestation with ticket proof.",
        "High",
    ),
    row(
        "License/software de-provisioning (cost recovery tracking)",
        MISSING,
        "Enterprise",
        "No SaaS seat inventory or license cost recovery; F&F recoveries are free-form numbers only.",
        "Add software license inventory tied to employee + cost recovery lines in F&F.",
        "Medium",
    ),
    row(
        "KT/handover task assignment and tracking",
        FULL,
        "Enterprise",
        "KT items with topic, transferredBy/To, status, dueDate; overdue sync; manager approve handover task.",
        "Support multiple KT topics from template packs by default.",
        "Low",
    ),
    row(
        "Document/project handover repository",
        PARTIAL,
        "Enterprise",
        "Schema has knowledgeTransfer.documents but API/UI do not write documents; no dedicated handover repo.",
        "Enable document attachments on KT items and link to Document Hub folder.",
        "Medium",
    ),
    row(
        "Successor assignment tracking",
        PARTIAL,
        "Enterprise",
        "transferredTo defaults to manager; HR can change. No succession history/backup chain.",
        "Add successor role, backup assignees, and succession audit history.",
        "Medium",
    ),
    row(
        "Full and final (F&F) settlement calculation",
        PARTIAL,
        "Enterprise",
        "Calculator for leave encashment, dues, bonus, gratuity estimate, recoveries, tax; PDF + optional payroll bridge. Many amounts are manual inputs.",
        "Auto-pull leave balances and open dues; expand statutory F&F components.",
        "High",
    ),
    row(
        "Reimbursement/expense clearance workflow",
        MISSING,
        "Enterprise",
        "Expense module is separate; no exit gate linking open expenses to offboarding clearance.",
        "Block F&F/clearance until open expenses are settled or waived.",
        "High",
    ),
    row(
        "Statutory clearance (PF withdrawal, gratuity, tax forms)",
        PARTIAL,
        "Enterprise",
        "India statutory service: Form 16/12BA, TDS, EPF/ESI statements, gratuity estimate. No PF withdrawal claim filing (Form 19 etc.).",
        "Add PF/ESI exit claim checklist + document generation; clarify gratuity as estimate vs payable.",
        "High",
    ),
    row(
        "Relieving letter / experience letter auto-generation",
        FULL,
        "Enterprise",
        "Auto-trigger on completion when published templates exist; manual generate/upload also supported.",
        "Ensure default templates published in bootstrap for all orgs.",
        "Low",
    ),
    row(
        "No-dues clearance from all departments (digital sign-off)",
        PARTIAL,
        "Enterprise",
        "Multi-role clearanceChecklist with completedBy/At audit; no e-sign; no_due_certificate catalog type not auto-generated.",
        "Generate No-Dues certificate on full clearance; optional e-sign per department head.",
        "Medium",
    ),
    row(
        "Alumni network/database entry",
        FULL,
        "Enterprise",
        "AlumniRecord upsert on completion; list/blacklist/rehire APIs and UI panel. Internal DB, not social alumni network.",
        "Optional alumni portal/comms later if product requires networking.",
        "Low",
    ),
    row(
        "Re-hire eligibility flag and history tracking",
        PARTIAL,
        "Enterprise",
        "eligibleForRehire, blacklist, rehireHistory exist; initiateRehire does not auto-create new hire pipeline.",
        "Link rehire initiation to employee reactivate + onboarding workflow create.",
        "Medium",
    ),
    row(
        "Exit analytics/reporting (attrition trends, exit reasons, department-wise turnover)",
        FULL,
        "Enterprise",
        "Lifecycle reports: by reason, clearance, notice, F&F, assets, KT, exit interview, turnover. Prefer LifecycleReportsHub over legacy AttritionReport (hardcoded series).",
        "Retire or fix legacy AttritionReport; add cohort attrition charts.",
        "Medium",
    ),
    row(
        "Employee self-service exit status tracker",
        FULL,
        "Enterprise",
        "HR can view all workflows; employees have tracker after HR creates case (see Employee section).",
        "Maintain; unlock after self-service resignation exists.",
        "Low",
    ),
]

# ─────────────────────────────────────────────────────────────
# OFFBOARDING — EMPLOYEE
# ─────────────────────────────────────────────────────────────
OFF_EMP = [
    row(
        "Resignation submission (employee self-service)",
        MISSING,
        "Employee",
        "Employee cannot open a resignation case; only complete initiation tasks after HR starts workflow. Major self-service gap.",
        "Build Resign Now flow with reason, preferred LWD, notice acknowledgment.",
        "High",
    ),
    row(
        "Termination initiation (HR/manager-side)",
        MISSING,
        "Employee",
        "Not applicable for employee self-service; employee is subject only.",
        "N/A for employee initiator; ensure clear status messaging if terminated.",
        "Low",
    ),
    row(
        "Approval workflow (manager → HR → department chain)",
        PARTIAL,
        "Employee",
        "Employee may complete own checklist items; does not participate in initiation approval chain (because chain not wired).",
        "Notify employee of approval stage changes once chain is implemented.",
        "High",
    ),
    row(
        "Notice period calculation and tracking",
        PARTIAL,
        "Employee",
        "Employee can view notice fields on own workflow; cannot request/approve buyout.",
        "Allow employee to request buyout/early release for HR approval.",
        "Medium",
    ),
    row(
        "Last working day auto-calculation and confirmation",
        MANUAL,
        "Employee",
        "Employee views LWD entered by HR; no confirmation/acknowledgment step.",
        "Add employee confirm/propose alternate LWD within policy.",
        "High",
    ),
    row(
        "Exit interview scheduling (auto-invite)",
        PARTIAL,
        "Employee",
        "Employee notified and can open sessions; calendar invite depends on org config.",
        "Always send ICS/email invite to employee with join link.",
        "Medium",
    ),
    row(
        "Exit interview feedback form and capture",
        FULL,
        "Employee",
        "Employee can draft/submit self exit interview sessions via Both routes.",
        "Maintain.",
        "Low",
    ),
    row(
        "Resignation letter/acceptance letter generation",
        PARTIAL,
        "Employee",
        "Employee receives issued letters; cannot generate. Resignation acceptance may not auto-issue.",
        "Auto-deliver acceptance letter to employee document inbox.",
        "Medium",
    ),
    row(
        "Exit checklist auto-generation per department (IT, Admin, Finance, HR)",
        PARTIAL,
        "Employee",
        "Employee completes employee-assigned checklist items; cannot complete other depts' items.",
        "Show overall clearance status (pending depts) to employee for transparency.",
        "Low",
    ),
    row(
        "IT asset recovery tracking (laptop, mobile, accessories)",
        PARTIAL,
        "Employee",
        "Employee can view assigned assets; no permission to mark returned.",
        "Allow employee to declare return/handover with photo evidence pending IT confirm.",
        "Medium",
    ),
    row(
        "System access revocation (auto-trigger on last working day)",
        MISSING,
        "Employee",
        "Employee has no control; may lose access without clear timeline communication.",
        "Notify employee of planned revocation date/time and data backup guidance.",
        "Medium",
    ),
    row(
        "Email/account deactivation or forwarding setup",
        MISSING,
        "Employee",
        "No employee self-service for forwarding preferences.",
        "Collect personal email + optional forwarding request before LWD.",
        "Medium",
    ),
    row(
        "Badge/access card deactivation",
        MANUAL,
        "Employee",
        "Employee returns badge physically; system tracking is IT manual tick.",
        "Add employee confirmation of badge return in checklist.",
        "Low",
    ),
    row(
        "License/software de-provisioning (cost recovery tracking)",
        MISSING,
        "Employee",
        "No employee visibility into license returns/costs.",
        "Show assigned software list to acknowledge return of access.",
        "Low",
    ),
    row(
        "KT/handover task assignment and tracking",
        FULL,
        "Employee",
        "Employee can update own KT status/notes and complete handover tasks.",
        "Allow attaching handover docs once repository is enabled.",
        "Low",
    ),
    row(
        "Document/project handover repository",
        PARTIAL,
        "Employee",
        "Cannot upload dedicated handover repository files via current KT API.",
        "Enable employee upload of handover documents to KT item.",
        "Medium",
    ),
    row(
        "Successor assignment tracking",
        PARTIAL,
        "Employee",
        "Employee may see transferredTo; typically set by HR/manager.",
        "Allow employee to propose successor for manager approval.",
        "Low",
    ),
    row(
        "Full and final (F&F) settlement calculation",
        PARTIAL,
        "Employee",
        "Employee can view sanitized settlement status; cannot calculate/approve.",
        "Provide employee-readable F&F summary PDF once approved.",
        "Medium",
    ),
    row(
        "Reimbursement/expense clearance workflow",
        MISSING,
        "Employee",
        "No exit-linked expense clearance self-service; must use separate expense module.",
        "Prompt employee to clear open expenses from exit tracker.",
        "High",
    ),
    row(
        "Statutory clearance (PF withdrawal, gratuity, tax forms)",
        PARTIAL,
        "Employee",
        "May receive statutory docs; no PF withdrawal self-service in lifecycle.",
        "Provide PF withdrawal guidance + form download pack on exit.",
        "High",
    ),
    row(
        "Relieving letter / experience letter auto-generation",
        FULL,
        "Employee",
        "Employee receives issued relieving/experience letters when generated.",
        "Notify employee when letters are ready to download.",
        "Low",
    ),
    row(
        "No-dues clearance from all departments (digital sign-off)",
        PARTIAL,
        "Employee",
        "Employee signs off only own items; sees limited cross-dept status.",
        "Show pending no-dues departments on employee exit tracker.",
        "Medium",
    ),
    row(
        "Alumni network/database entry",
        MISSING,
        "Employee",
        "No alumni self-service portal; alumni managed by HR after exit.",
        "Optional alumni opt-in + contact update after exit.",
        "Low",
    ),
    row(
        "Re-hire eligibility flag and history tracking",
        MISSING,
        "Employee",
        "Rehire flags are HR-only; employee cannot view eligibility.",
        "Optionally disclose eligibility status in relieving communication (policy-dependent).",
        "Low",
    ),
    row(
        "Exit analytics/reporting (attrition trends, exit reasons, department-wise turnover)",
        MISSING,
        "Employee",
        "Reports are Admin/HR only.",
        "N/A for employee role.",
        "Low",
    ),
    row(
        "Employee self-service exit status tracker",
        FULL,
        "Employee",
        "Offboarding Hub employee mode: progress, tasks, KT, checklist, exit interview — after HR creates workflow.",
        "Unlock tracker earlier once self-resignation exists.",
        "Low",
    ),
]


def count_status(rows):
    counts = {FULL: 0, PARTIAL: 0, MISSING: 0, MANUAL: 0, NA: 0}
    for r in rows:
        s = r[1]
        if s in counts:
            counts[s] += 1
        elif s.startswith("Fully"):
            counts[FULL] += 1
        elif s.startswith("Partially"):
            counts[PARTIAL] += 1
        elif s.startswith("Not Available"):
            counts[MISSING] += 1
        elif s.startswith("Manual"):
            counts[MANUAL] += 1
        else:
            counts[NA] += 1
    return counts


def health_score(counts):
    total = sum(counts.values())
    if total == 0:
        return 0
    # Weight: Full=1, Partial=0.55, Manual=0.35, Missing=0, N/A excluded
    na = counts[NA]
    scored = total - na
    if scored == 0:
        return 0
    points = (
        counts[FULL] * 1.0
        + counts[PARTIAL] * 0.55
        + counts[MANUAL] * 0.35
        + counts[MISSING] * 0.0
    )
    return round(100 * points / scored)


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("EMS — Onboarding & Offboarding\nFunctionality Audit & Gap Analysis")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = RGBColor(31, 78, 121)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    m = meta.add_run(
        f"Platform: Custom EMS (Employee Management System) — Lifecycle Module\n"
        f"Environment audited: Codebase / development workspace (not live production telemetry)\n"
        f"Audit date: {date.today().isoformat()}\n"
        f"Scope: Enterprise (Admin/HR/IT/Manager) and Employee self-service"
    )
    m.font.size = Pt(10)

    all_rows = ONB_ENT + ONB_EMP + OFF_ENT + OFF_EMP
    c_all = count_status(all_rows)
    c_onb = count_status(ONB_ENT + ONB_EMP)
    c_off = count_status(OFF_ENT + OFF_EMP)
    score_all = health_score(c_all)
    score_onb = health_score(c_onb)
    score_off = health_score(c_off)

    # Executive Summary
    add_heading(doc, "Executive Summary", 1)
    add_para(
        doc,
        "This audit evaluates every checklist item against the EMS Lifecycle implementation "
        "(services, routes, models, feature registry, and HR/Employee UI). Statuses reflect "
        "actual code capability—not marketing feature flags alone. Vendor integrations that "
        "exist as adapters but require credentials are scored Partially Functional when the "
        "manual/stub path works.",
    )

    add_para(doc, "Overall health scores", bold=True)
    add_para(
        doc,
        f"• Combined Onboarding + Offboarding: {score_all}/100\n"
        f"• Onboarding (Admin + Employee rows): {score_onb}/100\n"
        f"• Offboarding (Admin + Employee rows): {score_off}/100\n"
        f"• Counts (all rows): Fully={c_all[FULL]}, Partial={c_all[PARTIAL]}, "
        f"Manual={c_all[MANUAL]}, Missing={c_all[MISSING]}, N/A={c_all[NA]} "
        f"(total line items = {len(all_rows)})",
    )

    add_para(doc, "Top 5 critical gaps", bold=True)
    critical = [
        "1. No employee self-service resignation — exits are HR-initiated only; resignation feature flag does not expose a submit API.",
        "2. True pre-boarding portal missing — candidates get offer accept only; document/form upload requires an employee account.",
        "3. Day-1 email/IdP provisioning and badge deactivation are checklist/stub-driven — not reliable auto-integrations without env configuration and scheduled LWD jobs.",
        "4. Last working day is manual — notice period tracks against HR-entered LWD; no auto-calc or confirmation workflow.",
        "5. Expense clearance & PF withdrawal not in offboarding — F&F is a strong calculator but many inputs and statutory exit claims remain manual/outside the module.",
    ]
    for line in critical:
        add_para(doc, line)

    add_para(doc, "Strengths (already shipped)", bold=True)
    add_para(
        doc,
        "Multi-role onboarding/offboarding workflows with tasks, escalations, reminders; "
        "Document Hub & forms; offer portal + acceptance tracking; BGV case tracking; "
        "milestones/probation center; exit interviews; asset return tracking; notice period engine; "
        "relieving/experience letter automation; alumni DB; enterprise dashboards & lifecycle reports; "
        "employee self-service progress trackers (post-hire / post-exit-case creation).",
    )

    # Sections A–D
    sections = [
        ("Section A: Onboarding – Enterprise Level", ONB_ENT),
        ("Section B: Onboarding – Employee Level", ONB_EMP),
        ("Section C: Offboarding – Enterprise Level", OFF_ENT),
        ("Section D: Offboarding – Employee Level", OFF_EMP),
    ]

    for title_text, rows in sections:
        doc.add_page_break()
        add_heading(doc, title_text, 1)
        sc = count_status(rows)
        add_para(
            doc,
            f"Summary: Fully={sc[FULL]} | Partial={sc[PARTIAL]} | Manual={sc[MANUAL]} | "
            f"Missing={sc[MISSING]} | Health={health_score(sc)}/100",
        )
        add_table(doc, HEADERS, rows)

    # Section E
    doc.add_page_break()
    add_heading(doc, "Section E: Consolidated Gap Analysis & Recommendations (Prioritized Roadmap)", 1)

    add_heading(doc, "P0 — High priority (next 1–2 sprints)", 2)
    p0 = [
        "Employee self-service resignation → approval chain → auto-create OffboardingWorkflow.",
        "Tokenized candidate pre-boarding portal for documents, bank details, and forms before Day 1.",
        "Wire initiation approval (manager → HR) using existing lifecycleApprovalService.",
        "Auto-calculate LWD from notice policy + employee/manager confirmation.",
        "Fix access revocation: real LWD-day scheduled job; stop treating stub adapters as success without attestation.",
        "Expense clearance gate into offboarding; employee prompt to clear open expenses.",
        "Production BGV vendor credentials + join-blocking enforcement; email/IdP mailbox provisioning path.",
    ]
    for i, item in enumerate(p0, 1):
        add_para(doc, f"{i}. {item}")

    add_heading(doc, "P1 — Medium priority (next quarter)", 2)
    p1 = [
        "Employment contract portal + vendor e-sign for policies/contracts.",
        "Induction calendar auto-generation; LMS role/dept auto-enrollment rules.",
        "F&F auto-pull leave/dues; PF withdrawal guidance pack; No-Dues certificate auto-issue.",
        "KT document repository; successor history; resignation acceptance letter automation.",
        "Compliance dashboard (mandatory docs %); onboarding funnel/drop-off analytics.",
        "SMS notifications; Teams/Slack webhook hardening; welcomeEmail feature enforcement.",
        "Rehire initiation → reactivate employee + onboarding workflow.",
    ]
    for i, item in enumerate(p1, 1):
        add_para(doc, f"{i}. {item}")

    add_heading(doc, "P2 — Lower priority / polish", 2)
    p2 = [
        "Seating/workstation assignment.",
        "Medical/insurance enrollment pack.",
        "Buddy auto-matching algorithm; welcome-kit logistics.",
        "Org-chart team introduction fan-out.",
        "License/SaaS seat cost recovery tracking.",
        "Alumni self-service portal / social network (if required).",
        "Retire legacy AttritionReport hardcoded charts; deepen cohort attrition.",
    ]
    for i, item in enumerate(p2, 1):
        add_para(doc, f"{i}. {item}")

    add_heading(doc, "Suggested sequencing", 2)
    add_para(
        doc,
        "Wave 1 (Exit initiation & Day-1 readiness): resignation self-service, approval chain, LWD auto-calc, "
        "candidate doc portal, access revocation job.\n"
        "Wave 2 (Compliance & money): expense gate, F&F enrichment, statutory exit pack, e-sign hardening.\n"
        "Wave 3 (Experience & analytics): induction calendar, LMS auto-enroll, funnel reports, seating/benefits packs.",
    )

    # Appendix
    doc.add_page_break()
    add_heading(doc, "Appendix: Assumptions and Items Needing Further Clarification", 1)

    add_heading(doc, "Assumptions", 2)
    assumptions = [
        "Audit is based on the EMS codebase and lifecycle documentation (docs/LIFECYCLE_*.md, feature registry, services, routes, vite_client hubs)—not production usage metrics or customer-specific feature flag states.",
        "Feature keys registered with defaultEnabled=true are treated as intended product capability; defaultEnabled=false features are treated as optional/off unless code paths still work when enabled.",
        "Adapters that return stub success when credentials are missing are scored Partial or Manual, not Fully Functional for enterprise production readiness.",
        "Company size / live environment details were not provided; scoring is capability-based for the custom EMS platform.",
        "India-centric statutory packs (Aadhaar/PAN/PF/ESI/Form 16) are assumed relevant; other countries may need country packs.",
        "Separate modules (ID Card, Expenses, Engagement Surveys) count toward capability when they fulfill the checklist intent, even if not nested inside the Onboarding Hub.",
    ]
    for a in assumptions:
        add_para(doc, f"• {a}")

    add_heading(doc, "Needs clarification / verify in target environment", 2)
    clarify = [
        "Which e-sign provider credentials are configured in staging/production (DOCUSIGN_*, Adobe, Aadhaar)?",
        "Are BGV vendor API keys and IT ticketing (ServiceNow/Jira/etc.) configured, or is manual/stub in use?",
        "Are Azure AD / Google Workspace / Okta tokens present for access revocation?",
        "Org-level LifecycleSettings: which features are enabled per customer tenant?",
        "Is offer→employee conversion automated in any environment-specific script not in the main routes?",
        "Should medical/insurance enrollment be in-scope for the first commercial release or deferred?",
        "Is physical badge system integration required for the first enterprise customers?",
        "Legacy AttritionReport vs LifecycleReportsHub — which UI is used by HR today?",
        "SMS provider preference (if SMS is a hard requirement for reminders).",
        "Whether manager role should be allowed to initiate offboarding without Admin/HR.",
    ]
    for c in clarify:
        add_para(doc, f"• {c}")

    add_heading(doc, "Primary evidence sources", 2)
    sources = [
        "server/constants/lifecycleFeatureRegistry.js, onboardingDefaults.js, offboardingDefaults.js",
        "server/services/onboardingService.js, offboardingService.js, offerLetterService.js, noticePeriodService.js",
        "server/services/backgroundVerificationService.js, esignAdapter.js, accessRevocationAdapter.js",
        "server/services/fnfSettlementService.js, lifecycleExitInterviewService.js, lifecycleAlumniService.js",
        "server/services/lifecycleDocumentHubService.js, lifecycleFormService.js, lifecycleLetterService.js",
        "server/services/lifecycleEscalationService.js, lifecycleMilestoneService.js, lifecycleProbationService.js",
        "server/services/lifecycleReportsService.js, lifecycleDashboardService.js, itProvisioningService.js",
        "server/routes/Admin/OnboardingRoutes.js, Admin/LifecycleRoutes.js, Both/OnboardingRoutes.js, Public/LifecyclePortalRoutes.js",
        "vite_client HR Onboarding/Offboarding hubs, OfferCandidatePortal, Enterprise Command Center",
        "docs/LIFECYCLE_API.md, LIFECYCLE_INTEGRATION_GUIDE.md, LIFECYCLE_PHASE_F.md, LIFECYCLE_PHASE0_FOUNDATION.md",
    ]
    for s in sources:
        add_para(doc, f"• {s}")

    add_para(
        doc,
        "\nStatus legend: Fully Functional | Partially Functional / Needs Improvement | "
        "Not Available / Missing | Manual Workaround Only | N/A",
        bold=False,
        size=9,
    )

    doc.save(OUT_PATH)
    print(f"Wrote {OUT_PATH}")
    print(f"Scores: all={score_all} onboarding={score_onb} offboarding={score_off}")
    print(f"Row counts: {len(ONB_ENT)}/{len(ONB_EMP)}/{len(OFF_ENT)}/{len(OFF_EMP)} = {len(all_rows)}")


if __name__ == "__main__":
    build()
