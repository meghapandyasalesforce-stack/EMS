/**
 * End-to-end verify: opening persists after adjust flow + monthly roll matches expected chain.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { buildEmployeeLeaveBalanceResponse } from '../helpers/leaveBalanceResponseHelper.js';
import { rollLeaveBalanceThroughPeriod } from '../helpers/leaveBalanceRulesHelper.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
const employeeId = '6a3d12de4cd965399e907c89';
const orgId = '6a3cbbacc02ff3769ba3e8c6';

const expected = [
    { year: 2016, month: 1, value: 3 },
    { year: 2016, month: 2, value: 4.5 },
    { year: 2016, month: 3, value: 6 },
    { year: 2016, month: 12, value: 19.5 },
    { year: 2017, month: 1, value: 21 },
    { year: 2026, month: 1, value: 183 },
];

async function main() {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;

    const doc2016 = await db.collection('leavebalances').findOne({
        year: 2016,
        employee: new mongoose.Types.ObjectId(employeeId),
    });
    console.log('openingLeaveBalance in MongoDB:', JSON.stringify(doc2016?.employeeLeaveSummary?.openingLeaveBalance));

    const opening = await leaveBalanceEngine.resolveEmployeeOpeningBalance(employeeId, orgId);
    const rolled = rollLeaveBalanceThroughPeriod({
        joinYear: 2016,
        joinMonthIndex: 0,
        endYear: 2026,
        endMonthIndex: 0,
        monthlyRate: 1.5,
        periodOpeningBalance: opening,
    });

    console.log('\n=== Monthly chain verification ===');
    let allOk = true;
    for (const { year, month, value } of expected) {
        const row = rolled.ledgerByYear[year]?.find((r) => r.month === month);
        const actual = row?.available;
        const ok = actual === value;
        if (!ok) allOk = false;
        console.log(`${year}-${String(month).padStart(2, '0')}: expected ${value}, got ${actual} ${ok ? 'OK' : 'FAIL'}`);
    }

    for (const { year, month } of expected) {
        const resp = await buildEmployeeLeaveBalanceResponse(employeeId, year, orgId, { month });
        const actual = resp?.leaveSummary?.totalAvailableLeave;
        const exp = expected.find((e) => e.year === year && e.month === month)?.value;
        if (exp != null && actual !== exp) {
            console.log(`API ${year}-${month}: expected ${exp}, got ${actual} FAIL`);
            allOk = false;
        }
    }

    const afterDoc = await db.collection('leavebalances').findOne({
        year: 2016,
        employee: new mongoose.Types.ObjectId(employeeId),
    });
    const openingOk = afterDoc?.employeeLeaveSummary?.openingLeaveBalance?.active === true;
    console.log('\nopeningLeaveBalance.active after reads:', openingOk ? 'true OK' : 'MISSING/FALSE FAIL');

    await mongoose.disconnect();
    process.exit(allOk && openingOk ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
