/**
 * IT provisioning — software requests, asset approvals, ticketing, inventory dashboard.
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled, assertAnyFeatureEnabled } from './lifecycleConfigService.js';
import { createItTicket, listItTicketingProviders } from './itTicketingAdapter.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';

async function loadOnboarding(organizationId, workflowId) {
    const wf = await OnboardingWorkflow.findOne({ _id: workflowId, organizationId, isTemplate: { $ne: true } });
    if (!wf) throw new Error('Onboarding workflow not found');
    return wf;
}

export function buildSoftwareInventoryDashboard(workflows = []) {
    const bySystem = new Map();
    let pending = 0;
    let provisioned = 0;
    let revoked = 0;

    for (const wf of workflows) {
        for (const req of wf.softwareRequests || []) {
            const key = req.system;
            if (!bySystem.has(key)) bySystem.set(key, { system: key, total: 0, pending: 0, provisioned: 0 });
            const row = bySystem.get(key);
            row.total += 1;
            if (req.status === 'Provisioned') { row.provisioned += 1; provisioned += 1; }
            else if (req.status === 'Revoked') { revoked += 1; }
            else { row.pending += 1; pending += 1; }
        }
    }

    return {
        totals: { pending, provisioned, revoked, systems: bySystem.size },
        bySystem: [...bySystem.values()].sort((a, b) => b.total - a.total),
    };
}

export async function getSoftwareInventoryDashboard(organizationId) {
    const workflows = await OnboardingWorkflow.find({
        organizationId, isTemplate: { $ne: true },
    }).select('softwareRequests employeeId status').lean();
    return buildSoftwareInventoryDashboard(workflows);
}

export async function addSoftwareRequest(workflow, { system, category, mandatory, notes }, { actor, req } = {}) {
    await assertFeatureEnabled(workflow.organizationId, 'softwareAccessRequest', 'Software access requests');

    workflow.softwareRequests = workflow.softwareRequests || [];
    workflow.softwareRequests.push({
        system,
        category: category || 'application',
        mandatory: Boolean(mandatory),
        notes,
        status: 'Pending',
        approvalStatus: 'Pending',
    });

    await logLifecycleAudit({
        action: 'Create', entityType: 'SoftwareRequest', entityId: workflow._id,
        entityName: system, actor, req,
    });

    await notify({
        type: 'lifecycle_software_request',
        organizationId: workflow.organizationId,
        data: { workflowId: workflow._id, system, employeeId: workflow.employeeId },
    }).catch(() => {});

    return workflow;
}

export async function approveSoftwareRequest(workflow, requestId, { approved = true, notes }, { actor, req } = {}) {
    await assertFeatureEnabled(workflow.organizationId, 'softwareAccessRequest', 'Software access requests');
    const reqItem = workflow.softwareRequests?.id(requestId);
    if (!reqItem) throw new Error('Software request not found');

    reqItem.approvalStatus = approved ? 'Approved' : 'Rejected';
    reqItem.status = approved ? 'Approved' : 'Rejected';
    reqItem.approvedBy = actor?._id;
    if (notes) reqItem.notes = notes;

    if (approved) {
        const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
        const provider = settings.itTicketingProvider || process.env.IT_TICKETING_PROVIDER || 'manual';
        const employee = await Employee.findById(workflow.employeeId).select('name email').lean();
        const ticket = await createItTicket(provider, {
            summary: `Software access: ${reqItem.system}`,
            description: `Employee: ${employee?.name} (${employee?.email})\nWorkflow: ${workflow._id}\nNotes: ${notes || ''}`,
            requesterEmail: employee?.email,
        });

        // Never auto-mark Provisioned unless a real ticket was created successfully
        if (ticket.success && ticket.ticketId && !ticket.manualRequired) {
            reqItem.ticketId = ticket.ticketId;
            reqItem.ticketUrl = ticket.ticketUrl;
            reqItem.status = 'Ticket Created';
            reqItem.notes = [reqItem.notes, ticket.message].filter(Boolean).join(' | ');
        } else {
            reqItem.status = 'Approved';
            reqItem.ticketId = ticket.ticketId || undefined;
            reqItem.ticketUrl = ticket.ticketUrl || undefined;
            reqItem.notes = [
                reqItem.notes,
                ticket.message || 'Manual Processing Required',
            ].filter(Boolean).join(' | ');
        }
        reqItem.provisionedAt = undefined;
    }

    await logLifecycleAudit({
        action: approved ? 'Approve' : 'Reject', entityType: 'SoftwareRequest',
        entityId: requestId, entityName: reqItem.system, actor, req,
    });

    return { workflow, request: reqItem };
}

export async function markSoftwareProvisioned(workflow, requestId, { actor, req } = {}) {
    await assertFeatureEnabled(workflow.organizationId, 'softwareAccessRequest', 'Software access requests');
    const reqItem = workflow.softwareRequests?.id(requestId);
    if (!reqItem) throw new Error('Software request not found');
    reqItem.status = 'Provisioned';
    reqItem.provisionedAt = new Date();
    await logLifecycleAudit({ action: 'Update', entityType: 'SoftwareRequest', entityId: requestId, entityName: reqItem.system, actor, req });
    return reqItem;
}

export async function revokeSoftwareOnOffboarding(offboardingWorkflow, { actor, req } = {}) {
    await assertFeatureEnabled(offboardingWorkflow.organizationId, 'softwareAccessRequest', 'Software access requests');
    const settings = await getOrCreateLifecycleSettings(offboardingWorkflow.organizationId);
    const provider = settings.itTicketingProvider || 'manual';
    const onboarding = await OnboardingWorkflow.findOne({
        organizationId: offboardingWorkflow.organizationId,
        employeeId: offboardingWorkflow.employeeId,
        isTemplate: { $ne: true },
    }).lean();

    const results = [];
    for (const req of onboarding?.softwareRequests || []) {
        if (req.status !== 'Provisioned') continue;
        const ticket = await createItTicket(provider, {
            summary: `Revoke software access: ${req.system}`,
            description: `Offboarding workflow ${offboardingWorkflow._id}`,
        });
        results.push({ system: req.system, ticket });
    }

    await logLifecycleAudit({
        action: 'Revoke', entityType: 'SoftwareAccess', entityId: offboardingWorkflow._id,
        entityName: 'Software recovery', actor, req, metadata: { count: results.length },
    });

    return results;
}

export async function requestDeviceReplacement(workflow, { reason, assetType = 'Laptop' }, { actor, req } = {}) {
    await assertFeatureEnabled(workflow.organizationId, 'itAssetProvisioning', 'IT asset provisioning');
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    const provider = settings.itTicketingProvider || 'manual';
    const employee = await Employee.findById(workflow.employeeId).select('name email').lean();
    const ticket = await createItTicket(provider, {
        summary: `Device replacement: ${assetType}`,
        description: `Employee: ${employee?.name}\nReason: ${reason}`,
        requesterEmail: employee?.email,
    });

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'device_replacement_requested',
        description: `${assetType} replacement — ${ticket.ticketId || 'pending'}`,
        actor: actor?._id,
        createdAt: new Date(),
    });

    await logLifecycleAudit({ action: 'Create', entityType: 'AssetRequest', entityId: workflow._id, entityName: assetType, actor, req, metadata: { ticket } });
    return { ticket, workflow };
}

export { listItTicketingProviders, loadOnboarding };
