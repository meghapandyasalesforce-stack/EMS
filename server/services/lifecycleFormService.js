/**
 * Lifecycle form builder service — CRUD, versioning, responses, export.
 */

import { LifecycleFormDefinition, LifecycleFormResponse } from '../models/lifecycle.model.js';
import { LIFECYCLE_FORM_FIELD_TYPES } from '../constants/lifecycleSharedSchemas.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { initiateLifecycleApproval } from './lifecycleApprovalService.js';
import { notify } from '../helpers/notificationManager.js';
import {
    buildFormPreview,
    validateFormResponses,
    getVisibleFields,
} from './lifecycleFormEngine.js';
import { assertFeatureEnabled, assertAnyFeatureEnabled, isFeatureEnabled, getOrCreateLifecycleSettings } from './lifecycleConfigService.js';

async function requireFormsFeature(organizationId, form = null) {
    if (form?.featureKey) {
        return assertFeatureEnabled(organizationId, form.featureKey, form.name || form.featureKey);
    }
    return assertAnyFeatureEnabled(
        organizationId,
        ['digitalForms', 'emergencyContact', 'familyNominee', 'bankDetails'],
        'Digital forms',
    );
}

function snapshotForm(form) {
    const obj = form.toObject ? form.toObject() : { ...form };
    delete obj.versionHistory;
    return obj;
}

function pushFormVersion(form, actor, changeNotes = 'Form updated') {
    form.versionHistory = form.versionHistory || [];
    form.versionHistory.push({
        version: form.version || 1,
        snapshot: snapshotForm(form),
        changedBy: actor?._id,
        changedAt: new Date(),
        changeNotes,
    });
    form.version = (form.version || 1) + 1;
}

function normalizeFields(fields = []) {
    const keys = new Set();
    return fields.map((field, index) => {
        if (!field.key) throw new Error('Each field requires a unique key');
        if (keys.has(field.key)) throw new Error(`Duplicate field key: ${field.key}`);
        keys.add(field.key);
        if (!LIFECYCLE_FORM_FIELD_TYPES.includes(field.type)) {
            throw new Error(`Unsupported field type: ${field.type}`);
        }
        return { ...field, order: field.order ?? index };
    }).sort((a, b) => a.order - b.order);
}

function syncLegacyModule(form) {
    if (form.category === 'onboarding' || form.category === 'offboarding' || form.category === 'both') {
        form.module = form.category;
    } else if (!form.module) {
        form.module = 'both';
    }
}

export async function listForms(organizationId, filters = {}) {
    const query = { organizationId };
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.featureKey) query.featureKey = filters.featureKey;
    if (filters.activeOnly !== false) query.isActive = true;
    if (filters.status === 'Archived') delete query.isActive;
    return LifecycleFormDefinition.find(query).sort({ updatedAt: -1 }).lean();
}

export async function getFormById(organizationId, formId) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId }).lean();
    if (!form) throw new Error('Form not found');
    return form;
}

export async function createForm(organizationId, payload, { actor, req } = {}) {
    await requireFormsFeature(organizationId, { featureKey: payload.featureKey });
    const form = await LifecycleFormDefinition.create({
        organizationId,
        name: payload.name,
        description: payload.description,
        category: payload.category || payload.module || 'onboarding',
        module: payload.module || payload.category || 'onboarding',
        featureKey: payload.featureKey,
        stageKey: payload.stageKey,
        assignments: payload.assignments,
        fields: normalizeFields(payload.fields || []),
        approvalRequired: payload.approvalRequired || false,
        tags: payload.tags || [],
        status: 'Draft',
        version: 1,
    });
    syncLegacyModule(form);
    await form.save();
    await logLifecycleAudit({
        action: 'Create', entityType: 'LifecycleForm', entityId: form._id,
        entityName: form.name, req, actor, after: form.toObject(),
    });
    return form;
}

