import { BenefitPlan, EmployeeBenefit } from '../../models/benefits.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { sendNotification } from '../../helpers/notificationService.js';
import {
    getAuthoritativeHrUserIds,
    getAdminUserIds
} from '../../helpers/lifecycleNotificationRecipients.js';
import logger from '../../helpers/logger.js';

const pushEnrollmentHistory = (enrollment, type, message, createdBy) => {
    if (!enrollment.history) enrollment.history = [];
    enrollment.history.push({
        type,
        message,
        createdBy: createdBy || undefined,
        createdAt: new Date()
    });
};

const monthsSince = (dateValue) => {
    if (!dateValue) return 0;
    const start = new Date(dateValue);
    const now = new Date();
    const months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
    return Math.max(0, months);
};

const assertEnrollmentWindow = (benefitPlan) => {
    const period = benefitPlan.enrollmentPeriod || {};
    const now = new Date();

    if (period.startDate && now < new Date(period.startDate)) {
        return 'Enrollment has not opened yet for this benefit plan';
    }

    if (period.endDate && now > new Date(period.endDate)) {
        return 'Enrollment period has ended for this benefit plan';
    }

    // Explicit close from Settings; missing/undefined stays open for backward compatibility
    if (period.isOpen === false) {
        return 'Enrollment is currently closed for this benefit plan';
    }

    return null;
};

const assertEligibility = (employee, benefitPlan) => {
    const eligibility = benefitPlan.eligibility || {};

    if (eligibility.departments?.length) {
        const allowed = eligibility.departments.map((d) => String(d).toLowerCase());
        const dept = String(employee.department || '').toLowerCase();
        if (!allowed.includes(dept)) {
            return 'You are not eligible for this benefit based on department';
        }
    }

    if (eligibility.positionLevels?.length) {
        const allowed = eligibility.positionLevels.map((p) => String(p).toLowerCase());
        const position = String(employee.position || '').toLowerCase();
        if (!allowed.includes(position)) {
            return 'You are not eligible for this benefit based on position level';
        }
    }

    if (eligibility.locations?.length) {
        const allowed = eligibility.locations.map((l) => String(l).toLowerCase());
        const location = String(employee.city || '').toLowerCase();
        if (!location || !allowed.includes(location)) {
            return 'You are not eligible for this benefit based on location';
        }
    }

    if (eligibility.tenure > 0) {
        const tenureMonths = monthsSince(employee.joiningDate);
        if (tenureMonths < eligibility.tenure) {
            return `Minimum tenure of ${eligibility.tenure} month(s) required`;
        }
    }

    return null;
};

const notifyQuietly = async (payload) => {
    try {
        await sendNotification(payload);
    } catch (error) {
        logger.warn('Benefits notification failed', { error: error.message });
    }
};

const notifyHrOfEnrollmentRequest = async ({ organizationId, employee, planName, senderId }) => {
    try {
        const [hrIds, adminIds] = await Promise.all([
            getAuthoritativeHrUserIds(organizationId),
            getAdminUserIds(organizationId)
        ]);
        const recipients = [...new Set([...(hrIds || []), ...(adminIds || [])])];
        await Promise.all(
            recipients.map((userId) =>
                notifyQuietly({
                    userId,
                    title: 'Benefit enrollment request',
                    message: `${employee?.name || 'An employee'} requested enrollment in ${planName}`,
                    type: 'general',
                    priority: 'medium',
                    organizationId,
                    senderId,
                    metadata: { module: 'benefits', event: 'enrollment_created' }
                })
            )
        );
    } catch (error) {
        logger.warn('Failed to notify HR of benefit enrollment', { error: error.message });
    }
};

const notifyEmployeeEnrollmentStatus = async ({
    organizationId,
    employeeId,
    planName,
    status,
    senderId
}) => {
    const employee = await Employee.findById(employeeId).select('name userId').lean();
    const recipientId = employee?.userId || employeeId;
    const statusLabel =
        status === 'Active' ? 'approved' :
        status === 'Cancelled' ? 'rejected/cancelled' :
        status.toLowerCase();

    await notifyQuietly({
        userId: recipientId,
        title: 'Benefit enrollment update',
        message: `Your enrollment in ${planName} was ${statusLabel}`,
        type: 'general',
        priority: 'medium',
        organizationId,
        senderId,
        metadata: { module: 'benefits', event: 'enrollment_status', status }
    });
};

