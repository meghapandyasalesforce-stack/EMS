import React from 'react';
import { FiCalendar, FiLock, FiUser } from 'react-icons/fi';

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

function WorkPlanNode({ item, depth, currentEmployeeId, onStatusChange, updatingId }) {
  const assigneeName = item.assignee
    ? `${item.assignee.name || ''} ${item.assignee.lastName || ''}`.trim()
    : null;
  const isMine =
    currentEmployeeId &&
    item.assignee?._id?.toString() === currentEmployeeId.toString();

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
              {assigneeName ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100">
                  <FiUser size={12} />
                  {assigneeName}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-gray-100">Unassigned</span>
              )}
              {item.dueDate ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100">
                  <FiCalendar size={12} />
                  Due {formatDue(item.dueDate)}
                </span>
              ) : null}
            </div>
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
      </div>
      {(item.subtasks || []).map((st) => (
        <WorkPlanNode
          key={st._id}
          item={st}
          depth={depth + 1}
          currentEmployeeId={currentEmployeeId}
          onStatusChange={onStatusChange}
          updatingId={updatingId}
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
  updatingId,
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
        If you are assigned to a main task, you can update that task and all its subtasks. If you
        are only assigned to a subtask, you can update that subtask only.
      </p>
      {workPlan.map((node) => (
        <WorkPlanNode
          key={node._id}
          item={node}
          depth={0}
          currentEmployeeId={currentEmployeeId}
          onStatusChange={onStatusChange}
          updatingId={updatingId}
        />
      ))}
    </div>
  );
}
