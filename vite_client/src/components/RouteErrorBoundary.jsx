import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Route-level Error Boundary
 * Catches errors in route components and displays a fallback UI
 */
const RouteErrorBoundary = ({ children, fallback }) => {
  // Create a fallback function that handles both function and JSX fallbacks
  const fallbackFunction = fallback 
    ? (error, handleReset) => {
        // If fallback is already a function, call it
        if (typeof fallback === 'function') {
          return fallback(error, handleReset);
        }
        // If fallback is JSX, return it directly
        return fallback;
      }
    : (error, handleReset) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center max-w-lg px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-2">
              An error occurred while loading this page.
            </p>
            {error?.message && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-xs font-mono text-red-800 break-all">
                {String(error.message)}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-theme-secondary text-white rounded hover:bg-theme-primary"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );

  return (
    <ErrorBoundary fallback={fallbackFunction}>
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;

