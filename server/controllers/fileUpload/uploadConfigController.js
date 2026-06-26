import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import logger from '../../helpers/logger.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import Employee from '../../models/employee.model.js';
import { Document } from '../../models/document.model.js';
import {
    createEmployeeJobOrGenericDocument,
    JOB_DOCUMENT_TYPES,
} from '../../helpers/employeeDocumentUploadHelper.js';
import { DOCUMENTS_UPLOAD_DIR } from '../../helpers/documentFilePathHelper.js';
import {
    ensureDocumentsUploadDirs,
    resolveDocumentFileContent,
    sendDocumentFile,
} from '../../helpers/documentFileStorageHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store under server/uploads/documents (also mirrored in MongoDB fileBinary)
const UPLOADS_DOCUMENTS_DIR = DOCUMENTS_UPLOAD_DIR;
ensureDocumentsUploadDirs();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DOCUMENTS_DIR)) {
      fs.mkdirSync(UPLOADS_DOCUMENTS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DOCUMENTS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for multer
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, and Word documents are allowed.'), false);
  }
};

// Configure multer upload
export const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('document');

// Legacy route: forwards to canonical Document collection (same as POST /both/documents/upload)
export const addDocument = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { documentType } = req.body;

        if (!documentType || !req.file) {
            return res.status(400).json({
                message: 'Document type and file are required',
            });
        }

        if (!Object.values(JOB_DOCUMENT_TYPES).includes(documentType)) {
            return res.status(400).json({
                message: 'Invalid document type',
                allowedTypes: Object.values(JOB_DOCUMENT_TYPES),
            });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            try {
                if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            } catch {
                /* ignore */
            }
            return res.status(400).json({ message: 'Organization ID is required' });
        }

        if (!employeeId) {
            try {
                if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            } catch {
                /* ignore */
            }
            return res.status(401).json({ message: 'Employee authentication required' });
        }

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
        logger.error('Error adding document', { error: error.message, stack: error.stack });

        if (req.file?.path) {
            try {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            } catch (err) {
                logger.error('Error deleting uploaded file', { error: err.message, filePath: req.file?.path });
            }
        }

        const status = error.message?.includes('Invalid JSON') ? 400 : 500;
        res.status(status).json({
            message: error.message || 'Failed to upload document',
            ...(error.errors && { detailedErrors: error.errors }),
        });
    }
};

// HR-only download of employee document files
export const downloadDocument = async (req, res) => {
    try {
        const { employeeId, documentId } = req.params;
        const inline = req.query.inline === '1' || req.query.inline === 'true';

        const employee = await Employee.findById(employeeId).select('organizationId documents');
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const requesterOrgId = getOrganizationId(req);
        if (
            requesterOrgId &&
            employee.organizationId &&
            employee.organizationId.toString() !== requesterOrgId.toString()
        ) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        let fileUrl;
        let downloadName;
        let mimeType = null;
        let document = null;
        let legacyDoc = null;

        const embedded = employee.documents?.id?.(documentId);
        if (embedded) {
            legacyDoc = {
                fileUrl: embedded.filePath,
                fileName: embedded.originalName || embedded.fileName || 'document',
            };
            fileUrl = legacyDoc.fileUrl;
            downloadName = legacyDoc.fileName;
        } else {
            const canonQuery = {
                _id: documentId,
                uploadedBy: employeeId,
            };
            if (employee.organizationId) {
                canonQuery.organizationId = employee.organizationId;
            }
            document = await Document.findOne(canonQuery).lean();
            if (!document) {
                return res.status(404).json({ message: 'Document not found' });
            }
            fileUrl = document.fileUrl;
            downloadName = document.fileName || path.basename(document.fileUrl || '');
            mimeType = document.mimeType || null;
        }

        if (!fileUrl) {
            return res.status(404).json({ message: 'File path not found for document' });
        }

        if (!mimeType && downloadName?.toLowerCase().endsWith('.pdf')) {
            mimeType = 'application/pdf';
        }

        const loadBinary = (id) => Document.findById(id).select('+fileBinary').lean();
        const resolved = await resolveDocumentFileContent({
            document,
            legacyDoc,
            fileUrl,
            loadBinary,
        });

        if (!resolved) {
            return res.status(404).json({
                message: 'File not found',
                path: fileUrl,
            });
        }

        sendDocumentFile(res, {
            filePath: resolved.filePath,
            buffer: resolved.buffer,
            downloadName,
            mimeType,
            inline,
        });
    } catch (error) {
        logger.error('Error downloading document', {
            error: error.message,
            stack: error.stack,
            documentId: req.params.documentId,
        });
        res.status(500).json({
            message: 'Failed to download document',
            error: error.message,
        });
    }
};