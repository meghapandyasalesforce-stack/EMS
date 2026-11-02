import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  FiPlus,
  FiSave,
  FiEdit3,
  FiArrowLeft,
  FiCalendar,
  FiUser,
  FiMessageSquare,
  FiClipboard,
  FiRefreshCw,
  FiUsers,
  FiFlag,
  FiCheckCircle,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchMyProjects,
  fetchMyTasks,
  createNewTask,
  updateExistingTask,
  fetchEmployeeWorkPlan,
  updateEmployeeWorkItem,
  addEmployeeWorkItemComment,
} from "../../context/employeeTaskSlice";
import EmployeeWorkPlanSection from "./EmployeeWorkPlanSection";
import "./employeeProjectWorkspace.css";

const employeeIdOf = (value) => String(value?._id || value || "");
const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};
const isToday = (value) =>
  new Date(value).toDateString() === new Date().toDateString();
const statusLabel = (value) =>
  ({
    "in-progress": "In Progress",
    "on-hold": "On Hold",
    pending: "Pending",
    completed: "Completed",
  })[value] ||
  value ||
  "Pending";
const badgeClass = (status) =>
  `employee-project-badge employee-project-badge--${String(status || "pending")
    .toLowerCase()
    .replaceAll(" ", "-")}`;

export default function EmployeeTasks() {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    myProjects,
    myTasks,
    workPlan,
    workPlanProgress,
    workPlanStatus,
    workPlanError,
    error,
  } = useSelector((state) => state.employeeTask);
  const employee = useSelector((state) => state.employeeDetails?.employee);
  const user = useSelector((state) => state.auth?.user);
  const currentEmployeeId =
    employee?._id || user?.employeeProfileId || user?._id;
  const [activeTab, setActiveTab] = useState("details");
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState("Not Started");
  const [comments, setComments] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const logRequest = useRef(0);
  const [formError, setFormError] = useState("");
  const [updatingWorkItemId, setUpdatingWorkItemId] = useState(null);
  const [commentingWorkItemId, setCommentingWorkItemId] = useState(null);
  const descriptionInput = useRef(null);
  const savingRef = useRef(false);
  const currentProject = useMemo(
    () => myProjects.find((p) => String(p._id) === String(projectId)),
    [myProjects, projectId],
  );
  const projectLogs = useMemo(
    () =>
      myTasks.filter(
        (task) =>
          employeeIdOf(task.project) === String(projectId) &&
          employeeIdOf(task.employee) === String(currentEmployeeId),
      ),
    [myTasks, projectId, currentEmployeeId],
  );
  const todayTask = projectLogs.find((task) => isToday(task.date));

  const loadDailyLogs = useCallback(async () => {
    const requestId = ++logRequest.current;
    setLogsLoading(true);
    try {
      await dispatch(fetchMyTasks({ projectId, scope: "mine" }));
    } finally {
      if (requestId === logRequest.current) setLogsLoading(false);
    }
  }, [dispatch, projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setProjectsLoaded(false);
    setActiveTab("details");
    setEditingTaskId(null);
    setTaskDescription("");
    setTaskStatus("Not Started");
    setComments("");
    setFormError("");
    dispatch(fetchMyProjects()).then(() => {
      if (!cancelled) setProjectsLoaded(true);
    });
    loadDailyLogs();
    dispatch(fetchEmployeeWorkPlan(projectId));
    return () => {
      cancelled = true;
    };
  }, [projectId, dispatch, loadDailyLogs]);

  useEffect(() => {
    if (todayTask) {
      setEditingTaskId(todayTask._id);
      setTaskDescription(todayTask.taskDescription);
      setTaskStatus(todayTask.status);
      setComments(todayTask.comments || "");
    }
  }, [todayTask?._id, projectId]);

  const handleWorkItemStatusChange = useCallback(
    async (workItemId, newStatus) => {
      setUpdatingWorkItemId(workItemId);
      await dispatch(
        updateEmployeeWorkItem(workItemId, projectId, { status: newStatus }),
      );
      setUpdatingWorkItemId(null);
    },
    [dispatch, projectId],
  );
  const handleWorkItemDueDateChange = useCallback(
    async (workItemId, dueDate, dueDateChangeReason) => {
      setUpdatingWorkItemId(workItemId);
      const result = await dispatch(
        updateEmployeeWorkItem(workItemId, projectId, {
          dueDate,
          dueDateChangeReason,
        }),
      );
      setUpdatingWorkItemId(null);
      return result?.success;
    },
    [dispatch, projectId],
  );
  const handleWorkItemComment = useCallback(
    async (workItemId, text) => {
      setCommentingWorkItemId(workItemId);
      const result = await dispatch(
        addEmployeeWorkItemComment(workItemId, projectId, text),
      );
      setCommentingWorkItemId(null);
      return result?.success;
    },
    [dispatch, projectId],
  );

  const openDailyLog = () => {
    setActiveTab("daily");
    loadDailyLogs();
  };
  const handleSave = async (event) => {
    event.preventDefault();
    if (savingRef.current || logsLoading) return;
    if (!taskDescription.trim()) {
      setFormError("Describe what you worked on today.");
      descriptionInput.current?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      const data = {
        taskDescription: taskDescription.trim(),
        status: taskStatus,
        comments: comments.trim(),
      };
      const taskId = editingTaskId || todayTask?._id;
      const result = await dispatch(
        taskId
          ? updateExistingTask(taskId, data)
          : createNewTask({ projectId, ...data }),
      );
      if (result?.success) {
        if (result.task?._id) setEditingTaskId(result.task._id);
        await loadDailyLogs();
      } else {
        setFormError(
          "Your daily log could not be saved. Review the error above and try again.",
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!projectsLoaded)
    return (
      <main className="employee-project-workspace">
        <div
          className="employee-project-panel employee-project-empty"
          role="status"
        >
          Loading your project…
        </div>
      </main>
    );
  if (!currentProject)
    return (
      <main className="employee-project-workspace">
        <div
          className="employee-project-panel employee-project-empty"
          role={error ? "alert" : undefined}
        >
          <FiClipboard />
          <h1>{error ? "Unable to load project" : "Project not available"}</h1>
          <p>
            {error ||
              "This project is not currently assigned to you. Ask your project lead to check your membership."}
          </p>
          <button onClick={() => dispatch(fetchMyProjects())}>Try again</button>
          <button onClick={() => navigate("/employee/projects")}>
            Back to Projects
          </button>
        </div>
      </main>
    );

  const progress = Math.min(
    100,
    Math.max(0, Number(currentProject.progress) || 0),
  );
  const members = currentProject.projectMembers || [];
  const tabs = [
    ["details", "Project Details", FiClipboard],
    ["plan", "Work plan", FiCheckCircle],
    ["daily", "My daily logs", FiMessageSquare],
  ];
  return (
    <main className="employee-project-workspace">
      <div className="employee-project-toolbar">
        <button
          className="employee-project-secondary"
          onClick={() => navigate("/employee/projects")}
        >
          <FiArrowLeft /> Back to Projects
        </button>
        <button className="employee-project-primary" onClick={openDailyLog}>
          <FiPlus /> {todayTask ? "Update daily task" : "Add daily task"}
        </button>
      </div>
      <header className="employee-project-hero">
        <div className="employee-project-eyebrow">
          MY WORKSPACE <span>/</span> ASSIGNED PROJECT
        </div>
        <div className="employee-project-heading">
          <div>
            <h1>{currentProject.name}</h1>
            <p>Your project, your team, and the work moving it forward.</p>
          </div>
          <span className={badgeClass(currentProject.status)}>
            {statusLabel(currentProject.status)}
          </span>
        </div>
        <div className="employee-project-summary">
          <div>
            <FiUser />
            <span>
              Project lead
              <strong>
                {currentProject.projectLeader?.name || "Not assigned"}
              </strong>
            </span>
          </div>
          <div>
            <FiUsers />
            <span>
              Team members<strong>{members.length}</strong>
            </span>
          </div>
          <div>
            <FiCalendar />
            <span>
              Due date<strong>{formatDate(currentProject.endDate)}</strong>
            </span>
          </div>
          <div className="employee-project-progress">
            <span>
              Overall progress<strong>{progress}%</strong>
            </span>
            <progress
              value={progress}
              max="100"
              aria-label="Overall project progress"
            />
          </div>
        </div>
      </header>
      <nav
        className="employee-project-tabs"
        role="tablist"
        aria-label="Project workspace"
      >
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            id={`employee-project-tab-${key}`}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`employee-project-panel-${key}`}
            onClick={() =>
              key === "daily" ? openDailyLog() : setActiveTab(key)
            }
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div className="employee-project-error" role="alert">
          {error}
        </div>
      )}
      <section
        id={`employee-project-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`employee-project-tab-${activeTab}`}
      >
        {activeTab === "details" && (
          <div className="employee-project-detail-grid">
            <section className="employee-project-panel">
              <div className="employee-project-section-heading">
                <span>
                  <FiClipboard />
                </span>
                <div>
                  <h2>Project overview</h2>
                  <p>The details behind your shared goals.</p>
                </div>
              </div>
              <h3>Description</h3>
              <p className="employee-project-description">
                {currentProject.description ||
                  "No project description has been added yet."}
              </p>
              <dl className="employee-project-facts">
                {[
                  ["Category", currentProject.category || "General"],
                  ["Priority", currentProject.priority || "Medium"],
                  ["Start date", formatDate(currentProject.startDate)],
                  ["End date", formatDate(currentProject.endDate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {currentProject.tags?.length > 0 && (
                <div className="employee-project-tags">
                  {currentProject.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </section>
            <aside className="employee-project-panel">
              <div className="employee-project-section-heading">
                <span>
                  <FiUsers />
                </span>
                <div>
                  <h2>Team & ownership</h2>
                  <p>The people behind this project.</p>
                </div>
              </div>
              <h3>Project lead</h3>
              <div className="employee-project-person">
                <span>
                  {(currentProject.projectLeader?.name || "?").charAt(0)}
                </span>
                <div>
                  <strong>
                    {currentProject.projectLeader?.name || "Not assigned"}
                  </strong>
                  <small>{currentProject.projectLeader?.email}</small>
                </div>
              </div>
              <h3>Project members · {members.length}</h3>
              {members.length ? (
                members.map((member) => (
                  <div
                    className="employee-project-person"
                    key={employeeIdOf(member)}
                  >
                    <span>{(member.name || "?").charAt(0)}</span>
                    <div>
                      <strong>{member.name || "Team member"}</strong>
                      <small>{member.email}</small>
                    </div>
                  </div>
                ))
              ) : (
                <p>No additional team members.</p>
              )}
              <div className="employee-project-callout">
                <FiMessageSquare />
                <p>
                  Share what you worked on today. Your entry appears in this
                  project's Team daily logs.
                </p>
                <button onClick={openDailyLog}>Write today's log →</button>
              </div>
            </aside>
          </div>
        )}
        {activeTab === "plan" && (
          <div className="employee-project-panel employee-project-work-plan">
            <div className="employee-project-section-heading">
              <span>
                <FiCheckCircle />
              </span>
              <div>
                <h2>Work plan</h2>
                <p>
                  Update the tasks assigned to you and keep your team on track.
                </p>
              </div>
            </div>
            <EmployeeWorkPlanSection
              workPlan={workPlan}
              workPlanProgress={workPlanProgress}
              workPlanStatus={workPlanStatus}
              workPlanError={workPlanError}
              currentEmployeeId={currentEmployeeId}
              onStatusChange={handleWorkItemStatusChange}
              onDueDateChange={handleWorkItemDueDateChange}
              updatingId={updatingWorkItemId}
              onAddComment={handleWorkItemComment}
              commentingId={commentingWorkItemId}
              canComment={Boolean(currentEmployeeId)}
            />
          </div>
        )}
        {activeTab === "daily" && (
          <div className="employee-project-daily-grid">
            <form
              className="employee-project-panel employee-project-log-form"
              onSubmit={handleSave}
            >
              <div className="employee-project-section-heading">
                <span>
                  <FiEdit3 />
                </span>
                <div>
                  <h2>
                    {editingTaskId || todayTask
                      ? "Update today's log"
                      : "Today's work log"}
                  </h2>
                  <p>
                    {formatDate(new Date())} · Shared with your project team
                  </p>
                </div>
              </div>
              <div className="employee-project-callout">
                <FiMessageSquare />
                <p>
                  Write your daily task update here. It appears in Team daily
                  logs for {currentProject.name}. You can update today's entry
                  throughout the day.
                </p>
              </div>
              <label htmlFor="employee-task-description">
                Task description <span>*</span>
              </label>
              <textarea
                id="employee-task-description"
                ref={descriptionInput}
                value={taskDescription}
                onChange={(event) => {
                  setTaskDescription(event.target.value);
                  setFormError("");
                }}
                rows={4}
                placeholder="What did you work on today?"
                readOnly={saving}
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? "employee-task-error" : undefined}
              />
              <label htmlFor="employee-task-status">Status</label>
              <select
                id="employee-task-status"
                value={taskStatus}
                onChange={(event) => setTaskStatus(event.target.value)}
                disabled={saving}
              >
                {["Not Started", "In Progress", "Completed", "On Hold"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
              <label htmlFor="employee-task-comments">
                Comments <small>(optional)</small>
              </label>
              <textarea
                id="employee-task-comments"
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={3}
                placeholder="Add context, blockers, or a handover note…"
                readOnly={saving}
              />
              {formError && (
                <p
                  id="employee-task-error"
                  className="employee-project-error"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              <div className="employee-project-form-footer">
                <small>One log per day, per project.</small>
                <button
                  className="employee-project-primary"
                  type="submit"
                  disabled={saving || logsLoading}
                >
                  <FiSave />
                  {saving
                    ? "Saving…"
                    : editingTaskId || todayTask
                      ? "Update daily task"
                      : "Save daily task"}
                </button>
              </div>
            </form>
            <section className="employee-project-panel">
              <div className="employee-project-section-heading">
                <span>
                  <FiCalendar />
                </span>
                <div>
                  <h2>
                    My daily logs <small>({projectLogs.length})</small>
                  </h2>
                  <p>Your work history for this project.</p>
                </div>
                <button
                  className="employee-project-icon-button"
                  aria-label="Refresh my daily logs"
                  onClick={loadDailyLogs}
                  disabled={saving || logsLoading}
                >
                  <FiRefreshCw />
                </button>
              </div>
              {logsLoading && !saving ? (
                <p role="status">Loading daily logs…</p>
              ) : !projectLogs.length ? (
                <div className="employee-project-empty">
                  <FiClipboard />
                  <h3>Your first update starts here</h3>
                  <p>
                    Save today's work using the form. Your project team will be
                    able to see it in Team daily logs.
                  </p>
                </div>
              ) : (
                <div className="employee-project-log-list">
                  {projectLogs.map((task) => (
                    <article
                      className="employee-project-log-card"
                      key={task._id}
                    >
                      <div className="employee-project-log-meta">
                        <span>
                          <FiCalendar />
                          {formatDate(task.date)}
                        </span>
                        <span className={badgeClass(task.status)}>
                          {task.status}
                        </span>
                      </div>
                      <h3>{task.taskDescription}</h3>
                      {task.comments && <p>{task.comments}</p>}
                      {isToday(task.date) && (
                        <button
                          className="employee-project-text-button"
                          onClick={() => {
                            setEditingTaskId(task._id);
                            setTaskDescription(task.taskDescription);
                            setTaskStatus(task.status);
                            setComments(task.comments || "");
                            descriptionInput.current?.focus();
                          }}
                        >
                          <FiEdit3 /> Edit today's entry
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
