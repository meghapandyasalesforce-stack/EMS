import Organization from '../../models/organization.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import Attendance from '../../models/attendance.model.js';
import Leave from '../../models/leave.model.js';
import Payroll from '../../models/payroll.model.js';
import Project from '../../models/project.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import mongoose from 'mongoose';

/**
 * Get organization profile
 * @route GET /api/v1/admin/organization/profile
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {string} req.user.organizationId - Organization ID from JWT token
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Organization profile
 * @returns {Object} 400 - Organization ID is required
 * @returns {Object} 404 - Organization not found
 * @returns {Object} 500 - Server error
 */
export const getOrganizationProfile = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400);
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        return sendSuccess(res, {
            organization: organization
        }, 'Organization profile retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization profile', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch organization profile', 500);
    }
};

/**
 * Update organization profile
 * @route PUT /api/v1/admin/organization/profile
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.name] - Organization name
 * @param {string} [req.body.email] - Organization email
 * @param {string} [req.body.phone] - Organization phone
 * @param {Object} [req.body.address] - Organization address
 * @param {string} [req.body.domain] - Organization domain
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Updated organization profile
 * @returns {Object} 400 - Validation error or duplicate field
 * @returns {Object} 404 - Organization not found
 * @returns {Object} 500 - Server error
 */
export const updateOrganizationProfile = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const {
            name,
            email,
            phone,
            address,
            domain
        } = req.body;

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Update fields
        if (name !== undefined) organization.name = name.trim();
        if (phone !== undefined) organization.phone = phone?.trim();
        if (address !== undefined) organization.address = { ...organization.address, ...address };
        if (domain !== undefined) {
            // Validate domain if provided
            if (domain && domain.trim()) {
                const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
                if (!domainRegex.test(domain)) {
                    return sendError(res, 'Invalid domain format', 400);
                }
                // Check if domain is already taken by another organization
                const existingDomain = await Organization.findOne({
                    domain: domain.toLowerCase().trim(),
                    _id: { $ne: organizationId }
                });
                if (existingDomain) {
                    return sendError(res, 'This domain is already registered', 400);
                }
                organization.domain = domain.toLowerCase().trim();
            } else {
                organization.domain = undefined;
            }
        }

        // Email update requires special handling (also update admin user email)
        if (email !== undefined && email !== organization.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return sendError(res, 'Invalid email format', 400);
            }

            // Check if email is already taken
            const existingOrg = await Organization.findOne({
                email: email.toLowerCase().trim(),
                _id: { $ne: organizationId }
            });
            if (existingOrg) {
                return sendError(res, 'Email already registered to another organization', 400);
            }

            organization.email = email.toLowerCase().trim();

            // Update admin user email
            const adminUser = await User.findOne({
                organizationId: organizationId,
                role: 'admin'
            });
            if (adminUser) {
                adminUser.email = email.toLowerCase().trim();
                await adminUser.save();
            }
        }

        await organization.save();

        logger.info('Organization profile updated', { organizationId: organization._id });

        return sendSuccess(res, {
            organization: organization
        }, 'Organization profile updated successfully');
    } catch (error) {
        logger.error('Error updating organization profile', { error: error.message });
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return sendError(res, `${field} already exists`, 400);
        }
        return sendError(res, error.message || 'Failed to update organization profile', 500);
    }
};

/**
 * Upload organization logo
 */
export const uploadOrganizationLogo = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        if (!req.file) {
            return sendError(res, 'No file uploaded', 400);
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Update logo
        organization.logo = {
            url: `/uploads/${req.file.filename}`,
            filename: req.file.filename,
            uploadedAt: new Date()
        };

        await organization.save();

        logger.info('Organization logo uploaded', { organizationId: organization._id });

        return sendSuccess(res, {
            logo: organization.logo
        }, 'Logo uploaded successfully');
    } catch (error) {
        logger.error('Error uploading organization logo', { error: error.message });
        return sendError(res, error.message || 'Failed to upload logo', 500);
    }
};

/**
 * Delete organization logo
 */
