/**
 * Enterprise Document Hub service — extends existing Document model.
 * Reuses approval, notification, audit, and lifecycle catalog infrastructure.
 */

import { Document } from '../models/document.model.js';
import Employee from '../models/employee.model.js';
import { LifecycleDocumentCatalogEntry } from '../models/lifecycle.model.js';
import {
    LIFECYCLE_DOCUMENT_CATALOG,
    LIFECYCLE_DOCUMENT_HUB_CATEGORIES,
    CATALOG_TO_JOB_DOCUMENT_TYPE,
    getCatalogDocument,
} from '../constants/lifecycleDocumentCatalog.js';
import { getResolvedDocumentCatalog, assertFeatureEnabled, isOrgFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';
import { getSignedUrl, extractS3Key } from '../helpers/storageHelper.js';

const MS_PER_DAY = 86400000;

export function computeExpiryDate(catalogEntry, uploadedAt = new Date()) {
    if (!catalogEntry?.expiryDays) return null;
    return new Date(new Date(uploadedAt).getTime() + catalogEntry.expiryDays * MS_PER_DAY);
}

export function resolveCatalogMeta(catalogKey, orgCatalogEntry = null) {
    const system = getCatalogDocument(catalogKey);
    if (!system && !orgCatalogEntry) return null;
    return {
        ...(system || {}),
        ...(orgCatalogEntry || {}),
        catalogKey: catalogKey || system?.key,
        hubCategory: orgCatalogEntry?.hubCategory || system?.hubCategory || 'Custom',
        label: orgCatalogEntry?.label || system?.label || catalogKey,
    };
}

export function applyHubMetadataToDocument(doc, { catalogKey, orgCatalogEntry, workflowAssignment } = {}) {
    if (!catalogKey) return doc;
    const meta = resolveCatalogMeta(catalogKey, orgCatalogEntry);
    if (!meta) return doc;
    doc.catalogKey = catalogKey;
    doc.hubCategory = meta.hubCategory;
    if (!doc.name || doc.name === 'Document') doc.name = meta.label;
    doc.requiresApproval = meta.approvalRequired !== false;
    if (meta.approvalRequired) {
        doc.approvalStatus = doc.approvalStatus || 'Pending';
        doc.verificationStatus = doc.verificationStatus || 'Pending';
    }
    if (CATALOG_TO_JOB_DOCUMENT_TYPE[catalogKey]) {
        doc.employeeJobDocumentType = CATALOG_TO_JOB_DOCUMENT_TYPE[catalogKey];
    }
    const expiry = computeExpiryDate(meta, doc.createdAt || new Date());
    if (expiry) doc.expiryDate = expiry;
    if (workflowAssignment) doc.workflowAssignment = { ...doc.workflowAssignment?.toObject?.() || doc.workflowAssignment || {}, ...workflowAssignment };
    return doc;
}

export async function listDocumentLibrary(organizationId, filters = {}) {
    const query = { organizationId, isActive: { $ne: false } };
    if (filters.hubCategory) query.hubCategory = filters.hubCategory;
    if (filters.catalogKey) query.catalogKey = filters.catalogKey;
    if (filters.verificationStatus) query.verificationStatus = filters.verificationStatus;
    if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
    if (filters.employeeId) query.uploadedBy = filters.employeeId;
    if (filters.department) {
        const employees = await Employee.find({ organizationId, department: filters.department }).select('_id').lean();
        query.uploadedBy = { $in: employees.map((e) => e._id) };
    }
    if (filters.stageKey) query['workflowAssignment.stageKey'] = filters.stageKey;
    if (filters.featureKey) query['workflowAssignment.featureKey'] = filters.featureKey;
    if (filters.tag) query.tags = filters.tag;
    if (filters.search) {
        query.$or = [
            { name: new RegExp(filters.search, 'i') },
            { catalogKey: new RegExp(filters.search, 'i') },
            { tags: new RegExp(filters.search, 'i') },
        ];
    }
    if (filters.expiringWithinDays) {
        const cutoff = new Date(Date.now() + Number(filters.expiringWithinDays) * MS_PER_DAY);
        query.expiryDate = { $lte: cutoff, $gte: new Date() };
        query.verificationStatus = { $in: ['Approved', 'Renewal Pending'] };
    }
    if (filters.expired) {
        query.expiryDate = { $lt: new Date() };
        query.verificationStatus = { $in: ['Approved', 'Expired', 'Renewal Pending'] };
    }

    const docs = await Document.find(query)
        .populate('uploadedBy', 'firstName lastName employeeId department jobTitle name')
        .populate('verifiedBy', 'firstName lastName')
        .sort({ updatedAt: -1 })
        .limit(filters.limit || 200)
        .lean();
    return docs;
}

export async function getPendingVerification(organizationId, filters = {}) {
    return listDocumentLibrary(organizationId, {
        ...filters,
        verificationStatus: 'Pending',
        approvalStatus: 'Pending',
    });
}

export async function getExpiryDashboard(organizationId) {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * MS_PER_DAY);
    const in7 = new Date(now.getTime() + 7 * MS_PER_DAY);

    const [expired, expiringSoon, expiringWeek, renewalPending] = await Promise.all([
        Document.countDocuments({ organizationId, expiryDate: { $lt: now }, isActive: true }),
        Document.countDocuments({ organizationId, expiryDate: { $gte: now, $lte: in30 }, isActive: true }),
        Document.countDocuments({ organizationId, expiryDate: { $gte: now, $lte: in7 }, isActive: true }),
        Document.countDocuments({ organizationId, verificationStatus: 'Renewal Pending', isActive: true }),
    ]);

    const expiringList = await Document.find({
        organizationId,
        expiryDate: { $gte: now, $lte: in30 },
        isActive: true,
    })
        .populate('uploadedBy', 'firstName lastName department')
        .sort({ expiryDate: 1 })
        .limit(50)
        .lean();

    return { expired, expiringSoon, expiringWeek, renewalPending, expiringList };
}

