import multer from 'multer';
import logger from '../../helpers/logger.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import Employee from '../../models/employee.model.js';
import { Document } from '../../models/document.model.js';
import {
    createEmployeeJobOrGenericDocument,
    JOB_DOCUMENT_TYPES,
} from '../../helpers/employeeDocumentUploadHelper.js';
import { resolveDocumentSignedUrl } from '../../helpers/documentFileStorageHelper.js';

export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and Word documents are allowed.'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
}).single('document');

export const addDocument = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { documentType } = req.body;

        if (!documentType || !req.file) {
            return res.status(400).json({ message: 'Document type and file are required' });
        }

        if (!Object.values(JOB_DOCUMENT_TYPES).includes(documentType)) {
            return res.status(400).json({
                message: 'Invalid document type',
                allowedTypes: Object.values(JOB_DOCUMENT_TYPES),
            });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) return res.status(400).json({ message: 'Organization ID is required' });
        if (!employeeId) return res.status(401).json({ message: 'Employee authentication required' });

        const document = await createEmployeeJobOrGenericDocument({
            organizationId,
            employeeId,
            file: req.file,
            body: req.body,
        });

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully. Pending HR approval.',
            data: document,
        });
    } catch (error) {
        logger.error('Error adding document', { error: error.message });
        const status = error.message?.includes('Invalid JSON') ? 400 : 500;
        res.status(status).json({ message: error.message || 'Failed to upload document' });
    }
};

export const downloadDocument = async (req, res) => {
    try {
        const { employeeId, documentId } = req.params;

        const employee = await Employee.findById(employeeId).select('organizationId documents');
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const requesterOrgId = getOrganizationId(req);
        if (requesterOrgId && employee.organizationId &&
            employee.organizationId.toString() !== requesterOrgId.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        // Try canonical Document collection first
        const document = await Document.findOne({
            _id: documentId,
            uploadedBy: employeeId,
            ...(employee.organizationId && { organizationId: employee.organizationId }),
        }).lean();

        const fileUrl = document?.fileUrl;
        if (!fileUrl) return res.status(404).json({ message: 'Document not found' });

        const signedUrl = await resolveDocumentSignedUrl(fileUrl);
        if (!signedUrl) return res.status(404).json({ message: 'File not available' });

        return res.redirect(302, signedUrl);
    } catch (error) {
        logger.error('Error downloading document', { error: error.message, documentId: req.params.documentId });
        res.status(500).json({ message: 'Failed to download document', error: error.message });
    }
};
