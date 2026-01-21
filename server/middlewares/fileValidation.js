import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { validateFileContentSync } from '../helpers/fileContentValidator.js';
import logger from '../helpers/logger.js';

// Get absolute path to uploads directory for path traversal prevention
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_ROOT = path.resolve(__dirname, '../uploads');

// Configure allowed file types
const ALLOWED_FILE_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    any: ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf']
};

// Configure maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    any: 10 * 1024 * 1024 // 10MB
};

// Validate file type
export const validateFileType = (allowedTypes, file, res) => {
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file provided'
        });
    }

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
            receivedType: file.mimetype
        });
    }

    // Additional security: Validate file extension matches MIME type
    const allowedExtensions = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/webp': ['.webp'],
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    };

    const expectedExtensions = allowedExtensions[file.mimetype];
    if (expectedExtensions) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (!expectedExtensions.includes(fileExtension)) {
            return res.status(400).json({
                success: false,
                message: `File extension does not match MIME type. Expected: ${expectedExtensions.join(', ')}, received: ${fileExtension}`,
                code: 'MIME_MISMATCH'
            });
        }
    }

    return true;
};

// Validate file size
export const validateFileSize = (maxSize, file, res) => {
    if (!file) {
        return res.status(400).json({
            success: false,
            message: 'No file provided'
        });
    }

    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
            success: false,
            message: `File too large. Maximum size: ${maxSizeMB}MB`,
            fileSize: (file.size / (1024 * 1024)).toFixed(2)
        });
    }

    return true;
};

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadType = req.params.type || 'general';
        
        // SECURITY: Prevent path traversal attacks by using path.resolve() and validating
        // Sanitize uploadType to prevent directory traversal
        const sanitizedType = path.basename(uploadType).replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Build the target path using path.resolve() for absolute path
        const targetPath = path.resolve(UPLOADS_ROOT, sanitizedType);
        
        // CRITICAL: Ensure resolved path is within UPLOADS_ROOT directory
        // This prevents directory traversal attacks (e.g., ../../../etc/passwd)
        if (!targetPath.startsWith(UPLOADS_ROOT)) {
            logger.error('Path traversal attempt detected', {
                uploadType,
                sanitizedType,
                targetPath,
                uploadsRoot: UPLOADS_ROOT
            });
            return cb(new Error('Invalid upload path: directory traversal detected'));
        }
        
        // Create directory if it doesn't exist (synchronously to avoid race conditions)
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
            // Set directory permissions (readable/writable by owner only)
            fs.chmodSync(targetPath, 0o700);
        }
        
        cb(null, targetPath);
    },
    filename: (req, file, cb) => {
        // Use cryptographically secure random bytes instead of Math.random()
        const randomBytes = crypto.randomBytes(8).toString('hex');
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        
        // Sanitize filename to prevent directory traversal and special characters
        const sanitizedName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 50); // Limit length
        
        // Use secure filename: timestamp-random-sanitizedname.extension
        cb(null, `${timestamp}-${randomBytes}-${sanitizedName}${ext}`);
    }
});

// File filter function with enhanced validation
const fileFilter = (allowedTypes) => {
    return (req, file, cb) => {
        // Check if file has a name
        if (!file.originalname || file.originalname.trim().length === 0) {
            return cb(new Error('File name is required'));
        }

        // SECURITY: Prevent directory traversal attacks
        // Use path.basename() to normalize and extract only the filename
        const filename = path.basename(file.originalname);
        
        // Additional validation: check for directory traversal patterns
        if (filename.includes('..') || 
            filename.includes('/') || 
            filename.includes('\\') ||
            path.isAbsolute(filename) ||
            filename.startsWith('.') && filename !== '.' && filename !== '..') {
            logger.warn('Directory traversal attempt detected in filename', {
                originalName: file.originalname,
                sanitizedName: filename
            });
            return cb(new Error('Invalid file name: directory traversal not allowed'));
        }
        
        // Ensure filename is not empty after sanitization
        if (!filename || filename.trim().length === 0) {
            return cb(new Error('File name is required'));
        }

        // Check MIME type
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
        }

        // Check file extension matches MIME type (basic validation)
        const ext = path.extname(file.originalname).toLowerCase();
        const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.jsp', '.asp', '.aspx'];
        if (suspiciousExtensions.includes(ext)) {
            return cb(new Error('File type not allowed for security reasons'));
        }

        cb(null, true);
    };
};

// Post-upload validation middleware (validates file content after upload)
export const validateUploadedFileContent = (allowedMimeType) => {
    return (req, res, next) => {
        if (!req.file) {
            return next(); // No file to validate
        }

        const filePath = req.file.path;
        
        // SECURITY: Validate that file path is within UPLOADS_ROOT directory
        // This is a final check to prevent any path traversal that might have bypassed earlier checks
        const resolvedFilePath = path.resolve(filePath);
        if (!resolvedFilePath.startsWith(UPLOADS_ROOT)) {
            logger.error('Path traversal detected in uploaded file path', {
                filePath,
                resolvedFilePath,
                uploadsRoot: UPLOADS_ROOT
            });
            
            // Attempt to delete the file if it exists outside uploads directory
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                logger.error('Failed to delete invalid file outside uploads directory', { 
                    filePath, 
                    error: error.message 
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'Invalid file path detected',
                code: 'FILE_PATH_INVALID'
            });
        }
        
        const expectedMimeType = allowedMimeType || req.file.mimetype;

        // Validate file content using magic numbers
        const validation = validateFileContentSync(filePath, expectedMimeType);
        
        if (!validation.valid) {
            // Delete the uploaded file if validation fails
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                logger.error('Failed to delete invalid file', { filePath, error: error.message });
            }

            return res.status(400).json({
                success: false,
                message: validation.error || 'File content validation failed',
                code: 'FILE_CONTENT_INVALID'
            });
        }

        next();
    };
};

// Create upload middleware
export const createUploadMiddleware = (type = 'any', single = true) => {
    const allowedTypes = ALLOWED_FILE_TYPES[type] || ALLOWED_FILE_TYPES.any;
    const maxSize = MAX_FILE_SIZES[type] || MAX_FILE_SIZES.any;

    const upload = multer({
        storage,
        limits: {
            fileSize: maxSize
        },
        fileFilter: fileFilter(allowedTypes)
    });

    return single ? upload.single('file') : upload.array('files', 5);
};

// Profile photo upload middleware
export const uploadProfilePhoto = createUploadMiddleware('image', true);

// Document upload middleware
export const uploadDocument = createUploadMiddleware('document', true);

// Multiple files upload middleware
export const uploadMultiple = createUploadMiddleware('any', false);

// Generic upload middleware
export const uploadFile = createUploadMiddleware('any', true);

export default {
    uploadProfilePhoto,
    uploadDocument,
    uploadMultiple,
    uploadFile,
    validateFileType,
    validateFileSize,
    validateUploadedFileContent
};
