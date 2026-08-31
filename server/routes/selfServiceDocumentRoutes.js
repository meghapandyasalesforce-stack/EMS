import express from 'express';
import {
  previewDocument,
  generateDocument,
  downloadDocument,
  listMyGeneratedDocuments,
  deleteSelfServiceDocument,
} from '../controllers/selfServiceDocumentController.js';

const router = express.Router();

// All routes require authentication (applied at mount-point via isAuthenticatedBoth)
// Controller enforces employee ownership and template access checks

router.post('/preview', previewDocument);
router.post('/generate', generateDocument);
router.get('/download/:documentId', downloadDocument);
router.get('/my-documents', listMyGeneratedDocuments);
router.delete('/delete/:documentId', deleteSelfServiceDocument);

export default router;
