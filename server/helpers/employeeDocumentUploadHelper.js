import crypto from 'crypto';
import path from 'path';
import { Document } from '../models/document.model.js';
import { uploadFile, deleteFile } from './storageHelper.js';
import { buildDocumentS3Key } from './documentFilePathHelper.js';
import { applyHubMetadataToDocument } from '../services/lifecycleDocumentHubService.js';
import { getCatalogDocument } from '../constants/lifecycleDocumentCatalog.js';

const JOB_TYPE_TO_CATALOG = {
    AADHAR_CARD: 'AADHAAR',
    PAN_CARD: 'PAN',
    DEGREE_CERTIFICATE: 'DEGREE',
    OFFER_LETTER: 'OFFER_LETTER',
    PASSPORT: 'PASSPORT',
    GUARANTOR_FORM: 'OTHER',
    OTHER: 'OTHER',
};

export const JOB_DOCUMENT_TYPES = {
    OFFER_LETTER: 'OFFER_LETTER',
    AADHAR_CARD: 'AADHAR_CARD',
    PAN_CARD: 'PAN_CARD',
    PASSPORT: 'PASSPORT',
    GUARANTOR_FORM: 'GUARANTOR_FORM',
    DEGREE_CERTIFICATE: 'DEGREE_CERTIFICATE',
    OTHER: 'OTHER',
};

const JOB_TYPE_LABELS = {
    OFFER_LETTER: 'Offer Letter',
    AADHAR_CARD: 'Aadhaar Card',
    PAN_CARD: 'Pan Card',
    PASSPORT: 'Passport',
    GUARANTOR_FORM: 'Guarantor Form',
    DEGREE_CERTIFICATE: 'Degree Certificate',
    OTHER: 'Other Document',
};

const resolveAadhaarNumber = (parsedInfo = {}) =>
    String(parsedInfo.aadhaarNumber || parsedInfo.aadharNumber || '').trim();

/** Pull the main ID / reference number from job-details additionalInfo */
export function extractDocumentNumber(documentType, parsedInfo = {}) {
    if (!parsedInfo || typeof parsedInfo !== 'object') return '';
    switch (documentType) {
        case 'PAN_CARD':
            return String(parsedInfo.panNumber || '').trim();
        case 'AADHAR_CARD':
            return resolveAadhaarNumber(parsedInfo);
        case 'PASSPORT':
            return String(parsedInfo.passportNumber || '').trim().toUpperCase();
        case 'OFFER_LETTER':
            return String(parsedInfo.effectiveDate || '').trim();
        case 'GUARANTOR_FORM':
            return String(parsedInfo.guarantorName || parsedInfo.guarantorContact || '').trim();
        case 'DEGREE_CERTIFICATE':
            return String(parsedInfo.marksheetLevel || parsedInfo.institution || parsedInfo.yearObtained || '').trim();
        default:
            return String(
                parsedInfo.panNumber ||
                parsedInfo.aadhaarNumber ||
                parsedInfo.aadharNumber ||
                parsedInfo.passportNumber ||
                parsedInfo.documentNumber ||
                ''
            ).trim();
    }
}

export function formatJobDocDescription(documentType, parsedInfo = {}) {
    if (!parsedInfo || typeof parsedInfo !== 'object' || !Object.keys(parsedInfo).length) return '';
    switch (documentType) {
        case 'PAN_CARD':
            return parsedInfo.panNumber ? `PAN Number: ${parsedInfo.panNumber}` : '';
        case 'AADHAR_CARD': {
            const aadhaarNumber = resolveAadhaarNumber(parsedInfo);
            return aadhaarNumber ? `Aadhaar Number: ${aadhaarNumber}` : '';
        }
        case 'PASSPORT':
            return parsedInfo.passportNumber
                ? `Passport Number: ${String(parsedInfo.passportNumber).trim().toUpperCase()}`
                : '';
        case 'OFFER_LETTER':
            return parsedInfo.effectiveDate ? `Effective Date: ${parsedInfo.effectiveDate}` : '';
        case 'GUARANTOR_FORM': {
            const parts = [];
            if (parsedInfo.guarantorName) parts.push(`Name: ${parsedInfo.guarantorName}`);
            if (parsedInfo.guarantorContact) parts.push(`Contact: ${parsedInfo.guarantorContact}`);
            return parts.join(' · ');
        }
        case 'DEGREE_CERTIFICATE': {
            if (parsedInfo.marksheetLevel) return `Level: ${parsedInfo.marksheetLevel}`;
            const parts = [];
            if (parsedInfo.institution) parts.push(parsedInfo.institution);
            if (parsedInfo.yearObtained) parts.push(parsedInfo.yearObtained);
            return parts.join(' · ');
        }
        default:
            return Object.entries(parsedInfo)
                .filter(([, v]) => v != null && String(v).trim() !== '')
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ');
    }
}

