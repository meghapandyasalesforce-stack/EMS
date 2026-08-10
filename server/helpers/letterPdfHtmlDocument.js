/**
 * Builds a complete HTML document for letter/offer PDF rendering.
 * Styles mirror vite_client OfferLetterHtmlPreview for preview/PDF parity.
 *
 * Root cause of edge-hugging PDFs: @page { margin: 0 } with preferCSSPageSize
 * ignored Puppeteer margins. @page must declare real A4 margins.
 */

import { OFFER_LETTER_PRESENTATION_STYLES } from './enhanceOfferLetterHtml.js';
import { repairEscapedHtmlEntities } from './normalizeRichHtml.js';

/** Strip preview-only shell chrome; keep presentation rules for PDF parity. */
function presentationStylesForPdf() {
    return String(OFFER_LETTER_PRESENTATION_STYLES || '')
        .replace(/\.offer-letter-shell\s*\{[^}]*\}/g, '');
}

export const LETTER_PDF_HTML_STYLES = `
@page {
  size: A4;
  margin: 18mm 18mm 18mm 18mm;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #222222;
}
.letter-document {
  position: relative;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.letter-header {
  margin-bottom: 0.85em;
  font-size: 14px;
}
${presentationStylesForPdf()}
.letter-body.offer-letter-html,
.offer-letter-html {
  max-width: 100%;
  width: 100%;
  margin: 0 auto;
  box-shadow: none;
  border: none;
  /* Physical inset comes from @page — avoid double padding vs preview shell */
  padding: 0;
  min-height: auto;
  box-sizing: border-box;
  overflow-wrap: break-word;
  word-wrap: break-word;
  background: #ffffff;
}
@media print {
  .offer-letter-html,
  .letter-body.offer-letter-html {
    max-width: 100%;
    width: 100%;
    margin: 0 auto;
    padding: 0;
    box-shadow: none;
    border: none;
  }
}
.letter-body.offer-letter-html img,
.offer-letter-html img {
  max-width: 100%;
  height: auto;
}
.letter-body.offer-letter-html table,
.offer-letter-html table,
.offer-letter-html table.offer-data-table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin: 10px 0 18px;
  font-size: 13px;
}
.letter-body.offer-letter-html table th,
.letter-body.offer-letter-html table td,
.offer-letter-html table th,
.offer-letter-html table td {
  padding: 8px 10px;
  border: 1px solid #b8c4d1;
  vertical-align: middle;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.offer-letter-html table.offer-info-table td:first-child,
.offer-letter-html table.offer-info-table th:first-child {
  width: 38%;
}
.offer-letter-html table.offer-info-table td:last-child,
.offer-letter-html table.offer-info-table th:last-child {
  width: 62%;
}
/* Prevent salary cells from forcing horizontal overflow on A4 */
.offer-letter-html table.offer-comp-table th:not(:first-child),
.offer-letter-html table.offer-comp-table td:not(:first-child),
.offer-letter-html table.offer-comp-table td.offer-amount {
  white-space: normal;
}
.letter-footer {
  margin-top: 1.25em;
  font-size: 10.5pt;
  color: #444;
  page-break-inside: avoid;
  break-inside: avoid;
}
.letter-watermark {
  position: fixed;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 56px;
  font-weight: 700;
  color: rgba(180, 180, 180, 0.35);
  white-space: nowrap;
  pointer-events: none;
  z-index: 0;
}
.letter-header, .letter-body, .letter-footer {
  position: relative;
  z-index: 1;
}
.page-break {
  page-break-before: always;
  break-before: page;
}
.offer-letter-html h1,
.offer-letter-html h2,
.offer-letter-html h3,
.offer-letter-html .offer-section-title {
  page-break-after: avoid;
  break-after: avoid-page;
}
.offer-letter-html table.offer-data-table thead,
.offer-letter-html table thead {
  display: table-header-group;
}
.offer-letter-html table.offer-data-table tr,
.offer-letter-html table tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
.offer-letter-html .offer-signature-field,
.offer-letter-html .offer-signature-line,
.offer-letter-html .offer-closing-message,
.offer-letter-html .offer-company-name,
.offer-letter-html .offer-doc-title {
  page-break-inside: avoid;
  break-inside: avoid;
}
`;

/**
 * @param {object} options
 * @param {string} [options.headerHtml]
 * @param {string} options.bodyHtml
 * @param {string} [options.footerHtml]
 * @param {string} [options.watermarkText]
 */
export function buildLetterPdfHtmlDocument({
    headerHtml = '',
    bodyHtml = '',
    footerHtml = '',
    watermarkText = '',
}) {
    const watermark = watermarkText
        ? `<div class="letter-watermark">${watermarkText}</div>`
        : '';

    // Repair &amp;nbsp; → &nbsp; so Chromium interprets entities instead of showing them as text.
    // Do not alter CSS, table markup, or layout — only undo double-escaped entities.
    const safeHeader = repairEscapedHtmlEntities(headerHtml || '');
    const safeBody = repairEscapedHtmlEntities(bodyHtml || '');
    const safeFooter = repairEscapedHtmlEntities(footerHtml || '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Letter</title>
  <style>${LETTER_PDF_HTML_STYLES}</style>
</head>
<body>
  <div class="letter-document">
    ${watermark}
    ${safeHeader ? `<div class="letter-header">${safeHeader}</div>` : ''}
    <div class="letter-body offer-letter-html">${safeBody}</div>
    ${safeFooter ? `<div class="letter-footer">${safeFooter}</div>` : ''}
  </div>
</body>
</html>`;
}

export default { buildLetterPdfHtmlDocument, LETTER_PDF_HTML_STYLES };

