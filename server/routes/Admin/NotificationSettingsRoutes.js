import express from 'express';
import {
  getNotificationSettings,
  updateNotificationSettings,
  resetNotificationSettings,
  getAllNotificationSettings
} from '../../controllers/admin/notificationSettingsController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import isUserAuthenticated from '../../middlewares/isUserAuthenticated.js';
import { notificationSettingsValidations } from '../../middlewares/inputValidation.js';

const router = express.Router();

// Get notification settings for current user (admin or employee)
router.route('/settings').get(isUserAuthenticated, getNotificationSettings);

// Update notification settings for current user (admin or employee)
router.route('/settings').patch(isUserAuthenticated, notificationSettingsValidations.update, updateNotificationSettings);

// Reset notification settings to default (admin or employee)
router.route('/settings/reset').post(isUserAuthenticated, resetNotificationSettings);

// Get all notification settings (admin and HR can view)
router.route('/settings/all').get(isAdminOrHRAuthenticated, getAllNotificationSettings);

export default router;
