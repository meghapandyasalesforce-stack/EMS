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

        const employees = await Employee.find().select('-password');
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

        // Update status
        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
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

        const employee = await Employee.findByIdAndDelete(employeeId);

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

