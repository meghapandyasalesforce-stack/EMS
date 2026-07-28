import React from 'react';
import { FiCalendar } from 'react-icons/fi';

function personName(person) {
  if (!person) return 'Someone';
  if (typeof person === 'string') return 'Team member';
  const name = `${person.name || ''} ${person.lastName || ''}`.trim();
  return name || person.email || 'Team member';
}

function formatDateOnly(value) {
  if (!value) return 'None';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'None';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shows due-date change history for a work-plan task.
 */
export default function WorkItemDueDateHistory({ history = [], compact = false }) {
  const sorted = [...(history || [])].sort((a, b) => {
    const ta = new Date(a.changedAt || 0).getTime();
    const tb = new Date(b.changedAt || 0).getTime();
    return tb - ta;
  });

  if (!sorted.length) return null;

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        <FiCalendar size={14} />
        Due date history ({sorted.length})
      </div>
      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {sorted.map((entry) => (
          <li
            key={entry._id || `${entry.changedAt}-${entry.reason}`}
            className="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800">
                {personName(entry.changedBy)}
              </span>
              <span className="text-[11px] text-gray-500">{formatWhen(entry.changedAt)}</span>
            </div>
            <p className="text-xs text-gray-700 mt-1">
              <span className="font-medium">{formatDateOnly(entry.previousDueDate)}</span>
              {' → '}
              <span className="font-medium">{formatDateOnly(entry.newDueDate)}</span>
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              <span className="font-medium">Reason:</span> {entry.reason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
