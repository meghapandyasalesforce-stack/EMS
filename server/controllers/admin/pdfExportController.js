/**
 * PDF Export Controller
 * Handles PDF generation for payroll, attendance, and reports
 */

import { generatePayrollPDF, generateAttendancePDF, generateReportPDF } from '../../helpers/pdfGenerator.js';
import Payroll from '../../models/payroll.model.js';
import Employee from '../../models/employee.model.js';
import Attendance from '../../models/attendance.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound } from '../../helpers/responseHelper.js';
import asyncHandler from '../../helpers/asyncHandler.js';

/**
 * Export payroll as PDF
 * @route GET /api/v1/admin/payroll/:id/export-pdf
 * @access Private (Admin/HR)
 */
export const exportPayrollPDF = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        const payroll = await Payroll.findById(id).populate('employeeId');
        if (!payroll) {
            return sendNotFound(res, 'Payroll');
        }

        const employee = await Employee.findById(payroll.employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        const pdfBuffer = await generatePayrollPDF(payroll, employee);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-${employee.employeeId}-${payroll.month}-${payroll.year}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Payroll PDF export failed', {
            error: error.message,
            stack: error.stack,
            payrollId: req.params.id
        });
        return sendError(res, 'Failed to generate payroll PDF', 500, 'PDF_GENERATION_ERROR');
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

