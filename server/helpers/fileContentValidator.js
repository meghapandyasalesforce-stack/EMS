/**
 * File Content Validator
 * Validates file content using magic numbers (file signatures) to prevent MIME type spoofing
 * This provides an additional security layer beyond MIME type checking
 */

import fs from 'fs';
import logger from './logger.js';

/**
 * Magic numbers (file signatures) for common file types
 * Format: [offset, signature bytes]
 */
const FILE_SIGNATURES = {
  // Images
  'image/jpeg': [
    [0, [0xFF, 0xD8, 0xFF]],
  ],
  'image/png': [
    [0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  ],
  'image/gif': [
    [0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]], // GIF87a
    [0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF89a
  ],
  'image/webp': [
    [0, [0x52, 0x49, 0x46, 0x46]], // RIFF
    [8, [0x57, 0x45, 0x42, 0x50]], // WEBP
  ],
  
  // Documents
  'application/pdf': [
    [0, [0x25, 0x50, 0x44, 0x46, 0x2D]], // %PDF-
  ],
  'application/msword': [ // .doc (OLE2 format)
    [0, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  ],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [ // .docx (ZIP format)
    [0, [0x50, 0x4B, 0x03, 0x04]], // PK (ZIP signature)
  ],
  'application/vnd.ms-excel': [ // .xls (OLE2 format)
    [0, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [ // .xlsx (ZIP format)
    [0, [0x50, 0x4B, 0x03, 0x04]], // PK (ZIP signature)
  ],
};

/**
 * Validate file content against expected MIME type using magic numbers
 * @param {string} filePath - Path to the uploaded file
 * @param {string} expectedMimeType - Expected MIME type
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export const validateFileContent = async (filePath, expectedMimeType) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File not found' };
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // Read first bytes of file (up to 20 bytes should be enough for most signatures)
    const buffer = Buffer.alloc(20);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 20, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      return { valid: false, error: 'File too small to validate' };
    }

    // Get signatures for expected MIME type
    const signatures = FILE_SIGNATURES[expectedMimeType];
    if (!signatures || signatures.length === 0) {
      // If no signature defined for this MIME type, log warning but allow
      // (some file types don't have reliable magic numbers)
      logger.warn(`No file signature defined for MIME type: ${expectedMimeType}`);
      return { valid: true }; // Allow if no signature defined
    }

    // Check if any signature matches
    for (const [offset, signature] of signatures) {
      if (offset + signature.length > bytesRead) {
        continue; // Not enough bytes read
      }

      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[offset + i] !== signature[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { valid: true };
      }
    }

    // No signature matched
    return {
      valid: false,
      error: `File content does not match expected MIME type ${expectedMimeType}. Possible MIME type spoofing detected.`
    };
  } catch (error) {
    logger.error('File content validation error', {
      error: error.message,
      filePath,
      expectedMimeType
    });
    // On error, fail securely (reject the file)
    return {
      valid: false,
      error: 'File validation failed due to an error'
    };
  }
};

/**
 * Validate file content synchronously (for use in middleware)
 * @param {string} filePath - Path to the uploaded file
 * @param {string} expectedMimeType - Expected MIME type
 * @returns {{valid: boolean, error?: string}}
 */
export const validateFileContentSync = (filePath, expectedMimeType) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File not found' };
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // Read first bytes of file
    const buffer = Buffer.alloc(20);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 20, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      return { valid: false, error: 'File too small to validate' };
    }

    // Get signatures for expected MIME type
    const signatures = FILE_SIGNATURES[expectedMimeType];
    if (!signatures || signatures.length === 0) {
      // If no signature defined, allow (log warning in async version)
      return { valid: true };
    }

    // Check if any signature matches
    for (const [offset, signature] of signatures) {
      if (offset + signature.length > bytesRead) {
        continue;
      }

      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[offset + i] !== signature[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { valid: true };
      }
    }

    // No signature matched
    return {
      valid: false,
      error: `File content does not match expected MIME type ${expectedMimeType}. Possible MIME type spoofing detected.`
    };
  } catch (error) {
    logger.error('File content validation error', {
      error: error.message,
      filePath,
      expectedMimeType
    });
    return {
      valid: false,
      error: 'File validation failed due to an error'
    };
  }
};

export default {
  validateFileContent,
  validateFileContentSync,
  FILE_SIGNATURES
};

