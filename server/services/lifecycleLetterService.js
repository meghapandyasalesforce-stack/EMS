/**
 * Enterprise Letter Generator — templates, PDF, Document Hub, approval, triggers.
 */

import crypto from 'crypto';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import { Document } from '../models/document.model.js';
import { OffboardingWorkflow, OnboardingWorkflow } from '../models/onboarding.model.js';
import {
    LifecycleLetterTemplate,
    LifecycleGeneratedLetter,
    LIFECYCLE_LETTER_TYPES,
    LIFECYCLE_LETTER_PLACEHOLDERS,
} from '../models/lifecycleGap.model.js';
import { applyPlaceholders, buildLetterHtml, generateLetterPdf } from '../helpers/lifecycleLetterPdf.js';
import { initiateLifecycleApproval } from './lifecycleApprovalService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { assertFeatureEnabled, getOrCreateLifecycleSettings } from './lifecycleConfigService.js';

function categoryForLetterType(letterType) {
    for (const [cat, types] of Object.entries(LIFECYCLE_LETTER_TYPES)) {
        if (types.includes(letterType)) return cat;
    }
    return 'custom';
}

const LETTER_TYPE_FEATURE = Object.freeze({
    experience_letter: 'experienceLetter',
    experienceLetter: 'experienceLetter',
    relieving_letter: 'relievingLetter',
    relievingLetter: 'relievingLetter',
    service_certificate: 'serviceCertificate',
    serviceCertificate: 'serviceCertificate',
    offer_letter: 'offerLetter',
    offerLetter: 'offerLetter',
});

function featureKeyForLetterType(letterType) {
    if (!letterType) return 'experienceLetter';
    if (LETTER_TYPE_FEATURE[letterType]) return LETTER_TYPE_FEATURE[letterType];
    const normalized = String(letterType).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    if (normalized.includes('relieving')) return 'relievingLetter';
    if (normalized.includes('service')) return 'serviceCertificate';
    if (normalized.includes('offer')) return 'offerLetter';
    return 'experienceLetter';
}

function pushTemplateVersion(template, actor, notes = 'Updated') {
    template.versionHistory = template.versionHistory || [];
    template.versionHistory.push({
        version: template.version || 1,
        bodyHtml: template.bodyHtml,
        changedBy: actor?._id,
        changedAt: new Date(),
        changeNotes: notes,
    });
    template.version = (template.version || 1) + 1;
}

export async function listLetterTemplates(organizationId, filters = {}) {
    const query = { organizationId, isActive: { $ne: false } };
    if (filters.letterType) query.letterType = filters.letterType;
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    return LifecycleLetterTemplate.find(query).sort({ updatedAt: -1 }).lean();
}

export async function getLetterTemplate(organizationId, templateId) {
    const tpl = await LifecycleLetterTemplate.findOne({ _id: templateId, organizationId }).lean();
    if (!tpl) throw new Error('Letter template not found');
    return tpl;
}

export async function createLetterTemplate(organizationId, payload, { actor, req } = {}) {
    const letterType = payload.letterType;
    if (!letterType) throw new Error('letterType is required');
    const tpl = await LifecycleLetterTemplate.create({
        organizationId,
        letterType,
        category: payload.category || categoryForLetterType(letterType),
        name: payload.name,
        description: payload.description,
        bodyHtml: payload.bodyHtml || '<p>Dear {{employeeName}},</p><p>{{currentDate}}</p>',
        headerHtml: payload.headerHtml,
        footerHtml: payload.footerHtml,
        customPlaceholders: payload.customPlaceholders || [],
        workflowTriggers: payload.workflowTriggers || [],
        featureKey: payload.featureKey,
        watermarkText: payload.watermarkText,
        includeSignatureBlock: payload.includeSignatureBlock !== false,
        includeQrPlaceholder: payload.includeQrPlaceholder || false,
        includePageNumbers: payload.includePageNumbers !== false,
        passwordProtected: payload.passwordProtected || false,
        approvalRequired: payload.approvalRequired || false,
        status: 'Draft',
        version: 1,
        createdBy: actor?._id,
    });
    await logLifecycleAudit({
        action: 'Create', entityType: 'LifecycleLetterTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor,
    });
    return tpl;
}

