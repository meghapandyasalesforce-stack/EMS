import express from 'express';
import multer from 'multer';
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  listTemplates,
  deleteTemplate,
  listAvailableTemplates,
  getTemplateForEmployee,
  getAvailableCountries,
  uploadStamp,
  removeStamp,
  getStamp,
} from '../controllers/documentTemplateController.js';

// Multer memory storage for stamp uploads (stored in DB as binary)
const stampUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPG, and SVG images are allowed'), false);
  },
});

const router = express.Router();

// ─── Admin/HR: Template Management ───────────────────────────────────────────
router.post('/', createTemplate);
router.get('/admin/list', listTemplates);
router.get('/admin/:id', getTemplateById);
router.put('/admin/:id', updateTemplate);
router.delete('/admin/:id', deleteTemplate);

// Stamp management
router.post('/admin/:id/stamp', stampUpload.single('stamp'), uploadStamp);
router.get('/admin/:id/stamp', getStamp);
router.delete('/admin/:id/stamp', removeStamp);

// ─── Employee: Self-Service Access ───────────────────────────────────────────
router.get('/available', listAvailableTemplates);
router.get('/countries', getAvailableCountries);
router.get('/employee/:id', getTemplateForEmployee);

export default router;
