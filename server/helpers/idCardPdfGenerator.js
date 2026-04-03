/**
 * ID Card PDF Generator Helper
 * Generates PDF files for employee ID cards
 */

import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Generate PDF for ID card
 * @param {Object} idCard - ID card document with populated employeeId
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateIdCardPDF = async (idCard) => {
    try {
        const employee = idCard.employeeId || {};
        const cardDesign = idCard.cardDesign || {};

        // Vertical portrait ID card dimensions (credit-card ratio in portrait)
        const width = 53.98;
        const height = 85.6;

        // Create PDF document (ID card size, landscape)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [width, height]
        });

        const companyName = cardDesign.companyName || 'COMPANY NAME';
        const companyAddress = cardDesign.companyAddress || 'Corporate Office Address';
        const role = employee.jobTitle || employee.position || 'Employee';
        const employeeName = `${employee.name || ''} ${employee.lastName || ''}`.trim() || 'Employee Name';
        const employeeCode = employee.employeeId || idCard.cardNumber || '-';
        const phone = employee.phone1 || employee.phone2 || '-';
        const email = employee.email || '-';
        const address = employee.address || '-';
        const department = employee.department || '-';

        const formatDate = (value) => {
            if (!value) return '00-00-0000';
            try {
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return '00-00-0000';
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = d.getFullYear();
                return `${dd}-${mm}-${yy}`;
            } catch {
                return '00-00-0000';
            }
        };

        const joinDate = employee.joiningDate || idCard.issueDate;
        const expireDate = idCard.expireDate || null;

        const wrapText = (value, maxLen = 34) => {
            const str = String(value || '-');
            if (str.length <= maxLen) return str;
            return `${str.slice(0, maxLen - 1)}...`;
        };

        const profilePhotoUrl = employee?.profilePhoto?.url || employee?.profilePhoto || null;
        const qrCodeUrl = idCard?.qrCode?.imageUrl || null;
        const profilePhotoData = profilePhotoUrl ? getImageDataFromStoredUrl(profilePhotoUrl) : null;
        const qrCodeData = qrCodeUrl ? getImageDataFromStoredUrl(qrCodeUrl) : null;

        // === FRONT SIDE (Corporate ID Front - portrait only) ===
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, width, height, 'F');

        // Header
        pdf.setFillColor(16, 24, 40);
        pdf.rect(0, 0, width, 16, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.4);
        pdf.text(wrapText(companyName, 22), width / 2, 6.5, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(4.8);
        pdf.text(wrapText(companyAddress, 28), width / 2, 10.5, { align: 'center' });
        pdf.setFontSize(5.2);
        pdf.text('EMPLOYEE ID CARD', width / 2, 14, { align: 'center' });

        // Photo block (centered)
        const photoW = 14;
        const photoH = 17;
        const photoX = (width - photoW) / 2;
        const photoY = 18.5;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(photoX - 0.8, photoY - 0.8, photoW + 1.6, photoH + 1.6, 1.2, 1.2, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(photoX, photoY, photoW, photoH);
        if (profilePhotoData) {
            try {
                drawImageContain(pdf, profilePhotoData.dataUrl, profilePhotoData.format, photoX + 0.1, photoY + 0.1, photoW - 0.2, photoH - 0.2);
            } catch (photoError) {
                logger.warn('Failed to embed profile photo in ID card PDF', {
                    error: photoError.message,
                    idCardId: idCard?._id
                });
                pdf.setTextColor(150, 150, 150);
                pdf.setFontSize(3.8);
                pdf.text('PHOTO', width / 2, photoY + photoH / 2, { align: 'center' });
            }
        } else {
            pdf.setTextColor(150, 150, 150);
            pdf.setFontSize(3.8);
            pdf.text('PHOTO', width / 2, photoY + photoH / 2, { align: 'center' });
        }

        // Employee identity
        pdf.setTextColor(17, 24, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.8);
        pdf.text(wrapText(employeeName, 24), width / 2, 39, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.2);
        pdf.setTextColor(37, 99, 235);
        pdf.text(wrapText(role, 26), width / 2, 42.5, { align: 'center' });

        // ID badge
        pdf.setFillColor(229, 231, 235);
        pdf.roundedRect((width - 26) / 2, 44.2, 26, 4.4, 0.9, 0.9, 'F');
        pdf.setTextColor(17, 24, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(4.8);
        pdf.text(`EMP ID: ${wrapText(employeeCode, 14)}`, width / 2, 47.1, { align: 'center' });

        // Details block (left side)
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        pdf.setFontSize(4.2);
        let y = 53;
        const printKV = (k, v) => {
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${k}:`, 3.8, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(wrapText(v, 12), 12.5, y);
            y += 3.1;
        };

        printKV('Department', department);
        printKV('Email', email);
        printKV('Phone', phone);
        printKV('Address', address);
        printKV('Joined', formatDate(joinDate));

        // QR area on front (right side)
        const qrX = width - 20.5;
        const qrY = 56;
        pdf.setDrawColor(31, 41, 55);
        pdf.roundedRect(qrX, qrY, 16, 16, 1.2, 1.2, 'S');
        if (qrCodeData) {
            try {
                drawImageContain(pdf, qrCodeData.dataUrl, qrCodeData.format, qrX + 1, qrY + 1, 14, 14);
            } catch (qrError) {
                logger.warn('Failed to embed QR image in ID card PDF', {
                    error: qrError.message,
                    idCardId: idCard?._id
                });
                pdf.setFontSize(4.5);
                pdf.setTextColor(107, 114, 128);
                pdf.text('QR', qrX + 8, qrY + 8.6, { align: 'center' });
            }
        } else {
            pdf.setFontSize(4.5);
            pdf.setTextColor(107, 114, 128);
            pdf.text('QR', qrX + 8, qrY + 8.6, { align: 'center' });
        }

        // Footer strip
        pdf.setFillColor(16, 24, 40);
        pdf.rect(0, height - 6, width, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(4.2);
        pdf.text('If found, please return to HR Department', width / 2, height - 2.2, { align: 'center' });

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
 * Resolve app-relative upload URL to local file path and return data URL for jsPDF.
 * Supports values like "/uploads/profile-photos/..." and "/uploads/qrcodes/...".
 */
const getImageDataFromStoredUrl = (storedUrl) => {
    try {
        if (!storedUrl || typeof storedUrl !== 'string') return null;
        const cleanUrl = storedUrl.split('?')[0].trim();
        if (!cleanUrl.startsWith('/')) return null;

        const rel = cleanUrl.replace(/^\//, '');
        const candidates = [
            path.join(process.cwd(), rel), // e.g. <cwd>/uploads/...
            path.join(process.cwd(), 'public', rel), // e.g. <cwd>/public/uploads/...
            path.join(process.cwd(), '..', rel), // e.g. app root when cwd is /server
            path.join(process.cwd(), '..', 'public', rel)
        ];

        const filePath = candidates.find((p) => fs.existsSync(p));
        if (!filePath) return null;

        const ext = path.extname(filePath).toLowerCase();
        let mime = 'image/png';
        let format = 'PNG';
        if (ext === '.jpg' || ext === '.jpeg') {
            mime = 'image/jpeg';
            format = 'JPEG';
        } else if (ext === '.webp') {
            // jsPDF doesn't reliably handle WEBP in all setups; skip gracefully.
            return null;
        } else if (ext === '.gif') {
            // unsupported for addImage in common jsPDF setups
            return null;
        }

        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        return {
            dataUrl: `data:${mime};base64,${base64}`,
            format
        };
    } catch (error) {
        logger.warn('Failed to resolve image for ID card PDF', {
            error: error.message,
            storedUrl
        });
        return null;
    }
};

/**
 * Draw an image inside a box while preserving aspect ratio.
 * Prevents overflow and stretching in tight card layouts.
 */
const drawImageContain = (pdf, dataUrl, format, x, y, boxW, boxH) => {
    const props = pdf.getImageProperties(dataUrl);
    const imgW = props?.width || boxW;
    const imgH = props?.height || boxH;
    if (!imgW || !imgH) {
        pdf.addImage(dataUrl, format, x, y, boxW, boxH);
        return;
    }

    const scale = Math.min(boxW / imgW, boxH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = x + (boxW - drawW) / 2;
    const drawY = y + (boxH - drawH) / 2;
    pdf.addImage(dataUrl, format, drawX, drawY, drawW, drawH);
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

