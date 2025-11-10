import React from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Route-level Error Boundary
 * Catches errors in route components and displays a fallback UI
 */
const RouteErrorBoundary = ({ children, fallback }) => {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                An error occurred while loading this page.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Go to Home
              </button>
            </div>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;

