import { BenefitPlan, EmployeeBenefit } from '../../models/benefits.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

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
 * Enroll in benefit
 */
export const enrollInBenefit = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id || req.params.employeeId;
    const { benefitPlanId } = req.body;

    // Check if already enrolled
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

    // Get benefit plan details
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

    // Calculate contributions
    const employeeContribution = benefitPlan.employeeContribution?.amount || 0;
    const companyContribution = benefitPlan.companyContribution?.amount || 0;
    const totalCost = employeeContribution + companyContribution;

    const enrollment = new EmployeeBenefit({
        organizationId,
        employeeId,
        benefitPlanId,
        coverageType: req.body.coverageType || 'Individual',
        dependents: req.body.dependents || [],
        employeeContribution,
        companyContribution,
        totalCost,
        paymentFrequency: benefitPlan.employeeContribution?.frequency || 'Monthly',
        effectiveDate: req.body.effectiveDate || new Date(),
        status: 'Pending'
    });

    await enrollment.save();

    res.status(201).json({
        success: true,
        message: 'Enrolled in benefit plan successfully',
        data: enrollment
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

    // Get enrollment count
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

    // Check if there are active enrollments
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
    const { status, notes } = req.body;

    const enrollment = await EmployeeBenefit.findOne({
        _id: id,
        organizationId
    });

    if (!enrollment) {
        return res.status(404).json({
            success: false,
            message: 'Enrollment not found'
        });
    }

    enrollment.status = status;
    if (notes) enrollment.notes = notes;
    if (status === 'Active' && !enrollment.effectiveDate) {
        enrollment.effectiveDate = new Date();
    }

    await enrollment.save();

    const populatedEnrollment = await EmployeeBenefit.findById(enrollment._id)
        .populate('employeeId', 'name email employeeId department')
        .populate('benefitPlanId', 'name category');

    res.json({
        success: true,
        message: 'Enrollment status updated successfully',
        data: populatedEnrollment
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
        .populate('employeeId', 'name email employeeId department')
        .populate('benefitPlanId', 'name category')
        .sort({ enrollmentDate: -1 });

    res.json({
        success: true,
        data: enrollments
    });
});

