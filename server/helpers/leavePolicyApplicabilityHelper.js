/**
 * Leave policy applicability — who a policy applies to (org-scoped SaaS).
 *
 * applicableTo:
 * - all        → every employee in the organization
 * - department → employee.department matches applicableDepartments (case-insensitive)
 * - role       → employee.assignedRole matches applicableRoles (Role ObjectIds)
 * - employee   → employee._id is in applicableEmployees
 *
 * Date windows (SaaS mid-year support):
 * - effectiveDate ≤ asOfDate
 * - expiryDate is null/missing OR expiryDate ≥ asOfDate
 * Prefer setting expiryDate on the old policy the day before the new policy’s effectiveDate.
 *
 * Overlap resolution: newest effectiveDate wins; ties break by specificity
 * (employee > role > department > custom > all).
 */

const APPLICABILITY_SPECIFICITY = {
    employee: 4,
    role: 3,
    department: 2,
    custom: 1,
    all: 0,
};

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

/** Local calendar day at noon (stable vs DST / UTC shift). */
export function toLeavePolicyLocalDay(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
    }
    const raw = String(value).trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}

function policyEffectiveTime(policy) {
    const d = toLeavePolicyLocalDay(policy?.effectiveDate);
    return d ? d.getTime() : 0;
}

function policyExpiryTime(policy) {
    const d = toLeavePolicyLocalDay(policy?.expiryDate);
    return d ? d.getTime() : null;
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
 * Whether the policy’s effective/expiry window covers asOfDate.
 * Does not check isActive or employee applicability.
 */
export function isLeavePolicyEffectiveOnDate(policy, asOfDate = new Date()) {
    if (!policy) return false;
    const asOf = toLeavePolicyLocalDay(asOfDate);
    if (!asOf) return false;

    const effectiveMs = policyEffectiveTime(policy);
    if (effectiveMs > asOf.getTime()) return false;

    const expiryMs = policyExpiryTime(policy);
    if (expiryMs != null && expiryMs < asOf.getTime()) return false;

    return true;
}

/** Mongo filter fragment for policies active on asOfDate (combine with organizationId / isActive). */
export function buildLeavePolicyEffectiveDateFilter(asOfDate = new Date()) {
    const asOf = toLeavePolicyLocalDay(asOfDate) || toLeavePolicyLocalDay(new Date());
    return {
        effectiveDate: { $lte: asOf },
        $or: [{ expiryDate: null }, { expiryDate: { $exists: false } }, { expiryDate: { $gte: asOf } }],
    };
}

export function getLeavePolicyApplicabilitySpecificity(policy) {
    const key = String(policy?.applicableTo || 'all').toLowerCase();
    return APPLICABILITY_SPECIFICITY[key] ?? 0;
}

/**
 * Sort comparator: newest effectiveDate first, then higher specificity.
 */
export function compareLeavePolicySelectionPriority(a, b) {
    const byDate = policyEffectiveTime(b) - policyEffectiveTime(a);
    if (byDate !== 0) return byDate;
    return getLeavePolicyApplicabilitySpecificity(b) - getLeavePolicyApplicabilitySpecificity(a);
}

/**
 * Pick the single leave policy that applies to the employee on asOfDate.
 * @param {object[]} policies - org policies (typically isActive: true)
 * @param {object} employee
 * @param {Date|string} [asOfDate]
 * @param {{ requireUsable?: boolean, hasUsableLeaveTypes?: (p) => boolean }} [options]
 */
export function selectApplicableLeavePolicy(policies, employee, asOfDate = new Date(), options = {}) {
    const { requireUsable = false, hasUsableLeaveTypes = null } = options;
    const list = Array.isArray(policies) ? policies : [];

    const candidates = list.filter((policy) => {
        if (!policy || policy.isActive === false) return false;
        if (!isLeavePolicyEffectiveOnDate(policy, asOfDate)) return false;
        if (!isLeavePolicyApplicableToEmployee(policy, employee)) return false;
        if (requireUsable && typeof hasUsableLeaveTypes === 'function' && !hasUsableLeaveTypes(policy)) {
            return false;
        }
        return true;
    });

    if (candidates.length === 0) return null;
    candidates.sort(compareLeavePolicySelectionPriority);
    return candidates[0];
}

/**
 * Month-by-month policy map for mid-year accrual split.
 * Uses the 1st of each calendar month as the as-of date for selection.
 *
 * @returns {{ year: number, monthIndex: number, policy: object|null }[]}
 */
export function buildEmployeeLeavePolicyMonthMap(
    policies,
    employee,
    fromYear,
    fromMonthIndex,
    toYear,
    toMonthIndex,
    options = {}
) {
    const months = [];
    if (
        !Number.isInteger(fromYear) ||
        !Number.isInteger(fromMonthIndex) ||
        !Number.isInteger(toYear) ||
        !Number.isInteger(toMonthIndex)
    ) {
        return months;
    }

    let y = fromYear;
    let m = fromMonthIndex;
    while (y < toYear || (y === toYear && m <= toMonthIndex)) {
        const asOf = new Date(y, m, 1, 12, 0, 0, 0);
        months.push({
            year: y,
            monthIndex: m,
            policy: selectApplicableLeavePolicy(policies, employee, asOf, options),
        });
        m += 1;
        if (m > 11) {
            m = 0;
            y += 1;
        }
    }
    return months;
}

/**
 * Contiguous windows of the same policy across a month map.
 * @returns {{ policy: object, startYear: number, startMonthIndex: number, endYear: number, endMonthIndex: number }[]}
 */
export function groupLeavePolicyMonthMapIntoWindows(monthMap = []) {
    const windows = [];
    for (const entry of monthMap) {
        if (!entry?.policy) continue;
        const policyId = toIdString(entry.policy._id) || String(policyEffectiveTime(entry.policy));
        const last = windows[windows.length - 1];
        const lastId = last
            ? toIdString(last.policy._id) || String(policyEffectiveTime(last.policy))
            : null;
        if (last && lastId === policyId) {
            last.endYear = entry.year;
            last.endMonthIndex = entry.monthIndex;
            continue;
        }
        windows.push({
            policy: entry.policy,
            startYear: entry.year,
            startMonthIndex: entry.monthIndex,
            endYear: entry.year,
            endMonthIndex: entry.monthIndex,
        });
    }
    return windows;
}

/** Find leave-type config on a policy (enabled only). */
export function findPolicyLeaveTypeConfig(policy, leaveType) {
    if (!policy || !leaveType) return null;
    const want = String(leaveType).toLowerCase();
    const found = (policy.leaveTypes || []).find(
        (lt) => lt?.enabled !== false && String(lt.type || '').toLowerCase() === want
    );
    return found || null;
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
