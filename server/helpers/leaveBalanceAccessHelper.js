import Employee from '../models/employee.model.js';
import { isEmployeeLinkedToManager } from './managerHelper.js';
import { PERMISSIONS } from '../config/permissions.constants.js';
import { resolveAuthContext, hasAnyPermission } from './permissionService.js';

/**
 * Who may view / manually adjust an employee's leave balance.
 * - View: self, org admin, HR, executive, or direct line manager
 * - Adjust: org admin, HR, executive, or direct line manager (not self)
 */
export async function resolveEmployeeLeaveBalanceAccess(req, targetEmployeeId, { forAdjust = false } = {}) {
    const organizationId =
        req.organizationId || req.user?.organizationId || req.employee?.organizationId;

    if (!organizationId) {
        return { ok: false, status: 400, message: 'Organization ID is required', canAdjust: false };
    }

    const targetId = String(targetEmployeeId || '');
    const viewerEmployeeId = String(req.employee?._id || '');
    const jwtRole = (req.decoded?.role || req.user?.role || '').toLowerCase();

    if (!targetId) {
        return { ok: false, status: 400, message: 'Employee ID is required', canAdjust: false };
    }

    const ctx = req.authContext || (req.decoded ? await resolveAuthContext(req.decoded, req) : null);

    const isOrgAdmin = jwtRole === 'admin' || Boolean(ctx?.isOrgOwner);
    const isHrStaff = Boolean(
        ctx?.isHrManager ||
        ctx?.isHrExecutive ||
        ctx?.buckets?.includes('hr_manager') ||
        ctx?.buckets?.includes('hr_executive') ||
        hasAnyPermission(ctx, [PERMISSIONS.LEAVE_POLICY_MANAGE])
    );
    const isExecutive = Boolean(ctx?.isExecutive || ctx?.buckets?.includes('executive'));

    const isSelf = viewerEmployeeId && viewerEmployeeId === targetId;

    if (isSelf && !forAdjust) {
        return { ok: true, canAdjust: false, role: 'self' };
    }

    if (forAdjust && isSelf) {
        return {
            ok: false,
            status: 403,
            message: 'You cannot manually adjust your own leave balance. Contact HR or your manager.',
            canAdjust: false,
        };
    }

    if (isOrgAdmin || isHrStaff || isExecutive) {
        return { ok: true, canAdjust: true, role: isOrgAdmin ? 'admin' : isHrStaff ? 'hr' : 'executive' };
    }

    if (req.employee?._id) {
        const target = await Employee.findOne({
            _id: targetEmployeeId,
            organizationId,
        })
            .select('_id managerId manager organizationId')
            .lean();

        if (!target) {
            return { ok: false, status: 404, message: 'Employee not found', canAdjust: false };
        }

        if (isEmployeeLinkedToManager(target, req.employee)) {
            return { ok: true, canAdjust: true, role: 'manager' };
        }
    }

    return {
        ok: false,
        status: 403,
        message: forAdjust
            ? 'Only HR, admin, or this employee’s direct manager can adjust leave balances.'
            : 'Access denied. You can only view leave balances for your team or with HR/admin access.',
        canAdjust: false,
    };
}
