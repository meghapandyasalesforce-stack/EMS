/**
 * Production-Ready PDF Generation Helper for HRMS System
 * Generates professional PDFs for payroll, attendance, and reports
 * 
 * @module pdfGenerator
 * @requires jspdf
 * @requires logger
 */

import { jsPDF } from 'jspdf';
import logger from './logger.js';

// Constants
const PDF_CONFIG = {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    margin: 15
};

const COLORS = {
    header: { r: 59, g: 130, b: 246 },      // Blue
    success: { r: 34, g: 197, b: 94 },      // Green
    error: { r: 239, g: 68, b: 68 },        // Red
    warning: { r: 251, g: 191, b: 36 },     // Amber/Yellow
    tableHeader: { r: 240, g: 240, b: 240 }, // Light Gray
    border: { r: 200, g: 200, b: 200 },     // Gray
    text: { r: 0, g: 0, b: 0 },             // Black
    textLight: { r: 100, g: 100, b: 100 }   // Dark Gray
};

/**
 * Format currency with Indian Rupee symbol
 * Uses Indian numbering system (lakhs, crores)
 * Note: Using "Rs." instead of ₹ for better PDF font compatibility
 * 
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "Rs. 15,000.00")
 */
const formatCurrency = (amount) => {
    try {
        const num = Number(amount || 0);
        if (isNaN(num)) {
            logger.warn('Invalid amount provided to formatCurrency', { amount });
            return 'Rs. 0.00';
        }
        
        // Format number with Indian numbering system (lakhs, crores)
        const formatted = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(num));
        
        // Use "Rs." instead of ₹ for better PDF font compatibility
        // The ₹ symbol requires special font support which may not be available in jsPDF
        return `Rs. ${formatted}`;
    } catch (error) {
        logger.error('Currency formatting error', { error: error.message, amount });
        return 'Rs. 0.00';
    }
};

/**
 * Format label from camelCase/PascalCase to readable text
 * 
 * @param {string} key - Key to format
 * @returns {string} Formatted label
 */
const formatLabel = (key) => {
    if (!key || typeof key !== 'string') return '';
    
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
};

/**
 * Format date in Indian format
 * 
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
    try {
        if (!date) return '';
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (error) {
        logger.warn('Date formatting error', { error: error.message, date });
        return '';
    }
};

/**
 * Format timestamp in Indian format
 * 
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted timestamp string
 */
const formatTimestamp = (date) => {
    try {
        if (!date) return '';
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) return '';
        
        return dateObj.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        logger.warn('Timestamp formatting error', { error: error.message, date });
        return '';
    }
};

/**
 * Check if new page is needed and add if necessary
 * 
 * @param {jsPDF} doc - PDF document instance
 * @param {number} currentYPos - Current Y position
 * @param {number} pageHeight - Page height
 * @param {number} margin - Page margin
 * @param {number} requiredSpace - Required space in mm
 * @returns {number} Updated Y position
 */
const checkPageBreak = (doc, currentYPos, pageHeight, margin, requiredSpace = 20) => {
    if (currentYPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        return margin + 10;
    }
    return currentYPos;
};

/**
 * Sanitize text to ensure proper PDF rendering
 * Removes problematic characters that may cause encoding issues
 * 
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
const sanitizeText = (text) => {
    if (typeof text !== 'string') {
        return String(text || '');
    }
    // Remove any problematic characters and ensure proper encoding
    // Keep alphanumeric, spaces, common punctuation, and currency symbols
    return text.replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '').trim();
};

/**
 * Draw a table row with proper formatting
 * 
 * @param {jsPDF} doc - PDF document instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Row width
 * @param {string} label - Row label
 * @param {string} value - Row value
 * @param {boolean} isBold - Whether text should be bold
 * @param {boolean} drawLine - Whether to draw separator line
 */
const drawTableRow = (doc, x, y, width, label, value, isBold = false, drawLine = true) => {
    // Sanitize text to ensure proper rendering
    const sanitizedLabel = sanitizeText(String(label || ''));
    const sanitizedValue = sanitizeText(String(value || ''));
    
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(sanitizedLabel, x, y);
    doc.text(sanitizedValue, x + width - 3, y, { align: 'right' });
    
    if (drawLine) {
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.3);
        doc.line(x, y + 1, x + width, y + 1);
    }
};

