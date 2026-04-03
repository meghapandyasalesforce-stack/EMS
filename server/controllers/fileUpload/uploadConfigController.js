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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store under server/uploads/documents so static middleware (server/uploads) can serve /uploads/documents/...
const UPLOADS_DOCUMENTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'documents');

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

// Admin or HR downloads employee document (same org as requester)
export const downloadDocument = async (req, res) => {
    try {
        const { employeeId, documentId } = req.params;

        const isAdmin = req.user?.role === 'admin';
        const isHr = !!req.employee?._id;
        if (!isAdmin && !isHr) {
            return res.status(403).json({ message: 'Access denied. Admin or HR only.' });
        }

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

        const embedded = employee.documents?.id?.(documentId);
        if (embedded) {
            fileUrl = embedded.filePath;
            downloadName = embedded.originalName || embedded.fileName || path.basename(embedded.filePath || '');
        } else {
            const canonQuery = {
                _id: documentId,
                uploadedBy: employeeId,
            };
            if (employee.organizationId) {
                canonQuery.organizationId = employee.organizationId;
            }
            const canon = await Document.findOne(canonQuery).lean();
            if (!canon) {
                return res.status(404).json({ message: 'Document not found' });
            }
            fileUrl = canon.fileUrl;
            downloadName = canon.fileName || path.basename(canon.fileUrl || '');
        }

        if (!fileUrl) {
            return res.status(404).json({ message: 'File path not found for document' });
        }

        const basename = path.basename(fileUrl);
        let filePath = path.join(__dirname, '..', '..', 'uploads', 'documents', basename);
        if (!fs.existsSync(filePath)) {
            const legacyPath = path.join(process.cwd(), 'public', fileUrl);
            if (fs.existsSync(legacyPath)) filePath = legacyPath;
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on server', path: fileUrl });
        }
        res.download(filePath, downloadName, (err) => {
            if (err) {
                logger.error('Error downloading file', { error: err.message, stack: err.stack, filePath });
                res.status(500).json({ message: 'Error downloading file' });
            }
        });

    } catch (error) {
        logger.error('Error downloading document', { error: error.message, stack: error.stack, documentId: req.params.documentId });
        res.status(500).json({ 
            message: 'Failed to download document',
            error: error.message
        });
    }
};