import sharp from 'sharp';
import logger from './logger.js';

/**
 * Process a profile photo buffer: auto-rotate, trim borders, square crop, compress.
 * Returns a Buffer — no disk writes.
 * @param {Buffer} inputBuffer
 * @param {number} size - output dimension (default 800)
 * @returns {Promise<Buffer>}
 */
export async function processProfilePhotoBuffer(inputBuffer, size = 800) {
    let source = inputBuffer;

    // Trim empty/black borders
    try {
        source = await sharp(inputBuffer)
            .rotate()
            .trim({ threshold: 15 })
            .jpeg({ quality: 95 })
            .toBuffer();
    } catch {
        // trim failed — use original
        source = inputBuffer;
    }

    const optimized = await sharp(source)
        .resize(size, size, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

    return optimized;
}

/**
 * Generate a thumbnail buffer from an image buffer.
 * @param {Buffer} inputBuffer
 * @param {number} size - thumbnail dimension (default 200)
 * @returns {Promise<Buffer>}
 */
export async function generateThumbnailBuffer(inputBuffer, size = 200) {
    return sharp(inputBuffer)
        .resize(size, size, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 80 })
        .toBuffer();
}

export default { processProfilePhotoBuffer, generateThumbnailBuffer };
