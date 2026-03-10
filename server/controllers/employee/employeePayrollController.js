import Payroll from "../../models/payroll.model.js";
import Employee from "../../models/employee.model.js";
import logger from "../../helpers/logger.js";
import { generatePayrollPDF } from "../../helpers/pdfGenerator.js";
import { computeEarningsFromGross } from "../../helpers/salaryCalculation.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTH_ORDER = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

function sortPayrollsByYearMonth(payrolls, descending = true) {
    return payrolls.slice().sort((a, b) => {
        const yA = a.year || 0, yB = b.year || 0;
        if (yA !== yB) return descending ? yB - yA : yA - yB;
        const mA = MONTH_ORDER[a.month] || 0, mB = MONTH_ORDER[b.month] || 0;
        return descending ? mB - mA : mA - mB;
    });
}

// Get employee's payroll history (1 year = 12 months, sorted Jan→Dec within year, newest first)
export const getEmployeePayrollHistory = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = req.employee?.organizationId || req.organizationId || req.user?.organizationId;
        const { page = 1, limit = 12 } = req.query;

        const skip = (page - 1) * limit;
        const limitNum = Math.min(parseInt(limit, 10) || 12, 24);

        const query = { employeeId };
        if (organizationId) query.organizationId = organizationId;

        const total = await Payroll.countDocuments(query);
        const fetchSize = Math.min(skip + limitNum, 120);
        const raw = await Payroll.find(query)
            .sort({ year: -1 })
            .limit(fetchSize)
            .populate('employeeId', 'name lastName email jobTitle department')
            .lean();
        const sorted = sortPayrollsByYearMonth(raw, true);
        const payrolls = sorted.slice(skip, skip + limitNum);

        res.json({
            payrolls: sorted,
            totalPages: Math.ceil(total / limitNum),
            currentPage: parseInt(page, 10),
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
        const organizationId = req.employee?.organizationId || req.organizationId || req.user?.organizationId;
        const { payrollId } = req.params;

        const query = { _id: payrollId, employeeId };
        if (organizationId) query.organizationId = organizationId;

        const payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        res.json(payroll);
    } catch (error) {
        logger.error('Get Payroll Details Error', { error: error.message, stack: error.stack, payrollId: req.params.id });
        res.status(500).json({ message: error.message });
    }
};

