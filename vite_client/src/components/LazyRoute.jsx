import React, { Suspense } from 'react';
import RouteErrorBoundary from './RouteErrorBoundary';
import LoadingSpinner from './LoadingSpinner';

/**
 * LazyRoute Component
 * Wraps lazy-loaded routes with Suspense and Error Boundary
 * @param {React.Component} Component - Lazy-loaded component
 * @param {string} loadingMessage - Message to show while loading
 */
const LazyRoute = ({ Component, loadingMessage = 'Loading...' }) => {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LoadingSpinner message={loadingMessage} />}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
  );
};

export default LazyRoute;