export async function updateForm(organizationId, formId, payload, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    const before = snapshotForm(form);

    if (payload.name != null) form.name = payload.name;
    if (payload.description != null) form.description = payload.description;
    if (payload.category != null) form.category = payload.category;
    if (payload.module != null) form.module = payload.module;
    if (payload.featureKey != null) form.featureKey = payload.featureKey;
    if (payload.stageKey != null) form.stageKey = payload.stageKey;
    if (payload.assignments != null) form.assignments = payload.assignments;
    if (payload.approvalRequired != null) form.approvalRequired = payload.approvalRequired;
    if (payload.tags != null) form.tags = payload.tags;
    if (payload.fields != null) form.fields = normalizeFields(payload.fields);

    syncLegacyModule(form);

    if (form.isModified()) {
        pushFormVersion(form, actor, payload.changeNotes || 'Form builder save');
        if (form.status === 'Published') form.status = 'Draft';
    }

    await form.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleForm', entityId: form._id,
        entityName: form.name, req, actor, before, after: form.toObject(),
    });
    return form;
}

export async function cloneForm(organizationId, formId, { name, actor, req } = {}) {
    const source = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!source) throw new Error('Form not found');
    const clone = await LifecycleFormDefinition.create({
        ...snapshotForm(source),
        _id: undefined,
        name: name || `${source.name} (Copy)`,
        status: 'Draft',
        version: 1,
        versionHistory: [],
        publishedAt: null,
        clonedFrom: source._id,
    });
    await logLifecycleAudit({
        action: 'Create', entityType: 'LifecycleForm', entityId: clone._id,
        entityName: clone.name, req, actor, metadata: { clonedFrom: source._id },
    });
    return clone;
}

/**
 * Enhanced form submission with attachments and approval integration
 */
export async function submitFormResponse(organizationId, formId, payload, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    if (form.status !== 'Published') throw new Error('Form is not published');

    const { employeeId, workflowId, responses, attachments, submitterComments } = payload;

    // Validate responses
    const validation = validateFormResponses(form.fields, responses);
    if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for existing response
    const existing = await LifecycleFormResponse.findOne({
        organizationId,
        formDefinitionId: formId,
        employeeId,
        ...(workflowId ? { workflowId } : {}),
    });

    let response;
    if (existing) {
        // Update existing response
        existing.responses = responses;
        existing.attachments = attachments || existing.attachments;
        existing.submitterComments = submitterComments;
        existing.status = 'Submitted';
        existing.submittedAt = new Date();
        existing.submittedBy = actor?._id;
        existing.version = (existing.version || 1) + 1;
        
        // Add version history
        existing.versionHistory = existing.versionHistory || [];
        existing.versionHistory.push({
            version: existing.version - 1,
            responses: existing.responses,
            submittedAt: existing.submittedAt,
            submittedBy: existing.submittedBy,
        });

        response = await existing.save();
    } else {
        // Create new response
        response = await LifecycleFormResponse.create({
            organizationId,
            formDefinitionId: formId,
            employeeId,
            workflowId,
            responses,
            attachments: attachments || [],
            submitterComments,
            status: 'Submitted',
            submittedAt: new Date(),
            submittedBy: actor?._id,
            version: 1,
            versionHistory: [],
        });
    }

    // Log audit
    await logLifecycleAudit({
        action: existing ? 'Update' : 'Create',
        entityType: 'LifecycleFormResponse',
        entityId: response._id,
        entityName: `Response for ${form.name}`,
        req,
        actor,
        metadata: { formId, employeeId, workflowId },
    });

    // Initiate approval if required
    if (form.approvalRequired) {
        try {
            const approval = await initiateLifecycleApproval({
                organizationId,
                entityType: 'LifecycleFormResponse',
                entityId: response._id,
                entityName: `Form Response: ${form.name}`,
                requestedBy: actor?._id,
                workflowId,
                metadata: { formId, employeeId },
            });
            response.approvalId = approval._id;
            response.approvalStatus = 'Pending';
            await response.save();
        } catch (approvalError) {
            logger.warn('Failed to initiate form approval', {
                formId,
                responseId: response._id,
                error: approvalError.message,
            });
        }
    } else {
        response.approvalStatus = 'Approved';
        response.approvedAt = new Date();
        await response.save();
    }

    // Notify relevant parties
    await notify({
        type: 'lifecycle_form_submitted',
        organizationId,
        data: {
            formId,
            formName: form.name,
            responseId: response._id,
            employeeId,
            workflowId,
            requiresApproval: form.approvalRequired,
        },
    }).catch(() => {});

    // Sync form gate to workflow if workflowId provided
    if (workflowId) {
        const { OnboardingWorkflow } = await import('../models/onboarding.model.js');
        const workflow = await OnboardingWorkflow.findOne({ _id: workflowId, organizationId });
        if (workflow) {
            const { syncFormGateToWorkflow } = await import('./lifecycleFormGateService.js');
            await syncFormGateToWorkflow(workflow, organizationId);
            await workflow.save();
        }
    }

    return response;
}

