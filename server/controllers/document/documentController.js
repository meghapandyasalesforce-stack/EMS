import fs from 'fs';
import { Document, DocumentRequest } from '../../models/document.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { createEmployeeJobOrGenericDocument, mimeToDocumentTypeEnum } from '../../helpers/employeeDocumentUploadHelper.js';
import { getEffectiveFunctionalRoles } from '../../middlewares/createAuthMiddleware.js';

const DOCUMENT_CATEGORIES = ['Employee', 'Company', 'Policy', 'Contract', 'Certificate',
  'Training', 'Compliance', 'Financial', 'Legal', 'Other'];

/**
 * Upload document (Admin/HR - auto-approved)
 */
export const uploadDocument = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const uploadedBy = req.employee?._id || req.user?._id;

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
            message: 'Authentication required'
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
        relatedTo: req.body.relatedTo && ['Employee', 'Department', 'Project', 'Policy', 'Course', 'General'].includes(req.body.relatedTo)
            ? req.body.relatedTo
            : 'General',
        accessLevel,
        requiresApproval: false,
        approvalStatus: 'Approved',
        isActive: true
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
    const { category, relatedTo, relatedId, approvalStatus, page = 1, limit = 20 } = req.query;

    const query = addOrganizationFilter(req, {});

    // Platform admin: org-wide. Employee JWT: restricted unless HR (same visibility as /admin/documents/pending).
    const isPlatformAdmin = !!req.user?._id;

    if (isPlatformAdmin) {
        if (approvalStatus) {
            query.approvalStatus = approvalStatus;
        }
    } else if (req.employee?._id) {
        const employeeId = req.employee._id;

        const employee = await Employee.findById(employeeId)
            .select('department assignedRole functionalRoles position jobTitle')
            .populate('assignedRole', '_id')
            .lean();

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        const isHR = getEffectiveFunctionalRoles(employee).includes('hr');

        if (isHR) {
            if (approvalStatus) {
                query.approvalStatus = approvalStatus;
            }
        } else {
            const accessQuery = {
                $or: [
                    { uploadedBy: employeeId },
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

            query.$and = [
                {
                    $or: [
                        { approvalStatus: 'Approved' },
                        { approvalStatus: { $exists: false } },
                        { uploadedBy: employeeId },
                    ],
                },
                accessQuery,
            ];
        }
    } else {
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

/**
 * Share document with employees, departments, or roles
 */
export const shareDocument = asyncHandler(async (req, res) => {
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

    // Check if user has permission to share (must be uploader or admin/HR)
    const userId = req.user?._id || req.employee?._id;
    const isUploader = document.uploadedBy?.toString() === userId?.toString();
    const isAdmin = req.user?._id && req.user.role === 'admin';

    if (!isUploader && !isAdmin) {
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
        uploadedBy: { $ne: employeeId }, // Exclude own documents
        $or: [
            // Public documents
            { accessLevel: 'Public' },
            // Department-specific documents
            {
                accessLevel: 'Department',
                allowedDepartments: { $in: [employee.department] }
            },
            // Role-specific documents
            {
                accessLevel: 'Role',
                allowedRoles: employee.assignedRole?._id || { $exists: false }
            },
            // Specific employee documents
            {
                accessLevel: 'Specific',
                allowedEmployees: employeeId
            }
        ]
    };

    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
        .populate('uploadedBy', 'name email employeeId department')
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

