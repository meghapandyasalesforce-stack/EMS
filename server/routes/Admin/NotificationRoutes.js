import express from 'express';
import { 
  createNotification, 
  getNotifications, 
  getUserNotifications,
  getSentAnnouncements,
  getAnnouncementReceipts,
  publishAnnouncementDraft,
  deleteSentAnnouncement,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  deleteAllNotifications,
  notifyAdminsOnEmployeeBack
} from '../../controllers/admin/notificationController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isUserAuthenticated from '../../middlewares/isUserAuthenticated.js';

const router = express.Router();

// Get all notifications for user (SSE)
router.route("/get-all-notification").get(getNotifications);

// Get notifications for current user (regular API)
router.route("/user-notifications").get(isUserAuthenticated, getUserNotifications);

// Get unread notification count
router.route("/unread-count").get(isUserAuthenticated, getUnreadCount);

// Create announcement (admin / manager / HR / executive)
router.route("/create-notification").post(isAdminOrManagerOrHRAuthenticated, createNotification);

// Sent announcement history (admin / manager / HR / executive)
router.route("/sent-announcements").get(isAdminOrManagerOrHRAuthenticated, getSentAnnouncements);

// Publish draft / hard-delete announcement (before receipts)
router.route("/sent-announcements/:notificationId/publish").post(
  isAdminOrManagerOrHRAuthenticated,
  publishAnnouncementDraft
);
router.route("/sent-announcements/:notificationId").delete(
  isAdminOrManagerOrHRAuthenticated,
  deleteSentAnnouncement
);

// Announcement seen/unseen receipts
router.route("/sent-announcements/:notificationId/receipts").get(
  isAdminOrManagerOrHRAuthenticated,
  getAnnouncementReceipts
);

// Mark all notifications as read (before :notificationId routes)
router.route("/mark-all-read").patch(isUserAuthenticated, markAllAsRead);

// Delete / hide all notifications (before :notificationId routes)
router.route("/delete-all").delete(isUserAuthenticated, deleteAllNotifications);

// Mark notification as read
router.route("/:notificationId/read").patch(isUserAuthenticated, markAsRead);

// Delete / hide notification
router.route("/:notificationId").delete(isUserAuthenticated, deleteNotification);

// Employee event -> notify admins
router.route("/employee-back").post(isAuthenticated, notifyAdminsOnEmployeeBack);

export default router;