export const deleteOrganizationLogo = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        organization.logo = undefined;
        await organization.save();

        logger.info('Organization logo deleted', { organizationId: organization._id });

        return sendSuccess(res, {}, 'Logo deleted successfully');
    } catch (error) {
        logger.error('Error deleting organization logo', { error: error.message });
        return sendError(res, error.message || 'Failed to delete logo', 500);
    }
};

/**
 * Update organization settings
 */
export const updateOrganizationSettings = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const {
            allowEmployeeRegistration,
            requireEmailVerification,
            allowSelfService
        } = req.body;

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Update settings
        if (allowEmployeeRegistration !== undefined) {
            organization.settings.allowEmployeeRegistration = allowEmployeeRegistration;
        }
        if (requireEmailVerification !== undefined) {
            organization.settings.requireEmailVerification = requireEmailVerification;
        }
        if (allowSelfService !== undefined) {
            organization.settings.allowSelfService = allowSelfService;
        }

        await organization.save();

        logger.info('Organization settings updated', { organizationId: organization._id });

        return sendSuccess(res, {
            settings: organization.settings
        }, 'Organization settings updated successfully');
    } catch (error) {
        logger.error('Error updating organization settings', { error: error.message });
        return sendError(res, error.message || 'Failed to update settings', 500);
    }
};

/**
 * Update subscription plan
 */
export const updateSubscriptionPlan = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { subscriptionPlan, maxEmployees } = req.body;

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Validate subscription plan
        const validPlans = ['free', 'basic', 'premium', 'enterprise'];
        if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
            return sendError(res, 'Invalid subscription plan', 400);
        }

        // Update subscription plan
        if (subscriptionPlan) {
            organization.subscriptionPlan = subscriptionPlan;

            // Set employee limits based on plan
            const planLimits = {
                free: 10,
                basic: 50,
                premium: 200,
                enterprise: 1000
            };
            organization.maxEmployees = maxEmployees || planLimits[subscriptionPlan] || organization.maxEmployees;
        }

        if (maxEmployees !== undefined && subscriptionPlan) {
            organization.maxEmployees = maxEmployees;
        }

        await organization.save();

        logger.info('Subscription plan updated', { 
            organizationId: organization._id,
            plan: organization.subscriptionPlan
        });

        return sendSuccess(res, {
            organization: {
                subscriptionPlan: organization.subscriptionPlan,
                maxEmployees: organization.maxEmployees
            }
        }, 'Subscription plan updated successfully');
    } catch (error) {
        logger.error('Error updating subscription plan', { error: error.message });
        return sendError(res, error.message || 'Failed to update subscription plan', 500);
    }
};

/**
 * Get organization statistics
 */
export const getOrganizationStatistics = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, {});

        // Get counts
        const [
            totalEmployees,
            activeEmployees,
            totalUsers,
            totalAttendances,
            totalLeaves,
            totalPayrolls,
            totalProjects,
            pendingLeaves
        ] = await Promise.all([
            Employee.countDocuments(query),
            Employee.countDocuments({ ...query, status: 'active' }),
            User.countDocuments(query),
            Attendance.countDocuments(query),
            Leave.countDocuments(query),
            Payroll.countDocuments(query),
            Project.countDocuments(query),
            Leave.countDocuments({ ...query, status: 'pending' })
        ]);

        // Get organization
        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
        }

        // Calculate employee usage percentage
        // Handle case where maxEmployees might be undefined or null
        const maxEmployees = organization.maxEmployees || 0;
        const employeeUsage = maxEmployees > 0
            ? ((totalEmployees / maxEmployees) * 100).toFixed(1)
            : 0;

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentAttendances = await Attendance.countDocuments({
            ...query,
            createdAt: { $gte: sevenDaysAgo }
        });

        const recentLeaves = await Leave.countDocuments({
            ...query,
            createdAt: { $gte: sevenDaysAgo }
        });

        // Department distribution
        const departmentStats = await Employee.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Attendance statistics
        const attendanceStats = await Attendance.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Leave statistics by type
        const leaveStats = await Leave.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$leaveType',
                    count: { $sum: 1 },
                    totalDays: { $sum: '$duration' }
                }
            }
        ]);

        return sendSuccess(res, {
            statistics: {
                employees: {
                    total: totalEmployees,
                    active: activeEmployees,
                    inactive: totalEmployees - activeEmployees,
                    usage: parseFloat(employeeUsage),
                    limit: maxEmployees
                },
                users: {
                    total: totalUsers
                },
                attendance: {
                    total: totalAttendances,
                    recent: recentAttendances,
                    byStatus: attendanceStats
                },
                leaves: {
                    total: totalLeaves,
                    pending: pendingLeaves,
                    recent: recentLeaves,
                    byType: leaveStats
                },
                payroll: {
                    total: totalPayrolls
                },
                projects: {
                    total: totalProjects
                },
                departments: departmentStats,
                subscription: {
                    plan: organization.subscriptionPlan || 'free',
                    maxEmployees: maxEmployees,
                    employeeUsage: parseFloat(employeeUsage)
                }
            }
        }, 'Organization statistics retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization statistics', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch statistics', 500);
    }
};