/**
 * Generate professional PAYSLIP PDF
 * 
 * @param {Object} payrollData - Payroll data object
 * @param {Object} employeeData - Employee data object
 * @returns {Promise<Buffer>} PDF buffer
 * 
 * @example
 * const pdfBuffer = await generatePayrollPDF(
 *   {
 *     month: 'January',
 *     year: 2026,
 *     basicSalary: 15000,
 *     earnings: { basicWage: 15000, hra: 6000 },
 *     deductions: { pf: 1800, tax: 1500 },
 *     ctc: 111263,
 *     inHandSalary: 17700,
 *     status: 'Paid',
 *     payment: { provider: 'Bank', status: 'Success' }
 *   },
 *   {
 *     name: 'John',
 *     lastName: 'Doe',
 *     employeeId: 'EMP001',
 *     jobTitle: 'Software Engineer',
 *     department: 'Engineering'
 *   }
 * );
 */
export const generatePayrollPDF = async (payrollData, employeeData) => {
    const startTime = Date.now();
    
    try {
        // Input validation
        if (!payrollData || typeof payrollData !== 'object') {
            throw new Error('Invalid payrollData: must be an object');
        }
        
        if (!employeeData || typeof employeeData !== 'object') {
            throw new Error('Invalid employeeData: must be an object');
        }
        
        if (!employeeData.name || !employeeData.employeeId) {
            throw new Error('Invalid employeeData: name and employeeId are required');
        }
        
        // Initialize PDF document
        const doc = new jsPDF({
            orientation: PDF_CONFIG.orientation,
            unit: PDF_CONFIG.unit,
            format: PDF_CONFIG.format
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = PDF_CONFIG.margin;
        const contentWidth = pageWidth - (2 * margin);
        let yPos = margin;

        // ==================== HEADER SECTION ====================
        doc.setFillColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYSLIP', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const period = `${payrollData.month || 'N/A'} ${payrollData.year || 'N/A'}`;
        doc.text(`Period: ${period}`, pageWidth / 2, 30, { align: 'center' });

        yPos = 50;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // ==================== SYSTEM INFO ====================
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Paarsiv HRMS', margin, yPos);
        
        yPos += 5;
        doc.setFontSize(8);
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        const generatedOn = formatTimestamp(new Date());
        doc.text(`Generated on: ${generatedOn}`, margin, yPos);
        
        yPos += 15;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // ==================== EMPLOYEE INFORMATION BOX ====================
        const employeeBoxHeight = 35;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos, contentWidth, employeeBoxHeight);
        
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Employee Information', margin + 5, yPos);
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const employeeName = `${employeeData.name || ''} ${employeeData.lastName || ''}`.trim();
        doc.text(`Name: ${employeeName}`, margin + 5, yPos);
        doc.text(`Employee ID: ${employeeData.employeeId || 'N/A'}`, margin + 5, yPos + 5);
        
        if (employeeData.jobTitle) {
            doc.text(`Designation: ${employeeData.jobTitle}`, margin + 5, yPos + 10);
        }
        if (employeeData.department) {
            doc.text(`Department: ${employeeData.department}`, margin + 5, yPos + 15);
        }

        yPos += employeeBoxHeight + 10;

        // ==================== PAYROLL DETAILS SECTION ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 30);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYROLL DETAILS', margin, yPos);
        
        yPos += 5;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.3);
        
        // Table header
        doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', margin + 3, yPos + 5.5);
        doc.text('Amount', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
        
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        // Basic Salary
        const basicSalary = Number(payrollData.basicSalary) || 0;
        drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, 'Basic Salary', formatCurrency(basicSalary));
        yPos += 7;
        
        // CTC (Cost to Company) - Optional
        if (payrollData.ctc && Number(payrollData.ctc) > 0) {
            doc.setFont('helvetica', 'bold');
            drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, 'Cost to Company (CTC)', formatCurrency(payrollData.ctc));
            doc.setFont('helvetica', 'normal');
            yPos += 7;
        }
        
        yPos += 5;

        // ==================== EARNINGS SECTION ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 40);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('EARNINGS', margin, yPos);
        
        yPos += 5;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.3);
        
        // Table header
        doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', margin + 3, yPos + 5.5);
        doc.text('Amount', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
        
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        // Process earnings
        const earningsExclude = ['totalEarnings', 'total'];
        let earningsTotal = 0;
        
        if (payrollData.earnings && typeof payrollData.earnings === 'object') {
            const earningsEntries = Object.entries(payrollData.earnings)
                .filter(([key, value]) => {
                    const numValue = Number(value);
                    return !earningsExclude.includes(key) && 
                           !isNaN(numValue) && 
                           numValue > 0;
                })
                .sort((a, b) => Number(b[1]) - Number(a[1]));
            
            earningsEntries.forEach(([key, value]) => {
                yPos = checkPageBreak(doc, yPos, pageHeight, margin, 10);
                
                const numValue = Number(value);
                earningsTotal += numValue;
                const label = formatLabel(key);
                const amountText = formatCurrency(numValue);
                
                drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, label, amountText);
                yPos += 7;
            });
        }
        
        // Earnings Total
        yPos += 2;
        doc.setDrawColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        const totalEarnings = Number(payrollData.earnings?.totalEarnings) || earningsTotal;
        drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, 'Total Earnings', formatCurrency(totalEarnings), true, false);
        
        yPos += 15;

        // ==================== DEDUCTIONS SECTION ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 40);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DEDUCTIONS', margin, yPos);
        
        yPos += 5;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.3);
        
        // Table header
        doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', margin + 3, yPos + 5.5);
        doc.text('Amount', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
        
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        // Process deductions
        const deductionsExclude = ['total', 'totalDeductions'];
        let deductionsTotal = 0;
        
        if (payrollData.deductions && typeof payrollData.deductions === 'object') {
            const deductionsEntries = Object.entries(payrollData.deductions)
                .filter(([key, value]) => {
                    const numValue = Number(value);
                    return !deductionsExclude.includes(key) && 
                           !isNaN(numValue) && 
                           numValue > 0;
                })
                .sort((a, b) => Number(b[1]) - Number(a[1]));
            
            deductionsEntries.forEach(([key, value]) => {
                yPos = checkPageBreak(doc, yPos, pageHeight, margin, 10);
                
                const numValue = Number(value);
                deductionsTotal += numValue;
                const label = formatLabel(key);
                const amountText = formatCurrency(numValue);
                
                drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, label, amountText);
                yPos += 7;
            });
        }
        
        // Deductions Total
        yPos += 2;
        doc.setDrawColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        const totalDeductions = Number(payrollData.deductions?.total) || deductionsTotal;
        drawTableRow(doc, margin + 3, yPos + 5, contentWidth - 6, 'Total Deductions', formatCurrency(totalDeductions), true, false);
        
        yPos += 15;

        // ==================== NET SALARY SECTION ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 25);
        
        doc.setFillColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
        doc.rect(margin, yPos, contentWidth, 20, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('NET SALARY', margin + 5, yPos + 8);
        
        const netSalary = Number(payrollData.inHandSalary) || (totalEarnings - totalDeductions);
        const netSalaryText = sanitizeText(formatCurrency(netSalary));
        doc.setFontSize(16);
        doc.text(netSalaryText, pageWidth - margin - 5, yPos + 8, { align: 'right' });
        
        yPos += 25;

        // ==================== PAYMENT INFORMATION SECTION ====================
        if (payrollData.payment && typeof payrollData.payment === 'object') {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 30);
            
            doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('PAYMENT INFORMATION', margin, yPos);
            yPos += 8;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            if (payrollData.payment.provider) {
                doc.text(`Payment Provider: ${payrollData.payment.provider}`, margin, yPos);
                yPos += 6;
            }
            
            if (payrollData.payment.reference) {
                doc.text(`Transaction Reference: ${payrollData.payment.reference}`, margin, yPos);
                yPos += 6;
            }
            
            if (payrollData.payment.status) {
                const status = String(payrollData.payment.status);
                const statusColor = status === 'Success' ? COLORS.success :
                                   status === 'Failed' ? COLORS.error :
                                   COLORS.warning;
                
                doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
                doc.setFont('helvetica', 'bold');
                doc.text(`Payment Status: ${status}`, margin, yPos);
                doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
                doc.setFont('helvetica', 'normal');
                yPos += 6;
            }
            
            if (payrollData.payment.processedAt) {
                const processedDate = formatDate(payrollData.payment.processedAt);
                if (processedDate) {
                    doc.text(`Processed At: ${processedDate}`, margin, yPos);
                    yPos += 6;
                }
            }
            
            yPos += 5;
        }

        // ==================== ADDITIONAL INFORMATION ====================
        if (payrollData.status) {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 15);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const status = String(payrollData.status);
            const statusColor = status === 'Paid' ? COLORS.success :
                               status === 'Processed' ? COLORS.header :
                               COLORS.warning;
            
            doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
            doc.setFont('helvetica', 'bold');
            doc.text(`Payroll Status: ${status}`, margin, yPos);
            doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
            doc.setFont('helvetica', 'normal');
            yPos += 5;
        }
        
        if (payrollData.processedDate) {
            const processedDate = formatDate(payrollData.processedDate);
            if (processedDate) {
                doc.text(`Processed Date: ${processedDate}`, margin, yPos);
                yPos += 5;
            }
        }
        
        if (payrollData.paidDate) {
            const paidDate = formatDate(payrollData.paidDate);
            if (paidDate) {
                doc.text(`Paid Date: ${paidDate}`, margin, yPos);
                yPos += 5;
            }
        }
        
        // ==================== NOTES SECTION ====================
        if (payrollData.notes && typeof payrollData.notes === 'string' && payrollData.notes.trim()) {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 20);
            yPos += 5;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Notes:', margin, yPos);
            yPos += 5;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            
            const notesLines = doc.splitTextToSize(payrollData.notes.trim(), contentWidth - 4);
            notesLines.forEach(line => {
                yPos = checkPageBreak(doc, yPos, pageHeight, margin, 5);
                doc.text(line, margin + 2, yPos);
                yPos += 4;
            });
        }

        // ==================== FOOTER ====================
        const footerY = pageHeight - 10;
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.setFontSize(7);
        doc.text('This is a system-generated document and does not require a signature.', 
            pageWidth / 2, footerY, { align: 'center' });

        // ==================== GENERATE BUFFER ====================
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        const generationTime = Date.now() - startTime;

        logger.info('Payroll PDF generated successfully', {
            employeeId: employeeData.employeeId || 'N/A',
            period: period,
            generationTimeMs: generationTime,
            bufferSize: pdfBuffer.length
        });

        return pdfBuffer;
        
    } catch (error) {
        const generationTime = Date.now() - startTime;
        logger.error('Payroll PDF generation failed', {
            error: error.message,
            stack: error.stack,
            employeeId: employeeData?.employeeId || 'N/A',
            generationTimeMs: generationTime
        });
        throw error;
    }
};