const createEnrollmentRecord = async ({
    organizationId,
    employeeId,
    benefitPlan,
    coverageType,
    dependents,
    effectiveDate,
    status,
    actorId,
    historyMessage
}) => {
    const employeeContribution = benefitPlan.employeeContribution?.amount || 0;
    const companyContribution = benefitPlan.companyContribution?.amount || 0;
    const totalCost = employeeContribution + companyContribution;

    const enrollment = new EmployeeBenefit({
        organizationId,
        employeeId,
        benefitPlanId: benefitPlan._id,
        coverageType: coverageType || (benefitPlan.planType === 'Family' ? 'Family' : 'Individual'),
        dependents: dependents || [],
        employeeContribution,
        companyContribution,
        totalCost,
        paymentFrequency: benefitPlan.employeeContribution?.frequency || 'Monthly',
        effectiveDate: effectiveDate || new Date(),
        expiryDate: benefitPlan.expiryDate,
        status,
        history: []
    });

    pushEnrollmentHistory(
        enrollment,
        status === 'Active' ? 'Enrollment Approved' : 'Enrollment Created',
        historyMessage || `Enrolled in ${benefitPlan.name}`,
        actorId
    );

    await enrollment.save();
    return enrollment;
};

/**
 * Create benefit plan
 */
export const createBenefitPlan = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;

    const benefitPlan = new BenefitPlan({
        ...req.body,
        organizationId,
        createdBy
    });

    await benefitPlan.save();

    res.status(201).json({
        success: true,
        message: 'Benefit plan created successfully',
        data: benefitPlan
    });
});

/**
 * Get benefit plans
 */
export const getBenefitPlans = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { category, isActive } = req.query;

    const query = addOrganizationFilter(req, {});

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const benefitPlans = await BenefitPlan.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data: benefitPlans
    });
});

/**
 * Enroll in benefit (employee self-service)
 */
export const enrollInBenefit = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;
    const actorId = req.user?._id || req.employee?._id;
    const { benefitPlanId } = req.body;

    if (!employeeId) {
        return res.status(400).json({
            success: false,
            message: 'Employee context required for enrollment'
        });
    }

    const existingEnrollment = await EmployeeBenefit.findOne({
        organizationId,
        employeeId,
        benefitPlanId,
        status: { $in: ['Enrolled', 'Active', 'Pending'] }
    });

    if (existingEnrollment) {
        return res.status(400).json({
            success: false,
            message: 'Already enrolled in this benefit plan'
        });
    }

    const benefitPlan = await BenefitPlan.findOne({
        _id: benefitPlanId,
        organizationId,
        isActive: true
    });

    if (!benefitPlan) {
        return res.status(404).json({
            success: false,
            message: 'Benefit plan not found or inactive'
        });
    }

    if (benefitPlan.enrollmentType === 'Automatic') {
        return res.status(400).json({
            success: false,
            message: 'This benefit is assigned automatically by HR'
        });
    }

    const windowError = assertEnrollmentWindow(benefitPlan);
    if (windowError) {
        return res.status(400).json({ success: false, message: windowError });
    }

    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const eligibilityError = assertEligibility(employee, benefitPlan);
    if (eligibilityError) {
        return res.status(400).json({ success: false, message: eligibilityError });
    }

    const enrollment = await createEnrollmentRecord({
        organizationId,
        employeeId,
        benefitPlan,
        coverageType: req.body.coverageType,
        dependents: req.body.dependents || [],
        effectiveDate: req.body.effectiveDate || new Date(),
        status: 'Pending',
        actorId,
        historyMessage: `Enrollment requested for ${benefitPlan.name}`
    });

    await notifyHrOfEnrollmentRequest({
        organizationId,
        employee,
        planName: benefitPlan.name,
        senderId: actorId
    });

    res.status(201).json({
        success: true,
        message: 'Enrolled in benefit plan successfully',
        data: enrollment
    });
});

/**
 * HR enrolls an employee into a benefit (supports Automatic plans)
 */
