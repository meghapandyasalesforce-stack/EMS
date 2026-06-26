import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DOCUMENTS_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'documents');
export const LEGACY_DOCUMENTS_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'documents');
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const SERVER_ROOT = path.join(__dirname, '..');

function normalizeStoredFileUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return '';
    let normalized = fileUrl.split('?')[0].trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(normalized)) {
        try {
            normalized = new URL(normalized).pathname;
        } catch {
            /* keep original */
        }
    }
    return normalized;
}

/**
 * Resolve a stored fileUrl / filePath to an absolute path on disk.
 */
export function resolveDocumentFilePath(fileUrl) {
    const normalized = normalizeStoredFileUrl(fileUrl);
    if (!normalized) return null;

    if (path.isAbsolute(normalized.replace(/\//g, path.sep)) && fs.existsSync(normalized)) {
        return normalized;
    }
    if (path.isAbsolute(fileUrl) && fs.existsSync(fileUrl)) {
        return fileUrl;
    }

    const basename = path.basename(normalized);
    const cwd = process.cwd();

    const candidates = [
        path.join(DOCUMENTS_UPLOAD_DIR, basename),
        path.join(LEGACY_DOCUMENTS_UPLOAD_DIR, basename),
        path.join(DOCUMENTS_UPLOAD_DIR, normalized.replace(/^\/+/, '')),
        path.join(UPLOADS_ROOT, normalized.replace(/^\/uploads\/?/i, '')),
        path.join(SERVER_ROOT, 'public', normalized.replace(/^\/+/, '')),
        path.join(SERVER_ROOT, 'public', 'uploads', 'documents', basename),
        path.join(cwd, 'server', 'uploads', 'documents', basename),
        path.join(cwd, 'server', 'public', 'uploads', 'documents', basename),
    ];

    if (normalized.startsWith('/uploads/')) {
        candidates.unshift(path.join(UPLOADS_ROOT, normalized.slice('/uploads/'.length)));
        candidates.unshift(path.join(SERVER_ROOT, 'public', normalized.slice(1)));
    }

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Last resort: scan upload folders (handles moved/legacy filenames)
    for (const dir of [DOCUMENTS_UPLOAD_DIR, LEGACY_DOCUMENTS_UPLOAD_DIR]) {
        try {
            if (!fs.existsSync(dir)) continue;
            const files = fs.readdirSync(dir);
            if (files.includes(basename)) {
                return path.join(dir, basename);
            }
            const stem = basename.replace(/\.[^.]+$/, '');
            const partial = files.find(
                (f) => f === basename || f.startsWith(stem) || stem.includes(f.replace(/\.[^.]+$/, ''))
            );
            if (partial) {
                return path.join(dir, partial);
            }
        } catch {
            /* ignore */
        }
    }

    return null;
}

export function relativeDocumentFileUrl(filename) {
    return `/uploads/documents/${filename}`;
}
