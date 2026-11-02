import React from "react";
import {
  FiArrowUpRight,
  FiCalendar,
  FiCheckSquare,
  FiMoreHorizontal,
  FiUsers,
} from "react-icons/fi";
import "./projectCards.css";

export function projectStatus(value) {
  const key = String(value || "pending")
    .toLowerCase()
    .trim()
    .replace(/[ _]+/g, "-");
  if (["completed", "complete", "done"].includes(key)) return "Completed";
  if (["on-hold", "hold", "blocked"].includes(key)) return "On Hold";
  if (["in-progress", "active", "ongoing"].includes(key)) return "In Progress";
  if (["cancelled", "canceled"].includes(key)) return "Cancelled";
  return "Pending";
}

export function projectProgress(project, fallback = 0) {
  const raw = Number(
    project.progress ??
      project.progressPercent ??
      project.completionPercent ??
      project.completionPercentage ??
      project.completion ??
      fallback,
  );
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
}

export function projectIsOverdue(project) {
  if (
    !project.endDate ||
    ["Completed", "Cancelled"].includes(projectStatus(project.status))
  )
    return false;
  const due = new Date(project.endDate);
  due.setHours(23, 59, 59, 999);
  return Number.isFinite(due.getTime()) && due < new Date();
}

export function projectCategory(project) {
  return String(
    project.category ||
      project.department?.name ||
      project.department ||
      "General",
  );
}

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const personName = (person) =>
  typeof person === "object" && person
    ? [person.name, person.lastName].filter(Boolean).join(" ")
    : "";

/** Shared presentation only. Parent pages retain navigation, permissions and actions. */
export default function ProjectSummaryCard({
  project,
  progress = 0,
  onOpen,
  onActions,
  actionProps,
  showFinancials = false,
}) {
  const status = projectStatus(project.status);
  const overdue = projectIsOverdue(project);
  const percent = projectProgress(project, progress);
  const priority = ["critical", "high", "medium", "low"].includes(
    project.priority,
  )
    ? project.priority
    : "medium";
  const leader = personName(project.projectLeader) || "Unassigned";
  const members = Array.isArray(project.projectMembers)
    ? project.projectMembers
    : [];
  const visiblePeople = members.length
    ? members
    : project.projectLeader
      ? [project.projectLeader]
      : [];
  const due = project.endDate ? new Date(project.endDate) : null;
  const dueLabel =
    due && Number.isFinite(due.getTime())
      ? due.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "No due date";
  const hasWorkPlan = Number(project.workPlanTotal) > 0;
  const totalTasks = hasWorkPlan ? project.workPlanTotal : project.totalTasks;
  const completedTasks = hasWorkPlan
    ? project.workPlanCompleted
    : project.completedTasks;
  const hasTasks = Number.isFinite(totalTasks) && totalTasks >= 0;
  let budget;
  if (showFinancials && project.budget != null) {
    const currency = /^[A-Z]{3}$/.test(project.currency || "")
      ? project.currency
      : "INR";
    budget = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(project.budget) || 0);
  }

  return (
    <article
      className={`initiative-card ${overdue ? "initiative-card--overdue" : ""}`}
      aria-label={project.name || "Untitled project"}
    >
      <div className="initiative-card__top">
        <div className="initiative-card__tags">
          <span className="initiative-card__category">
            {projectCategory(project)}
          </span>
          <span
            className={`initiative-card__priority initiative-card__priority--${priority}`}
          >
            {priority} priority
          </span>
        </div>
        {onActions && (
          <button
            type="button"
            className="initiative-card__menu"
            aria-label={`Actions for ${project.name}`}
            onClick={onActions}
            {...actionProps}
          >
            <FiMoreHorizontal />
          </button>
        )}
      </div>
      <div className="initiative-card__heading">
        <h3>
          <button type="button" onClick={onOpen}>
            {project.name || "Untitled project"}
          </button>
        </h3>
        <span
          className={`initiative-card__status initiative-card__status--${overdue ? "overdue" : status.toLowerCase().replace(/ /g, "-")}`}
        >
          <i />
          {overdue ? "Overdue" : status}
        </span>
      </div>
      <p className="initiative-card__description">
        {project.description?.trim() ||
          "Project details will appear here when added."}
      </p>
      <div className="initiative-card__activity">
        <span>
          {hasTasks ? <FiCheckSquare /> : <FiUsers />}
          {hasTasks
            ? `${completedTasks || 0} of ${totalTasks} tasks done`
            : `${members.length} team member${members.length === 1 ? "" : "s"}`}
        </span>
        {budget && (
          <span className="initiative-card__budget">{budget} budget</span>
        )}
      </div>
      <div className="initiative-card__progress">
        <div>
          <span>Progress</span>
          <strong>{percent}%</strong>
        </div>
        <div
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="initiative-card__track"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="initiative-card__people">
        <div
          className="initiative-card__avatars"
          aria-label={`${members.length} team members`}
        >
          {visiblePeople.slice(0, 3).map((person, index) => (
            <span
              key={person?._id || index}
              className={`initiative-card__avatar initiative-card__avatar--${index}`}
              title={personName(person) || "Team member"}
            >
              {initials(personName(person))}
            </span>
          ))}
          {visiblePeople.length > 3 && (
            <span className="initiative-card__avatar initiative-card__avatar--more">
              +{visiblePeople.length - 3}
            </span>
          )}
          {!visiblePeople.length && (
            <span className="initiative-card__avatar initiative-card__avatar--more">
              <FiUsers />
            </span>
          )}
        </div>
        <span className="initiative-card__lead">
          <strong>{leader}</strong>
          <small>Project lead</small>
        </span>
        <span className={`initiative-card__due ${overdue ? "is-overdue" : ""}`}>
          <FiCalendar />
          <span>
            <small>{overdue ? "Overdue since" : "Due date"}</small>
            {dueLabel}
          </span>
        </span>
      </div>
      <button type="button" className="initiative-card__open" onClick={onOpen}>
        View project <FiArrowUpRight />
      </button>
    </article>
  );
}
