import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createSalaryStructure,
    getAllSalaryStructures,
    getSalaryStructureById,
    updateSalaryStructure,
    deleteSalaryStructure,
    applySalaryStructure,
    calculateEmployeeSalary,
    generatePayrollWithStructure,
    getApplicableStructures
} from '../../controllers/admin/salaryStructureController.js';
import { composeMiddleware, requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PAYROLL));

const readSalaryStructure = composeMiddleware(
    requireAnyPermission([
        PERMISSIONS.PAYROLL_VIEW_ALL,
        PERMISSIONS.PAYROLL_CREATE,
        PERMISSIONS.PAYROLL_EDIT,
    ])
);

const manageSalaryStructure = composeMiddleware(
    requireAnyPermission([
        PERMISSIONS.PAYROLL_CREATE,
        PERMISSIONS.PAYROLL_EDIT,
    ])
);

// Static paths must come before /:id to avoid being swallowed by the param route
router.route('/apply')
    .post(manageSalaryStructure, applySalaryStructure);

router.route('/generate-payroll')
    .post(manageSalaryStructure, generatePayrollWithStructure);

router.route('/applicable/:employeeId')
    .get(readSalaryStructure, getApplicableStructures);

router.route('/calculate/:structureId/:employeeId')
    .get(readSalaryStructure, calculateEmployeeSalary);

router.route('/')
    .post(manageSalaryStructure, createSalaryStructure)
    .get(readSalaryStructure, getAllSalaryStructures);

router.route('/:id')
    .get(readSalaryStructure, getSalaryStructureById)
    .put(manageSalaryStructure, updateSalaryStructure)
    .delete(manageSalaryStructure, deleteSalaryStructure);

export default router;
