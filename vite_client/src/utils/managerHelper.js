/**
 * Manager Helper Utilities for Frontend
 * Provides utilities for filtering and checking manager relationships
 */

import { isProjectManager } from './projectManagerHelper';

const normalizeRoleText = (value) => String(value || '').toLowerCase().trim();

const hasManagerFunctionalRole = (user) => {
    const functionalRoles = Array.isArray(user?.functionalRoles) ? user.functionalRoles : [];
    return functionalRoles.some((role) => normalizeRoleText(role) === 'manager');
};

const getManagerFieldText = (managerField) => {
    if (!managerField) return '';
    if (typeof managerField === 'string') return managerField.trim();
    if (typeof managerField === 'object') {
        const fullName = `${managerField.name || ''} ${managerField.lastName || ''}`.trim();
        return fullName || String(managerField.username || managerField.email || '').trim();
    }
    return String(managerField).trim();
};

/**
 * Check if an employee is linked to a manager
 * @param {Object} employee - Employee object
 * @param {Object} manager - Manager object (user object)
 * @returns {boolean} - True if employee is linked to manager
 */
export const isEmployeeLinkedToManager = (employee, manager) => {
    if (!employee || !manager) {
        return false;
    }

    const managerId = manager._id || manager.id;
    if (employee.managerId && managerId && String(employee.managerId) === String(managerId)) {
        return true;
    }

    if (!employee.manager || !manager.name) {
        return false;
    }

    const managerName = `${manager.name} ${manager.lastName || ''}`.trim();
    const managerFirstName = manager.name;
    const employeeManager = getManagerFieldText(employee.manager);

    if (employeeManager === managerName || employeeManager === managerFirstName) {
        return true;
    }

    const employeeManagerLower = employeeManager.toLowerCase();
    const managerNameLower = managerName.toLowerCase();
    const managerFirstNameLower = managerFirstName.toLowerCase();

    if (
        employeeManagerLower === managerNameLower ||
        employeeManagerLower === managerFirstNameLower ||
        employeeManagerLower.startsWith(managerFirstNameLower + ' ')
    ) {
        return true;
    }

    return false;
};

/**
 * Filter employees by managerId (preferred) or legacy manager name field.
 * @param {Array} employees - Array of employee objects
 * @param {Object} manager - Manager object (user object)
 * @returns {Array} - Filtered array of employees
 */
export const filterEmployeesByManager = (employees, manager) => {
    if (!employees || !Array.isArray(employees) || !manager) {
        return employees || [];
    }

    return employees.filter((emp) => isEmployeeLinkedToManager(emp, manager));
};

/**
 * Get team member IDs from employees array
 * @param {Array} employees - Array of employee objects
 * @param {Object} manager - Manager object
 * @returns {Array} - Array of employee IDs
 */
export const getTeamMemberIds = (employees, manager) => {
    const teamMembers = filterEmployeesByManager(employees, manager);
    return teamMembers.map(emp => emp._id || emp.id).filter(Boolean);
};

/**
 * Check if user is a manager
 * @param {Object} user - User object
 * @returns {boolean} - True if user is a manager
 */
export const isManager = (user) => {
    if (!user) return false;

    if (isProjectManager(user)) return true;

    const role = normalizeRoleText(user.role);
    if (role === 'manager') return true;
    if (hasManagerFunctionalRole(user)) return true;
    
    const position = normalizeRoleText(user.position);
    const jobTitle = normalizeRoleText(user.jobTitle);
    
    return position === 'manager' || 
           position === 'director' ||
           position.includes('manager') ||
           position.includes('director') ||
           jobTitle.includes('manager') ||
           jobTitle.includes('director');
};

/** Line manager only (team-scoped HR/attendance), not Project Manager. */
export const isLineManager = (user) => isManager(user) && !isProjectManager(user);

/**
 * Check if user is HR
 * @param {Object} user - User object
 * @returns {boolean} - True if user is HR
 */
export const isHR = (user) => {
    if (!user) return false;

    const functionalRoles = Array.isArray(user?.functionalRoles) ? user.functionalRoles : [];
    if (functionalRoles.some((role) => String(role || '').toLowerCase().trim() === 'hr')) {
        return true;
    }
    
    const department = (user.department || '').toLowerCase().trim();
    const position = (user.position || '').toLowerCase().trim();
    const jobTitle = (user.jobTitle || '').toLowerCase().trim();
    
    return department === 'hr' || 
           department.includes('hr') || 
           department.includes('human resource') ||
           jobTitle.includes('hr manager') ||
           jobTitle.includes('human resource') ||
           jobTitle.includes('hr') ||
           position.includes('hr manager') ||
           (position.includes('hr') && position.includes('manager'));
};

/**
 * HR document / ID-card management (org admin, HR portal delegates, or HR staff).
 */
export const canAccessHrDocuments = (
    user,
    employee = null,
    { isHrManager = false, isHrExecutive = false, isOrgOwner = false } = {}
) => {
    if (isOrgOwner || isHrManager || isHrExecutive) return true;
    const userObj = user || employee;
    if (!userObj) return false;
    if ((userObj.role || '').toLowerCase() === 'admin') return true;
    return isHR(userObj);
};

/**
 * Check if user can add employees (Admin or HR)
 * @param {Object} user - User object
 * @returns {boolean} - True if user can add employees
 */
export const canAddEmployee = (user) => {
    if (!user) return false;
    
    const userRole = user.role;
    if (userRole === 'admin') return true;
    
    return isHR(user);
};

/**
 * Get user role badge info
 * @param {Object} user - User object
 * @returns {Object} - Badge info with label and color
 */
export const getUserRoleBadge = (user) => {
    if (!user) return { label: 'Employee', color: 'gray' };
    
    const userRole = user.role;
    if (userRole === 'admin') {
        return { label: 'Admin', color: 'purple' };
    }
    
    if (isHR(user)) {
        return { label: 'HR', color: 'blue' };
    }
    
    if (isProjectManager(user)) {
        return { label: 'Project Manager', color: 'teal' };
    }

    if (isManager(user)) {
        return { label: 'Manager', color: 'green' };
    }
    
    return { label: 'Employee', color: 'gray' };
};

