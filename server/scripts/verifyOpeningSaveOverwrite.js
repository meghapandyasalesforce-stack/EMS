/**
 * Verifies the updateOne + balance.save() overwrite when in-memory doc lacks openingLeaveBalance.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LeaveBalance from '../models/leaveBalance.model.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';
const employeeId = new mongoose.Types.ObjectId('6a3d12de4cd965399e907c89');
const orgId = new mongoose.Types.ObjectId('6a3cbbacc02ff3769ba3e8c6');

async function readRaw(db) {
    return db.collection('leavebalances').findOne({ year: 2016, employee: employeeId });
}

async function main() {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;

    // Reset: remove openingLeaveBalance from MongoDB to simulate pre-migration state
    await db.collection('leavebalances').updateOne(
        { year: 2016, employee: employeeId },
        { $unset: { 'employeeLeaveSummary.openingLeaveBalance': '' } }
    );

    console.log('=== BEFORE REQUEST (no openingLeaveBalance in DB) ===');
    console.log(JSON.stringify((await readRaw(db))?.employeeLeaveSummary, null, 2));

    // Load in-memory doc as adjustEmployeeLeaveBalance does (via calculateBalance path)
    const balance = await LeaveBalance.findOne({ year: 2016, employee: employeeId, organizationId: orgId });
    console.log('\n=== IN-MEMORY after findOne (no opening field) ===');
    console.log('openingLeaveBalance in memory:', balance.employeeLeaveSummary?.openingLeaveBalance ?? 'UNDEFINED');

    const openingData = {
        active: true,
        balance: 3,
        openingYear: 2016,
        openingMonth: 1,
        reason: 'Historical leave migration',
        setAt: new Date(),
    };

    // BUGGY LEGACY PATH: updateOne only (no in-memory update)
    await LeaveBalance.updateOne(
        { _id: balance._id },
        { $set: { 'employeeLeaveSummary.openingLeaveBalance': openingData } }
    );

    console.log('\n=== AFTER updateOne (MongoDB has opening, memory does not) ===');
    const afterUpdateOne = await readRaw(db);
    console.log('MongoDB opening.active:', afterUpdateOne?.employeeLeaveSummary?.openingLeaveBalance?.active);
    console.log('In-memory opening:', balance.employeeLeaveSummary?.openingLeaveBalance ?? 'UNDEFINED');

    // Exact adjust flow: assign manualOverride, markModified, save
    balance.employeeLeaveSummary = balance.employeeLeaveSummary || {};
    balance.employeeLeaveSummary.manualOverride = {
        active: true,
        available: 3,
        accrued: 0,
        used: 0,
        carriedForward: 3,
        anchorYear: 2016,
        anchorMonth: 1,
        adjustedAt: new Date(),
    };
    balance.markModified('employeeLeaveSummary');
    await balance.save();

    console.log('\n=== AFTER balance.save() — BUGGY PATH RESULT ===');
    const afterSave = await readRaw(db);
    console.log(JSON.stringify(afterSave?.employeeLeaveSummary, null, 2));

    const openingGone = !afterSave?.employeeLeaveSummary?.openingLeaveBalance?.active;
    console.log('\nOpening wiped by save():', openingGone ? 'YES — BUG CONFIRMED' : 'NO');

    // Restore with fixed path
    balance.employeeLeaveSummary.openingLeaveBalance = openingData;
    balance.markModified('employeeLeaveSummary');
    await balance.save();

    console.log('\n=== AFTER FIXED save (opening set in memory first) ===');
    const afterFix = await readRaw(db);
    console.log(JSON.stringify(afterFix?.employeeLeaveSummary, null, 2));
    console.log('Opening persisted after fix:', afterFix?.employeeLeaveSummary?.openingLeaveBalance?.active === true ? 'YES' : 'NO');

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
