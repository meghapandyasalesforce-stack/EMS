/**
 * Role Helper Functions
 * Utilities for managing functional roles
 * SECURITY: Centralized role management to prevent security vulnerabilities
 */

import logger from './logger.js';
import { isProjectManagerJobTitle } from './projectManagerHelper.js';

/**
 * Calculate functional roles from employee data
 * This is used when creating/updating employees
 * 
 * @param {Object} employeeData - Employee data with department, position, jobTitle
 * @returns {Array<string>} - Array of functional roles
 */
export const calculateFunctionalRoles = (employeeData) => {
    const roles = [];
    const dept = (employeeData.department || '').toLowerCase().trim();
    const pos = (employeeData.position || '').toLowerCase().trim();
    const jobTitle = (employeeData.jobTitle || '').toLowerCase().trim();
    
    // HR detection
    if (dept === 'hr' || dept.includes('hr') || dept.includes('human resource') ||
        jobTitle.includes('hr manager') || jobTitle.includes('human resource') ||
        jobTitle.includes('hr') || (pos.includes('hr') && pos.includes('manager'))) {
        roles.push('hr');
    }
    
    // Project Manager: org-wide projects (not line-manager team scope)
    if (isProjectManagerJobTitle(employeeData.jobTitle)) {
        roles.push('project_manager');
    }

    // Line manager detection (exclude Project Manager job title)
    if (!isProjectManagerJobTitle(employeeData.jobTitle) &&
        (pos === 'manager' || pos === 'director' || pos.includes('manager') ||
        pos.includes('director') || jobTitle.includes('manager') || jobTitle.includes('director'))) {
        roles.push('manager');
    }
    
    // Executive detection
    if (pos === 'ceo' || pos === 'cto' || pos === 'cfo' || pos === 'vp' ||
        pos === 'vice president' || pos.includes('chief executive') ||
        pos.includes('chief technology') || pos.includes('chief financial') ||
        pos.includes('vice president')) {
        if (pos === 'ceo' || pos.includes('chief executive')) roles.push('ceo');
        if (pos === 'cto' || pos.includes('chief technology')) roles.push('cto');
        if (pos === 'cfo' || pos.includes('chief financial')) roles.push('cfo');
        if (pos === 'vp' || pos === 'vice president') roles.push('vp');
        roles.push('executive');
    }
    
    // Finance detection
    if (dept === 'finance' || dept.includes('finance')) {
        roles.push('finance');
    }
    
    // Tech detection
    if (dept === 'engineering' || dept === 'it support' || dept.includes('engineering') ||
        dept.includes('technology') || jobTitle.includes('engineer') || jobTitle.includes('developer')) {
        roles.push('tech');
    }
    
    // Remove duplicates
    return [...new Set(roles)];
};

/**
 * Set functional roles explicitly on employee
 * Use this when creating or updating employees
 * 
 * @param {Object} employee - Employee document or data
 * @param {Array<string>} explicitRoles - Optional explicit roles to set
 * @returns {Array<string>} - Final functional roles array
 */
export const setFunctionalRoles = (employee, explicitRoles = null) => {
    if (explicitRoles && Array.isArray(explicitRoles)) {
        // Use explicitly provided roles
        return [...new Set(explicitRoles)];
    }
    
    // Calculate from employee data
    return calculateFunctionalRoles(employee);
};

/**
 * Validate functional role
 * 
 * @param {string} role - Role to validate
 * @returns {boolean} - True if valid role
 */
export const isValidFunctionalRole = (role) => {
    const validRoles = ['hr', 'manager', 'project_manager', 'executive', 'finance', 'tech', 'ceo', 'cto', 'cfo', 'vp'];
    return validRoles.includes(role);
};

/**
 * Check if employee has specific functional role
 * SECURITY: Use this instead of string matching on department/position
 * 
 * @param {Object} employee - Employee document
 * @param {string} role - Role to check
 * @returns {boolean} - True if employee has the role
 */
export const hasFunctionalRole = (employee, role) => {
    const functionalRoles = employee.functionalRoles || [];
    return functionalRoles.includes(role);
};

export default {
    calculateFunctionalRoles,
    setFunctionalRoles,
    isValidFunctionalRole,
    hasFunctionalRole
};

