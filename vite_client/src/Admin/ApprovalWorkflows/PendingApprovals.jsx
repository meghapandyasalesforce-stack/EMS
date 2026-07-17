import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiClock, FiEye } from 'react-icons/fi';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import ApprovalDetailModal from './ApprovalDetailModal';

const PendingApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/v1/admin/approvals/my-pending');
      setApprovals(response.data?.data || []);
    } catch (error) {
      toast.error('Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (approvalId, stepNumber, action, comments = '') => {
    try {
      await axios.post(`/v1/admin/approvals/process/${approvalId}`, {
        stepNumber,
        action,
        comments
      });
      toast.success(`Request ${action.toLowerCase()}ed successfully`);
      setRejectingId(null);
      setRejectReason('');
      fetchPendingApprovals();
      setShowDetail(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process approval');
    }
  };

  const handleRejectClick = (approvalId) => {
    setRejectingId(approvalId);
    setRejectReason('');
  };

  const handleRejectConfirm = (approvalId, stepNumber) => {
    if (!rejectReason.trim()) {
      toast.warning('Please enter a rejection reason');
      return;
    }
    handleAction(approvalId, stepNumber, 'Reject', rejectReason.trim());
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="page-shell">
      <div className="page-shell-inner">
      <div className="hrms-stack">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
          <p className="text-lg text-gray-600">Review and approve pending requests</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {approvals.map((approval) => {
            const pendingStep = approval.currentPendingStep;
            const isUrgent = approval.priority === 'Urgent';
            const daysPending = pendingStep?.dueDate
              ? Math.floor((new Date(pendingStep.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={approval._id}
                className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 ${
                  isUrgent ? 'border-l-4 border-red-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {approval.entityType} Request
                      </h3>
                      {isUrgent && (
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          Urgent
                        </span>
                      )}
                      {daysPending !== null && daysPending < 1 && (
                        <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          Due Soon
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">
                      Requested by: <span className="font-medium">{approval.requestedBy?.name}</span>
                    </p>
                    {pendingStep && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FiClock className="w-4 h-4" />
                        <span>Step: {pendingStep.stepName}</span>
                        {pendingStep.dueDate && (
                          <span>• Due: {new Date(pendingStep.dueDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedApproval(approval);
                        setShowDetail(true);
                      }}
                      className="p-2 text-gray-600 hover:text-theme-secondary hover:bg-theme-secondary/10 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <FiEye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleAction(approval._id, pendingStep?.stepNumber, 'Approve')}
                      className="flex items-center gap-2 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors font-medium"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectClick(approval._id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <FiXCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              {rejectingId === approval._id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Rejection reason <span className="text-red-500">*</span></p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain briefly for the requester…"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectConfirm(approval._id, pendingStep?.stepNumber)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FiXCircle className="w-4 h-4" />
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>

        {approvals.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No pending approvals</p>
            <p className="text-gray-500 text-sm mt-2">You're all caught up!</p>
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
          onAction={handleAction}
        />
      )}
    </div>
  );
};

export default PendingApprovals;

