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
                position: 'center'
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
 * Process profile photo: optimize and generate thumbnail
 * @param {string} filePath - Path to uploaded file
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Processing result
 */
export const processProfilePhoto = async (filePath, filename) => {
    let tempPath = null;
    try {
        const fileDir = path.dirname(filePath);
        const fileExt = path.extname(filename);
        const fileBase = path.basename(filename, fileExt);

        // Create temporary file for optimization (Sharp cannot use same file for input/output)
        tempPath = path.join(fileDir, `${fileBase}_temp${fileExt}`);
        
        // Optimize to temporary file
        const optimizationResult = await optimizeImage(filePath, tempPath, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 85
        });

        // Replace original with optimized version
        fs.renameSync(tempPath, filePath);
        tempPath = null; // Clear temp path since we've moved it

        // Generate thumbnail from optimized image
        const thumbnailFilename = `${fileBase}_thumb${fileExt}`;
        const thumbnailPath = path.join(fileDir, thumbnailFilename);
        const thumbnailResult = await generateThumbnail(filePath, thumbnailPath, 200);

        return {
            success: true,
            optimized: optimizationResult,
            thumbnail: thumbnailResult,
            thumbnailUrl: `/uploads/profile-photos/${thumbnailFilename}`
        };
    } catch (error) {
        // Clean up temporary file if it exists
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (cleanupError) {
                logger.warn('Failed to cleanup temporary file', {
                    tempPath,
                    error: cleanupError.message
                });
            }
        }
        
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
    processProfilePhoto
};

