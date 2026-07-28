/**
 * Background verification — vendor adapter architecture + manual checks.
 */

import { BackgroundVerificationCase } from '../models/lifecycleGap.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled, assertFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { OnboardingWorkflow } from '../models/onboarding.model.js';

/** Core BGV always includes address/criminal/identity. Employment/education/reference need their Configure toggles. */
const DEFAULT_CHECKS = [
    { checkType: 'employment', label: 'Employment Verification', mandatory: true, featureKey: 'employmentVerification' },
    { checkType: 'education', label: 'Education Verification', mandatory: true, featureKey: 'educationVerification' },
    { checkType: 'address', label: 'Address Verification', mandatory: false, featureKey: 'backgroundVerification' },
    { checkType: 'reference', label: 'Reference Check', mandatory: false, featureKey: 'referenceVerification' },
    { checkType: 'criminal', label: 'Criminal Verification', mandatory: false, featureKey: 'backgroundVerification' },
    { checkType: 'identity', label: 'Identity Verification', mandatory: true, featureKey: 'backgroundVerification' },
];

function resolveBgvCheckLabel(checkType, label) {
    if (label && !/^verification check$/i.test(String(label))) return label;
    return DEFAULT_CHECKS.find((c) => c.checkType === checkType)?.label || checkType || 'Verification Check';
}

const CORE_CHECK_TYPES = new Set(['address', 'criminal', 'identity']);

/** Sub-check toggles: parent backgroundVerification must be on; optional child keys further filter. */
function resolveEnabledChecks(settings, checkTypes) {
    const policyDefaults = settings.bgvPolicy?.defaultChecks || [];
    const base = checkTypes?.length
        ? DEFAULT_CHECKS.filter((c) => checkTypes.includes(c.checkType))
        : (policyDefaults.length
            ? DEFAULT_CHECKS.filter((c) => policyDefaults.includes(c.checkType))
            : DEFAULT_CHECKS.filter((c) => (
                CORE_CHECK_TYPES.has(c.checkType) || isFeatureEnabled(settings, c.featureKey)
            )));

    return base.filter((c) => {
        if (c.featureKey === 'backgroundVerification') return true;
        return isFeatureEnabled(settings, c.featureKey);
    });
}

/**
 * When Configure enables more check types later, append missing checks to an open case.
 * When Configure disables BGV, this function will be called to handle the transition.
 */
export async function alignBgvCaseChecks(bgvCase, settings, { actor } = {}) {
    if (!bgvCase) return bgvCase;
    
    // If BGV is disabled, preserve historical data but mark as inactive
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        if (bgvCase.isActive !== false) {
            bgvCase.isActive = false;
            bgvCase.activityFeed = bgvCase.activityFeed || [];
            bgvCase.activityFeed.unshift({
                action: 'bgv_disabled',
                description: 'Background verification disabled from Configure',
                actor: actor?._id || actor,
                actorName: actor?.name || 'System',
                metadata: { disabledAt: new Date() },
            });
            await bgvCase.save();
        }
        return bgvCase;
    }
    
    // If BGV is re-enabled, reactivate the case
    if (bgvCase.isActive === false) {
        bgvCase.isActive = true;
        bgvCase.activityFeed = bgvCase.activityFeed || [];
        bgvCase.activityFeed.unshift({
            action: 'bgv_enabled',
            description: 'Background verification re-enabled from Configure',
            actor: actor?._id || actor,
            actorName: actor?.name || 'System',
            metadata: { enabledAt: new Date() },
        });
        await bgvCase.save();
    }
    
    // Don't modify completed cases
    if (['Clear', 'Waived', 'Failed'].includes(bgvCase.overallStatus)) return bgvCase;
    
    const selected = resolveEnabledChecks(settings);
    const existing = new Set((bgvCase.checks || []).map((c) => c.checkType));
    const missing = selected.filter((c) => !existing.has(c.checkType));
    if (!missing.length) return bgvCase;

    const startStatus = bgvCase.overallStatus === 'Not Started' ? 'Not Started' : 'Initiated';
    for (const c of missing) {
        bgvCase.checks.push({
            checkType: c.checkType,
            label: c.label,
            mandatory: c.mandatory,
            status: startStatus,
            initiatedAt: startStatus === 'Initiated' ? new Date() : undefined,
        });
    }
    bgvCase.activityFeed.unshift({
        action: 'bgv_checks_aligned',
        description: `Added checks from Configure: ${missing.map((c) => c.label).join(', ')}`,
        actor: actor?._id || actor,
    });
    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();
    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});
    return bgvCase;
}

function checkProgressWeight(status) {
    switch (status) {
        case 'Clear':
        case 'Waived':
            return 1;
        case 'In Progress':
            return 0.55;
        case 'Initiated':
            return 0.25;
        case 'Discrepancy':
            return 0.4;
        case 'Failed':
            return 0;
        default:
            return 0;
    }
}

function computeBgvProgress(bgvCase) {
    if (!bgvCase) return { progress: 0, status: 'Not Started' };
    const status = bgvCase.overallStatus || 'Not Started';
    if (status === 'Clear' || status === 'Waived') return { progress: 100, status };
    const checks = (bgvCase.checks || []).filter((c) => c.mandatory !== false);
    const pool = checks.length ? checks : (bgvCase.checks || []);
    if (!pool.length) {
        return { progress: status === 'In Progress' ? 25 : 0, status };
    }
    const failed = pool.some((c) => c.status === 'Failed');
    const sum = pool.reduce((n, c) => n + checkProgressWeight(c.status), 0);
    const progress = Math.min(99, Math.round((sum / pool.length) * 100));
    return { progress, status: failed ? 'Failed' : status };
}

async function syncBgvProgressToWorkflow(bgvCase, { actor } = {}) {
    if (!bgvCase?.onboardingWorkflowId) return null;

    const { OnboardingWorkflow } = await import('../models/onboarding.model.js');
    const { applyProgressToWorkflow, addActivity } = await import('./onboardingService.js');
    const { emitOnboardingChangedAsync } = await import('../helpers/backgroundTasks.js');

    const workflow = await OnboardingWorkflow.findById(bgvCase.onboardingWorkflowId);
    if (!workflow) return null;

    const settings = await getOrCreateLifecycleSettings(bgvCase.organizationId);
    const { progress, status } = computeBgvProgress(bgvCase);
    const blockJoining = Boolean(settings.bgvPolicy?.blockJoiningUntilClear)
        && isFeatureEnabled(settings, 'backgroundVerification')
        && !['Clear', 'Waived'].includes(status);

    const prevStatus = workflow.bgvStatus;
    workflow.bgvProgress = progress;
    workflow.bgvStatus = status;
    workflow.bgvBlocksJoining = blockJoining;
    if (!workflow.backgroundVerificationCaseId) {
        workflow.backgroundVerificationCaseId = bgvCase._id;
    }

    applyProgressToWorkflow(workflow, settings);

    if (prevStatus !== status) {
        addActivity(workflow, {
            action: 'bgv_status_changed',
            description: `Background verification status: ${status} (${progress}%)`,
            actor: actor?._id || actor,
            actorName: actor?.name || 'System',
            metadata: { bgvCaseId: bgvCase._id, status, progress },
        });
    }

    await workflow.save();
    emitOnboardingChangedAsync(workflow.organizationId, workflow._id);
    return workflow;
}

const vendors = new Map();

export function registerBgvVendor(name, adapter) {
    vendors.set(name, adapter);
}