export async function updateLetterTemplate(organizationId, templateId, payload, { actor, req } = {}) {
    const tpl = await LifecycleLetterTemplate.findOne({ _id: templateId, organizationId });
    if (!tpl) throw new Error('Letter template not found');
    const fields = ['name', 'description', 'bodyHtml', 'headerHtml', 'footerHtml', 'customPlaceholders',
        'workflowTriggers', 'featureKey', 'watermarkText', 'includeSignatureBlock', 'includeQrPlaceholder',
        'includePageNumbers', 'passwordProtected', 'approvalRequired', 'letterType', 'category'];
    for (const f of fields) {
        if (payload[f] !== undefined) tpl[f] = payload[f];
    }
    if (tpl.isModified()) {
        pushTemplateVersion(tpl, actor);
        if (tpl.status === 'Published') tpl.status = 'Draft';
        tpl.updatedBy = actor?._id;
    }
    await tpl.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleLetterTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor,
    });
    return tpl;
}

export async function cloneLetterTemplate(organizationId, templateId, { name, actor, req } = {}) {
    const source = await LifecycleLetterTemplate.findOne({ _id: templateId, organizationId }).lean();
    if (!source) throw new Error('Template not found');
    const { _id, createdAt, updatedAt, publishedAt, ...rest } = source;
    const clone = await LifecycleLetterTemplate.create({
        ...rest,
        name: name || `${source.name} (Copy)`,
        status: 'Draft',
        version: 1,
        versionHistory: [],
        clonedFrom: source._id,
        createdBy: actor?._id,
    });
    return clone;
}

export async function publishLetterTemplate(organizationId, templateId, { actor, req } = {}) {
    const tpl = await LifecycleLetterTemplate.findOne({ _id: templateId, organizationId });
    if (!tpl) throw new Error('Template not found');
    if (!tpl.bodyHtml?.trim()) throw new Error('Template body is required');
    tpl.status = 'Published';
    tpl.publishedAt = new Date();
    await tpl.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'LifecycleLetterTemplate', entityId: tpl._id,
        entityName: tpl.name, req, actor, metadata: { action: 'publish' },
    });
    return tpl;
}

export async function archiveLetterTemplate(organizationId, templateId, { actor, req } = {}) {
    const tpl = await LifecycleLetterTemplate.findOne({ _id: templateId, organizationId });
    if (!tpl) throw new Error('Template not found');
    tpl.status = 'Archived';
    tpl.isActive = false;
    await tpl.save();
    return tpl;
}

export async function buildPlaceholderContext({
    organizationId, employeeId, candidateId, workflowId, workflowType, customData = {},
}) {
    const org = await Organization.findById(organizationId).select('name legalName address').lean();
    let employee = null;
    if (employeeId) {
        employee = await Employee.findById(employeeId).lean();
    }
    let workflow = null;
    if (workflowId && workflowType === 'offboarding') {
        workflow = await OffboardingWorkflow.findById(workflowId).lean();
        if (!employee && workflow?.employeeId) employee = await Employee.findById(workflow.employeeId).lean();
    } else if (workflowId && workflowType === 'onboarding') {
        workflow = await OnboardingWorkflow.findById(workflowId).lean();
        if (!employee && workflow?.employeeId) employee = await Employee.findById(workflow.employeeId).lean();
    }

    const name = employee
        ? [employee.firstName || employee.name, employee.lastName].filter(Boolean).join(' ')
        : '';

    const ctx = {
        '{{employeeName}}': name,
        '{{employeeId}}': employee?.employeeId || employee?._id?.toString() || '',
        '{{employeeEmail}}': employee?.email || '',
        '{{department}}': employee?.department || '',
        '{{designation}}': employee?.jobTitle || employee?.designation || '',
        '{{managerName}}': '',
        '{{companyName}}': org?.legalName || org?.name || 'Organization',
        '{{companyAddress}}': org?.address || '',
        '{{joiningDate}}': employee?.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-IN') : '',
        '{{exitDate}}': workflow?.lastWorkingDate ? new Date(workflow.lastWorkingDate).toLocaleDateString('en-IN') : '',
        '{{lastWorkingDate}}': workflow?.lastWorkingDate ? new Date(workflow.lastWorkingDate).toLocaleDateString('en-IN') : '',
        '{{noticePeriodDays}}': String(workflow?.noticePeriod?.policyDays ?? ''),
        '{{salary}}': employee?.salary ? `Rs ${Number(employee.salary).toLocaleString('en-IN')}` : '',
        '{{currentDate}}': new Date().toLocaleDateString('en-IN'),
        '{{position}}': employee?.jobTitle || '',
        '{{location}}': employee?.workLocation || '',
        '{{fnfAmount}}': workflow?.finalSettlement?.netPayable != null ? String(workflow.finalSettlement.netPayable) : '',
        '{{assetsList}}': '',
        '{{workflowStage}}': workflow?.status || '',
        '{{signatureBlock}}': '\n\n_________________________\nAuthorized Signatory',
        '{{qrCode}}': '[QR Code]',
        '{{logo}}': org?.name || '',
    };

    for (const [k, v] of Object.entries(customData)) {
        const token = k.startsWith('{{') ? k : `{{${k}}}`;
        ctx[token] = v ?? '';
    }
    return ctx;
}

