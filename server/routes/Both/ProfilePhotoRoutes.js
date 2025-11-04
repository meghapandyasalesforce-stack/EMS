import express from 'express';
import { 
    uploadEmployeePhoto, 
    uploadAdminPhoto, 
    getProfilePhoto, 
    deleteProfilePhoto,
    upload
} from '../../controllers/profile/profilePhotoController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Upload profile photo for employee
router.route('/employee/upload')
    .post(isAuthenticated, upload.single('profilePhoto'), uploadEmployeePhoto);

// Upload profile photo for admin
router.route('/admin/upload')
    .post(isAdminAuthenticated, upload.single('profilePhoto'), uploadAdminPhoto);

// Get profile photo
router.route('/:userType/:userId')
    .get(getProfilePhoto);

// Delete profile photo
router.route('/:userType/:userId')
    .delete(deleteProfilePhoto);

export default router;