/** SpringVerify API adapter */
registerBgvVendor('springverify', {
    async initiateCase({ bgvCase, organizationId }) {
        const apiKey = process.env.SPRINGVERIFY_API_KEY;
        const baseUrl = process.env.SPRINGVERIFY_API_URL || 'https://api.springverify.com/v1';
        if (!apiKey) throw new Error('SpringVerify not configured (SPRINGVERIFY_API_KEY)');
        const res = await fetch(`${baseUrl}/cases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                referenceId: String(bgvCase._id),
                organizationId: String(organizationId),
                checks: bgvCase.checks.map((c) => c.checkType),
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'SpringVerify initiate failed');
        return { vendorCaseId: data.caseId || data.id, status: 'In Progress' };
    },
    async syncCase({ bgvCase }) {
        const apiKey = process.env.SPRINGVERIFY_API_KEY;
        const baseUrl = process.env.SPRINGVERIFY_API_URL || 'https://api.springverify.com/v1';
        const res = await fetch(`${baseUrl}/cases/${bgvCase.vendorCaseId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json();
        if (!res.ok) return null;
        return (data.checks || []).map((c) => ({
            checkType: c.type,
            status: c.status === 'completed' ? 'Clear' : c.status === 'failed' ? 'Failed' : 'In Progress',
            resultSummary: c.summary,
            vendorRef: c.id,
        }));
    },
});

/** AuthBridge API adapter */
registerBgvVendor('authbridge', {
    async initiateCase({ bgvCase, organizationId }) {
        const apiKey = process.env.AUTHBRIDGE_API_KEY;
        const baseUrl = process.env.AUTHBRIDGE_API_URL || 'https://api.authbridge.com/v2';
        if (!apiKey) throw new Error('AuthBridge not configured (AUTHBRIDGE_API_KEY)');
        const res = await fetch(`${baseUrl}/verification/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({ clientReferenceId: String(bgvCase._id), checks: bgvCase.checks.map((c) => c.checkType) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'AuthBridge initiate failed');
        return { vendorCaseId: data.requestId, status: 'In Progress' };
    },
    async syncCase({ bgvCase }) {
        const apiKey = process.env.AUTHBRIDGE_API_KEY;
        const baseUrl = process.env.AUTHBRIDGE_API_URL || 'https://api.authbridge.com/v2';
        const res = await fetch(`${baseUrl}/verification/${bgvCase.vendorCaseId}`, {
            headers: { 'X-API-Key': apiKey },
        });
        const data = await res.json();
        if (!res.ok) return null;
        return (data.verifications || []).map((v) => ({
            checkType: v.type,
            status: v.result === 'GREEN' ? 'Clear' : v.result === 'RED' ? 'Failed' : 'In Progress',
            resultSummary: v.remarks,
        }));
    },
});

/** IDfy API adapter */
registerBgvVendor('idfy', {
    async initiateCase({ bgvCase }) {
        const apiKey = process.env.IDFY_API_KEY;
        const accountId = process.env.IDFY_ACCOUNT_ID;
        const baseUrl = process.env.IDFY_API_URL || 'https://eve.idfy.com/v3';
        if (!apiKey || !accountId) throw new Error('IDfy not configured (IDFY_API_KEY, IDFY_ACCOUNT_ID)');
        const res = await fetch(`${baseUrl}/tasks/async/verify_with_source/ind_pan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey, 'account-id': accountId },
            body: JSON.stringify({ task_id: String(bgvCase._id), group_id: String(bgvCase.organizationId) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'IDfy initiate failed');
        return { vendorCaseId: data.request_id || data.requestId, status: 'In Progress' };
    },
    async syncCase({ bgvCase }) {
        const apiKey = process.env.IDFY_API_KEY;
        const accountId = process.env.IDFY_ACCOUNT_ID;
        const baseUrl = process.env.IDFY_API_URL || 'https://eve.idfy.com/v3';
        const res = await fetch(`${baseUrl}/tasks?request_id=${bgvCase.vendorCaseId}`, {
            headers: { 'api-key': apiKey, 'account-id': accountId },
        });
        const data = await res.json();
        if (!res.ok) return null;
        const tasks = Array.isArray(data) ? data : [data];
        return tasks.map((t) => ({
            checkType: t.type || 'identity',
            status: t.status === 'completed' ? 'Clear' : t.status === 'failed' ? 'Failed' : 'In Progress',
            resultSummary: t.result?.source_output?.status,
        }));
    },
});

registerBgvVendor('manual', {
    async initiateCase() {
        return { vendorCaseId: null, status: 'In Progress' };
    },
    async syncCase() {
        return null;
    },
});

/** Third-party BGV vendor placeholder — never auto-clears checks */
registerBgvVendor('stub_vendor', {
    async initiateCase({ bgvCase }) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('stub_vendor is not allowed in production. Configure a real BGV vendor or use manual.');
        }
        return {
            vendorCaseId: `PENDING-${bgvCase._id}`,
            status: 'In Progress',
            message: 'Vendor not configured — case remains In Progress for manual HR verification',
        };
    },
    async syncCase() {
        // Never fabricate Clear/Failed — HR must verify manually
        return null;
    },
});

function deriveOverallStatus(checks) {
    const mandatory = checks.filter((c) => c.mandatory !== false);
    if (!mandatory.length) return 'Not Started';
    if (mandatory.every((c) => c.status === 'Clear' || c.status === 'Waived')) return 'Clear';
    if (mandatory.some((c) => c.status === 'Failed')) return 'Failed';
    if (mandatory.some((c) => ['Initiated', 'In Progress'].includes(c.status))) return 'In Progress';
    if (mandatory.some((c) => c.status === 'Discrepancy')) return 'Partially Clear';
    return 'Not Started';
}

export async function createBgvCase({
    organizationId,
    subjectType,
    candidateId,
    employeeId,
    onboardingWorkflowId,
    checkTypes,
    actor,
    req,
}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        throw new Error('Background verification is disabled. Enable it from Employee Lifecycle → Configure.');
    }

    if (onboardingWorkflowId && !employeeId) {
        const { OnboardingWorkflow } = await import('../models/onboarding.model.js');
        const wf = await OnboardingWorkflow.findOne({ _id: onboardingWorkflowId, organizationId })
            .select('employeeId')
            .lean();
        if (wf?.employeeId) employeeId = wf.employeeId;
    }

    const vendor = settings.bgvPolicy?.vendor || 'manual';
    const selected = resolveEnabledChecks(settings, checkTypes);
    if (!selected.length) {
        throw new Error('No BGV checks enabled. Enable verification sub-features in Configure or pass checkTypes.');
    }

    const bgvCase = await BackgroundVerificationCase.create({
        organizationId,
        subjectType,
        candidateId,
        employeeId,
        onboardingWorkflowId,
        vendor,
        checks: selected.map((c) => ({
            checkType: c.checkType,
            label: c.label,
            mandatory: c.mandatory,
            status: 'Not Started',
        })),
        overallStatus: 'Not Started',
        initiatedBy: actor?._id,
        activityFeed: [{
            action: 'bgv_created',
            description: 'Background verification case created',
            actor: actor?._id,
        }],
    });

    const adapter = vendors.get(vendor) || vendors.get('manual');
    let vendorResult;
    try {
        vendorResult = await adapter.initiateCase({ bgvCase, organizationId });
    } catch (vendorError) {
        if (vendor !== 'manual') {
            bgvCase.vendor = 'manual';
            bgvCase.activityFeed.unshift({
                action: 'bgv_vendor_fallback',
                description: `Vendor "${vendor}" unavailable (${vendorError.message}). Continuing with manual checks.`,
                actor: actor?._id,
            });
            vendorResult = await vendors.get('manual').initiateCase({ bgvCase, organizationId });
        } else {
            throw vendorError;
        }
    }
    if (vendorResult?.vendorCaseId) bgvCase.vendorCaseId = vendorResult.vendorCaseId;
    bgvCase.overallStatus = 'In Progress';
    bgvCase.checks.forEach((c) => { c.status = 'Initiated'; c.initiatedAt = new Date(); });
    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'BGV Case',
        req,
        actor,
        after: bgvCase.toObject(),
    });

    await notify({
        type: 'lifecycle_bgv_initiated',
        organizationId,
        data: { bgvCase },
    }).catch(() => {});

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});

    return bgvCase;
}

export async function updateBgvCheckStatus(organizationId, caseId, checkId, {
    status, notes, resultSummary, actor, req,
}) {
    await assertFeatureEnabled(organizationId, 'backgroundVerification', 'Background verification');
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId });
    if (!bgvCase) throw new Error('BGV case not found');
    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const previousStatus = check.status;
    const previousOverall = bgvCase.overallStatus;
    check.status = status;
    if (notes !== undefined) check.notes = notes;
    if (resultSummary !== undefined) check.resultSummary = resultSummary;
    if (['Clear', 'Failed', 'Discrepancy', 'Waived'].includes(status)) {
        check.completedAt = new Date();
    }
    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    if (bgvCase.overallStatus === 'Clear') bgvCase.completedAt = new Date();

    bgvCase.activityFeed.unshift({
        action: 'bgv_check_updated',
        description: `${check.label}: ${previousStatus} → ${status}`,
        actor: actor?._id || actor,
    });
    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'BGV Check',
        req,
        actor,
        before: { checkId, status: previousStatus, overall: previousOverall },
        after: { checkId, status, overall: bgvCase.overallStatus },
    }).catch(() => {});

    if (bgvCase.overallStatus === 'Clear' && previousOverall !== 'Clear') {
        await notify({
            type: 'lifecycle_bgv_cleared',
            organizationId,
            data: { bgvCase },
        }).catch(() => {});
    }
    if (bgvCase.overallStatus === 'Failed' && previousOverall !== 'Failed') {
        await notify({
            type: 'lifecycle_bgv_failed',
            organizationId,
            data: { bgvCase },
        }).catch(() => {});
    }

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});
    return bgvCase;
}

