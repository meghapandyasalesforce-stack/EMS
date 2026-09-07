import { getSignedUrl, extractS3Key } from './storageHelper.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import s3Client, { S3_BUCKET } from '../config/s3.js';
import logger from './logger.js';

// No-op kept for any callers that still reference it — dirs no longer needed
export function ensureDocumentsUploadDirs() {}

/**
 * Serve a document by streaming the S3 object directly to the client.
 *
 * Returns HTTP 200 with the raw file body (never a signed URL / redirect), so the
 * authenticated Axios/XHR download path (`responseType: 'blob'`) receives real bytes.
 * This replaces the previous cross-origin 302 redirect to a pre-signed S3 URL, which
 * the browser would block via CORS, causing the frontend to fall back to /uploads/.
 */
export async function sendDocumentFile(res, { s3Key, fileUrl, downloadName, mimeType, inline }) {
    const key = s3Key || extractS3Key(fileUrl);
    if (!key) {
        // fileUrl is a legacy local disk path (/uploads/...) that was never migrated to S3.
        // The file no longer exists on the server filesystem.
        return res.status(404).json({
            success: false,
            message: 'File not found. This document was stored locally before cloud migration and must be re-uploaded.',
        });
    }

    let s3Response;
    try {
        s3Response = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
        logger.warn('S3 GetObject failed', { key, error: err.message });
        return res.status(500).json({ success: false, message: 'Could not download file' });
    }

    const safeName = String(downloadName || 'document').replace(/[^\w.\- ]+/g, '_');
    const contentType = mimeType || s3Response.ContentType || 'application/octet-stream';

    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
    );
    if (s3Response.ContentLength) {
        res.setHeader('Content-Length', String(s3Response.ContentLength));
    }

    s3Response.Body.on('error', (err) => {
        logger.error('S3 stream error', { key, error: err.message });
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to stream document' });
        } else {
            res.end();
        }
    });
    s3Response.Body.pipe(res);
}

/**
 * Return a signed URL string for a document (used by API responses that need a URL, not a redirect).
 */
export async function resolveDocumentSignedUrl(s3KeyOrFileUrl) {
    const key = extractS3Key(s3KeyOrFileUrl);
    if (!key) return null;
    try {
        return await getSignedUrl(key, 900);
    } catch {
        return null;
    }
}
