import LeavePolicy from '../../models/leavePolicy.model.js';
import LeaveBalance from '../../models/leaveBalance.model.js';
import Employee from '../../models/employee.model.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';
import logger from '../../helpers/logger.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { buildEmployeeLeaveBalanceResponse } from '../../helpers/leaveBalanceResponseHelper.js';
import { normalizePolicyLeaveTypes } from '../../helpers/leavePolicyAccrualHelper.js';
import { resolveEmployeeLeaveBalanceAccess } from '../../helpers/leaveBalanceAccessHelper.js';

async function recalculateOrgLeaveBalances(organizationId) {
    if (!organizationId) return;
    try {
        await leaveBalanceEngine.recalculateBalances(organizationId, new Date().getFullYear());
    } catch (error) {
        logger.warn('Leave balance recalculation after policy change failed', {
            organizationId,
            error: error.message
        });
    }
}

/**
 * Create a new leave policy
 */
export const createLeavePolicy = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'Organization ID is required'
            });
        }

        const policyData = {
            ...req.body,
            organizationId,
            createdBy: req.user?._id || req.employee?._id
        };

        if (policyData.leaveTypes) {
            policyData.leaveTypes = normalizePolicyLeaveTypes(policyData.leaveTypes);
        }

        const policy = new LeavePolicy(policyData);
        await policy.save();

        if (policyData.leaveTypes?.length) {
            await recalculateOrgLeaveBalances(organizationId);
        }

        res.status(201).json({
            success: true,
            message: 'Leave policy created successfully',
            policy
        });
    } catch (error) {
        logger.error('Create Leave Policy Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error creating leave policy',
            error: error.message
        });
    }
};

/**
 * Get all leave policies
 */
export const getAllLeavePolicies = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const { isActive } = req.query;

        const query = addOrganizationFilter(req, {});
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const policies = await LeavePolicy.find(query)
            .populate('applicableRoles', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            policies
        });
    } catch (error) {
        logger.error('Get All Leave Policies Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave policies',
            error: error.message
        });
    }
};

/**
 * Get leave policy by ID
 */
export const getLeavePolicyById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        })
            .populate('applicableRoles', 'name')
            .populate('applicableEmployees', 'name email employeeId')
            .populate('createdBy', 'name email');

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        res.json({
            success: true,
            policy
        });
    } catch (error) {
        logger.error('Get Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave policy',
            error: error.message
        });
    }
};

/**
 * Update leave policy
 */
export const updateLeavePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        });

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        const updateBody = { ...req.body };
        if (updateBody.leaveTypes) {
            updateBody.leaveTypes = normalizePolicyLeaveTypes(updateBody.leaveTypes);
        }

        Object.assign(policy, updateBody);
        policy.lastModifiedBy = req.user?._id || req.employee?._id;
        await policy.save();

        if (updateBody.leaveTypes?.length) {
            await recalculateOrgLeaveBalances(organizationId);
        }

        res.json({
            success: true,
            message: 'Leave policy updated successfully',
            policy
        });
    } catch (error) {
        logger.error('Update Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error updating leave policy',
            error: error.message
        });
    }
};

/**
 * Delete leave policy
 */
export const deleteLeavePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const policy = await LeavePolicy.findOne({
            _id: id,
            organizationId
        });

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Leave policy not found'
            });
        }

        // Check if policy is in use
        const balancesInUse = await LeaveBalance.countDocuments({ policy: id });
        if (balancesInUse > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete policy that is in use. Deactivate it instead.'
            });
        }

        await policy.deleteOne();

        res.json({
            success: true,
            message: 'Leave policy deleted successfully'
        });
    } catch (error) {
        logger.error('Delete Leave Policy Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error deleting leave policy',
            error: error.message
        });
    }
};

/**
 * Get employee leave balance
 */
export const getEmployeeLeaveBalance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year } = req.query;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetEmployeeId = employeeId || req.employee?._id || req.user?._id;

        const access = await resolveEmployeeLeaveBalanceAccess(req, targetEmployeeId, { forAdjust: false });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            targetEmployeeId,
            targetYear,
            organizationId
        );

        if (!balanceObj) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. No applicable policy for this employee.'
            });
        }

        res.json({
            success: true,
            balance: balanceObj,
            canAdjust: access.canAdjust,
        });
    } catch (error) {
        logger.error('Get Employee Leave Balance Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching leave balance',
            error: error.message
        });
    }
};

