/**
 * ID Card PDF Generator Helper
 * Generates PDF files for employee ID cards — Paarsiv portrait badge design
 */

import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import logger from './logger.js';
import Organization from '../models/organization.model.js';
import { formatOrganizationAddress, isPlaceholderIdCardAddress } from './organizationHelper.js';

/** Brand colors matching physical Paarsiv ID badge reference */
const GREEN = { r: 43, g: 170, b: 117 }; // #2BAA75
const CHARCOAL = { r: 26, g: 26, b: 26 }; // #1A1A1A
const PATTERN = { r: 168, g: 212, b: 188 }; // #A8D4BC
const WHITE = { r: 245, g: 250, b: 247 }; // #F5FAF7 card bg
const FOOTER_BG = { r: 211, g: 211, b: 211 }; // #D3D3D3
const PHOTO_RING = { r: 196, g: 196, b: 196 }; // #C4C4C4

/** In-memory transparent corner pattern (prepared once per process) */
let _patternCache = null;

/**
 * Generate PDF for ID card
 * @param {Object} idCard - ID card document with populated employeeId
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateIdCardPDF = async (idCard) => {
    try {
        const employee = idCard.employeeId || {};
        const cardDesign = idCard.cardDesign || {};

        // Vertical portrait ID card dimensions (ISO ID-1 portrait)
        const width = 53.98;
        const height = 85.6;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [width, height],
        });

        let companyName = String(cardDesign.companyName ?? '').trim();
        let companyAddress = String(cardDesign.companyAddress ?? '').trim();
        if (idCard.organizationId) {
            try {
                const org = await Organization.findById(idCard.organizationId)
                    .select('name address')
                    .lean();
                if (org) {
                    const orgAddr = formatOrganizationAddress(org.address);
                    if (isPlaceholderIdCardAddress(companyAddress) && orgAddr) {
                        companyAddress = orgAddr;
                    }
                    if (!companyName && org.name) {
                        companyName = String(org.name).trim();
                    }
                }
            } catch (orgErr) {
                logger.warn('ID card PDF: organization lookup failed', {
                    error: orgErr.message,
                    organizationId: idCard.organizationId,
                });
            }
        }
        if (!companyName) companyName = 'paarsiv';
        const website =
            companyAddress && /^www\.|^https?:\/\//i.test(companyAddress)
                ? companyAddress.replace(/^https?:\/\//i, '')
                : 'www.paarsiv.com';

        const role = (employee.jobTitle || employee.position || 'Employee').toUpperCase();
        const employeeName =
            `${employee.name || ''} ${employee.lastName || ''}`.trim().toUpperCase() || 'EMPLOYEE';
        const employeeCode = employee.employeeId || idCard.cardNumber || '-';

        const wrapText = (value, maxLen = 28) => {
            const str = String(value || '-');
            if (str.length <= maxLen) return str;
            return `${str.slice(0, maxLen - 1)}...`;
        };

        const [profilePhotoData, patternAsset] = await Promise.all([
            resolveEmployeeProfilePhoto(employee),
            ensureTransparentPattern(),
        ]);

        // Card background
        pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
        pdf.rect(0, 0, width, height, 'F');

        // Corner mesh (transparent PNG — no opaque white blocks)
        const patternDrawn = drawCornerPatternImage(pdf, width, height, patternAsset);
        if (!patternDrawn) {
            drawCornerPattern(pdf, 'top-right', width, height);
            drawCornerPattern(pdf, 'bottom-left', width, height);
        }

        // Logo: p + s green; aar + iv charcoal
        const logoY = 9.2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11.5);
        const pW = pdf.getTextWidth('p');
        const aarW = pdf.getTextWidth('aar');
        const sW = pdf.getTextWidth('s');
        const ivW = pdf.getTextWidth('iv');
        let lx = (width - (pW + aarW + sW + ivW)) / 2;
        pdf.setTextColor(GREEN.r, GREEN.g, GREEN.b);
        pdf.text('p', lx, logoY);
        lx += pW;
        pdf.setTextColor(CHARCOAL.r, CHARCOAL.g, CHARCOAL.b);
        pdf.text('aar', lx, logoY);
        lx += aarW;
        pdf.setTextColor(GREEN.r, GREEN.g, GREEN.b);
        pdf.text('s', lx, logoY);
        lx += sW;
        pdf.setTextColor(CHARCOAL.r, CHARCOAL.g, CHARCOAL.b);
        pdf.text('iv', lx, logoY);

        // Photo well
        const photoR = 13.5;
        const photoCx = width / 2;
        const photoCy = 30.5;
        pdf.setFillColor(PHOTO_RING.r, PHOTO_RING.g, PHOTO_RING.b);
        pdf.circle(photoCx, photoCy, photoR + 1.35, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.circle(photoCx, photoCy, photoR + 0.7, 'F');
        pdf.setFillColor(232, 232, 232);
        pdf.circle(photoCx, photoCy, photoR, 'F');

        if (profilePhotoData) {
            try {
                // True circular crop — jsPDF has no CSS overflow/clip
                const circular = await toCircularPngDataUrl(
                    profilePhotoData.buffer || profilePhotoData.dataUrl
                );
                const box = photoR * 2;
                pdf.addImage(circular, 'PNG', photoCx - photoR, photoCy - photoR, box, box);
                // Clean ring stroke on top
                pdf.setDrawColor(255, 255, 255);
                pdf.setLineWidth(0.55);
                pdf.circle(photoCx, photoCy, photoR + 0.2, 'S');
                pdf.setDrawColor(PHOTO_RING.r, PHOTO_RING.g, PHOTO_RING.b);
                pdf.setLineWidth(0.4);
                pdf.circle(photoCx, photoCy, photoR + 0.95, 'S');
            } catch (photoError) {
                logger.warn('Failed to embed profile photo in ID card PDF', {
                    error: photoError.message,
                    idCardId: idCard?._id,
                });
                pdf.setTextColor(150, 150, 150);
                pdf.setFontSize(3.5);
                pdf.text('PHOTO', photoCx, photoCy + 0.5, { align: 'center' });
            }
        } else {
            pdf.setTextColor(176, 176, 176);
            pdf.setFontSize(3.5);
            pdf.text('PHOTO', photoCx, photoCy + 0.5, { align: 'center' });
        }

        // Name / title / ID
        pdf.setTextColor(CHARCOAL.r, CHARCOAL.g, CHARCOAL.b);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.8);
        pdf.text(wrapText(employeeName, 26), width / 2, 50.5, { align: 'center' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.0);
        pdf.text(wrapText(role, 30), width / 2, 54.2, { align: 'center' });

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.2);
        pdf.text(wrapText(employeeCode, 22), width / 2, 61.0, { align: 'center' });

        // Green stripe + grey footer
        const footerH = 7.8;
        const accentH = 1.35;
        const footerY = height - footerH;
        pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
        pdf.rect(0, footerY - accentH, width, accentH, 'F');
        pdf.setFillColor(FOOTER_BG.r, FOOTER_BG.g, FOOTER_BG.b);
        pdf.rect(0, footerY, width, footerH, 'F');
        pdf.setTextColor(CHARCOAL.r, CHARCOAL.g, CHARCOAL.b);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(4.9);
        pdf.text(website.toLowerCase(), width / 2, footerY + 4.8, { align: 'center' });

        return Buffer.from(pdf.output('arraybuffer'));
    } catch (error) {
        logger.error('Error generating ID card PDF', {
            error: error.message,
            stack: error.stack,
            idCardId: idCard._id,
        });
        throw error;
    }
};

/**
 * Cover-fit image into a circular PNG with transparent corners.
 */
