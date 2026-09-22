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
import { invalidateEmployeesCache } from '../../helpers/cacheHelper.js';
import { applyEmployeeListDataScope } from '../../helpers/employeeListScopeHelper.js';
import { logUpdate, logDelete } from '../../helpers/auditLogger.js';
import { canManageEmployeeLifecycle } from '../../helpers/employeeLifecycleHelper.js';
import {
  isOrgOwnerUser,
  linkOrgOwnerMeProfile,
  resolveOrgOwnerUser,
} from '../../helpers/identityService.js';
import User from '../../models/user.model.js';

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

        const { scope } = applyEmployeeListDataScope(req, query);
        if (scope === 'team') {
            logger.info('Employee list scoped to managed team', {
                managerId: req.employee?._id,
                scope,
            });
        }

        // Optional server-side search (name, last name, email, employeeId)
        const search = String(req.query.search || '').trim();
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escaped, 'i');
            const searchClause = {
                $or: [
                    { name: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex },
                    { employeeId: searchRegex }
                ]
            };

            // If query already has an $or (e.g., manager filter), combine safely with $and.
            if (query.$or) {
                const existingOr = query.$or;
                delete query.$or;
                query.$and = [
                    ...(Array.isArray(query.$and) ? query.$and : []),
                    { $or: existingOr },
                    searchClause
                ];
            } else {
                query.$and = [
                    ...(Array.isArray(query.$and) ? query.$and : []),
                    searchClause
                ];
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

        return sendPaginatedResponse(res, employees, page, limit, total, 'Employees retrieved successfully');
    } catch (error) {
        logger.error('Error fetching employees', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to fetch employees', error);
    }
};

const toPlainEmployee = (doc) => {
    if (!doc) return null;
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
};

/**
 * PATCH /api/v1/admin/employee/:employeeId/status
 */
