/**
 * Multer config for offer PDF template uploads (HR/Admin only routes).
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(__dirname, '../uploads/lifecycle-letters/pdf-templates');

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

function ensureOrgDir(organizationId) {
    const orgDir = path.join(BASE_DIR, String(organizationId));
    if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true });
    return orgDir;
}

const storage = multer.diskStorage({
    destination(req, _file, cb) {
        try {
            const orgId = req.employee?.organizationId || req.user?.organizationId || req.organizationId || 'unknown';
            cb(null, ensureOrgDir(orgId));
        } catch (error) {
            cb(error);
        }
    },
    filename(_req, file, cb) {
        const safe = String(file.originalname || 'template.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `template-${Date.now()}-${safe}`);
    },
});

function pdfFilter(_req, file, cb) {
    const mime = file.mimetype;
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (mime === 'application/pdf' || ext === '.pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'));
    }
}

export const offerPdfTemplateUpload = multer({
    storage,
    limits: { fileSize: MAX_PDF_SIZE, files: 1 },
    fileFilter: pdfFilter,
});

export function resolvePdfTemplateFullPath(organizationId, pdfFileName) {
    return path.join(BASE_DIR, String(organizationId), pdfFileName);
}

export function pdfTemplatePublicUrl(organizationId, pdfFileName) {
    return `/uploads/lifecycle-letters/pdf-templates/${organizationId}/${pdfFileName}`;
}

export default offerPdfTemplateUpload;
