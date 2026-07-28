import React, { useState } from 'react';
import { FiCalendar, FiLock, FiUser } from 'react-icons/fi';
import WorkItemComments from '../../components/project/WorkItemComments';
import WorkItemDueDateHistory from '../../components/project/WorkItemDueDateHistory';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On hold' },
];

const statusLabel = (s) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s;

function formatDue(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(d) {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function resolveAssignees(item) {
  if (Array.isArray(item?.assignees) && item.assignees.length) return item.assignees;
  if (item?.assignee) return [item.assignee];
  return [];
}

function WorkPlanNode({
  item,
  depth,
  currentEmployeeId,
  onStatusChange,
  onDueDateChange,
  updatingId,
  onAddComment,
  commentingId,
  canComment,
}) {
  const assignees = resolveAssignees(item);
  const isMine =
    currentEmployeeId &&
    assignees.some((a) => (a._id || a)?.toString() === currentEmployeeId.toString());

  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState('');
  const [reasonDraft, setReasonDraft] = useState('');
  const [dueError, setDueError] = useState('');

  const openDueEditor = () => {
    setDueDraft(toDateInputValue(item.dueDate));
    setReasonDraft('');
    setDueError('');
    setEditingDue(true);
  };

  const cancelDueEditor = () => {
    setEditingDue(false);
    setDueError('');
  };

  const submitDueChange = async () => {
    const original = toDateInputValue(item.dueDate);
    if (dueDraft === original) {
      setEditingDue(false);
      return;
    }
    if (!reasonDraft.trim()) {
      setDueError('Reason is required when changing the due date');
      return;
    }
    setDueError('');
    const ok = await onDueDateChange?.(item._id, dueDraft || null, reasonDraft.trim());
    if (ok !== false) {
      setEditingDue(false);
    }
  };

  return (
    <div
      className="mb-3"
      style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
    >
      <div
        className={`rounded-lg border p-4 ${
          item.canEdit ? 'border-theme-secondary/40 bg-white' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {depth > 0 && (
                <span className="text-xs text-gray-500 font-medium uppercase">Subtask</span>
              )}
              {item.canEdit ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-theme-secondary/10 text-theme-secondary font-medium">
                  You can update
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium inline-flex items-center gap-1">
                  <FiLock size={12} /> View only
                </span>
              )}
              {isMine && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  Assigned to you
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
            {item.description ? (
              <p className="text-xs text-gray-600 mt-1">{item.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
              <span className="px-2 py-0.5 rounded bg-gray-100">
                Priority: {item.priority || 'medium'}
              </span>
              {assignees.length ? (
                assignees.map((person) => {
                  const pid = person._id || person;
                  const name = `${person.name || ''} ${person.lastName || ''}`.trim() || 'Assignee';
                  return (
                    <span
                      key={String(pid)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100"
                    >
                      <FiUser size={12} />
                      {name}
                    </span>
                  );
                })
              ) : (
                <span className="px-2 py-0.5 rounded bg-gray-100">Unassigned</span>
              )}
              {item.dueDate ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100">
                  <FiCalendar size={12} />
                  Due {formatDue(item.dueDate)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-gray-100">No due date</span>
              )}
              {item.canEdit && onDueDateChange && !editingDue ? (
                <button
                  type="button"
                  onClick={openDueEditor}
                  className="text-xs text-theme-secondary hover:underline"
                >
                  Change due date
                </button>
              ) : null}
            </div>

            {editingDue ? (
              <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  New due date
                  <input
                    type="date"
                    value={dueDraft}
                    onChange={(e) => setDueDraft(e.target.value)}
                    className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Reason for change
                  <textarea
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    rows={2}
                    placeholder="Why is the due date changing?"
                    className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                  />
                </label>
                {dueError ? <p className="text-xs text-red-600">{dueError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={updatingId === item._id}
                    onClick={submitDueChange}
                    className="text-xs px-3 py-1.5 rounded-lg bg-theme-secondary text-white disabled:opacity-60"
                  >
                    {updatingId === item._id ? 'Saving…' : 'Save due date'}
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === item._id}
                    onClick={cancelDueEditor}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex-shrink-0">
            {item.canEdit ? (
              <select
                value={item.status || 'todo'}
                disabled={updatingId === item._id}
                onChange={(e) => onStatusChange(item._id, e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-theme-secondary min-w-[140px]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`inline-block text-xs font-medium px-3 py-2 rounded-lg ${
                  item.status === 'completed'
                    ? 'bg-theme-primary/10 text-theme-primary'
                    : item.status === 'in-progress'
                      ? 'bg-theme-secondary/10 text-theme-secondary'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {statusLabel(item.status)}
              </span>
            )}
          </div>
        </div>
        <WorkItemDueDateHistory history={item.dueDateHistory} compact />
        <WorkItemComments
          comments={item.comments}
          canComment={canComment}
          submitting={commentingId === item._id}
          onSubmit={(text) => onAddComment?.(item._id, text)}
          compact
        />
      </div>
      {(item.subtasks || []).map((st) => (
        <WorkPlanNode
          key={st._id}
          item={st}
          depth={depth + 1}
          currentEmployeeId={currentEmployeeId}
          onStatusChange={onStatusChange}
          onDueDateChange={onDueDateChange}
          updatingId={updatingId}
          onAddComment={onAddComment}
          commentingId={commentingId}
          canComment={canComment}
        />
      ))}
    </div>
  );
}

export default function EmployeeWorkPlanSection({
  workPlan,
  workPlanProgress,
  workPlanStatus,
  workPlanError,
  currentEmployeeId,
  onStatusChange,
  onDueDateChange,
  updatingId,
  onAddComment,
  commentingId,
  canComment = true,
}) {
  if (workPlanStatus === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-secondary" />
      </div>
    );
  }

  if (workPlanError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
        {workPlanError}
      </div>
    );
  }

  if (!workPlan?.length) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-sm text-gray-600">
          No work plan items yet. Your project manager may add tasks and assign them to you.
        </p>
      </div>
    );
  }

  return (
    <div>
      {workPlanProgress && workPlanProgress.total > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-theme-secondary/5 border border-theme-secondary/20">
          <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
            <span>Work plan progress</span>
            <span>
              {workPlanProgress.completed} / {workPlanProgress.total} ({workPlanProgress.percent}%)
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-theme-secondary transition-all"
              style={{ width: `${workPlanProgress.percent}%` }}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mb-4">
        If you are assigned to a main task, you can update that task and all its subtasks. Changing a
        due date requires a reason, which is saved in the task history for the team to see.
      </p>
      {workPlan.map((node) => (
        <WorkPlanNode
          key={node._id}
          item={node}
          depth={0}
          currentEmployeeId={currentEmployeeId}
          onStatusChange={onStatusChange}
          onDueDateChange={onDueDateChange}
          updatingId={updatingId}
          onAddComment={onAddComment}
          commentingId={commentingId}
          canComment={canComment}
        />
      ))}
    </div>
  );
}
