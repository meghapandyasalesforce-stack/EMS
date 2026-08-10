import SalaryStructure from '../../models/salaryStructure.model.js';
import Employee from '../../models/employee.model.js';
import Payroll from '../../models/payroll.model.js';
import logger from '../../helpers/logger.js';
import { buildGeneratedPayrollPayload, clearPayrollGenerationCaches } from '../../helpers/payrollGenerationHelper.js';

const getReqOrganizationId = (req) => req.organizationId || req.user?.organizationId || req.employee?.organizationId;

// Create salary structure
export const createSalaryStructure = async (req, res) => {
    try {
        const {
            name, description, applicableTo, applicableValues,
            earnings, deductions, bonusStructure, overtimeRules
        } = req.body;
        const organizationId = getReqOrganizationId(req);

        // Check if structure with same name exists
        const existingStructure = await SalaryStructure.findOne({ name, organizationId });
        if (existingStructure) {
            return res.status(400).json({ message: 'Salary structure with this name already exists' });
        }

        const salaryStructure = new SalaryStructure({
            organizationId,
            name,
            description,
            applicableTo,
            applicableValues,
            earnings,
            deductions,
            bonusStructure,
            overtimeRules,
            createdBy: req.user._id
        });

        await salaryStructure.save();
        clearPayrollGenerationCaches({ organizationId });

        res.status(201).json({
            message: 'Salary structure created successfully',
            salaryStructure
        });
    } catch (error) {
        logger.error('Create salary structure error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to create salary structure', error: error.message });
    }
};

// Get all salary structures
export const getAllSalaryStructures = async (req, res) => {
    try {
        const { isActive } = req.query;
        const organizationId = getReqOrganizationId(req);
        const filter = { organizationId };

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const structures = await SalaryStructure.find(filter)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .sort({ createdAt: -1 });

        res.json(structures);
    } catch (error) {
        logger.error('Get salary structures error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to get salary structures', error: error.message });
    }
};

// Get salary structure by ID
export const getSalaryStructureById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getReqOrganizationId(req);

        const structure = await SalaryStructure.findOne({ _id: id, organizationId })
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        res.json(structure);
    } catch (error) {
        logger.error('Get salary structure error', { error: error.message, stack: error.stack, structureId: req.params.id });
        res.status(500).json({ message: 'Failed to get salary structure', error: error.message });
    }
};

// Update salary structure
export const updateSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const organizationId = getReqOrganizationId(req);

        const structure = await SalaryStructure.findOne({ _id: id, organizationId });
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if new name conflicts with existing structure
        if (updates.name && updates.name !== structure.name) {
            const existingStructure = await SalaryStructure.findOne({ 
                name: updates.name, 
                organizationId,
                _id: { $ne: id } 
            });
            if (existingStructure) {
                return res.status(400).json({ message: 'Salary structure with this name already exists' });
            }
        }

        updates.lastModifiedBy = req.user._id;
        const updatedStructure = await SalaryStructure.findOneAndUpdate({ _id: id, organizationId }, updates, { new: true })
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');
        clearPayrollGenerationCaches({ organizationId, structureId: id });

        res.json({
            message: 'Salary structure updated successfully',
            salaryStructure: updatedStructure
        });
    } catch (error) {
        logger.error('Update salary structure error', { error: error.message, stack: error.stack, structureId: req.params.id });
        res.status(500).json({ message: 'Failed to update salary structure', error: error.message });
    }
};

// Delete salary structure
export const deleteSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = getReqOrganizationId(req);

        const structure = await SalaryStructure.findOne({ _id: id, organizationId });
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if structure is being used by any employees
        const employeesUsingStructure = await Employee.countDocuments({
            salaryStructure: id,
            organizationId
        });

        if (employeesUsingStructure > 0) {
            return res.status(400).json({
                message: 'Cannot delete salary structure. It is being used by employees.',
                employeesCount: employeesUsingStructure
            });
        }

        await SalaryStructure.findOneAndDelete({ _id: id, organizationId });
        clearPayrollGenerationCaches({ organizationId, structureId: id });

        res.json({ message: 'Salary structure deleted successfully' });
    } catch (error) {
        logger.error('Delete salary structure error', { error: error.message, stack: error.stack, structureId: req.params.id });
        res.status(500).json({ message: 'Failed to delete salary structure', error: error.message });
    }
};