const toCircularPngDataUrl = async (input) => {
    let buffer = input;
    if (typeof input === 'string' && input.startsWith('data:')) {
        const b64 = input.split(',')[1] || '';
        buffer = Buffer.from(b64, 'base64');
    } else if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
        const res = await fetch(input);
        if (!res.ok) throw new Error(`Photo fetch failed: ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
    }

    const size = 640;
    const circleSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
            `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>` +
            `</svg>`
    );

    const png = await sharp(buffer)
        .rotate() // honour EXIF orientation
        .resize(size, size, { fit: 'cover', position: 'centre' })
        .ensureAlpha()
        .composite([{ input: circleSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();

    return `data:image/png;base64,${png.toString('base64')}`;
};

const findPatternSourcePath = () => {
    const candidates = [
        path.join(process.cwd(), 'assets', 'paarsiv-corner-pattern.png'),
        path.join(process.cwd(), 'server', 'assets', 'paarsiv-corner-pattern.png'),
        path.join(process.cwd(), '..', 'vite_client', 'public', 'paarsiv-corner-pattern.png'),
        path.join(process.cwd(), 'vite_client', 'public', 'paarsiv-corner-pattern.png'),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
};

/**
 * Bake white background out of the corner pattern so PDF placement
 * does not paint opaque rectangles (UI uses mix-blend:multiply instead).
 */
const ensureTransparentPattern = async () => {
    if (_patternCache?.dataUrl && _patternCache?.rotatedDataUrl) return _patternCache;

    const filePath = findPatternSourcePath();
    if (!filePath) return null;

    try {
        const input = fs.readFileSync(filePath);
        const { data, info } = await sharp(input)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            // Knock out paper-white / near-white so only mint lines remain
            if ((r > 235 && g > 235 && b > 235) || (max > 225 && max - min < 40)) {
                data[i + 3] = 0;
            }
        }

        const transparentPng = await sharp(data, {
            raw: { width: info.width, height: info.height, channels: info.channels },
        })
            .png()
            .toBuffer();

        // 180° rotate for bottom-left (matches UI transform)
        const rotatedPng = await sharp(transparentPng).rotate(180).png().toBuffer();

        _patternCache = {
            dataUrl: `data:image/png;base64,${transparentPng.toString('base64')}`,
            rotatedDataUrl: `data:image/png;base64,${rotatedPng.toString('base64')}`,
            width: info.width,
            height: info.height,
        };
        return _patternCache;
    } catch (err) {
        logger.warn('ID card PDF: failed to prepare transparent pattern', { error: err.message });
        return null;
    }
};

/** Place transparent corner meshes (top-right + rotated bottom-left) */
const drawCornerPatternImage = (pdf, width, height, patternAsset) => {
    try {
        if (!patternAsset?.dataUrl) return false;

        const patternW = width * 0.62;
        const patternH = (patternW * patternAsset.height) / patternAsset.width;
        const footerClear = 8.5;

        pdf.addImage(
            patternAsset.dataUrl,
            'PNG',
            width - patternW + 0.4,
            -0.4,
            patternW,
            patternH,
            undefined,
            'FAST'
        );

        pdf.addImage(
            patternAsset.rotatedDataUrl || patternAsset.dataUrl,
            'PNG',
            -0.4,
            height - patternH - footerClear,
            patternW,
            patternH,
            undefined,
            'FAST'
        );
        return true;
    } catch (err) {
        logger.warn('ID card PDF: corner pattern image failed', { error: err.message });
        return false;
    }
};

/** Constellation / low-poly wireframe in corners (fallback) */
const drawCornerPattern = (pdf, corner, width, height) => {
    pdf.setDrawColor(PATTERN.r, PATTERN.g, PATTERN.b);
    pdf.setLineWidth(0.12);
    pdf.setFillColor(PATTERN.r, PATTERN.g, PATTERN.b);

    const localNodes = [
        [0, 0], [4, 0], [9, 0], [14, 0],
        [0, 4], [0, 8], [0, 13], [0, 18], [0, 23],
        [4, 3.5], [8, 2], [5.5, 7], [10, 6],
        [3.5, 11], [8, 12], [12.5, 9.5],
        [2.5, 15.5], [7, 16.5], [11.5, 14.5], [15.5, 12],
        [4.5, 20.5], [9, 20], [13.5, 18], [17.5, 15.5],
        [7, 25], [11.5, 24], [15.5, 22], [2, 27],
        [13, 4.5], [16.5, 7.5], [18.5, 13.5], [16, 27],
    ];

    const edges = [
        [0, 1], [1, 2], [2, 3],
        [0, 4], [4, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [1, 9], [1, 10], [2, 10],
        [4, 9], [9, 11], [5, 11], [4, 11],
        [10, 12], [9, 12], [11, 12],
        [5, 13], [11, 13], [6, 13],
        [12, 14], [11, 14], [13, 14],
        [12, 15], [14, 15], [10, 15],
        [6, 16], [13, 16], [7, 16],
        [14, 17], [13, 17], [16, 17],
        [15, 18], [14, 18], [17, 18],
        [15, 19], [18, 19],
        [7, 20], [16, 20], [8, 20],
        [17, 21], [16, 21], [20, 21],
        [18, 22], [17, 22], [21, 22],
        [19, 23], [18, 23], [22, 23],
        [8, 24], [20, 24], [21, 24],
        [21, 25], [22, 25], [24, 25],
        [22, 26], [23, 26], [25, 26],
        [8, 27], [20, 27], [24, 27],
        [10, 28], [12, 28], [15, 28],
        [15, 29], [19, 29], [28, 29],
        [19, 30], [23, 30], [29, 30],
        [25, 31], [26, 31], [23, 31],
        [2, 28], [3, 28], [3, 10],
    ];

    const toPage = (lx, ly) => {
        if (corner === 'top-right') return { x: width - lx, y: ly };
        return { x: lx, y: height - 8 - ly };
    };

    edges.forEach(([a, b]) => {
        const [ax, ay] = localNodes[a];
        const [bx, by] = localNodes[b];
        const p1 = toPage(ax, ay);
        const p2 = toPage(bx, by);
        pdf.line(p1.x, p1.y, p2.x, p2.y);
    });

    localNodes.forEach(([lx, ly], i) => {
        const p = toPage(lx, ly);
        pdf.circle(p.x, p.y, i < 9 ? 0.22 : 0.28, 'F');
    });
};

/**
 * Load employee profile photo for PDF embedding (local disk or private S3).
 * Returns { buffer, dataUrl, format } so sharp can circular-crop from the buffer.
 */
const resolveEmployeeProfilePhoto = async (employee) => {
    try {
        const photo = employee?.profilePhoto || employee?.profilePicture;
        if (!photo) return null;

        const s3KeyCandidate =
            (typeof photo === 'object' && (photo.s3Key || photo.thumbS3Key)) || null;
        let urlCandidate =
            typeof photo === 'string' ? photo : photo.url || photo.thumbnailUrl || null;

        // Prefer original S3 key over a signed/display URL that may have been hydrated for UI
        const { extractS3Key, getSignedUrl } = await import('./storageHelper.js');
        let key = s3KeyCandidate || null;
        if (!key && urlCandidate && !String(urlCandidate).startsWith('/uploads/')) {
            // Only extract key from non-presigned object URLs / raw keys
            if (!/[?&]X-Amz-Signature=/i.test(String(urlCandidate))) {
                key = extractS3Key(urlCandidate);
            } else {
                // Strip query to recover key from signed URL if s3Key missing
                key = extractS3Key(String(urlCandidate).split('?')[0]);
            }
        }

        if (key && !String(key).startsWith('/uploads/')) {
            try {
                const { GetObjectCommand } = await import('@aws-sdk/client-s3');
                const s3ClientMod = await import('../config/s3.js');
                const response = await s3ClientMod.default.send(
                    new GetObjectCommand({ Bucket: s3ClientMod.S3_BUCKET, Key: key })
                );
                const bytes = await response.Body.transformToByteArray();
                const buffer = Buffer.from(bytes);
                const contentType = response.ContentType || guessMimeFromKey(key);
                const format = mimeToPdfFormat(contentType);
                if (!format) {
                    // Still usable by sharp even if jsPDF format is unknown
                    return { buffer, dataUrl: null, format: 'PNG' };
                }
                return {
                    buffer,
                    dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
                    format,
                };
            } catch (s3Err) {
                logger.warn('ID card PDF: S3 profile photo fetch failed, trying URL', {
                    error: s3Err.message,
                    key,
                });
                try {
                    const signed = await getSignedUrl(key, 120);
                    const remote = await fetchImageAsDataUrl(signed);
                    if (remote) return remote;
                } catch (signedErr) {
                    logger.warn('ID card PDF: signed URL photo fetch failed', {
                        error: signedErr.message,
                    });
                }
            }
        }

        if (urlCandidate && String(urlCandidate).startsWith('/')) {
            return getImageDataFromStoredUrl(urlCandidate);
        }

        if (urlCandidate && /^https?:\/\//i.test(String(urlCandidate))) {
            return await fetchImageAsDataUrl(urlCandidate);
        }

        return null;
    } catch (error) {
        logger.warn('ID card PDF: resolveEmployeeProfilePhoto failed', {
            error: error.message,
        });
        return null;
    }
};

const guessMimeFromKey = (key = '') => {
    const ext = path.extname(String(key).split('?')[0]).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/png';
};

const mimeToPdfFormat = (mime = '') => {
    const m = String(mime).toLowerCase();
    if (m.includes('jpeg') || m.includes('jpg')) return 'JPEG';
    if (m.includes('png')) return 'PNG';
    return null;
};

const fetchImageAsDataUrl = async (url) => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const format = mimeToPdfFormat(contentType) || 'JPEG';
        return {
            buffer,
            dataUrl: `data:${contentType.split(';')[0]};base64,${buffer.toString('base64')}`,
            format,
        };
    } catch (error) {
        logger.warn('ID card PDF: fetchImageAsDataUrl failed', { error: error.message });
        return null;
    }
};

const getImageDataFromStoredUrl = (storedUrl) => {
    try {
        if (!storedUrl || typeof storedUrl !== 'string') return null;
        const cleanUrl = storedUrl.split('?')[0].trim();
        if (!cleanUrl.startsWith('/')) return null;

        const rel = cleanUrl.replace(/^\//, '');
        const candidates = [
            path.join(process.cwd(), rel),
            path.join(process.cwd(), 'public', rel),
            path.join(process.cwd(), '..', rel),
            path.join(process.cwd(), '..', 'public', rel),
        ];

        const filePath = candidates.find((p) => fs.existsSync(p));
        if (!filePath) return null;

        const ext = path.extname(filePath).toLowerCase();
        let mime = 'image/png';
        let format = 'PNG';
        if (ext === '.jpg' || ext === '.jpeg') {
            mime = 'image/jpeg';
            format = 'JPEG';
        } else if (ext === '.webp' || ext === '.gif') {
            mime = 'image/png';
            format = 'PNG';
        }

        const buffer = fs.readFileSync(filePath);
        return {
            buffer,
            dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
            format,
        };
    } catch (error) {
        logger.warn('Failed to resolve image for ID card PDF', {
            error: error.message,
            storedUrl,
        });
        return null;
    }
};

const hexToRgb = (hex) => {
    if (!hex) return null;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
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
            error: error.message,
        });
        throw error;
    }
};

export { hexToRgb };
