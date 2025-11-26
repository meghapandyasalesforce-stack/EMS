import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import Role from '../../models/role.model.js';
import Organization from '../../models/organization.model.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';

/**
 * Helper function to get dashboard route based on department
 * @param {string} department - Employee department
 * @returns {string} Dashboard route
 */
const getDashboardByDepartment = (department) => {
    if (!department) return null;
    
    // Normalize department name: lowercase, trim, handle variations
    const dept = department.toLowerCase().trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/&/g, 'and'); // Handle & vs and
    
    // Map departments to dashboards (normalized keys)
    const departmentMap = {
        'hr': '/dashboard-hr',
        'human resources': '/dashboard-hr',
        'humanresource': '/dashboard-hr',
        'finance': '/dashboard-finance',
        'engineering': '/dashboard-manager', // Can be manager or executive based on position
        'it support': '/dashboard-manager',
        'itsupport': '/dashboard-manager',
        'sales': '/dashboard-manager',
        'marketing': '/dashboard-manager',
        'operations': '/dashboard-manager',
        'product': '/dashboard-manager',
        'research and development': '/dashboard-manager',
        'research & development': '/dashboard-manager',
        'r&d': '/dashboard-manager',
        'legal': '/dashboard-manager',
        'customer support': '/dashboard-employee',
        'customersupport': '/dashboard-employee',
        'design': '/dashboard-employee',
        'administration': '/dashboard-employee',
        'admin': '/dashboard-employee'
    };
    
    return departmentMap[dept] || null;
};

/**
 * Get user's dashboard route based on Position OR Department
 * Works for both admin and employee authentication
 * Priority: Assigned Role > Position (CEO, CTO, CFO, VP) > Department (HR/Finance) > Position (Manager/Director) > Other Departments > Job Title > Default Role
 * @route GET /api/v1/organization/dashboard/route
 * @access Private (Both admin and employee)
 * @param {Object} req - Express request object
 * @param {string} req.user._id - User ID (if admin)
 * @param {string} req.employee._id - Employee ID (if employee)
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Dashboard route information
 * @returns {Object} 401 - User not authenticated
 * @returns {Object} 500 - Server error
 */
