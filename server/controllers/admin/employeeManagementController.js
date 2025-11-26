/**
 * Employee Management Controller
 * Handles employee CRUD operations (Admin only)
 * Split from employeeAuthController for better organization
 */

import Employee from '../../models/employee.model.js';
import Payroll from '../../models/payroll.model.js';
import mongoose from 'mongoose';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendForbidden, sendValidationError, sendInternalError } from '../../helpers/responseHelper.js';
import { addOrganizationFilter, getOrganizationId } from '../../helpers/organizationHelper.js';

/**
 * Get all employees (Admin only)
 * GET /api/v1/admin/employee
 */
export const getAllEmployees = async (req, res) => {
    try {
        const user = req.user || req.employee;

        if (!user || user.role !== 'admin') {
            return sendForbidden(res, 'Access denied. Admins only.');
        }

        // Filter by organizationId
        const query = addOrganizationFilter(req, {});
        const employees = await Employee.find(query).select('-password');
        return sendSuccess(res, { employees }, 'Employees retrieved successfully');
    } catch (error) {
        logger.error('Error fetching employees', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to fetch employees', error);
    }
};

/**
 * Update employee active status (Admin only)
 * PATCH /api/v1/admin/employee/:employeeId/status
 */
export const updateEmployeeStatus = async (req, res) => {
    try {
        // Check if requester is admin
        if (req.user?.role !== 'admin') {
            return sendForbidden(res, 'Access denied. Admins only.');
        }

        const { employeeId } = req.params;
        const { active } = req.body;

        // Validate input
        if (typeof active !== 'boolean') {
            return sendValidationError(res, { active: 'Status must be a boolean (true/false)' });
        }

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return sendValidationError(res, { employeeId: 'Invalid employee ID format' });
        }

        // Update status - ensure employee belongs to same organization
        const organizationId = getOrganizationId(req);
        const updatedEmployee = await Employee.findOneAndUpdate(
            { _id: employeeId, organizationId },
            { active },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedEmployee) {
            return sendNotFound(res, 'Employee');
        }

        return sendSuccess(res, {
            employee: updatedEmployee
        }, `Employee ${active ? 'activated' : 'deactivated'} successfully`);

    } catch (error) {
        logger.error('Error updating employee status', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to update employee status', error);
    }
};

/**
 * Get managers (employees with management positions)
 * GET /api/v1/admin/employee/managers
 */
export const getManagers = async (req, res) => {
    try {
        const user = req.user || req.employee;

        if (!user || user.role !== 'admin') {
            return sendForbidden(res, 'Access denied. Admins only.');
        }

        // Management positions (in hierarchy order: highest to lowest)
        const managementPositions = ['CEO', 'CTO', 'CFO', 'VP', 'Director', 'Manager'];
        
        // Filter by organizationId and management positions
        const query = addOrganizationFilter(req, {
            position: { $in: managementPositions },
            status: 'active' // Only active managers
        });
        
        // Fetch managers
        const managers = await Employee.find(query)
            .select('name lastName email position department employeeId')
            .lean(); // Use lean() for better performance
        
        // Sort by position hierarchy (CEO first, then CTO, CFO, VP, Director, Manager)
        const positionOrder = { 'CEO': 1, 'CTO': 2, 'CFO': 3, 'VP': 4, 'Director': 5, 'Manager': 6 };
        managers.sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            if (orderA !== orderB) {
                return orderA - orderB; // Sort by position hierarchy
            }
            // If same position, sort by name
            const nameA = `${a.name} ${a.lastName || ''}`.trim();
            const nameB = `${b.name} ${b.lastName || ''}`.trim();
            return nameA.localeCompare(nameB);
        });
        
        return sendSuccess(res, { managers }, 'Managers retrieved successfully');
    } catch (error) {
        logger.error('Error fetching managers', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to fetch managers', error);
    }
};

/**
 * Delete employee (Admin only)
 * DELETE /api/v1/admin/employee/:employeeId
 */
export const deleteEmployee = async (req, res) => {
    try {
        // Ensure requester is an admin
        if (req.user?.role !== 'admin') {
            return sendForbidden(res, 'Access denied. Admins only.');
        }

        const { employeeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return sendValidationError(res, { employeeId: 'Invalid employee ID format' });
        }

        // Delete employee - ensure employee belongs to same organization
        const organizationId = getOrganizationId(req);
        const employee = await Employee.findOneAndDelete({ _id: employeeId, organizationId });

        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Optionally delete associated payroll data
        await Payroll.deleteMany({ employeeId: employee._id });

        return sendSuccess(res, null, 'Employee deleted successfully');
    } catch (error) {
        logger.error('Error deleting employee', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to delete employee', error);
    }
};

