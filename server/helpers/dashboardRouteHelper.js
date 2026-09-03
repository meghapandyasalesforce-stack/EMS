/**
 * Dashboard Route Helper
 * Determines the correct dashboard route based on user role, position, and department
 * Used in login responses to provide automatic redirection
 */

import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Organization from '../models/organization.model.js';
import logger from './logger.js';

/**
 * Get dashboard route for a user based on role, position, and department
 * @param {string} userId - User/Employee ID
 * @param {string} role - User role ('admin' or 'employee')
 * @param {string} organizationId - Organization ID
 * @param {string} email - User email (for admin cross-reference)
 * @returns {Promise<string>} Dashboard route path
 */
export const getDashboardRouteForUser = async (userId, role, organizationId, email = null) => {
    try {
        let dashboardRoute = '/dashboard-employee'; // Default fallback
        
        if (role === 'employee') {
            const employee = await Employee.findById(userId)
                .select('department position jobTitle role email functionalRoles assignedRole')
                .populate('assignedRole', 'dashboardRoute name');
            
            if (!employee) {
                logger.warn('Employee not found for dashboard routing', { userId });
                return dashboardRoute;
            }

            if (employee.assignedRole?.dashboardRoute) {
                return employee.assignedRole.dashboardRoute;
            }

            const functional = new Set(
                (employee.functionalRoles || []).map((r) => String(r).toLowerCase())
            );
            const position = employee.position ? employee.position.toLowerCase().trim() : '';
            const jobTitle = employee.jobTitle ? employee.jobTitle.toLowerCase().trim() : '';

            if (
                functional.has('executive') ||
                functional.has('ceo') ||
                functional.has('cto') ||
                functional.has('cfo') ||
                functional.has('vp') ||
                position === 'ceo' ||
                position === 'cto' ||
                position === 'cfo' ||
                position === 'vp'
            ) {
                dashboardRoute = '/dashboard-administration';
            } else if (functional.has('hr')) {
                dashboardRoute = '/dashboard-hr';
            } else if (functional.has('finance')) {
                dashboardRoute = '/dashboard-finance';
            } else if (functional.has('project_manager') || jobTitle === 'project manager') {
                dashboardRoute = '/dashboard-manager';
            } else if (
                functional.has('manager') ||
                position === 'manager' ||
                position === 'director'
            ) {
                dashboardRoute = '/dashboard-manager';
            } else {
                dashboardRoute = '/dashboard-employee';
            }

            logger.debug('Dashboard route from functional roles', {
                userId,
                dashboardRoute,
                functionalRoles: employee.functionalRoles,
            });
        } 
        else if (role === 'admin') {
            // Check if admin is also an employee
            if (email) {
                const employee = await Employee.findOne({ email: email.toLowerCase().trim() });
                if (employee) {
                    // Use employee routing logic
                    const position = employee.position ? employee.position.toLowerCase().trim() : '';
                    const department = employee.department ? employee.department.toLowerCase().trim() : '';
                    const jobTitle = employee.jobTitle ? employee.jobTitle.toLowerCase().trim() : '';
                    
                    // Apply same priority logic as employee
                    if (
                        department === 'hr' || 
                        department.includes('hr') || 
                        department.includes('human resource') ||
                        jobTitle.includes('hr manager') ||
                        jobTitle.includes('human resource') ||
                        jobTitle.includes('hr')
                    ) {
                        dashboardRoute = '/dashboard/hr';
                    } else if (position === 'ceo' || position === 'cto' || position === 'cfo' || position === 'vp') {
                        dashboardRoute = '/dashboard-administration';
                    } else if (jobTitle === 'project manager') {
                        dashboardRoute = '/dashboard-manager';
                    } else if (position === 'manager' || position === 'director') {
                        dashboardRoute = '/dashboard/manager';
                    } else if (
                        department === 'technology' ||
                        department === 'tech' ||
                        department.includes('technology') ||
                        department === 'it' ||
                        (department.includes('it') && !department.includes('support'))
                    ) {
                        dashboardRoute = '/dashboard/tech';
                    } else if (department === 'finance' || department.includes('finance')) {
                        dashboardRoute = '/dashboard/finance';
                    } else {
                        dashboardRoute = '/dashboard-admin';
                    }
                    
                    logger.debug('Admin with employee record - using employee routing', { 
                        userId, 
                        dashboardRoute,
                        position,
                        department 
                    });
                    return dashboardRoute;
                }
            }
            
            // Check if organization admin (Gmail or organization email)
            if (organizationId) {
                const organization = await Organization.findById(organizationId);
                if (organization && email) {
                    const orgEmail = organization.email?.toLowerCase() || '';
                    const userEmail = email.toLowerCase();
                    const isGmailUser = userEmail.endsWith('@gmail.com');
                    
                    if (orgEmail === userEmail || isGmailUser) {
                        dashboardRoute = '/organization/dashboard';
                        logger.debug('Organization admin dashboard', { userId, organizationId });
                        return dashboardRoute;
                    }
                }
            }
            
            // Default admin dashboard
            dashboardRoute = '/dashboard-admin';
            logger.debug('Default Admin Dashboard', { userId });
        }
        
        return dashboardRoute;
    } catch (error) {
        logger.error('Error determining dashboard route', { 
            userId, 
            role, 
            error: error.message,
            stack: error.stack 
        });
        // Return safe default based on role
        return role === 'admin' ? '/dashboard-admin' : '/dashboard-employee';
    }
};

/**
 * Get dashboard route synchronously based on role only (fallback)
 * Used when database lookup is not available
 * @param {string} role - User role
 * @param {string} email - User email (for organization detection)
 * @returns {string} Dashboard route path
 */
export const getDashboardRouteByRole = (role, email = '') => {
    const userEmail = email.toLowerCase();
    const isGmailUser = userEmail.endsWith('@gmail.com');
    
    if (role === 'admin') {
        // Organization admins (Gmail users) go to organization dashboard
        if (isGmailUser) {
            return '/organization/dashboard';
        }
        return '/dashboard-admin';
    } else if (role === 'hr_manager') {
        return '/dashboard/hr';
    } else if (role === 'manager') {
        return '/dashboard/manager';
    } else if (role === 'finance') {
        return '/dashboard/finance';
    } else {
        return '/dashboard-employee';
    }
};

