/**
 * ID Card PDF Generator Helper
 * Generates PDF files for employee ID cards
 */

import jsPDF from 'jspdf';
import logger from './logger.js';

/**
 * Generate PDF for ID card
 * @param {Object} idCard - ID card document with populated employeeId
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateIdCardPDF = async (idCard) => {
    try {
        const employee = idCard.employeeId;
        const cardDesign = idCard.cardDesign || {};
        
        // Create PDF document (ID card size: 85.6mm x 53.98mm - standard credit card size)
        // Using mm units, landscape orientation
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [85.6, 53.98] // Standard ID card dimensions
        });

        // Set background color
        if (cardDesign.backgroundColor) {
            const bgRgb = hexToRgb(cardDesign.backgroundColor);
            if (bgRgb) {
                pdf.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
                pdf.rect(0, 0, 85.6, 53.98, 'F');
            }
        }

        // Set text color
        const textColor = cardDesign.textColor || '#000000';
        const rgb = hexToRgb(textColor);
        if (rgb) {
            pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        }

        // Company name at top
        if (cardDesign.companyName) {
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(cardDesign.companyName, 42.8, 8, { align: 'center' });
        }

        // Company address (smaller, below company name)
        if (cardDesign.companyAddress) {
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'normal');
            pdf.text(cardDesign.companyAddress, 42.8, 12, { align: 'center' });
        }

        // Employee photo placeholder (if available)
        // Note: In production, you would load the actual image
        // For now, we'll create a placeholder rectangle
        const photoSize = 25;
        const photoX = 5;
        const photoY = 18;
        
        if (employee.profilePhoto) {
            // In production, you would load and embed the image:
            // const img = await loadImage(employee.profilePhoto);
            // pdf.addImage(img, 'JPEG', photoX, photoY, photoSize, photoSize);
            // For now, draw a placeholder
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(photoX, photoY, photoSize, photoSize);
            pdf.setFontSize(6);
            pdf.text('Photo', photoX + photoSize / 2, photoY + photoSize / 2, { align: 'center' });
        }

        // Employee information
        const infoX = 35;
        let infoY = 20;

        // Employee name
        const fullName = `${employee.name || ''} ${employee.lastName || ''}`.trim();
        if (fullName) {
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text(fullName, infoX, infoY);
            infoY += 6;
        }

        // Employee ID
        if (employee.employeeId) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`ID: ${employee.employeeId}`, infoX, infoY);
            infoY += 5;
        }

        // Department
        if (employee.department) {
            pdf.setFontSize(8);
            pdf.text(`Dept: ${employee.department}`, infoX, infoY);
            infoY += 5;
        }

        // Job Title
        if (employee.jobTitle) {
            pdf.setFontSize(8);
            pdf.text(employee.jobTitle, infoX, infoY);
            infoY += 5;
        }

        // Card number at bottom
        if (idCard.cardNumber) {
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Card: ${idCard.cardNumber}`, 42.8, 48, { align: 'center' });
        }

        // QR Code placeholder (if available)
        if (idCard.qrCode && idCard.qrCode.imageUrl) {
            // In production, you would load and embed the QR code image:
            // const qrImg = await loadImage(idCard.qrCode.imageUrl);
            // pdf.addImage(qrImg, 'PNG', 70, 20, 12, 12);
            // For now, draw a placeholder
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(70, 20, 12, 12);
            pdf.setFontSize(6);
            pdf.text('QR', 76, 26, { align: 'center' });
        }

        // Issue date
        if (idCard.issueDate) {
            const issueDate = new Date(idCard.issueDate).toLocaleDateString();
            pdf.setFontSize(6);
            pdf.text(`Issued: ${issueDate}`, 5, 50);
        }

        // Status indicator
        if (idCard.status === 'active') {
            pdf.setFillColor(0, 200, 0);
            pdf.circle(80, 5, 2, 'F');
        }

        // Generate PDF buffer
        const pdfBlob = pdf.output('arraybuffer');
        return Buffer.from(pdfBlob);
    } catch (error) {
        logger.error('Error generating ID card PDF', {
            error: error.message,
            stack: error.stack,
            idCardId: idCard._id
        });
        throw error;
    }
};

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code (e.g., '#FF0000')
 * @returns {Object|null} RGB object or null
 */
const hexToRgb = (hex) => {
    if (!hex) return null;
    
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Parse hex
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return null;
    }
    
    return { r, g, b };
};

/**
 * Generate ID card PDF and return as base64
 * @param {Object} idCard - ID card document
 * @returns {Promise<string>} Base64 encoded PDF
 */
export const generateIdCardPDFBase64 = async (idCard) => {
    try {
        const buffer = await generateIdCardPDF(idCard);
        return buffer.toString('base64');
    } catch (error) {
        logger.error('Error generating ID card PDF base64', {
            error: error.message
        });
        throw error;
    }
};

