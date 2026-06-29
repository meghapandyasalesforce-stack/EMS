import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Leave from '../models/leave.model.js';
import Employee from '../models/employee.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import leaveValidationService from '../services/leaveValidationService.js';
import { normalizePolicyLeaveTypes, getMonthlyEntitlementAmount } from '../helpers/leavePolicyAccrualHelper.js';

dotenv.config();

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('=== Leave balance debug ===\n');

    const emp = await Employee.findOne({ status: 'active' });
    if (!emp) {
        console.log('No active employee found');
        process.exit(0);
    }

    console.log('Employee:', emp.firstName, emp.lastName);
    console.log('Joining date:', emp.joiningDate);
    console.log('Months in 2026:', leaveBalanceEngine.calculateMonthsWorked(new Date(emp.joiningDate), 2026, new Date()));

    const policy = await LeavePolicy.findOne({ isActive: true, organizationId: emp.organizationId });
    if (policy) {
        console.log('\n--- Policy leave types (DB raw) ---');
        for (const lt of policy.leaveTypes) {
            console.log(lt.type, {
                maxDaysPerMonth: lt.maxDaysPerMonth,
                accrualMethod: lt.accrual?.method,
                accrualAmount: lt.accrual?.amount,
                maxAccrual: lt.accrual?.maxAccrual,
                monthlyEntitlement: getMonthlyEntitlementAmount(lt)
            });
        }

        const normalized = normalizePolicyLeaveTypes(policy.leaveTypes);
        console.log('\n--- After normalizePolicyLeaveTypes (loss_of_pay) ---');
        const lop = normalized.find((t) => t.type === 'loss_of_pay');
        if (lop) {
            console.log(lop.accrual);
        }
    }

    const balance = await leaveBalanceEngine.calculateBalance(emp._id, 2026, emp.organizationId);
    console.log('\n--- Calculated balances ---');
    for (const b of balance?.balances || []) {
        console.log(b.leaveType, { accrued: b.accrued, used: b.used, pending: b.pending, available: b.available });
    }

    const monthStart = new Date(2026, 5, 1);
    const monthEnd = new Date(2026, 5, 30, 23, 59, 59, 999);
    const sickLeaves = await Leave.find({
        organizationId: emp.organizationId,
        employee: emp._id,
        leaveType: 'sick',
        status: { $in: ['pending', 'approved'] },
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart }
    }).select('status startDate endDate duration leaveType');

    console.log('\n--- Sick leaves overlapping June 2026 ---');
    for (const l of sickLeaves) {
        console.log(l.status, l.startDate.toISOString().slice(0, 10), '->', l.endDate.toISOString().slice(0, 10), 'duration:', l.duration);
    }

    const summary = await leaveValidationService.getMonthlyLeaveCapSummary(
        emp._id,
        emp.organizationId,
        2026,
        6
    );
    console.log('\n--- June monthly cap (sick) ---');
    console.log(summary.types.find((t) => t.leaveType === 'sick'));

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
