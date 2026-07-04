/**

 * End-to-end verification: HRMS migration opening balance at effective month.

 * Usage: node scripts/e2eVerifyOpeningBalance.js [employeeId]

 */

import mongoose from 'mongoose';

import dotenv from 'dotenv';

import jwt from 'jsonwebtoken';

import leaveBalanceEngine from '../services/leaveBalanceEngine.js';



dotenv.config();



const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';

const API_BASE = process.env.API_BASE || 'http://localhost:10000/api';

const employeeId = process.argv[2] || '6a3d12de4cd965399e907c89';



const OPENING_YEAR = 2026;

const OPENING_MONTH = 6

const OPENING_VALUE = 10;



const PERIODS = [

    { year: 2026, month: 6, expected: 10 },

    { year: 2026, month: 7, expected: 11.5 },

    { year: 2026, month: 8, expected: 13 },

    { year: 2026, month: 9, expected: 14.5 },

    { year: 2026, month: 12, expected: 19 },

    { year: 2027, month: 1, expected: 20.5 },

];



function getLeaveSummary(balance) {

    const fromApi = balance?.leaveSummary;

    if (fromApi && typeof fromApi === 'object') {

        return {

            totalAvailableLeave: Number(fromApi.totalAvailableLeave) || 0,

            totalAccrued: Number(fromApi.totalAccrued) || 0,

            totalUsed: Number(fromApi.totalUsed) || 0,

            totalCarriedForward: Number(fromApi.totalCarriedForward) || 0,

        };

    }

    return { totalAvailableLeave: 0 };

}



function pickPooledLedgerRow(balance, viewMonth) {

    const pooled = (balance?.balances || []).find((b) => b.isPooledCategory || b.monthlyLedger?.length);

    const ledger = pooled?.monthlyLedger || [];

    return ledger.find((r) => r.month === viewMonth) || ledger[ledger.length - 1] || null;

}



async function getApiToken(db, orgId) {

    if (process.env.E2E_TOKEN) return process.env.E2E_TOKEN;



    const admin = await db.collection('users').findOne({ role: 'admin' });

    if (!admin || !process.env.JWT_SECRET) return null;



    return jwt.sign(

        {

            userId: String(admin._id),

            role: 'admin',

            organizationId: String(orgId),

        },

        process.env.JWT_SECRET,

        { expiresIn: '1h' }

    );

}



async function fetchBalance(token, orgId, year, month) {

    const url = `${API_BASE}/v1/admin/leave-policy/balance/${employeeId}?year=${year}&month=${month}`;

    const headers = { 'Content-Type': 'application/json' };

    if (token) headers.Authorization = `Bearer ${token}`;

    if (orgId) headers['x-organization-id'] = String(orgId);



    const res = await fetch(url, { headers });

    const data = await res.json();

    return { ok: res.ok, status: res.status, data };

}



async function readMongoOpening(db, orgId) {

    const docs = await db

        .collection('leavebalances')

        .find({ employee: new mongoose.Types.ObjectId(employeeId), organizationId: new mongoose.Types.ObjectId(orgId) })

        .project({ year: 1, employeeLeaveSummary: 1 })

        .toArray();

    const withOpening = docs.filter((d) => d.employeeLeaveSummary?.openingLeaveBalance?.active);

    return { docs, withOpening };

}



async function resolveOpeningUsed(orgId) {

    return leaveBalanceEngine.resolveEmployeeOpeningBalance(employeeId, orgId);

}



function printPeriodReport(label, period, openingUsed, apiResult, uiSummary, mismatch) {

    const { year, month, expected } = period;

    const balance = apiResult?.data?.balance;

    const row = pickPooledLedgerRow(balance, month);



    console.log(`\n${'='.repeat(72)}`);

    console.log(`${label}: ${year}-${String(month).padStart(2, '0')}`);

    console.log(`${'='.repeat(72)}`);

    console.log(`API HTTP status: ${apiResult.status} success=${apiResult.data?.success}`);

    console.log(

        `Opening used: active=${openingUsed?.active} balance=${openingUsed?.balance} year=${openingUsed?.openingYear} month=${openingUsed?.openingMonth}`

    );

    console.log(`Previous Month Closing: ${row?.previousBalance ?? 'N/A'}`);

    console.log(`Monthly Credit:         ${row?.credit ?? 'N/A'}`);

    console.log(`Closing Balance:        ${row?.available ?? 'N/A'}`);

    console.log(`totalAvailableLeave:    ${balance?.leaveSummary?.totalAvailableLeave ?? 'N/A'}`);

    console.log(`Expected Closing:       ${expected}`);



    const actual = balance?.leaveSummary?.totalAvailableLeave;

    const calcMatch = actual === expected;

    const uiMatch = uiSummary.totalAvailableLeave === actual;

    console.log(`API vs Expected:        ${calcMatch ? 'MATCH' : 'MISMATCH'}`);

    console.log(`UI vs API:              ${uiMatch ? 'MATCH' : 'MISMATCH'}`);



    if (!calcMatch || !uiMatch) {

        mismatch.push({ period: `${year}-${month}`, expected, actual, ui: uiSummary.totalAvailableLeave });

    }

}



