"""
Generate complete Onboarding module inventory (documentation only).
Scope: employee lifecycle onboarding — excludes offboarding UI/API sections except where shared shell exists.
"""
from datetime import date
from pathlib import Path

from docx import Document
from docx.shared import Pt

OUT_PATH = Path(__file__).resolve().parents[1] / "Onboarding_Module_Complete_Inventory.docx"


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    h = doc.add_heading(text, level=level)
    for p in h.runs:
        p.font.size = Pt(14 if level == 1 else 12)


def add_para(doc: Document, text: str) -> None:
    doc.add_paragraph(text)


def add_table(doc: Document, headers, rows) -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    for j, h in enumerate(headers):
        table.rows[0].cells[j].text = h
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = str(val) if val is not None else ""


def main() -> None:
    doc = Document()
    title = doc.add_paragraph("EMS — Complete Onboarding Module Inventory")
    title.runs[0].bold = True
    title.runs[0].font.size = Pt(16)
    add_para(
        doc,
        f"Generated: {date.today().isoformat()}. Method: static trace of React routes, components, navigation, "
        "and backend route files under server/routes (Admin/Both/Public lifecycle + onboarding). "
        "No runtime UI testing. Offboarding-only screens are omitted from feature detail unless they share the /onboarding shell.",
    )

    # ── 1. Pages ──
    add_heading(doc, "1. Every Page (Onboarding Module)", level=1)
    add_para(
        doc,
        "Primary entry: vite_client/src/routes/index.jsx → /onboarding → OnboardingRouteWrapper → EmployeeLifecycle. "
        "Query parameters act as virtual sub-pages (no separate React Router paths).",
    )
    pages = [
        ("Employee Lifecycle Shell", "/onboarding", "All authenticated", "Chrome: Onboarding/Offboarding toggle; HR/Admin also see Enterprise, Reports, Configure", "✅"),
        ("Onboarding Hub — HR/Admin list", "/onboarding", "Admin, HR, Executive", "KPIs, search, status chips, workflow table, create workflow", "✅"),
        ("Onboarding Workflow Detail", "/onboarding?id={workflowId}", "Admin, HR, Manager*, Employee*", "Single-workflow sections (tasks, docs, BGV, etc.)", "✅"),
        ("My Onboarding Journey", "/onboarding", "Employee", "Personal workflow when assigned; Self/Team toggles if manager", "✅"),
        ("Manager Team Onboarding", "/onboarding?view=team", "Manager (direct reports)", "Team stats, card grid, open report workflow", "✅"),
        ("Scheduled / No Workflow", "/onboarding", "Employee", "Empty state before joining or without workflow", "✅"),
        ("Workflow Configuration", "/onboarding?configure=1", "Admin, HR (canAccessLifecycleEnterprise)", "LifecycleConfigurationPanel", "✅"),
        ("Enterprise Command Center", "/onboarding?enterprise=1", "Admin, HR", "LifecycleEnterpriseHub + search/bulk/notifications", "✅"),
        ("Reports & Analytics", "/onboarding?reports=1", "Admin, HR", "LifecycleReportsHub (onboarding tab in scope)", "✅"),
        ("Public Offer Portal", "GET/POST /api/v1/public/lifecycle/offer/:token", "Candidate (token)", "Server-rendered/API portal; not a vite route", "✅"),
        ("Recruitment — Offer Letter tab", "/recruitment/candidates/:id", "Admin, HR", "Offer workflow adjacent to onboarding (offerLetter feature)", "✅"),
        ("Organization SaaS Onboarding", "/organization/onboarding", "Admin, Executive", "Tenant/org setup wizard — NOT employee onboarding", "✅ (separate)"),
        ("Legacy My Onboarding page", "(no route)", "—", "vite_client/src/Employee/Onboarding/MyOnboardingPage.jsx — superseded by /onboarding", "⚠️ Unrouted"),
        ("Legacy Admin Onboarding CRUD", "(no route)", "—", "OnboardingPage.jsx, OnboardingDetailPage.jsx — not registered in routes", "⚠️ Unrouted"),
        ("Buddy Dashboard (standalone)", "(no route)", "Buddy", "BuddyDashboard.jsx — APIs exist; component not linked in routes/nav", "⚠️ Unrouted"),
    ]
    add_table(doc, ["Page Name", "Route", "Role", "Purpose", "Status"], pages)

    # ── 2–5 per-page detail ──
    add_heading(doc, "2. Sections, Components, Tabs, and Actions by Page", level=1)

    sections = [
        (
            "Onboarding Hub — HR/Admin list (/onboarding)",
            "Sections: Header (Onboard New Employee); KPI row (Pending Actions, Offer Acceptance Rate, Avg Onboarding Time); Search + status filter chips; Workflow table (Candidate, Status, Progress ring, Banking, Verification, Delete, Join date); Pagination placeholder.",
            "Components: CmSearch, CmStat, CmBadge, CmRing, CmPerson, CmEmpty, CmButton, LoadingSpinner, useEmployees, useLifecycleFeatures.",
            "Tabs: None (list view).",
            "Actions: Search; filter by workflow status; row click → detail (?id=); delete workflow; open Create Workflow modal.",
        ),
        (
            "Onboarding Workflow Detail (/onboarding?id=…)",
            "Sections: Back link; Welcome & Progress (status, joining date, HR/Manager/Buddy cards, progress rings, role breakdown); Tasks by role; Documents (link-out); Checklist; Equipment & Assets; Training modules; Software & IT (ItProvisioningPanel); LMS Training (LmsDashboard); Mandatory Forms; Probation Goals (OnboardingGoalsPanel); BGV (OnboardingBgvPanel); 30-60-90 (OnboardingMilestonesPanel); Policy Signatures; Buddy Check-ins; Manager Actions; Recent Activity; Internal Notes (HR).",
            "Components: ProgressRing, OnboardingBgvPanel, OnboardingFormsPanel, OnboardingGoalsPanel, OnboardingMilestonesPanel, ItProvisioningPanel, LmsDashboard, corporate-modern Cm* widgets, socket.io onboarding:changed.",
            "Tabs: None — vertical sections with anchor ids (onboarding-documents, onboarding-assets, onboarding-training, onboarding-it, onboarding-lms, onboarding-forms, onboarding-goals, onboarding-bgv, onboarding-milestones, onboarding-buddy-checkins, onboarding-manager-actions).",
            "Actions: Publish/Pause/Resume/Cancel workflow (HR); task Start/Continue/Mark Complete; checklist toggle; asset status (HR); complete training; sign policy; buddy check-in status; manager action status; add internal note; navigate to /documents or /job-details; software request (IT panel); forms open/submit; BGV initiate/verify/upload (see BGV panel); milestone review; delete workflow from list.",
        ),
        (
            "Employee / Manager views (/onboarding, ?view=team)",
            "Sections: Self/Team toggle; scheduled empty state OR team stat cards OR same detail sections with reduced HR controls.",
            "Components: Same as detail where workflow selected; manager sees Manager Actions when data present.",
            "Tabs: Self | My Team (when canViewTeam).",
            "Actions: View team workflows; update tasks/checklist/training/signatures/buddy/manager items permitted by assigneeRole.",
        ),
        (
            "Configure (/onboarding?configure=1)",
            "Sections: Sidebar — Features, Policies, Industry packs, Compliance packs, Templates (WorkflowBuilder), Forms (FormBuilderHub), Document Hub, Letters (LetterGeneratorHub), Documents catalog, Rules (reminders/escalations/approvals). Exit Interview section exists but is offboarding — omitted here.",
            "Components: LifecycleConfigurationPanel, WorkflowBuilder, FormBuilderHub, DocumentHub, LetterGeneratorHub, OfferTemplateManager (policies).",
            "Tabs (Configure sidebar): modules | policies | industry | compliance | templates | forms | documents-hub | letters | documents | automation.",
            "Actions: Toggle module on/off; toggle per-feature flags; save settings (PATCH /admin/lifecycle/settings); install/uninstall packs; full template/form/document/letter CRUD in child hubs.",
        ),
        (
            "Enterprise (/onboarding?enterprise=1)",
            "Sections: Global search (optional); tab strip; tab body panels.",
            "Components: LifecycleEnterpriseHub, EnterpriseCommandCenter, StatutoryCompliancePanel, ItProvisioningPanel, LmsDashboard, ProbationCenter.",
            "Tabs: Command Center | Statutory | IT Provisioning | LMS | Probation | Notifications (each gated by feature keys).",
            "Actions: Search lifecycle; run bulk operations; edit notification channels; command-center KPIs and shortcuts.",
        ),
        (
            "Reports (/onboarding?reports=1)",
            "Sections: Overview; Onboarding tab (funnel, trends, document completion, drill-down); HR Analytics (partial onboarding metrics); Scheduled reports.",
            "Components: LifecycleReportsHub, ReportDataTable, recharts, CmStat/CmBadge.",
            "Tabs: overview | onboarding | offboarding (excluded) | hr | scheduled — onboarding tab documented.",
            "Actions: Filter date range/department; drill-down; export CSV/Excel; create scheduled report.",
        ),
        (
            "Document Hub (inside Configure)",
            "Sections: KPI alerts; folder/library views; pending queue; expiry dashboard; policy acknowledgment catalog; reports by department.",
            "Components: DocumentHub, CmTable, bulk selection.",
            "Tabs: Employee Documents | Pending Verification | Expiry Dashboard | Policy Acknowledgment | Reports.",
            "Actions: Search/filter; verify/reject; bulk verify; bulk remind; export library; view version history patterns (API supported).",
        ),
        (
            "Form Builder (inside Configure)",
            "Sections: Form list; drag-drop field builder; live preview; responses table.",
            "Components: FormBuilderHub, LoadingSpinner.",
            "Tabs/Views: list | builder | preview | responses.",
            "Actions: Create/clone/publish/rollback/delete form; export responses; assign forms (API).",
        ),
        (
            "Workflow Builder (inside Configure → Templates)",
            "Sections: Template list; stage editor; task/checklist/document bindings; preview/publish/clone.",
            "Components: WorkflowBuilder.",
            "Tabs: None (template picker + editor panes).",
            "Actions: CRUD onboarding templates via /admin/lifecycle/templates/onboarding/*.",
        ),
        (
            "Letter Generator (inside Configure)",
            "Sections: Letter types; template editor; generated letters queue.",
            "Components: LetterGeneratorHub.",
            "Tabs: Templates vs Generated (in-component navigation).",
            "Actions: Template CRUD, publish, clone, preview, generate, send, export generated letters (offer + other letter types).",
        ),
        (
            "Modals (Onboarding Hub)",
            "Sections: Create workflow form; cancel confirmation.",
            "Components: Inline modal markup in OnboardingHub.",
            "Tabs: None.",
            "Actions: POST create workflow; confirm cancel via performWorkflowAction.",
        ),
    ]
    for name, sec, comp, tabs, actions in sections:
        add_heading(doc, name, level=2)
        add_para(doc, f"Sections: {sec}")
        add_para(doc, f"Components: {comp}")
        add_para(doc, f"Tabs: {tabs}")
        add_para(doc, f"Actions: {actions}")

    add_heading(doc, "3. Every Component (by page)", level=1)
    component_rows = [
        ("OnboardingHub", "ProgressRing, CmSearch, CmStat, CmBadge, CmRing, CmPerson, CmEmpty, CmButton, LoadingSpinner"),
        ("OnboardingHub (detail)", "OnboardingBgvPanel, OnboardingFormsPanel, OnboardingGoalsPanel, OnboardingMilestonesPanel, ItProvisioningPanel, LmsDashboard"),
        ("EmployeeLifecycle", "OnboardingHub shell, lazy LifecycleConfigurationPanel, LifecycleReportsHub, LifecycleEnterpriseHub"),
        ("LifecycleConfigurationPanel", "WorkflowBuilder, FormBuilderHub, DocumentHub, LetterGeneratorHub, OfferTemplateManager, Toggle"),
        ("LifecycleEnterpriseHub", "EnterpriseCommandCenter, StatutoryCompliancePanel, ItProvisioningPanel, LmsDashboard, ProbationCenter"),
        ("LifecycleReportsHub", "ReportDataTable, recharts Bar/Line charts, CmStat, CmBadge, CmButton"),
        ("DocumentHub", "CmTable, CmSearch, CmStat, folder grid, bulk action bar"),
        ("OnboardingBgvPanel", "HR case queue, employee wizard, check cards, document upload, vendor report UI"),
        ("BuddyDashboard (unrouted)", "Workflow list, task list, check-in form, induction complete, document upload"),
    ]
    add_table(doc, ["Page / Panel", "Components"], component_rows)

    add_heading(doc, "4. Every Tab", level=1)
    tab_rows = [
        ("EmployeeLifecycle shell", "Onboarding | Offboarding (offboarding out of scope)"),
        ("Employee/Manager OnboardingHub", "Self | My Team"),
        ("Configure sidebar", "Features | Policies | Industry | Compliance | Templates | Forms | Document Hub | Letters | Documents | Rules"),
        ("Enterprise hub", "Command Center | Statutory | IT Provisioning | LMS | Probation | Notifications"),
        ("Reports hub", "Overview | Onboarding | HR Analytics | Scheduled Reports"),
        ("Document Hub", "Employee Documents | Pending Verification | Expiry Dashboard | Policy Acknowledgment | Reports"),
        ("Form Builder", "list | builder | preview | responses"),
        ("Recruitment candidate", "Offer Letter tab (related)"),
    ]
    add_table(doc, ["Page", "Tabs"], tab_rows)

    add_heading(doc, "5. Every Action (by area)", level=1)
    action_rows = [
        ("Workflow (HR)", "Create, Delete, Publish, Pause, Resume, Cancel, Add internal note"),
        ("Tasks", "Start, Continue Task (deep-link), Mark Complete (with blockers)"),
        ("Checklist", "Toggle complete (role-gated)"),
        ("Documents hub section", "Navigate to Manage Documents / Go to Documents"),
        ("Assets", "Change status (HR)"),
        ("Training", "Open link, Mark Complete"),
        ("IT Provisioning", "Create software request, Approve, Provision, Sync inventory"),
        ("LMS", "Assign course, Sync & certify"),
        ("Forms", "Open form modal, Submit"),
        ("Goals", "Add/edit probation goals (HR)"),
        ("BGV", "Initiate case, upload docs, verify/reject checks, HR remarks, vendor report, waive/sync (API)"),
        ("Milestones", "Submit milestone review"),
        ("Policies", "Sign e-signature"),
        ("Buddy check-ins", "Update status Scheduled/Completed"),
        ("Manager actions", "Update status Pending/In Progress/Completed"),
        ("Document Hub (configure)", "Verify, Bulk verify, Bulk remind, Export library"),
        ("Configure", "Save settings, Toggle features/modules, Install/uninstall packs"),
        ("Enterprise", "Search, Bulk execute, Save notification channels"),
        ("Reports", "Drill-down, Export, Schedule report"),
    ]
    add_table(doc, ["Area", "Actions"], action_rows)

    # ── 6 APIs ──
    add_heading(doc, "6. APIs Used (by page / component)", level=1)
    api_blocks = [
        (
            "OnboardingHub",
            [
                ("GET", "/api/v1/admin/onboarding/onboarding/dashboard", "HR list + stats"),
                ("GET", "/api/v1/both/onboarding/dashboard", "Employee/Manager dashboard"),
                ("GET", "/api/v1/both/onboarding/my-workflow", "Employee single workflow"),
                ("POST", "/api/v1/admin/onboarding/onboarding", "Create workflow (modal)"),
                ("DELETE", "/api/v1/admin/onboarding/onboarding/:id", "Delete workflow"),
                ("PUT", "/api/v1/admin/onboarding/onboarding/:id/tasks/:taskId", "HR task update"),
                ("PUT", "/api/v1/both/onboarding/workflow/:id/tasks/:taskId", "Employee task update"),
                ("POST", "/api/v1/admin/onboarding/onboarding/:id/actions/:action", "publish|pause|resume|cancel"),
                ("PUT", "…/checklist/:itemId", "Checklist (admin or both path)"),
                ("POST", "/api/v1/admin/onboarding/onboarding/:id/notes", "Internal notes"),
                ("PUT", "…/assets/:assetId", "Asset status"),
                ("PUT", "…/training/:trainingId", "Training complete"),
                ("POST", "/api/v1/both/onboarding/workflow/:id/signatures/:id/sign", "Policy sign"),
                ("PUT", "…/buddy-checkins/:id", "Buddy check-in"),
                ("PUT", "…/manager-actions/:id", "Manager action"),
            ],
        ),
        (
            "OnboardingFormsPanel",
            [
                ("GET", "/api/v1/admin/lifecycle/onboarding/:workflowId/forms/status", "Form completion status"),
                ("GET", "/api/v1/both/lifecycle/forms/:formId", "Load form definition"),
                ("POST", "/api/v1/both/lifecycle/forms/:formId/submit", "Submit response"),
            ],
        ),
        (
            "OnboardingGoalsPanel",
            [
                ("GET", "/api/v1/admin/lifecycle/onboarding/:workflowId/goals", "List goals"),
                ("POST", "/api/v1/admin/lifecycle/onboarding/:workflowId/goals", "Add/update goals"),
            ],
        ),
        (
            "OnboardingBgvPanel",
            [
                ("GET", "/api/v1/admin/lifecycle/bgv/hr/dashboard", "HR BGV queue"),
                ("GET", "/api/v1/admin/lifecycle/bgv/hr/:caseId/detail", "Case detail"),
                ("POST", "/api/v1/admin/lifecycle/bgv", "Create case"),
                ("POST", "/api/v1/both/lifecycle/employee/onboarding/:workflowId/bgv", "Employee initiate"),
                ("GET", "/api/v1/both/lifecycle/employee/bgv/dashboard", "Employee BGV"),
                ("PATCH", "/api/v1/both/onboarding/workflow/:workflowId/bgv/checks/:checkId", "Employee check update"),
                ("Various POST", "/api/v1/admin/lifecycle/bgv/hr/…", "Verify, documents, vendor report, remarks"),
            ],
        ),
        (
            "OnboardingMilestonesPanel",
            [
                ("POST", "/api/v1/admin/lifecycle/onboarding/:workflowId/milestones/review", "Record milestone review"),
            ],
        ),
        (
            "ItProvisioningPanel",
            [
                ("GET", "/api/v1/admin/lifecycle/it/inventory", "Org IT inventory"),
                ("GET", "/api/v1/admin/lifecycle/it/ticketing-providers", "Ticketing adapters"),
                ("POST", "/api/v1/admin/lifecycle/onboarding/:workflowId/software-requests", "New request"),
                ("POST", "…/software-requests/:id/approve", "Approve"),
                ("POST", "…/software-requests/:id/provision", "Mark provisioned"),
            ],
        ),
        (
            "LmsDashboard",
            [
                ("GET", "/api/v1/admin/lifecycle/lms/dashboard", "LMS summary"),
                ("GET", "/api/v1/admin/lifecycle/lms/providers", "Providers"),
                ("POST", "/api/v1/admin/lifecycle/onboarding/:workflowId/lms/assign-course", "Assign course"),
                ("POST", "…/lms/sync-certify", "Sync certifications"),
            ],
        ),
        (
            "LifecycleConfigurationPanel",
            [
                ("GET", "/api/v1/admin/lifecycle/registry", "Feature registry + settings"),
                ("PATCH", "/api/v1/admin/lifecycle/settings", "Save configure"),
                ("POST", "/api/v1/admin/lifecycle/packs/{industry|compliance}/install|uninstall", "Packs"),
                ("GET", "/api/v1/admin/lifecycle/templates/onboarding", "Template list"),
            ],
        ),
        (
            "DocumentHub",
            [
                ("GET", "/api/v1/admin/lifecycle/documents-hub/categories|library|pending|expiry|catalog|reports", "Loads"),
                ("POST", "…/documents-hub/:id/verify", "Verify"),
                ("POST", "…/bulk/verify|bulk/remind", "Bulk"),
                ("GET", "…/library/export", "Export"),
            ],
        ),
        (
            "FormBuilderHub / WorkflowBuilder / LetterGeneratorHub",
            [
                ("CRUD", "/api/v1/admin/lifecycle/forms/*", "Form definitions"),
                ("CRUD", "/api/v1/admin/lifecycle/templates/onboarding/*", "Workflow templates"),
                ("CRUD", "/api/v1/admin/lifecycle/letters/*", "Letter templates & generated"),
            ],
        ),
        (
            "LifecycleReportsHub (onboarding)",
            [
                ("GET", "/api/v1/admin/lifecycle/reports/dashboard|catalog|drilldown/*|export/*|scheduled", "Reports"),
                ("POST", "/api/v1/admin/lifecycle/reports/scheduled", "Schedule"),
            ],
        ),
        (
            "LifecycleEnterpriseHub",
            [
                ("GET", "/api/v1/admin/lifecycle/search", "Global search"),
                ("POST", "/api/v1/admin/lifecycle/bulk/execute", "Bulk ops"),
                ("GET/PATCH", "/api/v1/admin/lifecycle/notifications/center", "Notifications"),
                ("GET", "/api/v1/admin/lifecycle/probation/center", "ProbationCenter"),
            ],
        ),
        (
            "BuddyDashboard (unrouted UI)",
            [
                ("GET", "/api/v1/both/lifecycle/buddy/dashboard", "BuddyDashboard.jsx"),
                ("GET", "/api/v1/both/lifecycle/buddy/workflows", ""),
                ("GET", "/api/v1/both/lifecycle/buddy/workflows/:id", ""),
                ("POST", "…/tasks/:taskId/complete|checkin|induction/complete|documents|feedback", ""),
            ],
        ),
        (
            "Backend-only (no UI consumer found)",
            [
                ("GET", "/api/v1/admin/onboarding/onboarding/analytics", "getOnboardingAnalytics — no vite_client reference"),
                ("GET", "/api/v1/admin/onboarding/onboarding/:id", "Full workflow — legacy OnboardingDetailPage only"),
            ],
        ),
    ]
    for comp, rows in api_blocks:
        add_heading(doc, comp, level=2)
        add_table(doc, ["Method", "Endpoint", "Used by"], rows)

    # ── 7 Feature matrix ──
    add_heading(doc, "7. Feature Availability Matrix", level=1)
    add_para(doc, "Legend: ✅ full | 👀 view/limited | ❌ no access | * = gated by Configure feature flag")
    matrix = [
        ("Workflow list & detail", "✅", "✅", "👀 team", "👀 check-ins*", "✅ self"),
        ("Create/delete workflow", "✅", "✅", "❌", "❌", "❌"),
        ("Tasks & checklist", "✅", "✅", "👀 team tasks", "👀 buddy tasks*", "✅ own"),
        ("Documents section", "✅ → /documents", "✅", "👀", "❌", "✅ → profile"),
        ("Forms", "✅", "✅", "👀", "❌", "✅ submit"),
        ("BGV", "✅ HR console", "✅", "❌", "❌", "✅ initiate/edit*"),
        ("Assets", "✅ edit", "✅ edit", "👀", "❌", "👀"),
        ("IT software requests", "✅", "✅", "❌", "❌", "👀"),
        ("LMS", "✅", "✅", "❌", "❌", "✅ courses"),
        ("Goals / KRA", "✅", "✅", "👀", "❌", "👀"),
        ("Milestones 30-60-90", "✅", "✅", "✅ review", "❌", "👀"),
        ("Policy e-sign", "✅", "✅", "❌", "❌", "✅ sign"),
        ("Buddy program", "✅", "✅", "❌", "⚠️ no route*", "👀"),
        ("Manager actions", "✅", "✅", "✅", "❌", "❌"),
        ("Configure", "✅", "✅", "❌", "❌", "❌"),
        ("Enterprise / Reports", "✅", "✅", "❌", "❌", "❌"),
        ("Internal notes", "✅", "✅", "❌", "❌", "❌"),
    ]
    add_table(doc, ["Feature", "Admin", "HR", "Manager", "Buddy", "Employee"], matrix)

    # ── 8 Configure integration ──
    add_heading(doc, "8. Configure Integration (feature gating)", level=1)
    add_para(
        doc,
        "Frontend: useLifecycleFeatures — HR uses GET /admin/lifecycle/registry; employees/managers use GET /both/lifecycle/features. "
        "Fail-closed until loaded. filterByFeature() hides checklist/tasks with featureKey when disabled. "
        "Backend: requireLifecycleFeature middleware on selected both/lifecycle routes (e.g. BGV, buddy).",
    )
    configure_rows = [
        ("documentCollection", "documentCollection", "✅ toggle", "✅ OnboardingHub section hidden"),
        ("digitalForms / bank / nominee", "digitalForms, bankDetails, …", "✅", "✅ Forms section"),
        ("backgroundVerification", "backgroundVerification", "✅", "✅ UI + API 403 if off"),
        ("buddyProgram", "buddyProgram", "✅", "✅ check-ins; buddy APIs gated"),
        ("goalAssignment", "goalAssignment", "✅", "✅ Goals panel"),
        ("milestone30_60_90", "milestone30_60_90", "✅", "✅ when milestones exist"),
        ("itAssetProvisioning", "itAssetProvisioning", "✅", "✅ Assets section"),
        ("softwareAccessRequest", "softwareAccessRequest", "✅", "✅ IT panel"),
        ("trainingLms / lmsDashboard", "trainingLms, lmsDashboard", "✅", "✅ LMS sections"),
        ("mandatoryTraining", "mandatoryTraining", "✅", "✅ Training modules"),
        ("eSignature", "eSignature", "✅", "✅ Policy signatures"),
        ("joiningChecklist / induction", "joiningChecklist, induction", "✅", "✅ Checklist items filtered"),
        ("offerLetter / offerAcceptance", "offerLetter, offerAcceptance", "✅", "Checklist/tasks in template"),
        ("probation / probationCenter", "probation, probationCenter", "✅", "Enterprise Probation tab"),
        ("enterpriseDashboards", "enterpriseDashboards", "✅", "Command Center"),
        ("globalLifecycleSearch", "globalLifecycleSearch", "✅", "Enterprise search bar"),
        ("bulkOperations", "bulkOperations", "✅", "Enterprise notifications tab"),
        ("notificationCenter", "notificationCenter", "✅", "Enterprise notifications tab"),
        ("candidatePortal", "candidatePortal", "✅ default off", "Public offer token API only"),
        ("Configure Document Hub nav", "documentCollection | documentApproval", "✅", "Sidebar section hidden if both off"),
    ]
    add_table(doc, ["Feature", "Feature Key", "Configure UI", "Runtime behavior"], configure_rows)

    # ── 9 Workflow flow ──
    add_heading(doc, "9. Onboarding Workflow Flow", level=1)
    add_para(doc, "Status lifecycle: Draft → Scheduled (joining date) → Not Started / In Progress → Completed (or Paused / Cancelled / Overdue).")
    add_para(doc, "Default template stages (server/constants/onboardingDefaults.js — DEFAULT_ONBOARDING_STAGES):")
    flow = (
        "HR creates workflow (POST /admin/onboarding/onboarding) → Draft/Scheduled\n"
        "↓ Publish (action) → workflow activates near joining date\n"
        "↓ Pre-Boarding (preBoarding) / Offer acceptance (offerAcceptance, offerLetter)\n"
        "↓ Documentation (documentCollection, bankDetails, documentApproval, digitalForms)\n"
        "↓ Background Verification (backgroundVerification) — optional checks\n"
        "↓ IT Setup (itAssetProvisioning, softwareAccessRequest)\n"
        "↓ HR Setup (payrollSetup, employeeIdGeneration)\n"
        "↓ Induction (induction, buddyProgram, manager tasks)\n"
        "↓ Training (mandatoryTraining, trainingLms) & LMS assign/sync\n"
        "↓ Goals (goalAssignment) & 30-60-90 milestones (milestone30_60_90)\n"
        "↓ Probation tracking (probation) via Probation Center / reviews API\n"
        "↓ Completed"
    )
    add_para(doc, flow)
    add_para(doc, "Default task order: Upload identity docs → Upload bank details → HR verify docs → Assign laptop → Payroll → Manager induction → Buddy welcome.")

    # ── 10 Missing pages ──
    add_heading(doc, "10. Missing or Unlinked Pages", level=1)
    missing = [
        ("Dedicated Buddy Dashboard route", "BuddyDashboard.jsx implemented but not in routes/index.jsx or navigationConfig"),
        ("Candidate self-service dashboard", "candidatePortal feature default false; only tokenized offer portal exists"),
        ("Standalone Offer Approval Dashboard", "offerApproval feature + recruitment tab; no /onboarding offer queue page"),
        ("BGV Analytics page", "bgvAnalytics in reports drill-down; no dedicated BGV analytics screen"),
        ("Training Dashboard (employee)", "Training embedded in workflow; no /training onboarding route"),
        ("Probation Dashboard (employee/manager)", "ProbationCenter is HR enterprise tab only"),
        ("Admin onboarding analytics UI", "GET /admin/onboarding/onboarding/analytics has no frontend"),
        ("Legacy pages not wired", "MyOnboardingPage, OnboardingPage, OnboardingDetailPage orphaned"),
        ("Dedicated onboarding search", "Global search only under Enterprise when globalLifecycleSearch enabled"),
        ("Workflow stage runtime UI", "Stage APIs under /admin/lifecycle/onboarding/:id/stages/* — no dedicated stage board in OnboardingHub"),
    ]
    add_table(doc, ["Gap", "Evidence"], missing)

    # ── 11 Final report ──
    add_heading(doc, "11. Final Report Summary", level=1)

    add_heading(doc, "11.1 Navigation entry points", level=2)
    add_para(doc, "navigationConfig.jsx: Admin/HR/Manager/Employee menus include path /onboarding as 'Employee Lifecycle' or 'My Lifecycle'.")

    add_heading(doc, "11.2 Role-wise access (concise)", level=2)
    roles = [
        ("Admin", "Full HR capabilities + Configure/Enterprise/Reports if permissionFlags allow (canAccessLifecycleEnterprise)."),
        ("HR", "Same as Admin for lifecycle; primary operators of hub, configure, BGV HR console, document hub."),
        ("Manager", "/onboarding?view=team — team workflows, manager actions, milestone review; no configure."),
        ("Buddy", "No menu route; buddy check-ins inside assignee workflow; standalone BuddyDashboard unused."),
        ("Employee", "My Onboarding Journey; task/checklist/forms/BGV/sign/training as assignee; scheduled state if not started."),
    ]
    add_table(doc, ["Role", "Access"], roles)

    add_heading(doc, "11.3 UI improvement opportunities", level=2)
    improvements = [
        ("Unify routing", "Remove or redirect legacy MyOnboardingPage / OnboardingPage to /onboarding to avoid confusion."),
        ("Buddy experience", "Register /buddy or link BuddyDashboard from nav when buddyProgram enabled."),
        ("Workflow detail data", "Detail view uses dashboard list payload — consider GET /admin/onboarding/onboarding/:id for full fidelity."),
        ("Tabbed detail UX", "Long vertical scroll on workflow detail — user-requested redesign could use Overview/Documents/Forms/BGV tabs."),
        ("Analytics surfacing", "Wire onboarding/analytics API or remove dead endpoint."),
        ("Pagination", "HR table pagination buttons are disabled placeholders."),
        ("Manager/Buddy dashboards", "Dedicated role landing pages vs embedded sections."),
        ("Configure scope", "Onboarding configure mixed with offboarding sections — split for redesign clarity."),
        ("Corporate-modern parity", "cm-hrms styling only on HR shell; employee view uses legacy classes."),
        ("Document actions in-hub", "Documents section is link-out only — no inline upload/verify in onboarding detail."),
    ]
    add_table(doc, ["Area", "Recommendation"], improvements)

    add_heading(doc, "11.4 Key source files", level=2)
    add_para(
        doc,
        "UI: vite_client/src/HR/Onboarding/*, OnboardingRouteWrapper.jsx, Employee/BuddyDashboard.jsx (unrouted), "
        "Employee/Onboarding/MyOnboardingPage.jsx (unrouted). "
        "API: server/routes/Admin/OnboardingRoutes.js, Both/OnboardingRoutes.js, Admin/LifecycleRoutes.js (onboarding/*), "
        "Both/LifecycleBuddyRoutes.js, Both/LifecycleEmployeeRoutes.js, Public/LifecyclePortalRoutes.js. "
        "Features: server/constants/lifecycleFeatureRegistry.js, vite_client/src/Hooks/useLifecycleFeatures.js. "
        "Defaults: server/constants/onboardingDefaults.js.",
    )

    doc.save(OUT_PATH)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