export const getDashboardRoute = asyncHandler(async (req, res) => {
    // Try to get user from either admin or employee authentication
    let userId = req.user?._id || req.employee?._id;
    let userRole = req.user?.role || req.employee?.role;
    let organizationId = req.organizationId;
    
    // If not authenticated through middleware, return error
    if (!userId) {
        // This should not happen if middleware is working, but handle gracefully
        return sendError(res, 'User not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    let dashboardRoute = '/dashboard-employee';
    let assignedRole = null;
    let routeSource = 'default'; // Track what determined the route: 'assignedRole', 'department', 'position', 'jobTitle', 'role', 'default'
    let employeeDetails = null; // Store employee details for response

    // Check if user is an employee with assigned role
    if (userRole === 'employee') {
        const employee = await Employee.findById(userId)
            .populate('assignedRole', 'name dashboardRoute dashboardConfig')
            .select('department position jobTitle assignedRole');
        
        // Store employee details for response
        if (employee) {
            employeeDetails = {
                department: employee.department,
                position: employee.position,
                jobTitle: employee.jobTitle
            };
        }
        
        // Priority 1: Check assigned role (highest priority)
        if (employee?.assignedRole?.dashboardRoute) {
            assignedRole = employee.assignedRole;
            dashboardRoute = assignedRole.dashboardRoute;
            routeSource = 'assignedRole';
        } else {
            const position = employee?.position?.toLowerCase() || '';
            const department = employee?.department?.toLowerCase() || '';
            
            // Priority 2: Check POSITION for executive roles first (CEO, CTO, CFO, VP) - these override department
            if (position === 'ceo' || position === 'cto') {
                dashboardRoute = '/dashboard-executive';
                routeSource = 'position';
            } else if (position === 'cfo') {
                dashboardRoute = '/dashboard-executive'; // Can also use '/dashboard-finance' if preferred
                routeSource = 'position';
            } else if (position === 'vp') {
                // VP routing based on department
                if (department === 'engineering' || department === 'it support') {
                    dashboardRoute = '/dashboard-executive'; // VP Engineering -> CTO view
                } else if (department === 'finance') {
                    dashboardRoute = '/dashboard-executive'; // VP Finance -> CFO view
                } else {
                    dashboardRoute = '/dashboard-manager'; // Other VPs -> Manager view
                }
                routeSource = 'position-department';
            } else {
                // Priority 3: Check DEPARTMENT for HR and Finance (after checking executive positions)
                if (department === 'hr' || department === 'human resources') {
                    dashboardRoute = '/dashboard-hr';
                    routeSource = 'department';
                } else if (department === 'finance') {
                    dashboardRoute = '/dashboard-finance';
                    routeSource = 'department';
                } else if (position === 'manager' || position === 'director') {
                    // Manager/Director positions go to manager dashboard (unless in HR/Finance)
                    dashboardRoute = '/dashboard-manager';
                    routeSource = 'position';
                } else {
                    // Priority 4: Check other departments
                    const departmentRoute = getDashboardByDepartment(employee?.department);
                    if (departmentRoute) {
                        dashboardRoute = departmentRoute;
                        routeSource = 'department';
                    } else {
                        // Priority 5: Check job title for role-based routing
                        const jobTitle = employee?.jobTitle?.toLowerCase() || '';
                        if (jobTitle.includes('hr') || jobTitle.includes('human resource')) {
                            dashboardRoute = '/dashboard-hr';
                            routeSource = 'jobTitle';
                        } else if (jobTitle.includes('manager') || jobTitle.includes('director')) {
                            dashboardRoute = '/dashboard-manager';
                            routeSource = 'jobTitle';
                        } else if (jobTitle.includes('finance') || jobTitle.includes('accountant')) {
                            dashboardRoute = '/dashboard-finance';
                            routeSource = 'jobTitle';
                        }
                    }
                }
            }
        }
    } else if (userRole === 'admin') {
        const user = await User.findById(userId);
        if (user) {
            // Check if this is an organization admin (Gmail users or organization login)
            // Organization admins should go to organization dashboard
            const userEmail = user.email?.toLowerCase() || '';
            const isGmailUser = userEmail.endsWith('@gmail.com');
            
            // Also check if user is the primary admin of an organization
            // (organization email matches user email or user is the first admin)
            if (organizationId) {
                const organization = await Organization.findById(organizationId);
                if (organization) {
                    const orgEmail = organization.email?.toLowerCase() || '';
                    const isOrgAdmin = orgEmail === userEmail || isGmailUser;
                    
                    if (isOrgAdmin) {
                        dashboardRoute = '/organization/dashboard';
                        logger.debug('Routing organization admin to organization dashboard', {
                            userId,
                            organizationId,
                            email: userEmail
                        });
                    } else {
                        dashboardRoute = '/dashboard-admin';
                    }
                } else {
                    // Fallback: Gmail users go to organization dashboard
                    dashboardRoute = isGmailUser ? '/organization/dashboard' : '/dashboard-admin';
                }
            } else {
                // Fallback: Gmail users go to organization dashboard
                dashboardRoute = isGmailUser ? '/organization/dashboard' : '/dashboard-admin';
            }
        }
    }

    return sendSuccess(res, {
        dashboardRoute,
        role: userRole,
        routeSource, // Include what determined the route: 'assignedRole', 'department', 'position', 'jobTitle', 'role', 'default'
        department: employeeDetails?.department || null, // Include department for reference
        assignedRole: assignedRole ? {
            id: assignedRole._id,
            name: assignedRole.name,
            dashboardRoute: assignedRole.dashboardRoute,
            dashboardConfig: assignedRole.dashboardConfig
        } : null
    }, 'Dashboard route retrieved successfully');
});

/**
 * Get dashboard configuration for a role
 * @route GET /api/v1/organization/dashboard/config/:roleId
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.params.roleId - Role ID
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Dashboard configuration
 * @returns {Object} 404 - Role not found
 * @returns {Object} 500 - Server error
 */
export const getDashboardConfig = asyncHandler(async (req, res) => {
    const { roleId } = req.params;
    const organizationId = req.organizationId;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const role = await Role.findOne({
        _id: roleId,
        organizationId
    });

    if (!role) {
        return sendError(res, 'Role not found', 404, 'ROLE_NOT_FOUND');
    }

    return sendSuccess(res, {
        dashboardConfig: role.dashboardConfig || {
            widgets: [],
            layout: 'default',
            theme: 'light'
        }
    }, 'Dashboard configuration retrieved successfully');
});

/**
 * Update dashboard configuration for a role
 * @route PUT /api/v1/organization/dashboard/config/:roleId
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.params.roleId - Role ID
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} req.body - Updated configuration
 * @param {string} [req.body.dashboardRoute] - Dashboard route
 * @param {Object} [req.body.dashboardConfig] - Dashboard configuration
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Dashboard configuration updated successfully
 * @returns {Object} 404 - Role not found
 * @returns {Object} 500 - Server error
 */
export const updateDashboardConfig = asyncHandler(async (req, res) => {
    const { roleId } = req.params;
    const organizationId = req.organizationId;
    const { dashboardConfig, dashboardRoute } = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const role = await Role.findOne({
        _id: roleId,
        organizationId
    });

    if (!role) {
        return sendError(res, 'Role not found', 404, 'ROLE_NOT_FOUND');
    }

    if (dashboardRoute) {
        role.dashboardRoute = dashboardRoute;
    }

    if (dashboardConfig) {
        role.dashboardConfig = {
            ...role.dashboardConfig,
            ...dashboardConfig
        };
    }

    await role.save();

    logger.info('Dashboard config updated', { roleId, organizationId });

    return sendSuccess(res, {
        role: {
            id: role._id,
            name: role.name,
            dashboardRoute: role.dashboardRoute,
            dashboardConfig: role.dashboardConfig
        }
    }, 'Dashboard configuration updated successfully');
});

