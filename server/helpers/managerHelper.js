/**
 * Manager Helper Functions
 * Utilities for filtering employees by manager field
 */

import logger from "./logger.js";

/**
 * Build MongoDB query to find employees linked to a manager
 * Matches employees where manager field equals the manager's name
 * Supports: "Arun Kumar", "Arun", case-insensitive variations
 * 
 * @param {Object} managerEmployee - The manager's employee record
 * @returns {Object} - MongoDB $or query for matching manager field
 */
export const buildManagerMatchQuery = (managerEmployee) => {
    if (!managerEmployee || !managerEmployee._id) {
        return null;
    }

    const managerId = managerEmployee._id;
    // Get manager's full name and first name
    const managerName = `${managerEmployee.name || ''} ${managerEmployee.lastName || ''}`.trim();
    const managerFirstName = managerEmployee.name || '';
    
    // Escape special regex characters
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedManagerName = escapeRegex(managerName);
    const escapedFirstName = escapeRegex(managerFirstName);
    
    // Build comprehensive matching query
    // This handles: "Arun Kumar", "Arun", "arun kumar", "ARUN KUMAR", etc.
    const orConditions = [
        // Preferred path: strict manager-id mapping
        { managerId }
    ];

    // Legacy fallback for records created before managerId migration.
    if (managerName) {
        orConditions.push(
            { manager: managerName },
            { manager: { $regex: new RegExp(`^${escapedManagerName}$`, 'i') } },
            { manager: { $regex: new RegExp(escapedManagerName, 'i') } }
        );
    }
    if (managerFirstName) {
        orConditions.push(
            { manager: managerFirstName },
            { manager: { $regex: new RegExp(`^${escapedFirstName}$`, 'i') } },
            { manager: { $regex: new RegExp(`^${escapedFirstName}\\s`, 'i') } }
        );
    }

    const managerQuery = { $or: orConditions };
    
    logger.debug('Built manager match query', {
        managerName: managerName,
        managerFirstName: managerFirstName,
        queryPatterns: managerQuery.$or.length
    });
    
    return managerQuery;
};

/**
 * Check if an employee is linked to a manager
 * @param {Object} employee - Employee record to check
 * @param {Object} managerEmployee - Manager's employee record
 * @returns {boolean} - True if employee is linked to manager
 */
export const isEmployeeLinkedToManager = (employee, managerEmployee) => {
    if (!employee || !managerEmployee || !managerEmployee._id) {
        return false;
    }

    if (employee.managerId && String(employee.managerId) === String(managerEmployee._id)) {
        return true;
    }
    if (!employee.manager) return false;
    
    const managerName = `${managerEmployee.name} ${managerEmployee.lastName || ''}`.trim();
    const managerFirstName = managerEmployee.name;
    const employeeManager = employee.manager.trim();
    
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
 * Get all employee IDs linked to a manager
 * @param {Object} EmployeeModel - Mongoose Employee model
 * @param {string} organizationId - Organization ID
 * @param {Object} managerEmployee - Manager's employee record
 * @returns {Promise<Array>} - Array of employee IDs
 */
export const getManagerEmployeeIds = async (EmployeeModel, organizationId, managerEmployee) => {
    if (!managerEmployee || !managerEmployee._id) {
        return [];
    }
    
    const managerQuery = buildManagerMatchQuery(managerEmployee);
    if (!managerQuery) {
        return [];
    }
    
    // Add organization filter
    const query = {
        organizationId: organizationId,
        ...managerQuery.$or[0] ? { $or: managerQuery.$or } : managerQuery,
        status: 'active'
    };
    
    const managerEmployees = await EmployeeModel.find(query)
        .select('_id')
        .lean();
    
    return managerEmployees.map(emp => emp._id);
};

