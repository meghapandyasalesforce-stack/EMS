import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import { getSessionPortalDashboard, isDashboardPath } from '../utils/portalConfig';
import {
  dashboardSessionUserKey,
  hasInitialDashboardRedirect,
  markInitialDashboardRedirect,
} from '../utils/initialDashboardSession';

/** Runs after ProtectedRoute's authentication, permission and plan checks. */
export default function InitialDashboardRedirect({ children }) {
  const user = useSelector((state) => state.auth.user);
  const auth = useSelector((state) => state.auth);
  const employee = useSelector((state) => state.employeeDetails.employee);
  const location = useLocation();
  const navigate = useNavigate();
  const portal = getSessionPortalDashboard({ ...auth, employee });
  const portalId = portal?.id;
  const dashboard = portal?.home || '/dashboard';
  const userKey = dashboardSessionUserKey(user, portalId);
  const alreadyRedirected = hasInitialDashboardRedirect(user, portalId);
  // Preserve mandatory onboarding; its existing flow clears this flag itself.
  let completingOnboarding = false;
  try {
    completingOnboarding = sessionStorage.getItem('redirectToOfferLetterOnLogin') === '1';
  } catch {
    // Browsers may restrict session storage.
  }
  const needsRedirect = Boolean(userKey && !alreadyRedirected && !completingOnboarding);
  const wrongDashboard = Boolean(portal && isDashboardPath(location.pathname)
    && location.pathname !== '/dashboard' && location.pathname !== dashboard && !completingOnboarding);

  useEffect(() => {
    if (!needsRedirect && !wrongDashboard) return;
    // Record the attempt before navigating, so remounts, StrictMode and permission
    // fallback redirects cannot loop. This flag is navigation state, never authorization.
    markInitialDashboardRedirect(user, portalId);
    if (location.pathname !== dashboard) {
      navigate(dashboard, { replace: true });
    }
  }, [needsRedirect, wrongDashboard, user, portalId, dashboard, location.pathname, navigate]);

  if ((needsRedirect || wrongDashboard) && location.pathname !== dashboard) {
    return <LoadingSpinner message="Opening your dashboard..." />;
  }
  return <>{children}</>;
}