// Generate and download payslip as PDF (new format: org name + bank details)
export const downloadPayslip = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const { payrollId } = req.params;

        const organizationId = req.employee?.organizationId || req.organizationId || req.user?.organizationId;
        const query = { _id: payrollId, employeeId };
        if (organizationId) query.organizationId = organizationId;

        const payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId joiningDate phone1 financialDetails');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        const emp = payroll.employeeId;
        const fin = emp.financialDetails || {};

        // Organization data for header: logo (left), full company name + email (right)
        let orgData = { name: 'Paarsiv', email: '', website: '', logoBase64: null };
        if (organizationId) {
            const Organization = (await import('../../models/organization.model.js')).default;
            const org = await Organization.findById(organizationId).select('name email domain address logo').lean();
            if (org) {
                orgData = {
                    name: org.name || 'Paarsiv',
                    email: org.email || '',
                    website: org.domain || '',
                    address: org.address ? [org.address.street, org.address.city, org.address.state, org.address.country].filter(Boolean).join(', ') : ''
                };
                if (org.logo?.url) {
                    try {
                        const urlPath = org.logo.url.replace(/^\/+/, '');
                        const logosDir = path.join(__dirname, '../../uploads/logos');
                        const uploadsDir = path.join(__dirname, '../../uploads');
                        const baseName = path.basename(org.logo.url);
                        let filePath = path.join(logosDir, baseName);
                        if (!fs.existsSync(filePath)) filePath = path.join(uploadsDir, baseName);
                        if (fs.existsSync(filePath)) {
                            const buf = fs.readFileSync(filePath);
                            const ext = path.extname(baseName).toLowerCase();
                            const mime = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png';
                            orgData.logoBase64 = `data:image/${mime};base64,${buf.toString('base64')}`;
                            orgData.logoFormat = mime === 'jpeg' ? 'JPEG' : 'PNG';
                            try {
                                const meta = await sharp(buf).metadata();
                                if (meta.width && meta.height) {
                                    orgData.logoWidth = meta.width;
                                    orgData.logoHeight = meta.height;
                                }
                            } catch (_) { /* ignore */ }
                        }
                    } catch (e) {
                        logger.warn('Could not load organization logo for payslip', { error: e.message });
                    }
                }
            }
        }

        // Employee data including bank details and optional Mindstix-style fields (PAN, EPF UAN, Gender, Tax Regime)
        const employeeData = {
            name: emp.name,
            lastName: emp.lastName || '',
            employeeId: emp.employeeId,
            email: emp.email,
            jobTitle: emp.jobTitle,
            department: emp.department,
            joiningDate: emp.joiningDate,
            phone: emp.phone1 || '',
            bankName: fin.bankName || '',
            accountNumber: fin.accountNo || '',
            ifsc: fin.ifsc || '',
            accountName: fin.accountName || '',
            panNumber: fin.panNumber || emp.panNumber || '',
            epfUan: fin.epfUan || emp.epfUan || '',
            gender: emp.gender || '',
            taxRegime: fin.taxRegime || emp.taxRegime || ''
        };

        // Prepare payroll data for PDF (optional: workingDays, presentDays, unpaidLeave for attendance section)
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
            payment: payroll.payment,
            notes: payroll.notes,
            workingDays: payroll.workingDays,
            presentDays: payroll.presentDays,
            unpaidLeave: payroll.unpaidLeave,
            cumulativeEarnings: payroll.cumulativeEarnings,
            cumulativeDeductions: payroll.cumulativeDeductions
        };

        // Generate PDF (new format with org name + bank details)
        const pdfBuffer = await generatePayrollPDF(payrollData, employeeData, orgData);

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

            const gross = employee.salary || 0;
            const formula = computeEarningsFromGross(gross);
            const basicSalary = formula.basicWage;

            const earnings = {
                basicWage: formula.basicWage,
                houseRentAllowance: formula.houseRentAllowance,
                transportAllowance: 2000,
                medicalAllowance: 1500,
                overtime: 0,
                gratuity: formula.gratuity,
                specialAllowance: formula.specialAllowance,
                performanceBonus: 0,
                projectBonus: 0,
                attendanceBonus: 0,
                pfEmployer: Math.round(basicSalary * 0.12),
                esiEmployer: Math.round(basicSalary * 0.0325)
            };
            earnings.totalEarnings = formula.totalEarnings + (earnings.transportAllowance || 0) + (earnings.medicalAllowance || 0) + (earnings.pfEmployer || 0) + (earnings.esiEmployer || 0);

            const deductions = {
                pfEmployee: Math.round(basicSalary * 0.12),
                esiEmployee: Math.round(basicSalary * 0.0075),
                professionalTax: 200,
                incomeTax: Math.round(basicSalary * 0.1),
                advanceSalary: 0,
                loanDeduction: 0,
                otherDeductions: 0
            };
            deductions.total = (deductions.pfEmployee || 0) + (deductions.esiEmployee || 0) + (deductions.professionalTax || 0) + (deductions.incomeTax || 0) + (deductions.advanceSalary || 0) + (deductions.loanDeduction || 0) + (deductions.otherDeductions || 0);

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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Create default payroll for an employee for given month/year (auto-create on view) */
async function createDefaultPayrollForMonth(employeeId, month, year, organizationId) {
    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return null;
    const gross = employee.salary || 0;
    const formula = computeEarningsFromGross(gross);
    const basicSalary = formula.basicWage;
    const earnings = {
        basicWage: formula.basicWage,
        houseRentAllowance: formula.houseRentAllowance,
        transportAllowance: 2000,
        medicalAllowance: 1500,
        overtime: 0,
        gratuity: formula.gratuity,
        specialAllowance: formula.specialAllowance,
        performanceBonus: 0,
        projectBonus: 0,
        attendanceBonus: 0,
        pfEmployer: Math.round(basicSalary * 0.12),
        esiEmployer: Math.round(basicSalary * 0.0325)
    };
    earnings.totalEarnings = formula.totalEarnings + (earnings.transportAllowance || 0) + (earnings.medicalAllowance || 0) + (earnings.pfEmployer || 0) + (earnings.esiEmployer || 0);
    const deductions = {
        pfEmployee: Math.round(basicSalary * 0.12),
        esiEmployee: Math.round(basicSalary * 0.0075),
        professionalTax: 200,
        incomeTax: Math.round(basicSalary * 0.1),
        advanceSalary: 0,
        loanDeduction: 0,
        otherDeductions: 0
    };
    deductions.total = (deductions.pfEmployee || 0) + (deductions.esiEmployee || 0) + (deductions.professionalTax || 0) + (deductions.incomeTax || 0) + (deductions.advanceSalary || 0) + (deductions.loanDeduction || 0) + (deductions.otherDeductions || 0);
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
    if (organizationId) payrollData.organizationId = organizationId;
    const payroll = new Payroll(payrollData);
    await payroll.save();
    return payroll.toObject();
}

// Get payroll for a specific month/year (employee). Auto-creates if missing (on view).
export const getPayrollByMonth = async (req, res) => {
    try {
        if (!req.employee?._id) {
            return res.status(401).json({ success: false, message: 'Employee not authenticated' });
        }
        const employeeId = req.employee._id;
        const month = req.query.month || new Date().toLocaleString('default', { month: 'long' });
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        if (!MONTHS.includes(month) || year < 2000 || year > 2100) {
            return res.status(400).json({ success: false, message: 'Invalid month or year' });
        }
        const organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId;
        const query = { employeeId, month, year };
        if (organizationId) query.organizationId = organizationId;
        let payroll = await Payroll.findOne(query)
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();
        if (!payroll) {
            payroll = await createDefaultPayrollForMonth(employeeId, month, year, organizationId);
            if (!payroll) {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }
            payroll = await Payroll.findById(payroll._id)
                .populate('employeeId', 'name lastName email jobTitle department employeeId')
                .lean();
        }
        res.json({
            success: true,
            ...payroll,
            inHandSalary: payroll.inHandSalary || (payroll.earnings?.totalEarnings || 0) - (payroll.deductions?.total || 0)
        });
    } catch (error) {
        logger.error('Get Payroll by Month Error', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: error.message });
    }
};
