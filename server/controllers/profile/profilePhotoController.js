import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// Upload profile photo for employee
export const uploadEmployeePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const employeeId = req.employee._id;
        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Delete old photo if exists
        if (employee.profilePhoto && employee.profilePhoto.filename) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profile-photos', employee.profilePhoto.filename);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Update employee profile photo
        employee.profilePhoto = {
            url: `/uploads/profile-photos/${req.file.filename}`,
            filename: req.file.filename,
            uploadedAt: new Date()
        };

        await employee.save();

        res.json({
            message: 'Profile photo uploaded successfully',
            profilePhoto: employee.profilePhoto
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload profile photo', error: error.message });
    }
};

// Upload profile photo for admin
export const uploadAdminPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old photo if exists
        if (user.profilePhoto && user.profilePhoto.filename) {
            const oldPhotoPath = path.join(__dirname, '../../uploads/profile-photos', user.profilePhoto.filename);
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        // Update user profile photo
        user.profilePhoto = {
            url: `/uploads/profile-photos/${req.file.filename}`,
            filename: req.file.filename,
            uploadedAt: new Date()
        };

        await user.save();

        res.json({
            message: 'Profile photo uploaded successfully',
            profilePhoto: user.profilePhoto
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Failed to upload profile photo', error: error.message });
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

        res.json({ profilePhoto: user.profilePhoto });
    } catch (error) {
        console.error('Get photo error:', error);
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
        console.error('Delete photo error:', error);
        res.status(500).json({ message: 'Failed to delete profile photo', error: error.message });
    }
};
