/**
 * Manager Helper Utilities for Frontend
 * Provides utilities for filtering and checking manager relationships
 */

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
    if (!employee || !employee.manager || !manager || !manager.name) {
        return false;
    }
    
    const managerName = `${manager.name} ${manager.lastName || ''}`.trim();
    const managerFirstName = manager.name;
    const employeeManager = getManagerFieldText(employee.manager);
    
    // Check exact matches
    if (employeeManager === managerName || employeeManager === managerFirstName) {
        return true;
    }
    
    // Case-insensitive matching
    const employeeManagerLower = employeeManager.toLowerCase();
    const managerNameLower = managerName.toLowerCase();
    const managerFirstNameLower = managerFirstName.toLowerCase();
    
    if (employeeManagerLower === managerNameLower || 
        employeeManagerLower === managerFirstNameLower ||
        employeeManagerLower.startsWith(managerFirstNameLower + ' ')) {
        return true;
    }
    
    return false;
};

/**
 * Filter employees by manager field
 * Returns employees where manager field matches the manager's name
 * @param {Array} employees - Array of employee objects
 * @param {Object} manager - Manager object (user object)
 * @returns {Array} - Filtered array of employees
 */
export const filterEmployeesByManager = (employees, manager) => {
    if (!employees || !Array.isArray(employees) || !manager || !manager.name) {
        return employees || [];
    }
    
    const managerName = `${manager.name} ${manager.lastName || ''}`.trim();
    const managerFirstName = manager.name;
    
    return employees.filter(emp => {
        const empManager = getManagerFieldText(emp.manager);
        return empManager === managerName || 
               empManager === managerFirstName ||
               empManager.toLowerCase().startsWith(managerFirstName.toLowerCase());
    });
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

/**
 * Check if user is HR
 * @param {Object} user - User object
 * @returns {boolean} - True if user is HR
 */
export const isHR = (user) => {
    if (!user) return false;
    
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
    
    if (isManager(user)) {
        return { label: 'Manager', color: 'green' };
    }
    
    return { label: 'Employee', color: 'gray' };
};

