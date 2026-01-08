import { Document, DocumentRequest } from '../../models/document.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';

/**
 * Upload document (Admin/HR - auto-approved)
 */
export const uploadDocument = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const uploadedBy = req.user?._id || req.employee?._id;

    // File should be uploaded via multer middleware
    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    const document = new Document({
        ...req.body,
        organizationId,
        uploadedBy,
        fileUrl: file.path || file.location || file.url || `/uploads/${file.filename}`,
        fileName: file.originalname || file.name,
        fileSize: file.size,
        mimeType: file.mimetype,
        requiresApproval: false, // Admin/HR uploads are auto-approved
        approvalStatus: 'Approved'
    });

    await document.save();

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

    // File should be uploaded via multer middleware
    const file = req.file || req.files?.[0];
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    const document = new Document({
        ...req.body,
        organizationId,
        uploadedBy,
        fileUrl: file.path || file.location || file.url || `/uploads/${file.filename}`,
        fileName: file.originalname || file.name,
        fileSize: file.size,
        mimeType: file.mimetype,
        category: req.body.category || 'Employee',
        relatedTo: 'Employee',
        relatedId: uploadedBy,
        requiresApproval: true, // Employee uploads require approval
        approvalStatus: 'Pending',
        accessLevel: 'Private'
    });

    await document.save();

    res.status(201).json({
        success: true,
        message: 'Document uploaded successfully. Pending HR approval.',
        data: document
    });
});

/**
 * Get documents
 */
export const getDocuments = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { category, relatedTo, relatedId, approvalStatus, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    // For employees, only show approved documents or their own pending documents
    if (req.employee?._id && !req.user?._id) {
        query.$or = [
            { approvalStatus: 'Approved' },
            { approvalStatus: { $exists: false } },
            { uploadedBy: req.employee._id }
        ];
    } else {
        // For HR/Admin, show all documents
        if (approvalStatus) {
            query.approvalStatus = approvalStatus;
        }
    }

    if (category) query.category = category;
    if (relatedTo) query.relatedTo = relatedTo;
    if (relatedId) query.relatedId = relatedId;

    // Only show active documents (unless HR is viewing pending)
    if (!approvalStatus || approvalStatus !== 'Pending') {
        query.isActive = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
        .populate('uploadedBy', 'name email employeeId department')
        .populate('approvedBy', 'name email')
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
    const organizationId = getOrganizationId(req);
    const { page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {
        approvalStatus: 'Pending',
        requiresApproval: true
    });

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
        .populate('uploadedBy', 'name email employeeId department')
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
    document.fileUrl = file.path || file.location || file.url || `/uploads/${file.filename}`;
    document.fileName = file.originalname || file.name;
    document.fileSize = file.size;
    document.mimeType = file.mimetype;
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
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const document = await Document.findOne({
        _id: id,
        organizationId
    }).populate('uploadedBy', 'name email')
      .populate('previousVersions.uploadedBy', 'name email');

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