/**
 * Approve or reject form response
 */
export async function reviewFormResponse(organizationId, responseId, { decision, comments, actor, req } = {}) {
    const response = await LifecycleFormResponse.findOne({
        _id: responseId,
        organizationId,
    });
    if (!response) throw new Error('Form response not found');

    if (response.approvalStatus !== 'Pending') {
        throw new Error('Response is not pending approval');
    }

    if (decision === 'approve') {
        response.approvalStatus = 'Approved';
        response.status = 'Approved';
        response.approvedAt = new Date();
        response.approvedBy = actor?._id;
        response.approverComments = comments;
    } else if (decision === 'reject') {
        response.approvalStatus = 'Rejected';
        response.status = 'Rejected';
        response.rejectedAt = new Date();
        response.rejectedBy = actor?._id;
        response.rejectionReason = comments;
    } else {
        throw new Error('Invalid decision. Must be "approve" or "reject"');
    }

    response.reviewedAt = new Date();
    response.reviewedBy = actor?._id;
    response.reviewComments = comments;

    await response.save();

    // Log audit
    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleFormResponse',
        entityId: response._id,
        entityName: `Form Response ${decision === 'approve' ? 'Approval' : 'Rejection'}`,
        req,
        actor,
        metadata: { decision, comments },
    });

    // Notify submitter
    await notify({
        type: decision === 'approve' ? 'lifecycle_form_approved' : 'lifecycle_form_rejected',
        organizationId,
        data: {
            responseId: response._id,
            decision,
            comments,
            submittedBy: response.submittedBy,
        },
    }).catch(() => {});

    // Sync form gate to workflow
    if (response.workflowId) {
        const { OnboardingWorkflow } = await import('../models/onboarding.model.js');
        const workflow = await OnboardingWorkflow.findOne({
            _id: response.workflowId,
            organizationId,
        });
        if (workflow) {
            const { syncFormGateToWorkflow } = await import('./lifecycleFormGateService.js');
            await syncFormGateToWorkflow(workflow, organizationId);
            await workflow.save();
        }
    }

    return response;
}

/**
 * Add attachment to form response
 */
export async function addFormAttachment(organizationId, responseId, { fileName, fileUrl, fileType, fileSize, uploadedBy }, { actor, req } = {}) {
    const response = await LifecycleFormResponse.findOne({
        _id: responseId,
        organizationId,
    });
    if (!response) throw new Error('Form response not found');

    response.attachments = response.attachments || [];
    response.attachments.push({
        fileName,
        fileUrl,
        fileType,
        fileSize,
        uploadedAt: new Date(),
        uploadedBy: uploadedBy || actor?._id,
    });

    await response.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleFormResponse',
        entityId: response._id,
        entityName: 'Attachment Added',
        req,
        actor,
        metadata: { fileName },
    });

    return response;
}

/**
 * Remove attachment from form response
 */
