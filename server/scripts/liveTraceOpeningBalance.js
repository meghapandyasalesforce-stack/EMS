/**
 * Live runtime trace via actual controller handlers + MongoDB (no HTTP server required).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import {
    adjustEmployeeLeaveBalance,
    getEmployeeLeaveBalance,
} from '../controllers/leave/leavePolicyController.js';

dotenv.config();

const employeeId = process.argv[2] || '6a3d12de4cd965399e907c89';

function mockRes() {
    const res = { statusCode: 200, body: null };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
}

function getLeaveSummary(balance) {
    return Number(balance?.leaveSummary?.totalAvailableLeave) || 0;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr');
    const db = mongoose.connection.db;
    const empOid = new mongoose.Types.ObjectId(employeeId);
    const emp = await db.collection('employees').findOne({ _id: empOid });
    const orgId = String(emp.organizationId);
    const admin = await db.collection('users').findOne({ role: 'admin' });

    console.log('LIVE RUNTIME TRACE');
    console.log('Employee:', emp.name, emp.lastName, '| joiningDate:', emp.joiningDate);

    const baseReq = {
        params: { employeeId },
        organizationId: orgId,
        decoded: { role: 'admin', userId: String(admin._id), organizationId: orgId },
        employee: { _id: admin._id },
    };

    // ── PATCH (same handler as UI Save) ──
    console.log('\n========== PATCH adjustEmployeeLeaveBalance (Jan 2016, carriedForward=3) ==========');
    const patchReq = {
        ...baseReq,
        body: {
            year: 2016,
            month: 1,
            leaveType: 'employee',
            accrued: 0,
            used: 0,
            carriedForward: 3,
            reason: 'live-runtime-trace',
        },
    };
    const patchRes = mockRes();
    await adjustEmployeeLeaveBalance(patchReq, patchRes);
    console.log('PATCH status:', patchRes.statusCode, 'success:', patchRes.body?.success);
    if (!patchRes.body?.success) {
        console.log('PATCH failed:', patchRes.body?.message);
        process.exit(1);
    }
    console.log('PATCH response leaveSummary.totalAvailableLeave:', patchRes.body?.balance?.leaveSummary?.totalAvailableLeave);

    // ── MongoDB after PATCH ──
    console.log('\n========== MongoDB immediately after PATCH ==========');
    const doc2016 = await db.collection('leavebalances').findOne({ employee: empOid, year: 2016 });
    const opening = doc2016?.employeeLeaveSummary?.openingLeaveBalance;
    console.log(JSON.stringify(opening, null, 2));
    console.log('active=true:', opening?.active === true);
    console.log('balance=3:', opening?.balance === 3);

    const resolved = await leaveBalanceEngine.resolveEmployeeOpeningBalance(employeeId, orgId);
    console.log('\nresolveEmployeeOpeningBalance():', JSON.stringify(resolved));

    // ── GET for each period (same handler as UI loadBalance) ──
    const periods = [
        [2016, 1, 3],
        [2016, 2, 4.5],
        [2016, 3, 6],
        [2017, 1, 21],
        [2026, 1, 183],
    ];

    console.log('\n========== GET getEmployeeLeaveBalance (UI loadBalance path) ==========');
    for (const [year, month, expected] of periods) {
        const getReq = { ...baseReq, query: { year: String(year), month: String(month) } };
        const getRes = mockRes();
        await getEmployeeLeaveBalance(getReq, getRes);

        const bal = getRes.body?.balance;
        const apiTotal = bal?.leaveSummary?.totalAvailableLeave;
        const uiTotal = getLeaveSummary(bal);
        const pooledRow = bal?.balances?.find((b) => b.isPooledCategory);
        const ledgerRow = pooledRow?.monthlyLedger?.find((r) => r.month === month);

        const openingAtGet = await leaveBalanceEngine.resolveEmployeeOpeningBalance(employeeId, orgId);
        const policy = await leaveBalanceEngine.getApplicablePolicy(
            { _id: employeeId, joiningDate: emp.joiningDate, department: emp.department },
            orgId,
            year
        );
        const asOf = leaveBalanceEngine.endOfMonthDate(year, month - 1);
        const anchor = await leaveBalanceEngine.resolveEmployeeBalanceAnchor(employeeId, orgId, openingAtGet);
        const pooled = await leaveBalanceEngine.computePooledAvailableLeave(
            { _id: employeeId, joiningDate: emp.joiningDate },
            policy,
            orgId,
            asOf,
            anchor,
            openingAtGet
        );

        console.log(`\n--- ${year}-${String(month).padStart(2, '0')} (expected ${expected}) ---`);
        console.log('  resolveEmployeeOpeningBalance.balance:', openingAtGet?.balance);
        console.log('  periodOpeningBalance passed to roll: active=', openingAtGet?.active);
        console.log('  computePooledAvailableLeave().available:', pooled.available);
        console.log('  roll ledger row.available:', ledgerRow?.available);
        console.log('  API leaveSummary.totalAvailableLeave:', apiTotal);
        console.log('  UI getLeaveSummary():', uiTotal);
        console.log('  UI modal carriedForward pre-fill:', bal?.leaveSummary?.totalCarriedForward);
        console.log('  MATCH expected:', apiTotal === expected ? 'YES' : `NO (got ${apiTotal})`);
        console.log('  UI matches API:', apiTotal === uiTotal ? 'YES' : 'NO');
    }

    // ── After calculateBalance (automation path) ──
    console.log('\n========== After calculateBalance (automation) ==========');
    await leaveBalanceEngine.calculateBalance(employeeId, 2026, orgId);
    const openingAfter = (await db.collection('leavebalances').findOne({ employee: empOid, year: 2016 }))
        ?.employeeLeaveSummary?.openingLeaveBalance;
    console.log('openingLeaveBalance still active:', openingAfter?.active, 'balance:', openingAfter?.balance);

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
