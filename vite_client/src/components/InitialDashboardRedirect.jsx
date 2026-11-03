import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import {
  dashboardSessionUserKey,
  hasInitialDashboardRedirect,
  markInitialDashboardRedirect,
} from '../utils/initialDashboardSession';

/** Runs after ProtectedRoute's authentication, permission and plan checks. */
export default function InitialDashboardRedirect({ children }) {
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  const navigate = useNavigate();
  const userKey = dashboardSessionUserKey(user);
  const alreadyRedirected = hasInitialDashboardRedirect(user);
  // Preserve mandatory onboarding; its existing flow clears this flag itself.
  let completingOnboarding = false;
  try {
    completingOnboarding = sessionStorage.getItem('redirectToOfferLetterOnLogin') === '1';
  } catch {
    // Browsers may restrict session storage.
  }
  const needsRedirect = Boolean(userKey && !alreadyRedirected && !completingOnboarding);

  useEffect(() => {
    if (!needsRedirect || hasInitialDashboardRedirect(user)) return;
    // Record the attempt before navigating, so remounts, StrictMode and permission
    // fallback redirects cannot loop. This flag is navigation state, never authorization.
    markInitialDashboardRedirect(user);
    if (location.pathname !== '/dashboard') {
      // RoleBasedDashboard owns role/server routing; do not duplicate its policy here.
      navigate('/dashboard', { replace: true });
    }
  }, [needsRedirect, user, location.pathname, navigate]);

  if (needsRedirect && location.pathname !== '/dashboard') {
    return <LoadingSpinner message="Opening your dashboard..." />;
  }
  return <>{children}</>;
}
