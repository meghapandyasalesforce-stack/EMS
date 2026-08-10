/**
 * Render HTML to PDF buffer using headless Chromium (Puppeteer).
 * Falls back to jsPDF renderer if Chromium is unavailable.
 */

import { normalizeRichHtml, repairEscapedHtmlEntities } from './normalizeRichHtml.js';
import { renderHtmlToPdfBufferWithJsPdf } from './htmlToJsPdfRenderer.js';
import logger from './logger.js';

let browserPromise = null;
let puppeteerModule = null;

async function loadPuppeteer() {
    if (!puppeteerModule) {
        puppeteerModule = await import('puppeteer');
    }
    return puppeteerModule.default || puppeteerModule;
}

async function launchBrowser() {
    const puppeteer = await loadPuppeteer();
    return puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
        ],
    });
}

async function getBrowser() {
    if (!browserPromise) {
        browserPromise = launchBrowser().catch((error) => {
            browserPromise = null;
            throw error;
        });
    }
    return browserPromise;
}

export async function closePdfBrowser() {
    if (!browserPromise) return;
    try {
        const browser = await browserPromise;
        await browser.close();
    } catch (error) {
        logger.warn('Failed to close PDF browser cleanly', { error: error.message });
    } finally {
        browserPromise = null;
    }
}

async function renderWithPuppeteer(html, { includePageNumbers = true, marginMm = 15 } = {}) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });

        // Letter HTML uses @page { size: A4; margin: 18mm } (see letterPdfHtmlDocument).
        // preferCSSPageSize honors that size. marginMm reserves header/footer chrome
        // for page numbers (lifecycle letters pass 18). Never ship @page { margin: 0 }
        // with preferCSSPageSize — that forced content to the paper edge.
        const margin = `${Number(marginMm) || 0}mm`;
        const footerPadMm = Number(marginMm) > 0 ? marginMm : 18;
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: margin, right: margin, bottom: margin, left: margin },
            displayHeaderFooter: includePageNumbers,
            headerTemplate: '<div></div>',
            footerTemplate: includePageNumbers
                ? `<div style="font-size:9px;width:100%;text-align:right;padding-right:${footerPadMm}mm;color:#666;font-family:Arial,sans-serif;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                   </div>`
                : '<div></div>',
        });
    } finally {
        await page.close();
    }
}

/**
 * @param {string} html - Full HTML document
 * @param {object} [options]
 * @param {boolean} [options.includePageNumbers=true]
 * @param {number} [options.marginMm=15]
 */
export async function renderHtmlToPdfBuffer(html, options = {}) {
    // normalizeRichHtml undoes xss-clean tag encoding; repairEscapedHtmlEntities
    // restores &amp;nbsp; → &nbsp; so Chromium does not paint entities as literal text.
    const normalizedHtml = repairEscapedHtmlEntities(normalizeRichHtml(html));
    try {
        return await renderWithPuppeteer(normalizedHtml, options);
    } catch (error) {
        logger.warn('Puppeteer PDF render failed; falling back to jsPDF HTML renderer', {
            error: error.message,
        });
        return renderHtmlToPdfBufferWithJsPdf(normalizedHtml, options);
    }
}

export default { renderHtmlToPdfBuffer, closePdfBrowser };
