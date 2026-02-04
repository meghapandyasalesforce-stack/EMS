import React from 'react';
import { FiX, FiCheckCircle, FiClock, FiUser } from 'react-icons/fi';

const WorkflowDetail = ({ workflow, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Workflow Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{workflow.name}</h3>
            <p className="text-gray-600">{workflow.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Entity Type</span>
              <p className="font-medium text-gray-900">{workflow.entityType}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Status</span>
              <p className={`font-medium ${workflow.isActive ? 'text-green-600' : 'text-gray-600'}`}>
                {workflow.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Approval Steps</h4>
            <div className="space-y-3">
              {workflow.steps?.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {step.stepNumber}
                    </div>
                    <h5 className="font-semibold text-gray-900">{step.stepName}</h5>
                  </div>
                  <div className="ml-11 space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">Approver:</span> {step.approverType}</p>
                    <p><span className="font-medium">Timeout:</span> {step.timeoutHours} hours</p>
                    <div className="flex items-center gap-4 mt-2">
                      {step.isRequired && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Required</span>
                      )}
                      {step.canDelegate && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Can Delegate</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDetail;