export async function previewLetterTemplate(organizationId, templateId, contextOverrides = {}) {
    const tpl = await getLetterTemplate(organizationId, templateId);
    const ctx = await buildPlaceholderContext({ organizationId, ...contextOverrides });
    return {
        templateId: tpl._id,
        letterType: tpl.letterType,
        renderedHtml: buildLetterHtml({
            headerHtml: tpl.headerHtml,
            bodyHtml: tpl.bodyHtml,
            footerHtml: tpl.footerHtml,
            data: ctx,
        }),
        placeholders: LIFECYCLE_LETTER_PLACEHOLDERS,
    };
}

export async function saveLetterToDocumentHub({
    organizationId, employeeId, letter, pdf, actor,
}) {
    const doc = await Document.create({
        organizationId,
        name: letter.title || `${letter.letterType} - ${new Date().toLocaleDateString('en-IN')}`,
        description: `Generated lifecycle letter (${letter.letterType})`,
        category: 'Employee',
        type: 'PDF',
        fileUrl: pdf.pdfUrl,
        fileName: pdf.pdfFileName,
        fileSize: 0,
        mimeType: 'application/pdf',
        uploadedBy: actor?._id || employeeId,
        relatedTo: 'Employee',
        relatedId: employeeId,
        relatedToModel: 'Employee',
        requiresApproval: false,
        approvalStatus: 'Approved',
        verificationStatus: 'Approved',
        catalogKey: letter.letterType?.toUpperCase?.() || 'OTHER',
        hubCategory: letter.category === 'offboarding' ? 'Employment' : 'Employment',
        tags: ['lifecycle-letter', letter.letterType],
        metadata: {
            additionalInfo: {
                generatedLetterId: letter._id,
                letterType: letter.letterType,
                templateId: letter.templateId,
            },
        },
    });
    return doc;
}

