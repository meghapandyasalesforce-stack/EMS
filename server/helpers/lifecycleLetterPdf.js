/**
 * PDF generation for offer letters and lifecycle letters.
 * Renders resolved rich HTML via headless Chromium for preview/PDF parity.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../helpers/logger.js';
import { buildLetterPdfHtmlDocument } from './letterPdfHtmlDocument.js';
import { renderHtmlToPdfBuffer } from './htmlToPdfBuffer.js';
import { normalizeRichHtml } from './normalizeRichHtml.js';
import { enhanceOfferLetterHtml } from './enhanceOfferLetterHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads/lifecycle-letters');

function ensureDir() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** @deprecated Plain-text fallback helper — kept for tests/backward compatibility. */
export function stripHtml(html = '') {
    let text = String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' | ')
        .replace(/<\/th>/gi, ' | ')
        .replace(/<[^>]+>/g, '');
    for (let i = 0; i < 5; i += 1) {
        const next = text
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/&#x0*a0;/gi, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
        if (next === text) break;
        text = next;
    }
    return text
        .replace(/₹/g, 'Rs.')
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
    title: _title,
    bodyHtml,
    headerHtml,
    footerHtml,
    fileName,
    watermarkText,
    includePageNumbers = true,
}) {
    ensureDir();

    const resolvedHeader = normalizeRichHtml(headerHtml || '');
    const resolvedBody = enhanceOfferLetterHtml(normalizeRichHtml(bodyHtml || ''));
    const resolvedFooter = normalizeRichHtml(footerHtml || '');

    const htmlDocument = buildLetterPdfHtmlDocument({
        headerHtml: resolvedHeader,
        bodyHtml: resolvedBody,
        footerHtml: resolvedFooter,
        watermarkText,
    });

    // @page { margin: 18mm } in the HTML document provides the A4 inset.
    // marginMm reserves Puppeteer header/footer chrome (page numbers).
    const pdfBuffer = await renderHtmlToPdfBuffer(htmlDocument, {
        includePageNumbers,
        marginMm: 18,
    });

    const safeName = String(fileName || `${prefix}-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const orgDir = path.join(UPLOAD_DIR, String(organizationId));
    if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true });
    const fullPath = path.join(orgDir, safeName);
    fs.writeFileSync(fullPath, pdfBuffer);

    const relativeUrl = `/uploads/lifecycle-letters/${organizationId}/${safeName}`;
    logger.info('Lifecycle letter PDF generated from HTML', { relativeUrl });
    return { pdfUrl: relativeUrl, pdfFileName: safeName, fullPath, url: relativeUrl, fileName: safeName };
}

export default { generateLetterPdf, applyPlaceholders, stripHtml, buildLetterHtml };
