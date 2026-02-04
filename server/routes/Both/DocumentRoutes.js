import express from 'express';
import {
    getDocuments,
    requestDocument,
    getDocumentRequests,
    uploadEmployeeDocument,
    getSharedDocuments,
    shareDocument
} from '../../controllers/document/documentController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { upload } from '../../controllers/fileUpload/uploadConfigController.js';

const router = express.Router();

// Documents (route is already mounted at /api/v1/both/documents, so use / here)
router.route('/')
    .get(isAuthenticatedBoth, readLimiter, getDocuments);

// Get shared documents (for employees)
router.route('/shared')
    .get(isAuthenticated, readLimiter, getSharedDocuments);

// Employee uploads document (requires approval)
router.route('/upload')
    .post(isAuthenticated, (req, res, next) => {
        upload(req, res, (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next();
        });
    }, writeLimiter, uploadEmployeeDocument);

// Share document (employees can share their own documents)
router.route('/:id/share')
    .post(isAuthenticated, writeLimiter, shareDocument);

// Document Requests
router.route('/document-requests')
    .post(isAuthenticatedBoth, writeLimiter, requestDocument)
    .get(isAuthenticatedBoth, readLimiter, getDocumentRequests);

export default router;

