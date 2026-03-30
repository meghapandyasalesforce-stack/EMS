import Payroll from "../../models/payroll.model.js";
import logger from "../../helpers/logger.js";
import { generatePayrollPDF } from "../../helpers/pdfGenerator.js";
import { pickDisplayPayroll } from "../../helpers/payrollGenerationHelper.js";
import { aggregatePayrollPeriod } from "../../helpers/payrollAggregationHelper.js";
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

function normalizePayrollForDisplay(payroll) {
    if (!payroll || typeof payroll !== 'object') return payroll;

    const rawEarnings = payroll.earnings && typeof payroll.earnings === 'object' ? { ...payroll.earnings } : {};
    const gratuityLegacy = Number(rawEarnings.gratuity) || 0;
    delete rawEarnings.gratuity;
    const earnings = rawEarnings;
    const deductions = payroll.deductions && typeof payroll.deductions === 'object' ? { ...payroll.deductions } : {};

    // Legacy payrolls used to compute specialAllowance as:
    //   gross - basicWage - houseRentAllowance - gratuity
    // For SPA we want: gross - (Basic + HRA). So fold legacy gratuity into specialAllowance.
    if (gratuityLegacy > 0) {
        earnings.specialAllowance = (Number(earnings.specialAllowance) || 0) + gratuityLegacy;
    }

    const basicWage = Number(earnings.basicWage) || 0;
    deductions.pfEmployee = Math.round(basicWage * 0.12);

    const earningsFields = [
        'basicWage',
        'houseRentAllowance',
        'transportAllowance',
        'medicalAllowance',
        'overtime',
        'specialAllowance',
        'performanceBonus',
        'projectBonus',
        'attendanceBonus',
        'pfEmployer',
        'esiEmployer'
    ];
    const deductionFields = [
        'pfEmployee',
        'esiEmployee',
        'professionalTax',
        'incomeTax',
        'advanceSalary',
        'loanDeduction',
        'otherDeductions'
    ];

    earnings.totalEarnings = earningsFields.reduce((sum, key) => sum + (Number(earnings[key]) || 0), 0);
    deductions.total = deductionFields.reduce((sum, key) => sum + (Number(deductions[key]) || 0), 0);

    return {
        ...payroll,
        earnings,
        deductions,
        ctc: earnings.totalEarnings,
        inHandSalary: earnings.totalEarnings - deductions.total
    };
}

