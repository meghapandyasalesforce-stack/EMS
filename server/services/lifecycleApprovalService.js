/**
 * Bridges Lifecycle Settings approval bindings to the existing Approval Engine.
 */

import { initiateApproval } from './approvalWorkflowService.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { appendWorkflowTimeline } from './lifecycleAuditService.js';
import logger from '../helpers/logger.js';

const LIFECYCLE_ENTITY_TYPES = new Set([
    'Offer', 'Onboarding', 'Offboarding', 'Clearance', 'ExitInterview', 'FnF', 'AssetReturn', 'LifecycleForm', 'LifecycleLetter',
]);

const FEATURE_BY_ENTITY = Object.freeze({
    Offer: 'offerApproval',
    Onboarding: 'documentApproval',
    Offboarding: 'clearance',
    Clearance: 'clearance',
    ExitInterview: 'exitInterview',
    FnF: 'fnfSettlement',
    AssetReturn: 'assetReturn',
    LifecycleForm: 'digitalForms',
    LifecycleLetter: 'offerLetter',
});

export async function getLifecycleApprovalBinding(organizationId, entityType) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    const binding = (settings.approvals || []).find((a) => a.entityType === entityType);
    const featureKey = FEATURE_BY_ENTITY[entityType];
    if (featureKey && !isFeatureEnabled(settings, featureKey)) {
        return { enabled: false, approvalWorkflowId: null };
    }
    return {
        enabled: binding?.enabled === true,
        approvalWorkflowId: binding?.approvalWorkflowId || null,
    };
}

export async function initiateLifecycleApproval({
    organizationId,
    entityType,
    entityId,
    requestedBy,
    metadata = {},
    priority = 'Medium',
    req = null,
    actor = null,
}) {
    if (!LIFECYCLE_ENTITY_TYPES.has(entityType)) {
        throw new Error(`Unsupported lifecycle approval entity: ${entityType}`);
    }

    const binding = await getLifecycleApprovalBinding(organizationId, entityType);
    if (!binding.enabled) {
        return { status: 'Approved', autoApproved: true, skipped: true, reason: 'binding_disabled' };
    }

    const result = await initiateApproval({
        organizationId,
        entityType,
        entityId,
        requestedBy,
        workflowId: binding.approvalWorkflowId || null,
        metadata,
        priority,
    });

    await logLifecycleAudit({
        action: 'Create',
        entityType: entityType === 'FnF' ? 'F&F' : entityType,
        entityId,
        entityName: `${entityType} approval`,
        req,
        actor,
        metadata: { approvalResult: result },
    });

    return result;
}

export function appendLifecycleActivity(workflow, payload) {
    appendWorkflowTimeline(workflow, payload);
}

export async function handleLifecycleApprovalOutcome(instance) {
    const { applyLifecycleApprovalOutcome } = await import('./lifecycleApprovalHandlers.js');
    return applyLifecycleApprovalOutcome(instance);
}
