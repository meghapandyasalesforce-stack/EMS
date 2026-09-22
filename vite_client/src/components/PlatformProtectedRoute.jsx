import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';

/**
 * Protects SaaS platform control-panel routes.
 */
const PlatformProtectedRoute = ({ children }) => {
  const user = useSelector((state) => state.platform.user);
  const sessionChecked = useSelector((state) => state.platform.sessionChecked);

  if (!sessionChecked) {
    return <LoadingSpinner message="Checking platform session..." />;
  }

  if (!user) {
    return <Navigate to="/platform/login" replace />;
  }

  return children;
};

export default PlatformProtectedRoute;