export async function getCatalogWithOverrides(organizationId, module = 'both') {
    const onboarding = await getResolvedDocumentCatalog(organizationId, 'onboarding');
    const offboarding = await getResolvedDocumentCatalog(organizationId, 'offboarding');
    const custom = await LifecycleDocumentCatalogEntry.find({ organizationId, isCustom: true }).lean();
    const byCategory = {};
    for (const cat of LIFECYCLE_DOCUMENT_HUB_CATEGORIES) {
        byCategory[cat] = [];
    }
    const all = [...onboarding, ...offboarding, ...custom];
    const seen = new Set();
    for (const entry of all) {
        const key = entry.key || entry.catalogKey;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cat = entry.hubCategory || 'Custom';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({ ...entry, key });
    }
    if (module === 'onboarding') return { categories: byCategory, entries: onboarding };
    if (module === 'offboarding') return { categories: byCategory, entries: offboarding };
    return { categories: byCategory, entries: all };
}

export async function assignDocumentToWorkflow(organizationId, documentId, assignment, { actor, req } = {}) {
    const doc = await Document.findOne({ _id: documentId, organizationId });
    if (!doc) throw new Error('Document not found');
    doc.workflowAssignment = { ...(doc.workflowAssignment?.toObject?.() || doc.workflowAssignment || {}), ...assignment };
    if (assignment.stageKey) doc.workflowAssignment.stageKey = assignment.stageKey;
    if (assignment.featureKey) doc.workflowAssignment.featureKey = assignment.featureKey;
    await doc.save();
    await logLifecycleAudit({
        action: 'Update', entityType: 'Document', entityId: doc._id,
        entityName: doc.name, req, actor, metadata: { assignment },
    });
    return doc;
}