/**
 * Manually adjust leave balance for an employee (admin / HR / direct manager).
 */
export const adjustEmployeeLeaveBalance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const { year, leaveType, accrued, used, carriedForward, reason } = req.body;

        const access = await resolveEmployeeLeaveBalanceAccess(req, employeeId, { forAdjust: true });
        if (!access.ok) {
            return res.status(access.status || 403).json({
                success: false,
                message: access.message,
            });
        }

        if (!leaveType || typeof leaveType !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'leaveType is required',
            });
        }

        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
        if (Number.isNaN(targetYear)) {
            return res.status(400).json({ success: false, message: 'Invalid year' });
        }

        const normalizedType = leaveType.toLowerCase().trim();
        const numericFields = { accrued, used, carriedForward };
        const hasAnyField = Object.values(numericFields).some((v) => v !== undefined && v !== null && v !== '');
        if (!hasAnyField) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one of accrued, used, or carriedForward to update',
            });
        }

        let balance = await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId);
        if (!balance) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. Assign a leave policy to this employee first.',
            });
        }

        let typeBalance = balance.balances.find((b) => b.leaveType === normalizedType);
        if (!typeBalance) {
            return res.status(404).json({
                success: false,
                message: `Leave type "${normalizedType}" not found in this employee's balance`,
            });
        }

        const parseNonNegative = (val, label) => {
            if (val === undefined || val === null || val === '') return undefined;
            const num = Number(val);
            if (Number.isNaN(num) || num < 0) {
                throw new Error(`${label} must be a non-negative number`);
            }
            return num;
        };

        try {
            const nextAccrued = parseNonNegative(accrued, 'accrued');
            const nextUsed = parseNonNegative(used, 'used');
            const nextCarried = parseNonNegative(carriedForward, 'carriedForward');

            if (nextAccrued !== undefined) typeBalance.accrued = nextAccrued;
            if (nextUsed !== undefined) typeBalance.used = nextUsed;
            if (nextCarried !== undefined) typeBalance.carriedForward = nextCarried;

            typeBalance.manualOverride = {
                active: true,
                accrued: typeBalance.accrued,
                used: typeBalance.used,
                carriedForward: typeBalance.carriedForward,
                reason: reason ? String(reason).trim().slice(0, 500) : '',
                adjustedBy: req.employee?._id || req.user?._id,
                adjustedAt: new Date(),
            };

            typeBalance.available = Math.max(
                0,
                (typeBalance.accrued || 0) +
                    (typeBalance.carriedForward || 0) -
                    (typeBalance.used || 0) -
                    (typeBalance.expired || 0) -
                    (typeBalance.pending || 0)
            );

            balance.accrualHistory = balance.accrualHistory || [];
            balance.accrualHistory.push({
                date: new Date(),
                leaveType: normalizedType,
                amount: typeBalance.available,
                method: 'manual',
                notes: `[${access.role}] ${reason || 'Manual balance adjustment'}`,
            });

            balance.markModified('balances');
            await balance.save();
        } catch (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError.message,
            });
        }

        const balanceObj = await buildEmployeeLeaveBalanceResponse(
            employeeId,
            targetYear,
            organizationId
        );

        logger.info('Leave balance manually adjusted', {
            employeeId,
            leaveType: normalizedType,
            year: targetYear,
            adjustedBy: req.employee?._id || req.user?._id,
            role: access.role,
        });

        res.json({
            success: true,
            message: 'Leave balance updated successfully',
            balance: balanceObj,
            canAdjust: true,
        });
    } catch (error) {
        logger.error('Adjust Employee Leave Balance Error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Error adjusting leave balance',
            error: error.message,
        });
    }
};

/**
 * Recalculate all employee balances for a year
 */
export const recalculateBalances = async (req, res) => {
    try {
        const { year } = req.body;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const targetYear = year || new Date().getFullYear();
        const result = await leaveBalanceEngine.recalculateBalances(organizationId, targetYear);

        res.json({
            success: true,
            message: `Balances recalculated. Processed: ${result.processed}, Errors: ${result.errors}`,
            ...result
        });
    } catch (error) {
        logger.error('Recalculate Balances Error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error recalculating balances',
            error: error.message
        });
    }
};

