import fs from 'fs';
import path from 'path';
import { Document, DocumentRequest } from '../../models/document.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { createEmployeeJobOrGenericDocument, mimeToDocumentTypeEnum } from '../../helpers/employeeDocumentUploadHelper.js';
import { isHrStaffEmployee, loadRequesterHrStaff } from '../../helpers/functionalRolesHelper.js';
import { resolveDocumentFilePath, relativeDocumentFileUrl } from '../../helpers/documentFilePathHelper.js';
import {
    requireUploadFileBuffer,
    resolveDocumentFileContent,
    sendDocumentFile,
    backfillDocumentBinaryFromDisk,
    persistDocumentBinary,
} from '../../helpers/documentFileStorageHelper.js';

const DOCUMENT_CATEGORIES = ['Employee', 'Company', 'Policy', 'Contract', 'Certificate',
  'Training', 'Compliance', 'Financial', 'Legal', 'Other'];

const loadEmployeeDocumentContext = async (req) => {
    const isAdminUser =
        (req.user?.role || '').toLowerCase() === 'admin' ||
        (req.decoded?.role || '').toLowerCase() === 'admin';

    if (!req.employee?._id) {
        if (isAdminUser) {
            return { isHr: true, employeeId: null, employee: null };
        }
        return { isHr: false, employeeId: null, employee: null };
    }

    const employee = await Employee.findById(req.employee._id)
        .select('department assignedRole functionalRoles position jobTitle')
        .populate('assignedRole', '_id')
        .lean();

    if (!employee) {
        if (isAdminUser) {
            return { isHr: true, employeeId: req.employee._id, employee: null };
        }
        return { isHr: false, employeeId: req.employee._id, employee: null };
    }

    return {
        isHr: isAdminUser || isHrStaffEmployee(employee),
        employeeId: req.employee._id,
        employee,
    };
};

const HR_POLICY_CATEGORIES = ['Policy', 'Company', 'Training', 'Compliance'];

/** Documents an employee may list and download (own uploads + HR/org shared). */
const buildEmployeeDocumentQuery = (employeeId, employee) => ({
    $or: [
        { uploadedBy: employeeId },
        {
            uploadedBy: { $ne: employeeId },
            requiresApproval: false,
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            uploadedBy: { $ne: employeeId },
            accessLevel: 'Public',
            approvalStatus: 'Approved',
            category: { $in: HR_POLICY_CATEGORIES },
        },
        {
            accessLevel: 'Department',
            allowedDepartments: { $in: [employee.department] },
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            accessLevel: 'Role',
            allowedRoles: employee.assignedRole?._id || { $exists: false },
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            accessLevel: 'Specific',
            allowedEmployees: employeeId,
            approvalStatus: { $in: ['Approved', null] },
        },
    ],
});

/** Employee can download own uploads (any status/active) + active shared org docs. */
const buildEmployeeDownloadQuery = (employeeId, employee) => ({
    $or: [
        { uploadedBy: employeeId },
        {
            uploadedBy: { $ne: employeeId },
            isActive: { $ne: false },
            requiresApproval: false,
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            uploadedBy: { $ne: employeeId },
            isActive: { $ne: false },
            accessLevel: 'Public',
            approvalStatus: 'Approved',
            category: { $in: HR_POLICY_CATEGORIES },
        },
        {
            isActive: { $ne: false },
            accessLevel: 'Department',
            allowedDepartments: { $in: [employee.department] },
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            isActive: { $ne: false },
            accessLevel: 'Role',
            allowedRoles: employee.assignedRole?._id || { $exists: false },
            approvalStatus: { $in: ['Approved', null] },
        },
        {
            isActive: { $ne: false },
            accessLevel: 'Specific',
            allowedEmployees: employeeId,
            approvalStatus: { $in: ['Approved', null] },
        },
    ],
});

const assertHrDocumentAccess = async (req, res) => {
    const ctx = await loadEmployeeDocumentContext(req);
    if (!ctx.isHr) {
        res.status(403).json({
            success: false,
            message: 'Only HR can access all employee documents',
            code: 'HR_ONLY',
        });
        return false;
    }
    return true;
};

