import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document } from '../models/document.model.js';
import { persistDocumentBinary, requireUploadFileBuffer } from './documentFileStorageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DOCUMENTS_DIR = path.join(__dirname, '..', 'uploads', 'documents');

export const JOB_DOCUMENT_TYPES = {
    OFFER_LETTER: 'OFFER_LETTER',
    BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
    GUARANTOR_FORM: 'GUARANTOR_FORM',
    DEGREE_CERTIFICATE: 'DEGREE_CERTIFICATE',
    OTHER: 'OTHER',
};

const JOB_TYPE_LABELS = {
    OFFER_LETTER: 'Offer Letter',
    BIRTH_CERTIFICATE: 'Birth Certificate',
    GUARANTOR_FORM: 'Guarantor Form',
    DEGREE_CERTIFICATE: 'Degree Certificate',
    OTHER: 'Other Document',
};

const DOCUMENT_CATEGORIES = ['Employee', 'Company', 'Policy', 'Contract', 'Certificate',
    'Training', 'Compliance', 'Financial', 'Legal', 'Other'];

export function mimeToDocumentTypeEnum(mime) {
    if (!mime) return 'Other';
    if (mime === 'application/pdf') return 'PDF';
    if (mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return 'Word';
    }
    if (mime.startsWith('image/')) return 'Image';
    return 'Other';
}

function deleteFileIfExists(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return;
    const basename = path.basename(fileUrl);
    const currentPath = path.join(UPLOADS_DOCUMENTS_DIR, basename);
    try {
        if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
    } catch {
        /* ignore */
    }
}

/** Deactivate older rows of the same job-doc type and remove their files (caller must pass new doc _id to keep). */
export async function deactivatePreviousJobDocumentsExcept(organizationId, employeeId, documentType, keepId) {
    const olds = await Document.find({
        organizationId,
        uploadedBy: employeeId,
        category: 'Employee',
        employeeJobDocumentType: documentType,
        isActive: true,
        _id: { $ne: keepId },
    }).lean();

    await Document.updateMany(
        {
            organizationId,
            uploadedBy: employeeId,
            category: 'Employee',
            employeeJobDocumentType: documentType,
            _id: { $ne: keepId },
        },
        { $set: { isActive: false } }
    );
}

/**
 * Create and save a Document from employee multipart upload (job-details or generic).
 * Uses canonical Document collection (SaaS-ready single source of truth).
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

    const relFileUrl = `/uploads/documents/${file.filename}`;

    if (!file.path || !fs.existsSync(file.path)) {
        throw new Error('Uploaded file was not saved on the server. Please try uploading again.');
    }

    const isJobType = documentType && Object.values(JOB_DOCUMENT_TYPES).includes(documentType);

    const fileBinary = requireUploadFileBuffer(file);

    if (isJobType) {
        const doc = new Document({
            organizationId,
            uploadedBy: employeeId,
            name: JOB_TYPE_LABELS[documentType] || documentType,
            description: Object.keys(parsedInfo).length ? JSON.stringify(parsedInfo) : '',
            category: 'Employee',
            type: mimeToDocumentTypeEnum(file.mimetype),
            fileUrl: relFileUrl,
            fileName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            fileBinary,
            relatedTo: 'Employee',
            relatedId: employeeId,
            relatedToModel: 'Employee',
            requiresApproval: true,
            approvalStatus: 'Pending',
            accessLevel: 'Private',
            isActive: true,
            employeeJobDocumentType: documentType,
            tags: [documentType],
        });
        await doc.save();
        await deactivatePreviousJobDocumentsExcept(organizationId, employeeId, documentType, doc._id);
        await persistDocumentBinary(doc._id, fileBinary?.length ? fileBinary : file);
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
        fileUrl: relFileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileBinary,
        relatedTo: 'Employee',
        relatedId: employeeId,
        relatedToModel: 'Employee',
        requiresApproval: true,
        approvalStatus: 'Pending',
        accessLevel: 'Private',
        isActive: true,
    });
    await doc.save();
    await persistDocumentBinary(doc._id, fileBinary?.length ? fileBinary : file);
    return doc;
}

/**
 * Merge canonical Document records (job uploads) with legacy embedded employee.documents for API responses.
 */
export async function mergeLegacyAndCanonicalEmployeeDocuments(employee) {
    if (!employee || !employee._id || !employee.organizationId) {
        return employee;
    }

    const canonical = await Document.find({
        organizationId: employee.organizationId,
        uploadedBy: employee._id,
        employeeJobDocumentType: { $exists: true, $ne: null },
        isActive: true,
    })
        .sort({ createdAt: -1 })
        .lean();

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
    }));

    const legacy = (employee.documents || []).map((d) => (d && typeof d.toObject === 'function' ? d.toObject() : { ...d }));

    const byType = new Map();
    for (const l of legacy) {
        if (l && l.documentType) {
            byType.set(l.documentType, { ...l, _source: 'legacy' });
        }
    }
    for (const c of canonicalRows) {
        if (c.documentType) {
            byType.set(c.documentType, { ...c, _source: 'canonical' });
        }
    }

    employee.documents = Array.from(byType.values()).sort(
        (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
    );
    return employee;
}
