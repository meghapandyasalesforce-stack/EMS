import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';

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

// Employee uploads document 
export const addDocument = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { documentType, additionalInfo } = req.body;

        // Validate required fields
        if (!documentType || !req.file) {
            return res.status(400).json({ 
                message: 'Document type and file are required' 
            });
        }

        // Define allowed document types with their specific validations
        const ALLOWED_DOCUMENT_TYPES = {
            OFFER_LETTER: 'OFFER_LETTER',
            BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
            GUARANTOR_FORM: 'GUARANTOR_FORM',
            DEGREE_CERTIFICATE: 'DEGREE_CERTIFICATE',
            OTHER: 'OTHER'
        };

        // Validate document type
        if (!Object.values(ALLOWED_DOCUMENT_TYPES).includes(documentType)) {
            return res.status(400).json({
                message: 'Invalid document type',
                allowedTypes: Object.values(ALLOWED_DOCUMENT_TYPES)
            });
        }

        // Parse additionalInfo safely
        let parsedInfo = {};
        if (additionalInfo) {
            try {
                parsedInfo = JSON.parse(additionalInfo);
            } catch (error) {
                return res.status(400).json({ 
                    message: 'Invalid JSON in additionalInfo field' 
                });
            }
        }

        // Construct document metadata (fileName/size match employee schema for display)
        const newDocument = {
            documentType,
            filePath: `/uploads/documents/${req.file.filename}`,
            fileName: req.file.originalname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date(),
            status: 'PENDING_REVIEW',
            additionalInfo: parsedInfo
        };

        // Load employee so we can replace any existing document(s) of this type
        const employee = await Employee.findById(employeeId).select('documents');
        if (!employee) {
            // Clean up uploaded file if employee is missing
            try {
                if (req.file?.path && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            } catch (cleanupErr) {
                logger.error('Error deleting uploaded file for missing employee', {
                    error: cleanupErr.message,
                    filePath: req.file?.path
                });
            }
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Delete any existing files for this documentType on disk
        const existingOfType = (employee.documents || []).filter(doc => doc.documentType === documentType);
        for (const doc of existingOfType) {
            if (!doc?.filePath) continue;
            const basename = path.basename(doc.filePath);
            const currentPath = path.join(__dirname, '..', '..', 'uploads', 'documents', basename);
            const legacyPath = path.join(process.cwd(), 'public', doc.filePath);
            try {
                if (fs.existsSync(currentPath)) {
                    fs.unlinkSync(currentPath);
                } else if (fs.existsSync(legacyPath)) {
                    fs.unlinkSync(legacyPath);
                }
            } catch (unlinkErr) {
                logger.warn('Failed to delete old document file', {
                    error: unlinkErr.message,
                    filePath: doc.filePath
                });
            }
        }

        // Replace documents of this type in the array, keeping others intact
        employee.documents = (employee.documents || []).filter(doc => doc.documentType !== documentType);
        employee.documents.push(newDocument);
        // Sort newest first to match previous behaviour
        employee.documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        const updatedEmployee = await employee.save();

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: newDocument,
            documents: updatedEmployee.documents
        });

    } catch (error) {
        logger.error('Error adding document', { error: error.message, stack: error.stack, employeeId: req.params.employeeId });
        
        // Clean up uploaded file if error occurred
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                logger.error('Error deleting uploaded file', { error: err.message, stack: err.stack, filePath: req.file?.path });
            }
        }

        res.status(500).json({ 
            message: 'Failed to upload document',
            error: error.message,
            ...(error.errors && { detailedErrors: error.errors })
        });
    }
};

// Admin downloads document
export const downloadDocument = async (req, res) => {
    try {
        const { employeeId, documentId } = req.params;

        // Check if requester is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const document = employee.documents.id(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Resolve path: prefer server/uploads/documents (new), fallback to public/uploads/documents (legacy)
        const basename = path.basename(document.filePath);
        let filePath = path.join(__dirname, '..', '..', 'uploads', 'documents', basename);
        if (!fs.existsSync(filePath)) {
            const legacyPath = path.join(process.cwd(), 'public', document.filePath);
            if (fs.existsSync(legacyPath)) filePath = legacyPath;
        }
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on server', path: document.filePath });
        }

        const downloadName = document.originalName || document.fileName || path.basename(document.filePath);
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