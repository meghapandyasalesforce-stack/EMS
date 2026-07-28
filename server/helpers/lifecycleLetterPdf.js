/**
 * PDF generation for offer letters and lifecycle letters.
 */

import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../helpers/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads/lifecycle-letters');

function ensureDir() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function stripHtml(html = '') {
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' | ')
        .replace(/<\/th>/gi, ' | ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/₹/g, 'Rs.')
        // jsPDF default fonts only support WinAnsi — strip unsupported glyphs
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
        .replace(/\|(\s*\|)+/g, '|')
        .trim();
}

export function applyPlaceholders(template, data = {}) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const token = key.startsWith('{{') ? key : `{{${key}}}`;
        result = result.split(token).join(value ?? '');
    }
    return result;
}

export function buildLetterHtml({ headerHtml, bodyHtml, footerHtml, data = {} }) {
    const header = headerHtml ? applyPlaceholders(headerHtml, data) : '';
    const body = applyPlaceholders(bodyHtml || '', data);
    const footer = footerHtml ? applyPlaceholders(footerHtml, data) : '';
    return `${header}${body}${footer}`;
}

export async function generateLetterPdf({
    organizationId,
    prefix = 'letter',
    title,
    bodyHtml,
    headerHtml,
    footerHtml,
    fileName,
    watermarkText,
    includePageNumbers = true,
}) {
    ensureDir();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;
    const pageWidth = 210;

    if (headerHtml) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const headerText = stripHtml(headerHtml);
        const headerLines = doc.splitTextToSize(headerText, 180);
        for (const line of headerLines.slice(0, 4)) {
            doc.text(line, margin, y);
            y += 5;
        }
        y += 4;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(stripHtml(title || 'Letter'), margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const text = stripHtml(bodyHtml);
    const lines = doc.splitTextToSize(text, 180);
    for (const line of lines) {
        if (y > 280) {
            if (includePageNumbers) {
                doc.setFontSize(9);
                doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin - 20, 290);
            }
            doc.addPage();
            y = margin;
            if (watermarkText) {
                doc.setTextColor(200, 200, 200);
                doc.setFontSize(40);
                doc.text(watermarkText, 40, 150, { angle: 45 });
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(11);
            }
        }
        doc.text(line, margin, y);
        y += 6;
    }

    if (footerHtml) {
        y += 8;
        if (y > 260) { doc.addPage(); y = margin; }
        doc.setFontSize(9);
        const footerText = stripHtml(footerHtml);
        const footerLines = doc.splitTextToSize(footerText, 180);
        for (const line of footerLines.slice(0, 3)) {
            doc.text(line, margin, y);
            y += 5;
        }
    }

    if (includePageNumbers) {
        doc.setFontSize(9);
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin - 20, 290);
    }

    const safeName = String(fileName || `${prefix}-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const orgDir = path.join(UPLOAD_DIR, String(organizationId));
    if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true });
    const fullPath = path.join(orgDir, safeName);
    const buffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(fullPath, buffer);

    const relativeUrl = `/uploads/lifecycle-letters/${organizationId}/${safeName}`;
    logger.info('Lifecycle letter PDF generated', { relativeUrl });
    return { pdfUrl: relativeUrl, pdfFileName: safeName, fullPath, url: relativeUrl, fileName: safeName };
}

export default { generateLetterPdf, applyPlaceholders, stripHtml };
