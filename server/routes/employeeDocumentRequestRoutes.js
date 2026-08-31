import express from 'express';
import multer from 'multer';
import path from 'path';
import { DOCUMENTS_UPLOAD_DIR } from '../helpers/documentFilePathHelper.js';
import { ensureDocumentsUploadDirs } from '../helpers/documentFileStorageHelper.js';
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

ensureDocumentsUploadDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DOCUMENTS_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `employee-doc-request-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

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
