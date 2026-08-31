import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import s3Client, { S3_BUCKET } from '../config/s3.js';
import logger from './logger.js';

/**
 * Upload a buffer to S3.
 * @param {Buffer} buffer
 * @param {string} key  - S3 object key e.g. "{orgId}/profile-photos/{empId}-{ts}.webp"
 * @param {string} mimeType
 * @param {boolean} isPublic - true for profile photos / QR codes, false for sensitive docs
 * @returns {Promise<string>} full S3 URL
 */
export async function uploadFile(buffer, key, mimeType, isPublic = false) {
    // No ACL is set here: the bucket has Object Ownership "Bucket owner enforced"
    // (ACLs disabled), which rejects ACL parameters with AccessControlListNotSupported.
    // Profile photos are uploaded as normal private objects and served privately via
    // short-lived S3 pre-signed URLs. Public/static exposure is not used for objects.
    await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    }));

    if (isPublic) {
        return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
    }
    // For private files return the key — callers use getSignedUrl to serve them
    return key;
}

/**
 * Delete a file from S3 by key.
 * @param {string} key
 */
export async function deleteFile(key) {
    if (!key) return;
    // Strip full URL down to key if a URL was stored
    const resolvedKey = extractS3Key(key);
    if (!resolvedKey) return;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: resolvedKey }));
    } catch (err) {
        logger.warn('S3 deleteFile failed', { key: resolvedKey, error: err.message });
    }
}

/**
 * Generate a pre-signed URL for a private S3 object.
 * @param {string} key
 * @param {number} expiresIn - seconds (default 15 min)
 * @returns {Promise<string>} signed URL
 */
export async function getSignedUrl(key, expiresIn = 900) {
    const resolvedKey = extractS3Key(key);
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: resolvedKey });
    return awsGetSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Build S3 key for a given file type.
 * Keeps files isolated per organization — SaaS-ready.
 */
export function buildS3Key(type, organizationId, filename) {
    const orgPrefix = String(organizationId);
    switch (type) {
        case 'profile-photo':
            return `${orgPrefix}/profile-photos/${filename}`;
        case 'document':
            return `${orgPrefix}/documents/${filename}`;
        case 'pdf-template':
            return `${orgPrefix}/pdf-templates/${filename}`;
        case 'resume':
            return `${orgPrefix}/resumes/${filename}`;
        default:
            return `${orgPrefix}/misc/${filename}`;
    }
}

/**
 * Extract S3 key from either a full S3 URL or a raw key string.
 * Returns null for legacy local disk paths (/uploads/...) so callers
 * can return a clean 404 instead of passing a bad key to S3.
 */
export function extractS3Key(urlOrKey) {
    if (!urlOrKey) return null;
    // Legacy local disk paths are not S3 keys — signal absence to callers
    if (urlOrKey.startsWith('/uploads/') || urlOrKey.startsWith('./')) return null;
    // Full S3 URL: https://bucket.s3.region.amazonaws.com/key
    const match = urlOrKey.match(/amazonaws\.com\/(.+)$/);
    if (match) return match[1];
    // Already a raw S3 key
    return urlOrKey;
}
