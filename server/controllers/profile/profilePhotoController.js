import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendInternalError } from '../../helpers/responseHelper.js';
import { processProfilePhoto, normalizeProfilePhotoForAvatar } from '../../helpers/imageOptimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads/profile-photos');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

async function finalizeProfilePhotoUpload(uploadDir, originalFilename) {
    let storedFilename = originalFilename;
    let currentPath = path.join(uploadDir, originalFilename);
    let optimizationResult = null;
    let thumbnailUrl = null;

    try {
        const processResult = await processProfilePhoto(currentPath, originalFilename);
        if (processResult.success) {
            optimizationResult = processResult.optimized;
            thumbnailUrl = processResult.thumbnailUrl;
            storedFilename = processResult.filename || originalFilename;
            currentPath = path.join(uploadDir, storedFilename);
        }
    } catch (optimizationError) {
        logger.warn('Profile photo processing failed, attempting fallback normalize', {
            error: optimizationError.message,
            filename: originalFilename,
        });
        try {
            const fallback = await normalizeProfilePhotoForAvatar(currentPath, 800);
            storedFilename = fallback.filename;
            currentPath = fallback.path;
            optimizationResult = { optimizedSize: fallback.size };
        } catch (fallbackError) {
            logger.warn('Fallback normalize failed, using original upload', {
                error: fallbackError.message,
            });
        }
    }

    const fileStats = fs.existsSync(currentPath) ? fs.statSync(currentPath) : null;
    return { storedFilename, currentPath, optimizationResult, thumbnailUrl, fileStats };
}

function buildProfilePhotoRecord(storedFilename, thumbnailUrl, optimizationResult) {
    return {
        url: `/uploads/profile-photos/${storedFilename}`,
        thumbnailUrl: thumbnailUrl || `/uploads/profile-photos/${storedFilename}`,
        filename: storedFilename,
        uploadedAt: new Date(),
        optimized: !!optimizationResult,
        ...(optimizationResult && {
            originalSize: optimizationResult.originalSize,
            optimizedSize: optimizationResult.optimizedSize,
            compressionRatio: optimizationResult.compressionRatio,
        }),
    };
}