const findOwnDocument = async (req, res, documentId) => {
    const employeeId = req.employee?._id;
    if (!employeeId) {
        res.status(401).json({
            success: false,
            message: 'Employee authentication required',
        });
        return null;
    }

    const document = await Document.findOne(
        addOrganizationFilter(req, {
            _id: documentId,
            uploadedBy: employeeId,
            isActive: { $ne: false },
        })
    );

    if (!document) {
        res.status(404).json({
            success: false,
            message: 'Document not found or you do not have access',
        });
        return null;
    }

    return document;
};

const EMPLOYEE_UPLOAD_CATEGORIES = ['Employee', 'Certificate', 'Contract', 'Legal', 'Other'];

async function findLegacyEmbeddedDocument(req, documentId, { employeeIdOnly = null } = {}) {
    const orgFilter = addOrganizationFilter(req, {});
    const query = {
        ...orgFilter,
        'documents._id': documentId,
    };
    if (employeeIdOnly) {
        query._id = employeeIdOnly;
    }

    const employee = await Employee.findOne(query)
        .select('name lastName email employeeId department documents')
        .lean();

    if (!employee) return null;

    const embedded = (employee.documents || []).find(
        (d) => d._id && String(d._id) === String(documentId)
    );
    if (!embedded) return null;

    return {
        fileUrl: embedded.filePath,
        fileName: embedded.fileName || embedded.originalName || 'document',
        mimeType: null,
        _legacyEmbedded: true,
        uploadedBy: employee,
    };
}

function assertUploadedFileExists(file, fileUrl) {
    const diskPath = file?.path || resolveDocumentFilePath(fileUrl);
    if (!diskPath || !fs.existsSync(diskPath)) {
        throw new Error('Uploaded file was not saved on the server. Please try uploading again.');
    }
    return diskPath;
}

async function loadLegacyEmployeeDocumentsForHr(req, { searchTrim, category }) {
    if (category && category !== 'Employee') return [];

    const orgFilter = addOrganizationFilter(req, {});
    const employees = await Employee.find({
        ...orgFilter,
        'documents.0': { $exists: true },
    })
        .select('name lastName email employeeId department documents')
        .lean();

    if (!employees.length) return [];

    const employeeIds = employees.map((e) => e._id);
    const canonicalJobDocs = await Document.find({
        ...orgFilter,
        uploadedBy: { $in: employeeIds },
        employeeJobDocumentType: { $exists: true, $ne: null },
        isActive: { $ne: false },
    })
        .select('uploadedBy employeeJobDocumentType')
        .lean();

    const canonicalKeys = new Set(
        canonicalJobDocs.map((d) => `${d.uploadedBy}_${d.employeeJobDocumentType}`)
    );

    const rows = [];
    for (const emp of employees) {
        for (const doc of emp.documents || []) {
            if (!doc?.filePath && !doc?.fileName) continue;
            const typeKey = doc.documentType ? `${emp._id}_${doc.documentType}` : null;
            if (typeKey && canonicalKeys.has(typeKey)) continue;

            const title = doc.fileName || doc.originalName || doc.documentType || 'Document';
            if (searchTrim && !title.toLowerCase().includes(searchTrim.toLowerCase())) continue;

            rows.push({
                _id: doc._id,
                _legacyEmbedded: true,
                name: title,
                fileName: doc.fileName || doc.originalName || 'document',
                fileUrl: doc.filePath,
                fileSize: doc.size || doc.fileSize || 0,
                category: 'Employee',
                type: 'Other',
                uploadedBy: emp,
                relatedId: emp,
                relatedTo: 'Employee',
                createdAt: doc.uploadedAt || new Date(0),
                updatedAt: doc.uploadedAt || new Date(0),
                approvalStatus: 'Approved',
                requiresApproval: false,
                isActive: true,
                version: 1,
                accessLevel: 'Private',
            });
        }
    }
    return rows;
}

async function loadDocumentBinary(documentId) {
    return Document.findById(documentId).select('+fileBinary').lean();
}

/**
 * Upload document (Admin/HR - auto-approved)
 */
