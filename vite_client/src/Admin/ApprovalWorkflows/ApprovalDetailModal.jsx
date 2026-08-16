import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiCheckCircle, FiXCircle, FiClock, FiUser, FiAlertTriangle } from 'react-icons/fi';
import { auditActionLabel, formatAuditTimelineEvent } from '../../utils/approvalStatusDisplay';
import { AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';

const stepTone = (status = '') => {
  const s = String(status).toLowerCase();
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'error';
  if (s === 'skipped') return 'neutral';
  return 'pending';
};

const priorityTone = (priority = '') => {
  const p = String(priority).toLowerCase();
  if (p === 'urgent') return 'error';
  if (p === 'high') return 'attention';
  return 'neutral';
};

const InfoItem = ({ label, value, children }) => (
  <div className="ats-approval-modal__info-item">
    <span className="ats-approval-modal__info-label">{label}</span>
    {children || <span className="ats-approval-modal__info-value">{value || '—'}</span>}
  </div>
);

const ApprovalDetailModal = ({ approval, onClose, onAction }) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const pendingStep = approval.currentPendingStep;
  const requester = approval.requestedBy;
  const requesterName = [
    requester?.name,
    requester?.fullName,
    [requester?.firstName, requester?.lastName].filter(Boolean).join(' '),
  ].find((value) => value && String(value).trim()) || '';
  const requesterEmail = requester?.email || '';

  const timelineEntries = useMemo(() => {
    const auditTrail = Array.isArray(approval.auditTrail) ? approval.auditTrail : [];
    return auditTrail
      .map((event, index) => ({
        key: `${event.action || 'event'}-${index}`,
        label: formatAuditTimelineEvent(event) || auditActionLabel(event),
        at: event.at,
      }))
      .filter((entry) => Boolean(entry.label));
  }, [approval.auditTrail]);

  const steps = approval.steps?.length
    ? approval.steps
    : approval.currentPendingStep
      ? [approval.currentPendingStep]
      : [];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const handleApprove = () => {
    onAction(approval._id, pendingStep?.stepNumber, 'Approve', '');
  };

  const handleRejectConfirm = () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    onAction(approval._id, pendingStep?.stepNumber, 'Reject', reason);
  };

  return createPortal(
    <div
      className="ats-approval-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="cm-hrms ats-ui ats-approval-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ats-approval-modal__header">
          <div className="ats-approval-modal__header-main">
            <p className="ats-approval-modal__eyebrow">{approval.entityType || 'Request'}</p>
            <h2 id="approval-detail-title" className="ats-approval-modal__title">
              Approval Details
            </h2>
            <div className="ats-approval-modal__header-badges">
              <AtsBadge status={approval.status}>{approval.status || 'In Progress'}</AtsBadge>
              {approval.priority ? (
                <AtsBadge tone={priorityTone(approval.priority)}>{approval.priority}</AtsBadge>
              ) : null}
              {approval.slaEscalated ? <AtsBadge tone="error">Overdue</AtsBadge> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ats-approval-modal__close"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="ats-approval-modal__body">
          <section className="ats-approval-modal__section">
            <h3 className="ats-approval-modal__section-title">Request information</h3>
            <div className="ats-approval-modal__requester">
              <AtsAvatar name={requesterName || requesterEmail} />
              <div className="min-w-0">
                <span className="ats-approval-modal__info-label">Requested by</span>
                <p className="ats-approval-modal__requester-name">
                  {requesterName || requesterEmail || 'Requester unavailable'}
                </p>
                {requesterName && requesterEmail ? (
                  <p className="ats-approval-modal__requester-meta">{requesterEmail}</p>
                ) : null}
              </div>
            </div>
            <div className="ats-approval-modal__info-grid">
              <InfoItem label="Entity type" value={approval.entityType} />
              <InfoItem label="Status" value={approval.status} />
              <InfoItem label="Priority" value={approval.priority || 'Normal'} />
              {pendingStep?.dueDate ? (
                <InfoItem
                  label="Due date"
                  value={new Date(pendingStep.dueDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                />
              ) : (
                <InfoItem label="Current step" value={pendingStep?.stepName} />
              )}
              {approval.entityType === 'TaxRegimeChange' && (
                <>
                  <InfoItem label="Current tax regime" value={approval.metadata?.currentTaxRegime} />
                  <InfoItem label="Requested tax regime" value={approval.metadata?.requestedTaxRegime} />
                  {approval.metadata?.reason ? (
                    <div className="ats-approval-modal__info-item ats-approval-modal__info-item--wide">
                      <span className="ats-approval-modal__info-label">Reason</span>
                      <p className="ats-approval-modal__info-value">{approval.metadata.reason}</p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>

          {timelineEntries.length > 0 && (
            <section className="ats-approval-modal__section">
              <h3 className="ats-approval-modal__section-title">Request timeline</h3>
              <ul className="ats-approval-modal__timeline">
                {timelineEntries.map((entry) => (
                  <li key={entry.key} className="ats-approval-modal__timeline-item">
                    <span className="ats-approval-modal__timeline-dot" aria-hidden />
                    <div className="min-w-0">
                      <p className="ats-approval-modal__timeline-label">{entry.label}</p>
                      {entry.at ? (
                        <p className="ats-approval-modal__timeline-time">
                          {new Date(entry.at).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {steps.length > 0 && (
            <section className="ats-approval-modal__section">
              <h3 className="ats-approval-modal__section-title">Approval steps</h3>
              <div className="ats-approval-modal__steps">
                {steps.map((step, index) => {
                  const isPending = step.status === 'Pending';
                  const isApproved = step.status === 'Approved';
                  const isRejected = step.status === 'Rejected';
                  const isSkipped = step.status === 'Skipped';

                  return (
                    <div
                      key={`${step.stepName}-${index}`}
                      className={`ats-approval-modal__step ${
                        isPending ? 'ats-approval-modal__step--pending' :
                        isApproved ? 'ats-approval-modal__step--approved' :
                        isRejected ? 'ats-approval-modal__step--rejected' :
                        'ats-approval-modal__step--neutral'
                      }`}
                    >
                      <div className="ats-approval-modal__step-icon" aria-hidden>
                        {isApproved && <FiCheckCircle />}
                        {isRejected && <FiXCircle />}
                        {isPending && <FiClock />}
                        {isSkipped && <FiUser />}
                      </div>
                      <div className="ats-approval-modal__step-copy min-w-0">
                        <h4 className="ats-approval-modal__step-title">{step.stepName}</h4>
                        <p className="ats-approval-modal__step-sub">
                          Approver: {step.approverName || 'N/A'}
                        </p>
                        {step.comments ? (
                          <p className="ats-approval-modal__step-comment">&ldquo;{step.comments}&rdquo;</p>
                        ) : null}
                        {step.actionDate ? (
                          <p className="ats-approval-modal__step-time">
                            {new Date(step.actionDate).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                      <AtsBadge tone={stepTone(step.status)}>{step.status}</AtsBadge>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {pendingStep && (
            <section className="ats-approval-modal__section ats-approval-modal__section--action">
              <h3 className="ats-approval-modal__section-title">Your action</h3>

              {isRejecting ? (
                <div className="ats-approval-modal__reject-panel">
                  <label className="ats-approval-modal__reject-field">
                    <span className="ats-approval-modal__reject-label">
                      <FiAlertTriangle aria-hidden />
                      Rejection reason <span>*</span>
                    </span>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="cm-input w-full resize-none"
                      rows={3}
                      placeholder="Explain briefly for the requester…"
                      autoFocus
                    />
                  </label>
                  <div className="ats-approval-modal__reject-actions">
                    <CmButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsRejecting(false);
                        setRejectReason('');
                      }}
                    >
                      Cancel
                    </CmButton>
                    <CmButton
                      variant="outline"
                      size="sm"
                      className="ats-approval-modal__reject-btn"
                      disabled={!rejectReason.trim()}
                      onClick={handleRejectConfirm}
                    >
                      <FiXCircle className="h-4 w-4" />
                      Confirm reject
                    </CmButton>
                  </div>
                </div>
              ) : (
                <div className="ats-approval-modal__action-btns">
                  <CmButton variant="primary" onClick={handleApprove}>
                    <FiCheckCircle className="h-4 w-4" />
                    Approve
                  </CmButton>
                  <CmButton
                    variant="outline"
                    className="ats-approval-modal__reject-btn"
                    onClick={() => setIsRejecting(true)}
                  >
                    <FiXCircle className="h-4 w-4" />
                    Reject
                  </CmButton>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ApprovalDetailModal;