export async function generateLetter({
    organizationId, templateId, employeeId, candidateId, workflowId, workflowType,
    customData, triggerEvent, actor, req, sendNotification = true,
}) {
    const tpl = await LifecycleLetterTemplate.findOne({
        _id: templateId,
        organizationId,
        status: 'Published',
        isActive: { $ne: false },
    });
    if (!tpl) throw new Error('Published letter template not found');

    await assertFeatureEnabled(
        organizationId,
        featureKeyForLetterType(tpl.letterType),
        `Letter type ${tpl.letterType}`,
    );

    const ctx = await buildPlaceholderContext({
        organizationId, employeeId, candidateId, workflowId, workflowType, customData,
    });
    const renderedHtml = buildLetterHtml({
        headerHtml: tpl.headerHtml,
        bodyHtml: tpl.bodyHtml,
        footerHtml: tpl.footerHtml,
        data: ctx,
    });

    const title = tpl.name || tpl.letterType;
    const pdf = await generateLetterPdf({
        organizationId,
        prefix: tpl.letterType,
        title,
        bodyHtml: applyPlaceholders(tpl.bodyHtml, ctx),
        headerHtml: tpl.headerHtml ? applyPlaceholders(tpl.headerHtml, ctx) : undefined,
        footerHtml: tpl.footerHtml ? applyPlaceholders(tpl.footerHtml, ctx) : undefined,
        fileName: `${tpl.letterType}-${Date.now()}.pdf`,
        watermarkText: tpl.watermarkText,
        includePageNumbers: tpl.includePageNumbers !== false,
    });

    const letter = await LifecycleGeneratedLetter.create({
        organizationId,
        templateId: tpl._id,
        templateVersion: tpl.version,
        letterType: tpl.letterType,
        category: tpl.category,
        title,
        bodyHtml: tpl.bodyHtml,
        renderedHtml,
        pdfUrl: pdf.pdfUrl,
        pdfFileName: pdf.pdfFileName,
        employeeId,
        candidateId,
        workflowId,
        workflowType,
        status: 'Draft',
        placeholderSnapshot: ctx,
        triggerEvent,
        createdBy: actor?._id,
        activityFeed: [{ action: 'generated', description: 'Letter generated', actor: actor?._id }],
    });

    if (employeeId) {
        const hubDoc = await saveLetterToDocumentHub({ organizationId, employeeId, letter, pdf, actor });
        letter.documentId = hubDoc._id;
        await letter.save();
    }

    if (tpl.approvalRequired) {
        letter.status = 'PendingApproval';
        const approval = await initiateLifecycleApproval({
            organizationId,
            entityType: 'LifecycleLetter',
            entityId: letter._id,
            requestedBy: actor?._id,
            metadata: { letterType: letter.letterType, templateId: tpl._id },
            req,
            actor,
        });
        if (approval.approvalInstanceId) letter.approvalInstanceId = approval.approvalInstanceId;
        else if (approval.status === 'Approved') letter.status = 'Approved';
        await letter.save();
    } else {
        letter.status = 'Approved';
        await letter.save();
    }

    if (sendNotification) {
        await notify({
            type: letter.status === 'PendingApproval' ? 'lifecycle_letter_pending_approval' : 'lifecycle_letter_generated',
            organizationId,
            data: { letter, employeeId },
        }).catch(() => {});
    }

    await logLifecycleAudit({
        action: 'Create', entityType: 'LifecycleGeneratedLetter', entityId: letter._id,
        entityName: title, req, actor, metadata: { letterType: tpl.letterType },
    });

    return letter;
}

export async function bulkGenerateLetters(organizationId, { templateId, employeeIds = [], workflowType }, { actor, req } = {}) {
    const batchId = crypto.randomBytes(8).toString('hex');
    const results = [];
    for (const employeeId of employeeIds) {
        try {
            const letter = await generateLetter({
                organizationId, templateId, employeeId, workflowType, actor, req, sendNotification: false,
            });
            letter.bulkBatchId = batchId;
            await letter.save();
            results.push({ employeeId, success: true, letterId: letter._id });
        } catch (error) {
            results.push({ employeeId, success: false, message: error.message });
        }
    }
    return { batchId, results };
}

export async function sendLetter(organizationId, letterId, { actor, req } = {}) {
    const letter = await LifecycleGeneratedLetter.findOne({ _id: letterId, organizationId });
    if (!letter) throw new Error('Letter not found');
    if (!['Approved', 'Published'].includes(letter.status)) {
        throw new Error('Letter must be approved before sending');
    }
    letter.status = 'Sent';
    letter.sentAt = new Date();
    letter.deliveryStatus = 'Delivered';
    letter.activityFeed.push({ action: 'sent', description: 'Letter sent to employee', actor: actor?._id });
    await letter.save();

    await notify({
        type: 'lifecycle_letter_sent',
        organizationId,
        data: { letter, employeeId: letter.employeeId },
    }).catch(() => {});

    return letter;
}

export async function resendLetter(organizationId, letterId, ctx = {}) {
    return sendLetter(organizationId, letterId, ctx);
}

export async function acknowledgeLetter(organizationId, letterId, { actor } = {}) {
    const letter = await LifecycleGeneratedLetter.findOne({ _id: letterId, organizationId });
    if (!letter) throw new Error('Letter not found');
    letter.status = 'Acknowledged';
    letter.acknowledgedAt = new Date();
    letter.activityFeed.push({ action: 'acknowledged', description: 'Receipt acknowledged', actor: actor?._id });
    await letter.save();
    return letter;
}