export const uploadDocument = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const organizationId = getOrganizationId(req);
    const uploadedBy = req.employee?._id;

    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    if (!uploadedBy) {
        return res.status(401).json({
            success: false,
            message: 'HR employee profile required to upload documents'
        });
    }

    const name = (req.body.name && String(req.body.name).trim()) || file.originalname || 'Document';
    const category = req.body.category && DOCUMENT_CATEGORIES.includes(req.body.category)
        ? req.body.category
        : 'Company';
    const type = req.body.type && ['PDF', 'Word', 'Excel', 'Image', 'Video', 'Other'].includes(req.body.type)
        ? req.body.type
        : mimeToDocumentTypeEnum(file.mimetype);

    const relFileUrl = `/uploads/documents/${file.filename}`;
    assertUploadedFileExists(file, relFileUrl);
    const fileBinary = requireUploadFileBuffer(file);

    const accessLevel = req.body.accessLevel && ['Public', 'Department', 'Role', 'Specific', 'Private'].includes(req.body.accessLevel)
        ? req.body.accessLevel
        : 'Public';

    const document = new Document({
        name,
        description: req.body.description != null ? String(req.body.description) : '',
        category,
        type,
        organizationId,
        uploadedBy,
        fileUrl: relFileUrl,
        fileName: file.originalname || file.name || name,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileBinary,
        relatedTo: req.body.relatedTo && ['Employee', 'Department', 'Project', 'Policy', 'Course', 'General'].includes(req.body.relatedTo)
            ? req.body.relatedTo
            : 'General',
        accessLevel,
        requiresApproval: false,
        approvalStatus: 'Approved',
        isActive: true
    });

    await document.save();
    await persistDocumentBinary(document._id, fileBinary?.length ? fileBinary : file);

    res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
    });
});

/**
 * Employee uploads document (requires HR approval)
 */
export const uploadEmployeeDocument = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const uploadedBy = req.employee?._id;

    if (!uploadedBy) {
        return res.status(401).json({
            success: false,
            message: 'Employee authentication required'
        });
    }

    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    try {
        const document = await createEmployeeJobOrGenericDocument({
            organizationId,
            employeeId: uploadedBy,
            file,
            body: req.body,
        });

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully. Pending HR approval.',
            data: document
        });
    } catch (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch {
                /* ignore */
            }
        }
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to save document'
        });
    }
});

/**
 * Get documents with proper access control
 */
