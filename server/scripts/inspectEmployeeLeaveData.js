import mongoose from 'mongoose';
import dotenv from 'dotenv';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { resolveLeaveBalanceOrganizationId } from '../helpers/leaveBalanceAccessHelper.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/paarsiv_hr';

async function main() {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;
    console.log('Database:', db.databaseName);

    const balancesWithOverride = await db
        .collection('leavebalances')
        .find({ 'employeeLeaveSummary.manualOverride.active': true })
        .toArray();

    console.log('\n=== LeaveBalances with active manualOverride ===');
    console.log('Count:', balancesWithOverride.length);

    const audits = await db
        .collection('leavebalanceaudits')
        .find({ action: 'manual_adjust' })
        .sort({ performedAt: -1 })
        .limit(10)
        .toArray();

    console.log('\n=== Recent manual_adjust audits ===');
    for (const a of audits) {
        console.log(
            JSON.stringify({
                employee: String(a.employee),
                org: String(a.organizationId),
                toYear: a.toYear,
                toMonth: a.toMonth,
                performedAt: a.performedAt,
                newAvailable: a.newBalance?.available,
            })
        );
    }

    const june2026Employees = await db
        .collection('employees')
        .find({
            joiningDate: { $gte: new Date('2026-06-01'), $lt: new Date('2026-07-01') },
        })
        .project({ name: 1, lastName: 1, email: 1, joiningDate: 1, organizationId: 1 })
        .toArray();

    console.log('\n=== Employees with joiningDate in June 2026 ===');
    for (const e of june2026Employees) {
        console.log(
            JSON.stringify({
                _id: String(e._id),
                name: e.name,
                lastName: e.lastName,
                email: e.email,
                joiningDate: e.joiningDate,
                organizationId: String(e.organizationId),
            })
        );
    }

    const candidateIds = new Set();
    for (const b of balancesWithOverride) candidateIds.add(String(b.employee));
    for (const a of audits) candidateIds.add(String(a.employee));
    for (const e of june2026Employees) candidateIds.add(String(e._id));

    if (candidateIds.size === 0) {
        console.log('\nNo candidate employees found from overrides/audits/June2026 join.');
        const anyEmp = await db.collection('employees').findOne({}, { sort: { updatedAt: -1 } });
        if (anyEmp) candidateIds.add(String(anyEmp._id));
    }

    for (const employeeId of candidateIds) {
        await inspectEmployee(db, employeeId);
    }

    await mongoose.disconnect();
}

async function inspectEmployee(db, employeeId) {
    console.log('\n' + '='.repeat(80));
    console.log('EMPLOYEE INSPECTION:', employeeId);

    const employee = await db.collection('employees').findOne({
        _id: new mongoose.Types.ObjectId(employeeId),
    });

    if (!employee) {
        console.log('Employee not found');
        return;
    }

    console.log('\n--- Employee ---');
    console.log(
        JSON.stringify(
            {
                _id: String(employee._id),
                name: employee.name,
                lastName: employee.lastName,
                email: employee.email,
                joiningDate: employee.joiningDate,
                organizationId: employee.organizationId ? String(employee.organizationId) : null,
                status: employee.status,
            },
            null,
            2
        )
    );

    const resolvedOrgId = await resolveLeaveBalanceOrganizationId(employeeId, null);
    console.log('\nresolveLeaveBalanceOrganizationId(employeeId, null):', resolvedOrgId ? String(resolvedOrgId) : null);

    const policies = await db
        .collection('leavepolicies')
        .find({ organizationId: employee.organizationId, isActive: true })
        .project({ policyName: 1, isActive: 1, effectiveDate: 1, leaveTypes: 1 })
        .toArray();

    console.log('\n--- Active Leave Policies for employee org ---');
    for (const p of policies) {
        console.log(
            JSON.stringify({
                _id: String(p._id),
                policyName: p.policyName,
                isActive: p.isActive,
                effectiveDate: p.effectiveDate,
                leaveTypeCount: (p.leaveTypes || []).length,
                leaveTypes: (p.leaveTypes || []).map((lt) => lt.type),
            })
        );
    }

    const allBalances = await db
        .collection('leavebalances')
        .find({ employee: new mongoose.Types.ObjectId(employeeId) })
        .sort({ year: 1 })
        .toArray();

    console.log('\n--- All LeaveBalance documents (count:', allBalances.length, ') ---');

    const byYearOrg = {};
    for (const doc of allBalances) {
        const key = `${doc.year}|${doc.organizationId ? String(doc.organizationId) : 'NULL'}`;
        byYearOrg[key] = (byYearOrg[key] || 0) + 1;
    }

    const duplicates = Object.entries(byYearOrg).filter(([, count]) => count > 1);
    console.log('\nDuplicate year+organizationId groups:', duplicates.length ? duplicates : 'NONE');

    for (const doc of allBalances) {
        console.log(
            JSON.stringify(
                {
                    _id: String(doc._id),
                    year: doc.year,
                    organizationId: doc.organizationId ? String(doc.organizationId) : null,
                    policy: doc.policy ? String(doc.policy) : null,
                    employeeLeaveSummary_manualOverride: doc.employeeLeaveSummary?.manualOverride ?? null,
                },
                null,
                2
            )
        );
    }

    const overrideDocs = allBalances.filter((d) => d.employeeLeaveSummary?.manualOverride?.active === true);
    console.log('\n--- Documents containing active manual override ---');
    if (overrideDocs.length === 0) {
        console.log('NONE');
    } else {
        for (const d of overrideDocs) {
            console.log(String(d._id), 'year=', d.year, 'org=', d.organizationId ? String(d.organizationId) : null);
        }
    }

    const orgForAnchor = resolvedOrgId || employee.organizationId;
    const anchor = await leaveBalanceEngine.resolveEmployeeBalanceAnchor(employeeId, orgForAnchor);

    console.log('\n--- resolveEmployeeBalanceAnchor() ---');
    console.log('Query organizationId:', orgForAnchor ? String(orgForAnchor) : null);
    console.log('Returned anchor:', JSON.stringify(anchor));

    const anchorQueryDocs = await db
        .collection('leavebalances')
        .find({
            organizationId: orgForAnchor,
            employee: new mongoose.Types.ObjectId(employeeId),
            'employeeLeaveSummary.manualOverride.active': true,
        })
        .project({ _id: 1, year: 1, organizationId: 1, employeeLeaveSummary: 1 })
        .toArray();

    console.log('\n--- Documents matched by resolveEmployeeBalanceAnchor query ---');
    for (const d of anchorQueryDocs) {
        console.log(
            JSON.stringify({
                _id: String(d._id),
                year: d.year,
                organizationId: d.organizationId ? String(d.organizationId) : null,
                manualOverride: d.employeeLeaveSummary?.manualOverride,
            })
        );
    }

    if (overrideDocs.length > 0 && anchorQueryDocs.length > 0) {
        const savedId = String(overrideDocs[0]._id);
        const readIds = anchorQueryDocs.map((d) => String(d._id));
        console.log('\n--- Document ID comparison ---');
        console.log('Save-side override document _id(s):', overrideDocs.map((d) => String(d._id)));
        console.log('resolveEmployeeBalanceAnchor matched _id(s):', readIds);
        console.log('IDs match:', readIds.includes(savedId));
    } else if (overrideDocs.length > 0 && anchorQueryDocs.length === 0) {
        console.log('\n--- Document ID comparison ---');
        console.log('Override exists on:', overrideDocs.map((d) => String(d._id)));
        console.log('resolveEmployeeBalanceAnchor matched: NONE (returns null anchor)');
        console.log('IDs match: false');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
