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

// Create salary structure
router.route('/')
    .post(isAdminAuthenticated, createSalaryStructure);

// Get all salary structures
router.route('/')
    .get(isAdminAuthenticated, getAllSalaryStructures);

// Get salary structure by ID
router.route('/:id')
    .get(isAdminAuthenticated, getSalaryStructureById);

// Update salary structure
router.route('/:id')
    .put(isAdminAuthenticated, updateSalaryStructure);

// Delete salary structure
router.route('/:id')
    .delete(isAdminAuthenticated, deleteSalaryStructure);

// Apply salary structure to employee
router.route('/apply')
    .post(isAdminAuthenticated, applySalaryStructure);

// Calculate salary for employee using structure
router.route('/calculate/:structureId/:employeeId')
    .get(isAdminAuthenticated, calculateEmployeeSalary);

// Generate payroll using salary structure
router.route('/generate-payroll')
    .post(isAdminAuthenticated, generatePayrollWithStructure);

// Get applicable salary structures for employee
router.route('/applicable/:employeeId')
    .get(isAdminAuthenticated, getApplicableStructures);

export default router;
