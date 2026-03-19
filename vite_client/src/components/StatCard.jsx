import React from 'react';
import PropTypes from 'prop-types';
import { FaCheckCircle } from 'react-icons/fa';

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
  color = 'primary', 
  subtitle, 
  className = '',
  onClick 
}) => {
  const colorClasses = {
    primary: { border: 'border-theme-primary', bg: 'bg-theme-primary/10', text: 'text-theme-primary' },
    secondary: { border: 'border-theme-secondary', bg: 'bg-theme-secondary/10', text: 'text-theme-secondary' },
    accent: { border: 'border-theme-accent', bg: 'bg-theme-accent/10', text: 'text-theme-accent' },
    blue: {
      border: 'border-theme-secondary',
      bg: 'bg-theme-secondary/10',
      text: 'text-theme-secondary',
    },
    green: {
      border: 'border-theme-primary',
      bg: 'bg-theme-primary/10',
      text: 'text-theme-primary',
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
      text: 'text-theme-accent',
    },
    gray: {
      border: 'border-gray-500',
      bg: 'bg-gray-100',
      text: 'text-gray-600',
    },
  };

  const colors = colorClasses[color] || colorClasses.primary;

  const isHighlighted = className.includes('border-purple-500');
  
  // Theme and gradient backgrounds for icons
  const gradientClasses = {
    primary: 'bg-theme-primary',
    secondary: 'bg-theme-secondary',
    accent: 'bg-theme-accent',
    blue: 'bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-secondary)]',
    green: 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)]',
    yellow: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
    purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
    red: 'bg-gradient-to-br from-red-400 to-red-600',
    indigo: 'bg-theme-accent',
    gray: 'bg-gradient-to-br from-gray-400 to-gray-600',
  };

  const iconGradient = gradientClasses[color] || gradientClasses.primary;

  return (
    <div 
      className={`modern-card p-5 md:p-6 border-l-4 ${isHighlighted ? 'border-purple-500 border-2 ring-2 ring-purple-200' : colors.border} ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className} ${isHighlighted ? 'relative' : ''} animate-fadeIn`}
      onClick={onClick}
      style={{
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {icon && (
            <div className={`${iconGradient} p-3.5 rounded-xl flex-shrink-0 shadow-lg transform transition-transform hover:scale-110`}>
              <div className="text-white">
                {icon}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1.5">{label}</p>
            <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              {value}
            </p>
            {subtitle && (
              <p className={`text-xs md:text-sm mt-2 font-medium ${subtitle.includes('active') || subtitle.includes('completed') || subtitle.includes('green') ? 'text-theme-primary' : 'text-gray-500'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {isHighlighted && (
          <div className="ml-4 flex-shrink-0 animate-pulse">
            <div className="bg-purple-100 p-2 rounded-full">
              <FaCheckCircle className="w-5 h-5 text-purple-600" />
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
  color: PropTypes.oneOf(['primary', 'secondary', 'accent', 'blue', 'green', 'yellow', 'purple', 'orange', 'red', 'indigo', 'gray']),
  subtitle: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

export default StatCard;

