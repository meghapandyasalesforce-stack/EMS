import express from 'express';
import {
    createSLA,
    getAllSLAs,
    getSLAById,
    updateSLA,
    deleteSLA,
    getSLAViolations,
    trackEntityForSLA,
    markEntityResponded,
    markEntityResolved
} from '../../controllers/admin/slaController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';

const router = express.Router();

// SLA management
router.route('/')
    .post(isAdminAuthenticated, createSLA)
    .get(isAdminOrHRAuthenticated, getAllSLAs);

router.route('/:id')
    .get(isAdminOrHRAuthenticated, getSLAById)
    .put(isAdminAuthenticated, updateSLA)
    .delete(isAdminAuthenticated, deleteSLA);

// Violations
router.route('/violations')
    .get(isAdminOrHRAuthenticated, getSLAViolations);

// Track entities
router.route('/track')
    .post(isAdminOrHRAuthenticated, trackEntityForSLA);

router.route('/violations/:id/responded')
    .post(isAdminOrHRAuthenticated, markEntityResponded);

router.route('/violations/:id/resolved')
    .post(isAdminOrHRAuthenticated, markEntityResolved);

export default router;

