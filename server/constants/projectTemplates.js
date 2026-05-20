/**
 * Built-in project templates (same structure as client constants/projectTemplates.js)
 */

export const PROJECT_TEMPLATES = [
  { id: "blank", name: "Blank project", description: "Start with an empty work plan", defaults: {}, workPlan: [] },
  {
    id: "software",
    name: "Software development",
    description: "Discovery through release with dev subtasks",
    defaults: { category: "Development", priority: "medium", description: "Standard software delivery lifecycle" },
    workPlan: [
      { title: "Discovery & requirements", description: "Gather scope, stakeholders, and acceptance criteria", priority: "high", subtasks: [{ title: "Stakeholder interviews", priority: "medium" }, { title: "Write requirements doc", priority: "medium" }] },
      { title: "Design", description: "UX/UI and technical design", priority: "medium", subtasks: [{ title: "Wireframes / mockups", priority: "medium" }, { title: "Technical architecture", priority: "high" }] },
      { title: "Development", priority: "high", subtasks: [{ title: "Backend implementation", priority: "high" }, { title: "Frontend implementation", priority: "high" }, { title: "API integration", priority: "medium" }] },
      { title: "QA & UAT", priority: "medium", subtasks: [{ title: "Test plan & execution", priority: "medium" }, { title: "Bug fixes", priority: "high" }] },
      { title: "Deployment & handoff", priority: "medium", subtasks: [{ title: "Production deploy", priority: "critical" }, { title: "Documentation & training", priority: "low" }] }
    ]
  },
  {
    id: "marketing",
    name: "Marketing campaign",
    description: "Plan, create, launch, and measure a campaign",
    defaults: { category: "Marketing", priority: "medium", description: "End-to-end marketing campaign" },
    workPlan: [
      { title: "Strategy & goals", description: "Audience, channels, KPIs", priority: "high", subtasks: [{ title: "Define target audience", priority: "medium" }, { title: "Set campaign KPIs", priority: "medium" }] },
      { title: "Content creation", priority: "medium", subtasks: [{ title: "Copy & creative assets", priority: "medium" }, { title: "Landing page / collateral", priority: "medium" }] },
      { title: "Launch", priority: "high", subtasks: [{ title: "Schedule posts / ads", priority: "high" }, { title: "Go live", priority: "critical" }] },
      { title: "Review & reporting", priority: "low", subtasks: [{ title: "Performance report", priority: "medium" }] }
    ]
  },
  {
    id: "client-onboarding",
    name: "Client onboarding",
    description: "Onboard a new client or account",
    defaults: { category: "Client Services", priority: "high", description: "Structured client onboarding" },
    workPlan: [
      { title: "Kickoff", priority: "high", subtasks: [{ title: "Intro call & expectations", priority: "high" }, { title: "Collect access & assets", priority: "medium" }] },
      { title: "Setup", priority: "medium", subtasks: [{ title: "Account / environment setup", priority: "medium" }, { title: "Internal team briefing", priority: "medium" }] },
      { title: "Training & go-live", priority: "medium", subtasks: [{ title: "Client training session", priority: "medium" }, { title: "Go-live checklist", priority: "high" }] }
    ]
  },
  {
    id: "internal",
    name: "Internal initiative",
    description: "Cross-team internal project",
    defaults: { category: "Operations", priority: "medium" },
    workPlan: [
      { title: "Planning", priority: "medium", subtasks: [{ title: "Scope & owners", priority: "medium" }] },
      { title: "Execution", priority: "high", subtasks: [{ title: "Deliver milestones", priority: "high" }] },
      { title: "Retrospective", priority: "low", subtasks: [{ title: "Lessons learned", priority: "low" }] }
    ]
  }
];
