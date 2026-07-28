/**
 * Due-date change tracking for project work items.
 */

const MAX_REASON_LEN = 500;

export function toDateKey(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function dueDatesEqual(a, b) {
  return toDateKey(a) === toDateKey(b);
}

/**
 * Apply a due-date change with required reason when the date actually changes.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function applyDueDateChange(item, {
  dueDate,
  reason,
  changedBy,
} = {}) {
  if (dueDate === undefined) return { ok: true };

  const previousDueDate = item.dueDate || null;
  const nextDueDate = dueDate ? new Date(dueDate) : null;

  if (nextDueDate && Number.isNaN(nextDueDate.getTime())) {
    return { ok: false, error: 'Invalid due date' };
  }

  if (dueDatesEqual(previousDueDate, nextDueDate)) {
    return { ok: true };
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    return { ok: false, error: 'A reason is required when changing the due date' };
  }
  if (!changedBy) {
    return { ok: false, error: 'Employee profile required to change the due date' };
  }

  if (!Array.isArray(item.dueDateHistory)) {
    item.dueDateHistory = [];
  }

  item.dueDateHistory.push({
    previousDueDate: previousDueDate || undefined,
    newDueDate: nextDueDate || undefined,
    reason: trimmedReason.slice(0, MAX_REASON_LEN),
    changedBy,
    changedAt: new Date(),
  });

  item.dueDate = nextDueDate || undefined;
  return { ok: true };
}