export async function syncBgvVendorCase(organizationId, caseId, { actor } = {}) {
    await assertFeatureEnabled(organizationId, 'backgroundVerification', 'Background verification');
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId });
    if (!bgvCase || bgvCase.vendor === 'manual') return bgvCase;

    const adapter = vendors.get(bgvCase.vendor);
    if (!adapter?.syncCase) return bgvCase;

    const previousOverall = bgvCase.overallStatus;
    const updates = await adapter.syncCase({ bgvCase, organizationId });
    if (Array.isArray(updates)) {
        for (const upd of updates) {
            const check = bgvCase.checks.find((c) => c.checkType === upd.checkType);
            if (check) Object.assign(check, upd);
        }
        bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
        await bgvCase.save();
        if (bgvCase.overallStatus === 'Clear' && previousOverall !== 'Clear') {
            await notify({ type: 'lifecycle_bgv_cleared', organizationId, data: { bgvCase } }).catch(() => {});
        }
        if (bgvCase.overallStatus === 'Failed' && previousOverall !== 'Failed') {
            await notify({ type: 'lifecycle_bgv_failed', organizationId, data: { bgvCase } }).catch(() => {});
        }
        await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});
    }
    return bgvCase;
}

export async function listBgvCases(organizationId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return [];
    }
    const query = { organizationId };
    if (filters.employeeId) query.employeeId = filters.employeeId;
    if (filters.candidateId) query.candidateId = filters.candidateId;
    if (filters.status) query.overallStatus = filters.status;
    if (filters.onboardingWorkflowId) query.onboardingWorkflowId = filters.onboardingWorkflowId;
    const cases = await BackgroundVerificationCase.find(query).sort({ createdAt: -1 });
    // Refresh progress + append newly enabled check types for a specific employee/workflow
    if (filters.onboardingWorkflowId || filters.employeeId) {
        await Promise.all(cases.slice(0, 5).map(async (bgvCase) => {
            await alignBgvCaseChecks(bgvCase, settings).catch(() => null);
            await syncBgvProgressToWorkflow(bgvCase).catch(() => null);
        }));
    }
    return cases.map((c) => (typeof c.toObject === 'function' ? c.toObject() : c));
}

export function buildBgvDashboard(cases) {
    return {
        total: cases.length,
        inProgress: cases.filter((c) => c.overallStatus === 'In Progress').length,
        clear: cases.filter((c) => c.overallStatus === 'Clear').length,
        failed: cases.filter((c) => c.overallStatus === 'Failed').length,
        pendingChecks: cases.reduce((n, c) =>
            n + (c.checks || []).filter((ch) => !['Clear', 'Waived', 'Failed'].includes(ch.status)).length, 0),
        checkClearanceRate: cases.length
            ? Math.round((cases.filter((c) => c.overallStatus === 'Clear').length / cases.length) * 100) : 0,
        slaBreached: cases.filter((c) => c.slaBreached).length,
    };
}

export async function isBgvBlockingJoining(organizationId, workflow) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) return false;
    if (!settings.bgvPolicy?.blockJoiningUntilClear) return false;
    if (workflow.bgvStatus === 'Waived' || workflow.bgvStatus === 'Clear') return false;
    if (workflow.bgvBlocksJoining) return true;
    if (!workflow.backgroundVerificationCaseId) return true;
    const bgvCase = await BackgroundVerificationCase.findById(workflow.backgroundVerificationCaseId).lean();
    return !bgvCase || !['Clear', 'Waived'].includes(bgvCase.overallStatus);
}

export async function getBgvCaseForWorkflow(organizationId, workflowId, { workflow: workflowDoc, actor } = {}) {
    await assertFeatureEnabled(organizationId, 'backgroundVerification', 'Background verification');

    let bgvCase = await BackgroundVerificationCase.findOne({
        organizationId,
        onboardingWorkflowId: workflowId,
    });

    if (!bgvCase && workflowDoc?.backgroundVerificationCaseId) {
        bgvCase = await BackgroundVerificationCase.findOne({
            _id: workflowDoc.backgroundVerificationCaseId,
            organizationId,
        });
    }

    if (!bgvCase) return null;

    const workflowEmployeeId = workflowDoc?.employeeId?._id || workflowDoc?.employeeId;
    if (!bgvCase.employeeId && workflowEmployeeId) {
        bgvCase.employeeId = workflowEmployeeId;
    }
    if (!bgvCase.onboardingWorkflowId && workflowId) {
        bgvCase.onboardingWorkflowId = workflowId;
    }
    if (bgvCase.isModified?.()) {
        await bgvCase.save();
    }

    const settings = await getOrCreateLifecycleSettings(organizationId);
    await alignBgvCaseChecks(bgvCase, settings, { actor }).catch(() => null);
    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => null);

    return typeof bgvCase.toObject === 'function' ? bgvCase.toObject() : bgvCase;
}

export function listBgvVendors() {
    return [...vendors.keys()];
}

/**
 * Track BGV timeline with key milestones
 */
export async function trackBgvTimeline(bgvCase, { milestone, actor, req } = {}) {
    bgvCase.timeline = bgvCase.timeline || [];
    bgvCase.timeline.push({
        milestone,
        timestamp: new Date(),
        actor: actor?._id,
        actorName: actor?.name,
    });

    // Check for SLA breach
    const settings = await getOrCreateLifecycleSettings(bgvCase.organizationId);
    const slaDays = settings.bgvPolicy?.slaDays || 14;
    const initiatedAt = bgvCase.timeline.find(t => t.milestone === 'initiated')?.timestamp || bgvCase.createdAt;
    
    if (initiatedAt) {
        const daysElapsed = (new Date() - new Date(initiatedAt)) / (1000 * 60 * 60 * 24);
        if (daysElapsed > slaDays && !bgvCase.slaBreached) {
            bgvCase.slaBreached = true;
            bgvCase.slaBreachedAt = new Date();
            bgvCase.activityFeed.unshift({
                action: 'bgv_sla_breached',
                description: `SLA breached: ${Math.round(daysElapsed)} days elapsed (SLA: ${slaDays} days)`,
                actor: actor?._id,
            });
        }
    }

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'BGV Timeline',
        req,
        actor,
        metadata: { milestone },
    });

    return bgvCase;
}

/**
 * Initiate BGV approval workflow for critical results
 */
export async function initiateBgvApproval(organizationId, caseId, { actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId });
    if (!bgvCase) throw new Error('BGV case not found');

    // Only initiate approval for failed or discrepancy cases
    if (!['Failed', 'Partially Clear'].includes(bgvCase.overallStatus)) {
        throw new Error('Approval only required for failed or discrepancy cases');
    }

    const { initiateLifecycleApproval } = await import('./lifecycleApprovalService.js');
    
    const approval = await initiateLifecycleApproval({
        organizationId,
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: `BGV Case - ${bgvCase.overallStatus}`,
        requestedBy: actor?._id,
        workflowId: bgvCase.onboardingWorkflowId,
        metadata: { 
            overallStatus: bgvCase.overallStatus,
            failedChecks: bgvCase.checks.filter(c => c.status === 'Failed').map(c => c.checkType),
        },
    });

    bgvCase.approvalId = approval._id;
    bgvCase.approvalStatus = 'Pending';
    bgvCase.activityFeed.unshift({
        action: 'bgv_approval_initiated',
        description: 'Approval workflow initiated for BGV review',
        actor: actor?._id,
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'BGV Approval Initiated',
        req,
        actor,
    });

    return bgvCase;
}

/**
 * Complete manual verification with detailed evidence
 */
