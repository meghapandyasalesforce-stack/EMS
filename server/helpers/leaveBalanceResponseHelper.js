import Leave from '../models/leave.model.js';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { getLeaveTypeVariantsForBalance } from './leaveTypeHelper.js';

/**
 * Calculate and enrich leave balance for an employee (used by admin + employee endpoints).
 */
export async function buildEmployeeLeaveBalanceResponse(employeeId, year, organizationId) {
    const balance = await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);

    if (!balance) {
        return null;
    }

    await balance.populate('policy', 'policyName leaveTypes');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const balanceObj = balance.toObject();
    balanceObj.balances = await Promise.all(balanceObj.balances.map(async (b) => {
        const types = getLeaveTypeVariantsForBalance(b.leaveType);
        const monthLeaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            startDate: { $gte: monthStart, $lte: monthEnd },
            status: { $in: ['approved', 'pending'] }
        });
        b.usedThisMonth = monthLeaves.reduce((sum, l) => sum + (l.duration || 0), 0);
        return b;
    }));

    return balanceObj;
}
