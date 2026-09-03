import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
import { invalidateEmployeesCache } from '../../helpers/cacheHelper.js';
import { autoGenerateIdCard } from '../admin/idCardController.js';
import mongoose from 'mongoose';
import { isValidTimezone } from '../../constants/timezoneOptions.js';
import { clearPayrollGenerationCaches } from '../../helpers/payrollGenerationHelper.js';
import { migrateOrganizationEmployeeIds } from '../../helpers/employeeIdHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        // Remove previous logo file from disk if it exists
        if (organization.logo?.filename) {
            const oldLogoPath = path.join(__dirname, '../../uploads/logos', organization.logo.filename);
            try {
                await fs.promises.unlink(oldLogoPath);
                logger.info('Previous organization logo removed', { organizationId: organization._id, filename: organization.logo.filename });
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    logger.warn('Could not delete previous logo file', { path: oldLogoPath, error: err.message });
                }
            }
        }

        // Update logo
        // Files are stored in uploads/logos, so expose that full relative path
        organization.logo = {
            url: `/uploads/logos/${req.file.filename}`,
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
            allowSelfService,
            employeeIdPrefix,
            employeeIdStartNumber,
            employeeIdMinDigits,
            timezone,
            tdsCalculationMode,
            allowWorkFromHome,
            allowProbationAfterJoining,
            allowNonWorkingDayPunch,
            approvalSlaHours,
            payrollSettings,
        } = req.body;

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Store old settings to detect changes
        const oldPrefix = organization.settings?.employeeIdPrefix || null;
        const oldMinDigits = organization.settings?.employeeIdMinDigits || 3;
        const oldNextNumber = organization.settings?.employeeIdNextNumber || null;

        // Determine new values
        const newPrefix = employeeIdPrefix !== undefined 
            ? (employeeIdPrefix?.trim() ? employeeIdPrefix.trim().toUpperCase() : null)
            : oldPrefix;
        const newMinDigits = employeeIdMinDigits !== undefined 
            ? employeeIdMinDigits 
            : oldMinDigits;
        const newStartNumber = employeeIdStartNumber !== undefined 
            ? employeeIdStartNumber 
            : oldNextNumber;

        // Check if employee ID format is being changed
        // Migration should run if:
        // 1. Prefix is being set/changed (including first time setting)
        // 2. Min digits is being changed
        // 3. Start number is being changed
        const formatChanged = (
            employeeIdPrefix !== undefined && newPrefix !== oldPrefix
        ) || (
            employeeIdMinDigits !== undefined && newMinDigits !== oldMinDigits
        ) || (
            employeeIdStartNumber !== undefined && newStartNumber !== oldNextNumber
        );
        
        // Also check if we're setting a prefix for the first time (migrating from legacy format)
        const isFirstTimePrefix = !oldPrefix && newPrefix && employeeIdPrefix !== undefined;

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
        if (employeeIdPrefix !== undefined) {
            organization.settings.employeeIdPrefix = newPrefix;
        }
        if (employeeIdMinDigits !== undefined) {
            organization.settings.employeeIdMinDigits = newMinDigits;
        }
        if (employeeIdStartNumber !== undefined) {
            organization.settings.employeeIdNextNumber = newStartNumber;
        }
        if (tdsCalculationMode !== undefined) {
            if (!organization.settings) organization.settings = {};
            organization.settings.tdsCalculationMode = tdsCalculationMode;
        }
        if (allowWorkFromHome !== undefined) {
            if (!organization.settings) organization.settings = {};
            organization.settings.allowWorkFromHome = !!allowWorkFromHome;
        }
        if (allowProbationAfterJoining !== undefined) {
            if (!organization.settings) organization.settings = {};
            organization.settings.allowProbationAfterJoining = !!allowProbationAfterJoining;
        }
        if (allowNonWorkingDayPunch !== undefined) {
            if (!organization.settings) organization.settings = {};
            organization.settings.allowNonWorkingDayPunch = !!allowNonWorkingDayPunch;
        }
        if (approvalSlaHours !== undefined) {
            if (!organization.settings) organization.settings = {};
            organization.settings.approvalSlaHours = Number(approvalSlaHours);
        }
        if (payrollSettings !== undefined && payrollSettings && typeof payrollSettings === 'object') {
            if (!organization.settings) organization.settings = {};
            if (!organization.settings.payrollSettings) organization.settings.payrollSettings = {};
            const { calculationMode, minHoursForFullDay, minHoursForHalfDay, markHalfDayIfLate } = payrollSettings;
            if (calculationMode !== undefined) {
                organization.settings.payrollSettings.calculationMode = calculationMode;
            }
            if (minHoursForFullDay !== undefined) {
                organization.settings.payrollSettings.minHoursForFullDay = Number(minHoursForFullDay);
            }
            if (minHoursForHalfDay !== undefined) {
                organization.settings.payrollSettings.minHoursForHalfDay = Number(minHoursForHalfDay);
            }
            if (markHalfDayIfLate !== undefined) {
                organization.settings.payrollSettings.markHalfDayIfLate = !!markHalfDayIfLate;
            }
        }
        if (timezone !== undefined) {
            if (!isValidTimezone(timezone)) {
                return sendError(res, 'Invalid timezone', 400);
            }
            organization.timezone = timezone.trim();
        }

        // Variables to track ID card generation stats (declared at function level)
        let idCardsGenerated = 0;
        let idCardsFailed = 0;

        // If format changed and new prefix is set, migrate all employees
        // Also migrate if setting prefix for the first time (from legacy format)
        let employeeIdMigration = { migrated: false };
        if ((formatChanged || isFirstTimePrefix) && newPrefix) {
            try {
                logger.info('Employee ID format changed, starting migration', {
                    organizationId,
                    oldPrefix,
                    newPrefix,
                    oldMinDigits,
                    newMinDigits,
                    oldNextNumber,
                    newStartNumber
                });

                employeeIdMigration = await migrateOrganizationEmployeeIds(Employee, {
                    organizationId,
                    prefix: newPrefix,
                    minDigits: newMinDigits,
                    startNumber: newStartNumber || 1,
                });

                organization.settings.employeeIdNextNumber = employeeIdMigration.nextNumber;

                if (employeeIdMigration.count > 0) {
                    await invalidateEmployeesCache(organizationId);
                }

                if (employeeIdMigration.migrated) {
                    try {
                        const migratedEmployees = await Employee.find({ organizationId })
                            .select('_id')
                            .lean();

                        logger.info('Starting auto-generation of ID cards for migrated employees', {
                            organizationId,
                            totalEmployees: migratedEmployees.length
                        });

                        const adminUser = await User.findOne({
                            organizationId,
                            role: 'admin'
                        }).select('_id').lean();

                        const generatedBy = adminUser?._id || null;
                        const idCardBatchSize = 10;
                        for (let i = 0; i < migratedEmployees.length; i += idCardBatchSize) {
                            const batch = migratedEmployees.slice(i, i + idCardBatchSize);

                            await Promise.allSettled(
                                batch.map(async (emp) => {
                                    const result = await autoGenerateIdCard(
                                        emp._id,
                                        organizationId,
                                        generatedBy
                                    );

                                    if (result.success) {
                                        idCardsGenerated++;
                                    } else if (result.reason !== 'already_exists') {
                                        idCardsFailed++;
                                        logger.warn('Failed to auto-generate ID card during migration', {
                                            employeeId: emp._id,
                                            reason: result.reason
                                        });
                                    }
                                })
                            );
                        }

                        logger.info('ID card auto-generation completed during migration', {
                            organizationId,
                            totalEmployees: migratedEmployees.length,
                            idCardsGenerated,
                            idCardsFailed
                        });
                    } catch (idCardGenError) {
                        logger.error('Error during ID card auto-generation in migration', {
                            error: idCardGenError.message,
                            organizationId
                        });
                    }
                }
            } catch (migrationError) {
                logger.error('Error migrating employee IDs', {
                    error: migrationError.message,
                    organizationId,
                    stack: migrationError.stack
                });
                return sendError(res, `Employee ID migration failed: ${migrationError.message}`, 500);
            }
        }

        await organization.save();

        // Payroll generation caches (incl. TDS mode) — invalidate after settings change.
        clearPayrollGenerationCaches({ organizationId });

        // ID card stats are already tracked in idCardsGenerated and idCardsFailed variables above
        // They are updated during migration if migration occurred

        const migrationCompleted = Boolean(employeeIdMigration.migrated);

        logger.info('Organization settings updated', { 
            organizationId: organization._id,
            migrationCompleted,
            migrationReason: employeeIdMigration.reason,
            tdsCalculationMode: organization.settings?.tdsCalculationMode,
            idCardsGenerated,
            idCardsFailed
        });

        const response = {
            settings: organization.settings,
            timezone: organization.timezone,
            migrationCompleted,
        };

        // Include ID card generation stats if migration occurred
        if (formatChanged && newPrefix) {
            response.idCardsGenerated = idCardsGenerated;
            response.idCardsFailed = idCardsFailed;
        }

        return sendSuccess(
            res,
            response,
            employeeIdMigration.migrated
                ? `Organization settings updated successfully. All employee IDs have been migrated to the new format. ${idCardsGenerated} ID cards have been auto-generated.`
                : 'Organization settings updated successfully'
        );
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
 * Get organization branding / theme settings
 * @route GET /api/v1/admin/organization/branding
 * @access Private (Admin only)
 */
