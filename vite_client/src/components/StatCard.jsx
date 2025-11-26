import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable StatCard component for displaying statistics in dashboards
 * @param {string} label - Label text for the stat
 * @param {string|number} value - Value to display
 * @param {React.ReactNode} icon - Icon component to display
 * @param {string} color - Color theme (blue, green, yellow, purple, orange, red, indigo, gray)
 * @param {string} subtitle - Optional subtitle text
 * @param {string} className - Additional CSS classes
 * @param {function} onClick - Optional click handler
 */
const StatCard = ({ 
  label, 
  value, 
  icon, 
  color = 'blue', 
  subtitle, 
  className = '',
  onClick 
}) => {
  const colorClasses = {
    blue: {
      border: 'border-blue-500',
      bg: 'bg-blue-100',
      text: 'text-blue-600',
    },
    green: {
      border: 'border-green-500',
      bg: 'bg-green-100',
      text: 'text-green-600',
    },
    yellow: {
      border: 'border-yellow-500',
      bg: 'bg-yellow-100',
      text: 'text-yellow-600',
    },
    purple: {
      border: 'border-purple-500',
      bg: 'bg-purple-100',
      text: 'text-purple-600',
    },
    orange: {
      border: 'border-orange-500',
      bg: 'bg-orange-100',
      text: 'text-orange-600',
    },
    red: {
      border: 'border-red-500',
      bg: 'bg-red-100',
      text: 'text-red-600',
    },
    indigo: {
      border: 'border-indigo-500',
      bg: 'bg-indigo-100',
      text: 'text-indigo-600',
    },
    gray: {
      border: 'border-gray-500',
      bg: 'bg-gray-100',
      text: 'text-gray-600',
    },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div 
      className={`bg-white rounded-lg shadow-md p-4 md:p-6 border-l-4 ${colors.border} hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium">{label}</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mt-2">
            {value}
          </p>
          {subtitle && (
            <p className={`text-sm mt-1 ${subtitle.includes('active') || subtitle.includes('completed') || subtitle.includes('green') ? 'text-green-600' : 'text-gray-500'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`${colors.bg} p-2 md:p-3 rounded-full ml-4 flex-shrink-0`}>
            <div className={colors.text}>
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.oneOf(['blue', 'green', 'yellow', 'purple', 'orange', 'red', 'indigo', 'gray']),
  subtitle: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

export default StatCard;

