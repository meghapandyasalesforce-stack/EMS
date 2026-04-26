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
import { employeePfFromBasicWage } from './salaryCalculation.js';

// Constants
const PDF_CONFIG = {
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    margin: 15
};

// Salary slip palette: green #1cca9b, hard black #0e2b3d (headers), soft black #666 (sub-headers)
const COLORS = {
    header: { r: 14, g: 43, b: 61 },         // #0e2b3d hard black – section headers
    success: { r: 28, g: 202, b: 155 },      // #1cca9b green – highlights, net amount bar
    error: { r: 239, g: 68, b: 68 },         // Red
    warning: { r: 251, g: 191, b: 36 },      // Amber/Yellow
    tableHeader: { r: 230, g: 248, b: 241 }, // Light green tint (from #1cca9b) – table header bg
    border: { r: 200, g: 200, b: 200 },      // Gray
    text: { r: 14, g: 43, b: 61 },           // #0e2b3d hard black – main text
    textLight: { r: 102, g: 102, b: 102 }   // #666 soft black – sub-headers, secondary text
};

/**
 * Format currency with Indian Rupee symbol
 * Uses Indian numbering system (lakhs, crores)
 * Note: Using "Rs." instead of ₹ for better PDF font compatibility
 * 
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "INR (15,000.00)")
 */
