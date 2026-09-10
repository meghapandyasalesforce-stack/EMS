/**
 * Self-Service Document PDF Generator
 * Generates professional PDF documents from templates with employee/org data.
 * Uses jsPDF (proven in the codebase via pdfGenerator.js for payslips).
 *
 * This is a NEW helper — does not modify existing pdfGenerator.js.
 */

import { jsPDF } from 'jspdf';
import logger from './logger.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  heading: { r: 14, g: 43, b: 61 },       // #0e2b3d
  body: { r: 33, g: 37, b: 41 },           // #212529
  light: { r: 102, g: 102, b: 102 },       // #666
  accent: { r: 28, g: 202, b: 155 },       // #1cca9b
  border: { r: 200, g: 200, b: 200 },
};

const PAPER_SIZES = {
  A4: 'a4',
  Letter: 'letter',
  Legal: 'legal',
};

/**
 * Resolve all placeholder tokens in the template body.
 * Supports:
 *   - {{key}} — primary syntax
 *   - [Label] and **[Label]** — bracket syntax (matched via label-to-key mapping)
 */
function resolvePlaceholders(bodyContent, placeholderValues) {
  let resolved = bodyContent;

  // 1. Resolve {{key}} placeholders
  for (const [key, value] of Object.entries(placeholderValues)) {
    const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
    resolved = resolved.replace(regex, value != null ? String(value) : '');
  }

  // 2. Resolve [Label] and **[Label]** patterns using reverse label matching
  const labelMap = buildLabelToValueMap(placeholderValues);
  resolved = resolved.replace(/\*{0,2}\[([^\]]{2,40})\]\*{0,2}/g, (match, label) => {
    // Skip URLs and non-field brackets
    if (label.startsWith('http') || label.startsWith('/')) return match;
    // Skip [Company Stamp] — handled separately as a special placeholder
    if (/^company\s*stamp$/i.test(label.trim())) return match;
    const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (labelMap.has(normalized)) {
      return labelMap.get(normalized);
    }
    // Also try camelCase key directly
    const camelKey = label.replace(/[^a-zA-Z0-9\s]/g, '').trim()
      .split(/\s+/)
      .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
    if (placeholderValues[camelKey] != null && String(placeholderValues[camelKey]).trim()) {
      return String(placeholderValues[camelKey]);
    }
    return match; // Leave unresolved if no match
  });

  // 3. Remove any remaining unresolved {{}} placeholders
  resolved = resolved.replace(/\{\{[^}]+\}\}/g, '');
  return resolved;
}

/**
 * Build a map of normalized label → value for reverse matching [Label] patterns
 */
function buildLabelToValueMap(placeholderValues) {
  const LABEL_ALIASES = {
    'employee name': 'employeeName',
    'candidate name': 'employeeName',
    'full name': 'employeeName',
    'name': 'employeeName',
    'employee id': 'employeeId',
    'emp id': 'employeeId',
    'designation': 'designation',
    'position': 'designation',
    'job title': 'designation',
    'department': 'department',
    'joining date': 'joiningDate',
    'date of joining': 'joiningDate',
    'last working date': 'lastWorkingDate',
    'relieving date': 'lastWorkingDate',
    'end date': 'lastWorkingDate',
    'company name': 'companyName',
    'organization': 'companyName',
    'company address': 'companyAddress',
    'office address': 'companyAddress',
    'email': 'email',
    'phone': 'phone',
    'salary': 'salary',
    'basic salary': 'salary',
    'manager': 'manager',
    'date': 'currentDate',
    'current date': 'currentDate',
    'issue date': 'currentDate',
    'authorized person name': 'authorizedPersonName',
    'authorized person designation': 'authorizedPersonDesignation',
    'signatory name': 'authorizedPersonName',
    'signatory designation': 'authorizedPersonDesignation',
  };

  const map = new Map();
  for (const [label, key] of Object.entries(LABEL_ALIASES)) {
    const value = placeholderValues[key];
    if (value != null && String(value).trim()) {
      map.set(label, String(value));
    }
  }
  return map;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a value based on a format string
 * Supports: 'date:DD MMM YYYY', 'date:YYYY-MM-DD', 'uppercase', 'lowercase'
 */
function formatValue(value, format) {
  if (!value || !format) return value || '';

  if (format.startsWith('date:')) {
    const dateVal = new Date(value);
    if (isNaN(dateVal.getTime())) return String(value);
    const pattern = format.slice(5);
    return formatDatePattern(dateVal, pattern);
  }
  if (format === 'uppercase') return String(value).toUpperCase();
  if (format === 'lowercase') return String(value).toLowerCase();
  return String(value);
}

function formatDatePattern(date, pattern) {
  const day = date.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = date.getMonth();
  const year = date.getFullYear();

  return pattern
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
    .replace('MMMM', monthFull[month])
    .replace('MMM', monthNames[month])
    .replace('MM', String(month + 1).padStart(2, '0'))
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2));
}

