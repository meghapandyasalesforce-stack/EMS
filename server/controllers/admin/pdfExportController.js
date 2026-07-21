/**
 * PDF Export Controller
 * Handles PDF generation for payroll, attendance, and reports
 */

import { generatePayrollPDF, generateAttendancePDF, generateReportPDF } from '../../helpers/pdfGenerator.js';
import { enrichAttendanceMetricsForPayslip } from '../../helpers/payrollGenerationHelper.js';
import { aggregatePayrollPeriod, isValidMongoObjectId } from '../../helpers/payrollAggregationHelper.js';
import { getCachedEffectiveTimezone } from '../../helpers/orgContextCache.js';
import Payroll from '../../models/payroll.model.js';
import Employee from '../../models/employee.model.js';
import Attendance from '../../models/attendance.model.js';
import Organization from '../../models/organization.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound } from '../../helpers/responseHelper.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export payroll as PDF (same format as employee download: org name + bank details)
 * @route GET /api/v1/admin/payroll/:id/export-pdf
 * @access Private (Admin/HR)
 */
export const exportPayrollPDF = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidMongoObjectId(id)) {
            return sendError(res, 'Invalid payroll ID', 400, 'INVALID_PAYROLL_ID');
        }

        const organizationId = req.organizationId || req.user?.organizationId || req.employee?.organizationId;

        const payroll = await Payroll.findOne({ _id: id, ...(organizationId && { organizationId }) })
            .populate(
                'employeeId',
                'name lastName email jobTitle department employeeId joiningDate lastWorkingDate terminationDate phone1 gender financialDetails'
            );
        if (!payroll) {
            return sendNotFound(res, 'Payroll');
        }

        const emp = payroll.employeeId;
        if (!emp) {
            return sendNotFound(res, 'Employee');
        }

        const fin = emp.financialDetails || {};
        let orgData = { name: 'Paarsiv', email: '', website: '', logoBase64: null };
        if (organizationId) {
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
                        const baseName = path.basename(org.logo.url);
                        const logosDir = path.join(__dirname, '../../uploads/logos');
                        const uploadsDir = path.join(__dirname, '../../uploads');
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
                        logger.warn('Could not load organization logo for payslip export', { error: e.message });
                    }
                }
            }
        }

        const employeeData = {
            name: emp.name || 'Employee',
            lastName: emp.lastName || '',
            employeeId: emp.employeeId || emp._id?.toString?.() || 'N/A',
            email: emp.email,
            jobTitle: emp.jobTitle,
            department: emp.department,
            joiningDate: emp.joiningDate,
            lastWorkingDate: emp.lastWorkingDate,
            terminationDate: emp.terminationDate,
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

        if (organizationId) {
            orgData.timezone = await getCachedEffectiveTimezone(organizationId);
        }

        const payrollObj = payroll.toObject ? payroll.toObject() : payroll;
        const adjustmentsQuery = {
            employeeId: emp._id,
            month: payroll.month,
            year: payroll.year,
            type: 'off_cycle',
            isVisible: true,
            status: { $in: ['Processed', 'Paid'] },
        };
        if (organizationId) adjustmentsQuery.organizationId = organizationId;

        const adjustmentDocs = await Payroll.find(adjustmentsQuery).lean();
        const aggregated = aggregatePayrollPeriod([payrollObj, ...adjustmentDocs]);

        const payrollData = {
            month: payroll.month,
            year: payroll.year,
            basicSalary: payroll.basicSalary,
            earnings: payrollObj.earnings || {},
            deductions: payrollObj.deductions || {},
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
            cumulativeDeductions: payroll.cumulativeDeductions,
        };
        payrollData.earnings = { ...(payrollData.earnings || {}), totalEarnings: aggregated.final.earningsTotal };
        payrollData.deductions = { ...(payrollData.deductions || {}), total: aggregated.final.deductionsTotal };

        const attendanceMetrics = await enrichAttendanceMetricsForPayslip(payroll, organizationId);
        payrollData.workingDays = attendanceMetrics.workingDays ?? payrollData.workingDays;
        payrollData.presentDays = attendanceMetrics.presentDays ?? payrollData.presentDays;
        payrollData.unpaidLeave = attendanceMetrics.unpaidLeave ?? payrollData.unpaidLeave;

        const pdfBuffer = await generatePayrollPDF(payrollData, employeeData, orgData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-${emp.employeeId}-${payroll.month}-${payroll.year}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Payroll PDF export failed', {
            error: error.message,
            stack: error.stack,
            payrollId: req.params.id
        });
        return sendError(
            res,
            error.message || 'Failed to generate payroll PDF',
            500,
            'PDF_GENERATION_ERROR',
            process.env.NODE_ENV === 'development' ? error.message : undefined
        );
    }
});

/**
 * Export attendance report as PDF
 * @route GET /api/v1/both/attendance/:employeeId/export-pdf
 * @access Private
 */
export const exportAttendancePDF = asyncHandler(async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate } = req.query;

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Fetch attendance records
        const query = { employeeId };
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendanceRecords = await Attendance.find(query)
            .sort({ date: -1 })
            .limit(100); // Limit to prevent huge PDFs

        // Calculate summary
        const summary = {
            totalDays: attendanceRecords.length,
            present: attendanceRecords.filter(r => r.status === 'present').length,
            absent: attendanceRecords.filter(r => r.status === 'absent').length,
            late: attendanceRecords.filter(r => r.status === 'late').length,
            earlyLeave: attendanceRecords.filter(r => r.status === 'early-leave').length
        };

        const attendanceData = {
            records: attendanceRecords.map(record => ({
                date: record.date.toISOString().split('T')[0],
                clockIn: record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '-',
                clockOut: record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-',
                hours: record.totalHours || '-',
                status: record.status || '-'
            }))
        };

        const pdfBuffer = await generateAttendancePDF(attendanceData, employee, {
            startDate,
            endDate,
            summary
        });

        const filename = `attendance-${employee.employeeId}-${startDate || 'all'}-${endDate || 'all'}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Attendance PDF export failed', {
            error: error.message,
            stack: error.stack,
            employeeId: req.params.employeeId
        });
        return sendError(res, 'Failed to generate attendance PDF', 500, 'PDF_GENERATION_ERROR');
    }
});

/**
 * Export general report as PDF
 * @route POST /api/v1/admin/reports/export-pdf
 * @access Private (Admin)
 */
export const exportReportPDF = asyncHandler(async (req, res) => {
    try {
        const { title, subtitle, headers, rows } = req.body;

        if (!title || !headers || !rows) {
            return sendError(res, 'Title, headers, and rows are required', 400, 'VALIDATION_ERROR');
        }

        const reportData = {
            title,
            subtitle,
            headers,
            rows
        };

        const pdfBuffer = await generateReportPDF(reportData, { subtitle });

        const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Report PDF export failed', {
            error: error.message,
            stack: error.stack
        });
        return sendError(res, 'Failed to generate report PDF', 500, 'PDF_GENERATION_ERROR');
    }
});

export default {
    exportPayrollPDF,
    exportAttendancePDF,
    exportReportPDF
};

