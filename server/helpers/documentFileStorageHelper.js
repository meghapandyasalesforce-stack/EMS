import fs from 'fs';
import path from 'path';
import { Document } from '../models/document.model.js';
import {
    DOCUMENTS_UPLOAD_DIR,
    LEGACY_DOCUMENTS_UPLOAD_DIR,
    resolveDocumentFilePath,
} from './documentFilePathHelper.js';

export function ensureDocumentsUploadDirs() {
    fs.mkdirSync(DOCUMENTS_UPLOAD_DIR, { recursive: true });
    fs.mkdirSync(LEGACY_DOCUMENTS_UPLOAD_DIR, { recursive: true });
}

/** Read uploaded file bytes for MongoDB backup (survives disk loss / redeploy). */
export function readUploadFileBuffer(file) {
    const candidates = [
        file?.path,
        file?.filename ? path.join(DOCUMENTS_UPLOAD_DIR, file.filename) : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return fs.readFileSync(candidate);
            }
        } catch {
            /* try next */
        }
    }
    return null;
}

/** Require readable upload bytes — preview/download must work without disk file. */
export function requireUploadFileBuffer(file) {
    const buffer = readUploadFileBuffer(file);
    if (!buffer?.length) {
        throw new Error('Uploaded file could not be stored. Please try uploading again.');
    }
    return buffer;
}

function normalizeBinary(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value) && value.length) return value;
    if (value?.type === 'Buffer' && Array.isArray(value.data) && value.data.length) {
        return Buffer.from(value.data);
    }
    if (Array.isArray(value) && value.length) return Buffer.from(value);
    return null;
}

/** Stream or send a document file (disk path or in-memory buffer). */
export function sendDocumentFile(res, { filePath, buffer, downloadName, mimeType, inline }) {
    const safeName = downloadName || 'document';
    const contentType = mimeType || 'application/octet-stream';
    const fileBuffer = normalizeBinary(buffer);

    if (fileBuffer?.length) {
        res.setHeader('Content-Type', contentType);
        res.setHeader(
            'Content-Disposition',
            `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(safeName)}"`
        );
        res.send(fileBuffer);
        return;
    }

    if (!filePath) {
        res.status(404).json({ success: false, message: 'File not found' });
        return;
    }

    if (inline) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
        fs.createReadStream(filePath)
            .on('error', () => {
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Error reading file' });
                }
            })
            .pipe(res);
        return;
    }

    res.download(filePath, safeName, (err) => {
        if (err && !res.headersSent) {
            res.status(500).json({ success: false, message: 'Error downloading file' });
        }
    });
}

/** Resolve file from in-DB backup first (same as HR/org uploads), then disk. */
export async function resolveDocumentFileContent({ document, legacyDoc, fileUrl, loadBinary }) {
    let fileBinary = normalizeBinary(document?.fileBinary);
    if ((!fileBinary || !fileBinary.length) && document?._id && loadBinary) {
        const loaded = await loadBinary(document._id);
        fileBinary = normalizeBinary(loaded?.fileBinary);
    }
    if (fileBinary?.length) {
        return { buffer: fileBinary, source: 'database' };
    }

    const filePath = resolveDocumentFilePath(fileUrl);
    if (filePath) {
        return { filePath, source: 'disk' };
    }

    if (legacyDoc?.fileUrl) {
        const legacyPath = resolveDocumentFilePath(legacyDoc.fileUrl);
        if (legacyPath) {
            return { filePath: legacyPath, source: 'legacy-disk' };
        }
    }

    return null;
}

/** If file exists on disk but DB backup is missing, read and persist (one-time repair). */
export async function backfillDocumentBinaryFromDisk(documentId, fileUrl) {
    if (!documentId || !fileUrl) return null;
    const filePath = resolveDocumentFilePath(fileUrl);
    if (!filePath) return null;
    try {
        const buf = fs.readFileSync(filePath);
        if (!buf?.length) return null;
        await Document.findByIdAndUpdate(documentId, { fileBinary: buf });
        return buf;
    } catch {
        return null;
    }
}