const DOCUMENT_CATEGORIES = ['Employee', 'Company', 'Policy', 'Contract', 'Certificate',
    'Training', 'Compliance', 'Financial', 'Legal', 'Other'];

export function mimeToDocumentTypeEnum(mime) {
    if (!mime) return 'Other';
    if (mime === 'application/pdf') return 'PDF';
    if (mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'Word';
    if (mime.startsWith('image/')) return 'Image';
    return 'Other';
}

function matchesMarksheetLevel(doc, marksheetLevel) {
    const level = doc?.metadata?.additionalInfo?.marksheetLevel;
    return String(level || '').trim() === String(marksheetLevel || '').trim();
}

export async function deactivatePreviousJobDocumentsExcept(organizationId, employeeId, documentType, keepId, parsedInfo = {}) {
    const candidateFilter = {
        organizationId,
        uploadedBy: employeeId,
        category: 'Employee',
        employeeJobDocumentType: documentType,
        isActive: true,
        _id: { $ne: keepId },
    };

    const marksheetLevel = documentType === 'DEGREE_CERTIFICATE'
        ? String(parsedInfo?.marksheetLevel || '').trim()
        : '';

    if (documentType === 'DEGREE_CERTIFICATE' && marksheetLevel) {
        const candidates = await Document.find(candidateFilter).lean();
        const idsToDeactivate = candidates
            .filter((doc) => matchesMarksheetLevel(doc, marksheetLevel))
            .map((doc) => doc._id);

        if (idsToDeactivate.length > 0) {
            await Document.updateMany(
                { _id: { $in: idsToDeactivate } },
                { $set: { isActive: false } },
                { timestamps: false }
            );
        }
        return idsToDeactivate.length;
    }

    const result = await Document.updateMany(
        candidateFilter,
        { $set: { isActive: false } },
        { timestamps: false }
    );
    return result?.modifiedCount || 0;
}

/**
 * Upload document buffer to S3 and create a Document record.
 */
export async function createEmployeeJobOrGenericDocument({ organizationId, employeeId, file, body = {} }) {
    const { documentType, additionalInfo, name, description, type: bodyType, category: bodyCategory } = body;

    let parsedInfo = {};
    if (additionalInfo) {
        try {
            parsedInfo = typeof additionalInfo === 'string' ? JSON.parse(additionalInfo) : additionalInfo;
        } catch {
            throw new Error('Invalid JSON in additionalInfo field');
        }
    }

    if (!file?.buffer?.length) {
        throw new Error('Uploaded file buffer is empty. Please try uploading again.');
    }

    // Build S3 key and upload
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const safeBase = (file.originalname || 'document')
        .replace(ext, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 60);
    const filename = `${safeBase}-${timestamp}-${random}${ext}`;
    const s3Key = buildDocumentS3Key(organizationId, filename, employeeId);

    const s3Url = await uploadFile(file.buffer, s3Key, file.mimetype, false);

    const isJobType = documentType && Object.values(JOB_DOCUMENT_TYPES).includes(documentType);

    if (isJobType) {
        const documentNumber = extractDocumentNumber(documentType, parsedInfo);
        const readableDescription = formatJobDocDescription(documentType, parsedInfo);
        const docName = documentType === 'DEGREE_CERTIFICATE' && parsedInfo.marksheetLevel
            ? `Marksheet - ${parsedInfo.marksheetLevel}`
            : (JOB_TYPE_LABELS[documentType] || documentType);

        const doc = new Document({
            organizationId,
            uploadedBy: employeeId,
            name: docName,
            description: readableDescription,
            category: 'Employee',
            type: mimeToDocumentTypeEnum(file.mimetype),
            fileUrl: s3Url,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            relatedTo: 'Employee',
            relatedId: employeeId,
            relatedToModel: 'Employee',
            requiresApproval: true,
            approvalStatus: 'Pending',
            accessLevel: 'Private',
            isActive: true,
            employeeJobDocumentType: documentType,
            tags: [documentType, ...(documentNumber ? [documentNumber] : [])],
            metadata: {
                documentNumber: documentNumber || undefined,
                additionalInfo: Object.keys(parsedInfo).length ? parsedInfo : undefined,
            },
        });
        await doc.save();

        const catalogKey = body.catalogKey || JOB_TYPE_TO_CATALOG[documentType];
        applyHubMetadataToDocument(doc, { catalogKey, orgCatalogEntry: getCatalogDocument(catalogKey) });
        if (catalogKey) await doc.save();

        const replacedCount = await deactivatePreviousJobDocumentsExcept(
            organizationId, employeeId, documentType, doc._id, parsedInfo
        );
        if (replacedCount > 0) {
            doc.metadata = {
                ...(doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {}),
                isReupload: true,
                reuploadedAt: new Date(),
            };
            await doc.save();
        }
        return doc;
    }

    const docName = (name && String(name).trim()) || (file.originalname || 'Uploaded document');
    const docCategory = (bodyCategory && DOCUMENT_CATEGORIES.includes(bodyCategory)) ? bodyCategory : 'Employee';
    const docTypeEnum = (bodyType && ['PDF', 'Word', 'Excel', 'Image', 'Video', 'Other'].includes(bodyType))
        ? bodyType
        : mimeToDocumentTypeEnum(file.mimetype);

    const doc = new Document({
        organizationId,
        uploadedBy: employeeId,
        name: docName,
        description: description != null ? String(description) : '',
        category: docCategory,
        type: docTypeEnum,
        fileUrl: s3Url,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        relatedTo: 'Employee',
        relatedId: employeeId,
        relatedToModel: 'Employee',
        requiresApproval: true,
        approvalStatus: 'Pending',
        accessLevel: 'Private',
        isActive: true,
    });
    applyHubMetadataToDocument(doc, {
        catalogKey: body.catalogKey,
        orgCatalogEntry: body.catalogKey ? getCatalogDocument(body.catalogKey) : null,
        workflowAssignment: body.workflowAssignment ? JSON.parse(body.workflowAssignment) : undefined,
    });
    await doc.save();
    return doc;
}

export async function mergeLegacyAndCanonicalEmployeeDocuments(employee) {
    if (!employee || !employee._id || !employee.organizationId) return employee;

    const canonical = await Document.find({
        organizationId: employee.organizationId,
        uploadedBy: employee._id,
        employeeJobDocumentType: { $exists: true, $ne: null },
        isActive: true,
    }).sort({ createdAt: -1 }).lean();

    const canonicalRows = canonical.map((d) => ({
        _id: d._id,
        documentType: d.employeeJobDocumentType,
        fileName: d.fileName,
        uploadedAt: d.createdAt,
        filePath: d.fileUrl,
        mimeType: d.mimeType,
        status: d.approvalStatus,
        originalName: d.fileName,
        fileSize: d.fileSize,
        size: d.fileSize,
        description: d.description,
        metadata: d.metadata,
        documentNumber: d.metadata?.documentNumber || '',
    }));

    const legacy = (employee.documents || []).map((d) => (d && typeof d.toObject === 'function' ? d.toObject() : { ...d }));

    const byType = new Map();
    for (const l of legacy) {
        if (l && l.documentType) byType.set(l.documentType, { ...l, _source: 'legacy' });
    }
    for (const c of canonicalRows) {
        if (c.documentType) byType.set(c.documentType, { ...c, _source: 'canonical' });
    }

    employee.documents = Array.from(byType.values()).sort(
        (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
    );
    return employee;
}
