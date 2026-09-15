import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadFile, buildS3Key } from './storageHelper.js';
import { sendDocumentFile } from './documentFileStorageHelper.js';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname, '../uploads');

/**
 * Upload a leave attachment buffer to S3.
 * @returns {Promise<string>} S3 object key stored on Leave.document
 */
export async function uploadLeaveAttachmentToS3(file, organizationId, employeeId = null) {
    if (!file?.buffer?.length) {
        throw new Error('Uploaded file buffer is empty. Please try uploading again.');
    }
    if (!organizationId) {
        throw new Error('Organization ID is required');
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    const safeBase = (file.originalname || 'leave-attachment')
        .replace(ext, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 60);
    const filename = `leave-${safeBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const s3Key = buildS3Key('leave-attachment', organizationId, filename, employeeId);
    return uploadFile(file.buffer, s3Key, file.mimetype, false);
}

/**
 * Stream a leave attachment to the client (S3 key or legacy /uploads/ path).
 */
export async function streamLeaveAttachment(res, { fileRef, fileName, mimeType, inline = false }) {
    if (!fileRef || typeof fileRef !== 'string' || !fileRef.trim()) {
        return res.status(404).json({ success: false, message: 'No attachment found for this leave request' });
    }

    const ref = fileRef.trim();

    if (ref.startsWith('/uploads/') || ref.startsWith('./uploads/')) {
        const relative = ref.replace(/^\.?\//, '');
        const localPath = path.resolve(UPLOADS_ROOT, '..', relative);
        const uploadsParent = path.resolve(UPLOADS_ROOT, '..');

        if (!localPath.startsWith(uploadsParent)) {
            logger.warn('Leave attachment path traversal blocked', { fileRef: ref });
            return res.status(400).json({ success: false, message: 'Invalid document path' });
        }

        if (!fs.existsSync(localPath)) {
            return res.status(404).json({
                success: false,
                message: 'Attachment file not found. It may have been removed or must be re-uploaded.',
            });
        }

        const safeName = String(fileName || path.basename(localPath)).replace(/[^\w.\- ]+/g, '_');
        const stat = fs.statSync(localPath);
        const contentType = mimeType || 'application/octet-stream';

        res.status(200);
        res.setHeader('Content-Type', contentType);
        res.setHeader(
            'Content-Disposition',
            `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`
        );
        res.setHeader('Content-Length', String(stat.size));
        return fs.createReadStream(localPath).pipe(res);
    }

    return sendDocumentFile(res, {
        fileUrl: ref,
        downloadName: fileName || 'leave-attachment',
        mimeType,
        inline,
    });
}
