import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiClock, FiEye, FiAlertTriangle } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AtsPage, AtsPageHeader, AtsEmpty, AtsBadge, AtsAvatar, CmButton } from '../../components/recruitment/atsUi';
import ApprovalDetailModal from './ApprovalDetailModal';

const approvalTitle = (approval) => {
  if (approval.entityType === 'TaxRegimeChange') return 'Tax Regime Change';
  return `${approval.entityType || 'Request'}`.replace(/([a-z])([A-Z])/g, '$1 $2');
};

const approvalKey = (approval) => (
  approval.taxRegimeRequestId ? `tax-${approval.taxRegimeRequestId}` : approval._id
);

const formatDueLabel = (dueDate) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Overdue', tone: 'error' };
  if (days === 0) return { label: 'Due today', tone: 'attention' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'attention' };
  return { label: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, tone: 'neutral' };
};

const PendingApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showEscalatedOnly, setShowEscalatedOnly] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('escalated') === '1') {
      setShowEscalatedOnly(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const [workflowRes, taxRegimeRes] = await Promise.all([
        axios.get('/v1/admin/approvals/my-pending'),
        axios.get('/v1/both/tax-regime-change/admin/pending').catch(() => ({ data: { data: [] } })),
      ]);

      const workflowApprovals = workflowRes.data?.data || [];
      const taxRegimeApprovals = taxRegimeRes.data?.data || [];

      const workflowTaxIds = new Set(
        workflowApprovals
          .filter((a) => a.entityType === 'TaxRegimeChange')
          .map((a) => String(a.entityId))
      );

      const directTaxCards = taxRegimeApprovals.filter(
        (item) => !workflowTaxIds.has(String(item.taxRegimeRequestId))
      );

      setApprovals([...directTaxCards, ...workflowApprovals]);
    } catch {
      toast.error('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const isDirectTaxRegime = (approval) =>
    Boolean(approval?.isDirectTaxRegimeRequest || approval?.taxRegimeRequestId);

  const handleAction = async (approval, stepNumber, action, comments = '') => {
    try {
      if (isDirectTaxRegime(approval) || approval?.entityType === 'TaxRegimeChange') {
        const requestId = approval.taxRegimeRequestId || approval.entityId || approval._id;
        if (action === 'Approve') {
          await axios.patch(`/v1/both/tax-regime-change/admin/approve/${requestId}`, {
            stepNumber,
            comments,
          });
        } else {
          await axios.patch(`/v1/both/tax-regime-change/admin/reject/${requestId}`, {
            stepNumber,
            comments,
            rejectionReason: comments,
          });
        }
      } else {
        await axios.post(`/v1/admin/approvals/process/${approval._id}`, {
          stepNumber,
          action,
          comments,
          ...(approval.hrOverrideAvailable ? { hrOverride: true } : {}),
          ...(approval.timeoutEscalationAvailable && !approval.hrOverrideAvailable
            ? { timeoutEscalation: true }
            : {}),
        });
      }
      toast.success(`Request ${action.toLowerCase()}ed successfully`);
      setRejectingId(null);
      setRejectReason('');
      fetchPendingApprovals();
      setShowDetail(false);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.warning(error.response?.data?.message || 'Request has already been processed');
      } else {
        toast.error(error.response?.data?.message || 'Failed to process approval');
      }
      fetchPendingApprovals();
    }
  };

  const handleRejectClick = (id) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const handleRejectConfirm = (approval, stepNumber) => {
    if (!rejectReason.trim()) {
      toast.warning('Please enter a rejection reason');
      return;
    }
    handleAction(approval, stepNumber, 'Reject', rejectReason.trim());
  };

  const filteredApprovals = useMemo(() => (
    showEscalatedOnly ? approvals.filter((approval) => approval.slaEscalated) : approvals
  ), [approvals, showEscalatedOnly]);

  const stats = useMemo(() => ({
    total: approvals.length,
    overdue: approvals.filter((a) => a.slaEscalated).length,
    urgent: approvals.filter((a) => a.priority === 'Urgent' || a.entityType === 'TaxRegimeChange').length,
  }), [approvals]);

  if (loading) {
    return (
      <AtsPage>
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingSpinner message="Loading pending approvals…" />
        </div>
      </AtsPage>
    );
  }

  return (
    <AtsPage className="ats-approvals-page">
      <AtsPageHeader
        eyebrow="Administration"
        title="Pending Approvals"
        subtitle="Review, approve, or reject requests waiting on your action."
        actions={(
          <div className="ats-segment" role="tablist" aria-label="Approval filter">
            <button
              type="button"
              role="tab"
              aria-selected={!showEscalatedOnly}
              className={`ats-segment__btn ${!showEscalatedOnly ? 'ats-segment__btn--active' : ''}`}
              onClick={() => setShowEscalatedOnly(false)}
            >
              All requests
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showEscalatedOnly}
              className={`ats-segment__btn ${showEscalatedOnly ? 'ats-segment__btn--active' : ''}`}
              onClick={() => setShowEscalatedOnly(true)}
            >
              Overdue
              {stats.overdue > 0 ? (
                <span className="ats-tab-count ats-tab-count--alert">{stats.overdue}</span>
              ) : null}
            </button>
          </div>
        )}
      />

      <div className="ats-kpi-strip">
        <div className="cm-stat">
          <span className="cm-stat__label">Pending</span>
          <span className="cm-stat__value">{stats.total}</span>
        </div>
        <div className="cm-stat">
          <span className="cm-stat__label">Overdue</span>
          <span className="cm-stat__value">{stats.overdue}</span>
        </div>
        <div className="cm-stat">
          <span className="cm-stat__label">High priority</span>
          <span className="cm-stat__value">{stats.urgent}</span>
        </div>
      </div>

      {filteredApprovals.length === 0 ? (
        <AtsEmpty
          icon={FaCheckCircle}
          title={showEscalatedOnly ? 'No overdue approvals' : 'No pending approvals'}
          hint={showEscalatedOnly
            ? 'No requests are currently past the review window.'
            : "You're all caught up — nothing needs your approval right now."}
        />
      ) : (
        <div className="ats-approvals-list">
          {filteredApprovals.map((approval) => {
            const pendingStep = approval.currentPendingStep;
            const cardKey = approvalKey(approval);
            const isUrgent = approval.priority === 'Urgent' || approval.entityType === 'TaxRegimeChange';
            const dueMeta = formatDueLabel(pendingStep?.dueDate);
            const requesterName = approval.requestedBy?.name || 'Unknown requester';

            return (
              <article
                key={cardKey}
                className={`ats-approval-card ${isUrgent ? 'ats-approval-card--urgent' : ''} ${approval.slaEscalated ? 'ats-approval-card--overdue' : ''}`}
              >
                <div className="ats-approval-card__main">
                  <div className="ats-approval-card__identity">
                    <AtsAvatar name={requesterName} />
                    <div className="min-w-0">
                      <div className="ats-approval-card__title-row">
                        <h3 className="ats-approval-card__title">{approvalTitle(approval)}</h3>
                        {isUrgent ? <AtsBadge tone="attention">High priority</AtsBadge> : null}
                        {approval.slaEscalated ? <AtsBadge tone="error">Overdue</AtsBadge> : null}
                        {dueMeta?.tone === 'attention' ? <AtsBadge tone="pending">{dueMeta.label}</AtsBadge> : null}
                      </div>
                      <p className="ats-approval-card__requester">
                        Requested by <span>{requesterName}</span>
                      </p>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {approval.entityType === 'TaxRegimeChange'
                          ? 'Tax Regime Change Request'
                          : `${approval.entityType} Request`}
                      </h3>
                      {isUrgent && (
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          {approval.entityType === 'TaxRegimeChange' ? 'High' : 'Urgent'}
                        </span>
                      )}
                      {approval.slaEscalated && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          {approval.timeoutEscalationAvailable
                            ? 'Timed out — you may act'
                            : 'Timed out'}
                        </span>
                      )}
                      {daysPending !== null && daysPending < 1 && !approval.slaEscalated && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          Due Soon
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ats-approval-card__meta">
                    {approval.entityType === 'TaxRegimeChange' && (
                      <div className="ats-approval-card__meta-row">
                        <span className="ats-approval-card__meta-label">Tax regime</span>
                        <span className="ats-approval-card__meta-value">
                          {approval.metadata?.currentTaxRegime || '—'}
                          {' → '}
                          {approval.metadata?.requestedTaxRegime || 'N/A'}
                        </span>
                      </div>
                    )}
                    {pendingStep && (
                      <>
                        <div className="ats-approval-card__meta-row">
                          <span className="ats-approval-card__meta-label">Current step</span>
                          <span className="ats-approval-card__meta-value">{pendingStep.stepName}</span>
                        </div>
                        {pendingStep.dueDate && (
                          <div className="ats-approval-card__meta-row">
                            <span className="ats-approval-card__meta-label">Due date</span>
                            <span className={`ats-approval-card__meta-value ${dueMeta?.tone === 'error' ? 'ats-approval-card__meta-value--urgent' : ''}`}>
                              <FiClock aria-hidden />
                              {new Date(pendingStep.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                              {dueMeta ? ` · ${dueMeta.label}` : ''}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {approval.priority && approval.priority !== 'Normal' && (
                      <div className="ats-approval-card__meta-row">
                        <span className="ats-approval-card__meta-label">Priority</span>
                        <span className="ats-approval-card__meta-value">{approval.priority}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ats-approval-card__actions">
                  <CmButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleAction(approval, pendingStep?.stepNumber, 'Approve')}
                  >
                    <FiCheckCircle className="h-4 w-4" />
                    Approve
                  </CmButton>
                  <CmButton
                    variant="outline"
                    size="sm"
                    className="ats-approval-card__reject-btn"
                    onClick={() => handleRejectClick(cardKey)}
                  >
                    <FiXCircle className="h-4 w-4" />
                    Reject
                  </CmButton>
                  <button
                    type="button"
                    className="ats-approval-card__view"
                    title="View details"
                    aria-label="View details"
                    onClick={() => {
                      setSelectedApproval(approval);
                      setShowDetail(true);
                    }}
                  >
                    <FiEye className="h-4 w-4" />
                  </button>
                </div>

                {rejectingId === cardKey && (
                  <div className="ats-approval-card__reject-panel">
                    <p className="ats-approval-card__reject-label">
                      <FiAlertTriangle aria-hidden />
                      Rejection reason <span>*</span>
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain briefly for the requester…"
                      rows={3}
                      className="cm-input w-full resize-none"
                      autoFocus
                    />
                    <div className="ats-approval-card__reject-actions">
                      <CmButton
                        variant="ghost"
                        size="sm"
                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      >
                        Cancel
                      </CmButton>
                      <CmButton
                        variant="outline"
                        size="sm"
                        className="ats-approval-card__reject-btn"
                        onClick={() => handleRejectConfirm(approval, pendingStep?.stepNumber)}
                      >
                        <FiXCircle className="h-4 w-4" />
                        Confirm reject
                      </CmButton>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {filteredApprovals.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              {showEscalatedOnly ? 'No overdue approvals' : 'No pending approvals'}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {showEscalatedOnly
                ? 'No requests are currently past their step timeout.'
                : "You're all caught up!"}
            </p>
          </div>
        )}
      </div>
      </div>
      </div>

      {showDetail && selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => {
            setShowDetail(false);
            setSelectedApproval(null);
          }}
          onAction={(approvalId, stepNumber, action, comments) =>
            handleAction(selectedApproval, stepNumber, action, comments)
          }
        />
      )}
    </AtsPage>
  );
};

export default PendingApprovals;