/**
 * Build the complete placeholder values map from employee, org, and dynamic field inputs.
 * Priority order (lowest → highest):
 *   1. Convenience shortcuts (auto-populated from employee/org)
 *   2. System placeholders (configured per-template)
 *   3. Dynamic field values (employee-entered — HIGHEST priority)
 */
export function buildPlaceholderValues(template, employee, organization, dynamicFieldValues = {}) {
  const values = {};

  // 1. Common auto-values (lowest priority — can be overridden by anything)
  values.currentDate = formatDatePattern(new Date(), 'DD MMM YYYY');
  values.currentYear = String(new Date().getFullYear());

  // Employee convenience shortcuts
  if (employee) {
    values.employeeName = `${employee.name || ''} ${employee.lastName || ''}`.trim();
    values.employeeId = employee.employeeId || '';
    values.employeeDepartment = employee.department || '';
    values.employeeDesignation = employee.jobTitle || employee.position || '';
    values.employeeEmail = employee.email || '';
    values.joiningDate = employee.joiningDate ? formatDatePattern(new Date(employee.joiningDate), 'DD MMM YYYY') : '';
    values.lastWorkingDate = employee.lastWorkingDate ? formatDatePattern(new Date(employee.lastWorkingDate), 'DD MMM YYYY') : '';
  }

  // Organization convenience shortcuts
  if (organization) {
    values.companyName = organization.name || organization.legalName || '';
    values.companyLegalName = organization.legalName || organization.name || '';
    values.companyAddress = formatOrgAddress(organization);
    values.companyEmail = organization.email || '';
    values.companyPhone = organization.phone || '';
    values.companyWebsite = organization.website || organization.domain || '';
  }

  // 2. System placeholders from template config (override convenience shortcuts)
  for (const sp of (template.systemPlaceholders || [])) {
    let rawValue = '';
    if (sp.source === 'employee' && employee) {
      rawValue = getNestedValue(employee, sp.field);
    } else if (sp.source === 'organization' && organization) {
      rawValue = getNestedValue(organization, sp.field);
    }
    if (rawValue) {
      values[sp.key] = formatValue(rawValue, sp.format);
    }
  }

  // 3. Dynamic fields — employee-provided values (HIGHEST priority — always override)
  for (const df of (template.dynamicFields || [])) {
    const enteredValue = dynamicFieldValues[df.key];
    if (enteredValue != null && String(enteredValue).trim() !== '') {
      values[df.key] = String(enteredValue);
    } else if (!values[df.key]) {
      // Only use default if no value exists yet from system data
      values[df.key] = df.defaultValue || '';
    }
  }

  // 4. Apply ALL remaining dynamicFieldValues directly (covers auto-detected fields
  //    that may not be in template.dynamicFields but are {{placeholders}} in the body)
  for (const [key, val] of Object.entries(dynamicFieldValues)) {
    if (val != null && String(val).trim() !== '') {
      values[key] = String(val);
    }
  }

  return values;
}

function getNestedValue(obj, path) {
  if (!obj || !path) return '';
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return current != null ? current : '';
}

function formatOrgAddress(org) {
  if (!org.address) return '';
  const { street, city, state, country, zipCode } = org.address;
  return [street, city, state, country, zipCode].filter(Boolean).join(', ');
}

/**
 * Sanitize text for PDF output (remove unsupported chars)
 */
