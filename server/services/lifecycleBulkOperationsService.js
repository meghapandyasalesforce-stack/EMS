/**
 * Bulk lifecycle operations — onboarding, offboarding, documents, letters, workflows, reminders, exports.
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { bulkGenerateLetters } from './lifecycleLetterService.js';
import { bulkVerifyDocuments, sendDocumentReminders } from './lifecycleDocumentHubService.js';
import { notify } from '../helpers/notificationManager.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { applyProgressToWorkflow, synchronizeOnboardingWorkflows } from './onboardingService.js';
import { saveOffboardingWorkflow } from './offboardingService.js';
import { assertFeatureEnabled, assertModuleEnabled } from './lifecycleConfigService.js';

async function runBulk(items, handler) {
    const results = [];
    for (const item of items) {
        try {
            const data = await handler(item);
            results.push({ success: true, item, data });
        } catch (error) {
            results.push({ success: false, item, message: error.message });
        }
    }
    const succeeded = results.filter((r) => r.success).length;
    return { total: results.length, succeeded, failed: results.length - succeeded, results };
}

export async function bulkCreateOnboarding(organizationId, { employeeIds, templateId }, { actor, req } = {}) {
    const ids = employeeIds || [];
    return runBulk(ids, async (employeeId) => {
        const existing = await OnboardingWorkflow.findOne({ organizationId, employeeId, isTemplate: { $ne: true } });
        if (existing) throw new Error('Workflow already exists');
        const wf = await OnboardingWorkflow.create({
            organizationId,
            employeeId,
            templateId,
            status: 'Draft',
            startDate: new Date(),
            tasks: [],
            progress: 0,
        });
        await synchronizeOnboardingWorkflows(organizationId, { workflowIds: [wf._id] }).catch(() => {});
        return wf;
    });
}

export async function bulkCreateOffboarding(organizationId, { employeeIds, lastWorkingDate, reason }, { actor, req } = {}) {
    return runBulk(employeeIds || [], async (employeeId) => {
        const existing = await OffboardingWorkflow.findOne({ organizationId, employeeId, status: { $nin: ['Completed', 'Cancelled'] } });
        if (existing) throw new Error('Active offboarding exists');
        const wf = await OffboardingWorkflow.create({
            organizationId,
            employeeId,
            lastWorkingDate: lastWorkingDate || new Date(),
            reason: reason || 'Resignation',
            status: 'Draft',
            startDate: new Date(),
            progress: 0,
        });
        return wf;
    });
}

export async function bulkVerifyDocumentsOp(organizationId, { documentIds, verifiedBy, status = 'Verified' }, ctx) {
    return bulkVerifyDocuments(organizationId, documentIds, status, { actor: ctx?.actor || verifiedBy, req: ctx?.req });
}

export async function bulkDocumentReminders(organizationId, { documentIds, message }) {
    return sendDocumentReminders(organizationId, { documentIds, customMessage: message });
}

export async function bulkGenerateLettersOp(organizationId, payload, ctx) {
    return bulkGenerateLetters(organizationId, payload, ctx);
}

export async function bulkAssignWorkflowTemplate(organizationId, { workflowIds, templateId, workflowType = 'onboarding' }) {
    const Model = workflowType === 'offboarding' ? OffboardingWorkflow : OnboardingWorkflow;
    return runBulk(workflowIds || [], async (id) => {
        const wf = await Model.findOne({ _id: id, organizationId });
        if (!wf) throw new Error('Workflow not found');
        wf.templateId = templateId;
        await wf.save();
        return wf;
    });
}

export async function bulkSendReminders(organizationId, { workflowIds, workflowType = 'onboarding', reminderKey }) {
    return runBulk(workflowIds || [], async (id) => {
        await notify({
            type: workflowType === 'offboarding' ? 'lifecycle_offboarding_reminder' : 'lifecycle_onboarding_reminder',
            organizationId,
            data: { workflowId: id, reminderKey },
        });
        return { workflowId: id };
    });
}

export async function bulkRefreshProgress(organizationId, { workflowIds }) {
    return runBulk(workflowIds || [], async (id) => {
        const wf = await OnboardingWorkflow.findOne({ _id: id, organizationId, isTemplate: { $ne: true } });
        if (!wf) throw new Error('Not found');
        applyProgressToWorkflow(wf);
        await wf.save();
        return { progress: wf.progress };
    });
}

export async function bulkExportWorkflows(organizationId, { workflowType = 'onboarding', workflowIds }) {
    const Model = workflowType === 'offboarding' ? OffboardingWorkflow : OnboardingWorkflow;
    const query = { organizationId, isTemplate: { $ne: true } };
    if (workflowIds?.length) query._id = { $in: workflowIds };
    const rows = await Model.find(query).populate('employeeId', 'name lastName email').lean();
    const csv = ['id,employee,email,status,progress,startDate']
        .concat(rows.map((w) => [
            w._id,
            `"${w.employeeId?.name || ''} ${w.employeeId?.lastName || ''}"`,
            w.employeeId?.email || '',
            w.status,
            w.progress,
            w.startDate ? new Date(w.startDate).toISOString().slice(0, 10) : '',
        ].join(',')))
        .join('\n');
    return { format: 'csv', content: csv, count: rows.length };
}

export async function bulkSendNotifications(organizationId, { employeeIds, title, message, channels = ['inApp'] }) {
    return runBulk(employeeIds || [], async (employeeId) => {
        await notify({
            type: 'lifecycle_bulk_notification',
            organizationId,
            data: { employeeId, title, message, channels },
        });
        return { employeeId };
    });
}

export async function executeBulkOperation(organizationId, { operation, payload }, ctx = {}) {
    await assertFeatureEnabled(organizationId, 'bulkOperations', 'Bulk operations');

    const ops = {
        onboarding_create: async () => {
            await assertModuleEnabled(organizationId, 'onboarding');
            return bulkCreateOnboarding(organizationId, payload, ctx);
        },
        offboarding_create: async () => {
            await assertModuleEnabled(organizationId, 'offboarding');
            return bulkCreateOffboarding(organizationId, payload, ctx);
        },
        document_verify: async () => {
            await assertFeatureEnabled(organizationId, 'documentCollection', 'Document collection');
            return bulkVerifyDocumentsOp(organizationId, payload, ctx);
        },
        document_remind: async () => {
            await assertFeatureEnabled(organizationId, 'reminders', 'Reminders');
            return bulkDocumentReminders(organizationId, payload);
        },
        letter_generate: () => bulkGenerateLettersOp(organizationId, payload, ctx),
        workflow_assign: () => bulkAssignWorkflowTemplate(organizationId, payload),
        send_reminders: async () => {
            await assertFeatureEnabled(organizationId, 'reminders', 'Reminders');
            return bulkSendReminders(organizationId, payload);
        },
        progress_refresh: () => bulkRefreshProgress(organizationId, payload),
        export_workflows: () => bulkExportWorkflows(organizationId, payload),
        send_notifications: () => bulkSendNotifications(organizationId, payload),
    };

    if (!ops[operation]) throw new Error(`Unknown bulk operation: ${operation}`);
    const result = await ops[operation]();

    await logLifecycleAudit({
        action: 'Bulk', entityType: 'LifecycleOperation', entityName: operation,
        actor: ctx.actor, req: ctx.req, metadata: { operation, total: result.total, succeeded: result.succeeded },
    }).catch(() => {});

    return result;
}

export const BULK_OPERATIONS = Object.freeze([
    'onboarding_create', 'offboarding_create', 'document_verify', 'document_remind',
    'letter_generate', 'workflow_assign', 'send_reminders', 'progress_refresh',
    'export_workflows', 'send_notifications',
]);