// Upload profile photo for employee
export const uploadEmployeePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 'No image file provided', 400, 'NO_FILE');
        }

        const employeeId = req.employee._id;
        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Delete old photo if exists
        if (employee.profilePhoto && employee.profilePhoto.filename) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profile-photos', employee.profilePhoto.filename);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads/profile-photos');
        const initialPath = path.join(uploadDir, req.file.filename);
        if (!fs.existsSync(initialPath)) {
            logger.error('File was not saved', { savedFilePath: initialPath });
            return sendInternalError(res, 'File upload failed - file not found on disk');
        }

        const {
            storedFilename,
            currentPath,
            optimizationResult,
            thumbnailUrl,
            fileStats,
        } = await finalizeProfilePhotoUpload(uploadDir, req.file.filename);

        logger.info('Profile photo uploaded successfully', {
            filename: storedFilename,
            path: currentPath,
            size: fileStats?.size || 'unknown',
            optimized: !!optimizationResult,
            employeeId: employeeId.toString(),
        });

        employee.profilePhoto = buildProfilePhotoRecord(storedFilename, thumbnailUrl, optimizationResult);

        await employee.save();

        return sendSuccess(res, {
            profilePhoto: employee.profilePhoto,
            fileSize: fileStats.size
        }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Upload error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

// Admin / HR / executive: upload profile photo for a specific employee
export const uploadEmployeePhotoByAdmin = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 'No image file provided', 400, 'NO_FILE');
        }

        const { employeeId } = req.params;
        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        if (employee.profilePhoto && employee.profilePhoto.filename) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profile-photos', employee.profilePhoto.filename);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads/profile-photos');
        const initialPath = path.join(uploadDir, req.file.filename);
        if (!fs.existsSync(initialPath)) {
            logger.error('File was not saved', { savedFilePath: initialPath });
            return sendInternalError(res, 'File upload failed - file not found on disk');
        }

        const {
            storedFilename,
            currentPath,
            optimizationResult,
            thumbnailUrl,
            fileStats,
        } = await finalizeProfilePhotoUpload(uploadDir, req.file.filename);

        logger.info('Employee profile photo uploaded by admin', {
            filename: storedFilename,
            path: currentPath,
            size: fileStats?.size || 'unknown',
            optimized: !!optimizationResult,
            employeeId: employeeId.toString(),
            uploadedBy: req.user?._id?.toString() || req.employee?._id?.toString(),
        });

        employee.profilePhoto = buildProfilePhotoRecord(storedFilename, thumbnailUrl, optimizationResult);
        await employee.save();

        return sendSuccess(res, {
            profilePhoto: employee.profilePhoto,
            fileSize: fileStats?.size
        }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Admin employee photo upload error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

// Upload profile photo for admin
export const uploadAdminPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 'No image file provided', 400, 'NO_FILE');
        }

        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return sendNotFound(res, 'User');
        }

        // Delete old photo if exists
        if (user.profilePhoto && user.profilePhoto.filename) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profile-photos', user.profilePhoto.filename);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads/profile-photos');
        const initialPath = path.join(uploadDir, req.file.filename);
        if (!fs.existsSync(initialPath)) {
            logger.error('File was not saved', { savedFilePath: initialPath });
            return sendInternalError(res, 'File upload failed - file not found on disk');
        }

        const {
            storedFilename,
            currentPath,
            optimizationResult,
            thumbnailUrl,
            fileStats,
        } = await finalizeProfilePhotoUpload(uploadDir, req.file.filename);

        logger.info('Profile photo uploaded successfully', {
            filename: storedFilename,
            path: currentPath,
            size: fileStats?.size || 'unknown',
            optimized: !!optimizationResult,
            userId: userId.toString(),
        });

        user.profilePhoto = buildProfilePhotoRecord(storedFilename, thumbnailUrl, optimizationResult);

        await user.save();

        return sendSuccess(res, {
            profilePhoto: user.profilePhoto,
            fileSize: fileStats.size
        }, 'Profile photo uploaded successfully');
    } catch (error) {
        logger.error('Upload error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to upload profile photo', error);
    }
};

// Get profile photo
export const getProfilePhoto = async (req, res) => {
    try {
        const { userId, userType } = req.params;
        
        let user;
        if (userType === 'employee') {
            user = await Employee.findById(userId);
        } else if (userType === 'admin') {
            user = await User.findById(userId);
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.profilePhoto) {
            return res.status(404).json({ message: 'No profile photo found' });
        }

        // Check if file actually exists on disk
        const photoPath = path.join(__dirname, '../../uploads/profile-photos', user.profilePhoto.filename);
        if (!fs.existsSync(photoPath)) {
            logger.warn('Profile photo file not found on disk', {
                filename: user.profilePhoto.filename,
                path: photoPath,
                userId: userId,
                userType: userType
            });
            // Return 404 but with helpful message
            return res.status(404).json({ 
                message: 'Profile photo file not found on server (may have been lost during restart)',
                profilePhoto: user.profilePhoto,
                fileExists: false
            });
        }

        res.json({ 
            profilePhoto: user.profilePhoto,
            fileExists: true
        });
    } catch (error) {
        logger.error('Get photo error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to get profile photo', error: error.message });
    }
};

// Delete profile photo
export const deleteProfilePhoto = async (req, res) => {
    try {
        const { userId, userType } = req.params;
        
        let user;
        if (userType === 'employee') {
            user = await Employee.findById(userId);
        } else if (userType === 'admin') {
            user = await User.findById(userId);
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.profilePhoto) {
            return res.status(404).json({ message: 'No profile photo found' });
        }

        // Delete file from filesystem
        const photoPath = path.join(__dirname, '../../uploads/profile-photos', user.profilePhoto.filename);
        if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
        }

        // Remove photo reference from user
        user.profilePhoto = undefined;
        await user.save();

        res.json({ message: 'Profile photo deleted successfully' });
    } catch (error) {
        logger.error('Delete photo error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to delete profile photo', error: error.message });
    }
};