// Get employee's payroll history (1 year = 12 months, sorted Jan→Dec within year, newest first)
export const getEmployeePayrollHistory = async (req, res) => {
    try {
        const employeeId = req.employee._id;
        const organizationId = req.employee?.organizationId || req.organizationId || req.user?.organizationId;
        const { page = 1, limit = 12 } = req.query;

        const skip = (page - 1) * limit;
        const limitNum = Math.min(parseInt(limit, 10) || 12, 24);

        // Employee history should show published (non-provisional) payrolls only.
        const query = { employeeId, isVisible: true, isProvisional: false, type: 'monthly' };
        if (organizationId) query.organizationId = organizationId;

        const total = await Payroll.countDocuments(query);
        const fetchSize = Math.min(skip + limitNum, 120);
        const raw = await Payroll.find(query)
            .sort({ year: -1 })
            .limit(fetchSize)
            .populate('employeeId', 'name lastName email jobTitle department')
            .lean();
        const sortedRaw = sortPayrollsByYearMonth(raw, true);
        const pagedRaw = sortedRaw.slice(skip, skip + limitNum);

        const payrolls = await Promise.all(
            pagedRaw.map(async (monthlyPayroll) => {
                const normalized = normalizePayrollForDisplay(monthlyPayroll);

                const adjustmentsQuery = {
                    employeeId,
                    month: monthlyPayroll.month,
                    year: monthlyPayroll.year,
                    type: 'off_cycle',
                    isVisible: true,
                    status: { $in: ['Processed', 'Paid'] }
                };
                if (organizationId) adjustmentsQuery.organizationId = organizationId;

                const adjustmentDocs = await Payroll.find(adjustmentsQuery).lean();
                const aggregated = aggregatePayrollPeriod([monthlyPayroll, ...adjustmentDocs]);

                normalized.earnings.totalEarnings = aggregated.final.earningsTotal;
                normalized.deductions.total = aggregated.final.deductionsTotal;
                normalized.ctc = aggregated.final.earningsTotal;
                normalized.inHandSalary = aggregated.final.net;
                normalized.adjustments = aggregated.adjustments;

                return normalized;
            })
        );

        res.json({
            payrolls,
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

        // Only allow downloading payslips after final payment.
        const query = { _id: payrollId, employeeId, isVisible: true, status: 'Paid', payrollLocked: true };
        if (organizationId) query.organizationId = organizationId;

        const payroll = await Payroll.findOne(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name lastName email jobTitle department employeeId');

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        const adjustmentsQuery = {
            employeeId,
            month: payroll.month,
            year: payroll.year,
            type: 'off_cycle',
            isVisible: true,
            status: { $in: ['Processed', 'Paid'] }
        };
        if (organizationId) adjustmentsQuery.organizationId = organizationId;

        const adjustmentDocs = await Payroll.find(adjustmentsQuery).lean();
        const aggregated = aggregatePayrollPeriod([payroll.toObject(), ...adjustmentDocs]);

        const normalizedPayroll = normalizePayrollForDisplay(payroll.toObject());
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;
        normalizedPayroll.adjustments = aggregated.adjustments;

        res.json(normalizedPayroll);
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
        // Only allow downloading payslips after final payment.
        const query = { _id: payrollId, employeeId, isVisible: true, status: 'Paid', payrollLocked: true };
        if (organizationId) query.organizationId = organizationId;

        const payroll = await Payroll.findOne(query)
            .sort({ updatedAt: -1, createdAt: -1 })
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
        const adjustmentsQuery = {
            employeeId,
            month: payroll.month,
            year: payroll.year,
            type: 'off_cycle',
            isVisible: true,
            status: { $in: ['Processed', 'Paid'] }
        };
        if (organizationId) adjustmentsQuery.organizationId = organizationId;

        const adjustmentDocs = await Payroll.find(adjustmentsQuery).lean();
        const aggregated = aggregatePayrollPeriod([payroll.toObject(), ...adjustmentDocs]);

        const payrollData = {
            month: payroll.month,
            year: payroll.year,
            basicSalary: payroll.basicSalary,
            earnings: payroll.earnings,
            deductions: payroll.deductions,
            ctc: aggregated.final.earningsTotal,
            inHandSalary: aggregated.final.net,
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

        // Overwrite totals so the PDF reflects monthly + off-cycle adjustments.
        payrollData.earnings = payrollData.earnings || {};
        payrollData.earnings.totalEarnings = aggregated.final.earningsTotal;
        payrollData.deductions = payrollData.deductions || {};
        payrollData.deductions.total = aggregated.final.deductionsTotal;

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
            year,
            isVisible: true
        };
        if (organizationId) {
            query.organizationId = organizationId;
        }

        const rawList = await Payroll.find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();

        const aggregated = aggregatePayrollPeriod(rawList);
        if (!aggregated?.monthly) {
            return res.status(404).json({
                success: false,
                message: 'No payroll has been published for this month yet.'
            });
        }

        const monthly = aggregated.monthly;
        const normalizedPayroll = normalizePayrollForDisplay(monthly);

        // Replace totals with final aggregated totals (monthly + off-cycle adjustments).
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;

        res.json({
            success: true,
            ...normalizedPayroll,
            adjustments: aggregated.adjustments
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

// Get payroll for a specific month/year (employee).
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
        const query = { employeeId, month, year, isVisible: true };
        if (organizationId) query.organizationId = organizationId;
        const rawList = await Payroll.find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('employeeId', 'name lastName email jobTitle department employeeId')
            .lean();
        const aggregated = aggregatePayrollPeriod(rawList);
        if (!aggregated?.monthly) {
            return res.status(404).json({
                success: false,
                message: 'No payroll has been published for this period.'
            });
        }
        const monthly = aggregated.monthly;
        const normalizedPayroll = normalizePayrollForDisplay(monthly);
        normalizedPayroll.earnings.totalEarnings = aggregated.final.earningsTotal;
        normalizedPayroll.deductions.total = aggregated.final.deductionsTotal;
        normalizedPayroll.ctc = aggregated.final.earningsTotal;
        normalizedPayroll.inHandSalary = aggregated.final.net;

        res.json({
            success: true,
            ...normalizedPayroll,
            adjustments: aggregated.adjustments
        });
    } catch (error) {
        logger.error('Get Payroll by Month Error', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: error.message });
    }
};