export async function verifyDocument(organizationId, documentId, { status, remarks, actor, req } = {}) {
    await assertFeatureEnabled(organizationId, 'documentCollection', 'Document collection');
    const doc = await Document.findOne({ _id: documentId, organizationId });
    if (!doc) throw new Error('Document not found');
    const verifierId = actor?._id;

    if (status === 'Approved') {
        doc.approvalStatus = 'Approved';
        doc.verificationStatus = 'Approved';
        doc.approvedBy = verifierId;
        doc.approvedAt = new Date();
        doc.verifiedBy = verifierId;
        doc.verifiedAt = new Date();
        doc.isActive = true;
        doc.rejectionReason = undefined;
    } else if (status === 'Rejected') {
        doc.approvalStatus = 'Rejected';
        doc.verificationStatus = 'Rejected';
        doc.approvedBy = verifierId;
        doc.approvedAt = new Date();
        doc.verifiedBy = verifierId;
        doc.verifiedAt = new Date();
        doc.verificationRemarks = remarks;
        doc.rejectionReason = remarks;
        doc.isActive = false;
    }

    doc.verificationHistory = doc.verificationHistory || [];
    doc.verificationHistory.push({
        status: doc.verificationStatus,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        remarks,
    });

    await doc.save();

    await notify({
        type: status === 'Approved' ? 'lifecycle_document_approved' : 'lifecycle_document_rejected',
        organizationId,
        data: { document: doc, employeeId: doc.uploadedBy },
    }).catch(() => {});

    await logLifecycleAudit({
        action: 'Update', entityType: 'Document', entityId: doc._id,
        entityName: doc.name, req, actor, metadata: { verificationStatus: doc.verificationStatus },
    });
    return doc;
}

export async function bulkVerifyDocuments(organizationId, documentIds = [], status, { remarks, actor, req } = {}) {
    await assertFeatureEnabled(organizationId, 'documentCollection', 'Document collection');
    const results = [];
    for (const id of documentIds) {
        try {
            const doc = await verifyDocument(organizationId, id, { status, remarks, actor, req });
            results.push({ id, success: true, document: doc });
        } catch (error) {
            results.push({ id, success: false, message: error.message });
        }
    }
    return results;
}

export async function sendDocumentReminders(organizationId, documentIds = [], { actor } = {}) {
    await assertFeatureEnabled(organizationId, 'reminders', 'Reminders');
    await assertFeatureEnabled(organizationId, 'documentCollection', 'Document collection');
    const docs = await Document.find({ organizationId, _id: { $in: documentIds } });
    for (const doc of docs) {
        await notify({
            type: 'lifecycle_document_reminder',
            organizationId,
            data: { document: doc, employeeId: doc.uploadedBy },
        }).catch(() => {});
        doc.renewalReminderSentAt = new Date();
        await doc.save();
    }
    return { sent: docs.length };
}

export async function restoreDocumentVersion(organizationId, documentId, targetVersion, { actor, req } = {}) {
    const doc = await Document.findOne({ _id: documentId, organizationId });
    if (!doc) throw new Error('Document not found');
    const versionEntry = (doc.previousVersions || []).find((v) => v.version === targetVersion);
    if (!versionEntry) throw new Error('Version not found');

    doc.previousVersions.push({
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        version: doc.version,
        uploadedAt: new Date(),
        uploadedBy: actor?._id,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        comments: `Archived before restore to v${targetVersion}`,
    });

    doc.fileUrl = versionEntry.fileUrl;
    doc.fileName = versionEntry.fileName;
    doc.fileSize = versionEntry.fileSize || doc.fileSize;
    doc.mimeType = versionEntry.mimeType || doc.mimeType;
    doc.version = (doc.version || 1) + 1;
    await doc.save();

    await logLifecycleAudit({
        action: 'Update', entityType: 'Document', entityId: doc._id,
        entityName: doc.name, req, actor, metadata: { restoredVersion: targetVersion },
    });
    return doc;
}

export function buildMissingDocumentsReport(organizationId, employeeId, requiredCatalog = [], existingDocs = []) {
    const uploadedKeys = new Set(existingDocs.filter((d) => d.isActive !== false).map((d) => d.catalogKey).filter(Boolean));
    const missing = requiredCatalog.filter((c) => c.mandatory && !uploadedKeys.has(c.key || c.catalogKey));
    return { employeeId, missing, missingCount: missing.length, requiredCount: requiredCatalog.filter((c) => c.mandatory).length };
}

export async function buildDocumentReports(organizationId) {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * MS_PER_DAY);

    const [pending, rejected, expired, expiring, byDepartment] = await Promise.all([
        Document.countDocuments({ organizationId, verificationStatus: 'Pending', isActive: true }),
        Document.countDocuments({ organizationId, verificationStatus: 'Rejected' }),
        Document.countDocuments({ organizationId, verificationStatus: 'Expired' }),
        Document.countDocuments({ organizationId, expiryDate: { $gte: now, $lte: in30 }, isActive: true }),
        Document.aggregate([
            { $match: { organizationId, category: 'Employee', isActive: true } },
            { $lookup: { from: 'employees', localField: 'uploadedBy', foreignField: '_id', as: 'emp' } },
            { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
            { $group: { _id: '$emp.department', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'Pending'] }, 1, 0] } } } },
            { $sort: { count: -1 } },
        ]),
    ]);

    return { pending, rejected, expired, expiring, byDepartment };
}

