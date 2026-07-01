/**
 * Image Optimization Helper
 * Uses Sharp to compress and resize images
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';

/**
 * Optimize and resize image
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save optimized image
 * @param {Object} options - Optimization options
 * @param {number} options.maxWidth - Maximum width (default: 800)
 * @param {number} options.maxHeight - Maximum height (default: 800)
 * @param {number} options.quality - JPEG quality 1-100 (default: 85)
 * @returns {Promise<Object>} Optimization result with file size info
 */
export const optimizeImage = async (inputPath, outputPath, options = {}) => {
    try {
        const {
            maxWidth = 800,
            maxHeight = 800,
            quality = 85
        } = options;

        // Get original file size
        const originalStats = fs.statSync(inputPath);
        const originalSize = originalStats.size;

        // Process image with Sharp
        await sharp(inputPath)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality })
            .png({ quality, compressionLevel: 9 })
            .toFile(outputPath);

        // Get optimized file size
        const optimizedStats = fs.statSync(outputPath);
        const optimizedSize = optimizedStats.size;
        const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

        logger.info('Image optimized successfully', {
            inputPath,
            outputPath,
            originalSize,
            optimizedSize,
            compressionRatio: `${compressionRatio}%`
        });

        return {
            success: true,
            originalSize,
            optimizedSize,
            compressionRatio: parseFloat(compressionRatio),
            outputPath
        };
    } catch (error) {
        logger.error('Image optimization failed', {
            inputPath,
            outputPath,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Generate thumbnail from image
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save thumbnail
 * @param {number} size - Thumbnail size (default: 200)
 * @returns {Promise<Object>} Thumbnail generation result
 */
export const generateThumbnail = async (inputPath, outputPath, size = 200) => {
    try {
        await sharp(inputPath)
            .resize(size, size, {
                fit: 'cover',
                position: 'attention',
            })
            .jpeg({ quality: 80 })
            .toFile(outputPath);

        const thumbnailStats = fs.statSync(outputPath);

        logger.info('Thumbnail generated successfully', {
            inputPath,
            outputPath,
            size,
            thumbnailSize: thumbnailStats.size
        });

        return {
            success: true,
            thumbnailSize: thumbnailStats.size,
            outputPath
        };
    } catch (error) {
        logger.error('Thumbnail generation failed', {
            inputPath,
            outputPath,
            error: error.message
        });
        throw error;
    }
};

/**
 * Normalize profile photo: trim empty/black borders, square cover crop, face-aware.
 * Output fills circular avatars edge-to-edge (localhost + production).
 */
export const normalizeProfilePhotoForAvatar = async (filePath, size = 800) => {
    const fileDir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(fileDir, `${baseName}.jpg`);
    const tempPath = path.join(fileDir, `${baseName}_norm_${Date.now()}.jpg`);
    const trimmedPath = path.join(fileDir, `${baseName}_trim_${Date.now()}.jpg`);

    let sourcePath = filePath;
    try {
        await sharp(filePath)
            .rotate()
            .trim({ threshold: 15 })
            .jpeg({ quality: 95 })
            .toFile(trimmedPath);
        sourcePath = trimmedPath;
    } catch (trimError) {
        logger.debug('Profile photo trim skipped', { error: trimError.message });
    }

    await sharp(sourcePath)
        .resize(size, size, {
            fit: 'cover',
            position: 'attention',
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(tempPath);

    if (sourcePath !== filePath && fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
    }
    if (path.resolve(filePath) !== path.resolve(outputPath) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    if (fs.existsSync(outputPath) && path.resolve(outputPath) !== path.resolve(tempPath)) {
        fs.unlinkSync(outputPath);
    }
    fs.renameSync(tempPath, outputPath);

    const stats = fs.statSync(outputPath);
    return {
        size: stats.size,
        path: outputPath,
        filename: path.basename(outputPath),
    };
};

/** @deprecated Use normalizeProfilePhotoForAvatar */
export const cropProfilePhotoSquare = normalizeProfilePhotoForAvatar;

/**
 * Process profile photo: optimize and generate thumbnail
 * @param {string} filePath - Path to uploaded file
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Processing result
 */
export const processProfilePhoto = async (filePath, filename) => {
    try {
        const fileDir = path.dirname(filePath);
        const fileExt = path.extname(filename);
        const fileBase = path.basename(filename, fileExt);

        const normalized = await normalizeProfilePhotoForAvatar(filePath, 800);
        filePath = normalized.path;
        const outputFilename = normalized.filename;

        const optimizationResult = {
            success: true,
            originalSize: normalized.size,
            optimizedSize: normalized.size,
            compressionRatio: 0,
            outputPath: filePath,
        };

        const thumbnailFilename = `${fileBase}_thumb.jpg`;
        const thumbnailPath = path.join(fileDir, thumbnailFilename);
        const thumbnailResult = await generateThumbnail(filePath, thumbnailPath, 200);

        return {
            success: true,
            filename: outputFilename,
            optimized: optimizationResult,
            thumbnail: thumbnailResult,
            thumbnailUrl: `/uploads/profile-photos/${thumbnailFilename}`,
        };
    } catch (error) {
        logger.error('Profile photo processing failed', {
            filePath,
            filename,
            error: error.message
        });
        // Return original file info if processing fails
        return {
            success: false,
            error: error.message,
            fallback: true
        };
    }
};

export default {
    optimizeImage,
    generateThumbnail,
    normalizeProfilePhotoForAvatar,
    cropProfilePhotoSquare,
    processProfilePhoto
};

