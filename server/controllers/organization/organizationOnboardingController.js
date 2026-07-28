import Organization from '../../models/organization.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { ORG_ONBOARDING_STEPS, DEFAULT_ORG_DEPARTMENTS, DEFAULT_ORG_DESIGNATIONS, DEFAULT_EMPLOYMENT_TYPES } from '../../constants/onboardingDefaults.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

export const getOrganizationOnboardingStatus = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    return sendSuccess(res, {
        onboarding: organization.setupOnboarding || { status: 'not_started', currentStep: 'welcome', completedSteps: [] },
        steps: ORG_ONBOARDING_STEPS,
        organization: {
            name: organization.name,
            legalName: organization.legalName,
            email: organization.email,
            emailVerified: organization.emailVerified,
            industry: organization.industry,
            companySize: organization.companySize,
            website: organization.website,
            phone: organization.phone,
            gstNumber: organization.gstNumber,
            panNumber: organization.panNumber,
            businessRegistrationNumber: organization.businessRegistrationNumber,
            taxId: organization.taxId,
            timezone: organization.timezone,
            currency: organization.currency,
            dateFormat: organization.dateFormat,
            timeFormat: organization.timeFormat,
            language: organization.language,
            financialYearStart: organization.financialYearStart,
            workingDays: organization.workingDays,
            workingHours: organization.workingHours,
            breakPolicy: organization.breakPolicy,
            logo: organization.logo,
            banner: organization.banner,
            branding: organization.branding,
            emailBranding: organization.emailBranding,
            officeLocations: organization.officeLocations,
            orgDepartments: organization.orgDepartments,
            orgDesignations: organization.orgDesignations,
            employmentTypes: organization.employmentTypes,
            shiftTypes: organization.shiftTypes,
            address: organization.address,
        },
    });
});

export const updateOrganizationOnboardingStep = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { step, data = {}, markComplete = true, skip = false } = req.body;

    if (!step || !ORG_ONBOARDING_STEPS.includes(step)) {
        return sendError(res, 'Invalid onboarding step', 400);
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    if (!organization.setupOnboarding) {
        organization.setupOnboarding = { status: 'in_progress', completedSteps: [], skippedSteps: [] };
    }

    organization.setupOnboarding.status = 'in_progress';
    organization.setupOnboarding.currentStep = step;

    if (skip) {
        if (!organization.setupOnboarding.skippedSteps.includes(step)) {
            organization.setupOnboarding.skippedSteps.push(step);
        }
    } else if (markComplete && !organization.setupOnboarding.completedSteps.includes(step)) {
        organization.setupOnboarding.completedSteps.push(step);
    }

    switch (step) {
        case 'company-info':
            if (data.name) organization.name = data.name.trim();
            if (data.legalName !== undefined) organization.legalName = data.legalName?.trim();
            if (data.industry) organization.industry = data.industry;
            if (data.companySize) organization.companySize = data.companySize;
            if (data.website !== undefined) organization.website = data.website?.trim();
            if (data.phone !== undefined) organization.phone = data.phone?.trim();
            if (data.gstNumber !== undefined) organization.gstNumber = data.gstNumber?.trim();
            if (data.panNumber !== undefined) organization.panNumber = data.panNumber?.trim();
            if (data.businessRegistrationNumber !== undefined) {
                organization.businessRegistrationNumber = data.businessRegistrationNumber?.trim();
            }
            if (data.taxId !== undefined) organization.taxId = data.taxId?.trim();
            if (data.address) organization.address = { ...organization.address?.toObject?.() || organization.address || {}, ...data.address };
            break;

        case 'branding':
            if (data.branding) organization.branding = { ...organization.branding?.toObject?.() || organization.branding || {}, ...data.branding };
            if (data.emailBranding) organization.emailBranding = { ...organization.emailBranding || {}, ...data.emailBranding };
            break;

        case 'office-locations':
            if (Array.isArray(data.officeLocations)) organization.officeLocations = data.officeLocations;
            break;

        case 'working-hours':
            if (data.workingDays) organization.workingDays = data.workingDays;
            if (data.workingHours) organization.workingHours = { ...organization.workingHours || {}, ...data.workingHours };
            if (data.breakPolicy) organization.breakPolicy = { ...organization.breakPolicy || {}, ...data.breakPolicy };
            break;

        case 'timezone-currency':
            if (data.timezone) organization.timezone = data.timezone;
            if (data.currency) organization.currency = data.currency;
            if (data.dateFormat) organization.dateFormat = data.dateFormat;
            if (data.timeFormat) organization.timeFormat = data.timeFormat;
            if (data.language) organization.language = data.language;
            if (data.financialYearStart) organization.financialYearStart = data.financialYearStart;
            break;

        case 'departments':
            if (Array.isArray(data.orgDepartments)) organization.orgDepartments = data.orgDepartments;
            if (Array.isArray(data.orgDesignations)) organization.orgDesignations = data.orgDesignations;
            if (Array.isArray(data.employmentTypes)) organization.employmentTypes = data.employmentTypes;
            if (Array.isArray(data.shiftTypes)) organization.shiftTypes = data.shiftTypes;
            if (!organization.orgDepartments?.length && data.useDefaults) {
                organization.orgDepartments = DEFAULT_ORG_DEPARTMENTS.map((name) => ({ name }));
            }
            if (!organization.orgDesignations?.length && data.useDefaults) {
                organization.orgDesignations = DEFAULT_ORG_DESIGNATIONS.map((title) => ({ title }));
            }
            if (!organization.employmentTypes?.length && data.useDefaults) {
                organization.employmentTypes = DEFAULT_EMPLOYMENT_TYPES;
            }
            break;

        case 'subscription-plan':
            if (!organization.orgSetupExtras) organization.orgSetupExtras = {};
            if (data.subscriptionPlan) organization.orgSetupExtras.subscriptionPlan = data.subscriptionPlan;
            break;

        case 'company-policies':
            if (!organization.orgSetupExtras) organization.orgSetupExtras = {};
            if (data.companyPoliciesUrl) organization.orgSetupExtras.companyPoliciesUrl = data.companyPoliciesUrl;
            break;

        case 'smtp-email':
            if (!organization.orgSetupExtras) organization.orgSetupExtras = {};
            if (data.smtpConfigured !== undefined) organization.orgSetupExtras.smtpConfigured = data.smtpConfigured;
            break;

        case 'notification-preferences':
            if (!organization.orgSetupExtras) organization.orgSetupExtras = {};
            organization.orgSetupExtras.notificationPreferences = {
                ...(organization.orgSetupExtras.notificationPreferences || {}),
                ...(data.notificationPreferences || {}),
            };
            break;

        case 'integrations':
            if (!organization.orgSetupExtras) organization.orgSetupExtras = {};
            organization.orgSetupExtras.integrations = {
                ...(organization.orgSetupExtras.integrations || {}),
                ...(data.integrations || {}),
            };
            break;

        case 'invite-users':
            if (Array.isArray(data.invitedUsers)) {
                organization.setupOnboarding.invitedUsers = data.invitedUsers.map((u) => ({
                    email: u.email,
                    role: u.role,
                    invitedAt: new Date(),
                    status: 'pending',
                }));
            }
            break;

        default:
            break;
    }

    await organization.save();

    return sendSuccess(res, {
        onboarding: organization.setupOnboarding,
        organization,
    }, 'Onboarding step saved');
});

