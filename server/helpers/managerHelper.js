/**
 * Manager Helper Functions
 * Utilities for filtering employees by manager field
 */

import logger from "./logger.js";
import { shouldScopeDataToManagedTeam } from "./permissionService.js";

/**
 * Build MongoDB query to find employees linked to a manager.
 * Prefers managerId; legacy manager string matches are exact / anchored only.
 *
 * @param {Object} managerEmployee - The manager's employee record
 * @returns {Object} - MongoDB $or query for matching manager field
 */
export const buildManagerMatchQuery = (managerEmployee) => {
    if (!managerEmployee || !managerEmployee._id) {
        return null;
    }

    const managerId = managerEmployee._id;
    const managerName = `${managerEmployee.name || ''} ${managerEmployee.lastName || ''}`.trim();
    const managerFirstName = (managerEmployee.name || '').trim();

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedManagerName = escapeRegex(managerName);
    const escapedFirstName = escapeRegex(managerFirstName);

    const orConditions = [
        // Preferred path: strict manager-id mapping
        { managerId },
    ];

    // Legacy fallback for records created before managerId migration (anchored only).
    if (managerName) {
        orConditions.push(
            { manager: managerName },
            { manager: { $regex: new RegExp(`^${escapedManagerName}$`, 'i') } }
        );
    }
    if (managerFirstName && managerFirstName !== managerName) {
        orConditions.push(
            { manager: managerFirstName },
            { manager: { $regex: new RegExp(`^${escapedFirstName}$`, 'i') } },
            { manager: { $regex: new RegExp(`^${escapedFirstName}\\s`, 'i') } }
        );
    }

    const managerQuery = { $or: orConditions };

    logger.debug('Built manager match query', {
        managerName,
        managerFirstName,
        queryPatterns: managerQuery.$or.length,
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
    const employeeManager = String(employee.manager).trim();

    if (employeeManager === managerName || employeeManager === managerFirstName) {
        return true;
    }

    const employeeManagerLower = employeeManager.toLowerCase();
    const managerNameLower = managerName.toLowerCase();
    const managerFirstNameLower = (managerFirstName || '').toLowerCase();

    if (
        employeeManagerLower === managerNameLower ||
        employeeManagerLower === managerFirstNameLower ||
        (managerFirstNameLower &&
            employeeManagerLower.startsWith(managerFirstNameLower + ' '))
    ) {
        return true;
    }

    return false;
};

/**
 * Whether this regularization request is assigned to the given manager (request.managerId).
 */
export const isAssignedRegularizationApprover = (regularizationRequest, managerEmployee) => {
    if (!regularizationRequest?.managerId || !managerEmployee?._id) {
        return false;
    }
    const assignedId = regularizationRequest.managerId?._id || regularizationRequest.managerId;
    return String(assignedId) === String(managerEmployee._id);
};

/**
 * Mongo filter: team reports OR requests explicitly assigned to this manager.
 */
export const buildManagerRegularizationScopeFilter = (managerEmployee, managerEmployeeIds = []) => {
    const managerId = managerEmployee._id;
    const orClauses = [{ managerId }];

    if (managerEmployeeIds.length > 0) {
        orClauses.unshift({ employeeId: { $in: managerEmployeeIds } });
    }

    return { $or: orClauses };
};

/**
 * Line manager may act when the employee reports to them or the request is assigned to them.
 */
export const canLineManagerAccessRegularization = (
    req,
    regularizationRequest,
    employee = null
) => {
    if (!shouldScopeDataToManagedTeam(req) || !req.employee) {
        return true;
    }

    if (isAssignedRegularizationApprover(regularizationRequest, req.employee)) {
        return true;
    }

    if (employee && isEmployeeLinkedToManager(employee, req.employee)) {
        return true;
    }

    return false;
};

export const getManagerEmployeeIds = async (EmployeeModel, organizationId, managerEmployee) => {
    if (!managerEmployee || !managerEmployee._id) {
        return [];
    }

    const managerQuery = buildManagerMatchQuery(managerEmployee);
    if (!managerQuery) {
        return [];
    }

    const query = {
        organizationId: organizationId,
        ...(managerQuery.$or?.[0] ? { $or: managerQuery.$or } : managerQuery),
        status: 'active',
    };

    const managerEmployees = await EmployeeModel.find(query)
        .select('_id')
        .lean();

    return managerEmployees.map((emp) => emp._id);
};
