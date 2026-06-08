import { useSelector } from 'react-redux';
import { hasAnyPermission, hasPermission } from '../utils/permissions';

/**
 * Read permissions from auth slice (populated at login / permissions API).
 */
export const useAuthPermissions = () => {
  const permissions = useSelector((state) => state.auth.permissions) || [];
  const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];
  const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
  const dataScope = useSelector((state) => state.auth.dataScope) || 'self';

  return {
    permissions,
    roleBuckets,
    permissionFlags,
    dataScope,
    hasPermission: (key) =>
      permissionFlags.isOrgOwner || hasPermission(permissions, key),
    hasAnyPermission: (keys) =>
      hasAnyPermission(permissions, keys, { isOrgOwner: !!permissionFlags.isOrgOwner }),
    isOrgOwner: !!permissionFlags.isOrgOwner,
    isHrManager: !!permissionFlags.isHrManager,
    isHrExecutive: !!permissionFlags.isHrExecutive,
    isPayrollAdmin: !!permissionFlags.isPayrollAdmin,
    isLineManager: !!permissionFlags.isLineManager,
    isExecutive: !!permissionFlags.isExecutive,
  };
};

export default useAuthPermissions;