export const getDocuments = asyncHandler(async (req, res) => {
    const { category, relatedTo, relatedId, approvalStatus, page = 1, limit = 20, search, accessBuckets } = req.query;

    const query = addOrganizationFilter(req, {});

    const docCtx = await loadEmployeeDocumentContext(req);

    if (docCtx.isHr) {
        // HR staff — all employee documents
        if (approvalStatus) {
            query.approvalStatus = approvalStatus;
        }
    } else if (docCtx.employeeId && docCtx.employee) {
        // Employee — own docs + HR policies only
        query.$and = [buildEmployeeDocumentQuery(docCtx.employeeId, docCtx.employee)];
    } else {
        return res.status(403).json({
            success: false,
            message: 'Only HR can view all employee documents',
            code: 'HR_ONLY',
        });
    }

    if (category) query.category = category;
    if (relatedTo) query.relatedTo = relatedTo;
    if (relatedId) query.relatedId = relatedId;

    // Employees: hide inactive unless HR. HR sees everything (pending, approved, rejected, superseded).
    if (!docCtx.isHr) {
        if (!approvalStatus || approvalStatus !== 'Pending') {
            query.isActive = { $ne: false };
        }
    }

    const searchTrim = typeof search === 'string' ? search.trim() : '';
    if (searchTrim) {
        const escaped = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.name = { $regex: escaped, $options: 'i' };
    }

    if (accessBuckets != null && String(accessBuckets).length) {
        const buckets = String(accessBuckets).split(',').map((s) => s.trim()).filter(Boolean);
        const bucketConditions = [];
        if (buckets.includes('public')) bucketConditions.push({ accessLevel: 'Public' });
        if (buckets.includes('confidential')) bucketConditions.push({ accessLevel: 'Private' });
        if (buckets.includes('restricted')) {
            bucketConditions.push({ accessLevel: { $in: ['Department', 'Role', 'Specific'] } });
        }
        if (bucketConditions.length > 0) {
            const bucketFilter = bucketConditions.length === 1
                ? bucketConditions[0]
                : { $or: bucketConditions };
            query.$and = Array.isArray(query.$and) ? [...query.$and, bucketFilter] : [bucketFilter];
        }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const skip = (pageNum - 1) * limitNum;

    let documents;
    let total;

    if (docCtx.isHr) {
        const documentsFromDb = await Document.find(query)
            .populate('uploadedBy', 'name lastName email employeeId department')
            .populate({
                path: 'relatedId',
                select: 'name lastName email employeeId department',
            })
            .populate('approvedBy', 'name email')
            .populate('allowedEmployees', 'name email employeeId')
            .populate('allowedRoles', 'name')
            .sort({ createdAt: -1 })
            .lean();

        const legacyRows = await loadLegacyEmployeeDocumentsForHr(req, {
            searchTrim,
            category,
        });

        const combined = [...documentsFromDb, ...legacyRows].sort(
            (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );

        total = combined.length;
        documents = combined.slice(skip, skip + limitNum);
    } else {
        documents = await Document.find(query)
            .populate('uploadedBy', 'name lastName email employeeId department')
            .populate({
                path: 'relatedId',
                select: 'name lastName email employeeId department',
            })
            .populate('approvedBy', 'name email')
            .populate('allowedEmployees', 'name email employeeId')
            .populate('allowedRoles', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        total = await Document.countDocuments(query);
    }

    res.json({
        success: true,
        data: documents,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum) || 0
        }
    });
});

/**
 * Download a document file (authenticated — avoids direct /uploads URLs that nginx may not proxy).
 */
export const downloadDocumentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const docCtx = await loadEmployeeDocumentContext(req);
    const isHr = docCtx.isHr || (await loadRequesterHrStaff(req));
    const versionParam = req.query.version != null ? parseInt(String(req.query.version), 10) : null;
    const inline = req.query.inline === '1' || req.query.inline === 'true';

    const baseQuery = addOrganizationFilter(req, { _id: id });

    let document;
    let legacyDoc = null;

    if (isHr) {
        document = await Document.findOne(baseQuery).lean();
        if (!document) {
            document = await Document.findOne({ _id: id }).lean();
            if (
                document?.organizationId &&
                organizationId &&
                String(document.organizationId) !== String(organizationId)
            ) {
                document = null;
            }
        }
        if (!document) {
            legacyDoc = await findLegacyEmbeddedDocument(req, id);
        }
    } else if (docCtx.employeeId && docCtx.employee) {
        document = await Document.findOne({
            ...baseQuery,
            ...buildEmployeeDownloadQuery(docCtx.employeeId, docCtx.employee),
        }).lean();
        if (!document) {
            legacyDoc = await findLegacyEmbeddedDocument(req, id, {
                employeeIdOnly: docCtx.employeeId,
            });
        }
    } else {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to download this document',
            code: 'FORBIDDEN',
        });
    }

    if (!document && !legacyDoc) {
        return res.status(404).json({
            success: false,
            message: 'Document not found',
        });
    }

    let fileUrl = document?.fileUrl || legacyDoc?.fileUrl;
    let downloadName = document?.fileName || legacyDoc?.fileName || 'document';
    let mimeType = document?.mimeType || legacyDoc?.mimeType || null;

    if (document && versionParam != null && !Number.isNaN(versionParam)) {
        if (versionParam === document.version) {
            fileUrl = document.fileUrl;
            downloadName = document.fileName || downloadName;
        } else {
            const previous = (document.previousVersions || []).find((v) => v.version === versionParam);
            if (!previous) {
                return res.status(404).json({
                    success: false,
                    message: 'Document version not found',
                });
            }
            fileUrl = previous.fileUrl;
            downloadName = previous.fileName || downloadName;
        }
    }

    if (!mimeType && downloadName?.toLowerCase().endsWith('.pdf')) {
        mimeType = 'application/pdf';
    }
    if (!mimeType && fileUrl?.toLowerCase().includes('.pdf')) {
        mimeType = 'application/pdf';
    }

    const resolved = await resolveDocumentFileContent({
        document,
        legacyDoc,
        fileUrl,
        loadBinary: loadDocumentBinary,
    });

    let fileBuffer = resolved?.buffer;
    if (!fileBuffer?.length && document?._id && fileUrl) {
        fileBuffer = await backfillDocumentBinaryFromDisk(document._id, fileUrl);
    }
    if (!fileBuffer?.length && document?._id && fileUrl) {
        fileBuffer = await persistDocumentBinary(document._id, fileUrl);
    }

    if (!resolved && !fileBuffer) {
        logger.warn('Document file missing on disk', {
            documentId: id,
            fileUrl,
            organizationId,
            version: versionParam,
            legacy: !!legacyDoc,
        });
        return res.status(404).json({
            success: false,
            message: 'File not found',
            fileUrl,
        });
    }

    if (resolved?.filePath && document?._id) {
        fs.readFile(resolved.filePath, (err, buf) => {
            if (!err && buf?.length) {
                Document.findByIdAndUpdate(document._id, { fileBinary: buf }).catch(() => {});
            }
        });
    }

    downloadName = downloadName || path.basename(fileUrl || resolved?.filePath || 'document');
    sendDocumentFile(res, {
        filePath: resolved?.filePath,
        buffer: fileBuffer || resolved?.buffer,
        downloadName,
        mimeType,
        inline,
    });
});

