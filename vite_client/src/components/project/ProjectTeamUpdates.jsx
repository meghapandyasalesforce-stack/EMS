import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiMessageSquare, FiRefreshCw, FiCalendar } from "react-icons/fi";
import axios from "../../utils/axios";
import { BOTH_TASK_ENDPOINT } from "../../utils/constant";
import ProjectUpdateFeed from "./ProjectUpdateFeed";
import "../../Admin/project/projectDailyUpdates.css";

const initialDraft = (status) => ({
  update: "",
  updateDate: new Date().toISOString().slice(0, 10),
  status: status || "in-progress",
  blockers: "",
  nextSteps: "",
});
export default function ProjectTeamUpdates({ project, showComposer = false }) {
  const [updates, setUpdates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(showComposer);
  const [draft, setDraft] = useState(() => initialDraft(project.status));
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const pendingSave = useRef(false);
  const base = `${BOTH_TASK_ENDPOINT}/projects/${project._id}`;
  const refresh = useCallback(async () => {
    const requestId = ++request.current;
    setLoading(true);
    setError("");
    try {
      const collected = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const response = await axios.get(`${base}/updates`, {
          withCredentials: true,
          params: { page, limit: 100 },
        });
        if (!response.data?.success)
          throw new Error(
            response.data?.error || "Unable to load team updates",
          );
        collected.push(...(response.data.updates || []));
        const pagination = response.data.pagination;
        hasNext = pagination?.hasNext ?? page < Number(pagination?.pages || 1);
        page++;
      }
      const response = await axios.get(`${base}/team-logs`, {
        withCredentials: true,
      });
      if (requestId !== request.current) return;
      setUpdates(collected);
      setTasks(response.data?.tasks || []);
    } catch (error) {
      if (requestId === request.current)
        setError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Unable to load team logs",
        );
    } finally {
      if (requestId === request.current) setLoading(false);
    }
  }, [base]);
  useEffect(() => {
    refresh();
    return () => {
      request.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (showComposer) setOpen(true);
  }, [showComposer]);
  const post = async (event) => {
    event.preventDefault();
    if (pendingSave.current || !draft.update.trim()) return;
    pendingSave.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await axios.post(
        `${base}/updates`,
        { ...draft, update: draft.update.trim() },
        { withCredentials: true },
      );
      if (!response.data?.success)
        throw new Error(response.data?.error || "Unable to post update");
      setDraft(initialDraft(project.status));
      setOpen(false);
      setNotice("Your update has been posted to Team daily logs.");
      await refresh();
    } catch (error) {
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Unable to post update",
      );
    } finally {
      setSaving(false);
      pendingSave.current = false;
    }
  };
  const change = (event) =>
    setDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  return (
    <div className="employee-team-updates project-daily-view">
      <div className="employee-project-panel">
        <div className="employee-team-updates-heading">
          <div>
            <h2>Team daily logs</h2>
            <p>Updates from everyone working on {project.name}.</p>
          </div>
          <div>
            <button
              className="employee-project-secondary"
              onClick={refresh}
              disabled={loading || saving}
            >
              <FiRefreshCw /> Refresh logs
            </button>
            <button
              className="employee-project-primary"
              onClick={() => {
                setOpen(true);
                setNotice("");
              }}
            >
              <FiMessageSquare /> Post Update
            </button>
          </div>
        </div>
        {notice && (
          <div className="employee-project-callout" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="employee-project-error" role="alert">
            {error}
          </div>
        )}
        {open && (
          <form
            className="employee-project-log-form employee-team-update-form"
            onSubmit={post}
          >
            <h3>Post a team update</h3>
            <p>
              Share your work, blockers, and next steps. Your project team and
              HR can see this update.
            </p>
            <label htmlFor="team-update-text">
              Update <span>*</span>
            </label>
            <textarea
              id="team-update-text"
              name="update"
              required
              maxLength={5000}
              rows={4}
              value={draft.update}
              onChange={change}
              readOnly={saving}
              placeholder="What did you work on today?"
            />
            <div className="employee-project-facts">
              <div>
                <label htmlFor="team-update-date">Update date</label>
                <input
                  id="team-update-date"
                  name="updateDate"
                  type="date"
                  required
                  value={draft.updateDate}
                  onChange={change}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="team-update-status">Status</label>
                <select
                  id="team-update-status"
                  name="status"
                  value={draft.status}
                  onChange={change}
                  disabled={saving}
                >
                  {[
                    ["pending", "Pending"],
                    ["in-progress", "In Progress"],
                    ["completed", "Completed"],
                    ["on-hold", "On Hold"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="team-update-blockers">Blockers / Challenges</label>
            <textarea
              id="team-update-blockers"
              name="blockers"
              maxLength={1000}
              rows={2}
              value={draft.blockers}
              onChange={change}
              readOnly={saving}
            />
            <label htmlFor="team-update-next">Next Steps</label>
            <textarea
              id="team-update-next"
              name="nextSteps"
              maxLength={1000}
              rows={2}
              value={draft.nextSteps}
              onChange={change}
              readOnly={saving}
            />
            <div className="employee-project-form-footer">
              <button
                type="button"
                className="employee-project-secondary"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="employee-project-primary"
                disabled={saving || !draft.update.trim()}
              >
                {saving ? "Posting…" : "Post Update"}
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <p role="status">Loading team logs…</p>
        ) : !error && !updates.length && !tasks.length ? (
          <div className="employee-project-empty">
            <FiMessageSquare />
            <h3>No team updates yet</h3>
            <p>Post the first update to keep your team informed.</p>
          </div>
        ) : null}
      </div>
      {!loading && (
        <>
          <ProjectUpdateFeed updates={updates} />
          {tasks.length > 0 && (
            <section className="employee-project-panel">
              <h2>Team daily task entries</h2>
              <div className="employee-project-log-list">
                {tasks.map((task) => (
                  <article className="employee-project-log-card" key={task._id}>
                    <div className="employee-project-log-meta">
                      <span>
                        <FiCalendar />
                        {task.employee?.name || "Team member"} ·{" "}
                        {new Date(task.date).toLocaleDateString()}
                      </span>
                      <span className="employee-project-badge">
                        {task.status}
                      </span>
                    </div>
                    <h3>{task.taskDescription}</h3>
                    {task.comments && <p>{task.comments}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