export async function removeFormAttachment(organizationId, responseId, attachmentIndex, { actor, req } = {}) {
    const response = await LifecycleFormResponse.findOne({
        _id: responseId,
        organizationId,
    });
    if (!response) throw new Error('Form response not found');

    if (attachmentIndex < 0 || attachmentIndex >= (response.attachments || []).length) {
        throw new Error('Invalid attachment index');
    }

    const removed = response.attachments.splice(attachmentIndex, 1)[0];
    await response.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleFormResponse',
        entityId: response._id,
        entityName: 'Attachment Removed',
        req,
        actor,
        metadata: { fileName: removed.fileName },
    });

    return response;
}

/**
 * Get form response with version history
 */
export async function getFormResponseWithHistory(organizationId, responseId) {
    const response = await LifecycleFormResponse.findOne({
        _id: responseId,
        organizationId,
    }).lean();

    if (!response) throw new Error('Form response not found');

    const form = await LifecycleFormDefinition.findOne({
        _id: response.formDefinitionId,
        organizationId,
    }).lean();

    return {
        ...response,
        form,
        versionCount: response.versionHistory?.length || 0,
    };
}

/**
 * Rollback form response to previous version
 */
export async function rollbackFormResponse(organizationId, responseId, version, { actor, req } = {}) {
    const response = await LifecycleFormResponse.findOne({
        _id: responseId,
        organizationId,
    });
    if (!response) throw new Error('Form response not found');

    const targetVersion = response.versionHistory?.find(v => v.version === version);
    if (!targetVersion) {
        throw new Error(`Version ${version} not found in history`);
    }

    // Create new version with rolled back data
    response.versionHistory.push({
        version: response.version,
        responses: response.responses,
        submittedAt: response.submittedAt,
        submittedBy: response.submittedBy,
    });

    response.responses = targetVersion.responses;
    response.version = version + 1;
    response.rolledBackAt = new Date();
    response.rolledBackBy = actor?._id;

    await response.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'LifecycleFormResponse',
        entityId: response._id,
        entityName: `Rollback to version ${version}`,
        req,
        actor,
        metadata: { fromVersion: response.version - 1, toVersion: version },
    });

    return response;
}

export async function publishForm(organizationId, formId, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    if (!form.fields?.length) throw new Error('Add at least one field before publishing');
    normalizeFields(form.fields);
    form.status = 'Published';
    form.publishedAt = new Date();
    pushFormVersion(form, actor, 'Published');
    await form.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleForm', entityId: form._id,
        entityName: form.name, req, actor, metadata: { action: 'publish' },
    });
    return form;
}

export async function archiveForm(organizationId, formId, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    form.status = 'Archived';
    form.isActive = false;
    await form.save();
    await logLifecycleAudit({
        action: 'Delete', entityType: 'LifecycleForm', entityId: form._id,
        entityName: form.name, req, actor, metadata: { action: 'archive' },
    });
    return form;
}

export async function rollbackFormVersion(organizationId, formId, targetVersion, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    const entry = (form.versionHistory || []).find((v) => v.version === targetVersion);
    if (!entry?.snapshot) throw new Error('Version not found in history');
    const snap = entry.snapshot;
    form.fields = snap.fields || [];
    form.description = snap.description;
    form.category = snap.category || snap.module;
    form.featureKey = snap.featureKey;
    form.stageKey = snap.stageKey;
    form.assignments = snap.assignments;
    form.approvalRequired = snap.approvalRequired;
    form.status = 'Draft';
    pushFormVersion(form, actor, `Rolled back to v${targetVersion}`);
    await form.save();
    return form;
}

export async function previewForm(organizationId, formId) {
    const form = await getFormById(organizationId, formId);
    return buildFormPreview(form);
}

export async function assignFormToWorkflow(organizationId, formId, assignment, { actor, req } = {}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId });
    if (!form) throw new Error('Form not found');
    await requireFormsFeature(organizationId, form);
    form.assignments = { ...(form.assignments?.toObject?.() || form.assignments || {}), ...assignment };
    if (assignment.stageKey) form.stageKey = assignment.stageKey;
    if (assignment.featureKey) form.featureKey = assignment.featureKey;
    await form.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleForm', entityId: form._id,
        entityName: form.name, req, actor, metadata: { assignment },
    });
    return form;
}

