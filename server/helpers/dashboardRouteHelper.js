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
                .select('department position jobTitle role email');
            
            if (!employee) {
                logger.warn('Employee not found for dashboard routing', { userId });
                return dashboardRoute;
            }
            
            const position = employee.position ? employee.position.toLowerCase().trim() : '';
            const department = employee.department ? employee.department.toLowerCase().trim() : '';
            const jobTitle = employee.jobTitle ? employee.jobTitle.toLowerCase().trim() : '';
            
            // PRIORITY 1: HR Department/JobTitle → HR Dashboard
            if (
                department === 'hr' || 
                department.includes('hr') || 
                department.includes('human resource') ||
                jobTitle.includes('hr manager') ||
                jobTitle.includes('human resource') ||
                jobTitle.includes('hr')
            ) {
                dashboardRoute = '/dashboard/hr';
                logger.debug('HR Dashboard matched', { userId, department, jobTitle });
            }
            // PRIORITY 2: Executive positions → Administration Dashboard
            else if (
                position === 'ceo' || 
                position === 'cto' || 
                position === 'cfo' || 
                position === 'vp'
            ) {
                dashboardRoute = '/dashboard-administration';
                logger.debug('Executive Dashboard matched', { userId, position });
            }
            // PRIORITY 3: Project Manager → Projects workspace
            else if (jobTitle === 'project manager') {
                dashboardRoute = '/dashboard-manager';
                logger.debug('Project Manager dashboard matched', { userId, jobTitle });
            }
            // PRIORITY 4: Manager / Director → Manager Dashboard
            else if (
                position === 'manager' ||
                position === 'director'
            ) {
                dashboardRoute = '/dashboard/manager';
                logger.debug('Manager Dashboard matched', { userId, position, jobTitle });
            }
            // PRIORITY 4: Tech Department → Tech Dashboard
            else if (
                department === 'technology' ||
                department === 'tech' ||
                department.includes('technology') ||
                department === 'it' ||
                (department.includes('it') && !department.includes('support'))
            ) {
                dashboardRoute = '/dashboard/tech';
                logger.debug('Tech Dashboard matched', { userId, department });
            }
            // PRIORITY 5: Finance Department → Finance Dashboard
            else if (department === 'finance' || department.includes('finance')) {
                dashboardRoute = '/dashboard/finance';
                logger.debug('Finance Dashboard matched', { userId, department });
            }
            // PRIORITY 6: Default → Employee Dashboard
            else {
                dashboardRoute = '/dashboard-employee';
                logger.debug('Default Employee Dashboard', { userId });
            }
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

