import Payroll from "../../models/payroll.model.js";
import Employee from "../../models/employee.model.js";
import logger from "../../helpers/logger.js";
import { generatePayrollPDF } from "../../helpers/pdfGenerator.js";

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
        logger.error('Get Employee Payroll History Error', { error: error.message, stack: error.stack, employeeId: req.employee?._id });
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
        logger.error('Get Payroll Details Error', { error: error.message, stack: error.stack, payrollId: req.params.id });
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

        // Prepare employee data for PDF
        const employeeData = {
            name: payroll.employeeId.name,
            lastName: payroll.employeeId.lastName || '',
            employeeId: payroll.employeeId.employeeId,
            email: payroll.employeeId.email,
            jobTitle: payroll.employeeId.jobTitle,
            department: payroll.employeeId.department
        };

        // Prepare payroll data for PDF
        const payrollData = {
            month: payroll.month,
            year: payroll.year,
            basicSalary: payroll.basicSalary,
            earnings: payroll.earnings,
            deductions: payroll.deductions,
            ctc: payroll.ctc,
            inHandSalary: payroll.inHandSalary,
            status: payroll.status,
            processedDate: payroll.processedDate,
            paidDate: payroll.paidDate,
            payment: payroll.payment, // Add payment information
            notes: payroll.notes // Add notes
        };

        // Generate PDF
        const pdfBuffer = await generatePayrollPDF(payrollData, employeeData);

        // Set response headers for PDF download
        const fileName = `Payslip_${employeeData.employeeId}_${payroll.month}_${payroll.year}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF buffer
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Download Payslip Error', { error: error.message, stack: error.stack, payrollId: req.params.payrollId });
        res.status(500).json({ message: error.message });
    }
};

// Get current month payroll
export const getCurrentMonthPayroll = async (req, res) => {
    try {
        // Check if employee is authenticated
        if (!req.employee || !req.employee._id) {
            logger.warn('Get Current Month Payroll - Employee not authenticated', { 
                hasEmployee: !!req.employee,
                hasUserId: !!req.employee?._id
            });
            return res.status(401).json({ 
                success: false,
                message: 'Employee not authenticated' 
            });
        }

        const employeeId = req.employee._id;
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'long' });
        const year = currentDate.getFullYear();

        // Get organizationId for multi-tenancy
        const organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId;

        // Build query with organization filter if available
        const query = {
            employeeId,
            month,
            year
        };
        if (organizationId) {
            query.organizationId = organizationId;
        }

        let payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        // If no payroll exists for current month, create a default one
        if (!payroll) {
            const employee = await Employee.findById(employeeId).lean();
            if (!employee) {
                logger.warn('Get Current Month Payroll - Employee not found', { employeeId });
                return res.status(404).json({ 
                    success: false,
                    message: 'Employee not found' 
                });
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

            const payrollData = {
                employeeId,
                month,
                year,
                basicSalary,
                earnings,
                deductions,
                ctc,
                inHandSalary,
                status: 'Pending'
            };

            // Add organizationId if available
            if (organizationId) {
                payrollData.organizationId = organizationId;
            }

            payroll = new Payroll(payrollData);
            await payroll.save();
            payroll = payroll.toObject();
        }

        // Return response in expected format
        res.json({
            success: true,
            ...payroll,
            inHandSalary: payroll.inHandSalary || (payroll.earnings?.totalEarnings || 0) - (payroll.deductions?.total || 0)
        });
    } catch (error) {
        logger.error('Get Current Month Payroll Error', { 
            error: error.message, 
            stack: error.stack, 
            employeeId: req.employee?._id,
            organizationId: req.organizationId || req.employee?.organizationId
        });
        res.status(500).json({ 
            success: false,
            message: error.message || 'Failed to fetch current month payroll' 
        });
    }
};