export const enrollEmployeeByHR = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const actorId = req.user?._id || req.employee?._id;
    const { employeeId, benefitPlanId, coverageType, dependents, activateImmediately } = req.body;

    if (!employeeId || !benefitPlanId) {
        return res.status(400).json({
            success: false,
            message: 'employeeId and benefitPlanId are required'
        });
    }

    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const benefitPlan = await BenefitPlan.findOne({
        _id: benefitPlanId,
        organizationId,
        isActive: true
    });

    if (!benefitPlan) {
        return res.status(404).json({
            success: false,
            message: 'Benefit plan not found or inactive'
        });
    }

    const existingEnrollment = await EmployeeBenefit.findOne({
        organizationId,
        employeeId,
        benefitPlanId,
        status: { $in: ['Enrolled', 'Active', 'Pending'] }
    });

    if (existingEnrollment) {
        return res.status(400).json({
            success: false,
            message: 'Employee already enrolled in this benefit plan'
        });
    }

    const eligibilityError = assertEligibility(employee, benefitPlan);
    if (eligibilityError) {
        return res.status(400).json({ success: false, message: eligibilityError });
    }

    const shouldActivate =
        benefitPlan.enrollmentType === 'Automatic' || activateImmediately === true;

    const enrollment = await createEnrollmentRecord({
        organizationId,
        employeeId,
        benefitPlan,
        coverageType,
        dependents: dependents || [],
        effectiveDate: new Date(),
        status: shouldActivate ? 'Active' : 'Pending',
        actorId,
        historyMessage: shouldActivate
            ? `${benefitPlan.name} assigned by HR`
            : `${benefitPlan.name} enrollment created by HR`
    });

    await notifyEmployeeEnrollmentStatus({
        organizationId,
        employeeId,
        planName: benefitPlan.name,
        status: enrollment.status,
        senderId: actorId
    });

    const populated = await EmployeeBenefit.findById(enrollment._id)
        .populate('employeeId', 'name email employeeId department position')
        .populate('benefitPlanId', 'name category planType');

    res.status(201).json({
        success: true,
        message: shouldActivate
            ? 'Employee enrolled and activated successfully'
            : 'Employee enrollment created successfully',
        data: populated
    });
});

/**
 * Get single benefit plan
 */
export const getBenefitPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const benefitPlan = await BenefitPlan.findOne({
        _id: id,
        organizationId
    })
        .populate('createdBy', 'name email')
        .populate('eligibility.roles', 'name');

    if (!benefitPlan) {
        return res.status(404).json({
            success: false,
            message: 'Benefit plan not found'
        });
    }

    const enrollmentCount = await EmployeeBenefit.countDocuments({
        organizationId,
        benefitPlanId: id,
        status: { $in: ['Enrolled', 'Active'] }
    });

    res.json({
        success: true,
        data: {
            ...benefitPlan.toObject(),
            enrollmentCount
        }
    });
});

/**
 * Update benefit plan
 */
export const updateBenefitPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const benefitPlan = await BenefitPlan.findOne({
        _id: id,
        organizationId
    });

    if (!benefitPlan) {
        return res.status(404).json({
            success: false,
            message: 'Benefit plan not found'
        });
    }

    Object.assign(benefitPlan, req.body);
    await benefitPlan.save();

    const populatedPlan = await BenefitPlan.findById(benefitPlan._id)
        .populate('createdBy', 'name email')
        .populate('eligibility.roles', 'name');

    res.json({
        success: true,
        message: 'Benefit plan updated successfully',
        data: populatedPlan
    });
});

/**
 * Delete benefit plan
 */
export const deleteBenefitPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const benefitPlan = await BenefitPlan.findOne({
        _id: id,
        organizationId
    });

    if (!benefitPlan) {
        return res.status(404).json({
            success: false,
            message: 'Benefit plan not found'
        });
    }

    const activeEnrollments = await EmployeeBenefit.countDocuments({
        organizationId,
        benefitPlanId: id,
        status: { $in: ['Enrolled', 'Active', 'Pending'] }
    });

    if (activeEnrollments > 0) {
        return res.status(400).json({
            success: false,
            message: `Cannot delete benefit plan with ${activeEnrollments} active enrollment(s)`
        });
    }

    await BenefitPlan.deleteOne({ _id: id });

    res.json({
        success: true,
        message: 'Benefit plan deleted successfully'
    });
});

/**
 * Get all enrollments for a benefit plan
 */
export const getBenefitPlanEnrollments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { status } = req.query;

    const query = {
        organizationId,
        benefitPlanId: id
    };

    if (status) query.status = status;

    const enrollments = await EmployeeBenefit.find(query)
        .populate('employeeId', 'name email employeeId department')
        .populate('benefitPlanId', 'name category')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: enrollments
    });
});

/**
 * Update enrollment status
 */
