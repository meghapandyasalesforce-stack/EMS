import React from 'react';
import useAuthPermissions from '../Hooks/useAuthPermissions';

/**
 * Renders children only when the user holds any of the required permissions.
 */
const PermissionGate = ({ permissions: required = [], children, fallback = null }) => {
  const { hasAnyPermission, isOrgOwner } = useAuthPermissions();

  if (!required.length) {
    return <>{children}</>;
  }

  if (isOrgOwner || hasAnyPermission(required)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default PermissionGate;