export async function completeManualVerification(organizationId, caseId, checkId, {
    status, notes, evidence, verifiedBy, verificationDate, actor, req,
}) {
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId });
    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.status = status;
    check.notes = notes;
    check.verifiedBy = verifiedBy || actor?._id;
    check.verificationDate = verificationDate || new Date();
    check.completedAt = new Date();
    
    if (evidence) {
        check.evidence = evidence;
    }

    // Add manual verification milestone
    await trackBgvTimeline(bgvCase, {
        milestone: `manual_verification_${check.checkType}`,
        actor,
        req,
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    
    if (bgvCase.overallStatus === 'Clear') {
        bgvCase.completedAt = new Date();
        await trackBgvTimeline(bgvCase, { milestone: 'completed', actor, req });
    }

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'Manual Verification Completed',
        req,
        actor,
        metadata: { checkId, checkType: check.checkType, status },
    });

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});

    return bgvCase;
}

/**
 * Get BGV case with full timeline and analytics
 */
export async function getBgvCaseWithAnalytics(organizationId, caseId) {
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId })
        .populate('employeeId', 'name lastName email')
        .populate('candidateId', 'name lastName email')
        .populate('initiatedBy', 'name lastName')
        .lean();

    if (!bgvCase) throw new Error('BGV case not found');

    // Calculate analytics
    const totalChecks = bgvCase.checks?.length || 0;
    const completedChecks = bgvCase.checks?.filter(c => ['Clear', 'Waived', 'Failed'].includes(c.status)).length || 0;
    const clearChecks = bgvCase.checks?.filter(c => c.status === 'Clear').length || 0;
    const failedChecks = bgvCase.checks?.filter(c => c.status === 'Failed').length || 0;
    
    const avgCheckDuration = bgvCase.checks?.reduce((sum, c) => {
        if (c.initiatedAt && c.completedAt) {
            return sum + (new Date(c.completedAt) - new Date(c.initiatedAt));
        }
        return sum;
    }, 0) / (completedChecks || 1);

    const initiatedAt = bgvCase.timeline?.find(t => t.milestone === 'initiated')?.timestamp || bgvCase.createdAt;
    const totalDuration = initiatedAt ? (new Date() - new Date(initiatedAt)) : 0;

    return {
        ...bgvCase,
        analytics: {
            totalChecks,
            completedChecks,
            clearChecks,
            failedChecks,
            completionRate: totalChecks ? Math.round((completedChecks / totalChecks) * 100) : 0,
            clearanceRate: totalChecks ? Math.round((clearChecks / totalChecks) * 100) : 0,
            avgCheckDuration: Math.round(avgCheckDuration / (1000 * 60 * 60 * 24)), // in days
            totalDuration: Math.round(totalDuration / (1000 * 60 * 60 * 24)), // in days
            slaBreached: bgvCase.slaBreached,
        },
    };
}

/**
 * Bulk sync all BGV cases with vendor
 */
export async function bulkSyncBgvCases(organizationId, { actor } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return { synced: 0, failed: 0, skipped: true };
    }

    const cases = await BackgroundVerificationCase.find({
        organizationId,
        vendor: { $ne: 'manual' },
        overallStatus: { $in: ['In Progress', 'Initiated'] },
    });

    let synced = 0;
    let failed = 0;

    for (const bgvCase of cases) {
        try {
            await syncBgvVendorCase(organizationId, bgvCase._id, { actor });
            synced++;
        } catch (error) {
            failed++;
        }
    }

    return { synced, failed, total: cases.length };
}

/**
 * Waive BGV requirement for an employee
 */
export async function waiveBgvRequirement(organizationId, caseId, { reason, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({ _id: caseId, organizationId });
    if (!bgvCase) throw new Error('BGV case not found');

    bgvCase.overallStatus = 'Waived';
    bgvCase.waivedAt = new Date();
    bgvCase.waivedBy = actor?._id;
    bgvCase.waiverReason = reason;
    bgvCase.checks.forEach(c => {
        if (c.status !== 'Clear') {
            c.status = 'Waived';
            c.waivedAt = new Date();
        }
    });

    bgvCase.activityFeed.unshift({
        action: 'bgv_waived',
        description: `BGV requirement waived: ${reason}`,
        actor: actor?._id,
    });

    await bgvCase.save();

    await trackBgvTimeline(bgvCase, { milestone: 'waived', actor, req });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: bgvCase._id,
        entityName: 'BGV Waived',
        req,
        actor,
        metadata: { reason },
    });

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});

    return bgvCase;
}

/**
 * Get BGV statistics for dashboard
 */
export async function getBgvStatistics(organizationId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return { enabled: false };
    }

    const cases = await BackgroundVerificationCase.find({ organizationId }).lean();

    const byStatus = cases.reduce((acc, c) => {
        acc[c.overallStatus] = (acc[c.overallStatus] || 0) + 1;
        return acc;
    }, {});

    const byVendor = cases.reduce((acc, c) => {
        acc[c.vendor] = (acc[c.vendor] || 0) + 1;
        return acc;
    }, {});

    const slaBreachedCount = cases.filter(c => c.slaBreached).length;

    // Calculate average completion time
    const completedCases = cases.filter(c => c.completedAt);
    const avgCompletionDays = completedCases.length > 0
        ? completedCases.reduce((sum, c) => {
            const duration = c.completedAt && c.createdAt 
                ? (new Date(c.completedAt) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)
                : 0;
            return sum + duration;
        }, 0) / completedCases.length
        : 0;

    return {
        enabled: true,
        total: cases.length,
        byStatus,
        byVendor,
        slaBreached: slaBreachedCount,
        avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
        clearanceRate: cases.length > 0 
            ? Math.round((byStatus.Clear || 0) / cases.length * 100) 
            : 0,
    };
}

export { computeBgvProgress, syncBgvProgressToWorkflow };

/**
 * Get employee BGV dashboard with comprehensive metrics
 */
export async function getEmployeeBgvDashboard(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return { 
            enabled: false,
            message: 'Background verification is disabled. Contact HR to enable it.',
        };
    }

    const bgvCase = await BackgroundVerificationCase.findOne({
        organizationId,
        employeeId,
    }).populate('employeeId', 'name lastName email');

    if (!bgvCase) {
        return {
            enabled: true,
            hasBgvCase: false,
            totalVerifications: 0,
            pending: 0,
            submitted: 0,
            underReview: 0,
            verified: 0,
            rejected: 0,
            completionPercentage: 0,
            checks: [],
        };
    }

    const checks = bgvCase.checks || [];
    const totalVerifications = checks.length;
    const pending = checks.filter(c => c.status === 'Not Started' || c.status === 'Pending Employee Submission' || c.status === 'Draft Saved').length;
    const submitted = checks.filter(c => c.status === 'Submitted' || c.status === 'Pending Review').length;
    const underReview = checks.filter(c => c.status === 'Under HR Review' || c.status === 'Verification In Progress').length;
    const verified = checks.filter(c => c.status === 'Verified' || c.status === 'Clear').length;
    const rejected = checks.filter(c => c.status === 'Rejected' || c.status === 'Failed').length;
    const completionPercentage = totalVerifications > 0 ? Math.round((verified / totalVerifications) * 100) : 0;

    const enrichedChecks = checks.map(check => ({
        checkId: check._id,
        checkType: check.checkType,
        label: resolveBgvCheckLabel(check.checkType, check.label),
        status: check.status,
        mandatory: check.mandatory,
        requiredDocuments: getRequiredDocumentsForCheck(check.checkType),
        uploadedDocuments: check.documents || [],
        submittedAt: check.submittedAt,
        lastUpdated: check.lastUpdated || check.initiatedAt,
        verificationData: check.verificationData,
        employeeNotes: check.employeeNotes,
        hrNotes: check.hrNotes,
        infoRequest: check.infoRequest,
        canSubmit: canEmployeeSubmitCheck(check),
        canEdit: canEmployeeEditCheck(check),
        canResubmit: canEmployeeResubmitCheck(check),
    }));

    return {
        enabled: true,
        hasBgvCase: true,
        bgvCaseId: bgvCase._id,
        overallStatus: bgvCase.overallStatus,
        totalVerifications,
        pending,
        submitted,
        underReview,
        verified,
        rejected,
        completionPercentage,
        checks: enrichedChecks,
        activityFeed: bgvCase.activityFeed || [],
    };
}

