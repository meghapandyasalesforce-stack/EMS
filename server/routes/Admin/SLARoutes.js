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
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

// SLA management
router.route('/')
    .post(isAdminAuthenticated, createSLA)
    .get(isAdminOrHROrExecutiveAuthenticated, getAllSLAs);

router.route('/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getSLAById)
    .put(isAdminAuthenticated, updateSLA)
    .delete(isAdminAuthenticated, deleteSLA);

// Violations
router.route('/violations')
    .get(isAdminOrHROrExecutiveAuthenticated, getSLAViolations);

// Track entities
router.route('/track')
    .post(isAdminOrHROrExecutiveAuthenticated, trackEntityForSLA);

router.route('/violations/:id/responded')
    .post(isAdminOrHROrExecutiveAuthenticated, markEntityResponded);

router.route('/violations/:id/resolved')
    .post(isAdminOrHROrExecutiveAuthenticated, markEntityResolved);

export default router;