export function exportDocumentsCsv(documents = []) {
    const header = ['id', 'name', 'catalogKey', 'hubCategory', 'verificationStatus', 'employeeId', 'expiryDate', 'uploadedAt'].join(',');
    const rows = documents.map((d) => [
        d._id,
        `"${String(d.name || '').replace(/"/g, '""')}"`,
        d.catalogKey || '',
        d.hubCategory || '',
        d.verificationStatus || d.approvalStatus || '',
        d.uploadedBy?._id || d.uploadedBy || '',
        d.expiryDate || '',
        d.createdAt || '',
    ].join(','));
    return [header, ...rows].join('\n');
}

export async function processDocumentExpiryForOrg(organizationId) {
    if (!(await isOrgFeatureEnabled(organizationId, 'documentCollection'))) {
        return { expired: 0, reminders: 0, renewalPending: 0, skipped: true };
    }
    const remindersEnabled = await isOrgFeatureEnabled(organizationId, 'reminders');
    const now = new Date();
    const settings = await getResolvedDocumentCatalog(organizationId, 'onboarding');
    const catalogMap = new Map(settings.map((c) => [c.key, c]));

    let expired = 0;
    let reminders = 0;
    let renewalPending = 0;

    const docs = await Document.find({
        organizationId,
        expiryDate: { $exists: true, $ne: null },
        isActive: true,
        verificationStatus: { $in: ['Approved', 'Renewal Pending'] },
    });

    for (const doc of docs) {
        const catalog = catalogMap.get(doc.catalogKey) || getCatalogDocument(doc.catalogKey);
        const reminderDays = catalog?.renewalReminderDays || 30;

        if (doc.expiryDate < now) {
            doc.verificationStatus = 'Expired';
            await doc.save();
            expired += 1;
            if (remindersEnabled) {
                await notify({
                    type: 'lifecycle_document_expired',
                    organizationId,
                    data: { document: doc, featureKey: 'documentCollection' },
                }).catch(() => {});
            }
            continue;
        }

        const reminderAt = new Date(doc.expiryDate.getTime() - reminderDays * MS_PER_DAY);
        if (remindersEnabled && now >= reminderAt && !doc.renewalReminderSentAt) {
            doc.verificationStatus = 'Renewal Pending';
            doc.renewalReminderSentAt = now;
            await doc.save();
            reminders += 1;
            renewalPending += 1;
            await notify({
                type: 'lifecycle_document_reminder',
                organizationId,
                data: { document: doc, featureKey: 'reminders' },
            }).catch(() => {});
        }
    }

    return { expired, reminders, renewalPending };
}

export async function processAllDocumentExpiry() {
    const orgIds = await Document.distinct('organizationId');
    let totals = { expired: 0, reminders: 0, renewalPending: 0, orgs: 0 };
    for (const organizationId of orgIds) {
        const result = await processDocumentExpiryForOrg(organizationId);
        totals.expired += result.expired;
        totals.reminders += result.reminders;
        totals.renewalPending += result.renewalPending;
        totals.orgs += 1;
    }
    return totals;
}

export async function upsertCatalogEntry(organizationId, payload, { actor, req } = {}) {
    await assertFeatureEnabled(organizationId, 'documentCollection', 'Document collection');
    const entry = await LifecycleDocumentCatalogEntry.findOneAndUpdate(
        { organizationId, catalogKey: payload.catalogKey },
        {
            $set: {
                organizationId,
                catalogKey: payload.catalogKey,
                label: payload.label,
                hubCategory: payload.hubCategory || 'Custom',
                module: payload.module || 'both',
                featureKey: payload.featureKey || 'documentCollection',
                enabled: payload.enabled !== false,
                mandatory: payload.mandatory || false,
                approvalRequired: payload.approvalRequired || false,
                expiryDays: payload.expiryDays,
                renewalReminderDays: payload.renewalReminderDays,
                versioningEnabled: payload.versioningEnabled !== false,
                isCustom: payload.isCustom !== false,
                tags: payload.tags || [],
                assignments: payload.assignments,
            },
        },
        { upsert: true, new: true },
    );
    await logLifecycleAudit({
        action: payload.isCustom ? 'Create' : 'Update',
        entityType: 'LifecycleDocumentCatalog',
        entityId: entry._id,
        entityName: entry.label || entry.catalogKey,
        req, actor,
    });
    return entry;
}