export const updateEnrollmentStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = req.user?._id || req.employee?._id;
    const { status, notes } = req.body;

    const enrollment = await EmployeeBenefit.findOne({
        _id: id,
        organizationId
    }).populate('benefitPlanId', 'name');

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Enrollment not found'
        });
    }

    const previousStatus = enrollment.status;
    enrollment.status = status;
    if (notes) enrollment.notes = notes;
    if (status === 'Active' && !enrollment.effectiveDate) {
        enrollment.effectiveDate = new Date();
    }

    const planName = enrollment.benefitPlanId?.name || 'benefit';
    if (status === 'Active') {
        pushEnrollmentHistory(enrollment, 'Enrollment Approved', `${planName} approved`, actorId);
    } else if (status === 'Cancelled' && previousStatus === 'Pending') {
        pushEnrollmentHistory(enrollment, 'Enrollment Rejected', `${planName} rejected`, actorId);
    } else if (status === 'Cancelled') {
        pushEnrollmentHistory(enrollment, 'Enrollment Cancelled', `${planName} cancelled`, actorId);
    } else if (previousStatus !== status) {
        pushEnrollmentHistory(
            enrollment,
            'Benefit Updated',
            `Status changed from ${previousStatus} to ${status}`,
            actorId
        );
    }

    await enrollment.save();

    await notifyEmployeeEnrollmentStatus({
        organizationId,
        employeeId: enrollment.employeeId,
        planName,
        status,
        senderId: actorId
    });

    const populatedEnrollment = await EmployeeBenefit.findById(enrollment._id)
        .populate('employeeId', 'name email employeeId department position')
        .populate('benefitPlanId', 'name category planType');

    res.json({
        success: true,
        message: 'Enrollment status updated successfully',
        data: populatedEnrollment
    });
});

/**
 * Employee cancels own pending enrollment
 */
export const cancelOwnEnrollment = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;
    const actorId = req.user?._id || req.employee?._id;
    const { id } = req.params;

    if (!employeeId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const enrollment = await EmployeeBenefit.findOne({
        _id: id,
        organizationId,
        employeeId
    }).populate('benefitPlanId', 'name');

    if (!enrollment) {
        return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    if (enrollment.status !== 'Pending') {
        return res.status(400).json({
            success: false,
            message: 'Only pending enrollments can be cancelled'
        });
    }

    enrollment.status = 'Cancelled';
    pushEnrollmentHistory(
        enrollment,
        'Enrollment Cancelled',
        `${enrollment.benefitPlanId?.name || 'Benefit'} enrollment withdrawn by employee`,
        actorId
    );
    await enrollment.save();

    res.json({
        success: true,
        message: 'Enrollment cancelled successfully',
        data: enrollment
    });
});

/**
 * Get employee benefits
 */
export const getEmployeeBenefits = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;

    const benefits = await EmployeeBenefit.find({
        organizationId,
        employeeId
    })
        .populate('benefitPlanId')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: benefits
    });
});

/**
 * Get all enrollments (admin/HR view)
 */
export const getAllEnrollments = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, benefitPlanId, employeeId } = req.query;

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    if (benefitPlanId) query.benefitPlanId = benefitPlanId;
    if (employeeId) query.employeeId = employeeId;

    const enrollments = await EmployeeBenefit.find(query)
        .populate('employeeId', 'name email employeeId department position')
        .populate('benefitPlanId', 'name category planType')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: enrollments
    });
});

/**
 * Employee-centric benefits overview for HR/Admin
 */
export const getEmployeeBenefitsOverview = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { department, status, benefitPlanId, search } = req.query;

    const query = addOrganizationFilter(req, {});
    if (status) query.status = status;
    if (benefitPlanId) query.benefitPlanId = benefitPlanId;

    const enrollments = await EmployeeBenefit.find(query)
        .populate('employeeId', 'name email employeeId department position')
        .populate('benefitPlanId', 'name category planType')
        .sort({ enrollmentDate: -1 });

    const byEmployee = new Map();

    for (const enrollment of enrollments) {
        const emp = enrollment.employeeId;
        if (!emp?._id) continue;

        if (department && emp.department !== department) continue;
        if (search) {
            const term = String(search).toLowerCase();
            const haystack = `${emp.name || ''} ${emp.email || ''} ${emp.employeeId || ''}`.toLowerCase();
            if (!haystack.includes(term)) continue;
        }

        const key = String(emp._id);
        if (!byEmployee.has(key)) {
            byEmployee.set(key, {
                employee: emp,
                enrollments: [],
                benefitNames: [],
                activeCount: 0,
                pendingCount: 0
            });
        }

        const row = byEmployee.get(key);
        row.enrollments.push(enrollment);
        const planName = enrollment.benefitPlanId?.name;
        if (planName && !row.benefitNames.includes(planName)) {
            row.benefitNames.push(planName);
        }
        if (['Active', 'Enrolled'].includes(enrollment.status)) row.activeCount += 1;
        if (enrollment.status === 'Pending') row.pendingCount += 1;
    }

    res.json({
        success: true,
        data: Array.from(byEmployee.values())
    });
});

