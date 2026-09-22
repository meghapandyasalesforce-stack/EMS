import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import { isManager, isHR } from '../utils/managerHelper';
import { isProjectManager } from '../utils/projectManagerHelper';
import { isExecutive } from '../utils/navigationConfig';
import { getDefaultDashboardRoute } from '../utils/dashboardRedirect';
import { canAccess } from '../utils/permissions';
import { featureKeyForPath, isSaasFeatureEnabled } from '../constants/saasFeatures';

/**
 * Protects routes by RBAC permissions (preferred) or legacy role strings.
 */
const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  redirectTo,
  orgOwnerOnly = false,
  requiredFeature,
}) => {
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const authChecked = useSelector((state) => state.auth.authChecked);
  const permissions = useSelector((state) => state.auth.permissions) || [];
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const saasFeatures = useSelector((state) => state.auth.saasFeatures) || {};
  const employee = useSelector((state) => state.employeeDetails.employee);

  if (!authChecked) {
    return <LoadingSpinner message="Checking permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (orgOwnerOnly && !permissionFlags.isOrgOwner) {
    return (
      <Navigate
        to={redirectTo || getDefaultDashboardRoute(user, employee)}
        replace
      />
    );
  }

  const userRole = user?.role || employee?.role || 'employee';
  const isAdmin = userRole === 'admin';
  const userObj = user || employee;
  const userIsManager = isManager(userObj);
  const userIsProjectManager = isProjectManager(userObj);
  const userIsHR = isHR(userObj);
  const position = (userObj?.position || '').toLowerCase().trim();
  const userIsExecutive = isExecutive(position);

  const department = (userObj?.department || '').toLowerCase().trim();
  const isFinanceDept =
    department === 'finance' ||
    department.includes('finance') ||
    department === 'accounting';
  const isTechDept =
    department === 'technology' ||
    department === 'tech' ||
    department.includes('technology') ||
    department === 'it' ||
    (department.includes('it') && !department.includes('support'));

  const effectiveRoles = [];
  if (isAdmin) effectiveRoles.push('admin');
  if (userIsManager) effectiveRoles.push('manager');
  if (userIsProjectManager) effectiveRoles.push('project_manager');
  if (userIsHR) effectiveRoles.push('hr');
  if (userIsExecutive) effectiveRoles.push('executive');
  if (isFinanceDept) effectiveRoles.push('finance');
  if (isTechDept) effectiveRoles.push('tech');
  effectiveRoles.push('employee');

  const hasAccess = canAccess(permissions, requiredPermissions, {
    isOrgOwner: !!permissionFlags.isOrgOwner,
    allowedRoles,
    effectiveRoles,
  });

  const isHrOnlyRoute =
    allowedRoles.length === 1 &&
    allowedRoles[0] === 'hr' &&
    requiredPermissions.length === 0;

  if (hasAccess && isHrOnlyRoute && isAdmin && !userIsHR) {
    return (
      <Navigate
        to={redirectTo || '/employee/documents-id'}
        replace
      />
    );
  }

  if (!hasAccess) {
    const targetRedirect =
      redirectTo != null && redirectTo !== '' && redirectTo !== '/dashboard'
        ? redirectTo
        : getDefaultDashboardRoute(user, employee);
    return <Navigate to={targetRedirect} replace />;
  }

  const featureKey = requiredFeature || featureKeyForPath(location.pathname);
  if (!isSaasFeatureEnabled(saasFeatures, featureKey)) {
    return (
      <Navigate
        to={redirectTo || getDefaultDashboardRoute(user, employee)}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
