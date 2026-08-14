import React, { useState } from 'react';
import { FiX, FiCheckCircle, FiXCircle, FiClock, FiUser } from 'react-icons/fi';
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
  const [comments, setComments] = useState('');
  const [action, setAction] = useState(null);

  const pendingStep = approval.currentPendingStep;
  const auditTrail = Array.isArray(approval.auditTrail) ? approval.auditTrail : [];
  const requesterName = approval.requestedBy?.name
    || approval.requestedBy?.fullName
    || [approval.requestedBy?.firstName, approval.requestedBy?.lastName].filter(Boolean).join(' ')
    || '—';

  const steps = approval.steps?.length
    ? approval.steps
    : approval.currentPendingStep
      ? [approval.currentPendingStep]
      : [];

  const handleSubmit = () => {
    if (!action) return;
    onAction(approval._id, pendingStep?.stepNumber, action, comments);
  };

  return (
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
              <AtsAvatar name={requesterName} />
              <div className="min-w-0">
                <span className="ats-approval-modal__info-label">Requested by</span>
                <p className="ats-approval-modal__requester-name">{requesterName}</p>
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

          {auditTrail.length > 0 && (
            <section className="ats-approval-modal__section">
              <h3 className="ats-approval-modal__section-title">Request timeline</h3>
              <ul className="ats-approval-modal__timeline">
                {auditTrail
                  .map((event, index) => {
                    const label = formatAuditTimelineEvent(event) || auditActionLabel(event);
                    if (!label) return null;
                    return (
                      <li key={`${event.action}-${index}`} className="ats-approval-modal__timeline-item">
                        <span className="ats-approval-modal__timeline-dot" aria-hidden />
                        <div className="min-w-0">
                          <p className="ats-approval-modal__timeline-label">{label}</p>
                          <p className="ats-approval-modal__timeline-time">
                            {event.at ? new Date(event.at).toLocaleString() : '—'}
                          </p>
                        </div>
                      </li>
                    );
                  })
                  .filter(Boolean)}
              </ul>
            </section>
          )}

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

          {pendingStep && (
            <section className="ats-approval-modal__section ats-approval-modal__section--action">
              <h3 className="ats-approval-modal__section-title">Your action</h3>
              <label className="ats-public-field">
                <span className="ats-form-label">Comments</span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="cm-input w-full resize-none"
                  rows={3}
                  placeholder="Add comments (optional)"
                />
              </label>

              <div className="ats-approval-modal__action-btns">
                <button
                  type="button"
                  onClick={() => setAction('Approve')}
                  className={`ats-approval-modal__action-choice ${action === 'Approve' ? 'ats-approval-modal__action-choice--approve-active' : ''}`}
                >
                  <FiCheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setAction('Reject')}
                  className={`ats-approval-modal__action-choice ${action === 'Reject' ? 'ats-approval-modal__action-choice--reject-active' : ''}`}
                >
                  <FiXCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>

              {action ? (
                <CmButton type="button" className="w-full" onClick={handleSubmit}>
                  Submit {action}
                </CmButton>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalDetailModal;