function canEmployeeSubmitCheck(check) {
    const requiredDocs = getRequiredDocumentsForCheck(check.checkType);
    const uploadedDocs = check.documents || [];
    const hasRequiredDocs = requiredDocs.length === 0 || uploadedDocs.length >= requiredDocs.length;
    const hasVerificationData = check.checkType === 'employment' || check.checkType === 'education' || check.checkType === 'address'
        ? check.verificationData && Object.keys(check.verificationData).length > 0
        : true;
    const hasReferences = check.checkType === 'reference'
        ? check.references && check.references.length >= 2
        : true;
    const hasDeclaration = check.checkType === 'criminal'
        ? check.declarationAccepted
        : true;
    
    return hasRequiredDocs && hasVerificationData && hasReferences && hasDeclaration &&
        ['Not Started', 'Pending Employee Submission', 'Draft Saved'].includes(check.status);
}

function canEmployeeEditCheck(check) {
    return ['Not Started', 'Pending Employee Submission', 'Draft Saved', 'Additional Information Required'].includes(check.status);
}

function canEmployeeResubmitCheck(check) {
    return ['Additional Information Required', 'Rejected', 'Failed'].includes(check.status);
}

/**
 * Get employee's BGV case for real-time updates with enriched data
 */
export async function getEmployeeBgvCase(organizationId, employeeId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return null;
    }

    const bgvCase = await BackgroundVerificationCase.findOne({
        organizationId,
        employeeId,
    }).lean();

    if (!bgvCase) return null;

    // Enrich each check with progress and document status
    const enrichedChecks = (bgvCase.checks || []).map(check => {
        const requiredDocs = getRequiredDocumentsForCheck(check.checkType);
        const uploadedDocs = (check.documents || []).length;
        const pendingDocs = requiredDocs.length - uploadedDocs;
        const progress = requiredDocs.length > 0 
            ? Math.round((uploadedDocs / requiredDocs.length) * 100)
            : (check.status === 'Clear' ? 100 : check.status === 'In Progress' ? 50 : 0);

        return {
            ...check,
            requiredDocuments: requiredDocs,
            uploadedDocuments: check.documents || [],
            pendingDocuments: pendingDocs,
            progress,
            hrRemarks: check.hrNotes || null,
            infoRequest: check.infoRequest || null,
            infoResponse: check.infoResponse || null,
            lastUpdated: check.lastUpdated || check.initiatedAt,
            activityTimeline: buildCheckTimeline(check),
        };
    });

    // Calculate overall progress
    const totalChecks = enrichedChecks.length;
    const avgProgress = totalChecks > 0 
        ? Math.round(enrichedChecks.reduce((sum, c) => sum + c.progress, 0) / totalChecks)
        : 0;

    return {
        ...bgvCase,
        checks: enrichedChecks,
        overallProgress: avgProgress,
        summary: {
            completed: enrichedChecks.filter(c => c.status === 'Clear').length,
            pending: enrichedChecks.filter(c => ['Initiated', 'In Progress', 'Pending Review'].includes(c.status)).length,
            rejected: enrichedChecks.filter(c => c.status === 'Failed').length,
            awaitingUpload: enrichedChecks.filter(c => c.progress === 0).length,
        },
    };
}

/**
 * Get required documents for each check type
 */
function getRequiredDocumentsForCheck(checkType) {
    const docMap = {
        employment: [
            { name: 'Experience Letter', required: true },
            { name: 'Offer Letter', required: true },
            { name: 'Relieving Letter', required: false },
            { name: 'Salary Slip', required: false },
            { name: 'Appointment Letter', required: false },
        ],
        education: [
            { name: 'Degree Certificate', required: true },
            { name: 'Marksheet', required: true },
            { name: 'Diploma', required: false },
            { name: 'Transcript', required: false },
        ],
        address: [
            { name: 'Aadhaar', required: true },
            { name: 'Passport', required: false },
            { name: 'Driving Licence', required: false },
            { name: 'Utility Bill', required: false },
        ],
        identity: [
            { name: 'Aadhaar', required: true },
            { name: 'PAN', required: true },
            { name: 'Passport', required: false },
        ],
        criminal: [
            { name: 'Police Verification Certificate', required: false },
        ],
        reference: [], // References are managed separately
    };
    return docMap[checkType] || [];
}

/**
 * Build activity timeline for a check
 */
function buildCheckTimeline(check) {
    const timeline = [];
    
    if (check.initiatedAt) {
        timeline.push({
            date: check.initiatedAt,
            action: 'Initiated',
            description: 'Verification initiated',
        });
    }
    
    if (check.documents && check.documents.length > 0) {
        check.documents.forEach(doc => {
            timeline.push({
                date: doc.uploadedAt,
                action: 'Document Uploaded',
                description: `Uploaded ${doc.name}`,
                actor: doc.uploadedBy,
            });
        });
    }
    
    if (check.submittedAt) {
        timeline.push({
            date: check.submittedAt,
            action: 'Submitted',
            description: 'Submitted for HR review',
            actor: check.submittedBy,
        });
    }
    
    if (check.verifiedAt) {
        timeline.push({
            date: check.verifiedAt,
            action: check.status === 'Clear' ? 'Verified' : 'Rejected',
            description: check.status === 'Clear' ? 'Verification completed' : 'Verification rejected',
            actor: check.verifiedBy,
        });
    }
    
    if (check.infoRequestedAt) {
        timeline.push({
            date: check.infoRequestedAt,
            action: 'Info Requested',
            description: 'HR requested additional information',
            actor: check.infoRequestedBy,
        });
    }
    
    if (check.infoRespondedAt) {
        timeline.push({
            date: check.infoRespondedAt,
            action: 'Info Response',
            description: 'Employee responded to information request',
            actor: check.infoRespondedBy,
        });
    }
    
    return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Employee saves draft for Employment Verification
 */
export async function saveEmploymentDraft(organizationId, bgvCaseId, checkId, { 
    previousCompany, designation, joiningDate, relievingDate, hrContact, salary, reasonForLeaving, actor, req 
} = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');
    if (check.checkType !== 'employment') throw new Error('Check must be employment type');

    check.verificationData = check.verificationData || {};
    check.verificationData.previousCompany = previousCompany;
    check.verificationData.designation = designation;
    check.verificationData.joiningDate = joiningDate;
    check.verificationData.relievingDate = relievingDate;
    check.verificationData.hrContact = hrContact;
    check.verificationData.salary = salary;
    check.verificationData.reasonForLeaving = reasonForLeaving;
    check.status = 'Draft Saved';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'employment_draft_saved',
        description: `Employment verification draft saved for ${previousCompany || 'previous company'}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, previousCompany },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Employment Draft Saved',
        req,
        actor,
        metadata: { checkId, previousCompany },
    });

    return bgvCase;
}

/**
 * Employee saves draft for Education Verification (multiple records)
 */
export async function saveEducationDraft(organizationId, bgvCaseId, checkId, { 
    educationRecords, actor, req 
} = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');
    if (check.checkType !== 'education') throw new Error('Check must be education type');

    check.verificationData = check.verificationData || {};
    check.verificationData.educationRecords = educationRecords || [];
    check.status = 'Draft Saved';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'education_draft_saved',
        description: `Education verification draft saved with ${educationRecords?.length || 0} records`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, recordCount: educationRecords?.length || 0 },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Education Draft Saved',
        req,
        actor,
        metadata: { checkId, recordCount: educationRecords?.length || 0 },
    });

    return bgvCase;
}

/**
 * Employee saves draft for Address Verification
 */
export async function saveAddressDraft(organizationId, bgvCaseId, checkId, { 
    currentAddress, permanentAddress, actor, req 
} = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');
    if (check.checkType !== 'address') throw new Error('Check must be address type');

    check.verificationData = check.verificationData || {};
    check.verificationData.currentAddress = currentAddress;
    check.verificationData.permanentAddress = permanentAddress;
    check.status = 'Draft Saved';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'address_draft_saved',
        description: `Address verification draft saved`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Address Draft Saved',
        req,
        actor,
        metadata: { checkId },
    });

    return bgvCase;
}

/**
 * Employee uploads document for a BGV check
 */
export async function uploadBgvDocument(organizationId, bgvCaseId, checkId, { documentUrl, documentName, documentType, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.documents = check.documents || [];
    check.documents.push({
        url: documentUrl,
        name: documentName,
        type: documentType,
        uploadedAt: new Date(),
        uploadedBy: actor?._id,
        ocrStatus: 'Pending',
        matchStatus: 'Pending',
    });

    check.status = 'In Progress';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'document_uploaded',
        description: `Document uploaded for ${check.label}: ${documentName}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, documentName },
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Document Uploaded',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, documentName },
    });

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});

    return bgvCase;
}

