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
import { logUpdate, logDelete } from '../../helpers/auditLogger.js';

/**
 * @swagger
 * /api/v1/admin/employee:
 *   get:
 *     summary: Get all employees (paginated)
 *     description: Retrieves a paginated list of employees. Admins and HR see all employees. Managers see only employees in their department.
 *     tags: [Employee Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, terminated]
 *         description: Filter by employee status
 *     responses:
 *       200:
 *         description: Employees retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Employee'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     pages:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
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
        // ✅ SYNC: Update both active and status fields to keep them in sync
        const organizationId = getOrganizationId(req);
        
        // Get employee before update for audit log
        const employeeBefore = await Employee.findOne({ _id: employeeId, organizationId }).select('-password').lean();
        
        if (!employeeBefore) {
            return sendNotFound(res, 'Employee');
        }

        const updateData = {
            active,
            status: active ? 'active' : 'inactive' // Sync status with active field
        };
        const updatedEmployee = await Employee.findOneAndUpdate(
            { _id: employeeId, organizationId },
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        // Log audit trail
        await logUpdate({
            entityType: 'Employee',
            entityId: employeeId,
            entityName: `${employeeBefore.name} ${employeeBefore.lastName || ''}`.trim(),
            req,
            before: employeeBefore,
            after: updatedEmployee.toObject(),
            metadata: {
                statusChange: true,
                previousStatus: employeeBefore.status,
                newStatus: updatedEmployee.status,
                previousActive: employeeBefore.active,
                newActive: updatedEmployee.active
            }
        });

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
        
        // Get employee before deletion for audit log
        const employee = await Employee.findOne({ _id: employeeId, organizationId }).select('-password').lean();
        
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Delete employee
        await Employee.findOneAndDelete({ _id: employeeId, organizationId });

        // Optionally delete associated payroll data
        await Payroll.deleteMany({ employeeId: employee._id });

        // Log audit trail
        await logDelete({
            entityType: 'Employee',
            entityId: employeeId,
            entityName: `${employee.name} ${employee.lastName || ''}`.trim(),
            req,
            before: employee,
            after: null,
            metadata: {
                deletedPayroll: true
            }
        });

        return sendSuccess(res, null, 'Employee deleted successfully');
    } catch (error) {
        logger.error('Error deleting employee', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to delete employee', error);
    }
};

