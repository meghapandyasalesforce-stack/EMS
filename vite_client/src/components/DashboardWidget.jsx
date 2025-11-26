import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable Dashboard Widget Component
 * Allows for customizable dashboard widgets
 */
const DashboardWidget = ({
  title,
  children,
  icon,
  color = 'blue',
  className = '',
  actions,
  onRefresh,
  loading = false,
  error = null,
}) => {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
    red: 'border-red-500 bg-red-50',
    indigo: 'border-indigo-500 bg-indigo-50',
    gray: 'border-gray-500 bg-gray-50',
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${colors} ${className}`}>
      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`p-2 rounded-lg ${colors.split(' ')[1]}`}>
              {icon}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {actions}
        </div>
      </div>

      {/* Widget Content */}
      <div className="widget-content">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {!loading && !error && children}
      </div>
    </div>
  );
};

DashboardWidget.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  icon: PropTypes.node,
  color: PropTypes.oneOf(['blue', 'green', 'yellow', 'purple', 'orange', 'red', 'indigo', 'gray']),
  className: PropTypes.string,
  actions: PropTypes.node,
  onRefresh: PropTypes.func,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

export default DashboardWidget;