function sanitize(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a PDF document from a template with resolved placeholders.
 *
 * @param {Object} template - The DocumentTemplate document
 * @param {Object} employee - Employee record (lean)
 * @param {Object} organization - Organization record (lean)
 * @param {Object} dynamicFieldValues - Values provided by the employee for dynamic fields
 * @param {Object} options - Additional options (e.g., orgLogoBase64)
 * @returns {Promise<Buffer>} PDF as a Buffer
 */
export async function generateDocumentPdf(template, employee, organization, dynamicFieldValues = {}, options = {}) {
  const startTime = Date.now();

  try {
    // Generate the same HTML used for preview
    const previewHtml = generatePreviewHtml(template, employee, organization, dynamicFieldValues, options);

    // Build a full HTML page with embedded CSS for puppeteer to render
    const logoHtml = options.orgLogoBase64
      ? `<img src="${options.orgLogoBase64}" class="header-logo" />`
      : '';

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.7;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }

  /* Header with logo */
  .pdf-header {
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    margin-bottom: 12px;
    min-height: 40px;
  }
  .header-logo {
    max-width: 100px;
    max-height: 60px;
    object-fit: contain;
  }

  /* Document container */
  .document, .document-body {
    line-height: 1.7;
    width: 100%;
  }
  .document-body > *:first-child { margin-top: 0; }
  .document-body img { max-width: 100%; height: auto; }

  /* Logo */
  .document-logo-header { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  .document-org-logo { display: block; max-width: 100px; max-height: 60px; object-fit: contain; }

  /* Typography */
  h1, h2, h3, .document-heading { color: #0f172a; margin: 16px 0 8px; text-align: left; font-weight: 700; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; }
  h3, .document-heading { font-size: 12pt; }
  p { margin: 0 0 10px; text-align: left; }
  strong, b { font-weight: 700; }
  .document-closing { margin: 20px 0 8px; text-align: left; }

  /* Document classes used by admin templates */
  .document-header { text-align: left; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a; }
  .company-name { font-size: 16pt; font-weight: 700; color: #0f172a; text-align: left; }
  .company-address { font-size: 9pt; color: #475569; margin-top: 4px; text-align: left; }
  .document-title { text-align: center; font-size: 15pt; font-weight: 700; margin: 8px 0 16px; text-transform: uppercase; letter-spacing: 0.04em; color: #0f172a; }
  .document-date { font-size: 10pt; color: #475569; margin: 8px 0; text-align: left; }
  .document-ref { font-size: 9pt; color: #64748b; margin-bottom: 16px; text-align: left; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; font-size: 9pt; text-transform: uppercase; }

  /* Signature */
  .signature-section, .document-signature { margin-top: 36px; page-break-inside: avoid; text-align: left; }
  .signature-line { border-top: 1px solid #1a1a1a; width: 220px; max-width: 100%; margin-top: 36px; padding-top: 8px; text-align: left; }
  .signatory-name { font-weight: 700; margin: 0 0 2px; font-size: 11pt; text-align: left; }
  .signatory-designation, .signatory-company { color: #475569; font-size: 9.5pt; margin: 0 0 2px; text-align: left; }

  /* Stamp */
  .stamp-section { margin: 12px 0 10px; text-align: left; }
  .company-stamp {
    display: block;
    max-width: 100px;
    max-height: 70px;
    width: auto;
    height: auto;
    object-fit: contain;
    margin: 0;
  }

  /* Footer */
  .document-footer { margin-top: 36px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }

  /* Horizontal rules */
  hr, .document-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
</style>
</head>
<body>
  ${logoHtml ? `<div class="pdf-header">${logoHtml}</div>` : ''}
  ${previewHtml}
</body>
</html>`;

    // Use puppeteer to render HTML to PDF
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: false,
    });

    await browser.close();

    const buffer = Buffer.from(pdfBuffer);

    logger.info('Self-service document PDF generated', {
      templateId: template._id,
      documentType: template.documentType,
      employeeId: employee?._id,
      size: buffer.length,
      durationMs: Date.now() - startTime,
    });

    return buffer;
  } catch (error) {
    logger.error('Failed to generate document PDF', {
      error: error.message,
      stack: error.stack,
      templateId: template?._id,
    });
    throw error;
  }
}

// ─── Render Helpers ──────────────────────────────────────────────────────────

function renderLetterhead(doc, organization, options, marginLeft, marginRight, pageWidth, yPos) {
  const orgName = sanitize(organization?.name || organization?.legalName || 'Organization');
  const orgAddress = sanitize(formatOrgAddress(organization || {}));
  const orgEmail = organization?.email || '';
  const orgPhone = organization?.phone || '';

  // Logo
  if (options.orgLogoBase64) {
    try {
      const logoSize = 18;
      doc.addImage(options.orgLogoBase64, options.orgLogoFormat || 'PNG', marginLeft, yPos - 5, logoSize, logoSize);
      // Company name next to logo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(COLORS.heading.r, COLORS.heading.g, COLORS.heading.b);
      doc.text(orgName, marginLeft + 22, yPos + 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
      if (orgAddress) doc.text(orgAddress, marginLeft + 22, yPos + 8);
      const contactLine = [orgEmail, orgPhone].filter(Boolean).join(' | ');
      if (contactLine) doc.text(contactLine, marginLeft + 22, yPos + 12);

      yPos += 20;
    } catch (e) {
      logger.warn('Could not embed org logo in document', { error: e.message });
      yPos = renderTextLetterhead(doc, orgName, orgAddress, orgEmail, orgPhone, marginLeft, pageWidth, yPos);
    }
  } else {
    yPos = renderTextLetterhead(doc, orgName, orgAddress, orgEmail, orgPhone, marginLeft, pageWidth, yPos);
  }

  // Separator line
  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 5;

  return yPos;
}

function renderTextLetterhead(doc, orgName, orgAddress, orgEmail, orgPhone, marginLeft, pageWidth, yPos) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(COLORS.heading.r, COLORS.heading.g, COLORS.heading.b);
  doc.text(orgName, marginLeft, yPos + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
  if (orgAddress) doc.text(orgAddress, marginLeft, yPos + 8);
  const contactLine = [orgEmail, orgPhone].filter(Boolean).join(' | ');
  if (contactLine) doc.text(contactLine, marginLeft, yPos + 12);

  return yPos + 18;
}

/**
 * Add page number at the bottom center of the current page
 */
function addPageNumber(doc, pageWidth, pageHeight, marginBottom, fontFamily) {
  const pageCount = doc.internal.getNumberOfPages();
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const text = pageCount > 1 ? `Page ${currentPage} of ${pageCount}` : '';
  if (text) {
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, pageHeight - marginBottom + 10);
  }
}

function renderSignature(doc, signature, options, marginLeft, pageWidth, pageHeight, marginBottom, yPos, fontFamily, fontSize) {
  // Ensure enough space for signature at bottom
  const signatureHeight = 35;
  if (yPos + signatureHeight > pageHeight - marginBottom) {
    doc.addPage();
    yPos = 30;
  }

  yPos += 15; // spacing before signature

  // Signature image if available
  if (options.signatureImageBase64) {
    try {
      doc.addImage(options.signatureImageBase64, 'PNG', marginLeft, yPos, 40, 15);
      yPos += 18;
    } catch (e) {
      logger.warn('Could not embed signature image', { error: e.message });
    }
  }

  // Signature line
  doc.setDrawColor(COLORS.body.r, COLORS.body.g, COLORS.body.b);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, yPos, marginLeft + 50, yPos);
  yPos += 5;

  // Signatory details
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(COLORS.body.r, COLORS.body.g, COLORS.body.b);
  if (signature.signatoryName) {
    doc.text(sanitize(signature.signatoryName), marginLeft, yPos);
    yPos += 5;
  }

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(fontSize - 1);
  doc.setTextColor(COLORS.light.r, COLORS.light.g, COLORS.light.b);
  if (signature.signatoryDesignation) {
    doc.text(sanitize(signature.signatoryDesignation), marginLeft, yPos);
    yPos += 5;
  }
  if (signature.companyName) {
    doc.text(sanitize(signature.companyName), marginLeft, yPos);
    yPos += 5;
  }

  // Company stamp if available
  if (options.stampImageBase64) {
    try {
      yPos += 5;
      const stampFormat = (options.stampMimeType || '').includes('png') ? 'PNG' : 'JPEG';
      // Render stamp with preserved aspect ratio (max 30x30mm)
      const maxStampSize = 30;
      let stampW = maxStampSize;
      let stampH = maxStampSize;
      if (options.stampWidth && options.stampHeight && options.stampWidth > 0 && options.stampHeight > 0) {
        const ratio = options.stampWidth / options.stampHeight;
        if (ratio >= 1) {
          stampW = maxStampSize;
          stampH = maxStampSize / ratio;
        } else {
          stampH = maxStampSize;
          stampW = maxStampSize * ratio;
        }
      }
      doc.addImage(options.stampImageBase64, stampFormat, marginLeft, yPos, stampW, stampH);
      yPos += stampH + 3;
    } catch (e) {
      logger.warn('Could not embed company stamp', { error: e.message });
    }
  }

  return yPos;
}

/**
 * Generate a preview HTML string (for frontend preview without PDF download).
 * Supports plain text, markdown (**bold** / newlines), and HTML template bodies.
 */
export function generatePreviewHtml(template, employee, organization, dynamicFieldValues = {}, options = {}) {
  const placeholderValues = buildPlaceholderValues(template, employee, organization, dynamicFieldValues);

  const sig = template.signature || {};
  const stampEnabled = Boolean(sig.stampEnabled && options.stampImageBase64);
  const STAMP_MARKER = '[[[COMPANY_STAMP_IMAGE]]]';
  const stampImg = stampEnabled
    ? `<img src="${options.stampImageBase64}" alt="Company Stamp" class="company-stamp" />`
    : '';

  placeholderValues.companyStamp = stampEnabled ? STAMP_MARKER : '';

  if (sig.signatoryName) placeholderValues.authorizedPersonName = sig.signatoryName;
  if (sig.signatoryDesignation) placeholderValues.authorizedPersonDesignation = sig.signatoryDesignation;
  if (sig.signatoryDepartment) placeholderValues.authorizedPersonDepartment = sig.signatoryDepartment;

  const resolvedBody = resolvePlaceholders(template.bodyContent, placeholderValues);
  // Decode entities first so escaped HTML templates (&lt;div&gt;) become real tags before format detection
  const decodedBody = decodeHtmlEntities(resolvedBody);

  let processedBody = decodedBody;
  const stampPlaceholderRegex = /\*{0,2}\[Company\s*Stamp\]\*{0,2}/gi;
  const bodyHadStampPlaceholder = /\[Company\s*Stamp\]/i.test(decodedBody)
    || /\{\{\s*companyStamp\s*\}\}/i.test(template.bodyContent || '');

  processedBody = processedBody.replace(
    stampPlaceholderRegex,
    stampEnabled ? STAMP_MARKER : ''
  );

  const originalBody = template.bodyContent || '';
  // Detect HTML on original + decoded body (covers both raw and entity-escaped templates)
  const structuredHtml = isStructuredHtmlBody(originalBody) || isStructuredHtmlBody(decodedBody);
  const bodyHasSignature = bodyLooksLikeItHasSignature(originalBody, bodyHadStampPlaceholder)
    || bodyLooksLikeItHasSignature(decodedBody, bodyHadStampPlaceholder);

  let html = '';
  if (options.orgLogoBase64) {
    html += `<div class="document-logo-header"><img src="${options.orgLogoBase64}" alt="Organization Logo" class="document-org-logo" /></div>`;
  }

  let bodyHtml = '';
  if (structuredHtml) {
    bodyHtml = formatStructuredHtmlBody(processedBody, {
      stampEnabled,
      bodyHadStampPlaceholder,
      STAMP_MARKER,
    });
  } else {
    bodyHtml = formatPlainOrMarkdownBody(processedBody, STAMP_MARKER);
  }

  html += `<div class="document-body">${bodyHtml}</div>`;

  if (sig.enabled && !bodyHasSignature) {
    html += `<div class="document-signature">`;
    if (stampEnabled && !bodyHadStampPlaceholder && !html.includes(STAMP_MARKER)) {
      html += `<div class="stamp-section">${STAMP_MARKER}</div>`;
    }
    html += `<div class="signature-line">`;
    if (sig.signatoryName) html += `<p class="signatory-name">${escapeHtml(sig.signatoryName)}</p>`;
    if (sig.signatoryDesignation) html += `<p class="signatory-designation">${escapeHtml(sig.signatoryDesignation)}</p>`;
    if (sig.companyName) html += `<p class="signatory-company">${escapeHtml(sig.companyName)}</p>`;
    html += `</div></div>`;
  }

  if (stampEnabled) {
    html = html.split(STAMP_MARKER).join(stampImg);
  } else {
    html = html.split(STAMP_MARKER).join('');
  }

  return html;
}

/** True when body contains HTML markup (raw or entity-escaped). */
function isStructuredHtmlBody(bodyContent) {
  if (!bodyContent) return false;
  // Entity-escaped HTML stored in DB (e.g. &lt;div class="document-title"&gt;)
  if (/&lt;\/?[a-z][\s\S]*?&gt;/i.test(bodyContent)) return true;

  const decoded = decodeHtmlEntities(bodyContent);
  // Any real HTML tag → use HTML renderer (don't escape tags as visible text)
  if (/<\/?[a-z][^>]*>/i.test(decoded)) return true;

  return false;
}

function bodyLooksLikeItHasSignature(originalBody, bodyHadStampPlaceholder) {
  return /signature[-_]?section/i.test(originalBody)
    || /authorized\s*signatory/i.test(originalBody)
    || /\bsincerely\b/i.test(originalBody)
    || /\byours\s+(truly|faithfully|sincerely)\b/i.test(originalBody)
    || /\bregards\b/i.test(originalBody)
    || /\[Authorized\s*Person[^\]]*\]/i.test(originalBody)
    || /\{\{\s*authorizedPerson(Name|Designation|Department)\s*\}\}/i.test(originalBody)
    || (bodyHadStampPlaceholder && /\bfor\b/i.test(originalBody));
}

function formatPlainOrMarkdownBody(processedBody, STAMP_MARKER) {
  let html = '';
  const normalized = String(processedBody || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n\n+/);

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let blockHtml = '';

    for (const line of lines) {
      const ln = line.trim();
      if (!ln) continue;

      if (ln === STAMP_MARKER || ln.includes(STAMP_MARKER)) {
        blockHtml += `<div class="stamp-section">${STAMP_MARKER}</div>`;
        continue;
      }

      if (/^#{1,3}\s/.test(ln)) {
        const level = (ln.match(/^(#{1,3})/)?.[1] || '#').length;
        const text = ln.replace(/^#{1,3}\s*/, '');
        blockHtml += `<h${level} class="document-heading">${convertInlineFormatting(escapeHtml(text))}</h${level}>`;
        continue;
      }

      const plainCaps = ln.replace(/\*/g, '').trim();
      if (
        plainCaps.length >= 10
        && plainCaps.length < 70
        && plainCaps === plainCaps.toUpperCase()
        && /[A-Z]/.test(plainCaps)
        && !/[a-z]/.test(plainCaps)
      ) {
        blockHtml += `<h3 class="document-title">${convertInlineFormatting(escapeHtml(ln))}</h3>`;
        continue;
      }

      if (/^[-_=*]{3,}$/.test(ln)) {
        blockHtml += '<hr class="document-divider" />';
        continue;
      }

      if (/^(sincerely|regards|yours truly|yours faithfully|best regards|thank you)[,.]?$/i.test(ln.replace(/\*/g, '').trim())) {
        blockHtml += `<p class="document-closing">${convertInlineFormatting(escapeHtml(ln))}</p>`;
        continue;
      }

      blockHtml += `<p>${convertInlineFormatting(escapeHtml(ln))}</p>`;
    }

    html += blockHtml;
  }

  return html;
}

function formatStructuredHtmlBody(processedBody, { stampEnabled, bodyHadStampPlaceholder, STAMP_MARKER }) {
  // Ensure entity-escaped snippets are real tags before rendering
  let html = decodeHtmlEntities(processedBody);
  html = applyMarkdownOutsideHtmlTags(html);

  if (stampEnabled && !bodyHadStampPlaceholder && !html.includes(STAMP_MARKER)) {
    if (html.includes('<!-- Company stamp')) {
      html = html.replace(/<!--\s*Company stamp[^>]*-->/i, STAMP_MARKER);
    } else if (html.includes('stamp-section')) {
      const withStampSection = html.replace(
        /(<div[^>]*class="[^"]*stamp-section[^"]*"[^>]*>)\s*(<\/div>)/i,
        `$1${STAMP_MARKER}$2`
      );
      html = withStampSection !== html
        ? withStampSection
        : `${html}<div class="stamp-section">${STAMP_MARKER}</div>`;
    }
  }

  return html;
}

function applyMarkdownOutsideHtmlTags(html) {
  return String(html || '')
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part || part.startsWith('<')) return part;
      return convertInlineFormatting(part);
    })
    .join('');
}

/**
 * Convert inline markdown-style formatting to HTML
 * Handles: **bold**, *italic*, __underline__
 */
function convertInlineFormatting(text) {
  return String(text || '')
    .replace(/\*\*\*\*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/__([^_]+)__/g, '<u>$1</u>');
}

/**
 * Decode common HTML entities back to actual characters.
 * This handles cases where HTML was accidentally double-escaped during storage.
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
