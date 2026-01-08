import CompanyPolicy from '../../models/companyPolicy.model.js';
import PolicyAcknowledgment from '../../models/policyAcknowledgment.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';

/**
 * Create a new company policy
 * @route POST /api/v1/organization/policies
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} req.body - Request body
 * @param {string} req.body.policyType - Type of policy
 * @param {string} req.body.title - Policy title
 * @param {string} req.body.description - Policy description
 * @param {string} req.body.content - Policy content
 * @param {Array} [req.body.rules] - Policy rules
 * @param {Date} [req.body.effectiveDate] - Effective date
 * @param {Date} [req.body.expiryDate] - Expiry date
 * @param {boolean} [req.body.requiresAcknowledgment] - Whether acknowledgment is required
 * @param {Array} [req.body.applicableRoles] - Applicable role IDs
 * @param {Array} [req.body.applicableDepartments] - Applicable departments
 * @param {Object} res - Express response object
 * @returns {Object} 201 - Policy created successfully
 * @returns {Object} 400 - Validation error or missing organization ID
 * @returns {Object} 500 - Server error
 */
export const createPolicy = asyncHandler(async (req, res) => {
    const organizationId = req.organizationId || req.user?.organizationId;
    
    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const {
        policyType,
        title,
        description,
        content,
        rules,
        effectiveDate,
        expiryDate,
        requiresAcknowledgment,
        applicableRoles,
        applicableDepartments
    } = req.body;

    const policy = await CompanyPolicy.create({
        organizationId,
        policyType,
        title,
        description,
        content,
        rules: rules || [],
        effectiveDate: effectiveDate || new Date(),
        expiryDate,
        requiresAcknowledgment: requiresAcknowledgment || false,
        applicableRoles: applicableRoles || [],
        applicableDepartments: applicableDepartments || [],
        createdBy: req.user?._id || req.employee?._id
    });

    logger.info('Policy created', { policyId: policy._id, organizationId });

    return sendSuccess(res, { policy }, 'Policy created successfully', 201);
});

/**
 * Get all policies for an organization
 * @route GET /api/v1/organization/policies
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.policyType] - Filter by policy type
 * @param {boolean} [req.query.isActive] - Filter by active status
 * @param {Object} res - Express response object
 * @returns {Object} 200 - List of policies
 * @returns {Object} 400 - Missing organization ID
 * @returns {Object} 500 - Server error
 */
export const getPolicies = asyncHandler(async (req, res) => {
    // Support both admin (req.user) and HR employee (req.employee) access
    const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
    
    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }
    
    const { policyType, isActive } = req.query;

    const query = { organizationId };
    if (policyType) query.policyType = policyType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const policies = await CompanyPolicy.find(query)
        .populate('applicableRoles', 'name level')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    return sendSuccess(res, {
        count: policies.length,
        policies
    }, 'Policies retrieved successfully');
});

/**
 * Get a single policy by ID
 * @route GET /api/v1/organization/policies/:id
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Policy ID
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Policy details
 * @returns {Object} 404 - Policy not found
 * @returns {Object} 500 - Server error
 */
export const getPolicyById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Support both admin (req.user) and HR employee (req.employee) access
    const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const policy = await CompanyPolicy.findOne({
        _id: id,
        organizationId
    })
        .populate('applicableRoles', 'name level')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

    if (!policy) {
        return sendError(res, 'Policy not found', 404, 'POLICY_NOT_FOUND');
    }

    return sendSuccess(res, { policy }, 'Policy retrieved successfully');
});

/**
 * Update a policy
 * @route PUT /api/v1/organization/policies/:id
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Policy ID
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} req.body - Updated policy data
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Policy updated successfully
 * @returns {Object} 404 - Policy not found
 * @returns {Object} 500 - Server error
 */
export const updatePolicy = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = req.organizationId || req.user?.organizationId;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const policy = await CompanyPolicy.findOne({
        _id: id,
        organizationId
    });

    if (!policy) {
        return sendError(res, 'Policy not found', 404, 'POLICY_NOT_FOUND');
    }

    // Save previous version
    if (req.body.content && req.body.content !== policy.content) {
        policy.previousVersions.push({
            version: policy.version,
            content: policy.content,
            effectiveDate: policy.effectiveDate,
            modifiedBy: policy.lastModifiedBy,
            modifiedAt: policy.updatedAt
        });
        policy.version += 1;
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined && key !== '_id' && key !== 'organizationId') {
            policy[key] = req.body[key];
        }
    });

    policy.lastModifiedBy = req.user?._id || req.employee?._id;
    await policy.save();

    logger.info('Policy updated', { policyId: policy._id, organizationId });

    return sendSuccess(res, { policy }, 'Policy updated successfully');
});

/**
 * Delete a policy (soft delete)
 * @route DELETE /api/v1/organization/policies/:id
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.params.id - Policy ID
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Policy deleted successfully
 * @returns {Object} 404 - Policy not found
 * @returns {Object} 500 - Server error
 */
export const deletePolicy = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = req.organizationId || req.user?.organizationId;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const policy = await CompanyPolicy.findOne({
        _id: id,
        organizationId
    });

    if (!policy) {
        return sendError(res, 'Policy not found', 404, 'POLICY_NOT_FOUND');
    }

    policy.isActive = false;
    await policy.save();

    logger.info('Policy deleted', { policyId: policy._id, organizationId });

    return sendSuccess(res, null, 'Policy deleted successfully');
});