/**
 * Delete document before submission
 */
export async function deleteBgvDocument(organizationId, bgvCaseId, checkId, documentId, { actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const docIndex = check.documents.findIndex(d => d._id.toString() === documentId);
    if (docIndex === -1) throw new Error('Document not found');

    const docName = check.documents[docIndex].name;
    
    // Only allow deletion if not yet submitted
    if (check.status === 'Pending Review' || check.status === 'Clear' || check.status === 'Failed') {
        throw new Error('Cannot delete document after submission');
    }

    check.documents.splice(docIndex, 1);
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'document_deleted',
        description: `Document deleted for ${check.label}: ${docName}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, documentId, docName },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Document Deleted',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, docName },
    });

    return bgvCase;
}

/**
 * Replace uploaded document
 */
export async function replaceBgvDocument(organizationId, bgvCaseId, checkId, documentId, { documentUrl, documentName, documentType, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const doc = check.documents.id(documentId);
    if (!doc) throw new Error('Document not found');

    doc.url = documentUrl;
    doc.name = documentName;
    doc.type = documentType;
    doc.uploadedAt = new Date();
    doc.uploadedBy = actor?._id;
    doc.ocrStatus = 'Pending';
    doc.matchStatus = 'Pending';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'document_replaced',
        description: `Document replaced for ${check.label}: ${documentName}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, documentId, documentName },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Document Replaced',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, documentName },
    });

    return bgvCase;
}

/**
 * Add reference for reference check
 */
export async function addReference(organizationId, bgvCaseId, checkId, { name, company, designation, relationship, phone, email, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.references = check.references || [];
    check.references.push({
        name,
        company,
        designation,
        relationship,
        phone,
        email,
        addedAt: new Date(),
        addedBy: actor?._id,
    });

    check.status = 'In Progress';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'reference_added',
        description: `Reference added for ${check.label}: ${name}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, name },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Reference Added',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, name },
    });

    return bgvCase;
}

/**
 * Update reference
 */
export async function updateReference(organizationId, bgvCaseId, checkId, referenceId, { name, company, designation, relationship, phone, email, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const reference = check.references.id(referenceId);
    if (!reference) throw new Error('Reference not found');

    if (name) reference.name = name;
    if (company) reference.company = company;
    if (designation) reference.designation = designation;
    if (relationship) reference.relationship = relationship;
    if (phone) reference.phone = phone;
    if (email) reference.email = email;
    reference.updatedAt = new Date();
    reference.updatedBy = actor?._id;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'reference_updated',
        description: `Reference updated for ${check.label}: ${reference.name}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, referenceId },
    });

    await bgvCase.save();

    return bgvCase;
}

/**
 * Delete reference
 */
export async function deleteReference(organizationId, bgvCaseId, checkId, referenceId, { actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const refIndex = check.references.findIndex(r => r._id.toString() === referenceId);
    if (refIndex === -1) throw new Error('Reference not found');

    const refName = check.references[refIndex].name;
    check.references.splice(refIndex, 1);
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'reference_deleted',
        description: `Reference deleted for ${check.label}: ${refName}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, referenceId, refName },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Reference Deleted',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, refName },
    });

    return bgvCase;
}

/**
 * Accept criminal verification declaration
 */
export async function acceptCriminalDeclaration(organizationId, bgvCaseId, checkId, { accepted, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.declarationAccepted = accepted;
    check.declarationAcceptedAt = new Date();
    check.declarationAcceptedBy = actor?._id;
    check.status = accepted ? 'Pending Review' : check.status;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'declaration_accepted',
        description: accepted ? 'Criminal declaration accepted' : 'Criminal declaration declined',
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, accepted },
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: accepted ? 'Declaration Accepted' : 'Declaration Declined',
        req,
        actor,
        metadata: { checkId, accepted },
    });

    return bgvCase;
}

/**
 * Update OCR status for a document
 */
export async function updateDocumentOcrStatus(organizationId, bgvCaseId, checkId, documentId, { ocrStatus, ocrData, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const doc = check.documents.id(documentId);
    if (!doc) throw new Error('Document not found');

    doc.ocrStatus = ocrStatus || doc.ocrStatus;
    if (ocrData) doc.ocrData = ocrData;
    doc.ocrProcessedAt = new Date();
    doc.ocrProcessedBy = actor?._id;
    doc.ocrProcessedByName = actor?.name;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'ocr_processed',
        description: `OCR processed for document: ${doc.name} - Status: ${ocrStatus}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, documentId, ocrStatus, documentName: doc.name },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'OCR Status Updated',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, documentId, documentName: doc.name, ocrStatus },
    });

    return bgvCase;
}

/**
 * Update document match status for verification
 */