/**
 * Request document
 */
export const requestDocument = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const requestedBy = req.employee?._id || req.user?._id;

    const documentRequest = new DocumentRequest({
        ...req.body,
        organizationId,
        requestedBy
    });

    await documentRequest.save();

    res.status(201).json({
        success: true,
        message: 'Document request created successfully',
        data: documentRequest
    });
});

/**
 * Get document requests
 */
export const getDocumentRequests = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { requestedBy, status, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    if (requestedBy) query.requestedBy = requestedBy;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await DocumentRequest.find(query)
        .populate('requestedBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('document')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await DocumentRequest.countDocuments(query);

    res.json({
        success: true,
        data: requests,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Approve document (HR only)
 */
export const approveDocument = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const approvedBy = req.user?._id || req.employee?._id;

    const document = await Document.findOne({
        _id: id,
        organizationId
    });

    if (!document) {
        return res.status(404).json({
            success: false,
            message: 'Document not found'
        });
    }

    document.approvalStatus = 'Approved';
    document.approvedBy = approvedBy;
    document.approvedAt = new Date();
    document.isActive = true;

    await document.save();

    res.json({
        success: true,
        message: 'Document approved successfully',
        data: document
    });
});

/**
 * Reject document (HR only)
 */
export const rejectDocument = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { rejectionReason } = req.body;
    const rejectedBy = req.user?._id || req.employee?._id;

    const document = await Document.findOne({
        _id: id,
        organizationId
    });

    if (!document) {
        return res.status(404).json({
            success: false,
            message: 'Document not found'
        });
    }

    document.approvalStatus = 'Rejected';
    document.approvedBy = rejectedBy;
    document.approvedAt = new Date();
    document.rejectionReason = rejectionReason;
    document.isActive = false;

    await document.save();

    res.json({
        success: true,
        message: 'Document rejected successfully',
        data: document
    });
});

/**
 * Get documents pending approval
 */
