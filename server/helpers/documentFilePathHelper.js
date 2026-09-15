import { buildS3Key, extractS3Key } from './storageHelper.js';

/**
 * Build an S3 key for a document upload.
 * Employee files: {orgId}/employees/{employeeId}/documents/{filename}
 * Company files:  {orgId}/documents/company/{filename}
 * @param {string|ObjectId} organizationId
 * @param {string} filename
 * @param {string|ObjectId} [employeeId]
 */
export function buildDocumentS3Key(organizationId, filename, employeeId = null) {
    return buildS3Key('document', organizationId, filename, employeeId);
}

/**
 * Extract S3 key from a stored fileUrl (full URL or raw key).
 * Returns null if the value is a legacy local path.
 */
export function resolveDocumentS3Key(fileUrl) {
    if (!fileUrl) return null;
    // Legacy local paths like /uploads/documents/... are no longer resolvable
    if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('./')) return null;
    return extractS3Key(fileUrl);
}