export async function updateDocumentMatchStatus(organizationId, bgvCaseId, checkId, documentId, { matchStatus, matchScore, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const doc = check.documents.id(documentId);
    if (!doc) throw new Error('Document not found');

    doc.matchStatus = matchStatus || doc.matchStatus;
    if (matchScore !== undefined) doc.matchScore = matchScore;
    doc.matchProcessedAt = new Date();
    doc.matchProcessedBy = actor?._id;
    doc.matchProcessedByName = actor?.name;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'match_processed',
        description: `Document match processed: ${doc.name} - Status: ${matchStatus} - Score: ${matchScore}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, documentId, matchStatus, matchScore, documentName: doc.name },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Document Match Status Updated',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, documentId, documentName: doc.name, matchStatus, matchScore },
    });

    return bgvCase;
}

/**
 * Get HR BGV dashboard with employee details and verification status
 */
export async function getHrBgvDashboard(organizationId, filters = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return {
            enabled: false,
            message: 'Background verification is disabled. Enable it from Employee Lifecycle → Configure.',
        };
    }

    const query = { organizationId };
    if (filters.status) query.overallStatus = filters.status;
    if (filters.department) {
        const { Employee } = await import('../models/employee.model.js');
        const employees = await Employee.find({ organizationId, department: filters.department }).select('_id').lean();
        query.employeeId = { $in: employees.map(e => e._id) };
    }
    if (filters.vendor) query.vendor = filters.vendor;
    if (filters.assignedTo) query.assignedHr = filters.assignedTo;

    const bgvCases = await BackgroundVerificationCase.find(query)
        .populate('employeeId', 'name lastName employeeId department designation manager joiningDate email phone')
        .populate('assignedHr', 'name lastName')
        .sort({ createdAt: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingReviews = bgvCases.filter(c => 
        !['Clear', 'Waived', 'Failed'].includes(c.overallStatus) &&
        c.checks.some(ch => ch.status === 'Pending Review' || ch.status === 'Under HR Review' || ch.status === 'Submitted')
    );

    const overdue = bgvCases.filter(c => {
        if (!c.dueDate) return false;
        const dueDate = new Date(c.dueDate);
        return dueDate < today && !['Clear', 'Waived', 'Failed'].includes(c.overallStatus);
    });

    const awaitingEmployee = bgvCases.filter(c =>
        c.checks.some(ch => ch.status === 'Not Started' || ch.status === 'Pending Employee Submission' || ch.status === 'Draft Saved' || ch.status === 'Additional Information Required')
    );

    const verifiedToday = bgvCases.filter(c => 
        c.completedAt && new Date(c.completedAt) >= today && c.overallStatus === 'Clear'
    );

    const rejectedToday = bgvCases.filter(c => 
        c.completedAt && new Date(c.completedAt) >= today && c.overallStatus === 'Failed'
    );

    // Department-wise breakdown
    const departmentMap = {};
    bgvCases.forEach(c => {
        const dept = c.employeeId?.department || 'Unassigned';
        if (!departmentMap[dept]) {
            departmentMap[dept] = { department: dept, total: 0, pending: 0, verified: 0, rejected: 0, inProgress: 0 };
        }
        departmentMap[dept].total++;
        if (c.overallStatus === 'In Progress' || c.overallStatus === 'Initiated' || c.overallStatus === 'Pending Employee Submission') departmentMap[dept].inProgress++;
        else if (c.overallStatus === 'Clear') departmentMap[dept].verified++;
        else if (c.overallStatus === 'Failed') departmentMap[dept].rejected++;
        else if (c.overallStatus === 'Not Started') departmentMap[dept].pending++;
    });

    // Vendor-wise breakdown
    const vendorMap = {};
    bgvCases.forEach(c => {
        const vendor = c.vendor || 'manual';
        if (!vendorMap[vendor]) {
            vendorMap[vendor] = { vendor, total: 0, pending: 0, verified: 0, rejected: 0, inProgress: 0 };
        }
        vendorMap[vendor].total++;
        if (c.overallStatus === 'In Progress' || c.overallStatus === 'Initiated') vendorMap[vendor].inProgress++;
        else if (c.overallStatus === 'Clear') vendorMap[vendor].verified++;
        else if (c.overallStatus === 'Failed') vendorMap[vendor].rejected++;
        else if (c.overallStatus === 'Not Started') vendorMap[vendor].pending++;
    });

    // Average verification time (in days)
    const completedCases = bgvCases.filter(c => c.completedAt && c.createdAt);
    const avgCompletionDays = completedCases.length > 0
        ? completedCases.reduce((sum, c) => {
            const days = (new Date(c.completedAt) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0) / completedCases.length
        : 0;

    return {
        enabled: true,
        summary: {
            totalCases: bgvCases.length,
            pendingReviews: pendingReviews.length,
            overdue: overdue.length,
            awaitingEmployee: awaitingEmployee.length,
            verifiedToday: verifiedToday.length,
            rejectedToday: rejectedToday.length,
        },
        departmentBreakdown: Object.values(departmentMap),
        vendorBreakdown: Object.values(vendorMap),
        avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
        cases: bgvCases.map(c => ({
            _id: c._id,
            employee: c.employeeId,
            overallStatus: c.overallStatus,
            vendor: c.vendor,
            assignedHr: c.assignedHr,
            dueDate: c.dueDate,
            createdAt: c.createdAt,
            completedAt: c.completedAt,
            priority: c.priority,
            slaBreached: c.slaBreached,
            checks: c.checks.map(ch => ({
                checkId: ch._id,
                checkType: ch.checkType,
                label: resolveBgvCheckLabel(ch.checkType, ch.label),
                status: ch.status,
                mandatory: ch.mandatory,
                submittedAt: ch.submittedAt,
                lastUpdated: ch.lastUpdated,
                canVerify: canHrVerifyCheck(ch),
                canRequestInfo: canHrRequestInfo(ch),
                canAssignVendor: canHrAssignVendor(ch),
            })),
        })),
    };
}

function canHrVerifyCheck(check) {
    return ['Pending Review', 'Submitted', 'Under HR Review', 'Verification In Progress'].includes(check.status);
}

function canHrRequestInfo(check) {
    return ['Pending Review', 'Submitted', 'Under HR Review', 'Verification In Progress'].includes(check.status);
}

function canHrAssignVendor(check) {
    return ['Pending Review', 'Submitted', 'Under HR Review', 'Verification In Progress'].includes(check.status) &&
        ['criminal', 'employment', 'education'].includes(check.checkType);
}

/**
 * Get detailed BGV case for HR review with all verification sections
 */
export async function getHrBgvCaseDetail(organizationId, bgvCaseId) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        throw new Error('Background verification is disabled. Enable it from Employee Lifecycle → Configure.');
    }

    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    }).populate('employeeId', 'name lastName employeeId department designation manager joiningDate email phone');

    if (!bgvCase) throw new Error('BGV case not found');

    // Enrich each check with HR-specific data
    const enrichedChecks = (bgvCase.checks || []).map((check) => {
        const plain = typeof check.toObject === 'function' ? check.toObject() : { ...check };
        const checkType = plain.checkType;
        const label = plain.label || DEFAULT_CHECKS.find((c) => c.checkType === checkType)?.label || checkType;
        const requiredDocs = getRequiredDocumentsForCheck(checkType);
        const uploadedDocs = (plain.documents || []).length;
        const pendingDocs = requiredDocs.length - uploadedDocs;
        const progress = requiredDocs.length > 0
            ? Math.round((uploadedDocs / requiredDocs.length) * 100)
            : (plain.status === 'Clear' ? 100 : plain.status === 'In Progress' ? 50 : 0);

        return {
            ...plain,
            checkId: plain._id,
            checkType,
            label,
            requiredDocuments: requiredDocs,
            uploadedDocuments: plain.documents || [],
            missingDocuments: pendingDocs,
            progress,
            employeeRemarks: plain.employeeNotes || null,
            hrRemarks: plain.hrNotes || null,
            internalNotes: plain.internalNotes || [],
            assignedVerifier: plain.assignedVerifier,
            submissionDate: plain.submittedAt,
            lastUpdated: plain.lastUpdated || plain.initiatedAt,
            activityTimeline: buildCheckTimeline(plain),
            verificationDetails: getVerificationDetailsForCheck(plain),
        };
    });

    return {
        ...bgvCase.toObject(),
        employee: bgvCase.employeeId,
        checks: enrichedChecks,
        overallProgress: computeBgvProgress(bgvCase).progress,
        activityFeed: bgvCase.activityFeed || [],
    };
}

/**
 * Get verification-specific details for each check type
 */
function getVerificationDetailsForCheck(check) {
    switch (check.checkType) {
        case 'employment':
            return {
                previousCompany: check.verificationData?.previousCompany,
                designation: check.verificationData?.designation,
                employmentDuration: check.verificationData?.employmentDuration,
                salary: check.verificationData?.salary,
                relievingLetterVerified: check.verificationData?.relievingLetterVerified,
                experienceLetterVerified: check.verificationData?.experienceLetterVerified,
            };
        case 'education':
            return {
                degreeVerified: check.verificationData?.degreeVerified,
                universityVerified: check.verificationData?.universityVerified,
                passingYearVerified: check.verificationData?.passingYearVerified,
                certificatesVerified: check.verificationData?.certificatesVerified,
            };
        case 'address':
            return {
                addressProofVerified: check.verificationData?.addressProofVerified,
                aadhaarVerified: check.verificationData?.aadhaarVerified,
                passportVerified: check.verificationData?.passportVerified,
                utilityBillVerified: check.verificationData?.utilityBillVerified,
            };
        case 'identity':
            return {
                aadhaarVerified: check.verificationData?.aadhaarVerified,
                panVerified: check.verificationData?.panVerified,
                passportVerified: check.verificationData?.passportVerified,
                ocrMatch: check.verificationData?.ocrMatch,
                nameMatch: check.verificationData?.nameMatch,
                dobMatch: check.verificationData?.dobMatch,
                idNumberMatch: check.verificationData?.idNumberMatch,
            };
        case 'criminal':
            return {
                vendorReportUploaded: check.verificationData?.vendorReportUploaded,
                policeVerificationUploaded: check.verificationData?.policeVerificationUploaded,
                vendorReportUrl: check.verificationData?.vendorReportUrl,
                policeVerificationUrl: check.verificationData?.policeVerificationUrl,
            };
        case 'reference':
            return {
                references: check.references || [],
                contactStatus: check.verificationData?.contactStatus,
            };
        default:
            return {};
    }
}

/**
 * Add HR remarks (visible to employee)
 */
export async function addHrRemarks(organizationId, bgvCaseId, checkId, { remarks, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.hrNotes = remarks;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'hr_remarks_added',
        description: `HR added remarks for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, remarks },
    });

    await bgvCase.save();

    await notify({
        type: 'bgv_hr_remarks',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'HR Remarks Added',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}

/**
 * Add internal notes (visible only to HR/Admin)
 */
export async function addInternalNote(organizationId, bgvCaseId, checkId, { note, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.internalNotes = check.internalNotes || [];
    check.internalNotes.push({
        content: note,
        addedBy: actor?._id,
        addedByName: actor?.name,
        addedAt: new Date(),
    });

    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'internal_note_added',
        description: `Internal note added for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Internal Note Added',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}

/**
 * Update verification details for a check
 */
export async function updateVerificationDetails(organizationId, bgvCaseId, checkId, { verificationData, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.verificationData = { ...check.verificationData, ...verificationData };
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'verification_details_updated',
        description: `Verification details updated for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Verification Details Updated',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}

/**
 * Update reference contact status
 */
export async function updateReferenceContactStatus(organizationId, bgvCaseId, checkId, referenceId, { contactStatus, notes, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    const reference = check.references.id(referenceId);
    if (!reference) throw new Error('Reference not found');

    reference.contactStatus = contactStatus;
    reference.contactNotes = notes;
    reference.contactUpdatedBy = actor?._id;
    reference.contactUpdatedAt = new Date();
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'reference_contact_updated',
        description: `Reference contact status updated: ${reference.name}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, referenceId, contactStatus },
    });

    await bgvCase.save();

    return bgvCase;
}

/**
 * Upload vendor report for criminal verification
 */
export async function uploadVendorReport(organizationId, bgvCaseId, checkId, { reportUrl, reportName, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.verificationData = check.verificationData || {};
    check.verificationData.vendorReportUploaded = true;
    check.verificationData.vendorReportUrl = reportUrl;
    check.verificationData.vendorReportName = reportName;
    check.verificationData.uploadedBy = actor?._id;
    check.verificationData.uploadedAt = new Date();
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'vendor_report_uploaded',
        description: `Vendor report uploaded for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, reportName },
    });

    await bgvCase.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Vendor Report Uploaded',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, reportName },
    });

    return bgvCase;
}

