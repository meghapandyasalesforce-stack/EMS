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
 * Get user's dashboard route based on Department and Position
 * Works for both admin and employee authentication
 * Priority: Department (HR) > Position (CEO, CTO, CFO, VP) > Position (Manager/Director) > Default Employee Dashboard
 * Note: HR department takes priority over position, so HR Managers go to HR Dashboard
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

    // Check if user is an employee
    if (userRole === 'employee') {
        const employee = await Employee.findById(userId)
            .select('department position jobTitle role email assignedRole')
            .populate('assignedRole', 'name dashboardRoute dashboardConfig');
        
        if (!employee) {
            return sendError(res, 'Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
        }

        // Store employee details for response
        employeeDetails = {
            department: employee.department,
            position: employee.position,
            jobTitle: employee.jobTitle
        };

        // Normalize position, department, and jobTitle for case-insensitive comparison
        const position = employee.position ? employee.position.toLowerCase().trim() : '';
        const department = employee.department ? employee.department.toLowerCase().trim() : '';
        const jobTitle = employee.jobTitle ? employee.jobTitle.toLowerCase().trim() : '';
        const assignedRoleObj = employee.assignedRole;

        // ============================================
        // DASHBOARD ROUTING BASED ON POSITION AND DEPARTMENT
        // Priority: Assigned Role → Department → Position → Default
        // NOT based on role - routing is determined by position and department fields
        // ============================================
        
        // PRIORITY 1: Check Assigned Role (if assignedRole has dashboardRoute)
        // Custom dashboard route from assigned role takes highest priority
        if (assignedRoleObj && assignedRoleObj.dashboardRoute) {
            dashboardRoute = assignedRoleObj.dashboardRoute;
            routeSource = 'assignedRole';
            assignedRole = assignedRoleObj;
            logger.info('✅ MATCH: Assigned Role Dashboard (checked: assignedRole)', {
                userId,
                assignedRole: assignedRoleObj.name,
                dashboardRoute: assignedRoleObj.dashboardRoute,
                routeSource,
                checkedFields: {
                    assignedRole: assignedRoleObj.name || 'empty',
                    position: position || 'empty',
                    department: department || 'empty',
                    jobTitle: jobTitle || 'empty'
                }
            });
        }
        // PRIORITY 2: Check ALL HR criteria (Department AND JobTitle AND Position)
        // HR employees go to HR Dashboard regardless of their position (even if Manager)
        if (
            // Check department field
            department === 'hr' || 
            department.includes('hr') || 
            department.includes('human resource') ||
            // Check jobTitle field
            jobTitle.includes('hr manager') ||
            jobTitle.includes('human resource') ||
            jobTitle.includes('hr')
        ) {
            dashboardRoute = '/dashboard-hr';
            routeSource = 'department';
            const matchedField = department.includes('hr') || department.includes('human resource') 
                ? 'department' 
                : 'jobTitle';
            logger.info('✅ MATCH: HR Dashboard (checked: department, jobTitle)', {
                userId,
                department: employee.department,
                position: employee.position,
                jobTitle: employee.jobTitle,
                matchedField,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    department: department || 'empty',
                    jobTitle: jobTitle || 'empty',
                    position: position || 'empty'
                }
            });
        }
        // PRIORITY 3: Check ALL Executive positions (Position field)
        // CEO, CTO, CFO, VP → Administration Dashboard
        else if (
            position === 'ceo' || 
            position === 'cto' || 
            position === 'cfo' || 
            position === 'vp'
        ) {
            // Route to Administration Dashboard
            dashboardRoute = '/dashboard-administration';
            routeSource = 'position';
            logger.info('✅ MATCH: Administration Dashboard (checked: position)', {
                userId,
                position: employee.position,
                department: employee.department,
                matchedPosition: position,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    position: position || 'empty',
                    department: department || 'empty',
                    jobTitle: jobTitle || 'empty'
                }
            });
        }
        // PRIORITY 4: Check ALL Manager/Director positions (Position field)
        // Manager or Director → Manager Dashboard
        else if (
            position === 'manager' || 
            position === 'director'
        ) {
            dashboardRoute = '/dashboard-manager';
            routeSource = 'position';
            logger.info('✅ MATCH: Manager Dashboard (checked: position)', {
                userId,
                position: employee.position,
                department: employee.department,
                matchedPosition: position,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    position: position || 'empty',
                    department: department || 'empty',
                    jobTitle: jobTitle || 'empty'
                }
            });
        }
        // PRIORITY 5: Check ALL Technology/IT criteria (Department field)
        // Technology or IT department → Tech Dashboard
        else if (
            department === 'technology' ||
            department === 'tech' ||
            department.includes('technology') ||
            department === 'it' ||
            (department.includes('it') && !department.includes('support'))
        ) {
            dashboardRoute = '/dashboard/tech';
            routeSource = 'department';
            logger.info('✅ MATCH: Tech Dashboard (checked: department)', {
                userId,
                department: employee.department,
                matchedDepartment: department,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    department: department || 'empty',
                    position: position || 'empty',
                    jobTitle: jobTitle || 'empty'
                }
            });
        }
        // PRIORITY 6: Check ALL Finance criteria (Department field)
        // Finance department → Finance Dashboard
        else if (
            department === 'finance' || 
            department.includes('finance')
        ) {
            dashboardRoute = '/dashboard-finance';
            routeSource = 'department';
            logger.info('✅ MATCH: Finance Dashboard (checked: department)', {
                userId,
                department: employee.department,
                matchedDepartment: department,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    department: department || 'empty',
                    position: position || 'empty',
                    jobTitle: jobTitle || 'empty'
                }
            });
        }
        // PRIORITY 6: Default → Employee Dashboard
        // If NO matches found, use default Employee Dashboard
        else {
            dashboardRoute = '/dashboard-employee';
            routeSource = 'default';
            logger.info('⚠️ NO MATCH: Using Employee Dashboard (default)', {
                userId,
                position: employee.position,
                department: employee.department,
                jobTitle: employee.jobTitle,
                dashboardRoute,
                routeSource,
                checkedFields: {
                    position: position || 'NOT SET',
                    department: department || 'NOT SET',
                    jobTitle: jobTitle || 'NOT SET',
                    assignedRole: employee.assignedRole ? 'exists' : 'none'
                },
                reason: 'No matching criteria found - using default employee dashboard'
            });
        }
        
        // Log comprehensive check summary
        logger.info('📊 Dashboard Routing - All Criteria Checked', {
            userId,
            allFields: {
                position: employee.position || 'NOT SET',
                department: employee.department || 'NOT SET',
                jobTitle: employee.jobTitle || 'NOT SET',
                role: employee.role || 'NOT SET',
                assignedRole: employee.assignedRole ? employee.assignedRole.name : 'NOT SET'
            },
            matchedCriteria: routeSource,
            finalRoute: dashboardRoute,
            checksPerformed: [
                '✅ Assigned Role (Priority 1)',
                '✅ HR Department/JobTitle (Priority 2)',
                '✅ Executive Position (CEO/CTO/CFO/VP) (Priority 3)',
                '✅ Manager/Director Position (Priority 4)',
                '✅ Tech Department (Priority 5)',
                '✅ Finance Department (Priority 6)',
                '✅ Default Employee (Priority 7)'
            ],
            routingDecision: {
                matched: routeSource !== 'default',
                route: dashboardRoute,
                source: routeSource
            }
        });
    } else if (userRole === 'admin') {
        const user = await User.findById(userId);
        if (user) {
            // Check if this admin user is actually an employee (cross-reference by email)
            // This handles cases where employee is logged in as admin
            const employee = await Employee.findOne({ email: user.email })
                .select('department position jobTitle role email assignedRole')
                .populate('assignedRole', 'name dashboardRoute dashboardConfig');
            if (employee) {
                // If employee exists, route based on employee's department/position
                const position = employee.position ? employee.position.toLowerCase().trim() : '';
                const department = employee.department ? employee.department.toLowerCase().trim() : '';
                const jobTitle = employee.jobTitle ? employee.jobTitle.toLowerCase().trim() : '';
                const assignedRoleObj = employee.assignedRole;
                
                // Apply same comprehensive routing logic as employee
                // Checks ALL criteria in priority order
                
                // PRIORITY 1: Check Assigned Role (if assignedRole has dashboardRoute)
                if (assignedRoleObj && assignedRoleObj.dashboardRoute) {
                    dashboardRoute = assignedRoleObj.dashboardRoute;
                    routeSource = 'assignedRole';
                    logger.info('✅ MATCH: Admin → Assigned Role Dashboard (checked: assignedRole)', {
                        userId,
                        email: user.email,
                        assignedRole: assignedRoleObj.name,
                        dashboardRoute: assignedRoleObj.dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 2: HR Department → HR Dashboard
                // Check: department field AND jobTitle field
                if (
                    department === 'hr' || 
                    department.includes('hr') || 
                    department.includes('human resource') ||
                    jobTitle.includes('hr manager') ||
                    jobTitle.includes('human resource') ||
                    jobTitle.includes('hr')
                ) {
                    dashboardRoute = '/dashboard-hr';
                    routeSource = 'department';
                    logger.info('✅ MATCH: Admin → HR Dashboard (checked: department, jobTitle)', {
                        userId,
                        email: user.email,
                        department: employee.department,
                        position: employee.position,
                        jobTitle: employee.jobTitle,
                        dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 3: CEO, CTO, CFO, VP → Administration Dashboard
                // Check: position field
                else if (
                    position === 'ceo' || 
                    position === 'cto' || 
                    position === 'cfo' || 
                    position === 'vp'
                ) {
                    dashboardRoute = '/dashboard-administration';
                    routeSource = 'position';
                    logger.info('✅ MATCH: Admin → Administration Dashboard (checked: position)', {
                        userId,
                        email: user.email,
                        position: employee.position,
                        department: employee.department,
                        dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 4: Manager/Director → Manager Dashboard
                // Check: position field
                else if (
                    position === 'manager' || 
                    position === 'director'
                ) {
                    dashboardRoute = '/dashboard-manager';
                    routeSource = 'position';
                    logger.info('✅ MATCH: Admin → Manager Dashboard (checked: position)', {
                        userId,
                        email: user.email,
                        position: employee.position,
                        department: employee.department,
                        dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 5: Tech Department → Tech Dashboard
                // Check: department field
                else if (
                    department === 'technology' ||
                    department === 'tech' ||
                    department.includes('technology') ||
                    department === 'it' ||
                    (department.includes('it') && !department.includes('support'))
                ) {
                    dashboardRoute = '/dashboard/tech';
                    routeSource = 'department';
                    logger.info('✅ MATCH: Admin → Tech Dashboard (checked: department)', {
                        userId,
                        email: user.email,
                        department: employee.department,
                        dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 6: Finance Department → Finance Dashboard
                // Check: department field
                else if (
                    department === 'finance' || 
                    department.includes('finance')
                ) {
                    dashboardRoute = '/dashboard-finance';
                    routeSource = 'department';
                    logger.info('✅ MATCH: Admin → Finance Dashboard (checked: department)', {
                        userId,
                        email: user.email,
                        department: employee.department,
                        dashboardRoute,
                        routeSource
                    });
                }
                // PRIORITY 7: Default → Employee Dashboard
                // No matches found
                else {
                    dashboardRoute = '/dashboard-employee';
                    routeSource = 'default';
                    logger.info('⚠️ NO MATCH: Admin → Employee Dashboard (default)', {
                        userId,
                        email: user.email,
                        department: employee.department,
                        position: employee.position,
                        jobTitle: employee.jobTitle,
                        dashboardRoute,
                        routeSource,
                        checkedFields: {
                            position: position || 'NOT SET',
                            department: department || 'NOT SET',
                            jobTitle: jobTitle || 'NOT SET',
                            assignedRole: employee.assignedRole ? 'exists' : 'none'
                        }
                    });
                }
                
                logger.info('📊 Admin Dashboard Routing - All Criteria Checked', {
                    userId,
                    email: user.email,
                    allFields: {
                        position: employee.position || 'NOT SET',
                        department: employee.department || 'NOT SET',
                        jobTitle: employee.jobTitle || 'NOT SET',
                        assignedRole: employee.assignedRole ? employee.assignedRole.name : 'NOT SET'
                    },
                    matchedCriteria: routeSource,
                    finalRoute: dashboardRoute
                });
            } else {
                // Original admin routing logic for non-employee admins
                const userEmail = user.email?.toLowerCase() || '';
                const isGmailUser = userEmail.endsWith('@gmail.com');
                
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
                        dashboardRoute = isGmailUser ? '/organization/dashboard' : '/dashboard-admin';
                    }
                } else {
                    dashboardRoute = isGmailUser ? '/organization/dashboard' : '/dashboard-admin';
                }
            }
        }
    }

    return sendSuccess(res, {
        dashboardRoute,
        role: userRole,
        routeSource, // Include what determined the route: 'position', 'department', 'default'
        department: employeeDetails?.department || null,
        position: employeeDetails?.position || null,
        identification: {
            position: employeeDetails?.position || null,
            department: employeeDetails?.department || null,
            reason: routeSource
        },
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

