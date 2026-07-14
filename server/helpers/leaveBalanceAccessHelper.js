import Employee from '../models/employee.model.js';
import { isEmployeeLinkedToManager } from './managerHelper.js';
import { PERMISSIONS } from '../config/permissions.constants.js';
import { resolveAuthContext, hasAnyPermission } from './permissionService.js';
import {
    getEffectiveFunctionalRoles,
    isHrStaffEmployee,
} from './functionalRolesHelper.js';

/**
 * Canonical organizationId for leave balance reads/writes.
 * Always falls back to the target employee's organization when the request context omits it.
 */
export async function resolveLeaveBalanceOrganizationId(employeeId, organizationIdHint) {
    const hint = organizationIdHint || null;
    if (hint) return hint;
    if (!employeeId) return null;
    const targetEmployee = await Employee.findById(employeeId).select('organizationId').lean();
    return targetEmployee?.organizationId || null;
}

const EXECUTIVE_ROLE_KEYS = new Set(['executive', 'ceo', 'cto', 'cfo', 'vp']);

function isExecutiveEmployee(employee) {
    if (!employee) return false;
    return getEffectiveFunctionalRoles(employee).some((role) => EXECUTIVE_ROLE_KEYS.has(role));
}

/**
 * Who may view / manually adjust an employee's leave balance.
 * - View: self, org admin, HR, executive, or direct line manager
 * - Adjust: org admin, HR, executive, or direct line manager (not self)
 */
export async function resolveEmployeeLeaveBalanceAccess(req, targetEmployeeId, { forAdjust = false } = {}) {
    const organizationId = await resolveLeaveBalanceOrganizationId(
        targetEmployeeId,
        req.organizationId || req.user?.organizationId || req.employee?.organizationId
    );

    if (!organizationId) {
        return { ok: false, status: 400, message: 'Organization ID is required', canAdjust: false, organizationId: null };
    }

    const targetId = String(targetEmployeeId || '');
    const viewerEmployeeId = String(req.employee?._id || '');
    const jwtRole = (req.decoded?.role || req.user?.role || '').toLowerCase();

    if (!targetId) {
        return { ok: false, status: 400, message: 'Employee ID is required', canAdjust: false, organizationId };
    }

    const ctx = req.authContext || (req.decoded ? await resolveAuthContext(req.decoded, req) : null);

    const isOrgAdmin = jwtRole === 'admin' || Boolean(ctx?.isOrgOwner);
    // Prefer RBAC buckets; also fall back to loaded workforce profile (jobTitle / department / functionalRoles)
    // when middleware forgot to attach authContext (e.g. older isAuthenticatedBoth paths).
    const isHrStaff = Boolean(
        ctx?.isHrManager ||
        ctx?.isHrExecutive ||
        ctx?.buckets?.includes('hr_manager') ||
        ctx?.buckets?.includes('hr_executive') ||
        hasAnyPermission(ctx, [PERMISSIONS.LEAVE_POLICY_MANAGE]) ||
        isHrStaffEmployee(req.employee)
    );
    const isExecutive = Boolean(
        ctx?.isExecutive ||
        ctx?.buckets?.includes('executive') ||
        isExecutiveEmployee(req.employee)
    );

    const isSelf = viewerEmployeeId && viewerEmployeeId === targetId;

    if (isSelf && !forAdjust) {
        return { ok: true, canAdjust: false, role: 'self', organizationId };
    }

    if (forAdjust && isSelf) {
        return {
            ok: false,
            status: 403,
            message: 'You cannot manually adjust your own leave balance. Contact HR or your manager.',
            canAdjust: false,
            organizationId,
        };
    }

    if (isOrgAdmin || isHrStaff || isExecutive) {
        return {
            ok: true,
            canAdjust: true,
            role: isOrgAdmin ? 'admin' : isHrStaff ? 'hr' : 'executive',
            organizationId,
        };
    }

    if (req.employee?._id) {
        const target = await Employee.findOne({
            _id: targetEmployeeId,
            organizationId,
        })
            .select('_id managerId manager organizationId')
            .lean();

        if (!target) {
            return { ok: false, status: 404, message: 'Employee not found', canAdjust: false, organizationId };
        }

        if (isEmployeeLinkedToManager(target, req.employee)) {
            return { ok: true, canAdjust: true, role: 'manager', organizationId };
        }
    }

    return {
        ok: false,
        status: 403,
        message: forAdjust
            ? 'Only HR, admin, or this employee’s direct manager can adjust leave balances.'
            : 'Access denied. You can only view leave balances for your team or with HR/admin access.',
        canAdjust: false,
        organizationId,
    };
}
