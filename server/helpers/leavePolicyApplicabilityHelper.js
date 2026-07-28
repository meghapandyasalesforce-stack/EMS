/**
 * Leave policy applicability — who a policy applies to (org-scoped SaaS).
 *
 * applicableTo:
 * - all        → every employee in the organization
 * - department → employee.department matches applicableDepartments (case-insensitive)
 * - role       → employee.assignedRole matches applicableRoles (Role ObjectIds)
 * - employee   → employee._id is in applicableEmployees
 */

function toIdString(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
        if (value._id != null) return String(value._id);
        if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
            const s = value.toString();
            if (s && s !== '[object Object]') return s;
        }
        return '';
    }
    return String(value);
}

function normalizeDepartmentName(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

/** Prefer assignedRole (Role ref); never use system role string admin/employee. */
export function resolveEmployeeAssignedRoleId(employee) {
    return toIdString(employee?.assignedRole) || null;
}

export function isLeavePolicyApplicableToEmployee(policy, employee) {
    if (!policy || !employee) return false;

    const applicableTo = String(policy.applicableTo || 'all').toLowerCase();
    const employeeDepartment = normalizeDepartmentName(employee.department);
    const policyDepartments = (policy.applicableDepartments || [])
        .map(normalizeDepartmentName)
        .filter(Boolean);
    const employeeRoleId = resolveEmployeeAssignedRoleId(employee);
    const applicableRoleIds = (policy.applicableRoles || []).map(toIdString).filter(Boolean);
    const employeeId = toIdString(employee._id);
    const applicableEmployeeIds = (policy.applicableEmployees || []).map(toIdString).filter(Boolean);

    switch (applicableTo) {
        case 'all':
            return true;
        case 'department':
            return Boolean(employeeDepartment) && policyDepartments.includes(employeeDepartment);
        case 'role':
            return Boolean(employeeRoleId) && applicableRoleIds.includes(employeeRoleId);
        case 'employee':
            return Boolean(employeeId) && applicableEmployeeIds.includes(employeeId);
        case 'custom':
            // Flexible OR across any configured scopes (legacy / advanced).
            return (
                (Boolean(employeeId) && applicableEmployeeIds.includes(employeeId)) ||
                (Boolean(employeeRoleId) && applicableRoleIds.includes(employeeRoleId)) ||
                (Boolean(employeeDepartment) && policyDepartments.includes(employeeDepartment))
            );
        default:
            return false;
    }
}

/**
 * Validate applicability payload before create/update.
 * Returns an array of error strings (empty = ok).
 */
export function validateLeavePolicyApplicability(policyData = {}) {
    const errors = [];
    const applicableTo = String(policyData.applicableTo || 'all').toLowerCase();
    const departments = (policyData.applicableDepartments || [])
        .map((d) => String(d || '').trim())
        .filter(Boolean);
    const roles = (policyData.applicableRoles || []).map(toIdString).filter(Boolean);
    const employees = (policyData.applicableEmployees || []).map(toIdString).filter(Boolean);

    if (!['all', 'department', 'role', 'employee', 'custom'].includes(applicableTo)) {
        errors.push('Applicable To must be all, department, role, employee, or custom.');
        return errors;
    }

    if (applicableTo === 'department' && departments.length === 0) {
        errors.push('Select at least one department for a department-scoped leave policy.');
    }
    if (applicableTo === 'role' && roles.length === 0) {
        errors.push('Select at least one role for a role-scoped leave policy.');
    }
    if (applicableTo === 'employee' && employees.length === 0) {
        errors.push('Select at least one employee for an employee-scoped leave policy.');
    }
    if (
        applicableTo === 'custom' &&
        departments.length === 0 &&
        roles.length === 0 &&
        employees.length === 0
    ) {
        errors.push(
            'Custom applicability requires at least one department, role, or employee selection.'
        );
    }

    return errors;
}

/** Normalize lists for persistence based on applicableTo (clear unused scopes). */
export function normalizeLeavePolicyApplicability(policyData = {}) {
    const applicableTo = String(policyData.applicableTo || 'all').toLowerCase();
    const departments = (policyData.applicableDepartments || [])
        .map((d) => String(d || '').trim())
        .filter(Boolean);
    const roles = (policyData.applicableRoles || []).map(toIdString).filter(Boolean);
    const employees = (policyData.applicableEmployees || []).map(toIdString).filter(Boolean);

    const normalizedTo = ['all', 'department', 'role', 'employee', 'custom'].includes(applicableTo)
        ? applicableTo
        : 'all';

    if (normalizedTo === 'all') {
        return {
            applicableTo: 'all',
            applicableDepartments: [],
            applicableRoles: [],
            applicableEmployees: [],
        };
    }

    if (normalizedTo === 'custom') {
        return {
            applicableTo: 'custom',
            applicableDepartments: [...new Set(departments)],
            applicableRoles: [...new Set(roles)],
            applicableEmployees: [...new Set(employees)],
        };
    }

    return {
        applicableTo: normalizedTo,
        applicableDepartments: normalizedTo === 'department' ? [...new Set(departments)] : [],
        applicableRoles: normalizedTo === 'role' ? [...new Set(roles)] : [],
        applicableEmployees: normalizedTo === 'employee' ? [...new Set(employees)] : [],
    };
}