/** Display day counts on payslip (supports fractional present/unpaid). */
const formatPayslipDayCount = (value, fallback) => {
    if (value == null || Number.isNaN(Number(value))) return fallback;
    const v = Number(value);
    const rounded = Math.round(v * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
    return rounded.toFixed(1).replace(/\.0$/, '');
};

const formatCurrency = (amount) => {
    try {
        const num = Number(amount || 0);
        if (isNaN(num)) {
            logger.warn('Invalid amount provided to formatCurrency', { amount });
            return 'INR (0.00)';
        }
        
        // Format number with Indian numbering system (lakhs, crores)
        const formattedAbs = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(num));
        
        const sign = num < 0 ? '-' : '';
        return `Rs ${sign}${formattedAbs}`;
    } catch (error) {
        logger.error('Currency formatting error', { error: error.message, amount });
        return 'INR (0.00)';
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

    const formatted = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

    const acronymMap = {
        Pf: 'PF',
        Epf: 'EPF',
        Esi: 'ESI',
        Uan: 'UAN',
        Pan: 'PAN',
        Ifsc: 'IFSC',
        Id: 'ID',
        Ctc: 'CTC',
        Hr: 'HR',
        Tds: 'TDS',
        Pt: 'PT'
    };

    return formatted
        .split(' ')
        .map((word) => acronymMap[word] || word)
        .join(' ');
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
 * Convert number to words for Indian currency (e.g. "INR (Sixty Five Thousand Five Hundred Eighty Seven Only)")
 * Handles integers only (rupees); decimal part is ignored.
 *
 * @param {number|string} num - Amount to convert
 * @returns {string} Amount in words
 */
const numberToWordsINR = (num) => {
    const n = Math.floor(Number(num) || 0);
    if (n === 0) return 'INR (Zero Only)';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const toWordsUpTo99 = (x) => {
        if (x < 20) return ones[x];
        return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    };
    const toWordsUpTo999 = (x) => {
        if (x === 0) return '';
        if (x < 100) return toWordsUpTo99(x);
        return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + toWordsUpTo99(x % 100) : '');
    };
    let s = n.toString().replace(/^0+/, '') || '0';
    while (s.length < 9) s = '0' + s;
    const crore = parseInt(s.slice(0, 2), 10);
    const lakh = parseInt(s.slice(2, 4), 10);
    const thousand = parseInt(s.slice(4, 6), 10);
    const hundred = parseInt(s.slice(6, 9), 10);
    const parts = [];
    if (crore > 0) parts.push(toWordsUpTo99(crore) + ' Crore');
    if (lakh > 0) parts.push(toWordsUpTo99(lakh) + ' Lakh');
    if (thousand > 0) parts.push(toWordsUpTo99(thousand) + ' Thousand');
    if (hundred > 0) parts.push(toWordsUpTo999(hundred));
    const words = parts.join(' ').trim().replace(/\s+/g, ' ');
    return `INR (${words} Only)`;
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
export const generatePayrollPDF = async (payrollData, employeeData, orgData = {}) => {
    const startTime = Date.now();
    const companyName = orgData?.name || 'Paarsiv';

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
        const halfWidth = contentWidth / 2;
        let yPos = margin;
        const period = `${payrollData.month || 'N/A'}-${payrollData.year || 'N/A'}`;

        // ==================== HEADER: Left = company logo, Right = company name only ====================
        const logoMaxSize = 30; // max width/height in mm – logo fits inside this box, aspect ratio preserved
        const headerBlockY = yPos;
        let logoWidthMm = logoMaxSize;
        let logoHeightMm = logoMaxSize;
        if (orgData?.logoWidth && orgData?.logoHeight && orgData.logoWidth > 0 && orgData.logoHeight > 0) {
            const ratio = orgData.logoWidth / orgData.logoHeight;
            if (ratio >= 1) {
                logoWidthMm = logoMaxSize;
                logoHeightMm = logoMaxSize / ratio;
            } else {
                logoWidthMm = logoMaxSize * ratio;
                logoHeightMm = logoMaxSize;
            }
        }
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        if (orgData?.logoBase64) {
            try {
                const logoFormat = orgData.logoFormat || 'PNG';
                doc.addImage(orgData.logoBase64, logoFormat, margin, headerBlockY, logoWidthMm, logoHeightMm);
            } catch (e) {
                logger.warn('Payslip header: could not embed logo image', { error: e.message });
            }
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const companyNameY = headerBlockY + logoHeightMm / 2 - 2;
        doc.text(sanitizeText(companyName), pageWidth - margin, companyNameY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += logoHeightMm + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        const titleText = `Pay Slip for ${period}`;
        doc.text(titleText, pageWidth / 2, yPos, { align: 'center' });
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        doc.setFont('helvetica', 'normal');
        yPos += 12;

        // ==================== EMPLOYEE AND ACCOUNT DETAILS (two-column table) ====================
        const employeeName = `${employeeData.name || ''} ${employeeData.lastName || ''}`.trim();
        const leftRows = [
            ['Name', employeeName || ''],
            ['E-Mail ID', employeeData.email || ''],
            ['Designation', employeeData.jobTitle || ''],
            ['Bank Name', employeeData.bankName || ''],
            ['Date of Joining', employeeData.joiningDate ? formatDate(employeeData.joiningDate) : ''],
            ['EPF UAN', employeeData.epfUan || '']
        ];
        const rightRows = [
            ['Mobile No', employeeData.phone || ''],
            ['PAN No', employeeData.panNumber || ''],
            ['Staff ID', employeeData.employeeId || ''],
            ['Bank Account Number', employeeData.accountNumber || ''],
            ['Gender', employeeData.gender || ''],
            ['Tax Regime', employeeData.taxRegime || '']
        ];
        const leftLabelMax = 38;
        const rightLabelMax = 48;
        const cellPad = 6;
        const leftValueWidth = halfWidth - leftLabelMax - cellPad;
        const rightValueWidth = halfWidth - rightLabelMax - cellPad;
        const rowHeight = 6;
        const tableTop = yPos + 6;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.text('Employee and Account Details', margin, yPos);
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        yPos = tableTop;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.3);
        // Slightly taller box so the last row text stays comfortably inside the border
        const detailsBoxHeight = leftRows.length * rowHeight + 8;
        doc.rect(margin, yPos, contentWidth, detailsBoxHeight, 'S');
        doc.line(margin + halfWidth, yPos, margin + halfWidth, yPos + detailsBoxHeight);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const leftValueRightEdge = margin + halfWidth - 5;
        const rightValueRightEdge = pageWidth - margin - 5;
        leftRows.forEach(([label, value], i) => {
            const yy = yPos + 4 + (i + 1) * rowHeight;
            doc.setFont('helvetica', 'bold');
            doc.text(sanitizeText(label + ':'), margin + 3, yy);
            doc.setFont('helvetica', 'normal');
            const val = sanitizeText(String(value || ''));
            const lines = doc.splitTextToSize(val, leftValueWidth);
            doc.text(lines[0] || '', leftValueRightEdge, yy, { align: 'right' });
        });
        rightRows.forEach(([label, value], i) => {
            const yy = yPos + 4 + (i + 1) * rowHeight;
            doc.setFont('helvetica', 'bold');
            doc.text(sanitizeText(label + ':'), margin + halfWidth + 3, yy);
            doc.setFont('helvetica', 'normal');
            const val = sanitizeText(String(value || ''));
            const lines = doc.splitTextToSize(val, rightValueWidth);
            doc.text(lines[0] || '', rightValueRightEdge, yy, { align: 'right' });
        });
        yPos += leftRows.length * rowHeight + 14;

        // ==================== SALARY DETAILS (Attendance) – 3 columns to avoid overlap ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 35);
        const daysInPeriodStr = formatPayslipDayCount(
            payrollData.workingDays != null && !Number.isNaN(Number(payrollData.workingDays))
                ? payrollData.workingDays
                : payrollData.presentDays,
            '21'
        );
        const salaryPaidFor = payrollData.salaryPaidFor || `${period} (${daysInPeriodStr} Days)`;
        const presentDerived =
            payrollData.presentDays != null && !Number.isNaN(Number(payrollData.presentDays))
                ? payrollData.presentDays
                : payrollData.workingDays != null &&
                  payrollData.unpaidLeave != null &&
                  !Number.isNaN(Number(payrollData.workingDays)) &&
                  !Number.isNaN(Number(payrollData.unpaidLeave))
                  ? Number(payrollData.workingDays) - Number(payrollData.unpaidLeave)
                  : null;
        const presentDaysVal = formatPayslipDayCount(presentDerived, '21');
        const unpaidLeaveVal = formatPayslipDayCount(payrollData.unpaidLeave, '0');
        const col1End = margin + contentWidth * 0.52;
        const col2End = margin + contentWidth * 0.76;
        const cellPadSalary = 4;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.text('Salary Details', margin, yPos);
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        yPos += 6;
        doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
        doc.rect(margin, yPos, contentWidth, 8, 'F');
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.line(col1End, yPos, col1End, yPos + 8);
        doc.line(col2End, yPos, col2End, yPos + 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Salary Paid for', margin + cellPadSalary, yPos + 5.5);
        doc.setFont('helvetica', 'normal');
        const salaryPaidLines = doc.splitTextToSize(sanitizeText(salaryPaidFor), col1End - margin - 28);
        doc.text(salaryPaidLines[0] || '', col1End - cellPadSalary, yPos + 5.5, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text('Present', col1End + cellPadSalary, yPos + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${presentDaysVal} Days`, col2End - cellPadSalary, yPos + 5.5, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text('Unpaid Leave', col2End + cellPadSalary, yPos + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${unpaidLeaveVal} Days`, pageWidth - margin - cellPadSalary, yPos + 5.5, { align: 'right' });
        yPos += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Balance Leaves as on last day of ' + period + ' is:', margin, yPos);
        yPos += 6;
        doc.text('Note:', margin, yPos);
        yPos += 10;

        // ==================== EARNING AND DEDUCTION (Earning Head | Amount | Deduction Head | Amount) ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 50);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.header.r, COLORS.header.g, COLORS.header.b);
        doc.text('Earning and Deduction', margin, yPos);
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        yPos += 6;
        const earningsExclude = ['totalEarnings', 'total', 'gratuity'];
        const deductionsExclude = ['total', 'totalDeductions'];
        const earningsForPdf = (payrollData.earnings && typeof payrollData.earnings === 'object')
            ? { ...payrollData.earnings }
            : {};
        const gratuityLegacyPdf = Number(earningsForPdf.gratuity) || 0;
        delete earningsForPdf.gratuity;
        // For legacy payrolls, specialAllowance was reduced by gratuity.
        // Fold legacy gratuity into specialAllowance so SPA is gross - (Basic + HRA).
        if (gratuityLegacyPdf > 0) {
            earningsForPdf.specialAllowance = (Number(earningsForPdf.specialAllowance) || 0) + gratuityLegacyPdf;
        }
        let earningsTotal = 0;
        let deductionsTotal = 0;
        const earningsEntries = Object.entries(earningsForPdf)
            .filter(([key, value]) => {
                const numValue = Number(value);
                return !earningsExclude.includes(key) && !isNaN(numValue) && numValue > 0;
            })
            .sort((a, b) => Number(b[1]) - Number(a[1]));
        const normalizedDeductions = (payrollData.deductions && typeof payrollData.deductions === 'object')
            ? { ...payrollData.deductions }
            : {};
        // Keep payslip behavior aligned with payroll: PF auto-calculated as 12% of capped PF wage.
        const basicWageForPf = Number(payrollData.earnings?.basicWage) || 0;
        const autoPfEmployee = employeePfFromBasicWage(basicWageForPf);
        if (!(Number(normalizedDeductions.pfEmployee) > 0) && autoPfEmployee > 0) {
            normalizedDeductions.pfEmployee = autoPfEmployee;
        }
        const deductionsEntries = Object.entries(normalizedDeductions)
                .filter(([key, value]) => {
                    const numValue = Number(value);
                    return !deductionsExclude.includes(key) && !isNaN(numValue) && numValue > 0;
                })
                .sort((a, b) => Number(b[1]) - Number(a[1]));
        earningsEntries.forEach(([, value]) => { earningsTotal += Number(value); });
        deductionsEntries.forEach(([, value]) => { deductionsTotal += Number(value); });
        // Recompute totals from the exact rows we are going to render (after PF normalization),
        // so "Total Earnings / Total Deductions / Net Amount" always match the table.
        const totalEarnings = earningsTotal;
        const totalDeductions = deductionsTotal;
        const maxRows = Math.max(earningsEntries.length, deductionsEntries.length, 1);
        const colW1 = contentWidth * 0.38;
        const colW2 = contentWidth * 0.12;
        const colW3 = contentWidth * 0.38;
        const colW4 = contentWidth * 0.12;
        const leftHalf = colW1 + colW2;
        const tableTopY = yPos;
        doc.setFillColor(COLORS.tableHeader.r, COLORS.tableHeader.g, COLORS.tableHeader.b);
        doc.rect(margin, yPos, leftHalf, 8, 'F');
        doc.rect(margin + leftHalf, yPos, colW3 + colW4, 8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Earning Head', margin + 2, yPos + 5.5);
        doc.text(period, margin + colW1 + 2, yPos + 5.5);
        doc.text('Deduction Head', margin + leftHalf + 2, yPos + 5.5);
        doc.text(period, margin + leftHalf + colW3 + 2, yPos + 5.5);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        for (let i = 0; i < maxRows; i++) {
            yPos = checkPageBreak(doc, yPos, pageHeight, margin, 8);
            const earn = earningsEntries[i];
            const ded = deductionsEntries[i];
            const earnLabel = earn ? formatLabel(earn[0]) : '';
            const earnAmt = earn ? formatCurrency(earn[1]) : '';
            const dedLabel = ded ? formatLabel(ded[0]) : '';
            const dedAmt = ded ? formatCurrency(ded[1]) : '';
            const earnLabelLine = doc.splitTextToSize(sanitizeText(earnLabel), colW1 - 2)[0] || '';
            const dedLabelLine = doc.splitTextToSize(sanitizeText(dedLabel), colW3 - 2)[0] || '';
            doc.text(earnLabelLine, margin + 2, yPos + 5);
            doc.text(earnAmt, margin + colW1 + 2, yPos + 5);
            doc.text(dedLabelLine, margin + leftHalf + 2, yPos + 5);
            doc.text(dedAmt, margin + leftHalf + colW3 + 2, yPos + 5);
            doc.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
            yPos += 7;
        }
        doc.setDrawColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        doc.setLineWidth(0.4);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Total Earnings', margin + 2, yPos + 5);
        doc.text(formatCurrency(totalEarnings), margin + colW1 + 2, yPos + 5);
        doc.text('Total Deductions', margin + leftHalf + 2, yPos + 5);
        doc.text(formatCurrency(totalDeductions), margin + leftHalf + colW3 + 2, yPos + 5);
        doc.setFont('helvetica', 'normal');
        const tableBottomY = yPos + 12;
        doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
        doc.setLineWidth(0.4);
        doc.line(margin + leftHalf, tableTopY, margin + leftHalf, tableBottomY);
        yPos += 14;

        // ==================== NET AMOUNT + AMOUNT IN WORDS ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 25);
        const netSalary = totalEarnings - totalDeductions;
        const netAmountBarHeight = 14;
        doc.setFillColor(COLORS.success.r, COLORS.success.g, COLORS.success.b);
        doc.rect(margin, yPos - 2, contentWidth, netAmountBarHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Net Amount:', margin + 4, yPos + 6);
        doc.text(formatCurrency(netSalary), pageWidth - margin - 4, yPos + 6, { align: 'right' });
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        yPos += netAmountBarHeight + 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        doc.text('Amount In Words:', margin, yPos + 5);
        doc.setTextColor(COLORS.text.r, COLORS.text.g, COLORS.text.b);
        yPos += 5;
        const amountWords = numberToWordsINR(netSalary);
        const wordsLines = doc.splitTextToSize(sanitizeText(amountWords), contentWidth - 4);
        wordsLines.forEach(line => {
            doc.text(line, margin, yPos + 4);
            yPos += 5;
        });
        yPos += 8;

        // ==================== FOOTER (Disclaimer + Copyright) ====================
        yPos = checkPageBreak(doc, yPos, pageHeight, margin, 28);
        doc.setFontSize(8);
        doc.setTextColor(COLORS.textLight.r, COLORS.textLight.g, COLORS.textLight.b);
        const disclaimer = 'Please review your salary slip and contact HR for any discrepancies within 15 calendar days.';
        const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
        disclaimerLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += 4;
        });
        yPos += 4;
        doc.setFontSize(7);
        doc.text(`© ${payrollData.year || new Date().getFullYear()} ${companyName}. All rights reserved.`, pageWidth / 2, yPos, { align: 'center' });
        const footerY = pageHeight - 8;
        doc.text(`Generated on: ${formatTimestamp(new Date())}`, pageWidth / 2, footerY, { align: 'center' });

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