/**
 * Generate BGV reports
 */
export async function generateBgvReport(organizationId, { reportType, filters, actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(organizationId);
    if (!isFeatureEnabled(settings, 'backgroundVerification')) {
        return { 
            enabled: false,
            data: [], 
            reportType, 
            generatedAt: new Date(),
            message: 'Background verification is disabled.',
        };
    }

    const query = { organizationId };
    if (filters.department) query.department = filters.department;
    if (filters.status) query.overallStatus = filters.status;
    if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };
    if (filters.endDate) query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };

    const bgvCases = await BackgroundVerificationCase.find(query)
        .populate('employeeId', 'name employeeId department designation manager joiningDate')
        .sort({ createdAt: -1 });

    let reportData = [];

    switch (reportType) {
        case 'pending':
            reportData = bgvCases.filter(c => 
                !['Clear', 'Waived', 'Failed'].includes(c.overallStatus)
            );
            break;
        case 'completed':
            reportData = bgvCases.filter(c => c.overallStatus === 'Clear');
            break;
        case 'rejected':
            reportData = bgvCases.filter(c => c.overallStatus === 'Failed');
            break;
        case 'hr_performance':
            reportData = bgvCases.map(c => ({
                employee: c.employeeId,
                assignedHr: c.assignedHr,
                overallStatus: c.overallStatus,
                completedAt: c.completedAt,
                createdAt: c.createdAt,
                verificationTime: c.completedAt && c.createdAt 
                    ? (new Date(c.completedAt) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)
                    : null,
            }));
            break;
        case 'department':
            const deptMap = {};
            bgvCases.forEach(c => {
                const dept = c.employeeId?.department || 'Unassigned';
                if (!deptMap[dept]) {
                    deptMap[dept] = { department: dept, total: 0, clear: 0, inProgress: 0, failed: 0 };
                }
                deptMap[dept].total++;
                if (c.overallStatus === 'Clear') deptMap[dept].clear++;
                else if (c.overallStatus === 'In Progress' || c.overallStatus === 'Initiated') deptMap[dept].inProgress++;
                else if (c.overallStatus === 'Failed') deptMap[dept].failed++;
            });
            reportData = Object.values(deptMap);
            break;
        case 'monthly':
            const monthMap = {};
            bgvCases.forEach(c => {
                const month = new Date(c.createdAt).toISOString().slice(0, 7);
                if (!monthMap[month]) {
                    monthMap[month] = { month, total: 0, clear: 0, inProgress: 0, failed: 0 };
                }
                monthMap[month].total++;
                if (c.overallStatus === 'Clear') monthMap[month].clear++;
                else if (c.overallStatus === 'In Progress' || c.overallStatus === 'Initiated') monthMap[month].inProgress++;
                else if (c.overallStatus === 'Failed') monthMap[month].failed++;
            });
            reportData = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
            break;
        default:
            reportData = bgvCases;
    }

    await logLifecycleAudit({
        action: 'Export',
        entityType: 'BackgroundVerificationCase',
        entityName: 'BGV Report Generated',
        req,
        actor,
        metadata: { reportType, filters },
    });

    return {
        data: reportData,
        reportType,
        generatedAt: new Date(),
        generatedBy: actor?._id,
    };
}

/**
 * Employee submits check for review
 */
export async function submitCheckForReview(organizationId, bgvCaseId, checkId, { notes, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.status = 'Submitted';
    check.submittedAt = new Date();
    check.submittedBy = actor?._id;
    if (notes) check.employeeNotes = notes;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'check_submitted',
        description: `Check submitted for review: ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, notes },
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();

    await notify({
        type: 'bgv_submission_successful',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId },
    }).catch(() => {});

    await notify({
        type: 'bgv_employee_submitted',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId, employeeName: bgvCase.employeeId?.name },
    }).catch(() => {});

    await notify({
        type: 'bgv_check_submitted',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Check Submitted for Review',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}

/**
 * HR verifies a check
 */
export async function verifyCheck(organizationId, bgvCaseId, checkId, { verified, notes, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.status = verified ? 'Verified' : 'Rejected';
    check.verifiedAt = new Date();
    check.verifiedBy = actor?._id;
    if (notes) check.hrNotes = notes;
    check.lastUpdated = new Date;

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'check_verified',
        description: `Check ${verified ? 'verified' : 'rejected'}: ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, verified, notes },
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();

    await notify({
        type: verified ? 'bgv_verification_approved' : 'bgv_verification_rejected',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId },
    }).catch(() => {});

    await notify({
        type: verified ? 'bgv_check_verified' : 'bgv_check_rejected',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: verified ? 'Check Verified' : 'Check Rejected',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label, verified },
    });

    await syncBgvProgressToWorkflow(bgvCase, { actor }).catch(() => {});

    return bgvCase;
}

/**
 * HR requests additional information for a check
 */
export async function requestAdditionalInfo(organizationId, bgvCaseId, checkId, { request, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.status = 'Additional Information Required';
    check.infoRequest = request;
    check.infoRequestedAt = new Date();
    check.infoRequestedBy = actor?._id;
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'info_requested',
        description: `Additional information requested for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId, request },
    });

    await bgvCase.save();

    await notify({
        type: 'bgv_additional_info_requested',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId, request },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Additional Information Requested',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}

/**
 * Employee responds to information request
 */
export async function respondToInfoRequest(organizationId, bgvCaseId, checkId, { response, documents, actor, req } = {}) {
    const bgvCase = await BackgroundVerificationCase.findOne({
        _id: bgvCaseId,
        organizationId,
    });

    if (!bgvCase) throw new Error('BGV case not found');

    const check = bgvCase.checks.id(checkId);
    if (!check) throw new Error('Check not found');

    check.infoResponse = response;
    check.infoRespondedAt = new Date();
    check.infoRespondedBy = actor?._id;
    
    if (documents && documents.length) {
        check.documents = check.documents || [];
        documents.forEach(doc => {
            check.documents.push({
                url: doc.url,
                name: doc.name,
                type: doc.type,
                uploadedAt: new Date(),
                uploadedBy: actor?._id,
            });
        });
    }

    check.status = 'Resubmitted';
    check.lastUpdated = new Date();

    bgvCase.activityFeed = bgvCase.activityFeed || [];
    bgvCase.activityFeed.unshift({
        action: 'info_response',
        description: `Information provided for ${check.label}`,
        actor: actor?._id,
        actorName: actor?.name,
        metadata: { checkId },
    });

    bgvCase.overallStatus = deriveOverallStatus(bgvCase.checks);
    await bgvCase.save();

    await notify({
        type: 'bgv_info_response',
        organizationId,
        data: { bgvCaseId, checkId, checkLabel: check.label, employeeId: bgvCase.employeeId, employeeName: bgvCase.employeeId?.name },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'BackgroundVerificationCase',
        entityId: bgvCase._id,
        entityName: 'Information Response Provided',
        req,
        actor,
        metadata: { checkId, checkLabel: check.label },
    });

    return bgvCase;
}
