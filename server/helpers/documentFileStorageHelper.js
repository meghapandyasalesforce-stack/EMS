import { getSignedUrl, extractS3Key } from './storageHelper.js';

// No-op kept for any callers that still reference it — dirs no longer needed
export function ensureDocumentsUploadDirs() {}

/**
 * Serve a document: redirect client to a short-lived S3 signed URL.
 * Replaces the old disk-stream / buffer approach entirely.
 */
export async function sendDocumentFile(res, { s3Key, fileUrl, downloadName, mimeType, inline }) {
    const key = s3Key || extractS3Key(fileUrl);
    if (!key) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }

    try {
        const signedUrl = await getSignedUrl(key, 900); // 15 min
        // Redirect browser/client directly to S3 — no proxying through server
        return res.redirect(302, signedUrl);
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Could not generate download link' });
    }
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