export const updateEmployeeStatus = async (req, res) => {
    try {
        if (!canManageEmployeeLifecycle(req)) {
            return sendForbidden(res, 'Only organization admin or HR can deactivate or activate employees.');
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

        if (employeeBefore.status === 'terminated') {
            return sendValidationError(
                res,
                { status: 'Terminated employees cannot be changed via activate/deactivate. Use rehire/termination workflow.' }
            );
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

        if (!updatedEmployee) {
            return sendNotFound(res, 'Employee');
        }
        const orgIdForCache = organizationId || updatedEmployee?.organizationId || employeeBefore?.organizationId;
        if (orgIdForCache) {
            try {
                await invalidateEmployeesCache(orgIdForCache);
            } catch (e) {
                logger.warn('Failed to invalidate employees cache after status update', { error: e.message });
            }
        }

        try {
            await logUpdate({
                entityType: 'Employee',
                entityId: employeeId,
                entityName: `${employeeBefore.name} ${employeeBefore.lastName || ''}`.trim(),
                req,
                before: employeeBefore,
                after: toPlainEmployee(updatedEmployee),
                metadata: {
                    statusChange: true,
                    previousStatus: employeeBefore.status,
                    newStatus: updatedEmployee.status,
                    previousActive: employeeBefore.active,
                    newActive: updatedEmployee.active,
                },
            });
        } catch (auditError) {
            logger.warn('Audit log failed after employee status update', { error: auditError.message });
        }

        return sendSuccess(res, {
            employee: updatedEmployee,
        }, `Employee ${active ? 'activated' : 'deactivated'} successfully`);

    } catch (error) {
        logger.error('Error updating employee status', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to update employee status', 500, 'INTERNAL_ERROR');
    }
};

/**
 * Terminate employee with effective date.
 * PATCH /api/v1/employee/profile/admin/terminate/:employeeId
 */
export const terminateEmployee = async (req, res) => {
    try {
        if (!canManageEmployeeLifecycle(req)) {
            return sendForbidden(res, 'Only organization admin or HR can terminate employees.');
        }

        const { employeeId } = req.params;
        const { terminationDate, lastWorkingDate, reason, notes, eligibleForRehire } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return sendValidationError(res, { employeeId: 'Invalid employee ID format' });
        }

        if (!terminationDate) {
            return sendValidationError(res, { terminationDate: 'terminationDate is required' });
        }

        const parsedTerminationDate = new Date(terminationDate);
        if (Number.isNaN(parsedTerminationDate.getTime())) {
            return sendValidationError(res, { terminationDate: 'Invalid terminationDate' });
        }

        const parsedLastWorkingDate = lastWorkingDate ? new Date(lastWorkingDate) : parsedTerminationDate;
        if (Number.isNaN(parsedLastWorkingDate.getTime())) {
            return sendValidationError(res, { lastWorkingDate: 'Invalid lastWorkingDate' });
        }

        const organizationId = getOrganizationId(req);
        const employeeBefore = await Employee.findOne({ _id: employeeId, organizationId }).select('-password').lean();
        if (!employeeBefore) {
            return sendNotFound(res, 'Employee');
        }

        if (employeeBefore.status === 'terminated') {
            return sendValidationError(res, { status: 'Employee is already terminated.' });
        }

        const joiningDate = employeeBefore.joiningDate ? new Date(employeeBefore.joiningDate) : null;
        if (joiningDate && !Number.isNaN(joiningDate.getTime()) && parsedLastWorkingDate < joiningDate) {
            return sendValidationError(res, { lastWorkingDate: 'Last working date cannot be before joining date.' });
        }

        const updateData = {
            status: 'terminated',
            active: false,
            terminationDate: parsedTerminationDate,
            lastWorkingDate: parsedLastWorkingDate,
            terminationReason: reason || '',
            terminationNotes: notes || '',
            eligibleForRehire: Boolean(eligibleForRehire),
            terminatedBy: req.user?._id || req.employee?.userId || null,
        };

        const updatedEmployee = await Employee.findOneAndUpdate(
            { _id: employeeId, organizationId },
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedEmployee) {
            return sendNotFound(res, 'Employee');
        }

        const orgIdForCache = organizationId || updatedEmployee?.organizationId || employeeBefore?.organizationId;
        if (orgIdForCache) {
            try {
                await invalidateEmployeesCache(orgIdForCache);
            } catch (e) {
                logger.warn('Failed to invalidate employees cache after termination', { error: e.message });
            }
        }

        try {
            await logUpdate({
                entityType: 'Employee',
                entityId: employeeId,
                entityName: `${employeeBefore.name} ${employeeBefore.lastName || ''}`.trim(),
                req,
                before: employeeBefore,
                after: toPlainEmployee(updatedEmployee),
                metadata: {
                    statusChange: true,
                    previousStatus: employeeBefore.status,
                    newStatus: updatedEmployee.status,
                    terminationDate: parsedTerminationDate,
                    lastWorkingDate: parsedLastWorkingDate,
                },
            });
        } catch (auditError) {
            logger.warn('Audit log failed after employee termination', { error: auditError.message });
        }

        return sendSuccess(
            res,
            { employee: updatedEmployee },
            'Employee terminated successfully'
        );
    } catch (error) {
        logger.error('Error terminating employee', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to terminate employee', 500, 'INTERNAL_ERROR');
    }
};

/**
 * Get employees eligible as reporting managers for the hierarchy dropdown.
 * Includes the Admin root (managerId: null) and all other active employees so
 * department chains (e.g. Lead → Senior → Junior) can be assigned via managerId.
 * GET /api/v1/admin/employee/managers
 * Query: limit - optional, use for dropdown (e.g. limit=500 to get full list)
 */
export const getManagers = async (req, res) => {
    try {
        const user = req.user || req.employee;

        if (!user) {
            return sendForbidden(res, 'Access denied. Authentication required.');
        }

        const { page, limit, skip } = parsePagination(req, { defaultLimit: 100, maxLimit: 500 });

        const organizationId = getOrganizationId(req);
        const query = addOrganizationFilter(req, { status: 'active' });

        const [managers, total] = await Promise.all([
            Employee.find(query)
                .select('name lastName email position department employeeId managerId')
                .skip(skip)
                .limit(limit)
                .sort('name lastName')
                .lean(),
            Employee.countDocuments(query)
        ]);

        const positionOrder = {
            CEO: 1,
            CTO: 2,
            CFO: 3,
            VP: 4,
            Executive: 5,
            Director: 6,
            Manager: 7,
            Supervisor: 8,
            Lead: 9,
            Senior: 10,
            'Mid-Level': 11,
            Junior: 12,
            Intern: 13,
        };
        managers.sort((a, b) => {
            const aIsRoot = !a.managerId;
            const bIsRoot = !b.managerId;
            if (aIsRoot !== bIsRoot) return aIsRoot ? -1 : 1;
            const orderA = positionOrder[a.position] || 50;
            const orderB = positionOrder[b.position] || 50;
            if (orderA !== orderB) return orderA - orderB;
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
 * Get distinct job titles within the requester's organization.
 * GET /api/v1/admin/employee/job-titles
 */
export const getOrganizationJobTitles = async (req, res) => {
    try {
        const user = req.user || req.employee;
        if (!user) {
            return sendForbidden(res, 'Access denied. Authentication required.');
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendValidationError(res, { organizationId: 'Organization ID is required' });
        }

        const jobTitles = await Employee.distinct('jobTitle', {
            organizationId,
            jobTitle: { $exists: true, $ne: '' }
        });

        // Master catalog used across the app (kept in backend so dropdowns are consistent per role).
        const defaultJobTitles = [
            'Software Engineer',
            'Frontend Developer',
            'Backend Developer',
            'DevOps Engineer',
            'HR Manager',
            'HR Executive',
            'Financial Analyst',
            'Marketing Executive',
            'Sales Representative',
            'Product Manager',
            'QA Tester',
            'Customer Support Specialist',
            'UX/UI Designer',
            'Project Manager',
            'Legal Advisor',
            'Operations Coordinator',
            'Full Stack Developer'
        ];

        const normalizedOrgTitles = jobTitles
            .map((title) => String(title || '').trim())
            .filter(Boolean);

        const normalized = Array.from(new Set([
            ...defaultJobTitles,
            ...normalizedOrgTitles
        ]))
            .sort((a, b) => a.localeCompare(b));

        return sendSuccess(res, { jobTitles: normalized }, 'Job titles retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization job titles', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to fetch job titles', error);
    }
};

/**
 * Link an existing employee as the org owner's Me-tab profile.
 * POST /api/v1/admin/employee/:employeeId/link-as-me-profile
 */
export const linkEmployeeAsOrgOwnerMeProfile = async (req, res) => {
    try {
        if (!req.authContext?.isOrgOwner) {
            return sendForbidden(res, 'Only organization owners can link a Me profile.');
        }

        const { employeeId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return sendValidationError(res, { employeeId: 'Invalid employee ID format' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required.', 400, 'MISSING_ORGANIZATION_ID');
        }

        const orgOwner =
            req.user?._id && isOrgOwnerUser(req.user)
                ? req.user
                : await resolveOrgOwnerUser(organizationId);

        if (!orgOwner) {
            return sendForbidden(res, 'Organization owner account not found.');
        }

        const result = await linkOrgOwnerMeProfile(orgOwner, employeeId, organizationId);
        if (!result.ok) {
            if (result.code === 'NOT_FOUND') {
                return sendNotFound(res, 'Employee');
            }
            return sendError(res, result.message || 'Failed to link profile.', 400, result.code || 'LINK_FAILED');
        }

        await invalidateEmployeesCache(organizationId);

        const employeeObj = result.employee.toObject ? result.employee.toObject() : result.employee;

        logger.info('Linked employee as org owner Me profile', {
            organizationId,
            orgOwnerId: orgOwner._id,
            employeeId: employeeObj._id,
        });

        return sendSuccess(
            res,
            {
                employee: {
                    _id: employeeObj._id,
                    name: employeeObj.name,
                    lastName: employeeObj.lastName,
                    email: employeeObj.email,
                    employeeId: employeeObj.employeeId,
                    jobTitle: employeeObj.jobTitle,
                    department: employeeObj.department,
                    position: employeeObj.position,
                },
                employeeProfileId: employeeObj._id,
            },
            'Employee linked as your Me profile. Open the Me tab to view it.',
            200
        );
    } catch (error) {
        logger.error('Error linking org owner Me profile', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to link Me profile', error);
    }
};

/**
 * Delete employee (Admin or HR)
 * DELETE /api/v1/employee/auth/delete-employee/:employeeId
 */
export const deleteEmployee = async (req, res) => {
    try {
        if (!canManageEmployeeLifecycle(req)) {
            return sendForbidden(res, 'Only organization admin or HR can delete employees.');
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

        // Invalidate employee caches so lists refresh
        const orgIdForCache = organizationId || employee.organizationId;
        if (orgIdForCache) {
            try {
                const { invalidateEmployeesCache } = await import('../../helpers/cacheHelper.js');
                await invalidateEmployeesCache(orgIdForCache);
            } catch (e) {
                logger.warn('Failed to invalidate employees cache after delete', { error: e.message });
            }
        }

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
        return sendError(res, 'Failed to delete employee', 500, 'INTERNAL_ERROR');
    }
};

