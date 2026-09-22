import express from 'express';
import { requireFeature } from '../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../constants/saasFeatures.js';
import multer from 'multer';
import {
  createEmployeeDocumentRequest,
  listMyEmployeeDocumentRequests,
  listApprovalEmployeeDocumentRequests,
  approveEmployeeDocumentRequest,
  rejectEmployeeDocumentRequest,
  uploadEmployeeDocumentRequestFile,
  generateEmployeeDocument,
  downloadEmployeeDocumentRequestFile,
  markEmployeeDocumentRequestComplete,
  deleteEmployeeDocumentRequest,
} from '../controllers/employeeDocumentRequestController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.DOCUMENTS));

router.post('/request', createEmployeeDocumentRequest);
router.get('/my', listMyEmployeeDocumentRequests);
router.get('/approvals', listApprovalEmployeeDocumentRequests);
router.patch('/:id/approve', approveEmployeeDocumentRequest);
router.patch('/:id/reject', rejectEmployeeDocumentRequest);
router.post('/:id/upload', upload.single('document'), uploadEmployeeDocumentRequestFile);
router.patch('/:id/complete', markEmployeeDocumentRequestComplete);
router.get('/:id/download', downloadEmployeeDocumentRequestFile);
router.delete('/:id', deleteEmployeeDocumentRequest);
router.post('/generate', generateEmployeeDocument);

export default router;