export const getPendingDocuments = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const organizationId = getOrganizationId(req);
    const { page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {
        approvalStatus: 'Pending',
        requiresApproval: true,
        isActive: { $ne: false },
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
        .populate('uploadedBy', 'name lastName email employeeId department')
        .populate({
            path: 'relatedId',
            select: 'name lastName email employeeId department',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
        success: true,
        data: documents,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Upload new version of document
 */
export const uploadDocumentVersion = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const uploadedBy = req.user?._id || req.employee?._id;

    const document = await Document.findOne({
        _id: id,
        organizationId
    });

    if (!document) {
        return res.status(404).json({
            success: false,
            message: 'Document not found'
        });
    }

    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    // Save current version to previousVersions
    if (!document.previousVersions) {
        document.previousVersions = [];
    }

    document.previousVersions.push({
        fileUrl: document.fileUrl,
        fileName: document.fileName,
        version: document.version,
        uploadedAt: document.updatedAt || document.createdAt,
        uploadedBy: document.uploadedBy
    });

    // Update document with new version
    document.fileUrl = relativeDocumentFileUrl(file.filename);
    document.fileName = file.originalname || file.name;
    document.fileSize = file.size;
    document.mimeType = file.mimetype;
    document.fileBinary = requireUploadFileBuffer(file);
    document.version = (document.version || 1) + 1;
    document.uploadedBy = uploadedBy;

    await document.save();

    res.json({
        success: true,
        message: 'Document version uploaded successfully',
        data: document
    });
});

/**
 * Get document version history
 */
export const getDocumentVersions = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const document = await Document.findOne({
        _id: id,
        organizationId
    }).populate('uploadedBy', 'name lastName email')
      .populate('previousVersions.uploadedBy', 'name lastName email');

    if (!document) {
        return res.status(404).json({
            success: false,
            message: 'Document not found'
        });
    }

    const versions = [
        {
            version: document.version,
            fileUrl: document.fileUrl,
            fileName: document.fileName,
            uploadedAt: document.updatedAt || document.createdAt,
            uploadedBy: document.uploadedBy,
            isCurrent: true
        },
        ...(document.previousVersions || []).map(v => ({
            ...v,
            isCurrent: false
        }))
    ].sort((a, b) => b.version - a.version);

    res.json({
        success: true,
        data: {
            document: {
                _id: document._id,
                name: document.name,
                description: document.description
            },
            versions
        }
    });
});

/**
 * Share document with employees, departments, or roles
 */
export const shareDocument = asyncHandler(async (req, res) => {
    if (!(await assertHrDocumentAccess(req, res))) return;

    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { 
        accessLevel, 
        allowedEmployees, 
        allowedDepartments, 
        allowedRoles 
    } = req.body;

    // Validate access level
    const validAccessLevels = ['Public', 'Department', 'Role', 'Specific', 'Private'];
    if (accessLevel && !validAccessLevels.includes(accessLevel)) {
        return res.status(400).json({
            success: false,
            message: `Invalid access level. Must be one of: ${validAccessLevels.join(', ')}`
        });
    }

    const document = await Document.findOne({
        _id: id,
        organizationId
    });

    if (!document) {
        return res.status(404).json({
            success: false,
            message: 'Document not found'
        });
    }

    // HR-only route (middleware + assertHrDocumentAccess)
    const userId = req.user?._id || req.employee?._id;
    const isUploader = document.uploadedBy?.toString() === userId?.toString();

    if (!isUploader) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to share this document'
        });
    }

    // Validate employees exist and belong to same organization
    if (allowedEmployees && Array.isArray(allowedEmployees)) {
        const employees = await Employee.find({
            _id: { $in: allowedEmployees },
            organizationId
        }).select('_id').lean();

        if (employees.length !== allowedEmployees.length) {
            return res.status(400).json({
                success: false,
                message: 'Some employee IDs are invalid or do not belong to this organization'
            });
        }
    }

    // Update document sharing settings
    if (accessLevel) {
        document.accessLevel = accessLevel;
    }

    if (allowedEmployees !== undefined) {
        document.allowedEmployees = Array.isArray(allowedEmployees) ? allowedEmployees : [];
    }

    if (allowedDepartments !== undefined) {
        document.allowedDepartments = Array.isArray(allowedDepartments) ? allowedDepartments : [];
    }

    if (allowedRoles !== undefined) {
        document.allowedRoles = Array.isArray(allowedRoles) ? allowedRoles : [];
    }

    await document.save();

    // Populate for response
    await document.populate('allowedEmployees', 'name email employeeId');
    await document.populate('allowedRoles', 'name');

    logger.info('Document shared', {
        documentId: id,
        accessLevel: document.accessLevel,
        organizationId
    });

    res.json({
        success: true,
        message: 'Document sharing settings updated successfully',
        data: document
    });
});

/**
 * Get shared documents for current employee
 */
