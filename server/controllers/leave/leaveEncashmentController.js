import Leave from '../../models/leave.model.js';
import LeaveBalance from '../../models/leaveBalance.model.js';
import LeavePolicy from '../../models/leavePolicy.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound } from '../../helpers/responseHelper.js';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';

/**
 * Request leave encashment
 */
export const requestLeaveEncashment = async (req, res) => {
    try {
        const { leaveType, days, reason } = req.body;
        const employeeId = req.employee?._id;
        const organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId;

        if (!employeeId) {
            return sendError(res, 'Employee ID is required', 400, 'MISSING_EMPLOYEE_ID');
        }

        if (!leaveType || !days || days <= 0) {
            return sendError(res, 'Leave type and valid number of days are required', 400, 'INVALID_REQUEST');
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Get applicable policy
        const policy = await getApplicablePolicy(employee, organizationId);
        if (!policy) {
            return sendError(res, 'No leave policy found for employee', 404, 'NO_POLICY');
        }

        const leaveTypeConfig = policy.leaveTypes.find(lt => lt.type === leaveType);
        if (!leaveTypeConfig) {
            return sendError(res, `Leave type ${leaveType} not configured`, 400, 'INVALID_LEAVE_TYPE');
        }

        // Check if encashment is enabled
        if (!leaveTypeConfig.encashment?.enabled) {
            return sendError(res, `Encashment is not enabled for ${leaveTypeConfig.displayName}`, 400, 'ENCASHMENT_DISABLED');
        }

        // Check maximum encashable days per year
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);

        const encashedLeaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType,
            isEncashed: true,
            createdAt: { $gte: yearStart, $lte: yearEnd }
        });

        const totalEncashedDays = encashedLeaves.reduce((sum, leave) => sum + (leave.duration || 0), 0);
        const maxEncashable = leaveTypeConfig.encashment.maxDaysPerYear || 0;

        if (maxEncashable > 0 && (totalEncashedDays + days) > maxEncashable) {
            return sendError(
                res,
                `Maximum ${maxEncashable} days can be encashed per year. Already encashed: ${totalEncashedDays} days`,
                400,
                'MAX_ENCASHMENT_EXCEEDED'
            );
        }

        // Check available balance
        const balance = await leaveBalanceEngine.calculateBalance(employeeId, currentYear, organizationId);
        if (!balance) {
            return sendError(res, 'Could not calculate leave balance', 500, 'BALANCE_CALCULATION_ERROR');
        }

        const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
        if (!typeBalance || typeBalance.available < days) {
            return sendError(
                res,
                `Insufficient leave balance. Available: ${typeBalance?.available || 0} days, Requested: ${days} days`,
                400,
                'INSUFFICIENT_BALANCE'
            );
        }

        // Calculate encashment amount
        const encashmentAmount = await calculateEncashmentAmount(
            employee,
            days,
            leaveTypeConfig.encashment.calculationMethod
        );

        // Create encashment leave record
        const encashmentLeave = new Leave({
            organizationId,
            employee: employeeId,
            employeeName: `${employee.name} ${employee.lastName}`,
            leaveType,
            startDate: new Date(),
            endDate: new Date(),
            duration: days,
            reason: reason || `Leave encashment request for ${days} days`,
            status: 'pending',
            isEncashed: true,
            encashmentAmount,
            year: currentYear
        });

        await encashmentLeave.save();

        return sendSuccess(
            res,
            {
                encashment: encashmentLeave,
                encashmentAmount,
                availableBalance: typeBalance.available - days
            },
            'Leave encashment request submitted successfully',
            201
        );
    } catch (error) {
        logger.error('Request Leave Encashment Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error processing encashment request', 500, 'ENCASHMENT_ERROR');
    }
};

/**
 * Approve leave encashment
 */
export const approveLeaveEncashment = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const leave = await Leave.findById(id);
        if (!leave) {
            return sendNotFound(res, 'Leave encashment request');
        }

        if (!leave.isEncashed) {
            return sendError(res, 'This is not an encashment request', 400, 'NOT_ENCASHMENT');
        }

        if (leave.status !== 'pending') {
            return sendError(res, 'Encashment request is already processed', 400, 'ALREADY_PROCESSED');
        }

        // Update leave status
        leave.status = 'approved';
        leave.approvedBy = req.user?._id || req.employee?._id;
        leave.approvedAt = new Date();
        await leave.save();

        // Update leave balance
        const year = new Date(leave.startDate).getFullYear();
        await leaveBalanceEngine.calculateBalance(leave.employee, year, organizationId);

        return sendSuccess(
            res,
            { encashment: leave },
            'Leave encashment approved successfully'
        );
    } catch (error) {
        logger.error('Approve Leave Encashment Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error approving encashment', 500, 'APPROVAL_ERROR');
    }
};

/**
 * Get encashment history
 */
export const getEncashmentHistory = async (req, res) => {
    try {
        const employeeId = req.params.employeeId || req.employee?._id || req.user?._id;
        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;
        const { year } = req.query;

        const query = {
            organizationId,
            employee: employeeId,
            isEncashed: true
        };

        if (year) {
            query.year = parseInt(year);
        }

        const encashments = await Leave.find(query)
            .sort({ createdAt: -1 })
            .populate('approvedBy', 'name email')
            .populate('rejectedBy', 'name email');

        const totalEncashed = encashments
            .filter(e => e.status === 'approved')
            .reduce((sum, e) => sum + (e.encashmentAmount || 0), 0);

        return sendSuccess(res, {
            encashments,
            totalEncashed,
            totalDays: encashments
                .filter(e => e.status === 'approved')
                .reduce((sum, e) => sum + (e.duration || 0), 0)
        }, 'Encashment history retrieved successfully');
    } catch (error) {
        logger.error('Get Encashment History Error', { error: error.message, stack: error.stack });
        return sendError(res, 'Error fetching encashment history', 500, 'FETCH_ERROR');
    }
};

/**
 * Calculate encashment amount
 */
async function calculateEncashmentAmount(employee, days, method) {
    const salary = employee.salary || 0;

    switch (method) {
        case 'daily_salary':
            // Daily salary = Monthly salary / 30
            return Math.round((salary / 30) * days);

        case 'monthly_salary_divided_by_30':
            // Same as daily_salary
            return Math.round((salary / 30) * days);

        case 'custom':
            // For custom, we'll use daily_salary as default
            // This can be customized per organization
            return Math.round((salary / 30) * days);

        default:
            return Math.round((salary / 30) * days);
    }
}

/**
 * Get applicable policy for employee
 */
async function getApplicablePolicy(employee, organizationId) {
    const policies = await LeavePolicy.find({
        organizationId,
        isActive: true
    }).sort({ effectiveDate: -1 });

    for (const policy of policies) {
        if (isPolicyApplicable(policy, employee)) {
            return policy;
        }
    }

    return null;
}

/**
 * Check if policy is applicable to employee
 */
function isPolicyApplicable(policy, employee) {
    switch (policy.applicableTo) {
        case 'all':
            return true;
        case 'department':
            return policy.applicableDepartments.includes(employee.department);
        case 'role':
            return policy.applicableRoles.some(role =>
                role.toString() === employee.role?.toString()
            );
        case 'employee':
            return policy.applicableEmployees.some(emp =>
                emp.toString() === employee._id.toString()
            );
        default:
            return false;
    }
}

