import React from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

const SLAViolations = ({ violations, onRefresh }) => {
  const getViolationIcon = (violation) => {
    if (violation.status === 'Resolved') return <FiCheckCircle className="w-5 h-5 text-green-600" />;
    if (violation.status === 'Active') return <FiAlertTriangle className="w-5 h-5 text-red-600" />;
    return <FiClock className="w-5 h-5 text-gray-600" />;
  };

  const getViolationColor = (violation) => {
    if (violation.status === 'Resolved') return 'bg-green-50 border-green-200';
    if (violation.status === 'Active') return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="space-y-4">
      {violations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-md">
          <FiCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No violations found</p>
        </div>
      ) : (
        violations.map((violation) => (
          <div
            key={violation._id}
            className={`border rounded-xl p-6 ${getViolationColor(violation)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="mt-1">
                  {getViolationIcon(violation)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {violation.entityType} Violation
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      violation.status === 'Active' ? 'bg-red-100 text-red-800' :
                      violation.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {violation.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    SLA: {violation.slaId?.name || 'N/A'}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Violation Type:</span>
                      <p className="font-medium text-gray-900">{violation.violationType}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Current Level:</span>
                      <p className="font-medium text-gray-900">{violation.currentLevel}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Response Target:</span>
                      <p className="font-medium text-gray-900">
                        {violation.responseTime?.target
                          ? new Date(violation.responseTime.target).toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Resolution Target:</span>
                      <p className="font-medium text-gray-900">
                        {violation.resolutionTime?.target
                          ? new Date(violation.resolutionTime.target).toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {violation.escalatedTo && violation.escalatedTo.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Escalations:</p>
                      <div className="space-y-2">
                        {violation.escalatedTo.map((escalation, idx) => (
                          <div key={idx} className="text-xs text-gray-600">
                            Level {escalation.level} - {formatDistanceToNow(new Date(escalation.escalatedAt), { addSuffix: true })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SLAViolations;

