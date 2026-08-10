/**
 * Light HTML post-processing for offer letter presentation (preview + PDF).
 * Improves typography and structure without changing placeholder content.
 */

import { normalizeRichHtml } from './normalizeRichHtml.js';

const SECTION_TITLES = new Set([
    'POSITION DETAILS',
    'COMPENSATION',
    'TERMS OF EMPLOYMENT',
    'CONFIDENTIALITY',
    'INTELLECTUAL PROPERTY',
    'ACCEPTANCE',
]);

const COMPENSATION_LABELS = new Set([
    'basic salary', 'hra', 'special allowance', 'gross salary',
    'employee pf', 'employee esi', 'employer pf', 'employer esi',
    'gratuity', 'total ctc', 'annual ctc', 'component', 'amount',
]);

/** Decode entities including double-encoded forms (e.g. &amp;nbsp; → space). */
function decodeHtmlEntities(text = '') {
    let value = String(text);
    for (let i = 0; i < 5; i += 1) {
        const next = value
            // Double-encoded nbsp must be handled before bare &amp; → &
            .replace(/&amp;nbsp;?/gi, ' ')
            .replace(/&amp;ensp;?/gi, ' ')
            .replace(/&amp;emsp;?/gi, ' ')
            .replace(/&amp;#160;/gi, ' ')
            .replace(/&amp;#x0*a0;/gi, ' ')
            .replace(/&nbsp;?/gi, ' ')
            .replace(/&ensp;?/gi, ' ')
            .replace(/&emsp;?/gi, ' ')
            .replace(/&#160;/g, ' ')
            .replace(/&#8194;/g, ' ')
            .replace(/&#8195;/g, ' ')
            .replace(/&#x0*a0;/gi, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/\u2002/g, ' ')
            .replace(/\u2003/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/gi, "'");
        if (next === value) break;
        value = next;
    }
    return value;
}

function stripTags(text = '') {
    return decodeHtmlEntities(String(text).replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeDisplayText(text = '') {
    return stripTags(text);
}

/**
 * Escape plain text for HTML text nodes.
 * Input MUST already be entity-decoded; otherwise "&nbsp;" becomes "&amp;nbsp;"
 * and Puppeteer renders the literal characters "&nbsp;".
 */
function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function safeDisplayText(text = '') {
    // Decode first so escapeHtml never double-encodes &nbsp; → &amp;nbsp;
    return escapeHtml(normalizeDisplayText(text));
}

function stripBoldTags(html = '') {
    return String(html).replace(/<\/?(?:b|strong)\b[^>]*>/gi, '');
}

/** Remove <style> blocks so CSS never appears as document text (contentEditable often strips tags and leaves CSS source). */
function stripEmbeddedStyles(html = '') {
    return String(html)
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<link\b[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*>/gi, '');
}

/** Detect CSS source that leaked into visible paragraphs/raw text. */
export function looksLikeCssSourceText(text = '') {
    const plain = decodeHtmlEntities(String(text || '').replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
    if (!plain) return false;
    if (/^\.[a-zA-Z_-][\w-]*\s*\{/.test(plain)) return true;
    if (/^[.#]?[a-zA-Z_-][\w-]*\s*\{[^}]*\}$/.test(plain) && /:/.test(plain)) return true;
    if (/^(max-width|min-width|margin|padding|font-family|font-size|font-weight|line-height|box-sizing|background(-color)?|color|border(-[\w-]+)?|width|height|display|text-align|letter-spacing|white-space)\s*:\s*[^;{]+;?\s*$/i.test(plain)) {
        return true;
    }
    if (plain === '{' || plain === '}') return true;
    const cssKeywordHits = (plain.match(/\b(max-width|margin|padding|font-family|font-size|line-height|box-sizing|border-collapse)\b/gi) || []).length;
    const punctHits = (plain.match(/[{;}]/g) || []).length;
    if (cssKeywordHits >= 2 && punctHits >= 2 && !/<[a-z][\s\S]*>/i.test(String(text))) {
        return true;
    }
    return false;
}

/** Collapse editor line breaks and nbsp padding into normal flowing text. */
function normalizeInlineHtml(html = '') {
    return decodeHtmlEntities(stripBoldTags(html))
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isSectionTitle(text) {
    const plain = stripTags(text);
    if (!plain || plain.length > 50) return false;
    if (SECTION_TITLES.has(plain.toUpperCase())) return true;
    // Do not treat company legal names as section headings
    if (/PRIVATE\s+LIMITED|PVT\.?\s*LTD|TECHNOLOGIES|SOLUTIONS|CORPORATION/i.test(plain)) return false;
    return plain === plain.toUpperCase()
        && /[A-Z]/.test(plain)
        && !plain.includes(':')
        && plain.length >= 8
        && plain.length <= 40;
}

function parseKeyValue(text) {
    const plain = normalizeDisplayText(text);
    const match = plain.match(/^([A-Za-z][A-Za-z\s/&]{0,34}):\s*(.*)$/);
    if (!match) return null;
    const label = match[1].trim();
    const labelKey = label.toLowerCase();
    if (['dear', 'subject', 'to', 'date', 'signature', 'candidate name'].includes(labelKey)) return null;
    const value = match[2].trim();
    return { label, value };
}

function isCompanyName(plain, index) {
    if (/^Dear\s+/i.test(plain)) return false;
    if (/^Date:\s*/i.test(plain)) return false;
    if (/^Subject:\s*/i.test(plain)) return false;
    if (/^To,?\s*$/i.test(plain)) return false;
    if (/^OFFER OF EMPLOYMENT$/i.test(plain)) return false;
    if (/PRIVATE\s+LIMITED|PVT\.?\s*LTD|TECHNOLOGIES/i.test(plain) && plain.length >= 8) return true;
    if (index === 1 && plain === plain.toUpperCase() && plain.length >= 8 && !plain.includes(':')) return true;
    return false;
}

function classifyParagraph({ index, plain, inner }, state) {
    const unwrapped = normalizeInlineHtml(inner);

    if (looksLikeCssSourceText(plain) || looksLikeCssSourceText(inner)) {
        return { type: 'skip' };
    }
    if (/^OFFER OF EMPLOYMENT$/i.test(plain)) return { type: 'doc_title', html: 'OFFER OF EMPLOYMENT' };
    if (isSectionTitle(inner)) {
        state.afterTo = false;
        state.currentSection = plain.toUpperCase();
        return { type: 'section_title', html: safeDisplayText(plain) };
    }
    if (isCompanyName(plain, index)) return { type: 'company_name', html: safeDisplayText(plain) };
    if (/LOOK\s+FORWARD\s+TO\s+WELCOMING/i.test(plain) || /^WE\s+LOOK\s+FORWARD\b/i.test(plain)) {
        state.afterTo = false;
        return { type: 'closing_message', html: safeDisplayText(unwrapped || plain) };
    }
    if (/^Date:\s*/i.test(plain)) {
        const value = plain.replace(/^Date:\s*/i, '');
        if (state.currentSection === 'ACCEPTANCE') {
            return {
                type: 'signature_field',
                html: `<span class="offer-label">Date:</span> ${safeDisplayText(value)}`,
            };
        }
        return { type: 'date_line', html: `<span class="offer-label">Date:</span> ${safeDisplayText(value)}` };
    }
    if (/^Subject:\s*/i.test(plain)) {
        const value = plain.replace(/^Subject:\s*/i, '');
        return { type: 'subject_line', html: `<span class="offer-label">Subject:</span> ${safeDisplayText(value)}` };
    }
    if (/^To,?\s*$/i.test(plain)) return { type: 'recipient_label', html: 'To:' };
    if (/^Dear\s+/i.test(plain)) {
        state.afterTo = false;
        return { type: 'salutation', html: safeDisplayText(plain) };
    }
    if (state.afterTo && !plain.includes(':') && state.recipientLines < 3) {
        state.recipientLines += 1;
        return { type: 'recipient_detail', html: safeDisplayText(plain) };
    }
    const kv = parseKeyValue(inner);
    if (kv) {
        state.afterTo = false;
        return { type: 'kv_line', kv, section: state.currentSection };
    }
    if (/^For\s+/i.test(plain) || /^Authorized Signatory/i.test(plain) || /^HR\s*&/i.test(plain)) {
        return { type: 'signature_line', html: safeDisplayText(plain) };
    }
    if (/^Signature:/i.test(plain) || /^Candidate Name:/i.test(plain)) {
        let html = safeDisplayText(plain);
        if (/^Signature:\s*$/i.test(plain) || /^Signature:\s*_+\s*$/i.test(plain)) {
            html = '<span class="offer-label">Signature:</span> <span class="offer-signature-line-rule"></span>';
        } else if (/^Signature:/i.test(plain)) {
            const rest = plain.replace(/^Signature:\s*/i, '').replace(/_+/g, '').trim();
            html = rest
                ? `<span class="offer-label">Signature:</span> ${safeDisplayText(rest)}`
                : '<span class="offer-label">Signature:</span> <span class="offer-signature-line-rule"></span>';
        } else if (/^Candidate Name:/i.test(plain)) {
            const rest = plain.replace(/^Candidate Name:\s*/i, '');
            html = `<span class="offer-label">Candidate Name:</span> ${safeDisplayText(rest)}`;
        }
        return { type: 'signature_field', html };
    }
    state.afterTo = false;
    return { type: 'paragraph', html: safeDisplayText(unwrapped || plain) };
}

function renderClassifiedItem(item) {
    switch (item.type) {
        case 'skip':
            return '';
        case 'company_name':
            return `<p class="offer-company-name">${item.html}</p>`;
        case 'doc_title':
            return `<p class="offer-doc-title">${item.html}</p>`;
        case 'date_line':
            return `<p class="offer-meta-line">${item.html}</p>`;
        case 'subject_line':
            return `<p class="offer-subject">${item.html}</p>`;
        case 'recipient_label':
            return `<p class="offer-recipient-label">${item.html}</p>`;
        case 'recipient_detail':
            return `<p class="offer-recipient-detail">${item.html}</p>`;
        case 'salutation':
            return `<p class="offer-salutation">${item.html}</p>`;
        case 'section_title':
            return `<p class="offer-section-title">${item.html}</p>`;
        case 'closing_message':
            return `<p class="offer-closing-message">${item.html}</p>`;
        case 'signature_line':
            return `<p class="offer-signature-line">${item.html}</p>`;
        case 'signature_field':
            return `<p class="offer-signature-field">${item.html}</p>`;
        case 'paragraph':
        default:
            return `<p class="offer-paragraph">${item.html}</p>`;
    }
}

function isTotalRow(label) {
    return /total\s*ctc|annual\s*ctc/i.test(label);
}

function flushKvBuffer(buffer, section) {
    if (!buffer.length) return '';

    const isCompensation = section === 'COMPENSATION'
        || buffer.every((row) => COMPENSATION_LABELS.has(row.kv.label.toLowerCase())
            || isTotalRow(row.kv.label));

    if (isCompensation) {
        const rows = buffer.map(({ kv }) => {
            const total = isTotalRow(kv.label);
            const rowClass = total ? ' class="offer-total-row"' : '';
            return `<tr${rowClass}><td class="offer-td-label">${safeDisplayText(kv.label)}</td><td class="offer-td-value offer-amount">${safeDisplayText(kv.value)}</td></tr>`;
        }).join('');
        return `<table class="offer-data-table offer-comp-table"><thead><tr><th>Component</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    const rows = buffer.map(({ kv }) => {
        const total = isTotalRow(kv.label);
        const rowClass = total ? ' class="offer-total-row"' : '';
        return `<tr${rowClass}><td class="offer-td-label">${safeDisplayText(kv.label)}</td><td class="offer-td-value">${safeDisplayText(kv.value)}</td></tr>`;
    }).join('');
    return `<table class="offer-data-table offer-info-table"><tbody>${rows}</tbody></table>`;
}

function preprocessHeadings(doc) {
    return doc
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `<p class="offer-company-name">${safeDisplayText(inner)}</p>`)
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => {
            const plain = stripTags(inner);
            if (/OFFER OF EMPLOYMENT/i.test(plain)) {
                return '<p class="offer-doc-title">OFFER OF EMPLOYMENT</p>';
            }
            return `<p class="offer-section-title">${safeDisplayText(inner)}</p>`;
        })
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `<p class="offer-section-title">${safeDisplayText(inner)}</p>`);
}

function enhanceExistingTables(doc) {
    return doc.replace(/<table(\s[^>]*)?>/gi, (match, attrs = '') => {
        if (/class=["'][^"']*offer-data-table/.test(match)) return match;
        if (/class=/.test(attrs || '')) {
            return match.replace(/class=(["'])([^"']*)\1/, 'class=$1$2 offer-data-table$1');
        }
        return '<table class="offer-data-table">';
    });
}

function cleanTableCellContent(doc) {
    return doc.replace(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
        if (/<(?:table|tr|td|th)\b/i.test(inner)) return full;
        const cleaned = safeDisplayText(inner);
        return `<${tag}${attrs}>${cleaned}</${tag}>`;
    });
}

function parseDocumentParts(doc) {
    const parts = [];
    let lastIndex = 0;
    const regex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = regex.exec(doc)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ kind: 'raw', html: doc.slice(lastIndex, match.index) });
        }
        parts.push({ kind: 'p', inner: match[2] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < doc.length) {
        parts.push({ kind: 'raw', html: doc.slice(lastIndex) });
    }
    return parts;
}

export function enhanceOfferLetterHtml(html) {
    let doc = normalizeRichHtml(html);
    if (!doc) return doc;

    // Strip template <style> blocks — styling comes from OFFER_LETTER_PRESENTATION_STYLES only
    doc = stripEmbeddedStyles(doc);

    doc = doc
        .replace(/<p>\s*<(?:b|strong)>\s*<br\s*\/?>\s*<\/(?:b|strong)>\s*<\/p>/gi, '')
        .replace(/<p>\s*<(?:b|strong)>\s*<\/(?:b|strong)>\s*<\/p>/gi, '');

    doc = preprocessHeadings(doc);
    doc = enhanceExistingTables(doc);
    doc = cleanTableCellContent(doc);

    const parts = parseDocumentParts(doc);
    const state = { afterTo: false, recipientLines: 0, currentSection: null };
    let paragraphIndex = 0;
    let kvBuffer = [];
    let kvSection = null;
    const output = [];

    const flushKv = () => {
        if (!kvBuffer.length) return;
        output.push(flushKvBuffer(kvBuffer, kvSection));
        kvBuffer = [];
        kvSection = null;
    };

    for (const part of parts) {
        if (part.kind === 'raw') {
            flushKv();
            let raw = stripEmbeddedStyles(part.html);
            // Drop raw fragments that are only leaked CSS source
            if (looksLikeCssSourceText(raw)) continue;
            if (raw.trim()) output.push(raw);
            continue;
        }

        paragraphIndex += 1;
        const plain = stripTags(part.inner);
        if (!plain) continue;
        if (looksLikeCssSourceText(plain)) continue;

        const classified = classifyParagraph({ index: paragraphIndex, plain, inner: part.inner }, state);

        if (classified.type === 'skip') continue;

        if (classified.type === 'recipient_label') {
            state.afterTo = true;
            state.recipientLines = 0;
        }

        if (classified.type === 'kv_line') {
            if (!kvBuffer.length) kvSection = classified.section;
            kvBuffer.push(classified);
            continue;
        }

        flushKv();
        output.push(renderClassifiedItem(classified));
    }

    flushKv();
    return output.join('');
}

export const OFFER_LETTER_PRESENTATION_STYLES = `
.offer-letter-shell {
  background: #eef1f4;
  padding: 18px 12px 24px;
  border-radius: 8px;
}
.offer-letter-html {
  background: #ffffff;
  max-width: 850px;
  margin: 0 auto;
  padding: 45px 55px;
  box-sizing: border-box;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #222222;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  overflow-x: hidden;
}
.offer-letter-html .offer-company-name {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: #1f3f68;
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #c5d0de;
}
.offer-letter-html .offer-doc-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #1f3f68;
  margin: 4px 0 16px;
}
.offer-letter-html .offer-meta-line,
.offer-letter-html .offer-subject {
  margin: 0 0 8px;
  color: #222222;
  font-size: 14px;
}
.offer-letter-html .offer-subject {
  font-weight: 700;
}
.offer-letter-html .offer-label {
  font-weight: 700;
  color: #222222;
}
.offer-letter-html .offer-recipient-label {
  margin: 12px 0 2px;
  font-weight: 700;
}
.offer-letter-html .offer-recipient-detail {
  margin: 0 0 2px;
  font-weight: 400;
}
.offer-letter-html .offer-salutation {
  margin: 14px 0 10px;
  font-weight: 400;
}
.offer-letter-html .offer-section-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
  margin-top: 24px;
  margin-bottom: 10px;
  padding-bottom: 4px;
  color: #1f3f68;
  border-bottom: 1px solid #d0d7e2;
  text-transform: uppercase;
  page-break-after: avoid;
  break-after: avoid-page;
}
.offer-letter-html .offer-paragraph {
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 12px;
  font-weight: 400;
  color: #222222;
  text-align: left;
}
.offer-letter-html .offer-closing-message {
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  margin: 20px 0 12px;
  color: #1f3f68;
  page-break-inside: avoid;
}
.offer-letter-html .offer-signature-field {
  margin: 6px 0;
  font-size: 14px;
  font-weight: 400;
  color: #222222;
  page-break-inside: avoid;
}
.offer-letter-html .offer-signature-field + .offer-signature-field {
  margin-top: 8px;
}
.offer-letter-html .offer-signature-line-rule {
  display: inline-block;
  width: 220px;
  max-width: 55%;
  border-bottom: 1px solid #334155;
  margin-left: 6px;
  vertical-align: baseline;
  height: 1em;
}
.offer-letter-html .offer-signature-line {
  margin: 3px 0;
  font-size: 14px;
  font-weight: 400;
  color: #222222;
  page-break-inside: avoid;
}
.offer-letter-html .offer-signature-line:first-of-type,
.offer-letter-html p.offer-signature-line {
  margin-top: 4px;
}
.offer-letter-html p {
  margin: 0 0 12px;
}
.offer-letter-html ul,
.offer-letter-html ol {
  margin: 4px 0 12px 1.25em;
  padding: 0;
}
.offer-letter-html li {
  margin-bottom: 4px;
}
.offer-letter-html table.offer-data-table,
.offer-letter-html table {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  margin: 4px 0 14px;
  font-size: 13px;
  table-layout: fixed;
  page-break-inside: auto;
}
.offer-letter-html table thead {
  display: table-header-group;
}
.offer-letter-html table tr {
  page-break-inside: avoid;
  break-inside: avoid;
}
.offer-letter-html table th,
.offer-letter-html table td {
  border: 1px solid #b8c2ce;
  padding: 7px 10px;
  text-align: left;
  vertical-align: middle;
  line-height: 1.4;
  font-size: 13px;
  background: #fff;
  overflow-wrap: break-word;
}
.offer-letter-html table.offer-info-table td.offer-td-label,
.offer-letter-html table.offer-info-table td:first-child {
  width: 35%;
  font-weight: 600;
  color: #1f2937;
  background: #f8fafc;
}
.offer-letter-html table.offer-info-table td.offer-td-value,
.offer-letter-html table.offer-info-table td:last-child {
  width: 65%;
  font-weight: 400;
}
.offer-letter-html table.offer-comp-table th,
.offer-letter-html table th {
  background: #1f3f68;
  color: #fff;
  font-weight: 600;
  border-color: #1f3f68;
}
.offer-letter-html table.offer-comp-table th:not(:first-child),
.offer-letter-html table.offer-comp-table td:not(:first-child),
.offer-letter-html table.offer-comp-table td.offer-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.offer-letter-html table.offer-comp-table td:first-child {
  width: 42%;
  text-align: left;
  white-space: normal;
}
.offer-letter-html tr.offer-total-row td {
  font-weight: 700;
  background: #eef3f9;
  border-top: 2px solid #1f3f68;
}
.offer-letter-html a {
  color: #1d4ed8;
  text-decoration: underline;
  word-break: break-all;
}
.offer-letter-html strong,
.offer-letter-html b {
  font-weight: 700;
}
@media print {
  .offer-letter-shell {
    background: #fff;
    padding: 0;
    border-radius: 0;
  }
  .offer-letter-html {
    box-shadow: none;
    border: none;
    max-width: none;
    padding: 0;
  }
}
`;

export default { enhanceOfferLetterHtml, OFFER_LETTER_PRESENTATION_STYLES, looksLikeCssSourceText };
