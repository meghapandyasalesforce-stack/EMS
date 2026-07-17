/**
 * Export utilities for PDF, Excel, and CSV
 */

import DOMPurify from 'dompurify';
import { toast } from 'react-toastify';
import logger from './logger';

/**
 * Sanitize a string to prevent XSS attacks
 * Removes all HTML tags and escapes special characters
 */
const sanitizeText = (text) => {
    if (text === null || text === undefined) return '';
    // Use DOMPurify to sanitize, then extract text content
    // This removes all HTML tags and prevents XSS
    const sanitized = DOMPurify.sanitize(String(text), { ALLOWED_TAGS: [] });
    return sanitized;
};

// Export to CSV
export const exportToCSV = (data, filename = 'export.csv') => {
    if (!data || data.length === 0) {
        toast.error('No data to export');
        return;
    }

    // Convert data to CSV format
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Handle commas, quotes, and newlines in values
                if (value === null || value === undefined) return '';
                const stringValue = String(value).replace(/"/g, '""');
                return `"${stringValue}"`;
            }).join(',')
        )
    ].join('\n');

    // Create blob and download (UTF-8 BOM so Excel decodes special characters correctly)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Export to Excel (using simple CSV format with .xlsx extension)
export const exportToExcel = (data, filename = 'export.xlsx', sheetName = 'Sheet1') => {
    // For now, we'll use CSV format with .xlsx extension
    // In production, you might want to use a library like 'xlsx'
    exportToCSV(data, filename.replace('.xlsx', '.csv'));
};

// Export to PDF (using html2canvas and jsPDF if available)
export const exportToPDF = async (elementId, filename = 'export.pdf', title = 'Report') => {
    try {
        // Dynamic import to avoid loading if not needed
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const element = document.getElementById(elementId);
        if (!element) {
            toast.error('Element not found for PDF export');
            return;
        }

        // Create canvas from element
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;

        // Add title
        pdf.setFontSize(16);
        pdf.text(title, 105, 15, { align: 'center' });
        position = 25;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Add additional pages if needed
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(filename);
    } catch (error) {
        logger.error('Error exporting to PDF:', error);
        toast.error('PDF export failed. Please try again or use CSV export.');
    }
};

// Export analytics data to various formats
export const exportHRReport = async (analytics, format = 'csv', filename = 'hr-report') => {
    if (!analytics) {
        toast.error('No data to export');
        return;
    }

    const reportData = [];

    // Employee metrics
    if (analytics.employees) {
        reportData.push({
            Category: 'Employees',
            Metric: 'Total Employees',
            Value: analytics.employees.total || 0,
            Details: `${analytics.employees.active || 0} active`
        });
        reportData.push({
            Category: 'Employees',
            Metric: 'New Hires (30d)',
            Value: analytics.employees.newHires || 0,
            Details: 'This month'
        });
        reportData.push({
            Category: 'Employees',
            Metric: 'Attrition Rate',
            Value: `${analytics.employees.attritionRate || 0}%`,
            Details: 'Terminations'
        });
    }

    // Recruitment metrics
    if (analytics.recruitment) {
        reportData.push({
            Category: 'Recruitment',
            Metric: 'Avg Time to Fill',
            Value: `${Math.round(analytics.recruitment.avgTimeToFill || 0)} days`,
            Details: 'Average'
        });
        reportData.push({
            Category: 'Recruitment',
            Metric: 'Cost per Hire',
            Value: `$${analytics.recruitment.costPerHire || 0}`,
            Details: 'Average'
        });
        reportData.push({
            Category: 'Recruitment',
            Metric: 'Offer Acceptance Rate',
            Value: `${analytics.recruitment.offerAcceptanceRate || 0}%`,
            Details: 'Percentage'
        });
    }

    // Turnover analysis
    if (analytics.turnover) {
        reportData.push({
            Category: 'Turnover',
            Metric: 'Voluntary Turnover',
            Value: analytics.turnover.voluntary || 0,
            Details: 'Count'
        });
        reportData.push({
            Category: 'Turnover',
            Metric: 'Involuntary Turnover',
            Value: analytics.turnover.involuntary || 0,
            Details: 'Count'
        });
    }

    // Learning metrics
    if (analytics.learning) {
        reportData.push({
            Category: 'Learning',
            Metric: 'Course Completion Rate',
            Value: `${analytics.learning.completionRate || 0}%`,
            Details: 'Percentage'
        });
        reportData.push({
            Category: 'Learning',
            Metric: 'Certificates Issued',
            Value: analytics.learning.certificatesIssued || 0,
            Details: 'Count'
        });
    }

    // Engagement metrics
    if (analytics.engagement) {
        reportData.push({
            Category: 'Engagement',
            Metric: 'eNPS Score',
            Value: analytics.engagement.eNPS || 0,
            Details: 'Net Promoter Score'
        });
        reportData.push({
            Category: 'Engagement',
            Metric: 'Survey Response Rate',
            Value: `${analytics.engagement.responseRate || 0}%`,
            Details: 'Percentage'
        });
    }

    switch (format.toLowerCase()) {
        case 'csv':
            exportToCSV(reportData, `${filename}.csv`);
            break;
        case 'excel':
            exportToExcel(reportData, `${filename}.xlsx`);
            break;
        case 'pdf':
            // Sanitize filename and all data before inserting into HTML
            const sanitizedFilename = sanitizeText(filename);
            const sanitizedRows = reportData.map(row => ({
                Category: sanitizeText(row.Category),
                Metric: sanitizeText(row.Metric),
                Value: sanitizeText(row.Value),
                Details: sanitizeText(row.Details)
            }));
            
            // Create a temporary element for PDF export
            const tempDiv = document.createElement('div');
            tempDiv.id = 'pdf-export-content';
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.innerHTML = `
                <div style="padding: 20px; font-family: Arial, sans-serif;">
                    <h1 style="text-align: center; margin-bottom: 30px;">${sanitizedFilename}</h1>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f3f4f6;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Metric</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Value</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sanitizedRows.map(row => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${row.Category}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${row.Metric}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${row.Value}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${row.Details}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            document.body.appendChild(tempDiv);
            await exportToPDF('pdf-export-content', `${sanitizedFilename}.pdf`, sanitizedFilename);
            document.body.removeChild(tempDiv);
            break;
        default:
            toast.error('Unsupported export format');
    }
};
