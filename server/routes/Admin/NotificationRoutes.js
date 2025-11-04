import express from 'express';
import { 
  createNotification, 
  getNotifications, 
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  notifyAdminsOnEmployeeBack
} from '../../controllers/admin/notificationController.js';
import isAdminAuthenticated from './../../middlewares/isAdminAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isUserAuthenticated from '../../middlewares/isUserAuthenticated.js';

const router = express.Router();

// Get all notifications for user (SSE)
router.route("/get-all-notification").get(getNotifications);

// Get notifications for current user (regular API)
router.route("/user-notifications").get(isUserAuthenticated, getUserNotifications);

// Get unread notification count
router.route("/unread-count").get(isUserAuthenticated, getUnreadCount);

// Create notification (admin only)
router.route("/create-notification").post(isAdminAuthenticated, createNotification);

// Mark notification as read
router.route("/:notificationId/read").patch(isUserAuthenticated, markAsRead);

// Mark all notifications as read
router.route("/mark-all-read").patch(isUserAuthenticated, markAllAsRead);

// Delete notification
router.route("/:notificationId").delete(isUserAuthenticated, deleteNotification);

// Employee event -> notify admins
router.route("/employee-back").post(isAuthenticated, notifyAdminsOnEmployeeBack);

export default router;