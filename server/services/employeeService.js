/**
 * Employee Service Layer
 * Business logic for employee operations
 * Separates business logic from controllers
 */

import Employee from '../models/employee.model.js';
import { parsePagination } from '../helpers/paginationHelper.js';
import { getCachedEmployees, setCachedEmployees, invalidateEmployeesCache } from '../helpers/cacheHelper.js';
import { addOrganizationFilter, getOrganizationId } from '../helpers/organizationHelper.js';
import logger from '../helpers/logger.js';

/**
 * Get all employees with pagination and caching
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Paginated employees data
 */
export const getAllEmployeesService = async (req) => {
    try {
        const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, {});

        // Try cache first (only for first page)
        if (page === 1) {
            const cached = await getCachedEmployees(organizationId, query);
            if (cached) {
                return {
                    employees: cached.data,
                    pagination: {
                        page,
                        limit,
                        total: cached.total,
                        pages: Math.ceil(cached.total / limit)
                    }
                };
            }
        }

        // Execute optimized query
        const [employees, total] = await Promise.all([
            Employee.find(query)
                .select('-password -__v')
                .populate('assignedRole', 'name level permissions')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean(),
            Employee.countDocuments(query)
        ]);

        // Cache first page results
        if (page === 1) {
            await setCachedEmployees(organizationId, query, employees, total);
        }

        return {
            employees,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('Error in getAllEmployeesService', { error: error.message, stack: error.stack });
        throw error;
    }
};

/**
 * Get employee by ID
 * @param {string} employeeId - Employee ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Employee data
 */
export const getEmployeeByIdService = async (employeeId, organizationId) => {
    try {
        const employee = await Employee.findOne({
            _id: employeeId,
            organizationId
        })
            .select('-password -__v')
            .populate('assignedRole', 'name level permissions')
            .lean();

        if (!employee) {
            throw new Error('Employee not found');
        }

        return employee;
    } catch (error) {
        logger.error('Error in getEmployeeByIdService', { 
            employeeId, 
            organizationId,
            error: error.message 
        });
        throw error;
    }
};

/**
 * Create employee
 * @param {Object} employeeData - Employee data
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Created employee
 */
export const createEmployeeService = async (employeeData, organizationId) => {
    try {
        const employee = new Employee({
            ...employeeData,
            organizationId
        });

        await employee.save();

        // Invalidate cache
        await invalidateEmployeesCache(organizationId);

        // Return without password
        const employeeObj = employee.toObject();
        delete employeeObj.password;
        delete employeeObj.__v;

        return employeeObj;
    } catch (error) {
        logger.error('Error in createEmployeeService', { 
            organizationId,
            error: error.message 
        });
        throw error;
    }
};

/**
 * Update employee
 * @param {string} employeeId - Employee ID
 * @param {Object} updateData - Update data
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Updated employee
 */
export const updateEmployeeService = async (employeeId, updateData, organizationId) => {
    try {
        const employee = await Employee.findOneAndUpdate(
            { _id: employeeId, organizationId },
            updateData,
            { new: true, runValidators: true }
        )
            .select('-password -__v')
            .lean();

        if (!employee) {
            throw new Error('Employee not found');
        }

        // Invalidate cache
        await invalidateEmployeesCache(organizationId);

        return employee;
    } catch (error) {
        logger.error('Error in updateEmployeeService', { 
            employeeId,
            organizationId,
            error: error.message 
        });
        throw error;
    }
};

/**
 * Delete employee
 * @param {string} employeeId - Employee ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteEmployeeService = async (employeeId, organizationId) => {
    try {
        const result = await Employee.findOneAndDelete({
            _id: employeeId,
            organizationId
        });

        if (!result) {
            throw new Error('Employee not found');
        }

        // Invalidate cache
        await invalidateEmployeesCache(organizationId);

        return true;
    } catch (error) {
        logger.error('Error in deleteEmployeeService', { 
            employeeId,
            organizationId,
            error: error.message 
        });
        throw error;
    }
};

export default {
    getAllEmployeesService,
    getEmployeeByIdService,
    createEmployeeService,
    updateEmployeeService,
    deleteEmployeeService
};

