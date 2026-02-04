import express from 'express';
import {
    uploadDocument,
    approveDocument,
    rejectDocument,
    getPendingDocuments,
    uploadDocumentVersion,
    getDocumentVersions,
    shareDocument
} from '../../controllers/document/documentController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
// Upload middleware - adjust path based on your setup
// import upload from '../../middlewares/upload.js';

const router = express.Router();

// Upload Document
router.route('/upload')
    .post(isAdminOrHRAuthenticated, writeLimiter, uploadDocument);

// Get pending documents for approval
router.route('/pending')
    .get(isAdminOrHRAuthenticated, readLimiter, getPendingDocuments);

// Approve/Reject documents
router.route('/:id/approve')
    .post(isAdminOrHRAuthenticated, writeLimiter, approveDocument);

router.route('/:id/reject')
    .post(isAdminOrHRAuthenticated, writeLimiter, rejectDocument);

// Share document
router.route('/:id/share')
    .post(isAdminOrHRAuthenticated, writeLimiter, shareDocument);

// Document version control
router.route('/:id/versions')
    .get(isAdminOrHRAuthenticated, readLimiter, getDocumentVersions)
    .post(isAdminOrHRAuthenticated, writeLimiter, uploadDocumentVersion);

export default router;

