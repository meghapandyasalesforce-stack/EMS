import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiFolder,
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiGrid,
  FiArrowUpRight,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyProjects } from "../../context/employeeTaskSlice";
import { useNavigate } from "react-router-dom";
import ProjectSummaryCard, {
  projectCategory,
  projectStatus,
} from "../../components/project/ProjectSummaryCard";
import "./employeeProjects.css";

export default function EmployeeProjects() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    myProjects = [],
    status = "idle",
    error = null,
  } = useSelector((state) => state.employeeTask || {});
  const projects = useMemo(
    () => (Array.isArray(myProjects) ? myProjects : []),
    [myProjects],
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [department, setDepartment] = useState("All");
  const [sort, setSort] = useState("updated");

  useEffect(() => {
    dispatch(fetchMyProjects());
  }, [dispatch]);

  const counts = useMemo(
    () =>
      projects.reduce((result, project) => {
        const label = projectStatus(project.status);
        result[label] = (result[label] || 0) + 1;
        return result;
      }, {}),
    [projects],
  );
  const departments = useMemo(
    () => [...new Set(projects.map(projectCategory))].sort(),
    [projects],
  );
  const dueThisWeek = projects.filter((project) => {
    if (
      !project.endDate ||
      ["Completed", "Cancelled"].includes(projectStatus(project.status))
    )
      return false;
    const due = new Date(project.endDate);
    due.setHours(23, 59, 59, 999);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return due >= new Date() && due <= end;
  }).length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = projects.filter(
      (project) =>
        (filter === "All" || projectStatus(project.status) === filter) &&
        (department === "All" || projectCategory(project) === department) &&
        (!query ||
          [
            project.name,
            project.description,
            project.projectLeader?.name,
            projectCategory(project),
            projectStatus(project.status),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    );
    return result.sort((a, b) => {
      if (sort === "name")
        return String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "due")
        return (
          (new Date(a.endDate).getTime() || Infinity) -
          (new Date(b.endDate).getTime() || Infinity)
        );
      return (
        (new Date(b.updatedAt || b.createdAt).getTime() || 0) -
        (new Date(a.updatedAt || a.createdAt).getTime() || 0)
      );
    });
  }, [projects, filter, department, search, sort]);
  const filters = [
    "All",
    "In Progress",
    "Pending",
    "Completed",
    "On Hold",
    ...(counts.Cancelled ? ["Cancelled"] : []),
  ];

  return (
    <main className="assigned-workspace">
      <header className="assigned-workspace__header">
        <div className="assigned-workspace__eyebrow">
          <span /> MY WORKSPACE <i /> PROJECTS &amp; INITIATIVES
        </div>
        <h1>
          My assigned projects
          <span>
            <FiArrowUpRight />
          </span>
        </h1>
        <p>
          Your work, in focus. Track progress, stay connected with your team,
          and keep every deadline in sight.
        </p>
      </header>
      <section
        className="assigned-workspace__metrics"
        aria-label="Project summary"
      >
        {[
          [
            "Assigned projects",
            projects.length,
            "Across your workspace",
            <FiFolder />,
          ],
          [
            "In progress",
            counts["In Progress"] || 0,
            "Moving things forward",
            <FiActivity />,
          ],
          [
            "Completed",
            counts.Completed || 0,
            "Projects brought to life",
            <FiCheckCircle />,
          ],
          [
            "Due this week",
            dueThisWeek,
            "Upcoming project deadlines",
            <FiClock />,
          ],
        ].map(([label, value, note, icon], index) => (
          <div
            className={`assigned-metric assigned-metric--${index}`}
            key={label}
          >
            <div>
              <span>{label}</span>
              <i>{icon}</i>
            </div>
            <strong>{status === "loading" ? "—" : value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>
      <section
        className="assigned-workspace__filters"
        aria-label="Filter projects"
      >
        <div className="assigned-workspace__tabs">
          {filters.map((label) => (
            <button
              type="button"
              key={label}
              aria-pressed={filter === label}
              className={filter === label ? "is-active" : ""}
              onClick={() => setFilter(label)}
            >
              {label}
              <span>
                {label === "All" ? projects.length : counts[label] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="assigned-workspace__controls">
          <label className="assigned-workspace__search">
            <FiSearch />
            <input
              aria-label="Search projects"
              placeholder="Search your projects…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Project category"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="All">All categories</option>
            {departments.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
          <select
            aria-label="Sort projects"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="updated">Recently updated</option>
            <option value="due">Due date</option>
            <option value="name">Name A–Z</option>
          </select>
          {(search || filter !== "All" || department !== "All") && (
            <button
              type="button"
              className="assigned-workspace__clear"
              onClick={() => {
                setSearch("");
                setFilter("All");
                setDepartment("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
      <div className="assigned-workspace__section-title">
        <h2>
          <FiGrid /> My project directory <span>{filtered.length}</span>
        </h2>
        <p>
          {filtered.length} of {projects.length} projects
        </p>
      </div>
      {status === "loading" ? (
        <div className="assigned-workspace__empty" role="status">
          <FiClock />
          <h2>Loading your projects…</h2>
        </div>
      ) : error ? (
        <div className="assigned-workspace__empty" role="alert">
          <FiFolder />
          <h2>Unable to load projects</h2>
          <p>{String(error)}</p>
          <button type="button" onClick={() => dispatch(fetchMyProjects())}>
            Try again
          </button>
        </div>
      ) : filtered.length ? (
        <div
          className={`assigned-workspace__grid assigned-workspace__grid--${Math.min(filtered.length, 3)}`}
        >
          {filtered.map((project) => (
            <ProjectSummaryCard
              key={project._id}
              project={project}
              onOpen={() => navigate(`/employee/projects/${project._id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="assigned-workspace__empty">
          <FiFolder />
          <h2>
            {projects.length
              ? "No matching projects"
              : "Your next project starts here"}
          </h2>
          <p>
            {projects.length
              ? "Try another search or clear your filters."
              : "Projects assigned to you will appear in this workspace."}
          </p>
        </div>
      )}
    </main>
  );
}