async function main() {

    console.log('E2E HRMS Migration Opening Balance Verification');

    console.log('Employee:', employeeId);

    console.log(`Expected opening: ${OPENING_VALUE} at ${OPENING_YEAR}-${String(OPENING_MONTH).padStart(2, '0')}`);



    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    const db = mongoose.connection.db;



    const employee = await db.collection('employees').findOne({

        _id: new mongoose.Types.ObjectId(employeeId),

    });

    if (!employee) {

        console.error('Employee not found');

        process.exit(1);

    }

    const orgId = String(employee.organizationId);

    console.log('\nEmployee:', employee.name, employee.lastName, '| joiningDate:', employee.joiningDate);



    const mongoBefore = await readMongoOpening(db, orgId);

    for (const d of mongoBefore.withOpening) {

        const o = d.employeeLeaveSummary.openingLeaveBalance;

        console.log(`  year ${d.year}: active=${o.active} balance=${o.balance} opening=${o.openingYear}-${o.openingMonth}`);

    }



    const openingUsed = await resolveOpeningUsed(orgId);

    let token = await getApiToken(db, orgId);

    let apiAvailable = Boolean(token);



    if (apiAvailable) {

        const probe = await fetchBalance(token, orgId, OPENING_YEAR, OPENING_MONTH);

        if (!probe.ok) {

            console.log(`\nHTTP API probe failed (status ${probe.status})`);

            apiAvailable = false;

        }

    }



    const mismatches = [];



    for (const period of PERIODS) {

        let apiResult;

        if (apiAvailable) {

            apiResult = await fetchBalance(token, orgId, period.year, period.month);

        } else {

            const { buildEmployeeLeaveBalanceResponse } = await import('../helpers/leaveBalanceResponseHelper.js');

            const balanceObj = await buildEmployeeLeaveBalanceResponse(

                employeeId,

                period.year,

                orgId,

                { month: period.month }

            );

            apiResult = { ok: !!balanceObj, status: balanceObj ? 200 : 404, data: { success: !!balanceObj, balance: balanceObj } };

        }



        const uiSummary = getLeaveSummary(apiResult.data?.balance);

        printPeriodReport('API Response', period, openingUsed, apiResult, uiSummary, mismatches);

    }



    // Pre-HRMS month should not show migrated balance rolled from 2016

    const preHrms = apiAvailable

        ? await fetchBalance(token, orgId, 2016, 1)

        : {

              data: {

                  balance: await (

                      await import('../helpers/leaveBalanceResponseHelper.js')

                  ).buildEmployeeLeaveBalanceResponse(employeeId, 2016, orgId, { month: 1 }),

              },

          };

    const preHrmsAvailable = preHrms.data?.balance?.leaveSummary?.totalAvailableLeave ?? 0;

    console.log(`\nPre-HRMS Jan 2016 available (should be 0): ${preHrmsAvailable}`);

    if (openingUsed?.openingYear === OPENING_YEAR && preHrmsAvailable !== 0) {

        mismatches.push({ period: '2016-1', note: 'pre-HRMS month should be 0', actual: preHrmsAvailable });

    }



    console.log('\n' + '='.repeat(72));

    console.log(`Mismatches: ${mismatches.length}`);

    if (mismatches.length) {

        for (const m of mismatches) console.log(' ', JSON.stringify(m));

        process.exitCode = 1;

    } else {

        console.log('All checks PASSED');

    }



    await mongoose.disconnect();

}



main().catch((e) => {

    console.error(e);

    process.exit(1);

});

