import express from 'express';
import { 
    uploadEmployeePhoto,
    uploadEmployeePhotoByAdmin,
    uploadAdminPhoto, 
    getProfilePhoto, 
    deleteProfilePhoto,
    upload
} from '../../controllers/profile/profilePhotoController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Upload profile photo for employee
router.route('/employee/upload')
    .post(isAuthenticated, upload.single('profilePhoto'), uploadEmployeePhoto);

// Admin / HR / executive: upload photo for a specific employee (My Team list)
router.route('/employee/:employeeId/upload')
    .post(isAdminOrHROrExecutiveAuthenticated, upload.single('profilePhoto'), uploadEmployeePhotoByAdmin);

// Upload profile photo for admin
router.route('/admin/upload')
    .post(isAdminAuthenticated, upload.single('profilePhoto'), uploadAdminPhoto);

// Get / Delete profile photo (authenticated — no anonymous access)
router.route('/:userType/:userId')
    .get(isAuthenticatedBoth, readLimiter, getProfilePhoto)
    .delete(isAuthenticatedBoth, writeLimiter, deleteProfilePhoto);

export default router;
