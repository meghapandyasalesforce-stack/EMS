/**

 * Dashboard Route Helper

 * SaaS: home screen from assignedRole / functionalRoles (System Role).

 * Department name is not used. Legacy position/jobTitle only if functionalRoles empty.

 */



import Employee from '../models/employee.model.js';

import Organization from '../models/organization.model.js';

import logger from './logger.js';

import { resolveDashboardFromAccessProfile } from './dashboardAccessHelper.js';



/**

 * Get dashboard route for a user based on access profile

 * @param {string} userId - User/Employee ID

 * @param {string} role - User role ('admin' or 'employee')

 * @param {string} organizationId - Organization ID

 * @param {string} email - User email (for admin cross-reference)

 * @returns {Promise<string>} Dashboard route path

 */

export const getDashboardRouteForUser = async (userId, role, organizationId, email = null) => {

    try {

        let dashboardRoute = '/dashboard-employee';



        if (role === 'employee') {

            const employee = await Employee.findById(userId)

                .select('department position jobTitle role email functionalRoles assignedRole')

                .populate('assignedRole', 'dashboardRoute name');



            if (!employee) {

                logger.warn('Employee not found for dashboard routing', { userId });

                return dashboardRoute;

            }



            dashboardRoute = resolveDashboardFromAccessProfile({

                functionalRoles: employee.functionalRoles,

                assignedRole: employee.assignedRole,

                position: employee.position,

                jobTitle: employee.jobTitle,

                role: employee.role,

                allowLegacyJobStrings: true,

            });



            logger.debug('Dashboard route from access profile', {

                userId,

                dashboardRoute,

                functionalRoles: employee.functionalRoles,

            });

        } else if (role === 'admin') {

            if (email) {

                const employee = await Employee.findOne({ email: email.toLowerCase().trim() })

                    .select('position jobTitle role functionalRoles assignedRole')

                    .populate('assignedRole', 'dashboardRoute name');

                if (employee) {

                    dashboardRoute = resolveDashboardFromAccessProfile({

                        functionalRoles: employee.functionalRoles,

                        assignedRole: employee.assignedRole,

                        position: employee.position,

                        jobTitle: employee.jobTitle,

                        role: 'admin',

                        allowLegacyJobStrings: true,

                    });

                    // Prefer admin home when they have no elevated functional roles

                    if (

                        dashboardRoute === '/dashboard-employee' ||

                        dashboardRoute === '/dashboard-admin'

                    ) {

                        // keep checking org admin below if needed

                    } else {

                        logger.debug('Admin with employee access profile', {

                            userId,

                            dashboardRoute,

                        });

                        return dashboardRoute;

                    }

                }

            }



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



            dashboardRoute = '/dashboard-admin';

            logger.debug('Default Admin Dashboard', { userId });

        }



        return dashboardRoute;

    } catch (error) {

        logger.error('Error determining dashboard route', {

            userId,

            role,

            error: error.message,

            stack: error.stack,

        });

        return role === 'admin' ? '/dashboard-admin' : '/dashboard-employee';

    }

};



/**

 * Get dashboard route synchronously based on role only (fallback)

 */

export const getDashboardRouteByRole = (role, email = '') => {

    const userEmail = email.toLowerCase();

    const isGmailUser = userEmail.endsWith('@gmail.com');



    if (role === 'admin') {

        if (isGmailUser) {

            return '/organization/dashboard';

        }

        return '/dashboard-admin';

    }

    if (role === 'hr_manager') {

        return '/dashboard-hr';

    }

    if (role === 'manager') {

        return '/dashboard-manager';

    }

    if (role === 'finance') {

        return '/dashboard-finance';

    }

    return '/dashboard-employee';

};


