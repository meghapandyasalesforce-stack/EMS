/**
 * Employees eligible for "Assigned HR" pickers (onboarding / offboarding).
 * Only HR Manager and HR Executive — not the full employee list.
 */

const normalize = (value) => String(value || '').toLowerCase().trim();

export function isHrManagerOrExecutiveEmployee(emp) {
    if (!emp) return false;

    const title = normalize(emp.jobTitle || emp.position);
    const systemRole = normalize(emp.systemRoleId || emp.systemRole);
    const roles = [
        ...(Array.isArray(emp.roles) ? emp.roles : []),
        ...(Array.isArray(emp.platformRoles) ? emp.platformRoles : []),
        ...(Array.isArray(emp.functionalRoles) ? emp.functionalRoles : []),
    ].map(normalize);

    if (systemRole === 'hr_manager' || systemRole === 'hr_executive') return true;
    if (roles.includes('hr_manager') || roles.includes('hr_executive')) return true;
    // Org HR admin bucket maps to HR Manager in this product
    if (roles.includes('hr_admin') || systemRole === 'hr_admin') return true;

    if (/\bhr\s*manager\b/.test(title) || title === 'hrmanager') return true;
    if (/\bhr\s*executive\b/.test(title) || title === 'hrexecutive' || title.includes('hrexe')) return true;

    return false;
}

export function filterHrAssignees(employees = []) {
    return (employees || []).filter(isHrManagerOrExecutiveEmployee);
}

export default filterHrAssignees;
