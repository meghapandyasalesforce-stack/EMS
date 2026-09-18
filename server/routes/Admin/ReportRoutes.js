import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createReport,
    getReports,
    getReportById,
    regenerateReport,
    updateReport,
    deleteReport
} from '../../controllers/report/reportController.js';
import { exportReportPDF } from '../../controllers/admin/pdfExportController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import { exportLimiter } from '../../middlewares/endpointRateLimiters.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ANALYTICS));

// All report routes require admin authentication
router.post('/', isAdminAuthenticated, createReport);
router.get('/', isAdminAuthenticated, getReports);
router.get('/:id', isAdminAuthenticated, getReportById);
router.post('/:id/regenerate', isAdminAuthenticated, regenerateReport);
router.put('/:id', isAdminAuthenticated, updateReport);
router.delete('/:id', isAdminAuthenticated, deleteReport);

// PDF Export route
router.post('/export-pdf', isAdminAuthenticated, exportLimiter, exportReportPDF);

export default router;