// Apply salary structure to employee
export const applySalaryStructure = async (req, res) => {
    try {
        const { employeeId, structureId } = req.body;
        const organizationId = getReqOrganizationId(req);

        const employee = await Employee.findOne({ _id: employeeId, organizationId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findOne({ _id: structureId, organizationId, isActive: true });
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if structure is applicable to this employee
        if (structure.applicableTo !== 'all') {
            let isApplicable = false;
            
            switch (structure.applicableTo) {
                case 'department':
                    isApplicable = structure.applicableValues.includes(employee.department);
                    break;
                case 'position':
                    isApplicable = structure.applicableValues.includes(employee.position);
                    break;
                case 'level':
                    isApplicable = structure.applicableValues.includes(employee.roleLevel?.toString());
                    break;
            }

            if (!isApplicable) {
                return res.status(400).json({ 
                    message: 'This salary structure is not applicable to this employee' 
                });
            }
        }

        // Calculate salary based on structure
        const calculatedSalary = structure.calculateSalary(employee.salary);

        // Update employee's salary structure reference
        employee.salaryStructure = structureId;
        await employee.save();
        clearPayrollGenerationCaches({ organizationId, structureId });

        res.json({
            message: 'Salary structure applied successfully',
            employee: {
                id: employee._id,
                name: employee.name,
                currentSalary: employee.salary,
                calculatedSalary
            }
        });
    } catch (error) {
        logger.error('Apply salary structure error', { error: error.message, stack: error.stack, structureId: req.params.id });
        res.status(500).json({ message: 'Failed to apply salary structure', error: error.message });
    }
};

// Calculate salary for employee using structure
export const calculateEmployeeSalary = async (req, res) => {
    try {
        const { employeeId, structureId } = req.params;
        const organizationId = getReqOrganizationId(req);

        const employee = await Employee.findOne({ _id: employeeId, organizationId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findOne({ _id: structureId, organizationId, isActive: true });
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        const calculatedSalary = structure.calculateSalary(employee.salary);

        res.json({
            employee: {
                id: employee._id,
                name: employee.name,
                currentSalary: employee.salary
            },
            calculatedSalary
        });
    } catch (error) {
        logger.error('Calculate salary error', { error: error.message, stack: error.stack, employeeId: req.params.employeeId });
        res.status(500).json({ message: 'Failed to calculate salary', error: error.message });
    }
};

// Generate payroll using salary structure
export const generatePayrollWithStructure = async (req, res) => {
    try {
        const { employeeId, month, year, structureId } = req.body;
        const organizationId = getReqOrganizationId(req);
        const yearNum = parseInt(year, 10);
        if (Number.isNaN(yearNum)) {
            return res.status(400).json({ message: 'Invalid year' });
        }
        const monthIndex = new Date(`${month} 1, ${yearNum}`).getMonth();
        if (Number.isNaN(monthIndex)) {
            return res.status(400).json({ message: 'Invalid month' });
        }

        const employee = await Employee.findOne({ _id: employeeId, organizationId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findOne({ _id: structureId, organizationId, isActive: true });
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
            organizationId,
            employeeId,
            month,
            year: yearNum
        });

        if (existingPayroll) {
            return res.status(400).json({ 
                message: 'Payroll already exists for this employee and period',
                payrollId: existingPayroll._id
            });
        }

        const now = new Date();
        const mode =
            yearNum > now.getFullYear() ||
            (yearNum === now.getFullYear() && monthIndex >= now.getMonth())
                ? 'preview'
                : 'final';

        const empForGeneration = {
            ...employee.toObject(),
            salaryStructure: structure._id
        };
        const calculatedSalary = await buildGeneratedPayrollPayload({
            emp: empForGeneration,
            month,
            year: yearNum,
            organizationId,
            mode,
            asOf: now
        });

        // Create payroll
        const payroll = new Payroll({
            organizationId,
            employeeId,
            month,
            year: yearNum,
            basicSalary: calculatedSalary.basicSalary,
            earnings: calculatedSalary.earnings,
            deductions: calculatedSalary.deductions,
            ctc: calculatedSalary.ctc,
            inHandSalary: calculatedSalary.inHandSalary,
            leaves: calculatedSalary.leaves,
            workingDays: calculatedSalary.workingDays,
            presentDays: calculatedSalary.presentDays,
            unpaidLeave: calculatedSalary.unpaidLeave,
            paidLeaveDays: calculatedSalary.paidLeaveDays,
            generationType: mode === 'preview' ? 'preview' : 'final',
            isProvisional: mode === 'preview',
            status: 'Pending'
        });

        await payroll.save();

        res.status(201).json({
            message: 'Payroll generated successfully using salary structure',
            payroll
        });
    } catch (error) {
        logger.error('Generate payroll error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to generate payroll', error: error.message });
    }
};

// Get applicable salary structures for employee
export const getApplicableStructures = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const organizationId = getReqOrganizationId(req);

        const employee = await Employee.findOne({ _id: employeeId, organizationId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structures = await SalaryStructure.find({ isActive: true, organizationId });

        const applicableStructures = structures.filter(structure => {
            if (structure.applicableTo === 'all') return true;
            
            switch (structure.applicableTo) {
                case 'department':
                    return structure.applicableValues.includes(employee.department);
                case 'position':
                    return structure.applicableValues.includes(employee.position);
                case 'level':
                    return structure.applicableValues.includes(employee.roleLevel?.toString());
                default:
                    return false;
            }
        });

        res.json({
            employee: {
                id: employee._id,
                name: employee.name,
                department: employee.department,
                position: employee.position,
                roleLevel: employee.roleLevel
            },
            applicableStructures
        });
    } catch (error) {
        logger.error('Get applicable structures error', { error: error.message, stack: error.stack, employeeId: req.params.employeeId });
        res.status(500).json({ message: 'Failed to get applicable structures', error: error.message });
    }
};
