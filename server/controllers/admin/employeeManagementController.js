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
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { getCachedEmployees, setCachedEmployees } from '../../helpers/cacheHelper.js';
import { buildManagerMatchQuery } from '../../helpers/managerHelper.js';

/**
 * Get all employees (Admin, HR, and Managers) - Paginated
 * GET /api/v1/admin/employee or GET /api/v1/employee/auth/get-all-employees
 * Managers will see employees in their department only
 */
export const getAllEmployees = async (req, res) => {
    try {
        const user = req.user || req.employee;

        if (!user) {
            return sendForbidden(res, 'Access denied. Authentication required.');
        }

        // Access is controlled by middleware (isAdminOrManagerOrHRAuthenticated)
        // No need to check role here as middleware handles it

        // Parse pagination
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
        const sort = parseSort(req, '-createdAt');

        // Filter by organizationId
        const query = addOrganizationFilter(req, {});
        const organizationId = getOrganizationId(req);

        // If user is a manager (not admin or HR), filter by manager field
        // Example: Manager "Arun Kumar" will see employees with manager="Arun Kumar" or "Arun"
        const isManager = req.employee?.isManager && !req.employee?.isHR && !req.user;
        if (isManager && req.employee) {
            const managerQuery = buildManagerMatchQuery(req.employee);
            if (managerQuery && managerQuery.$or) {
                query.$or = managerQuery.$or;
            }
            query.status = 'active'; // Only active employees for managers
            
            const managerName = `${req.employee.name} ${req.employee.lastName || ''}`.trim();
            logger.info('Manager filtering employees by manager field', {
                managerId: req.employee._id,
                managerName: managerName,
                matchingCriteria: 'Employees where manager field matches manager name'
            });
        }

        // Try cache first (only for first page)
        if (page === 1) {
            const cached = await getCachedEmployees(organizationId, query);
            if (cached) {
                return sendPaginatedResponse(res, cached.data, page, limit, cached.total, 'Employees retrieved successfully');
            }
        }

        // Execute optimized query with pagination
        const [employees, total] = await Promise.all([
            Employee.find(query)
                .select('-password -__v')
                .populate('assignedRole', 'name level permissions')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Employee.countDocuments(query)
        ]);

        // Cache first page results
        if (page === 1) {
            await setCachedEmployees(organizationId, query, employees, total);
        }

        return sendPaginatedResponse(res, employees, page, limit, total, 'Employees retrieved successfully');
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

        // Access is controlled by middleware (isAdminOrHRAuthenticated)
        // No need to check role here as middleware handles it
        if (!user) {
            return sendForbidden(res, 'Access denied. Authentication required.');
        }

        // Management positions (in hierarchy order: highest to lowest)
        const managementPositions = ['CEO', 'CTO', 'CFO', 'VP', 'Director', 'Manager'];
        
        // Filter by organizationId and management positions
        const query = addOrganizationFilter(req, {
            position: { $in: managementPositions },
            status: 'active' // Only active managers
        });
        
        // Parse pagination for managers list
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });
        
        // Fetch managers with pagination
        const [managers, total] = await Promise.all([
            Employee.find(query)
                .select('name lastName email position department employeeId')
                .skip(skip)
                .limit(limit)
                .lean(), // Use lean() for better performance
            Employee.countDocuments(query)
        ]);
        
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
        
        return sendPaginatedResponse(res, managers, page, limit, total, 'Managers retrieved successfully');
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

