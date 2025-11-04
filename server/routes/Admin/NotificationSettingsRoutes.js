import express from 'express';
import {
  getNotificationSettings,
  updateNotificationSettings,
  resetNotificationSettings,
  getAllNotificationSettings
} from '../../controllers/admin/notificationSettingsController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isUserAuthenticated from '../../middlewares/isUserAuthenticated.js';

const router = express.Router();

// Get notification settings for current user (admin or employee)
router.route('/settings').get(isUserAuthenticated, getNotificationSettings);

// Update notification settings for current user (admin or employee)
router.route('/settings').patch(isUserAuthenticated, updateNotificationSettings);

// Reset notification settings to default (admin or employee)
router.route('/settings/reset').post(isUserAuthenticated, resetNotificationSettings);

// Get all notification settings (admin only)
router.route('/settings/all').get(isAdminAuthenticated, getAllNotificationSettings);

export default router;
