import { PERMISSIONS } from '../config/permissions.constants.js';
import { hasAnyPermission } from './permissionService.js';

/**
 * Org admin or HR staff may deactivate, terminate, or delete employees.
 */
export function canManageEmployeeLifecycle(req) {
    const ctx = req.authContext;
    const jwtRole = (req.decoded?.role || req.user?.role || '').toLowerCase();

    if (ctx?.isOrgOwner) return true;
    if (jwtRole === 'admin') return true;
    if (ctx?.isHrManager || ctx?.isHrExecutive) return true;

    return hasAnyPermission(ctx, [
        PERMISSIONS.EMPLOYEE_EDIT,
        PERMISSIONS.EMPLOYEE_DELETE,
    ]);
}
