/**
 * Employee Controller
 * Handles employee-specific operations (for employees, not admins)
 */

import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendInternalError } from '../../helpers/responseHelper.js';
import { addOrganizationFilter, getOrganizationId } from '../../helpers/organizationHelper.js';
import { parsePagination, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { buildManagerMatchQuery } from '../../helpers/managerHelper.js';
import asyncHandler from '../../helpers/asyncHandler.js';

/**
 * Get employees accessible to the current employee
 * For managers/directors: returns employees in their department
 * For regular employees: returns empty array or just themselves
 * GET /api/v1/employee
 */
export const getEmployees = asyncHandler(async (req, res) => {
    try {
        const employee = req.employee;
        
        if (!employee) {
            return sendError(res, 'Employee not authenticated', 401, 'NOT_AUTHENTICATED');
        }

        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});
        
        // Get employee's position and department
        const position = (employee.position || '').toLowerCase().trim();
        const department = (employee.department || '').toLowerCase().trim();
        
        // Check if employee is a manager or director
        const isManager = position === 'manager' || 
                         position === 'director' || 
                         position.includes('manager') || 
                         position.includes('director');
        
        // Parse pagination parameters
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
        
        let employees = [];
        let total = 0;
        
        if (isManager && employee) {
            // Managers can see employees linked to them via manager field
            // Example: Manager "Arun Kumar" sees employees with manager="Arun Kumar" or "Arun"
            const managerQuery = buildManagerMatchQuery(employee);
            if (managerQuery && managerQuery.$or) {
                query.$or = managerQuery.$or;
            }
            query.status = 'active'; // Only active employees
            
            // Get total count and employees with pagination
            [employees, total] = await Promise.all([
                Employee.find(query)
                    .select('-password -__v')
                    .populate('assignedRole', 'name level')
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Employee.countDocuments(query)
            ]);
            
            logger.info('Manager fetching employees by manager field', {
                employeeId: employee._id,
                managerName: managerName,
                count: employees.length,
                total,
                page,
                limit
            });
        } else {
            // Regular employees can only see themselves
            const self = await Employee.findById(employee._id)
                .select('-password -__v')
                .populate('assignedRole', 'name level')
                .lean();
            
            if (self) {
                employees = [self];
                total = 1;
            }
            
            logger.info('Employee fetching own data', {
                employeeId: employee._id
            });
        }

        // Use paginated response for managers, regular response for single employee
        if (isManager && department) {
            return sendPaginatedResponse(res, employees, page, limit, total, 'Employees retrieved successfully');
        } else {
            return sendSuccess(res, {
                employees,
                total: employees.length
            }, 'Employees retrieved successfully');
        }
    } catch (error) {
        logger.error('Error fetching employees', { 
            error: error.message, 
            stack: error.stack 
        });
        return sendInternalError(res, 'Failed to fetch employees', error);
    }
});

/**
 * Get current employee's own information
 * GET /api/v1/employee/me
 */
export const getCurrentEmployee = asyncHandler(async (req, res) => {
    try {
        const employee = req.employee;
        
        if (!employee) {
            return sendError(res, 'Employee not authenticated', 401, 'NOT_AUTHENTICATED');
        }

        const employeeData = await Employee.findById(employee._id)
            .select('-password -__v')
            .populate('assignedRole', 'name level permissions dashboardRoute')
            .lean();

        if (!employeeData) {
            return sendNotFound(res, 'Employee');
        }

        return sendSuccess(res, {
            employee: employeeData
        }, 'Employee data retrieved successfully');
    } catch (error) {
        logger.error('Error fetching current employee', { 
            error: error.message, 
            stack: error.stack 
        });
        return sendInternalError(res, 'Failed to fetch employee data', error);
    }
});