/**
 * Get all organization users
 */
export const getOrganizationUsers = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const { page = 1, limit = 20, role, search } = req.query;

        const query = addOrganizationFilter(req, {});

        if (role) {
            query.role = role;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(query)
        ]);

        return sendSuccess(res, {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }, 'Organization users retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization users', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch users', 500);
    }
};

/**
 * Get organization activity/logs
 */
export const getOrganizationActivity = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Validate organizationId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(organizationId)) {
            return sendError(res, 'Invalid organization ID format', 400, 'INVALID_ORGANIZATION_ID');
        }

        const { page = 1, limit = 50, startDate, endDate } = req.query;

        // Build base query with organizationId
        const baseQuery = { organizationId: new mongoose.Types.ObjectId(organizationId) };

        // Add date filter if provided
        if (startDate || endDate) {
            baseQuery.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    baseQuery.createdAt.$gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    baseQuery.createdAt.$lte = end;
                }
            }
        }

        const limitNum = Math.min(parseInt(limit) || 10, 100); // Cap at 100
        const skip = (Math.max(parseInt(page), 1) - 1) * limitNum;

        // Get recent employees
        let recentEmployees = [];
        try {
            recentEmployees = await Employee.find(baseQuery)
                .select('name email department joiningDate createdAt')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .lean();
        } catch (error) {
            logger.warn('Error fetching recent employees for activity', { error: error.message });
        }

        // Get recent attendances (userId in Attendance model references Employee)
        let recentAttendances = [];
        try {
            recentAttendances = await Attendance.find(baseQuery)
                .populate({
                    path: 'userId',
                    select: 'name email',
                    model: 'Employee',
                    options: { strictPopulate: false }
                })
                .select('userId date clockIn clockOut status createdAt')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .lean();
        } catch (error) {
            logger.warn('Error fetching recent attendances for activity', { error: error.message });
        }

        // Get recent leaves
        let recentLeaves = [];
        try {
            recentLeaves = await Leave.find(baseQuery)
                .populate({
                    path: 'employee',
                    select: 'name email',
                    model: 'Employee',
                    options: { strictPopulate: false }
                })
                .select('employee leaveType startDate endDate status createdAt')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .lean();
        } catch (error) {
            logger.warn('Error fetching recent leaves for activity', { error: error.message });
        }

        return sendSuccess(res, {
            activity: {
                recentEmployees: recentEmployees || [],
                recentAttendances: recentAttendances || [],
                recentLeaves: recentLeaves || []
            },
            pagination: {
                page: Math.max(parseInt(page), 1),
                limit: limitNum
            }
        }, 'Organization activity retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization activity', { 
            error: error.message, 
            stack: error.stack,
            organizationId: req.organizationId || req.user?.organizationId || req.employee?.organizationId
        });
        return sendError(res, error.message || 'Failed to fetch activity', 500);
    }
};

