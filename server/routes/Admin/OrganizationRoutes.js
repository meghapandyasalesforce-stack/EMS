import express from 'express';
import {
    getOrganizationProfile,
    updateOrganizationProfile,
    uploadOrganizationLogo,
    deleteOrganizationLogo,
    updateOrganizationSettings,
    updateSubscriptionPlan,
    getOrganizationStatistics,
    getOrganizationUsers,
    getOrganizationActivity,
    getOrganizationBranding,
    updateOrganizationBranding
} from '../../controllers/organization/organizationController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import isAdminOrExecutiveAuthenticated from '../../middlewares/isAdminOrExecutiveAuthenticated.js';
import { organizationValidations } from '../../middlewares/inputValidation.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for logo upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../../uploads/logos');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `logo-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

const router = express.Router();

// All routes require admin authentication
router.get('/profile', isAdminAuthenticated, getOrganizationProfile);
router.put('/profile', isAdminAuthenticated, organizationValidations.updateProfile, updateOrganizationProfile);
router.post('/logo', isAdminAuthenticated, upload.single('logo'), uploadOrganizationLogo);
router.delete('/logo', isAdminAuthenticated, deleteOrganizationLogo);
router.put('/settings', isAdminOrHRAuthenticated, organizationValidations.updateSettings, updateOrganizationSettings);
router.put('/subscription', isAdminAuthenticated, organizationValidations.updateSubscription, updateSubscriptionPlan);
router.get('/statistics', isAdminOrExecutiveAuthenticated, getOrganizationStatistics);
router.get('/users', isAdminAuthenticated, organizationValidations.getUsers, getOrganizationUsers);
router.get('/activity', isAdminOrExecutiveAuthenticated, organizationValidations.getActivity, getOrganizationActivity);
router.get('/branding', isAdminAuthenticated, getOrganizationBranding);
router.put('/branding', isAdminAuthenticated, updateOrganizationBranding);

export default router;

