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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600 mb-2 text-lg font-medium">{message}</p>
        {showProgress && (
          <div className="w-64 bg-gray-200 rounded-full h-1.5 mx-auto mt-4">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
              style={{ width: '60%' }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;