/**
 * Generate professional Attendance Report PDF
 * 
 * @param {Object} attendanceData - Attendance data object
 * @param {Object} employeeData - Employee data object
 * @param {Object} options - Report options (startDate, endDate, summary)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateAttendancePDF = async (attendanceData, employeeData, options = {}) => {
    const startTime = Date.now();
    
    try {
        // Input validation
        if (!attendanceData || typeof attendanceData !== 'object') {
            throw new Error('Invalid attendanceData: must be an object');
        }
        
        if (!employeeData || typeof employeeData !== 'object') {
            throw new Error('Invalid employeeData: must be an object');
        }
        
        if (!employeeData.name || !employeeData.employeeId) {
            throw new Error('Invalid employeeData: name and employeeId are required');
        }

        const doc = new jsPDF({
            orientation: PDF_CONFIG.orientation,
            unit: PDF_CONFIG.unit,
            format: PDF_CONFIG.format
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = PDF_CONFIG.margin;
        const contentWidth = pageWidth - (2 * margin);
        let yPos = margin;

        // Header
        doc.setFillColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('ATTENDANCE REPORT', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        if (options.startDate && options.endDate) {
            doc.text(`Period: ${formatDate(options.startDate)} to ${formatDate(options.endDate)}`, 
                pageWidth / 2, 30, { align: 'center' });
        }

        yPos = 50;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // System Info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Paarsiv HRMS', margin, yPos);
        yPos += 5;
        doc.setFontSize(8);
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.text(`Generated on: ${formatTimestamp(new Date())}`, margin, yPos);
        yPos += 15;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // Employee Information Box
        const employeeBoxHeight = 35;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.5);
        doc.rect(margin, yPos, contentWidth, employeeBoxHeight);
        
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Employee Information', margin + 5, yPos);
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const employeeName = `${employeeData.name || ''} ${employeeData.lastName || ''}`.trim();
        doc.text(`Name: ${employeeName}`, margin + 5, yPos);
        doc.text(`Employee ID: ${employeeData.employeeId || 'N/A'}`, margin + 5, yPos + 5);
        if (employeeData.jobTitle) {
            doc.text(`Designation: ${employeeData.jobTitle}`, margin + 5, yPos + 10);
        }
        if (employeeData.department) {
            doc.text(`Department: ${employeeData.department}`, margin + 5, yPos + 15);
        }

        yPos += employeeBoxHeight + 15;

        // Summary Section
        if (options.summary && typeof options.summary === 'object') {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 50);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SUMMARY', margin, yPos);
            yPos += 10;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            const summaryFields = [
                { key: 'totalDays', label: 'Total Days' },
                { key: 'present', label: 'Present' },
                { key: 'absent', label: 'Absent' },
                { key: 'late', label: 'Late' },
                { key: 'earlyLeave', label: 'Early Leave' },
                { key: 'overtime', label: 'Overtime Hours' }
            ];
            
            summaryFields.forEach(field => {
                const value = options.summary[field.key];
                if (value !== undefined && value !== null) {
                    doc.text(`${field.label}: ${value}`, margin + 5, yPos);
                    yPos += 7;
                }
            });
            
            yPos += 5;
        }

        // Attendance Records Table
        if (attendanceData.records && Array.isArray(attendanceData.records) && attendanceData.records.length > 0) {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 40);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('ATTENDANCE RECORDS', margin, yPos);
            yPos += 10;
            
            // Table header
            doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
            doc.rect(margin, yPos, contentWidth, 8, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Date', margin + 3, yPos + 5.5);
            doc.text('Clock In', margin + 50, yPos + 5.5);
            doc.text('Clock Out', margin + 90, yPos + 5.5);
            doc.text('Hours', margin + 130, yPos + 5.5);
            doc.text('Status', pageWidth - margin - 3, yPos + 5.5, { align: 'right' });
            
            yPos += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            attendanceData.records.forEach((record, index) => {
                yPos = checkPageBreak(doc, yPos, pageHeight, margin, 10);
                
                doc.text(record.date || '-', margin + 3, yPos + 5);
                doc.text(record.clockIn || '-', margin + 50, yPos + 5);
                doc.text(record.clockOut || '-', margin + 90, yPos + 5);
                doc.text(record.hours || '-', margin + 130, yPos + 5);
                
                // Status with color coding
                if (record.status) {
                    const status = String(record.status).toLowerCase();
                    const statusColor = status === 'present' ? COLORS.success :
                                      status === 'absent' ? COLORS.error :
                                      COLORS.warning;
                    doc.setTextColor(statusColor.r, statusColor.g, statusColor.b);
                    doc.text(record.status || '-', pageWidth - margin - 3, yPos + 5, { align: 'right' });
                    doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
                } else {
                    doc.text('-', pageWidth - margin - 3, yPos + 5, { align: 'right' });
                }
                
                doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
                doc.setLineWidth(0.3);
                doc.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
                yPos += 7;
            });
        }

        // Footer
        const footerY = pageHeight - 10;
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.setFontSize(7);
        doc.text('This is a system-generated document and does not require a signature.', 
            pageWidth / 2, footerY, { align: 'center' });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        const generationTime = Date.now() - startTime;

        logger.info('Attendance PDF generated successfully', {
            employeeId: employeeData.employeeId || 'N/A',
            recordCount: attendanceData.records?.length || 0,
            generationTimeMs: generationTime,
            bufferSize: pdfBuffer.length
        });

        return pdfBuffer;
        
    } catch (error) {
        const generationTime = Date.now() - startTime;
        logger.error('Attendance PDF generation failed', {
            error: error.message,
            stack: error.stack,
            employeeId: employeeData?.employeeId || 'N/A',
            generationTimeMs: generationTime
        });
        throw error;
    }
};

/**
 * Generate general Report PDF
 * 
 * @param {Object} reportData - Report data object
 * @param {Object} options - Report options (title, subtitle)
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateReportPDF = async (reportData, options = {}) => {
    const startTime = Date.now();
    
    try {
        // Input validation
        if (!reportData || typeof reportData !== 'object') {
            throw new Error('Invalid reportData: must be an object');
        }

        const { title = 'Report', headers = [], rows = [] } = reportData;
        
        if (!Array.isArray(headers) || !Array.isArray(rows)) {
            throw new Error('Invalid reportData: headers and rows must be arrays');
        }

        const doc = new jsPDF({
            orientation: PDF_CONFIG.orientation,
            unit: PDF_CONFIG.unit,
            format: PDF_CONFIG.format
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = PDF_CONFIG.margin;
        const contentWidth = pageWidth - (2 * margin);
        let yPos = margin;

        // Header
        doc.setFillColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(String(title).toUpperCase(), pageWidth / 2, 20, { align: 'center' });
        
        if (options.subtitle) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(String(options.subtitle), pageWidth / 2, 30, { align: 'center' });
        }

        yPos = 50;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // System Info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated by Paarsiv HRMS', margin, yPos);
        yPos += 5;
        doc.setFontSize(8);
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.text(`Generated on: ${formatTimestamp(new Date())}`, margin, yPos);
        yPos += 15;
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);

        // Table
        if (headers.length > 0 && rows.length > 0) {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 30);
            
            // Calculate column widths
            const columnCount = headers.length;
            const columnWidth = contentWidth / columnCount;
            
            // Table header
            doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
            doc.rect(margin, yPos, contentWidth, 8, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            
            headers.forEach((header, index) => {
                const xPos = margin + (index * columnWidth) + 3;
                doc.text(String(header), xPos, yPos + 5.5);
            });
            
            yPos += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            // Table rows
            rows.forEach((row) => {
                yPos = checkPageBreak(doc, yPos, pageHeight, margin, 10);
                
                if (Array.isArray(row)) {
                    row.forEach((cell, index) => {
                        const xPos = margin + (index * columnWidth) + 3;
                        const cellText = String(cell || '-');
                        doc.text(cellText, xPos, yPos + 5);
                    });
                }
                
                doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
                doc.setLineWidth(0.3);
                doc.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
                yPos += 7;
            });
        } else {
            // No data message
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('No data available for this report.', margin, yPos);
        }

        // Footer
        const footerY = pageHeight - 10;
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.setFontSize(7);
        doc.text('This is a system-generated document and does not require a signature.', 
            pageWidth / 2, footerY, { align: 'center' });

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        const generationTime = Date.now() - startTime;

        logger.info('Report PDF generated successfully', {
            title: String(title),
            rowCount: rows.length,
            generationTimeMs: generationTime,
            bufferSize: pdfBuffer.length
        });

        return pdfBuffer;
        
    } catch (error) {
        const generationTime = Date.now() - startTime;
        logger.error('Report PDF generation failed', {
            error: error.message,
            stack: error.stack,
            title: reportData?.title || 'N/A',
            generationTimeMs: generationTime
        });
        throw error;
    }
};

// Export default object for convenience
export default {
    generatePayrollPDF,
    generateAttendancePDF,
    generateReportPDF
};