/**
 * Process document with OCR (text extraction)
 * Placeholder for OCR integration - can be extended with Tesseract.js, Google Vision API, or similar
 */
export async function processDocumentOCR(documentId, { organizationId, actor, req } = {}) {
    const query = { _id: documentId };
    if (organizationId) query.organizationId = organizationId;
    const doc = await Document.findOne(query);
    if (!doc) throw new Error('Document not found');

    // OCR provider not configured — do not claim success
    doc.ocrProcessed = false;
    doc.ocrRequestedAt = new Date();
    doc.ocrRequestedBy = actor?._id;
    await doc.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Document',
        entityId: doc._id,
        entityName: doc.name,
        req,
        actor,
        metadata: { action: 'ocr_requested', stub: true },
    });

    const err = new Error('OCR provider is not configured. Document flagged for manual review.');
    err.code = 'OCR_NOT_CONFIGURED';
    err.status = 501;
    err.document = doc;
    throw err;
}

/**
 * Create a new version of a document
 */
export async function createDocumentVersion(organizationId, documentId, { fileUrl, fileName, comments, actor, req } = {}) {
    const doc = await Document.findOne({ _id: documentId, organizationId });
    if (!doc) throw new Error('Document not found');

    // Archive current version
    doc.previousVersions = doc.previousVersions || [];
    doc.previousVersions.push({
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        version: doc.version || 1,
        uploadedAt: doc.createdAt || new Date(),
        uploadedBy: doc.uploadedBy,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        comments: comments || 'Version archived',
        verificationStatus: doc.verificationStatus,
        approvalStatus: doc.approvalStatus,
    });

    // Update to new version
    doc.fileUrl = fileUrl;
    doc.fileName = fileName || doc.fileName;
    doc.version = (doc.version || 1) + 1;
    doc.createdAt = new Date();
    doc.uploadedBy = actor?._id;
    doc.verificationStatus = 'Pending';
    doc.approvalStatus = 'Pending';
    doc.ocrProcessed = false;

    await doc.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Document',
        entityId: doc._id,
        entityName: doc.name,
        req,
        actor,
        metadata: { newVersion: doc.version, comments },
    });

    await notify({
        type: 'lifecycle_document_versioned',
        organizationId,
        data: { document: doc, newVersion: doc.version },
    }).catch(() => {});

    return doc;
}

/**
 * Get document preview URL or generate preview
 */
export async function getDocumentPreview(documentId, { organizationId } = {}) {
    const query = { _id: documentId };
    if (organizationId) query.organizationId = organizationId;
    const doc = await Document.findOne(query);
    if (!doc) throw new Error('Document not found');

    const s3Key = doc.fileUrl ? extractS3Key(doc.fileUrl) : null;
    const previewUrl = s3Key ? await getSignedUrl(s3Key, 900) : null;

    if (doc.mimeType?.startsWith('image/')) {
        return { previewUrl, type: 'image', fileUrl: doc.fileUrl, name: doc.name };
    }

    if (doc.mimeType === 'application/pdf') {
        return { previewUrl, type: 'pdf', fileUrl: doc.fileUrl, name: doc.name, needsGeneration: false };
    }

    return { previewUrl, type: 'document', fileUrl: doc.fileUrl, name: doc.name, needsGeneration: !doc.fileUrl };
}

/**
 * Initiate document renewal workflow
 */
export async function initiateDocumentRenewal(organizationId, documentId, { actor, req } = {}) {
    const doc = await Document.findOne({ _id: documentId, organizationId });
    if (!doc) throw new Error('Document not found');

    doc.verificationStatus = 'Renewal Pending';
    doc.renewalInitiatedAt = new Date();
    doc.renewalInitiatedBy = actor?._id;

    await doc.save();

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Document',
        entityId: doc._id,
        entityName: doc.name,
        req,
        actor,
        metadata: { action: 'renewal_initiated' },
    });

    await notify({
        type: 'lifecycle_document_renewal_required',
        organizationId,
        data: { document: doc, employeeId: doc.uploadedBy },
    }).catch(() => {});

    return doc;
}