export async function saveFormResponseDraft({
    organizationId, formId, responseId, employeeId, candidateId,
    responses, workflowId, workflowType, actor,
}) {
    const form = await LifecycleFormDefinition.findOne({ _id: formId, organizationId, status: 'Published' });
    if (!form) throw new Error('Published form not found');

    let doc;
    if (responseId) {
        doc = await LifecycleFormResponse.findOne({ _id: responseId, organizationId, formDefinitionId: formId });
        if (!doc) throw new Error('Response not found');
        if (!['Draft', 'Rejected'].includes(doc.status)) throw new Error('Cannot edit submitted response');
    } else {
        doc = new LifecycleFormResponse({
            organizationId,
            formDefinitionId: formId,
            formVersion: form.version,
            category: form.category,
            featureKey: form.featureKey,
            stageKey: form.stageKey,
            employeeId,
            candidateId,
            workflowId,
            workflowType,
            status: 'Draft',
            submittedBy: actor?._id,
        });
    }

    doc.responses = responses;
    doc.activityFeed.push({ action: 'draft_saved', description: 'Draft saved', actor: actor?._id });
    await doc.save();
    return doc;
}

export async function listFormResponses(organizationId, formId, filters = {}) {
    const query = { organizationId, formDefinitionId: formId };
    if (filters.status) query.status = filters.status;
    if (filters.employeeId) query.employeeId = filters.employeeId;
    return LifecycleFormResponse.find(query).sort({ updatedAt: -1 }).lean();
}

export function buildFormReport(responses = []) {
    const total = responses.length;
    const byStatus = responses.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});
    const completed = (byStatus.Submitted || 0) + (byStatus.Approved || 0);
    const pending = (byStatus.Draft || 0) + (byStatus['Pending Approval'] || 0);
    const rejected = byStatus.Rejected || 0;

    const completionTimes = responses
        .filter((r) => r.submittedAt && r.createdAt)
        .map((r) => (new Date(r.submittedAt) - new Date(r.createdAt)) / 3600000);
    const avgCompletionHours = completionTimes.length
        ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length * 10) / 10
        : null;

    return { total, completed, pending, rejected, byStatus, avgCompletionHours };
}

export function exportResponsesCsv(form, responses = []) {
    const fieldKeys = (form.fields || [])
        .filter((f) => !['heading', 'divider', 'paragraph', 'instructions'].includes(f.type))
        .map((f) => f.key);
    const header = ['responseId', 'status', 'employeeId', 'submittedAt', ...fieldKeys].join(',');
    const rows = responses.map((r) => {
        const vals = fieldKeys.map((k) => {
            const v = r.responses?.[k];
            const str = Array.isArray(v) ? v.join(';') : (v ?? '');
            return `"${String(str).replace(/"/g, '""')}"`;
        });
        return [r._id, r.status, r.employeeId || '', r.submittedAt || '', ...vals].join(',');
    });
    return [header, ...rows].join('\n');
}

export async function handleFormApprovalOutcome(responseId, status, rejectionReason, approverId) {
    const doc = await LifecycleFormResponse.findById(responseId);
    if (!doc) return;
    if (status === 'Approved') {
        doc.status = 'Approved';
        doc.approvedAt = new Date();
        doc.activityFeed.push({ action: 'approved', description: 'Form response approved', actor: approverId });
    } else if (status === 'Rejected') {
        doc.status = 'Rejected';
        doc.rejectedAt = new Date();
        doc.rejectionReason = rejectionReason;
        doc.activityFeed.push({ action: 'rejected', description: rejectionReason || 'Form response rejected', actor: approverId });
    }
    await doc.save();
    await notify({
        type: status === 'Approved' ? 'lifecycle_form_approved' : 'lifecycle_form_rejected',
        organizationId: doc.organizationId,
        data: { response: doc },
    }).catch(() => {});
}

export { getVisibleFields, validateFormResponses, buildFormPreview };
