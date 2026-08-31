/**
 * Builds the printable HTML document for a learning completion certificate.
 * Rendered to PDF by renderHtmlToPdfBuffer (Puppeteer), so every style is inline
 * and every colour is a hex value — the PDF pipeline has no Tailwind available.
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const BRAND_NAME = 'paarsiv';
// Letters highlighted in the primary colour, mirroring the app header wordmark.
const BRAND_ACCENT_INDEXES = new Set([0, 4]);
const BRAND_PRIMARY = '#20C997';
const BRAND_DARK = '#1e293b';

const escapeHtml = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]
    );

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

/**
 * Puppeteer renders from setContent with no page origin, so relative /uploads
 * paths cannot resolve. Inline the logo bytes instead.
 */
const inlineLogoDataUrl = (storedUrl) => {
    try {
        if (!storedUrl || typeof storedUrl !== 'string') return null;
        if (storedUrl.startsWith('data:')) return storedUrl;

        const cleanUrl = storedUrl.split('?')[0].trim();
        if (!cleanUrl.startsWith('/')) return null;

        const rel = cleanUrl.replace(/^\//, '');
        const candidates = [
            path.join(process.cwd(), rel),
            path.join(process.cwd(), 'public', rel),
            path.join(process.cwd(), '..', rel),
            path.join(process.cwd(), '..', 'public', rel)
        ];

        const filePath = candidates.find((candidate) => fs.existsSync(candidate));
        if (!filePath) return null;

        const ext = path.extname(filePath).toLowerCase();
        const mimeByExt = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        const mime = mimeByExt[ext];
        if (!mime) return null;

        return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
    } catch (error) {
        logger.warn('Failed to inline organization logo for certificate PDF', {
            error: error.message,
            storedUrl
        });
        return null;
    }
};

const brandWordmarkHtml = () =>
    `<h2 class="brand">${BRAND_NAME
        .split('')
        .map(
            (letter, index) =>
                `<span style="color:${
                    BRAND_ACCENT_INDEXES.has(index) ? BRAND_PRIMARY : BRAND_DARK
                }">${letter}</span>`
        )
        .join('')}</h2>`;

/** Safe file name for the Content-Disposition header. */
export const buildCertificateFileName = (certificate) => {
    const parts = ['Certificate', certificate?.courseTitle, certificate?.employeeName]
        .filter(Boolean)
        .join('-');
    const safe = parts.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${safe || 'Certificate'}.pdf`;
};

export const buildLearningCertificateHtml = (certificate = {}) => {
    const logoDataUrl = inlineLogoDataUrl(certificate.organizationLogo);
    const brandMark = logoDataUrl
        ? `<img class="logo" src="${logoDataUrl}" alt="${escapeHtml(
            certificate.organizationName || 'Organization'
        )}" />`
        : brandWordmarkHtml();

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Certificate — ${escapeHtml(certificate.courseTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { box-sizing: border-box; width: 100%; height: 100vh; padding: 42px; display: flex; }
  .frame { flex: 1; border: 10px solid ${BRAND_PRIMARY}; outline: 1px solid #0d9488; padding: 40px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
  .brand { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 34px; letter-spacing: -.01em; margin: 0 0 4px; }
  .logo { max-height: 54px; max-width: 260px; object-fit: contain; margin: 0 auto 4px; display: block; }
  h1 { font-size: 42px; margin: 16px 0 6px; letter-spacing: .04em; }
  .sub { font-size: 15px; color: #475569; font-style: italic; margin: 6px 0; }
  .name { font-size: 36px; margin: 22px 0 8px; border-bottom: 2px solid #cbd5e1; display: inline-block; padding: 0 32px 8px; }
  .course { font-size: 23px; font-weight: bold; margin: 16px 0 4px; }
  .meta { margin-top: 30px; display: flex; justify-content: space-between; font-size: 13px; color: #475569; }
  .meta div { text-align: center; flex: 1; }
  .meta strong { display: block; color: #0f172a; font-size: 15px; margin-bottom: 4px; }
  .id { margin-top: 22px; font-size: 11px; color: #94a3b8; letter-spacing: .08em; }
</style>
</head>
<body>
  <!-- letter-body marks the content for the jsPDF fallback used when Chromium is unavailable. -->
  <div class="sheet"><div class="letter-body frame">
    ${brandMark}
    <h1>Certificate of Completion</h1>
    <p class="sub">This is to certify that</p>
    <p class="name">${escapeHtml(certificate.employeeName)}</p>
    <p class="sub">has successfully completed the course</p>
    <p class="course">${escapeHtml(certificate.courseTitle)}</p>
    ${certificate.courseProvider ? `<p class="sub">delivered by ${escapeHtml(certificate.courseProvider)}</p>` : ''}
    <div class="meta">
      <div><strong>${escapeHtml(formatDate(certificate.completedDate))}</strong>Completed on</div>
      <div><strong>${escapeHtml(formatDate(certificate.issuedDate))}</strong>Issued on</div>
      <div><strong>${escapeHtml(certificate.expiryDate ? formatDate(certificate.expiryDate) : 'No expiry')}</strong>Valid until</div>
    </div>
    <p class="id">Certificate ID: ${escapeHtml(certificate.certificateId)}</p>
  </div></div>
</body>
</html>`;
};

export default { buildLearningCertificateHtml, buildCertificateFileName };