/**
 * Reports summary cards
 */
export const getBenefitsReportsSummary = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
        totalPlans,
        activePlans,
        activeEnrollments,
        pendingEnrollments,
        expiringBenefits
    ] = await Promise.all([
        BenefitPlan.countDocuments({ organizationId }),
        BenefitPlan.countDocuments({ organizationId, isActive: true }),
        EmployeeBenefit.countDocuments({ organizationId, status: { $in: ['Active', 'Enrolled'] } }),
        EmployeeBenefit.countDocuments({ organizationId, status: 'Pending' }),
        EmployeeBenefit.countDocuments({
            organizationId,
            status: { $in: ['Active', 'Enrolled'] },
            expiryDate: { $gte: now, $lte: in30Days }
        })
    ]);

    res.json({
        success: true,
        data: {
            totalPlans,
            activePlans,
            activeEnrollments,
            pendingEnrollments,
            expiringBenefits
        }
    });
});

/**
 * Update dependents on an enrollment (HR/Admin)
 */
export const updateEnrollmentDependents = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const actorId = req.user?._id || req.employee?._id;
    const { dependents } = req.body;

    const enrollment = await EmployeeBenefit.findOne({
        _id: id,
        organizationId
    }).populate('benefitPlanId', 'name planType');

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Enrollment not found'
        });
    }

    if (!['Active', 'Enrolled', 'Pending'].includes(enrollment.status)) {
        return res.status(400).json({
            success: false,
            message: 'Dependents can only be managed on active or pending enrollments'
        });
    }

    const nextDependents = Array.isArray(dependents) ? dependents : [];
    const planType = enrollment.benefitPlanId?.planType;
    if (planType === 'Individual' && nextDependents.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'This benefit plan does not support dependents'
        });
    }

    const previousCount = enrollment.dependents?.length || 0;
    enrollment.dependents = nextDependents;

    if (nextDependents.length > previousCount) {
        pushEnrollmentHistory(
            enrollment,
            'Dependent Added',
            'Dependent added to enrollment',
            actorId
        );
    } else if (nextDependents.length < previousCount) {
        pushEnrollmentHistory(
            enrollment,
            'Dependent Removed',
            'Dependent removed from enrollment',
            actorId
        );
    } else {
        pushEnrollmentHistory(
            enrollment,
            'Benefit Updated',
            'Dependents updated',
            actorId
        );
    }

    await enrollment.save();

    const populatedEnrollment = await EmployeeBenefit.findById(enrollment._id)
        .populate('employeeId', 'name email employeeId department position')
        .populate('benefitPlanId', 'name category planType');

    res.json({
        success: true,
        message: 'Dependents updated successfully',
        data: populatedEnrollment
    });
});

/**
 * Employee updates dependents on own enrollment
 */
export const updateOwnEnrollmentDependents = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;
    const actorId = req.user?._id || req.employee?._id;
    const { dependents } = req.body;

    if (!employeeId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const enrollment = await EmployeeBenefit.findOne({
        _id: id,
        organizationId,
        employeeId
    }).populate('benefitPlanId', 'name planType');

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Enrollment not found'
        });
    }

    if (!['Active', 'Enrolled', 'Pending'].includes(enrollment.status)) {
        return res.status(400).json({
            success: false,
            message: 'Dependents can only be managed on active or pending enrollments'
        });
    }

    const nextDependents = Array.isArray(dependents) ? dependents : [];
    const planType = enrollment.benefitPlanId?.planType;
    if (planType === 'Individual' && nextDependents.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'This benefit plan does not support dependents'
        });
    }

    const previousCount = enrollment.dependents?.length || 0;
    enrollment.dependents = nextDependents;

    if (nextDependents.length > previousCount) {
        pushEnrollmentHistory(enrollment, 'Dependent Added', 'Dependent added to enrollment', actorId);
    } else if (nextDependents.length < previousCount) {
        pushEnrollmentHistory(enrollment, 'Dependent Removed', 'Dependent removed from enrollment', actorId);
    } else {
        pushEnrollmentHistory(enrollment, 'Benefit Updated', 'Dependents updated', actorId);
    }

    await enrollment.save();

    const populatedEnrollment = await EmployeeBenefit.findById(enrollment._id)
        .populate('benefitPlanId', 'name category planType');

    res.json({
        success: true,
        message: 'Dependents updated successfully',
        data: populatedEnrollment
    });
});