export async function markLetterViewed(organizationId, letterId) {
    const letter = await LifecycleGeneratedLetter.findOne({ _id: letterId, organizationId });
    if (!letter) throw new Error('Letter not found');
    if (!letter.viewedAt) {
        letter.viewedAt = new Date();
        if (letter.status === 'Sent') letter.status = 'Viewed';
        await letter.save();
        await notify({
            type: 'lifecycle_letter_viewed',
            organizationId,
            data: { letter, employeeId: letter.employeeId },
        }).catch(() => {});
    }
    return letter;
}

export async function listGeneratedLetters(organizationId, filters = {}) {
    const query = { organizationId };
    if (filters.letterType) query.letterType = filters.letterType;
    if (filters.status) query.status = filters.status;
    if (filters.employeeId) query.employeeId = filters.employeeId;
    if (filters.workflowId) query.workflowId = filters.workflowId;
    if (filters.bulkBatchId) query.bulkBatchId = filters.bulkBatchId;
    return LifecycleGeneratedLetter.find(query)
        .populate('employeeId', 'firstName lastName employeeId department')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 200)
        .lean();
}

export function buildLetterReports(letters = []) {
    const byStatus = letters.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
    }, {});
    return {
        total: letters.length,
        generated: letters.length,
        pendingApproval: byStatus.PendingApproval || 0,
        sent: (byStatus.Sent || 0) + (byStatus.Viewed || 0) + (byStatus.Acknowledged || 0),
        acknowledged: byStatus.Acknowledged || 0,
        byStatus,
        byLetterType: letters.reduce((acc, l) => {
            acc[l.letterType] = (acc[l.letterType] || 0) + 1;
            return acc;
        }, {}),
    };
}

export function exportLettersCsv(letters = []) {
    const header = ['id', 'letterType', 'status', 'employeeId', 'sentAt', 'acknowledgedAt', 'createdAt'].join(',');
    const rows = letters.map((l) => [
        l._id, l.letterType, l.status, l.employeeId?._id || l.employeeId || '',
        l.sentAt || '', l.acknowledgedAt || '', l.createdAt || '',
    ].join(','));
    return [header, ...rows].join('\n');
}

export async function handleLetterApprovalOutcome(letterId, status, rejectionReason, approverId) {
    const letter = await LifecycleGeneratedLetter.findById(letterId);
    if (!letter) return;
    if (status === 'Approved') {
        letter.status = 'Approved';
        letter.activityFeed.push({ action: 'approved', description: 'Letter approved', actor: approverId });
    } else if (status === 'Rejected') {
        letter.status = 'Rejected';
        letter.activityFeed.push({ action: 'rejected', description: rejectionReason || 'Letter rejected', actor: approverId });
    }
    await letter.save();
    await notify({
        type: status === 'Approved' ? 'lifecycle_letter_approved' : 'lifecycle_letter_rejected',
        organizationId: letter.organizationId,
        data: { letter, employeeId: letter.employeeId },
    }).catch(() => {});
}

export async function processWorkflowLetterTriggers({
    organizationId, event, employeeId, workflowId, workflowType, actor, req,
}) {
    const templates = await LifecycleLetterTemplate.find({
        organizationId,
        status: 'Published',
        isActive: { $ne: false },
        'workflowTriggers.event': event,
        'workflowTriggers.enabled': { $ne: false },
    });
    const generated = [];
    for (const tpl of templates) {
        const trigger = (tpl.workflowTriggers || []).find((t) => t.event === event && t.enabled !== false);
        if (!trigger) continue;
        try {
            const letter = await generateLetter({
                organizationId,
                templateId: tpl._id,
                employeeId,
                workflowId,
                workflowType,
                triggerEvent: event,
                actor,
                req,
            });
            generated.push(letter);
        } catch {
            /* skip failed auto-generation */
        }
    }
    return generated;
}

export {
    LIFECYCLE_LETTER_TYPES,
    LIFECYCLE_LETTER_PLACEHOLDERS,
    categoryForLetterType,
};
