import Employee from '../models/employee.model.js';
import logger from './logger.js';

/**
 * Get dashboard type from database for a user
 * Priority: 1. Assigned Role → 2. Department/Position from DB → 3. Fallback Logic
 * @param {string} userId - Employee ID
 * @param {string} department - Employee department (for fallback)
 * @param {string} position - Employee position (for fallback)
 * @returns {Promise<string>} dashboardType (e.g., "HR_DASHBOARD", "CEO_DASHBOARD")
 */
export const getDashboardForUserFromDB = async (userId, department, position) => {
    try {
        // PRIORITY 1: Check assignedRole from database
        const employee = await Employee.findById(userId)
            .select('assignedRole department position')
            .populate('assignedRole', 'dashboardRoute name');
        
        if (employee?.assignedRole?.dashboardRoute) {
            // Map dashboardRoute to dashboardType
            const route = employee.assignedRole.dashboardRoute;
            const routeToTypeMap = {
                '/dashboard/hr': 'HR_DASHBOARD',
                '/dashboard-hr': 'HR_DASHBOARD',
                '/dashboard/finance': 'FINANCE_DASHBOARD',
                '/dashboard-finance': 'FINANCE_DASHBOARD',
                '/dashboard/tech': 'TECH_DASHBOARD',
                '/dashboard/ceo': 'CEO_DASHBOARD',
                '/dashboard-administration': 'CEO_DASHBOARD',
                '/dashboard/manager': 'MANAGER_DASHBOARD',
                '/dashboard-manager': 'MANAGER_DASHBOARD',
                '/dashboard-employee': 'EMPLOYEE_DASHBOARD',
                '/dashboard-admin': 'ADMIN_DASHBOARD',
                '/organization/dashboard': 'ORGANIZATION_DASHBOARD'
            };
            
            const dashboardType = routeToTypeMap[route] || 'EMPLOYEE_DASHBOARD';
            
            logger.info('Dashboard type from assigned role in database', {
                userId,
                roleName: employee.assignedRole.name,
                dashboardRoute: route,
                dashboardType
            });
            
            return dashboardType;
        }
        
        // PRIORITY 2: Check department/position from database and use fallback logic
        const dept = (employee?.department || department || '').trim();
        const pos = (employee?.position || position || '').trim();
        
        logger.info('No assigned role found, using department/position from database', {
            userId,
            department: dept,
            position: pos,
            departmentType: typeof dept,
            positionType: typeof pos
        });
        
        const dashboardType = getDashboardForUser(dept, pos);
        
        logger.info('Dashboard type determined from department/position', {
            userId,
            department: dept,
            position: pos,
            dashboardType
        });
        
        return dashboardType;
        
    } catch (error) {
        logger.error('Error fetching dashboard from database', {
            userId,
            error: error.message,
            stack: error.stack
        });
        
        // Fallback to department/position logic
        return getDashboardForUser(department, position);
    }
};

/**
 * Fallback: Get dashboard type based on Department or Position
 * Returns dashboardType string that maps to frontend routes
 * @param {string} department - Employee department
 * @param {string} position - Employee position
 * @returns {string} dashboardType (e.g., "HR_DASHBOARD", "CEO_DASHBOARD")
 */
export const getDashboardForUser = (department, position) => {
    // Normalize inputs - handle null, undefined, and empty strings
    const dept = (department && typeof department === 'string') ? department.trim() : '';
    const pos = (position && typeof position === 'string') ? position.trim() : '';
    
    // Normalize to lowercase for comparison
    const deptLower = dept.toLowerCase();
    const posLower = pos.toLowerCase();
    
    // Check Department first (flexible matching for variations)
    // HR Department matching - handles "HR", "Human Resources", "Human Resource", etc.
    if (dept && (
        deptLower === 'hr' ||
        deptLower.includes('hr') ||
        deptLower === 'human resources' ||
        deptLower === 'human resource' ||
        deptLower.includes('human resource')
    )) {
        logger.debug('HR Dashboard matched by department', { department: dept, normalized: deptLower });
        return 'HR_DASHBOARD';
    }
    
    // Finance Department matching
    if (dept && (
        deptLower === 'finance' ||
        deptLower.includes('finance')
    )) {
        logger.debug('Finance Dashboard matched by department', { department: dept, normalized: deptLower });
        return 'FINANCE_DASHBOARD';
    }
    
    // Technology Department matching - handles "Technology", "Tech", "IT", etc.
    if (dept && (
        deptLower === 'technology' ||
        deptLower === 'tech' ||
        deptLower.includes('technology') ||
        deptLower === 'it' ||
        (deptLower.includes('it') && !deptLower.includes('support'))
    )) {
        logger.debug('Tech Dashboard matched by department', { department: dept, normalized: deptLower });
        return 'TECH_DASHBOARD';
    }
    
    // Check Position (exact match, case-insensitive)
    if (pos && (
        posLower === 'ceo' ||
        posLower === 'chief executive officer'
    )) {
        logger.debug('CEO Dashboard matched by position', { position: pos, normalized: posLower });
        return 'CEO_DASHBOARD';
    }
    
    if (pos && (
        posLower === 'manager' ||
        posLower.includes('manager') ||
        posLower === 'director' ||
        posLower.includes('director')
    )) {
        logger.debug('Manager Dashboard matched by position', { position: pos, normalized: posLower });
        return 'MANAGER_DASHBOARD';
    }
    
    // Default: No match found
    logger.debug('No dashboard match found, using default', { department: dept, position: pos });
    return 'EMPLOYEE_DASHBOARD';
};

