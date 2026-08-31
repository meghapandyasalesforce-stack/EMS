/**
 * Presentation-only helpers for approval / leave workflow status.
 * Strips internal flags (SLA breach, HR override availability, escalation) from user-visible text.
 * Backend fields (slaEscalated, hrOverrideAvailable, etc.) are unchanged — only UI labels.
 */

import { formatStatusLabel } from './textFormat.js';

const INTERNAL_NOTE_RE = /sla\s*breach|hr\s*override\s*available|\bescalated\b|override\s*available/i;

/** Remove internal workflow wording from any status string returned by the API. */
export function sanitizeApprovalStatusText(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';

  s = s.replace(/\s*[·•]\s*SLA\s+Breached\s*\(\s*HR\s+Override\s+Available\s*\)/gi, '');
  s = s.replace(/\s*[·•]\s*SLA\s+Breached/gi, '');
  s = s.replace(/\s*[·•]\s*Timed\s+out\s*\(\s*next\s+step\s+can\s+act\s*\)/gi, '');
  s = s.replace(/\s*[·•]\s*Timed\s+out/gi, '');
  s = s.replace(/\s*\(\s*HR\s+Override\s+Available\s*\)/gi, '');
  s = s.replace(/\s*[·•]\s*Escalated/gi, '');
  s = s.replace(/\bSLA\s+Breached\b/gi, '');
  s = s.replace(/\bHR\s+Override\s+Available\b/gi, '');
  s = s.replace(/\bSLA\s+breached\b/gi, '');
  s = s.replace(/\bTimed\s+out\b/gi, '');

  s = s.replace(/^Pending\s+Manager(?:\s*\([^)]*\))?/i, 'Waiting for Manager');
  s = s.replace(/^Pending\s+manager(?:\s*\([^)]*\))?/i, 'Waiting for Manager');
  s = s.replace(/^Awaiting\s+HR\s+approval$/i, 'Waiting for HR');

  s = s.replace(/\s{2,}/g, ' ').replace(/\s*[·•]\s*$/g, '').trim();
  return s;
}

const APPROVER_TYPE_WAITING = {
  Manager: 'Waiting for Manager',
  HR: 'Waiting for HR',
  Executive: 'Waiting for executive',
  Finance: 'Waiting for finance',
};

/** Pending-step label from workflowSummary (ignores slaEscalated / hrOverride flags). */
export function getWorkflowWaitingLabel(workflowSummary) {
  const pending = workflowSummary?.pendingStep;
  if (!workflowSummary?.hasWorkflow || !pending) return null;
  if (pending.approverType === 'Manager') return 'Waiting for Manager';
  return (
    APPROVER_TYPE_WAITING[pending.approverType] ||
    `Waiting: ${pending.stepName || `step ${pending.stepNumber}`}`
  );
}

export function formatHrOverrideOutcome(workflowSummary, status) {
  const st = (status || '').toLowerCase();
  if (!workflowSummary?.hrOverrideUsed) return null;
  if (st === 'approved') {
    return workflowSummary.hrOverrideByName
      ? `Approved by ${workflowSummary.hrOverrideByName}`
      : 'Approved by HR Manager';
  }
  if (st === 'rejected') {
    return workflowSummary.hrOverrideByName
      ? `Rejected by ${workflowSummary.hrOverrideByName}`
      : 'Rejected by HR Executive';
  }
  return null;
}

/** Leave list / drawer / employee views — maps API approvalStage + workflow to business-friendly text. */
export function formatLeaveApprovalStageDisplay(leave = {}) {
  const status = (leave?.status || '').toLowerCase();
  const hrLine = formatHrOverrideOutcome(leave?.workflowSummary, status);

  if (status === 'approved') return hrLine || 'Approved';
  if (status === 'rejected') return hrLine || 'Rejected';
  if (status === 'cancelled') return 'Cancelled';

  if (status === 'pending') {
    const fromWorkflow = getWorkflowWaitingLabel(leave?.workflowSummary);
    const cleaned = sanitizeApprovalStatusText(leave?.approvalStage || fromWorkflow || 'Pending');
    if (/waiting for manager/i.test(cleaned)) return 'Waiting for Manager';
    if (/^pending$/i.test(cleaned)) return 'Pending';
    return cleaned || 'Pending';
  }

  return sanitizeApprovalStatusText(leave?.approvalStage || leave?.status || '—') || '—';
}

export function formatCapitalRequestStatus(status) {
  return formatStatusLabel(status);
}

/**
 * Audit timeline — returns null to omit internal-only events from the UI.
 */
export function formatAuditTimelineEvent(event) {
  const action = event?.action || '';
  switch (action) {
    case 'request_submitted':
    case 'submitted':
      return 'Request submitted';
    case 'sla_timer_started': {
      const hoursMatch = String(event.note || '').match(/\((\d+\s*hours?)\)/i);
      return hoursMatch ? `Timer started (${hoursMatch[1]})` : 'Approval timer started';
    }
    case 'manager_notified':
    case 'approver_notified':
      if (
        event.note === 'Manager Notified' ||
        event.actorRole === 'Manager' ||
        /manager/i.test(event.note || '')
      ) {
        return 'Manager notified';
      }
      return sanitizeApprovalStatusText(event.note) || 'Approver notified';
    case 'sla_escalated':
    case 'hr_escalation_opened':
    case 'manager_step_skipped':
    case 'push_notifications_sent':
      return null;
    case 'hr_override_approved':
      return event.actorName ? `Approved by ${event.actorName}` : 'Approved by HR Manager';
    case 'hr_override_rejected':
      return event.actorName ? `Rejected by ${event.actorName}` : 'Rejected by HR Executive';
    case 'admin_bypass_approved':
      return 'Approved by Admin';
    default: {
      const note = String(event.note || '');
      if (INTERNAL_NOTE_RE.test(note)) return null;
      const label = sanitizeApprovalStatusText(note || action || 'Update');
      return label || null;
    }
  }
}

/** @deprecated alias for ApprovalDetailModal import name */
export const auditActionLabel = (event) => {
  const label = formatAuditTimelineEvent(event);
  if (label) return label;
  if (event?.action === 'submitted') return 'Submitted by Employee';
  return null;
};
