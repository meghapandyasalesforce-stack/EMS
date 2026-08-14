#!/usr/bin/env python3
"""Generate ENGAGEMENT_ROADMAP_GAP_ANALYSIS.docx from the Aug 2026 codebase scan."""

from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

OUT_PATH = Path(__file__).resolve().parent / "ENGAGEMENT_ROADMAP_GAP_ANALYSIS.docx"

NAVY = "1F4E79"
GREEN = "166534"
AMBER = "92400E"
RED = "991B1B"
GREEN_BG = "DCFCE7"
AMBER_BG = "FEF3C7"
RED_BG = "FEE2E2"
NAVY_RGB = RGBColor(31, 78, 121)


def set_cell_shading(cell, hex_color):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def set_run_color(run, hex_color):
    run.font.color.rgb = RGBColor(
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


def add_para(doc, text, bold=False, italic=False, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    return p


def add_kv(doc, label, value):
    p = doc.add_paragraph()
    r1 = p.add_run(f"{label}: ")
    r1.bold = True
    r1.font.size = Pt(11)
    r2 = p.add_run(str(value))
    r2.font.size = Pt(11)
    return p


def shade_status_cell(cell, status):
    text = str(status)
    if text.startswith("Fully"):
        set_cell_shading(cell, GREEN_BG)
        for p in cell.paragraphs:
            for r in p.runs:
                set_run_color(r, GREEN)
                r.bold = True
    elif text.startswith("Partially"):
        set_cell_shading(cell, AMBER_BG)
        for p in cell.paragraphs:
            for r in p.runs:
                set_run_color(r, AMBER)
                r.bold = True
    elif text.startswith("Not"):
        set_cell_shading(cell, RED_BG)
        for p in cell.paragraphs:
            for r in p.runs:
                set_run_color(r, RED)
                r.bold = True


def add_table(doc, headers, rows, status_col=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        set_cell_shading(hdr[i], NAVY)
        for p in hdr[i].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(255, 255, 255)
    for ri, row in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = str(val)
            for p in cells[ci].paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
            if status_col is not None and ci == status_col:
                shade_status_cell(cells[ci], val)
    doc.add_paragraph()
    return table


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    for r in p.runs:
        r.font.size = Pt(11)
    return p


PHASE1 = [
    ["Employee Engagement dashboard", "Fully Available", "EngagementDashboard.jsx, EngagementPage.jsx (analytics tab), GET /v1/both/engagement/analytics", "—", "—"],
    ["Employee survey inbox", "Fully Available", "getMySurveys in engagementController.js, GET /my-surveys, EmployeeEngagementPage.jsx", "—", "—"],
    ["Employee surveys and pulse surveys", "Fully Available", "Survey + PulseProgram in engagement.model.js; pulseProgramController.js; CreateSurvey.jsx, PulsePrograms.jsx", "—", "—"],
    ["eNPS surveys and analytics", "Fully Available", "Question type eNPS; getSurveyAnalytics / getEngagementAnalytics; dashboard eNPS charts", "—", "—"],
    ["Anonymous feedback", "Fully Available", "employeeId nulled + submitterHash; sanitizeFeedbackDocument; ENGAGEMENT_FEEDBACK_ANONYMOUS", "—", "—"],
    ["Feedback management", "Fully Available", "Feedback model; FeedbackPanel.jsx; PUT /admin/engagement/feedback/:id", "—", "—"],
    ["Suggestions workflow", "Fully Available", "SUGGESTION_STATUSES + transitions; SuggestionsPanel.jsx; dedicated HR tab", "—", "—"],
    ["Peer-to-peer recognition", "Fully Available", "createRecognition on both routes; employee Give Recognition form", "—", "—"],
    ["Recognition wall and reactions", "Fully Available", "Public wall; POST /recognition/:id/react; RecognitionPanel.jsx", "—", "—"],
    ["Engagement notifications", "Fully Available", "notificationEventRegistry.js (survey, feedback, suggestion, recognition, action plan)", "—", "—"],
    ["Engagement analytics", "Fully Available", "getEngagementAnalytics, getRecognitionAnalytics, dashboard", "—", "—"],
    ["Privacy-safe analytics", "Fully Available", "analyticsMinResponses (floor 5); applyThreshold; anonymous rows excluded from team/dept cuts", "—", "—"],
    ["Granular Engagement permissions", "Fully Available", "11 keys in permissions.constants.js and vite_client/src/utils/permissions.js", "No keys yet for wellbeing, rewards, or manager effectiveness (those products do not exist)", "—"],
    ["Survey reminders and auto-expiry", "Fully Available", "engagementSurveyJob.js (hourly close + remind); reminderEnabled / reminderDaysBefore on Survey and Pulse", "—", "—"],
]

PHASE2 = [
    ["Enhanced Recognition system", "Fully Available", "Individual / Team / Department; approval workflow; isPublic; reactions", "—", "—"],
    ["Recognition categories", "Partially Available", "Hardcoded in RECOGNITION_TYPES / RECOGNITION_CATEGORIES", "Roadmap wants Teamwork, Leadership, Innovation, Customer Focus, Ownership. Code has Achievement, Teamwork, Leadership, Innovation, Customer Appreciation, Performance, Going Extra Mile. Not configurable.", "Small"],
    ["Recognition history (Given, Received)", "Fully Available", "?mine=given / ?mine=received; employee Received / Given tabs", "—", "—"],
    ["Recognition filters and search", "Partially Available", "API: status, category/type, date; HR manage: status + category; employee tab search", "No HR wall text search; no date-range UI; filters are not first-class on the wall", "Small"],
    ["Employee achievement / badge system", "Partially Available", "Recognition.badge string; displayed if present", "No badge entity, earn rules, or employee badge collection", "Medium"],
    ["Badge catalog", "Not Available", "—", "No Badge model, catalog API, or admin UI", "Medium"],
    ["Custom HR / Admin badges", "Partially Available", "API accepts badge on create", "Give-recognition UI does not expose badge; no admin-defined catalog", "Small–Medium"],
    ["Employee profile recognition / badges", "Not Available", "No match under employee details / profile tabs", "No profile section for received recognition or badges", "Medium"],
    ["Engagement activity feed", "Partially Available", "GET /activity → getEngagementActivity; employee Activity tab", "Personal, last 30 days only. Not an org-wide social feed", "Medium"],
    ["Recognition and engagement activity updates", "Fully Available", "engagement.recognition.received / rejected / pending_approval plus survey and feedback events", "—", "—"],
    ["Improved survey / pulse experience", "Fully Available", "Recurring PulseProgram (weekly–quarterly); clone; eNPS; wellbeing template; audience targeting", "—", "—"],
    ["Engagement participation history", "Partially Available", "Inbox completionState; 30-day activity", "No long-term participation report across years or types", "Medium"],
]

PHASE3 = [
    ["Employee engagement points", "Partially Available", "Recognition.points (0–10 peer / 0–100 HR)", "No points balance, ledger, or employee wallet", "Medium"],
    ["Points earning rules", "Not Available", "—", "No rules engine (recognition / survey / activity → points)", "Medium"],
    ["Rewards catalog", "Not Available", "No Reward model, routes, or UI", "New catalog needed", "Large"],
    ["Reward configuration for HR / Admin", "Not Available", "—", "Depends on catalog", "Medium"],
    ["Employee reward redemption", "Not Available", "—", "Depends on points + catalog", "Large"],
    ["Redemption history", "Not Available", "—", "Depends on redemption", "Small after redemption"],
    ["Reward availability and limits", "Not Available", "—", "Stock, per-person caps, windows", "Medium"],
    ["Gamification statistics", "Partially Available", "Analytics aggregates totalPoints; UI shows counts, not a points leaderboard", "No gamification dashboard (points, streaks, ranks)", "Medium"],
    ["Employee engagement milestones", "Not Available", "getEngagementCelebrations is work anniversaries, not engagement milestones", "No milestone definitions (for example 10 surveys, 5 recognitions)", "Medium"],
]

PHASE4 = [
    ["Wellbeing check-ins", "Partially Available", "Survey type Wellbeing; WELLBEING_TEMPLATE_QUESTIONS; Create Survey “Load wellbeing template”", "Not a check-in product. Template covers workload, work-life balance, and a satisfaction-style question. No stress/energy dimension. HR must create surveys; no employee self-serve check-in", "Medium"],
    ["Wellbeing history", "Partially Available", "Only as normal survey responses / inbox completed items", "No dedicated wellbeing history API or UI", "Medium"],
    ["Wellbeing trends", "Partially Available", "Dashboard surveyType=Wellbeing filter", "No dedicated wellbeing trend metrics (energy, stress, WLB over time)", "Medium"],
    ["Department / team wellbeing analytics", "Partially Available", "Generic dept breakdown + type filter + team scope", "Not wellbeing-specific scores per department or team", "Medium"],
    ["Participation analytics", "Partially Available", "Generic participation rate", "Not wellbeing-check-in participation", "Small once check-ins exist"],
    ["Privacy-safe wellbeing reporting", "Partially Available", "Same k-anonymity floor (5)", "No wellbeing-specific privacy design for health-adjacent data", "Medium"],
]

PHASE5 = [
    ["Identify engagement issues", "Partially Available", "Dashboard KPIs, period deltas, tenure, department table", "No issue entity, auto-detection, or “create plan from this insight”", "Medium"],
    ["Create action plans", "Fully Available", "EngagementActionPlan; POST /admin/engagement/action-plans; ActionPlansPanel.jsx", "—", "—"],
    ["Assign action plan owners", "Fully Available", "owner required; notify engagement.action_plan.assigned", "—", "—"],
    ["Define improvement actions", "Partially Available", "description only", "No checklist / sub-actions", "Medium"],
    ["Set priorities and deadlines", "Fully Available", "priority Low / Medium / High; dueDate; due-soon / overdue job", "—", "—"],
    ["Track action plan progress", "Partially Available", "Status only (Open → In Progress → Completed)", "No percent complete or task-level progress", "Medium"],
    ["Action plan status", "Fully Available", "Open, In Progress, Completed, Cancelled", "—", "—"],
    ["HR / Manager remarks", "Partially Available", "resolutionRemarks on model + updateActionPlan", "Not in ActionPlansPanel.jsx UI", "Small"],
    ["Completion tracking", "Partially Available", "status + completedAt", "No completion percent or evidence of actions done", "Small–Medium"],
    ["Before / after engagement comparison", "Not Available", "Dashboard has generic prior-period comparison, not tied to a plan", "Need baseline snapshot at plan create + after window", "Large"],
    ["Action plan effectiveness tracking", "Not Available", "sourceType / sourceId exist but unused for metrics", "Score / eNPS / participation before vs after per plan", "Large"],
]

PHASE6 = [
    ["Manager feedback surveys (Anonymous)", "Partially Available", "GET /360-feedback/:employeeId — placeholder; comment says “needs dedicated model”; no UI", "Reuses Suggestion / Appreciation feedback, not manager surveys", "Large"],
    ["Communication effectiveness", "Not Available", "—", "Dimension not modeled", "Large (with manager surveys)"],
    ["Leadership / support ratings", "Not Available", "—", "Dimension not modeled", "Large"],
    ["Recognition and appreciation (manager dimension)", "Not Available", "Recognition module is unrelated", "Manager-rating dimension missing", "Large"],
    ["Feedback quality", "Not Available", "—", "Dimension not modeled", "Large"],
    ["Career support", "Not Available", "—", "Dimension not modeled", "Large"],
    ["Workload management", "Not Available", "Wellbeing template has workload, not manager-specific", "Dimension not modeled", "Large"],
    ["Manager effectiveness score", "Not Available", "—", "Composite score + rollup", "Large"],
    ["Team-level manager insights", "Not Available", "Team analytics exist for surveys / feedback, not manager scores", "No manager score rollup", "Medium after score"],
    ["Manager effectiveness trends", "Not Available", "—", "No trend series", "Medium after score"],
    ["Privacy-safe manager analytics", "Not Available", "Generic thresholds exist; nothing to apply them to", "Must suppress teams below k", "Medium after score"],
]

PHASE7 = [
    ["Engagement score / eNPS / participation trends", "Partially Available", "eNPS trend + response trend in dashboard", "No composite engagement score", "Medium"],
    ["Recognition / Feedback / Suggestion analytics", "Fully Available", "Dashboard sections + getRecognitionAnalytics", "—", "—"],
    ["Wellbeing / Manager effectiveness analytics", "Partially Available", "Wellbeing via surveyType filter only", "No manager analytics; no dedicated wellbeing analytics", "Large (depends on Phases 4 and 6)"],
    ["Department / Team / Location / Role / Tenure", "Partially Available", "Department breakdown; team scope; tenureInsights", "Location-wise: none. Role-wise: none. Employee model has no office / location used here", "Medium (role); Large (location if no location field)"],
    ["Engagement heatmaps", "Not Available", "—", "No heatmap visualization (department × time, and similar)", "Medium after score"],
    ["Custom date-range analytics", "Fully Available", "7d / 30d / 3m / 6m / custom in EngagementDashboard.jsx", "—", "—"],
    ["Comparative period analysis", "Fully Available", "payload.comparison vs prior window of same length", "Volume deltas only, not score / eNPS comparison", "—"],
    ["Advanced HR reports and exports", "Partially Available", "CSV: survey responses, feedback, suggestions, recognition, summary", "No PDF, schedules, action-plan / wellbeing / manager exports, or location / role cuts", "Medium"],
]

PHASE8 = [
    ["Engagement vs retention / attrition / tenure / department / recognition / participation", "Partially Available", "Tenure, department, recognition, participation", "No attrition / retention join (no exit / terminated correlation in engagement analytics)", "Large"],
    ["Trends across employee lifecycle", "Partially Available", "Tenure buckets: new joiner, 0–1, 1–3, 3+", "No onboarding → tenure → exit journey", "Large"],
    ["Early identification of declining areas", "Partially Available", "Period-over-period volume deltas", "No alerts, no declining-department flags, no score drop detection", "Medium after score"],
    ["Organization-level privacy-safe insights", "Fully Available", "Org-scope dashboard + threshold suppression", "—", "—"],
]

PHASE9 = [
    ["Enable / disable Engagement features", "Partially Available", "settings.engagement.features: surveys, pulse, feedback, suggestions, recognition", "No flags for wellbeing, rewards, manager effectiveness", "Small when those modules exist"],
    ["Survey / Feedback / Recognition / Suggestions / Wellbeing / Rewards / Manager configuration", "Partially Available", "Settings panel + per-survey / pulse config", "Wellbeing, rewards, and manager have no config surface", "Medium"],
    ["Anonymous feedback settings", "Fully Available", "anonymousFeedbackDefault + ENGAGEMENT_FEEDBACK_ANONYMOUS", "—", "—"],
    ["Analytics privacy threshold", "Fully Available", "analyticsMinResponses (5–50) in org settings + UI", "—", "—"],
    ["Recognition approval settings", "Fully Available", "recognitionRequireApproval", "—", "—"],
    ["Notification preferences", "Partially Available", "Org toggles: survey assigned / reminder, recognition received, action plan assigned", "Not per-employee; several events have no toggle", "Medium"],
    ["Survey reminder configuration", "Partially Available", "Per-survey and per-pulse reminderEnabled / reminderDaysBefore; org on / off", "No org-wide default reminder policy", "Small"],
    ["Recognition visibility settings", "Partially Available", "Per-item isPublic", "No org default (for example “all peer recognition public”)", "Small"],
    ["Organization-specific Engagement policies in docx", "Not Available", "General Policy Manager exists; no engagement policy pack or docx generator", "Templates + export", "Medium"],
]

HEADERS = ["Feature", "Status", "Evidence (file / model / route)", "Gap", "Effort"]


def build():
    doc = Document()

    section = doc.sections[0]
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)

    title = doc.add_heading("Employee Engagement Module — Roadmap Gap Analysis", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for r in title.runs:
        r.font.color.rgb = NAVY_RGB

    add_para(doc, "EMS HRMS  ·  Codebase scan of models, API routes, controllers, jobs, permissions, and frontend pages", italic=True, size=11)
    add_kv(doc, "Date", "12 August 2026")
    add_kv(doc, "Method", "Code evidence only. Items are marked Fully Available only when a file, model, or route can be cited.")
    add_kv(doc, "Classification", "Fully Available · Partially Available · Not Available · Unclear")

    doc.add_heading("1. Executive summary", 1)
    add_para(
        doc,
        "Phase 1 of the Engagement module is largely shipped. Later phases are uneven: recognition, analytics, and action plans have real code; rewards, manager effectiveness, heatmaps, attrition correlation, and engagement policy packs do not.",
    )
    add_para(
        doc,
        "What is production-shaped today: surveys and recurring pulse programs, eNPS, anonymous feedback, suggestions workflow, peer recognition wall, notifications, privacy-threshold analytics, granular permissions, org settings, CSV export, and a basic action-plan loop.",
    )
    add_para(
        doc,
        "What is not a product yet: rewards, badges, manager effectiveness, heatmaps, and engagement vs attrition insights.",
    )
    add_para(
        doc,
        "The 360 endpoint is a stub with no frontend. Do not treat it as manager effectiveness.",
        bold=True,
    )

    doc.add_heading("2. Coverage summary", 1)
    add_table(
        doc,
        ["Classification", "Count", "Share of 84 roadmap items"],
        [
            ["Fully Available", "29", "35%"],
            ["Partially Available", "32", "38%"],
            ["Not Available", "23", "27%"],
            ["Unclear", "0", "—"],
        ],
        status_col=0,
    )
    add_table(
        doc,
        ["Coverage view", "Result"],
        [
            ["Any code at all (Fully + Partial)", "~73%"],
            ["Strictly complete (Fully only)", "~35%"],
            ["Weighted (Partial = half)", "~53%"],
        ],
    )

    doc.add_heading("3. Phase-by-phase findings", 1)

    doc.add_heading("Phase 1 — Core Engagement Foundation", 2)
    add_table(doc, HEADERS, PHASE1, status_col=1)
    add_para(doc, "Phase 1 result: 14 Fully Available.", bold=True)

    doc.add_heading("Phase 2 — Recognition & Engagement Experience", 2)
    add_table(doc, HEADERS, PHASE2, status_col=1)
    add_para(doc, "Phase 2 result: 4 Fully Available, 6 Partially Available, 2 Not Available.", bold=True)

    doc.add_heading("Phase 3 — Rewards & Gamification", 2)
    add_para(
        doc,
        "Dependency: all of Phase 3 depends on a real points ledger, not the optional points field on Recognition.",
        italic=True,
    )
    add_table(doc, HEADERS, PHASE3, status_col=1)
    add_para(doc, "Phase 3 result: 0 Fully Available, 2 Partially Available, 7 Not Available.", bold=True)

    doc.add_heading("Phase 4 — Employee Wellbeing", 2)
    add_para(
        doc,
        "Dependency: treat Wellbeing as a first-class recurring program (likely via PulseProgram + type Wellbeing), not one-off surveys.",
        italic=True,
    )
    add_table(doc, HEADERS, PHASE4, status_col=1)
    add_para(doc, "Phase 4 result: 0 Fully Available, 6 Partially Available.", bold=True)

    doc.add_heading("Phase 5 — Engagement Action Plans", 2)
    add_para(
        doc,
        "Dependency: before/after and effectiveness need a stable engagement score (or eNPS + participation snapshot) stored on the plan.",
        italic=True,
    )
    add_table(doc, HEADERS, PHASE5, status_col=1)
    add_para(doc, "Phase 5 result: 4 Fully Available, 5 Partially Available, 2 Not Available.", bold=True)

    doc.add_heading("Phase 6 — Manager Effectiveness", 2)
    add_para(
        doc,
        "Dependency: all of Phase 6 depends on anonymous manager surveys with k-anonymity. Do not ship identifiable manager ratings.",
        italic=True,
    )
    add_table(doc, HEADERS, PHASE6, status_col=1)
    add_para(doc, "Phase 6 result: 0 Fully Available, 1 Partially Available, 10 Not Available.", bold=True)

    doc.add_heading("Phase 7 — Advanced Engagement Analytics", 2)
    add_table(doc, HEADERS, PHASE7, status_col=1)
    add_para(doc, "Phase 7 result: 3 Fully Available, 4 Partially Available, 1 Not Available.", bold=True)

    doc.add_heading("Phase 8 — Engagement & Employee Lifecycle Insights", 2)
    add_table(doc, HEADERS, PHASE8, status_col=1)
    add_para(doc, "Phase 8 result: 1 Fully Available, 3 Partially Available.", bold=True)

    doc.add_heading("Phase 9 — Engagement Configuration & SaaS Controls", 2)
    add_table(doc, HEADERS, PHASE9, status_col=1)
    add_para(doc, "Phase 9 result: 3 Fully Available, 5 Partially Available, 1 Not Available.", bold=True)

    doc.add_heading("4. Key files (evidence index)", 1)
    add_table(
        doc,
        ["Layer", "Paths"],
        [
            ["Models", "server/models/engagement.model.js (Survey, SurveyResponse, Feedback, Recognition, PulseProgram, EngagementActionPlan); server/models/organization.model.js (settings.engagement)"],
            ["APIs", "server/routes/Both/EngagementRoutes.js; server/routes/Admin/EngagementRoutes.js"],
            ["Controllers", "server/controllers/engagement/engagementController.js; pulseProgramController.js; actionPlanController.js"],
            ["Helpers", "server/helpers/engagementHelper.js; engagementSettingsHelper.js; engagementExportHelper.js; pulseScheduleHelper.js; notificationEventRegistry.js"],
            ["Jobs", "server/jobs/engagementSurveyJob.js"],
            ["Permissions", "server/config/permissions.constants.js; vite_client/src/utils/permissions.js"],
            ["HR UI", "vite_client/src/HR/Engagement/ (EngagementPage.jsx, EngagementDashboard.jsx, FeedbackPanel.jsx, SuggestionsPanel.jsx, RecognitionPanel.jsx, ActionPlansPanel.jsx, EngagementSettingsPanel.jsx, pulse and survey pages)"],
            ["Employee UI", "vite_client/src/Employee/Engagement/EmployeeEngagementPage.jsx"],
            ["Routes", "vite_client/src/routes/index.jsx (/engagement, /employee/engagement, pulse and survey sub-routes)"],
        ],
    )

    doc.add_heading("5. Prioritized build list (top 10)", 1)
    add_para(doc, "Ranked by impact and how many later items depend on them.")
    add_table(
        doc,
        ["Rank", "Build", "Why first", "Unlocks"],
        [
            ["1", "Composite engagement score (eNPS + participation + recognition / feedback volume, privacy-thresholded)", "Almost every advanced insight assumes a score", "Heatmaps, declining-area alerts, action-plan before/after, lifecycle, Phases 7 and 8"],
            ["2", "Manager effectiveness as an anonymous survey type (dimensions + k-anonymity)", "Entire Phase 6 is blocked; 360 stub is unusable", "Score, team insights, trends, manager analytics"],
            ["3", "Wellbeing as a recurring Pulse program (add stress/energy; employee check-in UX)", "Template already exists; do not invent a second module", "Phase 4 history, trends, department analytics"],
            ["4", "Points ledger + earning rules", "Recognition.points is display-only", "All of Phase 3"],
            ["5", "Action-plan sub-actions + remarks UI + baseline snapshot", "Model and API exist; UI and effectiveness do not", "Phase 5 completion, remarks, before/after"],
            ["6", "Badge catalog + employee profile tab", "Recognition is live; badges are a string", "Phase 2 catalog, custom badges, profile"],
            ["7", "Attrition / retention join (reuse employee status / exit data — do not duplicate HRIS)", "Phase 8 is otherwise just tenure buckets", "Lifecycle + engagement vs attrition"],
            ["8", "Rewards catalog + redemption", "Depends on item 4", "Rest of Phase 3"],
            ["9", "Role-wise (then location-wise) slices + heatmap", "Department, team, and tenure already exist", "Phase 7 remaining cuts"],
            ["10", "Feature flags + engagement policy pack for new modules", "Settings pattern already exists", "Phase 9 completeness; SaaS packaging"],
        ],
    )

    doc.add_heading("6. Implementation recommendation", 1)
    add_para(
        doc,
        "Extend the existing Engagement module. Do not start a new app, and do not buy a third-party engagement suite for surveys, feedback, recognition, or analytics. Those already live in engagement.model.js, /api/v1/both|admin/engagement/*, and vite_client/src/{HR,Employee}/Engagement/.",
    )
    add_bullet(
        doc,
        "Wellbeing and manager effectiveness should be additional survey types (Wellbeing already exists) plus templates, targeting, and privacy-safe rollups. Reuse PulseProgram for cadence. Do not create parallel check-in databases unless legal or privacy review requires sealed wellbeing storage.",
    )
    add_bullet(
        doc,
        "Badges and action-plan depth should extend Recognition and EngagementActionPlan (catalog collection; actions[]; baselineMetrics). Wire the missing UI (resolutionRemarks, badge picker, profile tab).",
    )
    add_bullet(
        doc,
        "Points and rewards need new models (EngagementPointsLedger, Reward, Redemption) under the same module, payroll-isolated. Consider a third party later only for physical reward fulfillment, not for the HR workflow.",
    )
    add_bullet(
        doc,
        "Lifecycle and attrition should join existing employee and exit data in getEngagementAnalytics. Do not rebuild retention analytics inside Engagement.",
    )
    add_bullet(
        doc,
        "Policies should reuse the existing Policy Manager with an Engagement template pack and docx export. Do not invent a second policy system.",
    )
    add_para(
        doc,
        "Do not build identifiable manager 360, HR-visible individual wellbeing history, or rewards until anonymity thresholds and the points ledger are in place. Replace or remove the 360 stub (get360Feedback) before anyone treats it as manager effectiveness.",
        bold=True,
    )

    doc.add_heading("7. Appendix — status counts by phase", 1)
    add_table(
        doc,
        ["Phase", "Fully", "Partial", "Not available", "Items"],
        [
            ["1 Core foundation", "14", "0", "0", "14"],
            ["2 Recognition experience", "4", "6", "2", "12"],
            ["3 Rewards & gamification", "0", "2", "7", "9"],
            ["4 Wellbeing", "0", "6", "0", "6"],
            ["5 Action plans", "4", "5", "2", "11"],
            ["6 Manager effectiveness", "0", "1", "10", "11"],
            ["7 Advanced analytics", "3", "4", "1", "8"],
            ["8 Lifecycle insights", "1", "3", "0", "4"],
            ["9 Configuration & SaaS", "3", "5", "1", "9"],
            ["Total", "29", "32", "23", "84"],
        ],
    )

    add_para(
        doc,
        f"Generated {datetime.now().strftime('%d %B %Y')} from a read-only scan of the EMS Engagement module. Status is based on code evidence, not the planning document.",
        italic=True,
        size=9,
    )

    doc.save(OUT_PATH)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    build()
