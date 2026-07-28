/**
 * IT provisioning — software requests, asset approvals, ticketing, inventory dashboard.
 */

import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';
import Employee from '../models/employee.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled, assertAnyFeatureEnabled } from './lifecycleConfigService.js';
import { createItTicket, listItTicketingProviders } from './itTicketingAdapter.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { getProvisioningTemplateForSystem, listProvisioningTemplates } from '../constants/accessProvisioningCatalog.js';

async function loadOnboarding(organizationId, workflowId) {
    const wf = await OnboardingWorkflow.findOne({ _id: workflowId, organizationId, isTemplate: { $ne: true } });
    if (!wf) throw new Error('Onboarding workflow not found');
    return wf;
}

function actorName(actor) {
    if (!actor) return 'HR Admin';
    return [actor.name, actor.lastName].filter(Boolean).join(' ').trim() || actor.email || 'HR Admin';
}

function parseSoftwareNotes(notes) {
    if (!notes) return { legacyNotes: '', timeline: [], details: {} };
    const [jsonPart, ...textTail] = String(notes).split(' | ');
    try {
        const parsed = JSON.parse(jsonPart);
        if (parsed && parsed.__accessProvisioning === true) {
            return {
                legacyNotes: parsed.legacyNotes || '',
                details: parsed.details || {},
                timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
                assignedByName: parsed.assignedByName || '',
                assignedOn: parsed.assignedOn || null,
                approvedDate: parsed.approvedDate || null,
                systemNote: parsed.systemNote || textTail.join(' | ') || '',
            };
        }
    } catch {
        // fall through to legacy notes shape
    }
    return { legacyNotes: notes, timeline: [], details: {}, systemNote: '' };
}

function serializeSoftwareNotes(payload) {
    return JSON.stringify({
        __accessProvisioning: true,
        legacyNotes: payload.legacyNotes || '',
        details: payload.details || {},
        timeline: payload.timeline || [],
        assignedByName: payload.assignedByName || '',
        assignedOn: payload.assignedOn || null,
        approvedDate: payload.approvedDate || null,
        systemNote: payload.systemNote || '',
    });
}

function addProvisioningTimelineEntry(reqItem, type, label, actor, extra = {}) {
    const payload = parseSoftwareNotes(reqItem.notes);
    payload.timeline = payload.timeline || [];
    payload.timeline.push({
        type,
        label,
        at: new Date().toISOString(),
        by: actorName(actor),
        ...extra,
    });
    reqItem.notes = serializeSoftwareNotes(payload);
    return payload;
}

function setProvisioningDetails(reqItem, details = {}, actor) {
    const payload = parseSoftwareNotes(reqItem.notes);
    payload.details = details;
    payload.assignedByName = actorName(actor);
    payload.assignedOn = new Date().toISOString();
    reqItem.notes = serializeSoftwareNotes(payload);
    return payload;
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
        notes: serializeSoftwareNotes({
            legacyNotes: notes || '',
            details: {},
            timeline: [{
                type: 'requested',
                label: 'Requested',
                at: new Date().toISOString(),
                by: actorName(actor),
            }],
        }),
        status: 'Pending',
        approvalStatus: 'Pending',
    });
    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'software_access_requested',
        description: `Access requested: ${system}`,
        actor: actor?._id,
        actorName: actorName(actor),
        metadata: { system, category },
        createdAt: new Date(),
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

export async function approveSoftwareRequest(workflow, requestId, { approved = true, notes, provisioningDetails }, { actor, req } = {}) {
    await assertFeatureEnabled(workflow.organizationId, 'softwareAccessRequest', 'Software access requests');
    const reqItem = workflow.softwareRequests?.id(requestId);
    if (!reqItem) throw new Error('Software request not found');

    const normalizedDetails = provisioningDetails && typeof provisioningDetails === 'object'
        ? provisioningDetails
        : {};

    reqItem.approvalStatus = approved ? 'Approved' : 'Rejected';
    reqItem.status = approved ? 'Approved' : 'Rejected';
    reqItem.approvedBy = actor?._id;
    if (approved) {
        setProvisioningDetails(reqItem, normalizedDetails, actor);
        const payload = addProvisioningTimelineEntry(reqItem, 'reviewed', 'Reviewed', actor);
        payload.approvedDate = new Date().toISOString();
        payload.legacyNotes = notes || payload.legacyNotes || '';
        payload.timeline.push({
            type: 'approved',
            label: 'Approved',
            at: new Date().toISOString(),
            by: actorName(actor),
        });
        reqItem.notes = serializeSoftwareNotes(payload);
    } else {
        const payload = addProvisioningTimelineEntry(reqItem, 'reviewed', 'Reviewed', actor);
        payload.legacyNotes = notes || payload.legacyNotes || '';
        payload.timeline.push({
            type: 'rejected',
            label: 'Rejected',
            at: new Date().toISOString(),
            by: actorName(actor),
        });
        reqItem.notes = serializeSoftwareNotes(payload);
    }

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
            const payload = parseSoftwareNotes(reqItem.notes);
            payload.systemNote = ticket.message || 'Ticket created for IT provisioning';
            reqItem.notes = serializeSoftwareNotes(payload);
        } else {
            reqItem.status = 'Approved';
            reqItem.ticketId = ticket.ticketId || undefined;
            reqItem.ticketUrl = ticket.ticketUrl || undefined;
            const payload = parseSoftwareNotes(reqItem.notes);
            payload.systemNote = ticket.message || 'Manual Processing Required';
            reqItem.notes = serializeSoftwareNotes(payload);
        }
        reqItem.provisionedAt = undefined;
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: approved ? 'software_access_approved' : 'software_access_rejected',
        description: `${approved ? 'Access approved' : 'Access rejected'}: ${reqItem.system}`,
        actor: actor?._id,
        actorName: actorName(actor),
        metadata: {
            system: reqItem.system,
            status: reqItem.status,
            provisioningDetails: approved ? normalizedDetails : undefined,
        },
        createdAt: new Date(),
    });

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
    const payload = addProvisioningTimelineEntry(reqItem, 'provisioned', 'Provisioned', actor);
    reqItem.notes = serializeSoftwareNotes(payload);
    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'software_access_provisioned',
        description: `Access provisioned: ${reqItem.system}`,
        actor: actor?._id,
        actorName: actorName(actor),
        metadata: { system: reqItem.system },
        createdAt: new Date(),
    });
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

export function getAccessProvisioningCatalog() {
    return listProvisioningTemplates();
}

export function getAccessProvisioningTemplate(system) {
    return getProvisioningTemplateForSystem(system);
}

export { listItTicketingProviders, loadOnboarding, parseSoftwareNotes };
