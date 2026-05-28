import LeavePolicy from '../../models/leavePolicy.model.js';
import LeaveBalance from '../../models/leaveBalance.model.js';
import Leave from '../../models/leave.model.js';
import Employee from '../../models/employee.model.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';
import logger from '../../helpers/logger.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import { getLeaveTypeVariantsForBalance } from '../../helpers/leaveTypeHelper.js';

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

        const policy = new LeavePolicy(policyData);
        await policy.save();

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

        Object.assign(policy, req.body);
        policy.lastModifiedBy = req.user?._id || req.employee?._id;
        await policy.save();

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

        // Check if user has permission to view this balance
        const isAdmin = req.user?.role === 'admin';
        const isHR = req.employee?.isHR || (req.employee?.department || '').toLowerCase().includes('hr');
        const isOwnBalance = targetEmployeeId.toString() === (req.employee?._id?.toString() || req.user?._id?.toString());

        if (!isOwnBalance && !isAdmin && !isHR) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own leave balance.'
            });
        }

        // Calculate/refresh balance
        const balance = await leaveBalanceEngine.calculateBalance(
            targetEmployeeId,
            targetYear,
            organizationId
        );

        if (!balance) {
            return res.status(404).json({
                success: false,
                message: 'Leave balance not found. No applicable policy for this employee.'
            });
        }

        await balance.populate('policy', 'policyName leaveTypes');

        // Calculate usedThisMonth for each leave type
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const balanceObj = balance.toObject();
        balanceObj.balances = await Promise.all(balanceObj.balances.map(async (b) => {
            const types = getLeaveTypeVariantsForBalance(b.leaveType);
            const monthLeaves = await Leave.find({
                organizationId,
                employee: targetEmployeeId,
                leaveType: { $in: types },
                startDate: { $gte: monthStart, $lte: monthEnd },
                status: { $in: ['approved', 'pending'] }
            });
            b.usedThisMonth = monthLeaves.reduce((sum, l) => sum + (l.duration || 0), 0);
            return b;
        }));

        res.json({
            success: true,
            balance: balanceObj
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

