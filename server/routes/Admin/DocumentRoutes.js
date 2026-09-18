import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    uploadDocument,
    approveDocument,
    rejectDocument,
    getPendingDocuments,
    uploadDocumentVersion,
    getDocumentVersions,
    shareDocument,
    downloadDocumentById,
    deleteDocumentByHr,
} from '../../controllers/document/documentController.js';
import { requireHrDocumentAccess } from '../../middlewares/requirePermission.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { upload } from '../../controllers/fileUpload/uploadConfigController.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.DOCUMENTS));

// Upload Document (multipart field name: "document")
router.route('/upload')
    .post(
        requireHrDocumentAccess,
        (req, res, next) => {
            upload(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, message: err.message });
                }
                next();
            });
        },
        writeLimiter,
        uploadDocument
    );

// Get pending documents for approval
router.route('/pending')
    .get(requireHrDocumentAccess, readLimiter, getPendingDocuments);

// HR download (preview / save) — same handler as /both/documents/:id/download
router.route('/:id/download')
    .get(requireHrDocumentAccess, readLimiter, downloadDocumentById);

// Approve/Reject documents
router.route('/:id/approve')
    .post(requireHrDocumentAccess, writeLimiter, approveDocument);

router.route('/:id/reject')
    .post(requireHrDocumentAccess, writeLimiter, rejectDocument);

// Delete document (HR/Admin)
router.route('/:id')
    .delete(requireHrDocumentAccess, writeLimiter, deleteDocumentByHr);

// Share document
router.route('/:id/share')
    .post(requireHrDocumentAccess, writeLimiter, shareDocument);

// Document version control
router.route('/:id/versions')
    .get(requireHrDocumentAccess, readLimiter, getDocumentVersions)
    .post(
        requireHrDocumentAccess,
        (req, res, next) => {
            upload(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, message: err.message });
                }
                next();
            });
        },
        writeLimiter,
        uploadDocumentVersion
    );

export default router;

