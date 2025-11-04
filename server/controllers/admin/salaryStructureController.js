import SalaryStructure from '../../models/salaryStructure.model.js';
import Employee from '../../models/employee.model.js';
import Payroll from '../../models/payroll.model.js';

// Create salary structure
export const createSalaryStructure = async (req, res) => {
    try {
        const {
            name, description, applicableTo, applicableValues,
            earnings, deductions, bonusStructure, overtimeRules
        } = req.body;

        // Check if structure with same name exists
        const existingStructure = await SalaryStructure.findOne({ name });
        if (existingStructure) {
            return res.status(400).json({ message: 'Salary structure with this name already exists' });
        }

        const salaryStructure = new SalaryStructure({
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

        res.status(201).json({
            message: 'Salary structure created successfully',
            salaryStructure
        });
    } catch (error) {
        console.error('Create salary structure error:', error);
        res.status(500).json({ message: 'Failed to create salary structure', error: error.message });
    }
};

// Get all salary structures
export const getAllSalaryStructures = async (req, res) => {
    try {
        const { isActive } = req.query;
        const filter = {};

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const structures = await SalaryStructure.find(filter)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .sort({ createdAt: -1 });

        res.json(structures);
    } catch (error) {
        console.error('Get salary structures error:', error);
        res.status(500).json({ message: 'Failed to get salary structures', error: error.message });
    }
};

// Get salary structure by ID
export const getSalaryStructureById = async (req, res) => {
    try {
        const { id } = req.params;

        const structure = await SalaryStructure.findById(id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        res.json(structure);
    } catch (error) {
        console.error('Get salary structure error:', error);
        res.status(500).json({ message: 'Failed to get salary structure', error: error.message });
    }
};

// Update salary structure
export const updateSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const structure = await SalaryStructure.findById(id);
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if new name conflicts with existing structure
        if (updates.name && updates.name !== structure.name) {
            const existingStructure = await SalaryStructure.findOne({ 
                name: updates.name, 
                _id: { $ne: id } 
            });
            if (existingStructure) {
                return res.status(400).json({ message: 'Salary structure with this name already exists' });
            }
        }

        updates.lastModifiedBy = req.user._id;
        const updatedStructure = await SalaryStructure.findByIdAndUpdate(id, updates, { new: true })
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        res.json({
            message: 'Salary structure updated successfully',
            salaryStructure: updatedStructure
        });
    } catch (error) {
        console.error('Update salary structure error:', error);
        res.status(500).json({ message: 'Failed to update salary structure', error: error.message });
    }
};

// Delete salary structure
export const deleteSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;

        const structure = await SalaryStructure.findById(id);
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if structure is being used by any employees
        const employeesUsingStructure = await Employee.countDocuments({
            salaryStructure: id
        });

        if (employeesUsingStructure > 0) {
            return res.status(400).json({
                message: 'Cannot delete salary structure. It is being used by employees.',
                employeesCount: employeesUsingStructure
            });
        }

        await SalaryStructure.findByIdAndDelete(id);

        res.json({ message: 'Salary structure deleted successfully' });
    } catch (error) {
        console.error('Delete salary structure error:', error);
        res.status(500).json({ message: 'Failed to delete salary structure', error: error.message });
    }
};

// Apply salary structure to employee
export const applySalaryStructure = async (req, res) => {
    try {
        const { employeeId, structureId } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findById(structureId);
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
        console.error('Apply salary structure error:', error);
        res.status(500).json({ message: 'Failed to apply salary structure', error: error.message });
    }
};

// Calculate salary for employee using structure
export const calculateEmployeeSalary = async (req, res) => {
    try {
        const { employeeId, structureId } = req.params;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findById(structureId);
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
        console.error('Calculate salary error:', error);
        res.status(500).json({ message: 'Failed to calculate salary', error: error.message });
    }
};

// Generate payroll using salary structure
export const generatePayrollWithStructure = async (req, res) => {
    try {
        const { employeeId, month, year, structureId } = req.body;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structure = await SalaryStructure.findById(structureId);
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
            employeeId,
            month,
            year
        });

        if (existingPayroll) {
            return res.status(400).json({ 
                message: 'Payroll already exists for this employee and period',
                payrollId: existingPayroll._id
            });
        }

        // Calculate salary using structure
        const calculatedSalary = structure.calculateSalary(employee.salary);

        // Create payroll
        const payroll = new Payroll({
            employeeId,
            month,
            year,
            basicSalary: employee.salary,
            earnings: calculatedSalary.earnings,
            deductions: calculatedSalary.deductions,
            ctc: calculatedSalary.totalEarnings,
            inHandSalary: calculatedSalary.netSalary,
            status: 'Pending'
        });

        await payroll.save();

        res.status(201).json({
            message: 'Payroll generated successfully using salary structure',
            payroll
        });
    } catch (error) {
        console.error('Generate payroll error:', error);
        res.status(500).json({ message: 'Failed to generate payroll', error: error.message });
    }
};

// Get applicable salary structures for employee
export const getApplicableStructures = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const structures = await SalaryStructure.find({ isActive: true });

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
        console.error('Get applicable structures error:', error);
        res.status(500).json({ message: 'Failed to get applicable structures', error: error.message });
    }
};