export const completeOrganizationOnboarding = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    if (!organization.setupOnboarding) {
        organization.setupOnboarding = {};
    }
    organization.setupOnboarding.status = 'completed';
    organization.setupOnboarding.currentStep = 'complete';
    organization.setupOnboarding.completedAt = new Date();
    if (!organization.setupOnboarding.completedSteps.includes('complete')) {
        organization.setupOnboarding.completedSteps.push('complete');
    }

    await organization.save();

    // Ensure enterprise lifecycle is ready for the org (idempotent)
    if (!organization.lifecycleEnterpriseEnabled) {
        try {
            const { bootstrapEnterpriseLifecycle } = await import('../../services/lifecycleEnterpriseBootstrap.js');
            await bootstrapEnterpriseLifecycle(organizationId, { actor: req.user || req.employee, req });
            organization.lifecycleEnterpriseEnabled = true;
            organization.lifecycleEnterpriseBootstrappedAt = new Date();
            await organization.save();
        } catch (error) {
            logger.warn('Enterprise bootstrap on org onboarding complete failed', {
                organizationId,
                error: error.message,
            });
        }
    }

    logger.info('Organization onboarding completed', { organizationId });

    return sendSuccess(res, {
        onboarding: organization.setupOnboarding,
        lifecycleEnterpriseEnabled: Boolean(organization.lifecycleEnterpriseEnabled),
        redirectTo: '/onboarding?enterprise=1',
    }, 'Organization onboarding completed');
});

export const getOrganizationOnboardingReview = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    const [employeeCount, userCount] = await Promise.all([
        Employee.countDocuments({ organizationId }),
        User.countDocuments({ organizationId }),
    ]);

    return sendSuccess(res, {
        profile: {
            name: organization.name,
            legalName: organization.legalName,
            industry: organization.industry,
            companySize: organization.companySize,
            email: organization.email,
            website: organization.website,
        },
        policies: {
            timezone: organization.timezone,
            currency: organization.currency,
            workingDays: organization.workingDays,
            workingHours: organization.workingHours,
        },
        locations: organization.officeLocations || [],
        departments: organization.orgDepartments || [],
        designations: organization.orgDesignations || [],
        invitedUsers: organization.setupOnboarding?.invitedUsers || [],
        employeeCount,
        userCount,
        onboarding: organization.setupOnboarding,
    });
});

/** Alias for backward compatibility — same as getOrganizationProfile */
export const getOrganizationDetails = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }
    return sendSuccess(res, { organization }, 'Organization details retrieved');
});

export const updateOrganizationLocale = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        timezone, currency, dateFormat, timeFormat, language,
        workingDays, workingHours, breakPolicy, financialYearStart,
    } = req.body;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    if (timezone !== undefined) organization.timezone = timezone;
    if (currency !== undefined) organization.currency = currency;
    if (dateFormat !== undefined) organization.dateFormat = dateFormat;
    if (timeFormat !== undefined) organization.timeFormat = timeFormat;
    if (language !== undefined) organization.language = language;
    if (financialYearStart !== undefined) organization.financialYearStart = financialYearStart;
    if (workingDays !== undefined) organization.workingDays = workingDays;
    if (workingHours !== undefined) organization.workingHours = { ...organization.workingHours || {}, ...workingHours };
    if (breakPolicy !== undefined) organization.breakPolicy = { ...organization.breakPolicy || {}, ...breakPolicy };

    await organization.save();

    return sendSuccess(res, { organization }, 'Locale settings updated');
});

export const updateOrganizationBusinessInfo = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return sendError(res, 'Organization not found', 404);
    }

    const fields = [
        'name', 'legalName', 'industry', 'companySize', 'website', 'phone',
        'gstNumber', 'panNumber', 'businessRegistrationNumber', 'taxId', 'businessType',
    ];
    for (const field of fields) {
        if (req.body[field] !== undefined) {
            organization[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
    }
    if (req.body.address) {
        organization.address = { ...organization.address?.toObject?.() || organization.address || {}, ...req.body.address };
    }

    await organization.save();
    return sendSuccess(res, { organization }, 'Business information updated');
});
