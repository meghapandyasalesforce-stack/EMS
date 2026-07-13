import express from 'express';
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
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Static paths must come before /:id to avoid being swallowed by the param route
router.route('/apply')
    .post(isAdminAuthenticated, applySalaryStructure);

router.route('/generate-payroll')
    .post(isAdminAuthenticated, generatePayrollWithStructure);

router.route('/applicable/:employeeId')
    .get(isAdminAuthenticated, getApplicableStructures);

router.route('/calculate/:structureId/:employeeId')
    .get(isAdminAuthenticated, calculateEmployeeSalary);

router.route('/')
    .post(isAdminAuthenticated, createSalaryStructure)
    .get(isAdminAuthenticated, getAllSalaryStructures);

router.route('/:id')
    .get(isAdminAuthenticated, getSalaryStructureById)
    .put(isAdminAuthenticated, updateSalaryStructure)
    .delete(isAdminAuthenticated, deleteSalaryStructure);

export default router;
