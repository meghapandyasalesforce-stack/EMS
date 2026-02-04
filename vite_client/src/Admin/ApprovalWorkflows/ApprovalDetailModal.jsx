import React, { useState } from 'react';
import { FiX, FiCheckCircle, FiXCircle, FiClock, FiUser } from 'react-icons/fi';

const ApprovalDetailModal = ({ approval, onClose, onAction }) => {
  const [comments, setComments] = useState('');
  const [action, setAction] = useState(null);

  const pendingStep = approval.currentPendingStep;

  const handleSubmit = () => {
    if (!action) return;
    onAction(approval._id, pendingStep?.stepNumber, action, comments);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Approval Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Request Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Entity Type</span>
                <p className="font-medium text-gray-900">{approval.entityType}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Requested By</span>
                <p className="font-medium text-gray-900">{approval.requestedBy?.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Priority</span>
                <p className={`font-medium ${
                  approval.priority === 'Urgent' ? 'text-red-600' :
                  approval.priority === 'High' ? 'text-orange-600' : 'text-gray-900'
                }`}>
                  {approval.priority}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <p className="font-medium text-gray-900">{approval.status}</p>
              </div>
            </div>
          </div>

          {/* Steps Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Steps</h3>
            <div className="space-y-3">
              {approval.steps?.map((step, index) => {
                const isPending = step.status === 'Pending';
                const isApproved = step.status === 'Approved';
                const isRejected = step.status === 'Rejected';

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      isPending ? 'border-blue-300 bg-blue-50' :
                      isApproved ? 'border-green-300 bg-green-50' :
                      isRejected ? 'border-red-300 bg-red-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {isApproved && <FiCheckCircle className="w-5 h-5 text-green-600" />}
                      {isRejected && <FiXCircle className="w-5 h-5 text-red-600" />}
                      {isPending && <FiClock className="w-5 h-5 text-blue-600" />}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{step.stepName}</h4>
                        <p className="text-sm text-gray-600">Approver: {step.approverName || 'N/A'}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isApproved ? 'bg-green-100 text-green-800' :
                        isRejected ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {step.status}
                      </span>
                    </div>
                    {step.comments && (
                      <p className="text-sm text-gray-600 mt-2 italic">"{step.comments}"</p>
                    )}
                    {step.actionDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(step.actionDate).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Section */}
          {pendingStep && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Action</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Add comments (optional)"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setAction('Approve')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                      action === 'Approve'
                        ? 'bg-green-600 text-white'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <FiCheckCircle className="w-5 h-5" />
                    Approve
                  </button>
                  <button
                    onClick={() => setAction('Reject')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                      action === 'Reject'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <FiXCircle className="w-5 h-5" />
                    Reject
                  </button>
                </div>

                {action && (
                  <button
                    onClick={handleSubmit}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Submit {action}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalDetailModal;

