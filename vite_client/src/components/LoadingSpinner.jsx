import React from 'react';

/**
 * Loading Spinner Component
 * Used for lazy-loaded route loading states
 * 
 * @param {string} message - Loading message to display
 * @param {boolean} showProgress - Whether to show progress bar
 */
const LoadingSpinner = ({ message = 'Loading...', showProgress = false }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-soft)]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary mb-4" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
        <p className="text-[var(--color-text)] mb-2 text-lg font-medium opacity-80">{message}</p>
        {showProgress && (
          <div className="w-64 bg-gray-200 rounded-full h-1.5 mx-auto mt-4">
            <div 
              className="h-1.5 rounded-full transition-all duration-300 bg-theme-primary" 
              style={{ width: '60%', backgroundColor: 'var(--color-primary)' }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;

