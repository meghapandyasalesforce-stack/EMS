import express from 'express';
import {
    createReport,
    getReports,
    getReportById,
    regenerateReport,
    updateReport,
    deleteReport
} from '../../controllers/report/reportController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// All report routes require admin authentication
router.post('/', isAdminAuthenticated, createReport);
router.get('/', isAdminAuthenticated, getReports);
router.get('/:id', isAdminAuthenticated, getReportById);
router.post('/:id/regenerate', isAdminAuthenticated, regenerateReport);
router.put('/:id', isAdminAuthenticated, updateReport);
router.delete('/:id', isAdminAuthenticated, deleteReport);

export default router;