export const getOrganizationBranding = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400);
        }

        const organization = await Organization.findById(organizationId).select('branding themePresets');

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        return sendSuccess(res, {
            branding: organization.branding || {},
            themePresets: organization.themePresets || []
        }, 'Organization branding retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization branding', { error: error.message });
        return sendError(res, error.message || 'Failed to fetch organization branding', 500);
    }
};

/**
 * Update organization branding / theme settings
 * @route PUT /api/v1/admin/organization/branding
 * @access Private (Admin only)
 */
export const updateOrganizationBranding = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);
        const {
            primaryColor,
            secondaryColor,
            theme,
            accentColor,
            backgroundColor,
            textColor,
            savePreset,
            applyPreset
        } = req.body;

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400);
        }

        const organization = await Organization.findById(organizationId);

        if (!organization) {
            return sendError(res, 'Organization not found', 404);
        }

        // Basic hex color validation helper
        const isHexColor = (value) => {
            if (!value) return false;
            return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
        };

        // Ensure branding and themePresets exist
        if (!organization.branding) {
            organization.branding = {};
        }
        if (!organization.themePresets) {
            organization.themePresets = [];
        }

        // Apply a saved preset by index
        if (typeof applyPreset === 'number' && applyPreset >= 0 && organization.themePresets[applyPreset]) {
            const preset = organization.themePresets[applyPreset];
            if (preset.primaryColor) organization.branding.primaryColor = preset.primaryColor;
            if (preset.secondaryColor) organization.branding.secondaryColor = preset.secondaryColor;
            if (preset.accentColor) organization.branding.accentColor = preset.accentColor;
            if (preset.backgroundColor !== undefined) organization.branding.backgroundColor = preset.backgroundColor;
            if (preset.textColor !== undefined) organization.branding.textColor = preset.textColor;
        }
        // Save current theme as a new preset
        else if (typeof savePreset === 'string' && savePreset.trim()) {
            const branding = organization.branding;
            organization.themePresets.push({
                name: savePreset.trim(),
                primaryColor: branding.primaryColor,
                secondaryColor: branding.secondaryColor,
                accentColor: branding.accentColor,
                backgroundColor: branding.backgroundColor,
                textColor: branding.textColor
            });
        }
        // Normal color updates
        else {
            if (primaryColor !== undefined) {
                if (primaryColor && !isHexColor(primaryColor)) {
                    return sendError(res, 'Invalid primaryColor value. Expected hex color like #16a34a', 400);
                }
                organization.branding.primaryColor = primaryColor;
            }

            if (secondaryColor !== undefined) {
                if (secondaryColor && !isHexColor(secondaryColor)) {
                    return sendError(res, 'Invalid secondaryColor value. Expected hex color like #2563eb', 400);
                }
                organization.branding.secondaryColor = secondaryColor;
            }

            if (accentColor !== undefined) {
                if (accentColor && !isHexColor(accentColor)) {
                    return sendError(res, 'Invalid accentColor value. Expected hex color', 400);
                }
                organization.branding.accentColor = accentColor;
            }

            if (backgroundColor !== undefined) {
                if (backgroundColor && !isHexColor(backgroundColor)) {
                    return sendError(res, 'Invalid backgroundColor value. Expected hex color', 400);
                }
                organization.branding.backgroundColor = backgroundColor;
            }

            if (textColor !== undefined) {
                if (textColor && !isHexColor(textColor)) {
                    return sendError(res, 'Invalid textColor value. Expected hex color', 400);
                }
                organization.branding.textColor = textColor;
            }

            if (theme !== undefined) {
                organization.branding.theme = theme;
            }
        }

        await organization.save();

        logger.info('Organization branding updated', { organizationId: organization._id });

        return sendSuccess(res, {
            branding: organization.branding,
            themePresets: organization.themePresets
        }, 'Organization branding updated successfully');
    } catch (error) {
        logger.error('Error updating organization branding', { error: error.message });
        return sendError(res, error.message || 'Failed to update organization branding', 500);
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

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

/** End of calendar month for `monthIndex` 0–11 */
function endOfCalendarMonthUtc(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
}

/**
 * Organization Analytics for CEO / exec dashboard charts
 * @route GET /api/v1/admin/organization/analytics
 */
export const getOrganizationAnalytics = async (req, res) => {
    try {
        const organizationId = getOrganizationId(req);

        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, {});
        const { timeRange = '30d' } = req.query;
        const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
        const periodDays = daysMap[timeRange] != null ? daysMap[timeRange] : 30;

        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodDays);
        periodStart.setHours(0, 0, 0, 0);

        const oid = mongoose.Types.ObjectId.isValid(String(organizationId))
            ? new mongoose.Types.ObjectId(String(organizationId))
            : null;

        if (!oid) {
            return sendError(res, 'Invalid organization ID', 400, 'INVALID_ORGANIZATION_ID');
        }

        const payrollVisibilityMatch = {
            organizationId: oid,
            type: 'monthly',
            isProvisional: false,
            $or: [{ isSuperseded: false }, { isSuperseded: { $exists: false } }],
            isVisible: { $ne: false }
        };

        const [
            totalEmployees,
            activeProjects,
            completedProjects,
            onHoldProjects,
            payrollWindowAgg,
            attendanceAgg,
            empTrendCounts,
            payrollByMonthAgg,
            recentEmployees,
            recentLeaves,
            recentProjects
        ] = await Promise.all([
            Employee.countDocuments(query),
            Project.countDocuments({ ...query, status: { $in: ['pending', 'in-progress'] } }),
            Project.countDocuments({ ...query, status: 'completed' }),
            Project.countDocuments({ ...query, status: 'on-hold' }),
            Payroll.aggregate([
                {
                    $match: {
                        ...payrollVisibilityMatch,
                        createdAt: { $gte: periodStart, $lte: now }
                    }
                },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$inHandSalary', 0] } } } }
            ]),
            Attendance.aggregate([
                {
                    $match: {
                        organizationId: oid,
                        date: { $gte: periodStart, $lte: now }
                    }
                },
                {
                    $group: {
                        _id: null,
                        n: { $sum: 1 },
                        present: {
                            $sum: {
                                $cond: [{ $in: ['$status', ['present', 'loggedOut', 'half-day']] }, 1, 0]
                            }
                        },
                        hours: { $sum: { $ifNull: ['$effectiveHours', 0] } }
                    }
                }
            ]),
            (async () => {
                const out = [];
                for (let i = 5; i >= 0; i--) {
                    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const y = ref.getFullYear();
                    const m = ref.getMonth();
                    const end = endOfCalendarMonthUtc(y, m);
                    const count = await Employee.countDocuments({
                        organizationId: oid,
                        createdAt: { $lte: end }
                    });
                    out.push({
                        month: ref.toLocaleString('en-US', { month: 'short' }),
                        year: y,
                        count
                    });
                }
                return out;
            })(),
            (async () => {
                const rows = [];
                for (let i = 5; i >= 0; i--) {
                    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const y = ref.getFullYear();
                    const m = ref.getMonth();
                    const label = MONTH_NAMES[m];
                    const [row] = await Payroll.aggregate([
                        {
                            $match: {
                                ...payrollVisibilityMatch,
                                year: y,
                                month: label
                            }
                        },
                        { $group: { _id: null, amount: { $sum: { $ifNull: ['$inHandSalary', 0] } } } }
                    ]);
                    rows.push({
                        month: ref.toLocaleString('en-US', { month: 'short' }),
                        amount: Math.round(row?.amount || 0)
                    });
                }
                return rows;
            })(),
            Employee.find(query).select('name createdAt').sort({ createdAt: -1 }).limit(6).lean(),
            Leave.find(query)
                .select('employeeName leaveType status createdAt')
                .sort({ createdAt: -1 })
                .limit(6)
                .lean(),
            Project.find(query).select('name status createdAt').sort({ createdAt: -1 }).limit(6).lean()
        ]);

        const totalPayroll = Math.round(payrollWindowAgg[0]?.total || 0);
        const att = attendanceAgg[0];
        const attendanceRows = att?.n || 0;
        const attendanceRate = attendanceRows > 0 ? Math.round((att.present / attendanceRows) * 100) : 0;
        const totalHours = Math.round((att?.hours || 0) * 10) / 10;
        const avgHoursPerDay =
            attendanceRows > 0 ? Math.round(((att?.hours || 0) / attendanceRows) * 10) / 10 : 0;

        const firstCount = empTrendCounts[0]?.count ?? 0;
        const lastCount = empTrendCounts[empTrendCounts.length - 1]?.count ?? 0;
        const employeeGrowth =
            firstCount > 0
                ? Math.round(((lastCount - firstCount) / firstCount) * 1000) / 10
                : lastCount > 0
                  ? 100
                  : 0;

        const recentActivity = [];
        for (const e of recentEmployees) {
            recentActivity.push({
                title: `Employee added: ${e.name || 'Team member'}`,
                timestamp: e.createdAt ? new Date(e.createdAt).toLocaleString() : ''
            });
        }
        for (const lv of recentLeaves) {
            recentActivity.push({
                title: `Leave ${lv.status || 'update'}: ${lv.employeeName || 'Employee'} (${lv.leaveType || 'leave'})`,
                timestamp: lv.createdAt ? new Date(lv.createdAt).toLocaleString() : ''
            });
        }
        for (const p of recentProjects) {
            recentActivity.push({
                title: `Project: ${p.name || 'Untitled'} (${p.status || 'status'})`,
                timestamp: p.createdAt ? new Date(p.createdAt).toLocaleString() : ''
            });
        }
        recentActivity.sort((a, b) => {
            const ta = new Date(a.timestamp).getTime();
            const tb = new Date(b.timestamp).getTime();
            return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
        });

        const analytics = {
            stats: {
                totalEmployees,
                activeProjects,
                completedProjects,
                onHoldProjects,
                cancelledProjects: 0,
                totalPayroll,
                attendanceRate,
                totalHours,
                avgHoursPerDay
            },
            trends: {
                employeeGrowth,
                employeeGrowthData: empTrendCounts.map(({ month, count }) => ({ month, count })),
                payrollTrendData: payrollByMonthAgg.map(({ month, amount }) => ({ month, amount }))
            },
            recentActivity: recentActivity.slice(0, 15),
            meta: { timeRange: timeRange || '30d', periodStart, generatedAt: new Date().toISOString() }
        };

        return sendSuccess(res, { analytics }, 'Organization analytics retrieved successfully');
    } catch (error) {
        logger.error('Error fetching organization analytics', { error: error.message, stack: error.stack });
        return sendError(res, error.message || 'Failed to fetch organization analytics', 500);
    }
};

