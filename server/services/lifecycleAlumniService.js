/**
 * Alumni management — database, rehire workflow, referrals, blacklist.
 */

import mongoose from 'mongoose';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';

const alumniSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    offboardingWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'OffboardingWorkflow' },
    status: { type: String, enum: ['Alumni', 'Blacklisted', 'Rehire Eligible', 'Rehired'], default: 'Alumni', index: true },
    eligibleForRehire: { type: Boolean, default: true },
    blacklistReason: String,
    lastWorkingDate: Date,
    separationReason: String,
    department: String,
    designation: String,
    personalEmail: String,
    linkedIn: String,
    referralCount: { type: Number, default: 0 },
    communications: [{
        channel: { type: String, enum: ['email', 'sms', 'in_app'] },
        subject: String,
        sentAt: { type: Date, default: Date.now },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    }],
    rehireHistory: [{
        rehiredAt: Date,
        newEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        notes: String,
    }],
    metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

alumniSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

export const AlumniRecord = mongoose.models.AlumniRecord || mongoose.model('AlumniRecord', alumniSchema);

export async function createAlumniFromOffboarding(workflow, employee, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'alumniManagement') && !isFeatureEnabled(settings, 'rehireEligibility')) {
        return null;
    }

    const eligible = employee?.eligibleForRehire !== false && !employee?.blacklisted;
    const record = await AlumniRecord.findOneAndUpdate(
        { organizationId: workflow.organizationId, employeeId: workflow.employeeId },
        {
            $set: {
                offboardingWorkflowId: workflow._id,
                status: eligible ? 'Rehire Eligible' : 'Alumni',
                eligibleForRehire: eligible,
                lastWorkingDate: workflow.lastWorkingDate,
                separationReason: workflow.reason,
                department: employee?.department,
                designation: employee?.jobTitle,
                personalEmail: employee?.personalEmail || employee?.email,
            },
        },
        { upsert: true, new: true },
    );

    await Employee.findByIdAndUpdate(workflow.employeeId, {
        $set: { alumniStatus: record.status, alumniRecordId: record._id },
    });

    await logLifecycleAudit({
        action: 'Create', entityType: 'Alumni', entityId: record._id,
        entityName: employee?.name || 'Alumni', actor, req,
    });

    await notify({
        type: 'lifecycle_alumni_created',
        organizationId: workflow.organizationId,
        data: { alumniId: record._id, employeeId: workflow.employeeId },
    }).catch(() => {});

    return record;
}

export async function blacklistAlumni(organizationId, alumniId, { reason, actor, req }) {
    await assertFeatureEnabled(organizationId, 'blacklisting', 'Blacklisting');
    const record = await AlumniRecord.findOne({ _id: alumniId, organizationId });
    if (!record) throw new Error('Alumni record not found');
    record.status = 'Blacklisted';
    record.eligibleForRehire = false;
    record.blacklistReason = reason;
    await record.save();
    await Employee.findByIdAndUpdate(record.employeeId, { $set: { eligibleForRehire: false, blacklisted: true } });
    await logLifecycleAudit({
        action: 'Update', entityType: 'Alumni', entityId: record._id,
        entityName: 'Blacklist', actor, req, metadata: { reason },
    });
    return record;
}

export async function initiateRehire(organizationId, alumniId, { notes, actor, req }) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'rehireEligibility')) throw new Error('Rehire workflow is disabled');

    const record = await AlumniRecord.findOne({ _id: alumniId, organizationId });
    if (!record) throw new Error('Alumni record not found');
    if (!record.eligibleForRehire || record.status === 'Blacklisted') {
        throw new Error('Employee is not eligible for rehire');
    }

    record.rehireHistory.push({ rehiredAt: new Date(), notes });
    record.status = 'Rehired';
    await record.save();

    await logLifecycleAudit({
        action: 'Update', entityType: 'Alumni', entityId: record._id,
        entityName: 'Rehire Initiated', actor, req,
    });

    return { alumni: record, message: 'Rehire workflow initiated — create employee record or reactivate via HR' };
}

export async function listAlumni(organizationId, filters = {}) {
    const query = { organizationId };
    if (filters.status) query.status = filters.status;
    if (filters.eligibleForRehire != null) query.eligibleForRehire = filters.eligibleForRehire;
    return AlumniRecord.find(query)
        .populate('employeeId', 'name lastName email department jobTitle')
        .sort({ updatedAt: -1 })
        .lean();
}

export function buildAlumniDashboard(records) {
    return {
        total: records.length,
        rehireEligible: records.filter((r) => r.eligibleForRehire && r.status !== 'Blacklisted').length,
        blacklisted: records.filter((r) => r.status === 'Blacklisted').length,
        rehired: records.filter((r) => r.status === 'Rehired').length,
        totalReferrals: records.reduce((n, r) => n + (r.referralCount || 0), 0),
    };
}