/**
 * Get policies applicable to an employee
 * @route GET /api/v1/organization/policies/employee/policies
 * @access Private (Employee only)
 * @param {Object} req - Express request object
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {string} req.employee._id - Employee ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - List of applicable policies with acknowledgment status
 * @returns {Object} 400 - Missing employee ID
 * @returns {Object} 404 - Employee not found
 * @returns {Object} 500 - Server error
 */
export const getEmployeePolicies = asyncHandler(async (req, res) => {
    const organizationId = req.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    if (!employeeId) {
        return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
        return sendError(res, 'Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    // Get all active policies
    const allPolicies = await CompanyPolicy.find({
        organizationId,
        isActive: true,
        effectiveDate: { $lte: new Date() },
        $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gte: new Date() } }
        ]
    }).populate('applicableRoles', 'name level');

    // Filter policies applicable to this employee
    const applicablePolicies = allPolicies.filter(policy => {
        // If applicable to all
        if (policy.applicableRoles.length === 0 && 
            policy.applicableDepartments.length === 0) {
            return true;
        }

        // Check if applicable to employee's role
        if (employee.assignedRole && policy.applicableRoles.length > 0) {
            const roleIds = policy.applicableRoles.map(r => r._id.toString());
            if (roleIds.includes(employee.assignedRole.toString())) {
                return true;
            }
        }

        // Check if applicable to employee's department
        if (policy.applicableDepartments.length > 0) {
            if (policy.applicableDepartments.includes(employee.department)) {
                return true;
            }
        }

        return false;
    });

    // Get acknowledgment status - optimized: single query with aggregation
    const policyIds = applicablePolicies.map(p => p._id);
    const acknowledgments = await PolicyAcknowledgment.find({
        organizationId,
        employeeId,
        policyId: { $in: policyIds }
    }).lean(); // Use lean() for better performance

    // Create a map for O(1) lookup instead of O(n) find in loop
    const acknowledgmentMap = new Map();
    acknowledgments.forEach(ack => {
        acknowledgmentMap.set(ack.policyId.toString(), {
            acknowledged: ack.acknowledged || false,
            acknowledgedAt: ack.acknowledgedAt || null
        });
    });

    // Map policies with acknowledgment status (optimized)
    const policiesWithAcknowledgment = applicablePolicies.map(policy => {
        const ack = acknowledgmentMap.get(policy._id.toString()) || {
            acknowledged: false,
            acknowledgedAt: null
        };
        return {
            ...policy.toObject(),
            acknowledged: ack.acknowledged,
            acknowledgedAt: ack.acknowledgedAt
        };
    });

    return sendSuccess(res, {
        count: policiesWithAcknowledgment.length,
        policies: policiesWithAcknowledgment
    }, 'Employee policies retrieved successfully');
});

/**
 * Acknowledge a policy
 * @route POST /api/v1/organization/policies/employee/acknowledge
 * @access Private (Employee only)
 * @param {Object} req - Express request object
 * @param {string} req.body.policyId - Policy ID to acknowledge
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {string} req.employee._id - Employee ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Policy acknowledged successfully
 * @returns {Object} 400 - Missing employee ID or policy ID
 * @returns {Object} 404 - Policy not found
 * @returns {Object} 500 - Server error
 */
export const acknowledgePolicy = asyncHandler(async (req, res) => {
    const { policyId } = req.body;
    const organizationId = req.organizationId || req.employee?.organizationId;
    const employeeId = req.employee?._id;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    if (!employeeId) {
        return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
    }

    if (!policyId) {
        return sendError(res, 'Policy ID is required', 400, 'MISSING_POLICY_ID');
    }

    const policy = await CompanyPolicy.findOne({
        _id: policyId,
        organizationId,
        isActive: true
    });

    if (!policy) {
        return sendError(res, 'Policy not found or inactive', 404, 'POLICY_NOT_FOUND');
    }

    // Create or update acknowledgment
    const acknowledgment = await PolicyAcknowledgment.findOneAndUpdate(
        {
            organizationId,
            employeeId,
            policyId
        },
        {
            acknowledged: true,
            acknowledgedAt: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        },
        {
            upsert: true,
            new: true
        }
    );

    logger.info('Policy acknowledged', { 
        policyId, 
        employeeId, 
        organizationId 
    });

    return sendSuccess(res, { acknowledgment }, 'Policy acknowledged successfully');
});

/**
 * Get policy compliance statistics
 * @route GET /api/v1/organization/policies/compliance
 * @access Private (Admin only)
 * @param {Object} req - Express request object
 * @param {string} req.organizationId - Organization ID from authentication
 * @param {Object} res - Express response object
 * @returns {Object} 200 - Compliance statistics
 * @returns {Object} 400 - Missing organization ID
 * @returns {Object} 500 - Server error
 */
export const getPolicyCompliance = asyncHandler(async (req, res) => {
    // Support both admin (req.user) and HR employee (req.employee) access
    const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
    }

    const policies = await CompanyPolicy.find({
        organizationId,
        isActive: true,
        requiresAcknowledgment: true
    });

    const employees = await Employee.find({
        organizationId,
        status: 'active'
    });

    const complianceData = await Promise.all(
        policies.map(async (policy) => {
            const acknowledgments = await PolicyAcknowledgment.countDocuments({
                organizationId,
                policyId: policy._id,
                acknowledged: true
            });

            return {
                policyId: policy._id,
                policyTitle: policy.title,
                totalEmployees: employees.length,
                acknowledged: acknowledgments,
                pending: employees.length - acknowledgments,
                complianceRate: employees.length > 0 
                    ? (acknowledgments / employees.length * 100).toFixed(2) 
                    : 0
            };
        })
    );

    return sendSuccess(res, { compliance: complianceData }, 'Compliance statistics retrieved successfully');
});