export const getSharedDocuments = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const employeeId = req.employee?._id;

    if (!employeeId) {
        return res.status(401).json({
            success: false,
            message: 'Employee authentication required'
        });
    }

    const { category, page = 1, limit = 20 } = req.query;

    // Get employee details
    const employee = await Employee.findById(employeeId)
        .select('department assignedRole functionalRoles')
        .populate('assignedRole', '_id')
        .lean();

    if (!employee) {
        return res.status(404).json({
            success: false,
            message: 'Employee not found'
        });
    }

    // Build query for shared documents (excluding own documents)
    const query = {
        organizationId,
        isActive: true,
        approvalStatus: { $in: ['Approved', null] },
        uploadedBy: { $ne: employeeId },
        $or: [
            { requiresApproval: false, approvalStatus: { $in: ['Approved', null] } },
            { accessLevel: 'Public' },
            {
                accessLevel: 'Department',
                allowedDepartments: { $in: [employee.department] },
            },
            {
                accessLevel: 'Role',
                allowedRoles: employee.assignedRole?._id || { $exists: false },
            },
            {
                accessLevel: 'Specific',
                allowedEmployees: employeeId,
            },
        ],
    };

    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
        .populate('uploadedBy', 'name lastName email employeeId department')
        .populate('allowedEmployees', 'name email employeeId')
        .populate('allowedRoles', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
        success: true,
        data: documents,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Employee — list only documents uploaded by the current user.
 */
export const getMyDocuments = asyncHandler(async (req, res) => {
    const employeeId = req.employee?._id;
    if (!employeeId) {
        return res.status(401).json({
            success: false,
            message: 'Employee authentication required',
        });
    }

    const { page = 1, limit = 50, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Include Rejected (isActive false) so profile Job Details can show reason + re-upload
    const query = addOrganizationFilter(req, {
        uploadedBy: employeeId,
        $or: [
            { isActive: { $ne: false } },
            { approvalStatus: 'Rejected' },
        ],
    });

    const searchTrim = typeof search === 'string' ? search.trim() : '';
    if (searchTrim) {
        query.$or = [
            { name: { $regex: searchTrim, $options: 'i' } },
            { fileName: { $regex: searchTrim, $options: 'i' } },
            { description: { $regex: searchTrim, $options: 'i' } },
        ];
    }

    const documents = await Document.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const total = await Document.countDocuments(query);

    res.json({
        success: true,
        data: documents,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum) || 0,
        },
    });
});

/**
 * Employee — update own document metadata (name, description, category).
 */
export const updateMyDocument = asyncHandler(async (req, res) => {
    const document = await findOwnDocument(req, res, req.params.id);
    if (!document) return;

    const { name, description, category } = req.body;

    if (name != null && String(name).trim()) {
        document.name = String(name).trim();
    }
    if (description !== undefined) {
        document.description = String(description);
    }
    if (category && EMPLOYEE_UPLOAD_CATEGORIES.includes(category)) {
        document.category = category;
    }

    await document.save();

    res.json({
        success: true,
        message: 'Document updated successfully',
        data: document,
    });
});

/**
 * Employee — replace file on an own document (re-submits for HR approval when required).
 */
export const replaceMyDocumentFile = asyncHandler(async (req, res) => {
    const document = await findOwnDocument(req, res, req.params.id);
    if (!document) return;

    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded',
        });
    }

    const relFileUrl = `/uploads/documents/${file.filename}`;
    assertUploadedFileExists(file, relFileUrl);
    const fileBinary = requireUploadFileBuffer(file);

    document.fileUrl = relFileUrl;
    document.fileName = file.originalname || file.name || document.fileName;
    document.fileSize = file.size;
    document.mimeType = file.mimetype;
    document.type = mimeToDocumentTypeEnum(file.mimetype);

    if (document.requiresApproval) {
        document.approvalStatus = 'Pending';
        document.approvedBy = undefined;
        document.approvedAt = undefined;
        document.rejectionReason = undefined;
    }

    await document.save();
    await persistDocumentBinary(document._id, fileBinary);

    res.json({
        success: true,
        message: document.requiresApproval
            ? 'Document updated and sent for HR approval'
            : 'Document file updated successfully',
        data: document,
    });
});

/**
 * Employee — soft-delete own document (hidden from employee; HR audit trail retained).
 */
export const deleteMyDocument = asyncHandler(async (req, res) => {
    const document = await findOwnDocument(req, res, req.params.id);
    if (!document) return;

    document.isActive = false;
    if (document.requiresApproval) {
        document.approvalStatus = 'Withdrawn';
        document.rejectionReason = 'Removed by employee';
    }
    await document.save();

    res.json({
        success: true,
        message: 'Document deleted successfully',
    });
});