/**
 * Complete document renewal with new document
 */
export async function completeDocumentRenewal(organizationId, documentId, { newDocumentId, actor, req } = {}) {
    const oldDoc = await Document.findOne({ _id: documentId, organizationId });
    if (!oldDoc) throw new Error('Document not found');

    const newDoc = await Document.findOne({ _id: newDocumentId, organizationId });
    if (!newDoc) throw new Error('New document not found');

    // Mark old document as replaced
    oldDoc.verificationStatus = 'Replaced';
    oldDoc.replacedBy = newDocumentId;
    oldDoc.replacedAt = new Date();
    oldDoc.isActive = false;

    // Link new document to old one
    newDoc.replacesDocument = documentId;
    newDoc.catalogKey = newDoc.catalogKey || oldDoc.catalogKey;
    newDoc.hubCategory = newDoc.hubCategory || oldDoc.hubCategory;
    newDoc.workflowAssignment = newDoc.workflowAssignment || oldDoc.workflowAssignment;

    // Recalculate expiry
    if (oldDoc.expiryDate) {
        const catalogue = await getCatalogDocument(newDoc.catalogKey);
        if (catalogue?.expiryDays) {
            newDoc.expiryDate = computeExpiryDate(catalogue, newDoc.createdAt || new Date());
        }
    }

    await Promise.all([oldDoc.save(), newDoc.save()]);

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Document',
        entityId: oldDoc._id,
        entityName: oldDoc.name,
        req,
        actor,
        metadata: { action: 'renewal_completed', replacedBy: newDocumentId },
    });

    await notify({
        type: 'lifecycle_document_renewed',
        organizationId,
        data: { oldDocument: oldDoc, newDocument: newDoc, employeeId: newDoc.uploadedBy },
    }).catch(() => {});

    return { oldDocument: oldDoc, newDocument: newDoc };
}

/**
 * Get document version history with diffs
 */
export async function getDocumentVersionHistory(documentId, { organizationId } = {}) {
    const query = { _id: documentId };
    if (organizationId) query.organizationId = organizationId;
    const doc = await Document.findOne(query);
    if (!doc) throw new Error('Document not found');

    const versions = [
        {
            version: doc.version || 1,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            uploadedAt: doc.createdAt || new Date(),
            uploadedBy: doc.uploadedBy,
            verificationStatus: doc.verificationStatus,
            approvalStatus: doc.approvalStatus,
            isCurrent: true,
        },
        ...(doc.previousVersions || []).map((v) => ({
            ...v,
            isCurrent: false,
        })),
    ];

    return {
        documentId: doc._id,
        documentName: doc.name,
        versions: versions.sort((a, b) => b.version - a.version),
        totalVersions: versions.length,
    };
}

/**
 * Bulk document operations
 */
export async function bulkDocumentOperation(organizationId, operation, documentIds, { actor, req } = {}) {
    const results = [];

    for (const id of documentIds) {
        try {
            let result;
            switch (operation) {
                case 'verify':
                    result = await verifyDocument(organizationId, id, { status: 'Approved', actor, req });
                    break;
                case 'reject':
                    result = await verifyDocument(organizationId, id, { status: 'Rejected', remarks: 'Bulk rejection', actor, req });
                    break;
                case 'renewal':
                    result = await initiateDocumentRenewal(organizationId, id, { actor, req });
                    break;
                case 'remind':
                    result = await sendDocumentReminders(organizationId, [id], { actor });
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
            results.push({ id, success: true, document: result });
        } catch (error) {
            results.push({ id, success: false, message: error.message });
        }
    }

    await logLifecycleAudit({
        action: 'Bulk Operation',
        entityType: 'Document',
        entityId: null,
        entityName: operation,
        req,
        actor,
        metadata: { operation, documentIds, successCount: results.filter(r => r.success).length },
    });

    return results;
}

export { LIFECYCLE_DOCUMENT_HUB_CATEGORIES, LIFECYCLE_DOCUMENT_CATALOG };
