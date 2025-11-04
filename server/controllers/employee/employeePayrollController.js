import Payroll from "../../models/payroll.model.js";
import Employee from "../../models/employee.model.js";

// Get employee's payroll history
export const getEmployeePayrollHistory = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { page = 1, limit = 12 } = req.query;

        const skip = (page - 1) * limit;

        const payrolls = await Payroll.find({ employeeId })
            .sort({ year: -1, month: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('employeeId', 'name lastName email jobTitle department');

        const total = await Payroll.countDocuments({ employeeId });

        res.json({
            payrolls,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        console.error('Get Employee Payroll History Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get specific payroll details
export const getPayrollDetails = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { payrollId } = req.params;

        const payroll = await Payroll.findOne({
            _id: payrollId,
            employeeId
        }).populate('employeeId', 'name lastName email jobTitle department employeeId');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        res.json(payroll);
    } catch (error) {
        console.error('Get Payroll Details Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Generate and download payslip as PDF
export const downloadPayslip = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { payrollId } = req.params;

        const payroll = await Payroll.findOne({
            _id: payrollId,
            employeeId
        }).populate('employeeId', 'name lastName email jobTitle department employeeId');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        // Generate payslip data
        const payslipData = {
            employee: {
                name: `${payroll.employeeId.name} ${payroll.employeeId.lastName}`,
                employeeId: payroll.employeeId.employeeId,
                email: payroll.employeeId.email,
                jobTitle: payroll.employeeId.jobTitle,
                department: payroll.employeeId.department
            },
            payroll: {
                month: payroll.month,
                year: payroll.year,
                basicSalary: payroll.basicSalary,
                earnings: payroll.earnings,
                deductions: payroll.deductions,
                ctc: payroll.ctc,
                inHandSalary: payroll.inHandSalary,
                status: payroll.status,
                processedDate: payroll.processedDate,
                paidDate: payroll.paidDate
            }
        };

        // For now, return the data as JSON
        // In production, you would generate a PDF here
        res.json({
            message: 'Payslip data generated successfully',
            payslipData,
            downloadUrl: `/api/employee/payroll/download-pdf/${payrollId}`
        });
    } catch (error) {
        console.error('Download Payslip Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get current month payroll
export const getCurrentMonthPayroll = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        let payroll = await Payroll.findOne({
            employeeId,
            month,
            year
        }).populate('employeeId', 'name lastName email jobTitle department employeeId');

        // If no payroll exists for current month, create a default one
        if (!payroll) {
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return res.status(404).json({ message: 'Employee not found' });
            }

            const basicSalary = employee.salary || 0;
            
            // Default earnings calculation
            const earnings = {
                basicWage: basicSalary,
                houseRentAllowance: Math.round(basicSalary * 0.4), // 40% of basic
                transportAllowance: 2000,
                medicalAllowance: 1500,
                overtime: 0,
                gratuity: 0,
                specialAllowance: 0,
                performanceBonus: 0,
                projectBonus: 0,
                attendanceBonus: 0,
                pfEmployer: Math.round(basicSalary * 0.12), // 12% of basic
                esiEmployer: Math.round(basicSalary * 0.0325) // 3.25% of basic
            };
            earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);

            // Default deductions calculation
            const deductions = {
                pfEmployee: Math.round(basicSalary * 0.12), // 12% of basic
                esiEmployee: Math.round(basicSalary * 0.0075), // 0.75% of basic
                professionalTax: 200,
                incomeTax: Math.round(basicSalary * 0.1), // 10% of basic
                advanceSalary: 0,
                loanDeduction: 0,
                otherDeductions: 0
            };
            deductions.total = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

            // Calculate CTC and in-hand salary
            const ctc = earnings.totalEarnings;
            const inHandSalary = earnings.totalEarnings - deductions.total;

            payroll = new Payroll({
                employeeId,
                month,
                year,
                basicSalary,
                earnings,
                deductions,
                ctc,
                inHandSalary,
                status: 'Pending'
            });

            await payroll.save();
        }

        res.json(payroll);
    } catch (error) {
        console.error('Get Current Month Payroll Error:', error);
        res.status(500).json({ message: error.message });
    }
};
